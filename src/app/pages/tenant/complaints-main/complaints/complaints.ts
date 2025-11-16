// Path: src/app/pages/tenant/complaints-main/home/complaints.home.ts
import {
  Component, OnInit, OnDestroy, Inject, PLATFORM_ID, AfterViewInit, ViewChild
} from '@angular/core';
import {CommonModule, isPlatformBrowser} from '@angular/common';
import {Subscription} from 'rxjs';
import {Router} from '@angular/router';

import {WindowsRefService} from '../../../../services/windowRef/windowRef.service';
import {AuthService} from '../../../../services/auth/auth.service';
import {TenantService, ComplaintClient} from '../../../../services/tenant/tenant.service';
import {APIsService, User} from '../../../../services/APIs/apis.service';

import {NotificationDialogComponent} from '../../../../components/dialogs/notification/notification.component';
import {ProgressBarComponent} from '../../../../components/dialogs/progress-bar/progress-bar.component';
import {
  TableButtonActionConfig,
  TableButton,
  TableColumn,
  CustomTableComponent
} from '../../../../components/shared/custom-table/custom-table.component';
import {GoogleChartsModule} from 'angular-google-charts';
import {ChartService, ChartBuild, PieEntry, SeriesEntry} from '../../../../services/chartService/chart-service';
import {SkeletonLoaderComponent} from '../../../../components/shared/skeleton-loader/skeleton-loader.component';


interface ComplaintTableRow {
  id: string;
  propertyid: string;
  tenantname: string;
  status: string;
  category: string;
}

@Component({
  selector: 'app-complaints',
  standalone: true,
  imports: [
    CommonModule,
    NotificationDialogComponent,
    ProgressBarComponent,
    CustomTableComponent,
    GoogleChartsModule,
    SkeletonLoaderComponent,
  ],
  templateUrl: './complaints.html',
  styleUrls: ['./complaints.scss']
})
export class ComplaintsHome implements OnInit, AfterViewInit, OnDestroy {
  // ────────────────────────────────────────────────────────────────────────────
  // References to child dialogs
  // ────────────────────────────────────────────────────────────────────────────
  @ViewChild(NotificationDialogComponent) notification!: NotificationDialogComponent;
  @ViewChild(ProgressBarComponent) progressBar!: ProgressBarComponent;

  // ────────────────────────────────────────────────────────────────────────────
  // Environment / auth
  // ────────────────────────────────────────────────────────────────────────────
  protected mode: boolean | null = null;                      // current theme mode (light/dark)
  protected isBrowser: boolean;                                // SSR/Electron guard
  private modeSub: Subscription | null = null;               // subscription for theme changes
  protected loggedUser!: User | null;                // current logged user (role checks)
  protected isLoading = false;                                 // page-level loading gate
  private tenantToken = '';                                  // token used for "create complaint" navigation

