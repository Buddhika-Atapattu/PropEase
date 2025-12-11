// Path: src/app/components/dialogs/multi-auth-qr-code/multi-auth-qr-code.component.ts

import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChildren,
  QueryList,
  ElementRef,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { interval, Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';

import { MatIconModule } from '@angular/material/icon';
import {
  APIsService,
  MultiAuthData,
  User,
} from '../../../services/APIs/apis.service';
import { MSG } from '../../../types/api-message.types';
import { CloseBtnComponent } from '../../shared/buttons/close-btn/close-btn';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { FormsModule } from '@angular/forms';

// ─────────────────────────────────────────────────────────────────────────────
// Types for dialog result
// ─────────────────────────────────────────────────────────────────────────────

type BackendPairingStatus = 'pending' | 'confirmed' | 'expired' | 'not_found';

type MultiAuthDialogReason =
  | 'confirmed'          // backend polling confirmed
  | 'expired'
  | 'not_found'
  | 'activated_via_code' // user entered valid code
  | 'user_cancelled';

export interface MultiAuthDialogResult {
  success: boolean;
  reason: MultiAuthDialogReason;
  authData: MultiAuthData | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

@Component( {
  selector: 'app-multi-auth-qr-code',
  standalone: true,
  imports: [
    CommonModule,
    CloseBtnComponent,
    PreloaderComponent,
    MatIconModule,
    FormsModule,
  ],
  templateUrl: './multi-auth-qr-code.component.html',
  styleUrl: './multi-auth-qr-code.component.scss',
} )
export class MultiAuthQrCodeDialogComponent implements OnInit, OnDestroy {
  @ViewChildren( 'codeBox' )
  protected codeBoxRefs!: QueryList<ElementRef<HTMLInputElement>>;

  protected isLoading: boolean = false;
  protected isBrowser: boolean;

  private username: string = '';
  protected QR: string = '';
  private QR_Data: MultiAuthData | null = null;

  // UI state: false = show QR, true = show code panel
  protected haveScanned: boolean = false;

  // 6-digit code boxes
  protected codeDigits: string[] = [ '', '', '', '', '', '' ];
  private pairingToken: string = '';

  private readonly destroy$: Subject<void> = new Subject<void>();

  constructor (
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    @Inject( MAT_DIALOG_DATA ) public data: { username: User[ 'username' ]; },
    private readonly apiService: APIsService,
    protected readonly dialogRef: MatDialogRef<MultiAuthQrCodeDialogComponent>,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.username = this.data?.username ?? '';
  }

  public ngOnInit(): void {
    if ( !this.isBrowser ) {
      console.warn( '[MultiAuthDialog] Not running in browser; skipping QR load.' );
      return;
    }

    if ( !this.username ) {
      console.warn( '[MultiAuthDialog] Username is empty; QR API will not be called.' );
      return;
    }

    void this.loadQRCode( this.username );
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // QR loading + polling
  // ───────────────────────────────────────────────────────────────────────────

  private async loadQRCode( username: string ): Promise<void> {
    try {
      if ( !username.trim() ) {
        throw new Error( 'Username is required!' );
      }

      this.isLoading = true;
      this.cdr.markForCheck();

      const res = await this.apiService.generateMultiAuthQRCode( username );

      if ( !res.success ) {
        throw new Error( res.message ?? 'Failed to fetch QR code from backend' );
      }

      const QR_Code = this.apiService.extractStringFromOther( res.data, 'qr' );
      const QR_Username = this.apiService.extractStringFromOther( res.data, 'username' );
      const QR_PairingToken = this.apiService.extractStringFromOther( res.data, 'pairingToken' );
      const QR_ExpiresAt = this.apiService.extractStringFromOther( res.data, 'expiresAt' );
      const QR_Uri = this.apiService.extractStringFromOther( res.data, 'uri' );

      if ( !QR_Code || !QR_Username || !QR_PairingToken || !QR_ExpiresAt || !QR_Uri ) {
        throw new Error( 'Invalid QR Code Data!' );
      }

      const data: MultiAuthData = {
        qr: QR_Code,
        username: QR_Username,
        pairingToken: QR_PairingToken,
        expiresAt: QR_ExpiresAt,
        uri: QR_Uri,
        deviceName: '',
        devicePlatform: '',
      };

      this.QR = QR_Code;
      this.QR_Data = data;
      this.pairingToken = QR_PairingToken; // critical for manual verification

      // Start polling for pairing confirmation from backend (for UI feedback)
      this.startPairingStatusPolling();
    } catch ( error ) {
      console.error( '[MultiAuthDialog] Error loading QR code:', error );
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  private startPairingStatusPolling(): void {
    if ( !this.QR_Data?.pairingToken ) {
      console.warn( '[MultiAuthDialog] No pairing token, cannot poll status.' );
      return;
    }

    const pairingToken: string = this.QR_Data.pairingToken;

    interval( 3000 )
      .pipe(
        takeUntil( this.destroy$ ),
        switchMap( () => this.apiService.getMultiAuthStatus( pairingToken ) ),
      )
      .subscribe(
        ( res: MSG ) => {
          void this.handleStatusResponse( res );
        },
        ( error ) => {
          console.error( '[MultiAuthDialog] Error polling pairing status:', error );
        },
      );
  }

  private async handleStatusResponse( res: MSG ): Promise<void> {

    const rawStatus = this.apiService.extractStringFromOther( res.data, 'status' );
    const status = rawStatus as BackendPairingStatus | undefined;

    if ( !status || !this.QR_Data ) {
      return;
    }

    if ( status === 'confirmed' ) {

      const result: MultiAuthDialogResult = {
        success: true,
        reason: 'confirmed',
        authData: this.QR_Data,
      };

      this.dialogRef.close( result );
      this.destroy$.next();
    } else if ( status === 'expired' || status === 'not_found' ) {
      console.warn( '[MultiAuthDialog] Pairing expired or not found:', status );

      const result: MultiAuthDialogResult = {
        success: false,
        reason: status,
        authData: null,
      };

      this.dialogRef.close( result );
      this.destroy$.next();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // UI switching: QR <-> Code
  // ───────────────────────────────────────────────────────────────────────────

  protected goToCodePanel(): void {
    if ( !this.QR_Data || !this.pairingToken ) {
      console.error( '[MultiAuthDialog] Cannot go to code panel – missing pairing token.' );
      return;
    }

    this.haveScanned = true;
    this.resetCodeDigits();
    this.cdr.markForCheck();
  }

  protected backToQr(): void {
    this.haveScanned = false;
    this.resetCodeDigits();
    this.cdr.markForCheck();
  }

  private resetCodeDigits(): void {
    this.codeDigits = [ '', '', '', '', '', '' ];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Code input logic
  // ───────────────────────────────────────────────────────────────────────────
  protected onCodeKeyDown( event: KeyboardEvent, index: number ): void {
    const key: string = event.key;
    const boxes: ElementRef<HTMLInputElement>[] = this.codeBoxRefs.toArray();
    const currentInput: HTMLInputElement | undefined = boxes[ index ]?.nativeElement;

    if ( !currentInput ) {
      return;
    }

    // ─────────────────────────────
    // Digit keys: 0–9
    // ─────────────────────────────
    if ( /^\d$/.test( key ) ) {
      // Stop browser from inserting the character by itself
      event.preventDefault();

      // Set current digit
      this.codeDigits[ index ] = key;
      currentInput.value = key;

      // Move to next box
      if ( index < boxes.length - 1 ) {
        const nextInput: HTMLInputElement = boxes[ index + 1 ].nativeElement;
        nextInput.focus();
        nextInput.select();
      }

      return;
    }

    // ─────────────────────────────
    // Backspace: clear + move backwards
    // ─────────────────────────────
    if ( key === 'Backspace' ) {
      event.preventDefault();

      // Clear current cell
      this.codeDigits[ index ] = '';
      currentInput.value = '';

      // Move to previous if any
      if ( index > 0 ) {
        const prevInput: HTMLInputElement = boxes[ index - 1 ].nativeElement;
        prevInput.focus();
        prevInput.select();
      }

      return;
    }

    // ─────────────────────────────
    // Allow simple navigation keys
    // ─────────────────────────────
    const allowedNav: string[] = [ 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End' ];

    if ( !allowedNav.includes( key ) ) {
      // Block any other key (letters, etc.)
      event.preventDefault();
    }
  }


  protected isCodeComplete(): boolean {
    return this.codeDigits.every( ( d ) => d.trim().length === 1 );
  }

  protected getFullCode(): string {
    return this.codeDigits.join( '' );
  }

  protected async onVerifyCode(): Promise<void> {
    try {
      const code: string = this.getFullCode();

      if ( !this.isCodeComplete() ) {
        return;
      }

      if ( !this.pairingToken ) {
        throw new Error( 'Invalid paring token!' );
      }

      if ( !code || code.length < 6 ) {
        throw new Error( 'Invalid code' );
      }

      const payload: { pairingToken: string, code: string; } = {
        pairingToken: this.pairingToken.trim(),
        code: code
      };

      const res = await this.apiService.mfaInitialVerify( payload );

      if ( !res.success ) {
        throw new Error( res.message ?? 'Failed to validate!' );
      }

      const pairing = this.apiService.extractObjectFromOther<{
        confirmed: boolean;
        createdAt: string;
        expiresAt: string;
        pairingToken: string;
        updatedAt: string;
        userId: string;
        username: string;
        _id: string;
      }>( res.data, 'pairing' );

      if ( !pairing ) {
        throw new Error( 'Invalid pairing!' );
      }

      const username = pairing.username.trim();
      const pairingToken = pairing.pairingToken.trim();

      if ( !username ) {
        throw new Error( 'Invalid username' );
      }

      if ( !pairingToken ) {
        throw new Error( 'Invalid pairing token!' );
      }

      const data: MultiAuthData = {
        pairingToken,
        username,
        devicePlatform: '',
        deviceName: '',
      };

      const confirmRes = await this.apiService.getConfirmationOfMultiAuth( data );

      if ( !confirmRes.success ) {
        throw new Error( 'Failed to confirm multi-authentication' );
      }

      this.close( true );

      this.destroy$.next();
    } catch ( error ) {
      console.error( '[MultiAuthDialog] Error verifying code:', error );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Close
  // ───────────────────────────────────────────────────────────────────────────

  protected close( isActive: boolean ): void {
    const result: MultiAuthDialogResult = {
      success: isActive,
      reason: isActive ? 'activated_via_code' : 'user_cancelled',
      authData: isActive ? this.QR_Data : null,
    };

    this.dialogRef.close( result );
    this.destroy$.next();
  }
}
