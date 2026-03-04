// Path: src/app/components/shared/custom-table/custom-table.component.ts
// ============================================================================
// CustomTableComponent (standalone, class-based, OnPush)
// ============================================================================
//
// ✅ NAVIGATION INDEX (Sections → Subsections)
// ---------------------------------------------------------------------------
// [00]  File header + design goals
// [01]  Public types (stable contracts)
//   [01.1]  File icon + extension mapping
//   [01.2]  Action icon registries (advanced + legacy)
//   [01.3]  Editing contracts (inline/dialog)
//   [01.4]  Render kinds + KPI cell shape
//   [01.5]  Column behavior inference (data type + render + edit)
//   [01.6]  Smart filtering types (auto-distributed filter models)
// [02]  Component declaration (standalone imports + OnPush)
// [03]  Inputs / Outputs (public API surface)
// [04]  Internal state (dataSource, caches, behavior maps, edit shadow state)
//   [04.1]  Heuristics tokens (date/image/kpi)
//   [04.2]  Differ + retry/fetch state
//   [04.3]  Smart filter state + enum cache
// [05]  Constructor (SSR-safe init + unified filterPredicate)
//   [05.1]  FilterPredicate design (legacy text OR smart JSON state)
// [06]  Template API methods (called from HTML)
// [07]  Lifecycle hooks (OnInit/OnChanges/DoCheck/Destroy)
// [08]  Generic helpers (trackBy, SafeHtml, empty checks)
// [09]  Smart behavior engine (column normalization + auto injection + decisions)
//   [09.1]  Column behavior decision logic
//   [09.2]  Data type inference (sample-scan + key hints + value-based strict date)
//   [09.3]  RenderKind→DataType mapping
// [10]  Action column injection (advanced first, then legacy)
//   [10.1]  Action columns detection helpers
//   [10.2]  Legacy button derivation + safety rules
// [11]  Advanced multiple-actions (row rules + click output + uniqueness checks)
// [12]  Editing engine (shadow state + normalize values + emit rich edit payload)
//   [12.1]  Lightweight validation rules
// [13]  Smart filtering engine (AUTO detect + distribute per column)
//   [13.1]  Filter decision builder (TableFilterKind per ColumnDataType)
//   [13.2]  Enum inference (low-cardinality detection + unique values cache)
//   [13.3]  Filter application (MatTableDataSource.filter JSON)
//   [13.4]  Row evaluation (global search + per-column evaluators)
// [14]  KPI “stock-like” helpers (arrow + delta + sparkline SVG polyline)
// [15]  KPI normalization (extract + stable ordering + inject KPI columns)
// [16]  Render resolver (template-friendly resolveRenderKind())
// [17]  Sorting (universalCompare supports KPI/date/string/number)
// [18]  Pagination getters/setters (safe index/limit + integration outputs)
// [19]  Paginator controls (date range, switch)
// [20]  File export (kept)
// [21]  Legacy single action click (kept)
// [22]  Retry/fetch logic (kept)
// [23]  Date parsing helpers (SSR-safe, STRICT value-based)
// [24]  Image helpers (kept compatible)
// [25]  Text trim + tooltip (safe defaults)
// [26]  Legacy action derivation helpers (kept)
// [27]  MIME/ext → icon mapping (kept)
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DoCheck,
  EventEmitter,
  Inject,
  Input,
  IterableDiffer,
  IterableDiffers,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { User } from '../../../services/APIs/apis.service';
import { AuthService } from '../../../services/auth/auth.service';
import { ImageService } from '../../../services/imageService/image.service';
import { TextService } from '../../../services/text/text.service';
import { PaginationUtil } from '../../../source/utility/pagination.util';

import { DateRange, Extension, PaginatorComponent } from '../paginator/paginator.component';
import { SwitchButton } from '../../../components/shared/buttons/switch-button/switch-button.component';
import { SkeletonLoaderComponent } from '../skeleton-loader/skeleton-loader.component';
import { DateTimePickerComponent } from '../date-time-picker/date-time-picker.component';

import {
  TextEditorDialogComponent,
  TextEditorDialogData,
  TextEditorDialogResult,
} from '../../dialogs/text-editor-dialog/text-editor-dialog.component';

// ============================================================================
// [01] Public types (stable contracts with parent + template)
// ============================================================================

export type TableExtension = Extension;
export type TableDateRange = DateRange;

// ---------------------------------------------------------------------------
// [01.1] File icon + extension mapping
// ---------------------------------------------------------------------------

/** Icons for files (Material Icons) */
export type MaterialFileIcon =
  | 'description'
  | 'text_snippet'
  | 'code'
  | 'table_chart'
  | 'slideshow'
  | 'picture_as_pdf'
  | 'folder_zip'
  | 'image'
  | 'insert_drive_file';

/** Extension mapping (kept to not break your current logic) */
export const EXTENSION_ICON_MAP: Record<Extension, MaterialFileIcon> = {
  doc: 'description',
  docx: 'description',
  dot: 'description',
  dotx: 'description',
  rtf: 'description',
  odt: 'description',

  txt: 'text_snippet',
  xml: 'code',

  xls: 'table_chart',
  xlsx: 'table_chart',
  xlsm: 'table_chart',
  xlt: 'table_chart',
  xltx: 'table_chart',
  ods: 'table_chart',
  csv: 'table_chart',
  tsv: 'table_chart',

  ppt: 'slideshow',
  pptx: 'slideshow',
  pptm: 'slideshow',
  pot: 'slideshow',
  potx: 'slideshow',
  odp: 'slideshow',

  pdf: 'picture_as_pdf',
  zip: 'folder_zip',

  png: 'image',
  jpeg: 'image',
  webp: 'image',
  gif: 'image',
  jpg: 'image',
  ico: 'image',
  svg: 'image',

  file: 'insert_drive_file',
};

// ---------------------------------------------------------------------------
// [01.2] Action icon registries (advanced + legacy)
// ---------------------------------------------------------------------------

export type IconKey =
  | 'view'
  | 'edit'
  | 'add'
  | 'delete'
  | 'archive'
  | 'restore'
  | 'close'
  | 'more'
  | 'task.assign'
  | 'task.complete'
  | 'task.pending'
  | 'task.blocked'
  | 'property'
  | 'property.add'
  | 'property.edit'
  | 'property.location'
  | 'property.image'
  | 'tenant'
  | 'tenant.add'
  | 'tenant.remove'
  | 'tenant.verify'
  | 'lease'
  | 'lease.sign'
  | 'lease.terminate'
  | 'lease.renew'
  | 'payment'
  | 'invoice'
  | 'file.upload'
  | 'file.download'
  | 'file.preview';

export const ICON_REGISTRY: Record<IconKey, string> = {
  view: 'visibility',
  edit: 'edit',
  add: 'add_circle',
  delete: 'delete',
  archive: 'archive',
  restore: 'unarchive',
  close: 'close',
  more: 'more_vert',

  'task.assign': 'assignment_add',
  'task.complete': 'task_alt',
  'task.pending': 'hourglass_empty',
  'task.blocked': 'block',

  property: 'apartment',
  'property.add': 'add_home',
  'property.edit': 'home_repair_service',
  'property.location': 'location_on',
  'property.image': 'photo_library',

  tenant: 'person',
  'tenant.add': 'person_add',
  'tenant.remove': 'person_remove',
  'tenant.verify': 'verified_user',

  lease: 'description',
  'lease.sign': 'draw',
  'lease.terminate': 'cancel_schedule_send',
  'lease.renew': 'autorenew',

  payment: 'payments',
  invoice: 'receipt_long',
  'file.upload': 'upload',
  'file.download': 'download',
  'file.preview': 'preview',
};

// -----------------------------
// Legacy buttons (do NOT break)
// -----------------------------
export type ActionId =
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

export type ActionIcon =
  | 'add_circle'
  | 'delete'
  | 'remove_circle'
  | 'visibility'
  | 'download'
  | 'check_circle'
  | 'cancel'
  | 'toggle_on'
  | 'toggle_off'
  | 'upload'
  | 'edit'
  | 'restart_alt'
  | 'search';

export const ACTION_ICONS: Record<ActionId, ActionIcon> = {
  add: 'add_circle',
  delete: 'delete',
  remove: 'remove_circle',
  view: 'visibility',
  download: 'download',
  approve: 'check_circle',
  reject: 'cancel',
  activate: 'toggle_on',
  deactivate: 'toggle_off',
  upload: 'upload',
  edit: 'edit',
  reset: 'restart_alt',
  search: 'search',
};

export interface TableButton {
  action: ActionId;
  icon: ActionIcon;
  label?: string;
  disabled?: boolean;
}

export interface TableButtonActionConfig {
  action: ActionId;
  data: any;
}

// -----------------------------
// Advanced multiple actions
// -----------------------------
export type TableButtonId = string;

export interface TableUiButton {
  id: TableButtonId;
  iconKey?: IconKey;
  icon?: string;
  label?: string;
  tooltip?: string;

  /** Row-aware rules */
  visible?: boolean | ( ( row: any ) => boolean );
  disabled?: boolean | ( ( row: any ) => boolean );

  /** Visual tone for menu item */
  tone?: 'good' | 'normal' | 'danger';
}

export interface TableUiButtonClickConfig {
  id: TableButtonId;
  row: any;
  meta?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// [01.3] Editing contracts (inline/dialog)
// ---------------------------------------------------------------------------

export type TableEditKind =
  | 'none'
  | 'inlineText'
  | 'inlineNumber'
  | 'inlineSelect'
  | 'inlineSwitch'
  | 'dialogText'
  | 'inlineDate'
  | 'inlineDateTime'
  | 'dialogDateRange';

export interface TableEditOption {
  label: string;
  value: any;
}

export interface TableEditConfig {
  kind: TableEditKind;

  maxLength?: number;
  min?: number;
  max?: number;

  options?: TableEditOption[];

  dialogTitle?: string;
  fieldLabel?: string;
  maxDialogLength?: number;

  minDate?: Date | string;
  maxDate?: Date | string;

  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}

// ---------------------------------------------------------------------------
// [01.4] Render kinds + KPI cell shape
// ---------------------------------------------------------------------------

export type TableRenderKind =
  | 'auto'
  | 'text'
  | 'number'
  | 'status'
  | 'icon'
  | 'date'
  | 'dateTime'
  | 'dateRange'
  | 'switch'
  | 'image'
  | 'singleAction'
  | 'multipleActions'
  | 'kpiSpark';

export type KpiTone = 'ok' | 'warn' | 'danger' | 'normal' | string;

export interface TableKpiSparkCell {
  score?: number;
  delta?: number;
  tone?: KpiTone;
  series?: Array<number | null | undefined>;
}

/** Column config */
export interface TableColumn {
  key: string;
  label: string;
  edit?: TableEditConfig;
  render?: TableRenderKind;
  multipleActions?: ReadonlyArray<TableUiButton>;
}

/** File export payload */
export interface FileExport {
  data: any[];
  extention: Extension;
}

/** Switch output (kept) */
export interface SwitchButtonType {
  isActive: boolean;
  index: number | null;
  on?: string;
  off?: string;
  data?: any;
}

/** Main “edit event” contract */
export interface TableCellEdit {
  rowIndex: number;
  columnKey: string;
  value: any;
  row: any;
  editKind: TableEditKind;

  meta?: {
    detectedType?: ColumnDataType;
    column?: TableColumn;
    previousValue?: any;
    isValid?: boolean;
    message?: string;
  };
}

export type ActionRenderMode = 'auto' | 'separate' | 'grouped';

/** Detectable data types for cells/columns (smart inference) */
export type ColumnDataType =
  | 'unknown'
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'dateTime'
  | 'dateRange'
  | 'image'
  | 'status'
  | 'icon'
  | 'kpi'
  | 'actions'
  | 'object'
  | 'array';

/** Smart decision result for how a column should behave */
export interface ColumnBehaviorDecision {
  key: string;
  renderKind: TableRenderKind;
  dataType: ColumnDataType;
  editKind: TableEditKind;
  isEditable: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// [01.6] Smart filtering types (auto-distributed filter models)
// ---------------------------------------------------------------------------

export type TableFilterKind =
  | 'none'
  | 'text'
  | 'numberRange'
  | 'dateRange'
  | 'booleanTri'
  | 'enum'
  | 'kpiRange';

export interface TableColumnFilterDecision {
  key: string;
  kind: TableFilterKind;
  dataType: ColumnDataType;
  reason?: string;

