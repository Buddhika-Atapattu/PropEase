// Path: src/app/pages/notifications/notifications-main-page.ts
import { CommonModule, isPlatformBrowser } from "@angular/common";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  Observable,
  of,
  Subscription,
  forkJoin,
} from "rxjs";
import { catchError, debounceTime, map, startWith, tap, take } from "rxjs/operators";

import { MatBadgeModule } from "@angular/material/badge";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatChipSelectionChange, MatChipsModule } from "@angular/material/chips";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatPaginatorModule, PageEvent } from "@angular/material/paginator";
import { MatTabsModule } from "@angular/material/tabs";
import { MatTooltipModule } from "@angular/material/tooltip";

import { SkeletonLoaderComponent } from "../../components/shared/skeleton-loader/skeleton-loader.component";
import { User } from "../../services/APIs/apis.service";
import { AuthService } from "../../services/auth/auth.service";
import { WindowsRefService } from "../../services/windowRef/windowRef.service";
import type { Role } from "../../services/auth/user.contract";

import { NotificationCenterService } from "../../services/notifications/notification-center.service";
import { NotificationRouteMapService } from "../../services/notifications/notification-route-map.service";
import {
  NOTIFICATION_CATEGORY_VALUES,
  type NotificationCategory,
} from "../../types/notifications/notification.types";

import type {
  NotificationAudience,
  NotificationInboxItemDto,
  NotificationLoadFilters,
} from "../../types/notifications/notification.types";

/** Tabs */
type TabKey = "all" | "unread" | "direct" | "overall";

interface CountVm {
  total: number;
  unread: number;
}

