// ============================================================================
// Path: src/app/pages/tenant/home/home.component.ts
// Description:
//  Tenant home page:
//    - Section 01: Admin / Non-tenant users table
//    - Section 02: Tenant users table
//    - Section 03: Tenant leases table (current user's leases)
// Notes:
//  - Class-based only (no standalone functions).
//  - SSR/Electron safe: browser-only logic is guarded with isBrowser.
// ============================================================================

import {
  CommonModule,
  isPlatformBrowser,
} from '@angular/common';

import {
  HttpErrorResponse,
} from '@angular/common/http';

import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';

import {
  MatBadgeModule,
} from '@angular/material/badge';

import {
  MatButtonModule,
} from '@angular/material/button';

import {
  MatDialog,
} from '@angular/material/dialog';

import {
  ActivatedRoute,
  Router,
  RouterModule,
} from '@angular/router';

import {
  Subscription,
  firstValueFrom,
} from 'rxjs';

import * as FileSaver from 'file-saver';
import * as XLSX from 'xlsx';

import {
  ConfirmationComponent,
} from '../../../components/shared/confirmation/confirmation.component';

import {
  NotificationDialogComponent,
} from '../../../components/dialogs/notificationBar/notificationBar.component';

import {
  ProgressBarComponent,
} from '../../../components/dialogs/progress-bar/progress-bar.component';

import {
  CustomTableComponent,
  FileExport,
  TableButton,
  TableButtonActionConfig,
  TableColumn,
} from '../../../components/shared/custom-table/custom-table.component';

import {
  APIsService,
  User,
} from '../../../services/APIs/apis.service';

import {
  AuthService,
} from '../../../services/auth/auth.service';

import {
  WindowsRefService,
} from '../../../services/windowRef/windowRef.service';

import {
  Lease,
  LeaseWithProperty,
  TenantService,
} from '../../../services/tenant/tenant.service';

import {
  BackEndPropertyData,
  PropertyService,
} from '../../../services/property/property.service';

import {
  PaginationUtil,
} from '../../../source/utility/pagination.util';

/* ========================================================================
   INTERFACES
   ======================================================================== */

export interface AdminTableElement {
  username?: string;
  name: string;
  image: string;
  contactNumber: string;
  email: string;
  gender: string;
  addedBy?: string;
}

export interface TenantHomeButtonDataType {
  type: string;
  username?: string;
  name: string;
  image: string;
  contactNumber: string;
  email: string;
  gender: string;
  addedBy?: string;
}

interface LeaseTableDataType {
  image: string;
  leaseid: string;

  dateRange: {
    start: Date;
    end: Date;
  };

  status: string;
  monthlyRent: string;
  remaningDays: number;
  notify: boolean;

  viewButton: TableButton;
  downloadButton: TableButton;
}

/* ========================================================================
   COMPONENT
   ======================================================================== */

@Component( {
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NotificationDialogComponent,
    ProgressBarComponent,
    CustomTableComponent,
    MatBadgeModule,
    MatButtonModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
} )
export class HomeComponent implements OnInit, OnDestroy {

  /* ======================================================================
     VIEW CHILDREN (DIALOGS / PROGRESS)
     ====================================================================== */

  @ViewChild( ProgressBarComponent, { static: true } )
  progressBarComponent!: ProgressBarComponent;

  @ViewChild( NotificationDialogComponent, { static: true } )
  notificationDialog!: NotificationDialogComponent;

  /* ======================================================================
     COMMON / SHARED STATE
     ====================================================================== */

  // Global loading state for this page
  private _isLoading: boolean = false;

  protected mode: boolean | null = null;
  protected isBrowser: boolean;

  protected loggedUser: User | null = null;

  protected allUsers: User[] | null = [];

  // All properties (not only for leases) – currently unused but kept for future use
  private properties!: BackEndPropertyData[];

  // Properties linked to leases (for export)
  private leaseProperties: BackEndPropertyData[] = [];

  private readonly defaultUserImage: string =
    'Images/user-images/dummy-user/dummy-user.jpg';

  // Fixed "today" for remaining days calculation
  private readonly today: Date = new Date();

  /* ======================================================================
     SECTION 01 — ADMIN / NON-TENANTS TABLE
     ====================================================================== */

  protected adminTableDisplay: boolean = false;

  private _adminPageSize: number = 2;
  private _adminPageSizeOptions: number[] = [ 2, 4, 6 ];
  private _adminPageIndex: number = 0;
  private _adminSearch: string = '';

  protected adminTableTitle: string = 'Non-Tenants Table';
  protected adminTotalDataCount: number = 0;

  protected adminData: AdminTableElement[] = [];
  protected adminsFull: AdminTableElement[] = [];

  protected adminColumns: TableColumn[] = [
    { label: 'Image', key: 'userimage' },
    { label: 'Name', key: 'name' },
    { label: 'Email', key: 'email' },
    { label: 'Contact Number', key: 'contactNumber' },
    { label: 'Gender', key: 'gender' },
    { label: 'View', key: 'viewButton' },
    { label: 'Add', key: 'addButton' },
  ];

  protected adminActionButtons: TableButton[] = [
    { action: 'view', icon: 'visibility', label: 'View' },
    { action: 'add', icon: 'add_circle', label: 'Add' },
  ];

  public adminFileExportExtension: FileExport[ 'extention' ] = 'xlsx';

  /* ======================================================================
     SECTION 02 — TENANTS TABLE
     ====================================================================== */

  protected tenantTableDisplay: boolean = false;

  private _tenantPageSize: number = 2;
  private _tenantPageSizeOptions: number[] = [ 2, 4, 6 ];
  private _tenantPageIndex: number = 0;
  private _tenantSearch: string = '';

  protected tenantTableTitle: string = 'Tenants Table';
  protected tenantTotalDataCount: number = 0;

  protected tenantData: AdminTableElement[] = [];
  protected tenantsFull: AdminTableElement[] = [];

  protected tenantColumns: TableColumn[] = [
    { label: 'Image', key: 'userimage' },
    { label: 'Name', key: 'name' },
    { label: 'Email', key: 'email' },
    { label: 'Contact Number', key: 'contactNumber' },
    { label: 'Gender', key: 'gender' },
    { label: 'View', key: 'viewButton' },
    { label: 'Remove', key: 'removeButton' },
  ];

