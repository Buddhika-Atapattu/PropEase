// Path: src/app/core/security/session/session-guard.service.ts

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthSessionService, SessionState } from './auth-session.service';
import { IdleLogoutService } from './idle-logout.service';
import { TrafficMonitorService } from '../traffic/traffic-monitor.service';

@Injectable({ providedIn: 'root' })
export class SessionGuardService {
  private sub: Subscription | null = null;

  public constructor(
    private readonly router: Router,
    private readonly session: AuthSessionService,
    private readonly idle: IdleLogoutService,
    private readonly traffic: TrafficMonitorService,
  ) {}

  public init(): void {
    if (this.sub) return;

    // Start traffic capture immediately (safe even before login)
    this.traffic.start();

    this.sub = this.session.observeSession().subscribe((s: SessionState) => {
      if (s.isAuthenticated) {
        this.idle.start();
        return;
      }

      // Logged out → stop idle monitor + notify + redirect
      this.idle.stop();

      // If you have your own NotificationDialogService, call it here.
      // For now, use a simple browser alert fallback (browser only).
      this.safeNotify('Your session has ended. Please login again.');

      // Avoid redirect loops: if already on /login, skip
      const url: string = String(this.router.url || '');
      if (!url.startsWith('/login')) {
        this.router.navigateByUrl('/login');
      }
    });

    console.info('[Info:] [SessionGuard] SessionGuardService initialized.\n');
  }

  public destroy(): void {
    if (!this.sub) return;
    this.sub.unsubscribe();
    this.sub = null;

    this.idle.stop();
    this.traffic.stop();

    console.info('[Info:] [SessionGuard] SessionGuardService destroyed.\n');
  }

  private safeNotify(message: string): void {
    try {
      // Replace with your NotificationDialogComponent bridge if you prefer.
      // This is intentionally minimal and safe.
      // alert(message);
    } catch {
      console.warn('[Warning:] [SessionGuard] Notify failed (likely SSR).\n');
    }
  }
}