  // Role gate: admin-like users can view "All complaints"
  get isAdminLike(): boolean {
    const roles = ['admin', 'operator', 'manager'];
    return roles.includes(this.loggedUser?.role?.toLowerCase() ?? '');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Table config (shared)
  // ────────────────────────────────────────────────────────────────────────────
  protected complaintTableColumns: TableColumn[] = [
    {key: 'id', label: 'Complaint ID'},
    {key: 'propertyid', label: 'Property ID'},
    {key: 'tenantname', label: 'Tenant Name'},
    {key: 'status', label: 'Status'},
    {key: 'category', label: 'Category'},
    {key: 'actions', label: 'View'},
    {key: 'operation', label: 'Edit'},
  ];
  protected actionButtons: TableButton[] = [{'action': 'view', 'icon': 'visibility'}, {'action': 'edit', 'icon': 'edit'}];

  // ────────────────────────────────────────────────────────────────────────────
  // ADMIN STATE (all via getters/setters; never use _private in operations)
  // ────────────────────────────────────────────────────────────────────────────
  protected adminTableType = 'All Complaints';

  private _adminAllData: ComplaintTableRow[] = [];     // full dataset
  private _adminFilteredData: ComplaintTableRow[] = []; // filtered dataset
  private _adminPageData: ComplaintTableRow[] = [];     // current page rows

  private _adminSearch = '';
  private _adminPageSize = 10;
  private _adminPageIndex = 0;
  protected adminPageSizeOptions: number[] = [5, 10, 25, 50, 100];
  private _adminIsReloading = false;

  // Admin: All data
  get adminAllData(): ComplaintTableRow[] {return this._adminAllData;}
  set adminAllData(v: ComplaintTableRow[]) {
    this._adminAllData = Array.isArray(v) ? v : [];
    // Keep the pipeline consistent when source changes
    this.adminSearch = this.adminSearch; // reapply current search
  }

  // Admin: Filtered data (derived)
  get adminFilteredData(): ComplaintTableRow[] {return this._adminFilteredData;}
  set adminFilteredData(v: ComplaintTableRow[]) {
    this._adminFilteredData = Array.isArray(v) ? v : [];
    this._rebuildAdminPageSizeOptions();
    this._applyAdminPage(0);
  }

  // Admin: Page data (final rows for table)
  get adminTableData(): ComplaintTableRow[] {return this._adminPageData;}
  set adminTableData(v: ComplaintTableRow[]) {
    this._adminPageData = Array.isArray(v) ? v : [];
  }

  // Admin: total count (derived from filtered)
  get adminTotalDataCount(): number {return this.adminFilteredData.length;}
  set adminTotalDataCount(_: number) {/* derived – no-op */}

  // Admin: search term
  get adminSearch(): string {return this._adminSearch;}
  set adminSearch(v: string) {
    this._adminSearch = (v ?? '').trim();
    this._filterAdminRows();
  }

  // Admin: pagination size
  get adminPageSize(): number {return this._adminPageSize;}
  set adminPageSize(v: number) {
    this._adminPageSize = Math.max(1, (v | 0));
    this._applyAdminPage(0);
  }

  // Admin: pagination index
  get adminPageIndex(): number {return this._adminPageIndex;}
  set adminPageIndex(v: number) {
    this._applyAdminPage(v | 0);
  }

  get adminIsReloading(): boolean {
    return this._adminIsReloading;
  }
  set adminIsReloading(value: boolean) {
    this._adminIsReloading = value;
  }


  // ────────────────────────────────────────────────────────────────────────────
  // TENANT STATE (all via getters/setters; never use _private in operations)
  // ────────────────────────────────────────────────────────────────────────────
  protected tenantTableType = 'My Complaints';

  private _tenantAllData: ComplaintTableRow[] = [];
  private _tenantFilteredData: ComplaintTableRow[] = [];
  private _tenantPageData: ComplaintTableRow[] = [];

  private _tenantSearch = '';
  private _tenantPageSize = 10;
  private _tenantPageIndex = 0;

  protected tenantPageCount = 0;
  protected tenantPageSizeOptions: number[] = [5, 10, 25, 50, 100];
  protected tenantIsReloading = false;

  // Tenant: All data
  get tenantAllData(): ComplaintTableRow[] {return this._tenantAllData;}
  set tenantAllData(v: ComplaintTableRow[]) {
    this._tenantAllData = Array.isArray(v) ? v : [];
    this.tenantSearch = this.tenantSearch; // reapply current search
  }

  // Tenant: Filtered data
  get tenantFilteredData(): ComplaintTableRow[] {return this._tenantFilteredData;}
  set tenantFilteredData(v: ComplaintTableRow[]) {
    this._tenantFilteredData = Array.isArray(v) ? v : [];
    this._rebuildTenantPageSizeOptions();
    this._applyTenantPage(0);
  }

  // Tenant: Page data
  get tenantTableData(): ComplaintTableRow[] {return this._tenantPageData;}
  set tenantTableData(v: ComplaintTableRow[]) {
    this._tenantPageData = Array.isArray(v) ? v : [];
  }

  // Tenant: total count
  get tenantTotalDataCount(): number {return this.tenantFilteredData.length;}
  set tenantTotalDataCount(_: number) {/* derived – no-op */}

  // Tenant: search term
  get tenantSearch(): string {return this._tenantSearch;}
  set tenantSearch(v: string) {
    this._tenantSearch = (v ?? '').trim();
    this._filterTenantRows();
  }

  // Tenant: pagination size
  get tenantPageSize(): number {return this._tenantPageSize;}
  set tenantPageSize(v: number) {
    this._tenantPageSize = Math.max(1, (v | 0));
    this._applyTenantPage(0);
  }

  // Tenant: pagination index
  get tenantPageIndex(): number {return this._tenantPageIndex;}
  set tenantPageIndex(v: number) {
    this._applyTenantPage(v | 0);
  }



  // ────────────────────────────────────────────────────────────────────────────
  // Chart variables
  // ────────────────────────────────────────────────────────────────────────────

  /** Admin status pie chart (bind in template) */
  protected adminStatusPieChart!: ChartBuild;
  /** Canonical status order you care about (lowercase) */
  private static readonly STATUS_ORDER: ReadonlyArray<string> = [
    'new',
    'triaged',
    'in_progress',
    'awaiting_tenant',
    'resolved',
    'closed',
    'reopened',
    'cancelled',
  ];

  /** Optional: prettier labels for the chart legend (maps from lowercase key) */
  private static readonly STATUS_LABELS: Record<string, string> = {
    new: 'New',
    triaged: 'Triaged',
    in_progress: 'In Progress',
    awaiting_tenant: 'Awaiting Tenant',
    resolved: 'Resolved',
    closed: 'Closed',
    reopened: 'Reopened',
    cancelled: 'Cancelled',
  };


  protected adminCategoryBarChart!: ChartBuild;

  /** Canonical category order (normalized: lowercase, single spaces) */
  private static readonly CATEGORY_ORDER: ReadonlyArray<string> = [
    'plumbing',
    'electrical',
    'hvac',
    'appliances',
    'structural',
    'doors windows',
    'security safety',
    'water leak damp',
    'sanitation',
    'internet telecom',
    'elevator lift',
    'pests vermin',
    'landscaping garden',
    'parking garage',
    'common areas',
    'access keys locks',
    'cleaning housekeeping',
    'waste management',
    'painting decor',
    'gas supply',
    'noise nuisance',
    'renovation work',
    'other',
  ] as const;

  /** Pretty labels for legend/axis (maps from normalized key above) */
  private static readonly CATEGORY_LABELS: Record<string, string> = {
    'plumbing': 'Plumbing',
    'electrical': 'Electrical',
    'hvac': 'HVAC',
    'appliances': 'Appliances',
    'structural': 'Structural',
    'doors windows': 'Doors & Windows',
    'security safety': 'Security & Safety',
    'water leak damp': 'Water Leak / Damp',
    'sanitation': 'Sanitation',
    'internet telecom': 'Internet & Telecom',
    'elevator lift': 'Elevator / Lift',
    'pests vermin': 'Pests / Vermin',
    'landscaping garden': 'Landscaping / Garden',
    'parking garage': 'Parking / Garage',
    'common areas': 'Common Areas',
    'access keys locks': 'Access / Keys / Locks',
    'cleaning housekeeping': 'Cleaning / Housekeeping',
    'waste management': 'Waste Management',
    'painting decor': 'Painting / Decor',
    'gas supply': 'Gas Supply',
    'noise nuisance': 'Noise / Nuisance',
    'renovation work': 'Renovation Work',
    'other': 'Other',
  };


  // ────────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────────────────────────────────────
  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private readonly platformId: Object,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly apiService: APIsService,
    private readonly chartService: ChartService,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.loggedUser = this.authService.getLoggedUser;
  }

