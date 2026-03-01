// Path: src/app/services/notifications/notification-center.service.ts
// =============================================================================
// NotificationCenterService (WS-first + REST fallback) — FIXED + COMPLETE
// =============================================================================
// 01) Introduction
// - Single state hub for Notification UI.
// - Maintains:
//    A) Live inbox snapshot (push-driven)
//    B) Live counts snapshot
//    C) WS-first operations with REST fallback
//
// 02) Important matters
// - MUST NOT depend on notification UI being opened.
// - MUST bind WS push streams once per app runtime.
// - SSR-safe: never touch Audio/window unless browser.
//
// 03) Why we make this class
// - Centralize notification streams and mutation operations.
// - Prevent “works only after clicking bell icon” & duplicate subscription bugs.
// - Provide Direct vs Overall lists/counts without backend changes.
//
// 04) Parameter expectations
// - See each method JSDoc.
// =============================================================================

import { Injectable, Inject, PLATFORM_ID, OnDestroy } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import {
  BehaviorSubject,
  Observable,
  Subject,
  Subscription,
  catchError,
  from,
  map,
  of,
  switchMap,
  take,
  tap,
  defer,
  race,
  timer
} from "rxjs";

import type {
  NotificationInboxItemDto,
  NotificationCountResponse,
  NotificationLoadFilters,
} from "../../types/notifications/notification.types";

import {
  NotificationSocketService,
  type NotificationScope,
  type NotificationPriorityScope,
  type WsInboxListRes,
  type WsInboxCountsRes,
  type WsMarkReadRes,
  type WsMarkAllReadRes,
} from "./notification-socket.service";

import {
  NotificationRestApiService,
  type NotificationInboxScopeLoadResult,
  type NotificationInboxScopeCountResult,
  type NotificationInboxMutationResult,
} from "./notification-rest-api.service";

import type { User } from "../APIs/apis.service";

import type { MSG } from "../../types/api-message.types";
import type { NotificationCoreDto } from "../../types/notifications/notification.types";

export type NotificationViewMode = "direct" | "overall";

export interface NotificationInboxView {
  items: NotificationInboxItemDto[];
  other: {
    total: number;
    unread: number;
    prioritized: number;
    unprioritized: number;
  };
}

@Injectable( { providedIn: "root" } )
export class NotificationCenterService implements OnDestroy {
  // =============================================================================
  // 0) Local state stores
  // =============================================================================

  private readonly inbox$ = new BehaviorSubject<NotificationInboxItemDto[]>( [] );
  private readonly counts$ = new BehaviorSubject<NotificationCountResponse>( {
    total: 0,
    unread: 0,
    prioritized: 0,
    unprioritized: 0,
  } );

  private lastLoad: {
    scope: NotificationScope;
    priorityScope: NotificationPriorityScope;
    page: number;
    limit: number;
    filters: NotificationLoadFilters;
    me: User;
  } | null = null;

  /** emitted after state update on WS push notify:new */
  private readonly onNew$ = new Subject<NotificationInboxItemDto>();

  private started = false;
  private pushBound = false;

  private readonly subs = new Subscription();

  // =============================================================================
  // 1) Sound (SSR-safe)
  // =============================================================================

  private readonly notificationSoundUrl: string =
    "public/sounds/notification-pop-up.mp3";

  private readonly isBrowser: boolean;
  private audio: HTMLAudioElement | null = null;

  private readonly soundCooldownMs: number = 900;
  private lastSoundAtMs: number = 0;

  public constructor (
    private readonly ws: NotificationSocketService,
    private readonly rest: NotificationRestApiService,
    @Inject( PLATFORM_ID ) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
    this.initNotificationSoundSafe();
  }

  public ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // =============================================================================
  // 2) Public Observables (Backwards compatible)
  // =============================================================================

  public connected$(): Observable<boolean> {
    return this.ws.isConnected$();
  }

  public notifications$(): Observable<NotificationInboxItemDto[]> {
    return this.inbox$.asObservable();
  }

  public unreadCount$(): Observable<number> {
    return this.counts$.asObservable().pipe( map( ( c ) => this.safeInt( c.unread ) ) );
  }

  public countsSnapshot$(): Observable<NotificationCountResponse> {
    return this.counts$.asObservable();
  }

  public onNew( playSound: boolean ): Observable<NotificationInboxItemDto> {
    if ( playSound !== true ) return this.onNew$.asObservable();
    return this.onNew$.asObservable().pipe( tap( () => this.playSoundSafe() ) );
  }

  // =============================================================================
  // 3) Lifecycle
  // =============================================================================

  /**
   * Start notification engine (bind push streams once + hydrate).
   *
   * @param options.scope
   * - "user" | "role" | "company"
   *
   * @param options.priorityScope
   * - "all" | "prioritized" | "unprioritized"
   *
   * @param options.page
   * - 1-based page index
   *
   * @param options.limit
   * - items per page (<=0 => load all up to hard limit)
   *
   * @param options.filters
   * - NotificationLoadFilters
   *
   * @param options.me
   * - logged user object (must include _id + username)
   */
  public start( options?: {
    scope?: NotificationScope;
    priorityScope?: NotificationPriorityScope;
    page?: number;
    limit?: number;
    filters?: NotificationLoadFilters;
    me?: User;
  } ): void {
    if ( this.started ) return;
    this.started = true;

    this.bindPushStreamsOnce();

    const scope: NotificationScope = options?.scope ?? "user";
    const priorityScope: NotificationPriorityScope = options?.priorityScope ?? "all";
    const page = this.safePage( options?.page );
    const limit = this.safeLimit( options?.limit );
    const filters: NotificationLoadFilters = options?.filters ?? {};
    const me = options?.me ?? null;

    if ( !me || !this.safeStr( ( me as any )?._id ) || !this.safeStr( ( me as any )?.username ) ) {
      // keep app stable; do not throw into UI
      // eslint-disable-next-line no-console
      console.warn(
        `[Warning:] [NotificationCenterService] start() skipped: invalid me\n`
      );
      return;
    }

    this.load$( { scope, priorityScope, page, limit, filters, me } )
      .pipe( take( 1 ) )
      .subscribe( { next: () => undefined, error: () => undefined } );
  }

