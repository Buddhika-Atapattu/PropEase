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
import { APIsService } from '../../services/APIs/apis.service';
import { AuthService, type TempLoginChallenge } from '../../services/auth/auth.service';
import { PreloaderComponent } from '../../components/shared/preloader/preloader.component';
import { NotificationDialogComponent } from '../../components/dialogs/notification/notificationBar.component';
import { HttpErrorResponse } from '@angular/common/http';
// If you already have shared button / preloader / notification components, import them here.

// import { NotificationService } from '../../services/notification/notification.service';
// import { AuthService } from '../../services/auth/auth.service';
// import { APIsService } from '../../services/APIs/apis.service';

@Component( {
  selector: 'app-mfa-verification',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    PreloaderComponent,
    NotificationDialogComponent,
  ],
  templateUrl: './mfa-verification.component.html',
  styleUrl: './mfa-verification.component.scss',
} )
export class MfaVerificationComponent implements OnInit, OnDestroy {
  @ViewChild( NotificationDialogComponent, { static: true } ) notificationDialog !: NotificationDialogComponent;

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

  constructor (
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly router: Router,
    private readonly apiService: APIsService,
    private readonly authService: AuthService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    // If you store pending MFA user in AuthService, you can pull it here.
    // this.username = this.authService.pendingMfaUsername ?? '';
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

  protected async onResendCode(): Promise<void> {
    try {
      const username = this.authService.tempUsername;
      if ( !username ) {
        throw new Error( 'Invalid username' );
      }
      const payloadRes = await this.apiService.regenerateChallenge( username );

      if ( !payloadRes.success ) {
        throw new Error( payloadRes.message ?? '' );
      }

      const newChallenge = this.apiService.extractObjectFromOther<TempLoginChallenge>( payloadRes.data, 'challenge' );

      if ( !newChallenge ) {
        throw new Error( 'Invalid new challenge!' );
      }

      const newToken = newChallenge?.token;

      if ( !newToken ) {
        throw new Error( 'Invalid new token!' );
      }

      this.authService.temporyChallenge = newChallenge;

      this.remainingSeconds = 30;
      this.resetCodeDigits();
      this.startCountdown();
    }
    catch ( error ) {
      console.error( error );
      let message = 'Unexpected error ocured while generating code!';
      if ( error instanceof Error ) {
        message = error.message;
      }
      else if ( error instanceof HttpErrorResponse ) {
        message = error.error.message;
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

      if ( !this.authService.temporyChallenge ) {
        throw new Error( 'Login challenge is required!' );
      }

      const code: string = this.getFullCode();

      this.isSubmitting = true;
      this.cdr.markForCheck();

      const payload: { token: string, code: string; } = {
        token: this.authService.temporyChallenge.token,
        code: code
      };

      // TODO: call real backend for MFA verify.
      // Example:
      const res = await this.apiService.mfaUserVerify( payload );

      if ( !res.success ) { throw new Error( res.message ?? 'Invalid code' ); }

      // For now, just simulate success delay
      await new Promise<void>( ( resolve ) => {
        setTimeout( () => resolve(), 600 );
      } );

      await this.authService.assignToken( res );

      // On success: navigate to dashboard / home
      await this.router.navigate( [ '/dashboard/home' ] );
    } catch ( error: any ) {
      console.error( '[MfaVerificationComponent] verify error:', error );
      this.isError = true;
      this.errorMessage = error?.message ?? 'Invalid or expired code. Please try again.';
      // If you have notification service:
      // this.notification.notification('error', this.errorMessage);
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
