import {CommonModule, isPlatformBrowser} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import {MatBadgeModule} from '@angular/material/badge';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';
import * as FileSaver from 'file-saver';
import {Subscription} from 'rxjs';
import * as XLSX from 'xlsx';
import {ConfirmationComponent} from '../../../components/dialogs/confirmation/confirmation.component';
import {
  NotificationDialogComponent,
  NotificationType,
} from '../../../components/dialogs/notification/notification.component';
import {ProgressBarComponent} from '../../../components/dialogs/progress-bar/progress-bar.component';
import {
  ButtonDataType,
  ButtonType,
  CustomTableColumnType,
  CustomTableComponent,
  FileExportWithDataAndExtentionType,
  SwitchButtonDataFormatType,
} from '../../../components/shared/custom-table/custom-table.component';
import {FileExportButtonTypeByExtension} from '../../../components/shared/paginator/paginator.component';
import {APIsService, BaseUser, UsersType} from '../../../services/APIs/apis.service';
import {
  AuthService,
  LoggedUserType,
} from '../../../services/auth/auth.service';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';
import {Lease, LeaseWithProperty, TenantService} from '../../../services/tenant/tenant.service';
import {BackEndPropertyData, PropertyService} from '../../../services/property/property.service';

export interface TenantTableElement {
  username?: string;
  name: string;
  image: string | File | undefined;
  contactNumber: string | undefined;
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
    start: Date,
    end: Date
  };
  status: string;
  monthlyRent: string;
  remaningDays: number;
  notify: boolean;
  view: {
    type: string
  },
  download: {
    type: string
  }
}

@Component({
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
})
export class HomeComponent implements OnInit, OnDestroy {
  //<======================= Foreign Components =======================>
  @ViewChild(ProgressBarComponent, {static: true})
  progressBarComponent!: ProgressBarComponent;
  @ViewChild(NotificationDialogComponent, {static: true})
  NotificationDialogComponent!: NotificationDialogComponent;
  //<======================= End Foreign Components =======================>

  //Test
  hidden = false;

  //<======================= Common Variables =======================>
  protected isLoading: boolean = false;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  protected modeSub: Subscription | null = null;
  protected loggedUser: LoggedUserType | null = null;
  protected allUsers: UsersType[] | null = [];
  private _isReloading: boolean = false;

  // Table Data for all users
  protected columns: CustomTableColumnType[] = [
    {label: 'Image', key: 'userimage'},
    {label: 'Name', key: 'name'},
    {label: 'Email', key: 'email'},
    {label: 'Contact Number', key: 'contactNumber'},
    {label: 'Gender', key: 'gender'},
    {label: 'View', key: 'operation'},
    {label: 'Actions', key: 'actions'},
  ];
  //<======================= End Common Variables =======================>

  //<======================= None Tenants Variables =======================>
  private _noneTenantButtonAction: ButtonType = {
    type: 'add',
  };
  private _noneTenantButtonOperation: ButtonType = {
    type: 'view',
  };
  private _noneTenantPageSize: number = 2;
  private _noneTenantPageSizeOptions: number[] = [2, 4, 6];
  private _noneTenantPageIndex: number = 0;
  private _noneTenantPageCount: number = 0;
  private _noneTenantTableType: string = '';
  private _noneTenantName: string = '';
  private _noneTenantTotalDataCount: number = 0;
  private _noneTenants: TenantTableElement[] = [];
  private _noneTenantsButtonActionTrigger: ButtonDataType | null = null;
  private _noneTenantsButtonOperationTrigger: ButtonDataType | null = null;
  private _noneTenantsButtonActionTriggerStarted: boolean = false;
  private _noneTenantsButtonOperationTriggerStarted: boolean = false;
  private _noneTenantsNotification: NotificationType = {
    type: '',
    message: '',
  };
  protected noneTenantsFull: TenantTableElement[] = [];
  public noneTenantFileExportButtonTypeByExtension: FileExportButtonTypeByExtension =
    {
      type: 'xlsx',
    };
  //<======================= End None Tenants Variables =======================>

  //<======================= Tenants Variables =======================>
  private _tenantButtonAction: ButtonType = {
    type: 'remove',
  };
  private _tenantButtonOperation: ButtonType = {
    type: 'view',
  };
  private _tenantPageSize: number = 2;
  private _tenantPageSizeOptions: number[] = [2, 4, 6];
  private _tenantPageIndex: number = 0;
  private _tenantPageCount: number = 0;
  private _tenantTableType: string = '';
  private _tenantName: string = '';
  private _tenantTotalDataCount: number = 0;
  private _tenants: TenantTableElement[] = [];
  private _tenantsButtonActionTrigger: ButtonDataType | null = null;
  private _tenantsButtonOperationTrigger: ButtonDataType | null = null;
  private _tenantsButtonActionTriggerStarted: boolean = false;
  private _tenantsNotification: NotificationType = {
    type: '',
    message: '',
  };
  protected tenantsFull: TenantTableElement[] = [];
  protected tenantFileExportButtonTypeByExtension: FileExportButtonTypeByExtension =
    {
      type: 'xlsx',
    };
  //<======================= End Tenants Variables =======================>

  //Logged User's Leases
  protected loggedUserLeases: Lease[] = [];


  //<============================================= LEASE TABLE VARIABLES =============================================>
  private _leaseTableIsReloading: boolean = false;
  private _leaseTablePageSize: number = 0;
  private _leaseTablePageSizeOptions: number[] = [];
  private _leaseTablePageIndex: number = 0;
  private _leaseTablePageCount: number = 0;
  private _leaseTableType: string = 'lease';
  private _leaseTabletSearch: string = '';
  private _leaseTableButtonAction: ButtonType = {
    type: 'add',
  };
  private _leaseTableButtonOperation: ButtonType = {
    type: 'add',
  };
  private _leaseTableTotalDataCount: number = 0;
  private _leaseTableButtonActionTrigger: ButtonDataType = {
    type: 'add',
    data: null,
  };
  private _leaseTableButtonOperationTrigger: ButtonDataType = {
    type: 'add',
    data: null,
  };
  private _leaseTableNotification: NotificationType = {
    type: 'success',
    message: '',
  };
  protected leaseTableFileExportButtonTypeByExtension: FileExportButtonTypeByExtension = {
    type: 'xlsx',
  };
  private _leaseTableData: LeaseTableDataType[] = [];
  private _leaseTableColumns: CustomTableColumnType[] = [];
  private _leaseSwitchButton: SwitchButtonDataFormatType = {
    isActive: false,
    data: null
  };
  protected leaseLength: number = 0;
  private selectedProperties: BackEndPropertyData[] = [];
  private today: Date = new Date();
  protected isLoggedUserHaveLeases: boolean = false;
  //<============================================= END LEASE TABLE VARIABLES =============================================>



