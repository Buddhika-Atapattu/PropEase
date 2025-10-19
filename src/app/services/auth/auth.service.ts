// src/app/services/auth/auth.service.ts
// -----------------------------------------------------------------------------
// AuthService
// - Owns login/logout/session restore.
// - Boots *both* realtime layers:
//     1) NotificationService (has its own Socket.IO for domain notifications)
//     2) SocketService       (shared realtime bus for future chat/calls/etc)
// - Keeps the two separated so you can gradually migrate notifications to the
//   shared SocketService later without breaking anything.
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
// - After login + restore: initializes NotificationService + SocketService once.
// -----------------------------------------------------------------------------

import {Injectable, Inject, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {CryptoService} from '../cryptoService/crypto.service';
import {APIsService} from '../APIs/apis.service';
import {ActivityTrackerService} from '../activityTacker/activity-tracker.service';
import {NotificationService} from '../notifications/notification-service';
import {SocketService} from '../socket/socket-service';

/* ==================== Types (unchanged) ==================== */

export interface UserCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}
export interface Address {
  street: string; houseNumber: string; city: string; postcode: string;
  country?: string; stateOrProvince?: string;
}
export interface PermissionEntry {module: string; actions: string[];}
export interface ROLE_ACCESS_MAP {role: string; permissions: PermissionEntry[];}
export type Role =
  | 'admin' | 'agent' | 'tenant' | 'owner'
  | 'operator' | 'manager' | 'developer' | 'user';

export interface BaseUser {
  _id?: string; __v?: number;
  name: string; username: string; email: string;
  dateOfBirth?: Date | null; age: number; image?: string | File;
  phoneNumber?: string; bio: string; role: Role; gender: string;
  address: Address; isActive: boolean; access: ROLE_ACCESS_MAP;
  creator: string; updator?: string; createdAt: Date; updatedAt: Date;
}
export interface NewUser extends BaseUser {password: string;}
export interface UsersType extends NewUser {}
export interface UpdateUserType extends Omit<BaseUser, 'createdAt'> {}
export interface LoggedUserType extends Omit<NewUser, 'password'> {}

export type AccessMap = {[module: string]: string[]};

export const ACCESS_OPTIONS: ReadonlyArray<{module: string; actions: ReadonlyArray<string>}> = [
  {module: 'User Management', actions: ['view', 'create', 'update', 'delete', 'activate', 'deactivate', 'reset password', 'change username', 'assign roles'] as const},
  {module: 'Property Management', actions: ['view', 'create', 'update', 'delete', 'assign agent', 'upload documents', 'manage amenities', 'change status'] as const},
  {
    module: 'Tenant Management', actions: [
      'add new tenant', 'remove tenant', 'view tenant profile', 'edit tenant details',
      'create lease', 'view lease', 'edit lease', 'terminate lease', 'activate lease', 'renew lease', 'extend lease', 'assign to a unit/property', 'view lease history',
      'send notification', 'send email', 'send SMS',
      'record manual payment', 'view payment history', 'upload payment proof',
      'upload lease documents', 'view lease documents', 'download lease documents',
      'view complaints', 'submit complaint',
      'track activity log', 'view tenant dashboard',
    ] as const
  },
  {module: 'Owner Management', actions: ['view', 'create', 'update', 'delete', 'view documents', 'assign to property'] as const},
  {module: 'Agent Management', actions: ['view', 'create', 'update', 'delete', 'assign properties', 'track performance'] as const},
  {module: 'Lease Management', actions: ['view', 'create', 'update', 'terminate', 'renew', 'upload document', 'track expiry'] as const},
  {module: 'Payment & Billing', actions: ['view', 'record manual', 'generate invoice', 'update invoice', 'delete invoice', 'view balance', 'export reports', 'configure rates'] as const},
  {module: 'Maintenance Requests', actions: ['view', 'create', 'assign technician', 'update status', 'close', 'track progress', 'upload documents', 'add cost', 'generate report'] as const},
  {module: 'Compliance Management', actions: ['upload certificates', 'view status', 'set reminders', 'update record', 'delete record', 'notify parties'] as const},
  {module: 'Document Management', actions: ['upload', 'download', 'delete', 'share', 'categorize'] as const},
  {module: 'Communication & Notification', actions: ['send', 'view logs', 'customize templates', 'schedule', 'notify'] as const},
  {module: 'Report Management', actions: ['generate financial', 'generate occupancy', 'export lease', 'customize templates', 'view audit logs', 'download'] as const},
  {module: 'Audit Logs', actions: ['view logs', 'filter logs', 'export', 'monitor login', 'track role changes'] as const},
  {module: 'Dashboard & Analytics', actions: ['view analytics', 'customize widgets', 'download', 'view real time'] as const},
  {module: 'System Settings', actions: ['manage roles', 'configure preferences', 'configure payments', 'manage integrations', 'backup restore'] as const},
  {module: 'Support & Helpdesk', actions: ['view tickets', 'respond', 'assign staff', 'close ticket', 'track history', 'send feedback'] as const},
  {module: 'Access Control', actions: ['grant access', 'revoke access', 'set restrictions', 'control sessions'] as const},
];

