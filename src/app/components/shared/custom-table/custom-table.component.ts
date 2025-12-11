// Path: src/app/components/shared/custom-table/custom-table.component.ts

// ──────────────────────────────────────────────────────────────────────────────
// Angular & Common
// ──────────────────────────────────────────────────────────────────────────────
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DoCheck,
  Inject,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  SimpleChanges,
  IterableDiffer,
  IterableDiffers,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

// ──────────────────────────────────────────────────────────────────────────────
// Angular Material
// ──────────────────────────────────────────────────────────────────────────────
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

// ──────────────────────────────────────────────────────────────────────────────
// Services & utilities
// ──────────────────────────────────────────────────────────────────────────────
import { User } from '../../../services/APIs/apis.service';
import { AuthService } from '../../../services/auth/auth.service';
import { ImageService } from '../../../services/imageService/image.service';
import { PaginationUtil } from '../../../source/utility/pagination.utils';

// ──────────────────────────────────────────────────────────────────────────────
// Child components
// ──────────────────────────────────────────────────────────────────────────────
import {
  Extension,
  PaginatorComponent,
  DateRange,
} from '../paginator/paginator.component';
import { SwitchButton } from '../../../components/shared/buttons/switch-button/switch-button.component';
import { SkeletonLoaderComponent } from '../skeleton-loader/skeleton-loader.component';
import { DateTimePickerComponent } from '../date-time-picker/date-time-picker.component';

// ──────────────────────────────────────────────────────────────────────────────
// Dialog for long-text editing
// ──────────────────────────────────────────────────────────────────────────────
import {
  TextEditorDialogComponent,
  TextEditorDialogData,
  TextEditorDialogResult,
} from '../../dialogs/text-editor-dialog/text-editor-dialog.component';
import { TextService } from '../../../services/text/text.service';

// ──────────────────────────────────────────────────────────────────────────────
// Re-exports for consumers
// ──────────────────────────────────────────────────────────────────────────────
export type TableExtension = Extension;
export type TableDateRange = DateRange;

// ──────────────────────────────────────────────────────────────────────────────
/** Material icons used for file-type representation */
// ──────────────────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────────────────
// Table actions and button types
// ──────────────────────────────────────────────────────────────────────────────

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

/**
 * Button configuration for a cell.
 *  - action: emitted up to the parent when clicked
 *  - icon: Material icon name
 *  - label: tooltip / visible label
 */
export interface TableButton {
  action: ActionId;
  icon: ActionIcon;
  label?: string;
  disabled?: boolean;
}

/** Payload emitted when a button is clicked */
export interface TableButtonActionConfig {
  action: ActionId;
  data: any;
}

// ──────────────────────────────────────────────────────────────────────────────
// Columns / events / switch types / edit types
// ──────────────────────────────────────────────────────────────────────────────

// How this column is edited
export type TableEditKind =
  | 'none'          // read-only
  | 'inlineText'    // small single-line text
  | 'inlineNumber'  // small numeric
  | 'inlineSelect'  // small select dropdown
  | 'inlineSwitch'  // boolean toggle
  | 'dialogText'   // large text → open dialog editor
  | 'inlineDate'   // inline date
  | 'inlineDateTime'   // inline date and time
  | 'dialogDateRange';   // inline date and time


export interface TableEditOption {
  label: string;
  value: any;
}

export interface TableEditConfig {
  kind: TableEditKind;

  /** For inlineText / inlineNumber */
  maxLength?: number;
  min?: number;
  max?: number;

  /** For inlineSelect */
  options?: TableEditOption[];

  /** For dialogText */
  dialogTitle?: string;
  fieldLabel?: string;
  maxDialogLength?: number; // e.g. 2000

  /** For inlineDate / inlineDateTime */
  minDate?: Date | string;
  maxDate?: Date | string;

  disabled?: boolean;

  /** Generic */
  placeholder?: string;
  required: boolean;
}


