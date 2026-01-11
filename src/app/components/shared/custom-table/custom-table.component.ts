// Path: src/app/components/shared/custom-table/custom-table.component.ts
// ============================================================================
// CustomTableComponent (standalone, class-based, OnPush)
// ----------------------------------------------------------------------------
// Key goals:
//  - Generic dynamic table (columns config + row data)
//  - Inline editing (text/number/select/switch/date/datetime)
//  - Dialog editing for long text
//  - Key-aware date rendering (fix: numbers should not auto-render as dates)
//  - Legacy button columns derived by column key/label (btn/view/edit...)
//  - multipleActions column supports multiple buttons with unique ids
//  - Image-like column rendering with fallback logic
//  - Pagination bindings and retry-based fetch trigger
//  - Auto-inject action columns (separate/grouped) when parent doesn't provide
//  - Small UI helpers: trackBy, client filter hook, column label helpers,
//    safe HTML helpers, "empty value" helpers, etc.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

// ──────────────────────────────────────────────────────────────
// Angular & Common
// ──────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────
// Angular Material
// ──────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────
// Services & utilities
// ──────────────────────────────────────────────────────────────
import { User } from '../../../services/APIs/apis.service';
import { AuthService } from '../../../services/auth/auth.service';
import { ImageService } from '../../../services/imageService/image.service';
import { TextService } from '../../../services/text/text.service';
import { PaginationUtil } from '../../../source/utility/pagination.utils';

// ──────────────────────────────────────────────────────────────
// Child components
// ──────────────────────────────────────────────────────────────
import { DateRange, Extension, PaginatorComponent } from '../paginator/paginator.component';
import { SwitchButton } from '../../../components/shared/buttons/switch-button/switch-button.component';
import { SkeletonLoaderComponent } from '../skeleton-loader/skeleton-loader.component';
import { DateTimePickerComponent } from '../date-time-picker/date-time-picker.component';

// ──────────────────────────────────────────────────────────────
// Dialog for long-text editing
// ──────────────────────────────────────────────────────────────
import {
  TextEditorDialogComponent,
  TextEditorDialogData,
  TextEditorDialogResult,
} from '../../dialogs/text-editor-dialog/text-editor-dialog.component';

// ──────────────────────────────────────────────────────────────
// Re-exports for consumers
// ──────────────────────────────────────────────────────────────
export type TableExtension = Extension;
export type TableDateRange = DateRange;

// ──────────────────────────────────────────────────────────────
// File icons
// ──────────────────────────────────────────────────────────────
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

export const EXTENSION_ICON_MAP: Record<Extension, MaterialFileIcon> = {
  // Word
  doc: 'description',
  docx: 'description',
  dot: 'description',
  dotx: 'description',
  rtf: 'description',
  odt: 'description',

  // Text
  txt: 'text_snippet',

  // XML
  xml: 'code',

  // Excel / Sheets
  xls: 'table_chart',
  xlsx: 'table_chart',
  xlsm: 'table_chart',
  xlt: 'table_chart',
  xltx: 'table_chart',
  ods: 'table_chart',
  csv: 'table_chart',
  tsv: 'table_chart',

  // PowerPoint
  ppt: 'slideshow',
  pptx: 'slideshow',
  pptm: 'slideshow',
  pot: 'slideshow',
  potx: 'slideshow',
  odp: 'slideshow',

  // PDF
  pdf: 'picture_as_pdf',

  // ZIP
  zip: 'folder_zip',

  // Images
  png: 'image',
  jpeg: 'image',
  webp: 'image',
  gif: 'image',
  jpg: 'image',
  ico: 'image',
  svg: 'image',

  // Default fallback
  file: 'insert_drive_file',
};

// ──────────────────────────────────────────────────────────────
// Universal Icon Registry (semantic iconKey → material icon string)
// ──────────────────────────────────────────────────────────────
export type IconKey =
  // Generic
  | 'view'
  | 'edit'
  | 'add'
  | 'delete'
  | 'archive'
  | 'restore'
  | 'close'
  | 'more'
  // Tasks / workflow
  | 'task.assign'
  | 'task.complete'
  | 'task.pending'
  | 'task.blocked'
  // Real estate
  | 'property'
  | 'property.add'
  | 'property.edit'
  | 'property.location'
  | 'property.image'
  // Tenant / user
  | 'tenant'
  | 'tenant.add'
  | 'tenant.remove'
  | 'tenant.verify'
  // Lease / agreement
  | 'lease'
  | 'lease.sign'
  | 'lease.terminate'
  | 'lease.renew'
  // Finance / files
  | 'payment'
  | 'invoice'
  | 'file.upload'
  | 'file.download'
  | 'file.preview';

export const ICON_REGISTRY: Record<IconKey, string> = {
  // Generic
  view: 'visibility',
  edit: 'edit',
  add: 'add_circle',
  delete: 'delete',
  archive: 'archive',
  restore: 'unarchive',
  close: 'close',
  more: 'more_vert',

  // Tasks
  'task.assign': 'assignment_add',
  'task.complete': 'task_alt',
  'task.pending': 'hourglass_empty',
  'task.blocked': 'block',

  // Real estate
  property: 'apartment',
  'property.add': 'add_home',
  'property.edit': 'home_repair_service',
  'property.location': 'location_on',
  'property.image': 'photo_library',

  // Tenant / user
  tenant: 'person',
  'tenant.add': 'person_add',
  'tenant.remove': 'person_remove',
  'tenant.verify': 'verified_user',

  // Lease
  lease: 'description',
  'lease.sign': 'draw',
  'lease.terminate': 'cancel_schedule_send',
  'lease.renew': 'autorenew',

  // Finance / files
  payment: 'payments',
  invoice: 'receipt_long',
  'file.upload': 'upload',
  'file.download': 'download',
  'file.preview': 'preview',
};

// ──────────────────────────────────────────────────────────────
// Legacy actions and buttons (existing flow)
// ──────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────
// Multiple-actions column (NEW)
// ──────────────────────────────────────────────────────────────
export type TableButtonId = string;

export interface TableUiButton {
  id: TableButtonId;

  /** Either iconKey OR icon. icon wins if both provided. */
  iconKey?: IconKey;
  icon?: string;

  label?: string;
  tooltip?: string;

  visible?: boolean | ( ( row: any ) => boolean );
  disabled?: boolean | ( ( row: any ) => boolean );

  tone?: 'good' | 'normal' | 'danger';
}

export interface TableUiButtonClickConfig {
  id: TableButtonId;
  row: any;
  meta?: Record<string, any>;
}

// ──────────────────────────────────────────────────────────────
// IDE-friendly duplicate id detection for TableUiButton tuples
// Works best when parent passes `as const`
// ──────────────────────────────────────────────────────────────
type ExtractIds<T extends ReadonlyArray<{ id: string; }>> = {
  [ K in keyof T ]: T[ K ] extends { id: infer I; } ? I : never;
};

type HasDuplicates<T extends ReadonlyArray<any>, Seen = never> = T extends readonly [
  infer Head,
  ...infer Tail,
]
  ? Head extends Seen
  ? true
  : HasDuplicates<Tail, Seen | Head>
  : false;

type EnforceUniqueIds<T extends ReadonlyArray<{ id: string; }>> = HasDuplicates<ExtractIds<T>> extends true
  ? never
  : T;

export class TableUiButtonFactory {
  public create<const T extends ReadonlyArray<TableUiButton>>( buttons: EnforceUniqueIds<T> ): T {
    this.assertUniqueAtRuntime( buttons );
    return buttons;
  }

