// Path: src/app/interceptors/auth-header.interceptor.ts

import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { HeaderContextService } from '../services/security/header-context.service';
import { environment } from '../../environments/environment';
import { SessionExpiryUiService } from '../services/security/session-expiry-ui.service';

@Injectable()
export class AuthHeaderInterceptor implements HttpInterceptor {

  /** Normalised backend origin, e.g. "https://api.propease.com" (no trailing slash). */
  private readonly apiOrigin: string | null;

  constructor (
    private readonly headerContext: HeaderContextService,
    private readonly sessionExpiryUi: SessionExpiryUiService,
  ) {
    const origin: string | undefined = environment.apiOrigin;

    this.apiOrigin = origin && origin.trim().length > 0
      ? origin.trim().replace( /\/+$/, '' )
      : null;
  }

  public intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    try {
      // Decide first if this request should ever carry auth headers.
      if ( !this.shouldAttachAuthHeaders( req ) ) {
        return next.handle( req );
      }

      // Ask the header context to build the header map.
      const headers: Record<string, string> = this.headerContext.buildAuthHeaders();

      // If nothing to add, pass through.
      if ( !headers || Object.keys( headers ).length === 0 ) {
        return next.handle( req );
      }

      const cloned: HttpRequest<unknown> = req.clone( {
        setHeaders: headers,
        // withCredentials: true, // keep/comment according to your backend
      } );

      // Attach response-side logic to inspect session-expiry headers
      return next.handle( cloned ).pipe(
        tap( ( event: HttpEvent<unknown> ) => {
          if ( event instanceof HttpResponse ) {
            this.handleSessionExpiryHeaders( event );
          }
        } ),
      );
    }
    catch ( error ) {
      // Never block the request if header building fails.
      console.error( '[AuthHeaderInterceptor] Failed to attach auth headers:', error );
      return next.handle( req );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Session-expiry header handling
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Reads session expiry warning headers (if present) and forwards them
   * to SessionExpiryUiService so the UI can show a countdown banner.
   *
   * Expected headers (must match backend SessionExpiryService):
   *   X-Session-Expiry-Warning : "true" | "false"
   *   X-Session-Expires-In-Seconds : "<int>"   (e.g. "300")
   *   X-Session-Expiry-At : ISO string (optional)
   */
  private handleSessionExpiryHeaders( res: HttpResponse<unknown> ): void {
    try {
      const warningFlag = res.headers.get( 'X-Session-Expiry-Warning' );
      if ( !warningFlag || warningFlag.toLowerCase() !== 'true' ) {
        // No warning on this response → we can choose to ignore or clear.
        // Comment out the next line if you only want to clear when session ends.
        this.sessionExpiryUi.clearWarning();
        return;
      }

      const secondsRaw = res.headers.get( 'X-Session-Expires-In-Seconds' );
      const expiryAtRaw = res.headers.get( 'X-Session-Expiry-At' );

      const seconds = secondsRaw ? Number.parseInt( secondsRaw, 10 ) : NaN;

      if ( Number.isNaN( seconds ) || seconds <= 0 ) {
        // Invalid / expired immediately → clear warning.
        this.sessionExpiryUi.clearWarning();
        return;
      }

      this.sessionExpiryUi.showWarning( seconds, expiryAtRaw ?? null );
    } catch ( error ) {
      console.warn( '[AuthHeaderInterceptor] Failed to process session expiry headers:', error );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helper: decide when we attach auth headers
  // ──────────────────────────────────────────────────────────────────────────

  private shouldAttachAuthHeaders( req: HttpRequest<unknown> ): boolean {
    const url: string = req.url;

    // 1) Absolute URLs (http/https)
    if ( this.isAbsoluteUrl( url ) ) {
      if ( !this.apiOrigin ) {
        return false;
      }
      return url.startsWith( this.apiOrigin );
    }

    // 2) Relative URLs → skip assets/i18n
    if ( url.startsWith( '/assets/' )
      || url.startsWith( 'assets/' )
      || url.startsWith( '/i18n/' )
      || url.startsWith( 'i18n/' ) ) {
      return false;
    }

    // 3) Only attach to API prefixes.
    if ( url.startsWith( '/api/' ) || url === '/api'
      || url.startsWith( 'api/' ) || url === 'api' ) {
      return true;
    }

    return false;
  }

  /** Simple absolute URL check for http/https. */
  private isAbsoluteUrl( url: string ): boolean {
    return /^https?:\/\//i.test( url );
  }
}
