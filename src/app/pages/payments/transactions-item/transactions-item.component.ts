import { CommonModule, isPlatformBrowser } from "@angular/common";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { Subject, of } from "rxjs";
import { catchError, takeUntil, tap } from "rxjs/operators";
import { FormsModule } from "@angular/forms";

import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatChipsModule } from "@angular/material/chips";
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";

import type { MSG } from "../../../types/api-message.types";
import { PaymentsService } from '../../../services/payments/payments.service';

import {
  PaymentStatus,
  type PaymentEvidenceDto,
  type PaymentTransactionApproveInputDto,
  type PaymentTransactionCoreDto,
  type PaymentTransactionPaymentStatusInputDto,
  type PaymentTransactionRejectInputDto,
} from "../../../types/payments/transactions/payment-transaction.types";

import { NotificationDialogComponent } from "../../../components/dialogs/notificationBar/notificationBar.component";
import { ProgressBarComponent } from "../../../components/dialogs/progress-bar/progress-bar.component";
import { ConfirmationComponent } from '../../../components/shared/confirmation/confirmation.component';
import { TextEditorDialogComponent, TextEditorDialogResult, TextEditorDialogData } from '../../../components/dialogs/text-editor-dialog/text-editor-dialog.component';

@Component( {
  selector: "app-transactions-item",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,

    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,

    NotificationDialogComponent,
    ProgressBarComponent,
  ],
  templateUrl: "./transactions-item.component.html",
  styleUrl: "./transactions-item.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class PaymentsTransactionsItemComponent implements OnInit, OnDestroy {
  @ViewChild( ProgressBarComponent )
  public progressBar?: ProgressBarComponent;

  @ViewChild( NotificationDialogComponent )
  public notificationDialog?: NotificationDialogComponent;

  public loading = false;

  public transactionId = "";
  public item: PaymentTransactionCoreDto | null = null;

  private readonly destroy$ = new Subject<void>();
  private readonly isBrowser: boolean;

  protected DEFAULT_PAYMENT_STATUS: PaymentStatus[] = [
    PaymentStatus.Failed,
    PaymentStatus.Paid,
    PaymentStatus.Pending,
    PaymentStatus.Refunded,
    PaymentStatus.Voided
  ];
  protected paymentStatus: PaymentStatus | null = null;

  public constructor (
    private readonly payments: PaymentsService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly dialog: MatDialog,
    @Inject( PLATFORM_ID ) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
  }

  public ngOnInit(): void {
    this.transactionId = this.route.snapshot.paramMap.get( "transactionId" ) ?? "";

    this.safeInfo(
      `[Info:] [TransactionsItem] init | transactionId=${ this.transactionId }\n`,
    );

    if ( !this.transactionId ) {
      this.safeNotifyError( "[Error:] Missing transactionId in route.\n" );
      void this.router.navigate( [ "/dashboard/payments/transactions-list" ] );
      return;
    }

    this.loadOne();
  }

  public ngOnDestroy(): void {
    this.safeInfo( "[Info:] [TransactionsItem] destroy.\n" );
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===========================================================================
  // UI Actions
  // ===========================================================================
  public backToList(): void {
    this.safeInfo( "[Info:] [TransactionsItem] navigate back.\n" );
    void this.router.navigate( [ "/dashboard/payments/transactions-list" ] );
  }

  public goToUpdate(): void {
    if ( !this.transactionId ) return;

    this.safeInfo(
      `[Info:] [TransactionsItem] navigate update -> ${ this.transactionId }\n`,
    );
    void this.router.navigate( [
      "/dashboard/payments/transactions-update",
      this.transactionId,
    ] );
  }

  public onDelete(): void {
    if ( !this.item ) return;

    if ( !this.isBrowser ) {
      this.safeWarn( "[Warning:] [TransactionsItem] delete blocked (SSR).\n" );
      return;
    }

    const dialogRef = this.dialog.open( ConfirmationComponent, {
      width: '400px',
      height: 'auto',
      data: {
        title: `Delete transaction`,
        message: `Are you wish to delete this transaction?`,
      },
    } );

    dialogRef.afterClosed().subscribe( ( v ) => {
      if ( !v || !this.item ) return;
      console.log( '[Info:] [Transaction deletion:] delete confirm' );
      this.safeProgressStart();

      this.payments.transactions
        .delete$( this.item.transactionId )
        .pipe(
          tap( ( msg ) =>
            this.safeInfo(
              `[Info:] [TransactionsItem] delete$ response: ${ this.safeJson( msg ) }\n`,
            ),
          ),
          catchError( ( err: unknown ) => {
            this.safeProgressError();
            this.safeNotifyError( `[Error:] Delete failed. ${ this.errMsg( err ) }\n` );
            return of( null );
          } ),
          takeUntil( this.destroy$ ),
        )
        .subscribe( ( msg ) => {
          if ( !msg ) return;

          this.safeProgressSuccess();
          this.safeNotifySuccess( "[Success:] Transaction deleted.\n" );
          void this.router.navigate( [ "/dashboard/payments/transactions-list" ] );
        } );
    } );
    return;
  }


  protected paymentStatusChange() {
    if ( !this.paymentStatus ) return;
    const data: PaymentTransactionPaymentStatusInputDto = {
      status: this.paymentStatus.trim()
    };

    const transactionId = this.item?.transactionId;

    if ( !transactionId ) {
      this.notificationDialog?.notification( 'erorr', 'Transaction ID is invalid' );
      return;
    }

    if ( !data.status ) {
      this.notificationDialog?.notification( 'erorr', 'Transaction payment status is invalid' );
      return;
    }

    this.payments.transactions.status$( transactionId, data ).pipe(
      tap( ( msg ) =>
        this.safeInfo(
          `[Info:] [TransactionsItem] status$ response: ${ this.safeJson( msg ) }\n`,
        ),
      ),
      catchError( ( err: unknown ) => {
        this.safeProgressError();
        this.safeNotifyError( `[Error:] Payment status change failed. ${ this.errMsg( err ) }\n` );
        return of( null );
      } ),
      takeUntil( this.destroy$ ),
    )
      .subscribe( ( msg ) => {
        if ( !msg ) return;
        this.safeProgressSuccess();
        this.safeNotifySuccess( "[Success:] Transaction payment status changed.\n" );
        this.loadOne();
      } );
  }

  // ===========================================================================
  // Verification Status Operations (Approve / Reject)
  // ---------------------------------------------------------------------------
  // Backend routes:
  // - POST /api-payments/transactions/:transactionId/approve
  // - POST /api-payments/transactions/:transactionId/reject
  // ===========================================================================
  public canApprove(): boolean {
    if ( !this.item ) return false;
    const s = ( this.item.verificationStatus ?? "" ).toLowerCase();
    // allow approve when not already approved
    return s !== "approved";
  }

  public canReject(): boolean {
    if ( !this.item ) return false;
    const s = ( this.item.verificationStatus ?? "" ).toLowerCase();
    // allow reject when not already rejected
    return s !== "rejected";
  }

  public onApprove(): void {
    if ( !this.item ) return;

    if ( !this.isBrowser ) {
      this.safeWarn( "[Warning:] [TransactionsItem] approve blocked (SSR).\n" );
      return;
    }

    const dialogRef = this.dialog.open( ConfirmationComponent, {
      width: '400px',
      height: 'auto',
      data: {
        title: `Approve transaction`,
        message: `Are you wish to approve this transaction?`,
      },
    } );


    dialogRef.afterClosed().subscribe( ( v ) => {
      if ( !v ) return;
      const textData: TextEditorDialogData = {
        title: 'Approving note',
        label: 'Note',
        value: '',
        maxLength: 200,
      };
      const textDialod = this.dialog.open( TextEditorDialogComponent, {
        width: '500px',
        height: 'auto',
        data: textData
      } );

      textDialod.afterClosed().subscribe( ( textValue ) => {
        if ( !this.item ) return;
        const value = textValue.value;
        if ( !value || typeof value !== 'string' ) {
          console.warn( '[Warning:] [Transaction approve note:] note is either invald or empty!' );
        }
        this.safeProgressStart();

        const notes: PaymentTransactionApproveInputDto = {
          notes: value
        };

        this.payments.transactions
          .approve$( this.item.transactionId, notes )
          .pipe(
            tap( ( msg ) => {
              this.safeInfo(
                `[Info:] [TransactionsItem] approve$ response: ${ this.safeJson( msg ) }\n`,
              );
            },
            ),
            catchError( ( err: unknown ) => {
              console.error( err );
              this.safeProgressError();
              this.safeNotifyError( `[Error:] Approve failed. ${ this.errMsg( err ) }\n` );
              return of( null );
            } ),
            takeUntil( this.destroy$ ),
          )
          .subscribe( ( msg ) => {
            if ( !msg ) return;

            this.safeProgressSuccess();
            this.safeNotifySuccess( "[Success:] Verification approved.\n" );
            this.loadOne(); // reload from backend truth
          } );
        return;
      } );
      return;
    } );

    return;
  }

  public onReject(): void {
    if ( !this.item ) return;

    if ( !this.isBrowser ) {
      this.safeWarn( "[Warning:] [TransactionsItem] reject blocked (SSR).\n" );
      return;
    }

    const dialogRef = this.dialog.open( ConfirmationComponent, {
      width: '400px',
      height: 'auto',
      data: {
        title: `Reject transaction`,
        message: `Are you wish to reject this transaction?`,
      },
    } );


    dialogRef.afterClosed().subscribe( ( v ) => {
      if ( !v ) return;
      const textData: TextEditorDialogData = {
        title: 'Reject note',
        label: 'Note',
        value: '',
        maxLength: 200,
      };
      const textDialod = this.dialog.open( TextEditorDialogComponent, {
        width: '500px',
        height: 'auto',
        data: textData
      } );

      textDialod.afterClosed().subscribe( ( textValue ) => {
        if ( !this.item ) return;

        const value = textValue.value;
        if ( !value || typeof value !== 'string' ) {
          console.warn( '[Warning:] [Transaction reject note:] note is either invald or empty!' );
        }

        const payload: PaymentTransactionRejectInputDto = {
          reason: value
        };

        this.safeProgressStart();

        this.payments.transactions
          .reject$( this.item.transactionId, payload )
          .pipe(
            tap( ( msg ) =>
              this.safeInfo(
                `[Info:] [TransactionsItem] reject$ response: ${ this.safeJson( msg ) }\n`,
              ),
            ),
            catchError( ( err: unknown ) => {
              console.log( err );
              this.safeProgressError();
              this.safeNotifyError( `[Error:] Reject failed. ${ this.errMsg( err ) }\n` );
              return of( null );
            } ),
            takeUntil( this.destroy$ ),
          )
          .subscribe( ( msg ) => {
            if ( !msg ) return;
            this.safeProgressSuccess();
            this.safeNotifySuccess( "[Success:] Verification rejected.\n" );
            this.loadOne(); // reload from backend truth
          } );
        return;
      } );
      return;
    } );
    return;
  }

  // ===========================================================================
  // Load
  // ===========================================================================
  private loadOne(): void {
    this.safeProgressStart();

    this.payments.transactions
      .getByTransactionId$( this.transactionId )
      .pipe(
        tap( ( msg ) =>
          this.safeInfo(
            `[Info:] [TransactionsItem] getByTransactionId$ response\n`,
          ),
        ),
        catchError( ( err: unknown ) => {
          this.safeProgressError();
          this.safeNotifyError( `[Error:] Failed to load transaction. ${ this.errMsg( err ) }\n` );
          return of( this.makeMsgFail( "LOAD_FAILED" ) );
        } ),
        takeUntil( this.destroy$ ),
      )
      .subscribe( ( msg ) => {
        const dto = this.extractOne( msg );

        if ( !dto ) {
          this.safeProgressError();
          this.safeNotifyError( "[Error:] Transaction payload missing.\n" );
          return;
        }

        this.item = dto;
        this.paymentStatus = dto.paymentStatus;
        this.safeProgressSuccess();
        // this.safeNotifySuccess( "[Success:] Transaction loaded.\n" );

        this.cdr.markForCheck();
      } );
  };

  // ===========================================================================
  // Evidence URL resolver
  // ===========================================================================
  public resolveEvidenceUrl( e: PaymentEvidenceDto ): string | null {
    const url = typeof e.publicUrl === "string" ? e.publicUrl.trim() : "";
    if ( url ) return url;

    const rel = typeof e.publicRel === "string" ? e.publicRel.trim() : "";
    if ( !rel ) return null;

    return `/${ rel.replace( /^\/+/g, "" ) }`;
  }

  // ===========================================================================
  // Envelope extractors (MSG -> one)
  // ===========================================================================
  private extractOne( msg: MSG ): PaymentTransactionCoreDto | null {
    const sys = this.asRecord( msg?.data?.system );
    const other = this.asRecord( msg?.data?.other );

    const direct = sys[ "transaction" ];
    if ( direct && typeof direct === "object" ) {
      return direct as PaymentTransactionCoreDto;
    }

    const arr =
      ( Array.isArray( sys[ "transactions" ] ) ? sys[ "transactions" ] : null ) ??
      ( Array.isArray( sys[ "items" ] ) ? sys[ "items" ] : null );

    if ( arr && arr[ 0 ] && typeof arr[ 0 ] === "object" ) {
      return arr[ 0 ] as PaymentTransactionCoreDto;
    }

    const otherTx = other[ "transaction" ];
    if ( otherTx && typeof otherTx === "object" ) {
      return otherTx as PaymentTransactionCoreDto;
    }

    return null;
  }

  // ===========================================================================
  // Progress + Notification wrappers
  // ===========================================================================
  private safeProgressStart(): void {
    this.loading = true;
    this.safeInfo( "[Info:] [TransactionsItem] progress start\n" );

    const pb = this.progressBar as unknown as {
      start?: () => void;
      show?: () => void;
      open?: () => void;
    };

    if ( pb?.start ) pb.start();
    else if ( pb?.show ) pb.show();
    else if ( pb?.open ) pb.open();

    this.cdr.markForCheck();
  }

  private safeProgressSuccess(): void {
    this.loading = false;
    this.safeInfo( "[Info:] [TransactionsItem] progress success\n" );

    const pb = this.progressBar as unknown as {
      complete?: () => void;
      hide?: () => void;
      close?: () => void;
    };

    if ( pb?.complete ) pb.complete();
    else if ( pb?.hide ) pb.hide();
    else if ( pb?.close ) pb.close();

    this.cdr.markForCheck();
  }

  private safeProgressError(): void {
    this.loading = false;
    this.safeInfo( "[Info:] [TransactionsItem] progress error\n" );

    const pb = this.progressBar as unknown as {
      stop?: () => void;
      hide?: () => void;
      close?: () => void;
    };

    if ( pb?.stop ) pb.stop();
    else if ( pb?.hide ) pb.hide();
    else if ( pb?.close ) pb.close();

    this.cdr.markForCheck();
  }

  private safeNotifySuccess( msg: string ): void {
    this.notificationDialog?.notification?.( "success", msg.trim() );
    this.safeInfo( msg );
  }

  private safeNotifyError( msg: string ): void {
    this.notificationDialog?.notification?.( "error", msg.trim() );
    this.safeError( msg );
  };

  // ===========================================================================
  // Safe helpers (no any)
  // ===========================================================================
  private asRecord( v: unknown ): Record<string, unknown> {
    return v && typeof v === "object" ? ( v as Record<string, unknown> ) : {};
  }

  private makeMsgFail( code: string ): MSG {
    // Must match FE ApiResponse envelope:
    // { success, status, message, data }
    return {
      success: false,
      status: "error",
      message: code,
      data: {
        system: {},
        other: {},
        pagination: {},
        validation: {},
      },
      timestamp: new Date().toISOString(),
    };
  }

  private errMsg( err: unknown ): string {
    if ( err instanceof HttpErrorResponse ) {
      const msg = ( err.error as { message?: string; } | null )?.message;
      return msg ?? err.message ?? "HTTP error";
    }
    if ( err instanceof Error ) return err.message;
    if ( typeof err === "string" ) return err;
    try {
      return JSON.stringify( err );
    } catch {
      return "Unknown error";
    }
  }

  private safeJson( v: unknown ): string {
    try {
      return JSON.stringify( v );
    } catch {
      return "[Unserializable]";
    }
  }

  private safeInfo( msg: string ): void {
    // eslint-disable-next-line no-console
    console.log( msg.endsWith( "\n" ) ? msg : msg + "\n" );
  }

  private safeWarn( msg: string ): void {
    // eslint-disable-next-line no-console
    console.warn( msg.endsWith( "\n" ) ? msg : msg + "\n" );
  }

  private safeError( msg: string ): void {
    // eslint-disable-next-line no-console
    console.error( msg.endsWith( "\n" ) ? msg : msg + "\n" );
  }
}
