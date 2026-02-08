// Path: src/app/services/auth/auth.service.ts
// -----------------------------------------------------------------------------
// AuthService
// -----------------------------------------------------------------------------
// Responsibilities
//   - Login / logout / session restore
//   - Local persistence of:
//       * sessionToken (opaque backend session token)
//       * guardToken   (short-lived API guard token)
//       * wsToken      (WebSocket-only token)
//       * encrypted logged user snapshot
//       * "is user logged in" flag
//       * remember-me username/password snapshot
//       * LAST_URL and MFA state
//   - Bootstraps realtime stack ONCE per browser session:
//       1) SocketService       – shared Socket.IO bus for chat/call/notifications
//       2) NotificationService – wires to shared socket, manages notification state
//
// Token & Access Control (current vs. future)
//   - CURRENT:
//       * Uses role-based DEFAULTS as a FRONTEND FALLBACK map
//         (used for quick UI gating, not security).
//   - FUTURE (recommended):
//       * Move ACCESS_OPTIONS + DEFAULT_ROLE_ACCESS to backend.
//       * Backend issues JWT / claims with role + permissions.
//       * Frontend reads from token / user.access to derive permissions.
//       * This service becomes a thin consumer of backend rules.
// -----------------------------------------------------------------------------

import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

import { CryptoService } from '../cryptoService/crypto.service';
import {
  APIsService,
} from '../APIs/apis.service';
import {
  UserSafeDto as User,
  Role,
  DEFAULT_ROLES,
} from './user.contract';
import { ActivityTrackerService } from '../activityTacker/activity-tracker.service';
import { NotificationService } from '../notifications/notification-service';
import { SocketService } from '../socket/socket-service';
import { AdminReportService } from '../adminReportService/admin-report.service';
import {
  ACCESS_OPTIONS,
  AccessModuleOption,
  AccessModuleKey,
  AccessActionKey,
} from '../../source/access-map.source';
import { environment } from '../../../environments/environment';
import type { MSG } from '../../types/api-message.types';
import { DeviceInfoService } from '../deviceInfo/device-info.service';
import { AccessControlService } from '../../core/security/access-control.service';

/* ============================================================================ *
 *  Types: User credentials & access model
 * ========================================================================== */

export interface UserCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface Address {
  street: string;
  houseNumber: string;
  city: string;
  postcode: string;
  country?: string;
  stateOrProvince?: string;
}

export interface TempLoginChallenge {
  userId: string;
  username: User[ 'username' ];

  token: string;          // random challenge token given to FE
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date | null;   // null/undefined = never used, Date = consumed time

  ipAddress?: string;
  userAgent?: string;
}

export type MfaVerificationStatus =
  | 'validated'
  | 'not_validated'
  | 'pending'
  | 'no_mfa'
  | 'unknown';

/**
 * Per-role default access config for FRONTEND FALLBACK:
 *   moduleKey -> list of allowed action IDs
 *
 * This is derived from ACCESS_OPTIONS; can be mirrored to backend later.
 */
type DefaultRoleAccessConfig = Partial<
  Record<AccessModuleKey, ReadonlyArray<AccessActionKey>>
>;

/* ============================================================================ *
 *  AuthService
 * ========================================================================== */

@Injectable( { providedIn: 'root' } )
export class AuthService {
  /** SSR flag – all browser-only code must check this first. */
  private readonly isBrowser: boolean;

  /** Simple runtime flags. */
  private isLoggedIn = false;
  private rememberMe = false;

  /** Raw credentials (last login attempt). */
  private username = '';
  private password = '';
  private user: UserCredentials = {
    username: '',
    password: '',
    rememberMe: false,
  };

  /** Current session user state. */
  private loggedUser: User | null = null;
  private localUser: User | null = null;
  private isValidUser = false;
  private isUserActive = false;

  /** Reserved for admin/operator features. */
  private users: User[] = [];

  /** Realtime bootstrap guard – initialise Sockets + Notifications once. */
  private notificationsInit = false;

  /** LocalStorage keys centralised (avoid typos). */
  private readonly STORAGE_KEYS: Readonly<{
    user: 'ENCRYPED_LOGGED_USER';
    isLoggedIn: 'IS_USER_LOGGED_IN';
    password: 'PASSWORD';
    sessionToken: 'sessionToken';
    guardToken: 'guardToken';
    wsToken: 'wsToken';
    mfaVerify: 'mfa_verify';
    lastUrl: 'LAST_URL';
    rememberUsername: 'REMEMBER_USERNAME';
    deviceId: 'propease_device_id';
  }> = {
    user: 'ENCRYPED_LOGGED_USER',
    isLoggedIn: 'IS_USER_LOGGED_IN',
    password: 'PASSWORD',
    sessionToken: 'sessionToken',
    guardToken: 'guardToken',
      wsToken: 'wsToken',            // WebSocket-only token
      mfaVerify: 'mfa_verify',
      lastUrl: 'LAST_URL',
      rememberUsername: 'REMEMBER_USERNAME',
      deviceId: 'propease_device_id',
  } as const;

  private _temporyChallenge: TempLoginChallenge | null = null;
  private _tempUsername = '';
  private _deviceId: string | null = null;

  /**
   * Cached: for each Role, which MODULE definitions are visible in the UI.
   *   {
   *     admin:   AccessModuleOption[],
   *     agent:   AccessModuleOption[],
   *     ...
   *   }
   */
  private readonly defaultRoleModulesMap: Record<
    Role,
    ReadonlyArray<AccessModuleOption>
  >;