  protected tenantActionButtons: TableButton[] = [
    { action: 'view', icon: 'visibility', label: 'View' },
    { action: 'remove', icon: 'remove_circle', label: 'Remove' },
  ];

  protected tenantFileExportExtension: FileExport[ 'extention' ] = 'xlsx';

  /* ======================================================================
     SECTION 03 — LEASE TABLE (TENANT LEASES)
     ====================================================================== */

  protected userLeases: Lease[] = [];

  // Full list of lease rows, before pagination
  private allLeasesUnderLoggedUser: LeaseTableDataType[] = [];

  protected leaseTableDisplay: boolean = false;
  protected leaseTotalDataCount: number = 0;

  private _leaseTableIsReloading: boolean = false;
  private _leaseTablePageIndex: number = 0;
  private _leaseTabletSearch: string = '';

  private _leaseTablePageSize: number = 2;
  private _leaseTablePageSizeOptions: number[] = [ 2, 4, 6 ];

  protected leaseTableTitle: string = 'Tenant Leases';
  protected leaseFileExtension: FileExport[ 'extention' ] = 'xlsx';

  protected leaseActionButtons: TableButton[] = [
    { action: 'view', icon: 'visibility' },
    { action: 'download', icon: 'download' },
  ];

  protected leaseTableData: LeaseTableDataType[] = [];

  protected leaseTableColumns: TableColumn[] = [
    { label: 'Image', key: 'propertyimage' },
    { label: 'Lease ID', key: 'leaseid' },
    { label: 'Date Range', key: 'daterange' },
    { label: 'Lease Status', key: 'status' },
    { label: 'Monthly Rent', key: 'monthlyRent' },
    { label: 'Remaining Days', key: 'remaningDays' },
    { label: 'View', key: 'viewButton' },
    { label: 'Download', key: 'downloadButton' },
  ];

  /* ======================================================================
     CONSTRUCTOR / LIFECYCLE
     ====================================================================== */

  private routeSubscription?: Subscription;

  constructor (
    private windowRef: WindowsRefService,

    @Inject( PLATFORM_ID )
    private platformId: Object,

    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private apiService: APIsService,
    private dialog: MatDialog,
    private tenantService: TenantService,
    private propertyService: PropertyService,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    // Keep subscription reference to clean up later
    this.routeSubscription = this.route.url.subscribe( () => {
      // Placeholder: handle URL segments if needed
    } );

    this.loggedUser = this.authService.getLoggedUser;
  }

  /**
   * ngOnInit
   *  - Load all three sections: Admin (non-tenants), Tenants, and Leases.
   */
  async ngOnInit(): Promise<void> {
    try {
      this.isLoading = true;

      // SECTION 01: Non-tenants (Admin table)
      await this.organiseAdmintable( 0, this._adminPageSize );

      // SECTION 02: Tenants table
      await this.organisTenantTable( 0, this._tenantPageSize );

      // SECTION 03: Logged user leases
      await this.loggeUserLeases();
    }
    finally {
      this.isLoading = false;
    }
  }

  /**
   * ngOnDestroy
   *  - Clean up subscriptions.
   */
  ngOnDestroy(): void {
    if ( this.routeSubscription ) {
      this.routeSubscription.unsubscribe();
    }
  }

  /* ======================================================================
     COMMON GETTERS / SETTERS
     ====================================================================== */

  protected get isLoading(): boolean {
    return this._isLoading;
  }

  // NOTE:
  //  - Setter ONLY updates the flag now.
  //  - No hidden reloads (to avoid recursion / unexpected calls).
  protected set isLoading( value: boolean ) {
    this._isLoading = value;
  }

  /* ======================================================================
     SMALL SHARED HELPERS
     ====================================================================== */

  /**
   * ensureValidInteger
   *  - Basic guard for non-negative integer values.
   */
  private ensureValidInteger(
    value: number,
    fieldName: string,
  ): void {
    if (
      Number.isNaN( value ) ||
      !Number.isFinite( value ) ||
      !Number.isInteger( value ) ||
      value < 0
    ) {
      throw new Error( `Invalid ${ fieldName }` );
    }
  }

  /**
   * normalizeSearch
   *  - Common search normaliser used by admin / tenant tables.
   */
  private normalizeSearch(
    search?: string,
  ): string | undefined {
    if ( typeof search !== 'string' ) return undefined;

    const trimmed: string = search.trim();
    return trimmed.length > 0 ? trimmed.toLowerCase() : undefined;
  }

  /* ======================================================================
     COMMON OPERATIONS (USED BY MULTIPLE SECTIONS)
     ====================================================================== */

  /**
   * isAllowed
   *  - Returns true if the logged user has any of the elevated roles.
   */
  protected get isAllowed(): boolean {
    if ( !this.loggedUser ) {
      return false;
    }

    const roles: string[] = [ 'admin', 'operator', 'manager' ];
    return roles.includes( this.loggedUser.role );
  }

  /**
   * handleFileExport
   *  - Handles export requests triggered from the Admin table.
   */
  protected handleFileExport(
    value: FileExport,
    type: string,
  ): void {
    try {
      if ( !type || typeof type !== 'string' ) {
        throw new Error( 'Invalid export name type!' );
      }

      if ( !value ) {
        throw new Error( 'Invalid export data!' );
      }

      if ( this.adminData.length === 0 ) {
        throw new Error( 'No admin users found to export!' );
      }

      this.exportTableData( value, type );
    }
    catch ( error ) {
      console.error( error );
      this.handleError( error, 'Failed to load file data.' );
    }
  }

