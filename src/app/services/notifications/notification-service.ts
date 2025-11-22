// src/app/services/notifications/notification-service.ts
// -----------------------------------------------------------------------------
// NotificationService (migrated)
// - REST for lists / read-state
// - Real-time events are delivered by the shared SocketService
//   (no direct socket.io usage here anymore)
// -----------------------------------------------------------------------------
//
// Quick Start
//   notificationService.initConnection({ apiBase, wsBase, token, tokenProvider });
//   notificationService.load({ limit: 20 });     // REST list
//   notificationService.onNew(true).subscribe(); // realtime new items + sound
// -----------------------------------------------------------------------------

import {Injectable, inject, PLATFORM_ID} from '@angular/core';
import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {isPlatformBrowser} from '@angular/common';
import {
  BehaviorSubject,
  Observable,
  Subject,
  firstValueFrom,
  lastValueFrom,
  Subscription,
} from 'rxjs';
import {map, tap} from 'rxjs/operators';
import {SocketService} from '../socket/socket-service';
import {
  RestoreNotificationPayload,
  BackendRestoreResponse,
} from '../../types/notification.types';

/* ==================== Shared Types ==================== */

export type UserRole =
  | 'admin'
  | 'agent'
  | 'tenant'
  | 'owner'
  | 'operator'
  | 'manager'
  | 'developer'
  | 'user';

export type AudienceMode = 'user' | 'role' | 'broadcast';
export type Severity = 'info' | 'success' | 'warning' | 'error';
export type Channel = 'inapp' | 'email' | 'sms' | 'push';
export type TitleCategory =
  | 'User'
  | 'Tenant'
  | 'Property'
  | 'Lease'
  | 'Agent'
  | 'Developer'
  | 'Maintenance'
  | 'Complaint'
  | 'Team'
  | 'Registration'
  | 'Payment'
  | 'System'
  | 'Comment';

export type Title =
  | 'New User'
  | 'Update User'
  | 'Delete User'
  | 'User Role Changed'
  | 'User Password Reset'
  | 'User Suspended'
  | 'User Reactivated'
  | 'New Tenant'
  | 'Update Tenant'
  | 'Delete Tenant'
  | 'Tenant Verified'
  | 'Tenant Moved Out'
  | 'Tenant Complaint Filed'
  | 'New Property'
  | 'Update Property'
  | 'Delete Property'
  | 'Property Approved'
  | 'Property Listing Expired'
  | 'Property Maintenance Requested'
  | 'Property Maintenance Completed'
  | 'Property Inspection Scheduled'
  | 'New Lease'
  | 'Update Lease'
  | 'Delete Lease'
  | 'Lease Renewed'
  | 'Lease Terminated'
  | 'Lease Payment Received'
  | 'Lease Reminder Sent'
  | 'Lease Agreement Download'
  | 'Lease Agreement View'
  | 'New Agent'
  | 'Update Agent'
  | 'Delete Agent'
  | 'Agent Assigned Property'
  | 'New Developer'
  | 'Update Developer'
  | 'Delete Developer'
  | 'New Maintenance Request'
  | 'Update Maintenance Request'
  | 'Close Maintenance Request'
  | 'Assign Maintenance Team'
  | 'Maintenance In Progress'
  | 'Maintenance Completed'
  | 'New Complaint'
  | 'Update Complaint'
  | 'Close Complaint'
  | 'Complaint Escalated'
  | 'Complaint Resolved'
  | 'New Team'
  | 'Update Team'
  | 'Delete Team'
  | 'Assign Team Member'
  | 'Team Task Created'
  | 'Team Task Completed'
  | 'New Registration'
  | 'Account Verified'
  | 'KYC Document Uploaded'
  | 'KYC Document Approved'
  | 'KYC Document Rejected'
  | 'New Invoice'
  | 'Update Invoice'
  | 'Invoice Paid'
  | 'Invoice Overdue'
  | 'Refund Issued'
  | 'Payment Failed'
  | 'System Update'
  | 'Security Alert'
  | 'Backup Completed'
  | 'New Message'
  | 'New Notification'
  | 'Broadcast Announcement'
  | 'New Comment'
  | 'Update Comment'
  | 'Delete Comment'
  | 'Reject Comment'
  | '';

export interface NotificationAudience {
  mode: AudienceMode;
  usernames?: string[];
  roles?: Array<UserRole>;
}

