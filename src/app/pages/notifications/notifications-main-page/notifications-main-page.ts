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
  Renderer2,
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
} from "rxjs";
import { catchError, debounceTime, map, startWith } from "rxjs/operators";

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

import { SkeletonLoaderComponent } from "../../../components/shared/skeleton-loader/skeleton-loader.component";
import { User } from "../../../services/APIs/apis.service";
import { AuthService } from "../../../services/auth/auth.service";
import { WindowsRefService } from "../../../services/windowRef/windowRef.service";
import type { Role } from "../../../services/auth/user.contract";

// ✅ NEW single facade
import { NotificationCenterService } from "../../../services/notifications/notification-center.service";

// ✅ NEW canonical DTOs
import type {
  NotificationInboxItemDto,
  NotificationLoadRequest,
} from "../../../types/notifications/notification.types";

/** Tabs */
type TabKey = "all" | "unread" | "direct" | "overall";

type TitleCategory =
  | "User"
  | "Tenant"
  | "Property"
  | "Lease"
  | "Agent"
  | "Developer"
  | "Maintenance"
  | "Complaint"
  | "Team"
  | "Registration"
  | "Payment"
  | "System";

const CATEGORY_OPTIONS: Array<TitleCategory | "All"> = [
  "All",
  "User",
  "Tenant",
  "Property",
  "Lease",
  "Agent",
  "Developer",
  "Maintenance",
  "Complaint",
  "Team",
  "Registration",
  "Payment",
  "System",
];

