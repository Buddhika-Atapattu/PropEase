// Angular core imports
import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  AfterViewInit,
  ViewChild,
  Renderer2,
  HostListener,
  ElementRef,
} from '@angular/core';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {Subscription, firstValueFrom} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {FormsModule} from '@angular/forms';

// Service and types imports
import {WindowsRefService} from '../../../../services/windowRef/windowRef.service';
import {
  PropertyService,
  type Address,
  type BackEndPropertyData,

} from '../../../../services/property/property.service';
import {AuthService, LoggedUserType, type BaseUser} from '../../../../services/auth/auth.service';
import {
  TenantService,
  type Lease,
  type ComplaintClient,
  type PendingAttachmentClient,
  COMPLAINT_CATEGORIES,
  type CreateComplaintPayload,
} from '../../../../services/tenant/tenant.service';
import {APIsService, type MSG} from '../../../../services/APIs/apis.service';

// Component imports
import {NotificationDialogComponent} from '../../../../components/dialogs/notification/notification.component';
import {ProgressBarComponent} from '../../../../components/dialogs/progress-bar/progress-bar.component';
import {
  ButtonDataType,
  ButtonType,
  CustomTableColumnType,
  CustomTableComponent,
} from '../../../../components/shared/custom-table/custom-table.component';
// import {EditorComponent} from '@tinymce/tinymce-angular';
import {Dropdown} from '../../../../components/shared/dropdown/dropdown';
import {TextEditorComponent} from '../../../../components/shared/textEditor/text-editor'

// Material UI imports
import {MatDialog} from '@angular/material/dialog';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatButtonModule} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';

/** Simple row model for the property selector table */
interface PropertyTableData {
  image: string;
  id: string;
  leaseid: string;
  title: string;
  type: string;
  address: Address;
  action: ButtonType;
  operation: ButtonType;
}

/** Internal pair to link a property with its lease */
interface PropertyWithLease {
  property: BackEndPropertyData;
  lease: Lease;
}
// EditorComponent,
@Component({
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
})
export class CreateComplaints implements OnInit, AfterViewInit, OnDestroy {
  // ───────────────────────────────────────────────────────────────────────────
  // ViewChild refs (DOM handles)
  // - fileUpload: hidden <input type="file"> we trigger programmatically
  // - dropzone:   drop target element to style + attach DnD listeners
  // ───────────────────────────────────────────────────────────────────────────
  @ViewChild(NotificationDialogComponent) notification!: NotificationDialogComponent;
  @ViewChild(ProgressBarComponent) progressBar!: ProgressBarComponent;
  @ViewChild('fileUpload', {static: true}) fileUpload!: ElementRef<HTMLInputElement>;
  @ViewChild('dropzone', {static: true}) dropzone!: ElementRef<HTMLElement>;

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
  private loggedUser!: LoggedUserType | null;

  // ─────────────────────────────────────────────
  // Raw backend properties / leases
  // ─────────────────────────────────────────────
  protected properties: BackEndPropertyData[] = [];
  private _leases: Lease[] = [];
  private _propertiesWithLease: PropertyWithLease[] = [];

  // ─────────────────────────────────────────────
  // Table config
  // ─────────────────────────────────────────────
  protected tableColumns: CustomTableColumnType[] = [
    {key: 'image', label: 'Image'},
    {key: 'id', label: 'ID'},
    {key: 'leaseid', label: 'LeaseID'},
    {key: 'title', label: 'Title'},
    {key: 'type', label: 'Type'},
    {key: 'address', label: 'Address'},
    {key: 'actions', label: 'View'},
    {key: 'operation', label: 'Add'},
  ];
  protected tableType: string = 'Property Selection';
  protected actionButton: ButtonType = {type: 'view'};
  protected operationButton: ButtonType = {type: 'add'};

  // Pagination + data
  private _isReloading: boolean = false;
  private _pageSize: number = 10;
  private _pageSizeOptions: number[] = [5, 10, 25, 50];
  private _pageIndex: number = 0;
  private _pageCount: number = 0;
  private _search: string = '';
  private _totalDataCount: number = 0;
  private _allData: PropertyTableData[] = [];
  private _filteredData: PropertyTableData[] = [];
  private _data: PropertyTableData[] = [];
  private _actionButtonFunction!: ButtonDataType;
  private _operationButtonFunction!: ButtonDataType;