  private assertUniqueAtRuntime( buttons: ReadonlyArray<TableUiButton> ): void {
    const seen: Set<string> = new Set<string>();

    for ( const btn of buttons ) {
      const id: string = String( btn?.id ?? '' ).trim();
      if ( !id ) continue;

      if ( seen.has( id ) ) {
        // eslint-disable-next-line no-console
        console.warn( '[Warning:] [CustomTable] Duplicate uiButton id detected:', id, '\n' );
        continue;
      }
      seen.add( id );
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Columns / edit configuration
// ──────────────────────────────────────────────────────────────
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

  required: boolean;
}

export type TableRenderKind =
  | 'auto'
  | 'text'
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
  score?: number;            // ex: 0..100
  delta?: number;            // ex: -5..+5
  tone?: KpiTone;            // ok | warn | danger | etc
  series?: Array<number | null | undefined>; // sparkline points
}



export interface TableColumn {
  key: string;
  label: string;
  edit?: TableEditConfig;

  /** parent can explicitly tell what this column is */
  render?: TableRenderKind;

  /** used only when render === 'multipleActions' */
  multipleActions?: ReadonlyArray<TableUiButton>;
}

export interface FileExport {
  data: any[];
  extention: Extension;
}

export interface SwitchButtonType {
  isActive: boolean;
  index: number | null;
  on?: string;
  off?: string;
  data?: any;
}

export interface TableCellEdit {
  rowIndex: number;
  columnKey: string;
  value: any;
  row: any;
  editKind: TableEditKind;
}

// ──────────────────────────────────────────────────────────────
// Action rendering mode (auto-inject)
// ──────────────────────────────────────────────────────────────
export type ActionRenderMode = 'auto' | 'separate' | 'grouped';



// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // Inputs / Outputs
  // ─────────────────────────────────────────────────────────────
  @Input( { required: false } ) public pagination: boolean = false;
  @Input( { required: false } ) public totalDataCount: number = 0;

  @Input( { required: true } ) public data: any[] = [];
  @Input( { required: true } ) public columns: TableColumn[] = [];

  @Input( { required: false } ) public limit: number = 2;
  @Output() public limitChange: EventEmitter<number> = new EventEmitter<number>();

  @Input( { required: false } ) public index: number = 0;
  @Output() public indexChange: EventEmitter<number> = new EventEmitter<number>();

  @Input( { required: false } ) public tableTitle: string = '';

  /** Future-safe: stable row identity (not used yet in edit-state map) */
  @Input() public rowIdKey: string = 'id';

  @Input( { required: false } ) public search: string = '';
  @Output() public searchChange: EventEmitter<string> = new EventEmitter<string>();

  @Input( { required: false } ) public isReload: boolean = false;
  @Output() public isReloadChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  @Input() public fileExportExtention!: Extension;
  @Output() public fileExport: EventEmitter<FileExport> = new EventEmitter<FileExport>();

  @Input() public isDateRageActive: boolean = false;

  @Input() public dateRange: DateRange | null = null;
  @Output() public dateRangeChange: EventEmitter<DateRange | null> = new EventEmitter<DateRange | null>();
  @Output() public rangeChange: EventEmitter<DateRange | null> = new EventEmitter<DateRange | null>();

  /** Legacy single action buttons (existing flow) */
  @Input() public buttons: TableButton[] = [];
  @Output() public buttonOperation: EventEmitter<TableButtonActionConfig> = new EventEmitter<TableButtonActionConfig>();

  /** NEW: multipleActions click event */
  @Output() public uiButtonClick: EventEmitter<TableUiButtonClickConfig> = new EventEmitter<TableUiButtonClickConfig>();

  @Input() public switch!: SwitchButtonType;
  @Output() public switchChange: EventEmitter<SwitchButtonType> = new EventEmitter<SwitchButtonType>();

  @Output() public fetchData: EventEmitter<void> = new EventEmitter<void>();
  @Output() public cellEdit: EventEmitter<TableCellEdit> = new EventEmitter<TableCellEdit>();

  /** Auto-inject: action columns mode */
  @Input() public actionRenderMode: ActionRenderMode = 'auto';

  /** If true and parent didn't provide action columns, table will inject them */
  @Input() public autoInjectActionColumns: boolean = true;

  /** Label for grouped actions column */
  @Input() public actionsColumnLabel: string = 'Actions';

  /** Optional: if true, MatTableDataSource filter is enabled (client-side). */
  @Input() public enableClientFilter: boolean = false;

  // ─────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────
  private readonly isBrowser: boolean;
  protected readonly loggedUser: User | null;

  protected displayedColumnKeys: string[] = [];
  protected dataSource: MatTableDataSource<any> = new MatTableDataSource<any>();

  protected tableStatus: string = '';

  protected isTableVisible: boolean = true;
  protected dataCount: number = 0;
  protected isArrayOfData: boolean = false;

  protected readonly definedMaleDummyImageURL: string = 'Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL: string = 'Images/user-images/dummy-user/dummy_woman.jpg';
  protected readonly definedImage: string = 'Images/System-images/noImage.jpeg';

  protected buttonColumns: Map<string, TableButton> = new Map<string, TableButton>();

  // Key by stable row id, not index (index changes when sorting/paging/filtering)
  protected rowEditState: Map<string, Record<string, any>> = new Map<string, Record<string, any>>();

  // Cache which columns are editable date-like (so we can normalize once)
  private editableDateKeys: Set<string> = new Set<string>();

  private fetchAttempts: number = 0;
  private readonly maxFetchAttempts: number = 3;
  private readonly fetchRetryDelayMs: number = 400;
  private fetchRetryTimerId: ReturnType<typeof setTimeout> | null = null;

  // ─────────────────────────────────────────────────────────────
  // KPI auto-normalization + stable ordering
  // ─────────────────────────────────────────────────────────────
  private normalizedRows: any[] = [];

  private kpiColumnOrderCache: string[] | null = null;

  /**
   * Stable KPI ordering.
   * Put your executive-critical KPIs first. Everything else goes after.
   */
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


  private dataDiffer: IterableDiffer<any> | null = null;

  // ─────────────────────────────────────────────────────────────
  // Column hints (images + date detection)
  // ─────────────────────────────────────────────────────────────
  private readonly IMAGE_COLUMN_HINTS: ReadonlyArray<{ token: string; type: 'userimage' | 'propertyImage' | 'image'; }> =
    [
      { token: 'userimage', type: 'userimage' },
      { token: 'user', type: 'userimage' },
      { token: 'profile', type: 'userimage' },
      { token: 'avatar', type: 'userimage' },

      { token: 'propertyimage', type: 'propertyImage' },
      { token: 'property', type: 'propertyImage' },

      { token: 'teamlogo', type: 'image' },
      { token: 'logo', type: 'image' },
      { token: 'picture', type: 'image' },
      { token: 'photo', type: 'image' },
      { token: 'image', type: 'image' },
      { token: 'img', type: 'image' },
    ];

  private readonly NON_IMAGE_KEY_TOKENS: ReadonlyArray<string> = [ 'id', 'uuid', 'code', 'number', 'no' ];