  constructor (
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private apiService: APIsService,
    private dialog: MatDialog,
    private tenantService: TenantService,
    private propertyService: PropertyService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe((segments) => {
    });

    this.loggedUser = this.authService.getLoggedUser;
  }

  async ngOnInit(): Promise<void> {
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
    if(this.isAdmin()) {
      await this.getAllUsers();
      await this.getAllTenants();
    }

    await this.loggeUserLeases();
    await this.loadeSelectedProperties();
    this.organizeLeaseTableData();
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  //<=============================== Logged User Lease View ===============================>
  protected async loggeUserLeases(): Promise<void> {
    try {
      if(!this.loggedUser) throw new Error("Please login first!");

      const response = await this.tenantService.getAllLeaseAgreementsByUsername(this.loggedUser.username);

      if(response.status !== 'success') throw new Error(response.message)

      if(response.data.length === 0) throw new Error("You don't have any leases!");

      const leases: Lease[] = response.data;

      this.loggedUserLeases = leases;
      this.isLoggedUserHaveLeases = true;
    }
    catch(error) {
      console.error(error);
      this.isLoggedUserHaveLeases = false
    }
  }

  //<========================================================================= SETTER & GETTER ========================================================================>
  // leaseTableIsReloading
  get leaseTableIsReloading(): boolean {
    return this._leaseTableIsReloading;
  }
  set leaseTableIsReloading(value: boolean) {
    this._leaseTableIsReloading = value;
    if(this._leaseTableIsReloading) {
      this.organizeLeaseTableData()
    }
  }

  // leaseTablePageSize
  get leaseTablePageSize(): number {
    return this._leaseTablePageSize;
  }
  set leaseTablePageSize(value: number) {
    this._leaseTablePageSize = value;
  }

  // leaseTablePageSizeOptions
  get leaseTablePageSizeOptions(): number[] {
    return this._leaseTablePageSizeOptions;
  }
  set leaseTablePageSizeOptions(value: number[]) {
    this._leaseTablePageSizeOptions = value;
  }

  // leaseTablePageIndex
  get leaseTablePageIndex(): number {
    return this._leaseTablePageIndex;
  }
  set leaseTablePageIndex(value: number) {
    this._leaseTablePageIndex = value;
  }

  // leaseTablePageCount
  get leaseTablePageCount(): number {
    return this._leaseTablePageCount;
  }
  set leaseTablePageCount(value: number) {
    this._leaseTablePageCount = value;
  }

  // leaseTableType
  get leaseTableType(): string {
    return this._leaseTableType;
  }
  set leaseTableType(value: string) {
    this._leaseTableType = value;
  }

  // leaseTabletSearch
  get leaseTabletSearch(): string {
    return this._leaseTabletSearch;
  }
  set leaseTabletSearch(value: string) {
    this._leaseTabletSearch = value;
  }

  // leaseTableButtonAction
  get leaseTableButtonAction(): ButtonType {
    return this._leaseTableButtonAction;
  }
  set leaseTableButtonAction(value: ButtonType) {
    this._leaseTableButtonAction = value;
  }

  // leaseTableButtonOperation
  get leaseTableButtonOperation(): ButtonType {
    return this._leaseTableButtonOperation;
  }
  set leaseTableButtonOperation(value: ButtonType) {
    this._leaseTableButtonOperation = value;
  }

  // leaseTableTotalDataCount
  get leaseTableTotalDataCount(): number {
    return this._leaseTableTotalDataCount;
  }
  set leaseTableTotalDataCount(value: number) {
    this._leaseTableTotalDataCount = value;
  }

  // leaseTableButtonActionTrigger
  get leaseTableButtonActionTrigger(): ButtonDataType {
    return this._leaseTableButtonActionTrigger;
  }
  set leaseTableButtonActionTrigger(value: ButtonDataType) {
    this._leaseTableButtonActionTrigger = value;
    // this.handleOpenLeaseAgreement()
    this.handleLeaseView();
  }

  // leaseTableButtonOperationTrigger
  get leaseTableButtonOperationTrigger(): ButtonDataType {
    return this._leaseTableButtonOperationTrigger;
  }
  set leaseTableButtonOperationTrigger(value: ButtonDataType) {
    this._leaseTableButtonOperationTrigger = value;
    this.downloadLeaseAgreement();
  }

  // leaseTableNotification
  get leaseTableNotification(): NotificationType {
    return this._leaseTableNotification;
  }
  set leaseTableNotification(value: NotificationType) {
    this._leaseTableNotification = value;
  }

  // leaseTableData
  get leaseTableData(): LeaseTableDataType[] {
    return this._leaseTableData;
  }
  set leaseTableData(value: LeaseTableDataType[]) {
    this._leaseTableData = value;
  }

  // leaseTableColumns
  get leaseTableColumns(): CustomTableColumnType[] {
    return this._leaseTableColumns;
  }
  set leaseTableColumns(value: CustomTableColumnType[]) {
    this._leaseTableColumns = value;
  }


  //<========================================================================= END SETTER & GETTER ========================================================================>

  //<========================================================================= HANGLERS ========================================================================>
  private async organizeLeaseTableData(): Promise<void> {
    try {
      if(!this.loggedUserLeases || this.loggedUserLeases.length === 0) {
        throw new Error("No lease agreements found!");
      }

      if(!this.selectedProperties || this.selectedProperties.length === 0) {
        await this.loadeSelectedProperties();
        if(!this.selectedProperties || this.selectedProperties.length === 0) {
          throw new Error("No properties found!");
        }
      }

      this.isLoading = true;
      this.leaseLength = this.loggedUserLeases.length;
      this.leaseTablePageSize = 2;
      this.leaseTablePageIndex = 0;
      this.leaseTablePageSizeOptions = [];

      for(let i = 1; i <= this.leaseLength; i++) {
        if(i % this.leaseTablePageSize === 0) {
          this.leaseTablePageSizeOptions.push(i);
        }
      }

      if(this.leaseTablePageSizeOptions.length === 0) {
        this.leaseTablePageSizeOptions.push(this.leaseLength);
      }


      this.leaseTablePageCount = Math.ceil(this.leaseLength / this.leaseTablePageSize);
      this.leaseTableType = 'Lease';

      this.leaseTableButtonAction = {type: 'view'};
      this.leaseTableButtonOperation = {type: 'download'};
      this.leaseTableTotalDataCount = this.leaseLength;
      this.leaseTableNotification = {type: 'success', message: ''};
      this.leaseTableFileExportButtonTypeByExtension = {type: 'xlsx'};

      this.leaseTableColumns = [
        {label: 'Image', key: 'propertyimage'},
        {label: 'Lease ID', key: 'leaseid'},
        {label: 'Date Range', key: 'daterange'},
        {label: 'Lease Status', key: 'status'},
        {label: 'Monthly Rent', key: 'monthlyRent'},
        {label: 'Remaining Days', key: 'remaningDays'},
        {label: 'View', key: 'actions'},
        {label: 'Download', key: 'operation'}
      ];

      // Clear previous table data
      this.leaseTableData = [];


      for(const lease of this.loggedUserLeases) {
        const property = this.selectedProperties.find(p => p.id === lease.propertyID);
        if(!property) continue;

        const propertyImageURL: LeaseTableDataType['image'] = property.images?.[0]?.imageURL || '';
        const leaseID: LeaseTableDataType['leaseid'] = lease.leaseID;
        const dateRange: LeaseTableDataType['dateRange'] = {
          start: new Date(lease.leaseAgreement.startDate),
          end: new Date(lease.leaseAgreement.endDate)
        };
        const status: LeaseTableDataType['status'] = lease.systemMetadata.validationStatus.toLocaleLowerCase();
        const monthlyRent: LeaseTableDataType['monthlyRent'] =
          `${lease.leaseAgreement.monthlyRent} ${lease.leaseAgreement.currency.currency}`;
        const remaningDays: LeaseTableDataType['remaningDays'] = Math.ceil(
          (dateRange.end.getTime() - this.today.getTime()) / (1000 * 3600 * 24)
        );
        const notify: LeaseTableDataType['notify'] = remaningDays < 30;
        const view: LeaseTableDataType['view'] = {type: 'view'};
        const download: LeaseTableDataType['download'] = {type: 'download'};


        const rowData: LeaseTableDataType = {
          image: propertyImageURL,
          leaseid: leaseID,
          dateRange,
          status,
          monthlyRent,
          remaningDays,
          notify,
          view,
          download,
        };

        this.leaseTableData.push(rowData);
      }

    } catch(error) {
      console.error('Error organizing lease table data:', error);
      this.NotificationDialogComponent.notification('error', (error as Error).message);
    } finally {
      setTimeout(() => {
        this.isLoading = false;
      }, 500);
    }
  }
  //<========================================================================= END HANGLERS ========================================================================>


  //<========================================================================= LOAD PROPERTY DATA ========================================================================>
  private async loadeSelectedProperties() {
    try {
      if(this.loggedUserLeases.length === 0) {
        throw new Error("No lease agreements found!");
      }

      this.isLoading = true;
      const seen = new Set<string>();

      for(const lease of this.loggedUserLeases) {
        const propertyID = lease.propertyID;
        if(!propertyID || seen.has(propertyID)) continue; // Avoid duplicates

        try {
          const res = await this.propertyService.getPropertyById(propertyID);
          if(res.status === 'success') {
            const resData: BackEndPropertyData = res.data as BackEndPropertyData;
            this.selectedProperties.push(resData);

            seen.add(propertyID);
          } else {
            console.error('Failed to fetch property:', res.message);
          }
        } catch(error: any) {
          console.log('Error fetching property:', error);
          if(error.status === 404) {
            this.NotificationDialogComponent.notification('error', 'No property found for this lease.');
          } else {
            this.NotificationDialogComponent.notification('error', 'Failed to fetch property.');
          }
        }
      }

    } catch(error) {
      console.error(error);
      this.NotificationDialogComponent.notification('error', 'Failed to load selected properties.');
    }
    finally {
      setTimeout(() => {
        this.isLoading = false;
      }, 500);
    }
  }
  //<========================================================================= END LOAD PROPERTY DATA ========================================================================>


  //<========================================================================= VIEW LEASE =========================================================================>
  private handleLeaseView() {
    try {
      const leaseID = this._leaseTableButtonActionTrigger.data.element.leaseid;

      if(!leaseID) throw new Error('No lease ID found!');

      this.router.navigate(['/dashboard/tenant/view-lease', leaseID]);

    }
    catch(error) {
      console.error(error)
    }
  }
  //<========================================================================= END VIEW LEASE =========================================================================>

  //<========================================================================= DOWNLOAD LEASE AGREEMENT =========================================================================>
  private async downloadLeaseAgreement(): Promise<void> {
    try {
      this.progressBarComponent.start();

      const leaseID = this._leaseTableButtonOperationTrigger.data.element.leaseid;
      if(!leaseID) throw new Error("Invalid lease ID");

      if(this.authService.getLoggedUser === null) throw new Error("Please login first!")

      // Download PDF blob from backend
      const blob = await this.tenantService.downloadLeaseAgreement(leaseID, 'download', this.authService.getLoggedUser.username);

      const actualName = `${leaseID}-lease-agreement.pdf`;

      // Create temporary link and trigger download
      const fileURL = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileURL;
      a.download = actualName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Clean up
      document.body.removeChild(a);
      window.URL.revokeObjectURL(fileURL);

    } catch(error) {
      console.error('Failed to download lease agreement PDF:', error);
      if(error instanceof HttpErrorResponse) {
        this.NotificationDialogComponent.notification('error', error.message);
      }
      else if(typeof error === 'string') {
        this.NotificationDialogComponent.notification('error', error);
      }
      else if(error instanceof Error) {
        this.NotificationDialogComponent.notification('error', error.message);
      }
      else {
        this.NotificationDialogComponent.notification('error', 'Failed to download lease agreement PDF.');
      }
    } finally {
      this.progressBarComponent.complete();
    }
  }
  //<========================================================================= END DOWNLOAD LEASE AGREEMENT =========================================================================>

  //<========================================================================= EXPORT LEASE DATA =========================================================================>
  protected handleExportLeaseTableData(value: FileExportWithDataAndExtentionType) {
    try {
      if(this.loggedUserLeases.length === 0) {
        throw new Error('No lease agreements found!');
      }

      if(this.selectedProperties.length === 0) {
        throw new Error('No properties found!');
      }

      const leasesWithProperty: LeaseWithProperty[] = [];

      this.loggedUserLeases.forEach((lease) => {
        const property = this.selectedProperties.find(p => p.id === lease.propertyID);
        if(!property) throw new Error('Property not found!');
        const leaseWithProperty: LeaseWithProperty = {
          ...lease,
          property
        };
        leasesWithProperty.push(leaseWithProperty);
      });

      if(leasesWithProperty.length === 0) {
        throw new Error('No leases with property found!');
      }

      this.exportLeasesDataAsExcel(leasesWithProperty, value.extention.type);
    }
    catch(error) {
      console.error(error);
      if(error instanceof HttpErrorResponse) this.NotificationDialogComponent.notification('error', error.message);
      else if(typeof error === 'string') this.NotificationDialogComponent.notification('error', error);
      else if(error instanceof Error) this.NotificationDialogComponent.notification('error', error.message);
      else this.NotificationDialogComponent.notification('error', 'Failed to load tenant data.');
    }
  }
  //<========================================================================= END EXPORT LEASE DATA =========================================================================>


  //<=========================== EXPORT EXCEL FILE ===========================>

  private exportLeasesDataAsExcel(
    leases: LeaseWithProperty[],
    fileExtension: FileExportWithDataAndExtentionType['extention']['type'] = 'xlsx'
  ): void {
    if(!Array.isArray(leases) || leases.length === 0) {
      console.warn('No lease data available for export.');
      return;
    }

    const exportData: Record<string, any>[] = leases.map((lease) => {
      const addr = lease.property?.address;

      return {
        'leaseID': lease.leaseID,
        'Tenant name': lease.tenantInformation?.fullName ?? '',
        'Tenant email': lease.tenantInformation?.email ?? '',
        'Tenant contact': lease.tenantInformation?.phoneNumber ?? '',

        'Co-Tenant name': lease.coTenant?.fullName ?? '',
        'Co-Tenant relationship': lease.coTenant?.relationship ?? '',

        'Property title': lease.property?.title ?? '',
        'Property address':
          (addr?.houseNumber ?? '') + ' ' +
          (addr?.street ?? '') + ', ' +
          (addr?.city ?? '') + ', ' +
          (addr?.stateOrProvince ?? '') + ', ' +
          (addr?.country ?? ''),

        'Started date': new Date(lease.leaseAgreement.startDate).toISOString(),
        'End date': new Date(lease.leaseAgreement.endDate).toISOString(),
        'Monthly rent': lease.leaseAgreement.monthlyRent,
        'Rent currency': lease.leaseAgreement.currency?.currency ?? '',
        'Payment frequency': lease.leaseAgreement.paymentFrequency?.name ?? '',
        'Payment method': lease.leaseAgreement.paymentMethod?.name ?? '',
        'Deposit': lease.leaseAgreement.securityDeposit?.name ?? '',
        'Rent due date': lease.leaseAgreement.rentDueDate?.label ?? '',
        'Notice period': lease.leaseAgreement.noticePeriodDays?.label ?? '',

        'Late penalties': lease.leaseAgreement.latePaymentPenalties?.map(p => p.label).join(',\n') ?? '',
        'Utility responsibilities': lease.leaseAgreement.utilityResponsibilities?.map(u => u.utility + ': ' + u.paidBy).join(',\n') ?? '',

        'Rules and regulations': lease.rulesAndRegulations?.map(r => r.rule).join(';\n') ?? '',

        'Tenant signature URL': (lease.signatures.tenantSignature as any)?.URL ?? '',
        'Landlord signature URL': (lease.signatures.landlordSignature as any)?.URL ?? '',
        'Signed At': new Date(lease.signatures.signedAt).toISOString(),
        'Signed By': lease.signatures.userAgent?.name ?? '',
        'ip Address': lease.signatures.ipAddress ?? '',

        'ocrStatus': lease.systemMetadata.ocrAutoFillStatus ? 'Yes' : 'No',
        'validationStatus': lease.systemMetadata.validationStatus,
        'leaseTemplateVersion': lease.systemMetadata.leaseTemplateVersion,
        'lastUpdated': lease.systemMetadata.lastUpdated,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = Object.keys(exportData[0]).map((key) => ({
      wch: key.length + 10
    }));

    const workbook: XLSX.WorkBook = {
      Sheets: {LeaseData: worksheet},
      SheetNames: ['LeaseData']
    };

    const mimeMap: Record<string, string> = {
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      csv: 'text/csv',
      ods: 'application/vnd.oasis.opendocument.spreadsheet'
    };

    const bookType: XLSX.BookType = fileExtension as XLSX.BookType;
    const mimeType = mimeMap[fileExtension] || mimeMap['xlsx'];

    const excelBuffer = XLSX.write(workbook, {
      bookType,
      type: 'array'
    });

    const blob = new Blob([excelBuffer], {type: mimeType});
    FileSaver.saveAs(blob, `Lease_Batch_Export_${new Date().toISOString()}.${fileExtension}`);
  }
  //<=========================== END EXPORT EXCEL FILE ===========================>

  //<=============================== End Logged User Lease View ===============================>

  //<======================= Logged User Premission Checker =======================>
  private permissionCheckerForAdd(): boolean {
    try {
      if(!this.loggedUser) {
        this.router.navigate(['/login']);
        throw new Error("Please login first!");
      }

      const tenantModulePermissions = this.loggedUser.access.permissions.find(
        (item) => item.module === 'Tenant Management'
      );

      const hasAddTenant = tenantModulePermissions?.actions.includes('add new tenant');

      return !!hasAddTenant;
    } catch(error) {
      console.error(error);

      if(typeof error === 'string') {
        this.NotificationDialogComponent.notification('error', error);
      } else if(error instanceof HttpErrorResponse) {
        this.NotificationDialogComponent.notification('error', error.error.message);
      } else if(error instanceof Error) {
        this.NotificationDialogComponent.notification('error', error.message);
      }
      else {
        this.NotificationDialogComponent.notification('error', 'Something went wrong!');
      }

      return false;
    }
  }

  private permissionCheckerForRemove(): boolean {
    try {
      if(!this.loggedUser) {
        this.router.navigate(['/login']);
        throw new Error("Please login first!");
      }

      const tenantModulePermissions = this.loggedUser.access.permissions.find(
        (item) => item.module === 'Tenant Management'
      );

      const hasRemoveTenant = tenantModulePermissions?.actions.includes('remove tenant');

      return !!(hasRemoveTenant);
    } catch(error) {
      console.error(error);

      if(typeof error === 'string') {
        this.NotificationDialogComponent.notification('error', error);
      } else if(error instanceof HttpErrorResponse) {
        this.NotificationDialogComponent.notification('error', error.error.message);
      } else if(error instanceof Error) {
        this.NotificationDialogComponent.notification('error', error.message);
      }
      else {
        this.NotificationDialogComponent.notification('error', 'Something went wrong!');
      }

      return false;
    }
  }
  //<======================= End Logged User Premission Checker =======================>


  //<======================= Getters and Settes For All Users =======================>
  get isReloading(): boolean {
    return this._isReloading;
  }

  set isReloading(value: boolean) {
    this._isReloading = value;
    if(this._isReloading) {
      this.handelLoading();
    }
  }
  //<======================= End Getters and Settes For All Users =======================>

  //<======================= Getters and Settes For None Tenants =======================>

  get noneTenantPageSize(): number {
    return this._noneTenantPageSize;
  }

  set noneTenantPageSize(value: number) {
    this._noneTenantPageSize = value;
    this.handelNoneTenantPageSize();
  }

  get noneTenantPageSizeOptions(): number[] {
    return this._noneTenantPageSizeOptions;
  }

  set noneTenantPageSizeOptions(value: number[]) {
    this._noneTenantPageSizeOptions = value;
  }

  get noneTenantPageIndex(): number {
    return this._noneTenantPageIndex;
  }

  set noneTenantPageIndex(value: number) {
    this._noneTenantPageIndex = value;
    this.handelNoneTenantPageIndex();
  }

  get noneTenantPageCount(): number {
    return this._noneTenantPageCount;
  }

  set noneTenantPageCount(value: number) {
    this._noneTenantPageCount = value;
  }

  get noneTenantTableType(): string {
    return this._noneTenantTableType;
  }

  set noneTenantTableType(value: string) {
    this._noneTenantTableType = value;
  }

  get noneTenants(): TenantTableElement[] {
    return this._noneTenants;
  }

  set noneTenants(value: TenantTableElement[]) {
    this._noneTenants = value;
  }

  get noneTenantName(): string {
    return this._noneTenantName;
  }

  set noneTenantName(value: string) {
    this._noneTenantName = value;
    this.handleNoneTenantNameSearch();
  }

  get noneTenantTotalDataCount(): number {
    return this._noneTenantTotalDataCount;
  }

  set noneTenantTotalDataCount(value: number) {
    this._noneTenantTotalDataCount = value;
  }

  get noneTenantButtonAction(): ButtonType {
    return this._noneTenantButtonAction;
  }

  set noneTenantButtonAction(value: ButtonType) {
    this._noneTenantButtonAction = value;
  }

  get noneTenantButtonOperation(): ButtonType {
    return this._noneTenantButtonOperation;
  }

  set noneTenantButtonOperation(value: ButtonType) {
    this._noneTenantButtonOperation = value;
  }

  get noneTenantsButtonActionTrigger(): ButtonDataType | null {
    return this._noneTenantsButtonActionTrigger;
  }

  set noneTenantsButtonActionTrigger(value: ButtonDataType | null) {
    this._noneTenantsButtonActionTrigger = value;
    this.handleNoneTenantActionButtonTigger();
  }

  get noneTenantsButtonOperationTrigger(): ButtonDataType | null {
    return this._noneTenantsButtonOperationTrigger;
  }

  set noneTenantsButtonOperationTrigger(value: ButtonDataType | null) {
    this._noneTenantsButtonOperationTrigger = value;
    this.handleNoneTenantOperationButtonTigger();
  }

  get noneTenantsButtonOperationTriggerStarted(): boolean {
    return this._noneTenantsButtonOperationTriggerStarted;
  }

  set noneTenantsButtonOperationTriggerStarted(value: boolean) {
    this._noneTenantsButtonOperationTriggerStarted = value;
  }

  get noneTenantsButtonActionTriggerStarted(): boolean {
    return this._noneTenantsButtonActionTriggerStarted;
  }

  set noneTenantsButtonActionTriggerStarted(value: boolean) {
    this._noneTenantsButtonActionTriggerStarted = value;
  }

  get noneTenantsNotification(): NotificationType {
    return this._noneTenantsNotification;
  }

  set noneTenantsNotification(value: NotificationType) {
    this._noneTenantsNotification = value;
  }

  //<======================= End Getters and Settes For None Tenants  =======================>

  //<======================= Getters and Settes For Tenants =======================>

  get tenantPageSize(): number {
    return this._tenantPageSize;
  }

  set tenantPageSize(value: number) {
    this._tenantPageSize = value;
    this.handelTenantPageSize();
  }

  get tenantPageSizeOptions(): number[] {
    return this._tenantPageSizeOptions;
  }

  set tenantPageSizeOptions(value: number[]) {
    this._tenantPageSizeOptions = value;
  }

  get tenantPageIndex(): number {
    return this._tenantPageIndex;
  }

  set tenantPageIndex(value: number) {
    this._tenantPageIndex = value;
    this.handelTenantPageIndex();
  }

  get tenantPageCount(): number {
    return this._tenantPageCount;
  }

  set tenantPageCount(value: number) {
    this._tenantPageCount = value;
  }

  get tenantTableType(): string {
    return this._tenantTableType;
  }

  set tenantTableType(value: string) {
    this._tenantTableType = value;
  }

  get tenants(): TenantTableElement[] {
    return this._tenants;
  }

  set tenants(value: TenantTableElement[]) {
    this._tenants = value;
  }

  get tenantName(): string {
    return this._tenantName;
  }

  set tenantName(value: string) {
    this._tenantName = value;
    this.handleTenantNameSearch();
  }

  get tenantTotalDataCount(): number {
    return this._tenantTotalDataCount;
  }

  set tenantTotalDataCount(value: number) {
    this._tenantTotalDataCount = value;
  }

  get tenantButtonAction(): ButtonType {
    return this._tenantButtonAction;
  }

  set tenantButtonAction(value: ButtonType) {
    this._tenantButtonAction = value;
  }

  get tenantButtonOperation(): ButtonType {
    return this._tenantButtonOperation;
  }

  set tenantButtonOperation(value: ButtonType) {
    this._tenantButtonOperation = value;
  }

  get tenantsButtonActionTrigger(): ButtonDataType | null {
    return this._tenantsButtonActionTrigger;
  }

  set tenantsButtonActionTrigger(value: ButtonDataType | null) {
    this._tenantsButtonActionTrigger = value;
    this.handleTenantActionButtonTigger();
  }

  get tenantsButtonOperationTrigger(): ButtonDataType | null {
    return this._tenantsButtonOperationTrigger;
  }

  set tenantsButtonOperationTrigger(value: ButtonDataType | null) {
    this._tenantsButtonOperationTrigger = value;
    this.handleTenantOperationButtonTigger();
  }

  get tenantsButtonActionTriggerStarted(): boolean {
    return this._tenantsButtonActionTriggerStarted;
  }

  set tenantsButtonActionTriggerStarted(value: boolean) {
    this._tenantsButtonActionTriggerStarted = value;
  }

  get tenantsNotification(): NotificationType {
    return this._tenantsNotification;
  }

  set tenantsNotification(value: NotificationType) {
    this._tenantsNotification = value;
  }

  //<======================= End Getters and Settes For None Tenants  =======================>

  //<======================= All Users Handle Methods =======================>

  private async handelLoading() {
    if(this.isReloading) {
      await this.getAllUsers();
      await this.getAllTenants();
      setTimeout(() => {
        this._isReloading = false;
        this.isLoading = false;
      }, 500);
    } else {
      this.isLoading = false;
    }
  }

  private async handleUserView(username: string) {
    if(this.isBrowser && username !== '') {
      const tokenResult = await this.apiService.generateToken(username);
      this.router.navigate(['/dashboard/view-user-profile', tokenResult.token]);
    }
  }

  private async handleTenantView(username: string) {
    if(this.isBrowser && username !== '') {
      const tokenResult = await this.apiService.generateToken(username);
      this.router.navigate(['/dashboard/tenant/tenant-view', tokenResult.token]);
    }
  }

  private exportTableData(
    data: FileExportWithDataAndExtentionType,
    typeOfTenant: string
  ): void {
    const fileExtention = data.extention.type;
    const fileData = data.data;

    if(!Array.isArray(fileData) || fileData.length === 0) {
      console.warn('No data to export.');
      return;
    }

    // Get unique keys from the data
    const rawColumns = Array.from(
      new Set(fileData.flatMap((item) => Object.keys(item)))
    );

    // Map raw keys to display labels (capitalized)
    const keyMap: Record<string, string> = {};
    rawColumns.forEach((key) => {
      keyMap[key] = key.charAt(0).toUpperCase() + key.slice(1);
    });
    // Use display labels for columns
    const columns = Object.values(keyMap);

    // Map each row
    const exportData: Record<string, any>[] = fileData.map((item) => {
      const normalizedRow: Record<string, any> = {};
      for(const rawKey in keyMap) {
        const displayKey = keyMap[rawKey];
        normalizedRow[displayKey] = item[rawKey] ?? '';
      }
      return normalizedRow;
    });

    // Optionally sort exportData by name if needed
    // this.sort(exportData as TenantTableElement[]);

    if(this.isExcel(fileExtention)) {
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Define column widths
      worksheet['!cols'] = columns.map((col) => ({wch: col.length + 10}));
      const workbook: XLSX.WorkBook = {
        Sheets: {Export: worksheet},
        SheetNames: ['Export'],
      };

      // Map file extension to valid XLSX BookType
      const bookTypeMap: {[key: string]: XLSX.BookType} = {
        xls: 'xls',
        xlsx: 'xlsx',
        xlsm: 'xlsm',
        xltx: 'xlsx',
        ods: 'ods',
        csv: 'csv',
        tsv: 'csv',
      };
      const bookType =
        bookTypeMap[fileExtention.toLowerCase().trim()] || 'xlsx';
      const excelBuffer = XLSX.write(workbook, {
        bookType: bookType,
        type: 'array',
      });

      const mimeMap: {[key: string]: string} = {
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls: 'application/vnd.ms-excel',
        csv: 'text/csv',
        ods: 'application/vnd.oasis.opendocument.spreadsheet',
      };

      const mimeType = mimeMap[fileExtention.toLowerCase()] || mimeMap['xlsx'];

      const blob = new Blob([excelBuffer], {type: mimeType});
      FileSaver.saveAs(
        blob,
        `${typeOfTenant}_Export_${new Date().toISOString()}.${fileExtention}`
      );
    }
  }

  private isExcel(type: string): boolean {
    switch(type.toLowerCase().trim()) {
      case 'xls':
        return true;
      case 'xlsx':
        return true;
      case 'xlsm':
        return true;
      case 'xlt':
        return true;
      case 'xltx':
        return true;
      case 'ods':
        return true;
      case 'csv':
        return true;
      case 'tsv':
        return true;
      default:
        return false;
    }
  }

  //<======================= End All Users Handle Methods =======================>

  //<======================= None Tenant Handle Methods =======================>

  protected handleNoneTenantsFileExport(
    data: FileExportWithDataAndExtentionType
  ) {
    if(data) {
      this.exportTableData(data, 'None_Tenant');
    } else {
      console.warn('No data to export');
    }
  }

  private async handleNoneTenantActionButtonTigger() {
    if(
      this._noneTenantsButtonActionTrigger &&
      this._noneTenantsButtonActionTrigger.type === 'add'
    ) {
      if(!this.permissionCheckerForAdd()) {
        this.NotificationDialogComponent.notification('warning', 'You don\'t have permission to add tenant!')
        return
      }
      const users = this.noneTenantsFull.filter(
        (data) =>
          data.name.toLowerCase() ===
          this._noneTenantsButtonActionTrigger?.data.element.name.toLowerCase()
      );
      if(users.length === 1) {
        await this.addTenant(users[0] as TenantHomeButtonDataType);
      }
    }
  }

  private async handleNoneTenantOperationButtonTigger() {
    if(
      this._noneTenantsButtonOperationTrigger &&
      this._noneTenantsButtonOperationTrigger.type === 'view'
    ) {
      const users = this.noneTenantsFull.filter(
        (data) =>
          data.name.toLowerCase() ===
          this._noneTenantsButtonOperationTrigger?.data.element.name.toLowerCase()
      );
      if(users.length === 1) {
        this.handleUserView(
          (users[0] as TenantTableElement).username as string
        );
      }
    }
  }

  private handelNoneTenantPageIndex() {
    const start = this._noneTenantPageIndex * this._noneTenantPageSize;
    const end = start + this._noneTenantPageSize;
    const data = this.noneTenantsFull.slice(start, end);
    this.noneTenants = this.sort(data);
  }

  private handelNoneTenantPageSize() {
    if(this._noneTenantPageSize) {
      const data = this.noneTenantsFull.slice(
        0 * this.noneTenantPageSize,
        this._noneTenantPageSize
      );

      this.noneTenants = this.sort(data);
    }
  }

  private handleNoneTenantNameSearch() {
    if(this._noneTenantName) {
      const searchedUsers = this.noneTenantsFull.filter((user) =>
        user.name.toLowerCase().includes(this._noneTenantName.toLowerCase())
      );

      const start = this.noneTenantPageIndex * this.noneTenantPageSize;
      const end = start + this.noneTenantPageSize;

      const data = searchedUsers.slice(start, end);

      this.noneTenantTotalDataCount = searchedUsers.length;
      this.noneTenantPageIndex = 0;
      this.noneTenantPageCount = Math.ceil(
        this.noneTenantTotalDataCount / this.noneTenantPageSize
      );

      this.noneTenants = this.sort(data);

      this.isReloading = false;
      this.isLoading = false;
    } else {
      this.handleNoneTenantForStart();
    }
  }

  private handleNoneTenantForStart() {
    this.noneTenantTotalDataCount = this.noneTenantsFull.length;

    this.noneTenantPageSizeOptions = [];
    for(let i = 1; i <= this.noneTenantsFull.length; i++) {
      if(i % 2 === 0) {
        this.noneTenantPageSizeOptions.push(i);
      }
    }
    if(this.noneTenantPageSizeOptions.length === 0)
      this.noneTenantPageSizeOptions.push(this.noneTenantsFull.length);
    this.noneTenantPageSize = this.noneTenantPageSizeOptions[0];

    this.noneTenantPageIndex = 0;
    this.noneTenantPageCount = Math.ceil(
      this.noneTenantsFull.length / this.noneTenantPageSize
    );
    this.noneTenantTableType = 'Users';
    this.noneTenantButtonAction = {
      type: 'add',
    };
    this.noneTenantButtonOperation = {
      type: 'view',
    };

    const data = this.noneTenantsFull.slice(0, this.noneTenantPageSize);
    this.noneTenants = this.sort(data);

    this.isReloading = false;
    this.isLoading = false;
  }

  //<======================= None Tenant Handle Methods =======================>

  //<======================= Tenant Handle Methods =======================>

  protected handleTenantsFileExport(data: FileExportWithDataAndExtentionType) {
    if(data) {
      this.exportTableData(data, 'Tenant');
    } else {
      console.warn('No data to export');
    }
  }

  private async handleTenantActionButtonTigger() {
    if(
      this._tenantsButtonActionTrigger &&
      this._tenantsButtonActionTrigger.type === 'remove'
    ) {
      try {
        if(!this.permissionCheckerForRemove()) {
          this.NotificationDialogComponent.notification('warning', 'You don\'t have permission to remove tenant!');
          return;
        }
        let confirmRemove: boolean = false;
        const users = this.tenantsFull.filter(
          (data) =>
            data.name.toLowerCase() ===
            this._tenantsButtonActionTrigger?.data.element.name.toLowerCase()
        );

        if(users.length === 1) {
          const dialogRef = this.dialog.open(ConfirmationComponent, {
            width: '400px',
            height: 'auto',
            data: {
              isConfirm: true,
              title: 'Renant removal',
              message: 'Do you wish to remove this tenant!'
            }
          })

          dialogRef.afterClosed().subscribe(async (result) => {
            if(result) {
              confirmRemove = result.isConfirm;
              if(confirmRemove) {
                await this.removeTenant(users[0] as TenantHomeButtonDataType);
              }
            }
          })
        }
      }
      catch(error) {
        console.log(error);
        if(error instanceof HttpErrorResponse) {
          this.NotificationDialogComponent.notification('error', error.error.message);
        } else if(typeof error === 'string') {
          this.NotificationDialogComponent.notification('error', error);
        } else if(error instanceof Error) {
          this.NotificationDialogComponent.notification('error', error.message);
        } else {
          this.NotificationDialogComponent.notification('error', 'An error occurred');
        }
      }
    }
  }

  private async handleTenantOperationButtonTigger() {
    if(
      this._tenantsButtonOperationTrigger &&
      this._tenantsButtonOperationTrigger.type === 'view'
    ) {
      const users = this.tenantsFull.filter(
        (data) =>
          data.name.toLowerCase() ===
          this._tenantsButtonOperationTrigger?.data.element.name.toLowerCase()
      );
      if(users.length === 1) {
        this.handleTenantView(
          (users[0] as TenantTableElement).username as string
        );
      }
    }
  }

  private handelTenantPageIndex() {
    const start = this._tenantPageIndex * this._tenantPageSize;
    const end = start + this._tenantPageSize;
    const data = this.tenantsFull.slice(start, end);
    this.tenants = this.sort(data);
  }

  private handelTenantPageSize() {
    if(this._tenantPageSize) {
      const data = this.tenantsFull.slice(
        0 * this.tenantPageSize,
        this._tenantPageSize
      );

      this.tenants = this.sort(data);
    }
  }

  private handleTenantNameSearch() {
    if(this._tenantName) {
      const searchedUsers = this.tenantsFull.filter((user) =>
        user.name.toLowerCase().includes(this._tenantName.toLowerCase())
      );

      const start = this.tenantPageIndex * this.tenantPageSize;
      const end = start + this.tenantPageSize;

      const data = searchedUsers.slice(start, end);

      this.tenantTotalDataCount = searchedUsers.length;
      this.tenantPageIndex = 0;
      this.tenantPageCount = Math.ceil(
        this.tenantTotalDataCount / this.tenantPageSize
      );

      this.tenants = this.sort(data);
      this.isReloading = false;
      this.isLoading = false;
    } else {
      this.handleTenantForStart();
    }
  }

  private handleTenantForStart() {
    this.tenantTotalDataCount = this.tenantsFull.length;
    this.tenantPageSizeOptions = [];
    for(let i = 1; i <= this.tenantsFull.length; i++) {
      if(i % 2 === 0) {
        this.tenantPageSizeOptions.push(i);
      }
    }

    if(this.tenantPageSizeOptions.length === 0)
      this.tenantPageSizeOptions.push(this.tenantsFull.length);
    this.tenantPageSize = this.tenantPageSizeOptions[0];

    this.tenantPageIndex = 0;
    this.tenantPageCount = Math.ceil(
      this.tenantsFull.length / this.tenantPageSize
    );
    this.tenantTableType = 'Tenants';
    this.tenantButtonAction = {
      type: 'remove',
    };
    this.tenantButtonOperation = {
      type: 'view',
    };

    const data = this.tenantsFull.slice(0, this.tenantPageSize);
    this.tenants = this.sort(data);

    this.isReloading = false;
    this.isLoading = false;
  }

  //<======================= Tenanr Handle Methods =======================>

  //<======================= APIs =======================>

  // Get All Users
  private async getAllUsers() {
    this.isLoading = true;
    await this.apiService
      .getAllUsers()
      .then((res: UsersType[] | null) => {
        if(res) {
          this.allUsers = res;
          setTimeout(() => {
            this.isLoading = false;
            this.isReloading = false;
          }, 500);
        }
      })
      .catch((err) => {
        console.log(err);
        setTimeout(() => {
          this.isLoading = false;
          this.isReloading = false;
        }, 500);
      })
      .finally(() => {
        setTimeout(() => {
          this.isLoading = false;
          this.isReloading = false;
        }, 500);
      });
  }

  // Get All Tenants
  private async getAllTenants() {
    this.isLoading = true;
    await this.apiService
      .getAllTenants()
      .then((res) => {
        if(res.status === 'success') {
          this.noneTenantsFull = [];
          this.tenantsFull = [];

          const tenants: TenantTableElement[] =
            res.data as TenantTableElement[];

          tenants.forEach((item) => {
            this.tenantsFull.push({
              username: item.username,
              name: item.name,
              image: item.image,
              contactNumber: item.contactNumber,
              email: item.email,
              gender: item.gender,
              addedBy: item.addedBy,
            });
          });

          const data = this.allUsers?.filter((user) => {
            const userIsTenant: boolean = tenants.some(
              (tenant) => tenant.username === user.username
            );
            return !userIsTenant;
          }) as UsersType[];

          data.forEach((item) => {
            this.noneTenantsFull.push({
              username: item.username,
              name: item.name,
              image: item.image,
              contactNumber: item.phoneNumber,
              email: item.email,
              gender: item.gender,
              addedBy: this.loggedUser?.username as string,
            });
          });

          this.noneTenantsFull = this.sort(this.noneTenantsFull);
          this.tenantsFull = this.sort(this.tenantsFull);
          this.handleNoneTenantForStart();
          this.handleTenantForStart();

          setTimeout(() => {
            this.isLoading = false;
            this.isReloading = false;
          }, 500);
        } else {
          setTimeout(() => {
            this.isLoading = false;
            this.isReloading = false;
          }, 500);
        }
      })
      .catch((err) => {
        console.log(err);
        setTimeout(() => {
          this.isLoading = false;
          this.isReloading = false;
        }, 500);
      })
      .finally(() => {
        setTimeout(() => {
          this.isLoading = false;
          this.isReloading = false;
        }, 500);
      });
  }

  // Add Tenant
  protected async addTenant(data: TenantHomeButtonDataType) {
    this.isLoading = true;
    this.progressBarComponent.start();
    const formData: FormData = new FormData();
    formData.append('username', data.username as string);
    formData.append('name', data.name);
    formData.append('image', data.image as string);
    formData.append('phoneNumber', data.contactNumber);
    formData.append('email', data.email);
    formData.append('gender', data.gender);
    formData.append('addedBy', data.addedBy as string);

    await this.apiService
      .insertTenant(formData)
      .then(async (data) => {
        if(data.status === 'success') {
          this.isReloading = true;
          this.NotificationDialogComponent.notification(data.status, data.message);
          // await this.getAllUsers();
          // await this.getAllTenants();
        }
      })
      .catch((error) => {
        if(error) {
          console.error('Action Button Error: ', error);
          this.progressBarComponent.stop();
          this.NotificationDialogComponent.notification(
            'warning',
            error.error.message
          );
          this.isLoading = false;
          this.isReloading = false;
        }
      })
      .finally(() => {
        this.progressBarComponent.complete();
        this.isLoading = false;
        this.isReloading = false;
      });
  }

  // Remove tenant
  protected async removeTenant(data: TenantHomeButtonDataType) {
    const user: TenantTableElement | undefined = this.tenants.find(
      (item) => item.name.toLowerCase() === data.name.toLowerCase()
    );

    if(user) {
      this.isLoading = true;
      this.progressBarComponent.start();
      const username = user.username;
      await this.apiService
        .deleteTenant(username as string)
        .then((res) => {
          if(res.status === 'success') {
            this.isReloading = true;
            this.NotificationDialogComponent.notification(res.status, res.message);
            // this.getAllTenants();
          } else {
            this.NotificationDialogComponent.notification('warning', res.message);
            this.progressBarComponent.stop();
            this.isLoading = false;
            this.isReloading = false;
          }
        })
        .catch((error) => {
          if(error) {
            this.NotificationDialogComponent.notification(
              'error',
              error.error.message
            );
            this.progressBarComponent.stop();
            this.isLoading = false;
            this.isReloading = false;
          }
        })
        .finally(() => {
          this.progressBarComponent.complete();
          this.isLoading = false;
          this.isReloading = false;
        });
    }
  }

  //<======================= End APIs =======================>

  //<======================= Helpers =======================>

  // Sort
  protected sort(list: TenantTableElement[]) {
    return list.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  }


  // Check Is Admin
  protected isAdmin(): boolean {
    if(this.loggedUser) {
      return this.loggedUser.role.toLocaleLowerCase() === 'admin';
    }
    return false;
  }
  //<======================= End Helpers =======================>
}
