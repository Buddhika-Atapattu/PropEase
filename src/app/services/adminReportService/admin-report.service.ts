import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getCountries } from '@yusifaliyevpro/countries';
import { firstValueFrom } from 'rxjs';
import { MSG } from '../../types/api-message.types';
import type { User } from '../APIs/apis.service';

type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

interface SecurityIncidentPayload {
  type: string;
  severity?: IncidentSeverity;
  message?: string;
  username?: string;
  details?: Record<string, unknown>;
}

@Injectable( {
  providedIn: 'root',
} )
export class AdminReportService {
  private isBrowser: boolean;
  private readonly baseURL: string = 'http://localhost:3000';
  private readonly reportAPI: string = 'api-report';

  constructor (
    private http: HttpClient,
    @Inject( PLATFORM_ID ) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
  }
  // ─────────────────────────────────────────────────────────────────────────────
  // Security / incident reporting helpers (frontend → backend)
  // Hits: POST  <baseURL>/<reportAPI>/security
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Centralised helper for reporting security incidents.
   *  - Wraps POST /security with consistent payload typing.
   */
  private async reportSecurityIncident(
    payload: SecurityIncidentPayload
  ): Promise<MSG> {
    return await firstValueFrom(
      this.http.post<MSG>(
        `${ this.baseURL }/${ this.reportAPI }/security`,
        payload
      )
    );
  }

  /**
   * Report failure to clear user object from localStorage.
   */
  public async reportCleanUser(
    currentUsername: User[ 'username' ]
  ): Promise<MSG> {
    return await this.reportSecurityIncident( {
      type: 'logout-clean-user-failure',
      severity: 'medium',
      message: 'Failed to clear user from localStorage after logout',
      username: currentUsername,
      details: {
        context: 'AuthService.safeLogout',
        extraNote: 'localStorage.removeItem("ENCRYPED_LOGGED_USER") returned without effect',
      },
    } );
  }

  /**
   * Report failure to clear auth token from localStorage.
   * NOTE:
   *  - We do NOT send the token itself.
   *  - Backend will still see any Authorization header/cookie and hash it there.
   */
  public async reportCleanToken(
    currentUsername: User[ 'username' ]
  ): Promise<MSG> {
    return await this.reportSecurityIncident( {
      type: 'logout-clean-token-failure',
      severity: 'high',
      message: 'Failed to clear sessionToken from localStorage after logout',
      username: currentUsername,
      details: {
        context: 'AuthService.safeLogout',
        extraNote: 'localStorage.removeItem("sessionToken") returned without effect',
      },
    } );
  }

  /**
   * Report failure to clear stored (encrypted) password from localStorage.
   * NOTE:
   *  - We never send password or its hash.
   *  - Only report that the cleanup operation failed.
   */
  public async reportCleanPassword(
    currentUsername: User[ 'username' ]
  ): Promise<MSG> {
    return await this.reportSecurityIncident( {
      type: 'logout-clean-password-failure',
      severity: 'high',
      message: 'Failed to clear encrypted password from localStorage after logout',
      username: currentUsername,
      details: {
        context: 'AuthService.safeLogout',
        extraNote: 'localStorage.removeItem("PASSWORD") returned without effect',
      },
    } );
  }

  /**
   * Report inconsistency in login status flags.
   * Example call:
   *   reportLoginStatusFailure(user.username, false, true);
   */
  public async reportLoginStatusFailure(
    currentUsername: User[ 'username' ],
    expectedStatus: boolean,
    actualStatus: boolean
  ): Promise<MSG> {
    return await this.reportSecurityIncident( {
      type: 'logout-login-status-mismatch',
      severity: 'medium',
      message: 'Login status flag is inconsistent after logout attempt',
      username: currentUsername,
      details: {
        context: 'AuthService.safeLogout',
        expectedStatus,
        actualStatus,
        extraNote: 'IS_USER_LOGGED_IN flag did not match expected state',
      },
    } );
  }

}
