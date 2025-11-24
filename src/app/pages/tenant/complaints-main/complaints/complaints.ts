// Path: src/app/pages/tenant/complaints-main/home/complaints.home.ts

// ──────────────────────────────────────────────────────────────────────────────
// Angular core & common
// ──────────────────────────────────────────────────────────────────────────────
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

// ──────────────────────────────────────────────────────────────────────────────
// Application services
// ──────────────────────────────────────────────────────────────────────────────
import { APIsService, User } from '../../../../services/APIs/apis.service';
import { AuthService } from '../../../../services/auth/auth.service';
import {
  ComplaintClient,
  TenantService,
} from '../../../../services/tenant/tenant.service';
import { WindowsRefService } from '../../../../services/windowRef/windowRef.service';
import {
  ChartBuild,
  ChartService,
  PieEntry,
  SeriesEntry,
} from '../../../../services/chartService/chart-service';

// ──────────────────────────────────────────────────────────────────────────────
// Shared / UI components
// ──────────────────────────────────────────────────────────────────────────────
import { GoogleChartsModule } from 'angular-google-charts';
import { NotificationDialogComponent } from '../../../../components/dialogs/notification/notificationBar.component';
import { ProgressBarComponent } from '../../../../components/dialogs/progress-bar/progress-bar.component';
import {
  CustomTableComponent,
  TableButton,
  TableButtonActionConfig,
  TableColumn,
} from '../../../../components/shared/custom-table/custom-table.component';
import { SkeletonLoaderComponent } from '../../../../components/shared/skeleton-loader/skeleton-loader.component';

// ──────────────────────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────────────────────
import { PaginationUtil } from '../../../../source/utility/pagination.utils';

// ──────────────────────────────────────────────────────────────────────────────
// Table row view-model for complaints table
// ──────────────────────────────────────────────────────────────────────────────
interface ComplaintTableRow {
  id: string;
  propertyid: string;
  tenantname: string;
  status: string;
  category: string;
  viewButton: TableButton;
  editButton: TableButton;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component definition
// ──────────────────────────────────────────────────────────────────────────────
@Component( {
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
  styleUrls: [ './complaints.scss' ],
} )
export class ComplaintsHome implements OnInit, AfterViewInit, OnDestroy {
  // ========================================================================
  // 1. CHILD COMPONENT REFERENCES (dialogs / loaders)
  // ========================================================================

  /** Notification dialog (toast-like) instance */
  @ViewChild( NotificationDialogComponent )
  notification!: NotificationDialogComponent;

  /** Global progress bar dialog instance */
  @ViewChild( ProgressBarComponent )
  progressBar!: ProgressBarComponent;

  // ========================================================================
  // 2. ENVIRONMENT / AUTH STATE
  // ========================================================================

  /** Current theme mode from WindowRefService (true = dark, false = light) */
  protected mode: boolean | null = null;

  /** True only when running in browser (SSR / Electron guard) */
  protected readonly isBrowser: boolean;

  /** Subscription for theme mode changes */
  private modeSub: Subscription | null = null;

  /** Currently logged-in user (from AuthService) */
  protected loggedUser!: User | null;

  /** Page-level loading flag (used to show skeleton loaders / spinners) */
  protected isLoading = false;

  /** Token used when navigating to "create complaint" route */
  private tenantToken = '';

  /** Quick role gate: admin-like roles can see "All Complaints" dashboard */
  get isAdminLike(): boolean {
    const roles = [ 'admin', 'operator', 'manager' ];
    return roles.includes( this.loggedUser?.role?.toLowerCase() ?? '' );
  }

  // ========================================================================
  // 3. TABLE CONFIG (SHARED BETWEEN ADMIN / TENANT)
  // ========================================================================

