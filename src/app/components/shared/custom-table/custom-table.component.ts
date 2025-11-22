// Path: src/app/components/shared/custom-table/custom-table.component.ts
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

import { MatIconModule } from '@angular/material/icon';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { User } from '../../../services/APIs/apis.service';
import { AuthService } from '../../../services/auth/auth.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';

import { SwitchButton } from '../../../components/shared/buttons/switch-button/switch-button.component';
import { type Extension, PaginatorComponent, DateRange } from '../paginator/paginator.component';
import { SkeletonLoaderComponent } from '../skeleton-loader/skeleton-loader.component';

/* ──────────────────────────────────────────────────────────────────
   1) Action / icon types + mapping
   ────────────────────────────────────────────────────────────────── */

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
 * Per-button config used in the table:
 * - action: emitted to parent (e.g. 'view', 'download')
 * - icon: material icon name
 * - label: human-readable (tooltip, optional text)
 */
export interface TableButton {
  action: ActionId;
  icon: ActionIcon;
  label?: string;
  disabled?: boolean;
}

/** Payload emitted when a button is clicked in any row */
export interface TableButtonActionConfig {
  action: ActionId;
  data: any;
}

/* ──────────────────────────────────────────────────────────────────
   2) Column / file export / events / switch types
   ────────────────────────────────────────────────────────────────── */

/** Column descriptor for dynamic tables */
export interface TableColumn {
  key: string;   // must match a key on each row object
  label: string; // header text
}

/** File export payload bubbled to parent */
export interface FileExport {
  data: any[];
  extention: Extension;
}

export type fileExt = Extension;

/** Normalized event types (currently unused, but kept for future extension) */
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

/** Optional per-row visibility predicates for action/operation buttons (not wired yet) */
export interface ButtonVisibility {
  action?: ( row: any ) => boolean;
  operation?: ( row: any ) => boolean;
}

/** Switch button (toggle) value contract */
export interface SwitchButtonType {
  isActive: boolean;
  index: number | null;
  on?: string;
  off?: string;
  data?: any;
}


