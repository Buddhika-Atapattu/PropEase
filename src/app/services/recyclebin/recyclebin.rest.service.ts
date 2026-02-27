// Path: src/app/services/recyclebin/recyclebin.rest.service.ts
// =============================================================================
// RecycleBinRestService (Angular) — MSG-aligned (system.recyclebin / recyclebins)
// -----------------------------------------------------------------------------
// 01. Introduction
// - Single REST access layer for Recycle Bin UI.
// - Uses the universal backend envelope type: MSG.
// - Extracts payload from res.data.system.recyclebin|recyclebins.
//
// 02. Important matters
// - All endpoints return MSG.
// - List payload is expected in: res.data.system.recyclebins (array)
// - Single payload is expected in: res.data.system.recyclebin (object)
// - Total count can be in:
//     res.data.pagination.total
//     res.data.other.pagination.total
//
// 03. Why we make this class
// - Centralizes query param normalization + MSG decoding.
// - Prevents UI components from knowing backend envelope details.
//
// 04. Parameter expectations
// - entryId: non-empty string (typically Mongo ObjectId string)
// - filters: optional, omitted when unused
// - page: required { page, limit } (1-based)
//
// 05. Usage hint
// - list({ page: {page:1,limit:20}, filters:{search:"LEASE"} })
// - snapshot(entryId) -> preview modal
// - restore flow: prepareRestore -> domain restore -> markRestored
// - purge -> permanently delete
//
// 06. Keep in mind
// - ISO/IEC 27001/27002 (Control 8.28): avoid logging sensitive payloads.
// - Do NOT pass undefined query params; omit them.
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
} from "../../types/recyclebin/recyclebin.types";

import { environment } from "../../../environments/environment";

import type { FileMetaPacketDto } from "../../types/recyclebin/recyclebin.types";

@Injectable( { providedIn: "root" } )
export class RecycleBinRestService {
  private readonly API_HOST = environment.apiOrigin;
  private readonly API_BASE = `${ this.API_HOST }/api-recyclebin`;

  public constructor ( private readonly http: HttpClient ) {}

  /**
   * List recycle bin entries with filters + pagination.
   *
   * @param options.filters
   * - Optional filters used to narrow results.
   *
   * @param options.page
   * - Required pagination info (1-based page, limit).
   *
   * @returns UI-normalized result { items, total, page, limit }
   */
  public list( options: {
    filters?: RecycleBinListFilters;
    page: PageQuery;
  } ): Observable<RecycleBinListUiResult> {
    const params = this.buildListParams( options.filters, options.page );

    return this.http.get<MSG>( `${ this.API_BASE }/list`, { params } ).pipe(
      map( ( msg ) => {
        const items = this.readSystemArray<RecycleBinEntryDto>( msg, "recyclebins" );
        const total = this.readTotal( msg );

        return {
          items,
          total,
          page: options.page.page,
          limit: options.page.limit,
        };
      } )
    );
  }

  /**
   * Count recycle bin entries for a given filter set.
   *
   * @param filters
   * - Optional list filters (same fields as list).
   *
   * @returns total count (number)
   */
  public count( filters?: RecycleBinListFilters ): Observable<number> {
    const params = this.buildCountParams( filters );

    return this.http.get<MSG>( `${ this.API_BASE }/count`, { params } ).pipe(
      map( ( msg ) => this.readTotal( msg ) )
    );
  }

  /**
   * Read snapshot for preview UI.
   *
   * @param entryId
   * - Expected: non-empty recycle bin entryId string.
   *
   * @returns SnapshotRead DTO with entry + snapshotData + meta.
   */
  public snapshot( entryId: string ): Observable<RecycleBinSnapshotReadDto> {
    const id = this.safeId( entryId );

    return this.http.get<MSG>( `${ this.API_BASE }/${ encodeURIComponent( id ) }/snapshot` ).pipe(
      map( ( msg ) => {
        const entry = this.readSystemObject<RecycleBinEntryDto>( msg, "recyclebin" );
        const other = this.readOther( msg );

        return {
          entry,
          snapshotData: this.readRecord( other, "snapshotData" ),
          meta: this.readRecord( other, "metadata" ),
        };
      } )
    );
  }

