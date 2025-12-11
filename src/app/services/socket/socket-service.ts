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

import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io, Socket as IoSocket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject, fromEvent } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  path?: string;   // default: /socket.io

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
  mode: string;          // e.g. 'security', 'maintenance', 'manual'
  reason: string;        // human-readable reason
  username?: string;     // may be omitted in some cases
  socketId?: string;     // BE socket.id
  ts?: number;           // server timestamp (ms since epoch, from Date.now())
}

@Injectable( { providedIn: 'root' } )
export class SocketService {
  /**
   * Underlying Socket.IO client instance.
   * Nullable so we can cleanly tear it down on logout.
   */
  private socket: IoSocket | null = null;

  private readonly platformId = inject( PLATFORM_ID );

  // Default connection options; can be overridden via init()
  private opts: Required<Pick<RealtimeOptions, 'wsBase' | 'path'>> = {
    wsBase: ( environment.apiOrigin ?? 'http://localhost:3000' ).replace( /\/+$/, '' ),
    path: '/socket.io',
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
  private backoffMs = 1500;                   // exponential backoff initial
  private readonly backoffMaxMs = 30_000;     // max backoff cap
  private readonly helloTimeoutMs = 4000;     // hello ack timeout
  private readonly heartbeatMs = 20_000;      // client heartbeat period
  private readonly jitterPct = 0.25;          // ±25% jitter

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


  constructor () {}

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
      this.opts.wsBase = opts.wsBase.replace( /\/+$/, '' );
    }
    if ( opts?.path ) {
      this.opts.path = opts.path;
    }
    this.tokenProvider = opts?.tokenProvider;

    // AUTH token for SocketAuthHelper (JWT / sessionToken)
    const authToken = opts?.token ?? this.readTokenSafe();
    if ( !authToken ) {
      console.error( '[Error:] [realtime] No AUTH token – socket not started\n' );
      return;
    }

    // Session token for GuardTokenService.rotateGuardToken (may be same as authToken)
    const sessionToken = opts?.sessionToken ?? authToken;