export const DEFAULT_ROLE_ACCESS: Record<Role, AccessMap> = {
  admin: Object.fromEntries(ACCESS_OPTIONS.map(m => [m.module, [...m.actions]])),
  agent: {'Property Management': ['view', 'update', 'upload documents'], 'Tenant Management': ['view', 'assign to property'], 'Communication & Notification': ['send', 'view logs'], 'Dashboard & Analytics': ['view analytics']},
  tenant: {'Lease Management': ['view'], 'Payment & Billing': ['view', 'view balance'], 'Maintenance Requests': ['view', 'create'], 'Communication & Notification': ['view logs']},
  owner: {'Property Management': ['view'], 'Tenant Management': ['view'], 'Report Management': ['generate financial', 'download']},
  operator: {'User Management': ['view', 'update'], 'Maintenance Requests': ['view', 'assign technician', 'close']},
  manager: {'User Management': ['view', 'update', 'assign roles'], 'Property Management': ['view', 'assign agent'], 'Compliance Management': ['view status', 'update record'], 'Report Management': ['generate occupancy', 'download']},
  developer: {'System Settings': ['configure preferences', 'manage integrations'], 'Dashboard & Analytics': ['customize widgets', 'view analytics'], 'Audit Logs': ['view logs']},
  user: {'Dashboard & Analytics': ['view analytics'], 'Communication & Notification': ['view logs']},
};

export function getDefaultAccessByRole(role: Role) {
  const allowed = DEFAULT_ROLE_ACCESS[role] ?? {};
  const result: Record<string, Record<string, boolean>> = {};
  for(const {module, actions} of ACCESS_OPTIONS) {
    result[module] = {};
    for(const action of actions) {
      result[module][action] = allowed[module]?.includes(action) ?? false;
    }
  }
  return result;
}

