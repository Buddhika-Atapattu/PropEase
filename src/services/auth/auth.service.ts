import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface UserCredentials {
  username: string;
  password: string;
}

interface UserCredentialsWithRememberMe extends UserCredentials {
  rememberMe?: boolean; // Optional property for rememberMe
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private user: UserCredentials | null = null;
  private isLoggedIn = false;
  private rememberMe = false;

  // Predefined hardcoded user
  private readonly definedUser: UserCredentials = {
    username: 'admin',
    password: 'admin',
  };

  private username: string = '';
  private password: string = '';
  private loginUser: UserCredentials = {
    username: this.username,
    password: this.password,
  };

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.loadCredentialsFromCookies();
  }

  set loginUserCredentials(user: UserCredentialsWithRememberMe) {
    this.username = user.username;
    this.password = user.password;
    this.rememberMe = user.rememberMe || false; // Default to false if not provided
    this.loginUser = {
      username: this.username,
      password: this.password,
    };
  }
  // Return the current logged-in user
  getUser(): UserCredentials | null {
    return this.user;
  }

  // Return the default user
  get getDefinedUser(): UserCredentials {
    return this.definedUser;
  }

  loadCredentialsFromCookies() {
    if (isPlatformBrowser(this.platformId)) {
      const username = this.getCookie('username');
      const password = this.getCookie('password');
      console.log(username, password);
      if (username && password) {
        this.setCredentials({ username, password });
      }
    }
  }

  setCookie(name: string, value: string, days: number): void {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = 'expires=' + date.toUTCString();
    document.cookie = `${name}=${value}; ${expires}; path=/`;
  }

  getCookie(name: string): string | null {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let c of ca) {
      while (c.charAt(0) === ' ') c = c.substring(1);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
  }

  deleteCookie(name: string): void {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }

  saveToCookies(): void {
    if (this.rememberMe) {
      this.setCookie('username', this.username, 30);
      this.setCookie('password', this.password, 30);
    } else {
      this.deleteCookie('username');
      this.deleteCookie('password');
    }
  }

  // Set user login credentials
  setCredentials(credentials: UserCredentials): void {
    this.user = credentials;
    this.isLoggedIn = true;
  }

  // Clear user login credentials
  clearCredentials(): void {
    this.user = null;
    this.isLoggedIn = false;
  }

  // Check if the user is logged in
  isUserLoggedIn(): boolean {
    return this.isLoggedIn;
  }

  // Get the credentials (alias for getUser)
  getCredentials(): UserCredentials | null {
    return this.user;
  }
}