  /** Stop engine (logout). Clears local state. */
  public stop(): void {
    this.started = false;
    this.inbox$.next( [] );
    this.counts$.next( { total: 0, unread: 0, prioritized: 0, unprioritized: 0 } );
  }

  // =============================================================================
  // 4) Hydrate (component refresh uses this)
  // =============================================================================

  /**
   * Load inbox + counts for a given scope (WS-first, REST fallback).
   * Writes into BehaviorSubjects; returns Observable<void>.
   */
  public load$( options: {
    scope: NotificationScope;
    priorityScope: NotificationPriorityScope;
    page: number;
    limit: number;
    filters: NotificationLoadFilters;
    me: User;
  } ): Observable<void> {
    const { scope, priorityScope, page, limit, filters, me } = options;
    this.lastLoad = { scope, priorityScope, page, limit, filters, me };

    return this.loadByScope$( scope, priorityScope, page, limit, filters, me ).pipe(
      tap( ( view ) => {
        this.inbox$.next( Array.isArray( view.items ) ? view.items : [] );
        this.counts$.next( this.normalizeCounts( view.other ) );
      } ),
      map( () => undefined ),
      catchError( () => of( undefined ) )
    );
  }

  // =============================================================================
  // 5) Direct vs Overall (your requested feature)
  // =============================================================================

  public loadDirect$(
    priorityScope: NotificationPriorityScope,
    page: number,
    limit: number,
    filters: NotificationLoadFilters,
    me: User
  ): Observable<NotificationInboxView> {
    return this.loadByScope$( "user", priorityScope, page, limit, filters, me );
  }

  public loadOverall$(
    priorityScope: NotificationPriorityScope,
    page: number,
    limit: number,
    filters: NotificationLoadFilters,
    me: User
  ): Observable<NotificationInboxView> {
    return this.mergeTwoScopes$(
      { scope: "role", priorityScope, page, limit, filters, me },
      { scope: "company", priorityScope, page, limit, filters, me }
    );
  }

  public countsDirect$(
    priorityScope: NotificationPriorityScope,
    filters: NotificationLoadFilters
  ): Observable<WsInboxCountsRes> {
    return this.countsByScope$( "user", priorityScope, filters );
  }

  public countsOverall$(
    priorityScope: NotificationPriorityScope,
    filters: NotificationLoadFilters,
    me: User
  ): Observable<NotificationCountResponse> {
    const pg = 1;
    const lim = 0; // safeLimit => 500

    return this.loadOverall$(priorityScope, pg, lim, filters, me).pipe(
      map((v) => ({
        total: this.safeInt(v.other.total),
        unread: this.safeInt(v.other.unread),
        prioritized: this.safeInt(v.other.prioritized),
        unprioritized: this.safeInt(v.other.unprioritized),
      })),
      catchError(() => of({ total: 0, unread: 0, prioritized: 0, unprioritized: 0 }))
    );
  }

  // =============================================================================
  // 5B) Unified (Direct + Overall) — FIXED: Direct wins, no double counts
  // =============================================================================

  public loadUnified$(
    priorityScope: NotificationPriorityScope,
    page: number,
    limit: number,
    filters: NotificationLoadFilters,
    me: User
  ): Observable<NotificationInboxView> {
    // Direct first => direct wins if same notification.id exists in overall
    return this.loadDirect$( priorityScope, page, limit, filters, me ).pipe(
      switchMap( ( direct ) =>
        this.loadOverall$( priorityScope, page, limit, filters, me ).pipe(
          map( ( overall ) => {
            const merged = this.mergePreferByNotificationId( direct.items, overall.items );
            return { items: merged, other: this.computeCountsFromItems( merged ) };
          } )
        )
      )
    );
  }

  /**
   * Unified counts without trusting backend counts (because backend counts rows).
   * We compute from merged unique notifications to prevent doubling.
   *
   * NOTE:
   * - For accurate counts, this must see enough items to represent the inbox.
   * - Use limit<=0 (your code maps it to 500) to get the "latest 500" cap.
   */
  public countsUnified$(
    priorityScope: NotificationPriorityScope,
    filters: NotificationLoadFilters,
    me: User
  ): Observable<NotificationCountResponse> {
    const pg = 1;
    const lim = 0; // your safeLimit() => 500

    return this.loadUnified$( priorityScope, pg, lim, filters, me ).pipe(
      map( ( v ) => ( {
        total: this.safeInt( v.other.total ),
        unread: this.safeInt( v.other.unread ),
        prioritized: this.safeInt( v.other.prioritized ),
        unprioritized: this.safeInt( v.other.unprioritized ),
      } ) ),
      catchError( () =>
        of( { total: 0, unread: 0, prioritized: 0, unprioritized: 0 } )
      )
    );
  }

