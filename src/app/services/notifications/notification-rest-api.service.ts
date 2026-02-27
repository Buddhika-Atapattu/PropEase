// Path: src/app/services/notifications/notification-rest-api.service.ts
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, throwError } from "rxjs";
import { map, catchError } from "rxjs/operators";

import { environment } from "../../../environments/environment";

import type { MSG } from "../../types/api-message.types";
import type {
  NotificationInboxItemDto,
  NotificationLoadFilters,
  NotificationLoadRequest,
  NotificationScope,
  NotificationPriorityScope,
  NotificationCoreDto,
} from "../../types/notifications/notification.types";
import { AuthService } from "../auth/auth.service";
import type { User } from "../APIs/apis.service";

/* ============================================================================
 * NotificationRestApiService (Observable-first)
 * ----------------------------------------------------------------------------
 * Mirrors backend NotificationHubController routes:
 *  - POST /api-notification/inbox/load
 *  - POST /api-notification/inbox/count
 *  - POST /api-notification/inbox/scope/load
 *  - POST /api-notification/inbox/scope/count
 *  - POST /api-notification/inbox/:inboxId/read
 *  - POST /api-notification/inbox/read-all
 *  - POST /api-notification/inbox/:inboxId/archive
 * ========================================================================== */

export interface NotificationInboxLoadResult {
  items: NotificationInboxItemDto[];
  total: number;
}

export interface NotificationInboxCountResult {
  total: number;
  unread: number;
}

export interface NotificationInboxScopeLoadResult {
  items: NotificationInboxItemDto[];
  other: { total: number; unread: number; prioritized: number; unprioritized: number; };
}

export interface NotificationInboxScopeCountResult {
  total: number;
  unread: number;
  prioritized: number;
  unprioritized: number;
}

export interface NotificationInboxMutationResult {
  total: number;
  unread: number;

  inboxId?: string;
  changed?: boolean;
  changedCount?: number;
}

@Injectable( { providedIn: "root" } )
export class NotificationRestApiService {
  private readonly apiBase = environment.apiOrigin ?? "http://localhost:3000";
  private static readonly HARD_MAX_LIMIT: number = 500;

  constructor (
    private readonly http: HttpClient,
  ) {}



  private buildBase(): string {
    return `${ this.apiBase }/api-notification`;
  }

  private urlLoad(): string {
    return `${ this.buildBase() }/inbox/load`;
  }

  private buildCreate(): string {
    return `${ this.buildBase() }/create`;
  }

  private buildUpdate( id: NotificationCoreDto[ 'id' ] ): string {
    return `${ this.buildBase() }/update/${ id }`;
  }

  private buildDelete( id: NotificationCoreDto[ 'id' ] ): string {
    return `${ this.buildBase() }/delete/${ id }`;
  }

  private urlCount(): string {
    return `${ this.buildBase() }/inbox/count`;
  }

  private urlScopeLoad(): string {
    return `${ this.buildBase() }/inbox/scope/load`;
  }

  private urlScopeCount(): string {
    return `${ this.buildBase() }/inbox/scope/count`;
  }

  private urlMarkRead( inboxId: string ): string {
    return `${ this.buildBase() }/inbox/${ this.safeSeg( inboxId ) }/read`;
  }

  private urlMarkAllRead(): string {
    return `${ this.buildBase() }/inbox/read-all`;
  }

  private urlArchive( inboxId: string ): string {
    return `${ this.buildBase() }/inbox/${ this.safeSeg( inboxId ) }/archive`;
  }


  // ---------------------------------------------------------------------------
  // API: CRUD (MSG-first, consistent with your system)
  // ---------------------------------------------------------------------------

