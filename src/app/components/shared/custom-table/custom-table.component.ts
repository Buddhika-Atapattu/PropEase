import {CommonModule, isPlatformBrowser} from '@angular/common';
import {
  AfterViewInit,
  Component,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {Subscription} from 'rxjs';

import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSortModule, Sort} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatTooltipModule} from '@angular/material/tooltip';

import {User} from '../../../services/APIs/apis.service';
import {TenantService} from '../../../services/tenant/tenant.service';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';

import {SwitchButton} from '../../../components/shared/buttons/switch-button/switch-button.component';
import {NotificationDialogComponent, NotificationType} from '../../dialogs/notification/notification.component';
import {ProgressBarComponent} from '../../dialogs/progress-bar/progress-bar.component';
import {FileExportButtonTypeByExtension, PaginatorComponent} from '../paginator/paginator.component';
import {SkeletonLoaderComponent} from '../skeleton-loader/skeleton-loader.component';

/**
 * Button click payload for row actions/operations
 */
export interface ButtonDataType {
  type: string;
  data: any;
}

/**
 * Allowed button types in Action/Operation columns
 */
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
  | 'edit'
  | 'reset'
  | 'search';
}

/** Column descriptor for dynamic tables */
export interface CustomTableColumnType {
  key: string;   // must match a key on each row object
  label: string; // header text
}

/** File export payload bubbled to parent */
export interface FileExportWithDataAndExtentionType {
  data: any[];
  extention: FileExportButtonTypeByExtension;
}



/** Normalized event types so parents can listen to one stream */
export type TableEventType =
  | 'action'
  | 'operation'
  | 'edit:start'
  | 'edit:save'
  | 'edit:cancel'
  | 'row:select'
  | 'switch';

export interface TableEvent<T = any> {
  type: TableEventType;
  payload: T;
  meta?: Record<string, any>;
}

/** Optional per-row visibility predicates for action/operation buttons */
export interface ButtonVisibility {
  action?: (row: any) => boolean;
  operation?: (row: any) => boolean;
}

/** Switch button (toggle) value contract */
export interface SwitchButtonType {
  isActive: boolean;
  index: number | null;
  on?: string;
  off?: string;
  data?: any;
}