  // =============================================================================
  // 6) Mutations — mark read / mark all read / archive
  // =============================================================================

  /**
 * Legacy/basic load (no scope). WS-first uses scope=user + priority=all.
 * REST fallback hits /inbox/load for backward compatibility.
 */
  public loadInboxLegacy$(
    page: number,
    limit: number,
    filters: NotificationLoadFilters,
    me: User
  ): Observable<{ items: NotificationInboxItemDto[]; total: number; }> {
    const pg = this.safePage( page );
    const lim = this.safeLimit( limit );
    const f = filters ?? {};

    return this.preferWsThenRest$( {
      ws: async () => {
        const x = await this.ws.rpcInboxList( {
          scope: "role",
          priorityScope: "all",
          page: pg,
          limit: lim,
          filters: f,
        } );
        return { items: x.items ?? [], total: this.safeInt( x.other?.total ) };
      },
      rest: () =>
        this.rest.loadInbox$( {
          userId: ( me as any )?._id ?? "",
          username: ( me as any )?.username ?? "",
          page: pg,
          limit: lim,
          filters: f,
          me: me as any,
        } as any ),
      wsTimeoutMs: 15000,
      restDelayMs: 450,
    } );
  }

  /**
   * Legacy/basic counts (no scope). WS-first uses scope=user + priority=all.
   * REST fallback hits /inbox/count.
   */
  public countInboxLegacy$( filters: NotificationLoadFilters ): Observable<{ total: number; unread: number; }> {
    const f = filters ?? {};

    return this.preferWsThenRest$( {
      ws: async () => {
        const x = await this.ws.rpcInboxCounts( { scope: "user", priorityScope: "all", filters: f } );
        return { total: this.safeInt( x.total ), unread: this.safeInt( x.unread ) };
      },
      rest: () => this.rest.countInbox$( f ),
      wsTimeoutMs: 12000,
      restDelayMs: 450,
    } );
  }

  public markRead$( inboxId: string ): Observable<WsMarkReadRes> {
    const id = this.safeStr( inboxId );
    if ( !id ) return of( { changed: false } );

    return this.ws.isConnected$().pipe(
      take( 1 ),
      switchMap( ( connected ) => {
        if ( !connected ) {
          return this.rest.markRead$( id ).pipe(
            tap( ( res ) => this.onRestMutationReadOne( id, res ) ),
            map( ( res ) => ( { changed: res.changed === true } ) ),
            catchError( () => of( { changed: false } ) )
          );
        }

        return from( this.ws.rpcMarkRead( id ) ).pipe(
          tap( ( res ) => {
            if ( res.changed === true ) {
              this.patchLocalReadOne( id );
              this.patchCountsUnreadDecrement( 1 );
            }
          } ),
          catchError( () =>
            this.rest.markRead$( id ).pipe(
              tap( ( res ) => this.onRestMutationReadOne( id, res ) ),
              map( ( res ) => ( { changed: res.changed === true } ) ),
              catchError( () => of( { changed: false } ) )
            )
          )
        );
      } )
    );
  }

  public markAllRead$(): Observable<WsMarkAllReadRes> {
    return this.ws.isConnected$().pipe(
      take( 1 ),
      switchMap( ( connected ) => {
        if ( !connected ) {
          return this.rest.markAllRead$().pipe(
            tap( ( res ) => {
              this.patchLocalReadAll();
              this.patchCountsFromRest( res.total, res.unread, undefined, undefined );
            } ),
            map( ( res ) => ( { changedCount: this.safeInt( res.changedCount ) } ) ),
            catchError( () => of( { changedCount: 0 } ) )
          );
        }

        return from( this.ws.rpcMarkAllRead() ).pipe(
          tap( () => {
            this.patchLocalReadAll();
            this.patchCountsUnreadSet( 0 );
          } ),
          catchError( () =>
            this.rest.markAllRead$().pipe(
              tap( ( res ) => {
                this.patchLocalReadAll();
                this.patchCountsFromRest( res.total, res.unread, undefined, undefined );
              } ),
              map( ( res ) => ( { changedCount: this.safeInt( res.changedCount ) } ) ),
              catchError( () => of( { changedCount: 0 } ) )
            )
          )
        );
      } )
    );
  }

  public archiveOne$( inboxId: string ): Observable<{ changed: boolean; }> {
    const id = this.safeStr( inboxId );
    if ( !id ) return of( { changed: false } );

    return this.ws.isConnected$().pipe(
      take( 1 ),
      switchMap( ( connected ) => {
        // REST-only if WS is down
        if ( !connected ) {
          return this.rest.archiveOne$( id ).pipe(
            tap( ( res ) => {
              if ( res.changed === true ) this.patchLocalArchiveOne( id );
              this.patchCountsFromRest( res.total, res.unread, undefined, undefined );
            } ),
            map( ( res ) => ( { changed: res.changed === true } ) ),
            catchError( () => of( { changed: false } ) )
          );
        }

        // WS-first, REST fallback
        return from( this.ws.rpcArchiveOne( id ) ).pipe(
          tap( ( res ) => {
            if ( res.changed === true ) {
              this.patchLocalArchiveOne( id );
              // counts: you only adjust unread locally on read ops; archive affects totals
              // safest is to rely on server push count OR REST fallback refresh later.
            }
          } ),
          map( ( res ) => ( { changed: res.changed === true } ) ),
          catchError( () =>
            this.rest.archiveOne$( id ).pipe(
              tap( ( res ) => {
                if ( res.changed === true ) this.patchLocalArchiveOne( id );
                this.patchCountsFromRest( res.total, res.unread, undefined, undefined );
              } ),
              map( ( res ) => ( { changed: res.changed === true } ) ),
              catchError( () => of( { changed: false } ) )
            )
          )
        );
      } )
    );
  }

