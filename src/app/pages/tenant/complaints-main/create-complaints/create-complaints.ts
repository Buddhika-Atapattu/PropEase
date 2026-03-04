// ─────────────────────────────────────────────────────────────────────────────
// Angular core & common imports
// ─────────────────────────────────────────────────────────────────────────────
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Renderer2,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

// ─────────────────────────────────────────────────────────────────────────────
// RxJS
// ─────────────────────────────────────────────────────────────────────────────
import { Subscription } from 'rxjs';

// ─────────────────────────────────────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────────────────────────────────────
import { HttpErrorResponse } from '@angular/common/http';

// ─────────────────────────────────────────────────────────────────────────────
// Services & types
// ─────────────────────────────────────────────────────────────────────────────
import {
  APIsService,
  type User,
} from '../../../../services/APIs/apis.service';
import { AuthService } from '../../../../services/auth/auth.service';

import {
  PropertyService,
  type Address,
  type BackEndPropertyData,
} from '../../../../services/property/property.service';

import {
  COMPLAINT_CATEGORIES,
  TenantService,
  type ComplaintClient,
  type CreateComplaintPayload,
  type Lease,
  type PendingAttachmentClient,
  type AttachmentSource,
} from '../../../../services/tenant/tenant.service';

import { WindowsRefService } from '../../../../services/windowRef/windowRef.service';

import { PaginationUtil } from '../../../../source/utility/pagination.util';

// ─────────────────────────────────────────────────────────────────────────────
// Shared components
// ─────────────────────────────────────────────────────────────────────────────
import {
  TableButtonActionConfig,
  TableButton,
  TableColumn,
  CustomTableComponent,
} from '../../../../components/shared/custom-table/custom-table.component';
import { NotificationDialogComponent } from '../../../../components/dialogs/notificationBar/notificationBar.component';
import { ProgressBarComponent } from '../../../../components/dialogs/progress-bar/progress-bar.component';
import { Dropdown } from '../../../../components/shared/dropdown/dropdown';
import { TextEditorComponent } from '../../../../components/shared/textEditor/text-editor';

// ─────────────────────────────────────────────────────────────────────────────
// Angular Material (standalone components/modules)
// ─────────────────────────────────────────────────────────────────────────────
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

// ─────────────────────────────────────────────────────────────────────────────
// Local interfaces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple row model for the property selector table.
 * This is what the CustomTableComponent renders.
 */
interface PropertyTableData {
  image: string;
  id: string;
  leaseid: string;
  title: string;
  type: string;
  address: Address;
  viewButton: TableButton;
  addButton: TableButton;
}

/**
 * Internal pair to link a property with its lease.
 * (Kept in case you want to use it for richer UI later.)
 */
interface PropertyWithLease {
  property: BackEndPropertyData;
  lease: Lease;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
@Component( {
  selector: 'app-create-complaints',
  standalone: true,
  imports: [
    // Angular
    CommonModule,
    FormsModule,

    // Material
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIcon,

    // Shared components
    NotificationDialogComponent,
    ProgressBarComponent,
    CustomTableComponent,
    Dropdown,
    TextEditorComponent,
  ],
  templateUrl: './create-complaints.html',
  styleUrl: './create-complaints.scss',
} )
export class CreateComplaints implements OnInit, AfterViewInit, OnDestroy {

  // ───────────────────────────────────────────────────────────────────────────
  // ViewChild references (DOM + child components)
  // ───────────────────────────────────────────────────────────────────────────

  @ViewChild( NotificationDialogComponent )
  notification!: NotificationDialogComponent;

  @ViewChild( ProgressBarComponent )
  progressBar!: ProgressBarComponent;

  /** Hidden input[type=file] used for manual file selection */
  @ViewChild( 'fileUpload', { static: true } )
  fileUpload!: ElementRef<HTMLInputElement>;

  /** Dropzone root element for drag & drop styling / listeners */
  @ViewChild( 'dropzone', { static: true } )
  dropzone!: ElementRef<HTMLElement>;

  // ───────────────────────────────────────────────────────────────────────────
  // Theme / environment state
  // ───────────────────────────────────────────────────────────────────────────

  /** Current mode (dark / light) from WindowRefService */
  protected mode: boolean | null = null;

  /** True only when running in browser (not on server for SSR) */
  protected readonly isBrowser: boolean;

  /** Subscription to global mode$ observable */
  private modeSub: Subscription | null = null;

