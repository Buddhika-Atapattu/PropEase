// Path: src/app/services/notifications/notification-service.ts
// -----------------------------------------------------------------------------
// NotificationService
// -----------------------------------------------------------------------------
// Responsibilities:
//  - REST access to Notification Center (/api-notification)
//  - Realtime notifications via shared SocketService (no direct socket.io here)
//  - Local cache + selectors + sound effects
//
// Notes:
//  - API base is driven by environment.apiOrigin (or http://localhost:3000).
//  - REST base is **always** backend URL; never falls back to FE origin.
//  - WebSocket base prefers opts.wsBase, otherwise falls back to apiOrigin.
//  - Notification sound path is configurable; default assumes assets are served
//    from "public/sounds/notification.mp3" per PropEase asset convention.
// -----------------------------------------------------------------------------

import {
  Injectable,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

import {
  BehaviorSubject,
  Observable,
  Subject,
  Subscription,
  firstValueFrom,
  lastValueFrom,
} from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { SocketService } from '../socket/socket-service';
import {
  RestoreNotificationPayload,
  BackendRestoreResponse,
} from '../../types/notification.types';
import { environment } from '../../../environments/environment';
import type { Role } from '../auth/user.contract';

/* ============================================================================
 * Shared Types
 * ==========================================================================*/

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
  roles?: Role[];
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
  data?: Record<string, unknown>;
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

export interface ResponseMSG {
  status: number | string;
  message: string;
  data: unknown;
}

export interface BackendBasicResponse {
  success: boolean;
  message: string;
  [ key: string ]: unknown;
}

export interface PermanentDeletePayload {
  category: TitleCategory | string;
  refId: string;
  metadata?: Record<string, unknown>;
}

/* ============================================================================
 * Load Options
 * ==========================================================================*/

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

/* ============================================================================
 * NotificationService
 * ==========================================================================*/

@Injectable( { providedIn: 'root' } )
export class NotificationService {
  // Angular DI
  private readonly http = inject( HttpClient );
  private readonly platformId = inject( PLATFORM_ID );
  private readonly socketSvc = inject( SocketService );

  // API roots
  private readonly apiRoot: string =
    ( environment.apiOrigin ?? 'http://localhost:3000' ).replace( /\/+$/, '' );

  // Canonical REST root for notifications
  private readonly notificationRoot: string =
    `${ this.apiRoot }/api-notification`;

  /**
   * Effective REST base for this instance.
   *  - Defaults to notificationRoot (backend origin).
   *  - Can be overridden in initConnection via opts.apiBase.
   *  - Never allowed to be empty → avoids falling back to FE origin.
   */
  private restBase: string = this.notificationRoot;

  // State
  private readonly _items$ = new BehaviorSubject<Notification[]>( [] );
  readonly items$ = this._items$.asObservable();

  private readonly _connected$ = new BehaviorSubject<boolean>( false );
  private readonly _rtt$ = new BehaviorSubject<number | null>( null );

  // Realtime streams
  private readonly newSubject = new Subject<Notification>();
  private readonly latestSubject = new BehaviorSubject<Notification | null>( null );
  readonly latest$ = this.latestSubject.asObservable();

  private subs: Subscription[] = [];

  private tokenProvider?: () => string | Promise<string>;

  // ──────────────────────────────────────────────────────────────────────────
  // Sound configuration
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Default sound path:
   *  - Assumes assets are under top-level "public" per PropEase convention.
   *  - You can override this in initConnection if needed.
   */
  private notificationSoundPath: string = 'sounds/notification.mp3';
  private notificationAudio: HTMLAudioElement | null = null;

  public constructor () {
    // No immediate side-effects; all wiring via initConnection/load
  }

  /* ========================================================================
   * Public read-only streams
   * ======================================================================*/

  get connected$(): Observable<boolean> {
    return this.socketSvc.connected$;
  }

  get rtt$(): Observable<number | null> {
    return this.socketSvc.rtt$;
  }

  /* ========================================================================
   * Token helpers (fallback for direct REST auth)
   * ======================================================================*/

  private getAuthTokens(): { session: string | null; guard: string | null; } {
    if ( !isPlatformBrowser( this.platformId ) ) {
      return { session: null, guard: null };
    }
    try {
      const session = localStorage.getItem( 'sessionToken' );
      const guard = localStorage.getItem( 'guardToken' );
      return { session, guard };
    } catch {
      return { session: null, guard: null };
    }
  }

  private authHeaders(): HttpHeaders {
    const { session, guard } = this.getAuthTokens();

    let headers = new HttpHeaders();

    // Session token (JWT)
    if ( session && session.trim() ) {
      headers = headers
        .set( 'Authorization', `Bearer ${ session.trim() }` )
        .set( 'x-session-token', session.trim() );
    }

    // Guard token (pair validator)
    if ( guard && guard.trim() ) {
      headers = headers.set( 'x-guard-token', guard.trim() );
    }

    return headers;
  }

  /* ========================================================================
   * Normalization & type guards
   * ======================================================================*/

  private normalize( n: Notification ): Notification {
    return {
      ...n,
      channels: n.channels?.length ? n.channels : [ 'inapp' ],
      userState: {
        isRead: n.userState?.isRead ?? false,
        isArchived: n.userState?.isArchived ?? false,
        deliveredAt: n.userState?.deliveredAt ?? n.createdAt,
        readAt: n.userState?.readAt,
      },
    };
  }

  private isLegacyLoadOptions( opts: LoadOptions ): opts is LoadOptionsLegacy {
    return 'skip' in opts || 'unread' in opts;
  }

  private looksLikeNotification( payload: unknown ): payload is Notification {
    if ( !payload || typeof payload !== 'object' ) return false;

    const obj: any = payload;
    return (
      typeof obj._id === 'string' &&
      typeof obj.title === 'string' &&
      typeof obj.body === 'string' &&
      typeof obj.createdAt === 'string'
    );
  }

  /* ========================================================================
   * Sound handling
   * ======================================================================*/

  /**
   * Init audio element once in browser.
   * Uses notificationSoundPath, which can be overridden via initConnection if
   * you want environment-specific paths.
   */
  private initNotificationSound(): void {
    if ( !isPlatformBrowser( this.platformId ) ) return;
    if ( this.notificationAudio ) return;

    try {
      const audio = new Audio( this.notificationSoundPath );

      audio.oncanplaythrough = () => {
        console.log(
          '🔊 [NotificationSound] Loaded OK:',
          this.notificationSoundPath,
        );
      };

      audio.onerror = ( ev ) => {
        console.error(
          '❌ [NotificationSound] Failed to load:',
          this.notificationSoundPath,
          ev,
        );
      };

      audio.preload = 'auto';
      audio.volume = 0.6;

      this.notificationAudio = audio;
      console.log(
        '🎧 [NotificationSound] Audio element created:',
        this.notificationAudio,
      );
    } catch ( err ) {
      this.notificationAudio = null;
      console.warn(
        '[NotificationSound] Failed during init:',
        err,
      );
    }
  }

  private playNotificationSound(): void {
    if ( !isPlatformBrowser( this.platformId ) ) return;

    if ( !this.notificationAudio ) {
      this.initNotificationSound();
    }

    if ( !this.notificationAudio ) {
      console.warn( '[NotificationSound] No audio instance; cannot play.' );
      return;
    }

    try {
      this.notificationAudio.currentTime = 0;
      const result = this.notificationAudio.play();

      if ( result && typeof ( result as any ).then === 'function' ) {
        ( result as Promise<void> )
          .then( () =>
            console.log( '✅ [NotificationSound] Playback started' ),
          )
          .catch( ( err ) =>
            console.error(
              '🚫 [NotificationSound] Playback failed:',
              err,
            ),
          );
      }
    } catch ( err ) {
      console.error(
        '🚫 [NotificationSound] Exception while playing:',
        err,
      );
    }
  }

  /** Manual test hook from UI / dev tools. */
  public testPlayNotificationSound(): void {
    this.playNotificationSound();
  }

  /* ========================================================================
   * Realtime: wiring to SocketService
   * ======================================================================*/

  public initConnection( opts?: {
    wsBase?: string;                   // Optional override for WebSocket base
    token?: string;                    // Optional explicit token (else localStorage)
    tokenProvider?: () => string | Promise<string>;
    notificationSoundPath?: string;    // Optional override for sound path
  } ): void {
    if ( !isPlatformBrowser( this.platformId ) ) return;

    console.log( '[NotificationService] initConnection called' );

    // 1) REST base: always backend /api-notification.
    const restBaseRaw = this.notificationRoot.replace( /\/+$/, '' );
    this.restBase = restBaseRaw;

    // 2) Sound path override (optional)
    if ( opts?.notificationSoundPath ) {
      this.notificationSoundPath = opts.notificationSoundPath;
    }

    this.tokenProvider = opts?.tokenProvider;

    const { session, guard } = this.getAuthTokens();

    // 3) Token resolution: prefer explicit token, then local storage
    const token = opts?.token ?? session;
    if ( !token ) {
      console.warn(
        '[NotificationService] initConnection: no token, aborting realtime.',
      );
      return;
    }

    // 4) Init sound
    this.initNotificationSound();

    // 5) WebSocket base: prefer wsBase, else apiRoot
    const wsBaseRaw = ( opts?.wsBase || this.apiRoot ).replace( /\/+$/, '' );

    // SocketService owns the actual socket; this call should be idempotent.
    this.socketSvc.init( {
      wsBase: wsBaseRaw,
      token,
      tokenProvider: this.tokenProvider,
    } );

    // 6) Clean stale subscriptions & reattach
    this.clearRealtimeSubscriptions();

    // Mirror connection state / RTT
    this.subs.push(
      this.socketSvc.connected$.subscribe( ( v ) => this._connected$.next( v ) ),
      this.socketSvc.rtt$.subscribe( ( ms ) =>
        this._rtt$.next( ms ?? null ),
      ),
    );

    // 7) Main realtime pipeline: listen to all events on events$ and
    //    handle only those whose event name contains "notification".
    this.subs.push(
      this.socketSvc.events$.subscribe( ( { event, payload } ) => {
        const ev = ( event || '' ).toLowerCase();

        if ( !ev.includes( 'notification' ) ) {
          return;
        }

        if ( this.looksLikeNotification( payload ) ) {
          console.log(
            '[NotificationService] Realtime event matched:',
            event,
            payload._id,
          );
          void this.handleIncoming( payload as Notification );
        } else {
          console.log(
            '[NotificationService] Ignored notification-like event (bad shape):',
            event,
            payload,
          );
        }
      } ),
    );

    console.log(
      '[NotificationService] Realtime wiring complete (restBase =',
      this.restBase,
      ', wsBase =',
      wsBaseRaw,
      ')',
    );
  }

  public updateToken( token: string ): void {
    this.socketSvc.updateToken( token );
  }

  public subscribeRooms( rooms: string[] ): void {
    this.socketSvc.joinRooms( rooms );
  }

  public unsubscribeRooms( rooms: string[] ): void {
    this.socketSvc.leaveRooms( rooms );
  }

  public disconnect(): void {
    this.clearRealtimeSubscriptions();
    this._connected$.next( false );
    this._rtt$.next( null );
    this._items$.next( [] );
  }

  private clearRealtimeSubscriptions(): void {
    this.subs.forEach( ( s ) => s.unsubscribe() );
    this.subs = [];
  }

  /* ========================================================================
   * REST listing & read-state
   * ======================================================================*/

  /** Defensive getter – never returns empty URL (avoids FE-origin fallback). */
  private getRestBase(): string {
    if ( !this.restBase || !this.restBase.trim() ) {
      const fallback = this.notificationRoot;
      console.warn(
        '[NotificationService] restBase was empty – using fallback:',
        fallback,
      );
      this.restBase = fallback;
    }
    return this.restBase;
  }

  private buildQueryParams( opts: LoadOptions ): HttpParams {
    let params = new HttpParams();

    if ( this.isLegacyLoadOptions( opts ) ) {
      const limit = opts.limit ?? 30;
      const skip = opts.skip ?? 0;
      const safeLimit = Math.max( 1, limit );
      const page = Math.max( 0, Math.floor( skip / safeLimit ) );
      const onlyUnread = !!opts.unread;

      params = params
        .set( 'limit', String( limit ) )
        .set( 'page', String( page ) )
        .set( 'onlyUnread', onlyUnread ? 'true' : 'false' );
      return params;
    }

    const o = opts as LoadOptionsNew;

    if ( typeof o.page === 'number' ) {
      params = params.set( 'page', String( o.page ) );
    }
    if ( typeof o.limit === 'number' ) {
      params = params.set( 'limit', String( o.limit ) );
    }
    if ( o.onlyUnread !== undefined ) {
      params = params.set(
        'onlyUnread',
        o.onlyUnread ? 'true' : 'false',
      );
    }
    if ( o.search ) {
      params = params.set( 'search', o.search.trim() );
    }
    if ( o.category ) {
      params = params.set( 'category', o.category );
    }
    if ( o.severity ) {
      params = params.set( 'severity', o.severity );
    }
    if ( o.channel ) {
      params = params.set( 'channel', o.channel );
    }
    if ( o.type ) {
      params = params.set( 'type', o.type );
    }
    if ( o.createdAfter ) {
      params = params.set(
        'createdAfter',
        new Date( o.createdAfter ).toISOString(),
      );
    }
    if ( o.createdBefore ) {
      params = params.set(
        'createdBefore',
        new Date( o.createdBefore ).toISOString(),
      );
    }
    if ( o.titles?.length ) {
      for ( const t of o.titles ) {
        params = params.append( 'titles', t );
      }
    }

    return params;
  }

  public async load( opts: LoadOptions = {} ): Promise<void> {
    const params = this.buildQueryParams( opts );
    const url = this.getRestBase();

    const res = await firstValueFrom(
      this.http.get<{ success: boolean; data: Notification[]; }>(
        url,
        {
          params,
          headers: this.authHeaders(),
          withCredentials: true,
        },
      ),
    );

    const data = ( res?.data ?? [] ).map( ( n ) => this.normalize( n ) );
    const sorted = data
      .sort(
        ( a, b ) =>
          +new Date( b.createdAt ) - +new Date( a.createdAt ),
      )
      .slice( 0, 200 );

    this._items$.next( sorted );
  }

  public load$( opts: LoadOptions = {} ): Observable<Notification[]> {
    const params = this.buildQueryParams( opts );
    const url = this.getRestBase();

    return this.http
      .get<{ success: boolean; data: Notification[]; }>( url, {
        params,
        headers: this.authHeaders(),
        withCredentials: true,
      } )
      .pipe(
        map( ( res ) =>
          ( res?.data ?? [] ).map( ( n ) => this.normalize( n ) ),
        ),
        map( ( list ) =>
          list
            .sort(
              ( a, b ) =>
                +new Date( b.createdAt ) - +new Date( a.createdAt ),
            )
            .slice( 0, 200 ),
        ),
        tap( ( sorted ) => this._items$.next( sorted ) ),
      );
  }

  // Convenience wrappers

  public loadOnlyUnread( page = 0, limit = 20 ): Promise<void> {
    return this.load( { page, limit, onlyUnread: true } );
  }

  public searchServer(
    query: string,
    page = 0,
    limit = 20,
  ): Promise<void> {
    return this.load( { page, limit, search: query } );
  }

  public byCategory(
    category: TitleCategory,
    page = 0,
    limit = 20,
  ): Promise<void> {
    return this.load( { page, limit, category } );
  }

  public bySeverity(
    severity: Severity,
    page = 0,
    limit = 20,
  ): Promise<void> {
    return this.load( { page, limit, severity } );
  }

  public byChannel(
    channel: Channel,
    page = 0,
    limit = 20,
  ): Promise<void> {
    return this.load( { page, limit, channel } );
  }

  public byType(
    type: string,
    page = 0,
    limit = 20,
  ): Promise<void> {
    return this.load( { page, limit, type } );
  }

  public byTitles(
    titles: Title[],
    page = 0,
    limit = 20,
  ): Promise<void> {
    return this.load( { page, limit, titles } );
  }

  public byDateRange(
    createdAfter?: Date | string,
    createdBefore?: Date | string,
    page = 0,
    limit = 20,
  ): Promise<void> {
    return this.load( {
      page,
      limit,
      createdAfter,
      createdBefore,
    } );
  }

  /* ========================================================================
   * Read-state mutations
   * ======================================================================*/

  public async markRead( notificationId: string ): Promise<void> {
    const url = `${ this.getRestBase() }/${ notificationId }/read`;

    await firstValueFrom(
      this.http.post(
        url,
        {},
        { headers: this.authHeaders(), withCredentials: true, },
      ),
    );

    const now = new Date().toISOString();

    const updated = this._items$.value.map( ( n ) =>
      n._id === notificationId
        ? this.normalize( {
          ...n,
          userState: {
            ...( n.userState ?? ( {} as any ) ),
            isRead: true,
            readAt: now,
          },
        } as Notification )
        : n,
    );

    this._items$.next( updated );
  }

  public async markManyAsRead( ids: string[] ): Promise<void> {
    if ( !ids?.length ) return;

    const url = `${ this.getRestBase() }/read-many`;

    await firstValueFrom(
      this.http.post(
        url,
        { ids },
        { headers: this.authHeaders(), withCredentials: true, },
      ),
    );

    const now = new Date().toISOString();

    const updated = this._items$.value.map( ( n ) =>
      ids.includes( n._id )
        ? this.normalize( {
          ...n,
          userState: {
            ...( n.userState ?? ( {} as any ) ),
            isRead: true,
            readAt: now,
          },
        } as Notification )
        : n,
    );

    this._items$.next( updated );
  }

  public async markAllRead(): Promise<void> {
    const url = `${ this.getRestBase() }/read-all`;

    await firstValueFrom(
      this.http.post(
        url,
        {},
        { headers: this.authHeaders(), withCredentials: true, },
      ),
    );

    const now = new Date().toISOString();

    const updated = this._items$.value.map( ( n ) =>
      this.normalize( {
        ...n,
        userState: {
          ...( n.userState ?? ( {} as any ) ),
          isRead: true,
          readAt: now,
        },
      } as Notification ),
    );

    this._items$.next( updated );
  }

  /* ========================================================================
   * Restore / Permanent delete
   * ======================================================================*/

  public async restoreDeleteJson(
    payload: RestoreNotificationPayload,
  ): Promise<BackendRestoreResponse> {
    const url = `${ this.getRestBase() }/restore`;

    const obs$ = this.http.post<BackendRestoreResponse>(
      url,
      payload,
      {
        headers: this.authHeaders().set(
          'Content-Type',
          'application/json',
        ),
        withCredentials: true,
      },
    );

    return await lastValueFrom( obs$ );
  }

  public async permanentDeleteJson(
    payload: PermanentDeletePayload,
    currentUserRole?: UserRole,
  ): Promise<BackendBasicResponse> {
    if ( currentUserRole && !this.isAdminRole( currentUserRole ) ) {
      return {
        success: false,
        message:
          'Only administrators can permanently delete items.',
      };
    }

    const url = `${ this.getRestBase() }/permanent-delete`;

    const obs$ = this.http.post<BackendBasicResponse>(
      url,
      { notification: payload },
      {
        headers: this.authHeaders().set(
          'Content-Type',
          'application/json',
        ),
        withCredentials: true,
      },
    );

    return await lastValueFrom( obs$ );
  }

  /* ========================================================================
   * Client-side selectors
   * ======================================================================*/

  public unreadNotifications$(): Observable<Notification[]> {
    return this.items$.pipe(
      map( ( list ) =>
        list.filter( ( n ) => !n.userState?.isRead ),
      ),
    );
  }

  public unreadCount$(): Observable<number> {
    return this.items$.pipe(
      map(
        ( list ) =>
          list.filter( ( n ) => !n.userState?.isRead ).length,
      ),
    );
  }

  public unreadCount(): number {
    return this._items$.value.filter(
      ( n ) => !n.userState?.isRead,
    ).length;
  }

  public itemsByTag$( tag: string ): Observable<Notification[]> {
    const q = ( tag ?? '' ).trim().toLowerCase();
    if ( !q ) return this.items$;

    return this.items$.pipe(
      map( ( list ) =>
        list.filter( ( n ) =>
          ( n.tags ?? [] )
            .map( ( t ) => t.toLowerCase() )
            .some( ( t ) => t.includes( q ) ),
        ),
      ),
    );
  }

  public itemsByCategory$(
    category: TitleCategory,
  ): Observable<Notification[]> {
    return this.items$.pipe(
      map( ( list ) =>
        list.filter( ( n ) => n.category === category ),
      ),
    );
  }

  public itemsByRole$(
    role: UserRole,
  ): Observable<Notification[]> {
    return this.items$.pipe(
      map( ( list ) =>
        list.filter( ( n ) =>
          ( n.audience?.roles ?? [] ).includes( role ),
        ),
      ),
    );
  }

  public itemsByUsername$(
    username: string,
  ): Observable<Notification[]> {
    return this.items$.pipe(
      map( ( list ) =>
        list.filter( ( n ) =>
          ( n.audience?.usernames ?? [] ).includes(
            username,
          ),
        ),
      ),
    );
  }

  public itemsSearch$(
    query: string,
  ): Observable<Notification[]> {
    const q = ( query ?? '' ).trim().toLowerCase();
    if ( !q ) return this.items$;

    return this.items$.pipe(
      map( ( list ) =>
        list.filter( ( n ) => {
          const title = ( n.title ?? '' ).toLowerCase();
          const body = ( n.body ?? '' ).toLowerCase();
          const tags = ( n.tags ?? [] ).map( ( t ) =>
            t.toLowerCase(),
          );

          return (
            title.includes( q ) ||
            body.includes( q ) ||
            tags.some( ( t ) => t.includes( q ) )
          );
        } ),
      ),
    );
  }

  public itemById$(
    id: string,
  ): Observable<Notification | undefined> {
    return this.items$.pipe(
      map( ( list ) => list.find( ( n ) => n._id === id ) ),
    );
  }

  /**
   * Realtime observable of new notifications.
   * If playSound = true, plays notification sound on each new item.
   */
  public onNew(
    playSound: boolean = false,
  ): Observable<Notification> {
    const base$ = this.newSubject.asObservable();

    if ( !playSound ) {
      return base$;
    }

    return base$.pipe(
      tap( () => {
        console.log(
          '[NotificationService] onNew tap – about to play sound',
        );
        this.playNotificationSound();
      } ),
    );
  }

  /** Upsert helper for internal cache. */
  public upsert( n: Notification ): void {
    const incoming = this.normalize( n );
    const list = this._items$.value.slice();
    const idx = list.findIndex( ( x ) => x._id === incoming._id );

    if ( idx !== -1 ) {
      list[ idx ] = incoming;
    } else {
      list.unshift( incoming );
    }

    const sorted = list
      .sort(
        ( a, b ) =>
          +new Date( b.createdAt ) - +new Date( a.createdAt ),
      )
      .slice( 0, 200 );

    this._items$.next( sorted );
  }

  /* ========================================================================
   * Internal realtime handler
   * ======================================================================*/

  private async handleIncoming(
    n: Notification,
  ): Promise<void> {
    console.log(
      '[NotificationService] handleIncoming fired with:',
      n?._id,
      n?.title,
    );

    const incoming = this.normalize( n );

    // Realtime streams
    this.newSubject.next( incoming );
    this.latestSubject.next( incoming );

    // Local cache
    this.upsert( incoming );

    // Best-effort ACK to server
    try {
      await this.socketSvc.emitWithAck(
        'notification:ack',
        { notificationId: incoming._id },
        2000,
      );
    } catch {
      // Non-fatal; ignore
    }
  }

  /* ========================================================================
   * Role helpers
   * ======================================================================*/

  private isAdminRole( role: UserRole ): boolean {
    return role === 'admin';
  }
}
