// Path: src/app/services/recyclebin/recyclebin-center.service.ts
// =============================================================================
// RecycleBinCenterService — WS-first then REST fallback (Phase 1)
// =============================================================================
//
// 01) Introduction
// - Single state hub for Recycle Bin dashboard.
// - Provides rows + loading + selection + expand(prepareRestore).
// - Phase 1 focus: list + count integration (Windows-like list).
//
// 02) Important matters
// - WS-first: if WS RPC layer exists + connected -> use it.
// - Fallback: if WS unavailable/failed -> use REST.
// - No payload logging (ISO 27001/27002 control 8.28).
// - exactOptionalPropertyTypes-safe: never pass undefined.
//
// 03) Why we make this class
// - UI must not know whether data came from WS or REST.
// - Centralized caching and refresh triggers.
//
// 04) Parameters
// - api: RecycleBinRestService
// - wsPush: RecycleBinSocketService (push refresh triggers)
// - (optional) wsRpc: RecycleBinWsRpcApi (list/count via WS ACK)
//
// 05) Usage hint
// - component:
//     center.loadPage({ page:1, limit:25 });
//     center.setSearch("LEASE");
//     center.vm$().subscribe(...)
//
//
// 06) Keep in mind
// - Restore uses REAL backend restore: POST /:entryId/restore (no markRestored).
// =============================================================================

import { Inject, Injectable, Optional } from "@angular/core";
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  map,
  of,
  switchMap,
  tap,
  catchError,
  finalize,
  Subject,
  merge,
  debounceTime,
  mergeMap,
  reduce,
  from,
} from "rxjs";

import type {
  PageQuery,
  RecycleBinEntryDto,
  RecycleBinListFilters,
  RecycleBinListUiResult,
  RecycleBinRestorePrepareDto,
} from "../../types/recyclebin/recyclebin.types";


import type { FileMetaPacketDto } from "../../types/recyclebin/recyclebin.types";
import { RecycleBinRestService } from "./recyclebin.rest.service";
import { RecycleBinSocketService } from "./recyclebin.socket.service";
import type { RecycleBinWsRpcApi } from "./recyclebin-ws-rpc.api";
import { RecycleBinWsRpcToken } from "./recyclebin-ws-rpc.token";

export type RecycleBinItemKind = "record" | "file";

export type RecycleBinItemIconKey =
  | "folder"
  | "file"
  | "pdf"
  | "image"
  | "doc"
  | "xls"
  | "ppt"
  | "zip"
  | "json"
  | "txt"
  | "code"
  | "unknown";

export interface RecycleBinCenterRow {
  rowId: string;
  entryId: string;

  kind: RecycleBinItemKind;

  name: string;
  typeLabel: string;
  originalLocation: string;
  dateDeletedIso: string;
  sizeBytes: number;

  depth: number;
  isExpandable: boolean;
  isExpanded: boolean;

  iconKey: RecycleBinItemIconKey;

  entry: RecycleBinEntryDto;
  file?: FileMetaPacketDto;
}

export interface RecycleBinCenterVm {
  rows: RecycleBinCenterRow[];
  total: number;
  page: number;
  limit: number;
  selectedCount: number;
}

@Injectable( { providedIn: "root" } )
export class RecycleBinCenterService {
  private readonly pageSubject = new BehaviorSubject<PageQuery>( { page: 1, limit: 25 } );
  private readonly filtersSubject = new BehaviorSubject<RecycleBinListFilters>( {} );
  private readonly loadingSubject = new BehaviorSubject<boolean>( false );

  private readonly expandedSetSubject = new BehaviorSubject<Set<string>>( new Set() );
  private readonly selectedRowIdsSubject = new BehaviorSubject<Set<string>>( new Set() );

  private readonly prepareCache = new Map<string, RecycleBinRestorePrepareDto>();

  /** Manual refresh trigger (used by WS push events + after actions) */
  private readonly refreshSubject = new Subject<void>();

  public constructor (
    private readonly api: RecycleBinRestService,
    private readonly wsPush: RecycleBinSocketService,
    @Optional() @Inject( RecycleBinWsRpcToken.TOKEN )
    private readonly wsRpc: RecycleBinWsRpcApi | null
  ) {
    this.bindPushRefreshTriggers();
  }

  // =============================================================================
  // Public streams
  // =============================================================================

  public isLoading$(): Observable<boolean> {
    return this.loadingSubject.asObservable();
  }

  public pageState$(): Observable<PageQuery> {
    return this.pageSubject.asObservable();
  }

  public selectedCount$(): Observable<number> {
    return this.selectedRowIdsSubject.pipe( map( ( s ) => s.size ) );
  }

