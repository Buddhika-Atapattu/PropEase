// src/app/services/auth/auth.service.ts
// -----------------------------------------------------------------------------
// AuthService
// - Owns login/logout/session restore.
// - Boots realtime stack ONCE per browser session:
//     1) SocketService       (shared Socket.IO bus for chat/call/notifications)
//     2) NotificationService (wires to shared socket, manages notification state)
// -----------------------------------------------------------------------------
//
// Usage:
//   await authService.sendVerifyUser();       // login
//   await authService.getLocalLoggedUser();   // restore session on app start
//   authService.clearCredentials();           // logout
//
// Exposed notification helpers (delegates to NotificationService):
//   authService.notifications$
//   authService.unreadNotifications$()
//   authService.unreadNotificationsCount
//   authService.markNotificationRead(id)
//
// Notes:
// - SSR safe: guards with isPlatformBrowser.
// - Token flow: reads and writes `auth_token` in localStorage.
// - After login + restore: initializes SocketService + NotificationService once.
// -----------------------------------------------------------------------------

import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CryptoService } from '../cryptoService/crypto.service';
import { APIsService, type User } from '../APIs/apis.service';
import { ActivityTrackerService } from '../activityTacker/activity-tracker.service';
import { NotificationService } from '../notifications/notification-service';
import { SocketService } from '../socket/socket-service';

/* ==================== Types (unchanged) ==================== */

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

export interface PermissionEntry {
  module: string;
  actions: string[];
}

export interface ROLE_ACCESS_MAP {
  role: string;
  permissions: PermissionEntry[];
}

export type Role =
  | 'admin'
  | 'agent'
  | 'tenant'
  | 'owner'
  | 'operator'
  | 'manager'
  | 'developer'
  | 'user';

export type AccessMap = { [ module: string ]: string[]; };

