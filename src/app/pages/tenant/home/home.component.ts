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
  NotificationComponent,
  NotificationType,
} from '../../../components/dialogs/notification/notification.component';
import {ProgressBarComponent} from '../../../components/dialogs/progress-bar/progress-bar.component';
import {
  ButtonDataType,
  ButtonType,
  CustomTableColumnType,
  CustomTableComponent,
  FileExportWithDataAndExtentionType,
} from '../../../components/shared/custom-table/custom-table.component';
import {FileExportButtonTypeByExtension} from '../../../components/shared/paginator/paginator.component';
import {APIsService, UsersType} from '../../../services/APIs/apis.service';
import {
  AuthService,
  LoggedUserType,
} from '../../../services/auth/auth.service';
import {TenantService} from '../../../services/tenant/tenant.service';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';

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

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NotificationComponent,
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
  progress!: ProgressBarComponent;
  @ViewChild(NotificationComponent, {static: true})
  notificationComponent!: NotificationComponent;
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

  constructor (
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private apiService: APIsService,
    private dialog: MatDialog
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
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }
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
        this.notificationComponent.notification('error', error);
      } else if(error instanceof HttpErrorResponse) {
        this.notificationComponent.notification('error', error.error.message);
      } else if(error instanceof Error) {
        this.notificationComponent.notification('error', error.message);
      }
      else {
        this.notificationComponent.notification('error', 'Something went wrong!');
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
        this.notificationComponent.notification('error', error);
      } else if(error instanceof HttpErrorResponse) {
        this.notificationComponent.notification('error', error.error.message);
      } else if(error instanceof Error) {
        this.notificationComponent.notification('error', error.message);
      }
      else {
        this.notificationComponent.notification('error', 'Something went wrong!');
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
        this.notificationComponent.notification('warning', 'You don\'t have permission to add tenant!')
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
          this.notificationComponent.notification('warning', 'You don\'t have permission to remove tenant!');
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
          this.notificationComponent.notification('error', error.error.message);
        }else if(typeof error === 'string') {
          this.notificationComponent.notification('error', error);
        } else if(error instanceof Error) {
          this.notificationComponent.notification('error', error.message);
        }else{
          this.notificationComponent.notification('error', 'An error occurred');
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
    this.progress.start();
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
          this.notificationComponent.notification(data.status, data.message);
          // await this.getAllUsers();
          // await this.getAllTenants();
        }
      })
      .catch((error) => {
        if(error) {
          console.error('Action Button Error: ', error);
          this.progress.stop();
          this.notificationComponent.notification(
            'warning',
            error.error.message
          );
          this.isLoading = false;
          this.isReloading = false;
        }
      })
      .finally(() => {
        this.progress.complete();
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
      this.progress.start();
      const username = user.username;
      await this.apiService
        .deleteTenant(username as string)
        .then((res) => {
          if(res.status === 'success') {
            this.isReloading = true;
            this.notificationComponent.notification(res.status, res.message);
            // this.getAllTenants();
          } else {
            this.notificationComponent.notification('warning', res.message);
            this.progress.stop();
            this.isLoading = false;
            this.isReloading = false;
          }
        })
        .catch((error) => {
          if(error) {
            this.notificationComponent.notification(
              'error',
              error.error.message
            );
            this.progress.stop();
            this.isLoading = false;
            this.isReloading = false;
          }
        })
        .finally(() => {
          this.progress.complete();
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