  /**
   * ViewModel stream (rows + pagination + selection count).
   * - WS-first list
   * - REST fallback
   */
  public vm$(): Observable<RecycleBinCenterVm> {
    const refreshTick$ = merge( of( void 0 ), this.refreshSubject.pipe( debounceTime( 50 ) ) );

    return combineLatest( [ this.pageSubject, this.filtersSubject, this.expandedSetSubject, refreshTick$ ] ).pipe(
      tap( () => this.loadingSubject.next( true ) ),
      switchMap( ( [ page, filters, expanded ] ) =>
        this.loadListWsFirst( { page, filters } ).pipe(
          switchMap( ( res ) => this.buildRows( res, expanded ) ),
          map( ( built ) => ( {
            ...built,
            selectedCount: this.selectedRowIdsSubject.value.size,
          } ) ),
          catchError( () =>
            of( {
              rows: [],
              total: 0,
              page: page.page,
              limit: page.limit,
              selectedCount: 0,
            } )
          ),
          finalize( () => this.loadingSubject.next( false ) )
        )
      )
    );
  }

  /**
   * Total count stream (Phase 1).
   * - WS-first count
   * - REST fallback
   */
  public totalCount$(): Observable<number> {
    const refreshTick$ = merge( of( void 0 ), this.refreshSubject.pipe( debounceTime( 50 ) ) );

    return combineLatest( [ this.filtersSubject, refreshTick$ ] ).pipe(
      switchMap( ( [ filters ] ) => this.loadCountWsFirst( filters ).pipe( catchError( () => of( 0 ) ) ) )
    );
  }

  // =============================================================================
  // Commands (component calls)
  // =============================================================================

  public loadPage( page: PageQuery ): void {
    const p =
      typeof page?.page === "number" && Number.isFinite( page.page )
        ? Math.max( 1, Math.floor( page.page ) )
        : 1;
    const l =
      typeof page?.limit === "number" && Number.isFinite( page.limit )
        ? Math.max( 1, Math.floor( page.limit ) )
        : 25;

    this.pageSubject.next( { page: p, limit: l } );
    this.clearSelection();
    this.refresh();
  }

  public setSearch( text: string ): void {
    const clean = typeof text === "string" ? text.trim() : "";
    const prev = this.filtersSubject.value;
    const next: RecycleBinListFilters = { ...prev };

    if ( clean ) next.search = clean;
    else this.deleteSearch( next );

    this.filtersSubject.next( next );
    this.clearSelection();

    const cur = this.pageSubject.value;
    this.pageSubject.next( { page: 1, limit: cur.limit } );

    this.refresh();
  }

  private deleteSearch( filters: RecycleBinListFilters ): void {
    // exactOptionalPropertyTypes-safe: remove key entirely
    const anyF = filters as unknown as { search?: string; };
    delete anyF.search;
  }

  public toggleExpand( entryId: string ): void {
    const id = this.safeId( entryId );
    const set = new Set( this.expandedSetSubject.value );
    if ( set.has( id ) ) set.delete( id );
    else set.add( id );
    this.expandedSetSubject.next( set );
  }

  public refresh(): void {
    this.refreshSubject.next();
  }

  // =============================================================================
  // Selection
  // =============================================================================

  public isSelected( rowId: string ): boolean {
    return this.selectedRowIdsSubject.value.has( rowId );
  }

  public toggleRowSelection( rowId: string ): void {
    const id = this.safeRowId( rowId );
    const set = new Set( this.selectedRowIdsSubject.value );
    if ( set.has( id ) ) set.delete( id );
    else set.add( id );
    this.selectedRowIdsSubject.next( set );
  }

  public clearSelection(): void {
    this.selectedRowIdsSubject.next( new Set() );
  }

  // =============================================================================
  // Actions (Phase 1)
  // =============================================================================

  public restoreSelected(): Observable<{ restored: number; }> {
    const entryIds = this.getSelectedEntryIdsUnique();
    if ( entryIds.length === 0 ) return of( { restored: 0 } );

    // 4 concurrent restores (tune 2..6)
    return this.restoreMultiple( entryIds, 4 );
  }

  public purgeSelected(): Observable<{ purged: number; }> {
    const entryIds = this.getSelectedEntryIdsUnique();
    if ( entryIds.length === 0 ) return of( { purged: 0 } );
    return this.purgeSequential( entryIds, 0, 0 );
  }

  // =============================================================================
  // Lazy prepare (files)
  // =============================================================================

