import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ChangeDetectorRef,
  Renderer2
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { WindowsRefService } from './services/windowRef/windowRef.service';
import { Subscription, filter } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import {
  AuthService,
  NewUser,
  LoggedUserType,
  UserCredentials,
} from './services/auth/auth.service';

import { ModeChangerComponent } from './components/mode-changer/mode-changer.component';
import { TopProgressBarComponent } from './components/top-progress-bar/top-progress-bar.component';
import { RouterModule } from '@angular/router';
import { CheckInternetStatusComponent } from './components/check-internet-status/check-internet-status.component';
//
@Component( {
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ModeChangerComponent,
    TopProgressBarComponent,
    RouterModule,
    CheckInternetStatusComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
} )
export class AppComponent implements OnInit, OnDestroy {
  title = 'propease-fontend';
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  private navEndSub: Subscription | null = null;
  private lastURL: string | null = null;
  private loggedUser: LoggedUserType | null = null;
  private userLoggedIn: boolean = false;

  constructor (
    private windowRef: WindowsRefService,
    private authService: AuthService,
    private router: Router,
    @Inject( PLATFORM_ID ) private platformId: Object,
    private cdRef: ChangeDetectorRef,
    private renderer: Renderer2
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    if ( this.isBrowser ) {
    }
  }

  ngOnInit(): void {

  }

  ngAfterViewInit() {
    if ( this.isBrowser ) {
      this.loadInit();
      this.globalImageDetector();
    }

    this.cdRef.detectChanges();
  }

  get isUserLoggedIn(): boolean {
    return this.authService.isUserLoggedIn;
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.navEndSub?.unsubscribe();
  }

  private loadInit(): void {
    if ( !this.isBrowser ) return;

    try {
      this.windowRef.initTheme();

      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );

      const isUserLoggedIn = this.safeGetFromLocalStorage( 'IS_USER_LOGGED_IN' );

      if (
        ( this.authService.getIsValidUser &&
          this.authService.getLoggedUser !== null &&
          this.authService.IsActiveUser ) ||
        ( isUserLoggedIn && isUserLoggedIn === 'true' )
      ) {
        this.safeAddBeforeUnloadListener( () => {
          const url = this.router.url;
          if ( url ) {
            this.safeSetToLocalStorage( 'LAST_URL', url );
          }
        } );

        this.lastURL = this.safeGetFromLocalStorage( 'LAST_URL' );
        if ( this.lastURL ) {
          this.router.navigateByUrl( this.lastURL ).catch( () => { } );
        }
      }
    } catch ( error ) {
      console.warn( 'loadInit error (ignored):', error );
    }
  }

  private globalImageDetector(): void {
    if ( typeof window === 'undefined' || typeof document === 'undefined' ) return;

    try {
      document.addEventListener(
        'error',
        ( event: Event ) => {
          const target = event.target as HTMLElement;
          if ( target?.tagName === 'IMG' ) {
            console.warn( 'Global image load error:', ( target as HTMLImageElement ).src );
            ( target as HTMLImageElement ).src = '/Images/System-images/noImage.png';
          }
        },
        true
      );
    } catch ( error ) {
      console.warn( 'globalImageDetector error (ignored):', error );
    }
  }

  private safeGetFromLocalStorage( key: string ): string | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem( key ) : null;
    } catch {
      return null;
    }
  }

  private safeSetToLocalStorage( key: string, value: string ): void {
    try {
      if ( typeof localStorage !== 'undefined' ) {
        localStorage.setItem( key, value );
      }
    } catch { }
  }

  private safeAddBeforeUnloadListener( callback: () => void ): void {
    try {
      if ( typeof window !== 'undefined' && typeof window.addEventListener === 'function' ) {
        window.addEventListener( 'beforeunload', callback );
      }
    } catch { }
  }
}