  /**
   * Create a user-supplied notification.
   *
   * Backend expects:
   * POST /api-notification/create
   * body: { notification: NotificationCoreDto }
   *
   * Returns: MSG
   * - msg.data.system.notification => NotificationCoreDto
   * - msg.data.other.delivered     => delivery result envelope (engine-specific)
   */
  public create$( notification: NotificationCoreDto ): Observable<MSG> {
    const url = this.buildCreate();

    // exactOptionalPropertyTypes-safe: strict object, no undefined fields
    const body: { notification: NotificationCoreDto; } = { notification };

    return this.http.post<MSG>( url, body ).pipe(
      map( ( msg ) => this.assertSuccess( msg, "create" ) ),
      catchError( ( err ) => this.toHttpError( "create", err ) )
    );
  }

  /**
   * Update ONLY title/body (your backend rule).
   *
   * Backend expects:
   * PATCH /api-notification/update/:notificationId
   * body: { patch: { title?: string; body?: string } }
   *
   * Returns: MSG
   * - msg.data.system.notification => updated NotificationCoreDto (recommended)
   */
  public updateTitleBody$(
    notificationId: NotificationCoreDto[ "id" ],
    patch: { title?: string; body?: string; }
  ): Observable<MSG> {
    const id = this.mustString( notificationId, "notificationId" );
    const url = this.buildUpdate( id );

    // Build patch payload without undefined values
    const patchBody: { title?: string; body?: string; } = {};

    if ( typeof patch.title === "string" ) {
      const t = patch.title.trim();
      if ( t ) patchBody.title = t;
    }

    if ( typeof patch.body === "string" ) {
      const b = patch.body.trim();
      if ( b ) patchBody.body = b;
    }

    if ( Object.keys( patchBody ).length === 0 ) {
      return throwError( () => new Error( "NotificationRestApiService: nothing to update (title/body empty)." ) );
    }

    const body: { patch: { title?: string; body?: string; }; } = { patch: patchBody };

    return this.http.patch<MSG>( url, body ).pipe(
      map( ( msg ) => this.assertSuccess( msg, "updateTitleBody" ) ),
      catchError( ( err ) => this.toHttpError( "updateTitleBody", err ) )
    );
  }

  /**
   * Delete notification (hard delete).
   *
   * Backend expects:
   * DELETE /api-notification/delete/:notificationId
   *
   * Returns: MSG
   * - msg.data.system.deleted => { notificationId, deleted, inboxRowsDeleted }
   * - msg.data.other.notificationId => string (controller adds it)
   */
  public delete$( notificationId: NotificationCoreDto[ "id" ] ): Observable<MSG> {
    const id = this.mustString( notificationId, "notificationId" );
    const url = this.buildDelete( id );

    return this.http.delete<MSG>( url ).pipe(
      map( ( msg ) => this.assertSuccess( msg, "delete" ) ),
      catchError( ( err ) => this.toHttpError( "delete", err ) )
    );
  }

  // ---------------------------------------------------------------------------
  // API: Queries (legacy/basic)
  // ---------------------------------------------------------------------------

  public loadInbox$( request: NotificationLoadRequest ): Observable<NotificationInboxLoadResult> {
    const url = this.urlLoad();
    const body = this.normalizeLoadRequest( request );

    return this.http.post<MSG>( url, body ).pipe(
      map( ( msg ) => this.assertSuccess( msg, "loadInbox" ) ),
      map( ( msg ) => {
        const items = this.readSystemArray<NotificationInboxItemDto>( msg, "notifications" );
        const total = this.readPaginationTotal( msg );
        return { items, total };
      } ),
      catchError( ( err ) => this.toHttpError( "loadInbox", err ) )
    );
  }

  public countInbox$( filters: NotificationLoadFilters ): Observable<NotificationInboxCountResult> {
    const url = this.urlCount();
    const body: { filters: NotificationLoadFilters; } = { filters: this.normalizeFilters( filters ) };

    return this.http.post<MSG>( url, body ).pipe(
      map( ( msg ) => this.assertSuccess( msg, "countInbox" ) ),
      map( ( msg ) => {
        const other = this.readOtherObject<{ unread?: unknown; }>( msg );
        const unread = this.safeInt( other.unread, 0 );
        const total = this.readPaginationTotal( msg );
        return { total, unread };
      } ),
      catchError( ( err ) => this.toHttpError( "countInbox", err ) )
    );
  }

