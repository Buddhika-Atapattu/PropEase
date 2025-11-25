// Angular core imports
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
import { Subscription } from 'rxjs';

// Service and types imports
import { APIsService, type User, type MSG } from '../../../../services/APIs/apis.service';
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
} from '../../../../services/tenant/tenant.service';
import { WindowsRefService } from '../../../../services/windowRef/windowRef.service';

// Component imports
import { NotificationDialogComponent } from '../../../../components/dialogs/notification/notificationBar.component';
import { ProgressBarComponent } from '../../../../components/dialogs/progress-bar/progress-bar.component';
import {
  TableButtonActionConfig,
  TableButton,
  TableColumn,
  CustomTableComponent,
} from '../../../../components/shared/custom-table/custom-table.component';
// import {EditorComponent} from '@tinymce/tinymce-angular';
import { Dropdown } from '../../../../components/shared/dropdown/dropdown';
import { TextEditorComponent } from '../../../../components/shared/textEditor/text-editor';

// Material UI imports
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { HttpErrorResponse } from '@angular/common/http';
import { PaginationUtil } from '../../../../source/utility/pagination.utils';

/** Simple row model for the property selector table */
interface PropertyTableData {
  image: string;
  id: string;
  leaseid: string;
  title: string;
  type: string;
  address: Address;
  viewButton: TableButton,
  addButton: TableButton,
}

/** Internal pair to link a property with its lease */
interface PropertyWithLease {
  property: BackEndPropertyData;
  lease: Lease;
}
// EditorComponent,
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
    // Components
    NotificationDialogComponent,
    ProgressBarComponent,
    CustomTableComponent,

    Dropdown,
    TextEditorComponent
  ],
  templateUrl: './create-complaints.html',
  styleUrl: './create-complaints.scss',
} )
export class CreateComplaints implements OnInit, AfterViewInit, OnDestroy {
  // ───────────────────────────────────────────────────────────────────────────
  // ViewChild refs (DOM handles)
  // - fileUpload: hidden <input type="file"> we trigger programmatically
  // - dropzone:   drop target element to style + attach DnD listeners
  // ───────────────────────────────────────────────────────────────────────────
  @ViewChild( NotificationDialogComponent ) notification!: NotificationDialogComponent;
  @ViewChild( ProgressBarComponent ) progressBar!: ProgressBarComponent;
  @ViewChild( 'fileUpload', { static: true } ) fileUpload!: ElementRef<HTMLInputElement>;
  @ViewChild( 'dropzone', { static: true } ) dropzone!: ElementRef<HTMLElement>;

  // Rich text editor minimal init (kept from your code)
  // init: EditorComponent['init'] = {
  //   plugins: 'lists link image table code help wordcount',
  // };

  // ─────────────────────────────────────────────
  // View / env state
  // ─────────────────────────────────────────────
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  private loggedUser!: User | null;

  // ─────────────────────────────────────────────
  // Raw backend properties / leases
  // ─────────────────────────────────────────────
  protected properties: BackEndPropertyData[] = [];
  private _leases: Lease[] = [];
  private _propertiesWithLease: PropertyWithLease[] = [];

  // ─────────────────────────────────────────────
  // Table config
  // ─────────────────────────────────────────────
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
  protected tableType: string = 'Property Selection';
  protected actionButtons: TableButton[] = [ { 'action': 'view', 'icon': 'visibility' }, { 'action': 'add', 'icon': 'add_circle' } ];

  // Pagination + data
  private _isReloading: boolean = false;
  private _pageSize: number = 10;
  private _pageIndex: number = 0;
  private _search: string = '';
  protected totalDataCount: number = 0;
  protected allData: PropertyTableData[] = [];

  // ─────────────────────────────────────────────
  // Complaint form fields
  // (Use public for template binding; keep internals private)
  // ─────────────────────────────────────────────
  private tenant: User | null = null;
  protected title!: ComplaintClient[ 'title' ];
  protected description!: ComplaintClient[ 'description' ];
  protected category!: ComplaintClient[ 'category' ];
  // Selected relations (populated when picking from the table)
  private _tenantID!: ComplaintClient[ 'tenantId' ];
  private _tenantName!: ComplaintClient[ 'tenantName' ];
  private _propertyId!: ComplaintClient[ 'propertyId' ];
  private _propertyName!: ComplaintClient[ 'propertyName' ];
  private _leaseId!: ComplaintClient[ 'leaseId' ];

  private _priority!: ComplaintClient[ 'priority' ]; // optional if your BE defaults
  private _status!: ComplaintClient[ 'status' ];     // optional if your BE defaults
  private _assigneeId!: ComplaintClient[ 'assigneeId' ];
  private _assigneeName!: ComplaintClient[ 'assigneeName' ];
  private readonly _createdAt: string = new Date().toISOString();
  private _dueAt!: string;
  private _selectedProperty !: BackEndPropertyData;

