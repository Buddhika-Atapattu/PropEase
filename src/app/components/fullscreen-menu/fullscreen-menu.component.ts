// Path: src/app/components/fullscreen-menu/fullscreen-menu.component.ts
// =============================================================================
// FullscreenMenuComponent (Menu + Notifications) — 3 Tabs + 3 Unread Counts
// =============================================================================
// Tabs:
// - All      = Direct + Overall (deduped by inboxId)
// - Direct   = notifications targeted to ME (mode:"User" via username/userId)
// - Overall  = notifications targeted to role/company (NOT me-specific)
//
// Fixes:
// - Prevents overlay closing when clicking inside panel (stopPropagation boundary)
// - Restored menu collapse + active route highlight
// - Correct audience parsing (Role uses roleKey)
// - Deterministic refresh via forkJoin (items + counts)
// - Unread counts per tab + list per activeTab
// =============================================================================

import { CommonModule, isPlatformBrowser } from "@angular/common";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  Renderer2,
  SimpleChanges,
  ViewChild,
} from "@angular/core";

import { MatRippleModule } from "@angular/material/core";
import { MatIconModule, MatIconRegistry } from "@angular/material/icon";
import { MatMenuModule, MatMenuTrigger } from "@angular/material/menu";
import { DomSanitizer } from "@angular/platform-browser";
import { Router } from "@angular/router";

import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  distinctUntilChanged,
  firstValueFrom,
  forkJoin,
  fromEvent,
  map,
  of,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
  timer,
} from "rxjs";

import { APIsService, User } from "../../services/APIs/apis.service";
import { AuthService } from "../../services/auth/auth.service";
import type { Role } from "../../services/auth/user.contract";

import { NotificationCenterService } from "../../services/notifications/notification-center.service";
import { NotificationRouteMapService } from "../../services/notifications/notification-route-map.service";

import { type FullscreenMenuLink } from "../list-main-panel/list-main-panel.component";
import { UserInfoPanelComponent } from "../user-info-panel/user-info-panel.component";

import type {
  NotificationAudience,
  NotificationInboxItemDto,
  NotificationLoadFilters,
} from "../../types/notifications/notification.types";

type TabKey = "all" | "direct" | "overall";
type UiNotification = NotificationInboxItemDto;

export interface FullscreenMenuProfile {
  name: string;
  email?: string | null;
  avatarSrc?: string | null;
}