  // ---------------------------------------------------------------------------
  // API: Queries (NEW scope endpoints)
  // ---------------------------------------------------------------------------

  /**
   * REST backup for scope-based listing:
   * POST /api-notification/inbox/scope/load
   *
   * Backend forces username/role from auth, but request.username is still required by DTO,
   * so we send a safe placeholder ("me").
   */
  public loadInboxByScope$(
    scope: NotificationScope,
    priorityScope: NotificationPriorityScope,
    page: number,
    limit: number,
    filters: NotificationLoadFilters,
    me: User
  ): Observable<NotificationInboxScopeLoadResult> {
    const url = this.urlScopeLoad();


    const request: NotificationLoadRequest = {
      userId: me?._id ?? '',
      username: me?.username ?? '',
      page: this.safePage( page ),
      limit: this.safeLimit( limit ),
      filters: this.normalizeFilters( filters ),
      me
    };

    const body: {
      scope: NotificationScope;
      priorityScope: NotificationPriorityScope;
      request: NotificationLoadRequest;
    } = {
      scope: this.safeScope( scope ),
      priorityScope: this.safePriorityScope( priorityScope ),
      request,
    };

    return this.http.post<MSG>( url, body ).pipe(
      map( ( msg ) => this.assertSuccess( msg, "loadInboxByScope" ) ),
      map( ( msg ) => {
        const items = this.readSystemArray<NotificationInboxItemDto>( msg, "notifications" );
        const other = this.readOtherObject<{
          total?: unknown;
          unread?: unknown;
          prioritized?: unknown;
          unprioritized?: unknown;
        }>( msg );

        // Backend also repeats total in pagination.total; we trust pagination for consistency.
        const total = this.readPaginationTotal( msg );

        return {
          items,
          other: {
            total,
            unread: this.safeInt( other.unread, 0 ),
            prioritized: this.safeInt( other.prioritized, 0 ),
            unprioritized: this.safeInt( other.unprioritized, 0 ),
          },
        };
      } ),
      catchError( ( err ) => this.toHttpError( "loadInboxByScope", err ) )
    );
  }

  /**
   * REST backup for scope-based counts:
   * POST /api-notification/inbox/scope/count
   */
  public countInboxByScope$(
    scope: NotificationScope,
    priorityScope: NotificationPriorityScope,
    filters: NotificationLoadFilters
  ): Observable<NotificationInboxScopeCountResult> {
    const url = this.urlScopeCount();

    const body: { scope: NotificationScope; priorityScope: NotificationPriorityScope; filters: NotificationLoadFilters; } = {
      scope: this.safeScope( scope ),
      priorityScope: this.safePriorityScope( priorityScope ),
      filters: this.normalizeFilters( filters ),
    };

    return this.http.post<MSG>( url, body ).pipe(
      map( ( msg ) => this.assertSuccess( msg, "countInboxByScope" ) ),
      map( ( msg ) => {
        const other = this.readOtherObject<{
          total?: unknown;
          unread?: unknown;
          prioritized?: unknown;
          unprioritized?: unknown;
        }>( msg );

        const total = this.readPaginationTotal( msg );

        return {
          total,
          unread: this.safeInt( other.unread, 0 ),
          prioritized: this.safeInt( other.prioritized, 0 ),
          unprioritized: this.safeInt( other.unprioritized, 0 ),
        };
      } ),
      catchError( ( err ) => this.toHttpError( "countInboxByScope", err ) )
    );
  }
  // ---------------------------------------------------------------------------
  // API: Mutations
  // ---------------------------------------------------------------------------

