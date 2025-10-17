// notification-service.ts
// Angular service for notifications with REST + Socket.IO
// - Exposes both Promise-based (load) and Observable-based (load$) APIs
// - Real-time updates via socket; visibility-aware polling is done in the component
// - Carefully commented so each method's role is clear

import {Injectable, inject, PLATFORM_ID} from '@angular/core';
import {HttpClient, HttpParams, HttpHeaders} from '@angular/common/http';
import {isPlatformBrowser} from '@angular/common';
import {
  BehaviorSubject,
  Observable,
  Subject,
  Subscription,
  firstValueFrom,
  fromEvent,
} from 'rxjs';
import {map, tap} from 'rxjs/operators';
import {io, Socket} from 'socket.io-client';

/* ==================== Shared Types ==================== */

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

export interface responseMSG {
  status: number | string;
  message: string;
  data: any;
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

  // In-memory list of notifications (observable for the UI)
  private _items$ = new BehaviorSubject<Notification[]>([]);
  /** Stream of the current list of notifications, newest first (max 200 kept). */
  readonly items$ = this._items$.asObservable();

  // Socket connection state
  private _connected$ = new BehaviorSubject<boolean>(false);
  /** Emits true when socket is connected; false when disconnected. */
  readonly connected$ = this._connected$.asObservable();

  // Application-level RTT (client ↔ server)
  private _rtt$ = new BehaviorSubject<number | null>(null);
  /** Estimated round-trip time in ms (null if not known). */
  readonly rtt$ = this._rtt$.asObservable();

  // REST + WebSocket base URLs
  private restBase = `${DEFAULT_API_BASE}${NOTIFICATION_API_PATH}`;
  private socketUrl = DEFAULT_WS_BASE;

  // Subjects to expose server push as Rx streams
  private newSubject = new Subject<Notification>();

  // Keep-alive + browser event subscriptions
  private heartbeatTimer: any = null;
  private browserSubs: Subscription[] = [];

  /** Optional provider: how to obtain a fresh token when needed (e.g., refresh flow). */
  private tokenProvider?: () => string | Promise<string>;

  constructor () { /* no eager work here */}

  /* -------------------- Handshake & keepalive -------------------- */

  /** Send a client → server hello. Updates the RTT estimate via ack timing. */
  private sendClientHello(): void {
    if(!this.socket) return;
    const started = Date.now();
    this.socket.timeout(4000).emit(
      'client:hello',
      {app: 'prop-ease-ui', ver: '1.0.0', t: started},
      (err?: Error, resp?: {ok: boolean; serverTime: number}) => {
        if(!err && resp?.ok) {
          const rtt = Math.max(0, Date.now() - started);
          this._rtt$.next(rtt);
        }
      }
    );
  }

