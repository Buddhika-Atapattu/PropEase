// Path: src/app/core/security/session/idle-logout.service.ts

import { Inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { fromEvent, merge, Subscription, timer } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { AuthSessionService } from './auth-session.service';

@Injectable({ providedIn: 'root' })
export class IdleLogoutService {
  private readonly isBrowser: boolean;

  private activitySub: Subscription | null = null;
  private idleTimerSub: Subscription | null = null;

  // Tune idle policy here:
  private readonly IDLE_LIMIT_MS: number = 10 * 60 * 1000; // 10 minutes
  private readonly ACTIVITY_THROTTLE_MS: number = 800;

  public constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private readonly zone: NgZone,
    private readonly session: AuthSessionService,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  public start(): void {
    if (!this.isBrowser) return;

    // Stop existing
    this.stop();

    // Listen only if authenticated
    if (!this.session.getSnapshot().isAuthenticated) return;

    this.zone.runOutsideAngular(() => {
      const activity$ = merge(
        fromEvent(window, 'mousemove'),
        fromEvent(window, 'keydown'),
        fromEvent(window, 'mousedown'),
        fromEvent(window, 'touchstart'),
        fromEvent(window, 'scroll'),
      ).pipe(throttleTime(this.ACTIVITY_THROTTLE_MS));

      this.activitySub = activity$.subscribe(() => {
        this.resetIdleTimer();
      });

      this.resetIdleTimer();
    });

    console.info('[Info:] [Idle] Idle monitor started.\n');
  }

  public stop(): void {
    if (this.activitySub) {
      this.activitySub.unsubscribe();
      this.activitySub = null;
    }
    if (this.idleTimerSub) {
      this.idleTimerSub.unsubscribe();
      this.idleTimerSub = null;
    }
  }

  public resetIdleTimer(): void {
    if (!this.isBrowser) return;

    if (this.idleTimerSub) {
      this.idleTimerSub.unsubscribe();
      this.idleTimerSub = null;
    }

    this.idleTimerSub = timer(this.IDLE_LIMIT_MS).subscribe(() => {
      this.zone.run(() => {
        // Only logout if still authenticated
        if (this.session.getSnapshot().isAuthenticated) {
          this.session.endSession('idle');
        }
      });
    });
  }
}
