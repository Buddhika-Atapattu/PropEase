/*****************************************************************************************
 * ListMainPanelComponent
 * -----------------------------------------------------------------------------
 * Sidebar navigation component with:
 *   - Expand / Collapse behaviour (ExpandableService)
 *   - Dynamic menu list with optional submenus
 *   - CDK Overlay-based fly-out submenu (for collapsed mode)
 *   - URL tracking for active item highlighting
 *   - SSR-safe browser checks
 *   - Custom SVG icon registration for MatIcon
 *
 *  REORGANISED + COMMENTED VERSION — BUDDHIKA ✨
 *****************************************************************************************/

import {
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';

import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  ConnectedPosition,
  OverlayModule,
} from '@angular/cdk/overlay';

import {CommonModule, isPlatformBrowser} from '@angular/common';
import {NavigationEnd, Router} from '@angular/router';
import {filter, Subscription} from 'rxjs';

import {MatButtonModule} from '@angular/material/button';
import {MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {DomSanitizer} from '@angular/platform-browser';

import {User} from '../../services/APIs/apis.service';
import {AuthService} from '../../services/auth/auth.service';
import {ExpandableService} from '../../services/expandable/expandable.service';
import {WindowsRefService} from '../../services/windowRef/windowRef.service';

/* ----------------------------------------------------------------------------
 * Menu interface
 * ---------------------------------------------------------------------------*/
export interface FullscreenMenuLink {
  url: string | null;
  unit: string;                 // full URL (for active state)
  mat_icon: string;
  icon_text: string;
  toolTip?: string;
  sub?: FullscreenMenuLink[] | null;
  commands?: string[] | null;        // router commands after /dashboard
}


/* =============================================================================
 * COMPONENT
 * ===========================================================================*/
@Component({
  selector: 'app-list-main-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    OverlayModule,
  ],
  templateUrl: './list-main-panel.component.html',
  styleUrls: ['./list-main-panel.component.scss'],
})
export class ListMainPanelComponent implements OnInit, OnDestroy {
  /* ---------------------------------------------------------------------------
   * INPUT + OUTPUT
   * ---------------------------------------------------------------------------*/

  /**
   * Whether the side panel is collapsed (icon-only) or expanded (full width).
   * Parent drives this via @Input, but we also keep it in sync with ExpandableService.
   */
  @Input({required: true}) collapsed: boolean = false;

  /**
   * Emit whenever this component decides to change collapsed state
   * (e.g. when clicking the expand/collapse button).
   */
  @Output() collapsedChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  /* ---------------------------------------------------------------------------
   * VIEW CHILDREN
   * ---------------------------------------------------------------------------*/

  /**
   * Reference to the CDK Connected Overlay that renders the submenu fly-out.
   * Used to force re-positioning after fonts/layout stabilize.
   */
  @ViewChild('submenuOverlay')
  private submenuOverlay?: CdkConnectedOverlay;

  /* ---------------------------------------------------------------------------
   * GENERAL STATE
   * ---------------------------------------------------------------------------*/

  /** SSR flag — we must not touch window / document when rendering on server. */
  public isBrowser: boolean;

  /** Current theme mode from WindowsRefService (light / dark). */
  public mode: boolean | null = null;

  /** Subscriptions for clean teardown. */
  private modeSub: Subscription | null = null;
  private expandSub: Subscription | null = null;
  private routerSub: Subscription | null = null;

  /** Routing / active-state tracking. */
  protected currecntURL: string = '';          // last segment under /dashboard/...
  protected activeParentRoute: string = '';    // parent route segment after /dashboard
  protected currentFullURL: string = '';       // full URL after redirects
  private currentURLCommand: string[] = []

  /** Logged user (to be used later for role-based menus if needed). */
  protected loggedUser: User | null = null;

  /** Signal controlling visual expand/collapse state (backed by ExpandableService). */
  public isExpanded = signal<boolean>(true);

  /**
   * Index of the dropdown that is open in expanded mode (normal dropdowns).
   * Used only by toggleDropdown/closeAllDropdowns.
   */
  private currentOpenIndex: number | null = null;

  /* ---------------------------------------------------------------------------
   * CDK Overlay submenu fly-out (collapsed mode)
   * ---------------------------------------------------------------------------*/

  /**
   * Whether the submenu fly-out overlay is currently open.
   * This controls the <ng-template cdkConnectedOverlay>.
   */
  protected submenuOpen: boolean = false;