  /** Start an app-level heartbeat (ping/ack) every 20s to monitor latency. */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    if(!this.socket) return;
    this.heartbeatTimer = setInterval(() => {
      const t0 = Date.now();
      this.socket!
        .timeout(4000)
        .emit('client:ping', t0, (err?: Error, reply?: {pong: true; ts: number; serverTs: number}) => {
          if(!err && reply?.pong && reply.ts === t0) {
            this._rtt$.next(Date.now() - t0);
          }
        });
    }, 20000);
  }

  /** Stop heartbeat timer. */
  private stopHeartbeat(): void {
    if(this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Reply to server → client ping; server uses this ack to detect client health. */
  private wireServerPingHandler(): void {
    if(!this.socket) return;
    this.socket.on('server:ping', (_payload: {t: number}, ack?: (clientNow: number) => void) => {
      ack?.(Date.now());
    });
  }

  /** Re-hello and optional logging for greetings. */
  private wireServerGreetings(): void {
    if(!this.socket) return;
    this.socket.on('server:hello', () => this.sendClientHello());
    this.socket.on('server:welcome', () => { /* optional debug */});
  }

  /** Listen for server auth update results; try to refresh token on failure. */
  private wireAuthUpdated(): void {
    if(!this.socket) return;
    this.socket.on('auth:updated', (res: {ok: boolean; reason?: string}) => {
      if(!res?.ok) this.refreshTokenFromProvider().catch(() => this.socket?.disconnect());
    });
  }

  /** Watch browser online/visibility events and reconnect quickly when possible. */
  private wireBrowserSignals(): void {
    if(!isPlatformBrowser(this.platformId)) return;
    const onOnline = () => {if(this.socket && !this.socket.connected) this.socket.connect();};
    const onVisible = () => {
      if(document.visibilityState === 'visible' && this.socket && !this.socket.connected) this.socket.connect();
    };
    this.browserSubs.push(fromEvent(window, 'online').subscribe(onOnline));
    this.browserSubs.push(fromEvent(document, 'visibilitychange').subscribe(onVisible));
  }

  /** If a token provider is configured, fetch a new token and push it to the server. */
  private async refreshTokenFromProvider(): Promise<void> {
    if(!this.tokenProvider || !this.socket) return;
    try {
      const newToken = await this.tokenProvider();
      if(newToken) this.socket.emit('auth:update', newToken);
    } catch { /* ignore */}
  }

  /* ==================== Public: socket lifecycle ==================== */

  /**
   * Initialize the socket connection (call after login/app bootstrap).
   * - If `tokenProvider` is passed, the service can auto-refresh auth on 401/connect_error.
   * - This sets up all socket handlers and starts a heartbeat.
   */
  public initConnection(opts?: {
    apiBase?: string;
    wsBase?: string;
    token?: string;
    tokenProvider?: () => string | Promise<string>;
  }): void {
    if(!isPlatformBrowser(this.platformId)) return;

    this.restBase = `${(opts?.apiBase || DEFAULT_API_BASE).replace(/\/+$/, '')}${NOTIFICATION_API_PATH}`;
    this.socketUrl = (opts?.wsBase || DEFAULT_WS_BASE).replace(/\/+$/, '');
    this.tokenProvider = opts?.tokenProvider;

    const token = opts?.token ?? getAuthToken();
    if(!token) return;

    // Reuse existing socket if present
    if(this.socket) {
      (this.socket as any).auth = {token};
      if(!this.socket.connected) this.socket.connect();
      return;
    }

    // Build socket
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
    this.socket.on('connect', () => {this._connected$.next(true); this.sendClientHello();});
    this.socket.on('disconnect', () => {this._connected$.next(false);});

    // Real-time notifications
    this.socket.on('notification.new', (n: Notification) => this.handleIncoming(n));

    // Handshake/keepalive wiring
    this.wireServerPingHandler();
    this.wireServerGreetings();
    this.wireAuthUpdated();
    this.startHeartbeat();

    // Auth/connect errors
    this.socket.on('connect_error', async (err: any) => {
      this._connected$.next(false);
      // Try to refresh token automatically if we can
      if(String(err?.message || '').toLowerCase().includes('unauthorized')) {
        await this.refreshTokenFromProvider();
      }
    });

    // After a reconnect, redo hello + ensure heartbeat is running
    this.socket.on('reconnect', () => {
      this.sendClientHello();
      this.startHeartbeat();
    });

    // Browser signals
    this.wireBrowserSignals();
  }

  /** Update the token without rebuilding the socket (e.g., after a refresh). */
  public updateToken(token: string): void {
    if(!isPlatformBrowser(this.platformId)) return;
    if(!this.socket) {this.initConnection({token}); return;}
    this.socket.emit('auth:update', token);
  }

  /** Subscribe the socket to extra domain rooms (server validates names). */
  public subscribeRooms(rooms: string[]): void {
    if(this.socket && rooms?.length) this.socket.emit('client:subscribe', rooms);
  }

  /** Unsubscribe from extra rooms. */
  public unsubscribeRooms(rooms: string[]): void {
    if(this.socket && rooms?.length) this.socket.emit('client:unsubscribe', rooms);
  }

  /**
   * Disconnect the socket and clear local cache. Call this on logout.
   * (Ensures timers/listeners are cleaned up to prevent leaks.)
   */
  public disconnect(): void {
    this.stopHeartbeat();
    this.browserSubs.forEach((s) => s.unsubscribe());
    this.browserSubs = [];

    if(this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this._connected$.next(false);
    this._rtt$.next(null);
    this._items$.next([]);
  }

  /* ==================== Public: REST listing & read state ==================== */

  /** Build Authorization header from local storage token (if available). */
  private authHeaders(): HttpHeaders {
    const token = getAuthToken();
    return token ? new HttpHeaders({Authorization: `Bearer ${token}`}) : new HttpHeaders();
  }

  /**
   * Fetch notifications from the server (Promise API).
   * - Supports both legacy `{limit, skip, unread}` and new query shape.
   * - Normalizes and sorts notifications newest first; keeps at most 200.
   */
  public async load(opts: LoadOptions = {}): Promise<void> {
    const params = this.buildQueryParams(opts);

    const res = await firstValueFrom(
      this.http.get<{success: boolean; data: Notification[]}>(this.restBase, {
        params,
        headers: this.authHeaders(),
      })
    );

    const data = (res?.data ?? []).map(normalize);
    const sorted = data
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 200);

    this._items$.next(sorted);
  }

  /**
   * Fetch notifications from the server (Observable API).
   * - Useful for composing with RxJS (retryWhen, switchMap, etc.) in components.
   */
  public load$(opts: LoadOptions = {}): Observable<void> {
    const params = this.buildQueryParams(opts);
    return this.http
      .get<{success: boolean; data: Notification[]}>(this.restBase, {
        params,
        headers: this.authHeaders(),
      })
      .pipe(
        map((res) => (res?.data ?? []).map(normalize)),
        map((list) =>
          list
            .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
            .slice(0, 200)
        ),
        tap((sorted) => this._items$.next(sorted)),
        map(() => void 0)
      );
  }

  /** Convenience wrappers for common filters. */
  public loadOnlyUnread(page = 0, limit = 20) {return this.load({page, limit, onlyUnread: true});}
  public searchServer(query: string, page = 0, limit = 20) {return this.load({page, limit, search: query});}
  public byCategory(category: TitleCategory, page = 0, limit = 20) {return this.load({page, limit, category});}
  public bySeverity(severity: Severity, page = 0, limit = 20) {return this.load({page, limit, severity});}
  public byChannel(channel: Channel, page = 0, limit = 20) {return this.load({page, limit, channel});}
  public byType(type: string, page = 0, limit = 20) {return this.load({page, limit, type});}
  public byTitles(titles: Title[], page = 0, limit = 20) {return this.load({page, limit, titles});}
  public byDateRange(createdAfter?: Date | string, createdBefore?: Date | string, page = 0, limit = 20) {
    return this.load({page, limit, createdAfter, createdBefore});
  }

  /**
   * Mark one notification as read (server + local cache).
   * Updates `userState` locally to keep UI snappy.
   */
  public async markRead(notificationId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.restBase}/${notificationId}/read`, {}, {headers: this.authHeaders()})
    );
    const now = new Date().toISOString();
    const updated = this._items$.value.map((n) =>
      n._id === notificationId
        ? normalize({
          ...n,
          userState: {...(n.userState ?? ({} as any)), isRead: true, readAt: now},
        } as Notification)
        : n
    );
    this._items$.next(updated);
  }

  /**
   * Mark many notifications as read (bulk server + local cache).
   * Avoids many network roundtrips and repaints.
   */
  public async markManyAsRead(ids: string[]): Promise<void> {
    if(!ids?.length) return;
    await firstValueFrom(
      this.http.post(`${this.restBase}/read-many`, {ids}, {headers: this.authHeaders()})
    );
    const now = new Date().toISOString();
    const updated = this._items$.value.map((n) =>
      ids.includes(n._id)
        ? normalize({
          ...n,
          userState: {...(n.userState ?? ({} as any)), isRead: true, readAt: now},
        } as Notification)
        : n
    );
    this._items$.next(updated);
  }

  /**
   * Mark all notifications as read (server + local cache).
   * Useful for "Mark all as read" UI actions.
   */
  public async markAllRead(): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.restBase}/read-all`, {}, {headers: this.authHeaders()})
    );
    const now = new Date().toISOString();
    const updated = this._items$.value.map((n) =>
      normalize({...n, userState: {...(n.userState ?? ({} as any)), isRead: true, readAt: now}} as Notification)
    );
    this._items$.next(updated);
  }

  /* ==================== Public: client-side selectors ==================== */

  /** Stream of unread notifications only. */
  public unreadNotifications$(): Observable<Notification[]> {
    return this.items$.pipe(map((list) => list.filter((n) => !n.userState?.isRead)));
  }
  /** Stream of unread count (keeps the badge reactive). */
  public unreadCount$(): Observable<number> {
    return this.items$.pipe(map((list) => list.filter((n) => !n.userState?.isRead).length));
  }
  /** Snapshot of unread count (synchronous). */
  public unreadCount(): number {
    return this._items$.value.filter((n) => !n.userState?.isRead).length;
  }
  /** Filter by tag locally. */
  public itemsByTag$(tag: string): Observable<Notification[]> {
    const q = (tag ?? '').trim().toLowerCase();
    if(!q) return this.items$;
    return this.items$.pipe(
      map((list) => list.filter((n) => (n.tags ?? []).some((t) => t.toLowerCase().includes(q))))
    );
  }
  /** Filter by category locally. */
  public itemsByCategory$(category: TitleCategory): Observable<Notification[]> {
    return this.items$.pipe(map((list) => list.filter((n) => n.category === category)));
  }
  /** Filter by role (audience.roles) locally. */
  public itemsByRole$(role: UserRole): Observable<Notification[]> {
    return this.items$.pipe(map((list) => list.filter((n) => (n.audience?.roles ?? []).includes(role))));
  }
  /** Filter by username (audience.usernames) locally. */
  public itemsByUsername$(username: string): Observable<Notification[]> {
    return this.items$.pipe(map((list) => list.filter((n) => (n.audience?.usernames ?? []).includes(username))));
  }
  /** Local text search across title/body/tags. */
  public itemsSearch$(query: string): Observable<Notification[]> {
    const q = (query ?? '').trim().toLowerCase();
    if(!q) return this.items$;
    return this.items$.pipe(
      map((list) =>
        list.filter((n) => {
          const title = (n.title ?? '').toLowerCase();
          const body = (n.body ?? '').toLowerCase();
          const tags = (n.tags ?? []).map((t) => t.toLowerCase());
          return title.includes(q) || body.includes(q) || tags.some((t) => t.includes(q));
        })
      )
    );
  }
  /** Find one by id (stream). */
  public itemById$(id: string): Observable<Notification | undefined> {
    return this.items$.pipe(map((list) => list.find((n) => n._id === id)));
  }

  /* ==================== Public: real-time hooks (new) ==================== */

  /**
   * Observable of new notifications as they arrive from the server.
   * (Used by your component to `upsert()` or show live toasts.)
   */
  public onNew(): Observable<Notification> {
    return this.newSubject.asObservable();
  }

  /**
   * Insert or update a notification in the in-memory list.
   * - If it exists, replaces it in place (preserving order by createdAt).
   * - If it’s new, prepends to the list (max 200 kept).
   */
  public upsert(n: Notification): void {
    const incoming = normalize(n);
    const list = this._items$.value.slice();
    const idx = list.findIndex((x) => x._id === incoming._id);

    if(idx !== -1) {
      list[idx] = incoming;
    } else {
      list.unshift(incoming);
    }

    // Keep newest first, cap at 200
    const sorted = list
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 200);

    this._items$.next(sorted);
  }

  /* ==================== Internals ==================== */

  /** Build query params for both legacy and new load options. */
  private buildQueryParams(opts: LoadOptions): HttpParams {
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
      const o = opts as LoadOptionsNew;
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
      if(o.titles?.length) o.titles.forEach((t) => (params = params.append('titles', t)));
    }

    return params;
  }

  /** Handle incoming real-time notification: upsert + ack + emit to observers. */
  private handleIncoming(n: Notification): void {
    const incoming = normalize(n);
    // Feed onNew() observers first (useful for toasts/snackbars)
    this.newSubject.next(incoming);

    // Update internal list (no duplicates)
    const current = this._items$.value;
    if(!current.some((x) => x._id === incoming._id)) {
      this._items$.next([incoming, ...current].slice(0, 200));
    } else {
      this.upsert(incoming);
    }

    // Tell server we received it (optional)
    this.socket?.emit('notification:ack', {notificationId: incoming._id});
  }

  public restoreDeleteJson(body: {notification: Notification /* or { id: string } */}) {
    return this.http.post<responseMSG>(
      `/api-notification/restore`,
      body,
      {headers: this.authHeaders().set('Content-Type', 'application/json')}
    ).toPromise();
  }

}
