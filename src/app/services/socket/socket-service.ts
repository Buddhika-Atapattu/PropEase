// Path kept as-is for future imports:
// src/app/services/socket/socket-service.ts
//
// SocketService: a single, reusable gateway for all realtime features
// (notifications, chat, calls). It owns the Socket.IO client, keep-alive,
// reconnection strategy, and a simple event bus.
//
// How to use:
//   1) After login:
//        socketService.init({ wsBase: environment.wsBase, token, tokenProvider });
//   2) Subscribe to connection status/RTT:
//        socketService.connected$.subscribe(...)
//        socketService.rtt$.subscribe(...)
//   3) Listen to server events:
//        socketService.on<YourType>('some:event', payload => { ... });
//      or use the generic bus:
//        socketService.events$.subscribe(({event, payload}) => { ... });
//   4) Emit with ack + timeout:
//        const resp = await socketService.emitWithAck<RespType>('event', data, 5000);
//   5) On logout:
//        socketService.disconnect();

import {Injectable, inject, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {io, Socket as IoSocket} from 'socket.io-client';
import {BehaviorSubject, Observable, Subject, fromEvent} from 'rxjs';

// Types for ack payloads your server returns
type HelloAck = {ok: boolean; serverTime: number};
type PingAck = {t1: number};

// Configuration you can pass on init()
export interface RealtimeOptions {
  wsBase?: string;                 // e.g. http://localhost:3000
  path?: string;                   // default: /socket.io
  token?: string;                  // initial auth token
  tokenProvider?: () => string | Promise<string>; // refresh token on demand
}

@Injectable({providedIn: 'root'})
export class SocketService {
  // IMPORTANT: nullable; we set to `null` on disconnect.
  private socket: IoSocket | null = null;

  private platformId = inject(PLATFORM_ID);

  // Default options (WS base + path). You can override in init().
  private opts: Required<Pick<RealtimeOptions, 'wsBase' | 'path'>> = {
    wsBase: 'http://localhost:3000',
    path: '/socket.io',
  };
  private tokenProvider?: () => string | Promise<string>;

  // ── Connection telemetry exposed to the app
  private _connected$ = new BehaviorSubject<boolean>(false);
  private _rtt$ = new BehaviorSubject<number>(0);
  private _skewMs$ = new BehaviorSubject<number>(0);

  /** Emits true when connected, false otherwise. */
  readonly connected$ = this._connected$.asObservable();
  /** Round-trip time estimate (ms). */
  readonly rtt$ = this._rtt$.asObservable();
  /** Estimated server clock skew vs client (ms). */
  readonly skewMs$ = this._skewMs$.asObservable();

  // ── Keep-alive settings
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private helloRetryTimer?: ReturnType<typeof setTimeout>;
  private backoffMs = 1500;                 // exponential backoff start
  private readonly backoffMaxMs = 30_000; // cap backoff at 30s
  private readonly helloTimeoutMs = 4000;   // hello ack timeout
  private readonly heartbeatMs = 20_000; // ping every 20s
  private readonly jitterPct = 0.25;   // +-25% jitter on retries

  // ── Simple event bus (if you want to observe all events in one place)
  private _event$ = new Subject<{event: string; payload: any}>();
  readonly events$: Observable<{event: string; payload: any}> = this._event$.asObservable();

  constructor () {}

  /** Initialize or reinitialize Socket.IO */
  public init(opts?: RealtimeOptions): void {
    if(!isPlatformBrowser(this.platformId)) return;

    if(opts?.wsBase) this.opts.wsBase = opts.wsBase.replace(/\/+$/, '');
    if(opts?.path) this.opts.path = opts.path;
    this.tokenProvider = opts?.tokenProvider;

    const token = opts?.token ?? this.readTokenSafe();
    if(!token) {
      console.error('[realtime] No token – socket not started');
      return;
    }

    // If socket exists, update auth & reconnect if needed.
    if(this.socket) {
      (this.socket as any).auth = {token};
      if(!this.socket.connected) this.socket.connect();
      return;
    }

    // Fresh connection
    this.socket = io(this.opts.wsBase, {
      path: this.opts.path,
      transports: ['websocket'],
      auth: {token},
      withCredentials: false,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
    });

    // ── Core connection lifecycle
    this.socket.on('connect', () => {
      this._connected$.next(true);
      this.backoffMs = 1500;
      this.sendHello();      // measure RTT & skew early
      this.startHeartbeat(); // begin periodic pings
      console.info('[realtime] connected', this.socket?.id);
    });

    this.socket.on('disconnect', (reason: string) => {
      this._connected$.next(false);
      this.stopHeartbeat();
      console.error('[realtime] disconnected:', reason);
      // schedule hello with backoff, in case reconnection is slow
      this.scheduleHello(this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, this.backoffMaxMs);
    });

    // ── Bubble all events to the bus (optional but handy)
    this.socket.onAny((event, payload) => {
      this._event$.next({event, payload});
    });

    // ── Errors
    this.socket.on('connect_error', async (err: any) => {
      this._connected$.next(false);
      console.error('[realtime] connect_error:', err?.message || err);
      if(String(err?.message || '').toLowerCase().includes('unauthorized')) {
        await this.refreshTokenFromProvider();
      }
    });

    this.socket.on('reconnect', (attempt) => {
      console.info('[realtime] reconnected, attempt', attempt);
      this.sendHello();
      this.startHeartbeat();
    });

    // ── Minimal server greetings/keepalive
    this.socket.on('server:hello', () => this.sendHello());
    this.socket.on('server:ping', (_payload: any, ack?: (clientNow: number) => void) => {
      ack?.(Date.now());
    });

    // ── Browser visibility/network nudges
    this.wireBrowserSignals();
  }

  /** Emit with ack + timeout (rejects on timeout or server error). */
  public emitWithAck<TResp = any>(event: string, data: any, timeoutMs = 5000): Promise<TResp> {
    return new Promise<TResp>((resolve, reject) => {
      if(!this.socket) return reject(new Error('socket not initialized'));
      this.socket.timeout(timeoutMs).emit(event, data, (err?: Error, resp?: TResp) => {
        if(err) return reject(err);
        resolve(resp as TResp);
      });
    });
  }

  /** Subscribe to a specific event (typed). */
  public on<T = any>(event: string, handler: (payload: T) => void): void {
    this.socket?.on(event, handler as any);
  }

  /** Remove a specific handler, or all handlers for an event. */
  public off(event: string, handler?: (...args: any[]) => void): void {
    handler ? this.socket?.off(event, handler) : this.socket?.off(event);
  }

  /** Join server rooms (e.g., `tenant:123`). */
  public joinRooms(rooms: string[]): void {
    if(rooms?.length) this.socket?.emit('client:subscribe', rooms);
  }

  /** Leave server rooms. */
  public leaveRooms(rooms: string[]): void {
    if(rooms?.length) this.socket?.emit('client:unsubscribe', rooms);
  }

  /** Push a fresh token to the server without recreating the socket. */
  public updateToken(token: string): void {
    if(!this.socket) return;
    this.socket.emit('auth:update', token);
  }

  /** Cleanly disconnect and release resources (call on logout). */
  public disconnect(): void {
    this.stopHeartbeat();
    if(this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null; // <- nullable field, no TS error
    }
    this._connected$.next(false);
  }

  // ────────────────── keep-alive internals ──────────────────

  private scheduleHello(delayMs: number): void {
    const jitter = 1 + (Math.random() * 2 - 1) * this.jitterPct; // 0.75..1.25
    if(this.helloRetryTimer) clearTimeout(this.helloRetryTimer);
    this.helloRetryTimer = setTimeout(() => this.sendHello(), Math.floor(delayMs * jitter));
  }

  /** Send a “hello” to measure RTT & estimate server/client clock skew. */
  private async sendHello(): Promise<void> {
    if(!this.socket || !this.socket.connected) return;
    const t0 = Date.now();
    try {
      const resp = await this.emitWithAck<HelloAck>(
        'client:hello',
        {app: 'prop-ease-ui', ver: '1.0.0', t: t0},
        this.helloTimeoutMs
      );
      if(!resp?.ok) throw new Error('hello not ok');

      const rtt = Math.max(0, Date.now() - t0);
      this._rtt$.next(rtt);

      // Estimate skew: serverTime ≈ client(t0 + rtt/2) if symmetric
      const estimatedClientAtServerNow = t0 + rtt / 2;
      this._skewMs$.next(resp.serverTime - estimatedClientAtServerNow);

      // refresh skew every 2 minutes
      this.scheduleHello(120_000);
    } catch(err: any) {
      this._connected$.next(false);
      console.error('[realtime] hello failed:', err?.message || err);
      this.scheduleHello(this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, this.backoffMaxMs);
    }
  }

  /** Start periodic ping to keep both sides alive and monitor latency. */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    if(!this.socket) return;

    this.heartbeatTimer = setInterval(async () => {
      if(!this.socket?.connected) return;
      const t0 = Date.now();
      try {
        await this.emitWithAck<PingAck>('client:ping', {t0}, this.helloTimeoutMs);
        const rtt = Math.max(0, Date.now() - t0);
        this._rtt$.next(rtt);
      } catch(e: any) {
        this._connected$.next(false);
        console.error('[realtime] heartbeat failed:', e?.message || e);
      }
    }, this.heartbeatMs);
  }

  private stopHeartbeat(): void {
    if(this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /** Reconnect nudges when browser goes online or tab becomes visible. */
  private wireBrowserSignals(): void {
    if(!isPlatformBrowser(this.platformId)) return;

    fromEvent(window, 'online').subscribe(() => {
      if(this.socket && !this.socket.connected) {
        console.warn('[realtime] browser online – trying to reconnect');
        this.socket.connect();
      }
    });

    fromEvent(document, 'visibilitychange').subscribe(() => {
      if(document.visibilityState === 'visible' && this.socket && !this.socket.connected) {
        console.warn('[realtime] tab visible – trying to reconnect');
        this.socket.connect();
      }
    });
  }

  private readTokenSafe(): string | null {
    try {return localStorage.getItem('auth_token');} catch {return null;}
  }

  private async refreshTokenFromProvider(): Promise<void> {
    if(!this.tokenProvider || !this.socket) return;
    try {
      const newToken = await this.tokenProvider();
      if(newToken) this.socket.emit('auth:update', newToken);
    } catch(e) {
      console.error('[realtime] token refresh failed', e);
    }
  }
}
