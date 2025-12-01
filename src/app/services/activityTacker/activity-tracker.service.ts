// Path: src/app/services/activity-tracker/activity-tracker.service.ts

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as moment from 'moment';
import { firstValueFrom } from 'rxjs';

import { MSG, type DateRange } from '../../types/api-message.types';

@Injectable( {
  providedIn: 'root',
} )
export class ActivityTrackerService {
  /**
   * Base API root for all tracking endpoints.
   * TODO: Move this to environment.ts for non-localhost builds.
   */
  private readonly root: string = 'http://localhost:3000/api-tracking';

  constructor ( private http: HttpClient ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Generic utilities
  // ───────────────────────────────────────────────────────────────────────────

  /** Encode a URL segment safely (e.g. usernames) */
  private safeSeg( value: string ): string {
    return encodeURIComponent( ( value || '' ).trim() );
  }

  /**
   * Converts a record into HttpParams.
   * - Skips null/undefined values.
   */
  private toParams(
    record: Record<string, string | number | boolean | undefined | null>
  ): HttpParams {
    let params = new HttpParams();

    for ( const [ key, rawValue ] of Object.entries( record ) ) {
      if ( rawValue != null ) {
        params = params.set( key, String( rawValue ) );
      }
    }

    return params;
  }

  /**
   * Normalise unknown error shapes into a standard MSG error response.
   */
  private mapError( e: unknown ): MSG {
    const fallback: MSG = {
      success: false,
      status: 'error',
      message: 'Unexpected error',
      data: null,
    };

    if ( typeof e === 'string' ) {
      return {
        success: false,
        status: 'error',
        message: e,
        data: null,
      };
    }

    if ( e && typeof e === 'object' ) {
      const anyE = e as { error?: unknown; message?: string; };

      if ( anyE?.error && typeof anyE.error === 'object' ) {
        const nested = anyE.error as { message?: string; };
        const emsg = nested.message || anyE.message || 'Request failed';

        return {
          success: false,
          status: 'error',
          message: emsg,
          data: anyE.error as any,
        };
      }

      if ( anyE?.message ) {
        return {
          success: false,
          status: 'error',
          message: anyE.message,
          data: null,
        };
      }
    }

    return fallback;
  }

  /**
   * Normalise any successful backend shape into MSG.
   * If the backend already returns MSG, this is basically a pass-through.
   */
  private normalizeToMSG( raw: unknown ): MSG {
    const r = raw as {
      success?: boolean;
      status?: string;
      message?: string;
      data?: unknown;
    };

    if ( typeof r?.message === 'string' ) {
      const success = typeof r.success === 'boolean' ? r.success : false;
      const status =
        typeof r.status === 'string' && r.status.toLowerCase() === 'success'
          ? 'success'
          : success
            ? 'success'
            : 'error';

      return {
        success,
        status,
        message: r.message,
        data: ( r.data ?? null ) as any,
      };
    }

    // If the payload isn’t in MSG shape but still useful, wrap it.
    return {
      success: true,
      status: 'success',
      message: 'OK',
      data: raw as any,
    };
  }

  /**
   * Convert string/Date to a Date or null safely.
   */
  public asDate( value: string | Date | null | undefined ): Date | null {
    if ( !value ) return null;
    if ( value instanceof Date ) return value;

    const parsed = new Date( value );
    return Number.isNaN( parsed.getTime() ) ? null : parsed;
  }

  /**
   * Format a date as `YYYY-MM-DD`.
   * Accepts Moment, Date, or ISO/string.
   */
  private formatDateOnly( date: moment.Moment | Date | string ): string {
    if ( moment.isMoment( date ) ) {
      return date.format( 'YYYY-MM-DD' );
    }

    const parsedDate = new Date( date );
    if ( Number.isNaN( parsedDate.getTime() ) ) {
      throw new Error( 'Invalid date provided to formatDateOnly' );
    }

    const year = parsedDate.getFullYear();
    const month = String( parsedDate.getMonth() + 1 ).padStart( 2, '0' );
    const day = String( parsedDate.getDate() ).padStart( 2, '0' );

    return `${ year }-${ month }-${ day }`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Low-level HTTP helpers (centralised error handling)
  // ───────────────────────────────────────────────────────────────────────────

  private async get( path: string, params?: HttpParams ): Promise<MSG> {
    try {
      const raw = await firstValueFrom(
        this.http.get<unknown>( `${ this.root }${ path }`, { params } )
      );
      return this.normalizeToMSG( raw );
    } catch ( e ) {
      return this.mapError( e );
    }
  }

  private async post( path: string, body?: unknown ): Promise<MSG> {
    try {
      const raw = await firstValueFrom(
        this.http.post<unknown>( `${ this.root }${ path }`, body )
      );
      return this.normalizeToMSG( raw );
    } catch ( e ) {
      return this.mapError( e );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API methods
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Save logged-in user details to tracking.
   * `data` should be the payload expected by `/track-logged-user-login`.
   */
  public async saveLoggedUserDataToTracking(
    data: Record<string, unknown>
  ): Promise<MSG> {
    return await this.post( '/track-logged-user-login', data );
  }

  /**
   * Get total login count for a specific user.
   * Returns MSG always (no null), with success flag.
   */
  public async getTotalTrackingCount( username: string ): Promise<MSG> {
    const safeUsername = this.safeSeg( username );
    return await this.get( `/get-logged-user-tracking-count/${ safeUsername }` );
  }

  /**
   * Get paginated tracking records for a user.
   * - index/limit: pagination
   * - dateRange: optional filter
   * - search: optional free-text search
   */
  public async getLoggedUserTracking(
    index: number,
    limit: number,
    username: string,
    dateRange?: DateRange,
    search?: string
  ): Promise<MSG> {
    const safeUsername = this.safeSeg( username );

    const params = this.toParams( {
      index,
      limit,
      daterange: dateRange ? JSON.stringify( dateRange ) : null,
      search: search ?? null,
    } );

    return await this.get(
      `/get-logged-user-tracking/${ safeUsername }`,
      params
    );
  }

  /**
   * Get aggregated login counts for all users.
   */
  public async getLoggedAllUsersTracking(): Promise<MSG> {
    return await this.get( '/get-all-users-login-counts' );
  }

  /**
   * Get file activity for a single user, with optional date filter.
   */
  public async getUserFileActivity(
    username: string,
    start: number,
    limit: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<MSG> {
    const safeUsername = this.safeSeg( username );

    const params = this.toParams( {
      startDate: startDate ? this.formatDateOnly( startDate ) : null,
      endDate: endDate ? this.formatDateOnly( endDate ) : null,
    } );

    // Path params are preserved exactly as your original API.
    return await this.get(
      `/user-file-management-activity/${ safeUsername }/${ start }/${ limit }`,
      params
    );
  }

  /**
   * Get users created by a specific creator (username),
   * with optional date filter.
   */
  public async getCreatedUsersBasedOnCreator(
    username: string,
    index: number,
    limit: number,
    search?: string
  ): Promise<MSG> {
    const safeUsername = this.safeSeg( username );
    const safeSearch = search ? search.trim() : undefined;
    const safeIndex = Number( index );
    const safeLimit = Number( limit );
    const params = this.toParams( {
      limit: safeLimit,
      index: safeIndex,
      search: safeSearch
    } );

    return await this.get(
      `/get-created-users-based-on-creator/${ safeUsername }`,
      params
    );
  }

  public async getTotalOfCreatedUsersBasedOnCreator(username: string): Promise<MSG>{
    const safeUsername = this.safeSeg( username );
    return await this.get(
      `/get-total-of-created-users-based-on-creator/${ safeUsername }`,
    );
  }
}