  /** KEY-AWARE date detection (fix for “numbers becoming dates”) */
  private readonly DATE_KEY_TOKENS: ReadonlyArray<string> = [
    'date',
    'time',
    'datetime',
    'created',
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

  // ─────────────────────────────────────────────────────────────
  // Constructor / DI
  // ─────────────────────────────────────────────────────────────
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

    // Small UI helper: make filter search stable & useful across objects/arrays
    this.dataSource.filterPredicate = ( row: any, filter: string ): boolean => {
      try {
        const needle = String( filter ?? '' ).toLowerCase().trim();
        if ( !needle ) return true;

        // Only filter by visible columns (prevents heavy stringifying entire row)
        const cols = Array.isArray( this.columns ) ? this.columns : [];
        const hay = cols
          .map( ( c ) => row?.[ c.key ] )
          .map( ( v ) => ( v == null ? '' : typeof v === 'string' ? v : JSON.stringify( v ) ) )
          .join( ' ' )
          .toLowerCase();

        return hay.includes( needle );
      } catch {
        return true;
      }
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────
  public async ngOnInit(): Promise<void> {
    const rows: any[] = Array.isArray( this.data ) ? this.data : [];
    this.normalizedRows = this.normalizeRowsForKpi( rows );
    this.dataSource.data = this.normalizedRows;


    this.dataCount = rows.length;
    this.isArrayOfData = rows.length > 0;

    this.dataDiffer = this.differs.find( rows ).create<any>();

    this.normalizeColumnsAndDetectButtons();
    this.applyClientFilterIfEnabled();
    this.scheduleDataFetchIfNeeded();
  }

  public ngAfterViewInit(): void {
    // Reserved (MatSort is handled via (matSortChange)="sortData($event)")
  }

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

      // prune edit state for rows that no longer exist
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
      changes[ 'actionRenderMode' ] ||
      changes[ 'autoInjectActionColumns' ]
    ) {
      this.normalizeColumnsAndDetectButtons();
      this.applyClientFilterIfEnabled();
      this.cdr.markForCheck();
    }

    if ( changes[ 'enableClientFilter' ] || changes[ 'search' ] ) {
      this.applyClientFilterIfEnabled();
      this.cdr.markForCheck();
    }

    if ( changes[ 'totalDataCount' ] || dataChanged ) {
      Promise.resolve().then( () => this.scheduleDataFetchIfNeeded() );
    }
  }

  public ngDoCheck(): void {
    if ( !this.dataDiffer || !Array.isArray( this.data ) ) return;

    const changes = this.dataDiffer.diff( this.data );
    if ( !changes ) return;

    this.normalizedRows = this.normalizeRowsForKpi( this.data );
    this.dataSource.data = this.normalizedRows;

    this.dataCount = this.data.length;
    this.isArrayOfData = this.data.length > 0;

    // prune
    const aliveRowIds = new Set<string>( this.data.map( ( r, idx ) => this.getRowId( r, idx ) ) );
    for ( const id of Array.from( this.rowEditState.keys() ) ) {
      if ( !aliveRowIds.has( id ) ) this.rowEditState.delete( id );
    }

    this.applyClientFilterIfEnabled();
    this.cdr.markForCheck();
  }

  // ─────────────────────────────────────────────────────────────
  // Small UI helpers (missing ones you usually need)
  // ─────────────────────────────────────────────────────────────
  protected trackByRow = ( index: number, row: any ): string => this.getRowId( row, index );

  protected trackByColumn = ( _: number, col: TableColumn ): string => String( col?.key ?? '' );

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

