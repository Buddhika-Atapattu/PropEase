// login.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  NgZone,
  ApplicationRef,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { WindowsRefService } from '../../../services/windowRef.service';
import { filter, firstValueFrom, Subscription, take } from 'rxjs';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  AuthService,
  UserCredentials,
} from '../../../services/auth/auth.service';
import {
  APIsService,
  LoggedUserType,
} from '../../../services/APIs/apis.service';
import {
  MatCheckboxChange,
  MatCheckboxModule,
} from '@angular/material/checkbox';

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
  protected username: string | null = '';
  protected password: string | null = '';
  protected rememberMe: boolean = false;
  protected hidePassword: boolean = true;
  protected isEmpty: boolean = true;
  protected isValid: boolean = false;
  protected mode: boolean | null = null;

  private isBrowser: boolean;
  private modeSub: Subscription | null = null;

  private user: UserCredentials = {
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
    private APIs: APIsService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private appRef: ApplicationRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.initializeFromCookies();
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      (window as any).LoginComponent = this;
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // Checkbox event handler
  protected updateRememberMe(event: MatCheckboxChange): void {
    this.rememberMe = event.checked;
  }

  // Login handler
  protected async login(): Promise<void> {
    if (!this.username || !this.password) {
      console.error('Username and password cannot be empty.');
      this.isEmpty = true;
      return;
    } else {
      const user = {
        username: this.username,
        password: this.password,
        rememberMe: this.rememberMe,
      };
      this.authService.logginUser = user;
      const verifiedUser = await this.authService
        .sendVerifyUser()
        .then((data) => {
          if (data && typeof data === 'object' && 'username' in data) {
            this.authService.setLoggedUser = data as LoggedUserType;
          } else {
            this.authService.setLoggedUser = null;
          }
          return data;
        });
      if (
        this.authService.getLoggedUser !== null &&
        this.authService.getLoggedUser.isActive
      ) {
        const username = await this.cryptoService.encrypt(this.username || '');
        const password = await this.cryptoService.encrypt(this.password || '');
        if (username !== null && password !== null) {
          this.saveToCookies(username, password);
          this.authService.isUserLoggedIn = true;
          this.router.navigate(['/dashboard/home']);
        } else {
          console.error('Username or password is null');
          this.authService.clearCredentials();
          this.username = '';
          this.password = '';
          await this.saveToCookies('', ''); // clear cookies if login fails
          this.router.navigate(['/login']);
        }
      } else {
        console.error('Username or password is null');
        this.authService.clearCredentials();
        this.username = '';
        this.password = '';
        await this.saveToCookies('', ''); // clear cookies if login fails
        this.router.navigate(['/login']);
      }
    }
  }

  // Cookie management
  private setCookie(name: string, value: string, days: number): void {
    const expires = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/`;
  }

  private getCookie(name: string): string | null {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let c of cookies) {
      c = c.trim();
      if (c.startsWith(nameEQ)) return c.slice(nameEQ.length);
    }
    return null;
  }

  private deleteCookie(name: string): void {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }

  private async saveToCookies(
    username: string,
    password: string
  ): Promise<void> {
    if (this.rememberMe && this.username && this.password) {
      this.setCookie('username', username, 30);
      this.setCookie('password', password, 30);
    } else {
      this.deleteCookie('username');
      this.deleteCookie('password');
    }
  }

  private async initializeFromCookies(): Promise<void> {
    if (this.isBrowser) {
      const decryptedUsername = await this.cryptoService.decrypt(
        this.getCookie('username') || ''
      );
      const decryptedPassword = await this.cryptoService.decrypt(
        this.getCookie('password') || ''
      );

      if (decryptedUsername !== null && decryptedPassword !== null) {
        this.username = decryptedUsername;
        this.password = decryptedPassword;
        this.rememberMe = true;
      }
    }
  }
}