  constructor (
    @Inject( PLATFORM_ID ) platformId: Object,
    private readonly cryptoService: CryptoService,
    private readonly apiService: APIsService,
    private readonly activityTrackerService: ActivityTrackerService,
    private readonly notificationService: NotificationService,
    private readonly socketService: SocketService,
    private readonly router: Router,
    private readonly adminReportService: AdminReportService,
    private readonly deviceInfoService: DeviceInfoService,
    private readonly accessControlService: AccessControlService,
  ) {
    this.isBrowser = isPlatformBrowser( platformId );

    // Precompute which MODULES each role can see in the UI.
    const map = {} as Record<Role, ReadonlyArray<AccessModuleOption>>;
    for ( const role of DEFAULT_ROLES ) {
      map[ role ] = this.filterDefaultAccessBaseRole( role );
    }
    this.defaultRoleModulesMap = map;
  }

  /* ───────────────────── Notification delegates ───────────────────── */

  get notifications$() {
    return this.notificationService.items$;
  }

  get unreadNotifications$() {
    return this.notificationService.unreadNotifications$();
  }

  get unreadNotificationsCount(): number {
    return this.notificationService.unreadCount();
  }

  public markNotificationRead( notificationId: string ): Promise<void> {
    return this.notificationService.markRead( notificationId );
  }

  /* ───────────────────── Getters / Setters ───────────────────────── */

  get getUserCredentials(): UserCredentials | null {
    return this.user ?? null;
  }

  get getLoggedUser(): User | null {
    return this.loggedUser;
  }

  get LocalUser(): User | null {
    return this.localUser;
  }

  get IsActiveUser(): boolean {
    return this.isUserActive;
  }

  get getIsValidUser(): boolean {
    return this.isValidUser;
  }

  get allUsers(): User[] {
    return this.users;
  }

  get isUserLoggedIn(): boolean {
    return this.isLoggedIn;
  }

  get temporyChallenge(): TempLoginChallenge | null {
    return this._temporyChallenge;
  }

  get tempUsername(): string {
    return this._tempUsername;
  }

  get deviceId(): string | null {
    return this._deviceId;
  }

  set deviceId( value: string | null ) {
    this._deviceId = value;
  }

  set tempUsername( value: string ) {
    this._tempUsername = value.trim();
  }

  set temporyChallenge( value: TempLoginChallenge | null ) {
    this._temporyChallenge = value;
  }

  set loginUserCredentials( user: UserCredentials ) {
    this.username = user.username;
    this.password = user.password;
    this.rememberMe = user.rememberMe ?? false;
    this.user = user;
  }

  set isUserLoggedIn( value: boolean ) {
    this.isLoggedIn = value;
  }

  set setLoggedUser( user: User | null ) {
    this.loggedUser = user;
  }

  set logginUser( user: UserCredentials ) {
    this.user = user;
  }

  /* ============================================================================ *
   *  High-level login API (for LoginComponent)
   * ========================================================================== */

  /**
   * High-level login API for LoginComponent.
   * Responsibilities:
   *  - Validate input
   *  - Call sendVerifyUser()
   *  - Handle remember-me snapshot
   *  - Branch MFA vs normal login
   *  - On normal login, call assignToken(), afterUserLoggedInOperations()
   */
  public async loginWithCredentials(
    username: string,
    password: string,
    rememberMe: boolean,
  ): Promise<{
    success: boolean;
    mfaRequired?: boolean;
    challenge?: TempLoginChallenge | null;
    redirectUrl?: string;
    errorMessage?: string;
  }> {
    try {
      const trimmedUsername: string = username.trim();
      const rawPassword: string = password;

      if ( !trimmedUsername || !rawPassword ) {
        return {
          success: false,
          errorMessage: 'Username and password are required.',
        };
      }

      // Store a temporary username snapshot for MFA flows (encrypted).
      if ( this.isBrowser ) {
        try {
          const encryptedUsername = await this.cryptoService.encrypt( trimmedUsername );
          if ( encryptedUsername ) {
            localStorage.setItem( 'tempUsername', encryptedUsername );
          }
        } catch ( err ) {
          console.error( '[Error:] [AuthService.loginWithCredentials] Failed to store tempUsername: ', err, '\n' );
        }
      }

      // Update internal state
      this.loginUserCredentials = {
        username: trimmedUsername,
        password: rawPassword,
        rememberMe,
      };

      const res: MSG | null = await this.sendVerifyUser();

      if ( !res || !res.success ) {
        const msg: string =
          res?.message ?? 'Failed to validate user credentials.';
        await this.clearCredentials();
        return {
          success: false,
          errorMessage: msg,
        };
      }

      // Credentials are valid → handle remember-me snapshot
      await this.storeRememberMeSnapshot( trimmedUsername, rawPassword, rememberMe );

      // MFA branch (no full session yet)
      const mfaRequired: boolean | null =
        this.apiService.extractBooleanFromOther( res.data, 'mfaRequired' );
      const challenge =
        this.apiService.extractObjectFromOther<TempLoginChallenge>(
          res.data,
          'challenge',
        );

      const deviceIdFromRes = this.apiService.extractStringFromOther( res.data, 'deviceId' );

      if ( mfaRequired === true && challenge ) {
        this.tempUsername = trimmedUsername;
        this.temporyChallenge = challenge;

        // Prefer deviceId from backend, fallback to local generator
        const effectiveDeviceId: string = deviceIdFromRes || this.deviceInfoService.getDeviceId();

        this.deviceId = effectiveDeviceId;

        if ( this.isBrowser && effectiveDeviceId ) {
          localStorage.setItem( this.STORAGE_KEYS.deviceId, effectiveDeviceId );
        }

        const encryptedChallenge = await this.cryptoService.encrypt( challenge );

        if ( !encryptedChallenge ) {
          throw new Error( 'Failed to encrypt login challenge!' );
        }

        if ( this.isBrowser ) {
          localStorage.setItem( 'temp-change', encryptedChallenge );
          localStorage.setItem( this.STORAGE_KEYS.mfaVerify, 'pending' );
        }

        return {
          success: true,
          mfaRequired: true,
          challenge,
        };
      }

      // Normal login flow – tokens + session
      await this.assignToken( res );

      if ( this.isBrowser ) {
        // Default entry point after login
        localStorage.setItem( this.STORAGE_KEYS.lastUrl, '/dashboard/home' );
      }

      return {
        success: true,
        mfaRequired: false,
        redirectUrl: '/dashboard/home',
      };
    } catch ( error: any ) {
      console.error( '[Error:] [AuthService.loginWithCredentials] ', error, '\n' );
      await this.clearCredentials();
      return {
        success: false,
        errorMessage:
          error?.message || 'Unexpected error occurred during login.',
      };
    }
  }

