import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Inject,
  PLATFORM_ID,
  ViewChild
} from '@angular/core';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {Subscription} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {APIsService, BaseUser} from '../../../services/APIs/apis.service';
import {SkeletonLoaderComponent} from '../../../components/shared/skeleton-loader/skeleton-loader.component';
import {Lease, LeaseWithProperty, SWITCH_ON_ARRAY, TenantService} from '../../../services/tenant/tenant.service';
import {
  NotificationComponent,
  NotificationType,
} from '../../../components/dialogs/notification/notification.component';
import {HttpErrorResponse} from '@angular/common/http';
import {
  CustomTableComponent,
  ButtonDataType,
  ButtonType,
  CustomTableColumnType,
  FileExportWithDataAndExtentionType,
  SwitchButtonDataFormatType,
} from '../../../components/shared/custom-table/custom-table.component';
import {FileExportButtonTypeByExtension} from '../../../components/shared/paginator/paginator.component';
import {BackEndPropertyData, PropertyService} from '../../../services/property/property.service';
import {AuthService} from '../../../services/auth/auth.service';
import {MatDialog} from '@angular/material/dialog';
import {CryptoService} from '../../../services/cryptoService/crypto.service';
import {ProgressBarComponent} from '../../../components/dialogs/progress-bar/progress-bar.component';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';

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
  switchButton: boolean;
}

