// Path: src/app/services/recyclebin/recyclebin.rest.service.ts
// =============================================================================
// RecycleBinRestService (Angular) — PHASE 1 ALIGNED (NO markRestored; REAL restore())
// =============================================================================

import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, map } from "rxjs";

import type { MSG } from "../../types/api-message.types";
import type {
  PageQuery,
  RecycleBinEntryDto,
  RecycleBinListFilters,
  RecycleBinListUiResult,
  RecycleBinPurgeResultDto,
  RecycleBinRestorePrepareDto,
  RecycleBinSnapshotReadDto,
  FileMetaPacketDto,
} from "../../types/recyclebin/recyclebin.types";

import { environment } from "../../../environments/environment";

/* =============================================================================
 * A) Restore Result DTO (FE-local, based on backend controller response)
 * - Controller returns:
 *   ok(res, "recycleBinItem", result.entry, ..., { other: { result } })
 * ========================================================================== */
export interface RecycleBinRestoreResultUi {
  entry: RecycleBinEntryDto;
  result: Record<string, unknown>;
}

@Injectable( { providedIn: "root" } )
export class RecycleBinRestService {
  private readonly API_HOST: string = environment.apiOrigin;
  private readonly API_BASE: string = `${ this.API_HOST }/api-recyclebin`;

  public constructor ( private readonly http: HttpClient ) {}

  public list( options: { filters?: RecycleBinListFilters; page: PageQuery; } ): Observable<RecycleBinListUiResult> {
    const params: HttpParams = this.buildListParams( options.filters, options.page );

    return this.http.get<MSG>( `${ this.API_BASE }/list`, { params } ).pipe(
      map( ( msg ) => {
        const items: RecycleBinEntryDto[] = this.readSystemArray<RecycleBinEntryDto>( msg, "recycleBinItems" );
        const total: number = this.readTotal( msg );

        return { items, total, page: options.page.page, limit: options.page.limit };
      } )
    );
  }

  public search( options: {
    searchText: string;
    filters?: Omit<RecycleBinListFilters, "search">;
    page: PageQuery;
  } ): Observable<RecycleBinListUiResult> {
    const searchText: string = this.safeSearchText( options.searchText );

    const mergedFilters: RecycleBinListFilters = searchText
      ? { ...( options.filters ?? {} ), search: searchText }
      : { ...( options.filters ?? {} ) };

    return this.list( { page: options.page, filters: mergedFilters } );
  }

  /**
   * Count (total only) — ALIGNED WITH BACKEND:
   * Controller:
   *   ok(res, "other", {}, ..., { pagination:{ total: result.total } })
   */
  public count( filters?: RecycleBinListFilters ): Observable<number> {
    const params: HttpParams = this.buildCountParams( filters );

    return this.http.get<MSG>( `${ this.API_BASE }/count`, { params } ).pipe( map( ( msg ) => this.readTotal( msg ) ) );
  }

  public snapshot( entryId: string ): Observable<RecycleBinSnapshotReadDto> {
    const id: string = this.safeId( entryId );

    return this.http.get<MSG>( `${ this.API_BASE }/${ encodeURIComponent( id ) }/snapshot` ).pipe(
      map( ( msg ) => {
        const entry: RecycleBinEntryDto = this.readSystemObjectOrThrow<RecycleBinEntryDto>( msg, "recycleBinItem" );
        const other: Record<string, unknown> = this.readOther( msg );

        return {
          entry,
          snapshotData: this.readRecord( other, "snapshotData" ),
          meta: this.readRecord( other, "metadata" ),
        };
      } )
    );
  }

  public prepareRestore( entryId: string ): Observable<RecycleBinRestorePrepareDto> {
    const id: string = this.safeId( entryId );

    return this.http.post<MSG>( `${ this.API_BASE }/${ encodeURIComponent( id ) }/restore/prepare`, {} ).pipe(
      map( ( msg ) => {
        const entry: RecycleBinEntryDto = this.readSystemObjectOrThrow<RecycleBinEntryDto>( msg, "recycleBinItem" );
        const other: Record<string, unknown> = this.readOther( msg );

        return {
          entry,
          snapshotData: this.readRecord( other, "snapshotData" ),
          files: this.readArrayTyped<FileMetaPacketDto>( other, "files" ),
        };
      } )
    );
  }