  /**
   * Prepare restore (loads snapshot + files manifest).
   *
   * @param entryId
   * - Expected: non-empty recycle bin entryId string.
   *
   * @returns RestorePrepare DTO.
   */
  public prepareRestore( entryId: string ): Observable<RecycleBinRestorePrepareDto> {
    const id = this.safeId( entryId );

    return this.http
      .post<MSG>( `${ this.API_BASE }/${ encodeURIComponent( id ) }/restore/prepare`, {} )
      .pipe(
        map( ( msg ) => {
          const entry = this.readSystemObject<RecycleBinEntryDto>( msg, "recyclebin" );
          const other = this.readOther( msg );

          return {
            entry,
            snapshotData: this.readRecord( other, "snapshotData" ),
            files: this.readArrayTyped<FileMetaPacketDto>( other, "files" ),
          };
        } )
      );
  }



  /**
   * Mark restored (call after domain restore succeeded).
   *
   * @param entryId
   * - Expected: non-empty recycle bin entryId string.
   *
   * @returns { entryId } confirmation
   */
  public markRestored( entryId: string ): Observable<{ entryId: string; }> {
    const id = this.safeId( entryId );

    return this.http.post<MSG>( `${ this.API_BASE }/${ encodeURIComponent( id ) }/restore/mark`, {} ).pipe(
      map( ( msg ) => {
        const other = this.readOther( msg );
        const v = this.readString( other, "entryId" );
        return { entryId: v || id };
      } )
    );
  }