  /** The submenu items of the currently active parent. */
  protected submenuItems: FullscreenMenuLink[] = [];

  /** CDK overlay origin for the currently active parent button. */
  protected submenuOrigin!: CdkOverlayOrigin;

  /** Route of the active parent item whose submenu is open. */
  protected activeParentPath: string | null = null;

  /**
   * Index of the parent whose submenu arrow should be rotated.
   * When this is null, no `.rotate` class is applied.
   * IMPORTANT RULE: whenever the submenu is not visible, this must be null.
   */
  protected activeSubmenuIndex: number | null = null;

  /**
   * Pre-configured overlay position for the fly-out:
   *   - Anchored to the end of the parent button (right edge)
   *   - Overlay appears to the right-hand side.
   */
  protected readonly overlayPositions: ConnectedPosition[] = [
    {
      originX: 'end',
      originY: 'center',
      overlayX: 'start',
      overlayY: 'center',
      offsetX: 12,
    },
  ];

  /* ---------------------------------------------------------------------------
   * STATIC MENU DATA
   * ---------------------------------------------------------------------------*/

  /**
   * Static menu definitions.
   * In future this can be generated based on user role (Admin/Tenant/etc.).
   */
  public static menuLists: FullscreenMenuLink[] = [
    {
      url: '/dashboard/home',
      unit: 'home',
      commands: ['home'],
      mat_icon: 'home-icon',
      icon_text: 'Home',
      toolTip: 'Home',
    },
    {
      url: '/dashboard/properties/list',
      unit: 'properties',
      commands: ['properties', 'list'],
      mat_icon: 'property-icon',
      icon_text: 'Properties',
      toolTip: 'Properties',
    },
    {
      url: '/dashboard/users/list',
      unit: 'users',
      commands: ['users', 'list'],
      mat_icon: 'users-icon',
      icon_text: 'Users',
      toolTip: 'Users',
    },
    {
      // parent (segment only) for active state
      url: null,
      commands: ['tenant'],
      unit: 'tenant',
      mat_icon: 'tenant-icon',
      icon_text: 'Tenants',
      toolTip: 'Tenants',
      sub: [
        {
          url: '/dashboard/tenant/tenant-home',
          commands: ['tenant', 'tenant-home'],
          unit: 'tenant-home',
          mat_icon: 'home-icon',
          icon_text: 'Home',
          toolTip: 'Tenant Home',
        },
        {
          url: '/dashboard/tenant/complaints',
          unit: 'complaints',
          commands: ['tenant', 'complaints'],
          mat_icon: 'complaints-icon',
          icon_text: 'Complaints',
          toolTip: 'Complaints',
        },
      ],
    },
    {
      url: '/dashboard/agent/panel',
      unit: 'agent',
      commands: ['agent', 'panel'],
      mat_icon: 'agent-icon',
      icon_text: 'Agents',
      toolTip: 'Agent',
    },
    {
      url: '/dashboard/payments',
      unit: 'payments',
      commands: ['payments'],
      mat_icon: 'payment-icon',
      icon_text: 'Payments',
      toolTip: 'Payments',
    },
    {
      url: '/dashboard/report',
      unit: 'report',
      commands: ['report'],
      mat_icon: 'report-icon',
      icon_text: 'Reports',
      toolTip: 'Reports',
    },
    {
      url: '/dashboard/log',
      unit: 'log',
      commands: ['log'],
      mat_icon: 'certification-icon',
      icon_text: 'Log',
      toolTip: 'Log',
    },
  ];


  /* =============================================================================
   * CONSTRUCTOR
   * ===========================================================================*/

  constructor (
    private windowRef: WindowsRefService,
    private expandableService: ExpandableService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private authService: AuthService,
    private elementRef: ElementRef
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.loggedUser = this.authService.getLoggedUser;

    this.bootstrapRouterListener();
    this.registerIcons();
  }

  /**
   * Subscribes to router NavigationEnd events to keep track of:
   *   - full URL (for isSubItemActive)
   *   - active parent route segment under /dashboard
   *   - last segment (used for main active state)
   */
  private bootstrapRouterListener(): void {
    this.routerSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((event: any) => {
        const navEvent = event as NavigationEnd;
        this.currentFullURL = navEvent.urlAfterRedirects;

        const segments: string[] = this.currentFullURL.split('/').filter(Boolean);
        const dashboardIndex: number = segments.indexOf('dashboard');

        this.activeParentRoute =
          dashboardIndex !== -1 && segments.length > dashboardIndex + 1
            ? segments[dashboardIndex + 1]
            : '';

        const commands: string[] = [];
        this.currentURLCommand = [];
        segments.forEach((item) => {
          if(item !== 'dashboard') commands.push(item);
        })
        this.currentURLCommand = [...commands];
        this.currecntURL = segments[segments.length - 1] ?? '';
      });
  }