@Component({
  selector: 'app-tenant-view',
  imports: [CommonModule, SkeletonLoaderComponent, CustomTableComponent, NotificationComponent, ProgressBarComponent],
  templateUrl: './tenant-view.component.html',
  styleUrl: './tenant-view.component.scss',
})
export class TenantViewComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(NotificationComponent) notificationComponent!: NotificationComponent
  @ViewChild(ProgressBarComponent) progressBarComponent!: ProgressBarComponent

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  protected modeSub: Subscription | null = null;
  private tenantID: string = '';
  protected tenant: BaseUser | null = null;
  protected leases: Lease[] = [];
  protected isLoading: boolean = true;

  protected readonly definedMaleDummyImageURL =
    '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL =
    '/Images/user-images/dummy-user/dummy_woman.jpg';
  protected definedImage: string =
    '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedImageExtentionArray: string[] = [
    'jpg',
    'webp',
    'jpeg',
    'png',
    'ico',
    'gif',
  ];

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
  protected loggedUser: BaseUser | null = null;
  protected leaseLength: number = 0;
  private selectedProperties: BackEndPropertyData[] = [];
  private today: Date = new Date();
  //<============================================= END LEASE TABLE VARIABLES =============================================>

  constructor (
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: APIsService,
    private tenantService: TenantService,
    private propertyService: PropertyService,
    private authService: AuthService,
    private dialog: MatDialog,
    private cryptoService: CryptoService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });

    this.route.params.subscribe(async (params) => {
      this.tenantID = params['tenantID'];
      await this.loadTenantData();
      await this.getLeaseAgreementsUnderUsername();
      await this.loadeSelectedProperties();
      this.organizeLeaseTableData();
    });

    this.loggedUser = this.authService.getLoggedUser;
  }

  async ngOnInit(): Promise<void> {
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }


  //<========================================================================= LEASE TABLE ========================================================================>
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

  //switchButton
  get leaseSwitchButton(): SwitchButtonDataFormatType {
    return this._leaseSwitchButton;
  }
  set leaseSwitchButton(value: SwitchButtonDataFormatType) {
    this._leaseSwitchButton = value;
    this.handleUpdateLeaseStatus()
  }


  //<========================================================================= END SETTER & GETTER ========================================================================>

  //<========================================================================= HANDLERS & OPERATIONALS ========================================================================>
  protected handleExportLeaseTableData(value: FileExportWithDataAndExtentionType) {
    try {
      if(this.leases.length === 0) {
        throw new Error('No lease agreements found!');
      }

      if(this.selectedProperties.length === 0) {
        throw new Error('No properties found!');
      }

      const leasesWithProperty: LeaseWithProperty[] = [];

      this.leases.forEach((lease) => {
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
      if(error instanceof HttpErrorResponse) this.notificationComponent.notification('error', error.message);
      else if(typeof error === 'string') this.notificationComponent.notification('error', error);
      else if(error instanceof Error) this.notificationComponent.notification('error', error.message);
      else this.notificationComponent.notification('error', 'Failed to load tenant data.');
    }
  }

  private async handleUpdateLeaseStatus() {
    try {
      this.isLoading = true;
      const tableData: LeaseTableDataType = this._leaseSwitchButton?.data as LeaseTableDataType;
      const isActive: SwitchButtonDataFormatType['isActive'] = this._leaseSwitchButton.isActive;

      if(!tableData) throw new Error('No table data found!');

      const leaseId = tableData.leaseid;// get the lease ID from the table data
      if(!leaseId) throw new Error('No lease ID found!');

      // Update Lease Array
      const filteredLease = this.leases.find((lease) => lease.leaseID === leaseId);
      if(!filteredLease) throw new Error('Lease not found in the leases array!');

      const status: Lease['systemMetadata']['validationStatus'] = isActive ? 'active' : 'inactive'

      const leaseAgreement = this.leases.find((lease) => lease.leaseID === leaseId);
      if(!leaseAgreement) throw new Error('Lease not found in the leases array!');

      filteredLease.systemMetadata.validationStatus = status;
      tableData.switchButton = isActive;
      tableData.status = status;
      leaseAgreement.systemMetadata.validationStatus = status;

      const formdata: FormData = new FormData();

      formdata.append('validationStatus', status);

      await this.tenantService.getLeaseAgreementByIDAndUpdateValidationStatus(formdata, leaseId).then((res) => {
        try {
          if(res.status === 'success') {
            this.notificationComponent.notification(res.status, res.message);
          }
          else {
            throw new Error(res.message)
          }
        }
        catch(error) {
          console.log(error);
          this.notificationComponent.notification("error", "Failed to update lease status!");
        }
      });

    }
    catch(error) {
      console.log(error)
      if(error) {
        this.notificationComponent.notification("error", "Failed to update lease status!")
      }
    }
    finally {
      setTimeout(() => {
        this.isLoading = false;
      }, 500);
    }
  }

  private async organizeLeaseTableData(): Promise<void> {
    try {
      if(!this.leases || this.leases.length === 0) {
        throw new Error("No lease agreements found!");
      }

      if(!this.selectedProperties || this.selectedProperties.length === 0) {
        await this.loadeSelectedProperties();
        if(!this.selectedProperties || this.selectedProperties.length === 0) {
          throw new Error("No properties found!");
        }
      }

      this.isLoading = true;
      this.leaseLength = this.leases.length;
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
        {label: 'Download', key: 'operation'},
        {label: 'Active', key: 'switchbutton'}
      ];

      // Clear previous table data
      this.leaseTableData = [];


      for(const lease of this.leases) {
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
        const switchButton: boolean = SWITCH_ON_ARRAY.includes(status.toLowerCase()) ? true : false;


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
          switchButton
        };

        this.leaseTableData.push(rowData);
      }

    } catch(error) {
      console.error('Error organizing lease table data:', error);
      this.notificationComponent.notification('error', (error as Error).message);
    } finally {
      setTimeout(() => {
        this.isLoading = false;
      }, 500);
    }
  }

  private async downloadLeaseAgreement(): Promise<void> {
    try {
      this.progressBarComponent.start();

      const leaseID = this._leaseTableButtonOperationTrigger.data.element.leaseID;
      console.log(leaseID)
      if(!leaseID) throw new Error("Invalid lease ID");

      if(this.authService.getLoggedUser === null) throw new Error("User not logged in");


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
        this.notificationComponent.notification('error', error.message);
      }
      else if(typeof error === 'string') {
        this.notificationComponent.notification('error', error);
      }
      else if(error instanceof Error) {
        this.notificationComponent.notification('error', error.message);
      }
      else {
        this.notificationComponent.notification('error', 'Failed to download lease agreement PDF.');
      }
    } finally {
      this.progressBarComponent.complete();
    }
  }


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
  //<========================================================================= END HANDLERS & OPERATIONALS ========================================================================>
  //<========================================================================= END LEASE TABLE ========================================================================>

  //<========================================================================= LOAD PROPERTY DATA ========================================================================>
  private async loadeSelectedProperties() {
    try {
      if(this.leases.length === 0) {
        throw new Error("No lease agreements found!");
      }

      this.isLoading = true;
      const seen = new Set<string>();

      for(const lease of this.leases) {
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
            this.notificationComponent.notification('error', 'No property found for this lease.');
          } else {
            this.notificationComponent.notification('error', 'Failed to fetch property.');
          }
        }
      }

    } catch(error) {
      console.error(error);
      this.notificationComponent.notification('error', 'Failed to load selected properties.');
    }
    finally {
      setTimeout(() => {
        this.isLoading = false;
      }, 500);
    }
  }
  //<========================================================================= END LOAD PROPERTY DATA ========================================================================>

  //<========================================================================= LOAD TENANT DATA ========================================================================>
  private async loadTenantData(): Promise<void> {
    try {
      const res = await this.apiService.getUserByToken(this.tenantID);

      if(!res || !res.user) {
        throw new Error('User data is missing from response.');
      }

      this.tenant = res.user as BaseUser;

    } catch(error) {
      console.error('Error loading tenant data:', error);
      this.notificationComponent?.notification?.(
        'error',
        'Failed to load tenant data. Please try again later.'
      );
    } finally {
      // Delay spinner fade-out slightly
      setTimeout(() => {
        this.isLoading = false;
      }, 500);
    }
  }
  //<========================================================================= END LOAD TENANT DATA ========================================================================>

  //<========================================================================= LOAD LEASE AGREEMENTS DATA ========================================================================>
  private async getLeaseAgreementsUnderUsername(): Promise<void> {
    try {
      const username = this.tenant?.username || '';
      if(!username) {
        throw new Error('Tenant username is missing.');
      }

      const res = await this.tenantService.getAllLeaseAgreementsByUsername(username);

      if(res.status === 'success') {
        this.leases = res.data as Lease[];
        await this.organizeLeaseTableData();
      } else {
        console.error('Failed to fetch lease agreements:', res.message);
        this.leases = [];
        this.notificationComponent.notification(
          'error',
          'Failed to fetch lease agreements. Please try again later.'
        );
      }

    } catch(error: any) {
      console.error('Error fetching lease agreements:', error);

      if(error instanceof HttpErrorResponse && error.status === 404) {
        this.notificationComponent.notification(
          'error',
          'No lease agreements found for this tenant.'
        );
      } else {
        this.notificationComponent.notification(
          'error',
          'An error occurred while fetching lease agreements. Please try again later.'
        );
      }

      this.leases = [];
    }
  }
  //<========================================================================= END LOAD LEASE AGREEMENTS DATA ========================================================================>

  //<========================================================================= LOAD TENANT IMAGE DATA ========================================================================>
  protected generateTenantImage(image: string, gender: string): string {
    try {
      const imageArray: string[] = image ? image.split('/') : [];

      if(Array.isArray(imageArray) && imageArray.length > 0) {
        const lastSegment = imageArray[imageArray.length - 1];
        const extension = lastSegment.split('.').pop()?.toLowerCase();

        if(extension && this.definedImageExtentionArray.includes(extension)) {
          this.definedImage = image;
        } else {
          this.definedImage = gender.toLowerCase() === 'male'
            ? this.definedMaleDummyImageURL
            : this.definedWomanDummyImageURL;
        }
      } else {
        // Handle case where image is empty or malformed
        this.definedImage = gender.toLowerCase() === 'male'
          ? this.definedMaleDummyImageURL
          : this.definedWomanDummyImageURL;
      }

      return this.definedImage;

    } catch(error) {
      console.error('Error generating tenant image:', error);
      return gender.toLowerCase() === 'male'
        ? this.definedMaleDummyImageURL
        : this.definedWomanDummyImageURL;
    }
  }
  //<========================================================================= END LOAD TENANT IMAGE DATA ========================================================================>

  //<========================================================================= GO TO THE LEASE CREATION ========================================================================>
  protected async makeTenantLease(): Promise<void> {
    try {
      if(!this.isBrowser) {
        throw new Error('Not running in browser environment.');
      }

      if(!this.tenant || !this.tenant.username) {
        throw new Error('Tenant information is missing.');
      }

      const tokenResult = await this.apiService.generateToken(this.tenant.username);

      if(!tokenResult || !tokenResult.token) {
        throw new Error('Failed to generate tenant token.');
      }

      await this.router.navigate(['/dashboard/tenant/create-lease', tokenResult.token]);

    } catch(error) {
      console.error('Error while trying to create tenant lease:', error);
      this.notificationComponent.notification('error', 'Unable to create tenant lease.');
    }
  }
  //<========================================================================= END GO TO THE LEASE CREATION ========================================================================>

  //<========================================================================= GO TO THE TENANT DASHBOARD ========================================================================>
  protected async goToTenants(): Promise<void> {
    try {
      await this.router.navigateByUrl('/', {skipLocationChange: true});
      await this.router.navigate(['/dashboard/tenant/tenant-home/']);
    } catch(error) {
      console.error('Navigation to tenants page failed:', error);
      this.notificationComponent.notification(
        'error',
        'Failed to navigate to the tenants page.'
      );
    }
  }
  //<========================================================================= END GO TO THE TENANT DASHBOARD ========================================================================>

  //<========================================================================= GO TO THE TENANT VIEW ========================================================================>
  protected async goToTenant(): Promise<void> {
    try {
      if(!this.tenant) {
        throw new Error('No tenant information available.');
      }

      const tenant = await this.apiService.generateToken(this.tenant.username);

      if(!tenant || !tenant.token) {
        throw new Error('Failed to generate tenant token.');
      }

      await this.router.navigateByUrl('/', {skipLocationChange: true});
      await this.router.navigate(['/dashboard/tenant/tenant-view/', tenant.token]);

    } catch(error) {
      console.error('Navigation to tenant view failed:', error);
      this.notificationComponent.notification('error', 'Unable to load tenant view.');
    }
  }
  //<========================================================================= END GO TO THE TENANT VIEW ========================================================================>


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
}
