import { CommonModule, isPlatformBrowser } from "@angular/common";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";

import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatPaginatorModule, PageEvent } from "@angular/material/paginator";
import { MatChipsModule } from "@angular/material/chips";
import { MatDialog } from "@angular/material/dialog";

import { BehaviorSubject, Subject, combineLatest, of } from "rxjs";
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
  takeUntil,
  tap,
} from "rxjs/operators";

import type { MSG } from "../../../types/api-message.types";
import { PaymentsService } from "../../../services/payments/payments.service";
import { ConfirmationComponent } from "../../../components/shared/confirmation/confirmation.component";

// -----------------------------------------------------------------------------
// UI row model (template consumes this only)
// -----------------------------------------------------------------------------
type TransactionListRow = Readonly<{
  transactionId: string;
  bankAccountAlias: string;
  amount: number;
  currencyCode: string;
  method: string;
  transactionAt: string;
  paymentStatus: string;
  verificationStatus: string;
}>;

@Component( {
  selector: "app-transactions-list",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,

    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatChipsModule,
  ],
  templateUrl: "./transactions-list.component.html",
  styleUrl: "./transactions-list.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class PaymentsTransactionsListComponent implements OnInit, OnDestroy {
  // ========================
  // UI State
  // ========================
  public loading = true;            // ✅ start as loading to avoid empty flicker
  public hasLoaded = false;         // ✅ becomes true after first API response
  public deletingId: string | null = null;

  public items: ReadonlyArray<TransactionListRow> = [];
  public total = 0;

  public page = 1;
  public limit = 10;

  public readonly searchCtrl = new FormControl<string>( "", { nonNullable: true } );

  private readonly destroy$ = new Subject<void>();
  private readonly page$ = new BehaviorSubject<{ page: number; limit: number; }>( {
    page: 1,
    limit: 10,
  } );
  private readonly isBrowser: boolean;

  public constructor (
    private readonly payments: PaymentsService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly dialog: MatDialog,
    @Inject( PLATFORM_ID ) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
  }

  public ngOnInit(): void {
    console.log( "[Info:] [TransactionsList] init.\n" );

    // ✅ SSR-safe: do not run HTTP on server render (prevents hydration mismatch)
    if ( !this.isBrowser ) {
      console.warn( "[Warning:] [TransactionsList] SSR render: skipping initial API load.\n" );
      this.loading = true;
      this.hasLoaded = false;
      this.cdr.markForCheck();
      return;
    }

    const search$ = this.searchCtrl.valueChanges.pipe(
      startWith( this.searchCtrl.value ),
      debounceTime( 250 ),
      map( ( v ) => ( typeof v === "string" ? v.trim() : "" ) ),
      distinctUntilChanged(),
      tap( ( v ) => console.log( `[Info:] [TransactionsList] search changed: "${ v }".\n` ) ),
      tap( () => {
        this.page = 1;
        this.page$.next( { page: 1, limit: this.limit } );
      } ),
    );

    combineLatest( [ search$, this.page$ ] )
      .pipe(
        map( ( [ search, pg ] ) => ( {
          search,
          page: pg.page,
          limit: pg.limit,
        } ) ),
        tap( ( q ) =>
          console.log(
            `[Info:] [TransactionsList] load requested -> page=${ q.page }, limit=${ q.limit }, search="${ q.search }".\n`,
          ),
        ),
        tap( () => {
          this.loading = true;
          this.cdr.markForCheck();
        } ),
        switchMap( ( q ) =>
          this.payments.transactions
            .list$( {
              page: q.page,
              limit: q.limit,
              filters: q.search ? ( { search: q.search } as Record<string, string> ) : undefined,
            } )
            .pipe(
              catchError( ( err: unknown ) => {
                console.error( "[Error:] [TransactionsList] list$ failed.\n", err );
                return of( this.makeMsgFail( "LIST_FAILED" ) );
              } ),
            ),
        ),
        tap( ( msg ) => console.log( "[Info:] [TransactionsList] list$ response.\n" ) ),
        map( ( msg ) => this.extractList( msg ) ),
        tap( ( r ) => {
          this.items = r.items;
          this.total = r.total;

          this.hasLoaded = true;
          this.loading = false;

          console.log(
            `[Success:] [TransactionsList] hydrated -> items=${ r.items.length }, total=${ r.total }.\n`,
          );
          this.cdr.markForCheck();
        } ),
        takeUntil( this.destroy$ ),
      )
      .subscribe();
  }

  public ngOnDestroy(): void {
    console.log( "[Info:] [TransactionsList] destroy.\n" );
    this.destroy$.next();
    this.destroy$.complete();
    this.page$.complete();
  }

  public onPage( e: PageEvent ): void {
    const nextPage = Number.isFinite( e.pageIndex ) ? e.pageIndex + 1 : 1;
    const nextLimit = Number.isFinite( e.pageSize ) ? e.pageSize : this.limit;

    console.log( `[Info:] [TransactionsList] page changed -> page=${ nextPage }, limit=${ nextLimit }.\n` );

    this.page = nextPage;
    this.limit = nextLimit;
    this.page$.next( { page: nextPage, limit: nextLimit } );
  }

  public onCreate(): void {
    console.log( "[Info:] [TransactionsList] navigate -> create.\n" );
    void this.router.navigate( [ "/dashboard/payments/transactions-create" ] );
  }

  public onView( item: TransactionListRow ): void {
    console.log( `[Info:] [TransactionsList] navigate -> view: ${ item.transactionId }.\n` );
    void this.router.navigate( [ "/dashboard/payments/transactions-item", item.transactionId ] );
  }

  public onUpdate( item: TransactionListRow ): void {
    console.log( `[Info:] [TransactionsList] navigate -> update: ${ item.transactionId }.\n` );
    void this.router.navigate( [ "/dashboard/payments/transactions-update", item.transactionId ] );
  }

  public onDelete( item: TransactionListRow ): void {
    console.log( `[Warning:] [TransactionsList] delete clicked: ${ item.transactionId }.\n` );

    if ( !this.isBrowser ) {
      console.warn( "[Warning:] [TransactionsList] delete blocked (SSR).\n" );
      return;
    }

    const dialogRef = this.dialog.open( ConfirmationComponent, {
      width: '400px',
      height: 'auto',
      data: {
        title: `Delete transaction`,
        message: `Are you wish to delete this transaction ( ${ item.transactionId } )?`,
      },
    } );


    dialogRef.afterClosed().subscribe( ( v ) => {
      if ( !v ) return;
      this.deletingId = item.transactionId;
      this.loading = true;
      this.cdr.markForCheck();

      this.payments.transactions
        .delete$( this.deletingId )
        .pipe(
          tap( ( msg ) => console.log( "[Info:] [TransactionsList] delete$ response.\n", msg ) ),
          catchError( ( err: unknown ) => {
            console.error( "[Error:] [TransactionsList] delete$ failed.\n", err );
            return of( this.makeMsgFail( "DELETE_FAILED" ) );
          } ),
          tap( () => {
            console.log( "[Success:] [TransactionsList] delete flow finished, reloading list.\n" );
            this.deletingId = null;
            this.page$.next( { page: this.page, limit: this.limit } );
          } ),
          takeUntil( this.destroy$ ),
        )
        .subscribe();
        return;
    } );
    return;
  }

  public onRefresh(): void {
    console.log( "[Info:] [TransactionsList] manual refresh.\n" );
    this.page$.next( { page: this.page, limit: this.limit } );
  }

  public trackById( _: number, x: TransactionListRow ): string {
    return x.transactionId;
  }

  private extractList( msg: MSG ): { items: ReadonlyArray<TransactionListRow>; total: number; } {
    const system = msg.data?.system;
    const other = msg.data?.other;
    const pagination = msg.data?.pagination;

    const raw = system?.transactions;
    const arr = this.asArray( raw ) ?? [];

    const rows = arr
      .map( ( x ) => this.normalizeRow( x ) )
      .filter( ( x ): x is TransactionListRow => x !== null );

    const totalFromOther = this.readTotal( other );
    const totalFromPagination = this.readTotal( pagination );

    const total = totalFromOther ?? totalFromPagination ?? rows.length;
    return { items: rows, total };
  }

  private normalizeRow( v: unknown ): TransactionListRow | null {
    const o = this.asRecord( v );

    const transactionId =
      this.asText( o[ "transactionId" ] ) ??
      this.asText( o[ "_id" ] ) ??
      this.asText( o[ "id" ] );

    if ( !transactionId ) return null;

    return {
      transactionId,
      bankAccountAlias: this.asText( o[ "bankAccountAlias" ] ) ?? "UNKNOWN",
      amount: this.asNumber( o[ "amount" ] ) ?? 0,
      currencyCode: this.asText( o[ "currencyCode" ] ) ?? "UNKNOWN",
      method: this.asText( o[ "method" ] ) ?? "UNKNOWN",
      transactionAt: this.asText( o[ "transactionAt" ] ) ?? "",
      paymentStatus: this.asText( o[ "paymentStatus" ] ) ?? "UNKNOWN",
      verificationStatus: this.asText( o[ "verificationStatus" ] ) ?? "UNKNOWN",
    };
  }

  private readTotal( v: unknown ): number | null {
    const o = this.asRecord( v );
    const n = this.asNumber( o[ "total" ] );
    return n ?? null;
  }

  private asRecord( v: unknown ): Record<string, unknown> {
    return v && typeof v === "object" ? ( v as Record<string, unknown> ) : {};
  }

  private asArray( v: unknown ): ReadonlyArray<unknown> | null {
    return Array.isArray( v ) ? v : null;
  }

  private asText( v: unknown ): string | null {
    const s = typeof v === "string" ? v.trim() : "";
    return s ? s : null;
  }

  private asNumber( v: unknown ): number | null {
    if ( typeof v === "number" && Number.isFinite( v ) ) return v;
    if ( typeof v === "string" ) {
      const n = Number( v );
      return Number.isFinite( n ) ? n : null;
    }
    return null;
  }

  private makeMsgFail( code: string ): MSG {
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
}