  // ─────────────────────────────────────────────
  // Complaint form fields
  // (Use public for template binding; keep internals private)
  // ─────────────────────────────────────────────
  private tenant!: BaseUser;
  protected title!: ComplaintClient['title'];
  protected description!: ComplaintClient['description'];
  protected category!: ComplaintClient['category'];
  // Selected relations (populated when picking from the table)
  private _tenantID!: ComplaintClient['tenantId'];
  private _tenantName!: ComplaintClient['tenantName'];
  private _propertyId!: ComplaintClient['propertyId'];
  private _propertyName!: ComplaintClient['propertyName'];
  private _leaseId!: ComplaintClient['leaseId'];

  private _priority!: ComplaintClient['priority']; // optional if your BE defaults
  private _status!: ComplaintClient['status'];     // optional if your BE defaults
  private _assigneeId!: ComplaintClient['assigneeId'];
  private _assigneeName!: ComplaintClient['assigneeName'];
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

  public constructor (
    private readonly windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly renderer: Renderer2,
    private readonly APIsService: APIsService,
    private readonly propertyService: PropertyService,
    private readonly dialog: MatDialog,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe(() => { /* reserved for future */});
    this.loggedUser = this.authService.getLoggedUser;

    this.route.params.subscribe(async (item) => {
      try {
        const token = item['tenantID'];
        const tokenRes = await this.APIsService.getUserByToken(token);
        this.tenant = tokenRes.user;
      }
      catch(error) {
        console.error(error)
      }
    })
    this._leaseId = this.route.snapshot.queryParamMap.get('leaseID') ?? '';
  }

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {this.mode = val;});
    }
    await this._getAllProperties();
    this.filterProperty()
  }

  ngAfterViewInit(): void {
    // Attach highly-targeted listeners to the dropzone only (safer than document-level)
    if(!this.isBrowser) return;
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
    const roles: string[] = ['admin', 'operator', 'manager'];
    const userRole = this.loggedUser?.role ?? '';
    return !!userRole && roles.includes(userRole);
  }

  // ─────────────────────────────────────────────
  // Table API getters/setters
  // ─────────────────────────────────────────────
  get isReloading(): boolean {return this._isReloading;}
  set isReloading(value: boolean) {this._isReloading = value; this._applyPage(0);}

  get pageSize(): number {return this._pageSize;}
  set pageSize(value: number) {
    this._pageSize = value;
    this._applyPage(0);
    this._rebuildPageSizeOptions(this._filteredData.length);
  }

  get pageSizeOptions(): number[] {return this._pageSizeOptions;}
  set pageSizeOptions(value: number[]) {this._pageSizeOptions = value ?? [];}

  get pageIndex(): number {return this._pageIndex;}
  set pageIndex(value: number) {
    this._pageIndex = value;
    this._applyPage(this._pageIndex);
  }

  get pageCount(): number {return this._pageCount;}
  set pageCount(value: number) {this._pageCount = value;}

  get search(): string {return this._search;}
  set search(value: string) {
    this._search = (value ?? '').trim();
    if(this._search.length === 0) {
      this._filteredData = [...this._allData];
      this.totleDataCount = this._filteredData.length;
      this._applyPage(0);
      this._rebuildPageSizeOptions(this._filteredData.length);
      return;
    }
    const q = this._search.toLowerCase();
    this._filteredData = this._allData.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
    this.totleDataCount = this._filteredData.length;
    this._applyPage(0);
    this._rebuildPageSizeOptions(this._filteredData.length);
  }

  get totleDataCount(): number {return this._totalDataCount;}
  set totleDataCount(value: number) {this._totalDataCount = value;}

  get data(): PropertyTableData[] {return this._data;}
  set data(value: PropertyTableData[]) {this._data = value ?? [];}

  get actionButtonFunction(): ButtonDataType {return this._actionButtonFunction;}
  set actionButtonFunction(value: ButtonDataType) {this._actionButtonFunction = value; this._actionButtonMethod()}

  get operationButtonFunction(): ButtonDataType {return this._operationButtonFunction;}
  set operationButtonFunction(value: ButtonDataType) {this._operationButtonFunction = value; this._operationButtonMethod()}

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
  private async _loadLeaseAndFindProperties(): Promise<PropertyWithLease[]> {
    try {
      const leaseRes: MSG = await this.tenantService.getAllLeases();
      const leases: Lease[] = leaseRes.data as Lease[];
      if(!Array.isArray(leases)) throw new Error('Leases cannot be read!');
      if(this.properties.length === 0) throw new Error('Properties are empty');
      this._leases = leases;

      // Build property-lease pairs quickly using a lookup map for performance
      const byPropertyId = new Map<string, BackEndPropertyData>(
        this.properties.map(p => [String(p.id ?? ''), p])
      );

      const pairs: PropertyWithLease[] = [];
      for(const lease of this._leases) {
        const prop = byPropertyId.get(String(lease.propertyID ?? ''));
        if(prop) pairs.push({property: prop, lease});
      }

      if(pairs.length === 0) throw new Error('No property matched to any lease.');
      return pairs;
    } catch(error) {
      console.error(error);
      return [];
    }
  }

  private async _getAllProperties(): Promise<void> {
    try {
      if(!this.loggedUser) throw new Error('Invalid user login!');
      if(this.loggedUser.role !== 'admin') return;

      this.isReloading = true;
      const propertyRes: MSG = await this.propertyService.getAllProperties();
      if(propertyRes.status !== 'success' || !Array.isArray(propertyRes.data)) {
        throw new Error('Failed to fetch properties from backend!');
      }
      this.properties = propertyRes.data;

      const pairs = await this._loadLeaseAndFindProperties();
      if(pairs.length === 0) throw new Error('Lease with property array is empty!');

      this._propertiesWithLease = pairs;

      // Build master rows
      this._allData = this._buildPropertyRows(this._propertiesWithLease);
      this._filteredData = [...this._allData];
      this.totleDataCount = this._filteredData.length;

      // Pagination
      this._applyPage(0);
      this._rebuildPageSizeOptions(this._filteredData.length);
      this.isReloading = false;
      return;
    } catch(error) {
      console.error(error);
      this.notification?.notification('error', 'Error: Failed to fetch properties.');
      this.isReloading = false;
      return;
    }
  }

  /** Convert property-lease pairs to table rows */
  private _buildPropertyRows(list: PropertyWithLease[]): PropertyTableData[] {
    if(!Array.isArray(list) || list.length === 0) return [];
    const rows: PropertyTableData[] = [];
    for(const pair of list) {
      const firstImageUrl =
        Array.isArray(pair.property.images) && pair.property.images[0]?.imageURL
          ? pair.property.images[0].imageURL
          : 'Images/System-images/noProperties.jpg';
      rows.push({
        image: firstImageUrl,
        id: pair.property.id ?? '',
        leaseid: pair.lease.leaseID,
        title: pair.property.title ?? 'Untitled',
        type: pair.property.type ?? 'Unknown',
        address: pair.property.address as Address,
        action: this.actionButton,
        operation: this.operationButton,
      });
    }
    return rows;
  }

  // ─────────────────────────────────────────────
  // Pagination helpers
  // ─────────────────────────────────────────────
  private _applyPage(nextIndex: number): void {
    const total = this._filteredData.length;
    this.pageCount = this.pageSize > 0 ? Math.ceil(total / this.pageSize) : 0;

    const safeIndex = Math.max(0, Math.min(nextIndex, Math.max(0, this.pageCount - 1)));
    this._pageIndex = safeIndex;

    const start = safeIndex * this.pageSize;
    const end = start + this.pageSize;
    this.data = this._filteredData.slice(start, end);
  }

  private _rebuildPageSizeOptions(totalRows: number): void {
    const base = [5, 10, 25, 50, 100];
    const opts = base.filter(n => n <= Math.max(totalRows, 1));
    if(totalRows > 0 && !opts.includes(totalRows) && totalRows < Math.min(...base)) {
      opts.unshift(totalRows);
    }
    this.pageSizeOptions = Array.from(new Set(opts)).sort((a, b) => a - b);

    if(this.pageSize > Math.max(totalRows, 1)) {
      this.pageSize = this.pageSizeOptions[this.pageSizeOptions.length - 1];
      this._applyPage(0);
    }
  }

  // ─────────────────────────────────────────────
  // Action & Operation buttons function only admin
  // ─────────────────────────────────────────────
  private async _actionButtonMethod(): Promise<void> {
    try {
      if(!this.actionButtonFunction) throw new Error('Property view button function invalid!');
      const data = this.actionButtonFunction.data.element;
      const propertyID = data.id;
      await this.router.navigate(['/dashboard/property-view/', propertyID]);
    }
    catch(error) {
      console.error(error);
      return;
    }
  }

  private async _operationButtonMethod(): Promise<void> {
    try {
      if(!this._operationButtonFunction) throw new Error('Property add button function invalid!');
      if(this.properties.length === 0) throw new Error('Properties are empty!');

      const data = this._operationButtonFunction.data.element;
      const propertyID = data.id;
      const property = this.properties.find((p) => p.id === propertyID);

      if(!property) throw new Error('Selected property is empty!');
      this._selectedProperty = property
      this._propertyId = property.id;
      this._propertyName = property.title;
      this._leaseId = this._leases.find((lease) => lease.propertyID === property.id)?.leaseID ?? '';
      this._tenantID = this._leases.find((lease) => lease.propertyID === property.id)?.tenantInformation.tenantUsername ?? '';
      return;
    }
    catch(error) {
      console.error(error);
      this.notification.notification('error', 'Error occur while adding the property')
      return;

    }
  }

  // ─────────────────────────────────────────────
  // File upload helpers (Drag & Drop + Paste + Input)
  // ─────────────────────────────────────────────

  // create-complaints.ts (example handlers)
  protected onQueueChanged(files: File[]): void {
    // keep your local files list for submit()
    this.pendingAttachments = files.map(f => ({source: 'dragdrop', file: f}));
  }

  protected onNewFiles(files: File[]): void {
    // maybe toast: `${files.length} files added`
  }

  protected onRemovedFile(file: File): void {
    // maybe toast: `Removed ${file.name}`
  }

  // ─────────────────────────────────────────────
  // Select property
  // ─────────────────────────────────────────────
  private filterProperty(): void {
    try {
      if(!this._leaseId) return;
      if(this.properties.length === 0) throw new Error('Property process failed!');

      if(this._leases.length === 0) throw new Error('Lease process failed!');
      const leaseID = this._leaseId;
      const lease = this._leases.find((lease) => lease.leaseID === leaseID);
      const property = this.properties.find((property) => property.id === lease?.propertyID);

      if(!lease) throw new Error('Cannot find lease!');
      if(!property) throw new Error('Cannot find property!');

      this._selectedProperty = property;
      this._leaseId = lease.leaseID;
      this._propertyId = property.id;
      this._propertyName = property.title;
      this._tenantID = lease.tenantInformation.tenantUsername;
      this._tenantName = lease.tenantInformation.fullName;
    }
    catch(error) {
      console.error(error);
      return;
    }
  }


  // ─────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────
  protected async submit(): Promise<void> {
    try {
      if(!this.loggedUser) {
        this.notification?.notification('error', 'Not logged in.');
        return;
      }

      // Minimal UI validation
      if(!this.title?.trim()) {
        this.notification?.notification('warning', 'Please enter a complaint title.');
        return;
      }
      if(!this.category) {
        this.notification?.notification('warning', 'Please select a category.');
        return;
      }
      if(!this._propertyId || !this._leaseId || !this._tenantID) {
        this.notification?.notification('warning', 'Please select a property/lease.');
        return;
      }

      // Build payload (aligns with your CreateComplaintPayload)
      const payload: CreateComplaintPayload = {
        tenantId: this._tenantID,
        propertyId: this._propertyId,
        leaseId: this._leaseId,
        title: this.title.trim(),
        description: (this.description ?? '').trim(),
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
      const files: File[] = this.pendingAttachments.map(p => p.file);

      // Call service
      this.progressBar.start();
      const resp = await this.tenantService.createComplaint(payload, files);


      if(resp.status === 'success') {

        this.notification?.notification('success', 'Complaint created.');
        // reset form minimal
        this.title = '';
        this.description = '';
        this.category = undefined as any;
        this.pendingAttachments = [];
        setTimeout(async () => {
          if(resp.data.code) await this.router.navigate(['/dashboard/tenant/complaints/view-complaint/', resp.data.code]);
          else await this.router.navigate(['/dashboard/tenant/complaints']);
        }, 1000)
        return;
      }

      this.notification?.notification('error', resp.message || 'Failed to create complaint.');
      return;
    } catch(error) {
      console.error(error);
      this.progressBar.stop();
      this.notification?.notification('error', 'Unexpected error during submission.');
      return;
    }
    finally {
      this.progressBar.complete();
    }
  }
}