  /**
   * Purge (permanent delete).
   *
   * @param entryId
   * - Expected: non-empty recycle bin entryId string.
   *
   * @returns purge result { entryId, purged }
   */
  public purge( entryId: string ): Observable<RecycleBinPurgeResultDto> {
    const id = this.safeId( entryId );

    return this.http.delete<MSG>( `${ this.API_BASE }/${ encodeURIComponent( id ) }/purge` ).pipe(
      map( ( msg ) => {
        const other = this.readOther( msg );
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

  /**
   * Build list params (filters + page).
   */
  private buildListParams( filters: RecycleBinListFilters | undefined, page: PageQuery ): HttpParams {
    let params = new HttpParams();

    params = params.set( "page", String( page.page ) );
    params = params.set( "limit", String( page.limit ) );

    if ( !filters ) return params;

    params = this.setIfPresent( params, "sourceKey", filters.sourceKey );
    params = this.setIfPresent( params, "search", filters.search );
    params = this.setIfPresent( params, "status", filters.status );
    params = this.setIfPresent( params, "deletedByUsername", filters.deletedByUsername );
    params = this.setIfPresent( params, "deletedFromIso", filters.deletedFromIso );
    params = this.setIfPresent( params, "deletedToIso", filters.deletedToIso );
    params = this.setIfPresent( params, "module", filters.module );
    params = this.setIfPresent( params, "entity", filters.entity );

    if ( Array.isArray( filters.tagsAny ) && filters.tagsAny.length > 0 ) {
      const clean = filters.tagsAny
        .map( ( x ) => ( typeof x === "string" ? x.trim() : "" ) )
        .filter( ( x ) => x.length > 0 );

      if ( clean.length > 0 ) params = params.set( "tagsAny", clean.join( "," ) );
    }

    return params;
  }

  /**
   * Build count params (filters only).
   */
  private buildCountParams( filters: RecycleBinListFilters | undefined ): HttpParams {
    let params = new HttpParams();
    if ( !filters ) return params;

    params = this.setIfPresent( params, "sourceKey", filters.sourceKey );
    params = this.setIfPresent( params, "search", filters.search );
    params = this.setIfPresent( params, "status", filters.status );
    params = this.setIfPresent( params, "deletedByUsername", filters.deletedByUsername );
    params = this.setIfPresent( params, "deletedFromIso", filters.deletedFromIso );
    params = this.setIfPresent( params, "deletedToIso", filters.deletedToIso );
    params = this.setIfPresent( params, "module", filters.module );
    params = this.setIfPresent( params, "entity", filters.entity );

    if ( Array.isArray( filters.tagsAny ) && filters.tagsAny.length > 0 ) {
      const clean = filters.tagsAny
        .map( ( x ) => ( typeof x === "string" ? x.trim() : "" ) )
        .filter( ( x ) => x.length > 0 );

      if ( clean.length > 0 ) params = params.set( "tagsAny", clean.join( "," ) );
    }

    return params;
  }

  /**
   * Only attach a query param if value is a non-empty string.
   */
  private setIfPresent( params: HttpParams, key: string, value: unknown ): HttpParams {
    if ( typeof value !== "string" ) return params;
    const v = value.trim();
    if ( !v ) return params;
    return params.set( key, v );
  }

  /**
   * Normalize & validate entryId input (basic hardening).
   */
  private safeId( entryId: string ): string {
    const id = typeof entryId === "string" ? entryId.trim() : "";
    if ( !id ) throw new Error( "RecycleBin: entryId is required" );
    return id;
  }

  /**
   * Read array from MSG.data.system[key].
   *
   * @param msg - MSG envelope
   * @param key - system bucket key (e.g., "recyclebins")
   */
  private readSystemArray<T>( msg: MSG, key: string ): T[] {
    const sys = this.readSystem( msg );
    const raw = sys[ key ];
    if ( !Array.isArray( raw ) ) return [];
    return raw as T[];
  }

  /**
   * Read object from MSG.data.system[key].
   *
   * @param msg - MSG envelope
   * @param key - system bucket key (e.g., "recyclebin")
   */
  private readSystemObject<T>( msg: MSG, key: string ): T {
    const sys = this.readSystem( msg );
    const raw = sys[ key ];
    if ( raw && typeof raw === "object" ) return raw as T;
    return {} as T;
  }

  /**
   * Read the system bucket safely.
   */
  private readSystem( msg: MSG ): Record<string, unknown> {
    const data = ( msg as unknown as { data?: unknown; } ).data;
    if ( !data || typeof data !== "object" ) return {};

    const sys = ( data as Record<string, unknown> )[ "system" ];
    if ( !sys || typeof sys !== "object" ) return {};

    return sys as Record<string, unknown>;
  }

  /**
   * Extract "other" payload safely (MSG.data.other).
   */
  private readOther( msg: MSG ): Record<string, unknown> {
    const data = ( msg as unknown as { data?: unknown; } ).data;
    if ( !data || typeof data !== "object" ) return {};

    const other = ( data as Record<string, unknown> )[ "other" ];
    if ( !other || typeof other !== "object" ) return {};

    return other as Record<string, unknown>;
  }

  /**
   * Read pagination.total from either:
   * - MSG.data.pagination.total
   * - MSG.data.other.pagination.total
   */
  private readTotal( msg: MSG ): number {
    const data = ( msg as unknown as { data?: unknown; } ).data;
    if ( !data || typeof data !== "object" ) return 0;

    const direct = this.readTotalFromPagination( ( data as Record<string, unknown> )[ "pagination" ] );
    if ( direct !== null ) return direct;

    const other = this.readOther( msg );
    const nested = this.readTotalFromPagination( other[ "pagination" ] );
    if ( nested !== null ) return nested;

    return 0;
  }

  private readTotalFromPagination( pagination: unknown ): number | null {
    if ( !pagination || typeof pagination !== "object" ) return null;
    const total = ( pagination as Record<string, unknown> )[ "total" ];
    if ( typeof total !== "number" ) return null;
    return Number.isFinite( total ) ? total : 0;
  }

  private readRecord( parent: Record<string, unknown>, key: string ): Record<string, unknown> {
    const v = parent[ key ];
    if ( !v || typeof v !== "object" ) return {};
    return v as Record<string, unknown>;
  }

  private readArrayUnknown( parent: Record<string, unknown>, key: string ): unknown[] {
    const v = parent[ key ];
    if ( !Array.isArray( v ) ) return [];
    return v as unknown[];
  }

  private readString( parent: Record<string, unknown>, key: string ): string {
    const v = parent[ key ];
    return typeof v === "string" ? v.trim() : "";
  }

  private readBool( parent: Record<string, unknown>, key: string ): boolean {
    const v = parent[ key ];
    return typeof v === "boolean" ? v : false;
  }

  // =============================================================================
  // Internals (class-only helpers)
  // =============================================================================

  /**
   * Read an array from an object bucket and cast to a typed array.
   *
   * @param parent
   * - Expected: Record bucket (e.g., msg.data.other)
   *
   * @param key
   * - Expected: field name that contains an array (e.g., "files")
   *
   * @returns T[]
   * - Returns [] if the key is missing or not an array.
   *
   * @important
   * - This is a DTO boundary helper. The backend is the source of truth.
   * - We do not deep-validate here to avoid runtime cost; UI can still guard.
   */
  private readArrayTyped<T>( parent: Record<string, unknown>, key: string ): T[] {
    const v = parent[ key ];
    if ( !Array.isArray( v ) ) return [];
    return v as T[];
  }
}