// --- Access Catalog (standardized verb–object phrasing) ---
export const ACCESS_OPTIONS: ReadonlyArray<{
  module: string;
  actions: ReadonlyArray<string>;
}> = [
    {
      module: 'User Management',
      actions: [
        'view users',
        'create user',
        'update user',
        'delete user',
        'activate user',
        'deactivate user',
        'reset password',
        'change username',
        'assign roles',
      ] as const,
    },
    {
      module: 'Property Management',
      actions: [
        'view properties',
        'create property',
        'update property',
        'delete property',
        'assign agent',
        'upload property documents',
        'manage amenities',
        'change property status',
      ] as const,
    },
    {
      module: 'Tenant Management',
      actions: [
        'view tenant profile',
        'create tenant',
        'update tenant',
        'remove tenant',
        'create lease',
        'view lease',
        'update lease',
        'terminate lease',
        'activate lease',
        'renew lease',
        'extend lease',
        'assign tenant to unit',
        'view lease history',
        'send notification',
        'send email',
        'send sms',
        'record manual payment',
        'view payment history',
        'upload payment proof',
        'upload lease documents',
        'view lease documents',
        'download lease documents',
        // Complaints (operator can edit per your rule)
        'view complaint',
        'create complaint',
        'update complaint',
        'delete complaint',
        'submit complaint',
        'view tenant activity',
        'view tenant dashboard',
      ] as const,
    },
    {
      module: 'Team Management',
      actions: [
        'view teams',
        'create team',
        'update team',
        'delete team',
        'view team documents',
        'assign member',
        'promote member',
        'demote member',
        'reassign tasks',
        'approve reports',
        'monitor performance',
        'generate team reports',
        'invite member',
        'remove member',
        'manage shifts',
        'allocate resources',
        'audit team activity',
        'schedule training',
        'review feedback',
        'set team goals',
        'handle escalations',
        'manage hierarchy',
        'lock access',
        'unlock access',
        // New: for your operator requirement
        'assign team to maintenance ticket',
      ] as const,
    },
    {
      module: 'Owner Management',
      actions: [
        'view owners',
        'create owner',
        'update owner',
        'delete owner',
        'view owner documents',
        'assign owner to property',
      ] as const,
    },
    {
      module: 'Agent Management',
      actions: [
        'view agents',
        'create agent',
        'update agent',
        'delete agent',
        'assign properties',
        'track performance',
      ] as const,
    },
    {
      module: 'Lease Management',
      actions: [
        'view leases',
        'create lease',
        'update lease',
        'terminate lease',
        'renew lease',
        'upload lease document',
        'track lease expiry',
      ] as const,
    },
    {
      module: 'Payment & Billing',
      actions: [
        'view payments',
        'record manual payment',
        'generate invoice',
        'update invoice',
        'delete invoice',
        'view balance',
        'export payment reports',
        'configure rates',
      ] as const,
    },
    {
      module: 'Maintenance Requests',
      actions: [
        'view requests',
        'create request',
        'assign technician',
        'assign maintenance team',
        'update request status',
        'close request',
        'track progress',
        'upload maintenance documents',
        'add maintenance cost',
        'generate maintenance report',
      ] as const,
    },
    {
      module: 'Compliance Management',
      actions: [
        'upload certificate',
        'view compliance status',
        'set compliance reminders',
        'update compliance record',
        'delete compliance record',
        'notify parties',
      ] as const,
    },
    {
      module: 'Document Management',
      actions: [
        'upload document',
        'download document',
        'delete document',
        'share document',
        'categorize document',
      ] as const,
    },
    {
      module: 'Communication & Notification',
      actions: [
        'send message',
        'view message logs',
        'customize templates',
        'schedule message',
        'broadcast notification',
      ] as const,
    },
    {
      module: 'Report Management',
      actions: [
        'generate financial report',
        'generate occupancy report',
        'export lease report',
        'customize report templates',
        'view audit logs',
        'download report',
      ] as const,
    },
    {
      module: 'Audit Logs',
      actions: [
        'view logs',
        'filter logs',
        'export logs',
        'monitor logins',
        'track role changes',
      ] as const,
    },
    {
      module: 'Dashboard & Analytics',
      actions: [
        'view analytics',
        'customize widgets',
        'download analytics',
        'view realtime analytics',
      ] as const,
    },
    {
      module: 'System Settings',
      actions: [
        'manage roles',
        'configure preferences',
        'configure payments',
        'manage integrations',
        'backup and restore',
      ] as const,
    },
    {
      module: 'Support & Helpdesk',
      actions: [
        'view tickets',
        'respond to ticket',
        'assign support staff',
        'close ticket',
        'view ticket history',
        'send satisfaction survey',
      ] as const,
    },
    {
      module: 'Access Control',
      actions: [
        'grant access',
        'revoke access',
        'set restrictions',
        'control sessions',
      ] as const,
    },
  ];