  /**
   * exportTableData
   *  - Generic table export helper for Admin / Tenant tables.
   *  - Builds a normalized JSON array and generates an Excel/CSV file.
   */
  private exportTableData(
    data: FileExport,
    typeOfTenant: string,
  ): void {
    const fileExtention = data.extention;
    const fileData = data.data;

    if ( !Array.isArray( fileData ) || fileData.length === 0 ) {
      console.warn( 'No data to export.' );
      return;
    }

    // Collect unique keys from all items
    const rawColumns: string[] = Array.from(
      new Set(
        fileData.flatMap( ( item ) => Object.keys( item ) ),
      ),
    );

    // Map raw keys → Display labels
    const keyMap: Record<string, string> = {};
    rawColumns.forEach( ( key: string ): void => {
      keyMap[ key ] = key.charAt( 0 ).toUpperCase() + key.slice( 1 );
    } );

    const columns: string[] = Object.values( keyMap );

    // Normalize each row to use display labels
    const exportData: Record<string, unknown>[] = fileData.map( ( item ) => {
      const normalizedRow: Record<string, unknown> = {};

      for ( const rawKey in keyMap ) {
        const displayKey = keyMap[ rawKey ];
        normalizedRow[ displayKey ] = ( item as Record<string, unknown> )[ rawKey ] ?? '';
      }

      return normalizedRow;
    } );

    // Only handle Excel-compatible types here
    if ( this.isExcel( fileExtention ) ) {
      const worksheet = XLSX.utils.json_to_sheet( exportData );

      // Auto column widths
      worksheet[ '!cols' ] = columns.map( ( col ) => ( {
        wch: col.length + 10,
      } ) );

      const workbook: XLSX.WorkBook = {
        Sheets: { Export: worksheet },
        SheetNames: [ 'Export' ],
      };

      const bookTypeMap: { [ key: string ]: XLSX.BookType; } = {
        xls: 'xls',
        xlsx: 'xlsx',
        xlsm: 'xlsm',
        xltx: 'xlsx',
        ods: 'ods',
        csv: 'csv',
        tsv: 'csv',
      };

      const safeExt: string = fileExtention.toLowerCase().trim();
      const bookType: XLSX.BookType = bookTypeMap[ safeExt ] || 'xlsx';

      const excelBuffer: ArrayBuffer = XLSX.write(
        workbook,
        {
          bookType,
          type: 'array',
        },
      );

      const mimeMap: { [ key: string ]: string; } = {
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls: 'application/vnd.ms-excel',
        csv: 'text/csv',
        ods: 'application/vnd.oasis.opendocument.spreadsheet',
      };

      const mimeType: string = mimeMap[ safeExt ] || mimeMap[ 'xlsx' ];

      const blob: Blob = new Blob(
        [ excelBuffer ],
        { type: mimeType },
      );

      FileSaver.saveAs(
        blob,
        `${ typeOfTenant }_Export_${ new Date().toISOString() }.${ fileExtention }`,
      );
    }
  }

  /**
   * isExcel
   *  - Returns true if the provided extension is supported for Excel export.
   */
  private isExcel(
    type: string,
  ): boolean {
    switch ( type.toLowerCase().trim() ) {
      case 'xls':
      case 'xlsx':
      case 'xlsm':
      case 'xlt':
      case 'xltx':
      case 'ods':
      case 'csv':
      case 'tsv':
        return true;
      default:
        return false;
    }
  }

  /* ======================================================================
     SECTION 01 — ADMIN (NON-TENANTS) GETTERS / SETTERS
     ====================================================================== */

  get adminPageSize(): number {
    return this._adminPageSize;
  }

  set adminPageSize( value: number ) {
    this._adminPageSize = value;
    this.organiseAdmintable(
      this._adminPageIndex,
      this._adminPageSize,
      this._adminSearch,
    );
  }

  get adminPageSizeOptions(): number[] {
    return this._adminPageSizeOptions;
  }

  set adminPageSizeOptions( value: number[] ) {
    this._adminPageSizeOptions = value;
  }

  get adminPageIndex(): number {
    return this._adminPageIndex;
  }

  set adminPageIndex( value: number ) {
    this._adminPageIndex = value;
    this.organiseAdmintable(
      this._adminPageIndex,
      this._adminPageSize,
      this._adminSearch,
    );
  }

  get adminSearch(): string {
    return this._adminSearch;
  }

  set adminSearch( value: string ) {
    this._adminSearch = value;
    this.organiseAdmintable(
      this._adminPageIndex,
      this._adminPageSize,
      this._adminSearch,
    );
  }

  /* ======================================================================
     SECTION 01 — ADMIN (NON-TENANTS) METHODS
     ====================================================================== */

  /**
   * organiseAdmintable
   *  - Fetches and prepares paginated user data for the Admin / Non-tenants table.
   */
  private async organiseAdmintable(
    index: number,
    size: number,
    search?: string,
  ): Promise<void> {
    try {
      this.adminTableDisplay = false;
      this.isLoading = true;

      // Reset current page data
      this.adminData = [];

      // Validate index
      this.ensureValidInteger( index, 'index' );

      const safeSearch: string | undefined = this.normalizeSearch( search );

      // 3) Fetch total user count
      const countRes = await this.tenantService.getAllNoneTenantsCount();

      if ( countRes.status !== 'success' ) {
        throw new Error( 'Failed to count total users' );
      }

      const count: number | undefined = countRes.data?.pagination?.total;

      if ( typeof count !== 'number' ) {
        throw new Error( 'Invalid count' );
      }

      this.ensureValidInteger( count, 'count' );

      this.adminTotalDataCount = count;

      // 4) Pagination calculations
      const safeIndex: number = PaginationUtil.safeIndex( index, count );
      const safeLimit: number = PaginationUtil.safeLimit( size, count );
      const safeStart: number = safeIndex * safeLimit;

      // 5) Fetch paginated user list
      const res = await this.tenantService.getAllNoneTenantsWithPagination(
        safeStart,
        safeLimit,
        safeSearch,
      );

      if ( res.status !== 'success' || !Array.isArray( res.data?.system?.users ) ) {
        throw new Error( 'Failed to process user fetching in admin table' );
      }

      const users = res.data.system.users;

      if ( users.length === 0 ) {
        // No users for this page; table remains empty
        return;
      }

      // 6) Transform raw users → table rows
      for ( const user of users ) {
        const rawGender: string = String( user.gender ?? '' ).toLowerCase();

        const gender: string =
          rawGender === 'male' || rawGender === 'female'
            ? rawGender
            : 'unknown';

        const namePrefix: string =
          gender === 'male' ? 'Mr.' : 'Ms.';

        const name: string = namePrefix
          ? `${ namePrefix } ${ user.name }`
          : user.name;

        const image: string = String( user.image ?? this.defaultUserImage );
        const contactNumber: string = String( user.phoneNumber ?? '' );
        const email: string = String( user.email ?? '' );
        const username: string = String( user.username ?? '' );

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

        const row: AdminTableElement & {
          viewButton: TableButton;
          addButton: TableButton;
        } = {
          image,
          name,
          gender,
          email,
          contactNumber,
          username,
          addedBy: user.creator,
          viewButton,
          addButton,
        };

        this.adminData.push( row );
      }
    }
    catch ( error ) {
      console.error( 'Error organizing users table data:', error );
      this.handleError( error, 'Failed to load admin users.' );
    }
    finally {
      this.adminTableDisplay = true;
      setTimeout( (): void => {
        this.isLoading = false;
      }, 500 );
    }
  }