  /* =============================================================================
   * LIFECYCLE
   * ===========================================================================*/

  public ngOnInit(): void {
    // On server, avoid touching browser-only things.
    if(!this.isBrowser) {
      this.isExpanded.set(!this.collapsed);
      return;
    }

    // Subscribe to theme mode (light/dark).
    this.modeSub = this.windowRef.mode$.subscribe((val: boolean | null) => {
      this.mode = val;
    });

    // Keep local signal + @Input collapsed in sync with global ExpandableService.
    this.expandSub = this.expandableService.isExpanded$.subscribe(
      (expanded: boolean) => {
        this.isExpanded.set(expanded);
        this.syncCollapsedFromExpanded(expanded);
      }
    );
  }

  public ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.expandSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }

  /* =============================================================================
   * GETTERS
   * ===========================================================================*/

  public get menuLists(): FullscreenMenuLink[] {
    return ListMainPanelComponent.menuLists;
  }

  /* =============================================================================
   * ICON REGISTRATION
   * ===========================================================================*/

  /**
   * Registers all SVG icons so that <mat-icon [svgIcon]="..."> can resolve them.
   * All paths are relative to /public for Electron compatibility.
   */
  private registerIcons(): void {
    const icons: {name: string; icon: string}[] = [
      {name: 'home-icon', icon: 'Images/Icons/home.svg'},
      {name: 'property-icon', icon: 'Images/Icons/property.svg'},
      {name: 'users-icon', icon: 'Images/Icons/users.svg'},
      {name: 'tenant-icon', icon: 'Images/Icons/tenant.svg'},
      {name: 'agent-icon', icon: 'Images/Icons/agents.svg'},
      {name: 'report-icon', icon: 'Images/Icons/report.svg'},
      {name: 'owner-icon', icon: 'Images/Icons/owner.svg'},
      {name: 'payment-icon', icon: 'Images/Icons/payments.svg'},
      {name: 'access-icon', icon: 'Images/Icons/access-control.svg'},
      {name: 'bill-list-icon', icon: 'Images/Icons/bill-list.svg'},
      {name: 'certification-icon', icon: 'Images/Icons/certification.svg'},
      {name: 'create-icon', icon: 'Images/Icons/create.svg'},
      {name: 'documents-icon', icon: 'Images/Icons/documents.svg'},
      {name: 'notifications-icon', icon: 'Images/Icons/notification.svg'},
      {name: 'log-icon', icon: 'Images/Icons/log.svg'},
      {name: 'complaints-icon', icon: 'Images/Icons/complaints.svg'},
    ];

    icons.forEach((iconDef: {name: string; icon: string}) => {
      this.matIconRegistry.addSvgIcon(
        iconDef.name,
        this.domSanitizer.bypassSecurityTrustResourceUrl(iconDef.icon)
      );
    });
  }

  /* =============================================================================
   * PANEL EXPAND / COLLAPSE
   * ===========================================================================*/

  /**
   * Triggered when user clicks expand/collapse button.
   * Flips the expanded signal, updates service, and adjusts label visibility.
   */
  protected togglePanel(): void {
    const expanded: boolean = !this.isExpanded();
    this.expandableService.setExpanded(expanded);
    this.syncCollapsedFromExpanded(expanded);
    this.updateLabelVisibility(expanded);
  }

  /**
   * Derive @Input collapsed from expanded state and emit if changed.
   */
  private syncCollapsedFromExpanded(expanded: boolean): void {
    const newCollapsed: boolean = !expanded;
    if(this.collapsed !== newCollapsed) {
      this.collapsed = newCollapsed;
      this.collapsedChange.emit(newCollapsed);
    }
  }

  /**
   * Imperatively show/hide `.delay-expand` labels for a smoother
   * icon-only vs full-width transition, and close menus when collapsing.
   *
   * NOTE: We keep this DOM-level for now because it affects many small spans;
   * later this could be replaced with a structural directive if needed.
   */
  private updateLabelVisibility(expanded: boolean): void {
    if(!this.isBrowser) {
      return;
    }

    const labels: NodeListOf<HTMLElement> =
      this.elementRef.nativeElement.querySelectorAll(
        '.delay-expand'
      ) as NodeListOf<HTMLElement>;

    if(expanded) {
      labels.forEach((el: HTMLElement) => {
        el.style.opacity = '1';
        el.style.display = 'inline-flex';
      });
    } else {
      // When collapsing, always close all dropdowns and any overlay submenu.
      this.closeAllDropdowns();
      this.closeSubmenu();

      labels.forEach((el: HTMLElement) => {
        el.style.opacity = '0';
        el.style.display = 'none';
      });
    }
  }

  /* =============================================================================
   * OVERLAY SUBMENU (collapsed mode)
   * ===========================================================================*/

  /**
   * Click handler for parent menu items that may or may not have submenus.
   * In collapsed mode:
   *   - If the item has sub[], show a fly-out submenu via CDK overlay.
   *   - Clicking the same item again closes the submenu.
   *   - Clicking another parent switches the submenu to that parent.
   * In all cases, `activeSubmenuIndex` reflects the item whose arrow should rotate.
   */
  protected onParentClick(
    link: FullscreenMenuLink,
    origin: CdkOverlayOrigin,
    index: number
  ): void {
    if(link.sub?.length) {
      const isSameItem: boolean = this.activeSubmenuIndex === index;

      // CASE 1: Clicking the same item while submenu is open → close it.
      if(isSameItem && this.submenuOpen) {
        this.closeSubmenu();
        return;
      }

      // CASE 2: Open or switch submenu to this parent.
      this.activeParentPath = link.url;
      this.submenuItems = link.sub;
      this.submenuOrigin = origin;

      this.submenuOpen = true;
      this.activeSubmenuIndex = index; // drives [class.rotate]="activeSubmenuIndex === i"

      // Force CDK to recalc overlay position after view updates
      // (fonts & layout can shift right after load).
      if(this.isBrowser) {
        setTimeout(() => {
          this.submenuOverlay?.overlayRef?.updatePosition();
        }, 0);
      }

      return;
    }

    // No submenu → treat as simple navigation and reset submenu state.
    this.submenuOpen = false;
    this.activeSubmenuIndex = null;
    this.navigateTo(link.commands);
  }

  /**
   * Shared method to fully close the submenu overlay.
   * IMPORTANT: whenever submenu is not visible, activeSubmenuIndex must be null
   * so that the chevron rotation class is removed.
   */
  protected closeSubmenu(): void {
    this.submenuOpen = false;
    this.activeSubmenuIndex = null;
  }

  /* =============================================================================
   * NORMAL DROPDOWNS (expanded mode)
   * ===========================================================================*/

  /**
   * Close any expanded-mode dropdowns (regular nested <ul> based menus).
   * This is independent from the CDK overlay used in collapsed mode.
   */
  private closeAllDropdowns(): void {
    const root: HTMLElement = this.elementRef.nativeElement as HTMLElement;
    const openItems: NodeListOf<Element> = root.querySelectorAll(
      'ul.menu > li.open'
    );

    openItems.forEach((li: Element) => {
      li.classList.remove('open');

      li.querySelectorAll('.dropdown-icon i').forEach((icon: Element) => {
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
      });

      li.querySelectorAll('button').forEach((b: Element) => {
        b.classList.remove('active');
      });
    });

    this.currentOpenIndex = null;
  }

  /* =============================================================================
   * ROUTING
   * ===========================================================================*/

  /**
   * Navigate using the provided segments.
   *
   * parent   →  /dashboard/parent
   * parent+child → /dashboard/parent/child
   * parent+child+subChild → /dashboard/parent/child/subChild
   *
   * If parent is null, fall back to /dashboard.
   */
  protected navigateTo(commands: string[] | null | undefined): void {
    if(!commands || commands.length === 0) {
      this.router.navigate(['/dashboard', 'home']);
      return;
    }

    this.router.navigate(['dashboard', ...commands]);
    return;
  }

  /* =============================================================================
   * CHECKING THE ROUTING PATH
   * ===========================================================================*/

  /**
   * Navigate using the provided segments.
   * This will check the path of the route then return boolean value
   */
  protected checkRoutingPath(item: FullscreenMenuLink): boolean {
    if(!item) return false;
    if(this.currentURLCommand.includes(item.unit)) return true;
    return false
  }


}