  // ─────────────────────────────────────────────
  // Attachments (drag & drop / paste / file input)
  // ─────────────────────────────────────────────
  protected isDragging: boolean = false;
  /** Pending attachments for UI + eventual upload */
  protected pendingAttachments: PendingAttachmentClient[] = [];
  /** Supported mime whitelist */
  private readonly ALLOWED_MIME: ReadonlyArray<string> = [
    // images
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    // docs if you want to allow:
    // 'application/pdf'
  ];
  /** Caps */
  private readonly MAX_FILES: number = 12;
  private readonly MAX_FILE_SIZE_BYTES: number = 10 * 1024 * 1024; // 10MB

  // Defined complaint categories (readonly)
  protected DEFINED_COMPLAINT_CATEGORIES: readonly string[] = COMPLAINT_CATEGORIES;

  // Renderer listeners to clean up
  private _dropEnterListener?: () => void;
  private _dropOverListener?: () => void;
  private _dropLeaveListener?: () => void;
  private _dropListener?: () => void;

  /** Quick role gate: admin-like roles can see "All Complaints" dashboard */


  public constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private platformId: Object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly renderer: Renderer2,
    private readonly APIsService: APIsService,
    private readonly propertyService: PropertyService,
    private readonly dialog: MatDialog,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.route.url.subscribe( () => { /* reserved for future */ } );
    this.loggedUser = this.authService.getLoggedUser;