  /**
   * Bootstrap helper for LoginComponent:
   *  1) Try auto-login from storage.
   *  2) If auto-login fails, try to pre-fill remembered credentials.
   */
  public async bootstrapLoginView(): Promise<{
    autoLoggedIn: boolean;
    redirectUrl?: string;
    remembered?: UserCredentials | null;
  }> {
    const auto = await this.tryAutoLoginFromStorage();

    if ( auto.autoLoggedIn ) {
      return {
        autoLoggedIn: true,
        redirectUrl: auto.redirectUrl,
        remembered: null,
      };
    }

    const remembered = await this.getRememberedCredentials();

    return {
      autoLoggedIn: false,
      remembered,
    };
  }

  /* ============================================================================ *
   *  Low-level login flow (called internally)
   * ========================================================================== */

  /**
   * Main login entry.
   *  - Calls backend `verifyUser`
   */
  public async sendVerifyUser(): Promise<MSG | null> {
    try {
      if ( !this.user?.username || !this.user?.password ) {
        throw new Error(
          'Login data is missing. Please provide username & password.',
        );
      }

      const deviceId = this.deviceInfoService.getDeviceId();

      const payload = {
        username: this.user.username,
        password: this.user.password,
        deviceId,
      };

      const response = await this.apiService.login( payload, {
        'x-device-id': deviceId,
      } );

      if ( !response || response.status !== 'success' ) {
        throw new Error( 'Invalid credentials or login failed.' );
      }

      // Persist deviceId in storage so auto-login can validate device.
      if ( this.isBrowser && deviceId ) {
        localStorage.setItem( this.STORAGE_KEYS.deviceId, deviceId );
      }

      this.deviceId = deviceId;

      return response;
    } catch ( error ) {
      console.error( '[Error:] [AuthService.sendVerifyUser] Login failed: ', error, '\n' );
      // Best-effort cleanup – robust against half-broken sessions
      this.clearCredentials().catch( ( err ) =>
        console.error( '[Error:] [AuthService.sendVerifyUser] cleanup after failure: ', err, '\n' ),
      );
      return null;
    }
  }

  /**
   * Submit MFA code + challenge token.
   */
  public async submitOnMFA( data: { token: string; code: string; } ): Promise<MSG> {
    if ( !data ) {
      throw new Error( 'Invalid data!' );
    }

    const safeToken = String( data.token ?? '' ).trim();
    const safeCode = String( data.code ?? '' ).trim();
    const effectiveDeviceId = this.deviceId ?? this.deviceInfoService.getDeviceId();

    if ( !safeToken ) {
      throw new Error( 'Invalid token!' );
    }

    if ( !safeCode ) {
      throw new Error( 'Invalid code' );
    }

    if ( !effectiveDeviceId ) {
      throw new Error( 'Invalid device ID' );
    }

    const payload: {
      code: string;
      token: string;
      deviceId: string;
    } = {
      code: safeCode,
      token: safeToken,
      deviceId: effectiveDeviceId,
    };

    // Persist deviceId if not stored yet
    if ( this.isBrowser && effectiveDeviceId ) {
      localStorage.setItem( this.STORAGE_KEYS.deviceId, effectiveDeviceId );
    }

    return await this.apiService.mfaUserVerify( payload );
  }