  public ensurePrepared( entryId: string ): Observable<RecycleBinRestorePrepareDto | null> {
    const id = this.safeId( entryId );
    const cached = this.prepareCache.get( id );
    if ( cached ) return of( cached );

    return this.api.prepareRestore( id ).pipe(
      tap( ( dto ) => {
        this.prepareCache.set( id, dto );
      } ),
      catchError( () => of( null ) )
    );
  }

  // =============================================================================
  // WS-first loaders
  // =============================================================================

  /**
   * WHY TS complained "possibly null":
   * - `this.wsRpc` is nullable. Even inside `if (!this.wsRpc) return ...`,
   *   TypeScript may not narrow it safely across RxJS callback boundaries.
   *
   * FIX:
   * - Take a local non-null snapshot `const rpc = this.wsRpc;`
   * - Use `rpc` inside the observable chain (stable reference).
   */
  private loadListWsFirst( options: {
    page: PageQuery;
    filters?: RecycleBinListFilters;
  } ): Observable<RecycleBinListUiResult> {
    const rpc = this.wsRpc;
    if ( !rpc ) return this.api.list( { page: options.page, filters: options.filters } );

    return rpc.isReady$().pipe(
      switchMap( ( ready ) => {
        if ( !ready ) return this.api.list( { page: options.page, filters: options.filters } );

        return rpc.list$( { page: options.page, filters: options.filters } ).pipe(
          catchError( () => this.api.list( { page: options.page, filters: options.filters } ) )
        );
      } )
    );
  }

  private loadCountWsFirst( filters?: RecycleBinListFilters ): Observable<number> {
    const rpc = this.wsRpc;
    if ( !rpc ) return this.api.count( filters );

    return rpc.isReady$().pipe(
      switchMap( ( ready ) => {
        if ( !ready ) return this.api.count( filters );

        return rpc.count$( filters ).pipe( catchError( () => this.api.count( filters ) ) );
      } )
    );
  }

  // =============================================================================
  // Push triggers (WS)
  // =============================================================================

  private bindPushRefreshTriggers(): void {
    // Phase 1 strategy:
    // - Any change event triggers a refresh of list+count.
    // - Debounce is applied via refreshSubject stream.

    this.wsPush.softDeleted$.subscribe( () => this.refresh() );
    this.wsPush.restored$.subscribe( () => this.refresh() );
    this.wsPush.permanentDeleted$.subscribe( () => this.refresh() );
    this.wsPush.bulk$.subscribe( () => this.refresh() );

    // Count push: still refresh (keeps UI consistent even if count payload differs)
    this.wsPush.count$.subscribe( () => this.refresh() );
  }

  // =============================================================================
  // Row builder
  // =============================================================================

  private buildRows(
    res: RecycleBinListUiResult,
    expanded: Set<string>
  ): Observable<{ rows: RecycleBinCenterRow[]; total: number; page: number; limit: number; }> {
    const entries = Array.isArray( res.items ) ? res.items : [];
    const requests: Observable<RecycleBinCenterRow[]>[] = [];

    for ( const e of entries ) {
      const entryId = this.safeId( ( e as { entryId?: string; } ).entryId || "" );
      const isExpanded = expanded.has( entryId );

      const recordRow: RecycleBinCenterRow = {
        rowId: `record:${ entryId }`,
        entryId,
        kind: "record",
        name: this.getRecordName( e ),
        typeLabel: this.getRecordTypeLabel( e ),
        originalLocation: this.getOriginalLocationLabel( e ),
        dateDeletedIso: this.getDeletedIso( e ),
        sizeBytes: 0,
        depth: 0,
        isExpandable: true,
        isExpanded,
        iconKey: this.getRecordIconKey( e ),
        entry: e,
      };

      if ( !isExpanded ) {
        requests.push( of( [ recordRow ] ) );
        continue;
      }

      const obs = this.ensurePrepared( entryId ).pipe(
        map( ( prep ) => {
          const rows: RecycleBinCenterRow[] = [ recordRow ];
          const files = prep && Array.isArray( prep.files ) ? prep.files : [];

          for ( const f of files ) {
            rows.push( {
              rowId: `file:${ entryId }:${ this.safeRowId( this.getFileStableKey( f ) ) }`,
              entryId,
              kind: "file",
              name: this.getFileName( f ),
              typeLabel: this.getFileTypeLabel( f ),
              originalLocation: this.getFileOriginalLocationLabel( f, e ),
              dateDeletedIso: this.getDeletedIso( e ),
              sizeBytes: this.getFileSize( f ),
              depth: 1,
              isExpandable: false,
              isExpanded: false,
              iconKey: this.getFileIconKey( f ),
              entry: e,
              file: f,
            } );
          }

          return rows;
        } )
      );

      requests.push( obs );
    }

    return combineLatest( requests.length ? requests : [ of( [] ) ] ).pipe(
      map( ( chunks ) => {
        const rows = chunks.flat();
        return { rows, total: res.total, page: res.page, limit: res.limit };
      } )
    );
  }

