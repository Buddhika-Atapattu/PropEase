// notification.service.ts (Angular) — drop-in replacement of your class body
import {Injectable, inject, PLATFORM_ID} from '@angular/core';
import {HttpClient, HttpParams, HttpHeaders} from '@angular/common/http';
import {isPlatformBrowser} from '@angular/common';
import {BehaviorSubject, Observable, firstValueFrom, fromEvent, Subscription} from 'rxjs';
import {map} from 'rxjs/operators';
import {io, Socket} from 'socket.io-client';

/* ==================== Shared Types (unchanged) ==================== */
export type UserRole =
  | 'admin' | 'agent' | 'tenant' | 'owner'
  | 'operator' | 'manager' | 'developer' | 'user';
export type AudienceMode = 'user' | 'role' | 'broadcast';
export type Severity = 'info' | 'success' | 'warning' | 'error';
export type Channel = 'inapp' | 'email' | 'sms' | 'push';
export type TitleCategory =
  | 'User' | 'Tenant' | 'Property' | 'Lease' | 'Agent' | 'Developer'
  | 'Maintenance' | 'Complaint' | 'Team' | 'Registration' | 'Payment' | 'System';

export type Title =
  | 'New User' | 'Update User' | 'Delete User' | 'User Role Changed' | 'User Password Reset' | 'User Suspended' | 'User Reactivated'
  | 'New Tenant' | 'Update Tenant' | 'Delete Tenant' | 'Tenant Verified' | 'Tenant Moved Out' | 'Tenant Complaint Filed'
  | 'New Property' | 'Update Property' | 'Delete Property' | 'Property Approved' | 'Property Listing Expired' | 'Property Maintenance Requested' | 'Property Maintenance Completed' | 'Property Inspection Scheduled'
  | 'New Lease' | 'Update Lease' | 'Delete Lease' | 'Lease Renewed' | 'Lease Terminated' | 'Lease Payment Received' | 'Lease Reminder Sent' | 'Lease Agreement Download'
  | 'New Agent' | 'Update Agent' | 'Delete Agent' | 'Agent Assigned Property'
  | 'New Developer' | 'Update Developer' | 'Delete Developer'
  | 'New Maintenance Request' | 'Update Maintenance Request' | 'Close Maintenance Request' | 'Assign Maintenance Team' | 'Maintenance In Progress' | 'Maintenance Completed'
  | 'New Complaint' | 'Update Complaint' | 'Close Complaint' | 'Complaint Escalated' | 'Complaint Resolved'
  | 'New Team' | 'Update Team' | 'Delete Team' | 'Assign Team Member' | 'Team Task Created' | 'Team Task Completed'
  | 'New Registration' | 'Account Verified' | 'KYC Document Uploaded' | 'KYC Document Approved' | 'KYC Document Rejected'
  | 'New Invoice' | 'Update Invoice' | 'Invoice Paid' | 'Invoice Overdue' | 'Refund Issued' | 'Payment Failed'
  | 'System Update' | 'Security Alert' | 'Backup Completed' | 'New Message' | 'New Notification' | 'Broadcast Announcement'
  | '';

export interface NotificationAudience {
  mode: AudienceMode;
  usernames?: string[];
  roles?: Array<UserRole>;
}

export type DefinedTypes =
  | 'create' | 'update' | 'delete' | 'archive' | 'restore'
  | 'assign' | 'reassign'
  | 'approve' | 'reject' | 'verify' | 'publish' | 'unpublish'
  | 'renew' | 'terminate' | 'expire' | 'download'
  | 'schedule' | 'start' | 'in_progress' | 'complete' | 'reschedule' | 'cancel'
  | 'maintenance_request' | 'maintenance_ack' | 'maintenance_in_progress' | 'maintenance_completed' | 'maintenance_closed'
  | 'payment_received' | 'payment_failed' | 'refund_issued' | 'invoice_created' | 'invoice_overdue'
  | 'notify' | 'reminder' | 'escalate' | 'broadcast'
  | 'import' | 'export' | 'sync';