  public markRead$( inboxId: string ): Observable<NotificationInboxMutationResult> {
    const url = this.urlMarkRead( inboxId );

    return this.http.post<MSG>( url, {} ).pipe(
      map( ( msg ) => this.assertSuccess( msg, "markRead" ) ),
      map( ( msg ) => {
        const other = this.readOtherObject<{ inboxId?: unknown; changed?: unknown; unread?: unknown; }>( msg );

        const out: NotificationInboxMutationResult = {
          total: this.readPaginationTotal( msg ),
          unread: this.safeInt( other.unread, 0 ),
        };

        const inboxIdSafe = this.safeString( other.inboxId );
        if ( inboxIdSafe ) out.inboxId = inboxIdSafe;

        if ( typeof other.changed === "boolean" ) out.changed = other.changed;

        return out;
      } ),
      catchError( ( err ) => this.toHttpError( "markRead", err ) )
    );
  }

  public markAllRead$(): Observable<NotificationInboxMutationResult> {
    const url = this.urlMarkAllRead();

    return this.http.post<MSG>( url, {} ).pipe(
      map( ( msg ) => this.assertSuccess( msg, "markAllRead" ) ),
      map( ( msg ) => {
        const other = this.readOtherObject<{ changedCount?: unknown; unread?: unknown; }>( msg );

        const out: NotificationInboxMutationResult = {
          total: this.readPaginationTotal( msg ),
          unread: this.safeInt( other.unread, 0 ),
        };

        const changedCount = this.safeIntOrUndefined( other.changedCount );
        if ( typeof changedCount === "number" ) out.changedCount = changedCount;

        return out;
      } ),
      catchError( ( err ) => this.toHttpError( "markAllRead", err ) )
    );
  }

  public archiveOne$( inboxId: string ): Observable<NotificationInboxMutationResult> {
    const url = this.urlArchive( inboxId );

    return this.http.post<MSG>( url, {} ).pipe(
      map( ( msg ) => this.assertSuccess( msg, "archiveOne" ) ),
      map( ( msg ) => {
        const other = this.readOtherObject<{ inboxId?: unknown; changed?: unknown; unread?: unknown; }>( msg );

        const out: NotificationInboxMutationResult = {
          total: this.readPaginationTotal( msg ),
          unread: this.safeInt( other.unread, 0 ),
        };

        const inboxIdSafe = this.safeString( other.inboxId );
        if ( inboxIdSafe ) out.inboxId = inboxIdSafe;

        if ( typeof other.changed === "boolean" ) out.changed = other.changed;

        return out;
      } ),
      catchError( ( err ) => this.toHttpError( "archiveOne", err ) )
    );
  }

  // ---------------------------------------------------------------------------
  // MSG parsing helpers (null-safe)
  // ---------------------------------------------------------------------------

  private assertSuccess( msg: MSG, op: string ): MSG {
    if ( !msg || msg.success !== true ) {
      const m = msg?.message ? String( msg.message ) : "Request failed";
      // eslint-disable-next-line no-console
      console.error( `[Error:] [NotificationRestApiService] ${ op } failed: ${ m }\n` );
      throw new Error( m );
    }
    return msg;
  }

  private readPaginationTotal( msg: MSG ): number {
    return this.safeInt( msg.data?.pagination?.total, 0 );
  }

  private readSystemArray<T>( msg: MSG, key: string ): T[] {
    const sys = msg.data?.system;
    if ( !sys ) return [];

    const v = ( sys as Record<string, unknown> )[ key ];
    if ( Array.isArray( v ) ) return v as T[];

    return [];
  }

  private readOtherObject<T extends Record<string, unknown>>( msg: MSG ): T {
    const other = msg.data?.other;
    if ( other && typeof other === "object" ) return other as T;
    return {} as T;
  }

  // ---------------------------------------------------------------------------
  // Input normalizers (exactOptionalPropertyTypes-safe)
  // ---------------------------------------------------------------------------

