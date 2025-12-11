// Path: src/app/components/session-expiry-banner/session-expiry-banner.component.ts

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

import {
  AutoLogOutService,
  AutoLogoutBannerState,
} from '../../services/autoLogoutService/auto-log-out.service';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-session-expiry-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-expiry-banner.component.html',
  styleUrls: ['./session-expiry-banner.component.scss'],
  host: { ngSkipHydration: '' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionExpiryBannerComponent {
  /**
   * State pushed from AutoLogOutService via AppComponent:
   *   <app-session-expiry-banner [state]="autoLogoutBannerState$ | async">
   */
  @Input() state: AutoLogoutBannerState | null = null;

  /** Local flag for disabling the "Logout now" button while clearing credentials. */
  protected isLoggingOut: boolean = false;

  constructor(
    private readonly autoLogOutService: AutoLogOutService,
    private readonly authService: AuthService,
  ) {}

  // ──────────────────────────────────────────────────────────────
  // Derived view model helpers
  // ──────────────────────────────────────────────────────────────

  /** Human-readable title based on backend `mode`. */
  get title(): string {
    const mode = this.state?.mode ?? 'unknown';

    switch (mode) {
      case 'security':
        return 'Security alert – session terminated';
      case 'maintenance':
        return 'System maintenance – session will close';
      case 'manual':
        return 'Session closed by server';
      default:
        return 'Session termination notice';
    }
  }

  /** Reason text shown under the title. */
  get reason(): string {
    if (this.state?.reason && this.state.reason.trim().length > 0) {
      return this.state.reason;
    }
    return 'Your session was terminated by the server for security or maintenance reasons.';
  }

  /** Format countdown as MM:SS, using `state.countdownSeconds`. */
  get formattedTime(): string {
    const total = this.state?.countdownSeconds ?? 0;
    const clamped = Math.max(0, total);

    const minutes = Math.floor(clamped / 60);
    const seconds = clamped % 60;

    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');

    return `${mm}:${ss}`;
  }

  // ──────────────────────────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────────────────────────

  /** User clicks "Dismiss" – hide the banner, session continues (if still valid). */
  dismiss(): void {
    this.autoLogOutService.clearBanner();
  }

  /**
   * User clicks "Logout now".
   * NOTE:
   *  - AutoLogOutService already triggers clearCredentials() at 10s,
   *    this is just a manual early logout shortcut.
   */
  async logoutNow(): Promise<void> {
    if (this.isLoggingOut) {
      return;
    }

    this.isLoggingOut = true;

    try {
      await this.authService.clearCredentials();
    } catch (error) {
      console.error(
        '[Error:] [SessionExpiryBanner] clearCredentials failed:',
        error,
        '\n',
      );
    } finally {
      this.autoLogOutService.clearBanner();
      this.isLoggingOut = false;
    }
  }
}
