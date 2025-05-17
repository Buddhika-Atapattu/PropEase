import { Injectable, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WindowsRefService implements OnDestroy {
  private isBrowser: boolean;
  private modeSubject = new BehaviorSubject<boolean | null>(null);
  private mediaQueryList: MediaQueryList | null = null;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
      this.setDarkMode(this.mediaQueryList.matches);

      this.mediaQueryList.addEventListener(
        'change',
        this.handleSystemThemeChange.bind(this)
      );
    }
  }

  get mode$() {
    return this.modeSubject.asObservable();
  }

  initTheme() {
    return this.mode$.subscribe((mode) => {
      if (mode === null) {
        const preferredMode = localStorage.getItem('preferred-mode');
        if (preferredMode === 'dark') {
          this.setDarkMode(true);
        } else {
          this.setDarkMode(false);
        }
      }
    });
  }

  private handleSystemThemeChange(event: MediaQueryListEvent): void {
    const isDark = event.matches;
    this.setDarkMode(isDark);
  }

  setDarkMode(mode: boolean): void {
    if (this.isBrowser) {
      if (mode) {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
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
  }
}