    // WebSocket-only token for WsTokenRegistryRedis (single-use, handshake only).
    // Priority:
    //   1) Explicit opts.wsToken (fresh from login / HTTP rotateWsToken).
    //   2) Last rotated wsToken from BE (if any), via ws:token:update.
    const lastWsTokenPayload = this._wsToken$.value;
    const wsToken = opts?.wsToken ?? ( lastWsTokenPayload?.token ?? undefined );

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
      transports: [ 'websocket' ],
      auth: {
        token: authToken,   // used by SocketAuthHelper.extractAuthToken
        sessionToken,       // used by SocketAuthHelper.extractSessionToken
        wsToken             // used by SocketAuthHelper.extractWsToken / WsTokenRegistryRedis
      },
      withCredentials: false,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
    } );

    // ──────────────────────────────────────────────────────────────────────
    // Catch the server termiation
    // ──────────────────────────────────────────────────────────────────────
    // ──────────────────────────────────────────────────────────────────────
    // Server-driven session termination (security kill-switch)
    // ──────────────────────────────────────────────────────────────────────
    this.socket.on(
      'session:terminated',
      ( raw: ServerTerminatePayload | unknown ) => {
        // Normalise payload to a safe structure
        const payload: ServerTerminatePayload = {
          mode: typeof ( raw as any )?.mode === 'string'
            ? ( raw as any ).mode
            : 'unknown',
          reason: typeof ( raw as any )?.reason === 'string'
            ? ( raw as any ).reason
            : 'unknown',
          username: typeof ( raw as any )?.username === 'string'
            ? ( raw as any ).username
            : undefined,
          socketId: typeof ( raw as any )?.socketId === 'string'
            ? ( raw as any ).socketId
            : undefined,
          ts: typeof ( raw as any )?.ts === 'number'
            ? ( raw as any ).ts
            : Date.now()
        };

        console.error(
          '[Error:] [realtime] session:terminated from server:',
          payload,
          '\n'
        );

        // Notify whoever subscribes (your new SessionTerminationService, etc.)
        this._serverTerminate$.next( payload );

        // Start a 10s countdown for auto-logout.
        // Actual logout will be done by a higher-level service.
        this.startTerminationCountdown( 10 );
      }
    );



    // ──────────────────────────────────────────────────────────────────────
    // Guard token auto injection from backend
    // ──────────────────────────────────────────────────────────────────────
    this.socket.on( 'guard:update', ( payload: GuardTokenPayload ) => {
      if (
        !payload ||
        typeof payload.token !== 'string' ||
        typeof payload.issuedAt !== 'number' ||
        typeof payload.expiresAt !== 'number'
      ) {
        console.warn( '[Warning:] [realtime] invalid guard:update payload', payload, '\n' );
        return;
      }
      this._guardToken$.next( payload );
    } );

    // ──────────────────────────────────────────────────────────────────────
    // WS token rotation from backend (primary wsToken cycle)
    // ──────────────────────────────────────────────────────────────────────
    //
    // Backend logic:
    //   - SocketConnectionHandler.registerWsTokenRotation(...) periodically
    //     calls WsTokenRegistryRedis.rotateToken(sessionId) and emits
    //     'ws:token:update' with a fresh wsToken.
    //
    // Frontend logic here:
    //   - Validate ws:token:update payload.
    //   - Store last payload in BehaviorSubject.
    //   - Patch socket.auth.wsToken so NEXT reconnect uses the fresh wsToken.
    //
    this.socket.on( 'ws:token:update', ( payload: WsTokenPushPayload ) => {
      this.handleWsTokenUpdate( payload );
    } );

    // ──────────────────────────────────────────────────────────────────────
    // Core connection lifecycle
    // ──────────────────────────────────────────────────────────────────────
    this.socket.on( 'connect', () => {
      this._connected$.next( true );
      this.backoffMs = 1500;
      this.sendHello();      // measure RTT & clock skew
      this.startHeartbeat(); // start periodic pings
    } );

    this.socket.on( 'disconnect', ( reason: unknown ) => {
      this._connected$.next( false );
      this.stopHeartbeat();
      // On generic disconnect we keep _wsToken$ as-is because the last token
      // pushed from BE is intended for the NEXT connection attempt.
      this._guardToken$.next( null );
      console.error( '[Error:] [realtime] disconnected:', reason, '\n' );
      this.scheduleHello( this.backoffMs );
      this.backoffMs = Math.min( this.backoffMs * 2, this.backoffMaxMs );
    } );

    // Bubble all events into local bus — useful for logging/meta-handlers
    this.socket.onAny( ( event: string, payload: unknown ) => {
      this._event$.next( { event, payload } );
    } );

    // Connection / auth errors
    this.socket.on( 'connect_error', async ( err: unknown ) => {
      this._connected$.next( false );

      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String( ( err as { message: unknown; } ).message )
          : String( err );

      console.error( '[Error:] [realtime] connect_error:', msg, '\n' );

      if ( msg.toLowerCase().includes( 'unauthorized' ) ) {
        await this.refreshTokenFromProvider();
      }
    } );

    this.socket.on( 'reconnect', () => {
      this.sendHello();
      this.startHeartbeat();
    } );

    // Server greetings / keepalive hooks
    this.socket.on( 'server:hello', () => this.sendHello() );
    this.socket.on(
      'server:ping',
      ( _payload: unknown, ack?: ( clientNow: number ) => void ) => {
        if ( ack ) {
          ack( Date.now() );
        }
      },
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
  public emitWithAck<TResp = unknown>(
    event: string,
    data: unknown,
    timeoutMs = 5000,
  ): Promise<TResp> {
    return new Promise<TResp>( ( resolve, reject ) => {
      if ( !this.socket ) {
        reject( new Error( 'socket not initialized' ) );
        return;
      }

      this.socket.timeout( timeoutMs ).emit(
        event,
        data,
        ( err: Error | null | undefined, resp?: TResp ) => {
          if ( err ) {
            reject( err );
            return;
          }
          resolve( resp as TResp );
        },
      );
    } );
  }

  /**
   * Subscribe to a specific event.
   * Use generics to get typed payloads in the handler.
   */
  public on<TPayload = unknown>(
    event: string,
    handler: ( payload: TPayload ) => void,
  ): void {
    this.socket?.on( event, handler as ( payload: unknown ) => void );
  }

  /**
   * Remove a specific handler or all handlers for an event.
   */
  public off( event: string, handler?: ( ...args: unknown[] ) => void ): void {
    if ( !this.socket ) {
      return;
    }

    if ( handler ) {
      this.socket.off(
        event,
        handler as unknown as ( ...args: any[] ) => void,
      );
    } else {
      this.socket.off( event );
    }
  }

  /**
   * Request server-side room subscription(s).
   * Example: joinRooms(['tenant:123', 'lease:abc']);
   */
  public joinRooms( rooms: string[] ): void {
    if ( !rooms || rooms.length === 0 ) return;
    this.socket?.emit( 'client:subscribe', rooms );
  }

  /**
   * Request server-side room unsubscription(s).
   */
  public leaveRooms( rooms: string[] ): void {
    if ( !rooms || rooms.length === 0 ) return;
    this.socket?.emit( 'client:unsubscribe', rooms );
  }

  /**
   * Push a fresh AUTH token (JWT / sessionToken) to the server without
   * recreating the socket. Backend will call jwt.verify again and rejoin
   * base rooms accordingly.
   */
  public updateToken( token: string ): void {
    if ( !this.socket ) return;
    this.socket.emit( 'auth:update', token );
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

    this._connected$.next( false );
    this._guardToken$.next( null );
    this._wsToken$.next( null );
  }


  // ──────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────────────────────────

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

    if ( remaining === 0 ) {
      return;
    }

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
        //  - Your new high-level service should be subscribed to
        //    terminationCountdown$ and call AuthService.logout()
        //    when it sees 0.
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
  private setAuthToken(
    token: string,
    sessionToken?: string,
    wsToken?: string,
  ): void {
    if ( !this.socket ) return;

    const sock = this.socket as unknown as {
      auth?: { token?: string; sessionToken?: string; wsToken?: string; };
    };

    const previous = sock.auth ?? {};
    sock.auth = {
      token,
      sessionToken: sessionToken ?? previous.sessionToken,
      wsToken: wsToken ?? previous.wsToken,
    };
  }

  /**
   * Handle incoming ws:token:update payload from backend.
   *
   * Responsibilities:
   *  - Validate payload.
   *  - Store in _wsToken$ for observers / debugging.
   *  - Patch socket.auth.wsToken so NEXT handshake uses this token.
   *
   * This does NOT affect the current connection; wsToken is consumed only
   * during handshake on the backend side (WsTokenRegistryRedis.consumeToken).
   */
  private handleWsTokenUpdate( payload: WsTokenPushPayload ): void {
    try {
      if (
        !payload ||
        typeof payload.token !== 'string' ||
        payload.token.trim().length === 0 ||
        typeof payload.issuedAt !== 'number' ||
        typeof payload.validUntil !== 'number'
      ) {
        console.warn(
          '[Warning:] [realtime] invalid ws:token:update payload',
          payload,
          '\n'
        );
        return;
      }

      const normalized: WsTokenPushPayload = {
        token: payload.token.trim(),
        issuedAt: payload.issuedAt,
        validUntil: payload.validUntil,
      };

      // Remember latest wsToken (for next handshake / debug).
      this._wsToken$.next( normalized );

      // Also patch socket.auth.wsToken so next reconnect uses this token.
      if ( this.socket ) {
        const sock = this.socket as unknown as {
          auth?: { token?: string; sessionToken?: string; wsToken?: string; };
        };

        const previous = sock.auth ?? {};
        sock.auth = {
          ...previous,
          wsToken: normalized.token,
        };
      }

      // console.info(
      //   '[Success:] [realtime] ws:token:update applied. validUntil=',
      //   new Date(normalized.validUntil).toISOString(),
      //   '\n'
      // );
    } catch ( err: unknown ) {
      console.error(
        '[Error:] [realtime] handleWsTokenUpdate failed:',
        err,
        '\n'
      );
    }
  }

  private scheduleHello( delayMs: number ): void {
    const jitterFactor = 1 + ( Math.random() * 2 - 1 ) * this.jitterPct; // 0.75..1.25
    const finalDelay = Math.floor( delayMs * jitterFactor );

    if ( this.helloRetryTimer ) {
      clearTimeout( this.helloRetryTimer );
    }

    this.helloRetryTimer = setTimeout(
      () => this.sendHello(),
      finalDelay,
    );
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
        'client:hello',
        { app: 'prop-ease-ui', ver: '1.0.0', t: t0 },
        this.helloTimeoutMs,
      );

      if ( !resp?.ok ) {
        throw new Error( 'hello not ok' );
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
        err && typeof err === 'object' && 'message' in err
          ? String( ( err as { message: unknown; } ).message )
          : String( err );

      console.error( '[Error:] [realtime] hello failed:', msg, '\n' );

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
          'client:ping',
          { t0 },
          this.helloTimeoutMs,
        );

        const rtt = Math.max( 0, Date.now() - t0 );
        this._rtt$.next( rtt );
      } catch ( err: unknown ) {
        this._connected$.next( false );

        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String( ( err as { message: unknown; } ).message )
            : String( err );

        console.error( '[Error:] [realtime] heartbeat failed:', msg, '\n' );
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

    fromEvent( window, 'online' ).subscribe( () => {
      if ( this.socket && !this.socket.connected ) {
        console.warn( '[Warning:] [realtime] browser online – trying to reconnect\n' );
        this.socket.connect();
      }
    } );

    fromEvent( document, 'visibilitychange' ).subscribe( () => {
      if (
        document.visibilityState === 'visible' &&
        this.socket &&
        !this.socket.connected
      ) {
        console.warn( '[Warning:] [realtime] tab visible – trying to reconnect\n' );
        this.socket.connect();
      }
    } );
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
      const authToken = localStorage.getItem( 'auth_token' );
      if ( authToken && authToken.trim().length > 0 ) {
        return authToken.trim();
      }

      const session = localStorage.getItem( 'sessionToken' );
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
      if ( newToken ) {
        this.socket.emit( 'auth:update', newToken );
      }
    } catch ( err: unknown ) {
      console.error( '[Error:] [realtime] token refresh failed', err, '\n' );
    }
  }
}
