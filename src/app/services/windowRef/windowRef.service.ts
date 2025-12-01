// Path: src/app/services/windowRef/windowRef.service.ts

import {
  Injectable,
  Inject,
  PLATFORM_ID,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  BehaviorSubject,
  fromEvent,
  Subscription,
} from 'rxjs';
import {
  debounceTime,
  startWith,
  map,
  distinctUntilChanged,
} from 'rxjs/operators';

@Injectable( { providedIn: 'root' } )
export class WindowsRefService implements OnDestroy {

  // ---------------------------------------------------------------------------
  // PLATFORM / ENVIRONMENT
  // ---------------------------------------------------------------------------

  private readonly isBrowser: boolean;

  // ---------------------------------------------------------------------------
  // THEME (DARK / LIGHT) STATE
  // ---------------------------------------------------------------------------

  private readonly modeSubject: BehaviorSubject<boolean | null> =
    new BehaviorSubject<boolean | null>( null );

  private mediaQueryList: MediaQueryList | null = null;

  // We must keep the same listener reference for add/remove
  private mediaQueryListener: ( ( event: MediaQueryListEvent ) => void ) | null =
    null;

  // ---------------------------------------------------------------------------
  // WINDOW WIDTH STATE
  // ---------------------------------------------------------------------------

  private readonly windowWidthSubject: BehaviorSubject<number> =
    new BehaviorSubject<number>( 0 );

  private resizeSub: Subscription | null = null;


  constructor (
    @Inject( PLATFORM_ID ) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser( platformId );

    if ( this.isBrowser ) {
      const win: Window = window;

      // ────────────────────────────────────────────────────────────────────
      // 1) System color scheme (prefers-color-scheme)
      // ────────────────────────────────────────────────────────────────────
      this.mediaQueryList = win.matchMedia( '(prefers-color-scheme: dark)' );

      // Initial theme based on system preference
      this.setDarkMode( this.mediaQueryList.matches );

      // Bind a stable listener reference
      this.mediaQueryListener = ( event: MediaQueryListEvent ): void => {
        this.handleSystemThemeChange( event );
      };

      this.mediaQueryList.addEventListener(
        'change',
        this.mediaQueryListener,
      );

      // ────────────────────────────────────────────────────────────────────
      // 2) Window width tracking
      // ────────────────────────────────────────────────────────────────────
      this.windowWidthSubject.next( win.innerWidth ); // initial value

      this.resizeSub = fromEvent( win, 'resize' )
        .pipe(
          debounceTime( 150 ),
          map( () => win.innerWidth ),
          distinctUntilChanged(),
          startWith( win.innerWidth ),
        )
        .subscribe( ( width: number ): void => {
          this.windowWidthSubject.next( width );
        } );
    }
  }

  // ---------------------------------------------------------------------------
  // NATIVE WINDOW / DOCUMENT ACCESSORS
  //  - These are what your HomeComponent can safely use.
  // ---------------------------------------------------------------------------

  get nativeWindow(): Window | null {
    return this.isBrowser ? window : null;
  }

  get nativeDocument(): Document | null {
    return this.isBrowser ? document : null;
  }


  // ---------------------------------------------------------------------------
  // OBSERVABLES / GETTERS
  // ---------------------------------------------------------------------------

  // Observable for dark/light mode
  get mode$() {
    return this.modeSubject.asObservable();
  }

  // Observable for window width
  get windowWidth$() {
    return this.windowWidthSubject.asObservable();
  }

  // Current window width (0 if not yet measured / SSR)
  get currentWindowWidth(): number {
    return this.windowWidthSubject.value;
  }

  // Current mode: true = dark, false = light, null = unknown/not initialised
  get currentMode(): boolean | null {
    return this.modeSubject.value;
  }

  // ---------------------------------------------------------------------------
  // THEME INITIALISATION / TOGGLING
  // ---------------------------------------------------------------------------

  /**
   * initTheme
   *  - Call this once in your root component if you want the service
   *    to read and apply persisted theme from localStorage.
   */
  initTheme(): Subscription {
    return this.mode$.subscribe( ( mode: boolean | null ): void => {
      if ( mode === null && this.isBrowser ) {
        const preferredMode: string | null =
          localStorage.getItem( 'preferred-mode' );
        this.setDarkMode( preferredMode === 'dark' );
      }
    } );
  }

  private handleSystemThemeChange(
    event: MediaQueryListEvent,
  ): void {
    this.setDarkMode( event.matches );
  }

  setDarkMode(
    mode: boolean,
  ): void {
    if ( this.isBrowser ) {
      const docEl: HTMLElement = document.documentElement;

      docEl.classList.toggle( 'dark', mode );
      docEl.classList.toggle( 'light', !mode );

      localStorage.setItem(
        'preferred-mode',
        mode ? 'dark' : 'light',
      );
    }

    this.modeSubject.next( mode );
  }

  setLightMode(): void {
    this.setDarkMode( false );
  }

  toggleDarkMode(): void {
    // Treat "null" as light-mode by default
    const current: boolean = this.modeSubject.value ?? false;
    this.setDarkMode( !current );
  }

  // ---------------------------------------------------------------------------
  // OPTIONAL: IMAGE PRELOAD HELPER (universal call-site, browser-only inside)
  // ---------------------------------------------------------------------------

  /**
   * preloadImage
   *  - Creates a new Image() and resolves once loaded.
   *  - No-op on SSR (just resolves).
   */
  preloadImage(
    src: string,
  ): Promise<void> {
    return new Promise( ( resolve, reject ) => {
      if ( !this.isBrowser ) {
        resolve();
        return;
      }

      const img = new Image();
      img.onload = (): void => resolve();
      img.onerror = ( err: unknown ): void => reject( err );
      img.src = src;
    } );
  }

  // ---------------------------------------------------------------------------
  // CLEANUP
  // ---------------------------------------------------------------------------

  ngOnDestroy(): void {
    if ( this.mediaQueryList && this.mediaQueryListener ) {
      this.mediaQueryList.removeEventListener(
        'change',
        this.mediaQueryListener,
      );
      this.mediaQueryListener = null;
    }

    if ( this.resizeSub ) {
      this.resizeSub.unsubscribe();
      this.resizeSub = null;
    }
  }
}