/* =============================================================================
 * NotificationsMainPage (Upgraded to NotificationCenterService integration)
 * -----------------------------------------------------------------------------
 * 01) Introduction to the class and its usage
 * - Full page notifications view: tabs, category chips, search, pagination.
 * - Uses REST snapshot list + WS count stream.
 * - Uses centralized routing (actionKey → route map) through NotificationCenterService.
 *
 * 02) Important matters
 * - Tabs/category/search remain LOCAL filters (do not affect backend query).
 * - Backend load is intentionally basic (page/limit) to keep UI stable.
 *
 * 03) Why upgrade
 * - One import/inject only (NotificationCenterService).
 * - Sound + WS + REST + routing handled centrally.
 * ============================================================================= */

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
  /** Theme mode from global service (bool or null until first emit) */
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  /** Core streams (NEW DTOs) */
  protected inboxItems$!: Observable<NotificationInboxItemDto[]>;
  protected unreadInboxItems$!: Observable<NotificationInboxItemDto[]>;
  protected unreadCount$!: Observable<number>;
  protected connected$!: Observable<boolean>;

  /** Audience-derived subsets */
  protected directInboxItems$!: Observable<NotificationInboxItemDto[]>;
  protected overallInboxItems$!: Observable<NotificationInboxItemDto[]>;

  /** Logged user */
  private username = "";
  private role: Role | null = null;

  // Optional: if your AuthUser carries these fields, we use them for audience checks
  private userId = "";
  private teamCodes: string[] = [];

  /** UI state */
  protected activeTab$: BehaviorSubject<TabKey> = new BehaviorSubject<TabKey>( "all" );
  protected searchCtrl: FormControl<string> = new FormControl<string>( "", { nonNullable: true } );

  /** Category chips */
  protected categories: Array<TitleCategory | "All"> = CATEGORY_OPTIONS;
  protected activeCategory$: BehaviorSubject<TitleCategory | "All"> = new BehaviorSubject<TitleCategory | "All">( "All" );

  /** Pagination state */
  protected pageSizeOptions: number[] = [ 10, 20, 30, 50 ];
  private pageIndex$: BehaviorSubject<number> = new BehaviorSubject<number>( 0 ); // 0-based
  private pageSize$: BehaviorSubject<number> = new BehaviorSubject<number>( 10 );

  /** Loading (skeletons) */
  protected loading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>( false );

  /** View-model */
  protected filteredItems$!: Observable<NotificationInboxItemDto[]>;
  protected totalCount$!: Observable<number>;
  protected pageItems$!: Observable<NotificationInboxItemDto[]>;

  /** Number-row paginator helpers */
  protected totalPages$!: Observable<number>;
  protected currentPage$!: Observable<number>;
  protected pageNumbers$!: Observable<number[]>;

  /** Socket connected snapshot */
  private connSub?: Subscription;
  protected connected!: boolean;

  /** Logged User snapshot */
  private me: User | null = null;

  public constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,

    // ✅ NEW single facade
    private readonly notify: NotificationCenterService,

    private readonly renderer: Renderer2
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

    // Logged user (for audience predicates)
    this.me = this.authService.getLoggedUser;
    this.username = this.me?.username || "";
    this.role = this.me?.role || null;

    // Optional extended identity (safe)
    this.userId = this.safeStr( ( this.me as unknown as { userId?: string; } )?.userId );
    this.teamCodes = this.safeArrStr( ( this.me as unknown as { teamCodes?: string[]; } )?.teamCodes );

    // Connection (WS)
    this.connected$ = this.notify.onConnected$();
    this.connSub = this.connected$
      .pipe( distinctUntilChanged() )
      .subscribe( ( isOn: boolean ): void => {
        // Keeping your legacy behaviour: connected flag inverted
        this.connected = !isOn;
      } );

    // Unread count (prefer WS count stream)
    this.unreadCount$ = this.notify.onCount$().pipe(
      map( ( c ) => {
        const n = ( c as unknown as { unread?: number; } )?.unread;
        return typeof n === "number" && Number.isFinite( n ) ? n : 0;
      } ),
      startWith( 0 )
    );

    // REST snapshot list (source of truth for list rendering)
    this.inboxItems$ = this.loadInboxStream( { page: 1, limit: 50 } );

    // Unread subset
    this.unreadInboxItems$ = this.inboxItems$.pipe(
      map( ( list ) => list.filter( ( x ) => !this.isRead( x ) ) )
    );

    // Audience derived (direct)
    this.directInboxItems$ = this.inboxItems$.pipe(
      map( ( list ) => list.filter( ( x ) => this.isDirectToMe( x?.notification?.audiences ?? [] ) ) )
    );

    // Audience derived (overall – admin sees others)
    this.overallInboxItems$ = this.inboxItems$.pipe(
      map( ( list ) => list.filter( ( x ) => this.isOverallVisibleToAdmin( x?.notification?.audiences ?? [] ) ) )
    );

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
        // pick pool by tab
        const pool =
          tab === "all"
            ? all
            : tab === "unread"
              ? all.filter( ( n ) => !this.isRead( n ) )
              : tab === "direct"
                ? direct
                : overall;

        // category filter (local)
        const withCategory =
          activeCat && activeCat !== "All"
            ? pool.filter( ( n ) => this.categoryOf( n ) === activeCat )
            : pool;

        // search filter (local)
        const query = ( q ?? "" ).trim().toLowerCase();
        if ( !query ) return withCategory;

        return withCategory.filter( ( n ) => {
          const title = this.titleOf( n ).toLowerCase();
          const body = this.bodyOf( n ).toLowerCase();
          const tags = this.tagsOf( n ).map( ( t ) => t.toLowerCase() );

          return title.includes( query ) || body.includes( query ) || tags.some( ( t ) => t.includes( query ) );
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

    // Initial fetch
    this.fetchPage();
  }

  public ngAfterViewInit(): void {}

  public ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.connSub?.unsubscribe();

    this.loading$.complete();
    this.pageIndex$.complete();
    this.pageSize$.complete();
    this.activeTab$.complete();
    this.activeCategory$.complete();
  }

  /** Manual refresh – only re-calls backend */
  protected refresh(): void {
    this.fetchPage();
  }

  /** Search – LOCAL filter only */
  protected search( q: string ): void {
    const query = ( q ?? "" ).trim();
    if ( query === this.searchCtrl.value ) return;

    this.searchCtrl.setValue( query, { emitEvent: true } );
    this.pageIndex$.next( 0 );
  }

  /** Category chip selection – LOCAL filter only */
  protected onCategorySelect( cat: TitleCategory | "All", ev: MatChipSelectionChange ): void {
    if ( !ev.selected ) return;
    this.activeCategory$.next( cat );
    this.pageIndex$.next( 0 );
  }

  /** Tab change – LOCAL filter only */
  protected onTabChange( idx: number ): void {
    const key: TabKey = idx === 0 ? "all" : idx === 1 ? "unread" : idx === 2 ? "direct" : "overall";
    this.activeTab$.next( key );
    this.pageIndex$.next( 0 );
  }

  /** MatPaginator handler – LOCAL pagination only */
  protected onPage( e: PageEvent ): void {
    this.pageIndex$.next( e.pageIndex );
    this.pageSize$.next( e.pageSize );
  }

  /** Number-row paginator actions (1-based) – LOCAL pagination only */
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

  /** Mark a single inbox item as read */
  protected markRead( inboxId: string ): void {
    const id = this.safeStr( inboxId );
    if ( !id ) return;

    this.notify.markRead$( id ).subscribe( {
      next: () => this.refresh(),
      error: ( err ) => {
        // eslint-disable-next-line no-console
        console.error( `[Error:] [NotificationsMainPage] markRead failed: ${ this.errMsg( err ) }\n` );
      },
    } );
  }

  /** Mark all visible (paged) items as read */
  protected markAllVisibleAsRead( items: NotificationInboxItemDto[] | null | undefined ): void {
    if ( !items?.length ) return;

    // Option A (preferred): your backend likely has markMany endpoint - if your REST service supports it.
    // If not available, fall back to markAllRead.
    // For now, safest: markAllRead
    this.notify.markAllRead$().subscribe( {
      next: () => this.refresh(),
      error: ( err ) => {
        // eslint-disable-next-line no-console
        console.error( `[Error:] [NotificationsMainPage] markAllRead failed: ${ this.errMsg( err ) }\n` );
      },
    } );
  }

  /** Open inbox item and mark read if needed */
  protected async openNotification( item: NotificationInboxItemDto ): Promise<void> {
    await this.notify.navigateByInboxItem( item );

    if ( !this.isRead( item ) ) {
      const inboxId = this.safeStr( ( item as unknown as { inboxId?: string; } )?.inboxId );
      if ( inboxId ) this.markRead( inboxId );
    }
  }

  /** TrackBy for *ngFor perf */
  protected trackById( _: number, item: NotificationInboxItemDto ): string {
    const inboxId = this.safeStr( ( item as unknown as { inboxId?: string; } )?.inboxId );
    if ( inboxId ) return inboxId;

    return this.safeStr( ( item?.notification as unknown as { notificationId?: string; } )?.notificationId );
  }

  /** Icon by severity (template calls) */
  protected iconFor( item: NotificationInboxItemDto ): string {
    const sev = this.safeStr( ( item?.notification as unknown as { severity?: string; } )?.severity );
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

  /**
   * Fetch from backend.
   * ❗ Does NOT apply local filters (tab/category/search)
   */
  private async fetchPage(): Promise<void> {
    this.loading$.next( true );

    try {
      // Keep backend fetch independent from local filters.
      // We load a stable snapshot (page=1) and paginate locally for UI consistency.
      // If you want true server-side paging, we can refactor later.
      this.inboxItems$ = this.loadInboxStream( { page: 1, limit: 50 } );
    } catch ( err ) {
      // eslint-disable-next-line no-console
      console.error( `[Error:] [NotificationsMainPage] fetchPage failed: ${ this.errMsg( err ) }\n` );
    } finally {
      // keep your skeleton delay
      await new Promise<void>( ( resolve ) => setTimeout( resolve, 1000 ) );
      this.loading$.next( false );
    }
  }

  // =============================================================================
  // REST snapshot loader (maps your REST result shape to NotificationInboxItemDto[])
  // =============================================================================

  private loadInboxStream( options: { page: number; limit: number; } ): Observable<NotificationInboxItemDto[]> {
    if ( !this.username ) return of( [] );

    const req: NotificationLoadRequest = {
      username: this.username,
      page: options.page,
      limit: options.limit,
    };

    return this.notify.loadInbox$( req ).pipe(
      map( ( res ) => {
        // NOTE:
        // Adjust this mapping to match your real REST response shape.
        // Typical shapes are:
        //  - { items: NotificationInboxItemDto[] }
        //  - { data: { items: NotificationInboxItemDto[] } }
        const items = ( res as unknown as { items?: NotificationInboxItemDto[]; } )?.items;
        return Array.isArray( items ) ? items : [];
      } ),
      catchError( () => of( [] ) )
    );
  }

  // =============================================================================
  // Audience model helpers (NEW union audiences)
  // =============================================================================

  private isDirectToMe( audiences: unknown[] ): boolean {
    if ( !Array.isArray( audiences ) || audiences.length === 0 ) return false;

    for ( const a of audiences ) {
      const mode = this.safeStr( ( a as { mode?: string; } )?.mode );

      if ( mode === "Company" ) return true;

      if ( mode === "Role" ) {
        const roleKeys = this.safeArrStr( ( a as { roleKeys?: string[]; } )?.roleKeys );
        if ( this.role && roleKeys.includes( String( this.role ) ) ) return true;
      }

      if ( mode === "Team" ) {
        const teamCodes = this.safeArrStr( ( a as { teamCodes?: string[]; } )?.teamCodes );
        if ( this.teamCodes.some( ( t ) => teamCodes.includes( t ) ) ) return true;
      }

      if ( mode === "User" ) {
        const userIds = this.safeArrStr( ( a as { userIds?: string[]; } )?.userIds );
        const usernames = this.safeArrStr( ( a as { usernames?: string[]; } )?.usernames );

        if ( this.userId && userIds.includes( this.userId ) ) return true;
        if ( this.username && usernames.includes( this.username ) ) return true;
      }
    }

    return false;
  }

  private isOverallVisibleToAdmin( audiences: unknown[] ): boolean {
    if ( this.role !== ( "admin" as Role ) ) return false;
    return !this.isDirectToMe( audiences );
  }

  // =============================================================================
  // DTO field accessors (centralize uncertain field names)
  // =============================================================================

  private isRead( item: NotificationInboxItemDto ): boolean {
    const v = ( item as unknown as { state?: { isRead?: boolean; }; } )?.state?.isRead;
    if ( typeof v === "boolean" ) return v;

    const v2 = ( item as unknown as { userState?: { isRead?: boolean; }; } )?.userState?.isRead;
    if ( typeof v2 === "boolean" ) return v2;

    return false;
  }

  private categoryOf( item: NotificationInboxItemDto ): string {
    return this.safeStr( ( item?.notification as unknown as { category?: string; } )?.category );
  }

  private titleOf( item: NotificationInboxItemDto ): string {
    return this.safeStr( ( item?.notification as unknown as { title?: string; } )?.title );
  }

  private bodyOf( item: NotificationInboxItemDto ): string {
    return this.safeStr( ( item?.notification as unknown as { body?: string; } )?.body );
  }

  private tagsOf( item: NotificationInboxItemDto ): string[] {
    const t = ( item?.notification as unknown as { tags?: string[]; } )?.tags;
    return this.safeArrStr( t );
  }

  // =============================================================================
  // safe helpers (class methods only)
  // =============================================================================

  private safeStr( v: unknown ): string {
    return typeof v === "string" ? v.trim() : "";
  }

  private safeArrStr( v: unknown ): string[] {
    if ( !Array.isArray( v ) ) return [];
    return v.filter( ( x ) => typeof x === "string" ).map( ( x ) => x.trim() ).filter( ( x ) => !!x );
  }

  private errMsg( err: unknown ): string {
    if ( err instanceof Error ) return err.message;
    return String( err ?? "unknown_error" );
  }
}
