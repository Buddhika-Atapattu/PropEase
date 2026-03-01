// Path: src/app/pages/recyclebin/dashboard/dashboard.component.ts
// =============================================================================
// RecycleBinDashboardComponent — FIXED (SSR-safe, OnPush-friendly, no leaks)
// =============================================================================
//
// Key fixes vs your broken version:
// 1) There is NO center.rows$(). Center exposes vm$().
// 2) loadPage() returns void — never console.log it.
// 3) No un-teardown subscriptions for restore/purge (use takeUntil).
// 4) Keep the streams aligned to Center: vm$ + isLoading$ + selectedCount$ + totalCount$.
// =============================================================================

import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";

import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatPaginatorModule, type PageEvent } from "@angular/material/paginator";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";

import { NotificationDialogComponent } from "../../../components/dialogs/notificationBar/notificationBar.component";
import { ProgressBarComponent } from "../../../components/dialogs/progress-bar/progress-bar.component";

import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  takeUntil,
  type Observable,
} from "rxjs";

import {
  RecycleBinCenterService,
  type RecycleBinCenterRow,
  type RecycleBinCenterVm,
} from "../../../services/recyclebin/recyclebin-center.service";

@Component( {
  selector: "app-dashboard-recyclebin",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatProgressBarModule,
    MatCheckboxModule,
    MatTableModule,
    MatTooltipModule,
    MatPaginatorModule,
    NotificationDialogComponent,
    ProgressBarComponent
  ],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class RecycleBinDashboardComponent implements OnDestroy {
  @ViewChild( ProgressBarComponent )
  public progressBar!: ProgressBarComponent;

  @ViewChild( NotificationDialogComponent )
  public notificationDialog!: NotificationDialogComponent;
  // =============================================================================
  // A) Streams (template binding)
  // =============================================================================

  /** Full VM (rows + total + page + limit + selectedCount) */
  public readonly vm$: Observable<RecycleBinCenterVm>;

  /** Loading flag */
  public readonly isLoading$: Observable<boolean>;

  /** Selected row count */
  public readonly selectedCount$: Observable<number>;

  /** Optional: total count stream (useful if your UI shows total separately) */
  public readonly totalCount$: Observable<number>;

  // =============================================================================
  // B) Local UI state
  // =============================================================================

  public searchText = "";
  public actionInFlight = false;

  public readonly displayedColumns: string[] = [
    "select",
    "name",
    "originalLocation",
    "dateDeleted",
    "type",
    "size",
  ];

  // =============================================================================
  // C) Internals
  // =============================================================================

  private readonly destroy$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();

  public constructor (
    public readonly center: RecycleBinCenterService,
    private readonly router: Router
  ) {
    // Bind streams once (async pipe friendly)
    this.vm$ = this.center.vm$();
    this.isLoading$ = this.center.isLoading$();
    this.selectedCount$ = this.center.selectedCount$();
    this.totalCount$ = this.center.totalCount$();

    // Initial Windows-like load
    this.center.loadPage( { page: 1, limit: 25 } );

    // Debounced search (prevents backend spam)
    this.searchInput$
      .pipe(
        map( ( v ) => ( typeof v === "string" ? v.trim() : "" ) ),
        debounceTime( 250 ),
        distinctUntilChanged(),
        takeUntil( this.destroy$ )
      )
      .subscribe( ( text ) => {
        this.center.setSearch( text );
      } );

    // console.log( this.vm$ );
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =============================================================================
  // Commands (called from template)
  // =============================================================================

  /** Search input handler (ngModelChange or (input)) */
  public onSearchChange(): void {
    this.searchInput$.next( this.searchText );
  }

  public onToggleExpand( entryId: string ): void {
    this.center.toggleExpand( entryId );
  }

  public onToggleSelect( rowId: string ): void {
    this.center.toggleRowSelection( rowId );
  }

  public isRowSelected( rowId: string ): boolean {
    return this.center.isSelected( rowId );
  }

  public onRestoreSelected(): void {
    if ( this.actionInFlight ) return;
    this.progressBar.start();
    this.actionInFlight = true;

    this.center
      .restoreSelected()
      .pipe(
        takeUntil( this.destroy$ ),
        finalize( () => {
          this.actionInFlight = false;
        } )
      )
      .subscribe( {
        next: () => {
          this.progressBar.complete();
          this.notificationDialog.notification( 'success', 'Item has been restored!' );
        },
        error: ( error ) => {
          console.error( '[Error:] [RecycleBinDashboardComponent:]', error );
          this.notificationDialog.notification( 'error', 'Failed to restore!' );
        },
      } );
  }

  public onDeleteSelected(): void {
    if ( this.actionInFlight ) return;

    this.actionInFlight = true;

    this.center
      .purgeSelected()
      .pipe(
        takeUntil( this.destroy$ ),
        finalize( () => {
          this.actionInFlight = false;
        } )
      )
      .subscribe( {
        next: () => {},
        error: () => {},
      } );
  }

  public onPageChange( ev: PageEvent ): void {
    // MatPaginator is 0-based; backend/UI center is 1-based
    const pageIndex = typeof ev.pageIndex === "number" && Number.isFinite( ev.pageIndex ) ? ev.pageIndex : 0;
    const page = pageIndex + 1;

    const limit =
      typeof ev.pageSize === "number" && Number.isFinite( ev.pageSize )
        ? Math.max( 1, Math.floor( ev.pageSize ) )
        : 25;

    this.center.loadPage( { page, limit } );
  }

  /**
   * Navigate to "Recycle Bin Item" view page
   * - Expects row.entry.entryId
   */
  public visitTheItem( item: Record<string, unknown> ): void {
    if ( !item || typeof item !== "object" ) return;

    const rawEntry: unknown = item[ "entry" ];
    if ( !rawEntry || typeof rawEntry !== "object" ) return;

    const entryRecord = rawEntry as Record<string, unknown>;
    const entryIdRaw: unknown = entryRecord[ "entryId" ];
    if ( typeof entryIdRaw !== "string" ) return;

    const entryId = entryIdRaw.trim();
    if ( !entryId ) return;

    this.router.navigate( [ "/dashboard/recycle-bin/recycle-bin-item", entryId ] );
  }

  // =============================================================================
  // UI helpers
  // =============================================================================

  public formatBytes( bytes: number ): string {
    const b = typeof bytes === "number" && Number.isFinite( bytes ) ? bytes : 0;
    if ( b <= 0 ) return "";

    const units = [ "B", "KB", "MB", "GB", "TB" ];
    let v = b;
    let i = 0;

    while ( v >= 1024 && i < units.length - 1 ) {
      v /= 1024;
      i += 1;
    }

    const fixed = v >= 10 ? v.toFixed( 0 ) : v.toFixed( 1 );
    return `${ fixed } ${ units[ i ] }`;
  }

  // =============================================================================
  // Optional small helpers for templates (if needed)
  // =============================================================================

  /** Safe access helper if your template wants to display row label */
  public rowLabel( row: RecycleBinCenterRow ): string {
    return row?.name ?? "";
  }
}
