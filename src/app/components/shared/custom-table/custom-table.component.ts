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
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import {
  APIsService,
  LoggedUserType,
  UsersType,
} from '../../../services/APIs/apis.service';
import { SkeletonLoaderComponent } from '../skeleton-loader/skeleton-loader.component';
import { AuthService } from '../../../services/auth/auth.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  FileExportButtonTypeByExtension,
  PaginatorComponent,
} from '../paginator/paginator.component';
import {
  NotificationComponent,
  NotificationType,
} from '../../dialogs/notification/notification.component';
import { ProgressBarComponent } from '../../dialogs/progress-bar/progress-bar.component';
import { TenantService } from '../../../services/tenant/tenant.service';
import { SwitchButton } from '../../../components/shared/buttons/switch-button/switch-button.component';


export interface ButtonDataType {
  type: string;
  data: any;
}

export interface ButtonType {
  type:
  | 'add'
  | 'delete'
  | 'remove'
  | 'view'
  | 'download'
  | 'approve'
  | 'reject'
  | 'activate'
  | 'deactivate'
  | 'upload'
  | 'reset'
  | 'search';
}

export interface CustomTableColumnType {
  key: string;
  label: string;
}

export interface FileExportWithDataAndExtentionType {
  data: any[];
  extention: FileExportButtonTypeByExtension;
}

export interface SwitchButtonDataFormatType {
  isActive: boolean; // Fixed spelling: was `isAvtive`
  data: any;
}

