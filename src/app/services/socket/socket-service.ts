// Path: src/app/services/socket/socket-service.ts
//
// SocketService: single gateway for all realtime features
//  - Owns socket.io client instance
//  - Handles auth token wiring, reconnection, keep-alive
//  - Exposes connection telemetry (connected, RTT, clock skew)
//  - Provides a generic event bus + typed emitWithAck
//
// Terminology:
//  - "auth token" (token): JWT / session token used by SocketAuthHelper on BE
//  - "sessionToken": same logical value used by GuardTokenService for guard
//  - "wsToken": WebSocket-only token issued by WsTokenRegistryRedis and
//               validated ONCE during initial Socket.IO handshake.

import { Injectable, inject, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { io, Socket as IoSocket } from "socket.io-client";
import { BehaviorSubject, Observable, Subject, fromEvent } from "rxjs";
import { environment } from "../../../environments/environment";

// ✅ NOTE: fix import path (your previous "./events/..." is wrong for this file)
// Expecting you created: src/app/socket/events/universal-socket.events.ts
import { UniversalSocketEvents } from "./events/universal-socket.events";

// ──────────────────────────────────────────────────────────────────────────────
/** Ack shape for client→server hello. */
type HelloAck = {
  ok: boolean;
  serverTime: number;
};

/**
 * Ack shape for client→server heartbeat:
 *  server responds with { pong: true, ts: t0, serverTs: Date.now() }
 *  but we only use this to detect success; RTT is computed locally.
 */
type PingAck = {
  pong: true;
  ts: number;
  serverTs: number;
};

// Configuration passed into init()
export interface RealtimeOptions {
  wsBase?: string; // e.g. http://localhost:3000 (no trailing slash preferred)
  path?: string; // default: /socket.io

  /**
   * Auth token (typically JWT / sessionToken) used by SocketAuthHelper on BE.
   * This is NOT the wsToken. Normally this is the same token you use for HTTP.
   */
  token?: string;

  /**
   * Optional provider to refresh the AUTH token (JWT) when needed.
   * NOTE: this is for the JWT, not for the guard/session/ws token.
   */
  tokenProvider?: () => string | Promise<string>;

  /**
   * Session token used by GuardTokenService on backend to rotate guard tokens.
   * In your design this is usually the same string as `token`.
   */
  sessionToken?: string;

  /**
   * WebSocket-only token issued by WsTokenRegistryRedis.
   *  - Issued on login / MFA success (or via HTTP rotateWsToken controller)
   *  - Validated once on first WS handshake
   *  - Single-use (one connection)
   */
  wsToken?: string;
}

// Generic envelope for the event bus
export interface SocketEventEnvelope {
  event: string;
  payload: unknown;
}

// Guard token payload pushed from backend (for HTTP ApiGuard)
export interface GuardTokenPayload {
  token: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * WS token payload pushed from backend (for NEXT WebSocket handshake).
 *
 * Backend event: `ws:token:update`
 *   - token      : new wsToken string (single-use)
 *   - issuedAt   : BE timestamp when token was created
 *   - validUntil : milliseconds since epoch when this wsToken expires
 */
export interface WsTokenPushPayload {
  token: string;
  issuedAt: number;
  validUntil: number;
}

export interface ServerTerminatePayload {
  mode: string; // e.g. 'security', 'maintenance', 'manual'
  reason: string; // human-readable reason
  username?: string; // may be omitted in some cases
  socketId?: string; // BE socket.id
  ts?: number; // server timestamp (ms since epoch, from Date.now())
}

type SocketAuthPayload = {
  token: string;
  sessionToken: string;
  wsToken?: string;
};

@Injectable( { providedIn: "root" } )
export class SocketService {
  /**
   * Underlying Socket.IO client instance.
   * Nullable so we can cleanly tear it down on logout.
   */
  private socket: IoSocket | null = null;

  private readonly platformId = inject( PLATFORM_ID );

  // Default connection options; can be overridden via init()
  private opts: Required<Pick<RealtimeOptions, "wsBase" | "path">> = {
    wsBase: ( environment.apiOrigin ?? "http://localhost:3000" ).replace( /\/+$/, "" ),
    path: "/socket.io",
  };

  /**
   * Provider for AUTH token (JWT / sessionToken).
   * Does NOT provide wsToken or guardToken.
   */
  private tokenProvider?: () => string | Promise<string>;

  // ── Connection telemetry exposed to the app ────────────────────────────────

  private readonly _connected$ = new BehaviorSubject<boolean>( false );
  private readonly _rtt$ = new BehaviorSubject<number>( 0 );
  private readonly _skewMs$ = new BehaviorSubject<number>( 0 );

  /** Emits true when connected, false when disconnected. */
  readonly connected$ = this._connected$.asObservable();
  /** Round-trip time estimate in ms (based on client→server pings). */
  readonly rtt$ = this._rtt$.asObservable();
  /** Estimated server clock skew vs client in ms (serverTime - clientEstimate). */
  readonly skewMs$ = this._skewMs$.asObservable();

  // Guard token state (BE → FE, auto-refreshed via guard:update)
  private readonly _guardToken$ = new BehaviorSubject<GuardTokenPayload | null>( null );
  /** Latest guard token pushed from backend. */
  readonly guardToken$ = this._guardToken$.asObservable();

  // WS token state (BE → FE, auto-refreshed via ws:token:update)
  private readonly _wsToken$ = new BehaviorSubject<WsTokenPushPayload | null>( null );
  /**
   * Latest wsToken payload pushed from backend.
   *
   * IMPORTANT:
   *  - This token is NOT used for the current connection (it is single-use).
   *  - It is intended for the NEXT WebSocket handshake (reconnect / new tab).
   */
  readonly wsToken$ = this._wsToken$.asObservable();

  // Keep-alive & reconnection backoff
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private helloRetryTimer?: ReturnType<typeof setTimeout>;
  private backoffMs = 1500; // exponential backoff initial
  private readonly backoffMaxMs = 30_000; // max backoff cap
  private readonly helloTimeoutMs = 4000; // hello ack timeout
  private readonly heartbeatMs = 20_000; // client heartbeat period
  private readonly jitterPct = 0.25; // ±25% jitter

  // Simple event bus if you want to observe everything
  private readonly _event$ = new Subject<SocketEventEnvelope>();
  readonly events$: Observable<SocketEventEnvelope> = this._event$.asObservable();

  // --- Server-driven session termination (security / manual kill) -----------

  private readonly _serverTerminate$ = new Subject<ServerTerminatePayload>();
  /**
   * Emits whenever the backend tells us "this session is terminated".
   * Typical next step: start a short countdown and then force logout.
   */
  readonly serverTerminate$ = this._serverTerminate$.asObservable();

  private readonly _terminationCountdown$ = new BehaviorSubject<number | null>( null );
  /**
   * If not null, represents "seconds until forced logout" after a
   * session:terminated event. You can show a banner like:
   *   "Your session will close in X seconds..."
   */
  readonly terminationCountdown$ = this._terminationCountdown$.asObservable();

  private terminationTimerHandle: ReturnType<typeof setInterval> | null = null;

  private readonly _socketReady$ = new BehaviorSubject<IoSocket | null>( null );
  public readonly socketReady$ = this._socketReady$.asObservable();

  public getSocketSnapshot(): IoSocket | null {
    return this.socket;
  }

  public constructor () {}

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Initialize or reinitialize the socket connection.
   * Call after login or when you want to switch wsBase/path.
   *
   * IMPORTANT:
   *  - opts.token        → AUTH token (JWT / sessionToken)
   *  - opts.sessionToken → same logical value, used for GuardTokenService
   *  - opts.wsToken      → WS-only token used by WsTokenRegistryRedis (handshake only)
   *
   * WS TOKEN FLOW (combined with backend):
   *  - Login / MFA / HTTP rotateWsToken → BE issues wsToken for this user/session.
   *  - You pass that wsToken into SocketService.init({ wsToken }).
   *  - Socket.IO handshake uses that wsToken once (BE consumes it from Redis).
   *  - While connected, backend periodically emits 'ws:token:update' with a
   *    NEW wsToken, which we store and attach to socket.auth for the NEXT
   *    reconnection / new tab.
   */
  public init( opts?: RealtimeOptions ): void {
    if ( !isPlatformBrowser( this.platformId ) ) {
      return;
    }

    // Apply overrides
    if ( opts?.wsBase ) {
      this.opts.wsBase = opts.wsBase.replace( /\/+$/, "" );
    }
    if ( opts?.path ) {
      this.opts.path = opts.path;
    }
    this.tokenProvider = opts?.tokenProvider;

    // AUTH token for SocketAuthHelper (JWT / sessionToken)
    const authToken = opts?.token ?? this.readTokenSafe();
    if ( !authToken ) {
      // eslint-disable-next-line no-console
      console.error( "[Error:] [realtime] No AUTH token – socket not started\n" );
      return;
    }

    // Session token for GuardTokenService.rotateGuardToken (may be same as authToken)
    const sessionToken = opts?.sessionToken ?? authToken;

    // WebSocket-only token for WsTokenRegistryRedis (single-use, handshake only).
    // Priority:
    //   1) Explicit opts.wsToken (fresh from login / HTTP rotateWsToken).
    //   2) Last rotated wsToken from BE (if any), via ws:token:update.
    const lastWsTokenPayload = this._wsToken$.value;
    const wsToken = opts?.wsToken ?? lastWsTokenPayload?.token;

    // Reuse existing instance → update auth only
    if ( this.socket ) {
      this.setAuthToken( authToken, sessionToken, wsToken );
      if ( !this.socket.connected ) {
        this.socket.connect();
      }
      return;
    }

    // Fresh connection
    this.socket = io( this.opts.wsBase, {
      path: this.opts.path,
      transports: [ "websocket" ],
      auth: {
        token: authToken, // used by SocketAuthHelper.extractAuthToken
        sessionToken, // used by SocketAuthHelper.extractSessionToken
        ...( wsToken ? { wsToken } : {} ),
      } satisfies SocketAuthPayload,
      withCredentials: false,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
    } );

    this._socketReady$.next( this.socket );

    // ──────────────────────────────────────────────────────────────────────
    // Server-driven session termination (security kill-switch)
    // ──────────────────────────────────────────────────────────────────────
    this.socket.on( UniversalSocketEvents.Server.SESSION_TERMINATED, ( raw: unknown ) => {
      const payload = this.normalizeServerTerminatePayload( raw );

      // eslint-disable-next-line no-console
      console.error( "[Error:] [realtime] session:terminated from server:", payload, "\n" );

      // Notify whoever subscribes (SessionTerminationService, etc.)
      this._serverTerminate$.next( payload );

      // Start a 10s countdown for auto-logout.
      // Actual logout will be done by a higher-level service.
      this.startTerminationCountdown( 10 );
    } );

    // ──────────────────────────────────────────────────────────────────────
    // Guard token auto injection from backend
    // ──────────────────────────────────────────────────────────────────────
    this.socket.on( UniversalSocketEvents.Server.GUARD_UPDATE, ( payload: unknown ) => {
      const normalized = this.normalizeGuardTokenPayload( payload );
      if ( !normalized ) {
        // eslint-disable-next-line no-console
        console.warn( "[Warning:] [realtime] invalid guard:update payload", payload, "\n" );
        return;
      }
      this._guardToken$.next( normalized );
    } );

    // ──────────────────────────────────────────────────────────────────────
    // WS token rotation from backend (primary wsToken cycle)
    // ──────────────────────────────────────────────────────────────────────
    this.socket.on( UniversalSocketEvents.Server.WS_TOKEN_UPDATE, ( payload: unknown ) => {
      const normalized = this.normalizeWsTokenPayload( payload );
      if ( !normalized ) {
        // eslint-disable-next-line no-console
        console.warn( "[Warning:] [realtime] invalid ws:token:update payload", payload, "\n" );
        return;
      }
      this.applyWsTokenUpdate( normalized );
    } );

    // ──────────────────────────────────────────────────────────────────────
    // Core connection lifecycle
    // ──────────────────────────────────────────────────────────────────────
    this.socket.on( "connect", () => {
      this._connected$.next( true );
      this.backoffMs = 1500;
      void this.sendHello(); // measure RTT & clock skew
      this.startHeartbeat(); // start periodic pings
    } );

    this.socket.on( "disconnect", ( reason: unknown ) => {
      this._connected$.next( false );
      this.stopHeartbeat();

      // On generic disconnect we keep _wsToken$ as-is because the last token
      // pushed from BE is intended for the NEXT connection attempt.
      this._guardToken$.next( null );

      // eslint-disable-next-line no-console
      console.error( "[Error:] [realtime] disconnected:", reason, "\n" );

      this.scheduleHello( this.backoffMs );
      this.backoffMs = Math.min( this.backoffMs * 2, this.backoffMaxMs );
    } );

    // Bubble all events into local bus — useful for logging/meta-handlers
    this.socket.onAny( ( event: string, payload: unknown ) => {
      this._event$.next( { event, payload } );
    } );

    // Connection / auth errors
    this.socket.on( "connect_error", async ( err: unknown ) => {
      this._connected$.next( false );

      const msg =
        err && typeof err === "object" && "message" in err
          ? String( ( err as { message: unknown; } ).message )
          : String( err );

      // eslint-disable-next-line no-console
      console.error( "[Error:] [realtime] connect_error:", msg, "\n" );

      if ( msg.toLowerCase().includes( "unauthorized" ) ) {
        await this.refreshTokenFromProvider();
      }
    } );

    // Server greetings / keepalive hooks
    this.socket.on( UniversalSocketEvents.Server.SERVER_HELLO, () => void this.sendHello() );

    this.socket.on(
      UniversalSocketEvents.Server.SERVER_PING,
      ( _payload: unknown, ack?: ( clientNow: number ) => void ) => {
        if ( ack ) ack( Date.now() );
      }
    );

    // Browser visibility / network nudges
    this.wireBrowserSignals();
  }

  /** Latest guard token snapshot (for interceptors, etc.). */
  public getLatestGuardToken(): GuardTokenPayload | null {
    return this._guardToken$.value;
  }

  /** Latest wsToken payload snapshot (for debugging / last-resort flows). */
  public getLatestWsToken(): WsTokenPushPayload | null {
    return this._wsToken$.value;
  }

  /**
   * Emit an event with ack and timeout.
   * Rejects on timeout or when the server callback comes back with an Error.
   */
  public emitWithAck<TResp = unknown>( event: string, data: unknown, timeoutMs = 5000 ): Promise<TResp> {
    return new Promise<TResp>( ( resolve, reject ) => {
      if ( !this.socket ) {
        reject( new Error( "socket not initialized" ) );
        return;
      }

      this.socket.timeout( timeoutMs ).emit( event, data, ( err: Error | null | undefined, resp?: TResp ) => {
        if ( err ) {
          reject( err );
          return;
        }
        resolve( resp as TResp );
      } );
    } );
  }

  /**
   * Subscribe to a specific event.
   * Use generics to get typed payloads in the handler.
   */
  public on<TPayload = unknown>( event: string, handler: ( payload: TPayload ) => void ): void {
    this.socket?.on( event, handler as unknown as ( payload: unknown ) => void );
  }

  /**
   * Remove a specific handler or all handlers for an event.
   */
  public off( event: string, handler?: ( ...args: unknown[] ) => void ): void {
    if ( !this.socket ) return;

    if ( handler ) {
      this.socket.off( event, handler as unknown as ( ...args: unknown[] ) => void );
    } else {
      this.socket.off( event );
    }
  }

  /**
   * Request server-side room subscription(s).
   * Example: joinRooms(['tenant:123', 'lease:abc']);
   */
  public joinRooms( rooms: string[] ): void {
    const safeRooms = this.safeRoomList( rooms );
    if ( safeRooms.length === 0 ) return;
    this.socket?.emit( UniversalSocketEvents.Client.SUBSCRIBE, safeRooms );
  }

  /**
   * Request server-side room unsubscription(s).
   */
  public leaveRooms( rooms: string[] ): void {
    const safeRooms = this.safeRoomList( rooms );
    if ( safeRooms.length === 0 ) return;
    this.socket?.emit( UniversalSocketEvents.Client.UNSUBSCRIBE, safeRooms );
  }

  /**
   * Push a fresh AUTH token (JWT / sessionToken) to the server without
   * recreating the socket. Backend will decode + rejoin base rooms accordingly.
   */
  public updateToken( token: string ): void {
    if ( !this.socket ) return;
    const t = typeof token === "string" ? token.trim() : "";
    if ( !t ) return;
    this.socket.emit( UniversalSocketEvents.Client.AUTH_UPDATE, t );
  }

  /**
   * Cleanly disconnect and release resources (call on logout).
   *
   * IMPORTANT:
   *  - This is a logical logout; we clear both guardToken and wsToken state.
   *  - For transient disconnects (network issues), backend 'disconnect' handler
   *    runs but we DO NOT clear _wsToken$ there, so the last rotated wsToken
   *    can still be used for the next reconnect attempt.
   */
  public disconnect(): void {
    this.stopHeartbeat();

    if ( this.terminationTimerHandle ) {
      clearInterval( this.terminationTimerHandle );
      this.terminationTimerHandle = null;
    }
    this._terminationCountdown$.next( null );

    if ( this.socket ) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this._socketReady$.next( null );
    this._connected$.next( false );
    this._guardToken$.next( null );
    this._wsToken$.next( null );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Normalize server termination payload without using `as any`.
   * Keeps optional fields OMITTED when missing.
   */
  private normalizeServerTerminatePayload( raw: unknown ): ServerTerminatePayload {
    const obj = raw && typeof raw === "object" ? ( raw as Record<string, unknown> ) : {};

    const mode = typeof obj[ "mode" ] === "string" ? obj[ "mode" ] : "unknown";
    const reason = typeof obj[ "reason" ] === "string" ? obj[ "reason" ] : "unknown";

    const username = typeof obj[ "username" ] === "string" ? obj[ "username" ] : undefined;
    const socketId = typeof obj[ "socketId" ] === "string" ? obj[ "socketId" ] : undefined;
    const ts = typeof obj[ "ts" ] === "number" ? obj[ "ts" ] : Date.now();

    const out: ServerTerminatePayload = { mode, reason, ts };
    if ( username ) out.username = username;
    if ( socketId ) out.socketId = socketId;

    return out;
  }

  /**
   * Guard token payload validator/normalizer.
   * Returns null if invalid.
   */
  private normalizeGuardTokenPayload( raw: unknown ): GuardTokenPayload | null {
    if ( !raw || typeof raw !== "object" ) return null;
    const obj = raw as Record<string, unknown>;

    const token = typeof obj[ "token" ] === "string" ? obj[ "token" ].trim() : "";
    const issuedAt = typeof obj[ "issuedAt" ] === "number" ? obj[ "issuedAt" ] : NaN;
    const expiresAt = typeof obj[ "expiresAt" ] === "number" ? obj[ "expiresAt" ] : NaN;

    if ( !token || !Number.isFinite( issuedAt ) || !Number.isFinite( expiresAt ) ) return null;

    return { token, issuedAt, expiresAt };
  }

  /**
   * WS token payload validator/normalizer.
   * Returns null if invalid.
   */
  private normalizeWsTokenPayload( raw: unknown ): WsTokenPushPayload | null {
    if ( !raw || typeof raw !== "object" ) return null;
    const obj = raw as Record<string, unknown>;

    const token = typeof obj[ "token" ] === "string" ? obj[ "token" ].trim() : "";
    const issuedAt = typeof obj[ "issuedAt" ] === "number" ? obj[ "issuedAt" ] : NaN;
    const validUntil = typeof obj[ "validUntil" ] === "number" ? obj[ "validUntil" ] : NaN;

    if ( !token || !Number.isFinite( issuedAt ) || !Number.isFinite( validUntil ) ) return null;

    return { token, issuedAt, validUntil };
  }

  /**
   * Apply WS token update (store + patch socket.auth.wsToken).
   * This does NOT affect current connection; it is used for NEXT handshake.
   */
  private applyWsTokenUpdate( payload: WsTokenPushPayload ): void {
    // Store latest wsToken (for next handshake / debug).
    this._wsToken$.next( payload );

    // Patch socket.auth.wsToken so next reconnect uses this token.
    if ( !this.socket ) return;

    const sock = this.socket as unknown as { auth?: Record<string, unknown>; };
    const previous = sock.auth && typeof sock.auth === "object" ? sock.auth : {};

    sock.auth = {
      ...previous,
      wsToken: payload.token,
    };
  }

  /**
   * Start a "forced logout in N seconds" countdown.
   *
   * This does NOT perform logout itself; it just:
   *  - Emits countdown seconds via terminationCountdown$.
   *  - Stops at 0 and leaves the actual logout to whoever listens.
   */
  private startTerminationCountdown( seconds: number ): void {
    // Clean any previous countdown
    if ( this.terminationTimerHandle ) {
      clearInterval( this.terminationTimerHandle );
      this.terminationTimerHandle = null;
    }

    let remaining = Math.max( 0, Math.floor( seconds ) );
    this._terminationCountdown$.next( remaining );

    if ( remaining === 0 ) return;

    this.terminationTimerHandle = setInterval( () => {
      remaining -= 1;

      if ( remaining <= 0 ) {
        this._terminationCountdown$.next( 0 );

        if ( this.terminationTimerHandle ) {
          clearInterval( this.terminationTimerHandle );
          this.terminationTimerHandle = null;
        }

        // IMPORTANT:
        //  - Do NOT logout here.
        //  - High-level service should subscribe and logout at 0.
        return;
      }

      this._terminationCountdown$.next( remaining );
    }, 1_000 );
  }

  /**
   * Update AUTH + session + ws tokens on existing socket instance.
   *
   * NOTE:
   *  - For Socket.IO client, `socket.auth` is used on the *next* connect()
   *    attempt. Changing it here will affect reconnection attempts triggered
   *    by Socket.IO or by you explicitly calling socket.connect().
   */
  private setAuthToken( token: string, sessionToken?: string, wsToken?: string ): void {
    if ( !this.socket ) return;

    const t = typeof token === "string" ? token.trim() : "";
    const s = typeof sessionToken === "string" ? sessionToken.trim() : "";
    const w = typeof wsToken === "string" ? wsToken.trim() : "";

    const sock = this.socket as unknown as { auth?: Record<string, unknown>; };
    const previous = sock.auth && typeof sock.auth === "object" ? sock.auth : {};

    // token + sessionToken are required in our shape
    const nextAuth: Record<string, unknown> = {
      ...previous,
      token: t,
      sessionToken: s || previous[ "sessionToken" ],
    };

    // wsToken is optional -> OMIT when empty
    if ( w ) {
      nextAuth[ "wsToken" ] = w;
    }

    sock.auth = nextAuth;
  }

  private scheduleHello( delayMs: number ): void {
    const jitterFactor = 1 + ( Math.random() * 2 - 1 ) * this.jitterPct; // 0.75..1.25
    const finalDelay = Math.floor( delayMs * jitterFactor );

    if ( this.helloRetryTimer ) {
      clearTimeout( this.helloRetryTimer );
    }

    this.helloRetryTimer = setTimeout( () => void this.sendHello(), finalDelay );
  }

  /**
   * Send a client→server “hello”:
   *  - Backend responds with { ok, serverTime }
   *  - Used to measure RTT and estimate clock skew.
   */
  private async sendHello(): Promise<void> {
    if ( !this.socket || !this.socket.connected ) {
      return;
    }

    const t0 = Date.now();

    try {
      const resp = await this.emitWithAck<HelloAck>(
        UniversalSocketEvents.Client.CLIENT_HELLO,
        { app: "prop-ease-ui", ver: "1.0.0", t: t0 },
        this.helloTimeoutMs
      );

      if ( !resp?.ok ) {
        throw new Error( "hello not ok" );
      }

      const rtt = Math.max( 0, Date.now() - t0 );
      this._rtt$.next( rtt );

      // Assume symmetric latency: serverTime ≈ client(t0 + rtt/2)
      const estimatedClientAtServerNow = t0 + rtt / 2;
      const skew = resp.serverTime - estimatedClientAtServerNow;
      this._skewMs$.next( skew );

      // Periodically refresh skew
      this.scheduleHello( 120_000 );
    } catch ( err: unknown ) {
      this._connected$.next( false );

      const msg =
        err && typeof err === "object" && "message" in err
          ? String( ( err as { message: unknown; } ).message )
          : String( err );

      // eslint-disable-next-line no-console
      console.error( "[Error:] [realtime] hello failed:", msg, "\n" );

      this.scheduleHello( this.backoffMs );
      this.backoffMs = Math.min( this.backoffMs * 2, this.backoffMaxMs );
    }
  }

  /**
   * Start periodic client→server heartbeat using `client:ping`.
   * RTT is updated on each successful ping.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    if ( !this.socket ) return;

    this.heartbeatTimer = setInterval( async () => {
      if ( !this.socket || !this.socket.connected ) {
        return;
      }

      const t0 = Date.now();

      try {
        await this.emitWithAck<PingAck>(
          UniversalSocketEvents.Client.CLIENT_PING,
          { t0 },
          this.helloTimeoutMs
        );

        const rtt = Math.max( 0, Date.now() - t0 );
        this._rtt$.next( rtt );
      } catch ( err: unknown ) {
        this._connected$.next( false );

        const msg =
          err && typeof err === "object" && "message" in err
            ? String( ( err as { message: unknown; } ).message )
            : String( err );

        // eslint-disable-next-line no-console
        console.error( "[Error:] [realtime] heartbeat failed:", msg, "\n" );
      }
    }, this.heartbeatMs );
  }

  private stopHeartbeat(): void {
    if ( this.heartbeatTimer ) {
      clearInterval( this.heartbeatTimer );
      this.heartbeatTimer = undefined;
    }
  }

  private wireBrowserSignals(): void {
    if ( !isPlatformBrowser( this.platformId ) ) {
      return;
    }

    fromEvent( window, "online" ).subscribe( () => {
      if ( this.socket && !this.socket.connected ) {
        // eslint-disable-next-line no-console
        console.warn( "[Warning:] [realtime] browser online – trying to reconnect\n" );
        this.socket.connect();
      }
    } );

    fromEvent( document, "visibilitychange" ).subscribe( () => {
      if ( document.visibilityState === "visible" && this.socket && !this.socket.connected ) {
        // eslint-disable-next-line no-console
        console.warn( "[Warning:] [realtime] tab visible – trying to reconnect\n" );
        this.socket.connect();
      }
    } );
  }

  private safeRoomList( v: unknown ): string[] {
    if ( !Array.isArray( v ) ) return [];
    const out: string[] = [];
    for ( const x of v ) {
      const s = typeof x === "string" ? x.trim() : "";
      if ( s && s !== "undefined" && s !== "null" ) out.push( s );
    }
    return out;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Token sources
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Read AUTH token (JWT / sessionToken) from storage.
   *
   * Supports both:
   *  - 'auth_token'    (if you introduce a dedicated JWT key)
   *  - 'sessionToken'  (current implementation from AuthService)
   */
  private readTokenSafe(): string | null {
    try {
      const authToken = localStorage.getItem( "auth_token" );
      if ( authToken && authToken.trim().length > 0 ) {
        return authToken.trim();
      }

      const session = localStorage.getItem( "sessionToken" );
      if ( session && session.trim().length > 0 ) {
        return session.trim();
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Refresh AUTH token (JWT / sessionToken) via tokenProvider and push it
   * to backend using `auth:update`. SessionToken / wsToken are NOT touched.
   */
  private async refreshTokenFromProvider(): Promise<void> {
    if ( !this.tokenProvider || !this.socket ) {
      return;
    }

    try {
      const newToken = await this.tokenProvider();
      const t = typeof newToken === "string" ? newToken.trim() : "";
      if ( t ) {
        this.socket.emit( UniversalSocketEvents.Client.AUTH_UPDATE, t );
      }
    } catch ( err: unknown ) {
      // eslint-disable-next-line no-console
      console.error( "[Error:] [realtime] token refresh failed", err, "\n" );
    }
  }
}