  async ngOnInit(): Promise<void> {
    if(this.isBrowser) this.modeSub = this.windowRef.mode$.subscribe(v => this.mode = v);
    await this.prepareTenantToken();
    if(this.isAdminLike) {await this.loadAllComplaintsForAdmin();}
    else {await this.loadMyComplaintsForTenant();}
  }
  ngAfterViewInit(): void {/* reserved for table ViewChild if needed */}
  ngOnDestroy(): void {this.modeSub?.unsubscribe();}

  // ────────────────────────────────────────────────────────────────────────────
  // Create flow
  // ────────────────────────────────────────────────────────────────────────────
  protected createComplaints(): void {
    try {
      if(!this.tenantToken) throw new Error('Tenant token is empty!');
      this.router.navigate(['/dashboard/tenant/complaints/create-complaint', this.tenantToken]);
    } catch(err) {
      console.error(err);
      this.notification?.notification('error', String(err));
      return;
    }
  }

  private async prepareTenantToken(): Promise<void> {
    try {
      if(!this.loggedUser?.username) throw new Error('Username is empty!');
      const tok = await this.apiService.generateToken(this.loggedUser.username);
      this.tenantToken = tok?.token ?? '';
    } catch(err) {
      console.error(err);
      this.notification?.notification('error', String(err));
      return;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Data loading (admin vs tenant)
  // ────────────────────────────────────────────────────────────────────────────
  private async loadAllComplaintsForAdmin(): Promise<void> {
    this.isLoading = true;
    try {
      const resp = await this.tenantService.getAllComplaints();
      if(resp.status !== 'success' || !Array.isArray(resp.data?.items)) {
        throw new Error(resp.message || 'Failed to fetch complaints');
      }

      const rows = this.toRows(resp.data.items as ComplaintClient[]);
      this.adminAllData = rows; // triggers search/filter/pagination via setter chain
      // Make the pie chart based on the status of the complaints
      this.makePieChartBasedOnComplaintStatusAdmin();
      this.makeBarChartBasedOnComplaintCategoryAdmin();
    } catch(e) {
      console.error(e);
      this.notification?.notification('error', 'Error while fetching all complaints.');
    } finally {
      this.isLoading = false;
    }
  }

  private async loadMyComplaintsForTenant(): Promise<void> {
    this.isLoading = true;
    try {
      const username = this.loggedUser?.username ?? '';
      if(!username) throw new Error('User not logged in');

      const resp = await this.tenantService.getAllComplaintsByTenant(username);
      if(resp.status !== 'success' || !Array.isArray(resp.data)) {
        throw new Error(resp.message || 'Failed to fetch tenant complaints');
      }
      const rows = this.toRows(resp.data as ComplaintClient[]);
      this.tenantAllData = rows; // triggers search/filter/pagination via setter chain
    } catch(e) {
      console.error(e);
      this.notification?.notification('error', 'Error while fetching your complaints.');
    } finally {
      this.isLoading = false;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Mapping (BE DTO → table rows)
  // ────────────────────────────────────────────────────────────────────────────
  private toRows(list: ComplaintClient[]): ComplaintTableRow[] {
    return (list ?? []).map(c => ({
      id: c.code ?? '',
      propertyid: c.propertyId ?? '',
      tenantname: c.tenantName ?? c.tenantId ?? '',
      status: c.status ?? '',
      category: c.category ?? ''
    }));
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ADMIN: filter + paginate (only use getters/setters)
  // ────────────────────────────────────────────────────────────────────────────
  private _filterAdminRows(): void {
    const q = this.adminSearch.toLowerCase().trim();
    const src = this.adminAllData;

    const filtered = !q
      ? [...src]
      : src.filter(r =>
        r.id.toLowerCase().includes(q) ||
        r.tenantname.toLowerCase().includes(q) ||
        r.propertyid.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q),
      );

    this.adminFilteredData = filtered; // setter cascades page size options + apply page(0)
    this.adminPageIndex = 0;           // ensure page index reset via setter
  }

  private _applyAdminPage(nextIndex: number): void {
    const total = this.adminFilteredData.length;
    // Always use a safe page size (avoid undefined from earlier state)
    const size = Math.max(1, (this.adminPageSize | 0) || 10);
    const count = size > 0 ? Math.ceil(total / size) : 0;

    const safeIndex = Math.max(0, Math.min(nextIndex, Math.max(0, count - 1)));
    this._adminPageIndex = safeIndex;

    const start = safeIndex * size;
    const end = start + size;
    this.adminTableData = this.adminFilteredData.slice(start, end);
  }

  private _rebuildAdminPageSizeOptions(): void {
    const total = this.adminFilteredData.length;
    const base = [5, 10, 25, 50, 100];

    // When no rows, keep defaults instead of producing an empty list
    if(total === 0) {
      this.adminPageSizeOptions = [...base];
      // Do NOT shrink page size from options when empty/zero total.
      // Just keep current page size as-is (or clamp to a safe min).
      if(!Number.isFinite(this._adminPageSize) || this._adminPageSize < 1) {
        this._adminPageSize = 10; // safe fallback
      }
      return;
    }

    // Normal case (>0)
    let opts = base.filter(n => n <= Math.max(total, 1));
    if(total > 0 && !opts.includes(total) && total < Math.min(...base)) {
      opts.unshift(total);
    }
    this.adminPageSizeOptions = Array.from(new Set(opts)).sort((a, b) => a - b);

    // Only clamp page size if we actually have options.
    const maxAllowed = Math.max(total, 1);
    if(this.adminPageSizeOptions.length > 0 && this._adminPageSize > maxAllowed) {
      this._adminPageSize = this.adminPageSizeOptions[this.adminPageSizeOptions.length - 1];
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TENANT: filter + paginate (only use getters/setters)
  // ────────────────────────────────────────────────────────────────────────────
  private _filterTenantRows(): void {
    const q = this.tenantSearch.toLowerCase().trim();
    const src = this.tenantAllData;

    const filtered = !q
      ? [...src]
      : src.filter(r =>
        r.id.toLowerCase().includes(q) ||
        r.propertyid.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q),
      );

    this.tenantFilteredData = filtered; // setter cascades
    this.tenantPageIndex = 0;        // reset via setter
  }

  private _applyTenantPage(nextIndex: number): void {
    const total = this.tenantFilteredData.length;
    const size = Math.max(1, (this.tenantPageSize | 0) || 10);
    const count = size > 0 ? Math.ceil(total / size) : 0;

    this.tenantPageCount = count;
    const safeIndex = Math.max(0, Math.min(nextIndex, Math.max(0, count - 1)));
    this._tenantPageIndex = safeIndex;

    const start = safeIndex * size;
    const end = start + size;
    this.tenantTableData = this.tenantFilteredData.slice(start, end);
  }

  private _rebuildTenantPageSizeOptions(): void {
    const total = this.tenantFilteredData.length;
    const base = [5, 10, 25, 50, 100];

    if(total === 0) {
      this.tenantPageSizeOptions = [...base];
      if(!Number.isFinite(this._tenantPageSize) || this._tenantPageSize < 1) {
        this._tenantPageSize = 10;
      }
      return;
    }

    let opts = base.filter(n => n <= Math.max(total, 1));
    if(total > 0 && !opts.includes(total) && total < Math.min(...base)) {
      opts.unshift(total);
    }
    this.tenantPageSizeOptions = Array.from(new Set(opts)).sort((a, b) => a - b);

    const maxAllowed = Math.max(total, 1);
    if(this.tenantPageSizeOptions.length > 0 && this._tenantPageSize > maxAllowed) {
      this._tenantPageSize = this.tenantPageSizeOptions[this.tenantPageSizeOptions.length - 1];
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Button triggers → route
  // ────────────────────────────────────────────────────────────────────────────
  protected handleButtonTrigger(evt: TableButtonActionConfig): void {
    if(!evt) return;
    const type = String(evt.action || '').toLowerCase();
    const raw = evt.data?.element ?? evt.data?.row ?? evt.data ?? {};
    const id = raw.id ?? raw.code ?? '';

    if(!id) {
      this.notification?.notification('warning', 'No complaint id found for this row.');
      return;
    }

    switch(type) {
      case 'view':
        this.router.navigate(['/dashboard/tenant/complaints/view-complaint', id]);
        break;
      case 'edit':
        this.router.navigate(['/dashboard/tenant/complaints/edit-complaint', id]);
        break;
      default:
        this.router.navigate(['/dashboard/tenant/complaints']);
        break;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Admin chart operation
  // ────────────────────────────────────────────────────────────────────────────
  // After your admin data loads, call this to render the chart
  private makePieChartBasedOnComplaintStatusAdmin(): void {
    try {
      // 1) Guard: ensure data exists
      const rows = this.adminAllData; // use your admin rows; for tenant use this.tenantAllData
      if(!Array.isArray(rows) || rows.length === 0) {
        throw new Error('Complaints are empty!');
      }

      // 2) Count statuses (normalized to lowercase); tolerate unknowns/missing
      const counts = this.countStatuses(
        rows.map(r => (r.status ?? '').toString().trim().toLowerCase())
      );

      // 3) Convert to Pie entries in the desired, fixed order
      const entries: PieEntry[] = ComplaintsHome.STATUS_ORDER
        .map(key => ({
          label: ComplaintsHome.STATUS_LABELS[key] ?? key,
          value: counts.get(key) ?? 0,
        }))
        // Optional: hide zero-valued slices; or keep them if you prefer
        .filter(e => e.value > 0);

      // 4) Build your preferred chart: Pie / Pie 3D / Donut
      //    The service assigns colors intelligently (semantic + 20-step palette)
      this.adminStatusPieChart = this.chartService.buildPie3D(
        'Complaints by Status',
        entries,
        {
          legend: {position: 'right'},
          pieSliceText: 'percentage',
          width: 420,
          height: 280,
          tooltip: {isHtml: true},
        }
      );
    } catch(err) {
      console.error(err);
      this.notification?.notification('warning', String(err));
    }
  }

  /**
   * Count normalized statuses into a Map, including all known statuses with 0 as default.
   * Unknown statuses are grouped under 'other' (not shown unless you add it to STATUS_ORDER).
   */
  private countStatuses(normalizedStatuses: string[]): Map<string, number> {
    const map = new Map<string, number>();

    // Initialize all known keys to 0 so chart keeps the consistent order
    for(const key of ComplaintsHome.STATUS_ORDER) map.set(key, 0);

    for(const raw of normalizedStatuses) {
      // Normalize: treat '', null, etc. as 'new' or skip; pick the behavior you want
      const key = raw || 'new';
      if(map.has(key)) {
        map.set(key, (map.get(key) ?? 0) + 1);
      } else {
        // Unknown status → bucket (uncomment below if you want to show it)
        // map.set('other', (map.get('other') ?? 0) + 1);
      }
    }

    return map;
  }


  /* ────────────────────────────────────────────────────────────────────────────
     Admin chart operation: Category → Bar chart
     Call this after admin complaints are loaded (same place you call the status pie).
  ──────────────────────────────────────────────────────────────────────────── */
  private makeBarChartBasedOnComplaintCategoryAdmin(): void {
    try {
      // 1) Guard
      const rows = this.adminAllData; // or whatever holds your admin complaint rows
      if(!Array.isArray(rows) || rows.length === 0) {
        throw new Error('Complaints are empty!');
      }

      // 2) Normalize & count categories
      const counts = this.countCategories(
        rows.map(r => this.normalizeCategory(r.category ?? ''))
      );

      // 3) Build categories array (fixed order) + values aligned to that order
      const categories: string[] = [];
      const values: number[] = [];

      for(const key of ComplaintsHome.CATEGORY_ORDER) {
        const label = ComplaintsHome.CATEGORY_LABELS[key] ?? key;
        const value = counts.get(key) ?? 0;
        if(value > 0) {               // keep or remove this if you want to show zeros
          categories.push(label);
          values.push(value);
        }
      }

      // 4) One series for "Complaints"
      const series: SeriesEntry[] = [{
        name: 'Complaints',
        values,
        type: 'bars', // not required for BarChart, but ok for semantics
      }];

      // 5) Build a horizontal Bar chart
      this.adminCategoryBarChart = this.chartService.buildBar(
        'Complaints by Category',
        categories,
        series,
        {
          legend: {position: 'none'},
          tooltip: {isHtml: true},
          height: Math.max(280, 40 + categories.length * 28), // auto-grow height per row
          hAxis: {title: 'Count'},
          vAxis: {title: 'Category'},
        }
      );

    } catch(err) {
      console.error(err);
      this.notification?.notification('warning', String(err));
    }
  }

  /**
   * Normalize raw category text → our canonical key:
   * - trim
   * - collapse multiple spaces
   * - lowercase
   * - map empty/unknown to 'other'
   */
  private normalizeCategory(raw: string): string {
    const norm = String(raw || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();

    // If the normalized value is one of our keys → use it, else bucket to 'other'
    if(ComplaintsHome.CATEGORY_ORDER.includes(norm as any)) return norm;
    return norm.length ? norm : 'other';
  }

  /**
   * Count categories into a Map seeded with all known keys at 0,
   * so the order stays stable even when some categories are missing.
   */
  private countCategories(normalizedCategories: string[]): Map<string, number> {
    const map = new Map<string, number>();
    for(const key of ComplaintsHome.CATEGORY_ORDER) map.set(key, 0);

    for(const key of normalizedCategories) {
      if(map.has(key)) {
        map.set(key, (map.get(key) ?? 0) + 1);
      } else {
        // Unknown → bucket as 'other'
        map.set('other', (map.get('other') ?? 0) + 1);
      }
    }
    return map;
  }
}