@Component({
  selector: 'app-custom-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatTooltipModule,

    SkeletonLoaderComponent,
    PaginatorComponent,
    NotificationDialogComponent,
    ProgressBarComponent,
    SwitchButton,
  ],
  templateUrl: './custom-table.component.html',
  styleUrls: ['./custom-table.component.scss'], // NOTE: plural is correct
})
export class CustomTableComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  // ─────────────────────────────────────────────────────────────
  // Inputs from parent (BEGINNER TIP: think of these as "props")
  // ─────────────────────────────────────────────────────────────
  @Input() loggedUser: User | null = null;
  @Input() isLoading = false;
  @Input() isBrowser = false;
  @Input() mode: boolean | null = null;
  @Input() modeSub: Subscription | null = null;
  @Input() isRemoving = false;

  @Input() fullDataCount = 0;
  @Input() totalDataCount = 0; @Output() totalDataCountChange = new EventEmitter<number>();
  @Input({required: true}) data: any[] = [];
  @Input({required: true}) columns: CustomTableColumnType[] = [];

  @Input() paginationEnable = false; @Output() paginationEnableChange = new EventEmitter<boolean>();
  @Input() pageSize = 2; @Output() pageSizeChange = new EventEmitter<number>();
  @Input() pageSizeOptions: number[] = [2, 4, 6]; @Output() pageSizeOptionsChange = new EventEmitter<number[]>();
  @Input() pageIndex = 0; @Output() pageIndexChange = new EventEmitter<number>();
  @Input() pageCount = 0; @Output() pageCountChange = new EventEmitter<number>();
  @Input() tableType = ''; @Output() tableTypeChange = new EventEmitter<string>();
  @Input() search = ''; @Output() searchChange = new EventEmitter<string>();
  @Input() isReload = false; @Output() isReloadChange = new EventEmitter<boolean>();

  @Input() fileExportButtonTypeByExtension!: FileExportButtonTypeByExtension;
  @Output() fileExport = new EventEmitter<FileExportWithDataAndExtentionType>();

  @Input() buttonAction: ButtonType = {type: 'add'}; @Output() buttonActionChange = new EventEmitter<ButtonType>();
  @Input() buttonOperation: ButtonType = {type: 'view'}; @Output() buttonOperationChange = new EventEmitter<ButtonType>();

  @Input() buttonActionTrigger: ButtonDataType | null = null; @Output() buttonActionTriggerChange = new EventEmitter<ButtonDataType | null>();
  @Input() buttonOperationTrigger: ButtonDataType | null = null; @Output() buttonOperationTriggerChange = new EventEmitter<ButtonDataType | null>();
  @Input() buttonActionTriggerStarted = false; @Output() buttonActionTriggerStartedChange = new EventEmitter<boolean>();
  @Input() buttonOperationTriggerStarted = false; @Output() buttonOperationTriggerStartedChange = new EventEmitter<boolean>();

  @Input() switchButton!: SwitchButtonType;
  @Output() switchButtonChange = new EventEmitter<SwitchButtonType>();

  @Input() notification: NotificationType = {type: '', message: ''};
  @Output() notificationChange = new EventEmitter<NotificationType>();

  // Edit feature flags
  @Input() editable = false;
  @Input() editMode: 'inline' | 'side-panel' | 'modal' = 'side-panel';
  @Input() rowIdKey = 'id';

  // Button visibility toggles
  @Input() showButtons: 'none' | 'action' | 'operation' | 'both' = 'both';
  @Input() buttonVisibility: ButtonVisibility = {};

  // Normalized event stream for parent
  @Output() tableEvent = new EventEmitter<TableEvent>();
  @Output() editRequested = new EventEmitter<any>();
  @Output() editSaved = new EventEmitter<any>();
  @Output() editCancelled = new EventEmitter<any>();

  // ─────────────────────────────────────────────────────────────
  // View children
  // ─────────────────────────────────────────────────────────────
  @ViewChild(ProgressBarComponent, {static: true}) progress!: ProgressBarComponent;
  @ViewChild(NotificationDialogComponent, {static: true}) NotificationDialogComponent!: NotificationDialogComponent;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // ─────────────────────────────────────────────────────────────
  // Internal state used by the table
  // ─────────────────────────────────────────────────────────────
  protected displayedColumnKeys: string[] = [];
  protected dataSource = new MatTableDataSource<any>();
  protected tableButtonAction = '';
  protected tableButtonOperation = '';
  protected tableStatus = '';
  protected isTableVisible = true;
  protected dataCount: number = 0;

  // Default images used as fallbacks
  protected readonly definedMaleDummyImageURL = 'Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL = 'Images/user-images/dummy-user/dummy_woman.jpg';
  protected definedImage = 'Images/System-images/noImage.jpeg';

  // Editing state
  private editingRowId: string | null = null;
  private editingDraft: any = null;

  // Cached per-row visibilities (avoid calling functions in template)
  protected canShowActionForRow: Map<string, boolean> = new Map();
  protected canShowOperationForRow: Map<string, boolean> = new Map();

  // ─────────────────────────────────────────────────────────────
  // DI
  // ─────────────────────────────────────────────────────────────
  public constructor (
    private readonly windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private readonly platformId: Object,
    private readonly tenantService: TenantService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────
  public async ngOnInit(): Promise<void> {
    // Subscribe to theme/mode only in browser
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {this.mode = val;});
    }
  }

  public ngAfterViewInit(): void {
    // Tie "loading" to parent-controlled isReload flag (for skeletons)
    setTimeout(() => {
      this.isLoading = this.isReload;
    }, 500)
  }

  /**
 * Normalizes any status string to a CSS-friendly class and returns:
 *  "main-category <normalized>"
 * - lowercases
 * - trims
 * - replaces spaces with underscores (so 'under review' -> 'under_review')
 * - leaves complaint statuses like 'in_progress' as-is
 */
  protected statusClass(status: string | null | undefined): string {
    const norm = String(status ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');   // spaces → underscores

    // If nothing sensible, just return base.
    if(!norm) return 'main-category';

    return `main-category ${norm}`;
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if(changes['data']) {
      this.tableButtonAction = this.buttonAction.type.trim().toLowerCase();
      this.tableButtonOperation = this.buttonOperation.type.trim().toLowerCase();

      // guard + copy to trigger MatTable change detection
      const rows = Array.isArray(this.data) ? this.data : [];
      this.dataCount = rows.length;
      this.dataSource.data = [...rows];

      this.computeButtonVisibility(this.dataSource.data);

      setTimeout(() => {
        this.isTableVisible = this.fullDataCount > 0;
      }, 0);
    }

    if(changes['columns']) {
      this.displayedColumnKeys = (this.columns ?? []).map(c => c.key);
      this.tableStatus = (this.columns.find(c => c.key.toLowerCase() === 'status')?.key || '').toLowerCase();
    }
  }

  public ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers (BEGINNER TIP: keep template simple; compute in TS)
  // ─────────────────────────────────────────────────────────────

  /** Expose a safe string converter for the template (instead of global String(...)) */
  protected toStr(v: unknown): string {return String(v ?? '');}

  /** Compute per-row visibility for action/operation buttons and cache in maps */
  private computeButtonVisibility(rows: any[]): void {
    this.canShowActionForRow.clear();
    this.canShowOperationForRow.clear();

    const showAction = this.showButtons === 'action' || this.showButtons === 'both';
    const showOperation = this.showButtons === 'operation' || this.showButtons === 'both';

    const hasActionPred = typeof this.buttonVisibility.action === 'function';
    const hasOperationPred = typeof this.buttonVisibility.operation === 'function';

    for(const row of rows) {
      const rowId = this.toStr(row?.[this.rowIdKey]);
      const allowAction = showAction && (!hasActionPred || !!this.buttonVisibility.action!(row));
      const allowOperation = showOperation && (!hasOperationPred || !!this.buttonVisibility.operation!(row));
      this.canShowActionForRow.set(rowId, allowAction);
      this.canShowOperationForRow.set(rowId, allowOperation);
    }
  }

  // Two-way binding proxies
  get userPageCount(): number {return this.pageCount;}
  set userPageCount(value: number) {this.pageCount = value; this.pageCountChange.emit(this.pageCount);}

  get userPageIndex(): number {return this.pageIndex;}
  set userPageIndex(value: number) {this.pageIndex = value; this.pageIndexChange.emit(this.pageIndex);}

  get userPageSize(): number {return this.pageSize;}
  set userPageSize(value: number) {this.pageSize = value; this.pageSizeChange.emit(this.pageSize);}

  get searchValue(): string {return this.search;}
  set searchValue(value: string) {this.search = value; this.searchChange.emit(this.search);}

  get isReloading(): boolean {return this.isReload;}
  set isReloading(value: boolean) {this.isReload = value; this.isReloadChange.emit(this.isReload);}

  get userTotalDataCount(): number {return this.totalDataCount;}
  set userTotalDataCount(value: number) {this.totalDataCount = value; this.totalDataCountChange.emit(this.totalDataCount);}

  get userTableType(): string {return this.tableType;}
  set userTableType(value: string) {this.tableType = value; this.tableTypeChange.emit(this.tableType);}

  get userPageSizeOptions(): number[] {return this.pageSizeOptions;}
  set userPageSizeOptions(value: number[]) {this.pageSizeOptions = value; this.pageSizeOptionsChange.emit(this.pageSizeOptions);}

  get userIsPaginationEnabled(): boolean {return this.paginationEnable;}
  set userIsPaginationEnabled(value: boolean) {this.paginationEnable = value; this.paginationEnableChange.emit(this.paginationEnable);}

  // Toolbar: export
  protected handleFileExport(ext: FileExportButtonTypeByExtension): void {
    this.fileExport.emit({data: this.dataSource.data, extention: ext});
  }

  // Toolbar: action button change (optional)
  protected handleActionButton(btn: ButtonType): void {
    this.buttonAction = btn;
    this.buttonActionChange.emit(this.buttonAction);
  }

  // Row toggle
  protected handleSwitchChange(isActive: SwitchButtonType['isActive'], input: SwitchButtonType['data'], index: number): void {
    this.switchButton = {isActive, index, data: input};
    this.switchButtonChange.emit(this.switchButton);
  }

  // Sorting (null-safe)
  protected sortData(sort: Sort, data?: any[]): void {
    // If not a tenant array, fall back to generic sort
    if(!this.tenantService.isTenantArray(this.dataSource.data)) {
      const src = (data || this.dataSource.data).slice();
      if(!sort.active || sort.direction === '') {
        this.dataSource.data = src;
        return;
      }
      const isAsc = sort.direction === 'asc';
      this.dataSource.data = src.sort((a, b) => this.universalCompare(a?.[sort.active], b?.[sort.active], isAsc));
      return;
    }

    // Tenant data path
    const sourceData = (data || this.dataSource.data).slice();
    const isAsc = sort.direction === 'asc';

    if(!sort.active || sort.direction === '') {
      this.dataSource.data = sourceData;
      return;
    }

    this.dataSource.data = sourceData.sort((a, b) =>
      this.universalCompare(a[sort.active], b[sort.active], isAsc)
    );
  }

  private universalCompare(a: any, b: any, isAsc: boolean): number {
    if(a == null && b != null) return isAsc ? -1 : 1;
    if(a != null && b == null) return isAsc ? 1 : -1;
    if(a == null && b == null) return 0;

    if(typeof a === 'string' && typeof b === 'string') {
      return a.localeCompare(b) * (isAsc ? 1 : -1);
    }
    return (a < b ? -1 : a > b ? 1 : 0) * (isAsc ? 1 : -1);
  }

  // Image helpers
  protected imageGenerator(image: string, type: string, gender?: string): string {
    switch(type.toLowerCase().trim()) {
      case 'userimage': {
        const imagetype = image.split('.')[1];
        if(imagetype) return image;
        if(gender?.toLocaleLowerCase() === 'male') return this.definedMaleDummyImageURL;
        if(gender?.toLocaleLowerCase() === 'female') return this.definedWomanDummyImageURL;
        return this.definedImage;
      }
      case 'propertyimage':
      case 'image':
        return image;
      default:
        return this.definedImage;
    }
  }

  // Formatting helpers
  protected formatDateRange(start: Date, end: Date): string {
    const formatWithSuffix = (date: Date): string => {
      const day = date.getDate();
      const suffix = this.getOrdinalSuffix(day);
      const month = date.toLocaleString('default', {month: 'long'});
      const year = date.getFullYear();
      return `${day}${suffix} of ${month} ${year}`;
    };
    return `${formatWithSuffix(start)} to ${formatWithSuffix(end)}`;
  }

  private getOrdinalSuffix(day: number): string {
    if(day >= 11 && day <= 13) return 'th';
    switch(day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  /** Pretty-print JSON or trim plain text safely */
  protected trimText(text: any): string {
    try {
      const stringValue = typeof text === 'string' ? text.trim() : JSON.stringify(text).trim();
      const parsed = JSON.parse(stringValue);
      if(typeof parsed === 'object' && parsed !== null) {
        return Object.entries(parsed)
          .map(([key, value]) => key.includes('_') ? '' : `${key} : ${value}`)
          .filter(Boolean)
          .join('<br>');
      }
      return String(parsed);
    } catch {
      const safeText = String(text ?? '').trim();
      return safeText.length > 30 ? safeText.slice(0, 30) + '...' : safeText;
    }
  }

  /**
   * Capitalize every word, preserving inline HTML.
   * BEGINNER TIP: DOMParser is browser-only; we guard with isBrowser.
   */
  protected makeCapitalize(text: any): string {
    const stringValue = typeof text === 'string' ? text : String(text ?? '').trim();
    if(!this.isBrowser) return stringValue; // SSR/Electron guard

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${stringValue}</div>`, 'text/html');
    const container = doc.body.firstChild as HTMLElement;

    function capitalizeTextNodes(node: Node): void {
      if(node.nodeType === Node.TEXT_NODE) {
        const originalText = node.nodeValue || '';
        node.nodeValue = originalText
          .split(' ')
          .map(word => word ? (word.charAt(0).toUpperCase() + word.slice(1)) : '')
          .join(' ');
      } else if(node.nodeType === Node.ELEMENT_NODE && node.childNodes) {
        node.childNodes.forEach(child => capitalizeTextNodes(child));
      }
    }

    capitalizeTextNodes(container);
    return container.innerHTML;
  }

  // Edit lifecycle
  protected onEditStart(row: any): void {
    if(!this.editable) return;
    const rowId = this.toStr(row?.[this.rowIdKey]);
    this.editingRowId = rowId;
    this.editingDraft = {...row};

    this.editRequested.emit({id: rowId, row: {...row}});
    this.tableEvent.emit({type: 'edit:start', payload: {id: rowId, row}});
  }

  protected onEditDraftChange(patch: Partial<any>): void {
    if(!this.editable || !this.editingDraft) return;
    this.editingDraft = {...this.editingDraft, ...patch};
  }

  protected onEditSave(): void {
    if(!this.editable || !this.editingDraft) return;

    const rowId = this.toStr(this.editingDraft?.[this.rowIdKey] ?? this.editingRowId ?? '');
    const payload = {id: rowId, row: {...this.editingDraft}};

    this.editSaved.emit(payload);
    this.tableEvent.emit({type: 'edit:save', payload});

    this.editingRowId = null;
    this.editingDraft = null;
  }

  protected onEditCancel(): void {
    if(!this.editable) return;
    const payload = {id: this.editingRowId};
    this.editCancelled.emit(payload);
    this.tableEvent.emit({type: 'edit:cancel', payload});

    this.editingRowId = null;
    this.editingDraft = null;
  }

  protected isRowEditing(row: any): boolean {
    const rowId = this.toStr(row?.[this.rowIdKey]);
    return !!this.editingRowId && this.editingRowId === rowId;
  }

  // Normalized button triggers
  protected handleOperationButtonTrigger(data: ButtonDataType | null): void {
    if(!data) return;
    this.buttonOperationTrigger = data;
    this.buttonOperationTriggerChange.emit(this.buttonOperationTrigger);
    this.buttonOperationTriggerStarted = true;
    this.buttonOperationTriggerStartedChange.emit(this.buttonOperationTriggerStarted);

    this.tableEvent.emit({type: 'operation', payload: data, meta: {column: 'operation'}});
  }

  protected handleActionButtonTrigger(data: ButtonDataType | null): void {
    if(!data) return;
    this.buttonActionTrigger = data as ButtonDataType;
    this.buttonActionTriggerChange.emit(this.buttonActionTrigger);
    this.buttonActionTriggerStarted = true;
    this.buttonActionTriggerStartedChange.emit(this.buttonActionTriggerStarted);

    this.tableEvent.emit({type: 'action', payload: data, meta: {column: 'actions'}});
  }
}
