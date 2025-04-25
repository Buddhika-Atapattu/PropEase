import { Injectable } from '@angular/core';

export interface UserCredentials {
  username: string;
  password: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private user: UserCredentials | null = null;
  private isLoggedIn = false;

  // Predefined hardcoded user
  private readonly definedUser: UserCredentials = {
    username: 'admin',
    password: 'admin',
  };

  constructor() {}

  // Return the current logged-in user
  getUser(): UserCredentials | null {
    return this.user;
  }

  // Return the default user
  get getDefinedUser(): UserCredentials {
    return this.definedUser;
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
