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
import {ConfirmationComponent} from '../../../components/shared/confirmation/confirmation.component';
import {
  NotificationDialogComponent,
  NotificationType,
} from '../../../components/dialogs/notification/notification.component';
import {ProgressBarComponent} from '../../../components/dialogs/progress-bar/progress-bar.component';
import {
  CustomTableComponent,
  SwitchButtonType,
  FileExport,
  TableButton,
  TableButtonActionConfig,
  TableColumn,
} from '../../../components/shared/custom-table/custom-table.component';
import {APIsService, User} from '../../../services/APIs/apis.service';
import {AuthService} from '../../../services/auth/auth.service';
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
  viewButton: TableButton,
  downloadButton: TableButton
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

  //<======================= Common Variables =======================>
  private _isLoading: boolean = false;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  protected loggedUser: User | null = null;
  protected allUsers: User[] | null = [];

  // Table Data for all users
  protected columns: TableColumn[] = [
    {label: 'Image', key: 'userimage'},
    {label: 'Name', key: 'name'},
    {label: 'Email', key: 'email'},
    {label: 'Contact Number', key: 'contactNumber'},
    {label: 'Gender', key: 'gender'},
    {label: 'View', key: 'viewButton'},
    {label: 'Download', key: 'downloadButton'},
  ];
  private properties!: BackEndPropertyData[];
  //<======================= End Common Variables =======================>

  //<======================= None Tenants Variables | Section 01 =======================>
  private _noneTenantPageSize: number = 2;
  private _noneTenantPageSizeOptions: number[] = [2, 4, 6];
  private _noneTenantPageIndex: number = 0;
  private _noneTenantPageCount: number = 0;
  private _noneTenantTableType: string = '';
  private _noneTenantName: string = '';
  private _noneTenantTotalDataCount: number = 0;
  private _noneTenants: TenantTableElement[] = [];
  protected noneTenantActionButtons: TableButton[] = [
    {'action': 'view', 'icon': 'visibility'},
    {'action': 'add', 'icon': 'add_circle'}
  ]
  protected noneTenantsFull: TenantTableElement[] = [];
  public noneTenantFileExportButtonTypeByExtension: FileExport['extention'] = 'xlsx';
  //<======================= End None Tenants Variables =======================>

  //<======================= Tenants Variables | Section 02 =======================>
  private _tenantPageSize: number = 2;
  private _tenantPageSizeOptions: number[] = [2, 4, 6];
  private _tenantPageIndex: number = 0;
  private _tenantPageCount: number = 0;
  private _tenantTableType: string = '';
  private _tenantName: string = '';
  private _tenantTotalDataCount: number = 0;
  private _tenants: TenantTableElement[] = [];
  protected tenantActionButtons: TableButton[] = [
    {'action': 'view', 'icon': 'visibility'},
    {'action': 'remove', 'icon': 'remove_circle'}
  ]
  protected tenantsFull: TenantTableElement[] = [];
  protected tenantFileExportButtonTypeByExtension: FileExport['extention'] = 'xlsx';
  //<======================= End Tenants Variables =======================>

  //<============================================= LEASE TABLE VARIABLES | Section 03 =============================================>
  protected userLeases: Lease[] = []
  private leaseProperties: BackEndPropertyData[] = []
  private allLeasesUnderLoggedUser: LeaseTableDataType[] = []
  private _leaseTableIsReloading: boolean = false;
  protected leaseTablePageSize: number = 2;
  private _leaseTablePageSizeOptions: number[] = [];
  private _leaseTablePageIndex: number = 0;
  protected leaseTableTitle: string = 'Tenant Leases';
  private _leaseTabletSearch: string = '';
  protected leaseFileExtension: FileExport['extention'] = 'xlsx';
  protected leaseActionButtons: TableButton[] = [
    {'action': 'view', 'icon': 'visibility'},
    {'action': 'download', 'icon': 'download'}
  ]
  protected leaseTableData: LeaseTableDataType[] = [];
  protected leaseTableColumns: TableColumn[] = [
    {label: 'Image', key: 'propertyimage'},
    {label: 'Lease ID', key: 'leaseid'},
    {label: 'Date Range', key: 'daterange'},
    {label: 'Lease Status', key: 'status'},
    {label: 'Monthly Rent', key: 'monthlyRent'},
    {label: 'Remaining Days', key: 'remaningDays'},
    {label: 'View', key: 'viewButton'},
    {label: 'Download', key: 'downloadButton'},
  ];
  private _leaseSwitchButton: SwitchButtonType = {
    isActive: false,
    index: null,
    data: null
  };
  protected leaseLength: number = 0;
  private today: Date = new Date();
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


    // Section 03 data load
    await this.loggeUserLeases()
  }

  ngOnDestroy(): void {

  }

  //<============================================= COMMON GETTER AND SETTER =============================================>
  protected get isLoading(): boolean {
    return this._isLoading;
  }
  protected set isLoading(value: boolean) {
    this._isLoading = value;
  }
  //<============================================= END COMMON GETTER AND SETTER =============================================>

  //<============================================= COMMON OPERATIONS =============================================>
  protected get isAllowed(): boolean {
    if(!this.loggedUser) return false
    const roles: string[] = ['admin', 'operator', 'manager'];
    return roles.includes(this.loggedUser.role)
  }
  //<============================================= END COMMON OPERATIONS =============================================>

  //<============================================= SECTION 03 ========================================================>
  //<============================================= Logged User Lease View ============================================>
  protected async loggeUserLeases(): Promise<void> {
    try {
      if(!this.loggedUser) throw new Error("Please login first!");

      const response = await this.tenantService.getAllLeaseAgreementsByUsername(this.loggedUser.username);


      if(response.status !== 'success') throw new Error(response.message)

      if(response.data.length === 0) throw new Error("You don't have any leases!");

      const leases: Lease[] = response.data;

      this.userLeases = [...leases];
      if(Array.isArray(this.userLeases) && this.userLeases.length > 0) this.organizeLeaseTableData(0);
    }
    catch(error) {
      console.error(error);
      this.userLeases = []
    }
  }

  //<============================================= SETTER & GETTER | SECTION 03 =========================================>
  // 01. leaseTableIsReloading
  get leaseTableIsReloading(): boolean {
    return this._leaseTableIsReloading;
  }
  set leaseTableIsReloading(value: boolean) {
    this._leaseTableIsReloading = value;
    if(this._leaseTableIsReloading) {
      this.organizeLeaseTableData(this._leaseTablePageIndex)
    }
  }

  // 02. leaseTablePageIndex
  get leaseTablePageIndex(): number {
    return this._leaseTablePageIndex;
  }
  set leaseTablePageIndex(value: number) {
    this._leaseTablePageIndex = value;
  }

  // 03. leaseTabletSearch
  get leaseTabletSearch(): string {
    return this._leaseTabletSearch;
  }
  set leaseTabletSearch(value: string) {
    this._leaseTabletSearch = value;
  }

  get leaseTablePageSizeOptions(): number[] {
    return this._leaseTablePageSizeOptions;
  }
  set leaseTablePageSizeOptions(value: number[]) {
    this._leaseTablePageSizeOptions = value
  }
  //<============================================= END SETTER & GETTER | SECTION 03 ============================================>

  //<============================================= HANGLERS | SECTION 03 =======================================================>
  private async organizeLeaseTableData(index: number): Promise<void> {
    try {
      if(!this.loggedUser) {
        throw new Error('Invalid logged user!');
      }

      if(!Array.isArray(this.userLeases) || this.userLeases.length === 0) {
        throw new Error("You don't have any leases!");
      }

      const username: string = this.loggedUser.username?.trim() ?? '';
      if(!username) {
        throw new Error('Invalid username!');
      }

      // ─────────────────────────────────────────────
      // Build all rows in parallel (and wait for them)
      // ─────────────────────────────────────────────
      const rowPromises: Array<Promise<LeaseTableDataType | null>> =
        this.userLeases.map(async (lease: Lease): Promise<LeaseTableDataType | null> => {
          try {
            const propertyID: string | undefined = lease.propertyID;
            if(!propertyID) {
              throw new Error('Invalid property ID!');
            }

            // Assuming this.propertyService.getPropertyById returns a Promise
            const propertyRes = await this.propertyService.getPropertyById(propertyID);
            if(!propertyRes || propertyRes.status !== 'success') {
              throw new Error('Failed to process property fetch!');
            }

            const property: BackEndPropertyData = propertyRes.data;
            if(!property) {
              throw new Error('Invalid property!');
            }

            const propertyImageURL: LeaseTableDataType['image'] =
              property.images?.[0]?.imageURL || '';

            const leaseID: LeaseTableDataType['leaseid'] = lease.leaseID;

            const dateRange: LeaseTableDataType['dateRange'] = {
              start: new Date(lease.leaseAgreement.startDate),
              end: new Date(lease.leaseAgreement.endDate),
            };

            const status: LeaseTableDataType['status'] =
              lease.systemMetadata.validationStatus.toLocaleLowerCase();

            const monthlyRent: LeaseTableDataType['monthlyRent'] =
              `${lease.leaseAgreement.monthlyRent} ${lease.leaseAgreement.currency.currency}`;

            const endTime: number = dateRange.end.getTime();
            const todayTime: number = this.today.getTime();
            const diffMs: number = endTime - todayTime;
            const remaningDays: LeaseTableDataType['remaningDays'] =
              Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            const notify: LeaseTableDataType['notify'] = remaningDays < 30;
            const viewButton: TableButton = {'action': 'view', 'icon': 'visibility', 'label': 'View'};
            const downloadButton: TableButton = {'action': 'download', 'icon': 'download', 'label': 'Download'}
            const data: LeaseTableDataType = {
              image: propertyImageURL,
              leaseid: leaseID,
              dateRange,
              status,
              monthlyRent,
              remaningDays,
              notify,
              viewButton,
              downloadButton
            };

            return data;
          } catch(error) {
            console.error('Error building lease row:', error);
            // Return null so Promise.all still resolves
            return null;
          }
        });

      const rowsWithNulls: Array<LeaseTableDataType | null> = await Promise.all(rowPromises);

      // Filter out failed rows
      const leaseTableRows: LeaseTableDataType[] = rowsWithNulls.filter(
        (row): row is LeaseTableDataType => row !== null,
      );

      if(leaseTableRows.length === 0) {
        throw new Error('Leases not found under the user!');
      }

      // Assign to your table data source (assuming this is your backing array)
      this.allLeasesUnderLoggedUser = leaseTableRows;

      // Now build the visible page
      this.makeLeasePagination(index);
      return;
    } catch(error) {
      console.error('Error organizing lease table data:', error);
      this.NotificationDialogComponent.notification('error', (error as Error).message);
      return;
    } finally {
      setTimeout((): void => {
        this.isLoading = false;
      }, 500);
    }
  }


  private makeLeasePagination(index: number): void {
    try {
      this.leaseTableData = [];
      if(this.allLeasesUnderLoggedUser.length === 0) throw new Error('Leases not found under the user!');
      const pageSize = this.leaseTablePageSize;
      const total = this.allLeasesUnderLoggedUser.length;
      const safeIndex = Math.max(0, Math.min(Math.floor(index), Math.ceil(total / pageSize) - 1));
      const safeStart = safeIndex * pageSize;
      const safeEnd = Math.min(safeStart + pageSize, total);
      const data: LeaseTableDataType[] = this.allLeasesUnderLoggedUser.slice(safeStart, safeEnd);
      this.leaseTableData = [...data];
      return;
    }
    catch(error) {
      console.error(error);
      return;
    }
  }

  protected handleLeaseOperations(value: TableButtonActionConfig) {}

  protected handleExportLeaseTableData(value: FileExport) {
    try {
      if(this.userLeases.length === 0) {
        throw new Error('No lease agreements found!');
      }

      if(this.leaseProperties.length === 0) {
        throw new Error('No properties found!');
      }

      const leasesWithProperty: LeaseWithProperty[] = [];

      this.userLeases.forEach((lease) => {
        const property = this.leaseProperties.find(p => p.id === lease.propertyID);
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

      this.exportLeasesDataAsExcel(leasesWithProperty, value.extention);
    }
    catch(error) {
      console.error(error);
      if(error instanceof HttpErrorResponse) this.NotificationDialogComponent.notification('error', error.message);
      else if(typeof error === 'string') this.NotificationDialogComponent.notification('error', error);
      else if(error instanceof Error) this.NotificationDialogComponent.notification('error', error.message);
      else this.NotificationDialogComponent.notification('error', 'Failed to load tenant data.');
    }
  }


  private exportLeasesDataAsExcel(
    leases: LeaseWithProperty[],
    fileExtension: FileExport['extention'] = 'xlsx'
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
  //<========================================================================= END HANDLERS ========================================================================>


  //<============================================= END SECTION 03 =============================================>
}
