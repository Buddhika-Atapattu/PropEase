// Path: src/app/services/socket/socket-service.ts
//
// SocketService: single gateway for all realtime features
//  - Owns socket.io client instance
//  - Handles auth token wiring, reconnection, keep-alive
//  - Exposes connection telemetry (connected, RTT, clock skew)
//  - Provides a generic event bus + typed emitWithAck
//
// Usage:
//  1) After login:
//       socketService.init({ wsBase: environment.wsBase, token, tokenProvider });
//  2) Observables:
//       socketService.connected$.subscribe(...);
//       socketService.rtt$.subscribe(...);
//       socketService.skewMs$.subscribe(...);
//       socketService.guardToken$.subscribe(...);
//  3) Listen to events:
//       socketService.on<YourPayload>('notification:new', payload => { ... });
//       socketService.events$.subscribe(({event, payload}) => { ... });
//  4) Emit with ack:
//       const resp = await socketService.emitWithAck<Resp>('chat:send', dto, 5000);
//  5) On logout:
//       socketService.disconnect();

import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io, Socket as IoSocket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject, fromEvent } from 'rxjs';
import { environment } from '../../../environments/environment';

// ──────────────────────────────────────────────────────────────────────────────
// Backend ack payload types (keep in sync with src/socket/socket.ts)
// ──────────────────────────────────────────────────────────────────────────────

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
  token?: string;  // initial auth token
  tokenProvider?: () => string | Promise<string>; // optional refresh provider
}

// Generic envelope for the event bus
export interface SocketEventEnvelope {
  event: string;
  payload: unknown;
}

// Guard token payload pushed from backend
export interface GuardTokenPayload {
  token: string;
  issuedAt: number;
  expiresAt: number;
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
    path: '/socket.io'
  };

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

  // Guard token state (BE → FE, auto-refreshed ~5s)
  private readonly _guardToken$ = new BehaviorSubject<GuardTokenPayload | null>( null );
  /** Latest guard token pushed from backend. */
  readonly guardToken$ = this._guardToken$.asObservable();

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

  constructor () {}

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Initialize or reinitialize the socket connection.
   * Call after login or when you want to switch wsBase/path.
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

    const token = opts?.token ?? this.readTokenSafe();
    if ( !token ) {
      console.error( '[realtime] No token – socket not started' );
      return;
    }

    // Reuse existing instance → update auth only
    if ( this.socket ) {
      this.setAuthToken( token );
      if ( !this.socket.connected ) {
        this.socket.connect();
      }
      return;
    }

    // Fresh connection
    this.socket = io( this.opts.wsBase, {
      path: this.opts.path,
      transports: [ 'websocket' ],
      auth: { token },
      withCredentials: false,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5
    } );

    // Guard token auto injection from backend
    this.socket.on( 'guard:update', ( payload: GuardTokenPayload ) => {
      if (
        !payload ||
        typeof payload.token !== 'string' ||
        typeof payload.issuedAt !== 'number' ||
        typeof payload.expiresAt !== 'number'
      ) {
        console.warn( '[realtime] invalid guard:update payload', payload );
        return;
      }
      this._guardToken$.next( payload );
    } );

    // Core connection lifecycle
    this.socket.on( 'connect', () => {
      this._connected$.next( true );
      this.backoffMs = 1500;
      this.sendHello();      // measure RTT & clock skew
      this.startHeartbeat(); // start periodic pings
      console.info( '[realtime] connected', this.socket?.id );
    } );

    this.socket.on( 'disconnect', ( reason: unknown ) => {
      this._connected$.next( false );
      this.stopHeartbeat();
      this._guardToken$.next( null );
      console.error( '[realtime] disconnected:', reason );
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

      console.error( '[realtime] connect_error:', msg );

      if ( msg.toLowerCase().includes( 'unauthorized' ) ) {
        await this.refreshTokenFromProvider();
      }
    } );

    this.socket.on( 'reconnect', ( attempt: number ) => {
      console.info( '[realtime] reconnected, attempt', attempt );
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
      }
    );

    // Browser visibility / network nudges
    this.wireBrowserSignals();
  }

  /** Latest guard token snapshot (for interceptors, etc.). */
  public getLatestGuardToken(): GuardTokenPayload | null {
    return this._guardToken$.value;
  }

  /**
   * Emit an event with ack and timeout.
   * Rejects on timeout or when the server callback comes back with an Error.
   */
  public emitWithAck<TResp = unknown>(
    event: string,
    data: unknown,
    timeoutMs = 5000
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
        }
      );
    } );
  }

  /**
   * Subscribe to a specific event.
   * Use generics to get typed payloads in the handler.
   */
  public on<TPayload = unknown>(
    event: string,
    handler: ( payload: TPayload ) => void
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
        handler as unknown as ( ...args: any[] ) => void
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
   * Push a fresh token to the server without recreating the socket.
   * Backend will call jwt.verify again and rejoin base rooms accordingly.
   */
  public updateToken( token: string ): void {
    if ( !this.socket ) return;
    this.socket.emit( 'auth:update', token );
  }

  /**
   * Cleanly disconnect and release resources (call on logout).
   */
  public disconnect(): void {
    this.stopHeartbeat();
    if ( this.socket ) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this._connected$.next( false );
    this._guardToken$.next( null );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────────────────────────

  /** Update auth token on existing socket instance. */
  private setAuthToken( token: string ): void {
    if ( !this.socket ) return;

    // socket.io client allows setting .auth before reconnect;
    // we go through unknown to avoid the TS structural mismatch warning.
    const sock = this.socket as unknown as { auth?: { token?: string; }; };
    sock.auth = { token };
  }

  private scheduleHello( delayMs: number ): void {
    const jitterFactor = 1 + ( Math.random() * 2 - 1 ) * this.jitterPct; // 0.75..1.25
    const finalDelay = Math.floor( delayMs * jitterFactor );

    if ( this.helloRetryTimer ) {
      clearTimeout( this.helloRetryTimer );
    }

    this.helloRetryTimer = setTimeout(
      () => this.sendHello(),
      finalDelay
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
        this.helloTimeoutMs
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

      console.error( '[realtime] hello failed:', msg );

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
          this.helloTimeoutMs
        );

        const rtt = Math.max( 0, Date.now() - t0 );
        this._rtt$.next( rtt );
      } catch ( err: unknown ) {
        this._connected$.next( false );

        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String( ( err as { message: unknown; } ).message )
            : String( err );

        console.error( '[realtime] heartbeat failed:', msg );
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
        console.warn( '[realtime] browser online – trying to reconnect' );
        this.socket.connect();
      }
    } );

    fromEvent( document, 'visibilitychange' ).subscribe( () => {
      if (
        document.visibilityState === 'visible' &&
        this.socket &&
        !this.socket.connected
      ) {
        console.warn( '[realtime] tab visible – trying to reconnect' );
        this.socket.connect();
      }
    } );
  }

  private readTokenSafe(): string | null {
    try {
      return localStorage.getItem( 'sessionToken' );
    } catch {
      return null;
    }
  }

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
      console.error( '[realtime] token refresh failed', err );
    }
  }
}
