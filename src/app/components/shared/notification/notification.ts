// Path: src/app/components/shared/notification/notification.ts
// =============================================================================
// NotificationComponent (Direct vs Overall + 3 Counts) — FIXED + DETERMINISTIC
// =============================================================================

import { CommonModule, isPlatformBrowser } from "@angular/common";
import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  ChangeDetectionStrategy,
} from "@angular/core";

import { MatBadgeModule } from "@angular/material/badge";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule, MatMenuTrigger } from "@angular/material/menu";

import { Router } from "@angular/router";

import {
  BehaviorSubject,
  Observable,
  Subject,
  fromEvent,
  forkJoin,
  of,
  timer,
} from "rxjs";

import {
  catchError,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs/operators";

import { AuthService } from "../../../services/auth/auth.service";
import { NotificationDialogComponent } from "../../dialogs/notificationBar/notificationBar.component";

import { NotificationCenterService } from "../../../services/notifications/notification-center.service";
import { NotificationRouteMapService } from "../../../services/notifications/notification-route-map.service";

import type {
  NotificationInboxItemDto,
  NotificationAudience,
  NotificationLoadFilters,
} from "../../../types/notifications/notification.types";

import type { Role } from "../../../services/auth/user.contract";
import type { NotificationPriorityScope } from "../../../services/notifications/notification-socket.service";
import type { User } from "../../../services/APIs/apis.service";

type TabKey = "all" | "direct" | "overall";

@Component( {
  selector: "app-notification",
  standalone: true,
  imports: [
    CommonModule,
    MatMenuModule,
    MatIconModule,
    MatBadgeModule,
    MatButtonModule,
    NotificationDialogComponent,
  ],
  templateUrl: "./notification.html",
  styleUrls: [ "./notification.scss" ],
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class NotificationComponent implements OnInit, OnDestroy {
  @ViewChild( "menuTrigger", { static: false } ) public menuTrigger!: MatMenuTrigger;
  @ViewChild( NotificationDialogComponent, { static: true } ) public notificationBar!: NotificationDialogComponent;

  // UI state (initial must be ALL)
  protected activeTab: TabKey = "all";
  protected isRefreshed: boolean = false;


  // Connection
  protected connected$!: Observable<boolean>;

  // Counts
  protected countAllUnread$!: Observable<number>;
  protected countDirectUnread$!: Observable<number>;
  protected countOverallUnread$!: Observable<number>;

  // Items (per tab)
  protected allItems$!: Observable<NotificationInboxItemDto[]>;
  protected directItems$!: Observable<NotificationInboxItemDto[]>;
  protected overallItems$!: Observable<NotificationInboxItemDto[]>;

  protected isLoggedIn = false;

  private readonly destroy$ = new Subject<void>();
  private readonly isBrowser: boolean;

  // Auth context
  private me: User | null = null;
  private myUserId = "";
  private myUsername = "";
  private myRole: Role | null = null;

  // Query defaults
  private readonly priorityScope: NotificationPriorityScope = "all";

  // Local state stores (deterministic merge + dedupe)
  private readonly all$ = new BehaviorSubject<NotificationInboxItemDto[]>( [] );
  private readonly directItemsState$ = new BehaviorSubject<NotificationInboxItemDto[]>( [] );
  private readonly overallItemsState$ = new BehaviorSubject<NotificationInboxItemDto[]>( [] );
  private readonly allItemsState$ = new BehaviorSubject<NotificationInboxItemDto[]>( [] );

  // Count stores
  private readonly countDirectState$ = new BehaviorSubject<number>( 0 );
  private readonly countOverallState$ = new BehaviorSubject<number>( 0 );
  private readonly countAllState$ = new BehaviorSubject<number>( 0 );

  // Safety: avoid spam-refresh
  private lastRefreshAtMs = 0;
  private readonly refreshMinGapMs = 800;

  public constructor (
    private readonly notify: NotificationCenterService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly notificationRouter: NotificationRouteMapService,
    @Inject( PLATFORM_ID ) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
    this.me = this.auth.getLoggedUser;
  }

  public ngOnInit(): void {
    this.isLoggedIn = this.auth.isUserLoggedIn;

    if ( !this.me ) {
      this.connected$ = of( false );
      this.bindEmptyStateStreams();
      return;
    }

    // IMPORTANT FIX: _id may not be string (can be ObjectId-like) => normalize using safeId()
    this.myUserId = this.safeId( this.me._id );
    this.myUsername = this.safeString( this.me.username );
    this.myRole = this.me.role;

    this.connected$ = this.notify.connected$();

    // Exposed streams
    this.directItems$ = this.directItemsState$.asObservable();
    this.overallItems$ = this.overallItemsState$.asObservable();
    this.allItems$ = this.allItemsState$.asObservable();

    this.countDirectUnread$ = this.countDirectState$.asObservable();
    this.countOverallUnread$ = this.countOverallState$.asObservable();
    this.countAllUnread$ = this.countAllState$.asObservable();

    // Initial load
    this.refreshOnce( "init" );

    // WS push -> refresh (throttled)
    this.notify
      .onNew( true )
      .pipe( takeUntil( this.destroy$ ) )
      .subscribe( {
        next: () => this.refreshOnce( "push_new" ),
        error: ( err: unknown ) => {
          // eslint-disable-next-line no-console
          console.error( `[Error:] [NotificationComponent] onNew error: ${ this.errMsg( err ) }\n` );
        },
      } );

    // Visibility-aware polling fallback
    if ( this.isBrowser ) {
      const visible$ = fromEvent( document, "visibilitychange" ).pipe(
        map( () => document.visibilityState === "visible" ),
        startWith( document.visibilityState === "visible" ),
        distinctUntilChanged()
      );

      visible$
        .pipe(
          switchMap( ( isVisible ) => {
            const intervalMs = isVisible ? 30_000 : 180_000;
            return timer( intervalMs, intervalMs );
          } ),
          tap( () => this.refreshOnce( "poll" ) ),
          takeUntil( this.destroy$ )
        )
        .subscribe();
    }
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.directItemsState$.complete();
    this.overallItemsState$.complete();
    this.allItemsState$.complete();

    this.countDirectState$.complete();
    this.countOverallState$.complete();
    this.countAllState$.complete();
  }

  /** Refresh when menu opens */
  protected onOpenMenu(): void {
    this.activeTab = "all";
    this.refreshOnce( "menu_open" );
  }

  protected setTab( tab: TabKey, ev?: Event ): void {
    ev?.stopPropagation();
    this.activeTab = tab;
  }


  protected async markOneRead(
    item: NotificationInboxItemDto,
    ev?: Event | MouseEvent | KeyboardEvent
  ): Promise<void> {
    ev?.stopPropagation();
    if ( typeof ( ev as MouseEvent | undefined )?.preventDefault === "function" ) {
      ( ev as MouseEvent ).preventDefault();
    }

    try {
      const ok = await this.notificationRouter.navigateByTarget( item.notification.target );

      const inboxId = this.safeId( ( item as unknown as { inboxId?: unknown; } )?.inboxId );
      if ( !inboxId ) {
        if ( ok ) this.closeMenu();
        return;
      }

      this.notify
        .markRead$( inboxId )
        .pipe( take( 1 ) )
        .subscribe( {
          next: () => {
            this.refreshOnce( "mark_one" );
            if ( ok ) this.closeMenu();
          },
          error: ( err: unknown ) => {
            // eslint-disable-next-line no-console
            console.error( `[Error:] [NotificationComponent] markRead failed: ${ this.errMsg( err ) }\n` );
          },
        } );
    } catch ( err: unknown ) {
      // eslint-disable-next-line no-console
      console.error( `[Error:] [NotificationComponent] navigate/markOneRead failed: ${ this.errMsg( err ) }\n` );
    }
  }

  protected markAllAsRead(): void {
    this.notify
      .markAllRead$()
      .pipe( take( 1 ) )
      .subscribe( {
        next: () => this.refreshOnce( "mark_all" ),
        error: ( err: unknown ) => {
          // eslint-disable-next-line no-console
          console.error( `[Error:] [NotificationComponent] markAllRead failed: ${ this.errMsg( err ) }\n` );
        },
      } );
  }

  protected viewAllNotifications(): void {
    if ( !this.isLoggedIn ) return;
    this.closeMenu();
    this.router.navigate( [ "/dashboard/notifications/all-notifications" ] ).catch( () => undefined );
  }

  protected readonly trackById = ( _: number, item: NotificationInboxItemDto ): string => {
    const inboxId = this.safeId( ( item as unknown as { inboxId?: unknown; } )?.inboxId );
    if ( inboxId ) return inboxId;

    const notifId = this.safeId( ( item?.notification as unknown as { notificationId?: unknown; } )?.notificationId );
    return notifId || String( _ );
  };

  protected refresh(): void {
    if ( this.isRefreshed ) return;   // guard first

    this.isRefreshed = true;
    this.refreshOnce( 'init' );

    setTimeout( () => {
      this.isRefreshed = false;
    }, 500 );
  }

  private closeMenu(): void {
    this.menuTrigger?.closeMenu();
  }

  // ---------------------------------------------------------------------------
  // Refresh logic (loads DIRECT + OVERALL and updates ALL = merged)
  // IMPORTANT FIX: forkJoin for deterministic completion (no race with merge+take)
  // ---------------------------------------------------------------------------

  private refreshOnce(
    reason: "init" | "push_new" | "menu_open" | "mark_one" | "mark_all" | "poll"
  ): void {
    if ( !this.isLoggedIn ) return;

    const now = Date.now();
    if ( now - this.lastRefreshAtMs < this.refreshMinGapMs ) return;
    this.lastRefreshAtMs = now;

    this.refresh$()
      .pipe( take( 1 ) )
      .subscribe( {
        next: () => undefined,
        error: ( err: unknown ) => {
          // eslint-disable-next-line no-console
          console.error( `[Error:] [NotificationComponent] refresh failed (${ reason }): ${ this.errMsg( err ) }\n` );
        },
      } );
  }

  private refresh$(): Observable<void> {
    if ( !this.me ) return of( void 0 );

    const listFilters: NotificationLoadFilters = {
      unreadOnly: false,
      includeArchived: false,
      includeDeleted: false,
    };

    const countFilters: NotificationLoadFilters = {};

    const directItems$ = this.notify
      .loadDirect$( this.priorityScope, 1, 0, listFilters, this.me )
      .pipe(
        map( ( view ) => ( view.items ?? [] ) ),
        map( ( items ) => this.normalizeDirectList( items ) ),
        catchError( () => of( [] as NotificationInboxItemDto[] ) )
      );

    const overallItems$ = this.notify
      .loadOverall$( this.priorityScope, 1, 0, listFilters, this.me )
      .pipe(
        map( ( view ) => ( view.items ?? [] ) ),
        map( ( items ) => this.normalizeOverallList( items ) ),
        catchError( () => of( [] as NotificationInboxItemDto[] ) )
      );

    const countDirect$ = this.notify.countsDirect$( this.priorityScope, countFilters ).pipe(
      map( ( c ) => this.safeNum( ( c as unknown as { unread?: unknown; } )?.unread ) ),
      catchError( () => of( 0 ) )
    );

    const countOverall$ = this.notify.countsOverall$( this.priorityScope, countFilters ).pipe(
      map( ( c ) => this.safeNum( ( c as unknown as { unread?: unknown; } )?.unread ) ),
      catchError( () => of( 0 ) )
    );

    return forkJoin( {
      directItems: directItems$,
      overallItems: overallItems$,
      directUnread: countDirect$,
      overallUnread: countOverall$,
    } ).pipe(
      tap( ( r ) => {
        // stores
        this.directItemsState$.next( r.directItems );
        this.overallItemsState$.next( r.overallItems );

        this.countDirectState$.next( r.directUnread );
        this.countOverallState$.next( r.overallUnread );

        // ✅ ALL = Direct + Overall (single truth)
        const merged = [ ...( r.directItems ?? [] ), ...( r.overallItems ?? [] ) ];

        const all = this.sortLatestFirst(
          this.dedupeByInboxId( merged )
        );

        this.allItemsState$.next( all );

        // ✅ ALL unread = directUnread + overallUnread
        this.countAllState$.next( ( r.directUnread ?? 0 ) + ( r.overallUnread ?? 0 ) );
      } ),
      map( () => void 0 )
    );
  }

  // ---------------------------------------------------------------------------
  // Audience rules (DIRECT vs OVERALL correctness)
  // ---------------------------------------------------------------------------

  private isDirectAudience( audiences: ReadonlyArray<NotificationAudience> ): boolean {
    if ( !Array.isArray( audiences ) || audiences.length === 0 ) return false;

    for ( const a of audiences ) {
      if ( a.mode !== "User" ) continue;

      const userId = this.safeId( ( a as unknown as { userId?: unknown; } )?.userId );
      const username = this.safeString( ( a as unknown as { username?: unknown; } )?.username );

      if ( this.myUserId && userId && userId === this.myUserId ) return true;
      if ( this.myUsername && username && username === this.myUsername ) return true;
    }

    return false;
  }

  private isOverallAudience( audiences: ReadonlyArray<NotificationAudience> ): boolean {

    if ( !Array.isArray( audiences ) || audiences.length === 0 ) return false;

    // must NOT be direct to ME (not "direct to anyone")
    if ( this.isDirectAudience( audiences ) ) return false;

    const myRoleKey = this.safeLower( this.myRole );

    for ( const a of audiences ) {
      if ( a.mode === "Company" ) return true;

      if ( a.mode === "Role" ) {
        // ✅ backend uses roleKey, not role
        const roleKey = this.safeLower( ( a as unknown as { roleKey?: unknown; } )?.roleKey );
        if ( roleKey && roleKey === myRoleKey ) return true;
      }
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Normalizers (separate, so scopes never mix accidentally)
  // ---------------------------------------------------------------------------

  private normalizeDirectList( list: NotificationInboxItemDto[] ): NotificationInboxItemDto[] {
    const out: NotificationInboxItemDto[] = [];
    for ( const it of list ?? [] ) {
      const aud = ( it?.notification?.audiences ?? [] ) as ReadonlyArray<NotificationAudience>;
      if ( this.isDirectAudience( aud ) ) out.push( it );
    }
    return out;
  }

  private normalizeOverallList( list: NotificationInboxItemDto[] ): NotificationInboxItemDto[] {
    const out: NotificationInboxItemDto[] = [];
    for ( const it of list ?? [] ) {
      const aud = ( it?.notification?.audiences ?? [] ) as ReadonlyArray<NotificationAudience>;
      if ( this.isOverallAudience( aud ) ) out.push( it );
    }
    return out;
  }

  private safeLower( v: unknown ): string {
    const s = typeof v === "string" ? v.trim() : "";
    return s.toLowerCase();
  }

  private dedupeByInboxId( items: NotificationInboxItemDto[] ): NotificationInboxItemDto[] {
    const seen = new Set<string>();
    const out: NotificationInboxItemDto[] = [];

    for ( const it of items ?? [] ) {
      const inboxId = this.safeId( ( it as unknown as { inboxId?: unknown; } )?.inboxId );
      if ( !inboxId ) continue;
      if ( seen.has( inboxId ) ) continue;
      seen.add( inboxId );
      out.push( it );
    }

    return out;
  }

  private bindEmptyStateStreams(): void {
    this.connected$ = of( false );

    this.directItems$ = of( [] );
    this.overallItems$ = of( [] );
    this.allItems$ = of( [] );

    this.countDirectUnread$ = of( 0 );
    this.countOverallUnread$ = of( 0 );
    this.countAllUnread$ = of( 0 );
  }

  // ---------------------------------------------------------------------------
  // SAFE helpers (important fixes: IDs + role normalization) + sorting
  // ---------------------------------------------------------------------------
  private sortLatestFirst( items: NotificationInboxItemDto[] ): NotificationInboxItemDto[] {
    const copy = [ ...( items ?? [] ) ];

    copy.sort( ( a, b ) => {
      const bt = this.getItemSortTimeMs( b );
      const at = this.getItemSortTimeMs( a );
      return bt - at; // ✅ latest first
    } );

    return copy;
  }

  private getItemSortTimeMs( item: NotificationInboxItemDto ): number {
    // Prefer deliveredAt (inbox delivery time), fallback to notification.createdAt
    const deliveredAt = ( item as unknown as { deliveredAt?: unknown; } )?.deliveredAt;
    const createdAt = ( item?.notification as unknown as { createdAt?: unknown; } )?.createdAt;

    const d1 = this.safeDateMs( deliveredAt );
    if ( d1 > 0 ) return d1;

    const d2 = this.safeDateMs( createdAt );
    if ( d2 > 0 ) return d2;

    return 0;
  }

  private safeDateMs( v: unknown ): number {
    if ( typeof v === "number" && Number.isFinite( v ) ) return v;

    if ( typeof v === "string" ) {
      const t = Date.parse( v );
      return Number.isFinite( t ) ? t : 0;
    }

    if ( v && typeof v === "object" ) {
      const maybe = v as { toString?: () => string; };
      if ( typeof maybe.toString === "function" ) {
        const t = Date.parse( String( maybe.toString() ) );
        return Number.isFinite( t ) ? t : 0;
      }
    }

    return 0;
  }

  /**
   * String safe (trim).
   * Accepts number as string too.
   */
  private safeString( v: unknown ): string {
    if ( typeof v === "string" ) return v.trim();
    if ( typeof v === "number" ) return String( v );
    return "";
  }

  /**
   * Safe ID coercion.
   * Accepts:
   * - string
   * - ObjectId-like (has toString)
   *
   * Why:
   * - Your auth/me._id can be Mongo ObjectId in runtime.
   */
  private safeId( v: unknown ): string {
    if ( typeof v === "string" ) return v.trim();
    if ( v && typeof v === "object" ) {
      const maybe = v as { toString?: () => string; };
      if ( typeof maybe.toString === "function" ) {
        const s = String( maybe.toString() ).trim();
        if ( s && s !== "[object Object]" ) return s;
      }
    }
    return "";
  }

  private normalizeRoleKey( v: unknown ): string {
    const s = this.safeString( v ).toLowerCase();
    return s;
  }

  private safeNum( v: unknown ): number {
    return typeof v === "number" && Number.isFinite( v ) ? v : 0;
  }

  private errMsg( err: unknown ): string {
    if ( err instanceof Error ) return err.message;
    return String( err ?? "unknown_error" );
  }
}
