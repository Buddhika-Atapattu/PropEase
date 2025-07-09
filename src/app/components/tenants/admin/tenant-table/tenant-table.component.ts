import {
  AfterViewInit,
  Component,
  ViewChild,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import {
  MatPaginator,
  MatPaginatorModule,
  PageEvent,
} from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Sort, MatSortModule, MatSort } from '@angular/material/sort';
import { WindowsRefService } from '../../../../services/windowRef/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import {
  APIsService,
  LoggedUserType,
  UsersType,
} from '../../../../services/APIs/apis.service';
import { SkeletonLoaderComponent } from '../../../shared/skeleton-loader/skeleton-loader.component';
import { AuthService } from '../../../../services/auth/auth.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PaginatorComponent } from '../../../shared/paginator/paginator.component';
import {
  NotificationComponent,
  NotificationType,
} from '../../../dialogs/notification/notification.component';
import { ProgressBarComponent } from '../../../dialogs/progress-bar/progress-bar.component';
import {
  TenantService,
} from '../../../../services/tenant/tenant.service';


export interface TenantTableElement {
  username?: string;
  name: string;
  image: string | File | undefined;
  contactNumber: string | undefined;
  email: string;
  gender: string;
  addedBy?: string;
}

export interface ButtonDataType {
  type: string;
  username?: string;
  name: string;
  image: string;
  contactNumber: string;
  email: string;
  gender: string;
  addedBy?: string;
}

export interface ActionButtonType {
  type: 'add' | 'delete' | 'remove' | 'view';
}

export interface CustomTableColumn {
  key: string;
  label: string;
}

