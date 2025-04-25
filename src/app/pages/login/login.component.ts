// login.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { WindowsRefService } from '../../../services/windowRef.service';
import { Subscription } from 'rxjs';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import {
  MatCheckboxChange,
  MatCheckboxModule,
} from '@angular/material/checkbox';
import {
  AuthService,
  UserCredentials,
} from '../../../services/auth/auth.service';
import { Router } from '@angular/router';

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
  isBrowser: boolean;
  protected username: string = '';
  protected password: string = '';
  private modeSub: Subscription | null = null;
  protected hidePassword: boolean = true;
  protected isEmpty: boolean = true;
  protected isValid: boolean = false;
  protected rememberMe: Boolean = false;
  private user: UserCredentials | null = null;

  constructor(
    private windowRef: WindowsRefService,
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      // Subscribe to dark/light mode
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });

      // Load cookies if available
      const savedUsername = this.getCookie('username');
      const savedPassword = this.getCookie('password');

      if (savedUsername && savedPassword) {
        this.username = savedUsername;
        this.password = savedPassword;
        this.rememberMe = true;

        // Attempt auto login
        this.login();
      }
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
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
    if (this.rememberMe) {
      this.setCookie('username', this.username, 30);
      this.setCookie('password', this.password, 30);
    } else {
      this.deleteCookie('username');
      this.deleteCookie('password');
    }
  }

  protected login(): void {
    if (!this.username || !this.password) {
      console.error('Username and password cannot be empty.');
      this.isEmpty = true;
      return;
    }

    const isValid =
      this.username === this.authService.getDefinedUser.username &&
      this.password === this.authService.getDefinedUser.password;

    if (isValid) {
      const user: UserCredentials = {
        username: this.username,
        password: this.password,
      };
      this.authService.setCredentials(user);
      this.saveToCookies();
      this.router.navigate(['/dashboard']);
    } else {
      console.error('Invalid username or password.');
      this.authService.clearCredentials();
      this.username = '';
      this.password = '';
      this.saveToCookies(); // Clears cookies if login fails
    }
  }
}
