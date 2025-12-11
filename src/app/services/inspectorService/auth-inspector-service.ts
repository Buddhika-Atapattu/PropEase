// Path: src/app/services/inspectorService/auth-inspector-service.ts

import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

@Injectable( { providedIn: 'root' } )
export class AuthInspectorService implements HttpInterceptor {

  /** Normalised backend origin, e.g. "https://api.propease.com" (no trailing slash). */
  private readonly apiOrigin: string | null;


  public constructor (
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly authService: AuthService,
  ) {
    const origin: string | undefined = environment.apiOrigin;

    this.apiOrigin = origin && origin.trim().length > 0
      ? origin.trim().replace( /\/+$/, '' )
      : null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Token access (SSR-safe)
  // ──────────────────────────────────────────────────────────────────────────

  public get sessionToken(): string | null {
    if ( !isPlatformBrowser( this.platformId ) ) {
      // On the server (SSR/Electron main) we don't have localStorage.
      return null;
    }

    try {
      return localStorage.getItem( 'sessionToken' );
    } catch {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HttpInterceptor implementation
  // ──────────────────────────────────────────────────────────────────────────

  public intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    try {
      // 1) Do not touch non-API / external requests
      if ( !this.shouldAttachAuthHeader( req ) ) {
        return next.handle( req );
      }

      const token: string | null = this.sessionToken;
      const user = this.authService.getLoggedUser;

      // 2) If no user or no token → let request pass through untouched
      if ( !user || !token ) {
        return next.handle( req );
      }

      // 3) Base headers with Authorization
      const setHeaders: Record<string, string> = {
        Authorization: `Bearer ${ token }`,
      };

      // 4) Optional: MFA verification header
      if ( user.multiAuthEnabled ) {
        // Ideally expose this as a helper on AuthService instead of hardcoding:
        const mfaStatus = this.authService.getMfaVerificationStatus();


        if ( mfaStatus ) {
          // Use a proper custom header name
          setHeaders[ 'X-MFA-Verification' ] = mfaStatus;
        }
      }

      // 5) Clone request with all auth-related headers
      const authed: HttpRequest<unknown> = req.clone( { setHeaders } );

      return next.handle( authed );
    } catch ( error ) {
      console.error(
        '[AuthInspectorService] Failed to attach Authorization/MFA headers:',
        error,
      );
      return next.handle( req );
    }
  }


  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Only attach Authorization to:
   *   - absolute URLs that start with apiOrigin
   *   - relative URLs under /api (or api/)
   *
   * Everything else (CDNs, assets, maps, etc.) is left untouched.
   */
  private shouldAttachAuthHeader( req: HttpRequest<unknown> ): boolean {
    const url: string = req.url;

    // Absolute http/https URLs
    if ( this.isAbsoluteUrl( url ) ) {
      if ( !this.apiOrigin ) {
        return false;
      }
      return url.startsWith( this.apiOrigin );
    }

    // Relative URLs – avoid assets/i18n/etc.
    if ( url.startsWith( '/assets/' )
      || url.startsWith( 'assets/' )
      || url.startsWith( '/i18n/' )
      || url.startsWith( 'i18n/' ) ) {
      return false;
    }

    // Restrict to API paths
    if ( url.startsWith( '/api/' ) || url === '/api'
      || url.startsWith( 'api/' ) || url === 'api' ) {
      return true;
    }

    return false;
  }

  private isAbsoluteUrl( url: string ): boolean {
    return /^https?:\/\//i.test( url );
  }
}