  /** Column configuration for the complaints table */
  protected complaintTableColumns: TableColumn[] = [
    { key: 'id', label: 'Complaint ID' },
    { key: 'propertyid', label: 'Property ID' },
    { key: 'tenantname', label: 'Tenant Name' },
    { key: 'status', label: 'Status' },
    { key: 'category', label: 'Category' },
    { key: 'viewButton', label: 'View' },
    { key: 'editButton', label: 'Edit' },
  ];

  /** Default action buttons to render in each row */
  protected actionButtons: TableButton[] = [
    { action: 'view', icon: 'visibility' },
    { action: 'edit', icon: 'edit' },
  ];

  // ========================================================================
  // 4. ADMIN TABLE STATE
  // ========================================================================

  /** Label for admin complaint table */
  protected adminTableType = 'All Complaints';

  /** Full data set for admin complaints (current page only) */
  protected adminAllData: ComplaintTableRow[] = [];

  /** Total complaint count for admin view (for paginator) */
  protected adminTotalDataCount = 0;

  /** Search term (admin) – use getter/setter for side-effects */
  private _adminSearch = '';

  /** Page size (admin) */
  private _adminPageSize = 10;

  /** Page index (admin) */
  private _adminPageIndex = 0;

  /** Reload trigger flag (admin); setter re-loads data immediately */
  private _adminIsReloading = false;

  // ========================================================================
  // 5. TENANT TABLE STATE
  // ========================================================================

  /** Label for tenant complaint table */
  protected tenantTableType = 'My Complaints';

  /** Full data set for tenant complaints (current page only) */
  protected tenantAllData: ComplaintTableRow[] = [];

  /** Total complaint count for tenant view (for paginator) */
  protected tenantTotalDataCount = 0;

  /** Search term (tenant) */
  private _tenantSearch = '';

  /** Page size (tenant) */
  private _tenantPageSize = 10;

  /** Page index (tenant) */
  private _tenantPageIndex = 0;

  /** Used when calculating total pages, if needed */
  protected tenantPageCount = 0;

  /** Reload trigger flag (tenant); setter re-loads data immediately */
  private _tenantIsReloading = false;

  // ========================================================================
  // 6. CHART STATE & CONSTANTS
  // ========================================================================

  /** Admin status pie chart model (bind to template) */
  protected adminStatusPieChart!: ChartBuild;

  /** Admin category bar chart model (bind to template) */
  protected adminCategoryBarChart!: ChartBuild;

  /** Fixed order for complaint statuses (lowercase keys) */
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

  /** Pretty status labels map: API key → legend label */
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

  /** Fixed order for complaint categories (normalized keys) */
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

  /** Pretty category labels map: normalized key → legend/axis label */
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

  // ========================================================================
  // 7. CONSTRUCTOR & LIFECYCLE HOOKS
  // ========================================================================

  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly apiService: APIsService,
    private readonly chartService: ChartService,
  ) {
    // Detect whether we are in a browser (vs SSR / Electron main)
    this.isBrowser = isPlatformBrowser( this.platformId );

    // Capture logged user once at construction time
    this.loggedUser = this.authService.getLoggedUser;
  }