  // =============================================================================
  // Sequential helpers (restore/purge)
  // =============================================================================

  private restoreSequential( entryIds: string[], index: number, restored: number ): Observable<{ restored: number; }> {
    if ( index >= entryIds.length ) {
      this.clearSelection();
      this.refresh();
      return of( { restored } );
    }

    const id = entryIds[ index ];

    return this.ensurePrepared( id ).pipe(
      switchMap( () =>
        // REAL RESTORE: backend POST /:entryId/restore (marks restored internally)
        this.api.restore( { entryId: id } )
      ),
      switchMap( () => this.restoreSequential( entryIds, index + 1, restored + 1 ) ),
      catchError( () => this.restoreSequential( entryIds, index + 1, restored ) )
    );
  }


  private restoreMultiple(
    entryIds: string[],
    concurrency: number = 4
  ): Observable<{ restored: number; }> {
    const ids = Array.isArray( entryIds ) ? entryIds.map( ( x ) => this.safeId( x ) ) : [];
    if ( ids.length === 0 ) return of( { restored: 0 } );

    return from( ids ).pipe(
      // Ensure prepared per entry (optional but keeps your current behavior)
      mergeMap(
        ( id ) =>
          this.ensurePrepared( id ).pipe(
            switchMap( () => this.api.restore( { entryId: id } ) ),
            map( () => 1 ),
            catchError( () => of( 0 ) )
          ),
        Math.max( 1, Math.floor( concurrency ) )
      ),
      reduce( ( sum, v ) => sum + v, 0 ),
      tap( () => {
        this.clearSelection();
        this.refresh();
      } ),
      map( ( restored ) => ( { restored } ) )
    );
  }

  private purgeSequential( entryIds: string[], index: number, purged: number ): Observable<{ purged: number; }> {
    if ( index >= entryIds.length ) {
      this.clearSelection();
      this.refresh();
      return of( { purged } );
    }

    const id = entryIds[ index ];

    return this.api.purge( id ).pipe(
      switchMap( () => this.purgeSequential( entryIds, index + 1, purged + 1 ) ),
      catchError( () => this.purgeSequential( entryIds, index + 1, purged ) )
    );
  }

  private getSelectedEntryIdsUnique(): string[] {
    const ids = new Set<string>();

    for ( const rowId of this.selectedRowIdsSubject.value ) {
      const parts = rowId.split( ":" );
      if ( parts.length >= 2 ) {
        const entryId = ( parts[ 1 ] || "" ).trim();
        if ( entryId ) ids.add( entryId );
      }
    }

    return Array.from( ids );
  }

  // =============================================================================
  // Mapping helpers
  // =============================================================================

  private getRecordName( e: RecycleBinEntryDto ): string {
    const anyE = e as unknown as Record<string, unknown>;
    const label = typeof anyE[ "label" ] === "string" ? String( anyE[ "label" ] ).trim() : "";
    const entity = typeof anyE[ "entity" ] === "string" ? String( anyE[ "entity" ] ).trim() : "";
    const entryId = typeof anyE[ "entryId" ] === "string" ? String( anyE[ "entryId" ] ).trim() : "";
    return label || entity || `Deleted Item (${ entryId.slice( 0, 6 ) || "Record" })`;
  }

  private getRecordTypeLabel( e: RecycleBinEntryDto ): string {
    const anyE = e as unknown as Record<string, unknown>;
    const module = typeof anyE[ "module" ] === "string" ? String( anyE[ "module" ] ).trim() : "";
    const entity = typeof anyE[ "entity" ] === "string" ? String( anyE[ "entity" ] ).trim() : "";
    if ( module && entity ) return `${ module } • ${ entity }`;
    return module || entity || "Record";
  }

  private getOriginalLocationLabel( e: RecycleBinEntryDto ): string {
    const anyE = e as unknown as Record<string, unknown>;
    const module = typeof anyE[ "module" ] === "string" ? String( anyE[ "module" ] ).trim() : "";
    const entity = typeof anyE[ "entity" ] === "string" ? String( anyE[ "entity" ] ).trim() : "";
    const sourceKey = typeof anyE[ "sourceKey" ] === "string" ? String( anyE[ "sourceKey" ] ).trim() : "";
    const parts = [ module, entity, sourceKey ].filter( ( x ) => !!x );
    return parts.length ? parts.join( " / " ) : "System";
  }