export type DefinedTypes =
  | 'create'
  | 'update'
  | 'delete'
  | 'archive'
  | 'restore'
  | 'assign'
  | 'reassign'
  | 'approve'
  | 'reject'
  | 'verify'
  | 'publish'
  | 'unpublish'
  | 'renew'
  | 'terminate'
  | 'expire'
  | 'download'
  | 'schedule'
  | 'start'
  | 'in_progress'
  | 'complete'
  | 'reschedule'
  | 'cancel'
  | 'maintenance_request'
  | 'maintenance_ack'
  | 'maintenance_in_progress'
  | 'maintenance_completed'
  | 'maintenance_closed'
  | 'payment_received'
  | 'payment_failed'
  | 'refund_issued'
  | 'invoice_created'
  | 'invoice_overdue'
  | 'notify'
  | 'reminder'
  | 'escalate'
  | 'broadcast'
  | 'import'
  | 'export'
  | 'sync';

export interface NotificationMetadata {
  refId: string;
  data?: Record<string, any>;
}

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
  metadata?: NotificationMetadata;
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
export interface BackendBasicResponse {
  success: boolean;
  message: string;
  [key: string]: any;
}
export interface PermanentDeletePayload {
  category: TitleCategory | string;
  refId: string;
  metadata?: Record<string, any>;
}

/* ==================== Config / helpers ==================== */

const DEFAULT_API_BASE = 'http://localhost:3000';
const NOTIFICATION_API_PATH = '/api-notification';

export interface LoadOptionsNew {
  page?: number;
  limit?: number;
  onlyUnread?: boolean;
  search?: string;
  category?: TitleCategory;
  severity?: Severity;
  channel?: Channel;
  type?: string;
  createdAfter?: string | Date;
  createdBefore?: string | Date;
  titles?: Title[];
}
export interface LoadOptionsLegacy {
  limit?: number;
  skip?: number;
  unread?: boolean;
}
export type LoadOptions = LoadOptionsNew | LoadOptionsLegacy;

/* ==================== Service ==================== */

