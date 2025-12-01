// login.component.ts

import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatCheckboxChange,
  MatCheckboxModule,
} from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  NotificationDialogComponent,
} from '../../components/dialogs/notification/notificationBar.component';
import {
  User
} from '../../services/APIs/apis.service';
import {
  AuthService,
  UserCredentials,
} from '../../services/auth/auth.service';
import { CryptoService } from '../../services/cryptoService/crypto.service';
import { WindowsRefService } from '../../services/windowRef/windowRef.service';

@Component( {
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
    NotificationDialogComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
} )
export class LoginComponent implements OnInit, OnDestroy {

  // ─────────────────────────────────────────────────────────────
  // View children
  // ─────────────────────────────────────────────────────────────

  @ViewChild( NotificationDialogComponent, { static: true } )
  protected notification!: NotificationDialogComponent;

  // ─────────────────────────────────────────────────────────────
  // Template-bound state
  // ─────────────────────────────────────────────────────────────

  /**
   * Username typed or restored for the login form.
   */
  protected username: string | null = '';

  /**
   * Password typed or restored for the login form.
   */
  protected password: string | null = '';

  /**
   * "Remember me" checkbox state.
   * When true, encrypted username + password are stored in cookies,
   * and the logged user object is stored in localStorage.
   */
  protected rememberMe: boolean = false;

  /**
   * Controls password visibility in the UI.
   */
  protected hidePassword: boolean = true;

  /**
   * Can be used in the template to show "empty" validation states.
   */
  protected isEmpty: boolean = true;

  /**
   * Can be used in the template if you later add client-side validation.
   */
  protected isValid: boolean = false;

  /**
   * Current UI mode (light / dark) pushed from WindowRefService.
   */
  protected mode: boolean | null = null;

  /**
   * Flag to indicate an error state (optional use in template).
   */
  protected isError: boolean = false;

  /**
   * Optional message to show in the template if needed.
   */
  protected message: string = '';

  /**
   * Indicates if a user was successfully restored from cookies/localStorage.
   * Useful if you want to show some hint like "Welcome back".
   */
  protected isUserSaved: boolean = false;

  // ─────────────────────────────────────────────────────────────
  // Internal / private fields
  // ─────────────────────────────────────────────────────────────

  /**
   * True only in browser runtime (false for SSR / pre-render).
   * Use this to guard all `window`, `document`, and `localStorage` usage.
   */
  private readonly isBrowser: boolean;

  /**
   * Subscription for dark/light mode stream from WindowRefService.
   */
  private modeSub: Subscription | null = null;

  /**
   * Small helper object used to send credentials to the AuthService.
   * This is never exposed to the template directly.
   */
  private readonly user: UserCredentials = {
    username: '',
    password: '',
    rememberMe: false,
  };

  // ─────────────────────────────────────────────────────────────
  // Constructor / Dependency Injection
  // ─────────────────────────────────────────────────────────────

  constructor (
    private readonly windowRef: WindowsRefService,
    protected readonly authService: AuthService,
    private readonly router: Router,
    private readonly cryptoService: CryptoService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
  ) {
    // Detect if this code runs in a real browser.
    this.isBrowser = isPlatformBrowser( this.platformId );

    // Start reading saved cookies in the background.
    // This only runs safely in the browser.
    this.initializeFromCookies().catch( ( err ) => {
      // Fails silently – user can still log in manually.
      console.error( '[LoginComponent] initializeFromCookies error:', err );
    } );
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle Hooks
  // ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      // Expose instance on window ONLY for debugging in dev-tools.
      ( window as any ).LoginComponent = this;

      // Subscribe to global mode changes (light/dark).
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }

    // Try auto-login if encrypted credentials + user object exist.
    await this.autoLogin();
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ─────────────────────────────────────────────────────────────
  // Public / template-triggered handlers
  // ─────────────────────────────────────────────────────────────

