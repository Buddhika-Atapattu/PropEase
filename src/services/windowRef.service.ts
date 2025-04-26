import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WindowsRefService {
  private isBrowser: boolean;
  private modeSubject = new BehaviorSubject<boolean | null>(null);

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;
      this.setDarkMode(prefersDark);
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

  setDarkMode(mode: boolean): void {
    if (this.isBrowser) {
      document.documentElement.classList.toggle('dark', mode);
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
}