  /**
   * adminActionButtonCenter
   *  - Central handler for Admin table actions (view / add).
   */
  protected async adminActionButtonCenter(
    value: TableButtonActionConfig,
  ): Promise<void> {
    try {
      if ( !value ) {
        throw new Error( 'Invalid admin button data' );
      }

      const action: string = value.action.trim().toLowerCase();
      const data = value.data;

      if ( !action ) {
        throw new Error( 'Invalid admin button action' );
      }

      if ( !Array.isArray( this.adminData ) || !this.adminData ) {
        throw new Error( 'Invalid user data!' );
      }

      switch ( action ) {
        case 'view': {
          try {
            const username: string | undefined = data.username;

            if ( !username || typeof username !== 'string' ) {
              throw new Error( 'Invalid username!' );
            }

            const resView = await this.apiService.generateToken( username );
            const token = this.apiService.extractTokenFromMsg( resView );

            if ( !token || typeof token !== 'string' ) {
              throw new Error( 'Invalid token!' );
            }

            await this.router.navigate( [ '/dashboard/users/user-profile', token ] );
          }
          catch ( error ) {
            console.error( error );
          }
          break;
        }

        case 'add': {
          await this.addTenant( data );
          break;
        }

        default:
          return;
      }
    }
    catch ( error ) {
      console.error( error );
      this.handleError( error, 'Failed to load user data.' );
    }
  }

  /**
   * addTenant
   *  - Converts a non-tenant user into a tenant (insertTenant API call).
   */
  protected async addTenant(
    data: AdminTableElement,
  ): Promise<void> {
    try {
      if ( !data ) {
        throw new Error( 'Invalid tenant data in insertion!' );
      }

      this.isLoading = true;
      this.progressBarComponent.start();

      const formData: FormData = new FormData();

      formData.append( 'username', data.username as string );
      formData.append( 'name', data.name );
      formData.append( 'image', data.image as string );
      formData.append( 'phoneNumber', data.contactNumber );
      formData.append( 'email', data.email );
      formData.append( 'gender', data.gender );
      formData.append( 'addedBy', data.addedBy as string );

      const res = await this.tenantService.insertTenant( formData );

      if ( res.status.toLowerCase() !== 'success' ) {
        throw new Error( 'Tenant insertion failed!' );
      }

      // Reload both admin and tenant tables
      await this.organiseAdmintable( this._adminPageIndex, this._adminPageSize, this._adminSearch );
      await this.organisTenantTable( this._tenantPageIndex, this._tenantPageSize, this._tenantSearch );
    }
    catch ( error ) {
      console.error( error );
      this.progressBarComponent.stop();
      this.handleError( error, 'Failed to load tenant data.' );
    }
    finally {
      this.progressBarComponent.complete();

      setTimeout( (): void => {
        this.isLoading = false;
      }, 500 );
    }
  }

  /* ======================================================================
     SECTION 02 — TENANTS GETTERS / SETTERS
     ====================================================================== */

  get tenantPageSize(): number {
    return this._tenantPageSize;
  }

  set tenantPageSize( value: number ) {
    this._tenantPageSize = value;

    this.organisTenantTable(
      this._tenantPageIndex,
      this._tenantPageSize,
      this._tenantSearch,
    );
  }

  get tenantPageSizeOptions(): number[] {
    return this._tenantPageSizeOptions;
  }

  set tenantPageSizeOptions( value: number[] ) {
    this._tenantPageSizeOptions = value;
  }

  get tenantPageIndex(): number {
    return this._tenantPageIndex;
  }

  set tenantPageIndex( value: number ) {
    this._tenantPageIndex = value;

    this.organisTenantTable(
      this._tenantPageIndex,
      this._tenantPageSize,
      this._tenantSearch,
    );
  }

  get tenantSearch(): string {
    return this._tenantSearch;
  }

  set tenantSearch( value: string ) {
    this._tenantSearch = value;

    this.organisTenantTable(
      this._tenantPageIndex,
      this._tenantPageSize,
      this._tenantSearch,
    );
  }

  /* ======================================================================
     SECTION 02 — TENANTS METHODS
     ====================================================================== */