/* ──────────────────────────────────────────────────────────────────
   3) Component
   ────────────────────────────────────────────────────────────────── */

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
export class CustomTableComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  // ─────────────────────────────────────────────────────────────
  // Inputs from parent (think of these as "props")
  // ─────────────────────────────────────────────────────────────

  @Input( { required: true } ) totalDataCount = 0;
  @Input( { required: true } ) data: any[] = [];
  @Input( { required: true } ) columns: TableColumn[] = [];

  @Input( { required: true } ) pagination = false;

  @Input( { required: true } ) pageSize = 2;
  @Output() pageSizeChange: EventEmitter<number> = new EventEmitter<number>();

  @Input() pageSizeOptions: number[] = [];

  @Input( { required: true } ) index = 0;
  @Output() indexChange: EventEmitter<number> = new EventEmitter<number>();

  @Input() tableTitle = '';

  @Input() search!: string;
  @Output() searchChange: EventEmitter<string> = new EventEmitter<string>();

  @Input() isReload: boolean = false;
  @Output() isReloadChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  @Input() fileExportExtention!: Extension;
  @Output() fileExport: EventEmitter<FileExport> = new EventEmitter<FileExport>();

  @Input() isDateRageActive: boolean = false;
  @Input() dateRange!: DateRange;
  @Output() dateRangeChange: EventEmitter<DateRange> = new EventEmitter<DateRange>();
  @Output() rangeChange: EventEmitter<DateRange> = new EventEmitter<DateRange>();

  /**
   * Optional explicit button configs from parent.
   * These are used:
   * - for a generic 'buttons' column (multi-button)
   * - OR to override auto-detected button configs per action
   */
  @Input() buttons!: TableButton[];
  @Output() buttonOperation: EventEmitter<TableButtonActionConfig> =
    new EventEmitter<TableButtonActionConfig>();

  @Input() switch!: SwitchButtonType;
  @Output() switchChange: EventEmitter<SwitchButtonType> =
    new EventEmitter<SwitchButtonType>();




  // Ask parent to fetch data (table-driven loading)
  @Output() fetchData: EventEmitter<void> = new EventEmitter<void>();



  // ─────────────────────────────────────────────────────────────
  // Internal state used by the table
  // ─────────────────────────────────────────────────────────────

  private isBrowser!: boolean;
  protected loggedUser!: User | null;

  /** Keys used by MatTable for header/row defs */
  protected displayedColumnKeys: string[] = [];

  /** DataSource wrapper used by MatTable */
  protected dataSource: MatTableDataSource<any> = new MatTableDataSource<any>();

  protected tableButtonAction = '';
  protected tableButtonOperation = '';
  protected tableStatus = '';
  protected isTableVisible = true;
  protected dataCount = 0;
  protected isArrayOfData = false;

  // Default images used as fallbacks
  protected readonly definedMaleDummyImageURL = 'Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL = 'Images/user-images/dummy-user/dummy_woman.jpg';
  protected definedImage = 'Images/System-images/noImage.jpeg';

  // Cached per-row visibilities (not used yet, but kept)
  protected canShowActionForRow: Map<string, boolean> = new Map();
  protected canShowOperationForRow: Map<string, boolean> = new Map();

  /**
   * Map of "button-like" column keys → button config.
   * Example:
   *  - column key "viewButton"  → action "view", icon "visibility", label "View" (or column label)
   *  - column key "downloadBtn" → action "download", icon "download", label "Download"
   *
   * The key is stored in lowercase for easy lookup.
   */
  protected buttonColumns: Map<string, TableButton> = new Map<string, TableButton>();

  // Retry logic for "wait for API"
  private fetchAttempts = 0;
  private readonly maxFetchAttempts = 3;
  private readonly fetchRetryDelayMs = 400;
  private fetchRetryTimerId: ReturnType<typeof setTimeout> | null = null;

  // ─────────────────────────────────────────────────────────────
  // Dependency Injection
  // ─────────────────────────────────────────────────────────────

  public constructor (
    private readonly windowRef: WindowsRefService,
    private readonly authService: AuthService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.loggedUser = this.authService.getLoggedUser ?? null;
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  public async ngOnInit(): Promise<void> {
    // Simple flag to show "no data" state
    this.isArrayOfData = Array.isArray( this.data ) && this.data.length > 0;

    // On first init, decide whether we need to ask parent for data
    this.scheduleDataFetchIfNeeded();
  }

  public ngAfterViewInit(): void {
    // Reserved for future logic (e.g. tie skeletons to isReload more tightly)
  }

  public ngOnDestroy(): void {
    // No subscriptions yet; placeholder for future cleanup
    this.resetFetchAttempts();
  }

  public ngOnChanges( changes: SimpleChanges ): void {
    let dataChanged = false;

    // When data changes → refresh MatTable source
    if ( changes[ 'data' ] ) {
      const rows: any[] = Array.isArray( this.data ) ? this.data : [];
      this.dataCount = rows.length;
      this.dataSource.data = [ ...rows ];
      this.isArrayOfData = rows.length > 0;
      dataChanged = true;
    }

    // When columns change → normalize keys and detect button columns
    if ( changes[ 'columns' ] ) {
      this.normalizeColumnsAndDetectButtons();
    }

    // When total count or data changes → drive retry / visibility logic
    if ( changes[ 'totalDataCount' ] || dataChanged ) {
      // Use microtask to avoid ExpressionChanged errors
      setTimeout( (): void => {
        this.scheduleDataFetchIfNeeded();
      }, 0 );
    }
  }


  // ─────────────────────────────────────────────────────────────
  // Column / button column normalization
  // ─────────────────────────────────────────────────────────────

  /**
   * Normalizes columns:
   *  - removes empty/duplicate keys (prevents MatTable duplicate column error)
   *  - rebuilds displayedColumnKeys
   *  - detects "button columns" by key (viewButton, downloadBtn, approve_button, etc.)
   *  - for each button column, builds a TableButton config (action, icon, label)
   */
  private normalizeColumnsAndDetectButtons(): void {
    this.buttonColumns.clear();

    const rawColumns: TableColumn[] = Array.isArray( this.columns ) ? this.columns : [];
    const normalized: TableColumn[] = [];
    const seenKeys: Set<string> = new Set<string>();

    // 1) Deduplicate + ignore invalid keys
    for ( const col of rawColumns ) {
      const key: string = ( col.key || '' ).trim();
      if ( !key ) {
        continue;
      }
      if ( seenKeys.has( key ) ) {
        console.warn( '[CustomTable] Dropping duplicate column key:', key );
        continue;
      }
      seenKeys.add( key );
      normalized.push( col );
    }

    // Store normalized columns back
    this.columns = normalized;
    this.displayedColumnKeys = normalized.map( ( c: TableColumn ) => c.key );

    // Track if there's a 'status' column (for CSS helpers)
    this.tableStatus =
      ( normalized.find( ( c: TableColumn ) => c.key.toLowerCase() === 'status' )?.key || '' )
        .toLowerCase();

    // 2) Detect button-like columns and build per-column button configs
    for ( const col of normalized ) {
      const keyRaw: string = ( col.key || '' ).trim();
      if ( !keyRaw ) {
        continue;
      }

      const keyLower: string = keyRaw.toLowerCase();

      // A "button column" is defined as any column whose key contains 'btn', 'button', or 'buttons'
      if (
        keyLower.includes( 'btn' ) ||
        keyLower.includes( 'button' ) ||
        keyLower.includes( 'buttons' )
      ) {
        const action: ActionId | null = this.deriveActionFromColumn( col );
        if ( !action ) {
          // If we can't derive a known action from the key/label, skip it silently
          console.warn( '[CustomTable] Could not derive action from button column:', col );
          continue;
        }

        // If parent provided explicit buttons, try to match by action first
        const override: TableButton | null = this.findButtonConfig( action );

        const label: string =
          col.label || override?.label || this.buildButtonLabelFromAction( action );

        const icon: ActionIcon = override?.icon || ACTION_ICONS[ action ];

        const buttonConfig: TableButton = {
          action,
          icon,
          label,
        };

        this.buttonColumns.set( keyLower, buttonConfig );
      }
    }
  }

  /** Returns true if a given column key is detected as a button column. */
  protected isButtonColumn( columnKey: string ): boolean {
    const keyLower: string = ( columnKey || '' ).trim().toLowerCase();
    return this.buttonColumns.has( keyLower );
  }

  /**
   * Returns the TableButton config for a given column key (if it is a button column),
   * otherwise null.
   */
  protected getButtonForColumn( columnKey: string ): TableButton | null {
    const keyLower: string = ( columnKey || '' ).trim().toLowerCase();
    return this.buttonColumns.get( keyLower ) ?? null;
  }

  /**
   * Searches in explicitly provided [buttons] input for a given action.
   * Used to override auto detection (icon/label) when parent wants full control.
   */
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
   * Normalizes any status string to a CSS-friendly class and returns:
   *  "main-category <normalized>"
   * - lowercases
   * - trims
   * - replaces spaces with underscores (so 'under review' -> 'under_review')
   * - leaves complaint statuses like 'in_progress' as-is
   */
  protected statusClass( status: string | null | undefined ): string {
    const norm: string = String( status ?? '' )
      .trim()
      .toLowerCase()
      .replace( /\s+/g, '_' );

    if ( !norm ) {
      return 'main-category';
    }
    return `main-category ${ norm }`;
  }

  // ─────────────────────────────────────────────────────────────
  // Button helpers (action derive, labels, BG color)
  // ─────────────────────────────────────────────────────────────

  /**
   * Derives an ActionId from a column definition using its key/label.
   * Examples:
   *  - key 'viewBtn'       → 'view'
   *  - key 'download_btn'  → 'download'
   *  - label 'Approve'     → 'approve'
   */
  private deriveActionFromColumn( col: TableColumn ): ActionId | null {
    const rawSource: string =
      ( col.key || col.label || '' ).toString().toLowerCase().trim();

    let cleaned: string = rawSource
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

  /** Simple TitleCase label generator based on the action id. */
  private buildButtonLabelFromAction( action: ActionId ): string {
    const text: string = action.toString();
    return text.charAt( 0 ).toUpperCase() + text.slice( 1 );
  }

  // Background color helpers (Bootstrap-style btn classes)
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
    this.index = value;
    this.indexChange.emit( this.index );
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
    this.searchChange.emit( this.search );
    this.isReloadChange.emit( this.isReload );
  }

  get tablePageSize(): number {
    return this.pageSize;
  }
  set tablePageSize( value: number ) {
    this.pageSize = value;
    this.pageSizeChange.emit( this.pageSize );
  }

  protected onDateRangeChange( dateRange: DateRange ): void {
    this.dateRange = dateRange;
    this.dateRangeChange.emit( this.dateRange );
  }

  protected onRangeChange( dataRange: DateRange ): void {
    this.rangeChange.emit( dataRange );
  }



  // Toolbar: export
  protected handleFileExport( extention: Extension, data: any ): void {
    // NOTE: you already have fileExportHandle below doing the real work
    this.fileExport.emit();
  }

  // Row toggle
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

  protected imageGenerator( image: string, type: string, gender?: string ): string {
    switch ( type.toLowerCase().trim() ) {
      case 'userimage': {
        const imagetype: string | undefined = image.split( '.' )[ 1 ];
        if ( imagetype ) return image;
        if ( gender?.toLowerCase() === 'male' ) return this.definedMaleDummyImageURL;
        if ( gender?.toLowerCase() === 'female' ) return this.definedWomanDummyImageURL;
        return this.definedImage;
      }
      case 'propertyimage':
      case 'image':
        return image;
      default:
        return this.definedImage;
    }
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
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  /** Pretty-print JSON or trim plain text safely */
  protected trimText( text: any ): string {
    try {
      const stringValue: string =
        typeof text === 'string' ? text.trim() : JSON.stringify( text ).trim();
      const parsed: any = JSON.parse( stringValue );
      if ( typeof parsed === 'object' && parsed !== null ) {
        return Object.entries( parsed )
          .map( ( [ key, value ] ) => ( key.includes( '_' ) ? '' : `${ key } : ${ value }` ) )
          .filter( Boolean )
          .join( '<br>' );
      }
      return String( parsed );
    } catch {
      const safeText: string = String( text ?? '' ).trim();
      return safeText.length > 30 ? safeText.slice( 0, 30 ) + '...' : safeText;
    }
  }

  /**
   * Capitalize every word, preserving inline HTML.
   * Uses DOMParser (browser-only).
   */
  protected makeCapitalize( text: any ): string {
    const stringValue: string =
      typeof text === 'string' ? text : String( text ?? '' ).trim();

    const parser: DOMParser = new DOMParser();
    const doc: Document = parser.parseFromString( `<div>${ stringValue }</div>`, 'text/html' );
    const container: HTMLElement = doc.body.firstChild as HTMLElement;

    function capitalizeTextNodes( node: Node ): void {
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
    }

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
      return;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Button click → emit to parent
  // ─────────────────────────────────────────────────────────────

  protected handleButtonOperations( action: TableButton[ 'action' ], data: any ): void {
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
      console.error( '[Table action button error]' + `Action: ${ action }`, ' Error: ', err );
      return;
    }
  }

  /**
   * Clear retry timer and reset attempt counter.
   */
  private resetFetchAttempts(): void {
    this.fetchAttempts = 0;

    if ( this.fetchRetryTimerId !== null ) {
      clearTimeout( this.fetchRetryTimerId );
      this.fetchRetryTimerId = null;
    }
  }

  /**
   * Central place that decides:
   *  - data arrived → show table, stop retrying
   *  - data not here yet → ask parent up to 3 times before treating as "truly empty"
   */
  private scheduleDataFetchIfNeeded(): void {
    const hasRows: boolean = Array.isArray( this.data ) && this.data.length > 0;
    const hasTotalCount: boolean =
      typeof this.totalDataCount === 'number' && this.totalDataCount > 0;

    // ── Case 1: We definitely have data or a count ─────────────────────────
    if ( hasRows || hasTotalCount ) {
      this.isArrayOfData = hasRows;
      this.isTableVisible = true; // show table or "no rows but count > 0" state
      this.resetFetchAttempts();
      return;
    }

    // At this point: totalDataCount === 0 AND data is empty or not an array.

    // ── Case 2: We already tried enough times → treat as truly empty ───────
    if ( this.fetchAttempts >= this.maxFetchAttempts ) {
      this.isArrayOfData = false;
      this.isTableVisible = true; // allow "No data found" message to render
      return;
    }

    // ── Case 3: Ask parent again ───────────────────────────────────────────
    this.fetchAttempts += 1;

    // Emit event so parent can trigger API call
    this.fetchData.emit();

    // While retrying, keep table hidden so skeleton / loader can be shown
    this.isArrayOfData = false;
    this.isTableVisible = false;

    // Schedule the next check (if parent still hasn't provided anything)
    this.fetchRetryTimerId = setTimeout( () => {
      this.scheduleDataFetchIfNeeded();
    }, this.fetchRetryDelayMs );
  }

}
