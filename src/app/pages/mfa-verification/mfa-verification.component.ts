// Path: src/app/pages/mfa-verification/mfa-verification.component.ts

import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  QueryList,
  ViewChildren,
  ViewChild
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { APIsService } from '../../services/APIs/apis.service';
import { AuthService, type TempLoginChallenge } from '../../services/auth/auth.service';
import { CryptoService } from '../../services/cryptoService/crypto.service';

import { PreloaderComponent } from '../../components/shared/preloader/preloader.component';
import { NotificationDialogComponent } from '../../components/dialogs/notificationBar/notificationBar.component';

@Component( {
  selector: 'app-mfa-verification',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatIconModule,
    PreloaderComponent,
    NotificationDialogComponent,
  ],
  templateUrl: './mfa-verification.component.html',
  styleUrl: './mfa-verification.component.scss',
} )
export class MfaVerificationComponent implements OnInit, OnDestroy {
  @ViewChild( NotificationDialogComponent, { static: true } )
  public notificationDialog!: NotificationDialogComponent;

  // ──────────────────────────────────────────────────────────
  // State
  // ──────────────────────────────────────────────────────────

  protected isBrowser: boolean;

  protected isSubmitting: boolean = false;
  protected isError: boolean = false;
  protected errorMessage: string = '';

  // 6-digit OTP code
  protected codeDigits: string[] = [ '', '', '', '', '', '' ];

  @ViewChildren( 'codeBox' )
  protected codeBoxRefs!: QueryList<ElementRef<HTMLInputElement>>;

  // For header / info – adjust as you wish
  protected username: string = '';
  protected subtitle: string =
    'Enter the 6-digit code from your authenticator app to continue.';

  // Optional: countdown for UX only (no strict security logic here)
  protected remainingSeconds: number = 30;
  private countdownTimerId: number | null = null;

  private readonly TEMP_USERNAME_KEY: string = 'tempUsername';
  private readonly TEMP_CHALLENGE_KEY: string = 'temp-change';

  public constructor (
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly router: Router,
    private readonly apiService: APIsService,
    private readonly authService: AuthService,
    private readonly cdr: ChangeDetectorRef,
    private readonly cryptoService: CryptoService,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
  }

  // ──────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────

  public ngOnInit(): void {
    if ( this.isBrowser ) {
      this.startCountdown();
    }
  }

  public ngOnDestroy(): void {
    this.stopCountdown();
  }

  // ──────────────────────────────────────────────────────────
  // Countdown (UX only)
  // ──────────────────────────────────────────────────────────

  private startCountdown(): void {
    this.stopCountdown();

    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    this.countdownTimerId = window.setInterval( () => {
      if ( this.remainingSeconds > 0 ) {
        this.remainingSeconds -= 1;
      } else {
        this.remainingSeconds = 0;
      }
      this.cdr.markForCheck();
    }, 1000 );
  }

  private stopCountdown(): void {
    if ( this.countdownTimerId !== null ) {
      window.clearInterval( this.countdownTimerId );
      this.countdownTimerId = null;
    }
  }

  // ──────────────────────────────────────────────────────────
  // MFA username helpers (for resend)
  // ──────────────────────────────────────────────────────────

  /**
   * Persist the temporary MFA username into localStorage (encrypted),
   * so that reloads / new tabs can recover it.
   */
  private async persistTempUsername( username: string ): Promise<void> {
    if ( !this.isBrowser ) {
      return;
    }

    const safeUsername: string = username.trim();
    if ( !safeUsername ) {
      return;
    }

    try {
      const encrypted: string | null = await this.cryptoService.encrypt( safeUsername );
      if ( encrypted ) {
        localStorage.setItem( this.TEMP_USERNAME_KEY, encrypted );
      }
    } catch ( error ) {
      console.error(
        '[Warning:] [MFA] Failed to persist temp username:',
        error,
        '\n'
      );
    }
  }