  /**
   * Consume the login response:
   *  - Set in-memory user
   *  - Extract & persist tokens
   *  - Initialise realtime
   *  - Persist encrypted snapshot
   *  - Run final active-user guard
   */
  public async assignToken( response: MSG ): Promise<void> {
    try {
      if ( !response ) {
        throw new Error( 'Invalid response!' );
      }

      const user: User | undefined = response.data?.system?.user;
      if ( !user ) {
        throw new Error( 'User payload is missing in login response.' );
      }

      this.accessControlService.setUser( user );

      // Store in-memory state
      this.setLoggedUser = user;
      this.localUser = user;
      this.isUserLoggedIn = true;
      this.isValidUser = true;
      this.isUserActive = !!user.isActive;

      // Extract & persist tokens
      const sessionToken = this.apiService.extractStringFromOther(
        response.data,
        'sessionToken',
      );
      const guardToken = this.apiService.extractStringFromOther(
        response.data,
        'guardToken',
      );

      // WebSocket-only token (optional)
      const wsToken = this.apiService.extractStringFromOther(
        response.data,
        'wsToken',
      );

      const mfaVerify = this.apiService.extractBooleanFromOther(
        response.data,
        'mfaVerify',
      );

      if ( !sessionToken || !guardToken ) {
        throw new Error( 'Auth tokens are missing in login response.' );
      }

      if ( !wsToken ) {
        console.warn(
          '[Warning:] [AuthService.assignToken] wsToken is missing in login response – WebSocket handshake may fall back.\n',
        );
      }

      this.writeTokenToStorage( sessionToken, guardToken, wsToken, mfaVerify );

      // Boot realtime layers (will use sessionToken + wsToken from storage)
      this.initRealtimeIfNeeded();

      // Persist encrypted snapshot (user only)
      await this.afterUserLoggedInOperations();

      // Final guard on isActive
      await this.finalInitialGuard( user );
    } catch ( error ) {
      console.error( '[Error:] [AuthService.assignToken] Failed to assign tokens: ', error, '\n' );
    }
  }

  /* ============================================================================ *
   *  Type guards
   * ========================================================================== */

  /**
   * Runtime type guard for User / User[]
   */
  public isUsersType( data: unknown ): data is User[] | User {
    const isOne = ( item: any ): boolean =>
      item &&
      typeof item.name === 'string' &&
      typeof item.username === 'string' &&
      typeof item.email === 'string' &&
      ( item.dateOfBirth === null ||
        typeof item.dateOfBirth === 'string' ||
        item.dateOfBirth instanceof Date ) &&
      typeof item.age === 'number' &&
      ( typeof item.image === 'string' || item.image instanceof File ) &&
      (
        typeof item.phoneNumber === 'string' ||
        typeof item.phoneNumber === 'undefined' ||
        (
          item.phoneNumber &&
          typeof item.phoneNumber === 'object' &&
          typeof item.phoneNumber.number === 'string'
        )
      ) &&
      typeof item.bio === 'string' &&
      DEFAULT_ROLES.includes( item.role as Role ) &&
      typeof item.gender === 'string' &&
      item.address &&
      typeof item.address === 'object' &&
      typeof item.address.street === 'string' &&
      typeof item.address.houseNumber === 'string' &&
      typeof item.address.city === 'string' &&
      typeof item.address.postcode === 'string' &&
      ( typeof item.address.country === 'string' ||
        typeof item.address.country === 'undefined' ) &&
      ( typeof item.address.stateOrProvince === 'string' ||
        typeof item.address.stateOrProvince === 'undefined' ) &&
      typeof item.isActive === 'boolean' &&
      item.access &&
      typeof item.access === 'object' &&
      typeof item.access.role === 'string' &&
      Array.isArray( item.access.permissions ) &&
      item.access.permissions.every(
        ( perm: any ) =>
          perm &&
          typeof perm.module === 'string' &&
          Array.isArray( perm.actions ) &&
          perm.actions.every( ( action: any ) => typeof action === 'string' ),
      ) &&
      typeof item.creator === 'string' &&
      ( typeof item.updator === 'string' ||
        typeof item.updator === 'undefined' ) &&
      ( typeof item.createdAt === 'string' ||
        item.createdAt instanceof Date ) &&
      ( typeof item.updatedAt === 'string' ||
        item.updatedAt instanceof Date );

    return Array.isArray( data ) ? data.every( isOne ) : isOne( data );
  }

  /* ============================================================================ *
   *  Post-login persistence
   * ========================================================================== */

  /**
   * Persist encrypted user snapshot into localStorage.
   *  This is called after successful login.
   */
  public async afterUserLoggedInOperations(): Promise<void> {
    if ( !this.isBrowser ) {
      return;
    }

    const baseUser = this.localUser ?? this.loggedUser;

    if ( !this.isValidUser || !baseUser ) {
      return;
    }

    try {
      // Always store encrypted user snapshot + login flag
      const encryptedUser = await this.cryptoService.encrypt( baseUser );

      if ( encryptedUser ) {
        localStorage.setItem( this.STORAGE_KEYS.user, encryptedUser );
        localStorage.setItem( this.STORAGE_KEYS.isLoggedIn, 'true' );
      }
      // Remember-me password is handled separately by storeRememberMeSnapshot()
    } catch ( error ) {
      console.error( '[Error:] [AuthService.afterUserLoggedInOperations] ', error, '\n' );
    }
  }

  /**
   * Store or clear remember-me snapshot (username + password).
   * This is ONLY for pre-filling the login form.
   * It does NOT control session validity.
   */
  private async storeRememberMeSnapshot(
    username: string,
    password: string,
    rememberMe: boolean,
  ): Promise<void> {
    if ( !this.isBrowser ) {
      return;
    }

    if ( !rememberMe ) {
      await this.clearRememberMeSnapshot();
      return;
    }

    const safeUsername: string = username.trim();
    const safePassword: string = password;

    if ( !safeUsername || !safePassword ) {
      await this.clearRememberMeSnapshot();
      return;
    }

    try {
      const [ encUsername, encPassword ] = await Promise.all( [
        this.cryptoService.encrypt( safeUsername ),
        this.cryptoService.encrypt( safePassword ),
      ] );

      if ( encUsername ) {
        localStorage.setItem( this.STORAGE_KEYS.rememberUsername, encUsername );
      }

      if ( encPassword ) {
        localStorage.setItem( this.STORAGE_KEYS.password, encPassword );
      }
    } catch ( error ) {
      console.error( '[Error:] [AuthService.storeRememberMeSnapshot] ', error, '\n' );
      await this.clearRememberMeSnapshot();
    }
  }

