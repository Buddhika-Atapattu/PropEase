// Path: src/app/services/notifications/notification-center.service.ts
// =============================================================================
// NotificationCenterService (WS-first + REST fallback)
// -----------------------------------------------------------------------------
// PURPOSE
// - Single frontend façade for Notifications
// - WS-first for ALL operations
// - REST is backup only (when WS fails / disconnected)
// - Maintains local streams (items + counts) from push events
// - Plays sound on NEW notification (browser-only, SSR-safe)
// =============================================================================

import { Injectable, Inject, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { BehaviorSubject, Observable, catchError, from, map, switchMap, take, Subscription } from "rxjs";

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
} from "./notification-socket.service";

import { NotificationRestApiService } from "./notification-rest-api.service";

export interface NotificationInboxView {
  items: NotificationInboxItemDto[];
  other: { total: number; unread: number; prioritized: number; unprioritized: number; };
}

@Injectable( { providedIn: "root" } )
export class NotificationCenterService {
  private readonly inbox$ = new BehaviorSubject<NotificationInboxItemDto[]>( [] );
  private readonly defaultCounts$ = new BehaviorSubject<NotificationCountResponse>( { total: 0, unread: 0 } );
  private started = false;
  private pushSubs: Subscription | null = null;

  /**
   * Sound file URL (NOT filesystem path).
   *
   * Expected location:
   * - public/sounds/notification-pop-up.mp3
   *
   * Runtime URL:
   * - public/sounds/notification-pop-up.mp3
   */
  private readonly notificationSoundUrl: string = "public/sounds/notification-pop-up.mp3";

  /**
   * Browser-only Audio instance.
   * - MUST be null on SSR to avoid "Audio is not defined".
   */
  private readonly isBrowser: boolean;
  private audio: HTMLAudioElement | null = null;

  /**
   * Cooldown to avoid rapid repeated sound spam (ms).
   */
  private readonly soundCooldownMs: number = 900;
  private lastSoundAtMs: number = 0;

  public constructor (
    private readonly ws: NotificationSocketService,
    private readonly rest: NotificationRestApiService,
    @Inject( PLATFORM_ID ) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser( platformId );

    // Prepare sound safely (browser only).
    this.initNotificationSound();

    this.bindPushStreams();
  }

  /**
   * Start notification engine for current authenticated session.
   *
   * Why we make this method:
   * - AuthService can call this safely after login or auto-login restore.
   * - Idempotent: prevents duplicate subscriptions and duplicate sounds.
   *
   * @param options.scope
   * - "user" | "role" | "company"
   * - Which view to preload first (recommended: "user")
   *
   * @param options.priorityScope
   * - "all" | "prioritized" | "unprioritized"
   *
   * @param options.page
   * - 1-based page for initial list preload
   *
   * @param options.limit
   * - row count for initial list preload
   *
   * @param options.filters
   * - initial filters for counts/list (can be empty {})
   *
   * Keep in mind:
   * - This method should run AFTER SocketService.init() so WS is ready.
   * - This does not block login. It warms up data in background.
   */
  public start( options?: {
    scope?: NotificationScope;
    priorityScope?: NotificationPriorityScope;
    page?: number;
    limit?: number;
    filters?: NotificationLoadFilters;
  } ): void {
    if ( this.started ) return;
    this.started = true;

    // ✅ Ensure push streams are wired exactly once.
    // (Move bindPushStreams() out of constructor OR guard it like below.)
    this.bindPushStreamsOnce();

    // ✅ Warm up counts + first page (non-blocking)
    const scope: NotificationScope = options?.scope ?? "user";
    const priorityScope: NotificationPriorityScope = options?.priorityScope ?? "all";
    const page = typeof options?.page === "number" && options.page > 0 ? options.page : 1;
    const limit = typeof options?.limit === "number" && options.limit > 0 ? options.limit : 10;
    const filters: NotificationLoadFilters = options?.filters ?? {};

    // counts warmup (subscribe once and auto complete)
    this.countsByScope$( scope, priorityScope, filters ).pipe( take( 1 ) ).subscribe( {
      next: ( c ) => {
        this.defaultCounts$.next( { total: c.total, unread: c.unread } );
      },
      error: () => undefined,
    } );

    // list warmup
    this.loadByScope$( scope, priorityScope, page, limit, filters ).pipe( take( 1 ) ).subscribe( {
      next: ( view ) => this.inbox$.next( view.items ),
      error: () => undefined,
    } );
  }

  /**
   * Stop notification engine (on logout).
   *
   * Why we make this method:
   * - Prevent old session notifications leaking into next login.
   * - Ensures ISO/IEC 27001 style session isolation.
   */
  public stop(): void {
    // unsubscribe push streams
    if ( this.pushSubs ) {
      this.pushSubs.unsubscribe();
      this.pushSubs = null;
    }

    // clear state
    this.inbox$.next( [] );
    this.defaultCounts$.next( { total: 0, unread: 0 } );

    // reset guard
    this.started = false;
  }

