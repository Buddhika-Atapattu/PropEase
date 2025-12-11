// Path: src/app/services/autoLogoutService/auto-log-out.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  SocketService,
  ServerTerminatePayload,
} from '../socket/socket-service';
import { AuthService } from '../auth/auth.service';

export interface AutoLogoutBannerState {
  show: boolean;
  mode: string;
  reason: string;
  username?: string;
  countdownSeconds: number | null;
  startedAt: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class AutoLogOutService {

  private readonly _bannerState$: BehaviorSubject<AutoLogoutBannerState> =
    new BehaviorSubject<AutoLogoutBannerState>({
      show: false,
      mode: 'unknown',
      reason: '',
      username: undefined,
      countdownSeconds: null,
      startedAt: null,
    });

  public readonly bannerState$: Observable<AutoLogoutBannerState> =
    this._bannerState$.asObservable();

  /**
   * Safety flag so we only call clearCredentials() once per termination
   * sequence, even if the countdown stream glitches or replays.
   */
  private hasClearedCredentials: boolean = false;

  public constructor(
    private readonly socketService: SocketService,
    private readonly authService: AuthService,
  ) {
    this.registerTerminationListeners();
  }

  // ──────────────────────────────────────────────────────────────────────
  // Wiring to SocketService
  // ──────────────────────────────────────────────────────────────────────

  private registerTerminationListeners(): void {
    // 1) Backend tells us "session terminated".
    this.socketService.serverTerminate$.subscribe(
      (payload: ServerTerminatePayload) => {
        const now: number = Date.now();

        const nextState: AutoLogoutBannerState = {
          show: true,
          mode: payload.mode || 'unknown',
          reason: payload.reason || 'Session was terminated by server.',
          username: payload.username,
          countdownSeconds: this._bannerState$.value.countdownSeconds,
          startedAt: this._bannerState$.value.startedAt ?? now,
        };

        // New termination sequence → reset guard so we can clear again.
        this.hasClearedCredentials = false;

        this._bannerState$.next(nextState);

        console.error(
          '[Error:] [AutoLogOutService] Server-triggered session termination received:',
          payload,
          '\n',
        );
      },
    );

    // 2) Countdown ticks from SocketService (e.g. 10 → 9 → 8 → ... → 0).
    this.socketService.terminationCountdown$.subscribe(
      (seconds: number | null) => {
        const current: AutoLogoutBannerState = this._bannerState$.value;

        if (!current.show && (seconds === null || seconds > 0)) {
          return;
        }

        const nextState: AutoLogoutBannerState = {
          ...current,
          countdownSeconds: seconds,
        };

        this._bannerState$.next(nextState);

        if (seconds !== null) {
          console.warn(
            '[Warning:] [AutoLogOutService] Termination countdown update:',
            seconds,
            'seconds remaining\n',
          );
        }

        // When countdown reaches 10s, force-clear credentials once.
        if (seconds === 10 && !this.hasClearedCredentials) {
          this.hasClearedCredentials = true;

          console.warn(
            '[Warning:] [AutoLogOutService] Countdown reached 10s – clearing credentials now.\n',
          );

          try {
            this.authService.clearCredentials();
          } catch (error: unknown) {
            console.error(
              '[Error:] [AutoLogOutService] Failed to clear credentials during forced logout:',
              error,
              '\n',
            );
          }
        }
      },
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // Helper methods
  // ──────────────────────────────────────────────────────────────────────

  public getCurrentBannerState(): AutoLogoutBannerState {
    return this._bannerState$.value;
  }

  public clearBanner(): void {
    this._bannerState$.next({
      show: false,
      mode: 'unknown',
      reason: '',
      username: undefined,
      countdownSeconds: null,
      startedAt: null,
    });
  }
}