  /**
   * Resolve username for MFA operations:
   *   1) Prefer in-memory authService.tempUsername
   *   2) Fallback to encrypted username from localStorage
   */
  private async resolveUsernameForChallenge(): Promise<string | null> {
    const fromService: string = this.authService.tempUsername?.trim() ?? '';
    if ( fromService ) {
      // Also persist for future reloads
      await this.persistTempUsername( fromService );
      return fromService;
    }

    if ( !this.isBrowser ) {
      return null;
    }

    const encUsername: string | null = localStorage.getItem( this.TEMP_USERNAME_KEY );
    if ( !encUsername ) {
      return null;
    }

    try {
      const decrypted: unknown = await this.cryptoService.decrypt( encUsername );

      if ( typeof decrypted === 'string' ) {
        const safe = decrypted.trim();
        return safe || null;
      }

      return null;
    } catch ( error ) {
      console.error(
        '[Error:] [MFA] Failed to decrypt stored temp username:',
        error,
        '\n'
      );
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Resend code
  // ──────────────────────────────────────────────────────────

  protected async onResendCode(): Promise<void> {
    try {
      const safeUsername: string | null = await this.resolveUsernameForChallenge();

      if ( !safeUsername ) {
        throw new Error( 'Username is missing – please login again.' );
      }

      const payloadRes = await this.apiService.regenerateChallenge( safeUsername );

      if ( !payloadRes.success ) {
        throw new Error( payloadRes.message ?? 'Failed to regenerate challenge.' );
      }

      const newChallenge =
        this.apiService.extractObjectFromOther<TempLoginChallenge>(
          payloadRes.data,
          'challenge',
        );

      if ( !newChallenge ) {
        throw new Error( 'Invalid new challenge!' );
      }

      if ( !newChallenge.token ) {
        throw new Error( 'Invalid new token!' );
      }

      this.authService.temporyChallenge = newChallenge;

      this.remainingSeconds = 30;
      this.resetCodeDigits();
      this.startCountdown();
    } catch ( error: any ) {
      console.error( '[Error:] [MFA] onResendCode error:', error, '\n' );

      let message: string = 'Unexpected error occurred while generating code!';
      if ( error instanceof HttpErrorResponse ) {
        message = error.error?.message ?? error.message;
      } else if ( error instanceof Error ) {
        message = error.message;
      }

      this.notificationDialog.notification( 'error', message );
    }
  }

  private resetCodeDigits(): void {
    this.codeDigits = [ '', '', '', '', '', '' ];
    this.cdr.markForCheck();

    const boxes: ElementRef<HTMLInputElement>[] = this.codeBoxRefs.toArray();
    if ( boxes[ 0 ] ) {
      const first: HTMLInputElement = boxes[ 0 ].nativeElement;
      first.focus();
      first.select();
    }
  }

  // ──────────────────────────────────────────────────────────
  // Code input logic (no double-typing, full control)
  // ──────────────────────────────────────────────────────────

  protected onCodeKeyDown( event: KeyboardEvent, index: number ): void {
    const key: string = event.key;
    const boxes: ElementRef<HTMLInputElement>[] = this.codeBoxRefs.toArray();
    const currentInput: HTMLInputElement | undefined = boxes[ index ]?.nativeElement;

    if ( !currentInput ) {
      return;
    }

    // Digits 0–9
    if ( /^\d$/.test( key ) ) {
      event.preventDefault();

      this.codeDigits[ index ] = key;
      currentInput.value = key;

      if ( index < boxes.length - 1 ) {
        const next: HTMLInputElement = boxes[ index + 1 ].nativeElement;
        next.focus();
        next.select();
      }

      return;
    }

    // Backspace: clear and move back
    if ( key === 'Backspace' ) {
      event.preventDefault();

      this.codeDigits[ index ] = '';
      currentInput.value = '';

      if ( index > 0 ) {
        const prev: HTMLInputElement = boxes[ index - 1 ].nativeElement;
        prev.focus();
        prev.select();
      }

      return;
    }

    const allowedNav: string[] = [ 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End' ];

    if ( !allowedNav.includes( key ) ) {
      event.preventDefault();
    }
  }

  protected isCodeComplete(): boolean {
    return this.codeDigits.every( ( d: string ) => d.trim().length === 1 );
  }

  protected getFullCode(): string {
    return this.codeDigits.join( '' );
  }

  // ──────────────────────────────────────────────────────────
  // Local challenge loader
  // ──────────────────────────────────────────────────────────

  /**
   * Load MFA challenge from localStorage (encrypted).
   * Supports both:
   *   - stringified JSON
   *   - direct object (if decrypt already returns object)
   */
  private async loadLocalChallenge(): Promise<TempLoginChallenge | null> {
    if ( !this.isBrowser ) {
      return null;
    }

    const raw: string | null = localStorage.getItem( this.TEMP_CHALLENGE_KEY );
    if ( !raw ) {
      return null;
    }

    try {
      const decrypted: unknown = await this.cryptoService.decrypt( raw );

      if ( typeof decrypted === 'string' ) {
        try {
          return JSON.parse( decrypted ) as TempLoginChallenge;
        } catch ( parseError ) {
          console.error(
            '[Error:] [MFA] Failed to parse decrypted local challenge JSON:',
            parseError,
            '\n'
          );
          return null;
        }
      }

      if ( decrypted && typeof decrypted === 'object' ) {
        return decrypted as TempLoginChallenge;
      }

      return null;
    } catch ( error ) {
      console.error(
        '[Error:] [MFA] Failed to decrypt local challenge:',
        error,
        '\n'
      );
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────────────────────

  protected async onSubmitCode(): Promise<void> {
    try {
      this.isError = false;
      this.errorMessage = '';

      if ( !this.isCodeComplete() ) {
        this.isError = true;
        this.errorMessage = 'Please enter all 6 digits.';
        return;
      }

      // Resolve challenge from service or localStorage
      const localChallenge: TempLoginChallenge | null =
        await this.loadLocalChallenge();

      const challenge: TempLoginChallenge | null =
        this.authService.temporyChallenge ?? localChallenge ?? null;

      if ( !challenge || !challenge.token ) {
        throw new Error( 'Login challenge is required!' );
      }

      const code: string = this.getFullCode();

      this.isSubmitting = true;
      this.cdr.markForCheck();

      const payload: { token: string; code: string; } = {
        token: challenge.token,
        code,
      };

      const res = await this.authService.submitOnMFA( payload );

      if ( !res.success ) {
        throw new Error( res.message ?? 'Invalid code' );
      }

      // UX: small delay for smoother transition
      await new Promise<void>( ( resolve ) => {
        setTimeout( () => resolve(), 600 );
      } );

      await this.authService.assignToken( res );

      if ( this.isBrowser ) {
        localStorage.removeItem( this.TEMP_CHALLENGE_KEY );
      }

      // On success: navigate to dashboard / home
      await this.router.navigate( [ '/dashboard/home' ] );
    } catch ( error: any ) {
      console.error(
        '[Error:] [MfaVerificationComponent] verify error:',
        error,
        '\n'
      );
      this.isError = true;

      let errorMessage = '';

      if ( error instanceof HttpErrorResponse ) {
        errorMessage = error.error?.message ?? error.message;
      } else if ( error instanceof Error ) {
        errorMessage = error.message;
      } else {
        errorMessage = 'Invalid or expired code. Please try again.';
      }

      this.errorMessage = errorMessage;
      this.notificationDialog.notification( 'error', this.errorMessage );
    } finally {
      this.isSubmitting = false;
      this.cdr.markForCheck();
    }
  }

  protected async onBackToLogin(): Promise<void> {
    void await this.authService.clearCredentials();
    return void await this.router.navigate( [ '/login' ] );
  }
}