  /* ========================================================================
   * 1) Public reactive state
   * ====================================================================== */

  public inboxItems$(): Observable<NotificationInboxItemDto[]> {
    return this.inbox$.asObservable();
  }

  public counts$(): Observable<NotificationCountResponse> {
    return this.defaultCounts$.asObservable();
  }

  public connected$(): Observable<boolean> {
    return this.ws.isConnected$();
  }

  /* ========================================================================
   * 2) WS-first operations (REST fallback)
   * ====================================================================== */

  public loadByScope$(
    scope: NotificationScope,
    priorityScope: NotificationPriorityScope,
    page: number,
    limit: number,
    filters: NotificationLoadFilters
  ): Observable<NotificationInboxView> {
    return this.connected$().pipe(
      take( 1 ),
      switchMap( ( connected ) => {
        if ( !connected ) {
          return this.rest
            .loadInboxByScope$( scope, priorityScope, page, limit, filters )
            .pipe( map( ( x ) => ( { items: x.items, other: x.other } ) ) );
        }

        return from( this.ws.rpcInboxList( { scope, priorityScope, page, limit, filters } ) ).pipe(
          map( ( x: WsInboxListRes ) => ( { items: x.items, other: x.other } ) ),
          catchError( () =>
            this.rest
              .loadInboxByScope$( scope, priorityScope, page, limit, filters )
              .pipe( map( ( x ) => ( { items: x.items, other: x.other } ) ) )
          )
        );
      } )
    );
  }

  public countsByScope$(
    scope: NotificationScope,
    priorityScope: NotificationPriorityScope,
    filters: NotificationLoadFilters
  ): Observable<WsInboxCountsRes> {
    return this.connected$().pipe(
      take( 1 ),
      switchMap( ( connected ) => {
        if ( !connected ) {
          return this.rest.countInboxByScope$( filters ).pipe(
            map( ( x ) => ( {
              total: x.total,
              unread: x.unread,
              prioritized: x.prioritized,
              unprioritized: x.unprioritized,
            } ) )
          );
        }

        return from( this.ws.rpcInboxCounts( { scope, priorityScope, filters } ) ).pipe(
          catchError( () =>
            this.rest.countInboxByScope$( filters ).pipe(
              map( ( x ) => ( {
                total: x.total,
                unread: x.unread,
                prioritized: x.prioritized,
                unprioritized: x.unprioritized,
              } ) )
            )
          )
        );
      } )
    );
  }

  public markRead$( inboxId: string ): Observable<boolean> {
    return this.connected$().pipe(
      take( 1 ),
      switchMap( ( connected ) => {
        if ( !connected ) {
          return this.rest.markRead$( inboxId ).pipe( map( ( x ) => x.changed === true ) );
        }

        return from( this.ws.rpcMarkRead( inboxId ) ).pipe(
          map( ( x ) => x.changed === true ),
          catchError( () => this.rest.markRead$( inboxId ).pipe( map( ( x ) => x.changed === true ) ) )
        );
      } )
    );
  }

  public markAllRead$(): Observable<number> {
    return this.connected$().pipe(
      take( 1 ),
      switchMap( ( connected ) => {
        if ( !connected ) {
          return this.rest.markAllRead$().pipe( map( ( x ) => x.changedCount ?? 0 ) );
        }

        return from( this.ws.rpcMarkAllRead() ).pipe(
          map( ( x ) => x.changedCount ?? 0 ),
          catchError( () => this.rest.markAllRead$().pipe( map( ( x ) => x.changedCount ?? 0 ) ) )
        );
      } )
    );
  }

  /* ========================================================================
  * 1.5) Compatibility façade (OLD UI API)
  * ------------------------------------------------------------------------
  * Why we add these:
  * - Older components expect notifications$(), unreadCount$(), onConnected$(),
  *   load(), load$(), onNew()
  * - We map them to the new WS-first primitives (inboxItems$/counts$/connected$)
  *   while keeping contracts stable.
  * ====================================================================== */

  /**
   * notifications$()
   * ---------------
   * Old UI expected a notification list stream.
   *
   * @returns Observable<NotificationInboxItemDto[]>
   * - Emits the in-memory inbox items (hydrated by push + loadByScope$()).
   */
  public notifications$(): Observable<NotificationInboxItemDto[]> {
    return this.inboxItems$();
  }

  /**
   * unreadCount$()
   * -------------
   * Old UI expected just unread count.
   *
   * @returns Observable<number>
   * - Derived from counts$().
   */
  public unreadCount$(): Observable<number> {
    return this.counts$().pipe( map( ( c ) => c.unread ) );
  }