@Component({
  selector: 'app-custom-table',
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
    SwitchButton
  ],
  templateUrl: './custom-table.component.html',
  styleUrl: './custom-table.component.scss',
})
export class CustomTableComponent
  implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @Input() loggedUser: LoggedUserType | null = null;
  @Input() isLoading: boolean = false;
  @Input() isBrowser: boolean = false;
  @Input() mode: boolean | null = null;
  @Input() modeSub: Subscription | null = null;
  @Input() isRemoving: boolean = false;
  @Input() fullDataCount: number = 0;
  @Input()
  fileExportButtonTypeByExtension: FileExportButtonTypeByExtension | null =
    null;

  @Input() buttonAction: ButtonType = {
    type: 'add',
  };
  @Output() buttonActionChange = new EventEmitter<ButtonType>();

  @Input() buttonOperation: ButtonType = {
    type: 'view',
  };
  @Output() buttonOperationChange = new EventEmitter<ButtonType>();

  @Input() paginationEnable: boolean = false;
  @Output() paginationEnableChange = new EventEmitter<boolean>();

  @Input() totalDataCount: number = 0;
  @Output() totalDataCountChange = new EventEmitter<number>();

  @Input() search: string = '';
  @Output() searchChange = new EventEmitter<string>();

  @Input() data: any[] = [];
  @Input() columns: CustomTableColumnType[] = [];

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

  @Output() fileExport: EventEmitter<FileExportWithDataAndExtentionType> =
    new EventEmitter<FileExportWithDataAndExtentionType>();

  @Input() switchButton: SwitchButtonDataFormatType | null = null;
  @Output() switchButtonChange = new EventEmitter<SwitchButtonDataFormatType>();

  // View child components
  @ViewChild(ProgressBarComponent, { static: true })
  progress!: ProgressBarComponent;
  @ViewChild(NotificationComponent, { static: true })
  notificationComponent!: NotificationComponent;

  // Table data
  protected displayedColumnKeys: string[] = [];
  protected dataSource = new MatTableDataSource<any>();
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  protected tableButtonAction: string = '';
  protected tableButtonOperation: string = '';
  protected tableStatus: string = '';
  protected isTableVisible: boolean = true;

  // Defined images
  protected readonly definedMaleDummyImageURL =
    '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL =
    '/Images/user-images/dummy-user/dummy_woman.jpg';
  protected definedImage: string = '/Images/System-images/noImage.jpeg';

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private apiService: APIsService,
    private authService: AuthService,
    private tenantService: TenantService
  ) { }

  async ngOnInit() {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }

  }

  ngAfterViewInit() { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.tableButtonAction = this.buttonAction.type.trim().toLowerCase();
      this.tableButtonOperation = this.buttonOperation.type
        .trim()
        .toLowerCase();
      this.dataSource.data = this.data;

      setTimeout(() => {
        if (this.fullDataCount > 0) {
          this.isTableVisible = true;
        } else {
          this.isTableVisible = false;
        }
      }, 1000);
    }
    if (changes['columns']) {
      this.displayedColumnKeys = this.columns.map((c) => c.key);
      this.tableStatus = (this.columns.find((c) => c.key.toLowerCase() === 'status')?.key || '').toLowerCase();
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

  get searchValue(): string {
    return this.search;
  }

  set searchValue(value: string) {
    this.search = value;
    this.searchChange.emit(this.search);
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
  protected handleFileExport(data: FileExportButtonTypeByExtension) {
    // FileExportWithDataAndExtentionType
    this.fileExport.emit({
      data: this.dataSource.data,
      extention: data,
    });
  }

  protected handleActionButton(buttonAction: ButtonType) {
    this.buttonAction = buttonAction;
    this.buttonActionChange.emit(this.buttonAction);
  }

  protected handleOperationButtonTrigger(data: ButtonDataType | null) {
    if (!data) return;

    this.buttonOperationTrigger = data;
    this.buttonOperationTriggerChange.emit(this.buttonOperationTrigger);

    this.buttonOperationTriggerStarted = true;
    this.buttonOperationTriggerStartedChange.emit(
      this.buttonOperationTriggerStarted
    );
  }

  protected handleActionButtonTrigger(data: ButtonDataType | null) {
    if (!data) return;

    this.buttonActionTrigger = data as ButtonDataType;
    this.buttonActionTriggerChange.emit(this.buttonActionTrigger);

    this.buttonActionTriggerStarted = true;
    this.buttonActionTriggerStartedChange.emit(this.buttonActionTriggerStarted);
  }

  protected handleSwitchChange(
    isActive: SwitchButtonDataFormatType['isActive'],
    input: SwitchButtonDataFormatType['data']
  ): void {
    this.switchButton = {
      isActive, // Fixed spelling
      data: input
    };

    this.switchButtonChange.emit(this.switchButton);
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
  protected imageGenerator(
    image: string,
    type: string,
    gender?: string
  ): string {
    switch (type.toLowerCase().trim()) {
      case 'userimage':
        const imagetype = image.split('.')[1];
        if (imagetype !== '') {
          return image;
        } else {
          if (gender?.toLocaleLowerCase() === 'male') {
            return this.definedMaleDummyImageURL;
          } else if (gender?.toLocaleLowerCase() === 'female') {
            return this.definedWomanDummyImageURL;
          } else {
            return this.definedImage;
          }
        }
      case 'propertyimage':
        return image;
      default:
        return this.definedImage;
    }
  }

  //<======================= End Image Checker =======================>

  //<======================= Format Date Range =======================>
  protected formatDateRange(start: Date, end: Date): string {
    const formatWithSuffix = (date: Date): string => {
      const day = date.getDate();
      const suffix = this.getOrdinalSuffix(day);
      const month = date.toLocaleString('default', { month: 'long' });
      const year = date.getFullYear();
      return `${day}${suffix} of ${month} ${year}`;
    };

    return `${formatWithSuffix(start)} to ${formatWithSuffix(end)}`;
  }

  private getOrdinalSuffix(day: number): string {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }
  //<======================= End Format Date Range =======================>

  //<======================= Trim Text =======================>
  protected trimText(text: any): string {
    const stringValue = typeof text === 'string' ? text : String(text ?? '');
    const safeText = stringValue.trim();

    return safeText.length > 30 ? safeText.slice(0, 30) + '...' : safeText;
  }
  //<======================= End Trim Text =======================>

  //<======================= Make Capitalize =======================>
  protected makeCapitalize(text: any): string {
    const stringValue = typeof text === 'string' ? text : String(text ?? '').trim();

    // Parse the input HTML into a document fragment
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${stringValue}</div>`, 'text/html');
    const container = doc.body.firstChild as HTMLElement;

    function capitalizeTextNodes(node: Node): void {
      if (node.nodeType === Node.TEXT_NODE) {
        const originalText = node.nodeValue || '';
        const words = originalText.split(' ');
        const capitalized = words
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        node.nodeValue = capitalized;
      } else if (node.nodeType === Node.ELEMENT_NODE && node.childNodes) {
        node.childNodes.forEach(child => capitalizeTextNodes(child));
      }
    }

    capitalizeTextNodes(container);

    return container.innerHTML;
  }
  //<======================= End Make Capitalize =======================>

}
