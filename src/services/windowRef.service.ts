import { Injectable, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, fromEvent, Subscription } from 'rxjs';
import {
  debounceTime,
  startWith,
  map,
  distinctUntilChanged,
} from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class WindowsRefService implements OnDestroy {
  private isBrowser: boolean;

  // Track dark/light mode
  private modeSubject = new BehaviorSubject<boolean | null>(null);
  private mediaQueryList: MediaQueryList | null = null;

  // Track screen width
  private windowWidthSubject = new BehaviorSubject<number>(0);
  private resizeSub: Subscription | null = null;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      // Detect color scheme preference
      this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
      this.setDarkMode(this.mediaQueryList.matches);

      this.mediaQueryList.addEventListener(
        'change',
        this.handleSystemThemeChange.bind(this)
      );

      // Track window width changes in every 1s
      this.windowWidthSubject.next(window.innerWidth); // initial value

      // Add window resize listener
      this.resizeSub = fromEvent(window, 'resize')
        .pipe(
          debounceTime(150),
          map(() => window.innerWidth),
          distinctUntilChanged(),
          startWith(window.innerWidth)
        )
        .subscribe((width) => {
          this.windowWidthSubject.next(width);
        });
    }
  }

  // Observable for dark/light mode
  get mode$() {
    return this.modeSubject.asObservable();
  }

  // Observable for window width
  get windowWidth$() {
    return this.windowWidthSubject.asObservable();
  }

  // Current window width
  get currentWindowWidth(): number {
    return this.windowWidthSubject.value;
  }

  // Theme toggle helpers
  initTheme() {
    return this.mode$.subscribe((mode) => {
      if (mode === null) {
        const preferredMode = localStorage.getItem('preferred-mode');
        this.setDarkMode(preferredMode === 'dark');
      }
    });
  }

  private handleSystemThemeChange(event: MediaQueryListEvent): void {
    this.setDarkMode(event.matches);
  }

  setDarkMode(mode: boolean): void {
    if (this.isBrowser) {
      document.documentElement.classList.toggle('dark', mode);
      document.documentElement.classList.toggle('light', !mode);
      localStorage.setItem('preferred-mode', mode ? 'dark' : 'light');
    }
    this.modeSubject.next(mode);
  }

  setLightMode(): void {
    this.setDarkMode(false);
  }

  toggleDarkMode(): void {
    const current = this.modeSubject.value;
    this.setDarkMode(!current);
  }

  get currentMode(): boolean | null {
    return this.modeSubject.value;
  }

  ngOnDestroy(): void {
    if (this.mediaQueryList) {
      this.mediaQueryList.removeEventListener(
        'change',
        this.handleSystemThemeChange.bind(this)
      );
    }

    if (this.resizeSub) {
      this.resizeSub.unsubscribe();
    }
  }
}