  private normalizeLoadRequest( input: NotificationLoadRequest ): NotificationLoadRequest {
    const out: NotificationLoadRequest = {
      userId: this.mustString( input.userId, 'userId' ),
      username: this.mustString( input.username, "username" ),
      page: this.safePage( input.page ),
      limit: this.safeLimit( input.limit ),
      filters: this.normalizeFilters( input.filters ?? {} ),
      me: input.me
    };

    return out;
  }

  private normalizeFilters( filters: NotificationLoadFilters ): NotificationLoadFilters {
    const out: NotificationLoadFilters = {};

    if ( filters.category ) out.category = filters.category;
    if ( filters.severity ) out.severity = filters.severity;
    if ( filters.mode ) out.mode = filters.mode;

    const search = this.safeString( filters.search );
    if ( search ) out.search = search;

    const from = this.safeIso( filters.from );
    if ( from ) out.from = from;

    const to = this.safeIso( filters.to );
    if ( to ) out.to = to;

    if ( typeof filters.unreadOnly === "boolean" ) out.unreadOnly = filters.unreadOnly;
    if ( typeof filters.includeDeleted === "boolean" ) out.includeDeleted = filters.includeDeleted;
    if ( typeof filters.includeArchived === "boolean" ) out.includeArchived = filters.includeArchived;

    return out;
  }

  // ---------------------------------------------------------------------------
  // Sanitizers
  // ---------------------------------------------------------------------------

  private safeSeg( v: unknown ): string {
    return encodeURIComponent( this.safeString( v ) );
  }

  private mustString( v: unknown, label: string ): string {
    const s = this.safeString( v );
    if ( !s ) throw new Error( `NotificationRestApiService: ${ label } is required.` );
    return s;
  }

  private safeString( v: unknown ): string {
    if ( typeof v === "string" ) return v.trim();
    if ( typeof v === "number" ) return String( v );
    return "";
  }

  private safeIso( v: unknown ): string {
    const s = this.safeString( v );
    if ( !s ) return "";
    if ( !/^\d{4}-\d{2}-\d{2}T/.test( s ) ) return "";
    return s;
  }

  private safeScope( v: unknown ): NotificationScope {
    if ( v === "user" || v === "role" || v === "company" ) return v;
    return "user";
  }

  private safePriorityScope( v: unknown ): NotificationPriorityScope {
    if ( v === "all" || v === "prioritized" || v === "unprioritized" ) return v;
    return "all";
  }

  private safePage( v: unknown ): number {
    const n = typeof v === "number" ? v : Number( v );
    if ( !Number.isFinite( n ) || n < 1 ) return 1;
    return Math.floor( n );
  }

  private safeLimit( v: unknown ): number {
    const n = typeof v === "number" ? v : Number( v );

    // Missing/invalid => default 100 (your choice)
    if ( !Number.isFinite( n ) ) return 100;

    // ✅ 0 or negative => "load all"
    if ( n <= 0 ) return NotificationRestApiService.HARD_MAX_LIMIT;

    return Math.min( Math.floor( n ), NotificationRestApiService.HARD_MAX_LIMIT );
  }

  private safeInt( v: unknown, fallback: number ): number {
    const n = typeof v === "number" ? v : Number( v );
    if ( !Number.isFinite( n ) ) return fallback;
    return Math.floor( n );
  }

  private safeIntOrUndefined( v: unknown ): number | undefined {
    const n = typeof v === "number" ? v : Number( v );
    if ( !Number.isFinite( n ) ) return undefined;
    return Math.floor( n );
  }

  private toHttpError( op: string, err: unknown ): Observable<never> {
    const msg = err instanceof Error ? err.message : String( err ?? "Unknown error" );
    // eslint-disable-next-line no-console
    console.error( `[Error:] [NotificationRestApiService] ${ op } http error: ${ msg }\n` );
    console.error( err );
    return throwError( () => new Error( msg ) );
  }
}


