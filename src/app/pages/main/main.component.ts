// Path: src/app/pages/main/main.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  AfterViewInit,
} from '@angular/core';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {Subscription} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {WindowsRefService} from '../../services/windowRef/windowRef.service';

// Permissions source
import {
  AuthService,
  DEFAULT_ROLE_ACCESS,
  ACCESS_OPTIONS,
  Role,
} from '../../services/auth/auth.service';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
})
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
  public rentCollected = 185000;
  public rentDelta = 6; // +6% vs last month
  public openMaintenance = 14;
  public mntDelta = 3; // +3 open in last 7d
  public expiringLeases = 8;
  public currency = 'LKR';

  public occupancySeries = [86, 88, 89, 90, 91, 92, 93, 92];
  public rentSeries = [140, 150, 147, 160, 170, 182, 185, 188];
  public maintenanceSeries = [10, 12, 9, 11, 13, 15, 14, 14];
  public leaseSeries = [6, 5, 7, 10, 8, 9, 7, 8];

  public recentActivity = [
    {title: 'Lease LEA-1023 renewed by Manager', time: '2h', level: 'info'},
    {title: 'User password reset (tenant.jay)', time: '6h', level: 'warn'},
    {title: 'Maintenance ticket M-442 escalated', time: '1d', level: 'error'},
  ];
  public notifications = [
    {title: 'Invoice INV-889 paid', read: true},
    {title: 'Lease LEA-1018 expires in 14 days', read: false},
    {title: 'New tenant application received', read: false},
  ];

  constructor (
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe(() => { /* keep for future deep-link handling */});
  }

  /* ---------------------- Lifecycle ---------------------- */

  ngOnInit(): void {
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {this.mode = val;});
    }
    this.computePermissions();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  /* ---------------------- Permission Logic ---------------------- */

  /**
   * Compute permission flags from your centralized DEFAULT_ROLE_ACCESS.
   * This keeps the dashboard content in sync with your rule catalog.
   */
  private computePermissions(): void {
    const user = this.auth.getLoggedUser;
    const role: Role = user?.role ?? 'user';
    const map = DEFAULT_ROLE_ACCESS[role] ?? {};

    // Helper to check an action under a module
    const can = (module: string, action: string) => {
      const actions = map[module] ?? [];
      return actions.includes(action);
    };

    // Visibility flags
    this.canViewProperties = can('Property Management', 'view properties');
    this.canViewLeases = can('Lease Management', 'view leases') || can('Tenant Management', 'view lease');
    this.canViewPayments = can('Payment & Billing', 'view payments');
    this.canViewMaintenance = can('Maintenance Requests', 'view requests');
    this.canViewAudit = can('Report Management', 'view audit logs') || can('Audit Logs', 'view logs');
    this.canViewNotifications = can('Communication & Notification', 'view message logs');

    // Quick actions (show only if permitted)
    this.canCreateLease = can('Tenant Management', 'create lease') || can('Lease Management', 'create lease');
    this.canAssignAgent = can('Property Management', 'assign agent');
    this.canRecordPayment = can('Payment & Billing', 'record manual payment');
    this.canOpenRequests = can('Maintenance Requests', 'view requests');
    this.canGenerateReports = can('Report Management', 'generate financial report') || can('Report Management', 'generate occupancy report');
    this.canTerminateLease = can('Tenant Management', 'terminate lease') || can('Lease Management', 'terminate lease');
  }

  /* ---------------------- Chart Helpers (SVG) ---------------------- */

  /**
   * Generate a simple sparkline path for an array of numbers.
   * Pure math → no DOM reads (SSR-safe). ViewBox = 120x40.
   */
  public sparkPath(series: number[]): string {
    if(!series || series.length === 0) return '';
    const w = 120, h = 40;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = Math.max(1, max - min);
    const step = series.length > 1 ? (w / (series.length - 1)) : w;

    const points = series.map((v, i) => {
      const x = Math.round(i * step);
      // Invert Y so larger values are higher on the chart
      const y = Math.round(h - ((v - min) / range) * (h - 4)) - 2;
      return [x, y] as const;
    });

    return points.reduce((d, [x, y], idx) => d + (idx === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`), '');
  }

  /* ---------------------- Quick Navigation ---------------------- */

  public goCreateLease(): void {
    // Example: navigate to tenant list/create flow (adjust path to your flow)
    this.router.navigate(['/dashboard/tenant/create-lease', 'new']);
  }
  public goAssignAgent(): void {
    this.router.navigate(['/dashboard/properties']); // list with assign UI
  }
  public goRecordPayment(): void {
    this.router.navigate(['/dashboard/tenant/payments-list']);
  }
  public goMaintenance(): void {
    // If you add a top-level maintenance list in the future, change the route here
    this.router.navigate(['/dashboard/tenant/complaints']);
  }
  public goReports(): void {
    // Point to an existing reports page if/when added
    this.router.navigate(['/dashboard/all-notifications']); // placeholder target
  }
  public goLeaseTerminations(): void {
    // You might implement a filtered leases page for upcoming terminations
    this.router.navigate(['/dashboard/tenant']);
  }
}
