import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CryptoService } from '../../services/cryptoService/crypto.service';
import { APIsService } from '../APIs/apis.service';

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

export interface Role {
  role: 'admin' | 'agent' | 'tenant' | 'operator' | 'developer' | 'user';
}

export interface BaseUser {
  __id?: string;
  __v?: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  username: string;
  email: string;
  age: number;
  image?: string | File;
  phoneNumber?: string;
  role: Role;
  address: Address;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewUser extends BaseUser {
  password: string;
}

export interface UsersType extends NewUser {}

export interface LoggedUserType extends Omit<NewUser, 'password'> {}

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
    private APIs: APIsService
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
  get verifyUser(): Promise<boolean | undefined> {
    return this.sendUserCredentialsAndGetUserData(this.user);
  }

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
  }

  set logginUser(user: UserCredentials) {
    this.user = user;
  }

  public async sendVerifyUser(): Promise<boolean | undefined> {
    return await this.APIs.verifyUser(this.user);
  }

  // Main user verification logic
  private async sendUserCredentialsAndGetUserData(
    user: UserCredentials
  ): Promise<boolean | undefined> {
    try {
      const user: UserCredentials = {
        username: this.username,
        password: this.password,
        rememberMe: this.rememberMe,
      };

      const data: LoggedUserType = await this.APIs.verifyUser(user);
      if (data) {
        this.setLoggedUser = data;
        this.user = user;

        const canSaveAllUsers = ['admin', 'operator'].includes(data.role.role);
        if (canSaveAllUsers) {
          const users = await this.APIs.getAllUsers();
          localStorage.setItem(
            'USERS',
            await this.cryptoService.encrypt(users)
          );
        } else {
          this.user = { username: '', password: '', rememberMe: false };
        }

        return true;
      }
    } catch (error) {
      console.error('User verification failed:', error);
    }

    return false;
  }

  // Post-login steps to run after authentication
  private async afterUserLoggedInOperatios(): Promise<void> {
    const isVerified = await this.sendUserCredentialsAndGetUserData(this.user);
    if (this.isBrowser && isVerified) {
      const encryptedUser = await this.cryptoService.encrypt(this.localUser!);
      const encryptedPassword = await this.cryptoService.encrypt(this.password);

      localStorage.setItem('ENCRYPED_LOGGED_USER', encryptedUser);
      localStorage.setItem('IS_USER_LOGGED_IN', 'true');
      localStorage.setItem('PASSWORD', encryptedPassword);
    }
  }

  // Decrypt and return local stored user if available
  private async getLocalLoggedUser(): Promise<LoggedUserType | null> {
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

  // Public method to retrieve and assign local user
  public async getAndAssignValuesFromLocalUser(): Promise<LoggedUserType | null> {
    return await this.getLocalLoggedUser();
  }

  clearCredentials(): void {
    this.user = {} as UserCredentials;
    this.isLoggedIn = false;
  }
}