@Component( {
  selector: "app-main",
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatBadgeModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatPaginatorModule,
    MatTooltipModule,
    ReactiveFormsModule,
    SkeletonLoaderComponent,
  ],
  templateUrl: "./notifications-main-page.html",
  styleUrl: "./notifications-main-page.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class NotificationsMainPage implements OnInit, AfterViewInit, OnDestroy {
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  private me: User | null = null;

  // Auth identity (normalized)
  private myUserId = "";
  private myUsername = "";
  private myRole: Role | null = null;
  private myTeamCodes: string[] = [];

  // Connection
  protected connected$!: Observable<boolean>;

  // ============================
  // Deterministic state stores
  // ============================
  private readonly directState$ = new BehaviorSubject<NotificationInboxItemDto[]>( [] );
  private readonly overallState$ = new BehaviorSubject<NotificationInboxItemDto[]>( [] );
  private readonly allState$ = new BehaviorSubject<NotificationInboxItemDto[]>( [] );

  /** Source list (ALWAYS deterministic ALL = direct + overall) */
  protected inboxItems$!: Observable<NotificationInboxItemDto[]>;

  /** Derived subsets */
  protected unreadInboxItems$!: Observable<NotificationInboxItemDto[]>;
  protected directInboxItems$!: Observable<NotificationInboxItemDto[]>;
  protected overallInboxItems$!: Observable<NotificationInboxItemDto[]>;

  /** Three counts (All / Direct / Overall) */
  protected allCounts$!: Observable<CountVm>;
  protected directCounts$!: Observable<CountVm>;
  protected overallCounts$!: Observable<CountVm>;
  protected unreadCount$!: Observable<number>;

  /** UI */
  protected activeTab$ = new BehaviorSubject<TabKey>( "all" );
  protected searchCtrl = new FormControl<string>( "", { nonNullable: true } );

  protected readonly categories: ReadonlyArray<NotificationCategory | "All"> =
    NOTIFICATION_CATEGORY_VALUES;
  protected activeCategory$ = new BehaviorSubject<NotificationCategory | "All">( "All" );

  protected pageSizeOptions: number[] = [ 10, 20, 30, 50 ];
  private pageIndex$ = new BehaviorSubject<number>( 0 );
  private pageSize$ = new BehaviorSubject<number>( 10 );

  protected loading$ = new BehaviorSubject<boolean>( false );

  protected filteredItems$!: Observable<NotificationInboxItemDto[]>;
  protected totalCount$!: Observable<number>;
  protected pageItems$!: Observable<NotificationInboxItemDto[]>;

  protected totalPages$!: Observable<number>;
  protected currentPage$!: Observable<number>;
  protected pageNumbers$!: Observable<number[]>;

  private pageClampSub?: Subscription;

  // Query defaults
  private readonly defaultScope = "user" as const;
  private readonly defaultPriority = "all" as const;
  private readonly defaultFilters: NotificationLoadFilters = {};
  private readonly initialLimit = 50;

  public constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly notify: NotificationCenterService,
    private readonly notificationRouter: NotificationRouteMapService
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
  }

  public ngOnInit(): void {
    // Theme
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val: boolean | null ): void => {
        this.mode = val;
      } );
    }

    // Auth snapshot
    this.me = this.authService.getLoggedUser;

    this.myUsername = this.safeString( this.me?.username );
    this.myRole = ( this.me?.role ?? null ) as Role | null;

    // IMPORTANT: _id can be ObjectId-like at runtime => safeId()
    this.myUserId = this.safeId( ( this.me as unknown as { _id?: unknown; } )?._id );

    // Optional team codes (safe)
    this.myTeamCodes = this.safeArrStr(
      ( this.me as unknown as { teamCodes?: unknown; } )?.teamCodes
    );

    // WS connection (use observable directly; no inverted mirror flags)
    this.connected$ = this.notify.connected$();

    // Start center ONCE (bind push streams etc.)
    if ( this.me ) {
      this.notify.start( {
        scope: this.defaultScope,
        priorityScope: this.defaultPriority,
        page: 1,
        limit: this.initialLimit,
        filters: this.defaultFilters,
        me: this.me,
      } );
    }

    // Expose deterministic lists
    this.directInboxItems$ = this.directState$.asObservable();
    this.overallInboxItems$ = this.overallState$.asObservable();
    this.inboxItems$ = this.allState$.asObservable();

    // Unread subset from ALL
    this.unreadInboxItems$ = this.inboxItems$.pipe(
      map( ( list ) => list.filter( ( x ) => !this.isRead( x ) ) )
    );

    // Counts from deterministic lists
    this.allCounts$ = this.inboxItems$.pipe( map( ( list ) => this.countVm( list ) ) );
    this.directCounts$ = this.directInboxItems$.pipe( map( ( list ) => this.countVm( list ) ) );
    this.overallCounts$ = this.overallInboxItems$.pipe( map( ( list ) => this.countVm( list ) ) );

    this.unreadCount$ = this.allCounts$.pipe( map( ( c ) => c.unread ), startWith( 0 ) );

    // Tab + search + category filter (LOCAL ONLY)
    this.filteredItems$ = combineLatest( [
      this.inboxItems$,
      this.directInboxItems$,
      this.overallInboxItems$,
      this.activeTab$,
      this.activeCategory$,
      this.searchCtrl.valueChanges.pipe( startWith<string>( "" ), debounceTime( 150 ) ),
    ] ).pipe(
      map( ( [ all, direct, overall, tab, activeCat, q ] ) => {
        const pool =
          tab === "all"
            ? all
            : tab === "unread"
              ? all.filter( ( n ) => !this.isRead( n ) )
              : tab === "direct"
                ? direct
                : overall;

        const withCategory =
          activeCat && activeCat !== "All"
            ? pool.filter( ( n ) => this.categoryOf( n ) === activeCat )
            : pool;

        const query = ( q ?? "" ).trim().toLowerCase();
        if ( !query ) return withCategory;

        return withCategory.filter( ( n ) => {
          const title = this.titleOf( n ).toLowerCase();
          const body = this.bodyOf( n ).toLowerCase();
          const tags = this.tagsOf( n ).map( ( t ) => t.toLowerCase() );
          return (
            title.includes( query ) ||
            body.includes( query ) ||
            tags.some( ( t ) => t.includes( query ) )
          );
        } );
      } )
    );

    // Counts + page slice (LOCAL pagination)
    this.totalCount$ = this.filteredItems$.pipe( map( ( arr ) => arr.length ) );

    this.pageItems$ = combineLatest( [ this.filteredItems$, this.pageIndex$, this.pageSize$ ] ).pipe(
      map( ( [ items, pageIndex, pageSize ] ) => {
        const start = pageIndex * pageSize;
        return items.slice( start, start + pageSize );
      } )
    );

    // Paginator meta for number-row
    this.totalPages$ = combineLatest( [ this.totalCount$, this.pageSize$ ] ).pipe(
      map( ( [ count, size ] ) => Math.max( 1, Math.ceil( ( count || 0 ) / ( size || 1 ) ) ) )
    );

    this.currentPage$ = this.pageIndex$.pipe( map( ( i ) => i + 1 ) );

    this.pageNumbers$ = combineLatest( [ this.currentPage$, this.totalPages$ ] ).pipe(
      map( ( [ current, total ] ) => {
        const windowSize = 5;
        let start = Math.max( 1, current - 2 );
        let end = Math.min( total, current + 2 );

        while ( end - start + 1 < Math.min( windowSize, total ) ) {
          if ( start > 1 ) start--;
          else if ( end < total ) end++;
          else break;
        }

        const pages: number[] = [];
        for ( let p = start; p <= end; p++ ) pages.push( p );
        return pages;
      } )
    );

    // Clamp pageIndex when total pages shrinks (live updates)
    this.pageClampSub = combineLatest( [ this.totalPages$, this.pageIndex$ ] ).subscribe(
      ( [ totalPages, pageIndex ] ) => {
        const maxIndex = Math.max( 0, totalPages - 1 );
        if ( pageIndex > maxIndex ) this.pageIndex$.next( maxIndex );
      }
    );

    // Initial refresh
    this.refresh();
  }

  public ngAfterViewInit(): void {}

  public ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.pageClampSub?.unsubscribe();

    this.loading$.complete();
    this.pageIndex$.complete();
    this.pageSize$.complete();
    this.activeTab$.complete();
    this.activeCategory$.complete();

    this.directState$.complete();
    this.overallState$.complete();
    this.allState$.complete();
  }

  /** Manual refresh – deterministic: load DIRECT + OVERALL then merge */
  protected refresh(): void {
    if ( !this.me ) return;

    this.loading$.next( true );

    this.refresh$()
      .pipe(
        take( 1 ),
        catchError( () => of( void 0 ) )
      )
      .subscribe( {
        next: async () => {
          await new Promise<void>( ( resolve ) => setTimeout( resolve, 800 ) );
          this.loading$.next( false );
        },
        error: async () => {
          await new Promise<void>( ( resolve ) => setTimeout( resolve, 800 ) );
          this.loading$.next( false );
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

    const directItems$ = this.notify
      .loadDirect$( this.defaultPriority, 1, 0, listFilters, this.me )
      .pipe(
        map( ( view ) => ( view.items ?? [] ) ),
        map( ( items ) => items.filter( ( it ) => this.isDirectAudience( it?.notification?.audiences ?? [] ) ) ),
        catchError( () => of( [] as NotificationInboxItemDto[] ) )
      );

    // Overall is for ALL users (not admin-only)
    const overallItems$ = this.notify
      .loadOverall$( this.defaultPriority, 1, 0, listFilters, this.me )
      .pipe(
        map( ( view ) => ( view.items ?? [] ) ),
        map( ( items ) => items.filter( ( it ) => this.isOverallAudience( it?.notification?.audiences ?? [] ) ) ),
        catchError( () => of( [] as NotificationInboxItemDto[] ) )
      );

    return forkJoin( { direct: directItems$, overall: overallItems$ } ).pipe(
      tap( ( r ) => {
        this.directState$.next( r.direct );
        this.overallState$.next( r.overall );

        const merged = [ ...( r.direct ?? [] ), ...( r.overall ?? [] ) ];
        const all = this.sortLatestFirst( this.dedupeByInboxId( merged ) );
        this.allState$.next( all );
      } ),
      map( () => void 0 )
    );
  }

  protected search( q: string ): void {
    const query = ( q ?? "" ).trim();
    if ( query === this.searchCtrl.value ) return;
    this.searchCtrl.setValue( query, { emitEvent: true } );
    this.pageIndex$.next( 0 );
  }

  protected onCategorySelect( cat: NotificationCategory | "All", ev: MatChipSelectionChange ): void {
    if ( !ev.selected ) return;
    this.activeCategory$.next( cat );
    this.pageIndex$.next( 0 );
  }

  protected onTabChange( idx: number ): void {
    const key: TabKey = idx === 0 ? "all" : idx === 1 ? "unread" : idx === 2 ? "direct" : "overall";
    this.activeTab$.next( key );
    this.pageIndex$.next( 0 );
  }

  protected onPage( e: PageEvent ): void {
    this.pageIndex$.next( e.pageIndex );
    this.pageSize$.next( e.pageSize );
  }

  protected async goToPage( p: number ): Promise<void> {
    if ( p < 1 ) return;
    const total = await firstValueFrom( this.totalPages$ );
    const clamped = Math.min( total, Math.max( 1, p ) );
    this.pageIndex$.next( clamped - 1 );
  }

  protected async prevPage( step: number = 1 ): Promise<void> {
    const current = await firstValueFrom( this.currentPage$ );
    await this.goToPage( current - step );
  }

  protected async nextPage( step: number = 1 ): Promise<void> {
    const current = await firstValueFrom( this.currentPage$ );
    await this.goToPage( current + step );
  }

  protected async skipBack(): Promise<void> {
    await this.prevPage( 3 );
  }

  protected async skipForward(): Promise<void> {
    await this.nextPage( 3 );
  }

  protected markRead( inboxId: string ): void {
    const id = this.safeId( inboxId );
    if ( !id ) return;

    this.notify.markRead$( id ).pipe( take( 1 ) ).subscribe( {
      next: () => undefined,
      error: ( err ) => {
        console.error( `[Error:] [NotificationsMainPage] markRead failed: ${ this.errMsg( err ) }\n` );
      },
    } );
  }

  protected markAllVisibleAsRead( items: NotificationInboxItemDto[] | null | undefined ): void {
    if ( !items?.length ) return;

    this.notify.markAllRead$().pipe( take( 1 ) ).subscribe( {
      next: () => undefined,
      error: ( err ) => {
        console.error( `[Error:] [NotificationsMainPage] markAllRead failed: ${ this.errMsg( err ) }\n` );
      },
    } );
  }

  protected async openNotification( item: NotificationInboxItemDto ): Promise<void> {
    await this.notificationRouter.navigateByTarget( item.notification.target );

    if ( !this.isRead( item ) ) {
      const inboxId = this.inboxIdOf( item );
      if ( inboxId ) this.markRead( inboxId );
    }
  }

  protected inboxIdOf( item: NotificationInboxItemDto ): string {
    return this.safeId( ( item as unknown as { inboxId?: unknown; } )?.inboxId );
  }

  // ✅ keeps lexical "this"
  protected readonly trackById = ( _: number, item: NotificationInboxItemDto ): string => {
    const inboxId = this.safeId( ( item as unknown as { inboxId?: unknown; } )?.inboxId );
    if ( inboxId ) return inboxId;

    const notificationId = this.safeId(
      ( item?.notification as unknown as { notificationId?: unknown; } )?.notificationId
    );
    return notificationId || String( _ );
  };

  protected iconFor( item: NotificationInboxItemDto ): string {
    const sev = this.safeString( ( item?.notification as unknown as { severity?: unknown; } )?.severity );
    switch ( sev ) {
      case "success":
        return "check_circle";
      case "warning":
        return "warning";
      case "error":
        return "error";
      default:
        return "notifications";
    }
  }

  // =============================================================================
  // Audience rules (aligned with your dialog, but Overall visible to ALL users)
  // =============================================================================

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

    // must NOT be direct to ME
    if ( this.isDirectAudience( audiences ) ) return false;

    const myRoleKey = this.safeLower( this.myRole );
    const myTeams = this.myTeamCodes;

    for ( const a of audiences ) {
      if ( !a || typeof a !== "object" ) continue;

      if ( a.mode === "Company" ) return true;

      if ( a.mode === "Role" ) {
        // support both roleKey and role (defensive)
        const roleKey = this.safeLower( ( a as unknown as { roleKey?: unknown; } )?.roleKey );
        const role = this.safeLower( ( a as unknown as { role?: unknown; } )?.role );

        if ( myRoleKey && roleKey && roleKey === myRoleKey ) return true;
        if ( myRoleKey && role && role === myRoleKey ) return true;
      }

      if ( a.mode === "Team" ) {
        const teamCode = this.safeString( ( a as unknown as { teamCode?: unknown; } )?.teamCode );
        if ( teamCode && myTeams.includes( teamCode ) ) return true;
      }
    }

    return false;
  }

  // =============================================================================
  // DTO accessors
  // =============================================================================

  protected isRead( item: NotificationInboxItemDto ): boolean {
    const v = ( item as unknown as { state?: { isRead?: boolean; }; } )?.state?.isRead;
    if ( typeof v === "boolean" ) return v;

    const v2 = ( item as unknown as { userState?: { isRead?: boolean; }; } )?.userState?.isRead;
    if ( typeof v2 === "boolean" ) return v2;

    const v3 = ( item as unknown as { isRead?: boolean; } )?.isRead;
    if ( typeof v3 === "boolean" ) return v3;

    return false;
  }

  protected categoryOf( item: NotificationInboxItemDto ): string {
    return this.safeString( ( item?.notification as unknown as { category?: unknown; } )?.category );
  }

  protected titleOf( item: NotificationInboxItemDto ): string {
    return this.safeString( ( item?.notification as unknown as { title?: unknown; } )?.title );
  }

  protected bodyOf( item: NotificationInboxItemDto ): string {
    return this.safeString( ( item?.notification as unknown as { body?: unknown; } )?.body );
  }

  protected tagsOf( item: NotificationInboxItemDto ): string[] {
    const t = ( item?.notification as unknown as { tags?: unknown; } )?.tags;
    return this.safeArrStr( t );
  }

  // =============================================================================
  // Count helpers
  // =============================================================================

  private countVm( list: ReadonlyArray<NotificationInboxItemDto> ): CountVm {
    const total = Array.isArray( list ) ? list.length : 0;
    const unread = Array.isArray( list ) ? list.filter( ( x ) => !this.isRead( x ) ).length : 0;
    return { total, unread };
  }

  // =============================================================================
  // Sorting + dedupe (copied from your dialog logic)
  // =============================================================================

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

  private sortLatestFirst( items: NotificationInboxItemDto[] ): NotificationInboxItemDto[] {
    const copy = [ ...( items ?? [] ) ];

    copy.sort( ( a, b ) => {
      const bt = this.getItemSortTimeMs( b );
      const at = this.getItemSortTimeMs( a );
      return bt - at;
    } );

    return copy;
  }

  private getItemSortTimeMs( item: NotificationInboxItemDto ): number {
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

  // =============================================================================
  // Safe helpers
  // =============================================================================

  private safeLower( v: unknown ): string {
    const s = typeof v === "string" ? v.trim() : "";
    return s.toLowerCase();
  }

  private safeString( v: unknown ): string {
    if ( typeof v === "string" ) return v.trim();
    if ( typeof v === "number" ) return String( v );
    return "";
  }

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

  private safeArrStr( v: unknown ): string[] {
    if ( !Array.isArray( v ) ) return [];
    return v
      .filter( ( x ) => typeof x === "string" )
      .map( ( x ) => x.trim() )
      .filter( ( x ) => !!x );
  }

  private errMsg( err: unknown ): string {
    if ( err instanceof Error ) return err.message;
    return String( err ?? "unknown_error" );
  }
}
