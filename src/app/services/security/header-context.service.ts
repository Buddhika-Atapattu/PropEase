// Path: src/app/services/security/header-context.service.ts
// -----------------------------------------------------------------------------
// HeaderContextService
// -----------------------------------------------------------------------------
// Responsibilities:
//  - Single source of truth for auth-related client headers.
//  - Owns storage for:
//      * sessionToken (main JWT for HTTP)
//      * guardToken   (short-lived JWT pushed via Socket.IO)
//  - Subscribes to SocketService.guardToken$ and persists the latest guard token.
//  - Provides header builders for HTTP clients and future subsystems
//    (chat, call, etc.).
// -----------------------------------------------------------------------------

import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

import { SocketService, GuardTokenPayload } from '../socket/socket-service';
import { DeviceInfoService } from '../deviceInfo/device-info.service'

export interface AuthTokenSnapshot {
  /** Long-lived API session token (Authorization: Bearer). */
  session?: string;
  /** Short-lived guard token (sent as x-guard-token, etc.). */
  guard?: string;
}

@Injectable( { providedIn: 'root' } )
export class HeaderContextService {
  private readonly isBrowser: boolean;

  // Centralised keys (use these instead of duplicating in AuthService later)
  private readonly STORAGE_KEYS = {
    sessionToken: 'sessionToken',
    guardToken: 'guardToken',
    deviceId: 'propease_device_id'
  } as const;

  /** Latest guard token from Socket or storage. */
  private readonly guardTokenSubject = new BehaviorSubject<GuardTokenPayload | null>( null );
  readonly guardToken$: Observable<GuardTokenPayload | null> = this.guardTokenSubject.asObservable();