  /**
   * Toggle password visibility (used by eye icon button in template).
   */
  protected togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }

  /**
   * Checkbox change handler for "Remember me".
   */
  protected updateRememberMe( event: MatCheckboxChange ): void {
    this.rememberMe = event.checked;
  }

  /**
   * Main login handler, triggered by form submit / login button.
   * Validates inputs, calls AuthService, encrypts + stores credentials,
   * and finally redirects to the dashboard on success.
   */
  protected async login(): Promise<void> {
    try {
      // Basic empty check before hitting server.
      if ( !this.username || !this.password ) {
        this.isEmpty = true;
        this.notification.notification(
          'error',
          'Username and password cannot be empty.',
        );
        console.error( '[LoginComponent] Username and password cannot be empty.' );
        return;
      }

      this.isEmpty = false;

      // Build credentials object for AuthService.
      this.user.username = this.username;
      this.user.password = this.password;
      this.user.rememberMe = this.rememberMe;

      this.authService.logginUser = this.user;

      // Ask backend to verify credentials.
      const verifiedUser: boolean = await this.authService.sendVerifyUser();

      if ( !verifiedUser ) {
        throw new Error( 'Invalid username or password.' );
      }

      const loggedUser: User | null = this.authService.getLoggedUser;

      // Basic guard: user must be present and active.
      if ( !loggedUser || !loggedUser.isActive ) {
        throw new Error( 'User inactive or login error. Please refresh the browser.' );
      }

      // Encrypt credentials and user payload in parallel.
      const [ encryptedUsername, encryptedPassword, encryptedUser ] =
        await Promise.all( [
          this.cryptoService.encrypt( this.username || '' ),
          this.cryptoService.encrypt( this.password || '' ),
          this.cryptoService.encrypt( JSON.stringify( loggedUser ) ),
        ] );

      if ( !encryptedUsername || !encryptedPassword || !encryptedUser ) {
        throw new Error( 'Encryption failed for login credentials.' );
      }

      // Persist encrypted user in localStorage (browser only).
      if ( this.isBrowser ) {
        localStorage.setItem( 'loggedUser', encryptedUser );
      }

      // Save encrypted credentials in cookies if rememberMe is true.
      await this.saveToCookies( encryptedUsername, encryptedPassword );

      // Mark as logged in.
      this.authService.isUserLoggedIn = true;

      // Optional: track login activity in backend (if implemented).
      await this.authService.insertLoggedUserTracks();

      // Navigate to dashboard.
      this.router.navigate( [ '/dashboard/home' ] );
    } catch ( error: any ) {
      console.error( '[LoginComponent] Login Error:', error );

      this.isError = true;

      this.notification.notification(
        'error',
        error?.error?.error || error?.message || 'Unknown error during login.',
      );

      // Reset sensitive data and clear stored credentials.
      this.authService.clearCredentials();
      this.username = '';
      this.password = '';

      // Ensure cookies are cleared even if rememberMe is still true.
      await this.saveToCookies( '', '' );

      // Stay on or navigate back to login route.
      this.router.navigate( [ '/login' ] );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Auto-login flow
  // ─────────────────────────────────────────────────────────────

  /**
   * Attempts to auto-login using encrypted username/password cookies
   * and the encrypted loggedUser object stored in localStorage.
   */
  private async autoLogin(): Promise<void> {
    // Do nothing on SSR / non-browser.
    if ( !this.isBrowser ) {
      return;
    }

    try {
      // 1) Read encrypted cookies once.
      const encUsernameCookie: string | null = this.getCookie( 'username' );
      const encPasswordCookie: string | null = this.getCookie( 'password' );

      // No saved creds → quietly return.
      if ( !encUsernameCookie || !encPasswordCookie ) {
        return;
      }

      // 2) Read encrypted loggedUser from localStorage.
      const encLoggedUserJson: string | null =
        localStorage.getItem( 'loggedUser' );

      if ( !encLoggedUserJson ) {
        // Old cookies but no user object – clear & ask for login.
        this.authService.clearCredentials();
        this.notification.notification(
          'error',
          'Saved session is invalid. Please login again.',
        );
        return;
      }

      // 3) Decrypt everything.
      const username: string | null =
        await this.cryptoService.decrypt( encUsernameCookie );
      const password: string | null =
        await this.cryptoService.decrypt( encPasswordCookie );
      const loggedUserJson: string | null =
        await this.cryptoService.decrypt( encLoggedUserJson );

      // 4) Validate decrypted values.
      if ( !username || !password || !loggedUserJson ) {
        this.authService.clearCredentials();
        this.notification.notification(
          'error',
          'Saved login data is corrupted. Please login again.',
        );
        return;
      }

      // 5) Parse user object safely.
      let loggedUser: User;
      try {
        loggedUser = JSON.parse( loggedUserJson ) as User;
      } catch {
        this.authService.clearCredentials();
        this.notification.notification(
          'error',
          'Saved account details are invalid. Please login again.',
        );
        return;
      }

      // Extra guard: basic fields.
      if ( !loggedUser.username || loggedUser.username.trim() === '' ) {
        this.authService.clearCredentials();
        this.notification.notification(
          'error',
          'Saved account details are incomplete. Please login again.',
        );
        return;
      }

      // 6) Apply to form + auth service.
      this.username = username;
      this.password = password;
      this.rememberMe = true;
      this.isUserSaved = true;

      this.authService.logginUser = {
        username: this.username,
        password: this.password,
        rememberMe: true,
      };
      this.authService.setLoggedUser = loggedUser;

      if ( !this.authService.getLoggedUser ) {
        this.authService.clearCredentials();
        this.notification.notification(
          'error',
          'Failed to attach saved login. Please login again.',
        );
        return;
      }

      // Mark as active.
      this.authService.getLoggedUser.isActive = true;
      this.authService.isUserLoggedIn = true;

      // 7) Redirect to dashboard.
      this.router.navigate( [ '/dashboard/home' ] );
    } catch ( error ) {
      console.error( '[LoginComponent] autoLogin error:', error );
      this.authService.clearCredentials();
      this.notification.notification(
        'error',
        'Unable to restore saved login. Please login again.',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Cookie helpers (browser-only)
  // ─────────────────────────────────────────────────────────────

  /**
   * Low-level function to set a cookie.
   */
  private setCookie( name: string, value: string, days: number ): void {
    if ( !this.isBrowser ) {
      return;
    }

    const expires = new Date( Date.now() + days * 86400000 ).toUTCString();
    document.cookie = `${ name }=${ value }; expires=${ expires }; path=/`;
  }

  /**
   * Low-level function to get a cookie by name.
   */
  private getCookie( name: string ): string | null {
    if ( !this.isBrowser ) {
      return null;
    }

    const nameEQ = `${ name }=`;
    const cookies = document.cookie.split( ';' );

    for ( let c of cookies ) {
      c = c.trim();
      if ( c.startsWith( nameEQ ) ) {
        return c.slice( nameEQ.length );
      }
    }

    return null;
  }

  /**
   * Low-level function to delete a cookie by name.
   */
  private deleteCookie( name: string ): void {
    if ( !this.isBrowser ) {
      return;
    }

    document.cookie = `${ name }=; Max-Age=0; path=/`;
  }

  /**
   * Stores or clears encrypted username/password cookies
   * depending on the rememberMe flag and current login state.
   */
  private async saveToCookies(
    username: string,
    password: string,
  ): Promise<void> {
    if ( !this.isBrowser ) {
      return;
    }

    const hasCreds: boolean = !!this.username && !!this.password;
    const hasUser: boolean = this.authService.getLoggedUser !== null;

    if ( this.rememberMe && hasCreds && hasUser ) {
      // Save encrypted credentials to cookies for 30 days.
      this.setCookie( 'username', username, 30 );
      this.setCookie( 'password', password, 30 );
    } else {
      // Clear cookies if rememberMe is off or data is not valid.
      this.deleteCookie( 'username' );
      this.deleteCookie( 'password' );
    }
  }

  /**
   * Reads encrypted cookies on startup and populates the form
   * with decrypted credentials if they are valid.
   * NOTE: this does NOT log the user in; that’s handled by autoLogin().
   */
  private async initializeFromCookies(): Promise<void> {
    if ( !this.isBrowser ) {
      return;
    }

    const encUsername: string | null = this.getCookie( 'username' );
    const encPassword: string | null = this.getCookie( 'password' );

    if ( !encUsername || !encPassword ) {
      return;
    }

    const decryptedUsername: string | null =
      await this.cryptoService.decrypt( encUsername );
    const decryptedPassword: string | null =
      await this.cryptoService.decrypt( encPassword );

    if ( decryptedUsername !== null && decryptedPassword !== null ) {
      this.username = decryptedUsername;
      this.password = decryptedPassword;
      this.rememberMe = true;
    }
  }
}