  // =============================================================================
  // 6B) CRUD — create / update(title+body) / delete (MSG-first)
  // =============================================================================

  /**
   * Create notification (REST only, MSG-first).
   * - Backend will also WS-push to recipients. For creator UX we refresh from server.
   */
  public create$( notification: NotificationCoreDto ): Observable<MSG> {
    return this.rest.create$( notification ).pipe(
      tap( ( msg ) => {
        // Best UX: reconcile from server truth (especially if audiences include role/company)
        this.refreshLastSafe();
      } ),
      catchError( ( err ) => of( err as unknown as MSG ) )
    );
  }

  /**
   * Update ONLY title/body (REST only, MSG-first).
   * - We also patch local snapshot immediately if possible.
   */
  public updateTitleBody$(
    notificationId: NotificationCoreDto[ "id" ],
    patch: { title?: string; body?: string; }
  ): Observable<MSG> {
    const id = this.safeStr( notificationId );
    if ( !id ) return of( { success: false, message: "notificationId required", data: {} as any } as MSG );

    return this.rest.updateTitleBody$( id, patch ).pipe(
      tap( ( msg ) => {
        // If backend returns updated notification in system.notification, patch local
        const updated = this.readSystemObject<NotificationCoreDto>( msg, "notification" );
        if ( updated && this.safeStr( updated.id ) === id ) {
          this.patchLocalNotificationTitleBody( id, updated.title, updated.body );
        } else {
          // fallback: patch using provided inputs if present
          const t = typeof patch.title === "string" ? patch.title.trim() : "";
          const b = typeof patch.body === "string" ? patch.body.trim() : "";
          if ( t || b ) this.patchLocalNotificationTitleBody( id, t || undefined, b || undefined );
        }

        // counts may not change but WS count might arrive; still safe to refresh later if needed
      } ),
      catchError( ( err ) => of( err as unknown as MSG ) )
    );
  }

  /**
   * Delete notification (REST only, MSG-first).
   * - Removes all inbox rows in DB. We remove from local immediately by notificationId.
   */
  public delete$( notificationId: NotificationCoreDto[ "id" ] ): Observable<MSG> {
    const id = this.safeStr( notificationId );
    if ( !id ) return of( { success: false, message: "notificationId required", data: {} as any } as MSG );

    return this.rest.delete$( id ).pipe(
      tap( () => {
        // Immediate local remove
        this.patchLocalRemoveByNotificationId( id );

        // Reconcile counts from server truth (recommended)
        this.refreshCountsLastSafe();
      } ),
      catchError( ( err ) => of( err as unknown as MSG ) )
    );
  }

  // =============================================================================
  // 7) WS-first operations (list + counts) — ALIGNED TO YOUR SERVICES
  // =============================================================================

  public loadByScope$(
    scope: NotificationScope,
    priorityScope: NotificationPriorityScope,
    page: number,
    limit: number,
    filters: NotificationLoadFilters,
    me: User
  ): Observable<NotificationInboxView> {
    const s = scope;
    const p = priorityScope;
    const pg = this.safePage( page );
    const lim = this.safeLimit( limit );
    const f = filters ?? {};

    return this.preferWsThenRest$<NotificationInboxView>( {
      ws: async () => {
        const x = await this.ws.rpcInboxList( { scope: s, priorityScope: p, page: pg, limit: lim, filters: f } );
        return this.toViewFromWsList( x );
      },
      rest: () => this.rest.loadInboxByScope$( s, p, pg, lim, f, me ).pipe( map( ( x ) => this.toViewFromRestScopeLoad( x ) ) ),
      wsTimeoutMs: 15000,
      restDelayMs: 450,
    } );
  }

  public countsByScope$(
    scope: NotificationScope,
    priorityScope: NotificationPriorityScope,
    filters: NotificationLoadFilters
  ): Observable<WsInboxCountsRes> {
    const s = scope;
    const p = priorityScope;
    const f = filters ?? {};

    return this.preferWsThenRest$<WsInboxCountsRes>( {
      ws: async () => {
        const x = await this.ws.rpcInboxCounts( { scope: s, priorityScope: p, filters: f } );
        return x;
      },
      rest: () => this.rest.countInboxByScope$( s, p, f ).pipe( map( ( x ) => this.toCountsFromRest( x ) ) ),
      wsTimeoutMs: 12000,
      restDelayMs: 450,
    } );
  }