export const DEFAULT_ROLE_ACCESS: Record<Role, AccessMap> = {
  // Admin: everything (unchanged)
  admin: Object.fromEntries( ACCESS_OPTIONS.map( ( m ) => [ m.module, [ ...m.actions ] ] ) ),

  // Agent: focused on properties/tenants comms
  agent: {
    'Property Management': [
      'view properties',
      'update property',
      'upload property documents',
    ],
    'Tenant Management': [
      'view tenant profile',
      'assign tenant to unit',
      'send notification',
      'send email',
      'send sms',
    ],
    'Communication & Notification': [ 'send message', 'view message logs' ],
    'Dashboard & Analytics': [ 'view analytics' ],
  },

  // Tenant: self-service
  tenant: {
    'Lease Management': [ 'view leases' ],
    'Payment & Billing': [ 'view payments', 'view balance' ],
    'Maintenance Requests': [ 'view requests', 'create request' ],
    'Communication & Notification': [ 'view message logs' ],
  },

  // Owner: portfolio view + reports
  owner: {
    'Property Management': [ 'view properties' ],
    'Tenant Management': [ 'view tenant profile', 'view lease' ],
    'Report Management': [ 'generate financial report', 'download report' ],
  },

  // Operator: daily operations (key updates below)
  operator: {
    'User Management': [ 'view users', 'update user' ],
    'Maintenance Requests': [
      'view requests',
      'create request',
      'assign technician',
      'assign maintenance team',
      'update request status',
      'close request',
      'track progress',
    ],
    'Tenant Management': [
      'view tenant profile',
      'view complaint',
      'create complaint',
      'update complaint', // can edit complaints
    ],
    'Team Management': [
      'view teams',
      'assign team to maintenance ticket', // can route teams to tickets
    ],
    'Communication & Notification': [ 'send message', 'view message logs' ],
    'Dashboard & Analytics': [ 'view analytics' ],
  },

  // Manager: ~half of admin (no deletes/security), with approvals/monitoring/reporting
  manager: {
    'User Management': [ 'view users', 'update user', 'assign roles' ],
    'Property Management': [ 'view properties', 'assign agent', 'change property status' ],
    'Lease Management': [
      'view leases',
      'create lease',
      'update lease',
      'terminate lease',
      'renew lease',
      'upload lease document',
      'track lease expiry',
    ],
    'Tenant Management': [
      'view tenant profile',
      'create tenant',
      'update tenant',
      'remove tenant',
      'create lease',
      'view lease',
      'update lease',
      'terminate lease',
      'activate lease',
      'renew lease',
      'extend lease',
      'assign tenant to unit',
      'view lease history',
      'send notification',
      'send email',
      'send sms',
      'record manual payment',
      'view payment history',
      'upload payment proof',
      'upload lease documents',
      'view lease documents',
      'download lease documents',
      // Complaints (operator can edit per your rule)
      'view complaint',
      'create complaint',
      'update complaint',
      'delete complaint',
      'submit complaint',
      'view tenant activity',
      'view tenant dashboard',
    ],
    'Team Management': [
      'view teams',
      'approve reports',
      'monitor performance',
      'generate team reports',
      'reassign tasks',
      'review feedback',
      'set team goals',
      'handle escalations',
    ],
    'Maintenance Requests': [
      'view requests',
      'assign technician',
      'update request status',
      'close request',
      'generate maintenance report',
    ],
    'Compliance Management': [
      'view compliance status',
      'update compliance record',
      'set compliance reminders',
    ],
    'Report Management': [
      'generate financial report',
      'generate occupancy report',
      'download report',
    ],
    'Audit Logs': [ 'view logs', 'filter logs' ],
    'Dashboard & Analytics': [ 'view analytics', 'customize widgets' ],
  },

  // Developer: observability + integrations
  developer: {
    'System Settings': [ 'configure preferences', 'manage integrations' ],
    'Dashboard & Analytics': [ 'customize widgets', 'view analytics' ],
    'Audit Logs': [ 'view logs' ],
  },

  // General user
  user: {
    'Dashboard & Analytics': [ 'view analytics' ],
    'Communication & Notification': [ 'view message logs' ],
  },
};

/* ==================== Auth Service ==================== */

@Injectable( { providedIn: 'root' } )
export class AuthService {
  private readonly isBrowser: boolean;

  private isLoggedIn = false;
  private rememberMe = false;
  private username = '';
  private password = '';
  private user: UserCredentials = {
    username: '',
    password: '',
    rememberMe: false,
  };

  private loggedUser: User | null = null;
  private localUser: User | null = null;
  private isValidUser = false;
  private isUserActive = false;
  private users: User[] = [];

  /** Ensure we boot the realtime layers once per session. */
  private notificationsInit = false;

  constructor (
    @Inject( PLATFORM_ID ) platformId: Object,
    private readonly cryptoService: CryptoService,
    private readonly APIs: APIsService,
    private readonly activityTrackerService: ActivityTrackerService,
    private readonly notificationService: NotificationService,
    private readonly socketService: SocketService,
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
  }

  /* ---------- Delegates: Notification convenience ---------- */

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