export interface Notification {
  _id: string;
  title: Title;
  category: TitleCategory;
  body: string;
  type: DefinedTypes;
  severity?: Severity;
  audience: NotificationAudience;
  createdAt: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
  channels?: Channel[];
  icon?: string;
  tags?: string[];
  link?: string;
  source?: string;
  userState?: {
    isRead: boolean;
    isArchived: boolean;
    deliveredAt: string;
    readAt?: string;
  };
}

/* ==================== Config / helpers ==================== */
const DEFAULT_API_BASE = 'http://localhost:3000';
const DEFAULT_WS_BASE = 'http://localhost:3000';
const SOCKET_PATH = '/socket.io';
const NOTIFICATION_API_PATH = '/api-notification';

function getAuthToken(): string | null {
  try {return localStorage.getItem('auth_token');} catch {return null;}
}

function normalize(n: Notification): Notification {
  return {
    ...n,
    channels: n.channels?.length ? n.channels : ['inapp'],
    userState: {
      isRead: n.userState?.isRead ?? false,
      isArchived: n.userState?.isArchived ?? false,
      deliveredAt: n.userState?.deliveredAt ?? n.createdAt,
      readAt: n.userState?.readAt,
    },
  };
}

/* ==================== Load options ==================== */
export interface LoadOptionsNew {
  page?: number; limit?: number; onlyUnread?: boolean; search?: string;
  category?: TitleCategory; severity?: Severity; channel?: Channel; type?: string;
  createdAfter?: string | Date; createdBefore?: string | Date; titles?: Title[];
}
export interface LoadOptionsLegacy {limit?: number; skip?: number; unread?: boolean;}
export type LoadOptions = LoadOptionsNew | LoadOptionsLegacy;
function isLegacyLoadOptions(opts: LoadOptions): opts is LoadOptionsLegacy {
  return 'skip' in opts || 'unread' in opts;
}

