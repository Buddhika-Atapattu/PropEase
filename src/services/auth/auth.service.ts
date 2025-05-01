import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { filter, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { CryptoService } from '../../services/cryptoService/crypto.service';

export interface UserCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

//User data pattern
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

export interface NewUser {
  __id?: string;
  __v?: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  age: number;
  image?: string | File;
  phoneNumber?: string;
  role: Role;
  address: Address;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface UsersType {
  __id?: string;
  __v?: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  age: number;
  image?: string | File;
  phoneNumber?: string;
  role: Role;
  address: Address;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoggedUserType {
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
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private isLoggedIn = false;
  private rememberMe = false;
  private username: string = '';
  private password: string = '';
  private loggedUser: LoggedUserType | null = null;
  private isValidUser: boolean = false;
  private users: UsersType[] = [];
  private isBrowser: boolean;
  private localUser: LoggedUserType | null = null;
  private isUserActive: boolean = false;
  private user: UserCredentials = {
    username: this.username,
    password: this.password,
    rememberMe: this.rememberMe,
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient,
    private router: Router,
    private cryptoService: CryptoService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    // this.getLocalLoggedUser()
  }

  private async getLocalLoggedUser(): Promise<LoggedUserType | null> {
    if (this.isBrowser) {
      const getLoggedUserDataFromLocalStorage: string | null =
        localStorage.getItem('ENCRYPED_LOGGED_USER');
      if (getLoggedUserDataFromLocalStorage !== null) {
        const getLoggedUser: LoggedUserType = await this.cryptoService.decrypt(
          getLoggedUserDataFromLocalStorage
        );
        this.localUser = getLoggedUser;
        this.loggedUser = getLoggedUser;
        this.isUserActive = getLoggedUser.isActive;
        this.isValidUser = true;
        this.isLoggedIn = true;
        return getLoggedUser;
      } else {
        return null;
      }
    }
    return Promise.resolve(null);
  }

  set loginUserCredentials(user: UserCredentials) {
    this.username = user.username;
    this.password = user.password;
    this.rememberMe = user.rememberMe || false; // Default to false if not provided
  }

  public async getAndAssignValuesFromLocalUser(): Promise<LoggedUserType | null> {
    return await this.getLocalLoggedUser();
  }

  // Return the current logged-in user
  getUser(): UserCredentials | null {
    return this.user;
  }

  get LocalUser(): LoggedUserType | null {
    return this.localUser;
  }

  set setLoggedUser(user: LoggedUserType | null) {
    this.loggedUser = user;
  }

  get getLoggedUser(): LoggedUserType | null {
    return this.loggedUser;
  }

  get IsActiveUser(): boolean {
    return this.isUserActive;
  }

  get getIsValidUser(): boolean {
    return this.isValidUser;
  }

  get allUsers(): LoggedUserType[] {
    return this.users;
  }

  // Clear user login credentials
  public clearCredentials(): void {
    this.user = {} as UserCredentials;
    this.isLoggedIn = false;
  }

  // Check if the user is logged in
  public isUserLoggedIn(): boolean {
    return this.isLoggedIn;
  }
}