  /**
 * Prefer WebSocket, fallback to REST.
 * Optionally start REST after a short delay in parallel, then take first success.
 *
 * @param options.ws
 * - WS producer (Promise-based)
 *
 * @param options.rest
 * - REST producer (Observable-based)
 *
 * @param options.wsTimeoutMs
 * - Max time to wait for WS ACK path before fallback becomes important
 *
 * @param options.restDelayMs
 * - Delay before starting REST in parallel (0 = start immediately in parallel)
 * - Recommended: 250-600ms so WS gets first chance
 */
  private preferWsThenRest$<T>( options: {
    ws: () => Promise<T>;
    rest: () => Observable<T>;
    wsTimeoutMs?: number;
    restDelayMs?: number;
  } ): Observable<T> {
    const wsTimeoutMs = typeof options.wsTimeoutMs === "number" ? Math.max( 1000, options.wsTimeoutMs ) : 12000;
    const restDelayMs = typeof options.restDelayMs === "number" ? Math.max( 0, options.restDelayMs ) : 450;

    return this.ws.isConnected$().pipe(
      take( 1 ),
      switchMap( ( connected ) => {
        // If WS is not connected -> REST only
        if ( !connected ) {
          return options.rest().pipe( catchError( () => of( null as unknown as T ) ) );
        }

        // WS attempt (Promise -> Observable)
        const ws$ = defer( () => from( options.ws() ) ).pipe(
          catchError( () => of( null as unknown as T ) )
        );

        // REST attempt (starts after delay, in parallel)
        const rest$ = timer( restDelayMs ).pipe(
          switchMap( () => options.rest().pipe( catchError( () => of( null as unknown as T ) ) ) )
        );

        // Take the first non-nullish result
        return race( ws$, rest$ ).pipe(
          map( ( v ) => v ),
          // If winner was null (both failed), run REST one last time (best effort)
          switchMap( ( v ) => {
            if ( v !== null && v !== undefined ) return of( v );
            return options.rest().pipe( catchError( () => of( null as unknown as T ) ) );
          } )
        );
      } )
    );
  }

  // =============================================================================
  // 8) Merge helpers (role + company)
  // =============================================================================

  private mergeTwoScopes$(
    a: {
      scope: NotificationScope;
      priorityScope: NotificationPriorityScope;
      page: number;
      limit: number;
      filters: NotificationLoadFilters;
      me: User;
    },
    b: {
      scope: NotificationScope;
      priorityScope: NotificationPriorityScope;
      page: number;
      limit: number;
      filters: NotificationLoadFilters;
      me: User;
    }
  ): Observable<NotificationInboxView> {
    return this.loadByScope$( a.scope, a.priorityScope, a.page, a.limit, a.filters, a.me ).pipe(
      switchMap( ( va ) =>
        this.loadByScope$( b.scope, b.priorityScope, b.page, b.limit, b.filters, b.me ).pipe(
          map( ( vb ) => {
            // IMPORTANT:
            // - Prefer A over B when notification.id duplicates exist
            //   (A wins)
            const merged = this.mergePreferByNotificationId( va.items, vb.items );

            return {
              items: merged,
              other: this.computeCountsFromItems( merged ),
            };
          } )
        )
      )
    );
  }

  private mergeTwoCounts$(
    a: { scope: NotificationScope; priorityScope: NotificationPriorityScope; filters: NotificationLoadFilters; },
    b: { scope: NotificationScope; priorityScope: NotificationPriorityScope; filters: NotificationLoadFilters; }
  ): Observable<WsInboxCountsRes> {
    return this.countsByScope$( a.scope, a.priorityScope, a.filters ).pipe(
      switchMap( ( ca ) =>
        this.countsByScope$( b.scope, b.priorityScope, b.filters ).pipe(
          map( ( cb ) => ( {
            total: this.safeInt( ca.total ) + this.safeInt( cb.total ),
            unread: this.safeInt( ca.unread ) + this.safeInt( cb.unread ),
            prioritized: this.safeInt( ca.prioritized ) + this.safeInt( cb.prioritized ),
            unprioritized: this.safeInt( ca.unprioritized ) + this.safeInt( cb.unprioritized ),
          } ) )
        )
      )
    );
  }

  // =============================================================================
  // 9) Push streams -> local state hydration + SOUND
  // =============================================================================