@Injectable({providedIn: 'root'})
export class NotificationService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private socketSvc = inject(SocketService);

  private restBase = `${DEFAULT_API_BASE}${NOTIFICATION_API_PATH}`;

  private _items$ = new BehaviorSubject<Notification[]>([]);
  readonly items$ = this._items$.asObservable();

  private _connected$ = new BehaviorSubject<boolean>(false);
  private _rtt$ = new BehaviorSubject<number | null>(null);

  // Realtime event stream (only realtime pushes go here)
  private newSubject = new Subject<Notification>();

  // Latest one
  private latestSubject = new BehaviorSubject<Notification | null>(null);
  readonly latest$ = this.latestSubject.asObservable();

  private subs: Subscription[] = [];

  private tokenProvider?: () => string | Promise<string>;

  private notificationSoundPath: string = 'sounds/notification.mp3';
  private notificationAudio: HTMLAudioElement | null = null;

  constructor () {}

  get connected$(): Observable<boolean> {
    return this.socketSvc.connected$;
  }
  get rtt$(): Observable<number | null> {
    return this.socketSvc.rtt$;
  }

  private getAuthToken(): string | null {
    try {
      return localStorage.getItem('auth_token');
    } catch {
      return null;
    }
  }

  private normalize(n: Notification): Notification {
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

  private isLegacyLoadOptions(opts: LoadOptions): opts is LoadOptionsLegacy {
    return 'skip' in opts || 'unread' in opts;
  }

  // ─────────────────────────────────────────────────────────────
  // Sound
  // ─────────────────────────────────────────────────────────────

  private initNotificationSound(): void {
    if(!isPlatformBrowser(this.platformId)) return;
    if(this.notificationAudio) return;

    try {
      const audio = new Audio(this.notificationSoundPath);
      audio.oncanplaythrough = () => {
        console.log('🔊 [NotificationSound] Loaded OK:', this.notificationSoundPath);
      };
      audio.onerror = (ev) => {
        console.error('❌ [NotificationSound] Failed to load:', this.notificationSoundPath, ev);
      };

      audio.preload = 'auto';
      audio.volume = 0.6;

      this.notificationAudio = audio;
      console.log('🎧 [NotificationSound] Audio element created:', this.notificationAudio);
    } catch(err) {
      this.notificationAudio = null;
      console.warn('[Failed in notification sound init]: ', err);
    }
  }

  private playNotificationSound(): void {
    if(!isPlatformBrowser(this.platformId)) return;

    if(!this.notificationAudio) this.initNotificationSound();
    if(!this.notificationAudio) {
      console.warn('[NotificationSound] No audio instance; cannot play.');
      return;
    }

    try {
      this.notificationAudio.currentTime = 0;
      const result = this.notificationAudio.play();
      if(result && typeof (result as any).then === 'function') {
        (result as Promise<void>)
          .then(() => console.log('✅ [NotificationSound] Playback started'))
          .catch((err) => {
            console.error('🚫 [NotificationSound] Playback failed:', err);
          });
      }
    } catch(err) {
      console.error('🚫 [NotificationSound] Exception while playing:', err);
    }
  }

  public testPlayNotificationSound(): void {
    this.playNotificationSound();
  }

  // ---------------------------------------------------------------------------
  // Realtime: wiring to SocketService
  // ---------------------------------------------------------------------------

  public initConnection(opts?: {
    apiBase?: string;
    wsBase?: string;
    token?: string;
    tokenProvider?: () => string | Promise<string>;
  }): void {
    if(!isPlatformBrowser(this.platformId)) return;

    console.log('[NotificationService] initConnection called');

    this.restBase = `${(opts?.apiBase || DEFAULT_API_BASE).replace(/\/+$/, '')}${NOTIFICATION_API_PATH}`;
    this.tokenProvider = opts?.tokenProvider;

    const token = opts?.token ?? this.getAuthToken();
    if(!token) {
      console.warn('[NotificationService] initConnection: no token, aborting realtime.');
      return;
    }

    this.initNotificationSound();

    // Let SocketService own the actual socket. This call is idempotent.
    this.socketSvc.init({
      wsBase: (opts?.wsBase || (opts?.apiBase || DEFAULT_API_BASE)).replace(/\/+$/, ''),
      token,
      tokenProvider: this.tokenProvider,
    });

    this.clearRealtimeSubscriptions();

    // Mirror connection state / rtt
    this.subs.push(
      this.socketSvc.connected$.subscribe(v => this._connected$.next(v)),
      this.socketSvc.rtt$.subscribe(ms => this._rtt$.next(ms ?? null)),
    );

    // 🔥 MAIN FIX: listen to ALL events and pick any that look like notifications
    this.subs.push(
      this.socketSvc.events$.subscribe(({event, payload}) => {
        const ev = (event || '').toLowerCase();

        // Only care about events with "notification" in the name
        if(!ev.includes('notification')) return;

        if(this.looksLikeNotification(payload)) {
          console.log('[NotificationService] Realtime event matched:', event, payload._id);
          this.handleIncoming(payload as Notification);
        } else {
          console.log('[NotificationService] Ignored notification-like event (bad shape):', event, payload);
        }
      })
    );

    console.log('[NotificationService] realtime wiring complete (using events$)');
  }

  public updateToken(token: string): void {
    this.socketSvc.updateToken(token);
  }

  public subscribeRooms(rooms: string[]): void {
    this.socketSvc.joinRooms(rooms);
  }
  public unsubscribeRooms(rooms: string[]): void {
    this.socketSvc.leaveRooms(rooms);
  }

  public disconnect(): void {
    this.clearRealtimeSubscriptions();
    this._connected$.next(false);
    this._rtt$.next(null);
    this._items$.next([]);
  }

  private clearRealtimeSubscriptions(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    // no direct off needed; we rely on events$ (onAny) now
  }

  // ---------------------------------------------------------------------------
  // REST listing & read-state (fallback + initial list)
  // ---------------------------------------------------------------------------

  private authHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return token ? new HttpHeaders({Authorization: `Bearer ${token}`}) : new HttpHeaders();
  }

  public async load(opts: LoadOptions = {}): Promise<void> {
    const params = this.buildQueryParams(opts);
    const res = await firstValueFrom(
      this.http.get<{success: boolean; data: Notification[]}>(this.restBase, {
        params,
        headers: this.authHeaders(),
      })
    );
    const data = (res?.data ?? []).map((n) => this.normalize(n));
    const sorted = data
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 200);
    this._items$.next(sorted);
  }

  public load$(opts: LoadOptions = {}): Observable<Notification[]> {
    const params = this.buildQueryParams(opts);
    return this.http
      .get<{success: boolean; data: Notification[]}>(this.restBase, {
        params,
        headers: this.authHeaders(),
      })
      .pipe(
        map((res) => (res?.data ?? []).map((n) => this.normalize(n))),
        map((list) =>
          list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 200)
        ),
        tap((sorted) => this._items$.next(sorted))
      );
  }

  public loadOnlyUnread(page = 0, limit = 20) {
    return this.load({page, limit, onlyUnread: true});
  }
  public searchServer(query: string, page = 0, limit = 20) {
    return this.load({page, limit, search: query});
  }
  public byCategory(category: TitleCategory, page = 0, limit = 20) {
    return this.load({page, limit, category});
  }
  public bySeverity(severity: Severity, page = 0, limit = 20) {
    return this.load({page, limit, severity});
  }
  public byChannel(channel: Channel, page = 0, limit = 20) {
    return this.load({page, limit, channel});
  }
  public byType(type: string, page = 0, limit = 20) {
    return this.load({page, limit, type});
  }
  public byTitles(titles: Title[], page = 0, limit = 20) {
    return this.load({page, limit, titles});
  }
  public byDateRange(
    createdAfter?: Date | string,
    createdBefore?: Date | string,
    page = 0,
    limit = 20
  ) {
    return this.load({page, limit, createdAfter, createdBefore});
  }

  public async markRead(notificationId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.restBase}/${notificationId}/read`, {}, {headers: this.authHeaders()})
    );
    const now = new Date().toISOString();
    const updated = this._items$.value.map((n) =>
      n._id === notificationId
        ? this.normalize({
          ...n,
          userState: {...(n.userState ?? ({} as any)), isRead: true, readAt: now},
        } as Notification)
        : n
    );
    this._items$.next(updated);
  }

  public async markManyAsRead(ids: string[]): Promise<void> {
    if(!ids?.length) return;
    await firstValueFrom(
      this.http.post(`${this.restBase}/read-many`, {ids}, {headers: this.authHeaders()})
    );
    const now = new Date().toISOString();
    const updated = this._items$.value.map((n) =>
      ids.includes(n._id)
        ? this.normalize({
          ...n,
          userState: {...(n.userState ?? ({} as any)), isRead: true, readAt: now},
        } as Notification)
        : n
    );
    this._items$.next(updated);
  }

  public async markAllRead(): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.restBase}/read-all`, {}, {headers: this.authHeaders()})
    );
    const now = new Date().toISOString();
    const updated = this._items$.value.map((n) =>
      this.normalize({
        ...n,
        userState: {...(n.userState ?? ({} as any)), isRead: true, readAt: now},
      } as Notification)
    );
    this._items$.next(updated);
  }

  // ---------------------------------------------------------------------------
  // Restore / Permanent delete
  // ---------------------------------------------------------------------------

  public async restoreDeleteJson(
    payload: RestoreNotificationPayload
  ): Promise<BackendRestoreResponse> {
    const obs$ = this.http.post<BackendRestoreResponse>(
      `${this.restBase}/restore`,
      payload,
      {headers: this.authHeaders().set('Content-Type', 'application/json')}
    );
    return await lastValueFrom(obs$);
  }

  public async permanentDeleteJson(
    payload: PermanentDeletePayload,
    currentUserRole?: UserRole
  ): Promise<BackendBasicResponse> {
    if(currentUserRole && !this.isAdminRole(currentUserRole)) {
      return {
        success: false,
        message: 'Only administrators can permanently delete items.',
      };
    }
    const obs$ = this.http.post<BackendBasicResponse>(
      `${this.restBase}/permanent-delete`,
      {notification: payload},
      {headers: this.authHeaders().set('Content-Type', 'application/json')}
    );
    return await lastValueFrom(obs$);
  }

  // ---------------------------------------------------------------------------
  // Client-side selectors
  // ---------------------------------------------------------------------------

  public unreadNotifications$(): Observable<Notification[]> {
    return this.items$.pipe(map((list) => list.filter((n) => !n.userState?.isRead)));
  }
  public unreadCount$(): Observable<number> {
    return this.items$.pipe(
      map((list) => list.filter((n) => !n.userState?.isRead).length)
    );
  }
  public unreadCount(): number {
    return this._items$.value.filter((n) => !n.userState?.isRead).length;
  }

  public itemsByTag$(tag: string): Observable<Notification[]> {
    const q = (tag ?? '').trim().toLowerCase();
    if(!q) return this.items$;
    return this.items$.pipe(
      map((list) =>
        list.filter((n) =>
          (n.tags ?? [])
            .map((t) => t.toLowerCase())
            .some((t) => t.includes(q))
        )
      )
    );
  }

  public itemsByCategory$(category: TitleCategory): Observable<Notification[]> {
    return this.items$.pipe(map((list) => list.filter((n) => n.category === category)));
  }

  public itemsByRole$(role: UserRole): Observable<Notification[]> {
    return this.items$.pipe(
      map((list) => list.filter((n) => (n.audience?.roles ?? []).includes(role)))
    );
  }

  public itemsByUsername$(username: string): Observable<Notification[]> {
    return this.items$.pipe(
      map((list) =>
        list.filter((n) => (n.audience?.usernames ?? []).includes(username))
      )
    );
  }

  public itemsSearch$(query: string): Observable<Notification[]> {
    const q = (query ?? '').trim().toLowerCase();
    if(!q) return this.items$;
    return this.items$.pipe(
      map((list) =>
        list.filter((n) => {
          const title = (n.title ?? '').toLowerCase();
          const body = (n.body ?? '').toLowerCase();
          const tags = (n.tags ?? []).map((t) => t.toLowerCase());
          return (
            title.includes(q) || body.includes(q) || tags.some((t) => t.includes(q))
          );
        })
      )
    );
  }

  public itemById$(id: string): Observable<Notification | undefined> {
    return this.items$.pipe(map((list) => list.find((n) => n._id === id)));
  }

  /** Realtime: observable of new notifications (optionally with sound) */
  public onNew(playSound: boolean = false): Observable<Notification> {
    console.log('[NotificationService] onNew() called – playSound =', playSound);

    const base$ = this.newSubject.asObservable();

    if(!playSound) {
      return base$;
    }

    return base$.pipe(
      tap(() => {
        console.log('[NotificationService] onNew tap – about to play sound');
        this.playNotificationSound();
      })
    );
  }

  /** Upsert helper */
  public upsert(n: Notification): void {
    const incoming = this.normalize(n);
    const list = this._items$.value.slice();
    const idx = list.findIndex((x) => x._id === incoming._id);
    if(idx !== -1) {
      list[idx] = incoming;
    } else {
      list.unshift(incoming);
    }
    const sorted = list
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 200);
    this._items$.next(sorted);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private buildQueryParams(opts: LoadOptions): HttpParams {
    let params = new HttpParams();

    if(this.isLegacyLoadOptions(opts)) {
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
      if(o.onlyUnread !== undefined)
        params = params.set('onlyUnread', o.onlyUnread ? 'true' : 'false');
      if(o.search) params = params.set('search', o.search.trim());
      if(o.category) params = params.set('category', o.category);
      if(o.severity) params = params.set('severity', o.severity);
      if(o.channel) params = params.set('channel', o.channel);
      if(o.type) params = params.set('type', o.type);
      if(o.createdAfter)
        params = params.set('createdAfter', new Date(o.createdAfter).toISOString());
      if(o.createdBefore)
        params = params.set('createdBefore', new Date(o.createdBefore).toISOString());
      if(o.titles?.length) o.titles.forEach((t) => (params = params.append('titles', t)));
    }

    return params;
  }

  /** Light type-guard so we don't treat random payloads as notifications */
  private looksLikeNotification(payload: any): payload is Notification {
    return !!payload &&
      typeof payload === 'object' &&
      typeof payload._id === 'string' &&
      typeof payload.title === 'string' &&
      typeof payload.body === 'string' &&
      typeof payload.createdAt === 'string';
  }

  /**
   * Handle a new notification pushed from server:
   *  - Emit to observers via newSubject (onNew)
   *  - Upsert into local cache
   *  - ACK back using SocketService
   */
  private async handleIncoming(n: Notification): Promise<void> {
    console.log('[NotificationService] handleIncoming fired with:', n?._id, n?.title);
    const incoming = this.normalize(n);

    // Emit realtime stream
    this.newSubject.next(incoming);
    this.latestSubject.next(incoming);

    // Update list
    this.upsert(incoming);

    // ACK to server (best effort)
    try {
      await this.socketSvc.emitWithAck(
        'notification:ack',
        {notificationId: incoming._id},
        2000
      );
    } catch {
      // non-fatal
    }
  }

  private isAdminRole(role: UserRole): boolean {
    return role === 'admin';
  }
}
