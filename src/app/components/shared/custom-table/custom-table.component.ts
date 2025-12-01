// Path: src/app/components/shared/custom-table/custom-table.component.ts

// ──────────────────────────────────────────────────────────────────────────────
// Angular & Common
// ──────────────────────────────────────────────────────────────────────────────
import { CommonModule, isPlatformBrowser } from '@angular/common';
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
} from '@angular/core';

// ──────────────────────────────────────────────────────────────────────────────
// Angular Material
// ──────────────────────────────────────────────────────────────────────────────
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

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

// ──────────────────────────────────────────────────────────────────────────────
// Re-exports for consumers
// ──────────────────────────────────────────────────────────────────────────────
export type TableExtension = Extension;
export type TableDateRange = DateRange;

// ──────────────────────────────────────────────────────────────────────────────
// File icon types + mapping (for Material icons)
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
 * - action: emitted up to the parent when clicked
 * - icon: Material icon name
 * - label: tooltip / visible label
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
// Columns / events / switch types
// ──────────────────────────────────────────────────────────────────────────────

/** Column descriptor for dynamic tables */
export interface TableColumn {
  /** Must match a key on each row object */
  key: string;
  /** Header text */
  label: string;
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

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

@Component( {
  selector: 'app-custom-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatTooltipModule,
    MatIconModule,
    SkeletonLoaderComponent,
    PaginatorComponent,
    SwitchButton,
  ],
  templateUrl: './custom-table.component.html',
  styleUrls: [ './custom-table.component.scss' ],
} )
export class CustomTableComponent
  implements OnInit, AfterViewInit, OnDestroy, OnChanges {

  // ─────────────────────────────────────────────────────────────
  // @Inputs / @Outputs - Public API for parents
  // ─────────────────────────────────────────────────────────────

  /** Total number of records (for pagination) */
  @Input( { required: true } ) totalDataCount = 0;

  /** Row data array (any object shape, see columns) */
  @Input( { required: true } ) data: any[] = [];

  /** Columns configuration (key + label) */
  @Input( { required: true } ) columns: TableColumn[] = [];

  /** Enable/disable paginator row */
  @Input( { required: true } ) pagination = false;

  /** Page size (bound to paginator) */
  @Input( { required: true } ) limit = 2;
  @Output() limitChange: EventEmitter<number> = new EventEmitter<number>();

  /** Page index (bound to paginator) */
  @Input( { required: true } ) index = 0;
  @Output() indexChange: EventEmitter<number> = new EventEmitter<number>();

  /** Table heading text */
  @Input( { required: true } ) tableTitle = '';

  /** Search text (from parent) */
  @Input() search = '';
  @Output() searchChange: EventEmitter<string> = new EventEmitter<string>();

  /** Reload flag (used to reset filters + refetch) */
  @Input( { required: true } ) isReload = false;
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
  protected canShowActionForRow: Map<string, boolean> = new Map();
  protected canShowOperationForRow: Map<string, boolean> = new Map();

  /**
   * Map of "button-like" column keys (viewButton, actionBtn, etc.)
   * → resolved TableButton config.
   */
  protected buttonColumns: Map<string, TableButton> =
    new Map<string, TableButton>();

  // Retry logic for "wait for parent API"
  private fetchAttempts = 0;
  private readonly maxFetchAttempts = 3;
  private readonly fetchRetryDelayMs = 400;
  private fetchRetryTimerId: ReturnType<typeof setTimeout> | null = null;

  // ─────────────────────────────────────────────────────────────
  // DI & Constructor
  // ─────────────────────────────────────────────────────────────

  public constructor (
    private readonly authService: AuthService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    // Keep ImageService injected for potential future usage (e.g. offline caching)
    private readonly imageService: ImageService,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.loggedUser = this.authService.getLoggedUser ?? null;
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  public async ngOnInit(): Promise<void> {
    this.isArrayOfData = Array.isArray( this.data ) && this.data.length > 0;
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

    // Data changed → refresh MatTable
    if ( changes[ 'data' ] ) {
      const rows: any[] = Array.isArray( this.data ) ? this.data : [];
      this.dataCount = rows.length;
      this.dataSource.data = [ ...rows ];
      this.isArrayOfData = rows.length > 0;
      dataChanged = true;
    }

    // Columns changed → normalize + detect button columns
    if ( changes[ 'columns' ] ) {
      this.normalizeColumnsAndDetectButtons();
    }

    // Total or data changed → check if we need to trigger fetch
    if ( changes[ 'totalDataCount' ] || dataChanged ) {
      // Use microtask to avoid ExpressionChangedAfterItHasBeenCheckedError
      Promise.resolve().then( () => this.scheduleDataFetchIfNeeded() );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Column / button column normalization
  // ─────────────────────────────────────────────────────────────

  /**
   * Cleans up the columns array:
   *  - removes duplicates
   *  - strips empty keys
   *  - sets displayedColumnKeys
   *  - detects "button-like" columns (viewButton, actionBtn, etc.)
   */
  private normalizeColumnsAndDetectButtons(): void {
    this.buttonColumns.clear();

    const rawColumns: TableColumn[] = Array.isArray( this.columns )
      ? this.columns
      : [];
    const normalized: TableColumn[] = [];
    const seenKeys: Set<string> = new Set<string>();

    // 1) Deduplicate + ignore invalid keys
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

    // Track if there is a "status" column for CSS helpers
    this.tableStatus =
      (
        normalized.find(
          ( c: TableColumn ) => c.key.toLowerCase() === 'status',
        )?.key || ''
      ).toLowerCase();

    // 2) Detect button-like columns and build per-column button configs
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

        // Allow parent override if provided
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

  /** True if the column is a button-type column */
  protected isButtonColumn( columnKey: string ): boolean {
    const keyLower: string = ( columnKey || '' ).trim().toLowerCase();
    return this.buttonColumns.has( keyLower );
  }

  /** Get the configured button for a given button column */
  protected getButtonForColumn( columnKey: string ): TableButton | null {
    const keyLower: string = ( columnKey || '' ).trim().toLowerCase();
    return this.buttonColumns.get( keyLower ) ?? null;
  }

  /** Find a button configuration (if parent provided it) for a given ActionId */
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
  // Status / style helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Normalizes status text into CSS class name:
   *  e.g. "In Progress" → "main-category in_progress"
   */
  protected statusClass( status: string | null | undefined ): string {
    const norm: string = String( status ?? '' )
      .trim()
      .toLowerCase()
      .replace( /\s+/g, '_' );

    if ( !norm ) return 'main-category';
    return `main-category ${ norm }`;
  }

  // ─────────────────────────────────────────────────────────────
  // Button helpers (derive action from column name, labels, bg color)
  // ─────────────────────────────────────────────────────────────

  /** Derive an ActionId from a button column's key / label */
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

  /** Default label from action name ("view" → "View") */
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
  // Paginator bindings (bridge between paginator component & parent)
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

    // Reset filters to "clean" state
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

  // Toolbar → export click handler
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

  /** MatSort handler used by template */
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

  /** Universal comparator for numbers / strings / nulls */
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

  /**
   * Image generator:
   *  - resolves most likely image field on the row object (element)
   *  - falls back to dummy user / generic image if needed
   *
   * Usage from template:
   *   <img
   *     [src]="imageGenerator(row, 'userimage', row.gender)"
   *     class="table-user-image"
   *   />
   */
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
        // If we actually have a non-empty string, just use it
        if ( safeImage ) {
          // simple "looks like a filename with extension" check
          const dotIndex: number = safeImage.lastIndexOf( '.' );
          if ( dotIndex > 0 && dotIndex < safeImage.length - 1 ) {
            return safeImage;
          }
        }

        // No valid image → choose dummy by gender
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
        // For generic images, if we have something, use it; else fallback
        return safeImage || this.definedImage;
      }

      default: {
        // Unknown type → generic fallback
        return this.definedImage;
      }
    }
  }

  /**
   * Resolve the most appropriate image field on a row object.
   * Works case-insensitively and ignores underscores, dashes etc.
   * Example matches:
   *  - "image", "Image", "imageUrl"
   *  - "user_image", "UserImage", "USER_IMAGE_URL"
   *  - "propertyImage", "profile_image", "avatar", "photo", etc.
   */
  private resolveImageField( record: any ): string | undefined {
    if ( !record || typeof record !== 'object' ) return undefined;

    // Normalize key like "USER_IMAGE_URL" → "userimageurl"
    const normalize = ( k: string ): string =>
      k.toLowerCase().replace( /[^a-z]/g, '' );

    // Accept these "tokens" inside the normalized key
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
  // Formatting helpers (dates, booleans, capitalization)
  // ─────────────────────────────────────────────────────────────

  /** Formats date range into "12th of March 2025 to 13th of March 2025" */
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

  /**
   * Smart text formatter:
   *  - if JSON representing object → builds lines "Key : Value"
   *  - boolean values → colored circles
   *  - date-like values → formatted as YYYY/MM/DD – hh:mm AM/PM
   *  - otherwise → string with max length 30 (…)
   *
   * Intended for use with [innerHTML] in cell templates.
   */
  protected trimText( text: any ): string {
    try {
      const stringValue: string =
        typeof text === 'string' ? text.trim() : JSON.stringify( text ).trim();

      const parsed: any = JSON.parse( stringValue );

      // 1) Object handling
      if ( typeof parsed === 'object' && parsed !== null ) {
        return Object.entries( parsed )
          .map( ( [ key, value ] ) => {
            if ( key.includes( '_' ) ) return '';

            // Boolean → colored circle
            if ( typeof value === 'boolean' ) {
              return `${ this.makeCapitalize( key ) } : ${ this.booleanCircle( value ) }`;
            }

            // Date → formatted (only on primitive values)
            if ( ( typeof value === 'string' || typeof value === 'number' ) && this.isDateValue( value ) ) {
              return `${ this.makeCapitalize( key ) } : ${ this.formatCustomDate( value ) }`;
            }

            return `${ this.makeCapitalize( key ) } : ${ this.makeCapitalize(
              value,
            ) }`;
          } )
          .filter( Boolean )
          .join( '<br>' );
      }

      // 2) Single boolean handling
      if ( typeof parsed === 'boolean' ) {
        return this.booleanCircle( parsed );
      }

      // 3) Single date string handling
      if ( this.isDateValue( parsed ) ) {
        return this.formatCustomDate( parsed );
      }

      return String( parsed );
    } catch {
      const safeText: string = String( text ?? '' ).trim();
      return safeText.length > 30 ? safeText.slice( 0, 30 ) + '...' : safeText;
    }
  }

  /** Detect whether a value is a valid date or date-like string */
  /** Detect whether a value is a valid *pure* date or date-time string/number */
  private isDateValue( value: any ): boolean {
    if ( value === null || value === undefined ) {
      return false;
    }

    // Already a Date instance
    if ( value instanceof Date && !isNaN( value.getTime() ) ) {
      return true;
    }

    // Numeric timestamp (ms since epoch)
    if ( typeof value === 'number' ) {
      if ( !Number.isFinite( value ) ) return false;
      const dateFromNumber: Date = new Date( value );
      return !isNaN( dateFromNumber.getTime() );
    }

    // Only strings beyond this point
    if ( typeof value !== 'string' ) {
      return false;
    }

    const trimmed: string = value.trim();
    if ( !trimmed ) return false;

    // ───────────────────────────────────────────────────────────────
    // Strict patterns: the *entire* string must look like a date.
    // This prevents "12/05/2024 Colombo" from being treated as a date.
    // ───────────────────────────────────────────────────────────────

    // ISO-like: 2025-11-30 or 2025-11-30T12:34:56Z
    const isoLike: RegExp =
      /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

    // 2025/11/30 or 2025/11/30 12:34
    const ymdSlash: RegExp =
      /^\d{4}\/\d{2}\/\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;

    // 30/11/2025 or 30/11/2025 12:34
    const dmySlash: RegExp =
      /^\d{2}\/\d{2}\/\d{4}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;

    // If it doesn’t *exactly* match one of these, it is NOT a date.
    if (
      !isoLike.test( trimmed ) &&
      !ymdSlash.test( trimmed ) &&
      !dmySlash.test( trimmed )
    ) {
      return false;
    }

    // Final safety: actually try constructing the Date
    const parsedDate: Date = new Date( trimmed );
    return !isNaN( parsedDate.getTime() );
  }


  /** Format date into "YYYY/MM/DD – hh:mm AM/PM" */
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
    if ( hours === 0 ) hours = 12; // midnight/noon case

    const hh = String( hours ).padStart( 2, '0' );

    return `${ yyyy }/${ mm }/${ dd } – ${ hh }:${ minutes } ${ ampm }`;
  }

  /** Returns HTML span for boolean circle (styled via SCSS) */
  private booleanCircle( value: boolean ): string {
    return value
      ? `<span class="bool-circle bool-true"></span>`
      : `<span class="bool-circle bool-false"></span>`;
  }

  /**
   * Capitalize every word, preserving inline HTML.
   * Uses DOMParser only in browser. On SSR, falls back to simple capitalization.
   */
  protected makeCapitalize( text: any ): string {
    const stringValue: string =
      typeof text === 'string' ? text : String( text ?? '' ).trim();

    // SSR / non-browser safe: simple capitalization
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
    } catch ( error ) {
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
    } catch ( err ) {
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

  /** Reset retry count + clear any pending timer */
  private resetFetchAttempts(): void {
    this.fetchAttempts = 0;

    if ( this.fetchRetryTimerId !== null ) {
      clearTimeout( this.fetchRetryTimerId );
      this.fetchRetryTimerId = null;
    }
  }

  /** Small helper to check if we currently have any rows */
  private hasTableData(): boolean {
    return Array.isArray( this.data ) && this.data.length > 0;
  }

  /**
   * Core retry logic:
   *  - if we already have rows or total count → show table and stop
   *  - else try up to maxFetchAttempts to ask parent for data
   *  - after each attempt, wait fetchRetryDelayMs and re-check
   *
   * This supports patterns where the parent does async HTTP and
   * fills [data] + [totalDataCount] later.
   */
  private scheduleDataFetchIfNeeded(): void {
    const hasRows: boolean = this.hasTableData();
    const hasTotalCount: boolean =
      typeof this.totalDataCount === 'number' && this.totalDataCount > 0;

    // Case 1: we already have some data or a count → show table, stop retrying
    if ( hasRows || hasTotalCount ) {
      this.isArrayOfData = hasRows;
      this.isTableVisible = true;
      this.resetFetchAttempts();
      return;
    }

    // Case 2: no data and we have exhausted retries → mark as empty state
    if ( this.fetchAttempts >= this.maxFetchAttempts ) {
      this.isArrayOfData = false;
      this.isTableVisible = true;
      return;
    }

    // Case 3: no data yet, but still have attempts left → trigger one attempt
    this.fetchAttempts += 1;

    // Ask parent to fetch data (1 attempt) – microtask to avoid CD clashes
    Promise.resolve().then( () => this.fetchData.emit() );

    // While waiting, hide the table body if desired
    this.isArrayOfData = false;
    this.isTableVisible = false;

    // Clear previous timer (avoid stacking)
    if ( this.fetchRetryTimerId !== null ) {
      clearTimeout( this.fetchRetryTimerId );
      this.fetchRetryTimerId = null;
    }

    // After a delay, re-run the logic.
    this.fetchRetryTimerId = setTimeout( (): void => {
      this.scheduleDataFetchIfNeeded();
    }, this.fetchRetryDelayMs );
  }

  // ─────────────────────────────────────────────────────────────
  // MIME / extension → icon mapping
  // ─────────────────────────────────────────────────────────────

  /**
   * Normalize MIME type or extension/filename into an Extension enum value.
   *  - "application/pdf" → "pdf"
   *  - "image/png"       → "png"
   *  - "report.docx"     → "docx"
   *  - unknown           → "file"
   */
  private mapMimeOrExtToExtension( type: string | undefined | null ): Extension {
    if ( !type ) return 'file';

    const lower = type.toLowerCase().trim();

    // 1) MIME type (contains "/")
    if ( lower.includes( '/' ) ) {
      const mime = lower;

      // Images
      if ( mime.startsWith( 'image/' ) ) return 'png';

      // PDF
      if ( mime === 'application/pdf' ) return 'pdf';

      // ZIP
      if (
        mime === 'application/zip' ||
        mime === 'application/x-zip-compressed' ||
        mime === 'application/x-7z-compressed'
      ) {
        return 'zip';
      }

      // Word
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

      // Excel
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

      // PowerPoint
      if (
        mime === 'application/vnd.ms-powerpoint' ||
        mime ===
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        mime ===
        'application/vnd.openxmlformats-officedocument.presentationml.template'
      ) {
        return 'pptx';
      }

      // Text
      if ( mime === 'text/plain' ) return 'txt';

      // XML
      if ( mime === 'text/xml' || mime === 'application/xml' ) return 'xml';

      // Fallback
      return 'file';
    }

    // 2) Otherwise treat as extension or filename
    const parts = lower.split( '.' );
    const extOnly = ( parts.length > 1 ? parts.pop() : parts[ 0 ] ) || 'file';
    return extOnly as Extension;
  }

  /** Top-level helper used by template to choose Material icon */
  protected chooseIcon( type: string | undefined | null ): MaterialFileIcon {
    const ext = this.mapMimeOrExtToExtension( type );
    return EXTENSION_ICON_MAP[ ext ] ?? 'insert_drive_file';
  }
}