  /**
   * organisTenantTable
   *  - Fetches and prepares paginated tenant data.
   */
  private async organisTenantTable(
    index: number,
    limit: number,
    search?: string,
  ): Promise<void> {
    try {
      this.tenantTableDisplay = false;
      this.isLoading = true;

      this.tenantData = [];

      const safeSearch: string | undefined = this.normalizeSearch( search );

      // 2) Get total tenant count
      const resTotal = await this.tenantService.getAllTenantsCount();

      if ( resTotal.status !== 'success' ) {
        throw new Error( 'Process tenant total count failed!' );
      }

      const total: number | undefined = resTotal.data?.pagination?.total;

      if ( !total || Number.isNaN( total ) || !Number.isInteger( total ) || !Number.isFinite( total ) ) {
        throw new Error( 'Invalid tenant total number!' );
      }

      this.ensureValidInteger( total, 'total tenant count' );

      this.tenantTotalDataCount = total;

      // 3) Pagination
      const safeIndex: number = PaginationUtil.safeIndex(
        index,
        this.tenantTotalDataCount,
      );

      const safeLimit: number = PaginationUtil.safeLimit(
        limit,
        this.tenantTotalDataCount,
      );

      const safeStart: number = safeIndex * safeLimit;

      if ( this.tenantTotalDataCount === 0 ) {
        // No tenants at all
        return;
      }

      // 4) Fetch paginated tenants
      const res = await this.tenantService.getAllTenantsWithPagination(
        safeStart,
        safeLimit,
        safeSearch,
      );

      if ( res.status !== 'success' || !Array.isArray( res.data?.system?.tenants ) ) {
        throw new Error( 'Tenant data process failed!' );
      }

      const tenants = res.data.system.tenants;

      if ( !Array.isArray( tenants ) ) {
        throw new Error( 'Invalid tenant list received from server!' );
      }

      if ( tenants.length === 0 ) {
        // No tenants for this page / filter
        return;
      }

      // 5) Build table rows
      for ( const user of tenants ) {
        const rawGender: string = String( user.gender ?? '' ).toLowerCase();

        const gender: string =
          rawGender === 'male' || rawGender === 'female'
            ? rawGender
            : 'unknown';

        const namePrefix: string =
          gender === 'male'
            ? 'Mr.'
            : gender === 'female'
              ? 'Ms.'
              : '';

        const name: string = namePrefix
          ? `${ namePrefix } ${ user.name }`
          : user.name;

        const image: string = String( user.image ?? this.defaultUserImage );
        const contactNumber: string = String( user.contactNumber ?? '' );
        const email: string = String( user.email ?? '' );
        const username: string = String( user.username ?? '' );

        const viewButton: TableButton = {
          action: 'view',
          icon: 'visibility',
          label: 'View',
        };

        const removeButton: TableButton = {
          action: 'remove',
          icon: 'remove_circle',
          label: 'Remove',
        };

        const row: AdminTableElement & {
          viewButton: TableButton;
          removeButton: TableButton;
        } = {
          image,
          name,
          gender,
          email,
          contactNumber,
          username,
          addedBy: user.addedBy,
          viewButton,
          removeButton,
        };

        this.tenantData.push( row );
      }
    }
    catch ( error ) {
      console.error( error );

      this.progressBarComponent.stop();
      this.handleError( error, 'Failed to load tenant data.' );
    }
    finally {
      this.tenantTableDisplay = true;

      setTimeout( (): void => {
        this.isLoading = false;
      }, 500 );
    }
  }

  /**
   * tenantActionButtonCenter
   *  - Central handler for Tenant table actions (view / remove).
   */
  protected async tenantActionButtonCenter(
    value: TableButtonActionConfig,
  ): Promise<void> {
    try {
      if ( !value ) {
        throw new Error( 'Invalid tenant button data' );
      }

      const action: string = value.action.trim().toLowerCase();
      const data = value.data;

      if ( !action ) {
        throw new Error( 'Invalid tenant button action' );
      }

      // IMPORTANT: use tenantData here (not adminData)
      if ( !Array.isArray( this.tenantData ) || !this.tenantData ) {
        throw new Error( 'Invalid tenant data!' );
      }

      switch ( action ) {
        case 'view': {
          try {
            const username = data.username;

            if ( !username || typeof username !== 'string' ) {
              throw new Error( 'Invalid username!' );
            }

            const resView = await this.apiService.generateToken( username );
            const token = this.apiService.extractTokenFromMsg( resView );

            if ( !token || typeof token !== 'string' ) {
              throw new Error( 'Invalid token!' );
            }

            await this.router.navigate( [ '/dashboard/tenant/tenant-view', token ] );
          }
          catch ( error ) {
            console.error( error );
          }
          break;
        }

        case 'remove': {
          await this.removeTenant( data );
          break;
        }

        default:
          return;
      }
    }
    catch ( error ) {
      console.error( error );
      this.progressBarComponent.stop();
      this.handleError( error, 'Failed to load tenant data.' );
    }
  }

  /**
   * removeTenant
   *  - Removes a tenant assigned to the system (deleteTenant API call).
   */
  private async removeTenant(
    data: AdminTableElement,
  ): Promise<void> {
    try {
      const dialogRef = this.dialog.open( ConfirmationComponent, {
        width: '400px',
        height: 'auto',
        data: {
          title: 'Do you wish to remove this tenant',
          body: 'All related activities and leases will be deleted!',
        },
      } );

      // Wait for the dialog result (true/false)
      const isConfirmed: boolean = await firstValueFrom(
        dialogRef.afterClosed(),
      );

      if ( !isConfirmed ) return;

      this.isLoading = true;
      this.progressBarComponent.start();

      if ( !this.loggedUser ) {
        throw new Error( 'Invalid login!' );
      }

      const loggedUsername: string = this.loggedUser.username.trim();

      if ( !loggedUsername || typeof loggedUsername !== 'string' ) {
        throw new Error( 'Invalid username' );
      }

      const tenantUsername: string | undefined = data.username?.trim();

      if ( !tenantUsername || typeof tenantUsername !== 'string' ) {
        throw new Error( 'Invalid tenant username' );
      }

      const res = await this.tenantService.deleteTenant(
        tenantUsername,
        loggedUsername,
      );

      if ( res.status !== 'success' ) {
        throw new Error( 'Failed to process tenant delete' );
      }

      this.notificationDialog.notification(
        'success',
        'Tenant deleted successful!',
      );

      await this.organiseAdmintable( this._adminPageIndex, this._adminPageSize, this._adminSearch );
      await this.organisTenantTable( this._tenantPageIndex, this._tenantPageSize, this._tenantSearch );
    }
    catch ( error ) {
      console.error( error );

      this.progressBarComponent.stop();
      this.handleError( error, 'Failed to load tenant data.' );
    }
    finally {
      this.progressBarComponent.complete();

      setTimeout( (): void => {
        this.isLoading = false;
      }, 500 );
    }
  }

  /* ======================================================================
     SECTION 03 — LEASES (TENANT LEASE VIEW)
     ====================================================================== */

