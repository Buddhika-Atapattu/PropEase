// login.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  NgZone,
  ApplicationRef,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { WindowsRefService } from '../../services/windowRef/windowRef.service';
import { filter, firstValueFrom, Subscription, take } from 'rxjs';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CryptoService } from '../../services/cryptoService/crypto.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  AuthService,
  UserCredentials,
} from '../../services/auth/auth.service';
import {
  APIsService,
  LoggedUserType,
} from '../../services/APIs/apis.service';
import {
  MatCheckboxChange,
  MatCheckboxModule,
} from '@angular/material/checkbox';
import { ActivityTrackerService } from '../../services/activityTacker/activity-tracker.service';
import {
  msgTypes,
  NotificationDialogComponent,
} from '../../components/dialogs/notification/notification.component';

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
  @ViewChild( NotificationDialogComponent, { static: true } )
  notification!: NotificationDialogComponent;
  protected username: string | null = '';
  protected password: string | null = '';
  protected rememberMe: boolean = false;
  protected hidePassword: boolean = true;
  protected isEmpty: boolean = true;
  protected isValid: boolean = false;
  protected mode: boolean | null = null;
  protected isError: boolean = false;
  protected message: string = '';

  private isBrowser: boolean;
  private modeSub: Subscription | null = null;

  private user: UserCredentials = {
    username: '',
    password: '',
    rememberMe: false,
  };

  protected isUserSaved: boolean = false;

  constructor (
    private windowRef: WindowsRefService,
    protected authService: AuthService,
    private router: Router,
    private ngZone: NgZone,
    private cryptoService: CryptoService,
    private http: HttpClient,
    private APIs: APIsService,
    @Inject( PLATFORM_ID ) private platformId: Object,
    private appRef: ApplicationRef,
    private activityTrackerService: ActivityTrackerService
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.initializeFromCookies();
  }

  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      ( window as any ).LoginComponent = this;
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }
    // auto login
    await this.autoLogin();
    return Promise.resolve();
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  private async autoLogin() {
    if ( this.isBrowser ) {
      if (
        this.getCookie( 'username' ) !== null &&
        this.getCookie( 'password' ) !== null
      ) {
        const username: string | null = await this.cryptoService.decrypt(
          this.getCookie( 'username' ) || ''
        );
        const password: string | null = await this.cryptoService.decrypt(
          this.getCookie( 'password' ) || ''
        );

        const getLoggedUserData = localStorage.getItem( 'loggedUser' );

        const loggedUser: LoggedUserType | null = JSON.parse(
          await this.cryptoService.decrypt( getLoggedUserData || '' )
        );

        this.username = username;
        this.password = password;
        this.rememberMe = true;

        if ( this.username !== '' && this.password !== '' && this.rememberMe ) {
          if ( loggedUser ) {
            this.isUserSaved = true;
            this.authService.logginUser = {
              username: this.username ?? '',
              password: this.password ?? '',
              rememberMe: true,
            };
            this.authService.setLoggedUser = loggedUser;
            if ( this.authService.getLoggedUser !== null ) {
              this.activityTrackerService.loggedUser = loggedUser;
              this.authService.getLoggedUser.isActive = true;
              this.authService.isUserLoggedIn = true;
              this.router.navigate( [ '/dashboard/home' ] );
            }
          } else {
            this.notification.notification(
              'error',
              'No saved data found. Please login again.'
            );
          }
        } else {
          this.notification.notification(
            'error',
            'No saved data found. Please login again.'
          );
        }
      }
    }
  }

  // Checkbox event handler
  protected updateRememberMe( event: MatCheckboxChange ): void {
    this.rememberMe = event.checked;
  }

  // Login handler
  protected async login(): Promise<void> {
    try {
      if ( !this.username || !this.password ) {
        this.notification.notification(
          'error',
          'Username and password cannot be empty.'
        );
        console.error( 'Username and password cannot be empty.' );
        this.isEmpty = true;
        return;
      }

      const user = {
        username: this.username,
        password: this.password,
        rememberMe: this.rememberMe,
      };

      this.authService.logginUser = user;

      const verifiedUser = await this.authService.sendVerifyUser();

      if ( !verifiedUser ) throw new Error( 'Invalid username or password' )

      const loggedUser = this.authService.getLoggedUser;

      if ( loggedUser && loggedUser.isActive ) {
        this.activityTrackerService.loggedUser = loggedUser;

        const [ encryptedUsername, encryptedPassword, encryptedUser ] = await Promise.all( [
          this.cryptoService.encrypt( this.username || '' ),
          this.cryptoService.encrypt( this.password || '' ),
          this.cryptoService.encrypt( JSON.stringify( loggedUser ) ),
        ] );

        if ( encryptedUsername && encryptedPassword && encryptedUser ) {
          localStorage.setItem( 'loggedUser', encryptedUser );
          this.saveToCookies( encryptedUsername, encryptedPassword );
          this.authService.isUserLoggedIn = true;
          await this.authService.insertLoggedUserTracks();
          this.router.navigate( [ '/dashboard/home' ] );
        } else {
          throw new Error( 'Encryption failed for login credentials.' );
        }
      } else {
        throw new Error( 'User inactive or login error. Please refresh the browser.' );
      }
    } catch ( error: any ) {
      console.error( 'Login Error:', error );

      this.notification.notification(
        'error',
        error?.error?.error || error?.message || 'Unknown error during login.'
      );

      this.authService.clearCredentials();
      this.username = '';
      this.password = '';
      await this.saveToCookies( '', '' ); // Clear cookies
      this.router.navigate( [ '/login' ] );
    }
  }

  // Cookie management
  private setCookie( name: string, value: string, days: number ): void {
    const expires = new Date( Date.now() + days * 86400000 ).toUTCString();
    document.cookie = `${ name }=${ value }; expires=${ expires }; path=/`;
  }

  private getCookie( name: string ): string | null {
    const nameEQ = `${ name }=`;
    const cookies = document.cookie.split( ';' );
    for ( let c of cookies ) {
      c = c.trim();
      if ( c.startsWith( nameEQ ) ) return c.slice( nameEQ.length );
    }
    return null;
  }

  private deleteCookie( name: string ): void {
    document.cookie = `${ name }=; Max-Age=0; path=/`;
  }

  private async saveToCookies(
    username: string,
    password: string
  ): Promise<void> {
    if (
      this.rememberMe &&
      this.username &&
      this.password &&
      this.authService.getLoggedUser !== null
    ) {
      this.setCookie( 'username', username, 30 );
      this.setCookie( 'password', password, 30 );
    } else {
      this.deleteCookie( 'username' );
      this.deleteCookie( 'password' );
    }
  }

  private async initializeFromCookies(): Promise<void> {
    if ( this.isBrowser ) {
      const decryptedUsername = await this.cryptoService.decrypt(
        this.getCookie( 'username' ) || ''
      );
      const decryptedPassword = await this.cryptoService.decrypt(
        this.getCookie( 'password' ) || ''
      );

      if ( decryptedUsername !== null && decryptedPassword !== null ) {
        this.username = decryptedUsername;
        this.password = decryptedPassword;
        this.rememberMe = true;
      }
    }
  }
}
