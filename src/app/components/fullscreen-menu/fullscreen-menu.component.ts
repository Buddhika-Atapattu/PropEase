// Path: src/app/components/fullscreen-menu/fullscreen-menu.component.ts
// =============================================================================
// FullscreenMenuComponent (NotificationCenterService — New Contracts Compatible)
// -----------------------------------------------------------------------------
// Key fixes for the new notification system:
// 1) ✅ Use NotificationCenterService consistently (remove old notificationService refs)
// 2) ✅ Replace legacy `audience.usernames/roles` logic with NEW `audiences[]` model
// 3) ✅ Avoid browser `Notification` name collision → use UiNotification alias
// 4) ✅ SSR-safe: guard ALL window/document usage with isBrowser
// 5) ✅ Standalone imports fixed: MatMenuModule added for MatMenuTrigger
// 6) ✅ Robust ID handling: supports `notificationId` (new) + `_id` (legacy)
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

import { fromEvent, Observable, Subject, timer } from "rxjs";
import {
  delayWhen,
  distinctUntilChanged,
  map,
  retryWhen,
  scan,
  startWith,
  switchMap,
  takeUntil,
} from "rxjs/operators";

import { APIsService, User } from "../../services/APIs/apis.service";
import { AuthService } from "../../services/auth/auth.service";
import type { Role } from "../../services/auth/user.contract";
import { NotificationCenterService } from "../../services/notifications/notification-center.service";
import { NotificationRouteMapService } from '../../services/notifications/notification-route-map.service';
import { type FullscreenMenuLink } from "../list-main-panel/list-main-panel.component";
import { UserInfoPanelComponent } from "../user-info-panel/user-info-panel.component";