  /**
   * loggeUserLeases
   *  - Loads all leases associated with the logged-in user and
   *    prepares initial lease table data.
   */
  protected async loggeUserLeases(): Promise<void> {
    try {
      if ( !this.loggedUser ) {
        throw new Error( 'Please login first!' );
      }

      const response = await this.tenantService.getAllLeaseAgreementsByUsername(
        this.loggedUser.username,
      );

      if ( response.status !== 'success' ) {
        throw new Error( response.message );
      }

      const rowLeases: Lease[] | undefined = response.data?.system?.leases;

      if ( !Array.isArray( rowLeases ) || rowLeases.length === 0 ) {
        this.notificationDialog.notification( 'warning', "You don't have any leases!" );
        throw new Error( "You don't have any leases!" );
      }

      this.userLeases = [ ...rowLeases ];

      if ( this.userLeases.length > 0 ) {
        await this.organizeLeaseTableData( this._leaseTablePageIndex, this._leaseTablePageSize );
      }
    }
    catch ( error ) {
      console.error( error );
      this.userLeases = [];
      // Optional: show notification here if you want
    }
  }

  /* ----------------------------------------------------------------------
     SECTION 03 — GETTERS / SETTERS
     ---------------------------------------------------------------------- */

  get leaseTablePageSize(): number {
    return this._leaseTablePageSize;
  }

  set leaseTablePageSize( value: number ) {
    this._leaseTablePageSize = value;
    this.organizeLeaseTableData( this._leaseTablePageIndex, this._leaseTablePageSize );
  }

  get leaseTablePageIndex(): number {
    return this._leaseTablePageIndex;
  }

  set leaseTablePageIndex( value: number ) {
    this._leaseTablePageIndex = value;
    this.organizeLeaseTableData( this._leaseTablePageIndex, this._leaseTablePageSize );
  }

  get leaseTabletSearch(): string {
    return this._leaseTabletSearch;
  }

  set leaseTabletSearch( value: string ) {
    this._leaseTabletSearch = value;
    this.leaseSearch( this._leaseTabletSearch );
  }

  get leaseTablePageSizeOptions(): number[] {
    return this._leaseTablePageSizeOptions;
  }

  set leaseTablePageSizeOptions( value: number[] ) {
    this._leaseTablePageSizeOptions = value;
  }

  /* ----------------------------------------------------------------------
     SECTION 03 — LEASE HANDLERS
     ---------------------------------------------------------------------- */

  /**
   * organizeLeaseTableData
   *  - Builds full lease table rows from user leases and property data,
   *    then applies pagination.
   */
  private async organizeLeaseTableData(
    index: number,
    size: number,
  ): Promise<void> {
    try {
      this.leaseTableDisplay = false;
      this.isLoading = true;

      if ( !this.loggedUser ) {
        throw new Error( 'Invalid logged user!' );
      }

      this.ensureValidInteger( index, 'index' );
      this.ensureValidInteger( size, 'size' );

      if ( !Array.isArray( this.userLeases ) || this.userLeases.length === 0 ) {
        throw new Error( "You don't have any leases!" );
      }

      const username: string = this.loggedUser.username?.trim() ?? '';
      if ( !username ) {
        throw new Error( 'Invalid username!' );
      }

      // Reset leaseProperties (will be refilled)
      this.leaseProperties = [];

      // Build lease rows in parallel
      const rowPromises: Array<Promise<LeaseTableDataType | null>> =
        this.userLeases.map(
          async ( lease: Lease ): Promise<LeaseTableDataType | null> => {
            try {
              const propertyID: string | undefined = lease.propertyID;

              if ( !propertyID ) {
                throw new Error( 'Invalid property ID!' );
              }

              const propertyRes = await this.propertyService.getPropertyById( propertyID );

              if ( !propertyRes || propertyRes.status !== 'success' ) {
                throw new Error( 'Failed to process property fetch!' );
              }

              const property: BackEndPropertyData | undefined = propertyRes.data?.system?.property;

              if ( !property ) {
                throw new Error( 'Invalid property!' );
              }

              // Store property for later Excel export (avoid duplicates by id)
              const alreadyExists = this.leaseProperties.some(
                ( p ) => p.id === property.id,
              );
              if ( !alreadyExists ) {
                this.leaseProperties.push( property );
              }

              const propertyImageURL: LeaseTableDataType[ 'image' ] =
                property.images?.[ 0 ]?.imageURL || '';

              const leaseID: LeaseTableDataType[ 'leaseid' ] = lease.leaseID;

              const dateRange: LeaseTableDataType[ 'dateRange' ] = {
                start: new Date( lease.leaseAgreement.startDate ),
                end: new Date( lease.leaseAgreement.endDate ),
              };

              const status: LeaseTableDataType[ 'status' ] =
                lease.systemMetadata.validationStatus.toLocaleLowerCase();

              const monthlyRent: LeaseTableDataType[ 'monthlyRent' ] =
                `${ lease.leaseAgreement.monthlyRent } ${ lease.leaseAgreement.currency.currency }`;

              const endTime: number = dateRange.end.getTime();
              const todayTime: number = this.today.getTime();
              const diffMs: number = endTime - todayTime;

              const remaningDays: LeaseTableDataType[ 'remaningDays' ] =
                Math.ceil( diffMs / ( 1000 * 60 * 60 * 24 ) );

              const notify: LeaseTableDataType[ 'notify' ] = remaningDays < 30;

              const viewButton: TableButton = {
                action: 'view',
                icon: 'visibility',
                label: 'View',
              };

              const downloadButton: TableButton = {
                action: 'download',
                icon: 'download',
                label: 'Download',
              };

              const data: LeaseTableDataType = {
                image: propertyImageURL,
                leaseid: leaseID,
                dateRange,
                status,
                monthlyRent,
                remaningDays,
                notify,
                viewButton,
                downloadButton,
              };

              return data;
            }
            catch ( error ) {
              console.error( 'Error building lease row:', error );
              return null;
            }
          },
        );

      const rowsWithNulls: Array<LeaseTableDataType | null> =
        await Promise.all( rowPromises );

      const leaseTableRows: LeaseTableDataType[] = rowsWithNulls.filter(
        ( row ): row is LeaseTableDataType => row !== null,
      );

      if ( leaseTableRows.length === 0 ) {
        throw new Error( 'Leases not found under the user!' );
      }

      this.allLeasesUnderLoggedUser = leaseTableRows;
      this.leaseTotalDataCount = this.allLeasesUnderLoggedUser.length;

      this.makeLeasePagination( index, size );
    }
    catch ( error ) {
      console.error( 'Error organizing lease table data:', error );

      this.notificationDialog.notification(
        'error',
        ( error as Error ).message,
      );
    }
    finally {
      this.leaseTableDisplay = true;

      setTimeout( (): void => {
        this.isLoading = false;
      }, 500 );
    }
  }

