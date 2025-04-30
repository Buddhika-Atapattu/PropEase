import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { filter, firstValueFrom } from 'rxjs';

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
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private user: UserCredentials | null = null;
  private isLoggedIn = false;
  private rememberMe = false;
  private username: string = '';
  private password: string = '';
  private loggedUser: NewUser | null = null;
  private isValidUser: boolean = false;
  private users: NewUser[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {
    // this.loadCredentialsFromCookies();
  }

  set loginUserCredentials(user: UserCredentials) {
    // console.log(user);
    this.username = user.username;
    this.password = user.password;
    this.rememberMe = user.rememberMe || false; // Default to false if not provided
  }

  // Return the current logged-in user
  getUser(): UserCredentials | null {
    return this.user;
  }

  public async callApiUsers(): Promise<void> {
    try {
      console.log('username: ', this.username, ' password: ', this.password);

      const users = await firstValueFrom(
        this.http.get<NewUser[]>('http://localhost:3000/users')
      );

      const user = users.find(
        (u) =>
          (u.username === this.username || u.email === this.username) &&
          u.password === this.password
      );

      this.loggedUser = user || null;

      if (user) {
        this.loggedUser = user;
        this.isValidUser = true;
        this.isLoggedIn = true;
      } else {
        this.isValidUser = false;
        this.isLoggedIn = false;
      }
    } catch (error) {
      console.error('Error: ', error);
    }
  }

  get getIsValidUser(): boolean {
    return this.isValidUser;
  }

  get allUsers(): NewUser[] {
    return this.users;
  }

  get getLoggedUser(): NewUser | null {
    return this.loggedUser;
  }

  // Clear user login credentials
  public clearCredentials(): void {
    this.user = null;
    this.isLoggedIn = false;
  }

  // Check if the user is logged in
  public isUserLoggedIn(): boolean {
    return this.isLoggedIn;
  }
}
