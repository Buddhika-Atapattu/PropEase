// Path: src/app/pages/main/main.component.ts

import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { WindowsRefService } from '../../services/windowRef/windowRef.service';

// Permissions source
import { AuthService } from '../../services/auth/auth.service';
import { Role } from '../../services/auth/user.contract';
import {
  AccessModuleKey,
  AccessModuleOption,
} from '../../source/access-map.source';

@Component( {
  selector: 'app-main',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './main.component.html',
  styleUrls: [ './main.component.scss' ],
} )
export class MainComponent implements OnInit, AfterViewInit, OnDestroy {
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  // ---- Permission flags (computed from DEFAULT_ROLE_ACCESS) ----
  public canViewProperties = false;
  public canViewLeases = false;
  public canViewPayments = false;
  public canViewMaintenance = false;
  public canViewAudit = false;
  public canViewNotifications = false;

  // Quick action availability
  public canCreateLease = false;
  public canAssignAgent = false;
  public canRecordPayment = false;
  public canOpenRequests = false;
  public canGenerateReports = false;
  public canTerminateLease = false;

  // ---- Demo data (replace with real API calls) ----
  public occupancyPct = 92;
  public occDelta = 2; // +2% vs last month
  public rentCollected = 185_000;
  public rentDelta = 6; // +6% vs last month
  public openMaintenance = 14;
  public mntDelta = 3; // +3 open in last 7d
  public expiringLeases = 8;
  public currency = 'LKR';

  public occupancySeries = [ 86, 88, 89, 90, 91, 92, 93, 92 ];
  public rentSeries = [ 140, 150, 147, 160, 170, 182, 185, 188 ];
  public maintenanceSeries = [ 10, 12, 9, 11, 13, 15, 14, 14 ];
  public leaseSeries = [ 6, 5, 7, 10, 8, 9, 7, 8 ];

  public recentActivity = [
    { title: 'Lease LEA-1023 renewed by Manager', time: '2h', level: 'info' },
    { title: 'User password reset (tenant.jay)', time: '6h', level: 'warn' },
    { title: 'Maintenance ticket M-442 escalated', time: '1d', level: 'error' },
  ];

  public notifications = [
    { title: 'Invoice INV-889 paid', read: true },
    { title: 'Lease LEA-1018 expires in 14 days', read: false },
    { title: 'New tenant application received', read: false },
  ];

  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly auth: AuthService,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    // Reserved for future deep-link / query param handling
    this.route.url.subscribe( () => {
      // no-op for now
    } );
  }

  /* ---------------------- Lifecycle ---------------------- */

  ngOnInit(): void {
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }

    this.computePermissions();
  }

  ngAfterViewInit(): void {
    // Reserved for future DOM-dependent initialisation
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  /* ---------------------- Permission Logic ---------------------- */

  /**
   * Compute permission flags from the centralized access catalog.
   *
   * NOTE:
   *  - Right now we drive everything off MODULE visibility.
   *    i.e. "If user can see module X → show card / quick action".
   *  - When your per-action AccessActionKey set is final, you can
   *    tighten this to use getDefaultAccessByRole(role) and check
   *    precise action flags.
   */
  private computePermissions(): void {
    const user = this.auth.getLoggedUser;
    const role: Role = user?.role ?? 'user';

    // This returns an array of AccessModuleOption:
    //   [{ module: AccessModuleKey, actions: AccessActionOption[] }, ...]
    const visibleModules: ReadonlyArray<AccessModuleOption> =
      this.auth.filterDefaultAccessBaseRole( role );

    const hasModule = ( moduleKey: AccessModuleKey ): boolean =>
      visibleModules.some( ( m ) => m.module === moduleKey );

    // ── Visibility flags (module-level) ────────────────────────────────
    this.canViewProperties = hasModule( 'PropertyManagement' );
    this.canViewLeases = hasModule( 'TenantManagement' );        // and later: 'LeaseManagement'
    this.canViewPayments = hasModule( 'PropertyManagement' );      // TEMP until Payment module is fully wired
    this.canViewMaintenance = hasModule( 'TenantManagement' );        // TEMP until Maintenance module is added
    this.canViewAudit = hasModule( 'AuditLogs' );
    this.canViewNotifications = hasModule( 'NotificationCenter' );

    // ── Quick actions ─────────────────────────────────────────────────
    // For now: if user has access to the relevant module, we expose the action.
    // When your AccessActionKey set is final, you can swap to proper action checks.
    this.canCreateLease = hasModule( 'TenantManagement' );
    this.canAssignAgent = hasModule( 'PropertyManagement' );
    this.canRecordPayment = hasModule( 'PropertyManagement' );      // TEMP → later: PaymentAndBilling
    this.canOpenRequests = hasModule( 'TenantManagement' );        // TEMP → later: MaintenanceRequests
    this.canGenerateReports = hasModule( 'AuditLogs' );
    this.canTerminateLease = hasModule( 'TenantManagement' );        // TEMP → later: LeaseManagement
  }

  /* ---------------------- Chart Helpers (SVG) ---------------------- */

  /**
   * Generate a simple sparkline path for an array of numbers.
   * Pure math → no DOM reads (SSR-safe). ViewBox = 120x40.
   */
  public sparkPath( series: number[] ): string {
    if ( !series || series.length === 0 ) {
      return '';
    }

    const width = 120;
    const height = 40;

    const min = Math.min( ...series );
    const max = Math.max( ...series );
    const range = Math.max( 1, max - min );

    const step = series.length > 1 ? width / ( series.length - 1 ) : width;

    const points = series.map( ( value, index ) => {
      const x = Math.round( index * step );
      // Invert Y so larger values are higher on the chart
      const normalized = ( value - min ) / range;
      const y = Math.round( height - normalized * ( height - 4 ) ) - 2;
      return [ x, y ] as const;
    } );

    return points.reduce(
      ( d, [ x, y ], idx ) => d + ( idx === 0 ? `M ${ x } ${ y }` : ` L ${ x } ${ y }` ),
      '',
    );
  }

  /* ---------------------- Quick Navigation ---------------------- */

  public goCreateLease(): void {
    // Example: navigate to tenant list/create flow (adjust path to your flow)
    this.router.navigate( [ '/dashboard/tenant/create-lease', 'new' ] );
  }

  public goAssignAgent(): void {
    this.router.navigate( [ '/dashboard/properties' ] ); // list with assign UI
  }

  public goRecordPayment(): void {
    this.router.navigate( [ '/dashboard/tenant/payments-list' ] );
  }

  public goMaintenance(): void {
    // If you add a top-level maintenance list in the future, change the route here
    this.router.navigate( [ '/dashboard/tenant/complaints' ] );
  }

  public goReports(): void {
    // Point to an existing reports page if/when added
    this.router.navigate( [ '/dashboard/notifications/all-notifications' ] );
  }

  public goLeaseTerminations(): void {
    // You might implement a filtered leases page for upcoming terminations
    this.router.navigate( [ '/dashboard/tenant' ] );
  }
}
