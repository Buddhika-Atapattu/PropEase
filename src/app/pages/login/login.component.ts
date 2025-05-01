// login.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  NgZone,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { WindowsRefService } from '../../../services/windowRef.service';
import { firstValueFrom, Subscription } from 'rxjs';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CryptoService } from '../../../services/cryptoService/crypto.service';

import {
  MatCheckboxChange,
  MatCheckboxModule,
} from '@angular/material/checkbox';
import {
  AuthService,
  LoggedUserType,
  UserCredentials,
  UsersType,
} from '../../../services/auth/auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  mode: boolean | null = null;
  private isBrowser: boolean;
  protected username: string | null = '';
  protected password: string | null = '';
  private modeSub: Subscription | null = null;
  protected hidePassword: boolean = true;
  protected isEmpty: boolean = true;
  protected isValid: boolean = false;
  protected rememberMe: boolean = false;
  private user: UserCredentials | null = {
    username: '',
    password: '',
    rememberMe: false,
  };

  constructor(
    private windowRef: WindowsRefService,
    protected authService: AuthService,
    private router: Router,
    private ngZone: NgZone,
    private cryptoService: CryptoService,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnInit() {
    console.log('ngOnInit started');
    if (this.isBrowser) {
      (window as any).LoginComponent = this;
      // Subscribe to dark/light mode
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });

      // Load cookies if available
      const savedUsername = this.getCookie('username');
      const savedPassword = this.getCookie('password');

      if (savedUsername !== '' && savedPassword !== '') {
        this.username = savedUsername;
        this.password = savedPassword;
        this.rememberMe = true;
      } else {
        const localUser: string | null = localStorage.getItem(
          'ENCRYPED_LOGGED_USER'
        );
        if (localUser !== null) {
          await this.authService.getAndAssignValuesFromLocalUser();
          this.username = this.authService.getLoggedUser?.username || '';
          this.password = '';
        }
      }
      // Attempt auto login
      // this.login();
    }
  }

  get auth(): AuthService {
    return this.authService;
  }

  protected updateRememberMe(event: MatCheckboxChange): void {
    this.rememberMe = event.checked;
  }

  protected setCookie(name: string, value: string, days: number): void {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = 'expires=' + date.toUTCString();
    document.cookie = `${name}=${value}; ${expires}; path=/`;
  }

  protected getCookie(name: string): string | null {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let c of ca) {
      while (c.charAt(0) === ' ') c = c.substring(1);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
  }

  protected deleteCookie(name: string): void {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }

  protected saveToCookies(): void {
    if (this.rememberMe && this.username && this.password) {
      this.setCookie('username', this.username, 30);
      this.setCookie('password', this.password, 30);
    } else {
      this.deleteCookie('username');
      this.deleteCookie('password');
    }
  }

  private async getAllUsersAndSaveToLocalStorage(): Promise<UsersType[]> {
    if (this.isBrowser) {
      try {
        const users: UsersType[] = await firstValueFrom(
          this.http.get<UsersType[]>('http://localhost:3000/users')
        );
        const encrypted = await this.cryptoService.encrypt(users);
        localStorage.setItem('USERS', encrypted);
      } catch (error) {
        console.log(error);
      }
    }
    return Promise.resolve([]);
  }

  private async sendUserCredentialsAndGetUserData(): Promise<void> {
    try {
      const user: UserCredentials = {
        username: this.username || '',
        password: this.password || '',
        rememberMe: this.rememberMe,
      };
      const data: LoggedUserType = await firstValueFrom(
        this.http.post<LoggedUserType>(
          'http://localhost:3000/verify-user',
          user
        )
      );

      if (data !== null) {
        this.authService.setLoggedUser = data;
        this.user = {
          username: this.username || '',
          password: this.password || '',
          rememberMe: this.rememberMe,
        };
        this.authService.loginUserCredentials = this.user;
        const authorizedRolesToSaveAllUsersToLocalStorage = [
          'admin',
          'operator',
        ];

        if (
          authorizedRolesToSaveAllUsersToLocalStorage.includes(data.role.role)
        ) {
          await this.getAllUsersAndSaveToLocalStorage();
        }
      } else {
        this.user = {
          username: '',
          password: '',
          rememberMe: false,
        };
      }
    } catch (error) {
      console.error(error);
    }
    return Promise.resolve();
  }

  // Login Method
  protected async login(): Promise<void> {
    if (!this.username || !this.password) {
      console.error('Username and password cannot be empty.');
      this.isEmpty = true;
      return;
    }
    await this.sendUserCredentialsAndGetUserData();
    if (
      this.authService.getLoggedUser !== null &&
      this.authService.getLoggedUser.isActive &&
      this.isBrowser
    ) {
      const encrypted = await this.cryptoService.encrypt(
        this.authService.getLoggedUser
      );
      localStorage.setItem('ENCRYPED_LOGGED_USER', encrypted);
      localStorage.setItem('IS_USER_LOGGED_IN', true.toString());
      this.saveToCookies();
      // this.router.navigate(['/dashboard/home']);
    } else {
      console.error('Invalid username or password.');
      this.authService.clearCredentials();
      this.username = '';
      this.password = '';
      this.saveToCookies(); // Clears cookies if login fails
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }
}