// NOTE:
// We intentionally DO NOT use the global browser `Notification` type name.
// Import your canonical FE mirror type here.
// If your file path differs, adjust it once and keep it consistent everywhere.
import type {
  NotificationAudience,
  NotificationInboxItemDto
} from "../../types/notifications/notification.types";

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

  /** Menu items (same shape you already use) */
  @Input( { required: true } ) links: FullscreenMenuLink[] = [];

  /** Current router url fragment to highlight active route */
  @Input() currentUrl = "";

  /** Emits when the overlay requests close */
  @Output() closed = new EventEmitter<void>();

  /** Emits (parent, child, grandchild) path triplet for navigation */
  @Output() navigate = new EventEmitter<{ p: string | null; c: string | null; g: string | null; }>();

  @ViewChild( "menuTrigger", { static: false } ) menuTrigger?: MatMenuTrigger;

  private readonly isBrowser: boolean;
  private readonly destroy$ = new Subject<void>();
  private readonly unlisteners: Array<() => void> = [];

  /** Which body to show */
  protected activeView: "menu" | "notifications" = "menu";

  // Notification streams (NEW system)
  protected notifications$!: Observable<ReadonlyArray<UiNotification>>;
  protected unreadCount$!: Observable<number>;
  protected connected$!: Observable<boolean>;

  protected activeTab: "direct" | "overall" = "direct";
  protected directNotifications$!: Observable<ReadonlyArray<UiNotification>>;
  protected overallNotifications$!: Observable<ReadonlyArray<UiNotification>>;

  protected isLoggedIn = false;
  private username = "";
  private userId = "";
  private role: Role = "user";

  protected menuOpen = false;

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
    private readonly apiService: APIsService,
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
  }

  // === Life-cycle ===========================================================
  public ngOnInit(): void {
    this.makeIcons();

    // Auth snapshot (safe defaults)
    this.isLoggedIn = this.authService.isUserLoggedIn;
    const me = this.authService.getLoggedUser;
    this.username = String( me?.username ?? "" ).trim();
    this.userId = String( ( me as unknown as { userId?: string; } )?.userId ?? "" ).trim(); // if your UserSafeDto uses "userId"
    this.role = ( me?.role ?? "user" ) as Role;

    // ─────────────────────────────────────────────────────────────────────
    // Streams from NotificationCenterService (NEW)
    // Assumed API (matches the style you used elsewhere):
    //   - notifications$(): Observable<UiNotification[]>
    //   - unreadCount$(): Observable<number>
    //   - connected$: Observable<boolean>
    //   - load({limit}): Promise<void>
    //   - load$({limit}): Observable<void> (optional helper)
    //   - onNew(playSound): Observable<UiNotification>
    //   - markRead(notificationId): Promise<void>
    //   - markAllRead(): Promise<void>
    // ─────────────────────────────────────────────────────────────────────
    this.notifications$ = this.notificationCenter.notifications$();
    this.unreadCount$ = this.notificationCenter.unreadCount$();
    this.connected$ = this.notificationCenter.onConnected$();

    // Split predicates (NEW audiences[] model)
    const isDirect = ( n: UiNotification ): boolean => this.isTargetingMe( n );
    const isOverall = ( n: UiNotification ): boolean => this.isAdminOverall( n );

    this.directNotifications$ = this.notifications$.pipe( map( ( list ) => list.filter( isDirect ) ) );
    this.overallNotifications$ = this.notifications$.pipe( map( ( list ) => list.filter( isOverall ) ) );

    // Initial fetch
    this.notificationCenter
      .load( { limit: 30 } )
      .catch( ( error: unknown ) => console.error( "[Error:] [FullscreenMenu] initial load failed: ", error, "\n" ) );

    // Optional real-time stream
    this.notificationCenter
      .onNew( true )
      .pipe( takeUntil( this.destroy$ ) )
      .subscribe( {
        next: ( n: UiNotification ) => {
          console.log( "[Info:] [FullscreenMenu] new notification received: ", this.getNotifId( n ), "\n" );
        },
        error: ( err: unknown ) => {
          console.error( "[Error:] [FullscreenMenu] realtime notifications error: ", err, "\n" );
        },
      } );

    // Visibility-aware polling with backoff (SSR-safe)
    if ( this.isBrowser ) {
      const visible$ = fromEvent( document, "visibilitychange" ).pipe(
        map( () => document.visibilityState === "visible" ),
        startWith( document.visibilityState === "visible" ),
        distinctUntilChanged(),
      );

      visible$
        .pipe(
          switchMap( ( isVisible ) => {
            const intervalMs = isVisible ? 30_000 : 180_000; // 30s vs 3min
            return timer( intervalMs, intervalMs ).pipe( map( () => undefined ) );
          } ),
          switchMap( () => {
            const load$Maybe = this.notificationCenter.load$?.( { limit: 30 } );
            if ( load$Maybe ) {
              return load$Maybe;
            }

            // Promise → Observable adapter (typed, no `any`)
            return new Observable<void>( ( sub ) => {
              this.notificationCenter
                .load( { limit: 30 } )
                .then( () => {
                  sub.next();
                  sub.complete();
                } )
                .catch( ( e: unknown ) => sub.error( e ) );
            } );
          } ),
          retryWhen( ( errors ) =>
            errors.pipe(
              scan( ( acc: number ) => Math.min( acc ? acc * 3 : 5_000, 300_000 ), 0 ),
              delayWhen( ( ms: number ) => timer( ms ) ),
            ),
          ),
          takeUntil( this.destroy$ ),
        )
        .subscribe();
    }
  }

  public ngAfterViewInit(): void {
    this.applyBodyScrollLock( this.open );

    // Close on ESC (browser only)
    if ( this.isBrowser ) {
      const offKey = this.r2.listen( "document", "keydown", ( e: KeyboardEvent ) => {
        if ( e.key === "Escape" && this.open ) {
          this.requestClose();
        }
      } );
      this.unlisteners.push( offKey );
    }
  }

  public ngOnChanges( changes: SimpleChanges ): void {
    if ( changes[ "open" ] && !changes[ "open" ].firstChange ) {
      this.applyBodyScrollLock( this.open );
    }
  }

  public ngOnDestroy(): void {
    this.unlisteners.forEach( ( u ) => u() );
    this.applyBodyScrollLock( false );

    this.destroy$.next();
    this.destroy$.complete();
  }

  // === View toggles =========================================================
  protected showMenu(): void {
    this.activeView = "menu";
  }

  protected showNotifications(): void {
    this.activeView = "notifications";
  }

  // === Notification actions =================================================
  protected async markOneRead( notification: UiNotification, ev?: MouseEvent ): Promise<void> {
    ev?.stopPropagation();
    ev?.preventDefault();

    try {
      // 1) Navigate (NEW system: prefer target.route if you have it)
      // If your notification DTO contains `target.route` / `target.params`,
      // you can wire it here in a single place.
      const didNavigate = await this.navigateByNotificationTarget( notification );

      // 2) Mark as read
      const id = this.getNotifId( notification );
      if ( id ) {
        await this.notificationCenter.markRead$( id );
      }

      // 3) Close overlay after action
      if ( didNavigate ) {
        this.requestClose();
      }
    } catch ( e: unknown ) {
      console.error( "[Error:] [FullscreenMenu] markOneRead failed: ", e, "\n" );
    }
  }

  protected async markAllAsRead(): Promise<void> {
    try {
      await this.notificationCenter.markAllRead$();
    } catch ( e: unknown ) {
      console.error( "[Error:] [FullscreenMenu] markAllAsRead failed: ", e, "\n" );
    }
  }

  protected iconFor( n: UiNotification ): string {
    switch ( n.notification.severity ) {
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

  protected viewAllNotifications(): void {
    if ( !this.authService.getLoggedUser ) {
      return;
    }
    this.requestClose();
    this.router.navigate( [ "/dashboard/notifications/all-notifications" ] );
  }

  protected trackById = ( _: number, item: UiNotification ): string => this.getNotifId( item ) ?? String( _ );

  // === Menu helpers =========================================================
  protected activeItem( parent: FullscreenMenuLink | null, child: FullscreenMenuLink | null ): boolean {
    try {
      if ( !parent?.url ) {
        return false;
      }

      // SSR-safe: use Router url if possible; fallback to input currentUrl
      const rawPath = this.isBrowser
        ? ( this.router.url || this.currentUrl || "/" )
        : ( this.currentUrl || "/" );

      const cleanPath = rawPath.split( "?" )[ 0 ].split( "#" )[ 0 ];
      const segs = cleanPath.split( "/" ).filter( Boolean ).map( ( s ) => s.toLowerCase() );

      const parentSeg = this.lastSeg( parent.url );
      const childSeg = child?.url ? this.lastSeg( child.url ) : null;

      const matchParent = !!parentSeg && segs.includes( parentSeg );
      const matchChild = !!childSeg && segs.includes( childSeg );

      return matchParent || matchChild;
    } catch ( err: unknown ) {
      console.error( "[Error:] [FullscreenMenu.activeItem] failed: ", err, "\n" );
      return false;
    }
  }

  private lastSeg( url: string ): string {
    return url.split( "/" ).filter( Boolean ).pop()!.toLowerCase();
  }

  // === Public API (template) ================================================
  public onBackdrop(): void {
    this.requestClose();
  }

  public go( item: FullscreenMenuLink ): void {
    if ( !item.commands ) {
      return;
    }
    this.router.navigate( [ "dashboard", ...item.commands ] );
    this.requestClose();
  }

  public toggleTop( index: number ): void {
    this.toggleSection( `.lvl-1[data-idx="${ index }"]` );
  }

  public toggleSub( i: number, j: number ): void {
    this.toggleSection( `.lvl-2[data-idx="${ i }-${ j }"]` );
  }

  public trackTop = ( _: number, it: FullscreenMenuLink ): string => it.url ?? it.icon_text;
  public trackSub = ( _: number, it: FullscreenMenuLink ): string => it.url ?? it.icon_text;
  public trackChild = ( _: number, it: FullscreenMenuLink ): string => it.url ?? it.icon_text;

  public get firstName(): string {
    const raw = ( this.profile?.name ?? "" ).trim();
    if ( !raw ) {
      return "User";
    }
    const first = raw.split( /\s+/ )[ 0 ];
    return first || "User";
  }

  protected async viewUserProfile(): Promise<void> {
    try {
      const user: User | null = this.authService.getLoggedUser;
      if ( !user?.username ) {
        throw new Error( "Invalid login / username!" );
      }

      const res = await this.apiService.generateToken( user.username );
      if ( !res.success || res.status !== "success" || !res.data ) {
        throw new Error( "Failed to fetch data!" );
      }

      const token: string | null = this.apiService.extractTokenFromMsg( res );
      if ( !token ) {
        throw new Error( "Token missing from response!" );
      }

      await this.router.navigate( [ "/dashboard/users/user-profile", token ] );
    } catch ( error: unknown ) {
      console.error( "[Error:] [FullscreenMenu.viewUserProfile] ", error, "\n" );
    } finally {
      this.requestClose();
    }
  }

  // === Private helpers (class-based) ========================================
  private toggleSection( selector: string ): void {
    const host = this.el.nativeElement;
    const section = host.querySelector<HTMLElement>( selector );
    if ( !section ) {
      return;
    }

    const body = section.querySelector<HTMLElement>( ".collapse-body" );
    if ( !body ) {
      return;
    }

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

  protected signalToClose(): void {
    this.menuOpen = false;
    this.requestClose();
  }

  private applyBodyScrollLock( lock: boolean ): void {
    if ( !this.isBrowser ) {
      return;
    }
    const body = document.body;
    body.style.overflow = lock ? "hidden" : "";
  }

  protected isActive( candidate: string | null ): boolean {
    if ( !candidate ) {
      return false;
    }
    return this.currentUrl.includes( candidate );
  }

  private closeMenu(): void {
    this.menuTrigger?.closeMenu();
  }

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

    icons.forEach( ( i ) => {
      this.matIconRegistry.addSvgIcon(
        i.name,
        this.domSanitizer.bypassSecurityTrustResourceUrl( i.icon ),
      );
    } );
  }

  // =============================================================================
  // NEW NOTIFICATION MODEL HELPERS
  // =============================================================================

  /**
   * Extract a stable notification ID.
   * - NEW contracts commonly use `notificationId`
   * - LEGACY code used `_id`
   */
  private getNotifId( n: UiNotification ): string | null {
    const asAny = n as unknown as { notificationId?: string; _id?: string; };
    const id = String( asAny.notificationId ?? asAny._id ?? "" ).trim();
    return id ? id : null;
  }

  /**
   * Does this notification target the currently logged user?
   * NEW model: `audiences: NotificationAudience[]`
   */
  private isTargetingMe( n: UiNotification ): boolean {
    if ( !this.isLoggedIn ) {
      return false;
    }

    const audiences = ( n.notification.audiences ?? [] ) as ReadonlyArray<NotificationAudience>;
    if ( !audiences.length ) {
      return false;
    }

    const myUsername = this.username;
    const myUserId = this.userId;
    const myRole = this.role;

    return audiences.some( ( a ) => {
      // Your canonical union:
      // mode: "Company" | "Role" | "Team" | "User"
      switch ( a.mode ) {
        case "User": {
          const au = a as unknown as { userId?: string; username?: string; };
          const byId = myUserId ? String( au.userId ?? "" ) === myUserId : false;
          const byName = myUsername ? String( au.username ?? "" ) === myUsername : false;
          return byId || byName;
        }
        case "Role": {
          const ar = a as unknown as { role?: string; };
          return !!myRole && String( ar.role ?? "" ) === myRole;
        }
        case "Company": {
          // Company-wide broadcast targets everyone (including me)
          return true;
        }
        case "Team": {
          // If you later add teamCodes in AuthUser, you can match here.
          // For now: treat team audience as direct only if you know team membership in FE.
          return false;
        }
        default:
          return false;
      }
    } );
  }

  /**
   * "Overall" tab behavior:
   * - Only admin sees it
   * - Shows notifications that DO NOT target me directly
   *   (still useful for admin monitoring)
   */
  private isAdminOverall( n: UiNotification ): boolean {
    if ( this.role !== "admin" ) {
      return false;
    }
    return !this.isTargetingMe( n );
  }

  /**
   * Navigation strategy for the new system.
   * Preferred: notification.target contains an action/route.
   * If your NotificationCoreDto has `target: { actionKey, params }`,
   * this is where you translate it into a router navigation.
   *
   * Return true if navigation happened, false otherwise.
   */
  private async navigateByNotificationTarget( n: UiNotification ): Promise<boolean> {
    try {
      const target = n.notification.target;
      if ( !target ) {
        return false;
      }

      // Minimal safe support for a route-style target:
      // target: { route: string, params?: any }
      const asRoute = target;
      const route = String( asRoute.route ?? "" ).trim();

      if ( route ) {
        // If params exist, you can append them as segments or queryParams based on your convention.
        await this.router.navigate( [ route ] );
        return true;
      }

      // If you use actionKey/params (NotificationActionKey),
      // implement a map here:
      // target: { actionKey: "lease:view", params: { leaseId: "..." } }
      // and translate to router paths.

      const router = await this.notificationRouter.resolveTargetToUrlTree( target );

      return this.router.navigate( [ router ] ) ?? false;
    } catch ( e: unknown ) {
      console.error( "[Error:] [FullscreenMenu.navigateByNotificationTarget] ", e, "\n" );
      return false;
    }
  }
}