  /* ---------- Getters / Setters ---------- */

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
    this.rememberMe = user.rememberMe || false;
    this.user = user;
  }

  set isUserLoggedIn( value: boolean ) {
    this.isLoggedIn = value;
  }

  set setLoggedUser( user: User | null ) {
    this.loggedUser = user;
    this.activityTrackerService.loggedUser = user;
  }

  set logginUser( user: UserCredentials ) {
    this.user = user;
  }

  /* ---------- Login flow ---------- */

  public async sendVerifyUser(): Promise<boolean> {
    try {
      const response = await this.APIs.verifyUser( this.user );
      if ( response?.status !== 'success' ) {
        throw new Error( 'Invalid credentials!' );
      }

      const user: User | undefined = response.user as User;
      if ( !user ) {
        throw new Error( 'User not found!' );
      }

      // Store state
      this.setLoggedUser = user;
      this.localUser = user; // ensure persistence methods see the same user
      this.isUserLoggedIn = true;
      this.isValidUser = true;
      this.isUserActive = !!user.isActive;

      // Persist JWT (server may also return via APIsService)
      const token =
        ( response as any )?.token ??
        ( this.APIs as any )?.token ??
        ( this.isBrowser ? localStorage.getItem( 'auth_token' ) : null );

      if ( this.isBrowser && token ) {
        localStorage.setItem( 'auth_token', token );
      }

      // Boot realtime layers (SocketService + NotificationService)
      this.initRealtimeIfNeeded();

      return true;
    } catch ( error ) {
      console.error( '[sendVerifyUser]', error );
      return false;
    }
  }

  /* ---------- Validate payload type helper ---------- */

  public isUsersType( data: any ): data is User[] | User {
    const isOne = ( item: any ) =>
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
      [
        'admin',
        'agent',
        'tenant',
        'owner',
        'operator',
        'manager',
        'developer',
        'user',
      ].includes( item.role ) &&
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

  /* ---------- Admin-only helper ---------- */

  public async sendUserCredentialsAndGetUserData( role: string ): Promise<boolean> {
    if ( !this.isBrowser ) return false;

    try {
      const canSaveAllUsers = [ 'admin', 'operator' ].includes( role );
      if ( !canSaveAllUsers ) {
        throw new Error( 'User is not admin or operator' );
      }

      const users = await this.APIs.getAllUsers();
      if ( !users ) {
        throw new Error( 'Users are not fetched' );
      }

      const encryptedUsers = await this.cryptoService.encrypt( users );
      if ( !encryptedUsers ) {
        throw new Error( 'Users are not encrypted' );
      }

      localStorage.setItem( 'USERS', encryptedUsers );
      return true;
    } catch {
      return false;
    }
  }

  /* ---------- Post-login persistence ---------- */

  public async afterUserLoggedInOperatios(): Promise<void> {
    if ( !this.isBrowser ) return;

    // Use localUser if available, otherwise fall back to loggedUser
    const baseUser = this.localUser ?? this.loggedUser;

    if ( this.isValidUser && baseUser ) {
      const encryptedUser = await this.cryptoService.encrypt( baseUser );
      const encryptedPassword = await this.cryptoService.encrypt( this.password );

      if ( encryptedUser && encryptedPassword ) {
        // (kept original key spelling)
        localStorage.setItem( 'ENCRYPED_LOGGED_USER', encryptedUser );
        localStorage.setItem( 'IS_USER_LOGGED_IN', 'true' );
        localStorage.setItem( 'PASSWORD', encryptedPassword );
      }
    }
  }

  /* ---------- Session restore on app start ---------- */

  public async getLocalLoggedUser(): Promise<User | null> {
    if ( !this.isBrowser ) return null;

    const encrypted = localStorage.getItem( 'ENCRYPED_LOGGED_USER' );
    if ( !encrypted ) return null;

    try {
      const decryptedUser = ( await this.cryptoService.decrypt( encrypted ) ) as User;
      this.localUser = decryptedUser;
      this.loggedUser = decryptedUser;
      this.isUserActive = !!decryptedUser.isActive;
      this.isValidUser = true;
      this.isLoggedIn = true;

      // Boot realtime on session restore as well
      this.initRealtimeIfNeeded();

      return decryptedUser;
    } catch ( e ) {
      console.error( '[getLocalLoggedUser] decrypt failed', e );
      return null;
    }
  }

  /* ---------- Activity tracker ---------- */

  public async insertLoggedUserTracks(): Promise<void> {
    const date = new Date();
    this.activityTrackerService.userLoggedTime = date;
    const data = { username: this.user?.username, date };
    await this.activityTrackerService
      .saveLoggedUserDataToTracking( data )
      .catch( ( error ) => {
        console.error( error );
      } );
  }

  /* ==================== Realtime bootstrap ==================== */

  /**
   * Build a backend base URL (prefers APIsService config; falls back to same-origin).
   */
  private resolveApiBase(): string {
    if ( !this.isBrowser ) return '';

    const anyAPIs = this.APIs as any;
    const base =
      anyAPIs.apiBase ??
      anyAPIs.baseUrl ??
      anyAPIs.API_BASE ??
      window.location.origin;

    return String( base ).replace( /\/+$/, '' );
  }

  /**
   * Initialize:
   *  - SocketService (shared Socket.IO bus for chat/calls/notifications)
   *  - NotificationService (wires to shared socket, REST base)
   *
   * Runs once per session (guarded by `notificationsInit`).
   */
  private initRealtimeIfNeeded(): void {
    if ( !this.isBrowser || this.notificationsInit ) return;

    const token =
      ( this.APIs as any )?.token ||
      ( this.isBrowser ? localStorage.getItem( 'auth_token' ) : null );

    if ( !token ) {
      console.warn( '[AuthService] initRealtimeIfNeeded: no token found, skipping realtime init' );
      return;
    }

    const apiBase = this.resolveApiBase();
    if ( !apiBase ) {
      console.warn( '[AuthService] initRealtimeIfNeeded: no apiBase, skipping realtime init' );
      return;
    }

    // Point WS base to backend host (NOT Angular dev server)
    const wsBase = apiBase;

    // Token provider for refresh if server requests it
    const tokenProvider = () =>
      ( this.isBrowser ? localStorage.getItem( 'auth_token' ) : '' ) || '';

    // 1) Shared realtime bus (for chat/calls/etc + notifications)
    this.socketService.init( { wsBase, token, tokenProvider } );

    // 2) Notification service: configure REST base + wire to shared socket
    this.notificationService.initConnection( { apiBase, wsBase, token, tokenProvider } );

    // 3) Initial notification snapshot via REST (fallback + initial state)
    this.notificationService
      .load( { limit: 20 } )
      .catch( ( err ) => console.warn( '[AuthService] initial notification load failed', err ) );

    this.notificationsInit = true;
  }

  /* ==================== Cleanup (logout) ==================== */

  /** Clears session and disconnects realtime. Call on logout. */
  public clearCredentials(): void {
    this.user = { username: '', password: '', rememberMe: false };
    this.isLoggedIn = false;
    this.isValidUser = false;
    this.isUserActive = false;
    this.setLoggedUser = null;
    this.localUser = null;

    // Optional: clear persisted user snapshot (kept original keys)
    if ( this.isBrowser ) {
      localStorage.removeItem( 'ENCRYPED_LOGGED_USER' );
      localStorage.removeItem( 'IS_USER_LOGGED_IN' );
      localStorage.removeItem( 'PASSWORD' );
      // If you want to fully logout from backend token as well, uncomment:
      // localStorage.removeItem('auth_token');
    }

    // Disconnect realtime layers
    this.notificationService.disconnect();
    this.socketService.disconnect();
    this.notificationsInit = false;
  }

  /** ================== Helper Common Methods =================== */

  public getDefaultAccessByRole( role: Role ): Record<string, Record<string, boolean>> {
    const allowed = DEFAULT_ROLE_ACCESS[ role ] ?? {};
    const result: Record<string, Record<string, boolean>> = {};

    for ( const { module, actions } of ACCESS_OPTIONS ) {
      result[ module ] = {};
      for ( const action of actions ) {
        result[ module ][ action ] = allowed[ module ]?.includes( action ) ?? false;
      }
    }

    return result;
  }

  public getDefaultAccessByModel( _module: string ): void {
    // reserved for future if you need per-module defaults
  }
}