  /** Currently logged-in user (admin / tenant / etc.) */
  private loggedUser: User | null;

  // ───────────────────────────────────────────────────────────────────────────
  // Table configuration (shared between Admin + Tenant views)
  // ───────────────────────────────────────────────────────────────────────────

  /** Column definition for CustomTableComponent */
  protected tableColumns: TableColumn[] = [
    { key: 'image', label: 'Image' },
    { key: 'id', label: 'ID' },
    { key: 'leaseid', label: 'LeaseID' },
    { key: 'title', label: 'Title' },
    { key: 'type', label: 'Type' },
    { key: 'address', label: 'Address' },
    { key: 'viewButton', label: 'View' },
    { key: 'addButton', label: 'Add' },
  ];

  /** Simple label for the table (header / caption) */
  protected tableType: string = 'Property Selection';

  /** Button definitions passed to CustomTableComponent */
  protected actionButtons: TableButton[] = [
    { action: 'view', icon: 'visibility' },
    { action: 'add', icon: 'add_circle' },
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // Pagination + data (Admin side)
  // ───────────────────────────────────────────────────────────────────────────

  private _isReloading: boolean = false;
  private _pageSize: number = 10;
  private _pageIndex: number = 0;
  private _search: string = '';

  /** Total number of leases (for admin table) */
  protected totalDataCount: number = 0;

  /** Rows rendered for admin view */
  protected allData: PropertyTableData[] = [];

  // ───────────────────────────────────────────────────────────────────────────
  // Pagination + data (Tenant side)
  // ───────────────────────────────────────────────────────────────────────────

  /** Flag used by tenant paginator to trigger reload */
  private _isReloadingTenant: boolean = false;

  /** Page size for tenant-side table (spelling kept as in existing code) */
  private _pageLimiteTenant: number = 10;

  /** Current page index for tenant table */
  private _pageIndexTenant: number = 0;

  /** Search keyword for tenant table */
  private _searchTenant: string = '';

  /** Total leases for tenant (for tenant table) */
  protected totalDataCountTenant: number = 0;

  /** Rows rendered for tenant view */
  protected allDataTenant: PropertyTableData[] = [];

  // ───────────────────────────────────────────────────────────────────────────
  // Complaint form fields
  // ───────────────────────────────────────────────────────────────────────────

  /** Tenant resolved from route token (for tenant-initiated complaints) */
  private tenant: User | null = null;

  /** Complaint title (simple string) */
  protected title!: ComplaintClient[ 'title' ];

  /** Complaint rich-text / description */
  protected description!: ComplaintClient[ 'description' ];

  /** Complaint category (enum/string from COMPLAINT_CATEGORIES) */
  protected category: ComplaintClient[ 'category' ] | undefined;

  // Related IDs / names resolved from table selection
  private _tenantID!: ComplaintClient[ 'tenantId' ];
  private _tenantName!: ComplaintClient[ 'tenantName' ];
  private _propertyId!: ComplaintClient[ 'propertyId' ];
  private _propertyName!: ComplaintClient[ 'propertyName' ];
  private _leaseId!: ComplaintClient[ 'leaseId' ];

  // Optional meta fields
  private _priority: ComplaintClient[ 'priority' ] = 'medium';
  private _status!: ComplaintClient[ 'status' ];
  private _assigneeId!: ComplaintClient[ 'assigneeId' ];
  private _assigneeName!: ComplaintClient[ 'assigneeName' ];

  /** Complaint creation timestamp (client-side) */
  private readonly _createdAt: string = new Date().toISOString();

  /** Optional due date/time */
  private _dueAt!: string;

  /** Property currently selected for this complaint */
  private _selectedProperty!: BackEndPropertyData;

  // ───────────────────────────────────────────────────────────────────────────
  // Attachments (drag & drop / paste / file input)
  // ───────────────────────────────────────────────────────────────────────────

  /** Whether user is currently dragging files over dropzone */
  protected isDragging: boolean = false;

  /**
   * Pending attachments (shown in UI and later uploaded).
   * Each entry contains the File plus how it was added.
   */
  protected pendingAttachments: PendingAttachmentClient[] = [];

  /** Supported MIME types for attachments */
  private readonly ALLOWED_MIME: ReadonlyArray<string> = [
    // Images
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    // Add more if you want (e.g. 'application/pdf')
  ];

  /** Maximum number of attachments per complaint */
  private readonly MAX_FILES: number = 12;

  /** Max file size per attachment (10 MB) */
  private readonly MAX_FILE_SIZE_BYTES: number = 10 * 1024 * 1024;

  // ───────────────────────────────────────────────────────────────────────────
  // Complaint categories (readonly constant from service)
  // ───────────────────────────────────────────────────────────────────────────

  protected DEFINED_COMPLAINT_CATEGORIES: readonly string[] = COMPLAINT_CATEGORIES;

  // ───────────────────────────────────────────────────────────────────────────
  // Renderer2 event listener clean-up handles (for drag & drop)
  // ───────────────────────────────────────────────────────────────────────────

  private _dropEnterListener?: () => void;
  private _dropOverListener?: () => void;
  private _dropLeaveListener?: () => void;
  private _dropListener?: () => void;

  // ───────────────────────────────────────────────────────────────────────────
  // Convenience getters
  // ───────────────────────────────────────────────────────────────────────────

  /** Logged user role (admin / tenant / etc.) as plain string */
  get loggedUserRole(): string {
    return this.loggedUser?.role ?? '';
  }

  /**
   * True if logged user is admin-like.
   * You use this to decide which table to load (admin vs tenant).
   */
  get checkLoggedUserRole(): boolean {
    const roles: string[] = [ 'admin', 'operator', 'manager' ];
    const userRole = this.loggedUser?.role ?? '';
    return !!userRole && roles.includes( userRole );
  }

  /** Expose selected property to template */
  get property(): BackEndPropertyData {
    return this._selectedProperty;
  }

  /** Expose selected lease ID to template */
  get leaseID(): string {
    return this._leaseId ?? '';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Table API getters/setters (Tenant)
  // ───────────────────────────────────────────────────────────────────────────

  get isReloadingTenant(): boolean {
    return this._isReloadingTenant;
  }
  set isReloadingTenant( value: boolean ) {
    this._isReloadingTenant = value;
    if ( this._isReloadingTenant ) {
      void this.loadTableDataForTenant(
        this._pageIndexTenant,
        this._pageLimiteTenant,
        this._searchTenant,
      );
    }
  }

  get pageLimiteTenant(): number {
    return this._pageLimiteTenant;
  }
  set pageLimiteTenant( value: number ) {
    this._pageLimiteTenant = value;
    void this.loadTableDataForTenant(
      this._pageIndexTenant,
      this._pageLimiteTenant,
      this._searchTenant,
    );
  }

  get pageIndexTenant(): number {
    return this._pageIndexTenant;
  }
  set pageIndexTenant( value: number ) {
    this._pageIndexTenant = value;
    void this.loadTableDataForTenant(
      this._pageIndexTenant,
      this._pageLimiteTenant,
      this._searchTenant,
    );
  }

  get searchTenant(): string {
    return this._searchTenant;
  }
  set searchTenant( value: string ) {
    this._searchTenant = ( value ?? '' ).trim();
    void this.loadTableDataForTenant(
      this._pageIndexTenant,
      this._pageLimiteTenant,
      this._searchTenant,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Table API getters/setters (Admin)
  // ───────────────────────────────────────────────────────────────────────────

  get isReloading(): boolean {
    return this._isReloading;
  }
  set isReloading( value: boolean ) {
    this._isReloading = value;
    if ( this._isReloading ) {
      void this.loadTableDataForAdmin( this._pageIndex, this._pageSize, this._search );
    }
  }

  get pageSize(): number {
    return this._pageSize;
  }
  set pageSize( value: number ) {
    this._pageSize = value;
    void this.loadTableDataForAdmin( this._pageIndex, this._pageSize, this._search );
  }

  get pageIndex(): number {
    return this._pageIndex;
  }
  set pageIndex( value: number ) {
    this._pageIndex = value;
    void this.loadTableDataForAdmin( this._pageIndex, this._pageSize, this._search );
  }

  get search(): string {
    return this._search;
  }
  set search( value: string ) {
    this._search = ( value ?? '' ).trim();
    void this.loadTableDataForAdmin( this._pageIndex, this._pageSize, this._search );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Constructor
  // ───────────────────────────────────────────────────────────────────────────

  public constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly renderer: Renderer2,
    private readonly apiService: APIsService,
    private readonly propertyService: PropertyService,
    private readonly dialog: MatDialog,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    // Snapshot of logged user from AuthService
    this.loggedUser = this.authService.getLoggedUser;

    // Optional: use logged user as default assignee (useful for admin)
    this.registerAssigneeFromLoggedUser();

    // Reserved in case you need route-based behaviour later
    this.route.url.subscribe( () => {
      // no-op for now
    } );

    // Resolve tenant from "tenantID" route param and optional leaseID query param
    this.route.params.subscribe( async ( params ) => {
      try {
        const token = params[ 'tenantID' ];

        const res = await this.apiService.getUserByToken( token );

        if ( !res.success || res.status !== 'success' ) {
          throw new Error( 'Failed to fetch user!' );
        }

        const user: User | undefined = res.data?.system?.user;

        if ( !user ) {
          throw new Error( 'Invalid user data!' );
        }

        this.tenant = user;
        this.registerTenantContext( user );

        // Optional query param 'leaseID' to auto-select lease/property
        this._leaseId = this.route.snapshot.queryParamMap.get( 'leaseID' ) ?? '';

        if ( this._leaseId ) {
          await this.loadLease( this._leaseId );
        }
      } catch ( error ) {
        console.error( error );
      }
    } );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ───────────────────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }

    // Admin-like roles see all leases, tenant sees only own leases
    if ( this.checkLoggedUserRole ) {
      await this.loadTableDataForAdmin(
        this._pageIndex,
        this._pageSize,
        this._search,
      );
    } else {
      await this.loadTableDataForTenant(
        this._pageIndexTenant,
        this._pageLimiteTenant,
        this._searchTenant,
      );
    }
  }

  ngAfterViewInit(): void {
    if ( !this.isBrowser ) {
      return;
    }

    // If you later want to wire Renderer2 listeners directly:
    // this._dropEnterListener = this.renderer.listen(...);
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();

    this._dropEnterListener?.();
    this._dropOverListener?.();
    this._dropLeaveListener?.();
    this._dropListener?.();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Data loading – admin view
  // ───────────────────────────────────────────────────────────────────────────

  /** Convenience method (e.g. refresh button) */
  protected async fetchData(): Promise<void> {
    if ( this.checkLoggedUserRole ) {
      await this.loadTableDataForAdmin(
        this._pageIndex,
        this._pageSize,
        this._search,
      );
    } else {
      await this.loadTableDataForTenant(
        this._pageIndexTenant,
        this._pageLimiteTenant,
        this._searchTenant,
      );
    }
  }

  /**
   * Admin table loader:
   *  1) Fetch total count of leases
   *  2) Validate total
   *  3) Compute safe pagination (index/limit)
   *  4) Fetch leases for the current page
   *  5) Map them to PropertyTableData rows
   */
  private async loadTableDataForAdmin(
    index: number,
    limit: number,
    search?: string,
  ): Promise<void> {
    try {
      // 1) Get total count
      const countRes = await this.tenantService.getLeaseCount();

      if ( countRes.status.toLowerCase() !== 'success' ) {
        throw new Error( 'Failed to fetch total count of leases' );
      }

      const total: number | undefined = countRes.data?.pagination?.total;

      if (
        total === undefined ||
        !Number.isFinite( total ) ||
        !Number.isInteger( total ) ||
        total < 0 ||
        Number.isNaN( total )
      ) {
        throw new Error( 'Invalid lease total number!' );
      }

      // Early exit: no leases at all
      if ( total === 0 ) {
        this.allData = [];
        this.totalDataCount = 0;
        return;
      }

      // 2) Compute safe pagination and search
      const safeIndex: number = PaginationUtil.safeIndex( index, total );
      const safeLimit: number = PaginationUtil.safeLimit( limit, total );
      const safeStart: number = safeIndex * safeLimit;
      const safeSearch: string | undefined = search ? search.trim() : undefined;

      // 3) Fetch paginated leases from backend
      const leaseRes = await this.tenantService.getAllLeases(
        safeStart,
        safeLimit,
        safeSearch,
      );

      if ( leaseRes.status.toLowerCase() !== 'success' ) {
        throw new Error( 'Failed to fetch lease data!' );
      }

      const leases: Lease[] | undefined = leaseRes.data?.system?.leases;

      if ( !Array.isArray( leases ) || leases.length === 0 ) {
        this.allData = [];
        this.totalDataCount = 0;
        return;
      }

      // 4) Build rows for table (each row may individually fail)
      const rows: ( PropertyTableData | null )[] = await Promise.all(
        leases.map( async ( lease ): Promise<PropertyTableData | null> => {
          return this.organiseTableRow( lease );
        } ),
      );

      // 5) Filter out failed rows
      const filteredRows: PropertyTableData[] = rows.filter(
        ( row ): row is PropertyTableData => row !== null,
      );

      this.allData = filteredRows;
      this.totalDataCount = total;
    } catch ( error ) {
      console.error( error );
      this.handleGenericError( error, 'Unknown error while loading lease table.' );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Data loading – tenant view
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Tenant table loader:
   *  - Loads all leases for a given tenant username
   *  - Validates total
   *  - Applies in-memory pagination + search
   */
  private async loadTableDataForTenant(
    index: number,
    limit: number,
    search?: string,
  ): Promise<void> {
    try {
      if ( !this.tenant?.username ) {
        throw new Error( 'Invalid tenant username!' );
      }

      // Tenant-based lease fetch
      const res = await this.tenantService.getAllLeaseAgreementsByUsername(
        this.tenant.username,
      );

      if ( res.status !== 'success' ) {
        throw new Error( 'Failed to fetch lease documents!' );
      }

      const leases: Lease[] | undefined = res.data?.system?.leases;

      if ( !Array.isArray( leases ) || leases.length === 0 ) {
        throw new Error( 'Invalid lease documents!' );
      }

      const total = leases.length;

      if (
        Number.isNaN( total ) ||
        !Number.isFinite( total ) ||
        !Number.isInteger( total )
      ) {
        throw new Error( 'Invalid total count of lease documents!' );
      }

      // Safe pagination indices
      const safeIndex = PaginationUtil.safeIndex( index, total );
      const safeLimit = PaginationUtil.safeLimit( limit, total );
      const safeStart = safeIndex * safeLimit;
      const safeEnd = safeStart + safeLimit;
      const safeSearch = search ? search.trim().toLowerCase() : undefined;

      // Map to table rows
      const rows: ( PropertyTableData | null )[] = await Promise.all(
        leases.map( async ( lease ): Promise<PropertyTableData | null> => {
          return this.organiseTableRow( lease );
        } ),
      );

      const sanitisedRows: PropertyTableData[] = rows.filter(
        ( row ): row is PropertyTableData => row !== null,
      );

      if ( !Array.isArray( sanitisedRows ) || sanitisedRows.length === 0 ) {
        throw new Error( 'Invalid sanitised lease documents' );
      }

      // Apply search + slice
      const paginatedRows: PropertyTableData[] = safeSearch
        ? this.searchTenantData( safeSearch, sanitisedRows ).slice(
          safeStart,
          safeEnd,
        )
        : sanitisedRows.slice( safeStart, safeEnd );

      if ( !Array.isArray( paginatedRows ) || paginatedRows.length === 0 ) {
        throw new Error( 'Invalid paginated lease documents' );
      }

      this.totalDataCountTenant = total;
      this.allDataTenant = paginatedRows;
    } catch ( error ) {
      console.error( error );
      this.handleGenericError( error, 'Unknown error while loading lease table.' );
    }
  }

  /**
   * In-memory search for tenant leases.
   * Filters by ID, leaseID, title, type, or address fields.
   */
  private searchTenantData(
    search: string,
    leases: PropertyTableData[],
  ): PropertyTableData[] {
    try {
      if ( !search.trim() ) {
        throw new Error( 'Invalid search!' );
      }

      if ( !Array.isArray( leases ) || leases.length === 0 ) {
        throw new Error( 'Invalid leases for search!' );
      }

      const safeSearch = search.trim().toLowerCase();

      const rows: PropertyTableData[] = leases.filter( ( lease ) =>
        lease.id.toLowerCase().trim().includes( safeSearch ) ||
        lease.leaseid.toLowerCase().trim().includes( safeSearch ) ||
        lease.title.toLowerCase().trim().includes( safeSearch ) ||
        lease.type.toLowerCase().trim().includes( safeSearch ) ||
        lease.address.city.toLowerCase().trim().includes( safeSearch ) ||
        lease.address.country.toLowerCase().trim().includes( safeSearch ) ||
        lease.address.houseNumber.toLowerCase().trim().includes( safeSearch ) ||
        lease.address.postcode.toLowerCase().trim().includes( safeSearch ) ||
        ( lease.address.stateOrProvince &&
          lease.address.stateOrProvince
            .toLowerCase()
            .trim()
            .includes( safeSearch ) ) ||
        ( lease.address.street &&
          lease.address.street.toLowerCase().trim().includes( safeSearch ) ),
      );

      if ( !Array.isArray( rows ) || rows.length === 0 ) {
        throw new Error( 'No data found!' );
      }

      return rows;
    } catch ( error ) {
      console.error( error );
      return [];
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Mapping Lease → PropertyTableData (shared by admin + tenant loaders)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Given a Lease, fetch minimal property info and build a PropertyTableData row.
   * If anything fails, returns null so that callers can safely filter it out.
   */
  private async organiseTableRow(
    data: Lease,
  ): Promise<PropertyTableData | null> {
    try {
      const propertyID: Lease[ 'leaseID' ] | undefined = data.propertyID;

      if ( !propertyID ) {
        throw new Error( 'Invalid property ID!' );
      }

      // Ask backend only for the fields we need for the table
      const propertyRes = await this.propertyService.getPropertySectionById(
        propertyID,
        [ 'images', 'title', 'address', 'type' ],
      );

      if ( !propertyRes.success || propertyRes.status.toLowerCase() !== 'success' ) {
        throw new Error( 'Failed to fetch section of the property!' );
      }


      const values = this.apiService.extractObjectFromOther<{
        images?: BackEndPropertyData[ 'images' ];
        title?: BackEndPropertyData[ 'title' ];
        type?: BackEndPropertyData[ 'type' ];
        address?: BackEndPropertyData[ 'address' ];
      }>( propertyRes.data, 'values' );

      if ( !values ) {
        throw new Error( 'Property section payload is missing!' );
      }

      const images: BackEndPropertyData[ 'images' ] | undefined = values.images;

      const image: string | undefined =
        Array.isArray( images ) && images.length > 0
          ? images[ 0 ].imageURL
          : undefined;

      const title: BackEndPropertyData[ 'title' ] | undefined = values.title;
      const type: BackEndPropertyData[ 'type' ] | undefined = values.type;
      const address: BackEndPropertyData[ 'address' ] | undefined = values.address;

      if ( !image || !title || !type || !address ) {
        throw new Error(
          'One or more required property fields are missing (image/title/type/address).',
        );
      }

      const id: BackEndPropertyData[ 'id' ] = propertyID;
      const leaseid: Lease[ 'leaseID' ] = data.leaseID;

      const viewButton: TableButton = {
        action: 'view',
        icon: 'visibility',
        label: 'View',
      };

      const addButton: TableButton = {
        action: 'add',
        icon: 'add_circle',
        label: 'Add',
      };

      const row: PropertyTableData = {
        image,
        id,
        leaseid,
        title,
        type,
        address,
        viewButton,
        addButton,
      };

      return row;
    } catch ( error ) {
      console.error( '[organiseTableRow] error:', error );

      // Optional: per-row notifications
      this.handleGenericError( error, 'Error while building table row.' );
      return null;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lease / Property resolver (used for pre-selecting from route params)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Fetch a single Lease by leaseID and then register its property.
   */
  private async loadLease( leaseId: string ): Promise<void> {
    try {
      if ( !leaseId.trim() ) {
        throw new Error( 'Invalid lease ID!' );
      }

      const safeLeaseId = leaseId.trim();

      const leaseRes = await this.tenantService.getLeaseAgreementByLeaseID(
        safeLeaseId,
      );

      if ( leaseRes.status !== 'success' ) {
        throw new Error( 'Failed to fetch lease data!' );
      }

      const lease: Lease | undefined = leaseRes.data?.system?.lease;

      if ( !lease ) {
        throw new Error( 'Invalid lease data' );
      }

      this._leaseId = lease.leaseID;
      await this.registerProperty( lease.propertyID ?? '' );
    } catch ( error ) {
      console.error( '[Loading lease] error:', error );
      this.handleGenericError( error, 'Error while loading lease.' );
    }
  }

  /**
   * Fetch a full property by ID and store it as the currently selected property.
   */
  private async registerProperty( propertyID: string ): Promise<void> {
    try {
      if ( !propertyID.trim() ) {
        throw new Error( 'Invalid property ID!' );
      }

      const propertyRes = await this.propertyService.getPropertyById(
        propertyID.trim(),
      );

      if ( !propertyRes.success || propertyRes.status.toLowerCase() !== 'success' ) {
        throw new Error( 'Failed to fetch section of the property!' );
      }

      if ( !propertyRes.data?.system?.property ) {
        throw new Error( 'Invalid property data' );
      }

      this._selectedProperty = propertyRes.data.system.property;
      this._propertyId = this._selectedProperty.id;
      this._propertyName = this._selectedProperty.title;
    } catch ( error ) {
      console.error( error );
      this.handleGenericError( error, 'Error while registering property.' );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Action button operations (Admin only)
  // ───────────────────────────────────────────────────────────────────────────

  protected async actionButtonOperations(
    value: TableButtonActionConfig,
  ): Promise<void> {
    try {
      if ( !value ) {
        throw new Error( 'Data retrieve invalid!' );
      }

      const action: TableButtonActionConfig[ 'action' ] = value.action;
      const data: TableButtonActionConfig[ 'data' ] = value.data;

      if ( !data ) {
        throw new Error( 'Invalid values!' );
      }

      const propertyID = data.id;

      switch ( action ) {
        case 'view':
          await this.router.navigate( [
            '/dashboard/properties/property-view/',
            propertyID,
          ] );
          break;

        case 'add':
          this._leaseId = data.leaseid;
          await this.registerProperty( propertyID );
          break;
      }
    } catch ( error ) {
      console.error( error );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // File upload helpers (drag & drop queue callbacks)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Fired when the dropzone queue changes (full File[] list).
   * We map it to PendingAttachmentClient[] for submit().
   */
  protected onQueueChanged( files: File[] ): void {
    const validatedFiles: File[] = this.filterAndValidateFiles( files );

    this.pendingAttachments = validatedFiles.map(
      ( file ): PendingAttachmentClient =>
        this.buildPendingAttachment( file, 'dragdrop' ),
    );
  }

  /** Fired when new files are added – good place to show a toast if needed. */
  protected onNewFiles( files: File[] ): void {
    const validatedFiles: File[] = this.filterAndValidateFiles( files );

    this.pendingAttachments = [
      ...this.pendingAttachments,
      ...validatedFiles.map(
        ( file ): PendingAttachmentClient =>
          this.buildPendingAttachment( file, 'dragdrop' ),
      ),
    ];
  }

  /** Fired when one file is removed from queue. */
  protected onRemovedFile( file: File ): void {
    this.pendingAttachments = this.pendingAttachments.filter(
      ( p ) => p.file !== file,
    );
  }

  /** Trigger the hidden file input from a button in the template. */
  protected openFileDialog(): void {
    if ( !this.isBrowser ) {
      return;
    }

    if ( this.fileUpload?.nativeElement ) {
      this.fileUpload.nativeElement.value = '';
      this.fileUpload.nativeElement.click();
    }
  }

  /** Handle manual file selection from the hidden input. */
  protected onFileInputChange( event: Event ): void {
    const input = event.target as HTMLInputElement | null;
    if ( !input || !input.files ) {
      return;
    }

    const files: File[] = Array.from( input.files );
    const validatedFiles: File[] = this.filterAndValidateFiles( files );

    this.pendingAttachments = [
      ...this.pendingAttachments,
      ...validatedFiles.map(
        ( file ): PendingAttachmentClient =>
          this.buildPendingAttachment( file, 'filesystem' ),
      ),
    ];
  }


  private buildPendingAttachment(
    file: File,
    source: AttachmentSource,
  ): PendingAttachmentClient {
    return {
      source,
      file,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Submit complaint
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Builds CreateComplaintPayload + File[] and calls TenantService.createComplaint.
   * Handles minimal UI validation and redirects to complaint view on success.
   */
  protected async submit(): Promise<void> {
    try {
      if ( !this.loggedUser ) {
        this.notification?.notification( 'error', 'Not logged in.' );
        return;
      }

      // Minimal validation – can later be upgraded to Angular Validators
      if ( !this.title?.trim() ) {
        this.notification?.notification(
          'warning',
          'Please enter a complaint title.',
        );
        return;
      }

      const category = this.category;
      if ( !category ) {
        this.notification?.notification(
          'warning',
          'Please select a category.',
        );
        return;
      }

      if ( !this._propertyId || !this._leaseId || !this._tenantID ) {
        this.notification?.notification(
          'warning',
          'Please select a property/lease.',
        );
        return;
      }

      // Build payload (must match backend DTO)
      const payload: CreateComplaintPayload = {
        tenantId: this._tenantID,
        propertyId: this._propertyId,
        leaseId: this._leaseId,
        title: this.title.trim(),
        description: ( this.description ?? '' ).trim(),
        category,
        priority: this._priority,
        status: this._status,
        assigneeId: this._assigneeId,
        dueAt: this._dueAt,
        code: undefined,
        tenantName: this._tenantName,
        propertyName: this._propertyName,
        assigneeName: this._assigneeName,
        // createdAt not always needed on client, but kept here if DTO expects it:
        // createdAt: this._createdAt,
      };

      // Extract File[] from pendingAttachments
      const files: File[] = this.pendingAttachments.map( ( p ) => p.file );

      // Call backend – show progress bar while uploading
      this.progressBar.start();
      const resp = await this.tenantService.createComplaint( payload, files );

      if ( resp.status === 'success' ) {
        this.notification?.notification( 'success', 'Complaint created.' );

        // Reset form (minimal)
        this.title = '' as ComplaintClient[ 'title' ];
        this.description = '' as ComplaintClient[ 'description' ];
        this.category = undefined;
        this.pendingAttachments = [];

        const complaint = resp.data?.system?.complaint;

        if ( !complaint ) {
          throw new Error( 'Invalid complaint data!' );
        }

        // Redirect to complaint view (if code returned) or list
        setTimeout( async () => {
          if ( complaint.code ) {
            await this.router.navigate( [
              '/dashboard/tenant/complaints/view-complaint/',
              complaint.code,
            ] );
          } else {
            await this.router.navigate( [ '/dashboard/tenant/complaints' ] );
          }
        }, 1000 );

        return;
      }

      this.notification?.notification(
        'error',
        resp.message || 'Failed to create complaint.',
      );
    } catch ( error ) {
      console.error( error );
      this.notification?.notification(
        'error',
        'Unexpected error during submission.',
      );
    } finally {
      this.progressBar.complete();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Use tenant user object to set _tenantID / _tenantName safely
   * without relying on a specific User shape.
   */
  private registerTenantContext( user: User ): void {
    const raw = user as unknown as {
      _id?: string;
      id?: string;
      username?: string;
      fullName?: string;
      fullname?: string;
    };

    const tenantId: string | undefined = raw.id ?? raw._id;
    const tenantName: string | undefined =
      raw.fullName ?? raw.fullname ?? raw.username ?? tenantId;

    if ( !tenantId ) {
      throw new Error( 'Tenant ID is missing on user object.' );
    }

    this._tenantID = tenantId as ComplaintClient[ 'tenantId' ];
    this._tenantName = ( tenantName ?? tenantId ) as ComplaintClient[ 'tenantName' ];
  }

  /**
   * Optionally treat logged user as default assignee (common for admin/operator).
   */
  private registerAssigneeFromLoggedUser(): void {
    if ( !this.loggedUser ) {
      return;
    }

    const raw = this.loggedUser as unknown as {
      _id?: string;
      id?: string;
      username?: string;
      fullName?: string;
      fullname?: string;
    };

    const assigneeId: string | undefined = raw.id ?? raw._id;
    const assigneeName: string | undefined =
      raw.fullName ?? raw.fullname ?? raw.username;

    if ( assigneeId ) {
      this._assigneeId = assigneeId as ComplaintClient[ 'assigneeId' ];
    }

    if ( assigneeName ) {
      this._assigneeName =
        assigneeName as ComplaintClient[ 'assigneeName' ];
    }
  }

  /**
   * Validate a single file against mime/size/limit.
   * Returns error message string or null if OK.
   */
  private validateFile( file: File ): string | null {
    if ( !this.ALLOWED_MIME.includes( file.type ) ) {
      return `File type not allowed: ${ file.name }`;
    }

    if ( file.size > this.MAX_FILE_SIZE_BYTES ) {
      return `File too large: ${ file.name }`;
    }

    if ( this.pendingAttachments.length >= this.MAX_FILES ) {
      return `Maximum of ${ this.MAX_FILES } files reached.`;
    }

    return null;
  }

  /**
   * Run validateFile on a list and emit notifications for failures.
   */
  private filterAndValidateFiles( files: File[] ): File[] {
    const valid: File[] = [];

    for ( const file of files ) {
      const error = this.validateFile( file );

      if ( error ) {
        this.notification?.notification( 'warning', error );
      } else {
        valid.push( file );
      }
    }

    return valid;
  }

  /**
   * Standardised error handler for service calls in this component.
   */
  private handleGenericError( error: unknown, fallback: string ): void {
    if ( error instanceof HttpErrorResponse ) {
      this.notification?.notification( 'error', error.message );
    } else if ( error instanceof Error ) {
      this.notification?.notification( 'error', error.message );
    } else {
      this.notification?.notification( 'error', fallback );
    }
  }
}