  /**
   * REAL RESTORE (DB + Files) — matches backend controller:
   * POST /:entryId/restore
   * body: { restoreMode?: "insert" | "upsert" }
   *
   * @param options.restoreMode
   * - Optional: "insert" | "upsert"
   * - If omitted, backend/engine defaults apply
   */
  public restore( options: {
    entryId: string;
    restoreMode?: "insert" | "upsert";
  } ): Observable<RecycleBinRestoreResultUi> {
    const id: string = this.safeId( options.entryId );

    // exactOptionalPropertyTypes-safe: only attach restoreMode if present
    const body: Record<string, unknown> = {};
    if ( options.restoreMode ) body[ "restoreMode" ] = options.restoreMode;

    console.log( 'restore' );

    return this.http.post<MSG>( `${ this.API_BASE }/${ encodeURIComponent( id ) }/restore`, body ).pipe(
      map( ( msg ) => {
        const entry: RecycleBinEntryDto = this.readSystemObjectOrThrow<RecycleBinEntryDto>( msg, "recycleBinItem" );
        const other: Record<string, unknown> = this.readOther( msg );
        const result: Record<string, unknown> = this.readRecord( other, "result" );

        return { entry, result };
      } )
    );
  }

  public purge( entryId: string ): Observable<RecycleBinPurgeResultDto> {
    const id: string = this.safeId( entryId );

    return this.http.delete<MSG>( `${ this.API_BASE }/${ encodeURIComponent( id ) }/purge` ).pipe(
      map( ( msg ) => {
        const other: Record<string, unknown> = this.readOther( msg );
        return {
          entryId: this.readString( other, "entryId" ) || id,
          purged: this.readBool( other, "purged" ),
        };
      } )
    );
  }

  // =============================================================================
  // Internals (class-only helpers)
  // =============================================================================

  private buildListParams( filters: RecycleBinListFilters | undefined, page: PageQuery ): HttpParams {
    let params: HttpParams = new HttpParams();

    params = params.set( "page", String( page.page ) );
    params = params.set( "limit", String( page.limit ) );

    if ( !filters ) return params;

    params = this.setIfPresent( params, "search", filters.search );

    params = this.setIfPresent( params, "sourceKey", filters.sourceKey );
    params = this.setIfPresent( params, "status", filters.status );
    params = this.setIfPresent( params, "deletedByUsername", filters.deletedByUsername );
    params = this.setIfPresent( params, "deletedFromIso", filters.deletedFromIso );
    params = this.setIfPresent( params, "deletedToIso", filters.deletedToIso );
    params = this.setIfPresent( params, "module", filters.module );
    params = this.setIfPresent( params, "entity", filters.entity );

    params = this.setCsvIfPresent( params, "tagsAny", filters.tagsAny );

    return params;
  }

  private buildCountParams( filters: RecycleBinListFilters | undefined ): HttpParams {
    let params: HttpParams = new HttpParams();
    if ( !filters ) return params;

    params = this.setIfPresent( params, "search", filters.search );

    params = this.setIfPresent( params, "sourceKey", filters.sourceKey );
    params = this.setIfPresent( params, "status", filters.status );
    params = this.setIfPresent( params, "deletedByUsername", filters.deletedByUsername );
    params = this.setIfPresent( params, "deletedFromIso", filters.deletedFromIso );
    params = this.setIfPresent( params, "deletedToIso", filters.deletedToIso );
    params = this.setIfPresent( params, "module", filters.module );
    params = this.setIfPresent( params, "entity", filters.entity );

    params = this.setCsvIfPresent( params, "tagsAny", filters.tagsAny );

    return params;
  }

  private setIfPresent( params: HttpParams, key: string, value: unknown ): HttpParams {
    if ( typeof value !== "string" ) return params;
    const v: string = value.trim();
    if ( !v ) return params;
    return params.set( key, v );
  }