  /**
   * Initialisation:
   * - subscribe to theme mode (browser only)
   * - generate tenant token for "create complaint"
   * - load data depending on role (admin-like vs tenant)
   */
  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( v ) => ( this.mode = v ) );
    }

    await this.prepareTenantToken();

    if ( this.isAdminLike ) {
      await this.loadAllComplaintsForAdmin(
        this._adminPageIndex,
        this._adminPageSize,
        this._adminSearch,
      );
    } else {
      await this.loadMyComplaintsForTenant(
        this._tenantPageIndex,
        this._tenantPageSize,
        this._tenantSearch,
      );
    }
  }

  /**
   * View initialisation.
   * Currently reserved for future ViewChild initialisation, if needed.
   */
  ngAfterViewInit(): void {
    // Reserved for table ViewChild / chart initialisation if needed
  }

  /**
   * Clean up subscriptions when component is destroyed
   */
  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ========================================================================
  // 8. CREATE COMPLAINT FLOW
  // ========================================================================

  /**
   * Navigate to "create complaint" screen using pre-generated tenant token
   */
  protected createComplaints(): void {
    try {
      if ( !this.tenantToken ) {
        throw new Error( 'Tenant token is empty!' );
      }

      this.router.navigate( [
        '/dashboard/tenant/complaints/create-complaint',
        this.tenantToken,
      ] );
    } catch ( err ) {
      console.error( err );
      this.notification?.notification( 'error', String( err ) );
      return;
    }
  }

  /**
   * Generate a call-token for the tenant based on their username.
   * Used when navigating to "create complaint" page.
   */
  private async prepareTenantToken(): Promise<void> {
    try {
      if ( !this.loggedUser?.username ) {
        throw new Error( 'Username is empty!' );
      }

      const tok = await this.apiService.generateToken(
        this.loggedUser.username,
      );

      this.tenantToken = tok?.token ?? '';
    } catch ( err ) {
      console.error( err );
      this.notification?.notification( 'error', String( err ) );
      return;
    }
  }

  // ========================================================================
  // 9. ADMIN STATE: GETTERS / SETTERS (TRIGGER DATA LOAD)
  // ========================================================================

  /** Admin: getter for reload flag */
  get adminIsReloading(): boolean {
    return this._adminIsReloading;
  }

  /**
   * Admin: setter for reload flag.
   * When set to true, triggers a fresh load of admin complaints.
   */
  set adminIsReloading( value: boolean ) {
    this._adminIsReloading = value;

    if ( this._adminIsReloading ) {
      this.loadAllComplaintsForAdmin(
        this._adminPageIndex,
        this._adminPageSize,
        this._adminSearch,
      );
    }
  }

  /** Admin: current search term (for binding) */
  get adminSearch(): string {
    return this._adminSearch;
  }

  /**
   * Admin: update search term and re-load complaints.
   * Trims whitespace and reuses current page index and size.
   */
  set adminSearch( v: string ) {
    this._adminSearch = ( v ?? '' ).trim();

    this.loadAllComplaintsForAdmin(
      this._adminPageIndex,
      this._adminPageSize,
      this._adminSearch,
    );
  }

  /** Admin: current page size */
  get adminPageSize(): number {
    return this._adminPageSize;
  }

  /**
   * Admin: update page size and reload with safe size (minimum 1).
   */
  set adminPageSize( v: number ) {
    this._adminPageSize = Math.max( 1, v | 0 );

    this.loadAllComplaintsForAdmin(
      this._adminPageIndex,
      this._adminPageSize,
      this._adminSearch,
    );
  }

  /** Admin: current page index */
  get adminPageIndex(): number {
    return this._adminPageIndex;
  }

  /**
   * Admin: update page index and reload complaints for new page.
   */
  set adminPageIndex( v: number ) {
    this._adminPageIndex = v;

    this.loadAllComplaintsForAdmin(
      this._adminPageIndex,
      this._adminPageSize,
      this._adminSearch,
    );
  }

  // ========================================================================
  // 10. TENANT STATE: GETTERS / SETTERS (TRIGGER DATA LOAD)
  // ========================================================================

  /** Tenant: getter for reload flag */
  get tenantIsReloading(): boolean {
    return this._tenantIsReloading;
  }

  /**
   * Tenant: setter for reload flag.
   * When set true, refreshes "My Complaints" list.
   */
  set tenantIsReloading( value: boolean ) {
    this._tenantIsReloading = value;

    if ( this._tenantIsReloading ) {
      this.loadMyComplaintsForTenant(
        this._tenantPageIndex,
        this._tenantPageSize,
        this._tenantSearch,
      );
    }
  }

  /** Tenant: current search term */
  get tenantSearch(): string {
    return this._tenantSearch;
  }

  /**
   * Tenant: update search term and refresh tenant complaints.
   */
  set tenantSearch( v: string ) {
    this._tenantSearch = ( v ?? '' ).trim();

    this.loadMyComplaintsForTenant(
      this._tenantPageIndex,
      this._tenantPageSize,
      this._tenantSearch,
    );
  }

  /** Tenant: current page size */
  get tenantPageSize(): number {
    return this._tenantPageSize;
  }

  /**
   * Tenant: update page size and reload data.
   */
  set tenantPageSize( v: number ) {
    this._tenantPageSize = v;

    this.loadMyComplaintsForTenant(
      this._tenantPageIndex,
      this._tenantPageSize,
      this._tenantSearch,
    );
  }

  /** Tenant: current page index */
  get tenantPageIndex(): number {
    return this._tenantPageIndex;
  }

  /**
   * Tenant: update page index and reload data.
   */
  set tenantPageIndex( v: number ) {
    this._tenantPageIndex = v;

    this.loadMyComplaintsForTenant(
      this._tenantPageIndex,
      this._tenantPageSize,
      this._tenantSearch,
    );
  }

  // ========================================================================
  // 11. DATA LOADING (ADMIN VS TENANT)
  // ========================================================================

  /**
   * Load all complaints for admin-like roles:
   * - Retrieves total count
   * - Calculates safe pagination values
   * - Fetches complaints for the current page
   * - Builds table rows
   * - Builds admin charts (status pie + category bar)
   */
  private async loadAllComplaintsForAdmin(
    index: number,
    size: number,
    search?: string,
  ): Promise<void> {
    this.isLoading = true;

    try {
      // 1) Get total complaint count
      const countRea = await this.tenantService.getAllComplaintsCount();

      if ( countRea.status !== 'success' || typeof countRea.data?.total !== 'number' ) {
        throw new Error( countRea.message || 'Failed to fetch complaints count' );
      }

      const total = Number( countRea.data.total );
      this.adminTotalDataCount = total;

      // 2) Compute safe pagination based on total
      const safeIndex = PaginationUtil.safeIndex( index, total );
      const safeLimit = PaginationUtil.safeLimit( size, total );
      const safeStart = safeIndex * safeLimit;
      const safeSearch = search ? search.trim() : undefined;

      // 3) Fetch complaints with pagination + optional search
      const resp = await this.tenantService.getAllComplaints(
        safeStart,
        safeLimit,
        safeSearch,
      );

      if ( resp.status !== 'success' || !Array.isArray( resp.data?.items ) ) {
        throw new Error( resp.message || 'Failed to fetch complaints' );
      }

      // 4) Map backend DTOs → table rows
      const rows = await Promise.all(
        resp.data.items.map(
          async ( complaint: ComplaintClient ): Promise<ComplaintTableRow> =>
            await this.buildRow( complaint ),
        ),
      );

      this.adminAllData = rows;

      // 5) Build admin charts based on all complaints
      await this.makePieChartBasedOnComplaintStatusAdmin();
      await this.makeBarChartBasedOnComplaintCategoryAdmin();
    } catch ( e ) {
      console.error( e );
      this.notification?.notification(
        'error',
        'Error while fetching all complaints.',
      );
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Helper used e.g. from template when tenant wants to manually reload
   */
  protected fetchTenantData(): void {
    this.loadMyComplaintsForTenant(
      this._tenantPageIndex,
      this._tenantPageSize,
      this._tenantSearch,
    );
  }

  /**
   * Load complaints belonging to the currently logged-in tenant:
   * - Validates username
   * - Fetches total count
   * - Applies safe pagination
   * - Maps complaints to table rows
   */
  private async loadMyComplaintsForTenant(
    index: number,
    size: number,
    search?: string,
  ): Promise<void> {
    this.isLoading = true;

    try {
      const username = this.loggedUser?.username ?? '';
      if ( !username ) {
        throw new Error( 'User not logged in' );
      }

      // 1) Get total complaints for this tenant
      const countRes =
        await this.tenantService.getTotalCountOfComplaintsByTenant( username );

      if ( countRes.status !== 'success' || typeof countRes.data?.total !== 'number' ) {
        throw new Error(
          countRes.message || 'Failed to fetch complaint count for tenant',
        );
      }

      const totalComplaints = countRes.data.total;
      this.tenantTotalDataCount = totalComplaints;

      // 2) Compute safe pagination
      const safeIndex = PaginationUtil.safeIndex( index, totalComplaints );
      const safeLimit = PaginationUtil.safeLimit( size, totalComplaints );
      const safeStart = safeIndex * safeLimit;
      const safeSearch = search ? search.trim() : undefined;

      // 3) Fetch complaints for this tenant
      const resp = await this.tenantService.getAllComplaintsByTenant(
        username,
        safeStart,
        safeLimit,
        safeSearch,
      );

      if ( resp.status !== 'success' || !Array.isArray( resp.data.complaints ) ) {
        throw new Error( resp.message || 'Failed to fetch tenant complaints' );
      }

      // 4) Map backend DTOs → table rows
      const rows = await Promise.all(
        resp.data.complaints.map(
          async ( complaint: ComplaintClient ): Promise<ComplaintTableRow> =>
            await this.buildRow( complaint ),
        ),
      );

      this.tenantAllData = rows;
    } catch ( e ) {
      console.error( e );
      this.notification?.notification(
        'error',
        'Error while fetching your complaints.',
      );
    } finally {
      this.isLoading = false;
    }
  }

  // ========================================================================
  // 12. MAPPING (BACKEND DTO → TABLE ROW)
  // ========================================================================

  /**
   * Convert a backend ComplaintClient into a ComplaintTableRow used by the table:
   * - Fetches tenant full name from API (section "name")
   * - Fills action buttons for view/edit
   */
  private async buildRow( item: ComplaintClient ): Promise<ComplaintTableRow> {
    const res = await this.apiService.getSectionKeyFromUser(
      item.tenantId,
      'name',
    );

    if ( res.status !== 'success' ) {
      console.warn( 'Failed to fetch user data' );
    }

    const userFullName = res.data.section?.name ?? '';
    if ( !userFullName ) {
      console.warn( 'Failed to process user full name' );
    }

    const data: ComplaintTableRow = {
      id: item.code || '',
      propertyid: item.propertyId || '',
      tenantname: userFullName || item.tenantId,
      status: item.status || '',
      category: item.category || '',
      viewButton: { action: 'view', icon: 'visibility', label: 'View' },
      editButton: { action: 'edit', icon: 'edit', label: 'Edit' },
    };

    return data;
  }

  // ========================================================================
  // 13. TABLE BUTTON HANDLERS (VIEW / EDIT)
  // ========================================================================

  /**
   * Handle table button click events:
   * - View → navigate to "view complaint" page
   * - Edit → navigate to "edit complaint" page
   * - Default → navigate back to complaints home
   */
  protected handleButtonTrigger( evt: TableButtonActionConfig ): void {
    if ( !evt ) return;

    const type = String( evt.action || '' ).toLowerCase();
    const raw = evt.data?.element ?? evt.data?.row ?? evt.data ?? {};
    const id = raw.id ?? raw.code ?? '';

    if ( !id ) {
      this.notification?.notification(
        'warning',
        'No complaint id found for this row.',
      );
      return;
    }

    switch ( type ) {
      case 'view':
        this.router.navigate( [
          '/dashboard/tenant/complaints/view-complaint',
          id,
        ] );
        break;

      case 'edit':
        this.router.navigate( [
          '/dashboard/tenant/complaints/edit-complaint',
          id,
        ] );
        break;

      default:
        this.router.navigate( [ '/dashboard/tenant/complaints' ] );
        break;
    }
  }

  // ========================================================================
  // 14. ADMIN CHARTS: STATUS PIE
  // ========================================================================

  /**
   * Build admin status pie chart:
   * - Uses aggregated data from backend (getAllComplaintsBySection('status'))
   *   or falls back to adminAllData if aggregation is empty.
   * - Normalises statuses and counts them.
   * - Builds a 3D pie chart using ChartService.
   */
  private async makePieChartBasedOnComplaintStatusAdmin(): Promise<void> {
    try {
      const res = await this.tenantService.getAllComplaintsBySection( 'status' );

      if ( res.status !== 'success' ) {
        throw new Error( 'Failed to fetch complaints data!' );
      }

      const complaints = res.data?.complaints;
      const total = res.data?.total;

      // Choose dataset:
      // 1) use aggregated "complaints" if present
      // 2) otherwise fallback to already loaded admin table data
      let rows: Array<{ status?: string; }> | undefined;

      if ( Array.isArray( complaints ) && complaints.length > 0 ) {
        rows = complaints;
      } else if (
        Array.isArray( this.adminAllData ) &&
        this.adminAllData.length > 0
      ) {
        rows = this.adminAllData;
      }

      if ( !rows || rows.length === 0 ) {
        throw new Error( 'Complaints are empty!' );
      }

      // Normalise statuses to lowercase for consistent counting
      const normalizedStatuses = rows.map( ( r ) =>
        ( r.status ?? '' ).toString().trim().toLowerCase(),
      );

      // Count statuses using helper (includes all known keys)
      const counts = this.countStatuses( normalizedStatuses );

      // Optional consistency check vs backend total
      if ( typeof total === 'number' && Number.isFinite( total ) ) {
        const computedTotal = Array.from( counts.values() ).reduce(
          ( sum, v ) => sum + v,
          0,
        );

        if ( computedTotal !== total ) {
          console.warn( 'Backend total does not match computed total', {
            backendTotal: total,
            computedTotal,
          } );
        }
      }

      // Build pie entries according to fixed STATUS_ORDER
      const entries: PieEntry[] = ComplaintsHome.STATUS_ORDER.map( ( key ) => ( {
        label: ComplaintsHome.STATUS_LABELS[ key ] ?? key,
        value: counts.get( key ) ?? 0,
      } ) ).filter( ( e ) => e.value > 0 ); // Skip slices with 0 value

      // Build the 3D pie chart
      this.adminStatusPieChart = this.chartService.buildPie3D(
        'Complaints by Status',
        entries,
        {
          legend: { position: 'right' },
          pieSliceText: 'percentage',
          width: 420,
          height: 280,
          tooltip: { isHtml: true },
        },
      );
    } catch ( err ) {
      console.error( err );
      this.notification?.notification( 'warning', String( err ) );
    }
  }

  /**
   * Count normalised statuses into a Map:
   * - Seeds all known statuses from STATUS_ORDER with 0
   * - Unknown statuses can be bucketed in an "other" group (currently disabled)
   */
  private countStatuses( normalizedStatuses: string[] ): Map<string, number> {
    const map = new Map<string, number>();

    // Seed known statuses with 0 for stable order
    for ( const key of ComplaintsHome.STATUS_ORDER ) {
      map.set( key, 0 );
    }

    for ( const raw of normalizedStatuses ) {
      const key = raw || 'new';

      if ( map.has( key ) ) {
        map.set( key, ( map.get( key ) ?? 0 ) + 1 );
      } else {
        // Unknown status bucket:
        // map.set('other', (map.get('other') ?? 0) + 1);
      }
    }

    return map;
  }

  // ========================================================================
  // 15. ADMIN CHARTS: CATEGORY BAR
  // ========================================================================

  /**
   * Build admin category bar chart:
   * - Uses aggregated data from backend (grouped by category)
   *   or falls back to adminAllData when needed.
   * - Normalises categories and counts them.
   * - Builds a horizontal bar chart with dynamic height.
   */
  private async makeBarChartBasedOnComplaintCategoryAdmin(): Promise<void> {
    try {
      // Fetch aggregated complaints grouped by category
      const res = await this.tenantService.getAllComplaintsBySection(
        'category',
      );

      if ( res.status !== 'success' ) {
        throw new Error( 'Failed to fetch complaints data!' );
      }

      const complaints = res.data?.complaints;
      const total = res.data?.total;

      // Select dataset: backend aggregation or fallback admin data
      let rows: Array<{ category?: string; }> | undefined;

      if ( Array.isArray( complaints ) && complaints.length > 0 ) {
        rows = complaints;
      } else if (
        Array.isArray( this.adminAllData ) &&
        this.adminAllData.length > 0
      ) {
        rows = this.adminAllData;
      }

      if ( !rows || rows.length === 0 ) {
        throw new Error( 'Complaints are empty!' );
      }

      // Normalise category strings and count them
      const normalizedCategories = rows.map( ( r ) =>
        this.normalizeCategory( r.category ?? '' ),
      );
      const counts = this.countCategories( normalizedCategories );

      // Optional consistency check vs backend total
      if ( typeof total === 'number' && Number.isFinite( total ) ) {
        const computed = Array.from( counts.values() ).reduce(
          ( a, c ) => a + c,
          0,
        );

        if ( computed !== total ) {
          console.warn( 'Category totals mismatch', {
            backendTotal: total,
            computed,
          } );
        }
      }

      // Build label + value arrays in fixed order
      const categories: string[] = [];
      const values: number[] = [];

      for ( const key of ComplaintsHome.CATEGORY_ORDER ) {
        const label = ComplaintsHome.CATEGORY_LABELS[ key ] ?? key;
        const value = counts.get( key ) ?? 0;

        // If you want zero-bars to show, remove this condition
        if ( value > 0 ) {
          categories.push( label );
          values.push( value );
        }
      }

      // Single-series bar chart "Complaints"
      const series: SeriesEntry[] = [
        {
          name: 'Complaints',
          values,
          type: 'bars',
        },
      ];

      // Build horizontal bar chart with auto height based on number of rows
      this.adminCategoryBarChart = this.chartService.buildBar(
        'Complaints by Category',
        categories,
        series,
        {
          legend: { position: 'none' },
          tooltip: { isHtml: true },
          height: Math.max( 280, 40 + categories.length * 28 ),
          hAxis: { title: 'Count' },
          vAxis: { title: 'Category' },
        },
      );
    } catch ( err ) {
      console.error( err );
      this.notification?.notification( 'warning', String( err ) );
    }
  }

  // ========================================================================
  // 16. CATEGORY NORMALISATION & COUNTING HELPERS
  // ========================================================================

  /**
   * Normalise raw category text into one of our canonical keys:
   * - trim
   * - collapse multiple spaces into single
   * - lowercase
   * - map unknown/empty categories to 'other'
   */
  private normalizeCategory( raw: string ): string {
    const norm = String( raw || '' )
      .trim()
      .replace( /\s+/g, ' ' )
      .toLowerCase();

    return ComplaintsHome.CATEGORY_ORDER.includes( norm as any )
      ? norm
      : norm.length
        ? 'other'
        : 'other';
  }

  /**
   * Count categories into a Map:
   * - Seeds all keys from CATEGORY_ORDER with 0 for stable order.
   * - Unknown categories can be bucketed into 'other' (currently same key).
   */
  private countCategories( normalized: string[] ): Map<string, number> {
    const map = new Map<string, number>();

    // Seed all known categories with 0
    for ( const key of ComplaintsHome.CATEGORY_ORDER ) {
      map.set( key, 0 );
    }

    for ( const raw of normalized ) {
      const key = raw || 'other';

      if ( map.has( key ) ) {
        map.set( key, ( map.get( key ) ?? 0 ) + 1 );
      } else {
        // If you decide to expose unknown categories, you can bucket here:
        // map.set('other', (map.get('other') ?? 0) + 1);
      }
    }

    return map;
  }
}