  /** Use with [innerHTML] only. Prefer plain text bindings whenever possible. */
  protected asSafeHtml( html: string ): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml( String( html ?? '' ) );
  }

  /** If you want client-side filter, this applies `this.search` into MatTableDataSource. */
  private applyClientFilterIfEnabled(): void {
    if ( !this.enableClientFilter ) return;

    const v = String( this.search ?? '' ).trim().toLowerCase();
    this.dataSource.filter = v;
  }

  // ─────────────────────────────────────────────────────────────
  // Public helpers
  // ─────────────────────────────────────────────────────────────
  public convertArrayIntoObjectPair<T extends string | number>( data: readonly T[] ): { label: string; value: T; }[] {
    try {
      if ( !Array.isArray( data ) || data.length === 0 ) {
        throw new Error( 'Data array is invalid!' );
      }

      const out: { label: string; value: T; }[] = [];

      for ( const item of data ) {
        const label: string = this.textService.keyToLabel( String( item ) );
        out.push( { label, value: item } );
      }

      return out;
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [CustomTable] convertArrayIntoObjectPair failed.\n', error );
      return [];
    }
  }

  protected toDateOrNull( raw: string | Date | null | undefined ): Date | null {
    if ( raw instanceof Date ) return isNaN( raw.getTime() ) ? null : raw;

    if ( typeof raw === 'string' ) {
      const trimmed = raw.trim();
      if ( !trimmed ) return null;

      const parsed = new Date( trimmed );
      return Number.isNaN( parsed.getTime() ) ? null : parsed;
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // Column rendering kind (template can switch by this)
  // ─────────────────────────────────────────────────────────────
  protected resolveRenderKind( col: TableColumn ): TableRenderKind {
    // 1) Explicit wins
    if ( col.render && col.render !== 'auto' ) return col.render;

    // 2) Multiple actions column
    if ( this.isMultipleActionsColumn( col ) ) return 'multipleActions';

    // 3) Legacy single-action columns
    if ( this.isButtonColumn( col.key ) ) return 'singleAction';

    // 4) Images by key heuristics
    if ( this.isImageLikeColumn( col.key ) ) return 'image';

    // 5) Inline editors imply "text" rendering with editor
    if ( this.hasInlineEdit( col ) ) return 'text';

    // 6) Smart defaults by key (only a few)
    const k = ( col.key || '' ).toLowerCase().trim();

    // key-aware date default (important)
    if ( this.isDateColumnKey( k ) ) {
      const sample = this.dataSource.data?.[ 0 ]?.[ col.key ];
      // if it looks like it has time, show dateTime; else date
      if ( typeof sample === 'string' && /T\d{2}:\d{2}/.test( sample ) ) return 'dateTime';
      return 'date';
    }

    // KPI auto-detect (if parent didn’t set render)
    const sample = this.dataSource.data?.[ 0 ]?.[ col.key ];
    if ( this.isKpiLikeKey( col.key ) && ( this.isKpiCellShape( sample ) || typeof sample === 'number' ) ) {
      return 'kpiSpark';
    }


    if ( k === 'status' ) return 'status';
    if ( k === 'icon' ) return 'icon';
    if ( k === 'daterange' ) return 'dateRange';
    if ( k === 'switch' ) return 'switch';

    return 'text';
  }

  // ─────────────────────────────────────────────────────────────
  // Column normalization + action columns injection + legacy button derivation
  // ─────────────────────────────────────────────────────────────
  private normalizeColumnsAndDetectButtons(): void {
    this.buttonColumns.clear();

    const rawColumns: TableColumn[] = Array.isArray( this.columns ) ? this.columns : [];
    const normalized: TableColumn[] = [];
    const seenKeys: Set<string> = new Set<string>();

    // 1) Normalize and dedupe columns
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

    // 2) Auto-inject action columns if parent didn't provide them
    this.autoInjectActionColumnsIfNeeded( normalized, seenKeys );

    // 3) Apply final columns and displayed keys
    this.columns = normalized;
    this.displayedColumnKeys = normalized.map( ( c ) => c.key );

    // 4) Cache status key
    this.tableStatus = ( normalized.find( ( c ) => c.key.toLowerCase() === 'status' )?.key || '' ).toLowerCase();

    // 5) Derive legacy button columns map
    this.deriveLegacyButtonColumns( normalized );

    // 6) Validate multipleActions uniqueness
    this.validateMultipleActionsUniqueIds();

    this.rebuildEditableKeyCaches();
  }

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

  private autoInjectActionColumnsIfNeeded( normalized: TableColumn[], seenKeys: Set<string> ): void {
    if ( !this.autoInjectActionColumns ) return;

    const hasLegacyCols = this.hasAnyLegacyActionColumns( normalized );
    const hasMultiCols = this.hasAnyMultipleActionsColumns( normalized );
    const hasLegacyButtons = Array.isArray( this.buttons ) && this.buttons.length > 0;

    if ( hasLegacyCols || hasMultiCols ) return;
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

    for ( const btn of this.buttons ) {
      const c = this.buildLegacyActionColumn( btn );
      if ( !seenKeys.has( c.key ) ) {
        seenKeys.add( c.key );
        normalized.push( c );
      }
    }
  }

  private deriveLegacyButtonColumns( normalized: TableColumn[] ): void {
    for ( const col of normalized ) {
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

  // ─────────────────────────────────────────────────────────────
  // Action columns: detection + builders
  // ─────────────────────────────────────────────────────────────
  protected isButtonColumn( columnKey: string ): boolean {
    const keyLower = String( columnKey ?? '' ).trim().toLowerCase();
    return this.buttonColumns.has( keyLower );
  }

  protected getButtonForColumn( columnKey: string ): TableButton | null {
    const keyLower = String( columnKey ?? '' ).trim().toLowerCase();
    return this.buttonColumns.get( keyLower ) ?? null;
  }

  private hasAnyLegacyActionColumns( cols: TableColumn[] ): boolean {
    return cols.some( ( c ) => this.isLikelyLegacyActionColumn( c.key ) );
  }

  private hasAnyMultipleActionsColumns( cols: TableColumn[] ): boolean {
    return cols.some( ( c ) => Array.isArray( c.multipleActions ) && c.multipleActions.length > 0 );
  }

  private isLikelyLegacyActionColumn( columnKey: string ): boolean {
    const k = String( columnKey ?? '' ).toLowerCase().trim();
    return k.includes( 'btn' ) || k.includes( 'button' ) || k.includes( 'buttons' ) || k === 'actions';
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

  private findButtonConfig( action: ActionId ): TableButton | null {
    if ( !Array.isArray( this.buttons ) || this.buttons.length === 0 ) return null;
    return this.buttons.find( ( btn ) => btn.action === action ) ?? null;
  }

  // ─────────────────────────────────────────────────────────────
  // Multiple-actions (render + click)
  // ─────────────────────────────────────────────────────────────
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

      // Bridge: if id matches legacy ActionId, emit legacy output too.
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

  // ─────────────────────────────────────────────────────────────
  // Edit state helpers
  // ─────────────────────────────────────────────────────────────
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

      const normalisedValue = this.normalizeEditableValue( columnKey, value );
      const prev = state[ columnKey ];

      const same =
        prev === normalisedValue ||
        ( prev instanceof Date &&
          normalisedValue instanceof Date &&
          prev.getTime() === normalisedValue.getTime() );

      if ( same ) return;

      state[ columnKey ] = normalisedValue;

      this.cellEdit.emit( {
        rowIndex,
        columnKey,
        value: normalisedValue,
        row,
        editKind,
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

  protected coerceDate( input: Date | string | null | undefined ): Date | null {
    if ( !input ) return null;
    if ( input instanceof Date ) return isNaN( input.getTime() ) ? null : input;

    const parsed = new Date( input );
    return isNaN( parsed.getTime() ) ? null : parsed;
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
        state[ key ] = result.value;

        this.cellEdit.emit( {
          rowIndex,
          columnKey: key,
          value: result.value,
          row,
          editKind: 'dialogText',
        } );
      } );
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [CustomTable] openTextEditorDialog error.\n', error );
    }
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

  // ─────────────────────────────────────────────────────────────
  // Status helpers
  // ─────────────────────────────────────────────────────────────
  protected statusClass( status: string | null | undefined ): string {
    const norm: string = String( status ?? '' ).trim().toLowerCase().replace( /\s+/g, '_' );
    if ( !norm ) return 'main-category';
    return `main-category ${ norm }`;
  }

  // ─────────────────────────────────────────────────────────────
  // Paginator bindings (two-way through getters/setters)
  // ─────────────────────────────────────────────────────────────
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

  public get tableLimit(): number {
    return this.limit;
  }
  public set tableLimit( value: number ) {
    const safeLimit = PaginationUtil.safeLimit( value, this.totalDataCount );
    this.limit = safeLimit;
    this.limitChange.emit( safeLimit );
  }

  protected onDateRangeChange( dateRange: DateRange | null ): void {
    this.dateRange = dateRange;
    this.dateRangeChange.emit( this.dateRange );
  }

  protected onRangeChange( dateRange: DateRange | null ): void {
    this.rangeChange.emit( dateRange );
  }

  protected handleFileExport( extention: Extension, _data: any ): void {
    this.fileExportHandle( extention );
  }

  protected handleSwitchChange( isActive: SwitchButtonType[ 'isActive' ], input: SwitchButtonType[ 'data' ], index: number ): void {
    this.switch = { isActive, index, data: input };
    this.switchChange.emit( this.switch );
  }

  // ─────────────────────────────────────────────────────────────
  // Sorting
  // ─────────────────────────────────────────────────────────────
  protected sortData( sort: Sort, data?: any[] ): void {
    const sourceData: any[] = ( data || this.dataSource.data ).slice();
    const isAsc: boolean = sort.direction === 'asc';

    if ( !sort.active || sort.direction === '' ) {
      this.dataSource.data = sourceData;
      return;
    }

    this.dataSource.data = sourceData.sort( ( a: any, b: any ) =>
      this.universalCompare( a?.[ sort.active ], b?.[ sort.active ], isAsc ),
    );

    this.cdr.markForCheck();
  }

  private universalCompare( a: any, b: any, isAsc: boolean ): number {
    if ( a == null && b != null ) return isAsc ? -1 : 1;
    if ( a != null && b == null ) return isAsc ? 1 : -1;
    if ( a == null && b == null ) return 0;

    if ( typeof a === 'string' && typeof b === 'string' ) {
      return a.localeCompare( b ) * ( isAsc ? 1 : -1 );
    }

    return ( a < b ? -1 : a > b ? 1 : 0 ) * ( isAsc ? 1 : -1 );
  }

  // ─────────────────────────────────────────────────────────────
  // Image helpers
  // ─────────────────────────────────────────────────────────────
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

    if ( typeof explicitPath === 'string' && explicitPath.trim() ) {
      image = explicitPath.trim();
    } else {
      image = this.resolveImageField( element );
    }

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
      case 'image': {
        return safeImage || this.definedImage;
      }

      default:
        return this.definedImage;
    }
  }

  protected resolveColumnImage( row: any, columnKey: string ): string {
    const renderType = this.inferImageRenderType( columnKey );
    if ( !renderType ) return this.definedImage;

    const directValue: unknown = row?.[ columnKey ];
    const explicitPath: string | undefined =
      typeof directValue === 'string' && directValue.trim() ? directValue.trim() : undefined;

    if ( explicitPath ) {
      return this.imageGenerator( row, renderType, row?.gender, explicitPath );
    }

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

  // ─────────────────────────────────────────────────────────────
  // Date input helpers
  // ─────────────────────────────────────────────────────────────
  protected toDateInputValue( value: any ): string | null {
    if ( !value ) return null;

    const date: Date = value instanceof Date ? value : new Date( value );
    if ( isNaN( date.getTime() ) ) return null;

    const yyyy = date.getFullYear();
    const mm = String( date.getMonth() + 1 ).padStart( 2, '0' );
    const dd = String( date.getDate() ).padStart( 2, '0' );

    return `${ yyyy }-${ mm }-${ dd }`;
  }

  protected toDateTimeInputValue( value: any ): string | null {
    if ( !value ) return null;

    const date: Date = value instanceof Date ? value : new Date( value );
    if ( isNaN( date.getTime() ) ) return null;

    const yyyy = date.getFullYear();
    const mm = String( date.getMonth() + 1 ).padStart( 2, '0' );
    const dd = String( date.getDate() ).padStart( 2, '0' );

    const hh = String( date.getHours() ).padStart( 2, '0' );
    const min = String( date.getMinutes() ).padStart( 2, '0' );

    return `${ yyyy }-${ mm }-${ dd }T${ hh }:${ min }`;
  }

  // ─────────────────────────────────────────────────────────────
  // Formatting helpers
  // ─────────────────────────────────────────────────────────────
  protected formatDateRange( start: Date, end: Date ): string {
    const formatWithSuffix = ( date: Date ): string => {
      const day: number = date.getDate();
      const suffix: string = this.getOrdinalSuffix( day );
      const month: string = date.toLocaleString( 'default', { month: 'long' } );
      const year: number = date.getFullYear();
      return `${ day }${ suffix } of ${ month } ${ year }`;
    };

    return `${ formatWithSuffix( start ) } to ${ formatWithSuffix( end ) }`;
  }

  private getOrdinalSuffix( day: number ): string {
    if ( day >= 11 && day <= 13 ) return 'th';
    switch ( day % 10 ) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Key-aware date detection
  // ─────────────────────────────────────────────────────────────
  private normalizeKeyToken( key: string ): string {
    return String( key ?? '' ).toLowerCase().replace( /[^a-z0-9]/g, '' );
  }

  private isDateColumnKey( columnKey: string | null | undefined ): boolean {
    const normKey: string = this.normalizeKeyToken( String( columnKey ?? '' ) );
    if ( !normKey ) return false;

    for ( const token of this.DATE_KEY_TOKENS ) {
      if ( normKey.includes( token ) ) return true;
    }
    return false;
  }

  private tryParseDate( raw: unknown, columnKey?: string | null ): Date | null {
    if ( raw instanceof Date ) {
      const t: number = raw.getTime();
      return Number.isFinite( t ) ? raw : null;
    }

    if ( typeof raw === 'string' ) {
      const trimmed: string = raw.trim();
      if ( !trimmed ) return null;

      if ( this.isPureNumberString( trimmed ) ) return null;

      const iso: Date | null = this.parseStrictIso8601( trimmed );
      if ( iso ) return iso;

      const slash: Date | null = this.parseStrictSlashFormats( trimmed );
      if ( slash ) return slash;

      return null;
    }

    if ( typeof raw === 'number' ) {
      if ( !Number.isFinite( raw ) ) return null;
      if ( !Number.isInteger( raw ) ) return null;

      const keyOk: boolean = this.isDateColumnKey( ( columnKey ?? '' ).trim() );
      if ( !keyOk ) return null;

      const ms: number = this.coerceEpochToMs( raw );
      if ( !Number.isFinite( ms ) ) return null;

      if ( !this.isEpochMsInReasonableRange( ms ) ) return null;

      const d: Date = new Date( ms );
      return Number.isFinite( d.getTime() ) ? d : null;
    }

    return null;
  }

  private isPureNumberString( value: string ): boolean {
    return /^-?\d+$/.test( value );
  }

  private parseStrictIso8601( input: string ): Date | null {
    const re: RegExp =
      /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:Z|([+-])(\d{2}):?(\d{2}))?)?$/;

    const m: RegExpExecArray | null = re.exec( input );
    if ( !m ) return null;

    const year: number = Number( m[ 1 ] );
    const month: number = Number( m[ 2 ] );
    const day: number = Number( m[ 3 ] );

    if ( !this.isValidYmd( year, month, day ) ) return null;

    const hasTime: boolean = typeof m[ 4 ] === 'string' && m[ 4 ].length > 0;
    if ( !hasTime ) {
      const utcMs: number = Date.UTC( year, month - 1, day, 0, 0, 0, 0 );
      const d: Date = new Date( utcMs );
      return this.matchesYmdUtc( d, year, month, day ) ? d : null;
    }

    const hh: number = Number( m[ 4 ] );
    const mm: number = Number( m[ 5 ] );
    const ss: number = m[ 6 ] ? Number( m[ 6 ] ) : 0;
    const ms: number = m[ 7 ] ? this.padRightMs( m[ 7 ] ) : 0;

    if ( !this.isValidHms( hh, mm, ss, ms ) ) return null;

    const hasZ: boolean = /Z$/.test( input );
    const hasOffset: boolean = !!m[ 8 ];

    let offsetMinutes: number = 0;
    if ( hasZ ) {
      offsetMinutes = 0;
    } else if ( hasOffset ) {
      const sign: number = m[ 8 ] === '-' ? -1 : 1;
      const offH: number = Number( m[ 9 ] );
      const offM: number = Number( m[ 10 ] );
      if ( offH > 23 || offM > 59 ) return null;
      offsetMinutes = sign * ( offH * 60 + offM );
    } else {
      const local: Date = new Date( year, month - 1, day, hh, mm, ss, ms );
      return this.matchesYmdLocal( local, year, month, day, hh, mm, ss, ms ) ? local : null;
    }

    const utcMs: number = Date.UTC( year, month - 1, day, hh, mm, ss, ms ) - offsetMinutes * 60_000;
    const d: Date = new Date( utcMs );

    return this.matchesYmdHmsUtc( d, year, month, day, hh, mm, ss, ms, offsetMinutes ) ? d : null;
  }

  private parseStrictSlashFormats( input: string ): Date | null {
    const ymd: RegExp = /^(\d{4})\/(\d{2})\/(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
    const dmy: RegExp = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

    let m: RegExpExecArray | null = ymd.exec( input );
    if ( m ) {
      const year: number = Number( m[ 1 ] );
      const month: number = Number( m[ 2 ] );
      const day: number = Number( m[ 3 ] );
      if ( !this.isValidYmd( year, month, day ) ) return null;

      const hh: number = m[ 4 ] ? Number( m[ 4 ] ) : 0;
      const mm: number = m[ 5 ] ? Number( m[ 5 ] ) : 0;
      const ss: number = m[ 6 ] ? Number( m[ 6 ] ) : 0;

      if ( !this.isValidHms( hh, mm, ss, 0 ) ) return null;

      const d: Date = new Date( year, month - 1, day, hh, mm, ss, 0 );
      return this.matchesYmdLocal( d, year, month, day, hh, mm, ss, 0 ) ? d : null;
    }

    m = dmy.exec( input );
    if ( m ) {
      const day: number = Number( m[ 1 ] );
      const month: number = Number( m[ 2 ] );
      const year: number = Number( m[ 3 ] );
      if ( !this.isValidYmd( year, month, day ) ) return null;

      const hh: number = m[ 4 ] ? Number( m[ 4 ] ) : 0;
      const mm: number = m[ 5 ] ? Number( m[ 5 ] ) : 0;
      const ss: number = m[ 6 ] ? Number( m[ 6 ] ) : 0;

      if ( !this.isValidHms( hh, mm, ss, 0 ) ) return null;

      const d: Date = new Date( year, month - 1, day, hh, mm, ss, 0 );
      return this.matchesYmdLocal( d, year, month, day, hh, mm, ss, 0 ) ? d : null;
    }

    return null;
  }

  private coerceEpochToMs( value: number ): number {
    const abs: number = Math.abs( value );
    if ( abs < 10_000_000_000 ) return value * 1000;
    return value;
  }

  private isEpochMsInReasonableRange( ms: number ): boolean {
    const min: number = Date.UTC( 2000, 0, 1, 0, 0, 0, 0 );
    const max: number = Date.UTC( 2100, 0, 1, 0, 0, 0, 0 );
    return ms >= min && ms <= max;
  }

  private isValidYmd( year: number, month: number, day: number ): boolean {
    if ( !Number.isInteger( year ) || year < 1900 || year > 2200 ) return false;
    if ( !Number.isInteger( month ) || month < 1 || month > 12 ) return false;
    if ( !Number.isInteger( day ) || day < 1 ) return false;

    const daysInMonth: number = this.getDaysInMonth( year, month );
    return day <= daysInMonth;
  }

  private getDaysInMonth( year: number, month: number ): number {
    if ( month === 2 ) return this.isLeapYear( year ) ? 29 : 28;
    if ( month === 4 || month === 6 || month === 9 || month === 11 ) return 30;
    return 31;
  }

  private isLeapYear( year: number ): boolean {
    if ( year % 400 === 0 ) return true;
    if ( year % 100 === 0 ) return false;
    return year % 4 === 0;
  }

  private isValidHms( hh: number, mm: number, ss: number, ms: number ): boolean {
    if ( !Number.isInteger( hh ) || hh < 0 || hh > 23 ) return false;
    if ( !Number.isInteger( mm ) || mm < 0 || mm > 59 ) return false;
    if ( !Number.isInteger( ss ) || ss < 0 || ss > 59 ) return false;
    if ( !Number.isInteger( ms ) || ms < 0 || ms > 999 ) return false;
    return true;
  }

  private padRightMs( rawMs: string ): number {
    const s: string = rawMs.length === 1 ? rawMs + '00' : rawMs.length === 2 ? rawMs + '0' : rawMs;
    return Number( s );
  }

  private matchesYmdUtc( d: Date, y: number, m: number, day: number ): boolean {
    return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
  }

  private matchesYmdLocal( d: Date, y: number, m: number, day: number, hh: number, mm: number, ss: number, ms: number ): boolean {
    return (
      d.getFullYear() === y &&
      d.getMonth() + 1 === m &&
      d.getDate() === day &&
      d.getHours() === hh &&
      d.getMinutes() === mm &&
      d.getSeconds() === ss &&
      d.getMilliseconds() === ms
    );
  }

  private matchesYmdHmsUtc(
    d: Date,
    y: number,
    m: number,
    day: number,
    hh: number,
    mm: number,
    ss: number,
    ms: number,
    offsetMinutes: number,
  ): boolean {
    const adjustedMs: number = d.getTime() + offsetMinutes * 60_000;
    const adj: Date = new Date( adjustedMs );

    return (
      adj.getUTCFullYear() === y &&
      adj.getUTCMonth() + 1 === m &&
      adj.getUTCDate() === day &&
      adj.getUTCHours() === hh &&
      adj.getUTCMinutes() === mm &&
      adj.getUTCSeconds() === ss &&
      adj.getUTCMilliseconds() === ms
    );
  }

  private isDateValue( value: unknown, columnKey?: string | null ): boolean {
    return this.tryParseDate( value, columnKey ) !== null;
  }

  private formatCustomDate( value: any ): string {
    const date = value instanceof Date ? value : new Date( value );
    if ( isNaN( date.getTime() ) ) return String( value );

    const yyyy = date.getFullYear();
    const mm = String( date.getMonth() + 1 ).padStart( 2, '0' );
    const dd = String( date.getDate() ).padStart( 2, '0' );

    let hours = date.getHours();
    const minutes = String( date.getMinutes() ).padStart( 2, '0' );
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    if ( hours === 0 ) hours = 12;

    const hh = String( hours ).padStart( 2, '0' );

    return `${ yyyy }/${ mm }/${ dd } – ${ hh }:${ minutes } ${ ampm }`;
  }

  private booleanCircle( value: boolean ): string {
    return value ? '<span class="bool-circle bool-true"></span>' : '<span class="bool-circle bool-false"></span>';
  }

  // ─────────────────────────────────────────────────────────────
  // Text formatting helpers (trim + tooltip)
  // ─────────────────────────────────────────────────────────────
  protected trimText( text: any, columnKey?: string ): string {
    try {
      const stringValue: string = typeof text === 'string' ? text.trim() : JSON.stringify( text ).trim();
      const parsed: any = JSON.parse( stringValue );

      if ( Array.isArray( parsed ) ) {
        if ( parsed.length === 0 ) return '';

        const allObjects: boolean = parsed.every( ( item: any ) => item !== null && typeof item === 'object' );

        if ( allObjects ) {
          return parsed
            .map( ( item: any ) => this.buildKeyValueLinesFromObject( item ) )
            .filter( ( line: string ) => !!line )
            .join( '<br>' );
        }

        const flat: string = parsed
          .map( ( item: any ) => String( item ?? '' ).trim() )
          .filter( ( v: string ) => v.length > 0 )
          .join( ', ' );

        const safeFlat: string = flat.trim();
        return safeFlat.length > 30 ? `${ safeFlat.slice( 0, 30 ) }...` : safeFlat;
      }

      if ( typeof parsed === 'object' && parsed !== null ) {
        return this.buildKeyValueLinesFromObject( parsed );
      }

      if ( typeof parsed === 'boolean' ) {
        return this.booleanCircle( parsed );
      }

      if ( this.isDateValue( parsed, columnKey ?? null ) ) {
        const dt: Date | null = this.tryParseDate( parsed, columnKey ?? null );
        return dt ? this.formatCustomDate( dt ) : String( parsed ?? '' ).trim();
      }

      const plain: string = String( parsed ?? '' ).trim();
      return plain.length > 30 ? `${ plain.slice( 0, 30 ) }...` : plain;
    } catch {
      const safeText: string = String( text ?? '' ).trim();
      return safeText.length > 30 ? `${ safeText.slice( 0, 30 ) }...` : safeText;
    }
  }

  protected getToolTip( text: any, columnKey?: string ): string {
    try {
      const stringValue: string = typeof text === 'string' ? text.trim() : JSON.stringify( text ).trim();
      const parsed: any = JSON.parse( stringValue );

      if ( Array.isArray( parsed ) ) {
        if ( parsed.length === 0 ) return '';

        const allObjects: boolean = parsed.every( ( item: any ) => item !== null && typeof item === 'object' );

        if ( allObjects ) {
          return parsed
            .map( ( item: any ) => this.buildKeyValueLinesPlain( item ) )
            .filter( Boolean )
            .join( ' | ' );
        }

        return parsed
          .map( ( item: any ) => String( item ?? '' ).trim() )
          .filter( Boolean )
          .join( ', ' );
      }

      if ( typeof parsed === 'object' && parsed !== null ) {
        return this.buildKeyValueLinesPlain( parsed );
      }

      if ( typeof parsed === 'boolean' ) {
        return parsed ? 'Yes' : 'No';
      }

      if ( this.isDateValue( parsed, columnKey ?? null ) ) {
        const dt: Date | null = this.tryParseDate( parsed, columnKey ?? null );
        return dt ? this.formatCustomDate( dt ) : String( parsed ).trim();
      }

      return String( parsed ?? '' ).trim();
    } catch {
      return String( text ?? '' ).trim();
    }
  }

  private buildKeyValueLinesPlain( input: any ): string {
    if ( !input || typeof input !== 'object' ) return '';

    return Object.entries( input )
      .map( ( [ key, value ] ) => {
        if ( key.includes( '_' ) ) return '';

        if ( typeof value === 'boolean' ) {
          return `${ this.makeCapitalize( key ) }: ${ value ? 'Yes' : 'No' }`;
        }

        if ( ( typeof value === 'string' || typeof value === 'number' ) && this.isDateValue( value, key ) ) {
          const dt: Date | null = this.tryParseDate( value, key );
          if ( dt ) return `${ this.makeCapitalize( key ) }: ${ this.formatCustomDate( dt ) }`;
        }

        return `${ this.makeCapitalize( key ) }: ${ String( value ?? '' ).trim() }`;
      } )
      .filter( Boolean )
      .join( ' | ' );
  }

  private buildKeyValueLinesFromObject( input: any ): string {
    if ( !input || typeof input !== 'object' ) return '';

    return Object.entries( input )
      .map( ( [ key, value ] ) => {
        if ( key.includes( '_' ) ) return '';

        if ( typeof value === 'boolean' ) {
          return `${ this.makeCapitalize( key ) } : ${ this.booleanCircle( value ) }`;
        }

        if ( ( typeof value === 'string' || typeof value === 'number' ) && this.isDateValue( value, key ) ) {
          const dt: Date | null = this.tryParseDate( value, key );
          if ( dt ) return `${ this.makeCapitalize( key ) } : ${ this.formatCustomDate( dt ) }`;
        }

        return `${ this.makeCapitalize( key ) } : ${ this.makeCapitalize( value ) }`;
      } )
      .filter( ( line: string ) => !!line )
      .join( '<br>' );
  }

  protected makeCapitalize( text: any ): string {
    const stringValue: string = typeof text === 'string' ? text : String( text ?? '' ).trim();

    if ( !this.isBrowser ) {
      return stringValue
        .split( ' ' )
        .map( ( word: string ) => ( word ? word.charAt( 0 ).toUpperCase() + word.slice( 1 ) : '' ) )
        .join( ' ' );
    }

    const parser: DOMParser = new DOMParser();
    const doc: Document = parser.parseFromString( `<div>${ stringValue }</div>`, 'text/html' );
    const container: HTMLElement = doc.body.firstChild as HTMLElement;

    const capitalizeTextNodes = ( node: Node ): void => {
      if ( node.nodeType === Node.TEXT_NODE ) {
        const originalText: string = node.nodeValue || '';
        node.nodeValue = originalText
          .split( ' ' )
          .map( ( word: string ) => ( word ? word.charAt( 0 ).toUpperCase() + word.slice( 1 ) : '' ) )
          .join( ' ' );
      } else if ( node.nodeType === Node.ELEMENT_NODE && node.childNodes ) {
        node.childNodes.forEach( ( child: Node ) => capitalizeTextNodes( child ) );
      }
    };

    capitalizeTextNodes( container );
    return container.innerHTML;
  }

  // ─────────────────────────────────────────────────────────────
  // File export
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // Legacy single action click → emit
  // ─────────────────────────────────────────────────────────────
  protected handleButtonOperations( action: TableButton[ 'action' ], data: any ): void {
    try {
      if ( typeof action !== 'string' || !action ) throw new Error( 'Button ID is invalid!' );

      this.buttonOperation.emit( { action, data } );
    } catch ( err ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [CustomTable] Table action button error.\n', err );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Retry / fetch logic
  // ─────────────────────────────────────────────────────────────
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

    this.fetchRetryTimerId = setTimeout( (): void => {
      this.scheduleDataFetchIfNeeded();
    }, this.fetchRetryDelayMs );
  }

  // ─────────────────────────────────────────────────────────────
  // Legacy action derivation for button columns
  // ─────────────────────────────────────────────────────────────
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

  protected checkButtonBGforNormal( action: string ): boolean {
    const normal: string[] = [ 'download', 'upload', 'edit', 'reset', 'search' ];
    const safeAction: string = action.toLowerCase().trim();
    return normal.includes( safeAction );
  }

  // ─────────────────────────────────────────────────────────────
  // MIME / extension → icon mapping
  // ─────────────────────────────────────────────────────────────
  private mapMimeOrExtToExtension( type: string | undefined | null ): Extension {
    if ( !type ) return 'file';

    const lower = type.toLowerCase().trim();

    if ( lower.includes( '/' ) ) {
      const mime = lower;

      if ( mime.startsWith( 'image/' ) ) return 'png';
      if ( mime === 'application/pdf' ) return 'pdf';

      if (
        mime === 'application/zip' ||
        mime === 'application/x-zip-compressed' ||
        mime === 'application/x-7z-compressed'
      ) {
        return 'zip';
      }

      if (
        mime === 'application/msword' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.template' ||
        mime === 'application/rtf'
      ) {
        return 'docx';
      }

      if (
        mime === 'application/vnd.ms-excel' ||
        mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.template' ||
        mime === 'text/csv'
      ) {
        return 'xlsx';
      }

      if (
        mime === 'application/vnd.ms-powerpoint' ||
        mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        mime === 'application/vnd.openxmlformats-officedocument.presentationml.template'
      ) {
        return 'pptx';
      }

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

  // ─────────────────────────────────────────────────────────────
  // KPI spark helpers (used by template case: 'kpiSpark')
  // ─────────────────────────────────────────────────────────────
  protected kpiToneClass( tone: unknown ): 'ok' | 'warn' | 'danger' | 'normal' {
    const t = String( tone ?? '' ).trim().toLowerCase();

    // Accept a few aliases so FE can send flexible values
    if ( t === 'ok' || t === 'good' || t === 'success' || t === 'positive' ) return 'ok';
    if ( t === 'warn' || t === 'warning' || t === 'medium' ) return 'warn';
    if ( t === 'danger' || t === 'bad' || t === 'error' || t === 'critical' || t === 'negative' ) return 'danger';

    return 'normal';
  }

  protected buildSparkPolyline( series: unknown ): string {
    // SVG viewBox: 0 0 100 28 (from your template)
    const W = 100;
    const H = 28;

    const arr = Array.isArray( series ) ? series : [];
    const pointsRaw = arr
      .map( v => ( typeof v === 'number' && Number.isFinite( v ) ? v : null ) )
      .filter( ( v ): v is number => v !== null );

    // If not enough points, draw a flat line in the middle
    if ( pointsRaw.length < 2 ) {
      return `0 ${ H / 2 } ${ W } ${ H / 2 }`;
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for ( const v of pointsRaw ) {
      if ( v < min ) min = v;
      if ( v > max ) max = v;
    }

    // Avoid divide-by-zero (all equal values)
    const range = max - min;
    const safeRange = range === 0 ? 1 : range;

    const n = pointsRaw.length;
    const stepX = W / ( n - 1 );

    const pts: string[] = [];

    for ( let i = 0; i < n; i++ ) {
      const v = pointsRaw[ i ];

      // Normalize to 0..1 then invert for SVG y (0 is top)
      const norm = ( v - min ) / safeRange;
      const x = i * stepX;
      const y = ( 1 - norm ) * ( H - 2 ) + 1; // padding 1px top/bottom

      pts.push( `${ this.round1( x ) } ${ this.round1( y ) }` );
    }

    return pts.join( ' ' );
  }

  private round1( v: number ): number {
    return Math.round( v * 10 ) / 10;
  }

  // ─────────────────────────────────────────────────────────────
  // KPI detection + normalization helpers
  // ─────────────────────────────────────────────────────────────
  private isKpiLikeKey( key: string ): boolean {
    const k = this.normalizeKeyToken( key );
    if ( !k ) return false;

    // Strong signals (avoid false positives)
    if ( k.includes( 'kpi' ) ) return true;
    if ( k.includes( 'rate' ) || k.includes( 'score' ) ) return true;
    if ( k.includes( 'health' ) || k.includes( 'engagement' ) ) return true;
    if ( k.includes( 'performance' ) || k.includes( 'completion' ) ) return true;

    return false;
  }

  private isKpiCellShape( v: any ): boolean {
    if ( !v || typeof v !== 'object' || Array.isArray( v ) ) return false;

    // Any of these indicates a KPI cell
    const hasScore = 'score' in v || 'value' in v || 'percent' in v || 'percentage' in v;
    const hasDelta = 'delta' in v || 'change' in v || 'diff' in v || 'deltaValue' in v;
    const hasSeries = 'series' in v || 'spark' in v || 'trend' in v;

    return !!( hasScore || hasDelta || hasSeries );
  }

  private normalizeKpiCell( raw: any ): TableKpiSparkCell {
    // number => score
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

    const toneRaw =
      String( ( raw as any ).tone ?? ( raw as any ).status ?? '' ).trim().toLowerCase() || 'normal';

    const seriesRaw = ( raw as any ).series ?? ( raw as any ).spark ?? ( raw as any ).trend ?? [];
    const series = Array.isArray( seriesRaw ) ? seriesRaw : [];

    // Auto tone if not explicit
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

        // Case: { health: {score,delta,...} }
        if ( this.isKpiCellShape( val ) || typeof val === 'number' ) {
          out[ key ] = this.normalizeKpiCell( val );
          continue;
        }

        // Case: nested object still might contain KPI-like leaves
        if ( val && typeof val === 'object' && !Array.isArray( val ) ) {
          // If this nested object itself is a KPI packet container, flatten it
          const nk = this.normalizeKeyToken( key );
          if ( this.KPI_CONTAINER_KEYS.includes( nk as any ) ) {
            tryExtractFromObject( val );
          }
        }
      }
    };

    // 1) explicit KPI containers
    for ( const cKey of this.KPI_CONTAINER_KEYS ) {
      const container = ( row as any )[ cKey ];
      if ( container && typeof container === 'object' ) {
        tryExtractFromObject( container );
      }
    }

    // 2) direct KPI-ish keys at root (avoid exploding everything)
    for ( const key of Object.keys( row ) ) {
      if ( !this.isKpiLikeKey( key ) ) continue;

      const val = ( row as any )[ key ];
      if ( this.isKpiCellShape( val ) || typeof val === 'number' ) {
        out[ key ] = this.normalizeKpiCell( val );
      }
    }

    return out;
  }

  private buildStableKpiKeyOrder( keys: string[] ): string[] {
    const norm = ( k: string ) => this.normalizeKeyToken( k );

    // Priority bucket by hint list
    const scoreKey = ( k: string ): number => {
      const nk = norm( k );
      const idx = this.KPI_ORDER_HINTS.findIndex( h => nk.includes( h ) );
      return idx === -1 ? 9999 : idx;
    };

    return keys
      .slice()
      .sort( ( a, b ) => {
        const pa = scoreKey( a );
        const pb = scoreKey( b );
        if ( pa !== pb ) return pa - pb;

        // tie-breaker stable alphabetical by normalized key
        return norm( a ).localeCompare( norm( b ) );
      } );
  }

  private normalizeRowsForKpi( rows: any[] ): any[] {
    try {
      const safeRows = Array.isArray( rows ) ? rows : [];
      if ( safeRows.length === 0 ) return [];

      // Extract KPI keys across first N rows (avoid heavy scan)
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

      // Cache stable order (first time only, unless KPI set changes)
      const ordered =
        this.kpiColumnOrderCache &&
          this.kpiColumnOrderCache.length > 0 &&
          this.sameKeySet( this.kpiColumnOrderCache, kpiKeys )
          ? this.kpiColumnOrderCache
          : this.buildStableKpiKeyOrder( kpiKeys );

      this.kpiColumnOrderCache = ordered;

      // Ensure columns exist for each KPI key (and are rendered as kpiSpark)
      this.ensureKpiColumnsExist( ordered );

      // Build normalized rows: merge KPI cells at root so each KPI has its own column
      return safeRows.map( ( rawRow, idx ) => {
        const kpis =
          idx < scanN ? perRowKpi[ idx ] : this.extractKpiPairsFromRow( rawRow );

        const out: any = { ...( rawRow ?? {} ) };

        // Put normalized KPI cells at root keys (one column per KPI)
        for ( const key of ordered ) {
          if ( kpis[ key ] ) out[ key ] = kpis[ key ];
          else if ( out[ key ] && ( this.isKpiCellShape( out[ key ] ) || typeof out[ key ] === 'number' ) ) {
            // normalize existing
            out[ key ] = this.normalizeKpiCell( out[ key ] );
          }
        }

        // Keep a reference to raw (useful if you need it later)
        out.__raw = rawRow;

        return out;
      } );
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [CustomTable] normalizeRowsForKpi failed.\n', error );
      return Array.isArray( rows ) ? rows : [];
    }
  }

  private sameKeySet( a: string[], b: string[] ): boolean {
    const A = new Set( a.map( x => this.normalizeKeyToken( x ) ) );
    const B = new Set( b.map( x => this.normalizeKeyToken( x ) ) );
    if ( A.size !== B.size ) return false;
    for ( const x of A ) if ( !B.has( x ) ) return false;
    return true;
  }

  private ensureKpiColumnsExist( orderedKeys: string[] ): void {
    const cols: TableColumn[] = Array.isArray( this.columns ) ? this.columns : [];

    const seen = new Set( cols.map( c => String( c.key ?? '' ).trim() ) );
    const kpiCols: TableColumn[] = [];

    for ( const key of orderedKeys ) {
      if ( seen.has( key ) ) {
        // If parent gave it, force render to kpiSpark for KPI-like keys
        const existing = cols.find( c => c.key === key );
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

    // Insert KPI columns “intelligently”:
    // - If parent already has KPI columns, append new KPIs after them
    // - Else: append at end (keeps parent order stable)
    const firstKpiIndex = cols.findIndex( c => c.render === 'kpiSpark' || this.isKpiLikeKey( c.key ) );
    if ( firstKpiIndex >= 0 ) {
      const head = cols.slice( 0, firstKpiIndex + 1 );
      const tail = cols.slice( firstKpiIndex + 1 );
      this.columns = [ ...head, ...kpiCols, ...tail ];
    } else {
      this.columns = [ ...cols, ...kpiCols ];
    }
  }


}