  constructor (
    @Inject( PLATFORM_ID ) platformId: Object,
    private readonly socketService: SocketService,
    private readonly deviceIdInfoService: DeviceInfoService
  ) {
    this.isBrowser = isPlatformBrowser( platformId );

    // 1) Bootstrap from localStorage (if any)
    this.restoreGuardTokenFromStorage();

    // 2) Live sync from SocketService (BE → FE guard:update)
    this.socketService.guardToken$.subscribe( ( payload ) => {
      if ( !payload ) {
        return;
      }
      this.setGuardToken( payload );
    } );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Called after login: central place to store both tokens.
   * (AuthService should call this instead of writing tokens directly.)
   */
  public updateTokensFromLogin( sessionToken: string, guardToken: string ): void {
    if ( !sessionToken || !sessionToken.trim() ) {
      console.warn( '[HeaderContextService] Empty session token on login update.' );
      return;
    }
    if ( !guardToken || !guardToken.trim() ) {
      console.warn( '[HeaderContextService] Empty guard token on login update.' );
      return;
    }

    this.writeSessionToken( sessionToken.trim() );
    this.writeGuardTokenRaw( guardToken.trim() );

    // Also reflect guard in the live subject
    const now = Date.now();
    const payload: GuardTokenPayload = {
      token: guardToken.trim(),
      issuedAt: now,
      expiresAt: now + 10_000 // we don't know BE TTL here; this is just a soft hint
    };
    this.guardTokenSubject.next( payload );
  }

  /**
   * Clear all auth-related tokens (called on logout).
   */
  public clearAllTokens(): void {
    if ( this.isBrowser ) {
      try {
        localStorage.removeItem( this.STORAGE_KEYS.sessionToken );
        localStorage.removeItem( this.STORAGE_KEYS.guardToken );
        localStorage.removeItem( this.STORAGE_KEYS.deviceId );

      } catch ( error ) {
        console.error( '[HeaderContextService.clearAllTokens] Failed to clear storage:', error );
      }
    }
    this.guardTokenSubject.next( null );
  }

  /**
   * Snapshot for consumers (interceptors, services, etc.).
   *  - Prefers LIVE guard token from Socket
   *  - Falls back to persisted values in localStorage.
   */
  public getTokensSnapshot(): AuthTokenSnapshot {
    const snapshot: AuthTokenSnapshot = {};

    const storedSession = this.readSessionToken();
    if ( storedSession ) {
      snapshot.session = storedSession;
    }

    const liveGuard = this.guardTokenSubject.value;
    if ( liveGuard?.token && liveGuard.token.trim().length > 0 ) {
      snapshot.guard = liveGuard.token.trim();
    } else {
      const storedGuard = this.readGuardTokenRaw();
      if ( storedGuard ) {
        snapshot.guard = storedGuard;
      }
    }

    return snapshot;
  }

  /**
   * Build standard auth headers for outgoing HTTP calls.
   *
   * Example result:
   *  {
   *    Authorization: 'Bearer <session>',
   *    'x-guard-token': '<guard>'
   *  }
   */
  public buildAuthHeaders( extra?: Record<string, string> ): Record<string, string> {
    const tokens = this.getTokensSnapshot();
    const headers: Record<string, string> = {};

    if ( tokens.session ) {
      // 1) Still support AuthMiddleware (Authorization: Bearer ...)
      headers[ 'Authorization' ] = `Bearer ${ tokens.session }`;

      // 2) ALSO support ApiGuard, which expects x-session-token
      headers[ 'x-session-token' ] = tokens.session;

      // 3)  ALSO SET DEVICE ID TO THE HEADER
      headers[ 'x-device-id' ] = this.deviceIdInfoService.getDeviceId()
    }

    if ( tokens.guard ) {
      headers[ 'x-guard-token' ] = tokens.guard;
    }

    if ( extra ) {
      for ( const [ key, value ] of Object.entries( extra ) ) {
        if ( value !== undefined && value !== null ) {
          headers[ key ] = String( value );
        }
      }
    }

    return headers;
  }


  /**
   * Small helper if you ever want to send auth with non-HTTP transports
   * (e.g., STOMP over WebSocket, custom signalling channels, etc.).
   */
  public buildAuthMeta( extra?: Record<string, unknown> ): Record<string, unknown> {
    const tokens = this.getTokensSnapshot();
    const meta: Record<string, unknown> = {};

    if ( tokens.session ) {
      meta[ 'sessionToken' ] = tokens.session;
    }
    if ( tokens.guard ) {
      meta[ 'guardToken' ] = tokens.guard;
    }

    if ( extra ) {
      for ( const [ key, value ] of Object.entries( extra ) ) {
        meta[ key ] = value;
      }
    }

    return meta;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal: guard token management
  // ──────────────────────────────────────────────────────────────────────────

  private setGuardToken( payload: GuardTokenPayload ): void {
    if ( !payload || !payload.token || !payload.token.trim() ) {
      return;
    }
    // Write to storage (safety / refresh)
    this.writeGuardTokenRaw( payload.token.trim() );
    // Update live subject
    this.guardTokenSubject.next( payload );
  }

  private restoreGuardTokenFromStorage(): void {
    const raw = this.readGuardTokenRaw();
    if ( !raw ) {
      return;
    }
    // We don't know original issuedAt/TTL, so we just provide a minimal payload
    const now = Date.now();
    const payload: GuardTokenPayload = {
      token: raw,
      issuedAt: now,
      expiresAt: now + 5_000 // arbitrary; real validity comes from BE
    };
    this.guardTokenSubject.next( payload );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal: localStorage helpers
  // ──────────────────────────────────────────────────────────────────────────

  private readSessionToken(): string | null {
    if ( !this.isBrowser ) {
      return null;
    }
    try {
      const value = localStorage.getItem( this.STORAGE_KEYS.sessionToken );
      return value && value.trim().length > 0 ? value.trim() : null;
    } catch {
      return null;
    }
  }

  private writeSessionToken( token: string ): void {
    if ( !this.isBrowser ) {
      return;
    }
    try {
      localStorage.setItem( this.STORAGE_KEYS.sessionToken, token );
    } catch ( error ) {
      console.error( '[HeaderContextService.writeSessionToken] Failed:', error );
    }
  }

  private readGuardTokenRaw(): string | null {
    if ( !this.isBrowser ) {
      return null;
    }
    try {
      const value = localStorage.getItem( this.STORAGE_KEYS.guardToken );
      return value && value.trim().length > 0 ? value.trim() : null;
    } catch {
      return null;
    }
  }

  private writeGuardTokenRaw( token: string ): void {
    if ( !this.isBrowser ) {
      return;
    }
    try {
      localStorage.setItem( this.STORAGE_KEYS.guardToken, token );
    } catch ( error ) {
      console.error( '[HeaderContextService.writeGuardTokenRaw] Failed:', error );
    }
  }
}