  private bindPushStreamsOnce(): void {
    if ( this.pushBound ) return;
    this.pushBound = true;

    this.subs.add(
      this.ws.onNewNotification$().subscribe( {
        next: ( p ) => {
          const curr = this.inbox$.value;
          const next = this.mergeItems( [ p.item ], curr ); // new item first + dedupe/sort
          this.inbox$.next( next );

          if ( p.count ) this.counts$.next( this.normalizeCountPayload( p.count ) );

          this.onNew$.next( p.item );
          this.playSoundSafe();
        },
        error: () => undefined,
      } )
    );

    this.subs.add(
      this.ws.onPatchNotification$().subscribe( {
        next: ( p ) => {
          const id = this.safeStr( p.inboxId );
          if ( !id ) return;

          const curr = this.inbox$.value;
          const patched = curr.map( ( x ) => {
            if ( this.safeStr( ( x as any )?.inboxId ) !== id ) return x;



            const base: any = { ...( x as any ) };

            if ( typeof p.patch?.isRead === "boolean" ) base.isRead = p.patch.isRead;
            if ( typeof p.patch?.isDeleted === "boolean" ) base.isDeleted = p.patch.isDeleted;
            if ( typeof p.patch?.isArchived === "boolean" ) base.isArchived = p.patch.isArchived;

            const readAt = this.safeStr( p.patch?.readAt );
            if ( readAt ) base.readAt = readAt;

            const archivedAt = this.safeStr( p.patch?.archivedAt );
            if ( archivedAt ) base.archivedAt = archivedAt;


            const patchNotif = ( p as any )?.patch?.notification;
            if ( patchNotif && typeof patchNotif === "object" ) {
              const title = this.safeStr( ( patchNotif as any ).title );
              const body = this.safeStr( ( patchNotif as any ).body );

              if ( title || body ) {
                const n0 = ( base as any ).notification && typeof ( base as any ).notification === "object"
                  ? { ...( base as any ).notification }
                  : {};

                if ( title ) n0.title = title;
                if ( body ) n0.body = body;

                ( base as any ).notification = n0;
              }
            }

            return base as NotificationInboxItemDto;
          } );

          this.inbox$.next( this.sortByCreatedAtDesc( patched ) );
          if ( p.count ) this.counts$.next( this.normalizeCountPayload( p.count ) );
        },
        error: () => undefined,
      } )
    );

    this.subs.add(
      this.ws.onCountUpdate$().subscribe( {
        next: ( c ) => this.counts$.next( this.normalizeCountPayload( c ) ),
        error: () => undefined,
      } )
    );

    this.subs.add(
      this.ws.onBulkUpdate$().subscribe( {
        next: ( p ) => {
          if ( p.count ) this.counts$.next( this.normalizeCountPayload( p.count ) );
        },
        error: () => undefined,
      } )
    );

    this.subs.add(
      this.ws.onDeleteNotification$().subscribe( {
        next: ( p ) => {
          const notificationId = this.safeStr( ( p as any )?.notificationId );
          const inboxId = this.safeStr( ( p as any )?.inboxId );

          // Prefer notificationId (master delete removes all rows)
          if ( notificationId ) {
            const before = this.inbox$.value;
            const removed = before.filter( ( x ) => this.safeStr( ( x as any )?.notification?.id ) === notificationId );

            const next = before.filter( ( x ) => this.safeStr( ( x as any )?.notification?.id ) !== notificationId );
            this.inbox$.next( next );

            // counts: safest is to trust push count if present
            if ( ( p as any )?.count ) this.counts$.next( this.normalizeCountPayload( ( p as any ).count ) );
            return;
          }

          // Fallback: single inboxId delete
          if ( inboxId ) {
            const next = this.inbox$.value.filter( ( x ) => this.safeStr( ( x as any )?.inboxId ) !== inboxId );
            this.inbox$.next( next );

            if ( ( p as any )?.count ) this.counts$.next( this.normalizeCountPayload( ( p as any ).count ) );
          }
        },
        error: () => undefined,
      } )
    );
  }

  // =============================================================================
  // 10) Local patch helpers (UI instant updates)
  // =============================================================================

  private patchLocalReadOne( inboxId: string ): void {
    const id = this.safeStr( inboxId );
    if ( !id ) return;

    const now = new Date().toISOString();
    const next = this.inbox$.value.map( ( x ) => {
      if ( this.safeStr( ( x as any )?.inboxId ) !== id ) return x;
      if ( ( x as any )?.isRead === true ) return x;
      return { ...( x as any ), isRead: true, readAt: now } as NotificationInboxItemDto;
    } );

    this.inbox$.next( next );
  }

  private patchLocalReadAll(): void {
    const now = new Date().toISOString();
    const next = this.inbox$.value.map( ( x ) => {
      if ( ( x as any )?.isRead === true ) return x;
      return { ...( x as any ), isRead: true, readAt: now } as NotificationInboxItemDto;
    } );
    this.inbox$.next( next );
  }

  private patchLocalArchiveOne( inboxId: string ): void {
    const id = this.safeStr( inboxId );
    if ( !id ) return;

    const now = new Date().toISOString();
    const next = this.inbox$.value.map( ( x ) => {
      if ( this.safeStr( ( x as any )?.inboxId ) !== id ) return x;
      return { ...( x as any ), isArchived: true, archivedAt: now } as NotificationInboxItemDto;
    } );

    this.inbox$.next( next );
  }

  private patchCountsUnreadDecrement( by: number ): void {
    const c = this.counts$.value;
    const unread = Math.max( 0, this.safeInt( c.unread ) - Math.max( 0, this.safeInt( by ) ) );
    this.counts$.next( { ...c, unread } );
  }

  private patchCountsUnreadSet( n: number ): void {
    const c = this.counts$.value;
    const unread = Math.max( 0, this.safeInt( n ) );
    this.counts$.next( { ...c, unread } );
  }

  private patchCountsFromRest(
    total: number,
    unread: number,
    prioritized?: number,
    unprioritized?: number
  ): void {
    const c = this.counts$.value;

    const next: NotificationCountResponse = {
      ...c,
      total: this.safeInt( total ),
      unread: this.safeInt( unread ),
      prioritized: typeof prioritized === "number" ? this.safeInt( prioritized ) : this.safeInt( c.prioritized ),
      unprioritized:
        typeof unprioritized === "number" ? this.safeInt( unprioritized ) : this.safeInt( c.unprioritized ),
    };

    this.counts$.next( next );
  }

  private onRestMutationReadOne( inboxId: string, res: NotificationInboxMutationResult ): void {
    if ( res.changed === true ) this.patchLocalReadOne( inboxId );
    this.patchCountsFromRest( res.total, res.unread, undefined, undefined );
  }

  // =============================================================================
  // 11) Sound helpers (SSR-safe, autoplay-safe)
  // =============================================================================

