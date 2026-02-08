// Path: src/app/core/security/session/auth-session.service.ts

import { Inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subscription, timer } from 'rxjs';

export type LogoutReason =
  | 'expired'
  | 'idle'
  | 'manual'
  | 'server_invalid'
  | 'forced';

export type SessionState = Readonly<{
  isAuthenticated: boolean;
  expiresAtMs: number; // epoch ms
}>;

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly isBrowser: boolean;

  private readonly sessionState$ = new BehaviorSubject<SessionState>({
    isAuthenticated: false,
    expiresAtMs: 0,
  });

  private expirySub: Subscription | null = null;

  // You can tune these two without touching other logic:
  private readonly CHECK_AHEAD_MS: number = 1500; // check slightly before expiry
  private readonly STORAGE_KEY: string = 'pe_session_state';

  public constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private readonly zone: NgZone,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Restore session state (browser only)
    if (this.isBrowser) {
      const restored: SessionState | null = this.readStateFromStorage();
      if (restored && restored.expiresAtMs > Date.now()) {
        this.sessionState$.next(restored);
        this.armExpiryTimer(restored.expiresAtMs);
      } else {
        this.clearStorage();
      }
    }
  }

  public observeSession(): Observable<SessionState> {
    return this.sessionState$.asObservable();
  }

  public getSnapshot(): SessionState {
    return this.sessionState$.value;
  }

  /**
   * Call this after login success.
   * You may pass expiresAtMs directly, or pass a JWT and let FE decode `exp`.
   */
  public startSessionByExpiry(expiresAtMs: number): void {
    const safeExpiry: number = Number(expiresAtMs || 0);
    if (!safeExpiry || safeExpiry <= Date.now()) {
      console.warn('[Warning:] [Session] startSessionByExpiry called with invalid expiry.\n');
      this.endSession('expired');
      return;
    }

    const nextState: SessionState = {
      isAuthenticated: true,
      expiresAtMs: safeExpiry,
    };

    this.sessionState$.next(nextState);
    this.writeStateToStorage(nextState);
    this.armExpiryTimer(safeExpiry);
  }

  public startSessionFromJwt(accessToken: string): void {
    const expMs: number | null = this.tryReadJwtExpMs(accessToken);
    if (!expMs) {
      console.warn('[Warning:] [Session] JWT exp missing/invalid, session not started.\n');
      this.endSession('server_invalid');
      return;
    }
    this.startSessionByExpiry(expMs);
  }

  /**
   * Extends session (e.g., called after refresh token success).
   */
  public refreshSession(expiresAtMs: number): void {
    const snap: SessionState = this.getSnapshot();
    if (!snap.isAuthenticated) return;

    this.startSessionByExpiry(expiresAtMs);
  }

  public endSession(reason: LogoutReason): void {
    // Stop timers
    if (this.expirySub) {
      this.expirySub.unsubscribe();
      this.expirySub = null;
    }

    // Clear state
    this.sessionState$.next({ isAuthenticated: false, expiresAtMs: 0 });
    this.clearStorage();

    console.warn(`[Warning:] [Session] Session ended. reason=${reason}\n`);
  }

  public isExpiredNow(): boolean {
    const snap: SessionState = this.getSnapshot();
    if (!snap.isAuthenticated) return true;
    return Date.now() >= snap.expiresAtMs;
  }

  // =========================================================
  // Internals
  // =========================================================

  private armExpiryTimer(expiresAtMs: number): void {
    if (!this.isBrowser) return;

    if (this.expirySub) {
      this.expirySub.unsubscribe();
      this.expirySub = null;
    }

    const dueInMs: number = Math.max(0, expiresAtMs - Date.now() - this.CHECK_AHEAD_MS);

    // Run timer outside Angular to reduce change-detection noise
    this.zone.runOutsideAngular(() => {
      this.expirySub = timer(dueInMs).subscribe(() => {
        // Re-enter Angular for state updates
        this.zone.run(() => {
          if (this.isExpiredNow()) {
            this.endSession('expired');
          } else {
            // Edge: clock drift; re-arm precisely
            this.armExpiryTimer(this.getSnapshot().expiresAtMs);
          }
        });
      });
    });
  }

  private tryReadJwtExpMs(token: string): number | null {
    try {
      const parts: string[] = String(token || '').split('.');
      if (parts.length < 2) return null;

      const payloadBase64: string = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      // Add padding if needed
      const padded: string = payloadBase64 + '==='.slice((payloadBase64.length + 3) % 4);

      const json: string = this.isBrowser
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf-8');

      const payload: any = JSON.parse(json);
      const expSec: number = Number(payload?.exp || 0);

      if (!expSec) return null;
      return expSec * 1000;
    } catch (err) {
      console.error('[Error:] [Session] Failed to parse JWT exp.\n', err);
      return null;
    }
  }

  private readStateFromStorage(): SessionState | null {
    try {
      const raw: string | null = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      const parsed: any = JSON.parse(raw);
      const expiresAtMs: number = Number(parsed?.expiresAtMs || 0);
      const isAuthenticated: boolean = Boolean(parsed?.isAuthenticated);

      if (!isAuthenticated || !expiresAtMs) return null;

      return { isAuthenticated, expiresAtMs };
    } catch (err) {
      console.error('[Error:] [Session] Failed to restore session from storage.\n', err);
      return null;
    }
  }

  private writeStateToStorage(state: SessionState): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('[Error:] [Session] Failed to persist session.\n', err);
    }
  }

  private clearStorage(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (err) {
      console.error('[Error:] [Session] Failed to clear session storage.\n', err);
    }
  }
}
