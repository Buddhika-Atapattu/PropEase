import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Renderer2,
} from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription, filter } from 'rxjs';

import {
  type User,
} from './services/APIs/apis.service';
import {
  AuthService
} from './services/auth/auth.service';
import { ImageService } from './services/imageService/image.service';
import { WindowsRefService } from './services/windowRef/windowRef.service';


import { CheckInternetStatusComponent } from './components/check-internet-status/check-internet-status.component';
import { ModeChangerComponent } from './components/mode-changer/mode-changer.component';
import { TopProgressBarComponent } from './components/top-progress-bar/top-progress-bar.component';

import { environment } from '../environments/environment';

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
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  /** App name shown in the browser tab/Electron title bar */
  public title: string = 'propease-fontend';

  /** Current theme mode from WindowsRefService (true=dark, false=light) */
  protected mode: boolean | null = null;

  /** Hydration/SSR guard – true only in real browsers (web or Electron renderer) */
  protected readonly isBrowser: boolean;

  /** One-time app loaded flag (used by template to show/hide shell) */
  protected isAppLoad: boolean = false;

  /** Logged user (if available) */
  private loggedUser: User | null = null;

  /** Whether user is authenticated (cached for quick checks) */
  private userLoggedIn: boolean = false;

  // ── Subscriptions & unlisteners (cleaned up on destroy) ─────────────────────
  private modeSub: Subscription | null = null;
  private navEndSub: Subscription | null = null;
  private beforeUnloadUnlisten: ( () => void ) | null = null;
  private imgErrorUnlisten: ( () => void ) | null = null;

  /** Last URL restored after reload/login */
  private lastURL: string | null = null;

  // ── Constructor ─────────────────────────────────────────────────────────────
  constructor (
    private readonly windowRef: WindowsRefService,
    private readonly authService: AuthService,
    private readonly router: Router,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly cdRef: ChangeDetectorRef,
    private readonly renderer: Renderer2,
    private readonly imageService: ImageService,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.imageService.preload( 'Images/System-images/noImage.png' );
    this.imageService.preload( 'Images/company-images/logo/logo/animation.gif' );
    this.imageService.preload( 'Images/company-images/logo/logo/without-bg.webp' );
  }

  // ── Lifecycle: OnInit ───────────────────────────────────────────────────────
  /**
   * Keep OnInit lean: avoid DOM work or navigation here.
   * Heavy initializations go to ngAfterViewInit (after the view exists).
   */
  public ngOnInit(): void {
    this.loggedUser = this.authService.getLoggedUser;
    // No-op for now; reserved for future lightweight init
  }



  // ── Lifecycle: AfterViewInit ────────────────────────────────────────────────
  /**
   * Browser-only initialization:
   *  - Theme wiring
   *  - Global image error fallback
   *  - Route restore for authenticated sessions
   *  - NavigationEnd listener to persist last URL
   */
  public ngAfterViewInit(): void {
    if ( this.isBrowser ) {
      this.initThemeAndMode();
      this.attachGlobalImageFallback();
      this.restoreRouteIfAuthenticated();
      this.persistLastUrlOnNavigation();
    }

    this.isAppLoad = true;
    this.cdRef.detectChanges();
  }

  // ── Lifecycle: OnDestroy ────────────────────────────────────────────────────
  public ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.navEndSub?.unsubscribe();
    if ( this.beforeUnloadUnlisten ) {
      this.beforeUnloadUnlisten();
      this.beforeUnloadUnlisten = null;
    }
    if ( this.imgErrorUnlisten ) {
      this.imgErrorUnlisten();
      this.imgErrorUnlisten = null;
    }
  }

  // ── Public getters ──────────────────────────────────────────────────────────
  /** Fast getter for auth state (used by template) */
  get isUserLoggedIn(): boolean {
    if ( this.loggedUser ) return true;
    else return false;
  }

  // ── Private helpers — Initialization ────────────────────────────────────────
  /**
   * Initialize theme and subscribe to mode changes (browser only).
   * Uses WindowsRefService to read and persist the theme.
   */
  private initThemeAndMode(): void {
    try {
      this.windowRef.initTheme();
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => ( this.mode = val ) );
    } catch ( error ) {
      this.safeWarn( 'initThemeAndMode error (ignored):', error );
    }
  }

  /**
   * Restore the last route for valid/authenticated users.
   * Uses both a beforeunload fallback and immediate navigation after boot.
   */
  private restoreRouteIfAuthenticated(): void {
    try {
      // Determine if user is authenticated
      const isUserLoggedInFlag = this.safeGetFromLocalStorage( 'IS_USER_LOGGED_IN' );
      const hasValidUser =
        ( this.authService.getIsValidUser &&
          this.authService.getLoggedUser !== null &&
          this.authService.IsActiveUser ) ||
        ( isUserLoggedInFlag && isUserLoggedInFlag === 'true' );

      if ( !hasValidUser ) return;

      // Persist last URL just before the window unloads (fallback)
      this.beforeUnloadUnlisten = this.safeAddBeforeUnloadListener( () => {
        const url = this.router.url;
        if ( url ) {
          this.safeSetToLocalStorage( 'LAST_URL', url );
        }
      } );

      // Attempt a restore if LAST_URL exists
      this.lastURL = this.safeGetFromLocalStorage( 'LAST_URL' );
      if ( this.lastURL ) {
        // Best-effort navigation; ignore errors (e.g., guards)
        this.router.navigateByUrl( this.lastURL ).catch( () => {} );
      }
    } catch ( error ) {
      this.safeWarn( 'restoreRouteIfAuthenticated error (ignored):', error );
    }
  }

  /**
   * Keep LAST_URL up-to-date after each successful navigation.
   * This is more reliable than only using beforeunload.
   */
  private persistLastUrlOnNavigation(): void {
    try {
      this.navEndSub = this.router.events
        .pipe( filter( ( e ): e is NavigationEnd => e instanceof NavigationEnd ) )
        .subscribe( ( evt: NavigationEnd ) => {
          this.safeSetToLocalStorage( 'LAST_URL', evt.urlAfterRedirects || evt.url );
        } );
    } catch ( error ) {
      this.safeWarn( 'persistLastUrlOnNavigation error (ignored):', error );
    }
  }

  // ── Private helpers — Global image fallback ────────────────────────────────
  /**
   * Attach a single capture-phase 'error' listener for IMG elements.
   * When any image fails, we swap to a local placeholder that works in
   * both Web (http/https) and Electron (file://) by using a computed relative URL.
   */
  private attachGlobalImageFallback(): void {
    if ( !this.isBrowser ) return;

    try {
      // Compute a safe relative URL for the placeholder
      const fallbackUrl = this.computeAssetUrl( 'Images/System-images/noImage.png' );

      // Use Renderer2 to attach a capture-phase error listener on document
      this.imgErrorUnlisten = this.renderer.listen(
        // target
        'document',
        // event name
        'error',
        // handler
        ( event: Event ) => {
          const target = event?.target as HTMLElement | null;
          if ( !target || target.tagName !== 'IMG' ) return;

          const img = target as HTMLImageElement;

          // Avoid infinite loops: replace only if not already the fallback
          if ( !img.src || img.src.endsWith( '/noImage.png' ) === false ) {
            this.safeWarn( 'Global image load error:', img.src );
            img.src = fallbackUrl;
          }
        }
      );
    } catch ( error ) {
      this.safeWarn( 'attachGlobalImageFallback error (ignored):', error );
    }
  }

  /**
   * Compute a runtime-safe asset URL that works under:
   *  - Web dev/prod (baseHref "/" with HTTP(S))
   *  - Electron (baseHref "./" with file:// protocol)
   * Rule of thumb in this project: keep paths **relative** (no leading slash).
   *
   * @param relativePath e.g., "Images/System-images/noImage.png"
   */
  private computeAssetUrl( relativePath: string ): string {
    // Electron typically serves via file:// and uses baseHref "./"
    const fileProto = typeof location !== 'undefined' && location.protocol === 'file:';
    // In either case we want relative URLs, not absolute.
    // Prepend "./" for safety when on file:// to avoid root resolution issues.
    return fileProto ? `./${ relativePath }` : `${ relativePath }`;
  }

  // ── Private helpers — Safe Web APIs ────────────────────────────────────────
  /** Safe read from localStorage (no-throw, SSR-friendly) */
  private safeGetFromLocalStorage( key: string ): string | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem( key ) : null;
    } catch {
      return null;
    }
  }

  /** Safe write to localStorage (no-throw, SSR-friendly) */
  private safeSetToLocalStorage( key: string, value: string ): void {
    try {
      if ( typeof localStorage !== 'undefined' ) {
        localStorage.setItem( key, value );
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * Safe beforeunload listener using Renderer2.
   * Returns a cleanup function to remove the listener.
   */
  private safeAddBeforeUnloadListener( callback: () => void ): () => void {
    try {
      if ( typeof window !== 'undefined' ) {
        return this.renderer.listen( 'window', 'beforeunload', callback );
      }
    } catch {
      /* ignore */
    }
    // No-op cleanup if not attached
    return () => {};
  }

  /** Dev-safe logger that avoids noisy logs in production builds */
  private safeWarn( message: string, data?: unknown ): void {
    if ( !environment.production ) {
      // eslint-disable-next-line no-console
      console.warn( message, data ?? '' );
    }
  }
}