  enumValues?: string[];
  enumMode?: 'single' | 'multi';
}

/** Smart filter state stored as JSON in MatTableDataSource.filter */
export interface TableFilterState {
  globalText?: string;
  columns: Record<string, any>;
}

// ============================================================================
// [02] Component declaration
// ============================================================================
@Component( {
  selector: 'app-custom-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,

    MatTableModule,
    MatSortModule,
    MatTooltipModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,

    SkeletonLoaderComponent,
    PaginatorComponent,
    SwitchButton,
    DateTimePickerComponent,
  ],
  templateUrl: './custom-table.component.html',
  styleUrls: [ './custom-table.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class CustomTableComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges, DoCheck {
  @ViewChild( DateTimePickerComponent, { static: true } )
  public dateTimePicker!: DateTimePickerComponent;

  // ==========================================================================
  // [03] Inputs / Outputs (public API of this component)
  // ==========================================================================

  // ---- Data & columns
  @Input( { required: true } ) public data: any[] = [];
  @Input( { required: true } ) public columns: TableColumn[] = [];

  // ---- Table basics
  @Input( { required: false } ) public tableTitle: string = '';
  @Input() public rowIdKey: string = 'id';

  // ---- Pagination integration
  @Input( { required: false } ) public pagination: boolean = false;
  @Input( { required: false } ) public totalDataCount: number = 0;

  @Input( { required: false } ) public limit: number = 2;
  @Output() public limitChange: EventEmitter<number> = new EventEmitter<number>();

  @Input( { required: false } ) public index: number = 0;
  @Output() public indexChange: EventEmitter<number> = new EventEmitter<number>();

  // ---- Search integration
  @Input( { required: false } ) public search: string = '';
  @Output() public searchChange: EventEmitter<string> = new EventEmitter<string>();

  // ---- Reload (kept for existing screens)
  @Input( { required: false } ) public isReload: boolean = false;
  @Output() public isReloadChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  // ---- Export
  @Input() public fileExportExtention!: Extension;
  @Output() public fileExport: EventEmitter<FileExport> = new EventEmitter<FileExport>();

  // ---- Date range filter (kept)
  @Input() public isDateRageActive: boolean = false;

  @Input() public dateRange: DateRange | null = null;
  @Output() public dateRangeChange: EventEmitter<DateRange | null> = new EventEmitter<DateRange | null>();
  @Output() public rangeChange: EventEmitter<DateRange | null> = new EventEmitter<DateRange | null>();

  // ---- Legacy buttons (do not break)
  @Input() public buttons: TableButton[] = [];
  @Output() public buttonOperation: EventEmitter<TableButtonActionConfig> = new EventEmitter<TableButtonActionConfig>();

  // ---- Advanced buttons (new)
  @Input() public advancedButtons: ReadonlyArray<TableUiButton> = [];
  @Input() public advancedActionsColumnKey: string = 'actions';
  @Input() public advancedActionsColumnLabel: string = 'Actions';

  /** ✅ New multipleActions output */
  @Output() public uiButtonClick: EventEmitter<TableUiButtonClickConfig> = new EventEmitter<TableUiButtonClickConfig>();

  // ---- Switch (kept)
  @Input() public switch!: SwitchButtonType;
  @Output() public switchChange: EventEmitter<SwitchButtonType> = new EventEmitter<SwitchButtonType>();

  // ---- Fetch data request (kept)
  @Output() public fetchData: EventEmitter<void> = new EventEmitter<void>();

  // ---- Edit output (main contract)
  @Output() public cellEdit: EventEmitter<TableCellEdit> = new EventEmitter<TableCellEdit>();

  // ---- Actions behavior
  @Input() public actionRenderMode: ActionRenderMode = 'auto';
  @Input() public autoInjectActionColumns: boolean = true;
  @Input() public actionsColumnLabel: string = 'Actions';

  // ---- Client filtering toggle (legacy)
  @Input() public enableClientFilter: boolean = false;

  // ---- Smart filtering toggles (new)
  @Input() public enableSmartFilters: boolean = true;

  /** Global search noise control */
  @Input() public globalSearchTextOnly: boolean = true;

  // ==========================================================================
  // [04] Internal state
  // ==========================================================================

  private readonly isBrowser: boolean;
  protected readonly loggedUser: User | null;

  /** Angular Material table source */
  protected dataSource: MatTableDataSource<any> = new MatTableDataSource<any>();

  /** Column keys for <mat-table [displayedColumns]> */
  protected displayedColumnKeys: string[] = [];

  /** Status key presence (for class mapping) */
  protected tableStatus: string = '';

  /** Visibility + load fallback */
  protected isTableVisible: boolean = true;
  protected dataCount: number = 0;
  protected isArrayOfData: boolean = false;

  /** Image fallbacks (kept) */
  protected readonly definedMaleDummyImageURL: string = 'Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL: string = 'Images/user-images/dummy-user/dummy_woman.jpg';
  protected readonly definedImage: string = 'Images/System-images/noImage.jpeg';

  /** Legacy action columns map */
  protected buttonColumns: Map<string, TableButton> = new Map<string, TableButton>();

  /** Column behavior cache (render/type/edit decisions) */
  protected columnBehavior: Map<string, ColumnBehaviorDecision> = new Map<string, ColumnBehaviorDecision>();

  /** Row edit shadow state (no mutation while typing) */
  protected rowEditState: Map<string, Record<string, any>> = new Map<string, Record<string, any>>();

  /** Keys that are date-ish and editable (normalize to Date objects) */
  private editableDateKeys: Set<string> = new Set<string>();

  // --------------------------------------------------------------------------
  // [04.2] Retry / fetch state
  // --------------------------------------------------------------------------
  private fetchAttempts: number = 0;
  private readonly maxFetchAttempts: number = 3;
  private readonly fetchRetryDelayMs: number = 400;
  private fetchRetryTimerId: ReturnType<typeof setTimeout> | null = null;

  // --------------------------------------------------------------------------
  // [04.3] KPI normalization caches
  // --------------------------------------------------------------------------
  private normalizedRows: any[] = [];
  private kpiColumnOrderCache: string[] | null = null;

  private readonly KPI_ORDER_HINTS: ReadonlyArray<string> = [
    'overall',
    'performance',
    'completion',
    'completed',
    'completionrate',
    'velocity',
    'throughput',
    'productivity',
    'quality',
    'sla',
    'health',
    'engagement',
    'risk',
    'blocked',
    'overdue',
  ] as const;

  private readonly KPI_CONTAINER_KEYS: ReadonlyArray<string> = [
    'kpis',
    'kpi',
    'metrics',
    'metric',
    'stats',
    'stat',
    'summary',
    'scorecard',
  ] as const;

  // ---- Data differ
  private dataDiffer: IterableDiffer<any> | null = null;

  // --------------------------------------------------------------------------
  // [04.1] Heuristics tokens (image/date)
  // --------------------------------------------------------------------------

  private readonly IMAGE_COLUMN_HINTS: ReadonlyArray<{
    token: string;
    type: 'userimage' | 'propertyImage' | 'image';
  }> = [
      { token: 'userimage', type: 'userimage' },
      { token: 'profile', type: 'userimage' },
      { token: 'avatar', type: 'userimage' },

      { token: 'propertyimage', type: 'propertyImage' },
      { token: 'propertyicon', type: 'propertyImage' },
      { token: 'propertyavatar', type: 'propertyImage' },

      { token: 'teamlogo', type: 'image' },
      { token: 'logo', type: 'image' },
      { token: 'picture', type: 'image' },
      { token: 'photo', type: 'image' },
      { token: 'image', type: 'image' },
      { token: 'img', type: 'image' },
    ];

  private readonly NON_IMAGE_KEY_TOKENS: ReadonlyArray<string> = [ 'id', 'uuid', 'code', 'number', 'no' ];

  private readonly DATE_KEY_TOKENS: ReadonlyArray<string> = [
    'date',
    'time',
    'datetime',
    'created',
    'startat',
    'endat',
    'createdat',
    'updated',
    'updatedat',
    'deleted',
    'deletedat',
    'dob',
    'birth',
    'expires',
    'expiry',
    'from',
    'to',
    'start',
    'end',
    'at',
    'timestamp',
    'ts',
  ];

  // --------------------------------------------------------------------------
  // [04.3-A] Smart filter state + caches
  // --------------------------------------------------------------------------

  /** Smart filter decisions: key -> filter kind */
  protected smartFilterDecision: Map<string, TableColumnFilterDecision> = new Map<string, TableColumnFilterDecision>();

  /** Current smart filter state stored in MatTableDataSource.filter (JSON) */
  protected smartFilterState: TableFilterState = {
    globalText: '',
    columns: {},
  };

  /** Enum cache: columnKey -> unique values */
  private smartEnumCache: Map<string, string[]> = new Map<string, string[]>();

  // ==========================================================================
  // [05] Constructor (SSR-safe init + unified filterPredicate)
  // ==========================================================================
  public constructor (
    private readonly authService: AuthService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly imageService: ImageService,
    private readonly cdr: ChangeDetectorRef,
    private readonly differs: IterableDiffers,
    private readonly dialog: MatDialog,
    private readonly textService: TextService,
    private readonly sanitizer: DomSanitizer,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.loggedUser = this.authService.getLoggedUser ?? null;

    // ========================================================================
    // [05.1] FilterPredicate design
    // ------------------------------------------------------------------------
    // Supports:
    //   1) Legacy string filter
    //   2) Smart JSON filter (TableFilterState)
    // ========================================================================
    this.dataSource.filterPredicate = ( row: any, filter: string ): boolean => {
      try {
        const raw: string = String( filter ?? '' ).trim();
        if ( !raw ) return true;

        const parsed = this.tryParseFilterState( raw );
        if ( parsed ) return this.evaluateRowAgainstFilterState( row, parsed );

        // Legacy fallback
        const needle = raw.toLowerCase();
        return this.legacyGlobalTextMatch( row, needle );
      } catch {
        return true;
      }
    };
  }

  // ==========================================================================
  // [06] Template API methods (must be public/protected — NOT private)
  // ==========================================================================

  /** Template hook: emits file export request (called by HTML). */
  protected handleFileExport( extention: Extension, _data: any[] ): void {
    // Backward safe: keep exporting this.data, not the param.
    this.fileExportHandle( extention );
  }

  /** Template hook: returns a css class for status pills/badges. */
  protected statusClass( status: string | null | undefined ): string {
    const norm: string = String( status ?? '' ).trim().toLowerCase().replace( /\s+/g, '_' );
    if ( !norm ) return 'main-category';
    return `main-category ${ norm }`;
  }

  /** Template hook: capitalize words safely (SSR-safe). */
  protected makeCapitalize( text: any ): string {
    const stringValue: string = typeof text === 'string' ? text : String( text ?? '' ).trim();

    // SSR-safe path
    if ( !this.isBrowser ) {
      return stringValue
        .split( ' ' )
        .map( ( w ) => ( w ? w.charAt( 0 ).toUpperCase() + w.slice( 1 ) : '' ) )
        .join( ' ' );
    }

    // Browser path: preserve HTML and only capitalize text nodes
    const parser: DOMParser = new DOMParser();
    const doc: Document = parser.parseFromString( `<div>${ stringValue }</div>`, 'text/html' );
    const container: HTMLElement = doc.body.firstChild as HTMLElement;

    const walk = ( node: Node ): void => {
      if ( node.nodeType === Node.TEXT_NODE ) {
        const original: string = node.nodeValue || '';
        node.nodeValue = original
          .split( ' ' )
          .map( ( w ) => ( w ? w.charAt( 0 ).toUpperCase() + w.slice( 1 ) : '' ) )
          .join( ' ' );
        return;
      }

      if ( node.nodeType === Node.ELEMENT_NODE && node.childNodes ) {
        node.childNodes.forEach( ( child ) => walk( child ) );
      }
    };

    walk( container );
    return container.innerHTML;
  }

  // ==========================================================================
  // [07] Lifecycle: OnInit / OnChanges / DoCheck / Destroy
  // ==========================================================================

  public async ngOnInit(): Promise<void> {
    const rows: any[] = Array.isArray( this.data ) ? this.data : [];

    // KPI normalization may inject KPI columns dynamically
    this.normalizedRows = this.normalizeRowsForKpi( rows );
    this.dataSource.data = this.normalizedRows;

    this.dataCount = rows.length;
    this.isArrayOfData = rows.length > 0;

    this.dataDiffer = this.differs.find( rows ).create<any>();

    this.normalizeColumnsAndBuildBehavior();

    // Apply filter (smart or legacy depending on flags)
    this.applyClientFilterIfEnabled();

    this.scheduleDataFetchIfNeeded();
  }

  public ngAfterViewInit(): void {}

  public ngOnDestroy(): void {
    this.resetFetchAttempts();
  }

  public ngOnChanges( changes: SimpleChanges ): void {
    let dataChanged = false;

    if ( changes[ 'data' ] ) {
      const rows: any[] = Array.isArray( this.data ) ? this.data : [];
      this.normalizedRows = this.normalizeRowsForKpi( rows );
      this.dataSource.data = this.normalizedRows;

      this.dataCount = rows.length;
      this.isArrayOfData = rows.length > 0;

      this.dataDiffer = this.differs.find( rows ).create<any>();

      // Remove edit state for removed rows
      const aliveRowIds = new Set<string>( rows.map( ( r, idx ) => this.getRowId( r, idx ) ) );
      for ( const id of Array.from( this.rowEditState.keys() ) ) {
        if ( !aliveRowIds.has( id ) ) this.rowEditState.delete( id );
      }

      dataChanged = true;
      this.applyClientFilterIfEnabled();
      this.cdr.markForCheck();
    }

    if (
      changes[ 'columns' ] ||
      changes[ 'buttons' ] ||
      changes[ 'advancedButtons' ] ||
      changes[ 'actionRenderMode' ] ||
      changes[ 'autoInjectActionColumns' ] ||
      changes[ 'enableSmartFilters' ]
    ) {
      this.normalizeColumnsAndBuildBehavior();
      this.applyClientFilterIfEnabled();
      this.cdr.markForCheck();
    }

    if ( changes[ 'enableClientFilter' ] || changes[ 'search' ] || changes[ 'globalSearchTextOnly' ] ) {
      this.applyClientFilterIfEnabled();
      this.cdr.markForCheck();
    }

    if ( changes[ 'totalDataCount' ] || dataChanged ) {
      Promise.resolve().then( () => this.scheduleDataFetchIfNeeded() );
    }
  }

  public ngDoCheck(): void {
    if ( !this.dataDiffer || !Array.isArray( this.data ) ) return;

    const diff = this.dataDiffer.diff( this.data );
    if ( !diff ) return;

    this.normalizedRows = this.normalizeRowsForKpi( this.data );
    this.dataSource.data = this.normalizedRows;

    this.dataCount = this.data.length;
    this.isArrayOfData = this.data.length > 0;

    // Remove edit state for removed rows
    const aliveRowIds = new Set<string>( this.data.map( ( r, idx ) => this.getRowId( r, idx ) ) );
    for ( const id of Array.from( this.rowEditState.keys() ) ) {
      if ( !aliveRowIds.has( id ) ) this.rowEditState.delete( id );
    }

    this.applyClientFilterIfEnabled();
    this.cdr.markForCheck();
  }

  // ==========================================================================
  // [08] TrackBy + safe helpers
  // ==========================================================================

  protected trackByRow = ( index: number, row: any ): string => this.getRowId( row, index );
  protected trackByColumn = ( _: number, col: TableColumn ): string => String( col?.key ?? '' );

  protected asSafeHtml( html: string ): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml( String( html ?? '' ) );
  }

  protected isEmptyValue( value: any ): boolean {
    if ( value == null ) return true;
    if ( typeof value === 'string' && !value.trim() ) return true;
    if ( Array.isArray( value ) && value.length === 0 ) return true;
    if ( typeof value === 'object' && !Array.isArray( value ) && Object.keys( value ).length === 0 ) return true;
    return false;
  }

  protected getColumnLabel( col: TableColumn ): string {
    const raw = String( col?.label ?? col?.key ?? '' ).trim();
    return raw || '—';
  }

  /**
   * [08.1] Unified filter apply (smart JSON OR legacy)
   */
  private applyClientFilterIfEnabled(): void {
    if ( this.enableSmartFilters ) {
      this.applySmartFilter();
      return;
    }

    // Legacy mode only
    if ( !this.enableClientFilter ) return;
    this.dataSource.filter = String( this.search ?? '' ).trim().toLowerCase();
  }

  // ==========================================================================
  // [09] Smart behavior engine (identify column types + action types + edits)
  // ==========================================================================

  private normalizeColumnsAndBuildBehavior(): void {
    this.buttonColumns.clear();
    this.columnBehavior.clear();

    // [09.0] Normalize columns (dedupe by key)
    const rawColumns: TableColumn[] = Array.isArray( this.columns ) ? this.columns : [];
    const normalized: TableColumn[] = [];
    const seenKeys: Set<string> = new Set<string>();

    for ( const col of rawColumns ) {
      const key = String( col?.key ?? '' ).trim();
      if ( !key ) continue;

      if ( seenKeys.has( key ) ) {
    // eslint-disable-next-line no-console
        console.warn( '[Warning:] [CustomTable] Dropping duplicate column key:', key, '\n' );
        continue;
      }

      seenKeys.add( key );
      normalized.push( col );
    }

    // [09.0-A] Auto-inject actions if needed (advanced first, then legacy)
    this.autoInjectActionColumnsIfNeeded( normalized, seenKeys );

    // Apply
    this.columns = normalized;
    this.displayedColumnKeys = normalized.map( ( c ) => c.key );

    // [09.0-B] Find status key (used by CSS class)
    this.tableStatus = ( normalized.find( ( c ) => c.key.toLowerCase() === 'status' )?.key || '' ).toLowerCase();

    // [09.0-C] Build legacy button map (single action columns)
    this.deriveLegacyButtonColumns( normalized );

    // [09.0-D] Build editable key caches (for date normalization)
    this.rebuildEditableKeyCaches();

    // [09.0-E] Validate multipleActions uniqueness
    this.validateMultipleActionsUniqueIds();

    // [09.1] Build “behavior decisions” for each column
    for ( const col of this.columns ) {
      const decision = this.decideColumnBehavior( col );
      this.columnBehavior.set( col.key, decision );
    }

    // [09.2] Build “smart filter decisions” AFTER behavior decisions exist
    this.rebuildSmartFilterDecisions();
  }

  // --------------------------------------------------------------------------
  // [09.1] Column behavior decision logic
  // --------------------------------------------------------------------------

  private decideColumnBehavior( col: TableColumn ): ColumnBehaviorDecision {
    const key = String( col?.key ?? '' ).trim();
    const render = col.render ?? 'auto';
    const editKind: TableEditKind = col.edit?.kind ?? 'none';
    const isEditable = editKind !== 'none';

    const detectedType = this.detectColumnDataType( key, col );

    // [09.1-A] Honor explicit render (but still keep detected type for meta)
    if ( render !== 'auto' ) {
      return {
        key,
        renderKind: render,
        dataType: this.renderKindToDataType( render, detectedType ),
        editKind,
        isEditable,
        reason: 'Explicit render specified by column config',
      };
    }

    // [09.1-B] Actions first (avoid mis-detection)
    if ( this.isMultipleActionsColumn( col ) ) {
      return {
        key,
        renderKind: 'multipleActions',
        dataType: 'actions',
        editKind: 'none',
        isEditable: false,
        reason: 'Column has multipleActions definitions',
      };
    }

    if ( this.isButtonColumn( key ) ) {
      return {
        key,
        renderKind: 'singleAction',
        dataType: 'actions',
        editKind: 'none',
        isEditable: false,
        reason: 'Legacy action column derived from btn_* / button patterns',
      };
    }

    // [09.1-C] Images by key hints
    if ( this.isImageLikeColumn( key ) ) {
      return {
        key,
        renderKind: 'image',
        dataType: 'image',
        editKind,
        isEditable,
        reason: 'Key hints indicate image-like column',
      };
    }

    // [09.1-D] KPI columns
    if ( this.isKpiLikeKey( key ) ) {
      const sample = this.dataSource.data?.[ 0 ]?.[ key ];
      if ( this.isKpiCellShape( sample ) || typeof sample === 'number' ) {
        return {
          key,
          renderKind: 'kpiSpark',
          dataType: 'kpi',
          editKind,
          isEditable,
          reason: 'Key looks KPI-like and sample matches KPI shape/number',
        };
      }
    }

    // [09.1-E] STRICT date/dateTime by VALUE (not only by key)
    if ( detectedType === 'date' || detectedType === 'dateTime' ) {
      return {
        key,
        renderKind: detectedType === 'dateTime' ? 'dateTime' : 'date',
        dataType: detectedType,
        editKind,
        isEditable,
        reason: 'Detected by strict value-based date parsing',
      };
    }

    // [09.1-F] Boolean => switch render + switch edit default
    if ( detectedType === 'boolean' ) {
      return {
        key,
        renderKind: 'switch',
        dataType: 'boolean',
        editKind: editKind === 'none' ? 'inlineSwitch' : editKind,
        isEditable: true,
        reason: 'Detected boolean column (renders as switch)',
      };
    }

    // [09.1-G] Number
    if ( detectedType === 'number' ) {
      return {
        key,
        renderKind: 'number',
        dataType: 'number',
        editKind,
        isEditable,
        reason: 'Detected numeric column',
      };
    }

    // [09.1-H] status/icon common keys
    const lower = key.toLowerCase();
    if ( lower === 'status' ) {
      return { key, renderKind: 'status', dataType: 'status', editKind, isEditable, reason: 'Key is status' };
    }
    if ( lower === 'icon' ) {
      return { key, renderKind: 'icon', dataType: 'icon', editKind, isEditable, reason: 'Key is icon' };
    }

    // [09.1-I] Default text
    return {
      key,
      renderKind: 'text',
      dataType: detectedType === 'unknown' ? 'text' : detectedType,
      editKind,
      isEditable,
      reason: 'Default to text render',
    };
  }

  // --------------------------------------------------------------------------
  // [09.2] Data type inference (sample scan + key hints + strict date-by-value)
  // --------------------------------------------------------------------------

  private detectColumnDataType( columnKey: string, col?: TableColumn ): ColumnDataType {
    const key = String( columnKey ?? '' ).trim();
    if ( !key ) return 'unknown';

    // Strong hints: image
    if ( this.isImageLikeColumn( key ) ) return 'image';

    // Actions
    if ( col && this.isMultipleActionsColumn( col ) ) return 'actions';
    if ( this.isButtonColumn( key ) ) return 'actions';

    // KPI
    if ( this.isKpiLikeKey( key ) ) {
      const sample = this.dataSource.data?.[ 0 ]?.[ key ];
      if ( this.isKpiCellShape( sample ) || typeof sample === 'number' ) return 'kpi';
    }

    // Key-hint date is helpful, BUT do not trust it alone (use value checks too)
    const keyHintsDate = this.isDateColumnKey( key );

    // Sample scan (small window = fast)
    const rows = Array.isArray( this.dataSource.data ) ? this.dataSource.data : [];
    const scanN = Math.min( 20, rows.length );

    let seenNumber = 0;
    let seenBoolean = 0;
    let seenString = 0;
    let seenArray = 0;
    let seenObject = 0;

    // STRICT date signals (value-based)
    let seenDate = 0;
    let seenDateTime = 0;

    for ( let i = 0; i < scanN; i++ ) {
      const v = rows[ i ]?.[ key ];
      if ( v == null ) continue;

      // ✅ strict value-based date detection early (prevents false positives)
      const dateProbe = this.isDateStringValue( v );
      if ( dateProbe.isDate ) {
        if ( dateProbe.kind === 'dateTime' ) seenDateTime++;
        else seenDate++;
        continue;
      }

      if ( Array.isArray( v ) ) {
        seenArray++;
        continue;
      }

      const t = typeof v;
      if ( t === 'number' && Number.isFinite( v ) ) seenNumber++;
      else if ( t === 'boolean' ) seenBoolean++;
      else if ( t === 'string' ) seenString++;
      else if ( t === 'object' ) seenObject++;
    }

    // If we saw strict dates, prefer them (datetime wins)
    if ( seenDateTime > 0 ) return 'dateTime';
    if ( seenDate > 0 ) return 'date';

    // If key hints date but no strict match, DO NOT force date.
    // This avoids bugs like IDs that include "time" or "ts" but aren't dates.
    if ( keyHintsDate ) {
      // leave decision to normal type inference below (safe)
    }

    // Heuristic priority
    if ( seenBoolean > 0 && seenBoolean >= seenNumber && seenBoolean >= seenString ) return 'boolean';
    if ( seenNumber > 0 && seenNumber >= seenString && seenNumber >= seenObject ) return 'number';
    if ( seenString > 0 ) return 'text';
    if ( seenArray > 0 ) return 'array';
    if ( seenObject > 0 ) return 'object';

    return 'unknown';
  }

  // --------------------------------------------------------------------------
  // [09.3] RenderKind → DataType mapping
  // --------------------------------------------------------------------------

  private renderKindToDataType( renderKind: TableRenderKind, fallback: ColumnDataType ): ColumnDataType {
    switch ( renderKind ) {
      case 'number':
        return 'number';
      case 'date':
        return 'date';
      case 'dateTime':
        return 'dateTime';
      case 'dateRange':
        return 'dateRange';
      case 'image':
        return 'image';
      case 'status':
        return 'status';
      case 'icon':
        return 'icon';
      case 'singleAction':
      case 'multipleActions':
        return 'actions';
      case 'kpiSpark':
        return 'kpi';
      case 'switch':
        return 'boolean';
      case 'text':
      default:
        return fallback === 'unknown' ? 'text' : fallback;
    }
  }

  // ==========================================================================
  // [10] Action column injection (advanced first, then legacy) - backward safe
  // ==========================================================================

  private autoInjectActionColumnsIfNeeded( normalized: TableColumn[], seenKeys: Set<string> ): void {
    if ( !this.autoInjectActionColumns ) return;

    const hasLegacyCols = this.hasAnyLegacyActionColumns( normalized );
    const hasMultiCols = this.hasAnyMultipleActionsColumns( normalized );

    // If already has actions columns, do nothing
    if ( hasLegacyCols || hasMultiCols ) return;

    // [10.0] Advanced grouped actions
    const hasAdvanced = Array.isArray( this.advancedButtons ) && this.advancedButtons.length > 0;
    if ( hasAdvanced ) {
      const col = this.buildAdvancedActionsColumn();
      if ( !seenKeys.has( col.key ) ) {
        seenKeys.add( col.key );
        normalized.push( col );
      }
      return;
    }

    // [10.1] Legacy buttons injection
    const hasLegacyButtons = Array.isArray( this.buttons ) && this.buttons.length > 0;
    if ( !hasLegacyButtons ) return;

    const resolvedMode: ActionRenderMode =
      this.actionRenderMode === 'auto' ? this.resolveAutoActionRenderModeFromButtons() : this.actionRenderMode;

    if ( resolvedMode === 'grouped' ) {
      const col = this.buildGroupedActionsFromLegacyButtons();
      if ( !seenKeys.has( col.key ) ) {
        seenKeys.add( col.key );
        normalized.push( col );
      }
      return;
    }

    // Separate mode => multiple btn_* columns
    for ( const btn of this.buttons ) {
      const c = this.buildLegacyActionColumn( btn );
      if ( !seenKeys.has( c.key ) ) {
        seenKeys.add( c.key );
        normalized.push( c );
      }
    }
  }

  // --------------------------------------------------------------------------
  // [10.1] Action column detection helpers
  // --------------------------------------------------------------------------

  private hasAnyMultipleActionsColumns( cols: TableColumn[] ): boolean {
    return Array.isArray( cols ) && cols.some( ( c ) => this.isMultipleActionsColumn( c ) );
  }

  private hasAnyLegacyActionColumns( cols: TableColumn[] ): boolean {
    return Array.isArray( cols ) && cols.some( ( c ) => this.isLikelyLegacyActionColumn( String( c?.key ?? '' ) ) );
  }

  private buildAdvancedActionsColumn(): TableColumn {
    const defs: ReadonlyArray<TableUiButton> = Array.isArray( this.advancedButtons ) ? this.advancedButtons : [];
    return {
      key: this.advancedActionsColumnKey,
      label: this.advancedActionsColumnLabel,
      render: 'multipleActions',
      multipleActions: defs,
    };
  }

  private buildLegacyActionColumn( button: TableButton ): TableColumn {
    const key = `btn_${ button.action }`;
    return {
      key,
      label: String( button.label || this.buildButtonLabelFromAction( button.action ) ).trim(),
      render: 'singleAction',
    };
  }

  private buildGroupedActionsFromLegacyButtons(): TableColumn {
    const defs: TableUiButton[] = ( Array.isArray( this.buttons ) ? this.buttons : [] ).map( ( b ) => ( {
      id: b.action,
      icon: b.icon,
      label: b.label || this.buildButtonLabelFromAction( b.action ),
      tooltip: b.label || this.buildButtonLabelFromAction( b.action ),
      tone: this.checkButtonBGforDanger( b.action )
        ? 'danger'
        : this.checkButtonBGforGood( b.action )
          ? 'good'
          : 'normal',
      disabled: !!b.disabled,
    } ) );

    return {
      key: 'actions',
      label: this.actionsColumnLabel,
      render: 'multipleActions',
      multipleActions: defs,
    };
  }

  private resolveAutoActionRenderModeFromButtons(): ActionRenderMode {
    if ( this.actionRenderMode !== 'auto' ) return this.actionRenderMode;

    const btns: TableButton[] = Array.isArray( this.buttons ) ? this.buttons : [];
    if ( btns.length <= 1 ) return 'separate';

    const labels = btns
      .map( ( b ) => String( b.label || this.buildButtonLabelFromAction( b.action ) ).trim() )
      .filter( Boolean );

    const unique = new Set( labels.map( ( l ) => l.toLowerCase() ) );
    return unique.size > 1 ? 'separate' : 'grouped';
  }

  // ==========================================================================
  // [10.2] Legacy button detection (IMPORTANT: do not treat "actions" as legacy)
  // ==========================================================================

  protected isButtonColumn( columnKey: string ): boolean {
    const keyLower = String( columnKey ?? '' ).trim().toLowerCase();
    return this.buttonColumns.has( keyLower );
  }

  protected getButtonForColumn( columnKey: string ): TableButton | null {
    const keyLower = String( columnKey ?? '' ).trim().toLowerCase();
    return this.buttonColumns.get( keyLower ) ?? null;
  }

  private deriveLegacyButtonColumns( cols: TableColumn[] ): void {
    for ( const col of cols ) {
      if ( this.isMultipleActionsColumn( col ) || col.render === 'multipleActions' ) continue;

      const keyRaw = String( col?.key ?? '' ).trim();
      if ( !keyRaw ) continue;

      const keyLower = keyRaw.toLowerCase();

      if ( !this.isLikelyLegacyActionColumn( keyLower ) ) continue;

      const action: ActionId | null = this.deriveActionFromColumn( col );
      if ( !action ) {
        // eslint-disable-next-line no-console
        console.warn( '[Warning:] [CustomTable] Could not derive action from button column:\n', col, '\n' );
        continue;
      }

      const override = this.findButtonConfig( action );
      const label = col.label || override?.label || this.buildButtonLabelFromAction( action );
      const icon: ActionIcon = override?.icon || ACTION_ICONS[ action ];

      this.buttonColumns.set( keyLower, { action, icon, label } );
    }
  }

  private isLikelyLegacyActionColumn( columnKey: string ): boolean {
    const k = String( columnKey ?? '' ).toLowerCase().trim();

    // ✅ legacy patterns only
    if ( k.startsWith( 'btn_' ) ) return true;
    if ( k.includes( 'btn' ) ) return true;
    if ( k.includes( 'button' ) || k.includes( 'buttons' ) ) return true;

    // ❌ do NOT treat "actions" as legacy
    return false;
  }

  private findButtonConfig( action: ActionId ): TableButton | null {
    if ( !Array.isArray( this.buttons ) || this.buttons.length === 0 ) return null;
    return this.buttons.find( ( btn ) => btn.action === action ) ?? null;
  }

  // ==========================================================================
  // [11] Advanced multiple-actions (row rules + click output)
  // ==========================================================================

  protected isMultipleActionsColumn( column: TableColumn ): boolean {
    return Array.isArray( column.multipleActions ) && column.multipleActions.length > 0;
  }

  protected getMultipleActionsForRow( column: TableColumn, row: any ): ReadonlyArray<TableUiButton> {
    const defs: ReadonlyArray<TableUiButton> = Array.isArray( column.multipleActions ) ? column.multipleActions : [];
    if ( defs.length === 0 ) return [];

    const out: TableUiButton[] = [];

    for ( const def of defs ) {
      const visible = this.resolveUiBool( def.visible, row, true );
      if ( !visible ) continue;

      const disabled = this.resolveUiBool( def.disabled, row, false );

      out.push( {
        ...def,
        disabled,
        visible: true,
      } );
    }

    return out;
  }

  protected resolveUiIcon( button: TableUiButton ): string {
    const direct = String( button?.icon ?? '' ).trim();
    if ( direct ) return direct;

    const iconKey: IconKey | undefined = button?.iconKey;
    if ( iconKey && ICON_REGISTRY[ iconKey ] ) return ICON_REGISTRY[ iconKey ];

    return 'help_outline';
  }

  protected handleUiButtonClick( button: TableUiButton, row: any ): void {
    try {
      const id = String( button?.id ?? '' ).trim();
      if ( !id ) throw new Error( 'UI button id is required.' );

      this.uiButtonClick.emit( { id, row } );

      // Bridge: do not break old listeners
      const asLegacy = id as ActionId;
      if ( ( Object.keys( ACTION_ICONS ) as ActionId[] ).includes( asLegacy ) ) {
        this.buttonOperation.emit( { action: asLegacy, data: row } );
      }
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [CustomTable] handleUiButtonClick failed.\n', error );
    }
  }

  private resolveUiBool( rule: boolean | ( ( row: any ) => boolean ) | undefined, row: any, fallback: boolean ): boolean {
    if ( typeof rule === 'boolean' ) return rule;

    if ( typeof rule === 'function' ) {
      try {
        return !!rule( row );
      } catch {
        return fallback;
      }
    }

    return fallback;
  }

  private validateMultipleActionsUniqueIds(): void {
    try {
      const cols: TableColumn[] = Array.isArray( this.columns ) ? this.columns : [];

      for ( const col of cols ) {
        if ( !Array.isArray( col.multipleActions ) || col.multipleActions.length === 0 ) continue;

        const seen: Set<string> = new Set<string>();

        for ( const btn of col.multipleActions ) {
          const id: string = String( btn?.id ?? '' ).trim();
          if ( !id ) continue;

          if ( seen.has( id ) ) {
            // eslint-disable-next-line no-console
            console.warn(
              '[Warning:] [CustomTable] Duplicate multipleActions id in column:',
              col.key,
              ' id:',
              id,
              '\n',
            );
          }
          seen.add( id );
        }
      }
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [CustomTable] validateMultipleActionsUniqueIds failed.\n', error );
    }
  }

  // ==========================================================================
  // [12] Editing engine (normalize value types + emit smart payload to parent)
  // ==========================================================================

  private rebuildEditableKeyCaches(): void {
    this.editableDateKeys.clear();

    for ( const c of Array.isArray( this.columns ) ? this.columns : [] ) {
      const k = String( c?.key ?? '' ).trim();
      const kind = c?.edit?.kind;
      if ( !k || !kind ) continue;

      if ( kind === 'inlineDate' || kind === 'inlineDateTime' ) {
        this.editableDateKeys.add( k );
      }
    }
  }

  private getRowId( row: any, rowIndex: number ): string {
    const key = String( this.rowIdKey ?? 'id' ).trim();
    const v = row?.[ key ];

    const direct = String( v ?? '' ).trim();
    if ( direct ) return direct;

    return `__idx__${ rowIndex }`;
  }

  private normalizeEditableValue( key: string, value: any ): any {
    if ( this.editableDateKeys.has( key ) ) {
      if ( value == null || value === '' ) return null;

      if ( value instanceof Date ) return isNaN( value.getTime() ) ? null : value;

      // Accept ISO/known formats too
      const parsed = this.tryParseDateStrict( value );
      if ( parsed.date ) return parsed.date;

      const d = new Date( value );
      return isNaN( d.getTime() ) ? null : d;
    }

    return value;
  }

  private ensureRowEditState( rowIndex: number, row: any ): Record<string, any> {
    const id = this.getRowId( row, rowIndex );

    const existing = this.rowEditState.get( id );
    if ( existing ) return existing;

    const state: Record<string, any> = { ...( row ?? {} ) };

    for ( const key of this.editableDateKeys ) {
      state[ key ] = this.normalizeEditableValue( key, state[ key ] );
    }

    this.rowEditState.set( id, state );
    return state;
  }

  protected getCellEditValue( rowIndex: number, columnKey: string, row: any ): any {
    const key = String( columnKey ?? '' ).trim();
    if ( !key ) return undefined;

    const state = this.ensureRowEditState( rowIndex, row );
    return state[ key ];
  }

  protected handleInlineEditChange( value: any, column: TableColumn, row: any, rowIndex: number ): void {
    try {
      const columnKey = String( column.key ?? '' ).trim();
      if ( !columnKey ) throw new Error( 'Column key is required for inline edit.' );

      const editKind: TableEditKind = column.edit?.kind || 'none';
      const state = this.ensureRowEditState( rowIndex, row );

      const previousValue = state[ columnKey ];
      const normalisedValue = this.normalizeEditableValue( columnKey, value );

      const same =
        previousValue === normalisedValue ||
        ( previousValue instanceof Date &&
          normalisedValue instanceof Date &&
          previousValue.getTime() === normalisedValue.getTime() );

      if ( same ) return;

      const validation = this.validateEditValue( columnKey, normalisedValue, column );

      state[ columnKey ] = normalisedValue;

      this.cellEdit.emit( {
        rowIndex,
        columnKey,
        value: normalisedValue,
        row,
        editKind,
        meta: {
          detectedType: this.columnBehavior.get( columnKey )?.dataType ?? this.detectColumnDataType( columnKey, column ),
          column,
          previousValue,
          isValid: validation.isValid,
          message: validation.message,
        },
      } );
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [CustomTable] handleInlineEditChange error.\n', error );
    }
  }

  protected hasInlineEdit( column: TableColumn ): boolean {
    const kind: TableEditKind | undefined = column.edit?.kind;
    return (
      !!kind &&
      ( kind === 'inlineText' ||
        kind === 'inlineNumber' ||
        kind === 'inlineSelect' ||
        kind === 'inlineSwitch' ||
        kind === 'inlineDate' ||
        kind === 'inlineDateTime' )
    );
  }

  protected isDialogTextEdit( column: TableColumn ): boolean {
    return column.edit?.kind === 'dialogText';
  }

  protected openTextEditorDialog( column: TableColumn, row: any, rowIndex: number ): void {
    try {
      const key: string = String( column.key ?? '' ).trim();
      if ( !key ) throw new Error( 'Column key is required for dialog text edit.' );

      const current: string = this.getCellEditValue( rowIndex, key, row ) ?? row?.[ key ] ?? '';

      const data: TextEditorDialogData = {
        title: column.edit?.dialogTitle || 'Edit text',
        label: column.edit?.fieldLabel || column.label || key,
        value: String( current ),
        maxLength: column.edit?.maxDialogLength,
      };

      const dialogRef = this.dialog.open<TextEditorDialogComponent, TextEditorDialogData, TextEditorDialogResult>(
        TextEditorDialogComponent,
        {
          width: '700px',
          maxWidth: '90vw',
          data,
          disableClose: true,
        },
      );

      dialogRef.afterClosed().subscribe( ( result: TextEditorDialogResult | undefined ) => {
        if ( !result ) return;

        const state: Record<string, any> = this.ensureRowEditState( rowIndex, row );
        const previousValue = state[ key ];

        state[ key ] = result.value;

        const validation = this.validateEditValue( key, result.value, column );

        this.cellEdit.emit( {
          rowIndex,
          columnKey: key,
          value: result.value,
          row,
          editKind: 'dialogText',
          meta: {
            detectedType: this.columnBehavior.get( key )?.dataType ?? this.detectColumnDataType( key, column ),
            column,
            previousValue,
            isValid: validation.isValid,
            message: validation.message,
          },
        } );
      } );
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [CustomTable] openTextEditorDialog error.\n', error );
    }
  }

  // --------------------------------------------------------------------------
  // [12.1] Lightweight validation rules
  // --------------------------------------------------------------------------

  private validateEditValue(
    columnKey: string,
    value: any,
    column: TableColumn,
  ): { isValid: boolean; message?: string; } {
    const cfg = column?.edit;
    if ( !cfg ) return { isValid: true };

    if ( cfg.required ) {
      const empty = value == null || value === '' || ( typeof value === 'string' && !value.trim() );
      if ( empty ) return { isValid: false, message: `${ this.textService.keyToLabel( columnKey ) } is required.` };
    }

    if ( typeof cfg.maxLength === 'number' && cfg.maxLength > 0 && typeof value === 'string' ) {
      if ( value.length > cfg.maxLength ) return { isValid: false, message: `Max length is ${ cfg.maxLength }.` };
    }

    if ( typeof cfg.min === 'number' && typeof value === 'number' ) {
      if ( value < cfg.min ) return { isValid: false, message: `Minimum value is ${ cfg.min }.` };
    }
    if ( typeof cfg.max === 'number' && typeof value === 'number' ) {
      if ( value > cfg.max ) return { isValid: false, message: `Maximum value is ${ cfg.max }.` };
    }

    if ( ( cfg.kind === 'inlineDate' || cfg.kind === 'inlineDateTime' ) && value instanceof Date ) {
      const minD = this.toDateOrNull( cfg.minDate as any );
      const maxD = this.toDateOrNull( cfg.maxDate as any );

      if ( minD && value.getTime() < minD.getTime() )
        return { isValid: false, message: `Date must be after ${ minD.toDateString() }.` };
      if ( maxD && value.getTime() > maxD.getTime() )
        return { isValid: false, message: `Date must be before ${ maxD.toDateString() }.` };
    }

    return { isValid: true };
  }

  // ==========================================================================
  // [13] Smart filtering engine (AUTO detect + distribute per column)
  // ==========================================================================

  private tryParseFilterState( raw: string ): TableFilterState | null {
    if ( !raw ) return null;
    if ( !raw.startsWith( '{' ) || !raw.endsWith( '}' ) ) return null;

    try {
      const obj = JSON.parse( raw );
      if ( !obj || typeof obj !== 'object' ) return null;

      const state: TableFilterState = {
        globalText: typeof obj.globalText === 'string' ? obj.globalText : '',
        columns: obj.columns && typeof obj.columns === 'object' ? obj.columns : {},
      };
      return state;
    } catch {
      return null;
    }
  }

  private legacyGlobalTextMatch( row: any, needle: string ): boolean {
    const cols = Array.isArray( this.columns ) ? this.columns : [];

    const hay = cols
      .map( ( c ) => row?.[ c.key ] )
      .map( ( v ) => {
        if ( v == null ) return '';
        if ( typeof v === 'string' ) return v;
        if ( typeof v === 'number' || typeof v === 'boolean' ) return String( v );

        if ( this.globalSearchTextOnly ) return '';
        return JSON.stringify( v );
      } )
      .join( ' ' )
      .toLowerCase();

    return hay.includes( needle );
  }

  private rebuildSmartFilterDecisions(): void {
    this.smartFilterDecision.clear();
    this.smartEnumCache.clear();

    if ( !this.enableSmartFilters ) return;

    const cols = Array.isArray( this.columns ) ? this.columns : [];
    for ( const col of cols ) {
      const key = String( col?.key ?? '' ).trim();
      if ( !key ) continue;

      const behavior = this.columnBehavior.get( key );
      const dataType = behavior?.dataType ?? this.detectColumnDataType( key, col );

      const decision = this.decideColumnFilter( key, dataType );
      this.smartFilterDecision.set( key, decision );

      // Preload enum values
      if ( decision.kind === 'enum' ) {
        const values = this.deriveEnumValuesForColumn( key );
        this.smartEnumCache.set( key, values );
        decision.enumValues = values;
      }
    }

    // Ensure state shape exists
    if ( !this.smartFilterState || typeof this.smartFilterState !== 'object' ) {
      this.smartFilterState = { globalText: '', columns: {} };
    }
    if ( !this.smartFilterState.columns || typeof this.smartFilterState.columns !== 'object' ) {
      this.smartFilterState.columns = {};
    }

    // Seed defaults (do not overwrite existing user selections)
    for ( const [ key, dec ] of this.smartFilterDecision.entries() ) {
      if ( dec.kind === 'none' ) continue;
      if ( !( key in this.smartFilterState.columns ) ) {
        this.smartFilterState.columns[ key ] = this.defaultFilterValue( dec );
      }
    }
  }

  private decideColumnFilter( key: string, dataType: ColumnDataType ): TableColumnFilterDecision {
    if ( dataType === 'actions' || dataType === 'image' || dataType === 'object' || dataType === 'array' ) {
      return { key, kind: 'none', dataType, reason: 'Non-filterable data type (actions/image/object/array)' };
    }

    if ( dataType === 'status' ) {
      return { key, kind: 'enum', dataType, enumMode: 'multi', reason: 'Status => enum filter' };
    }

    if ( dataType === 'kpi' ) {
      return { key, kind: 'kpiRange', dataType, reason: 'KPI => range filter on score/delta' };
    }

    if ( dataType === 'boolean' ) {
      return { key, kind: 'booleanTri', dataType, reason: 'Boolean => tri-state filter' };
    }

    if ( dataType === 'number' ) {
      return { key, kind: 'numberRange', dataType, reason: 'Number => min/max range filter' };
    }

    if ( dataType === 'date' || dataType === 'dateTime' || dataType === 'dateRange' ) {
      return { key, kind: 'dateRange', dataType, reason: 'Date/DateTime => from/to range filter' };
    }

    if ( dataType === 'text' ) {
      if ( this.isLowCardinalityTextColumn( key ) ) {
        return { key, kind: 'enum', dataType, enumMode: 'multi', reason: 'Text low-cardinality => enum filter' };
      }
      return { key, kind: 'text', dataType, reason: 'Text => contains filter' };
    }

    return { key, kind: 'text', dataType, reason: 'Fallback => text contains filter' };
  }

  private defaultFilterValue( dec: TableColumnFilterDecision ): any {
    switch ( dec.kind ) {
      case 'text':
        return '';
      case 'numberRange':
        return { min: null, max: null };
      case 'dateRange':
        return { from: null, to: null };
      case 'booleanTri':
        return { mode: 'any' as 'any' | 'true' | 'false' };
      case 'enum':
        return { values: [] as string[] };
      case 'kpiRange':
        return { scoreMin: null, scoreMax: null, deltaMin: null, deltaMax: null };
      default:
        return null;
    }
  }

  private deriveEnumValuesForColumn( columnKey: string ): string[] {
    const rows = Array.isArray( this.dataSource.data ) ? this.dataSource.data : [];
    const scanN = Math.min( 200, rows.length );

    const set = new Set<string>();
    for ( let i = 0; i < scanN; i++ ) {
      const v = rows[ i ]?.[ columnKey ];
      if ( v == null ) continue;
      const s = String( v ).trim();
      if ( !s ) continue;

      set.add( s );

      // Safety cap
      if ( set.size > 30 ) break;
    }

    return Array.from( set ).sort( ( a, b ) => a.localeCompare( b ) );
  }

  private isLowCardinalityTextColumn( columnKey: string ): boolean {
    const values = this.deriveEnumValuesForColumn( columnKey );
    return values.length > 0 && values.length <= 12;
  }

  private applySmartFilter(): void {
    if ( !this.enableSmartFilters && !this.enableClientFilter ) return;

    this.smartFilterState.globalText = String( this.search ?? '' ).trim();

    const state: TableFilterState = {
      globalText: this.smartFilterState.globalText ?? '',
      columns: this.smartFilterState.columns ?? {},
    };

    this.dataSource.filter = JSON.stringify( state );
  }

  protected setSmartColumnFilterValue( columnKey: string, value: any ): void {
    if ( !this.enableSmartFilters ) return;

    const key = String( columnKey ?? '' ).trim();
    if ( !key ) return;

    if ( !this.smartFilterState.columns ) this.smartFilterState.columns = {};
    this.smartFilterState.columns[ key ] = value;

    this.applySmartFilter();
    this.cdr.markForCheck();
  }

  protected clearSmartFilters(): void {
    this.smartFilterState = { globalText: String( this.search ?? '' ).trim(), columns: {} };

    for ( const [ key, dec ] of this.smartFilterDecision.entries() ) {
      if ( dec.kind === 'none' ) continue;
      this.smartFilterState.columns[ key ] = this.defaultFilterValue( dec );
    }

    this.applySmartFilter();
    this.cdr.markForCheck();
  }

  private evaluateRowAgainstFilterState( row: any, state: TableFilterState ): boolean {
    // (1) Global search
    const needle = String( state.globalText ?? '' ).toLowerCase().trim();
    if ( needle ) {
      const ok = this.smartGlobalSearchMatch( row, needle );
      if ( !ok ) return false;
    }

    // (2) Per-column filters
    const cols = state.columns && typeof state.columns === 'object' ? state.columns : {};
    for ( const key of Object.keys( cols ) ) {
      const decision = this.smartFilterDecision.get( key );
      if ( !decision || decision.kind === 'none' ) continue;

      const filterValue = cols[ key ];
      const cellValue = row?.[ key ];

      const pass = this.evaluateCellByDecision( cellValue, filterValue, decision );
      if ( !pass ) return false;
    }

    return true;
  }

  private smartGlobalSearchMatch( row: any, needle: string ): boolean {
    const cols = Array.isArray( this.columns ) ? this.columns : [];

    const searchableKeys: string[] = [];
    for ( const c of cols ) {
      const key = String( c?.key ?? '' ).trim();
      if ( !key ) continue;

      const dec = this.smartFilterDecision.get( key );
      if ( !dec ) continue;

      if ( dec.kind === 'none' ) continue;
      if ( dec.dataType === 'object' || dec.dataType === 'array' || dec.dataType === 'image' || dec.dataType === 'actions' ) {
        continue;
      }

      searchableKeys.push( key );
    }

    const hay = searchableKeys
      .map( ( k ) => row?.[ k ] )
      .map( ( v ) => {
        if ( v == null ) return '';
        if ( typeof v === 'string' ) return v;
        if ( typeof v === 'number' || typeof v === 'boolean' ) return String( v );

        if ( this.isKpiCellShape( v ) ) {
          const kpi = this.normalizeKpiCell( v );
          return `${ kpi.score ?? '' } ${ kpi.delta ?? '' } ${ kpi.tone ?? '' }`;
        }

        return this.globalSearchTextOnly ? '' : JSON.stringify( v );
      } )
      .join( ' ' )
      .toLowerCase();

    return hay.includes( needle );
  }

  private evaluateCellByDecision( cellValue: any, filterValue: any, decision: TableColumnFilterDecision ): boolean {
    switch ( decision.kind ) {
      case 'text':
        return this.evalTextContains( cellValue, filterValue );
      case 'numberRange':
        return this.evalNumberRange( cellValue, filterValue );
      case 'dateRange':
        return this.evalDateRange( cellValue, filterValue );
      case 'booleanTri':
        return this.evalBooleanTri( cellValue, filterValue );
      case 'enum':
        return this.evalEnum( cellValue, filterValue );
      case 'kpiRange':
        return this.evalKpiRange( cellValue, filterValue );
      default:
        return true;
    }
  }

  private evalTextContains( cellValue: any, filterValue: any ): boolean {
    const needle = String( filterValue ?? '' ).toLowerCase().trim();
    if ( !needle ) return true;
    const hay = String( cellValue ?? '' ).toLowerCase();
    return hay.includes( needle );
  }

  private evalNumberRange( cellValue: any, filterValue: any ): boolean {
    const min = filterValue?.min;
    const max = filterValue?.max;

    if ( min == null && max == null ) return true;

    const n = typeof cellValue === 'number' ? cellValue : Number( cellValue );
    if ( !Number.isFinite( n ) ) return false;

    if ( min != null ) {
      const mn = typeof min === 'number' ? min : Number( min );
      if ( Number.isFinite( mn ) && n < mn ) return false;
    }

    if ( max != null ) {
      const mx = typeof max === 'number' ? max : Number( max );
      if ( Number.isFinite( mx ) && n > mx ) return false;
    }

    return true;
  }

  private evalDateRange( cellValue: any, filterValue: any ): boolean {
    const fromRaw = filterValue?.from;
    const toRaw = filterValue?.to;

    if ( !fromRaw && !toRaw ) return true;

    const d = this.toDateOrNull( cellValue );
    if ( !d ) return false;

    const from = this.toDateOrNull( fromRaw );
    const to = this.toDateOrNull( toRaw );

    if ( from && d.getTime() < from.getTime() ) return false;
    if ( to && d.getTime() > to.getTime() ) return false;

    return true;
  }

  private evalBooleanTri( cellValue: any, filterValue: any ): boolean {
    const mode: 'any' | 'true' | 'false' = filterValue?.mode ?? 'any';
    if ( mode === 'any' ) return true;

    const v = typeof cellValue === 'boolean' ? cellValue : String( cellValue ?? '' ).toLowerCase().trim() === 'true';
    return mode === 'true' ? v === true : v === false;
  }

  private evalEnum( cellValue: any, filterValue: any ): boolean {
    const selected: string[] = Array.isArray( filterValue?.values ) ? filterValue.values : [];
    if ( selected.length === 0 ) return true;

    const v = String( cellValue ?? '' ).trim();
    if ( !v ) return false;

    return selected.includes( v );
  }

  private evalKpiRange( cellValue: any, filterValue: any ): boolean {
    const kpi = this.normalizeKpiCell( cellValue );

    const score = typeof kpi.score === 'number' ? kpi.score : Number( kpi.score );
    const delta = typeof kpi.delta === 'number' ? kpi.delta : Number( kpi.delta );

    const sMin = filterValue?.scoreMin;
    const sMax = filterValue?.scoreMax;
    const dMin = filterValue?.deltaMin;
    const dMax = filterValue?.deltaMax;

    if ( sMin == null && sMax == null && dMin == null && dMax == null ) return true;

    if ( !Number.isFinite( score ) ) return false;

    if ( sMin != null ) {
      const mn = typeof sMin === 'number' ? sMin : Number( sMin );
      if ( Number.isFinite( mn ) && score < mn ) return false;
    }

    if ( sMax != null ) {
      const mx = typeof sMax === 'number' ? sMax : Number( sMax );
      if ( Number.isFinite( mx ) && score > mx ) return false;
    }

    if ( dMin != null || dMax != null ) {
      if ( !Number.isFinite( delta ) ) return false;

      if ( dMin != null ) {
        const mn = typeof dMin === 'number' ? dMin : Number( dMin );
        if ( Number.isFinite( mn ) && delta < mn ) return false;
      }

      if ( dMax != null ) {
        const mx = typeof dMax === 'number' ? dMax : Number( dMax );
        if ( Number.isFinite( mx ) && delta > mx ) return false;
      }
    }

    return true;
  }

  // ==========================================================================
  // [14] KPI “stock-like” display helpers (arrow + delta + sparkline)
  // ==========================================================================

  protected kpiToneClass( tone: unknown ): 'ok' | 'warn' | 'danger' | 'normal' {
    const t = String( tone ?? '' ).trim().toLowerCase();

    if ( t === 'ok' || t === 'good' || t === 'success' || t === 'positive' ) return 'ok';
    if ( t === 'warn' || t === 'warning' || t === 'medium' ) return 'warn';
    if ( t === 'danger' || t === 'bad' || t === 'error' || t === 'critical' || t === 'negative' ) return 'danger';

    return 'normal';
  }

  protected kpiArrow( delta: unknown ): 'arrow_upward' | 'arrow_downward' | 'remove' {
    const d = typeof delta === 'number' ? delta : Number( delta );
    if ( !Number.isFinite( d ) ) return 'remove';

    const EPS = 1e-9;
    if ( d > EPS ) return 'arrow_upward';
    if ( d < -EPS ) return 'arrow_downward';
    return 'remove';
  }

  protected kpiScoreText( cell: any ): string {
    const kpi = this.normalizeKpiCell( cell );
    const n = typeof kpi.score === 'number' ? kpi.score : Number( kpi.score );
    if ( !Number.isFinite( n ) ) return '0';
    return this.formatCompactNumber( n );
  }

  protected kpiDeltaText( cell: any ): string {
    const kpi = this.normalizeKpiCell( cell );
    const d = typeof kpi.delta === 'number' ? kpi.delta : Number( kpi.delta );
    if ( !Number.isFinite( d ) || Math.abs( d ) < 1e-9 ) return '0';
    const sign = d > 0 ? '+' : '';
    return `${ sign }${ this.formatCompactNumber( d ) }`;
  }

  private formatCompactNumber( n: number ): string {
    const abs = Math.abs( n );
    if ( abs >= 1_000_000_000 ) return `${ Math.round( ( n / 1_000_000_000 ) * 10 ) / 10 }B`;
    if ( abs >= 1_000_000 ) return `${ Math.round( ( n / 1_000_000 ) * 10 ) / 10 }M`;
    if ( abs >= 1_000 ) return `${ Math.round( ( n / 1_000 ) * 10 ) / 10 }K`;
    return `${ Math.round( n * 100 ) / 100 }`;
  }

  protected buildSparkPolyline( series: unknown ): string {
    const W = 100;
    const H = 28;

    const arr = Array.isArray( series ) ? series : [];
    const pointsRaw = arr
      .map( ( v ) => ( typeof v === 'number' && Number.isFinite( v ) ? v : null ) )
      .filter( ( v ): v is number => v !== null );

    if ( pointsRaw.length < 2 ) return `0 ${ H / 2 } ${ W } ${ H / 2 }`;

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for ( const v of pointsRaw ) {
      if ( v < min ) min = v;
      if ( v > max ) max = v;
    }

    const range = max - min;
    const safeRange = range === 0 ? 1 : range;

    const n = pointsRaw.length;
    const stepX = W / ( n - 1 );

    const pts: string[] = [];
    for ( let i = 0; i < n; i++ ) {
      const v = pointsRaw[ i ];
      const norm = ( v - min ) / safeRange;
      const x = i * stepX;
      const y = ( 1 - norm ) * ( H - 2 ) + 1;
      pts.push( `${ this.round1( x ) } ${ this.round1( y ) }` );
    }

    return pts.join( ' ' );
  }

  private round1( v: number ): number {
    return Math.round( v * 10 ) / 10;
  }

  // ==========================================================================
  // [15] KPI normalization (kept compatible)
  // ==========================================================================

  private normalizeKeyToken( key: string ): string {
    return String( key ?? '' ).toLowerCase().replace( /[^a-z0-9]/g, '' );
  }

  private isKpiLikeKey( key: string ): boolean {
    const k = this.normalizeKeyToken( key );
    if ( !k ) return false;

    if ( k.includes( 'kpi' ) ) return true;
    if ( k.includes( 'rate' ) || k.includes( 'score' ) ) return true;
    if ( k.includes( 'health' ) || k.includes( 'engagement' ) ) return true;
    if ( k.includes( 'performance' ) || k.includes( 'completion' ) ) return true;

    return false;
  }

  private isKpiCellShape( v: any ): boolean {
    if ( !v || typeof v !== 'object' || Array.isArray( v ) ) return false;

    const hasScore = 'score' in v || 'value' in v || 'percent' in v || 'percentage' in v;
    const hasDelta = 'delta' in v || 'change' in v || 'diff' in v || 'deltaValue' in v;
    const hasSeries = 'series' in v || 'spark' in v || 'trend' in v;

    return !!( hasScore || hasDelta || hasSeries );
  }

  private normalizeKpiCell( raw: any ): TableKpiSparkCell {
    if ( typeof raw === 'number' && Number.isFinite( raw ) ) {
      return { score: raw, delta: 0, tone: 'normal', series: [] };
    }

    if ( !raw || typeof raw !== 'object' || Array.isArray( raw ) ) {
      return { score: 0, delta: 0, tone: 'normal', series: [] };
    }

    const pickNumber = ( ...keys: string[] ): number | undefined => {
      for ( const k of keys ) {
        const v = ( raw as any )[ k ];
        if ( typeof v === 'number' && Number.isFinite( v ) ) return v;
        if ( typeof v === 'string' && v.trim() && !Number.isNaN( Number( v ) ) ) return Number( v );
      }
      return undefined;
    };

    const score = pickNumber( 'score', 'value', 'percent', 'percentage' ) ?? 0;
    const delta = pickNumber( 'delta', 'change', 'diff', 'deltaValue' ) ?? 0;

    const toneRaw = String( ( raw as any ).tone ?? ( raw as any ).status ?? '' ).trim().toLowerCase() || 'normal';

    const seriesRaw = ( raw as any ).series ?? ( raw as any ).spark ?? ( raw as any ).trend ?? [];
    const series = Array.isArray( seriesRaw ) ? seriesRaw : [];

    const tone: KpiTone =
      toneRaw !== 'normal'
        ? toneRaw
        : delta > 0
          ? 'ok'
          : delta < 0
            ? 'danger'
            : 'normal';

    return { score, delta, tone, series };
  }

  private extractKpiPairsFromRow( row: any ): Record<string, TableKpiSparkCell> {
    const out: Record<string, TableKpiSparkCell> = {};
    if ( !row || typeof row !== 'object' ) return out;

    const tryExtractFromObject = ( obj: any ): void => {
      if ( !obj || typeof obj !== 'object' || Array.isArray( obj ) ) return;

      for ( const key of Object.keys( obj ) ) {
        const val = obj[ key ];

        if ( this.isKpiCellShape( val ) || typeof val === 'number' ) {
          out[ key ] = this.normalizeKpiCell( val );
          continue;
        }

        if ( val && typeof val === 'object' && !Array.isArray( val ) ) {
          const nk = this.normalizeKeyToken( key );
          if ( this.KPI_CONTAINER_KEYS.includes( nk as any ) ) tryExtractFromObject( val );
        }
      }
    };

    for ( const cKey of this.KPI_CONTAINER_KEYS ) {
      const container = ( row as any )[ cKey ];
      if ( container && typeof container === 'object' ) tryExtractFromObject( container );
    }

    for ( const key of Object.keys( row ) ) {
      if ( !this.isKpiLikeKey( key ) ) continue;
      const val = ( row as any )[ key ];
      if ( this.isKpiCellShape( val ) || typeof val === 'number' ) out[ key ] = this.normalizeKpiCell( val );
    }

    return out;
  }

  private buildStableKpiKeyOrder( keys: string[] ): string[] {
    const norm = ( k: string ) => this.normalizeKeyToken( k );

    const scoreKey = ( k: string ): number => {
      const nk = norm( k );
      const idx = this.KPI_ORDER_HINTS.findIndex( ( h ) => nk.includes( h ) );
      return idx === -1 ? 9999 : idx;
    };

    return keys
      .slice()
      .sort( ( a, b ) => {
        const pa = scoreKey( a );
        const pb = scoreKey( b );
        if ( pa !== pb ) return pa - pb;
        return norm( a ).localeCompare( norm( b ) );
      } );
  }

  private sameKeySet( a: string[], b: string[] ): boolean {
    const A = new Set( a.map( ( x ) => this.normalizeKeyToken( x ) ) );
    const B = new Set( b.map( ( x ) => this.normalizeKeyToken( x ) ) );
    if ( A.size !== B.size ) return false;
    for ( const x of A ) if ( !B.has( x ) ) return false;
    return true;
  }

  private ensureKpiColumnsExist( orderedKeys: string[] ): void {
    const cols: TableColumn[] = Array.isArray( this.columns ) ? this.columns : [];
    const seen = new Set( cols.map( ( c ) => String( c.key ?? '' ).trim() ) );

    const kpiCols: TableColumn[] = [];

    for ( const key of orderedKeys ) {
      if ( seen.has( key ) ) {
        const existing = cols.find( ( c ) => c.key === key );
        if ( existing ) existing.render = existing.render === 'auto' ? 'kpiSpark' : existing.render;
        continue;
      }

      kpiCols.push( {
        key,
        label: this.textService.keyToLabel( key ),
        render: 'kpiSpark',
      } );
      seen.add( key );
    }

    if ( kpiCols.length === 0 ) return;

    const firstKpiIndex = cols.findIndex( ( c ) => c.render === 'kpiSpark' || this.isKpiLikeKey( c.key ) );
    if ( firstKpiIndex >= 0 ) {
      const head = cols.slice( 0, firstKpiIndex + 1 );
      const tail = cols.slice( firstKpiIndex + 1 );
      this.columns = [ ...head, ...kpiCols, ...tail ];
    } else {
      this.columns = [ ...cols, ...kpiCols ];
    }
  }

  private normalizeRowsForKpi( rows: any[] ): any[] {
    try {
      const safeRows = Array.isArray( rows ) ? rows : [];
      if ( safeRows.length === 0 ) return [];

      const scanN = Math.min( 25, safeRows.length );

      const kpiKeySet: Set<string> = new Set<string>();
      const perRowKpi: Array<Record<string, TableKpiSparkCell>> = [];

      for ( let i = 0; i < scanN; i++ ) {
        const r = safeRows[ i ];
        const pairs = this.extractKpiPairsFromRow( r );
        perRowKpi[ i ] = pairs;
        for ( const k of Object.keys( pairs ) ) kpiKeySet.add( k );
      }

      const kpiKeys = Array.from( kpiKeySet );

      const ordered =
        this.kpiColumnOrderCache && this.kpiColumnOrderCache.length > 0 && this.sameKeySet( this.kpiColumnOrderCache, kpiKeys )
          ? this.kpiColumnOrderCache
          : this.buildStableKpiKeyOrder( kpiKeys );

      this.kpiColumnOrderCache = ordered;

      this.ensureKpiColumnsExist( ordered );

      return safeRows.map( ( rawRow, idx ) => {
        const kpis = idx < scanN ? perRowKpi[ idx ] : this.extractKpiPairsFromRow( rawRow );
        const out: any = { ...( rawRow ?? {} ) };

        for ( const key of ordered ) {
          if ( kpis[ key ] ) out[ key ] = kpis[ key ];
          else if ( out[ key ] && ( this.isKpiCellShape( out[ key ] ) || typeof out[ key ] === 'number' ) ) {
            out[ key ] = this.normalizeKpiCell( out[ key ] );
          }
        }

        out.__raw = rawRow;
        return out;
      } );
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [CustomTable] normalizeRowsForKpi failed.\n', error );
      return Array.isArray( rows ) ? rows : [];
    }
  }

  // ==========================================================================
  // [16] Render resolver (template-friendly)
  // ==========================================================================

  protected resolveRenderKind( col: TableColumn ): TableRenderKind {
    const key = String( col?.key ?? '' ).trim();
    const decision = this.columnBehavior.get( key );
    return decision?.renderKind ?? ( col.render && col.render !== 'auto' ? col.render : 'text' );
  }

  // ==========================================================================
  // [17] Sorting
  // ==========================================================================

  protected sortData( sort: Sort, data?: any[] ): void {
    const sourceData: any[] = ( data || this.dataSource.data ).slice();
    const isAsc: boolean = sort.direction === 'asc';

    if ( !sort.active || sort.direction === '' ) {
      this.dataSource.data = sourceData;
      return;
    }

    this.dataSource.data = sourceData.sort( ( a: any, b: any ) => this.universalCompare( a?.[ sort.active ], b?.[ sort.active ], isAsc ) );
    this.cdr.markForCheck();
  }

  private universalCompare( a: any, b: any, isAsc: boolean ): number {
    // KPI compare
    if ( this.isKpiCellShape( a ) || this.isKpiCellShape( b ) ) {
      const ka = this.normalizeKpiCell( a );
      const kb = this.normalizeKpiCell( b );
      const na = typeof ka.score === 'number' ? ka.score : Number( ka.score );
      const nb = typeof kb.score === 'number' ? kb.score : Number( kb.score );
      return ( na < nb ? -1 : na > nb ? 1 : 0 ) * ( isAsc ? 1 : -1 );
    }

    // ✅ Date compare (STRICT: uses the same parser as filters/inference)
    const da = this.toDateOrNull( a );
    const db = this.toDateOrNull( b );
    if ( da || db ) {
      const ta = da ? da.getTime() : Number.NEGATIVE_INFINITY;
      const tb = db ? db.getTime() : Number.NEGATIVE_INFINITY;
      return ( ta < tb ? -1 : ta > tb ? 1 : 0 ) * ( isAsc ? 1 : -1 );
    }

    // Null handling
    if ( a == null && b != null ) return isAsc ? -1 : 1;
    if ( a != null && b == null ) return isAsc ? 1 : -1;
    if ( a == null && b == null ) return 0;

    // String compare
    if ( typeof a === 'string' && typeof b === 'string' ) return a.localeCompare( b ) * ( isAsc ? 1 : -1 );

    // Number / fallback
    return ( a < b ? -1 : a > b ? 1 : 0 ) * ( isAsc ? 1 : -1 );
  }

  // ==========================================================================
  // [18] Pagination getters & setters
  // ==========================================================================

  public get tablePageIndex(): number {
    return this.index;
  }
  public set tablePageIndex( value: number ) {
    const safeLimit = PaginationUtil.safeLimit( this.limit, this.totalDataCount );
    const totalPages = Math.max( 1, Math.ceil( this.totalDataCount / safeLimit ) );
    const safeIndex = PaginationUtil.safeIndex( value, totalPages );

    this.index = safeIndex;
    this.indexChange.emit( safeIndex );
  }

  public get tableLimit(): number {
    return this.limit;
  }
  public set tableLimit( value: number ) {
    const safeLimit = PaginationUtil.safeLimit( value, this.totalDataCount );
    this.limit = safeLimit;
    this.limitChange.emit( safeLimit );
  }

  public get tableSearchValue(): string {
    return this.search;
  }
  public set tableSearchValue( value: string ) {
    this.search = value;
    this.searchChange.emit( this.search );

    this.applyClientFilterIfEnabled();
  }

  public get tableIsReload(): boolean {
    return this.isReload;
  }
  public set tableIsReload( value: boolean ) {
    this.isReload = value;

    this.search = '';
    this.dateRange = null;
    this.index = this.tablePageIndex;

    this.dateRangeChange.emit( null );
    this.rangeChange.emit( null );
    this.searchChange.emit( this.search );
    this.isReloadChange.emit( this.isReload );
    this.indexChange.emit( this.index );
    this.limitChange.emit( this.tableLimit );

    this.applyClientFilterIfEnabled();
  }

  // ==========================================================================
  // [19] Paginator and controls events (kept)
  // ==========================================================================

  protected onDateRangeChange( dateRange: DateRange | null ): void {
    this.dateRange = dateRange;
    this.dateRangeChange.emit( this.dateRange );
  }

  protected onRangeChange( dateRange: DateRange | null ): void {
    this.rangeChange.emit( dateRange );
  }

  protected handleSwitchChange( isActive: SwitchButtonType[ 'isActive' ], input: SwitchButtonType[ 'data' ], index: number ): void {
    this.switch = { isActive, index, data: input };
    this.switchChange.emit( this.switch );
  }

  // ==========================================================================
  // [20] File export (kept)
  // ==========================================================================

  protected fileExportHandle( extention: Extension ): void {
    try {
      if ( !Array.isArray( this.data ) ) throw new Error( 'Data is not type of array' );
      const payload: FileExport = { extention, data: this.data };
      this.fileExport.emit( payload );
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [CustomTable] File exporting error.\n', error );
    }
  }

  // ==========================================================================
  // [21] Legacy single action click (kept)
  // ==========================================================================

  protected handleButtonOperations( action: TableButton[ 'action' ], data: any ): void {
    try {
      if ( typeof action !== 'string' || !action ) throw new Error( 'Button ID is invalid!' );
      this.buttonOperation.emit( { action, data } );
    } catch ( err ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [CustomTable] Table action button error.\n', err );
    }
  }

  // ==========================================================================
  // [22] Retry / fetch logic (kept)
  // ==========================================================================

  private resetFetchAttempts(): void {
    this.fetchAttempts = 0;

    if ( this.fetchRetryTimerId !== null ) {
      clearTimeout( this.fetchRetryTimerId );
      this.fetchRetryTimerId = null;
    }
  }

  private hasTableData(): boolean {
    return Array.isArray( this.data ) && this.data.length > 0;
  }

  private scheduleDataFetchIfNeeded(): void {
    const hasRows: boolean = this.hasTableData();
    const hasTotalCount: boolean = typeof this.totalDataCount === 'number' && this.totalDataCount > 0;

    if ( hasRows || hasTotalCount ) {
      this.isArrayOfData = hasRows;
      this.isTableVisible = true;
      this.resetFetchAttempts();
      return;
    }

    if ( this.fetchAttempts >= this.maxFetchAttempts ) {
      this.isArrayOfData = false;
      this.isTableVisible = true;
      return;
    }

    this.fetchAttempts += 1;
    Promise.resolve().then( () => this.fetchData.emit() );

    this.isArrayOfData = false;
    this.isTableVisible = false;

    if ( this.fetchRetryTimerId !== null ) {
      clearTimeout( this.fetchRetryTimerId );
      this.fetchRetryTimerId = null;
    }

    this.fetchRetryTimerId = setTimeout( (): void => this.scheduleDataFetchIfNeeded(), this.fetchRetryDelayMs );
  }

  // ==========================================================================
  // [23] Date parsing helpers (STRICT ISO + common standard formats)
  // ==========================================================================

  private readonly ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  private readonly ISO_DATETIME_RE =
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

  private readonly YMD_SLASH_RE = /^\d{4}\/\d{2}\/\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;
  private readonly DMY_SLASH_RE = /^\d{2}\/\d{2}\/\d{4}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;
  private readonly MDY_SLASH_RE = /^\d{2}\/\d{2}\/\d{4}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;
  private readonly YMD_DASH_SPACE_TIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/;

  private isProbablyNotADateString( s: string ): boolean {
    const t = s.trim();
    if ( !t ) return true;

    if ( t.length < 8 ) return true;

    // reject long all-digit strings (IDs)
    if ( /^\d+$/.test( t ) && t.length >= 10 ) return true;

    return false;
  }

  private isValidYmd( y: number, m: number, d: number ): boolean {
    if ( !Number.isInteger( y ) || y < 1900 || y > 2200 ) return false;
    if ( !Number.isInteger( m ) || m < 1 || m > 12 ) return false;
    if ( !Number.isInteger( d ) || d < 1 || d > 31 ) return false;

    const dt = new Date( Date.UTC( y, m - 1, d ) );
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  private isValidHms( h: number, mi: number, s?: number ): boolean {
    if ( !Number.isInteger( h ) || h < 0 || h > 23 ) return false;
    if ( !Number.isInteger( mi ) || mi < 0 || mi > 59 ) return false;
    if ( s === undefined ) return true;
    return Number.isInteger( s ) && s >= 0 && s <= 59;
  }

  private tryParseDateStrict( raw: unknown ): { date: Date | null; kind: 'date' | 'dateTime' | null; source?: string; } {
    if ( raw instanceof Date ) {
      return { date: isNaN( raw.getTime() ) ? null : raw, kind: 'dateTime', source: 'DateInstance' };
    }

    if ( typeof raw === 'number' && Number.isFinite( raw ) ) {
      // epoch millis only if plausible
      const min = Date.UTC( 2000, 0, 1 );
      const max = Date.UTC( 2200, 0, 1 );
      if ( raw >= min && raw <= max ) {
        const d = new Date( raw );
        return { date: isNaN( d.getTime() ) ? null : d, kind: 'dateTime', source: 'EpochMillis' };
      }
      return { date: null, kind: null, source: 'EpochRejected' };
    }

    if ( typeof raw !== 'string' ) return { date: null, kind: null };

    const s = raw.trim();
    if ( this.isProbablyNotADateString( s ) ) return { date: null, kind: null, source: 'RejectedByHeuristic' };

    // 1) ISO date
    if ( this.ISO_DATE_RE.test( s ) ) {
      const [ yy, mm, dd ] = s.split( '-' ).map( Number );
      if ( !this.isValidYmd( yy, mm, dd ) ) return { date: null, kind: null, source: 'ISO_DATE_InvalidParts' };
      const d = new Date( Date.UTC( yy, mm - 1, dd ) );
      return { date: d, kind: 'date', source: 'ISO_DATE' };
    }

    // 2) ISO datetime (optional timezone)
    if ( this.ISO_DATETIME_RE.test( s ) ) {
      const d = new Date( s );
      if ( Number.isNaN( d.getTime() ) ) return { date: null, kind: null, source: 'ISO_DATETIME_Invalid' };
      return { date: d, kind: 'dateTime', source: 'ISO_DATETIME' };
    }

    // 3) yyyy-MM-dd HH:mm(:ss)
    if ( this.YMD_DASH_SPACE_TIME_RE.test( s ) ) {
      const [ datePart, timePart ] = s.split( ' ' );
      const [ yy, mm, dd ] = datePart.split( '-' ).map( Number );
      const [ hh, mi, ssMaybe ] = timePart.split( ':' ).map( Number );
      const ss = Number.isFinite( ssMaybe ) ? ssMaybe : undefined;

      if ( !this.isValidYmd( yy, mm, dd ) ) return { date: null, kind: null, source: 'YMD_SPACE_InvalidDate' };
      if ( !this.isValidHms( hh, mi, ss ) ) return { date: null, kind: null, source: 'YMD_SPACE_InvalidTime' };

      const d = new Date( Date.UTC( yy, mm - 1, dd, hh, mi, ss ?? 0 ) );
      return { date: d, kind: 'dateTime', source: 'YMD_SPACE_TIME' };
    }

    // 4) yyyy/MM/dd (optional time)
    if ( this.YMD_SLASH_RE.test( s ) ) {
      const [ datePart, timePart ] = s.split( /[ T]/ );
      const [ yy, mm, dd ] = datePart.split( '/' ).map( Number );

      if ( !this.isValidYmd( yy, mm, dd ) ) return { date: null, kind: null, source: 'YMD_SLASH_InvalidDate' };

      if ( !timePart ) {
        return { date: new Date( Date.UTC( yy, mm - 1, dd ) ), kind: 'date', source: 'YMD_SLASH' };
      }

      const [ hh, mi, ssMaybe ] = timePart.split( ':' ).map( Number );
      const ss = Number.isFinite( ssMaybe ) ? ssMaybe : undefined;

      if ( !this.isValidHms( hh, mi, ss ) ) return { date: null, kind: null, source: 'YMD_SLASH_InvalidTime' };

      const d = new Date( Date.UTC( yy, mm - 1, dd, hh, mi, ss ?? 0 ) );
      return { date: d, kind: 'dateTime', source: 'YMD_SLASH_TIME' };
    }

    // 5) dd/MM/yyyy OR MM/dd/yyyy (ambiguous => reject)
    if ( this.DMY_SLASH_RE.test( s ) || this.MDY_SLASH_RE.test( s ) ) {
      const [ datePart, timePart ] = s.split( /[ T]/ );
      const [ a, b, yy ] = datePart.split( '/' ).map( Number );

      if ( !Number.isInteger( yy ) || yy < 1900 || yy > 2200 ) return { date: null, kind: null, source: 'DMY/MDY_InvalidYear' };

      const canDMY = this.isValidYmd( yy, b, a ); // day=a month=b
      const canMDY = this.isValidYmd( yy, a, b ); // month=a day=b

      let dd: number | null = null;
      let mm: number | null = null;

      if ( canDMY && !canMDY ) { dd = a; mm = b; }
      else if ( !canDMY && canMDY ) { dd = b; mm = a; }
      else return { date: null, kind: null, source: 'DMY/MDY_AmbiguousOrInvalid' };

      if ( !timePart ) {
        return { date: new Date( Date.UTC( yy, ( mm as number ) - 1, dd as number ) ), kind: 'date', source: 'DMY/MDY' };
      }

      const [ hh, mi, ssMaybe ] = timePart.split( ':' ).map( Number );
      const ss = Number.isFinite( ssMaybe ) ? ssMaybe : undefined;

      if ( !this.isValidHms( hh, mi, ss ) ) return { date: null, kind: null, source: 'DMY/MDY_InvalidTime' };

      const d = new Date( Date.UTC( yy, ( mm as number ) - 1, dd as number, hh, mi, ss ?? 0 ) );
      return { date: d, kind: 'dateTime', source: 'DMY/MDY_TIME' };
    }

    return { date: null, kind: null, source: 'NoPatternMatch' };
  }

  /** Single source of truth for Date conversions (used by filter + sort + validation) */
  protected toDateOrNull( raw: unknown ): Date | null {
    const parsed = this.tryParseDateStrict( raw );
    return parsed.date;
  }

  /** Used only for inference decisions */
  private isDateStringValue( raw: unknown ): { isDate: boolean; kind?: 'date' | 'dateTime'; } {
    const parsed = this.tryParseDateStrict( raw );
    return { isDate: !!parsed.date, kind: parsed.kind ?? undefined };
  }

  /** Key hint helper (NOT enough alone to force date) */
  private isDateColumnKey( columnKey: string ): boolean {
    const safeKey: string = this.normalizeKeyToken( String( columnKey ?? '' ) );

    if ( !safeKey ) return false;

    // Avoid false positives like "id", "uuid", "code" etc.
    for ( const deny of this.NON_IMAGE_KEY_TOKENS ) {
      if ( safeKey === deny ) return false;
    }

    return this.DATE_KEY_TOKENS.some( ( t ) => safeKey.includes( this.normalizeKeyToken( t ) ) );
  }

  // ==========================================================================
  // [24] Image helpers (kept compatible)
  // ==========================================================================

  protected inferImageRenderType( columnKey: string ): 'userimage' | 'propertyImage' | 'image' | null {
    const safeKey: string = String( columnKey ?? '' ).toLowerCase().trim();
    if ( !safeKey ) return null;

    for ( const deny of this.NON_IMAGE_KEY_TOKENS ) {
      if ( safeKey.endsWith( deny ) ) return null;
    }

    for ( const hint of this.IMAGE_COLUMN_HINTS ) {
      if ( safeKey.includes( hint.token ) ) return hint.type;
    }

    return null;
  }

  protected isImageLikeColumn( columnKey: string ): boolean {
    return this.inferImageRenderType( columnKey ) !== null;
  }

  protected imageGenerator(
    element: any,
    type: 'userimage' | 'propertyImage' | 'image',
    gender?: string,
    explicitPath?: string | null,
  ): string {
    let image: string | undefined;

    if ( typeof explicitPath === 'string' && explicitPath.trim() ) image = explicitPath.trim();
    else image = this.resolveImageField( element );

    const safeType: string = String( type ?? '' ).toLowerCase().trim();
    const safeImage: string = typeof image === 'string' ? image.trim() : '';

    switch ( safeType ) {
      case 'userimage': {
        if ( safeImage ) {
          const dotIndex: number = safeImage.lastIndexOf( '.' );
          if ( dotIndex > 0 && dotIndex < safeImage.length - 1 ) return safeImage;
        }

        const safeGender: string = String( gender ?? '' ).toLowerCase().trim();
        if ( safeGender === 'male' ) return this.definedMaleDummyImageURL;
        if ( safeGender === 'female' ) return this.definedWomanDummyImageURL;

        return this.definedImage;
      }

      case 'propertyimage':
      case 'image':
        return safeImage || this.definedImage;

      default:
        return this.definedImage;
    }
  }

  protected resolveColumnImage( row: any, columnKey: string ): string {
    const renderType = this.inferImageRenderType( columnKey );
    if ( !renderType ) return this.definedImage;

    const directValue: unknown = row?.[ columnKey ];
    const explicitPath: string | undefined = typeof directValue === 'string' && directValue.trim() ? directValue.trim() : undefined;

    if ( explicitPath ) return this.imageGenerator( row, renderType, row?.gender, explicitPath );

    const fallbackImage: string | undefined = this.resolveImageFieldForType( row, renderType );
    return this.imageGenerator( row, renderType, row?.gender, fallbackImage ?? null );
  }

  private resolveImageFieldForType( record: any, type: 'userimage' | 'propertyImage' | 'image' ): string | undefined {
    if ( !record || typeof record !== 'object' ) return undefined;

    const normalize = ( k: string ): string => k.toLowerCase().replace( /[^a-z]/g, '' );

    const allowedMap: Record<typeof type, string[]> = {
      userimage: [ 'userimage', 'profileimage', 'avatar' ],
      propertyImage: [ 'propertyimage' ],
      image: [ 'image', 'img', 'photo', 'logo' ],
    };

    const allowed = allowedMap[ type ];

    for ( const key of Object.keys( record ) ) {
      const norm = normalize( key );
      if ( allowed.some( ( token ) => norm === token ) ) {
        const val = record[ key ];
        if ( typeof val === 'string' && val.trim() ) return val.trim();
      }
    }

    return undefined;
  }

  private resolveImageField( record: any ): string | undefined {
    if ( !record || typeof record !== 'object' ) return undefined;

    const normalize = ( k: string ): string => k.toLowerCase().replace( /[^a-z]/g, '' );
    const accepted = [ 'image', 'userimage', 'propertyimage', 'profileimage', 'profile', 'avatar', 'img', 'photo' ];

    for ( const key of Object.keys( record ) ) {
      const norm = normalize( key );
      if ( accepted.some( ( token ) => norm.includes( token ) ) ) {
        const val = record[ key ];
        return typeof val === 'string' ? val : undefined;
      }
    }

    return undefined;
  }

  // ==========================================================================
  // [25] Text trim + tooltip
  // ==========================================================================

  protected trimText( text: any, _columnKey?: string ): string {
    const s = text == null ? '' : typeof text === 'string' ? text : JSON.stringify( text );
    const trimmed = s.trim();
    const max = 120;
    return trimmed.length > max ? `${ trimmed.slice( 0, max ) }…` : trimmed;
  }

  protected getToolTip( text: any, _columnKey?: string ): string {
    const s = text == null ? '' : typeof text === 'string' ? text : JSON.stringify( text );
    return s.trim();
  }

  // ==========================================================================
  // [26] Legacy action derivation helpers (kept)
  // ==========================================================================

  private deriveActionFromColumn( col: TableColumn ): ActionId | null {
    const rawSource: string = String( col.key || col.label || '' ).toLowerCase().trim();

    const cleaned: string = rawSource
      .replace( /buttons?/g, '' )
      .replace( /btn/g, '' )
      .replace( /[_\-\s]+/g, '' )
      .trim();

    const possibleActions: ActionId[] = [
      'add',
      'delete',
      'remove',
      'view',
      'download',
      'approve',
      'reject',
      'activate',
      'deactivate',
      'upload',
      'edit',
      'reset',
      'search',
    ];

    return possibleActions.find( ( id ) => id === cleaned ) ?? null;
  }

  private buildButtonLabelFromAction( action: ActionId ): string {
    const text: string = action.toString();
    return text.charAt( 0 ).toUpperCase() + text.slice( 1 );
  }

  protected checkButtonBGforDanger( action: string ): boolean {
    const danger: string[] = [ 'delete', 'remove', 'reject', 'deactivate' ];
    const safeAction: string = action.toLowerCase().trim();
    return danger.includes( safeAction );
  }

  protected checkButtonBGforGood( action: string ): boolean {
    const good: string[] = [ 'add', 'view', 'approve', 'activate' ];
    const safeAction: string = action.toLowerCase().trim();
    return good.includes( safeAction );
  }

  // ==========================================================================
  // [27] MIME / extension → icon mapping (kept)
  // ==========================================================================

  private mapMimeOrExtToExtension( type: string | undefined | null ): Extension {
    if ( !type ) return 'file';
    const lower = type.toLowerCase().trim();

    if ( lower.includes( '/' ) ) {
      const mime = lower;

      if ( mime.startsWith( 'image/' ) ) return 'png';
      if ( mime === 'application/pdf' ) return 'pdf';

      if ( mime === 'application/zip' || mime === 'application/x-zip-compressed' || mime === 'application/x-7z-compressed' )
        return 'zip';

      if (
        mime === 'application/msword' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.template' ||
        mime === 'application/rtf'
      )
        return 'docx';

      if (
        mime === 'application/vnd.ms-excel' ||
        mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.template' ||
        mime === 'text/csv'
      )
        return 'xlsx';

      if (
        mime === 'application/vnd.ms-powerpoint' ||
        mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        mime === 'application/vnd.openxmlformats-officedocument.presentationml.template'
      )
        return 'pptx';

      if ( mime === 'text/plain' ) return 'txt';
      if ( mime === 'text/xml' || mime === 'application/xml' ) return 'xml';

      return 'file';
    }

    const parts = lower.split( '.' );
    const extOnly = ( parts.length > 1 ? parts.pop() : parts[ 0 ] ) || 'file';
    return extOnly as Extension;
  }

  protected chooseIcon( type: string | undefined | null ): MaterialFileIcon {
    const ext = this.mapMimeOrExtToExtension( type );
    return EXTENSION_ICON_MAP[ ext ] ?? 'insert_drive_file';
  }
}