  /**
   * makeLeasePagination
   *  - Creates the visible page of leases from the full list.
   */
  private makeLeasePagination(
    index: number,
    size: number,
  ): void {
    try {
      this.ensureValidInteger( index, 'index' );
      this.ensureValidInteger( size, 'size' );

      this.leaseTableData = [];

      if ( this.allLeasesUnderLoggedUser.length === 0 ) {
        throw new Error( 'Leases not found under the user!' );
      }

      const total: number = this.allLeasesUnderLoggedUser.length;

      const pageSize: number = PaginationUtil.safeLimit( size, total );

      const safeIndex: number = PaginationUtil.safeIndex( index, total );

      const safeStart: number = safeIndex * pageSize;
      const safeEnd: number = Math.min( safeStart + pageSize, total );

      const data: LeaseTableDataType[] = this.allLeasesUnderLoggedUser.slice(
        safeStart,
        safeEnd,
      );

      this.leaseTableData = [ ...data ];
    }
    catch ( error ) {
      console.error( error );
    }
  }

  /**
   * handleLeaseOperations
   *  - Central handler for lease table actions (view / download).
   */
  protected async handleLeaseOperations(
    value: TableButtonActionConfig,
  ): Promise<void> {
    try {
      if ( this.authService.getLoggedUser === null ) {
        throw new Error( 'Please login first!' );
      }

      if ( !value ) {
        throw new Error( 'Invalid Button Operation' );
      }

      const buttonAction: string = value.action.toLocaleLowerCase().trim();
      const leaseID: string = value.data.leaseid.trim();

      if ( !leaseID ) {
        throw new Error( 'No lease ID found!' );
      }

      switch ( buttonAction ) {
        case 'view':
          await this.viewLease( leaseID );
          break;

        case 'download':
          await this.downloadLease( leaseID );
          break;

        default:
          return;
      }
    }
    catch ( error ) {
      console.error( error );
      this.notificationDialog.notification( 'error', String( error ) );
    }
  }

  /**
   * viewLease
   *  - Navigates to the lease view page for the given leaseId.
   */
  private async viewLease(
    leaseId: string,
  ): Promise<void> {
    try {
      if ( !leaseId ) {
        throw new Error( 'Invalid lease ID!' );
      }

      await this.router.navigate( [ '/dashboard/tenant/view-lease', leaseId ] );
    }
    catch ( err ) {
      console.error( 'Failed to view lease agreement:', err );
      this.handleError( err, 'Failed to open lease agreement.' );
    }
  }

  /**
   * leaseSearch
   *  - Filters leases by ID or status. Falls back to current page when empty.
   */
  private leaseSearch(
    search: string,
  ): void {
    try {
      const safeSearch: string = search.trim().toLowerCase();

      if ( !safeSearch ) {
        this.makeLeasePagination( this._leaseTablePageIndex, this._leaseTablePageSize );
        return;
      }

      // Use filter to support multiple results
      const searchData: LeaseTableDataType[] =
        this.allLeasesUnderLoggedUser.filter(
          ( lease ) =>
            lease.leaseid.toLowerCase().includes( safeSearch ) ||
            lease.status.toLowerCase().includes( safeSearch ),
        );

      if ( Array.isArray( searchData ) && searchData.length > 0 ) {
        this.leaseTableData = [ ...searchData ];
      }
      else {
        this.makeLeasePagination( this._leaseTablePageIndex, this._leaseTablePageSize );
      }
    }
    catch ( err ) {
      console.error( 'Failed to search lease data:', err );
      this.handleError( err, 'Failed to search lease data.' );
    }
  }

  /**
   * downloadLease
   *  - Downloads a lease agreement PDF for the given leaseId.
   *  - Browser-only (guarded for SSR/Electron).
   */
  private async downloadLease(
    leaseId: string,
  ): Promise<void> {
    try {
      if ( this.authService.getLoggedUser === null ) {
        throw new Error( 'Please login first!' );
      }

      if ( !leaseId ) {
        throw new Error( 'Invalid lease ID!' );
      }

      if ( !this.isBrowser ) {
        throw new Error( 'Downloading is only supported in browser environment.' );
      }

      this.progressBarComponent.start();

      const blob: Blob = await this.tenantService.downloadLeaseAgreement(
        leaseId,
        'download',
        this.authService.getLoggedUser.username,
      );

      const actualName: string = `${ leaseId }-lease-agreement.pdf`;

      const nativeWindow: Window | null = this.windowRef.nativeWindow;
      if ( !nativeWindow ) {
        throw new Error( 'Window object is not available.' );
      }

      const fileURL: string = URL.createObjectURL( blob );

      const anchor: HTMLAnchorElement = nativeWindow.document.createElement( 'a' );
      anchor.href = fileURL;
      anchor.download = actualName;
      anchor.style.display = 'none';

      nativeWindow.document.body.appendChild( anchor );
      anchor.click();
      nativeWindow.document.body.removeChild( anchor );

      URL.revokeObjectURL( fileURL );
    }
    catch ( err ) {
      console.error( 'Failed to download lease agreement PDF:', err );
      this.handleError( err, 'Failed to download lease agreement PDF.' );
    }
    finally {
      this.progressBarComponent.complete();
    }
  }