  private initNotificationSoundSafe(): void {
    if ( !this.isBrowser ) return;

    try {
      const a = new Audio( this.notificationSoundUrl );
      a.preload = "auto";
      a.volume = 0.7;
      this.audio = a;
    } catch ( err ) {
      // eslint-disable-next-line no-console
      console.warn(
        `[Warning:] [NotificationCenterService] init sound failed: ${ String( err ) }\n`
      );
      this.audio = null;
    }
  }

  private playSoundSafe(): void {
    if ( !this.isBrowser ) return;
    if ( !this.audio ) return;

    const now = Date.now();
    if ( now - this.lastSoundAtMs < this.soundCooldownMs ) return;
    this.lastSoundAtMs = now;

    try {
      this.audio.currentTime = 0;
      const p = this.audio.play();
      if ( p && typeof ( p as any )?.then === "function" ) {
        ( p as Promise<void> ).catch( ( err ) => {
          // eslint-disable-next-line no-console
          console.warn(
            `[Warning:] [NotificationCenterService] sound blocked: ${ String( err ) }\n`
          );
        } );
      }
    } catch ( err ) {
      // eslint-disable-next-line no-console
      console.warn(
        `[Warning:] [NotificationCenterService] sound play failed: ${ String( err ) }\n`
      );
    }
  }

  // =============================================================================
  // 12) Mapping helpers (WS/REST -> View)
  // =============================================================================

  private toViewFromWsList( x: WsInboxListRes ): NotificationInboxView {
    const items = Array.isArray( x?.items ) ? x.items : [];
    const other = x?.other ?? ( {} as any );

    return {
      items: this.sortByCreatedAtDesc( this.dedupeByInboxId( items ) ),
      other: this.normalizeCounts( other ),
    };
  }

  private toViewFromRestScopeLoad( x: NotificationInboxScopeLoadResult ): NotificationInboxView {
    const items = Array.isArray( x?.items ) ? x.items : [];
    const other = x?.other ?? ( {} as any );

    return {
      items: this.sortByCreatedAtDesc( this.dedupeByInboxId( items ) ),
      other: this.normalizeCounts( other ),
    };
  }

  private toCountsFromRest( x: NotificationInboxScopeCountResult ): WsInboxCountsRes {
    return {
      total: this.safeInt( x?.total ),
      unread: this.safeInt( x?.unread ),
      prioritized: this.safeInt( x?.prioritized ),
      unprioritized: this.safeInt( x?.unprioritized ),
    };
  }

  private normalizeCounts( other: any ): NotificationInboxView[ "other" ] {
    return {
      total: this.safeInt( other?.total ),
      unread: this.safeInt( other?.unread ),
      prioritized: this.safeInt( other?.prioritized ),
      unprioritized: this.safeInt( other?.unprioritized ),
    };
  }

  private normalizeCountPayload( c: NotificationCountResponse ): NotificationCountResponse {
    return {
      total: this.safeInt( ( c as any )?.total ),
      unread: this.safeInt( ( c as any )?.unread ),
      prioritized: this.safeInt( ( c as any )?.prioritized ),
      unprioritized: this.safeInt( ( c as any )?.unprioritized ),
    };
  }

  // =============================================================================
  // 13) Merge / dedupe / sort
  // =============================================================================

  private mergeItems( a: NotificationInboxItemDto[], b: NotificationInboxItemDto[] ): NotificationInboxItemDto[] {
    const merged = [ ...( Array.isArray( a ) ? a : [] ), ...( Array.isArray( b ) ? b : [] ) ];
    return this.sortByCreatedAtDesc( this.dedupeByInboxId( merged ) );
  }

  private dedupeByInboxId( items: NotificationInboxItemDto[] ): NotificationInboxItemDto[] {
    const seen = new Set<string>();
    const out: NotificationInboxItemDto[] = [];

    for ( const it of items ?? [] ) {
      const id = this.safeStr( ( it as any )?.inboxId );
      if ( !id ) continue;
      if ( seen.has( id ) ) continue;
      seen.add( id );
      out.push( it );
    }

    return out;
  }

  private sortByCreatedAtDesc( items: NotificationInboxItemDto[] ): NotificationInboxItemDto[] {
    const arr = Array.isArray( items ) ? [ ...items ] : [];
    arr.sort( ( a, b ) => {
      const da =
        this.safeDateMs( ( a as any )?.deliveredAt ) ||
        this.safeDateMs( ( a as any )?.notification?.createdAt );

      const db =
        this.safeDateMs( ( b as any )?.deliveredAt ) ||
        this.safeDateMs( ( b as any )?.notification?.createdAt );

      return db - da;
    } );
    return arr;
  }

  // =============================================================================
  // 13B) Merge / dedupe / sort (FIX: prefer DIRECT when same notification exists)
  // =============================================================================

  /**
   * Deduplicate by notification.id (NOT inboxId).
   *
   * Why:
   * - Same notification can create multiple inbox rows (direct + company/role),
   *   each with a different inboxId.
   * - UI must treat them as ONE logical notification for counts & lists.
   *
   * Priority rule:
   * - Items from `preferred` array win over `fallback` when notification.id matches.
   */
  private mergePreferByNotificationId(
    preferred: NotificationInboxItemDto[],
    fallback: NotificationInboxItemDto[]
  ): NotificationInboxItemDto[] {
    const a = Array.isArray( preferred ) ? preferred : [];
    const b = Array.isArray( fallback ) ? fallback : [];

    // Preferred first => if same notification.id exists later, it is ignored.
    const merged = [ ...a, ...b ];

    const seenNotif = new Set<string>();
    const out: NotificationInboxItemDto[] = [];

    for ( const it of merged ) {
      const nid = this.safeStr( ( it as any )?.notification?.id );
      if ( !nid ) {
        // If notification.id is missing, fallback to inboxId to avoid losing data.
        const iid = this.safeStr( ( it as any )?.inboxId );
        if ( !iid ) continue;
        // treat as unique by inboxId in this edge case
        out.push( it );
        continue;
      }

      if ( seenNotif.has( nid ) ) continue;
      seenNotif.add( nid );
      out.push( it );
    }

    return this.sortByCreatedAtDesc( out );
  }

