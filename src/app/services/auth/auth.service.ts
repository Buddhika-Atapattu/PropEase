// src/app/services/auth/auth.service.ts
// -----------------------------------------------------------------------------
// AuthService
// -----------------------------------------------------------------------------
// Responsibilities
//   - Login / logout / session restore
//   - Local persistence of:
//       * sessionToken (JWT from backend)
//       * encrypted logged user snapshot
//       * "is user logged in" flag
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
//       * Backend issues JWT with role + permission claims.
//       * Frontend reads from token / user.access to derive permissions.
//       * This service becomes a thin consumer of backend rules.
// -----------------------------------------------------------------------------

import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

import { CryptoService } from '../cryptoService/crypto.service';
import { APIsService, User, Role, DEFAULT_ROLES, ROLE_ACCESS_MAP, PermissionEntry } from '../APIs/apis.service';
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

/* ============================================================================
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


/**
 * Per-role default access config for FRONTEND FALLBACK:
 *   moduleKey -> list of allowed action IDs
 *
 * This is derived from ACCESS_OPTIONS; can be mirrored to backend later.
 */
type DefaultRoleAccessConfig = Partial<
  Record<AccessModuleKey, ReadonlyArray<AccessActionKey>>
>;

/* ============================================================================
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
  private readonly STORAGE_KEYS = {
    user: 'ENCRYPED_LOGGED_USER',
    isLoggedIn: 'IS_USER_LOGGED_IN',
    password: 'PASSWORD',
    sessionToken: 'sessionToken',
    guardToken: 'guardToken',
  } as const;


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

  markNotificationRead( notificationId: string ): Promise<void> {
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

  /* ============================================================================
   *  Login flow
   * ========================================================================== */

  /**
   * Main login entry.
   *  - Calls backend `verifyUser`
   *  - Stores token in localStorage
   *  - Persists encrypted user snapshot
   *  - Boots realtime stack
   */
  public async sendVerifyUser(): Promise<boolean> {
    try {
      if ( !this.user?.username || !this.user?.password ) {
        throw new Error( 'Login data is missing. Please provide username & password.' );
      }

      const payload = {
        username: this.user.username,
        password: this.user.password,
      };

      const response = await this.apiService.login( payload );


      if ( !response || response.status !== 'success' ) {
        throw new Error( 'Invalid credentials or login failed.' );
      }

      const user: User | undefined = response.data?.system?.user;
      if ( !user ) {
        throw new Error( 'User payload is missing in login response.' );
      }

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


      if ( !sessionToken || !guardToken ) {
        throw new Error( 'Auth tokens are missing in login response.' );
      }


      this.writeTokenToStorage( sessionToken, guardToken );

      // Boot realtime layers
      this.initRealtimeIfNeeded();

      // Persist encrypted snapshot (user + password)
      await this.afterUserLoggedInOperatios();

      // Final guard on isActive
      await this.finalInitialGuard( user );

      const isActive = response.data?.system?.user?.isActive;
      return !!isActive;
    } catch ( error ) {
      console.error( '[AuthService.sendVerifyUser] Login failed', error );
      this.clearCredentials();
      return false;
    }
  }

  /* ============================================================================
   *  Type guards
   * ========================================================================== */

  /**
   * Runtime type guard for User / User[]
   *  - Used where backend returns untyped data.
   *  - Keep this in sync with `User` interface in APIsService.
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
      ( typeof item.phoneNumber === 'string' ||
        typeof item.phoneNumber === 'undefined' ) &&
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

  /* ============================================================================
   *  Admin-only helper
   * ========================================================================== */



  /* ============================================================================
   *  Post-login persistence
   * ========================================================================== */

  /**
   * Persist encrypted user snapshot + password into localStorage.
   *  This is called after successful login.
   */
  public async afterUserLoggedInOperatios(): Promise<void> {
    if ( !this.isBrowser ) {
      return;
    }

    const baseUser = this.localUser ?? this.loggedUser;

    if ( !this.isValidUser || !baseUser ) {
      return;
    }

    try {
      const encryptedUser = await this.cryptoService.encrypt( baseUser );
      const encryptedPassword = await this.cryptoService.encrypt(
        this.password,
      );

      if ( encryptedUser && encryptedPassword ) {
        localStorage.setItem( this.STORAGE_KEYS.user, encryptedUser );
        localStorage.setItem( this.STORAGE_KEYS.isLoggedIn, 'true' );
        localStorage.setItem(
          this.STORAGE_KEYS.password,
          encryptedPassword,
        );
      }
    } catch ( error ) {
      console.error(
        '[AuthService.afterUserLoggedInOperatios]',
        error,
      );
    }
  }

  /* ============================================================================
   *  Session restore (app bootstrap)
   * ========================================================================== */

  /**
   * Restore logged user from encrypted localStorage snapshot.
   *  - Also boots realtime stack if data is valid.
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

      // Boot realtime on restore
      this.initRealtimeIfNeeded();

      return decryptedUser;
    } catch ( error ) {
      console.error(
        '[AuthService.getLocalLoggedUser] decrypt failed',
        error,
      );
      return null;
    }
  }

  /* ============================================================================
   *  Activity tracker
   * ========================================================================== */

  public async insertLoggedUserTracks(): Promise<void> {
    try {
      const date = new Date();
      const data = { username: this.user?.username, date };
      await this.activityTrackerService.saveLoggedUserDataToTracking(
        data,
      );
    } catch ( error ) {
      console.error(
        '[AuthService.insertLoggedUserTracks]',
        error,
      );
    }
  }

  /* ============================================================================
   *  Realtime bootstrap (Sockets + Notifications)
   * ========================================================================== */

  /**
   * Resolve backend HTTP base from APIsService or window.location.
   *  - If you later centralise environment config, plug it here.
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

      const tokenFromService = ( this.apiService as any )?.token;
      const tokenFromStorage = this.readTokenFromStorage();
      const token = tokenFromService ?? tokenFromStorage;

      if ( !token ) {
        throw new Error(
          '[AuthService] initRealtimeIfNeeded: no token found, skipping realtime init',
        );
      }

      const apiBase = this.resolveApiBase();
      if ( !apiBase ) {
        throw new Error(
          '[AuthService] initRealtimeIfNeeded: no apiBase, skipping realtime init',
        );
      }

      const wsBase = apiBase;

      const tokenProvider = (): string =>
        this.readTokenFromStorage()?.session ?? '';

      this.socketService.init( { wsBase, token, tokenProvider } );

      this.notificationService.initConnection( {
        wsBase,
        token,
        tokenProvider,
      } );

      this.notificationService
        .load( { limit: 20 } )
        .catch( ( err ) =>
          console.warn(
            '[AuthService] initial notification load failed',
            err,
          ),
        );

      this.notificationsInit = true;
    } catch ( error ) {
      console.error( '[Failed to initialise notification:] ', error );
      return;
    }
  }

  /* ============================================================================
   *  Cleanup (logout)
   * ========================================================================== */

  /**
   * Full logout:
   *  - Clears in-memory auth state
   *  - Clears encrypted snapshot & flags from localStorage
   *  - Disconnects realtime layers
   *
   * NOTE:
   *  By default we also clear sessionToken and guardToken here. If you ever implement
   *  backend-side blacklisting / revocation, you might adjust this.
   */
  public async clearCredentials(): Promise<void> {
    const failures: string[] = [];

    try {

      if ( !this.loggedUser ) {
        throw new Error( 'Logout failed due to the invalid user data!' );
      }

      const res = await this.apiService.logout();

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to logout properly!' );
      }

      if ( this.isBrowser ) {
        // 1) Attempt removals
        localStorage.removeItem( this.STORAGE_KEYS.user );
        localStorage.removeItem( this.STORAGE_KEYS.isLoggedIn );
        localStorage.removeItem( this.STORAGE_KEYS.password );
        localStorage.removeItem( this.STORAGE_KEYS.sessionToken );
        localStorage.removeItem( this.STORAGE_KEYS.guardToken );

        // 2) Validate each key and report anomalies

        // 2.1 User object
        const storedUser = localStorage.getItem( this.STORAGE_KEYS.user );
        if ( storedUser !== null ) {
          await this.adminReportService.reportCleanUser(
            this.localUser?.username ??
            this.loggedUser?.username ??
            '',
          );
          failures.push( 'user' );
        }

        // 2.2 Login status flag
        const storedLogin = localStorage.getItem(
          this.STORAGE_KEYS.isLoggedIn,
        );
        if ( storedLogin !== null ) {
          const actualStatus: boolean = storedLogin === 'true';
          await this.adminReportService.reportLoginStatusFailure(
            this.localUser?.username ??
            this.loggedUser?.username ??
            '',
            false, // expected: logged out
            actualStatus, // actual value in storage
          );
          failures.push( 'loginStatus' );
        }

        // 2.3 Password snapshot
        const storedPassword = localStorage.getItem(
          this.STORAGE_KEYS.password,
        );
        if ( storedPassword !== null ) {
          await this.adminReportService.reportCleanPassword(
            this.localUser?.username ??
            this.loggedUser?.username ??
            '',
          );
          failures.push( 'password' );
        }

        // 2.4 Token
        const storedSessionToken = localStorage.getItem( this.STORAGE_KEYS.sessionToken );
        const storedGuardToken = localStorage.getItem( this.STORAGE_KEYS.guardToken );
        if ( storedSessionToken !== null ) {
          await this.adminReportService.reportCleanToken(
            this.loggedUser?.username ??
            this.localUser?.username ??
            '',
          );
          failures.push( 'token' );
        }
      }

      // 3) Always clear in-memory state (even if storage ops misbehave)
      this.user = { username: '', password: '', rememberMe: false };
      this.isLoggedIn = false;
      this.isValidUser = false;
      this.isUserActive = false;
      this.setLoggedUser = null;
      this.localUser = null;

      this.notificationService.disconnect();
      this.socketService.disconnect();
      this.notificationsInit = false;

      if ( failures.length > 0 ) {
        console.error(
          '[AuthService.clearCredentials] Storage cleanup anomalies:',
          failures.join( ', ' ),
        );
      }
    } catch ( error ) {
      console.error(
        '[AuthService.clearCredentials] Failed to revoke user login:',
        error,
      );
      // no rethrow — logout is best-effort
      return;
    }
  }

  /* ============================================================================
   *  Guards & access helpers
   * ========================================================================== */

  /**
   * Final guard immediately after login:
   *  - Ensures `user.isActive === true`
   *  - On failure clears state and routes to root.
   */
  private async finalInitialGuard( user: User ): Promise<void> {
    try {
      if ( !user ) {
        throw new Error(
          'Invalid login data, please try again later.',
        );
      }

      const isActive: boolean = !!user.isActive;

      if ( !isActive ) {
        throw new Error(
          'Login privileges are denied – user is inactive.',
        );
      }

      return;
    } catch ( error ) {
      console.error( '[AuthService.finalInitialGuard] Failed', error );
      await this.clearCredentials();
      this.router.navigate( [ '/' ] );
      return;
    }
  }

  /**
   * filterModules
   * -------------
   * If no modules are passed → return ALL modules from ACCESS_OPTIONS.
   * If a list is provided → return only those modules.
   */
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

  /**
   * filterDefaultAccessBaseRole
   * ---------------------------
   * Frontend helper to decide which MODULES a given role can see
   * in the Access UI (checkbox tree, etc.).
   *
   * NOTE:
   *  - This returns module *definitions* (AccessModuleOption[]),
   *    not PermissionEntry[]. You’ll still choose which actions
   *    inside each module to tick for that role in the UI.
   */
  public filterDefaultAccessBaseRole(
    role: Role,
  ): ReadonlyArray<AccessModuleOption> {
    switch ( role ) {
      // Full system visibility
      case 'admin': {
        return this.filterModules();
      }

      // Typical agent: property + tenant + notifications
      case 'agent': {
        const permitModules: AccessModuleKey[] = [
          'PropertyManagement',
          'TenantManagement',
          'NotificationCenter',
        ];
        return this.filterModules( permitModules );
      }

      // Manager: more oversight – user mgmt + tracking
      case 'manager': {
        const permitModules: AccessModuleKey[] = [
          'UserManagement',
          'PropertyManagement',
          'TenantManagement',
          'NotificationCenter',
          'TrackingAndAudit',
        ];
        return this.filterModules( permitModules );
      }

      // Operator: similar to manager but maybe without some system-level stuff
      case 'operator': {
        const permitModules: AccessModuleKey[] = [
          'UserManagement',
          'PropertyManagement',
          'TenantManagement',
          'NotificationCenter',
        ];
        return this.filterModules( permitModules );
      }

      // Default (tenant / basic user / unknown role):
      // only tenant & notifications
      default: {
        const permitModules: AccessModuleKey[] = [
          'TenantManagement',
          'NotificationCenter',
        ];
        return this.filterModules( permitModules );
      }
    }
  }

  /**
   * Build the per-role default access CONFIG for FRONTEND:
   *   moduleKey -> list of allowed action IDs
   *
   * Currently: grants ALL actions in each visible module.
   * If later you want per-action differences per role, customise here.
   */
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

  /**
   * Publish the per-role visible MODULE definitions for UI:
   * {
   *   admin:   [AccessModuleOption, ...],
   *   agent:   [...],
   *   ...
   * }
   */
  public publishDefaultRoleAccessMap(): Record<
    Role,
    ReadonlyArray<AccessModuleOption>
  > {
    return this.defaultRoleModulesMap;
  }

  /**
   * FRONTEND helper: build boolean matrix from per-role default config.
   *  - PURELY for UI gating (buttons, menus).
   *  - REAL security must be enforced on backend (guards + DB).
   *
   * Returns (example):
   * {
   *   UserManagement: {
   *     view:   true/false,
   *     create: true/false,
   *     ...
   *   },
   *   PropertyManagement: { ... },
   *   ...
   * }
   */
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

    // Walk the canonical access matrix (ACCESS_OPTIONS is the source-of-truth)
    for ( const { module, actions } of ACCESS_OPTIONS ) {
      const moduleKey = module as AccessModuleKey;

      // From defaults: list of allowed action IDs for this module
      const allowedActionsForModule: readonly AccessActionKey[] =
        allowedForRole[ moduleKey ] ?? [];

      const flags: Record<AccessActionKey, boolean> =
        {} as Record<AccessActionKey, boolean>;

      // Each `action` is AccessActionOption → use `action.id`
      for ( const { id } of actions ) {
        const actionKey = id as AccessActionKey;
        flags[ actionKey ] = allowedActionsForModule.includes( actionKey );
      }

      matrix[ moduleKey ] = flags;
    }

    return matrix;
  }

  /**
   * Reserved hook for future per-module defaults,
   * once access rules are fully backend-driven.
   */
  public getDefaultAccessByModel( _module: string ): void {
    // reserved for future per-module defaults
  }

  /* ============================================================================
   *  Token helpers (localStorage)
   * ========================================================================== */

  /** Read JWT from localStorage (if browser). */
  private readTokenFromStorage(): { session: string, guard: string; } | null {
    if ( !this.isBrowser ) {
      return null;
    }
    const sessionToken = localStorage.getItem( this.STORAGE_KEYS.sessionToken ) ?? null;
    const guardToken = localStorage.getItem( this.STORAGE_KEYS.guardToken ) ?? null;

    if ( sessionToken && guardToken ) {
      return {
        session: sessionToken,
        guard: guardToken
      };
    }
    else return null;
  }

  /** Persist JWT into localStorage (if browser). */
  private writeTokenToStorage( session: string, guard: string ): void {
    if ( !this.isBrowser ) {
      return;
    }
    if ( !session || !session.trim() ) {
      console.warn(
        '[AuthService] Attempted to write empty session token to storage.',
      );
      return;
    }
    if ( !guard || !guard.trim() ) {
      console.warn(
        '[AuthService] Attempted to write empty guard token to storage.',
      );
      return;
    }
    localStorage.setItem( this.STORAGE_KEYS.guardToken, guard.trim() );
    localStorage.setItem( this.STORAGE_KEYS.sessionToken, session.trim() );
  }
}