  /**
   * Remove remember-me username/password from storage.
   */
  private async clearRememberMeSnapshot(): Promise<void> {
    if ( !this.isBrowser ) {
      return;
    }

    try {
      localStorage.removeItem( this.STORAGE_KEYS.rememberUsername );
      localStorage.removeItem( this.STORAGE_KEYS.password );
    } catch ( error ) {
      console.error( '[Error:] [AuthService.clearRememberMeSnapshot] ', error, '\n' );
    }
  }

  /**
   * Load remembered credentials (if any) for login pre-fill.
   * Returns null if nothing valid is stored.
   */
  public async getRememberedCredentials(): Promise<UserCredentials | null> {
    if ( !this.isBrowser ) {
      return null;
    }

    const encUsername: string | null =
      localStorage.getItem( this.STORAGE_KEYS.rememberUsername );
    const encPassword: string | null =
      localStorage.getItem( this.STORAGE_KEYS.password );

    if ( !encUsername || !encPassword ) {
      return null;
    }

    try {
      const [ decUsername, decPassword ] = await Promise.all( [
        this.cryptoService.decrypt( encUsername ),
        this.cryptoService.decrypt( encPassword ),
      ] );

      if ( !decUsername || !decPassword ) {
        return null;
      }

      return {
        username: String( decUsername ),
        password: String( decPassword ),
        rememberMe: true,
      };
    } catch ( error ) {
      console.error( '[Error:] [AuthService.getRememberedCredentials] ', error, '\n' );
      return null;
    }
  }

  /* ============================================================================ *
   *  Session restore (auto-login / app bootstrap)
   * ========================================================================== */

  /**
   * Try to restore a full session from localStorage.
   * Conditions:
   *  - sessionToken + ENCRYPED_LOGGED_USER must exist
   *  - If mfaVerify is present and not "validated"/"no_mfa" → abort
   *  - deviceId must be present (bind session to device)
   */
  private async tryAutoLoginFromStorage(): Promise<{
    autoLoggedIn: boolean;
    redirectUrl?: string;
  }> {
    if ( !this.isBrowser ) {
      return { autoLoggedIn: false };
    }

    try {
      const sessionToken: string | null =
        localStorage.getItem( this.STORAGE_KEYS.sessionToken );
      const encLoggedUser: string | null =
        localStorage.getItem( this.STORAGE_KEYS.user );
      const isLoggedFlag: string | null =
        localStorage.getItem( this.STORAGE_KEYS.isLoggedIn );
      const mfaVerify: string | null =
        localStorage.getItem( this.STORAGE_KEYS.mfaVerify );
      const lastUrlRaw: string | null =
        localStorage.getItem( this.STORAGE_KEYS.lastUrl );
      const storedDeviceId: string | null =
        localStorage.getItem( this.STORAGE_KEYS.deviceId );

      if ( !sessionToken || !encLoggedUser ) {
        return { autoLoggedIn: false };
      }

      if ( isLoggedFlag !== null && isLoggedFlag !== 'true' ) {
        return { autoLoggedIn: false };
      }

      if (
        mfaVerify !== null &&
        mfaVerify !== 'validated' &&
        mfaVerify !== 'no_mfa'
      ) {
        return { autoLoggedIn: false };
      }

      if ( !storedDeviceId ) {
        return { autoLoggedIn: false };
      }

      const decryptedUser =
        ( await this.cryptoService.decrypt( encLoggedUser ) ) as User | null;

      if ( !decryptedUser || !decryptedUser.username?.trim() ) {
        return { autoLoggedIn: false };
      }

      if ( decryptedUser.isActive === false ) {
        return { autoLoggedIn: false };
      }

      // Restore into AuthService
      this.loggedUser = decryptedUser;
      this.localUser = decryptedUser;
      this.isLoggedIn = true;
      this.isValidUser = true;
      this.isUserActive = !!decryptedUser.isActive;
      this._deviceId = storedDeviceId;

      // Boot realtime (will use tokens from storage)
      this.initRealtimeIfNeeded();

      // ─────────────────────────────────────────────────────────────
      // Ignore public/auth routes when picking redirect target
      // ─────────────────────────────────────────────────────────────
      const safeLastUrl: string = ( lastUrlRaw ?? '' ).trim();

      const isPublicRoute: boolean =
        !safeLastUrl ||
        safeLastUrl === '/' ||
        safeLastUrl === '/login' ||
        safeLastUrl.startsWith( '/mfa' ) ||
        safeLastUrl.startsWith( '/auth' );

      const targetUrl: string = isPublicRoute
        ? '/dashboard/home'
        : safeLastUrl;

      return {
        autoLoggedIn: true,
        redirectUrl: targetUrl,
      };
    } catch ( error ) {
      console.error( '[Error:] [AuthService.tryAutoLoginFromStorage] ', error, '\n' );
      return { autoLoggedIn: false };
    }
  }