  /**
   * Compute counts from list (after dedupe).
   * This ensures "direct + overall duplicate delivery" is counted once.
   */
  private computeCountsFromItems( items: NotificationInboxItemDto[] ): NotificationInboxView[ "other" ] {
    const arr = Array.isArray( items ) ? items : [];

    let total = 0;
    let unread = 0;
    let prioritized = 0;
    let unprioritized = 0;

    for ( const it of arr ) {
      total += 1;

      const isRead = ( it as any )?.isRead === true;
      if ( !isRead ) unread += 1;

      // Keep your existing semantics:
      // - If dto has isPrioritized boolean => use it
      // - Else infer from notification.severity/priority if you have that shape
      const ip = ( it as any )?.isPrioritized;
      if ( typeof ip === "boolean" ) {
        if ( ip ) prioritized += 1;
        else unprioritized += 1;
        continue;
      }

      // fallback inference (safe + non-breaking)
      const sev = this.safeStr( ( it as any )?.notification?.severity ).toLowerCase();
      if ( sev === "high" || sev === "critical" || sev === "urgent" ) prioritized += 1;
      else unprioritized += 1;
    }

    return { total, unread, prioritized, unprioritized };
  }

  // =============================================================================
  // 14) Small safe helpers
  // =============================================================================

  private refreshLastSafe(): void {
    const s = this.lastLoad;
    if ( !s ) return;

    this.load$( {
      scope: s.scope,
      priorityScope: s.priorityScope,
      page: s.page,
      limit: s.limit,
      filters: s.filters,
      me: s.me,
    } ).pipe( take( 1 ) ).subscribe( { next: () => undefined, error: () => undefined } );
  }

  private refreshCountsLastSafe(): void {
    const s = this.lastLoad;
    if ( !s ) return;

    this.countsByScope$( s.scope, s.priorityScope, s.filters ).pipe( take( 1 ) ).subscribe( {
      next: ( c ) => this.counts$.next( this.normalizeCountPayload( c as unknown as NotificationCountResponse ) ),
      error: () => undefined,
    } );
  }

  private patchLocalNotificationTitleBody(
    notificationId: string,
    title?: string,
    body?: string
  ): void {
    const id = this.safeStr( notificationId );
    if ( !id ) return;

    const t = typeof title === "string" ? title.trim() : "";
    const b = typeof body === "string" ? body.trim() : "";

    if ( !t && !b ) return;

    const next = this.inbox$.value.map( ( x ) => {
      const nid = this.safeStr( ( x as any )?.notification?.id );
      if ( nid !== id ) return x;

      const base: any = { ...( x as any ) };
      const n0: any =
        base.notification && typeof base.notification === "object"
          ? { ...( base.notification as any ) }
          : {};

      if ( t ) n0.title = t;
      if ( b ) n0.body = b;

      base.notification = n0;
      return base as NotificationInboxItemDto;
    } );

    this.inbox$.next( this.sortByCreatedAtDesc( next ) );
  }

  private patchLocalRemoveByNotificationId( notificationId: string ): void {
    const id = this.safeStr( notificationId );
    if ( !id ) return;

    const next = this.inbox$.value.filter( ( x ) => this.safeStr( ( x as any )?.notification?.id ) !== id );
    this.inbox$.next( next );
  }

  /**
   * Read system object safely from MSG: msg.data.system[key]
   */
  private readSystemObject<T extends Record<string, unknown> | NotificationCoreDto>(
    msg: MSG,
    key: string
  ): T | null {
    const sys = msg?.data?.system;
    if ( !sys || typeof sys !== "object" ) return null;

    const v = ( sys as Record<string, unknown> )[ key ];
    if ( !v || typeof v !== "object" ) return null;

    return v as T;
  }

  private safeStr( v: unknown ): string {
    return typeof v === "string" ? v.trim() : "";
  }

  private safeInt( v: unknown ): number {
    if ( typeof v === "number" && Number.isFinite( v ) ) return Math.floor( v );
    if ( typeof v === "string" && v.trim() && !Number.isNaN( Number( v ) ) ) return Math.floor( Number( v ) );
    return 0;
  }

  private safeDateMs( v: unknown ): number {
    const s = this.safeStr( v );
    if ( !s ) return 0;
    const ms = Date.parse( s );
    return Number.isFinite( ms ) ? ms : 0;
  }

  private safePage( v: unknown ): number {
    const n = typeof v === "number" ? v : Number( v );
    if ( !Number.isFinite( n ) || n < 1 ) return 1;
    return Math.floor( n );
  }

  private safeLimit( v: unknown ): number {
    const n = typeof v === "number" ? v : Number( v );
    if ( !Number.isFinite( n ) ) return 10;
    if ( n <= 0 ) return 500; // mirror backend/FE hard max usage
    return Math.min( Math.floor( n ), 500 );
  }
}