/* ==================== Service ==================== */
@Injectable({providedIn: 'root'})
export class NotificationService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private socket: Socket | null = null;

  // Live list
  private _items$ = new BehaviorSubject<Notification[]>([]);
  readonly items$ = this._items$.asObservable();

  // Connection state + telemetry
  private _connected$ = new BehaviorSubject<boolean>(false);
  readonly connected$ = this._connected$.asObservable();

  private _rtt$ = new BehaviorSubject<number | null>(null);
  /** Application-level round-trip time (ms), null if unknown */
  readonly rtt$ = this._rtt$.asObservable();

  // URLs
  private restBase = `${DEFAULT_API_BASE}${NOTIFICATION_API_PATH}`;
  private socketUrl = DEFAULT_WS_BASE;

  // Event handlers (so we can remove them)
  private onConnect = () => {
    this._connected$.next(true);
    // Complete handshake: client → server hello (with ack)
    this.sendClientHello();
  };
  private onDisconnect = () => this._connected$.next(false);

  private onNew = (n: Notification) => {
    const incoming = normalize(n);
    const current = this._items$.value;
    if(current.some(x => x._id === incoming._id)) return;

    this._items$.next([incoming, ...current].slice(0, 200));
    this.socket?.emit('notification:ack', {notificationId: incoming._id});
  };

  // Keep-alive timer + browser event subs
  private heartbeatTimer: any = null;
  private browserSubs: Subscription[] = [];

  /** OPTIONAL: external token provider (e.g., refresh flow) */
  private tokenProvider?: () => string | Promise<string>;


  constructor () {

  }

  /* -------------------- Handshake helpers -------------------- */

  /** Send client → server hello (ack updates RTT baseline via serverTime) */
  private sendClientHello() {
    if(!this.socket) return;
    const started = Date.now();
    this.socket.timeout(4000).emit(
      'client:hello',
      {app: 'prop-ease-ui', ver: '1.0.0', t: started},
      (err?: Error, resp?: {ok: boolean; serverTime: number}) => {
        if(!err && resp?.ok) {
          // rough half-RTT estimate
          const halfRtt = Math.max(0, Date.now() - started) / 2;
          this._rtt$.next(halfRtt * 2);
        }
      }
    );
  }

  /** App-level heartbeat: client → server ping w/ ack every 20s */
  private startHeartbeat() {
    this.stopHeartbeat();
    if(!this.socket) return;
    this.heartbeatTimer = setInterval(() => {
      const t0 = Date.now();
      this.socket!.timeout(4000).emit('client:ping', t0, (err?: Error, reply?: {pong: true; ts: number; serverTs: number}) => {
        if(!err && reply?.pong && reply.ts === t0) {
          this._rtt$.next(Date.now() - t0);
        }
      });
    }, 20000);
  }

  private stopHeartbeat() {
    if(this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Respond to server → client ping with an ack (the server expects this) */
  private wireServerPingHandler() {
    if(!this.socket) return;
    // Handler signature MUST include ack callback to satisfy server timeout()
    this.socket.on('server:ping', (_payload: {t: number}, ack?: (clientNow: number) => void) => {
      ack?.(Date.now());
    });
  }

  /** Handle server greetings */
  private wireServerGreetings() {
    if(!this.socket) return;
    // When server greets, reply again (idempotent + helps after reconnect)
    this.socket.on('server:hello', () => this.sendClientHello());
    // Optional listener (useful for debugging)
    this.socket.on('server:welcome', (_payload) => {
      // no-op; you could expose this if needed
    });
  }

  /** Listen for token updates result (optional) */
  private wireAuthUpdated() {
    if(!this.socket) return;
    this.socket.on('auth:updated', (res: {ok: boolean; reason?: string}) => {
      if(!res?.ok) {
        // token rejected — try to fetch a new token if provider is set
        this.refreshTokenFromProvider().catch(() => this.socket?.disconnect());
      }
    });
  }

  /** Browser signals → reconnect fast when possible */
  private wireBrowserSignals() {
    if(!isPlatformBrowser(this.platformId)) return;

    const onOnline = () => {
      if(this.socket && !this.socket.connected) this.socket.connect();
    };
    const onVisible = () => {
      if(document.visibilityState === 'visible' && this.socket && !this.socket.connected) {
        this.socket.connect();
      }
    };

    this.browserSubs.push(fromEvent(window, 'online').subscribe(onOnline));
    this.browserSubs.push(fromEvent(document, 'visibilitychange').subscribe(onVisible));
  }

  /** Try to refresh token via provider (if configured) and push to server */
  private async refreshTokenFromProvider() {
    if(!this.tokenProvider || !this.socket) return;
    try {
      const newToken = await this.tokenProvider();
      if(newToken) this.socket.emit('auth:update', newToken);
    } catch {
      // ignore; caller decides what to do on failure
    }
  }

  /* ==================== Public API ==================== */

  /**
   * Initialize socket connection (call after login or app bootstrap).
   * You can pass a tokenProvider for seamless refresh-on-401/connect_error.
   */
  initConnection(opts?: {
    apiBase?: string;
    wsBase?: string;
    token?: string;
    tokenProvider?: () => string | Promise<string>;
  }) {
    if(!isPlatformBrowser(this.platformId)) return;

    this.restBase = `${(opts?.apiBase || DEFAULT_API_BASE).replace(/\/+$/, '')}${NOTIFICATION_API_PATH}`;
    this.socketUrl = (opts?.wsBase || DEFAULT_WS_BASE).replace(/\/+$/, '');
    this.tokenProvider = opts?.tokenProvider;

    const token = opts?.token ?? getAuthToken();
    if(!token) return;

    if(this.socket) {
      (this.socket as any).auth = {token};
      if(!this.socket.connected) this.socket.connect();
      return;
    }

    this.socket = io(this.socketUrl, {
      path: SOCKET_PATH,
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

    // Core status
    this.socket.on('connect', this.onConnect);
    this.socket.on('disconnect', this.onDisconnect);
    this.socket.on('notification.new', this.onNew);

    this.socket.on('connect', () => console.log('[socket] connected', this.socket?.id));
    this.socket.on('connect_error', (err: any) =>
      console.error('[socket] connect_error:', err?.message || err)
    );

    // Handshake/keepalive
    this.wireServerPingHandler();
    this.wireServerGreetings();
    this.wireAuthUpdated();
    this.startHeartbeat();

    // Errors + reconnect hints
    this.socket.on('connect_error', async (err: any) => {
      this._connected$.next(false);
      console.error('[socket] connect_error:', err?.message || err);
      if(String(err?.message || '').toLowerCase().includes('unauthorized')) {
        await this.refreshTokenFromProvider();
      }
    });
    
    this.socket.on('reconnect', () => {
      // upon reconnect, redo hello + resume heartbeat
      this.sendClientHello();
      this.startHeartbeat();
    });

    // Browser events
    this.wireBrowserSignals();
  }

  /** Push a brand-new token (e.g., after refresh) without rebuilding the socket */
  updateToken(token: string) {
    if(!isPlatformBrowser(this.platformId)) return;
    if(!this.socket) {this.initConnection({token}); return;}
    this.socket.emit('auth:update', token);
  }

  /** Subscribe to extra domain rooms (server validates names) */
  subscribeRooms(rooms: string[]) {
    if(this.socket && rooms?.length) this.socket.emit('client:subscribe', rooms);
  }
  /** Unsubscribe from domain rooms */
  unsubscribeRooms(rooms: string[]) {
    if(this.socket && rooms?.length) this.socket.emit('client:unsubscribe', rooms);
  }

  /** Disconnect socket and clear local cache (e.g., on logout) */
  disconnect(): void {
    this.stopHeartbeat();
    this.browserSubs.forEach(s => s.unsubscribe());
    this.browserSubs = [];

    if(this.socket) {
      this.socket.off('connect', this.onConnect);
      this.socket.off('disconnect', this.onDisconnect);
      this.socket.off('notification.new', this.onNew);
      this.socket.off('server:ping');
      this.socket.off('server:hello');
      this.socket.off('server:welcome');
      this.socket.off('auth:updated');
      this.socket.off('connect_error');
      this.socket.off('reconnect');

      this.socket.disconnect();
      this.socket = null;
    }
    this._connected$.next(false);
    this._rtt$.next(null);
    this._items$.next([]);
  }

  /* ==================== REST: listing & read-state (unchanged logic) ==================== */

  private authHeaders(): HttpHeaders {
    const token = getAuthToken();
    return token ? new HttpHeaders({Authorization: `Bearer ${token}`}) : new HttpHeaders();
  }

  async load(opts: LoadOptions = {}): Promise<void> {
    let params = new HttpParams();

    if(isLegacyLoadOptions(opts)) {
      const limit = opts.limit ?? 30;
      const skip = opts.skip ?? 0;
      const page = Math.max(0, Math.floor(skip / Math.max(1, limit)));
      const onlyUnread = !!opts.unread;

      params = params
        .set('limit', String(limit))
        .set('page', String(page))
        .set('onlyUnread', onlyUnread ? 'true' : 'false');
    } else {
      const o: LoadOptionsNew = opts;
      if(typeof o.page === 'number') params = params.set('page', String(o.page));
      if(typeof o.limit === 'number') params = params.set('limit', String(o.limit));
      if(o.onlyUnread !== undefined) params = params.set('onlyUnread', o.onlyUnread ? 'true' : 'false');
      if(o.search) params = params.set('search', o.search.trim());
      if(o.category) params = params.set('category', o.category);
      if(o.severity) params = params.set('severity', o.severity);
      if(o.channel) params = params.set('channel', o.channel);
      if(o.type) params = params.set('type', o.type);
      if(o.createdAfter) params = params.set('createdAfter', new Date(o.createdAfter).toISOString());
      if(o.createdBefore) params = params.set('createdBefore', new Date(o.createdBefore).toISOString());
      if(o.titles?.length) o.titles.forEach(t => params = params.append('titles', t));
    }

    const res = await firstValueFrom(
      this.http.get<{success: boolean; data: Notification[]}>(this.restBase, {
        params, headers: this.authHeaders(),
      })
    );

    const data = (res?.data ?? []).map(normalize);
    const sorted = [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 200);
    this._items$.next(sorted);
  }

  loadOnlyUnread(page = 0, limit = 20) {return this.load({page, limit, onlyUnread: true});}
  searchServer(query: string, page = 0, limit = 20) {return this.load({page, limit, search: query});}
  byCategory(category: TitleCategory, page = 0, limit = 20) {return this.load({page, limit, category});}
  bySeverity(severity: Severity, page = 0, limit = 20) {return this.load({page, limit, severity});}
  byChannel(channel: Channel, page = 0, limit = 20) {return this.load({page, limit, channel});}
  byType(type: string, page = 0, limit = 20) {return this.load({page, limit, type});}
  byTitles(titles: Title[], page = 0, limit = 20) {return this.load({page, limit, titles});}
  byDateRange(createdAfter?: Date | string, createdBefore?: Date | string, page = 0, limit = 20) {
    return this.load({page, limit, createdAfter, createdBefore});
  }

  async markRead(notificationId: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.restBase}/${notificationId}/read`, {}, {headers: this.authHeaders()}));
    const updated = this._items$.value.map(n =>
      n._id === notificationId
        ? normalize({...n, userState: {...(n.userState ?? ({} as any)), isRead: true, readAt: new Date().toISOString()}} as Notification)
        : n
    );
    this._items$.next(updated);
  }

  async markManyAsRead(ids: string[]): Promise<void> {
    if(!ids?.length) return;
    await firstValueFrom(this.http.post(`${this.restBase}/read-many`, {ids}, {headers: this.authHeaders()}));
    const now = new Date().toISOString();
    const updated = this._items$.value.map(n =>
      ids.includes(n._id)
        ? normalize({...n, userState: {...(n.userState ?? ({} as any)), isRead: true, readAt: now}} as Notification)
        : n
    );
    this._items$.next(updated);
  }

  async markAllRead(): Promise<void> {
    await firstValueFrom(this.http.post(`${this.restBase}/read-all`, {}, {headers: this.authHeaders()}));
    const now = new Date().toISOString();
    const updated = this._items$.value.map(n =>
      normalize({...n, userState: {...(n.userState ?? ({} as any)), isRead: true, readAt: now}} as Notification)
    );
    this._items$.next(updated);
  }

  /* ==================== Client-side selectors ==================== */
  unreadNotifications$(): Observable<Notification[]> {
    return this.items$.pipe(map(list => list.filter(n => !n.userState?.isRead)));
  }
  unreadCount$(): Observable<number> {
    return this.items$.pipe(map(list => list.filter(n => !n.userState?.isRead).length));
  }
  unreadCount(): number {
    return this._items$.value.filter(n => !n.userState?.isRead).length;
  }
  itemsByTag$(tag: string): Observable<Notification[]> {
    const q = (tag ?? '').trim().toLowerCase();
    if(!q) return this.items$;
    return this.items$.pipe(map(list => list.filter(n => (n.tags ?? []).some(t => t.toLowerCase().includes(q)))));
  }
  itemsByCategory$(category: TitleCategory): Observable<Notification[]> {
    return this.items$.pipe(map(list => list.filter(n => n.category === category)));
  }
  itemsByRole$(role: UserRole): Observable<Notification[]> {
    return this.items$.pipe(map(list => list.filter(n => (n.audience?.roles ?? []).includes(role))));
  }
  itemsByUsername$(username: string): Observable<Notification[]> {
    return this.items$.pipe(map(list => list.filter(n => (n.audience?.usernames ?? []).includes(username))));
  }
  itemsSearch$(query: string): Observable<Notification[]> {
    const q = (query ?? '').trim().toLowerCase();
    if(!q) return this.items$;
    return this.items$.pipe(
      map(list =>
        list.filter(n => {
          const title = (n.title ?? '').toLowerCase();
          const body = (n.body ?? '').toLowerCase();
          const tags = (n.tags ?? []).map(t => t.toLowerCase());
          return title.includes(q) || body.includes(q) || tags.some(t => t.includes(q));
        })
      )
    );
  }
  itemById$(id: string): Observable<Notification | undefined> {
    return this.items$.pipe(map(list => list.find(n => n._id === id)));
  }
}