  /**
   * Generic restore (for places that still call it directly).
   */
  public async getLocalLoggedUser(): Promise<User | null> {
    if ( !this.isBrowser ) {
      return null;
    }

    const encrypted = localStorage.getItem( this.STORAGE_KEYS.user );
    if ( !encrypted ) {
      return null;
    }

    try {
      const decryptedUser = ( await this.cryptoService.decrypt(
        encrypted,
      ) ) as User;
      this.localUser = decryptedUser;
      this.loggedUser = decryptedUser;
      this.isUserActive = !!decryptedUser.isActive;
      this.isValidUser = true;
      this.isLoggedIn = true;

      // Boot realtime on restore – guarded by tokens inside initRealtimeIfNeeded
      this.initRealtimeIfNeeded();

      return decryptedUser;
    } catch ( error ) {
      console.error( '[Error:] [AuthService.getLocalLoggedUser] decrypt failed: ', error, '\n' );
      return null;
    }
  }

  /* ============================================================================ *
   *  Activity tracker
   * ========================================================================== */

  public async insertLoggedUserTracks(): Promise<void> {
    try {
      const date = new Date();
      const data = { username: this.user?.username, date };
      await this.activityTrackerService.saveLoggedUserDataToTracking( data );
    } catch ( error ) {
      console.error( '[Error:] [AuthService.insertLoggedUserTracks] ', error, '\n' );
    }
  }

  /* ============================================================================ *
   *  Realtime bootstrap (Sockets + Notifications)
   * ========================================================================== */

  /**
   * Resolve backend HTTP base from APIsService or environment.
   */
  private resolveApiBase(): string {
    if ( !this.isBrowser ) {
      return '';
    }

    const anyAPIs = this.apiService as any;

    const base =
      anyAPIs.apiBase ??
      anyAPIs.baseUrl ??
      anyAPIs.API_BASE ??
      environment.apiOrigin;

    return String( base ).replace( /\/+$/, '' );
  }

  /**
   * Initialise Socket.IO bus + NotificationService.
   *  - Idempotent: runs ONCE per browser session (notificationsInit flag).
   */
  private initRealtimeIfNeeded(): void {
    try {
      if ( !this.isBrowser || this.notificationsInit ) {
        return;
      }

      // Always read the canonical token bundle from localStorage.
      const tokenBundle = this.readTokenFromStorage();

      const sessionToken: string | undefined = tokenBundle?.session;
      const wsToken: string | undefined = tokenBundle?.wsToken;

      if ( !sessionToken ) {
        throw new Error(
          '[AuthService] initRealtimeIfNeeded: no session token found, skipping realtime init',
        );
      }

      const apiBase = this.resolveApiBase();
      if ( !apiBase ) {
        throw new Error(
          '[AuthService] initRealtimeIfNeeded: no apiBase, skipping realtime init',
        );
      }

      const wsBase = apiBase;

      // For now, "tokenProvider" just re-reads the session token from storage.
      const tokenProvider = (): string =>
        this.readTokenFromStorage()?.session ?? '';

      // ── Socket.IO: use sessionToken + wsToken for handshake ──────────────
      this.socketService.init( {
        wsBase,
        token: sessionToken,          // same opaque token as HTTP APIs
        sessionToken: sessionToken,
        wsToken,
        tokenProvider,
      } );

      // ── Notification service: HTTP + (optional) WS integration ───────────
      this.notificationService.initConnection( {
        wsBase,
        token: sessionToken,
        tokenProvider,
      } );

      // Initial pull of notifications (guarded by ApiGuard)
      this.notificationService
        .load( { limit: 20 } )
        .catch( ( err ) =>
          console.warn(
            '[Warning:] [AuthService] initial notification load failed: ',
            err,
            '\n',
          ),
        );

      this.notificationsInit = true;
    } catch ( error ) {
      console.error( '[Error:] [AuthService] Failed to initialise notification: ', error, '\n' );
    }
  }

  /**
   * getMfaVerificationStatus
   * ------------------------
   * Returns the MFA verification state for the CURRENT session.
   */
  public getMfaVerificationStatus(): MfaVerificationStatus {
    if ( !this.isBrowser ) {
      return 'unknown';
    }

    const user = this.loggedUser ?? this.localUser ?? null;

    if ( !user || !user.multiAuthEnabled ) {
      return 'no_mfa';
    }

    const raw = localStorage.getItem( this.STORAGE_KEYS.mfaVerify );

    if ( !raw ) {
      return 'pending';
    }

    const value = raw.trim().toLowerCase();

    switch ( value ) {
      case 'validated':
        return 'validated';
      case 'not_validated':
        return 'not_validated';
      case 'pending':
        return 'pending';
      case 'no_mfa':
        return 'no_mfa';
      default:
        return 'unknown';
    }
  }

  /* ============================================================================ *
   *  Cleanup (logout)
   * ========================================================================== */