    this.route.params.subscribe( async ( item ) => {
      try {
        const token = item[ 'tenantID' ];
        const tokenRes = await this.APIsService.getUserByToken( token );
        this.tenant = tokenRes.user ?? null;
      }
      catch ( error ) {
        console.error( error );
      }
    } );
    this._leaseId = this.route.snapshot.queryParamMap.get( 'leaseID' ) ?? '';
  }

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => { this.mode = val; } );
    }
    await this.loadTableData( this._pageIndex, this._pageSize, this._search );
  }

  ngAfterViewInit(): void {
    // Attach highly-targeted listeners to the dropzone only (safer than document-level)
    if ( !this.isBrowser ) return;
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();

    // Clean up listeners added via Renderer2
    this._dropEnterListener?.();
    this._dropOverListener?.();
    this._dropLeaveListener?.();
    this._dropListener?.();
  }

  // ─────────────────────────────────────────────
  // Role helpers
  // ─────────────────────────────────────────────
  get loggedUserRole(): string {
    return this.loggedUser?.role ?? '';
  }

  get checkLoggedUserRole(): boolean {
    const roles: string[] = [ 'admin', 'operator', 'manager' ];
    const userRole = this.loggedUser?.role ?? '';
    return !!userRole && roles.includes( userRole );
  }

  // ─────────────────────────────────────────────
  // Table API getters/setters
  // ─────────────────────────────────────────────
  get isReloading(): boolean { return this._isReloading; }
  set isReloading( value: boolean ) {
    this._isReloading = value;
    if ( this._isReloading ) this.loadTableData( this._pageIndex, this._pageSize, this._search );
  }

  get pageSize(): number { return this._pageSize; }
  set pageSize( value: number ) {
    this._pageSize = value;
    this.loadTableData( this._pageIndex, this._pageSize, this._search );
  }

  get pageIndex(): number { return this._pageIndex; }
  set pageIndex( value: number ) {
    this._pageIndex = value;
    this.loadTableData( this._pageIndex, this._pageSize, this._search );
  }

  get search(): string { return this._search; }
  set search( value: string ) {
    this._search = ( value ?? '' ).trim();
    this.loadTableData( this._pageIndex, this._pageSize, this._search );
  }


  // Make public selected property
  get property(): BackEndPropertyData {
    return this._selectedProperty;
  }

  // Make leaseID public
  get leaseID(): string {
    return this._leaseId ?? '';
  }

  // ─────────────────────────────────────────────
  // Data load + assembly
  // ─────────────────────────────────────────────
  protected fetchData() {
    this.loadTableData( this._pageIndex, this._pageSize, this._search );
  }
  private async loadTableData( index: number, limit: number, search?: string ): Promise<void> {
    try {
      // 1) Get total count
      const countRes = await this.tenantService.getLeaseCount();

      if ( countRes.status.toLowerCase() !== 'success' ) {
        throw new Error( 'Failed to fetch total count of leases' );
      }

      const total: number = countRes.data;

      if ( !Number.isFinite( total ) || !Number.isInteger( total ) || total < 0 ) {
        throw new Error( 'Invalid lease total number!' );
      }

      // If no leases, just show an empty table and exit
      if ( total === 0 ) {
        this.allData = [];
        return;
      }

      // 2) Pagination
      const safeIndex: number = PaginationUtil.safeIndex( index, total );
      const safeLimit: number = PaginationUtil.safeLimit( limit, total );
      const safeStart: number = safeIndex * safeLimit;

      // 3) Fetch paginated leases
      const leaseRes = await this.tenantService.getAllLeases( safeStart, safeLimit );

      if ( leaseRes.status.toLowerCase() !== 'success' ) {
        throw new Error( 'Failed to fetch lease data!' );
      }

      const leases: Lease[] = leaseRes.data.leases;

      // If backend returns no leases for this page, just show empty
      if ( !Array.isArray( leases ) || leases.length === 0 ) {
        this.allData = [];
        return;
      }

      // 4) Build rows
      const rows: ( PropertyTableData | null )[] = await Promise.all(
        leases.map( async ( lease ): Promise<PropertyTableData | null> => {
          return this.organiseTableRow( lease );
        } )
      );

      const filteredRows: PropertyTableData[] = rows.filter(
        ( row ): row is PropertyTableData => row !== null
      );

      // It is valid that some rows fail and are skipped
      this.allData = filteredRows;
    } catch ( error ) {
      console.error( error );
      if ( error instanceof HttpErrorResponse ) {
        this.notification.notification( 'error', error.message );
      } else if ( error instanceof Error ) {
        this.notification.notification( 'error', error.message );
      } else {
        this.notification.notification( 'error', 'Unknown error while loading lease table.' );
      }
    }
  }


  private async organiseTableRow( data: Lease ): Promise<PropertyTableData | null> {
    try {
      const propertyID: Lease[ 'leaseID' ] | undefined = data.propertyID;

      if ( !propertyID ) {
        throw new Error( 'Invalid property ID!' );
      }

      const propertyRes = await this.propertyService.getPropertySectionById(
        propertyID,
        [ 'images', 'title', 'address', 'type' ]
      );

      if ( propertyRes.status.toLowerCase() !== 'success' ) {
        throw new Error( 'Failed to fetch section of the property!' );
      }

      const values = propertyRes.data?.values as {
        images?: BackEndPropertyData[ 'images' ];
        title?: BackEndPropertyData[ 'title' ];
        type?: BackEndPropertyData[ 'type' ];
        address?: BackEndPropertyData[ 'address' ];
      };

      if ( !values ) {
        throw new Error( 'Property section payload is missing!' );
      }

      const images: BackEndPropertyData[ 'images' ] | undefined = values.images;
      const image: string | undefined = Array.isArray( images ) && images.length > 0
        ? images[ 0 ].imageURL
        : undefined;

      const title: BackEndPropertyData[ 'title' ] | undefined = values.title;
      const type: BackEndPropertyData[ 'type' ] | undefined = values.type;
      const address: BackEndPropertyData[ 'address' ] | undefined = values.address;

      if ( !image || !title || !type || !address ) {
        throw new Error( 'One or more required property fields are missing (image/title/type/address).' );
      }

      const id: BackEndPropertyData[ 'id' ] = propertyID;
      const leaseid: Lease[ 'leaseID' ] = data.leaseID;

      const viewButton: TableButton = { action: 'view', icon: 'visibility', label: 'View' };
      const addButton: TableButton = { action: 'add', icon: 'add_circle', label: 'Add' };

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
      // Optional: comment this if you don’t want spammy notifications per row
      if ( error instanceof HttpErrorResponse ) {
        this.notification.notification( 'error', error.message );
      } else if ( error instanceof Error ) {
        this.notification.notification( 'error', error.message );
      }
      return null;
    }
  }



  // ─────────────────────────────────────────────
  // Action & Operation buttons function only admin
  // ─────────────────────────────────────────────
  protected async actionButtonOperations( value: TableButtonActionConfig ): Promise<void> {
    try {
      if ( !value ) throw new Error( 'Data retrive invalid!' );
      const action: TableButtonActionConfig[ 'action' ] = value.action;
      const data: TableButtonActionConfig[ 'data' ] = value.data.element;
      if ( !data ) throw new Error( 'Invalid values!' );
      const propertyID = data.id;
      switch ( action ) {
        case 'view':
          await this.router.navigate( [ '/dashboard/properties/property-view/', propertyID ] );
          break;
        case 'add':
          const property = this.properties.find( ( p ) => p.id === propertyID );

          if ( !property ) throw new Error( 'Selected property is empty!' );
          this._selectedProperty = property;
          this._propertyId = property.id;
          this._propertyName = property.title;
          this._leaseId = this._leases.find( ( lease ) => lease.propertyID === property.id )?.leaseID ?? '';
          this._tenantID = this._leases.find( ( lease ) => lease.propertyID === property.id )?.tenantInformation.tenantUsername ?? '';
          break;
      }

      return;
    }
    catch ( error ) {
      console.error( error );
      return;
    }
  }

  // ─────────────────────────────────────────────
  // File upload helpers (Drag & Drop + Paste + Input)
  // ─────────────────────────────────────────────

  // create-complaints.ts (example handlers)
  protected onQueueChanged( files: File[] ): void {
    // keep your local files list for submit()
    this.pendingAttachments = files.map( f => ( { source: 'dragdrop', file: f } ) );
  }

  protected onNewFiles( files: File[] ): void {
    // maybe toast: `${files.length} files added`
  }

  protected onRemovedFile( file: File ): void {
    // maybe toast: `Removed ${file.name}`
  }

  // ─────────────────────────────────────────────
  // Select property
  // ─────────────────────────────────────────────
  private filterProperty(): void {
    try {
      if ( !this._leaseId ) return;
      if ( this.properties.length === 0 ) throw new Error( 'Property process failed!' );

      if ( this._leases.length === 0 ) throw new Error( 'Lease process failed!' );
      const leaseID = this._leaseId;
      const lease = this._leases.find( ( lease ) => lease.leaseID === leaseID );
      const property = this.properties.find( ( property ) => property.id === lease?.propertyID );

      if ( !lease ) throw new Error( 'Cannot find lease!' );
      if ( !property ) throw new Error( 'Cannot find property!' );

      this._selectedProperty = property;
      this._leaseId = lease.leaseID;
      this._propertyId = property.id;
      this._propertyName = property.title;
      this._tenantID = lease.tenantInformation.tenantUsername;
      this._tenantName = lease.tenantInformation.fullName;
    }
    catch ( error ) {
      console.error( error );
      return;
    }
  }


  // ─────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────
  protected async submit(): Promise<void> {
    try {
      if ( !this.loggedUser ) {
        this.notification?.notification( 'error', 'Not logged in.' );
        return;
      }

      // Minimal UI validation
      if ( !this.title?.trim() ) {
        this.notification?.notification( 'warning', 'Please enter a complaint title.' );
        return;
      }
      if ( !this.category ) {
        this.notification?.notification( 'warning', 'Please select a category.' );
        return;
      }
      if ( !this._propertyId || !this._leaseId || !this._tenantID ) {
        this.notification?.notification( 'warning', 'Please select a property/lease.' );
        return;
      }

      // Build payload (aligns with your CreateComplaintPayload)
      const payload: CreateComplaintPayload = {
        tenantId: this._tenantID,
        propertyId: this._propertyId,
        leaseId: this._leaseId,
        title: this.title.trim(),
        description: ( this.description ?? '' ).trim(),
        category: this.category,
        priority: this._priority ?? 'medium', // default example
        // optional:
        status: this._status,
        assigneeId: this._assigneeId,
        dueAt: this._dueAt,
        code: undefined,
        tenantName: this._tenantName,
        propertyName: this._propertyName,
        assigneeName: this._assigneeName,
      };

      // Extract File[] from queue
      const files: File[] = this.pendingAttachments.map( p => p.file );

      // Call service
      this.progressBar.start();
      const resp = await this.tenantService.createComplaint( payload, files );


      if ( resp.status === 'success' ) {

        this.notification?.notification( 'success', 'Complaint created.' );
        // reset form minimal
        this.title = '';
        this.description = '';
        this.category = undefined as any;
        this.pendingAttachments = [];
        setTimeout( async () => {
          if ( resp.data.code ) await this.router.navigate( [ '/dashboard/tenant/complaints/view-complaint/', resp.data.code ] );
          else await this.router.navigate( [ '/dashboard/tenant/complaints' ] );
        }, 1000 );
        return;
      }

      this.notification?.notification( 'error', resp.message || 'Failed to create complaint.' );
      return;
    } catch ( error ) {
      console.error( error );
      this.progressBar.stop();
      this.notification?.notification( 'error', 'Unexpected error during submission.' );
      return;
    }
    finally {
      this.progressBar.complete();
    }
  }

  // Page indicators
  protected async gotComplaintDashboard(): Promise<void> {
    try {
      await this.router.navigate( [ '/dashboard/tenant/complaints' ] );
      return;
    }
    catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'Route to complaints failed!' );
      return;
    }
  }

  protected async createComplaint(): Promise<void> {
    try {
      if ( !this.loggedUser ) throw new Error( 'Logged user invalid!' );
      const res = await this.APIsService.generateToken( this.loggedUser.username );
      const token = res.token;
      if ( !token ) throw new Error( 'Token generation failed!' );
      await this.router.navigate( [ '/dashboard/tenant/complaints/create-complaint', token ] );
      return;
    }
    catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'Route to complaints failed!' );
      return;
    }
  }
}
