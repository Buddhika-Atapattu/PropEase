// Path: src/app/pages/error404/error404.component.ts
// -----------------------------------------------------------------------------
// Error404Component
// - Used for two cases:
//   1) 404 (wildcard ** routes)
//   2) Unauthorized (/dashboard/unauthorized)
// - Detects current mode (light/dark) via WindowsRefService (browser-only).
// - SSR-safe: guards all browser APIs with isPlatformBrowser.
// - Cleans up subscriptions on destroy to avoid memory leaks.
// - Provides a single "Go Home" action that redirects appropriately.
// -----------------------------------------------------------------------------

import {CommonModule, isPlatformBrowser} from '@angular/common';
import {Component, Inject, OnDestroy, OnInit, PLATFORM_ID} from '@angular/core';
import {Router} from '@angular/router';
import {Subject, takeUntil} from 'rxjs';
import {AuthService} from '../../services/auth/auth.service';
import {WindowsRefService} from '../../services/windowRef/windowRef.service';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error404.component.html',
  styleUrls: ['./error404.component.scss'], // ✅ Angular expects styleUrls (array), not styleUrl
})
export class Error404Component implements OnInit, OnDestroy {
  /** current theme mode; null until the first emission (browser only) */
  public mode: boolean | null = null;

  /** true when this page represents "Unauthorized" rather than "Not Found" */
  public isUnauthorized = false;

  /** true when running in the browser (not on the server) */
  private readonly isBrowser: boolean;

  /** teardown notifier for RxJS subscriptions */
  private readonly destroy$ = new Subject<void>();

  constructor (
    private readonly router: Router,
    private readonly windowRef: WindowsRefService,
    private readonly authService: AuthService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /* ----------------------------- Lifecycle ------------------------------ */

  public ngOnInit(): void {
    // Detect Unauthorized vs 404:
    // - We treat any URL that ends with /unauthorized (or contains that segment)
    //   as the Unauthorized page. Router.url is safe to read; still guard for SSR.
    if(this.isBrowser) {
      const url = this.router.url || '';
      this.isUnauthorized = this.isUnauthorizedUrl(url);
    } else {
      // On server, assume not unauthorized (render generic error page)
      this.isUnauthorized = false;
    }

    // Subscribe to theme mode changes (browser-only)
    if(this.isBrowser) {
      this.windowRef.mode$
        .pipe(takeUntil(this.destroy$))
        .subscribe((val) => {
          this.mode = val;
        });
    }
  }

  public ngOnDestroy(): void {
    // Complete the notifier to clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ------------------------------ Getters ------------------------------- */

  /** Snapshot whether the user is currently logged in. */
  public get userLoggedIn(): boolean {
    return this.authService.isUserLoggedIn;
  }

  /* ------------------------------ Actions -------------------------------- */

  /**
   * Navigate user back to a sensible landing page:
   * - If logged in → /dashboard/home
   * - If logged out → clear any residual state and go to / (which redirects to /login)
   */
  public goHome(): void {
    if(this.authService.isUserLoggedIn) {
      this.router.navigate(['/dashboard/home']);
      return;
    }

    this.authService.clearCredentials();
    this.router.navigate(['/']);
  }

  /* ----------------------------- Utilities ------------------------------- */

  /**
   * Returns true if the given URL represents our Unauthorized route.
   * We check for '/dashboard/unauthorized' at the end or as a path segment.
   */
  private isUnauthorizedUrl(url: string): boolean {
    // Strict match or with query/fragment
    if(url === '/dashboard/unauthorized') return true;

    // Contains path segment (handles potential trailing slashes or future nesting)
    return url.includes('/dashboard/unauthorized');
  }
}