  private getDeletedIso( e: RecycleBinEntryDto ): string {
    const anyE = e as unknown as Record<string, unknown>;
    const iso = typeof anyE[ "deletedAtIso" ] === "string" ? String( anyE[ "deletedAtIso" ] ).trim() : "";
    return iso || "";
  }

  private getRecordIconKey( e: RecycleBinEntryDto ): RecycleBinItemIconKey {
    const anyE = e as unknown as Record<string, unknown>;
    const module = typeof anyE[ "module" ] === "string" ? String( anyE[ "module" ] ).toLowerCase() : "";
    if ( module.includes( "lease" ) ) return "doc";
    if ( module.includes( "payment" ) ) return "xls";
    if ( module.includes( "property" ) ) return "folder";
    return "file";
  }

  private getFileStableKey( f: FileMetaPacketDto ): string {
    const anyF = f as unknown as Record<string, unknown>;
    const stored = typeof anyF[ "storedName" ] === "string" ? String( anyF[ "storedName" ] ).trim() : "";
    const rel = typeof anyF[ "relativePath" ] === "string" ? String( anyF[ "relativePath" ] ).trim() : "";
    const orig = typeof anyF[ "originalName" ] === "string" ? String( anyF[ "originalName" ] ).trim() : "";
    return stored || rel || orig || "file";
  }

  private getFileName( f: FileMetaPacketDto ): string {
    const anyF = f as unknown as Record<string, unknown>;
    const orig = typeof anyF[ "originalName" ] === "string" ? String( anyF[ "originalName" ] ).trim() : "";
    const stored = typeof anyF[ "storedName" ] === "string" ? String( anyF[ "storedName" ] ).trim() : "";
    return orig || stored || "File";
  }

  private getFileSize( f: FileMetaPacketDto ): number {
    const anyF = f as unknown as Record<string, unknown>;
    const size = anyF[ "sizeBytes" ];
    if ( typeof size === "number" && Number.isFinite( size ) ) return size;
    return 0;
  }

  private getFileTypeLabel( f: FileMetaPacketDto ): string {
    const name = this.getFileName( f );
    const ext = this.extOf( name );
    if ( !ext ) return "File";
    return `${ ext.toUpperCase() } File`;
  }

  private getFileOriginalLocationLabel( f: FileMetaPacketDto, e: RecycleBinEntryDto ): string {
    const anyF = f as unknown as Record<string, unknown>;
    const origRel = typeof anyF[ "originalRel" ] === "string" ? String( anyF[ "originalRel" ] ).trim() : "";
    const origAbs = typeof anyF[ "originalAbs" ] === "string" ? String( anyF[ "originalAbs" ] ).trim() : "";
    return origRel || origAbs || this.getOriginalLocationLabel( e );
  }

  private getFileIconKey( f: FileMetaPacketDto ): RecycleBinItemIconKey {
    const name = this.getFileName( f );
    const ext = this.extOf( name );

    if ( !ext ) return "file";
    if ( [ "png", "jpg", "jpeg", "webp", "gif", "bmp", "svg" ].includes( ext ) ) return "image";
    if ( [ "pdf" ].includes( ext ) ) return "pdf";
    if ( [ "doc", "docx", "rtf" ].includes( ext ) ) return "doc";
    if ( [ "xls", "xlsx", "csv" ].includes( ext ) ) return "xls";
    if ( [ "ppt", "pptx" ].includes( ext ) ) return "ppt";
    if ( [ "zip", "rar", "7z", "tar", "gz" ].includes( ext ) ) return "zip";
    if ( [ "json" ].includes( ext ) ) return "json";
    if ( [ "txt", "log" ].includes( ext ) ) return "txt";
    if ( [ "ts", "js", "html", "css", "scss", "md" ].includes( ext ) ) return "code";
    return "unknown";
  }

  private extOf( filename: string ): string {
    const n = typeof filename === "string" ? filename.trim() : "";
    const i = n.lastIndexOf( "." );
    if ( i <= 0 ) return "";
    return n.slice( i + 1 ).toLowerCase().trim();
  }

  // =============================================================================
  // Safety + helpers
  // =============================================================================

  private safeId( v: string ): string {
    const s = typeof v === "string" ? v.trim() : "";
    if ( !s ) throw new Error( "[Error:] [RecycleBinCenterService:] entryId is required\n" );
    return s;
  }

  private safeRowId( v: string ): string {
    const s = typeof v === "string" ? v.trim() : "";
    return s || "row";
  }
}