/** Column descriptor for dynamic tables */
export interface TableColumn {
  /** Must match a key on each row object */
  key: string;
  /** Header text */
  label: string;

  /**
   * Optional editing config:
   *  - inlineText / inlineNumber / inlineSelect / inlineSwitch / dialogText
   *  - if not provided → read-only
   */
  edit?: TableEditConfig;
}

/** File export payload bubbled to parent */
export interface FileExport {
  data: any[];
  extention: Extension;
}

export type fileExt = Extension;

/** (Reserved for future) normalized event types */
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

/** Optional per-row visibility predicates (currently not wired) */
export interface ButtonVisibility {
  action?: ( row: any ) => boolean;
  operation?: ( row: any ) => boolean;
}

/** Switch button payload (row-level toggle) */
export interface SwitchButtonType {
  isActive: boolean;
  index: number | null;
  on?: string;
  off?: string;
  data?: any;
}

/** Single cell edit payload for parent */
export interface TableCellEdit {
  rowIndex: number;
  columnKey: string;
  value: any;
  row: any;
  editKind: TableEditKind;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

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
export class CustomTableComponent
  implements OnInit, AfterViewInit, OnDestroy, OnChanges, DoCheck {
  @ViewChild( DateTimePickerComponent, { static: true } ) dateTimePicker !: DateTimePickerComponent;

  // ─────────────────────────────────────────────────────────────
  // @Inputs / @Outputs - Public API for parents
  // ─────────────────────────────────────────────────────────────

  /** Enable/disable paginator row */
  @Input( { required: true } ) pagination: boolean = false;

  /** Total number of records (for pagination) */
  @Input( { required: false } ) totalDataCount: number = 0;

  /** Row data array (any object shape, see columns) */
  @Input( { required: true } ) data: any[] = [];

  /** Columns configuration (key + label) */
  @Input( { required: true } ) columns: TableColumn[] = [];

  /** Page size (bound to paginator) */
  @Input( { required: false } ) limit: number = 2;
  @Output() limitChange: EventEmitter<number> = new EventEmitter<number>();

  /** Page index (bound to paginator) */
  @Input( { required: false } ) index: number = 0;
  @Output() indexChange: EventEmitter<number> = new EventEmitter<number>();

  /** Table heading text */
  @Input( { required: true } ) tableTitle: string = '';

  /** Search text (from parent) */
  @Input( { required: false } ) search: string = '';
  @Output() searchChange: EventEmitter<string> = new EventEmitter<string>();

  /** Reload flag (used to reset filters + refetch) */
  @Input( { required: false } ) isReload: boolean = false;
  @Output() isReloadChange: EventEmitter<boolean> =
    new EventEmitter<boolean>();

  /** File extension for export button (e.g. xlsx, pdf, csv) */
  @Input() fileExportExtention!: Extension;
  @Output() fileExport: EventEmitter<FileExport> =
    new EventEmitter<FileExport>();

  /** Enable date-range picker above table */
  @Input() isDateRageActive = false;

  /** Current date range selection */
  @Input() dateRange: DateRange | null = null;
  @Output() dateRangeChange: EventEmitter<DateRange | null> =
    new EventEmitter<DateRange | null>();
  @Output() rangeChange: EventEmitter<DateRange | null> =
    new EventEmitter<DateRange | null>();

  /** Optional button set for header/toolbar (not mandatory) */
  @Input() buttons: TableButton[] = [];
  @Output() buttonOperation: EventEmitter<TableButtonActionConfig> =
    new EventEmitter<TableButtonActionConfig>();

  /** Row-level switch configuration */
  @Input() switch!: SwitchButtonType;
  @Output() switchChange: EventEmitter<SwitchButtonType> =
    new EventEmitter<SwitchButtonType>();

  /** Request the parent to fetch data (table-driven loading) */
  @Output() fetchData: EventEmitter<void> = new EventEmitter<void>();

  /** Emits when a cell is edited (inline or dialog) */
  @Output() cellEdit: EventEmitter<TableCellEdit> =
    new EventEmitter<TableCellEdit>();

  // ─────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────

  /** SSR guard */
  private readonly isBrowser: boolean;

  /** Logged user (if needed for some future features) */
  protected readonly loggedUser: User | null;

  /** MatTable column keys */
  protected displayedColumnKeys: string[] = [];

  /** MatTable data source wrapper */
  protected dataSource: MatTableDataSource<any> =
    new MatTableDataSource<any>();

  /** Status helpers / UI flags */
  protected tableButtonAction = '';
  protected tableButtonOperation = '';
  protected tableStatus = '';
  protected isTableVisible = true;
  protected dataCount = 0;
  protected isArrayOfData = false;

  // Default image fallbacks
  protected readonly definedMaleDummyImageURL =
    'Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL =
    'Images/user-images/dummy-user/dummy_woman.jpg';
  protected readonly definedImage = 'Images/System-images/noImage.jpeg';

  // Cached row visibility flags (not used yet, kept for future)
  protected canShowActionForRow: Map<string, boolean> = new Map<string, boolean>();
  protected canShowOperationForRow: Map<string, boolean> = new Map<string, boolean>();

  /**
   * Map of "button-like" column keys (viewButton, actionBtn, etc.)
   * → resolved TableButton config.
   */
  protected buttonColumns: Map<string, TableButton> =
    new Map<string, TableButton>();

  /**
   * In-memory edited values:
   *  Map<rowIndex, Record<columnKey, value>>
   */
  protected rowEditState: Map<number, Record<string, any>> =
    new Map<number, Record<string, any>>();

  // Retry logic for "wait for parent API"
  private fetchAttempts = 0;
  private readonly maxFetchAttempts = 3;
  private readonly fetchRetryDelayMs = 400;
  private fetchRetryTimerId: ReturnType<typeof setTimeout> | null = null;

  // Iterable differ: detect in-place mutations (push/splice) on `data`
  private dataDiffer: IterableDiffer<any> | null = null;

  // ─────────────────────────────────────────────────────────────
  // DI & Constructor
  // ─────────────────────────────────────────────────────────────

  public constructor (
    private readonly authService: AuthService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly imageService: ImageService,
    private readonly cdr: ChangeDetectorRef,
    private readonly differs: IterableDiffers,
    private readonly dialog: MatDialog,
    private readonly textService: TextService
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.loggedUser = this.authService.getLoggedUser ?? null;
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  public async ngOnInit(): Promise<void> {
    const rows: any[] = Array.isArray( this.data ) ? this.data : [];
    this.dataSource.data = rows;
    this.dataCount = rows.length;
    this.isArrayOfData = rows.length > 0;

    this.dataDiffer = this.differs.find( this.data || [] ).create<any>();

    this.scheduleDataFetchIfNeeded();
  }

  public ngAfterViewInit(): void {
    // Reserved for future (e.g. view-level tweaks)
  }

  public ngOnDestroy(): void {
    this.resetFetchAttempts();
  }

  public ngOnChanges( changes: SimpleChanges ): void {
    let dataChanged = false;

    if ( changes[ 'data' ] ) {
      const rows: any[] = Array.isArray( this.data ) ? this.data : [];
      this.dataCount = rows.length;
      this.dataSource.data = rows;
      this.isArrayOfData = rows.length > 0;
      dataChanged = true;

      this.dataDiffer = this.differs.find( this.data || [] ).create<any>();
      this.cdr.markForCheck();
    }

    if ( changes[ 'columns' ] ) {
      this.normalizeColumnsAndDetectButtons();
      this.cdr.markForCheck();
    }

    if ( changes[ 'totalDataCount' ] || dataChanged ) {
      Promise.resolve().then( () => this.scheduleDataFetchIfNeeded() );
    }
  }

  public ngDoCheck(): void {
    if ( !this.dataDiffer || !Array.isArray( this.data ) ) {
      return;
    }

    const changes = this.dataDiffer.diff( this.data );
    if ( changes ) {
      this.dataSource.data = this.data;
      this.dataCount = this.data.length;
      this.isArrayOfData = this.data.length > 0;
      this.cdr.markForCheck();
    }
  }
  // ─────────────────────────────────────────────────────────────
  // Public helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Convert an array of primitive values (string/number or literal unions)
   * into a `{ label, value }[]` pair list for selects, etc.
   *
   * - Accepts *readonly* arrays (e.g. readonly RoleInTeam[])
   * - Preserves the exact value type via generics
   */
  public convertArrayIntoObjectPair<T extends string | number>(
    data: readonly T[],
  ): { label: string; value: T; }[] {
    try {
      if ( !Array.isArray( data ) || data.length === 0 ) {
        throw new Error( 'Data array is invalid!' );
      }

      const returnData: { label: string; value: T; }[] = [];

      for ( const item of data ) {
        // keyToLabel most likely expects string → normalize to string
        const label: string = this.textService.keyToLabel( String( item ) );

        const organised: { label: string; value: T; } = {
          label,
          value: item,
        };

        returnData.push( organised );
      }

      return returnData;
    } catch ( error ) {
      console.error( error );
      return [];
    }
  }

  protected toDateOrNull(
    raw: string | Date | null | undefined,
  ): Date | null {
    if ( raw instanceof Date ) {
      return raw;
    }

    if ( typeof raw === 'string' ) {
      const trimmed: string = raw.trim();
      if ( !trimmed ) {
        return null;
      }

      const parsed: Date = new Date( trimmed );
      if ( Number.isNaN( parsed.getTime() ) ) {
        return null;
      }

      return parsed;
    }

    return null;
  }
  // ─────────────────────────────────────────────────────────────
  // Column / button column normalization
  // ─────────────────────────────────────────────────────────────

  private normalizeColumnsAndDetectButtons(): void {
    this.buttonColumns.clear();

    const rawColumns: TableColumn[] = Array.isArray( this.columns )
      ? this.columns
      : [];
    const normalized: TableColumn[] = [];
    const seenKeys: Set<string> = new Set<string>();

    for ( const col of rawColumns ) {
      const key: string = ( col.key || '' ).trim();
      if ( !key ) continue;
      if ( seenKeys.has( key ) ) {
        console.warn( '[CustomTable] Dropping duplicate column key:', key );
        continue;
      }
      seenKeys.add( key );
      normalized.push( col );
    }

    this.columns = normalized;
    this.displayedColumnKeys = normalized.map(
      ( c: TableColumn ): string => c.key,
    );

    this.tableStatus =
      (
        normalized.find(
          ( c: TableColumn ) => c.key.toLowerCase() === 'status',
        )?.key || ''
      ).toLowerCase();

    for ( const col of normalized ) {
      const keyRaw: string = ( col.key || '' ).trim();
      if ( !keyRaw ) continue;

      const keyLower: string = keyRaw.toLowerCase();

      if (
        keyLower.includes( 'btn' ) ||
        keyLower.includes( 'button' ) ||
        keyLower.includes( 'buttons' )
      ) {
        const action: ActionId | null = this.deriveActionFromColumn( col );
        if ( !action ) {
          console.warn(
            '[CustomTable] Could not derive action from button column:',
            col,
          );
          continue;
        }

        const override: TableButton | null = this.findButtonConfig( action );

        const label: string =
          col.label ||
          override?.label ||
          this.buildButtonLabelFromAction( action );

        const icon: ActionIcon = override?.icon || ACTION_ICONS[ action ];

        const buttonConfig: TableButton = { action, icon, label };
        this.buttonColumns.set( keyLower, buttonConfig );
      }
    }
  }

  protected isButtonColumn( columnKey: string ): boolean {
    const keyLower: string = ( columnKey || '' ).trim().toLowerCase();
    return this.buttonColumns.has( keyLower );
  }

  protected getButtonForColumn( columnKey: string ): TableButton | null {
    const keyLower: string = ( columnKey || '' ).trim().toLowerCase();
    return this.buttonColumns.get( keyLower ) ?? null;
  }

  private findButtonConfig( action: ActionId ): TableButton | null {
    if ( !Array.isArray( this.buttons ) || this.buttons.length === 0 ) {
      return null;
    }
    const found: TableButton | undefined = this.buttons.find(
      ( btn: TableButton ) => btn.action === action,
    );
    return found ?? null;
  }

  // ─────────────────────────────────────────────────────────────
  // Edit-state helpers (inline + dialog)
  // ─────────────────────────────────────────────────────────────

  /** Ensure there is a mutable edit state object for a given row index */
  private ensureRowEditState(
    rowIndex: number,
    row: any,
  ): Record<string, any> {
    if ( !this.rowEditState.has( rowIndex ) ) {
      this.rowEditState.set( rowIndex, { ...row } );
    }
    // Map.get must be non-null because we just set it above when missing
    return this.rowEditState.get( rowIndex ) as Record<string, any>;
  }

  /**
   * Returns the current value for a cell, preferring edited state over
   * the raw row value.
   */
  protected getCellEditValue(
    rowIndex: number,
    columnKey: string,
    row: any,
  ): any {
    const state = this.rowEditState.get( rowIndex );
    if (
      state &&
      Object.prototype.hasOwnProperty.call( state, columnKey )
    ) {
      return state[ columnKey ];
    }
    return row ? row[ columnKey ] : undefined;
  }

  /**
   * Handle inline edit changes (text/number/select/switch).
   * Updates edit map and emits a TableCellEdit payload.
   */
  protected handleInlineEditChange(
    value: any,
    column: TableColumn,
    row: any,
    rowIndex: number,
  ): void {
    try {
      const columnKey: string = ( column.key || '' ).trim();
      if ( !columnKey ) {
        throw new Error( 'Column key is required for inline edit.' );
      }

      const editKind: TableEditKind = column.edit?.kind || 'none';
      let normalisedValue: any = value;

      switch ( editKind ) {
        case 'inlineNumber': {
          if ( value === '' || value === null || value === undefined ) {
            normalisedValue = null;
          } else {
            const num = Number( value );
            normalisedValue = Number.isNaN( num ) ? null : num;
          }
          break;
        }

        case 'inlineDate':
        case 'inlineDateTime': {
          if ( !value ) {
            normalisedValue = null;
          } else if ( value instanceof Date ) {
            normalisedValue = isNaN( value.getTime() ) ? null : value;
          } else {
            const dt = new Date( value );
            normalisedValue = isNaN( dt.getTime() ) ? null : dt;
          }
          break;
        }

        default:
          normalisedValue = value;
      }

      const state: Record<string, any> = this.ensureRowEditState( rowIndex, row );
      state[ columnKey ] = normalisedValue;

      const payload: TableCellEdit = {
        rowIndex,
        columnKey,
        value: normalisedValue,
        row,
        editKind,
      };

      this.cellEdit.emit( payload );
    } catch ( error ) {
      console.error( '[CustomTable] handleInlineEditChange error:', error );
    }
  }



  /** True if this column should be edited inline in the table cell */
  protected hasInlineEdit( column: TableColumn ): boolean {
    const kind: TableEditKind | undefined = column.edit?.kind;
    return !!kind && (
      kind === 'inlineText' ||
      kind === 'inlineNumber' ||
      kind === 'inlineSelect' ||
      kind === 'inlineSwitch' ||
      kind === 'inlineDate' ||
      kind === 'inlineDateTime'
    );
  }

  /**
 * Coerce a Date|string|undefined into a valid Date or null.
 * Used for [min]/[max] inputs on Material date/datetime pickers.
 */
  protected coerceDate(
    input: Date | string | null | undefined,
  ): Date | null {
    if ( !input ) return null;
    if ( input instanceof Date ) {
      return isNaN( input.getTime() ) ? null : input;
    }
    const parsed = new Date( input );
    return isNaN( parsed.getTime() ) ? null : parsed;
  }

  /** True if this column uses the dialog text editor */
  protected isDialogTextEdit( column: TableColumn ): boolean {
    return column.edit?.kind === 'dialogText';
  }

  /**
   * Open dialog text editor for large text columns.
   * When user saves:
   *  - update rowEditState
   *  - emit cellEdit(event) with editKind = 'dialogText'
   */
  protected openTextEditorDialog(
    column: TableColumn,
    row: any,
    rowIndex: number,
  ): void {
    try {
      const key: string = ( column.key || '' ).trim();
      if ( !key ) {
        throw new Error( 'Column key is required for dialog text edit.' );
      }

      const current: string =
        this.getCellEditValue( rowIndex, key, row ) ??
        row?.[ key ] ??
        '';

      const data: TextEditorDialogData = {
        title: column.edit?.dialogTitle || 'Edit text',
        label: column.edit?.fieldLabel || column.label || key,
        value: String( current ),
        maxLength: column.edit?.maxDialogLength,
      };

      const dialogRef = this.dialog.open<
        TextEditorDialogComponent,
        TextEditorDialogData,
        TextEditorDialogResult
      >( TextEditorDialogComponent, {
        width: '700px',
        maxWidth: '90vw',
        data,
        disableClose: true,
      } );

      dialogRef.afterClosed().subscribe(
        ( result: TextEditorDialogResult | undefined ) => {
          if ( !result ) {
            return;
          }

          const state: Record<string, any> =
            this.ensureRowEditState( rowIndex, row );
          state[ key ] = result.value;

          const payload: TableCellEdit = {
            rowIndex,
            columnKey: key,
            value: result.value,
            row,
            editKind: 'dialogText',
          };

          this.cellEdit.emit( payload );
        },
      );
    }
    catch ( error ) {
      console.error( '[CustomTable] openTextEditorDialog error:', error );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Status / style helpers
  // ─────────────────────────────────────────────────────────────

  protected statusClass( status: string | null | undefined ): string {
    const norm: string = String( status ?? '' )
      .trim()
      .toLowerCase()
      .replace( /\s+/g, '_' );

    if ( !norm ) return 'main-category';
    return `main-category ${ norm }`;
  }

  private deriveActionFromColumn( col: TableColumn ): ActionId | null {
    const rawSource: string = ( col.key || col.label || '' )
      .toString()
      .toLowerCase()
      .trim();

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

    const match: ActionId | undefined = possibleActions.find(
      ( id: ActionId ) => id === cleaned,
    );
    return match ?? null;
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
  // Paginator bindings
  // ─────────────────────────────────────────────────────────────

  get tablePageIndex(): number {
    return this.index;
  }
  set tablePageIndex( value: number ) {
    const safeLimit = PaginationUtil.safeLimit(
      this.limit,
      this.totalDataCount,
    );
    const totalPages = Math.max(
      1,
      Math.ceil( this.totalDataCount / safeLimit ),
    );
    const safeIndex = PaginationUtil.safeIndex( value, totalPages );
    this.index = safeIndex;
    this.indexChange.emit( safeIndex );
  }

  get tableSearchValue(): string {
    return this.search;
  }
  set tableSearchValue( value: string ) {
    this.search = value;
    this.searchChange.emit( this.search );
  }

  get tableIsReload(): boolean {
    return this.isReload;
  }
  set tableIsReload( value: boolean ) {
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
  }

  get tableLimit(): number {
    return this.limit;
  }
  set tableLimit( value: number ) {
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

  protected handleSwitchChange(
    isActive: SwitchButtonType[ 'isActive' ],
    input: SwitchButtonType[ 'data' ],
    index: number,
  ): void {
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
      this.universalCompare( a[ sort.active ], b[ sort.active ], isAsc ),
    );
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

  protected imageGenerator(
    element: any,
    type: string,
    gender?: string,
  ): string {
    const image = this.resolveImageField( element );
    const safeType: string = ( type || '' ).toLowerCase().trim();
    const safeImage: string = typeof image === 'string' ? image.trim() : '';

    switch ( safeType ) {
      case 'userimage': {
        if ( safeImage ) {
          const dotIndex: number = safeImage.lastIndexOf( '.' );
          if ( dotIndex > 0 && dotIndex < safeImage.length - 1 ) {
            return safeImage;
          }
        }

        const safeGender: string = ( gender || '' ).toLowerCase().trim();

        if ( safeGender === 'male' ) {
          return this.definedMaleDummyImageURL;
        }
        if ( safeGender === 'female' ) {
          return this.definedWomanDummyImageURL;
        }

        return this.definedImage;
      }

      case 'propertyimage':
      case 'image': {
        return safeImage || this.definedImage;
      }

      default: {
        return this.definedImage;
      }
    }
  }

  private resolveImageField( record: any ): string | undefined {
    if ( !record || typeof record !== 'object' ) return undefined;

    const normalize = ( k: string ): string =>
      k.toLowerCase().replace( /[^a-z]/g, '' );

    const accepted = [
      'image',
      'userimage',
      'propertyimage',
      'profileimage',
      'avatar',
      'img',
      'photo',
    ];

    for ( const key of Object.keys( record ) ) {
      const norm = normalize( key );
      if ( accepted.some( ( token: string ) => norm.includes( token ) ) ) {
        return record[ key ];
      }
    }

    return undefined;
  }

  // ─────────────────────────────────────────────────────────────
  // Date input helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Convert any date-like value (Date | string | number) to
   * 'yyyy-MM-dd' for <input type="date">.
   */
  protected toDateInputValue( value: any ): string | null {
    if ( !value ) return null;

    const date: Date = value instanceof Date ? value : new Date( value );
    if ( isNaN( date.getTime() ) ) return null;

    const yyyy = date.getFullYear();
    const mm = String( date.getMonth() + 1 ).padStart( 2, '0' );
    const dd = String( date.getDate() ).padStart( 2, '0' );

    return `${ yyyy }-${ mm }-${ dd }`;
  }

  /**
   * Convert any date-like value to 'yyyy-MM-ddTHH:mm'
   * for <input type="datetime-local">.
   */
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

  protected trimText( text: any ): string {
    try {
      const stringValue: string =
        typeof text === 'string' ? text.trim() : JSON.stringify( text ).trim();

      const parsed: any = JSON.parse( stringValue );

      if ( Array.isArray( parsed ) ) {
        if ( parsed.length === 0 ) {
          return '';
        }

        const allObjects: boolean = parsed.every(
          ( item: any ) => item !== null && typeof item === 'object',
        );

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

      if ( this.isDateValue( parsed ) ) {
        return this.formatCustomDate( parsed );
      }

      const plain: string = String( parsed ?? '' ).trim();
      return plain.length > 30 ? `${ plain.slice( 0, 30 ) }...` : plain;
    }
    catch {
      const safeText: string = String( text ?? '' ).trim();
      return safeText.length > 30 ? `${ safeText.slice( 0, 30 ) }...` : safeText;
    }
  }

  private buildKeyValueLinesFromObject( input: any ): string {
    if ( !input || typeof input !== 'object' ) {
      return '';
    }

    return Object.entries( input )
      .map( ( [ key, value ] ) => {
        if ( key.includes( '_' ) ) {
          return '';
        }

        if ( typeof value === 'boolean' ) {
          return `${ this.makeCapitalize( key ) } : ${ this.booleanCircle( value ) }`;
        }

        if (
          ( typeof value === 'string' || typeof value === 'number' ) &&
          this.isDateValue( value )
        ) {
          return `${ this.makeCapitalize( key ) } : ${ this.formatCustomDate( value ) }`;
        }

        return `${ this.makeCapitalize( key ) } : ${ this.makeCapitalize( value ) }`;
      } )
      .filter( ( line: string ) => !!line )
      .join( '<br>' );
  }

  private isDateValue( value: any ): boolean {
    if ( value === null || value === undefined ) {
      return false;
    }

    if ( value instanceof Date && !isNaN( value.getTime() ) ) {
      return true;
    }

    if ( typeof value === 'number' ) {
      if ( !Number.isFinite( value ) ) return false;
      const dateFromNumber: Date = new Date( value );
      return !isNaN( dateFromNumber.getTime() );
    }

    if ( typeof value !== 'string' ) {
      return false;
    }

    const trimmed: string = value.trim();
    if ( !trimmed ) return false;

    const isoLike: RegExp =
      /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

    const ymdSlash: RegExp =
      /^\d{4}\/\d{2}\/\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;

    const dmySlash: RegExp =
      /^\d{2}\/\d{2}\/\d{4}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;

    if (
      !isoLike.test( trimmed ) &&
      !ymdSlash.test( trimmed ) &&
      !dmySlash.test( trimmed )
    ) {
      return false;
    }

    const parsedDate: Date = new Date( trimmed );
    return !isNaN( parsedDate.getTime() );
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
    return value
      ? '<span class="bool-circle bool-true"></span>'
      : '<span class="bool-circle bool-false"></span>';
  }

  protected makeCapitalize( text: any ): string {
    const stringValue: string =
      typeof text === 'string' ? text : String( text ?? '' ).trim();

    if ( !this.isBrowser ) {
      return stringValue
        .split( ' ' )
        .map( ( word: string ) =>
          word ? word.charAt( 0 ).toUpperCase() + word.slice( 1 ) : '',
        )
        .join( ' ' );
    }

    const parser: DOMParser = new DOMParser();
    const doc: Document = parser.parseFromString(
      `<div>${ stringValue }</div>`,
      'text/html',
    );
    const container: HTMLElement = doc.body.firstChild as HTMLElement;

    const capitalizeTextNodes = ( node: Node ): void => {
      if ( node.nodeType === Node.TEXT_NODE ) {
        const originalText: string = node.nodeValue || '';
        node.nodeValue = originalText
          .split( ' ' )
          .map( ( word: string ) =>
            word ? word.charAt( 0 ).toUpperCase() + word.slice( 1 ) : '',
          )
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
      if ( !Array.isArray( this.data ) ) {
        throw new Error( 'Data is not type of array' );
      }
      const payload: FileExport = {
        extention,
        data: this.data,
      };
      this.fileExport.emit( payload );
    }
    catch ( error ) {
      console.error( '[File exporting error]: ', error );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Button click → emit to parent
  // ─────────────────────────────────────────────────────────────

  protected handleButtonOperations(
    action: TableButton[ 'action' ],
    data: any,
  ): void {
    try {
      if ( typeof action !== 'string' || !action ) {
        throw new Error( 'Button ID is invalid!' );
      }
      const assemble: TableButtonActionConfig = {
        action,
        data,
      };
      this.buttonOperation.emit( assemble );
    }
    catch ( err ) {
      console.error(
        '[Table action button error]' + `Action: ${ action }`,
        ' Error: ',
        err,
      );
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
    const hasTotalCount: boolean =
      typeof this.totalDataCount === 'number' && this.totalDataCount > 0;

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
        mime ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mime ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.template' ||
        mime === 'application/rtf'
      ) {
        return 'docx';
      }

      if (
        mime === 'application/vnd.ms-excel' ||
        mime ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mime ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.template' ||
        mime === 'text/csv'
      ) {
        return 'xlsx';
      }

      if (
        mime === 'application/vnd.ms-powerpoint' ||
        mime ===
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        mime ===
        'application/vnd.openxmlformats-officedocument.presentationml.template'
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
}