@Component({
  selector: 'app-tenant-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    SkeletonLoaderComponent,
    MatTooltipModule,
    PaginatorComponent,
    NotificationComponent,
    ProgressBarComponent,
  ],
  templateUrl: './tenant-table.component.html',
  styleUrl: './tenant-table.component.scss',
})
export class TenantTableComponent
  implements OnInit, AfterViewInit, OnDestroy, OnChanges
{
  @Input() loggedUser: LoggedUserType | null = null;
  @Input() isLoading: boolean = false;
  @Input() isBrowser: boolean = false;
  @Input() mode: boolean | null = null;
  @Input() modeSub: Subscription | null = null;
  @Input() isTenants: boolean = false;
  @Input() isRemoving: boolean = false;
  @Input() fullDataCount: number = 0;

  @Input() buttonAction: ActionButtonType = {
    type: 'add',
  };
  @Output() buttonActionChange = new EventEmitter<ActionButtonType>();

  @Input() buttonOperation: ActionButtonType = {
    type: 'view',
  };
  @Output() buttonOperationChange = new EventEmitter<ActionButtonType>();

  @Input() paginationEnable: boolean = false;
  @Output() paginationEnableChange = new EventEmitter<boolean>();

  @Input() totalDataCount: number = 0;
  @Output() totalDataCountChange = new EventEmitter<number>();

  @Input() name: string = '';
  @Output() nameChange = new EventEmitter<string>();

  @Input() data: any[] = [];
  @Input() columns: CustomTableColumn[] = [];

  @Input() pageSize = 2;
  @Output() pageSizeChange = new EventEmitter<number>();

  @Input() pageSizeOptions: number[] = [2, 4, 6];
  @Output() pageSizeOptionsChange = new EventEmitter<number[]>();

  @Input() pageIndex = 0;
  @Output() pageIndexChange = new EventEmitter<number>();

  @Input() pageCount = 0;
  @Output() pageCountChange = new EventEmitter<number>();

  @Input() tableType: string = '';
  @Output() tableTypeChange = new EventEmitter<string>();

  @Input() isReload: boolean = false;
  @Output() isReloadChange = new EventEmitter<boolean>();

  @Input() buttonActionTrigger: ButtonDataType | null = null;
  @Output() buttonActionTriggerChange =
    new EventEmitter<ButtonDataType | null>();

  @Input() buttonOperationTrigger: ButtonDataType | null = null;
  @Output() buttonOperationTriggerChange =
    new EventEmitter<ButtonDataType | null>();

  @Input() buttonActionTriggerStarted: boolean = false;
  @Output() buttonActionTriggerStartedChange = new EventEmitter<boolean>();

  @Input() buttonOperationTriggerStarted: boolean = false;
  @Output() buttonOperationTriggerStartedChange = new EventEmitter<boolean>();

  @Input() notification: NotificationType = {
    type: '',
    message: '',
  };
  @Output() notificationChange = new EventEmitter<NotificationType>();

  // View child components
  @ViewChild(ProgressBarComponent, { static: true })
  progress!: ProgressBarComponent;
  @ViewChild(NotificationComponent, { static: true })
  notificationComponent!: NotificationComponent;

  // Table data
  protected displayedColumnKeys: string[] = [];
  protected dataSource = new MatTableDataSource<TenantTableElement>();
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  protected tableButtonAction: string = '';
  protected tableButtonOperation: string = '';

  // Defined images
  protected readonly definedMaleDummyImageURL =
    '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL =
    '/Images/user-images/dummy-user/dummy_woman.jpg';
  protected definedImage: string =
    '/Images/user-images/dummy-user/dummy-user.jpg';

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private apiService: APIsService,
    private authService: AuthService,
    private tenantService: TenantService
  ) {}

  async ngOnInit() {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  ngAfterViewInit() {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.tableButtonAction = this.buttonAction.type.trim().toLowerCase();
      this.tableButtonOperation = this.buttonOperation.type
        .trim()
        .toLowerCase();
      this.dataSource.data = this.data;
    }
    if (changes['columns']) {
      this.displayedColumnKeys = this.columns.map((c) => c.key);
    }
  }

  ngOnDestroy() {
    this.modeSub?.unsubscribe();
  }

  //<======================= Getter And Setter =======================>

  //Page Count
  get userPageCount(): number {
    return this.pageCount;
  }

  set userPageCount(value: number) {
    this.pageCount = value;
    this.pageCountChange.emit(this.pageCount);
  }

  // Page Index
  get userPageIndex(): number {
    return this.pageIndex;
  }

  set userPageIndex(value: number) {
    this.pageIndex = value;
    this.pageIndexChange.emit(this.pageIndex);
  }

  get userPageSize(): number {
    return this.pageSize;
  }

  set userPageSize(value: number) {
    this.pageSize = value;
    this.pageSizeChange.emit(this.pageSize);
  }

  get userName(): string {
    return this.name;
  }

  set userName(value: string) {
    this.name = value;
    this.nameChange.emit(this.name);
  }

  get isReloading(): boolean {
    return this.isReload;
  }

  set isReloading(value: boolean) {
    this.isReload = value;
    this.isReloadChange.emit(this.isReload);
  }

  get userTotalDataCount(): number {
    return this.totalDataCount;
  }

  set userTotalDataCount(value: number) {
    this.totalDataCount = value;
    this.totalDataCountChange.emit(this.totalDataCount);
  }

  get userTableType(): string {
    return this.tableType;
  }

  set userTableType(value: string) {
    this.tableType = value;
    this.tableTypeChange.emit(this.tableType);
  }

  get userPageSizeOptions(): number[] {
    return this.pageSizeOptions;
  }

  set userPageSizeOptions(value: number[]) {
    this.pageSizeOptions = value;
    this.pageSizeOptionsChange.emit(this.pageSizeOptions);
  }

  get userIsPaginationEnabled(): boolean {
    return this.paginationEnable;
  }

  set userIsPaginationEnabled(value: boolean) {
    this.paginationEnable = value;
    this.paginationEnableChange.emit(this.paginationEnable);
  }

  //<======================= End Getter And Setter =======================>

  //<======================= Handle Actions =======================>
  protected handleActionButton(buttonAction: ActionButtonType) {
    this.buttonAction = buttonAction;
    this.buttonActionChange.emit(this.buttonAction);
  }

  protected handleOperationButtonTrigger(data: ButtonDataType | null) {
    if (!data) return;
    
    const userData = this.dataSource.data.filter((item) =>
      item.name.toLowerCase().includes(data.name.toLowerCase())
    );

    if (userData.length === 1) {
      const user = {
        type: data.type,
        username: userData[0].username,
        name: userData[0].name,
        image: userData[0].image,
        contactNumber: userData[0].contactNumber,
        email: userData[0].email,
        gender: userData[0].gender,
        addedBy: this.authService.getLoggedUser?.username,
      } as ButtonDataType;
      
      this.buttonOperationTrigger = user;
      this.buttonOperationTriggerChange.emit(this.buttonOperationTrigger);

      this.buttonOperationTriggerStarted = true;
      this.buttonOperationTriggerStartedChange.emit(
        this.buttonOperationTriggerStarted
      );
    }
  }

  protected handleActionButtonTrigger(data: ButtonDataType | null) {
    if (!data) return;
    const userData = this.dataSource.data.filter((item) =>
      item.name.toLowerCase().includes(data.name.toLowerCase())
    );
    if (userData.length === 1) {
      const user = {
        type: data.type,
        username: userData[0].username,
        name: userData[0].name,
        image: userData[0].image,
        contactNumber: userData[0].contactNumber,
        email: userData[0].email,
        gender: userData[0].gender,
        addedBy: this.authService.getLoggedUser?.username,
      } as ButtonDataType;
      this.buttonActionTrigger = user;
      this.buttonActionTriggerChange.emit(this.buttonActionTrigger);

      this.buttonActionTriggerStarted = true;
      this.buttonActionTriggerStartedChange.emit(
        this.buttonActionTriggerStarted
      );
    }
  }
  //<======================= End Handle Actions =======================>

  //<======================= Sort Data =======================>
  protected sortData(sort: Sort, data?: any[]): void {
    if (!this.tenantService.isTenantArray(this.dataSource.data)) {
      return;
    }

    const sourceData = (data || this.dataSource.data).slice();
    const isAsc = sort.direction === 'asc';

    if (!sort.active || sort.direction === '') {
      this.dataSource.data = sourceData;
      return;
    }

    this.dataSource.data = sourceData.sort((a, b) =>
      this.universalCompare(a[sort.active], b[sort.active], isAsc)
    );
  }

  private universalCompare(a: any, b: any, isAsc: boolean): number {
    if (a == null && b != null) return isAsc ? -1 : 1;
    if (a != null && b == null) return isAsc ? 1 : -1;
    if (a == null && b == null) return 0;

    if (typeof a === 'string' && typeof b === 'string') {
      return a.localeCompare(b) * (isAsc ? 1 : -1);
    }

    return (a < b ? -1 : a > b ? 1 : 0) * (isAsc ? 1 : -1);
  }
  //<======================= End Sort Data =======================>

  //<======================= Image Checker =======================>
  protected imageGenerator(image: string): string {
    if (image) {
      const imagetype = image.split('.')[1];
      if (imagetype !== '') {
        return image;
      } else {
        return this.definedMaleDummyImageURL;
      }
    } else {
      return this.definedImage;
    }
  }
  //<======================= End Image Checker =======================>
}