  /**
   * onConnected$()
   * -------------
   * Old UI expected "connected" stream.
   *
   * @returns Observable<boolean>
   * - Same as connected$().
   */
  public onConnected$(): Observable<boolean> {
    return this.connected$();
  }

  /**
   * onNew()
   * ------
   * Old UI expected a stream of just the new notification item.
   *
   * @param playSound
   * - If true, we play sound on arrival (even if push handling already does).
   * - We keep it for old components that used to control sound.
   *
   * Keep in mind:
   * - Your push binding ALREADY plays sound by default.
   * - So if playSound=true and push already plays sound, you would double-play.
   * - Therefore we only play sound here if playSound=true AND you decide to
   *   disable sound in push binding later.
   */
  public onNew( playSound: boolean ): Observable<NotificationInboxItemDto> {
    return this.ws.onNewNotification$().pipe(
      map( ( p ) => {
        if ( playSound ) {
          // Avoid double sound if push already plays sound.
          // Keep it disabled by default or remove sound from push binding.
          // this.playNotificationSoundSafe();
        }
        return p.item;
      } )
    );
  }

  /**
   * load()
   * ------
   * Old UI expected a Promise-based loader (usually load latest 30).
   *
   * @param options.scope
   * @param options.priorityScope
   * @param options.page
   * @param options.limit
   * @param options.filters
   *
   * Default behavior:
   * - scope: "user"
   * - priorityScope: "all"
   * - page: 1
   * - limit: 30
   * - filters: {}
   *
   * Result:
   * - updates inbox$ with returned items
   * - updates counts stream with response.other.unread/total
   */
  public async load( options?: {
    scope?: NotificationScope;
    priorityScope?: NotificationPriorityScope;
    page?: number;
    limit?: number;
    filters?: NotificationLoadFilters;
  } ): Promise<void> {
    const scope: NotificationScope = options?.scope ?? "user";
    const priorityScope: NotificationPriorityScope = options?.priorityScope ?? "all";
    const page: number = typeof options?.page === "number" && options.page > 0 ? options.page : 1;
    const limit: number = typeof options?.limit === "number" && options.limit > 0 ? options.limit : 30;
    const filters: NotificationLoadFilters = options?.filters ?? {};

    await new Promise<void>( ( resolve, reject ) => {
      this.loadByScope$( scope, priorityScope, page, limit, filters ).pipe( take( 1 ) ).subscribe( {
        next: ( view ) => {
          this.inbox$.next( view.items );
          this.defaultCounts$.next( { total: view.other.total, unread: view.other.unread } );
          resolve();
        },
        error: ( e: unknown ) => reject( e ),
      } );
    } );
  }

  /**
   * load$()
   * ------
   * Old UI expected an Observable-based loader (used for polling pipelines).
   *
   * @param options same as load()
   * @returns Observable<void>
   */
  public load$( options?: {
    scope?: NotificationScope;
    priorityScope?: NotificationPriorityScope;
    page?: number;
    limit?: number;
    filters?: NotificationLoadFilters;
  } ): Observable<void> {
    const scope: NotificationScope = options?.scope ?? "user";
    const priorityScope: NotificationPriorityScope = options?.priorityScope ?? "all";
    const page: number = typeof options?.page === "number" && options.page > 0 ? options.page : 1;
    const limit: number = typeof options?.limit === "number" && options.limit > 0 ? options.limit : 30;
    const filters: NotificationLoadFilters = options?.filters ?? {};

    return this.loadByScope$( scope, priorityScope, page, limit, filters ).pipe(
      take( 1 ),
      map( ( view ) => {
        this.inbox$.next( view.items );
        this.defaultCounts$.next( { total: view.other.total, unread: view.other.unread } );
        return undefined;
      } )
    );
  }

  /* ========================================================================
   * 3) Push streams -> local state hydration + SOUND
   * ====================================================================== */

  private bindPushStreams(): void {
    // NEW
    this.ws.onNewNotification$().subscribe( {
      next: ( p ) => {
        const curr = this.inbox$.value;
        this.inbox$.next( [ p.item, ...curr ] );

        if ( p.count ) {
          this.defaultCounts$.next( p.count );
        }

        // ✅ Play sound for new notification
        this.playNotificationSoundSafe();
      },
      error: () => undefined,
    } );

    // PATCH
    this.ws.onPatchNotification$().subscribe( {
      next: ( p ) => {
        const curr = this.inbox$.value;
        const next = curr.map( ( x ) => {
          if ( x.inboxId !== p.inboxId ) return x;

          const merged: NotificationInboxItemDto = {
            ...x,
            isRead: typeof p.patch.isRead === "boolean" ? p.patch.isRead : x.isRead,
            isDeleted: typeof p.patch.isDeleted === "boolean" ? p.patch.isDeleted : x.isDeleted,
          };

          if ( p.patch.readAt ) {
            return { ...merged, readAt: p.patch.readAt };
          }

          return merged;
        } );

        this.inbox$.next( next );

        if ( p.count ) {
          this.defaultCounts$.next( p.count );
        }
      },
      error: () => undefined,
    } );

    // COUNT
    this.ws.onCountUpdate$().subscribe( {
      next: ( c ) => this.defaultCounts$.next( c ),
      error: () => undefined,
    } );

    // BULK (optional)
    this.ws.onBulkUpdate$().subscribe( {
      next: ( p ) => {
        if ( p.count ) this.defaultCounts$.next( p.count );
      },
      error: () => undefined,
    } );
  }

