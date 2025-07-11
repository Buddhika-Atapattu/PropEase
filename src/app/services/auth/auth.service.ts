import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CryptoService } from '../cryptoService/crypto.service';
import { APIsService } from '../APIs/apis.service';
import { ActivityTrackerService } from '../activityTacker/activity-tracker.service';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

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

export interface BaseUser {
  _id?: string;
  __v?: number;
  name: string;
  username: string;
  email: string;
  dateOfBirth?: Date | null;
  age: number;
  image?: string | File;
  phoneNumber?: string;
  bio: string;
  role:
    | 'admin'
    | 'agent'
    | 'tenant'
    | 'owner'
    | 'operator'
    | 'manager'
    | 'developer'
    | 'user';
  gender: string;
  address: Address;
  isActive: boolean;
  access: ROLE_ACCESS_MAP;
  creator: string;
  updator?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewUser extends BaseUser {
  password: string;
}

export interface UsersType extends NewUser {}

export interface UpdateUserType extends Omit<BaseUser, 'createdAt'> {}

export interface LoggedUserType extends Omit<NewUser, 'password'> {}

export type AccessMap = {
  [module: string]: string[]; // list of actions allowed
};

export const ACCESS_OPTIONS: ReadonlyArray<{
  module: string;
  actions: ReadonlyArray<string>;
}> = [
  {
    module: 'User Management',
    actions: [
      'view',
      'create',
      'update',
      'delete',
      'activate',
      'deactivate',
      'reset password',
      'change username',
      'assign roles',
    ] as const,
  },
  {
    module: 'Property Management',
    actions: [
      'view',
      'create',
      'update',
      'delete',
      'assign agent',
      'upload documents',
      'manage amenities',
      'change status',
    ] as const,
  },
  {
    module: 'Tenant Management',
    actions: [
      'add new tenant',
      'edit tenant details',
      'upload/view lease documents',
      'terminate lease',
      'send notification/email/SMS',
      'record manual payment',
      'extend lease',
      'assign to a unit/property',
      'view lease history',
    ] as const,
  },
  {
    module: 'Owner Management',
    actions: [
      'view',
      'create',
      'update',
      'delete',
      'view documents',
      'assign to property',
    ] as const,
  },
  {
    module: 'Agent Management',
    actions: [
      'view',
      'create',
      'update',
      'delete',
      'assign properties',
      'track performance',
    ] as const,
  },
  {
    module: 'Lease Management',
    actions: [
      'view',
      'create',
      'update',
      'terminate',
      'renew',
      'upload document',
      'track expiry',
    ] as const,
  },
  {
    module: 'Payment & Billing',
    actions: [
      'view',
      'record manual',
      'generate invoice',
      'update invoice',
      'delete invoice',
      'view balance',
      'export reports',
      'configure rates',
    ] as const,
  },
  {
    module: 'Maintenance Requests',
    actions: [
      'view',
      'create',
      'assign technician',
      'update status',
      'close',
      'track progress',
      'upload documents',
      'add cost',
      'generate report',
    ] as const,
  },
  {
    module: 'Compliance Management',
    actions: [
      'upload certificates',
      'view status',
      'set reminders',
      'update record',
      'delete record',
      'notify parties',
    ] as const,
  },
  {
    module: 'Document Management',
    actions: ['upload', 'download', 'delete', 'share', 'categorize'] as const,
  },
  {
    module: 'Communication & Notification',
    actions: [
      'send',
      'view logs',
      'customize templates',
      'schedule',
      'notify',
    ] as const,
  },
  {
    module: 'Report Management',
    actions: [
      'generate financial',
      'generate occupancy',
      'export lease',
      'customize templates',
      'view audit logs',
      'download',
    ] as const,
  },
  {
    module: 'Audit Logs',
    actions: [
      'view logs',
      'filter logs',
      'export',
      'monitor login',
      'track role changes',
    ] as const,
  },
  {
    module: 'Dashboard & Analytics',
    actions: [
      'view analytics',
      'customize widgets',
      'download',
      'view real time',
    ] as const,
  },
  {
    module: 'System Settings',
    actions: [
      'manage roles',
      'configure preferences',
      'configure payments',
      'manage integrations',
      'backup restore',
    ] as const,
  },
  {
    module: 'Support & Helpdesk',
    actions: [
      'view tickets',
      'respond',
      'assign staff',
      'close ticket',
      'track history',
      'send feedback',
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
  admin: Object.fromEntries(
    ACCESS_OPTIONS.map((mod) => [mod.module, [...mod.actions]])
  ),

  agent: {
    'Property Management': ['view', 'update', 'upload documents'],
    'Tenant Management': ['view', 'assign to property'],
    'Communication & Notification': ['send', 'view logs'],
    'Dashboard & Analytics': ['view analytics'],
  },

  tenant: {
    'Lease Management': ['view'],
    'Payment & Billing': ['view', 'view balance'],
    'Maintenance Requests': ['view', 'create'],
    'Communication & Notification': ['view logs'],
  },

  owner: {
    'Property Management': ['view'],
    'Tenant Management': ['view'],
    'Report Management': ['generate financial', 'download'],
  },

  operator: {
    'User Management': ['view', 'update'],
    'Maintenance Requests': ['view', 'assign technician', 'close'],
  },

  manager: {
    'User Management': ['view', 'update', 'assign roles'],
    'Property Management': ['view', 'assign agent'],
    'Compliance Management': ['view status', 'update record'],
    'Report Management': ['generate occupancy', 'download'],
  },

  developer: {
    'System Settings': ['configure preferences', 'manage integrations'],
    'Dashboard & Analytics': ['customize widgets', 'view analytics'],
    'Audit Logs': ['view logs'],
  },

  user: {
    'Dashboard & Analytics': ['view analytics'],
    'Communication & Notification': ['view logs'],
  },
};

export function getDefaultAccessByRole(role: Role): {
  [module: string]: { [action: string]: boolean };
} {
  const allowed = DEFAULT_ROLE_ACCESS[role] ?? {};
  const result: Record<string, Record<string, boolean>> = {};

  for (const { module, actions } of ACCESS_OPTIONS) {
    result[module] = {};
    for (const action of actions) {
      result[module][action] = allowed[module]?.includes(action) ?? false;
    }
  }

  return result;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private isBrowser: boolean;
  private isLoggedIn = false;
  private rememberMe = false;
  private username = '';
  private password = '';
  private user: UserCredentials = {
    username: '',
    password: '',
    rememberMe: false,
  };

  private loggedUser: LoggedUserType | null = null;
  private localUser: LoggedUserType | null = null;
  private isValidUser = false;
  private isUserActive = false;
  private users: UsersType[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient,
    private router: Router,
    private cryptoService: CryptoService,
    private APIs: APIsService,
    private activityTrackerService: ActivityTrackerService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // Getters
  get getUserCredentials(): UserCredentials | null {
    return this.user;
  }

  get getLoggedUser(): LoggedUserType | null {
    return this.loggedUser;
  }

  get LocalUser(): LoggedUserType | null {
    return this.localUser;
  }

  get IsActiveUser(): boolean {
    return this.isUserActive;
  }

  get getIsValidUser(): boolean {
    return this.isValidUser;
  }

  get allUsers(): UsersType[] {
    return this.users;
  }

  // Entry point to trigger user verification

  get isUserLoggedIn(): boolean {
    return this.isLoggedIn;
  }

  // Setters
  set loginUserCredentials(user: UserCredentials) {
    this.username = user.username;
    this.password = user.password;
    this.rememberMe = user.rememberMe || false;
  }

  set isUserLoggedIn(value: boolean) {
    this.isLoggedIn = value;
  }

  set setLoggedUser(user: LoggedUserType | null) {
    this.loggedUser = user;
    this.activityTrackerService.loggedUser = user;
  }

  set logginUser(user: UserCredentials) {
    this.user = user;
  }

  public async sendVerifyUser(): Promise<boolean | undefined> {
    return await this.APIs.verifyUser(this.user);
  }

  public isUsersType(data: any): data is UsersType[] | UsersType {
    return (
      Array.isArray(data) &&
      data.every(
        (item) =>
          item &&
          typeof item.name === 'string' &&
          typeof item.username === 'string' &&
          typeof item.email === 'string' &&
          (item.dateOfBirth === null ||
            typeof item.dateOfBirth === 'string' ||
            item.dateOfBirth instanceof Date) &&
          typeof item.age === 'number' &&
          (typeof item.image === 'string' || item.image instanceof File) &&
          (typeof item.phoneNumber === 'string' ||
            typeof item.phoneNumber === 'undefined') &&
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
          ].includes(item.role) &&
          typeof item.gender === 'string' &&
          typeof item.address === 'object' &&
          item.address !== null &&
          typeof item.address.street === 'string' &&
          typeof item.address.houseNumber === 'string' &&
          typeof item.address.city === 'string' &&
          typeof item.address.postcode === 'string' &&
          (typeof item.address.country === 'string' ||
            typeof item.address.country === 'undefined') &&
          (typeof item.address.stateOrProvince === 'string' ||
            typeof item.address.stateOrProvince === 'undefined') &&
          typeof item.isActive === 'boolean' &&
          typeof item.access === 'object' &&
          item.access !== null &&
          typeof item.access.role === 'string' &&
          Array.isArray(item.access.permissions) &&
          item.access.permissions.every(
            (perm: any) =>
              typeof perm === 'object' &&
              typeof perm.module === 'string' &&
              Array.isArray(perm.actions) &&
              perm.actions.every((action: any) => typeof action === 'string')
          ) &&
          typeof item.creator === 'string' &&
          (typeof item.updator === 'string' ||
            typeof item.updator === 'undefined') &&
          (typeof item.createdAt === 'string' ||
            item.createdAt instanceof Date) &&
          (typeof item.updatedAt === 'string' || item.updatedAt instanceof Date)
      )
    );
  }

  // Main user verification logic
  public async sendUserCredentialsAndGetUserData(
    role: string
  ): Promise<boolean | undefined> {
    if (this.isBrowser) {
      try {
        const canSaveAllUsers = ['admin', 'operator'].includes(role);
        if (canSaveAllUsers) {
          const users = await this.APIs.getAllUsers();
          if (!users) {
            throw new Error('Users are not fetched');
          }
          const encryptedUsers = await this.cryptoService.encrypt(users);
          if (encryptedUsers) {
            localStorage.setItem('USERS', encryptedUsers);
          } else {
            throw new Error('Users are not encrypted');
          }
        } else {
          throw new Error('User is not admin or operator');
        }
        return true;
      } catch (error) {
        // console.error('Error', error);
        return false;
      }
    } else {
      return false;
    }
  }

  // Post-login steps to run after authentication
  public async afterUserLoggedInOperatios(): Promise<void> {
    if (this.isBrowser) {
      if (this.isValidUser) {
        const encryptedUser = await this.cryptoService.encrypt(this.localUser!);
        const encryptedPassword = await this.cryptoService.encrypt(
          this.password
        );
        if (encryptedUser && encryptedPassword) {
          localStorage.setItem('ENCRYPED_LOGGED_USER', encryptedUser);
          localStorage.setItem('IS_USER_LOGGED_IN', 'true');
          localStorage.setItem('PASSWORD', encryptedPassword);
        }
      }
    }
  }

  // Decrypt and return local stored user if available
  public async getLocalLoggedUser(): Promise<LoggedUserType | null> {
    if (this.isBrowser) {
      const encrypted = localStorage.getItem('ENCRYPED_LOGGED_USER');
      if (encrypted) {
        const decryptedUser = await this.cryptoService.decrypt(encrypted);
        this.localUser = decryptedUser;
        this.loggedUser = decryptedUser;
        this.isUserActive = decryptedUser.isActive;
        this.isValidUser = true;
        this.isLoggedIn = true;

        return decryptedUser;
      }
    }
    return null;
  }

  public async insertLoggedUserTracks() {
    const date = new Date();
    this.activityTrackerService.userLoggedTime = date;

    const data = {
      username: this.user?.username,
      date: date,
    };
    await this.activityTrackerService
      .saveLoggedUserDataToTracking(data)
      .then((data) => {
        // console.log(data);
      })
      .catch((error) => {
        if (error) {
          // console.log('Error: ', error);
        }
      });
  }

  public clearCredentials(): void {
    this.user = {} as UserCredentials;
    this.isLoggedIn = false;
  }
}