  /**
   * Full logout:
   *  - Backend /logout is BEST-EFFORT (idempotent)
   *  - Clears encrypted snapshot & flags from localStorage
   *  - Clears sessionToken + guardToken + wsToken
   *  - Disconnects realtime layers
   *  - Always clears in-memory state (even if something fails)
   */
  public async clearCredentials(): Promise<void> {
    const failures: string[] = [];

    const username: string =
      this.localUser?.username ??
      this.loggedUser?.username ??
      '';

    try {
      // 1) Backend logout – BEST EFFORT only
      try {
        const res = await this.apiService.logout();

        if ( !res?.success || res.status !== 'success' ) {
          console.warn(
            '[Warning:] [AuthService.clearCredentials] Backend logout reported failure: ',
            res,
            '\n',
          );
        }
      } catch ( err ) {
        console.warn(
          '[Warning:] [AuthService.clearCredentials] Backend logout threw error: ',
          err,
          '\n',
        );
      }

      // 2) LocalStorage cleanup + anomaly reporting
      if ( this.isBrowser ) {
        // 2.1 Attempt removals
        localStorage.removeItem( this.STORAGE_KEYS.user );
        localStorage.removeItem( this.STORAGE_KEYS.isLoggedIn );
        localStorage.removeItem( this.STORAGE_KEYS.password );
        localStorage.removeItem( this.STORAGE_KEYS.sessionToken );
        localStorage.removeItem( this.STORAGE_KEYS.guardToken );
        localStorage.removeItem( this.STORAGE_KEYS.wsToken );
        localStorage.removeItem( this.STORAGE_KEYS.mfaVerify );
        localStorage.removeItem( this.STORAGE_KEYS.lastUrl );
        localStorage.removeItem( this.STORAGE_KEYS.rememberUsername );
        localStorage.removeItem( this.STORAGE_KEYS.deviceId );

        // Temporary data that needs to be handled
        localStorage.removeItem( 'preferred-mode' );
        localStorage.removeItem( 'LAST_URL' );
        localStorage.removeItem( 'temp-change' );
        localStorage.removeItem( 'tempUsername' );

        // 2.2 Validate each key and report anomalies

        // 2.2.1 User object
        const storedUser = localStorage.getItem( this.STORAGE_KEYS.user );
        if ( storedUser !== null ) {
          try {
            await this.adminReportService.reportCleanUser( username );
          } catch ( err ) {
            console.warn(
              '[Warning:] [AuthService.clearCredentials] reportCleanUser failed: ',
              err,
              '\n',
            );
          }
          failures.push( 'user' );
        }

        // 2.2.2 Login status flag
        const storedLogin = localStorage.getItem(
          this.STORAGE_KEYS.isLoggedIn,
        );
        if ( storedLogin !== null ) {
          const actualStatus: boolean = storedLogin === 'true';
          try {
            await this.adminReportService.reportLoginStatusFailure(
              username,
              false,        // expected: logged out
              actualStatus, // actual value in storage
            );
          } catch ( err ) {
            console.warn(
              '[Warning:] [AuthService.clearCredentials] reportLoginStatusFailure failed: ',
              err,
              '\n',
            );
          }
          failures.push( 'loginStatus' );
        }

        // 2.2.3 Password snapshot
        const storedPassword = localStorage.getItem(
          this.STORAGE_KEYS.password,
        );
        if ( storedPassword !== null ) {
          try {
            await this.adminReportService.reportCleanPassword( username );
          } catch ( err ) {
            console.warn(
              '[Warning:] [AuthService.clearCredentials] reportCleanPassword failed: ',
              err,
              '\n',
            );
          }
          failures.push( 'password' );
        }

        // 2.2.4 Tokens (session + guard + ws)
        const storedSessionToken = localStorage.getItem(
          this.STORAGE_KEYS.sessionToken,
        );
        const storedGuardToken = localStorage.getItem(
          this.STORAGE_KEYS.guardToken,
        );
        const storedWsToken = localStorage.getItem(
          this.STORAGE_KEYS.wsToken,
        );

        if (
          storedSessionToken !== null ||
          storedGuardToken !== null ||
          storedWsToken !== null
        ) {
          try {
            await this.adminReportService.reportCleanToken( username );
          } catch ( err ) {
            console.warn(
              '[Warning:] [AuthService.clearCredentials] reportCleanToken failed: ',
              err,
              '\n',
            );
          }
          failures.push( 'token' );
        }
      }

      if ( failures.length > 0 ) {
        console.error(
          '[Error:] [AuthService.clearCredentials] Storage cleanup anomalies: ',
          failures.join( ', ' ),
          '\n',
        );
      }
    } catch ( error ) {
      console.error(
        '[Error:] [AuthService.clearCredentials] Unexpected error during logout: ',
        error,
        '\n',
      );
    } finally {
      // 3) ALWAYS clear in-memory state & realtime, even if something above failed
      this.user = { username: '', password: '', rememberMe: false };
      this.username = '';
      this.password = '';
      this.isLoggedIn = false;
      this.isValidUser = false;
      this.isUserActive = false;
      this.setLoggedUser = null;
      this.localUser = null;
      this._tempUsername = '';
      this._temporyChallenge = null;
      this._deviceId = null;
      this.accessControlService.setUser( null );

      this.notificationService.disconnect();
      this.socketService.disconnect();
      this.notificationsInit = false;
    }
  }

  /* ============================================================================ *
   *  Guards & access helpers
   * ========================================================================== */

  private async finalInitialGuard( user: User ): Promise<void> {
    try {
      if ( !user ) {
        throw new Error( 'Invalid login data, please try again later.' );
      }

      const isActive: boolean = !!user.isActive;

      if ( !isActive ) {
        throw new Error(
          'Login privileges are denied – user is inactive.',
        );
      }

      return;
    } catch ( error ) {
      console.error( '[Error:] [AuthService.finalInitialGuard] Failed: ', error, '\n' );
      await this.clearCredentials();
      this.router.navigate( [ '/' ] );
      return;
    }
  }