  /**
   * handleExportLeaseTableData
   *  - Exports lease data together with property data as an Excel/CSV file.
   */
  protected handleExportLeaseTableData(
    value: FileExport,
  ): void {
    try {
      if ( this.userLeases.length === 0 ) {
        throw new Error( 'No lease agreements found!' );
      }

      if ( this.leaseProperties.length === 0 ) {
        throw new Error( 'No properties found!' );
      }

      const leasesWithProperty: LeaseWithProperty[] = [];

      this.userLeases.forEach( ( lease ) => {
        const property = this.leaseProperties.find(
          ( p ) => p.id === lease.propertyID,
        );

        if ( !property ) {
          throw new Error( 'Property not found!' );
        }

        const leaseWithProperty: LeaseWithProperty = {
          ...lease,
          property,
        };

        leasesWithProperty.push( leaseWithProperty );
      } );

      if ( leasesWithProperty.length === 0 ) {
        throw new Error( 'No leases with property found!' );
      }

      this.exportLeasesDataAsExcel(
        leasesWithProperty,
        value.extention,
      );
    }
    catch ( error ) {
      console.error( error );
      this.handleError( error, 'Failed to load tenant data.' );
    }
  }

  /**
   * exportLeasesDataAsExcel
   *  - Converts LeaseWithProperty[] to a flattened structure and exports as Excel.
   */
  private exportLeasesDataAsExcel(
    leases: LeaseWithProperty[],
    fileExtension: FileExport[ 'extention' ] = 'xlsx',
  ): void {
    if ( !Array.isArray( leases ) || leases.length === 0 ) {
      console.warn( 'No lease data available for export.' );
      return;
    }

    const exportData: Record<string, unknown>[] = leases.map( ( lease ) => {
      const addr = lease.property?.address;

      return {
        leaseID: lease.leaseID,
        'Tenant name': lease.tenantInformation?.fullName ?? '',
        'Tenant email': lease.tenantInformation?.email ?? '',
        'Tenant contact': lease.tenantInformation?.phoneNumber ?? '',
        'Co-Tenant name': lease.coTenant?.fullName ?? '',
        'Co-Tenant relationship': lease.coTenant?.relationship ?? '',
        'Property title': lease.property?.title ?? '',
        'Property address':
          ( addr?.houseNumber ?? '' ) + ' ' +
          ( addr?.street ?? '' ) + ', ' +
          ( addr?.city ?? '' ) + ', ' +
          ( addr?.stateOrProvince ?? '' ) + ', ' +
          ( addr?.country ?? '' ),
        'Started date': new Date( lease.leaseAgreement.startDate ).toISOString(),
        'End date': new Date( lease.leaseAgreement.endDate ).toISOString(),
        'Monthly rent': lease.leaseAgreement.monthlyRent,
        'Rent currency': lease.leaseAgreement.currency?.currency ?? '',
        'Payment frequency': lease.leaseAgreement.paymentFrequency?.name ?? '',
        'Payment method': lease.leaseAgreement.paymentMethod?.name ?? '',
        'Deposit': lease.leaseAgreement.securityDeposit?.name ?? '',
        'Rent due date': lease.leaseAgreement.rentDueDate?.label ?? '',
        'Notice period': lease.leaseAgreement.noticePeriodDays?.label ?? '',
        'Late penalties': lease.leaseAgreement.latePaymentPenalties
          ?.map( ( p ) => p.label )
          .join( ',\n' ) ?? '',
        'Utility responsibilities': lease.leaseAgreement.utilityResponsibilities
          ?.map( ( u ) => u.utility + ': ' + u.paidBy )
          .join( ',\n' ) ?? '',
        'Rules and regulations': lease.rulesAndRegulations
          ?.map( ( r ) => r.rule )
          .join( ';\n' ) ?? '',
        'Tenant signature URL': ( lease.signatures.tenantSignature as any )?.URL ?? '',
        'Landlord signature URL': ( lease.signatures.landlordSignature as any )?.URL ?? '',
        'Signed At': new Date( lease.signatures.signedAt ).toISOString(),
        'Signed By': lease.signatures.userAgent?.name ?? '',
        'ip Address': lease.signatures.ipAddress ?? '',
        ocrStatus: lease.systemMetadata.ocrAutoFillStatus ? 'Yes' : 'No',
        validationStatus: lease.systemMetadata.validationStatus,
        leaseTemplateVersion: lease.systemMetadata.leaseTemplateVersion,
        lastUpdated: lease.systemMetadata.lastUpdated,
      };
    } );

    const worksheet = XLSX.utils.json_to_sheet( exportData );

    worksheet[ '!cols' ] = Object.keys( exportData[ 0 ] ).map( ( key ) => ( {
      wch: key.length + 10,
    } ) );

    const workbook: XLSX.WorkBook = {
      Sheets: { LeaseData: worksheet },
      SheetNames: [ 'LeaseData' ],
    };

    const mimeMap: Record<string, string> = {
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      csv: 'text/csv',
      ods: 'application/vnd.oasis.opendocument.spreadsheet',
    };

    const bookType: XLSX.BookType = fileExtension as XLSX.BookType;
    const mimeType: string = mimeMap[ fileExtension ] || mimeMap[ 'xlsx' ];

    const excelBuffer: ArrayBuffer = XLSX.write(
      workbook,
      {
        bookType,
        type: 'array',
      },
    );

    const blob: Blob = new Blob(
      [ excelBuffer ],
      { type: mimeType },
    );

    FileSaver.saveAs(
      blob,
      `Lease_Batch_Export_${ new Date().toISOString() }.${ fileExtension }`,
    );
  }

  /* ======================================================================
     SHARED ERROR HANDLER
     ====================================================================== */

  /**
   * handleError
   *  - Centralised error → notification mapping.
   *  - Keeps catch blocks shorter and more readable.
   */
  private handleError(
    error: unknown,
    fallbackMessage: string,
  ): void {
    if ( error instanceof HttpErrorResponse ) {
      this.notificationDialog.notification( 'error', error.message );
    }
    else if ( typeof error === 'string' ) {
      this.notificationDialog.notification( 'error', error );
    }
    else if ( error instanceof Error ) {
      this.notificationDialog.notification( 'error', error.message );
    }
    else {
      this.notificationDialog.notification( 'error', fallbackMessage );
    }
  }

  /* ======================================================================
     END COMPONENT
     ====================================================================== */
}