/* ==================== Auth Service ==================== */

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly isBrowser: boolean;

  private isLoggedIn = false;
  private rememberMe = false;
  private username = '';
  private password = '';
  private user: UserCredentials = {username: '', password: '', rememberMe: false};

  private loggedUser: LoggedUserType | null = null;
  private localUser: LoggedUserType | null = null;
  private isValidUser = false;
  private isUserActive = false;
  private users: UsersType[] = [];

  /** Ensure we boot the realtime layers once per session. */
  private notificationsInit = false;

  constructor (
    @Inject(PLATFORM_ID) platformId: Object,
    private cryptoService: CryptoService,
    private APIs: APIsService,
    private activityTrackerService: ActivityTrackerService,
    private notificationService: NotificationService,
    private socketService: SocketService,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /* ---------- Delegates: Notification convenience ---------- */
  get notifications$() {return this.notificationService.items$;}
  get unreadNotifications$() {return this.notificationService.unreadCount$();}
  get unreadNotificationsCount(): number {return this.notificationService.unreadCount();}
  markNotificationRead(notificationId: string) {return this.notificationService.markRead(notificationId);}

  /* ---------- Getters / Setters ---------- */
  get getUserCredentials(): UserCredentials | null {return this.user ?? null;}
  get getLoggedUser(): LoggedUserType | null {return this.loggedUser;}
  get LocalUser(): LoggedUserType | null {return this.localUser;}
  get IsActiveUser(): boolean {return this.isUserActive;}
  get getIsValidUser(): boolean {return this.isValidUser;}
  get allUsers(): UsersType[] {return this.users;}
  get isUserLoggedIn(): boolean {return this.isLoggedIn;}

  set loginUserCredentials(user: UserCredentials) {
    this.username = user.username;
    this.password = user.password;
    this.rememberMe = user.rememberMe || false;
    this.user = user;
  }
  set isUserLoggedIn(value: boolean) {this.isLoggedIn = value;}
  set setLoggedUser(user: LoggedUserType | null) {
    this.loggedUser = user;
    this.activityTrackerService.loggedUser = user;
  }
  set logginUser(user: UserCredentials) {this.user = user;}

  /* ---------- Login flow ---------- */
  public async sendVerifyUser(): Promise<boolean> {
    try {
      const response = await this.APIs.verifyUser(this.user);
      if(response?.status !== 'success') throw new Error('Invalid credentials!');

      const user: LoggedUserType = response.user as LoggedUserType;
      if(!user) throw new Error('User not found!');

      // Store state
      this.setLoggedUser = user;
      this.isUserLoggedIn = true;
      this.isValidUser = true;
      this.isUserActive = !!user.isActive;

      // Persist JWT (server may also return via APIsService)
      const token =
        (response as any)?.token ??
        (this.APIs as any)?.token ??
        (this.isBrowser ? localStorage.getItem('auth_token') : null);

      if(this.isBrowser && token) localStorage.setItem('auth_token', token);

      // Boot realtime layers (NotificationService + SocketService)
      this.initRealtimeIfNeeded();

      return true;
    } catch(error) {
      console.error('[sendVerifyUser]', error);
      return false;
    }
  }

  /* ---------- Validate payload type helper ---------- */
  public isUsersType(data: any): data is UsersType[] | UsersType {
    const isOne = (item: any) =>
      item && typeof item.name === 'string' && typeof item.username === 'string' &&
      typeof item.email === 'string' &&
      (item.dateOfBirth === null || typeof item.dateOfBirth === 'string' || item.dateOfBirth instanceof Date) &&
      typeof item.age === 'number' &&
      (typeof item.image === 'string' || item.image instanceof File) &&
      (typeof item.phoneNumber === 'string' || typeof item.phoneNumber === 'undefined') &&
      typeof item.bio === 'string' &&
      ['admin', 'agent', 'tenant', 'owner', 'operator', 'manager', 'developer', 'user'].includes(item.role) &&
      typeof item.gender === 'string' && item.address && typeof item.address === 'object' &&
      typeof item.address.street === 'string' && typeof item.address.houseNumber === 'string' &&
      typeof item.address.city === 'string' && typeof item.address.postcode === 'string' &&
      (typeof item.address.country === 'string' || typeof item.address.country === 'undefined') &&
      (typeof item.address.stateOrProvince === 'string' || typeof item.address.stateOrProvince === 'undefined') &&
      typeof item.isActive === 'boolean' && item.access && typeof item.access === 'object' &&
      typeof item.access.role === 'string' && Array.isArray(item.access.permissions) &&
      item.access.permissions.every((perm: any) => perm && typeof perm.module === 'string' &&
        Array.isArray(perm.actions) && perm.actions.every((action: any) => typeof action === 'string')) &&
      typeof item.creator === 'string' &&
      (typeof item.updator === 'string' || typeof item.updator === 'undefined') &&
      (typeof item.createdAt === 'string' || item.createdAt instanceof Date) &&
      (typeof item.updatedAt === 'string' || item.updatedAt instanceof Date);
    return Array.isArray(data) ? data.every(isOne) : isOne(data);
  }

  /* ---------- Admin-only helper ---------- */
  public async sendUserCredentialsAndGetUserData(role: string): Promise<boolean> {
    if(!this.isBrowser) return false;
    try {
      const canSaveAllUsers = ['admin', 'operator'].includes(role);
      if(!canSaveAllUsers) throw new Error('User is not admin or operator');

      const users = await this.APIs.getAllUsers();
      if(!users) throw new Error('Users are not fetched');

      const encryptedUsers = await this.cryptoService.encrypt(users);
      if(!encryptedUsers) throw new Error('Users are not encrypted');

      localStorage.setItem('USERS', encryptedUsers);
      return true;
    } catch {
      return false;
    }
  }

  /* ---------- Post-login persistence ---------- */
  public async afterUserLoggedInOperatios(): Promise<void> {
    if(!this.isBrowser) return;
    if(this.isValidUser && this.localUser) {
      const encryptedUser = await this.cryptoService.encrypt(this.localUser);
      const encryptedPassword = await this.cryptoService.encrypt(this.password);
      if(encryptedUser && encryptedPassword) {
        localStorage.setItem('ENCRYPED_LOGGED_USER', encryptedUser); // (kept original key spelling)
        localStorage.setItem('IS_USER_LOGGED_IN', 'true');
        localStorage.setItem('PASSWORD', encryptedPassword);
      }
    }
  }

  /* ---------- Session restore on app start ---------- */
  public async getLocalLoggedUser(): Promise<LoggedUserType | null> {
    if(!this.isBrowser) return null;
    const encrypted = localStorage.getItem('ENCRYPED_LOGGED_USER');
    if(!encrypted) return null;

    try {
      const decryptedUser = (await this.cryptoService.decrypt(encrypted)) as LoggedUserType;
      this.localUser = decryptedUser;
      this.loggedUser = decryptedUser;
      this.isUserActive = !!decryptedUser.isActive;
      this.isValidUser = true;
      this.isLoggedIn = true;

      // Boot realtime on session restore as well
      this.initRealtimeIfNeeded();
      return decryptedUser;
    } catch(e) {
      console.error('[getLocalLoggedUser] decrypt failed', e);
      return null;
    }
  }

  /* ---------- Activity tracker ---------- */
  public async insertLoggedUserTracks() {
    const date = new Date();
    this.activityTrackerService.userLoggedTime = date;
    const data = {username: this.user?.username, date};
    await this.activityTrackerService.saveLoggedUserDataToTracking(data).catch((error) => {console.error(error)});
  }

  /* ==================== Realtime bootstrap ==================== */

  /** Build a backend base URL (prefers APIsService config; falls back to same-origin). */
  private resolveApiBase(): string {
    if(!this.isBrowser) return '';
    const anyAPIs = this.APIs as any;
    const base =
      anyAPIs.apiBase ??
      anyAPIs.baseUrl ??
      anyAPIs.API_BASE ??
      window.location.origin;
    return String(base).replace(/\/+$/, '');
  }

  /**
   * Initialize:
   *  - NotificationService (uses its own Socket.IO internally)
   *  - SocketService (shared socket for chat/calls/other realtime)
   *
   * Runs once per session (guarded by `notificationsInit`).
   */
  private initRealtimeIfNeeded(): void {
    if(!this.isBrowser || this.notificationsInit) return;

    const token =
      (this.APIs as any)?.token ||
      localStorage.getItem('auth_token');

    if(!token) return;

    // Prefer the API base as the WS base unless your backend differs.
    const apiBase = this.resolveApiBase();
    const wsBase = apiBase; // ✅ point to backend host (NOT the Angular dev server)

    // Provide a tokenProvider so both layers can refresh auth if server asks.
    const tokenProvider = () => localStorage.getItem('auth_token') || '';

    // 1) Shared realtime bus (for chat/calls/etc)
    this.socketService.init({wsBase, token, tokenProvider});

    // 2) Notifications (kept as-is; it owns its own socket)
    this.notificationService.initConnection({apiBase, wsBase, token, tokenProvider});
    this.notificationService.load({limit: 20, skip: 0}).catch(() => {});



    this.notificationsInit = true;
  }

  /* ==================== Cleanup (logout) ==================== */

  /** Clears session and disconnects realtime. Call on logout. */
  public clearCredentials(): void {
    this.user = {username: '', password: '', rememberMe: false};
    this.isLoggedIn = false;
    this.isValidUser = false;
    this.isUserActive = false;
    this.setLoggedUser = null;

    // Optional: clear persisted user snapshot (kept original keys)
    if(this.isBrowser) {
      localStorage.removeItem('ENCRYPED_LOGGED_USER');
      localStorage.removeItem('IS_USER_LOGGED_IN');
      localStorage.removeItem('PASSWORD');
      // NOTE: Do not forcibly remove auth_token here if a separate SSO flow manages it.
      // If you do want to wipe it on logout, uncomment:
      // localStorage.removeItem('auth_token');
    }

    // Disconnect both realtime layers
    this.notificationService.disconnect();
    this.socketService.disconnect();
    this.notificationsInit = false;
  }
}