  private setCsvIfPresent( params: HttpParams, key: string, list: unknown ): HttpParams {
    if ( !Array.isArray( list ) || list.length === 0 ) return params;

    const clean: string[] = list
      .map( ( x ) => ( typeof x === "string" ? x.trim() : "" ) )
      .filter( ( x ) => x.length > 0 );

    if ( clean.length === 0 ) return params;

    return params.set( key, clean.join( "," ) );
  }

  private safeId( entryId: string ): string {
    const id: string = typeof entryId === "string" ? entryId.trim() : "";
    if ( !id ) throw new Error( "[Error:] [RecycleBinRestService:] entryId is required\n" );
    return id;
  }

  private safeSearchText( searchText: string ): string {
    const s: string = typeof searchText === "string" ? searchText.trim() : "";
    if ( !s ) return "";
    if ( s.length < 2 ) return "";
    return s;
  }

  private readSystemArray<T>( msg: MSG, key: string ): T[] {
    const sys: Record<string, unknown> = this.readSystem( msg );
    const raw: unknown = sys[ key ];
    if ( !Array.isArray( raw ) ) return [];
    return raw as T[];
  }

  private readSystemObjectOrThrow<T>( msg: MSG, key: string ): T {
    const sys: Record<string, unknown> = this.readSystem( msg );
    const raw: unknown = sys[ key ];
    if ( raw && typeof raw === "object" ) return raw as T;
    throw new Error( `[Error:] [RecycleBinRestService:] Missing system.${ key } in MSG\n` );
  }

  private readSystem( msg: MSG ): Record<string, unknown> {
    const data: unknown = ( msg as unknown as { data?: unknown; } ).data;
    if ( !data || typeof data !== "object" ) return {};

    const sys: unknown = ( data as Record<string, unknown> )[ "system" ];
    if ( !sys || typeof sys !== "object" ) return {};

    return sys as Record<string, unknown>;
  }

  private readOther( msg: MSG ): Record<string, unknown> {
    const data: unknown = ( msg as unknown as { data?: unknown; } ).data;
    if ( !data || typeof data !== "object" ) return {};

    const other: unknown = ( data as Record<string, unknown> )[ "other" ];
    if ( !other || typeof other !== "object" ) return {};

    return other as Record<string, unknown>;
  }

  private readTotal( msg: MSG ): number {
    const data: unknown = ( msg as unknown as { data?: unknown; } ).data;
    if ( !data || typeof data !== "object" ) return 0;

    const direct: number | null = this.readTotalFromPagination( ( data as Record<string, unknown> )[ "pagination" ] );
    if ( direct !== null ) return direct;

    const other: Record<string, unknown> = this.readOther( msg );
    const nested: number | null = this.readTotalFromPagination( other[ "pagination" ] );
    if ( nested !== null ) return nested;

    return 0;
  }

  private readTotalFromPagination( pagination: unknown ): number | null {
    if ( !pagination || typeof pagination !== "object" ) return null;

    const total: unknown = ( pagination as Record<string, unknown> )[ "total" ];
    if ( typeof total !== "number" ) return null;

    return Number.isFinite( total ) ? total : 0;
  }

  private readRecord( parent: Record<string, unknown>, key: string ): Record<string, unknown> {
    const v: unknown = parent[ key ];
    if ( !v || typeof v !== "object" ) return {};
    return v as Record<string, unknown>;
  }

  private readString( parent: Record<string, unknown>, key: string ): string {
    const v: unknown = parent[ key ];
    return typeof v === "string" ? v.trim() : "";
  }

  private readBool( parent: Record<string, unknown>, key: string ): boolean {
    const v: unknown = parent[ key ];
    return typeof v === "boolean" ? v : false;
  }

  private readArrayTyped<T>( parent: Record<string, unknown>, key: string ): T[] {
    const v: unknown = parent[ key ];
    if ( !Array.isArray( v ) ) return [];
    return v as T[];
  }
}