@Component( {
  selector: "app-fullscreen-menu",
  standalone: true,
  imports: [ CommonModule, MatIconModule, MatRippleModule, MatMenuModule, UserInfoPanelComponent ],
  templateUrl: "./fullscreen-menu.component.html",
  styleUrls: [ "./fullscreen-menu.component.scss" ],
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class FullscreenMenuComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  /** Controls visibility from parent */
  @Input() open = false;

  /** Profile header (optional) */
  @Input() profile: FullscreenMenuProfile | null = null;

  /** Menu items */
  @Input( { required: true } ) links: FullscreenMenuLink[] = [];

  /** Current router url fragment to highlight active route */
  @Input() currentUrl = "";

  /** Emits when the overlay requests close */
  @Output() closed = new EventEmitter<void>();

  /** Emits (parent, child, grandchild) path triplet for navigation (optional) */
  @Output() navigate = new EventEmitter<{ p: string | null; c: string | null; g: string | null; }>();

  @ViewChild( "menuTrigger", { static: false } ) public menuTrigger?: MatMenuTrigger;
  @ViewChild( UserInfoPanelComponent, { static: false } ) public userInfoPanel?: UserInfoPanelComponent;

  private readonly isBrowser: boolean;
  private readonly destroy$ = new Subject<void>();
  private readonly unlisteners: Array<() => void> = [];

  /** Which body to show */
  protected activeView: "menu" | "notifications" = "menu";

  /** Tabs in notifications view */
  protected activeTab: TabKey = "all";

  /** Connection */
  protected connected$!: Observable<boolean>;

  /** Lists (exposed) */
  protected allNotifications$!: Observable<ReadonlyArray<UiNotification>>;
  protected directNotifications$!: Observable<ReadonlyArray<UiNotification>>;
  protected overallNotifications$!: Observable<ReadonlyArray<UiNotification>>;

  /** Active list based on tab */
  protected activeNotifications$!: Observable<ReadonlyArray<UiNotification>>;

  /** Unread counts (exposed) */
  protected unreadAll$!: Observable<number>;
  protected unreadDirect$!: Observable<number>;
  protected unreadOverall$!: Observable<number>;

  /** Badge for the Menu/Notifications switch */
  protected unreadCount$!: Observable<number>;

  protected isLoggedIn = false;

  private me: User | null = null;
  private username = "";
  private userId = "";
  private role: Role = "user";

  /** Local stores */
  private readonly allItemsState$ = new BehaviorSubject<UiNotification[]>( [] );
  private readonly directItemsState$ = new BehaviorSubject<UiNotification[]>( [] );
  private readonly overallItemsState$ = new BehaviorSubject<UiNotification[]>( [] );

  private readonly unreadAllState$ = new BehaviorSubject<number>( 0 );
  private readonly unreadDirectState$ = new BehaviorSubject<number>( 0 );
  private readonly unreadOverallState$ = new BehaviorSubject<number>( 0 );

  /** Tab store so activeNotifications$ can react */
  private readonly activeTabState$ = new BehaviorSubject<TabKey>( "all" );

  /** Query defaults */
  private readonly priorityScope: "all" | "prioritized" | "unprioritized" = "all";
  private readonly page = 1;
  private readonly limit = 50;

  /** Refresh throttling */
  private lastRefreshAtMs = 0;
  private readonly refreshMinGapMs = 800;

  public constructor (
    private readonly el: ElementRef<HTMLElement>,
    private readonly r2: Renderer2,
    private readonly router: Router,
    @Inject( PLATFORM_ID ) platformId: object,
    private readonly notificationCenter: NotificationCenterService,
    private readonly notificationRouter: NotificationRouteMapService,
    private readonly authService: AuthService,
    private readonly matIconRegistry: MatIconRegistry,
    private readonly domSanitizer: DomSanitizer,
    private readonly apiService: APIsService
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
  }

  // =============================================================================
  // Life-cycle
  // =============================================================================

  public ngOnInit(): void {
    this.makeIcons();

    this.isLoggedIn = this.authService.isUserLoggedIn;
    this.me = this.authService.getLoggedUser;

    if ( !this.me ) {
      this.connected$ = of( false );
      this.bindEmptyStreams();
      return;
    }

    this.username = this.safeString( this.me.username );
    this.userId =
      this.safeId( ( this.me as unknown as { _id?: unknown; userId?: unknown; } )?._id ) ||
      this.safeId( ( this.me as unknown as { userId?: unknown; } )?.userId );
    this.role = ( this.me.role ?? "user" ) as Role;

    this.connected$ = this.notificationCenter.connected$();

    // Expose streams
    this.allNotifications$ = this.allItemsState$.asObservable();
    this.directNotifications$ = this.directItemsState$.asObservable();
    this.overallNotifications$ = this.overallItemsState$.asObservable();

    this.unreadAll$ = this.unreadAllState$.asObservable();
    this.unreadDirect$ = this.unreadDirectState$.asObservable();
    this.unreadOverall$ = this.unreadOverallState$.asObservable();

    // Badge = ALL unread
    this.unreadCount$ = this.unreadAll$;

    // Active list based on tab
    this.activeNotifications$ = this.activeTabState$.pipe(
      distinctUntilChanged(),
      switchMap( ( t ) => {
        if ( t === "direct" ) return this.directNotifications$;
        if ( t === "overall" ) return this.overallNotifications$;
        return this.allNotifications$;
      } )
    );

    // Start notification center (required for WS + REST fallback)
    this.notificationCenter.start( { me: this.me } );

    // Initial hydrate
    this.refreshOnce( "init" );

    // WS push -> refresh (throttled)
    this.notificationCenter
      .onNew( false )
      .pipe( takeUntil( this.destroy$ ) )
      .subscribe( {
        next: () => this.refreshOnce( "push_new" ),
        error: ( err: unknown ) => {
          // eslint-disable-next-line no-console
          console.error( `[Error:] [FullscreenMenu] onNew stream error: ${ this.errMsg( err ) }\n` );
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
        .subscribe( {
          error: ( err: unknown ) => {
            // eslint-disable-next-line no-console
            console.error( `[Error:] [FullscreenMenu] poll refresh error: ${ this.errMsg( err ) }\n` );
          },
        } );
    }
  }

  public ngAfterViewInit(): void {
    this.applyBodyScrollLock( this.open );

    if ( this.isBrowser ) {
      const offKey = this.r2.listen( "document", "keydown", ( e: KeyboardEvent ) => {
        if ( e.key === "Escape" && this.open ) this.requestClose();
      } );
      this.unlisteners.push( offKey );
    }
  }

  public ngOnChanges( changes: SimpleChanges ): void {
    if ( changes[ "open" ] && !changes[ "open" ].firstChange ) {
      this.applyBodyScrollLock( this.open );
    }

    // When opening, default view/tab
    if ( changes[ "open" ] && this.open ) {
      this.activeView = "menu";
      this.setTab( "all" );
    }
  }

  public ngOnDestroy(): void {
    this.unlisteners.forEach( ( u ) => u() );
    this.applyBodyScrollLock( false );

    this.destroy$.next();
    this.destroy$.complete();

    this.allItemsState$.complete();
    this.directItemsState$.complete();
    this.overallItemsState$.complete();

    this.unreadAllState$.complete();
    this.unreadDirectState$.complete();
    this.unreadOverallState$.complete();

    this.activeTabState$.complete();
  }

  // =============================================================================
  // Click isolation (prevents overlay close when clicking inside)
  // =============================================================================

  protected stopInside( ev?: Event ): void {
    ev?.stopPropagation();
  }

  // =============================================================================
  // View toggles
  // =============================================================================

  protected showMenu( ev?: Event ): void {
    ev?.preventDefault?.();
    ev?.stopPropagation();
    this.activeView = "menu";
  }

  protected showNotifications( ev?: Event ): void {
    ev?.preventDefault?.();
    ev?.stopPropagation();
    this.activeView = "notifications";
    this.setTab( "all", ev );
    this.refreshOnce( "open_notifications" );
  }

  protected setTab( tab: TabKey, ev?: Event ): void {
    ev?.preventDefault?.();
    ev?.stopPropagation();

    this.activeTab = tab;
    this.activeTabState$.next( tab );
  }

  protected canShowOverallTab(): boolean {
    return this.safeLower( this.role ) === "admin";
  }

  // =============================================================================
  // Notifications actions
  // =============================================================================

  protected async markOneRead( notification: UiNotification, ev?: Event ): Promise<void> {
    ev?.stopPropagation();
    ev?.preventDefault?.();

    try {
      const didNavigate = await this.navigateByNotificationTarget( notification );

      const inboxId = this.getInboxId( notification );
      if ( inboxId ) {
        await firstValueFrom( this.notificationCenter.markRead$( inboxId ).pipe( take( 1 ) ) );
      }

      this.refreshOnce( "mark_one" );
      if ( didNavigate ) this.requestClose();
    } catch ( e: unknown ) {
      // eslint-disable-next-line no-console
      console.error( `[Error:] [FullscreenMenu] markOneRead failed: ${ this.errMsg( e ) }\n` );
    }
  }

  protected async markAllAsRead( ev?: Event ): Promise<void> {
    ev?.stopPropagation();
    ev?.preventDefault?.();

    try {
      await firstValueFrom( this.notificationCenter.markAllRead$().pipe( take( 1 ) ) );
      this.refreshOnce( "mark_all" );
    } catch ( e: unknown ) {
      // eslint-disable-next-line no-console
      console.error( `[Error:] [FullscreenMenu] markAllAsRead failed: ${ this.errMsg( e ) }\n` );
    }
  }

  protected viewAllNotifications( ev?: Event ): void {
    ev?.stopPropagation();
    ev?.preventDefault?.();

    if ( !this.me ) return;
    this.requestClose();
    this.router.navigate( [ "/dashboard/notifications/all-notifications" ] ).catch( () => undefined );
  }

  protected readonly trackById = ( _: number, item: UiNotification ): string => {
    const inboxId = this.getInboxId( item );
    return inboxId || String( _ );
  };

  // =============================================================================
  // Menu helpers (restored)
  // =============================================================================

  public onBackdrop( ev?: MouseEvent ): void {
    // Only close if the REAL backdrop is clicked (prevents accidental closes)
    if ( ev && ev.target !== ev.currentTarget ) return;
    this.requestClose();
  }

  public go( item: FullscreenMenuLink, ev?: Event ): void {
    ev?.stopPropagation();
    ev?.preventDefault?.();

    if ( !item.commands ) return;

    // emit triplet for parent tracking (optional)
    this.navigate.emit( { p: item.url ?? null, c: null, g: null } );

    this.router.navigate( [ "dashboard", ...item.commands ] ).catch( () => undefined );
    this.requestClose();
  }

  public toggleTop( index: number, ev?: Event ): void {
    ev?.stopPropagation();
    ev?.preventDefault?.();
    this.toggleSection( `.lvl-1[data-idx="${ index }"]` );
  }

  public toggleSub( i: number, j: number, ev?: Event ): void {
    ev?.stopPropagation();
    ev?.preventDefault?.();
    this.toggleSection( `.lvl-2[data-idx="${ i }-${ j }"]` );
  }

  public isActive( url?: string | null ): boolean {
    const u = this.safeString( url );
    if ( !u ) return false;

    const curr = this.safeString( this.currentUrl || this.router.url );
    return curr.includes( u );
  }

  public activeItem( p: FullscreenMenuLink | null, s: FullscreenMenuLink | null ): boolean {
    const u = this.safeString( ( s ?? p )?.url );
    if ( !u ) return false;

    const curr = this.safeString( this.currentUrl || this.router.url );
    return curr.includes( u );
  }

  public trackTop = ( _: number, it: FullscreenMenuLink ): string => it.url ?? it.icon_text;
  public trackSub = ( _: number, it: FullscreenMenuLink ): string => it.url ?? it.icon_text;
  public trackChild = ( _: number, it: FullscreenMenuLink ): string => it.url ?? it.icon_text;

  protected signalToClose(): void {
    this.requestClose();
  }

  // =============================================================================
  // Profile click action (kept)
  // =============================================================================

  protected async viewUserProfile(): Promise<void> {
    try {
      const user: User | null = this.authService.getLoggedUser;
      if ( !user?.username ) throw new Error( "Invalid login / username!" );

      const res = await this.apiService.generateToken( user.username );
      if ( !res.success || res.status !== "success" || !res.data ) throw new Error( "Failed to fetch data!" );

      const token: string | null = this.apiService.extractTokenFromMsg( res );
      if ( !token ) throw new Error( "Token missing from response!" );

      await this.router.navigate( [ "/dashboard/users/user-profile", token ] );
    } catch ( error: unknown ) {
      // eslint-disable-next-line no-console
      console.error( `[Error:] [FullscreenMenu.viewUserProfile] ${ this.errMsg( error ) }\n` );
    } finally {
      this.requestClose();
    }
  }

  // =============================================================================
  // Refresh logic (Direct + Overall + Counts) -> All
  // =============================================================================

  private refreshOnce(
    reason: "init" | "push_new" | "open_notifications" | "mark_one" | "mark_all" | "poll"
  ): void {
    if ( !this.me ) return;

    const now = Date.now();
    if ( now - this.lastRefreshAtMs < this.refreshMinGapMs ) return;
    this.lastRefreshAtMs = now;

    this.refresh$()
      .pipe( take( 1 ) )
      .subscribe( {
        next: () => undefined,
        error: ( err: unknown ) => {
          // eslint-disable-next-line no-console
          console.error( `[Error:] [FullscreenMenu] refresh failed (${ reason }): ${ this.errMsg( err ) }\n` );
        },
      } );
  }

  private refresh$(): Observable<void> {
    if ( !this.me ) return of( void 0 );

    const filters: NotificationLoadFilters = {};

    const directItems$ = this.notificationCenter
      .loadDirect$( this.priorityScope, this.page, this.limit, filters, this.me )
      .pipe(
        map( ( view ) => view.items ?? [] ),
        // Enforce direct-to-me rule
        map( ( items ) => items.filter( ( x ) => this.isDirectToMe( x ) ) ),
        catchError( () => of( [] as UiNotification[] ) )
      );

    const overallItems$ = this.canShowOverallTab()
      ? this.notificationCenter.loadOverall$( this.priorityScope, this.page, this.limit, filters, this.me ).pipe(
        map( ( view ) => view.items ?? [] ),
        // Enforce overall rule (role/company) excluding direct-to-me
        map( ( items ) => items.filter( ( x ) => this.isOverallToMe( x ) ) ),
        catchError( () => of( [] as UiNotification[] ) )
      )
      : of( [] as UiNotification[] );

    const countDirect$ = this.notificationCenter.countsDirect$( this.priorityScope, filters ).pipe(
      map( ( c ) => this.safeNum( ( c as unknown as { unread?: unknown; } )?.unread ) ),
      catchError( () => of( 0 ) )
    );

    const countOverall$ = this.canShowOverallTab()
      ? this.notificationCenter.countsOverall$( this.priorityScope, filters ).pipe(
        map( ( c ) => this.safeNum( ( c as unknown as { unread?: unknown; } )?.unread ) ),
        catchError( () => of( 0 ) )
      )
      : of( 0 );

    return forkJoin( {
      directItems: directItems$,
      overallItems: overallItems$,
      directUnread: countDirect$,
      overallUnread: countOverall$,
    } ).pipe(
      tap( ( r ) => {
        const direct = Array.isArray( r.directItems ) ? r.directItems : [];
        const overall = Array.isArray( r.overallItems ) ? r.overallItems : [];

        const all = this.dedupeByInboxId( [ ...direct, ...overall ] );

        this.directItemsState$.next( direct );
        this.overallItemsState$.next( overall );
        this.allItemsState$.next( all );

        const unreadDirect = this.safeNum( r.directUnread );
        const unreadOverall = this.safeNum( r.overallUnread );
        const unreadAll = unreadDirect + unreadOverall;

        this.unreadDirectState$.next( unreadDirect );
        this.unreadOverallState$.next( unreadOverall );
        this.unreadAllState$.next( unreadAll );
      } ),
      map( () => void 0 )
    );
  }

  // =============================================================================
  // Audience rules
  // =============================================================================

  private isDirectToMe( n: UiNotification ): boolean {
    if ( !this.me ) return false;

    const audRaw = ( n?.notification as unknown as { audiences?: unknown; } )?.audiences;
    const audiences = Array.isArray( audRaw ) ? ( audRaw as ReadonlyArray<NotificationAudience> ) : [];
    if ( audiences.length === 0 ) return false;

    for ( const a of audiences ) {
      if ( !a || a.mode !== "User" ) continue;

      const u = this.safeString( ( a as unknown as { username?: unknown; } )?.username );
      const id = this.safeId( ( a as unknown as { userId?: unknown; } )?.userId );

      if ( this.username && u && u === this.username ) return true;
      if ( this.userId && id && id === this.userId ) return true;
    }

    return false;
  }

  private isOverallToMe( n: UiNotification ): boolean {
    if ( !this.me ) return false;

    // Overall excludes only "direct to ME" (not "direct to anyone")
    if ( this.isDirectToMe( n ) ) return false;

    const audRaw = ( n?.notification as unknown as { audiences?: unknown; } )?.audiences;
    const audiences = Array.isArray( audRaw ) ? ( audRaw as ReadonlyArray<NotificationAudience> ) : [];
    if ( audiences.length === 0 ) return false;

    const myRoleKey = this.safeLower( this.role );

    for ( const a of audiences ) {
      if ( !a ) continue;

      if ( a.mode === "Company" ) return true;

      if ( a.mode === "Role" ) {
        // ✅ backend uses roleKey
        const roleKey = this.safeLower( ( a as unknown as { roleKey?: unknown; } )?.roleKey );
        if ( roleKey && myRoleKey && roleKey === myRoleKey ) return true;
      }
    }

    return false;
  }

  // =============================================================================
  // Helpers: IDs / unread / dedupe
  // =============================================================================

  private getInboxId( n: UiNotification ): string {
    return this.safeId( ( n as unknown as { inboxId?: unknown; } )?.inboxId );
  }

  private dedupeByInboxId( items: UiNotification[] ): UiNotification[] {
    const seen = new Set<string>();
    const out: UiNotification[] = [];

    for ( const it of items ?? [] ) {
      const id = this.getInboxId( it );
      if ( !id ) continue;
      if ( seen.has( id ) ) continue;
      seen.add( id );
      out.push( it );
    }

    return out;
  }

  // =============================================================================
  // Collapses + close mechanics
  // =============================================================================

  private toggleSection( selector: string ): void {
    const host = this.el.nativeElement;
    const section = host.querySelector<HTMLElement>( selector );
    if ( !section ) return;

    const body = section.querySelector<HTMLElement>( ".collapse-body" );
    if ( !body ) return;

    const isOpen = section.classList.contains( "open" );
    if ( isOpen ) {
      const start = body.scrollHeight;
      body.style.height = `${ start }px`;
      void body.offsetHeight;
      body.style.height = "0px";
      section.classList.remove( "open" );
    } else {
      body.style.height = "auto";
      const end = body.scrollHeight;
      body.style.height = "0px";
      void body.offsetHeight;
      body.style.height = `${ end }px`;
      section.classList.add( "open" );
    }
  }

  private requestClose(): void {
    this.open = false;
    this.applyBodyScrollLock( false );
    this.closed.emit();
  }

  private applyBodyScrollLock( lock: boolean ): void {
    if ( !this.isBrowser ) return;
    document.body.style.overflow = lock ? "hidden" : "";
  }

  private bindEmptyStreams(): void {
    this.allNotifications$ = of( [] );
    this.directNotifications$ = of( [] );
    this.overallNotifications$ = of( [] );

    this.activeNotifications$ = of( [] );

    this.unreadAll$ = of( 0 );
    this.unreadDirect$ = of( 0 );
    this.unreadOverall$ = of( 0 );
    this.unreadCount$ = of( 0 );
  }

  // =============================================================================
  // Navigation for notification targets
  // =============================================================================

  private async navigateByNotificationTarget( n: UiNotification ): Promise<boolean> {
    try {
      const target = ( n?.notification as unknown as { target?: unknown; } )?.target;
      if ( !target ) return false;

      const ok = await this.notificationRouter.navigateByTarget( target as never );
      return ok === true;
    } catch ( e: unknown ) {
      // eslint-disable-next-line no-console
      console.error( `[Error:] [FullscreenMenu.navigateByNotificationTarget] ${ this.errMsg( e ) }\n` );
      return false;
    }
  }

  // =============================================================================
  // Icons
  // =============================================================================

  private makeIcons(): void {
    const icons: Array<{ name: string; icon: string; }> = [
      { name: "home-icon", icon: "Images/Icons/home.svg" },
      { name: "property-icon", icon: "Images/Icons/property.svg" },
      { name: "users-icon", icon: "Images/Icons/users.svg" },
      { name: "tenant-icon", icon: "Images/Icons/tenant.svg" },
      { name: "teams", icon: "Images/Icons/agents.svg" },
      { name: "report-icon", icon: "Images/Icons/report.svg" },
      { name: "owner-icon", icon: "Images/Icons/owner.svg" },
      { name: "payment-icon", icon: "Images/Icons/payments.svg" },
      { name: "access-icon", icon: "Images/Icons/access-control.svg" },
      { name: "bill-list-icon", icon: "Images/Icons/bill-list.svg" },
      { name: "certification-icon", icon: "Images/Icons/certification.svg" },
      { name: "create-icon", icon: "Images/Icons/create.svg" },
      { name: "documents-icon", icon: "Images/Icons/documents.svg" },
      { name: "notifications-icon", icon: "Images/Icons/notification.svg" },
      { name: "log-icon", icon: "Images/Icons/log.svg" },
      { name: "complaints-icon", icon: "Images/Icons/complaints.svg" },
    ];

    for ( const i of icons ) {
      this.matIconRegistry.addSvgIcon( i.name, this.domSanitizer.bypassSecurityTrustResourceUrl( i.icon ) );
    }
  }

  // =============================================================================
  // Small safe helpers
  // =============================================================================

  private safeString( v: unknown ): string {
    return typeof v === "string" ? v.trim() : "";
  }

  private safeLower( v: unknown ): string {
    return this.safeString( v ).toLowerCase();
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

  private safeNum( v: unknown ): number {
    return typeof v === "number" && Number.isFinite( v ) ? v : 0;
  }

  private errMsg( err: unknown ): string {
    if ( err instanceof Error ) return err.message;
    return String( err ?? "unknown_error" );
  }
}