  /* ========================================================================
   * 4) Sound helpers (SSR-safe, autoplay-safe)
   * ====================================================================== */

  /**
   * Prepare (preload) the notification sound safely.
   *
   * Important matters:
   * - SSR: must do nothing (Audio is not available)
   * - Browser autoplay policies: preload is okay, but play() may be blocked until user gesture
   */
  private initNotificationSound(): void {
    if ( !this.isBrowser ) return;

    try {
      const a = new Audio( this.notificationSoundUrl );

      // Preload metadata so first play is fast.
      a.preload = "auto";

      // You can tune volume here if needed (0.0 - 1.0)
      a.volume = 0.7;

      this.audio = a;
    } catch ( err ) {
    // eslint-disable-next-line no-console
      console.warn( `[Warning:] [NotificationCenterService] init sound failed: ${ String( err ) }\n` );
      this.audio = null;
    }
  }

  /**
   * Play the sound if possible.
   *
   * Why we make this method:
   * - Central place to handle cooldown + autoplay blocking + safety checks.
   *
   * Keep in mind:
   * - Browsers may block play() until the user interacts with the page at least once.
   * - We swallow errors because notifications must still work without sound.
   */
  private playNotificationSoundSafe(): void {
    if ( !this.isBrowser ) return;
    if ( !this.audio ) return;

    const now = Date.now();
    if ( now - this.lastSoundAtMs < this.soundCooldownMs ) return;
    this.lastSoundAtMs = now;

    try {
      // Rewind to start for repeated plays.
      this.audio.currentTime = 0;

      const p = this.audio.play();
      // play() returns a promise in modern browsers.
      if ( p && typeof p.then === "function" ) {
        p.catch( ( err ) => {
      // Autoplay blocked or other issue.
      // eslint-disable-next-line no-console
          console.warn( `[Warning:] [NotificationCenterService] sound blocked: ${ String( err ) }\n` );
        } );
      }
    } catch ( err ) {
      // eslint-disable-next-line no-console
      console.warn( `[Warning:] [NotificationCenterService] sound play failed: ${ String( err ) }\n` );
    }
  }


  // ---------------------------------------------------------------------------
  // IMPORTANT: Make push binding idempotent
  // ---------------------------------------------------------------------------

  private bindPushStreamsOnce(): void {
    if ( this.pushSubs ) return;

    const sub = new Subscription();

    sub.add(
      this.ws.onNewNotification$().subscribe( {
        next: ( p ) => {
          const curr = this.inbox$.value;
          this.inbox$.next( [ p.item, ...curr ] );

          if ( p.count ) {
            this.defaultCounts$.next( p.count );
          }

          // play sound
          this.playNotificationSoundSafe();
        },
        error: () => undefined,
      } )
    );

    sub.add(
      this.ws.onPatchNotification$().subscribe( {
        next: ( p ) => {
          const curr = this.inbox$.value;
          const next = curr.map( ( x ) => {
            if ( x.inboxId !== p.inboxId ) return x;

            const merged: NotificationInboxItemDto = {
              ...x,
              isRead: typeof p.patch.isRead === "boolean" ? p.patch.isRead : x.isRead,
              isDeleted: typeof p.patch.isDeleted === "boolean" ? p.patch.isDeleted : x.isDeleted,
            };

            if ( p.patch.readAt ) {
              return { ...merged, readAt: p.patch.readAt };
            }

            return merged;
          } );

          this.inbox$.next( next );

          if ( p.count ) {
            this.defaultCounts$.next( p.count );
          }
        },
        error: () => undefined,
      } )
    );

    sub.add(
      this.ws.onCountUpdate$().subscribe( {
        next: ( c ) => this.defaultCounts$.next( c ),
        error: () => undefined,
      } )
    );

    sub.add(
      this.ws.onBulkUpdate$().subscribe( {
        next: ( p ) => {
          if ( p.count ) this.defaultCounts$.next( p.count );
        },
        error: () => undefined,
      } )
    );

    this.pushSubs = sub;
  }

}