  public filterModules(
    modules?: AccessModuleKey[],
  ): ReadonlyArray<AccessModuleOption> {
    if ( !Array.isArray( modules ) || modules.length === 0 ) {
      return ACCESS_OPTIONS;
    }

    const wanted = new Set<AccessModuleKey>( modules );
    return ACCESS_OPTIONS.filter( ( m ) =>
      wanted.has( m.module as AccessModuleKey ),
    );
  }

  public filterDefaultAccessBaseRole(
    role: Role,
  ): ReadonlyArray<AccessModuleOption> {
    switch ( role ) {
      case 'admin': {
        return this.filterModules();
      }

      case 'agent': {
        const permitModules: AccessModuleKey[] = [
          'PropertyManagement',
          'TenantManagement',
          'NotificationCenter',
        ];
        return this.filterModules( permitModules );
      }

      case 'manager': {
        const permitModules: AccessModuleKey[] = [
          'UserManagement',
          'PropertyManagement',
          'TenantManagement',
          'NotificationCenter',
          'AuditLogs',
        ];
        return this.filterModules( permitModules );
      }

      case 'operator': {
        const permitModules: AccessModuleKey[] = [
          'UserManagement',
          'PropertyManagement',
          'TenantManagement',
          'NotificationCenter',
        ];
        return this.filterModules( permitModules );
      }

      default: {
        const permitModules: AccessModuleKey[] = [
          'TenantManagement',
          'NotificationCenter',
        ];
        return this.filterModules( permitModules );
      }
    }
  }

  private buildDefaultRoleAccessConfig(
    role: Role,
  ): DefaultRoleAccessConfig {
    const visibleModules = this.filterDefaultAccessBaseRole( role );
    const config: DefaultRoleAccessConfig = {};

    for ( const { module, actions } of visibleModules ) {
      const moduleKey = module as AccessModuleKey;
      const actionIds = actions.map(
        ( action ) => action.id as AccessActionKey,
      );
      config[ moduleKey ] = actionIds;
    }

    return config;
  }

  public publishDefaultRoleAccessMap(): Record<
    Role,
    ReadonlyArray<AccessModuleOption>
  > {
    return this.defaultRoleModulesMap;
  }

  public getDefaultAccessByRole(
    role: Role,
  ): Record<AccessModuleKey, Record<AccessActionKey, boolean>> {
    const allowedForRole: DefaultRoleAccessConfig =
      this.buildDefaultRoleAccessConfig( role );

    const matrix: Record<
      AccessModuleKey,
      Record<AccessActionKey, boolean>
    > = {} as Record<
      AccessModuleKey,
      Record<AccessActionKey, boolean>
    >;

    for ( const { module, actions } of ACCESS_OPTIONS ) {
      const moduleKey = module as AccessModuleKey;

      const allowedActionsForModule: readonly AccessActionKey[] =
        allowedForRole[ moduleKey ] ?? [];

      const flags: Record<AccessActionKey, boolean> =
        {} as Record<AccessActionKey, boolean>;

      for ( const { id } of actions ) {
        const actionKey = id as AccessActionKey;
        flags[ actionKey ] = allowedActionsForModule.includes( actionKey );
      }

      matrix[ moduleKey ] = flags;
    }

    return matrix;
  }

  public getDefaultAccessByModel( _module: string ): void {
    // reserved for future per-module defaults
  }

  /* ============================================================================ *
   *  Token helpers (localStorage)
   * ========================================================================== */

  private readTokenFromStorage():
    | { session: string; guard: string; wsToken?: string; }
    | null {
    if ( !this.isBrowser ) {
      return null;
    }

    const sessionToken =
      localStorage.getItem( this.STORAGE_KEYS.sessionToken ) ?? null;
    const guardToken =
      localStorage.getItem( this.STORAGE_KEYS.guardToken ) ?? null;
    const wsToken =
      localStorage.getItem( this.STORAGE_KEYS.wsToken ) ?? null;

    if ( sessionToken && guardToken ) {
      return {
        session: sessionToken,
        guard: guardToken,
        wsToken: wsToken ?? undefined,
      };
    }

    return null;
  }

  private writeTokenToStorage(
    session: string,
    guard: string,
    wsToken?: string | null,
    mfaValidation?: boolean | null,
  ): void {
    if ( !this.isBrowser ) {
      return;
    }

    if ( !session?.trim() || !guard?.trim() ) {
      console.warn(
        '[Warning:] [AuthService] Attempted to write empty tokens to storage.\n',
      );
      return;
    }

    localStorage.setItem( this.STORAGE_KEYS.sessionToken, session.trim() );
    localStorage.setItem( this.STORAGE_KEYS.guardToken, guard.trim() );

    if ( wsToken && wsToken.trim().length > 0 ) {
      localStorage.setItem( this.STORAGE_KEYS.wsToken, wsToken.trim() );
    }

    if ( this.loggedUser?.multiAuthEnabled ) {
      if ( mfaValidation === true ) {
        localStorage.setItem( this.STORAGE_KEYS.mfaVerify, 'validated' );
      } else if ( mfaValidation === false ) {
        localStorage.setItem( this.STORAGE_KEYS.mfaVerify, 'not_validated' );
      } else {
        localStorage.setItem( this.STORAGE_KEYS.mfaVerify, 'pending' );
      }
    } else {
      localStorage.setItem( this.STORAGE_KEYS.mfaVerify, 'no_mfa' );
    }
  }
}
