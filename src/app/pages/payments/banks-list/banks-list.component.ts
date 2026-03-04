// Path: src/app/pages/payments/banks-list/banks-list.component.ts
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";

import { Observable, Subject, of } from "rxjs";
import { catchError, debounceTime, distinctUntilChanged, map, startWith, takeUntil } from "rxjs/operators";

// Material
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { MatPaginator, MatPaginatorModule } from "@angular/material/paginator";
import { MatSort, MatSortModule } from "@angular/material/sort";
import { MatChipsModule } from "@angular/material/chips";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

// App UI
import { ProgressBarComponent } from "../../../components/dialogs/progress-bar/progress-bar.component";
import { NotificationDialogComponent } from "../../../components/dialogs/notificationBar/notificationBar.component";

// Services
import { PaymentsService } from "../../../services/payments/payments.service";

// Types
import type { MSG } from "../../../types/api-message.types";
import { BankStatus, type BankCoreDto } from "../../../types/payments/bank-registry/banks/bank.types";

// =============================================================================
// Table row (strict-safe, UI-only)
// =============================================================================
type BankRow = {
  bankId: string;
  name: string;
  countryCca2: string;
  bankCode: string;
  swiftBic: string;
  supportedCurrencyCodes: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  status: string;
};

type ListFormShape = {
  search: FormControl<string>;
  countryCca2: FormControl<string>;
  onlyActive: FormControl<"all" | "active" | "inactive">;
  limit: FormControl<number>;
};

@Component({
  selector: "app-banks-list",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,

    // Material
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,

    // Shared UI
    NotificationDialogComponent,
    ProgressBarComponent,
  ],
  templateUrl: "./banks-list.component.html",
  styleUrls: ["./banks-list.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BanksListComponent implements OnInit, OnDestroy {
  @ViewChild(ProgressBarComponent) public progressBar!: ProgressBarComponent;
  @ViewChild(NotificationDialogComponent) public notificationDialog!: NotificationDialogComponent;

  @ViewChild(MatPaginator) private paginator!: MatPaginator;
  @ViewChild(MatSort) private sort!: MatSort;

  public loading = false;
  public error: string | null = null;

  public readonly form: FormGroup<ListFormShape>;

  public readonly displayedColumns: string[] = [
    "name",
    "countryCca2",
    "bankCode",
    "swiftBic",
    "supportedCurrencyCodes",
    "created",
    "updated",
    "actions",
  ];

  public readonly dataSource = new MatTableDataSource<BankRow>([]);
  public total = 0;

  private page = 1;
  private readonly destroy$ = new Subject<void>();

  public constructor(
    private readonly fb: FormBuilder,
    private readonly payments: PaymentsService,
    private readonly router: Router
  ) {
    const nn = this.fb.nonNullable;
    this.form = nn.group({
      search: nn.control(""),
      countryCca2: nn.control(""),
      onlyActive: nn.control<"all" | "active" | "inactive">("all"),
      limit: nn.control(25),
    });
  }

  public ngOnInit(): void {
    // Attach Material helpers after view init-ish (safe enough in OnInit for most cases)
    // If you prefer, move to AfterViewInit and set once.
    queueMicrotask(() => {
      if (this.paginator) this.dataSource.paginator = this.paginator;
      if (this.sort) this.dataSource.sort = this.sort;
    });

    // React to filters
    const search$ = this.form.controls.search.valueChanges.pipe(
      startWith(this.form.controls.search.value),
      debounceTime(250),
      map((v) => (v ?? "").trim()),
      distinctUntilChanged()
    );

    const country$ = this.form.controls.countryCca2.valueChanges.pipe(
      startWith(this.form.controls.countryCca2.value),
      debounceTime(150),
      map((v) => (v ?? "").trim().toUpperCase()),
      distinctUntilChanged()
    );

    const status$ = this.form.controls.onlyActive.valueChanges.pipe(
      startWith(this.form.controls.onlyActive.value),
      distinctUntilChanged()
    );

    const limit$ = this.form.controls.limit.valueChanges.pipe(
      startWith(this.form.controls.limit.value),
      map((v) => (typeof v === "number" && v > 0 ? v : 25)),
      distinctUntilChanged()
    );

    // Combine manually (avoid importing combineLatest if you want)
    // Any change -> reset page -> reload
    search$.pipe(takeUntil(this.destroy$)).subscribe(() => this.resetAndLoad());
    country$.pipe(takeUntil(this.destroy$)).subscribe(() => this.resetAndLoad());
    status$.pipe(takeUntil(this.destroy$)).subscribe(() => this.resetAndLoad());
    limit$.pipe(takeUntil(this.destroy$)).subscribe(() => this.resetAndLoad());

    // Initial load
    this.loadPage(1);
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  // =============================================================================
  // UI actions
  // =============================================================================
  public onPage(ev: { pageIndex: number; pageSize: number }): void {
    const nextPage = (ev.pageIndex ?? 0) + 1;
    this.page = nextPage;

    const size = typeof ev.pageSize === "number" && ev.pageSize > 0 ? ev.pageSize : 25;
    this.form.controls.limit.setValue(size);

    this.loadPage(this.page);
  }

  public clearFilters(): void {
    this.form.reset({
      search: "",
      countryCca2: "",
      onlyActive: "all",
      limit: 25,
    });
    this.resetAndLoad();
  }

  public view(row: BankRow): void {
    void this.router.navigate(["/dashboard/payments/banks-item", row.bankId]);
  }

  public update(row: BankRow): void {
    void this.router.navigate(["/dashboard/payments/banks-update", row.bankId]);
  }

  public delete(row: BankRow): void {
    const ok = window.confirm(`Delete bank "${row.name}"? This cannot be undone.`);
    if (!ok) return;

    this.loading = true;
    this.error = null;
    this.progressBar?.start();

    this.payments.banks
      .delete$(row.bankId)
      .pipe(
        takeUntil(this.destroy$),
        catchError((err: unknown) => {
          this.loading = false;
          this.error = `[Error:] ${this.errMsg(err)}\n`;
          this.notificationDialog?.notification("error", this.errMsg(err) ?? "Delete failed");
          this.progressBar?.stop();
          return of(null);
        })
      )
      .subscribe((msg: MSG | null) => {
        this.loading = false;

        if (!msg?.success) {
          this.error = msg?.message ?? "[Error:] Delete failed.\n";
          this.notificationDialog?.notification("error", msg?.message ?? "Delete failed");
          this.progressBar?.stop();
          return;
        }

        this.notificationDialog?.notification("success", msg.message ?? "Deleted");
        this.progressBar?.complete();
        this.loadPage(this.page);
      });
  }

  // =============================================================================
  // Load
  // =============================================================================
  private resetAndLoad(): void {
    this.page = 1;
    if (this.paginator) this.paginator.firstPage();
    this.loadPage(1);
  }

  private loadPage(page: number): void {
    const options = this.buildListOptions(page);

    this.loading = true;
    this.error = null;
    // this.progressBar?.start();

    this.payments.banks
      .list$(options)
      .pipe(
        takeUntil(this.destroy$),
        catchError((err: unknown) => {
          console.log(err)
          this.loading = false;
          this.error = `[Error:] ${this.errMsg(err)}\n`;
          // this.progressBar?.stop();
          return of(null);
        })
      )
      .subscribe((msg: MSG | null) => {
        this.loading = false;
        if (!msg?.success) {
          this.error = msg?.message ?? "[Error:] Failed to load banks.\n";
          // this.progressBar?.stop();
          return;
        }

        const rows = this.extractRows(msg).map((x) => this.toRow(x));
        this.dataSource.data = rows;

        this.total = this.extractTotal(msg);
        // this.progressBar?.complete();
      });
  }

  private buildListOptions(page: number): {
    page: number;
    limit: number;
    onlyActive?: boolean;
    countryCca2?: string;
    search?: string;
  } {
    const search = this.safeTrim(this.form.controls.search.value);
    const cca2 = this.safeUpper(this.form.controls.countryCca2.value);
    const limit = this.clamp(this.form.controls.limit.value, 1, 100);

    const statusMode = this.form.controls.onlyActive.value;
    const onlyActive =
      statusMode === "active" ? true : statusMode === "inactive" ? false : undefined;

    const base = { page, limit } as {
      page: number;
      limit: number;
      onlyActive?: boolean;
      countryCca2?: string;
      search?: string;
    };

    if (onlyActive !== undefined) base.onlyActive = onlyActive;
    if (cca2 && cca2.length === 2) base.countryCca2 = cca2;
    if (search) base.search = search;

    return base;
  }

  // =============================================================================
  // MSG parsing (defensive)
  // =============================================================================
  private extractRows(msg: MSG): unknown[] {
    const banks = msg.data?.system?.banks;
    if(!Array.isArray(banks) || banks.length === 0) return [];
    return banks;
  }

  private extractTotal(msg: MSG): number {
    const total = msg.data?.pagination?.total;
    if(!total || typeof total !== 'number' || isNaN(total) || !isFinite(total)){
      return this.dataSource.data.length
    }

    return total;
  }

  private toRow(raw: unknown): BankRow {
    const r = this.asRecord(raw) ?? {};

    const supported = Array.isArray(r["supportedCurrencyCodes"])
      ? (r["supportedCurrencyCodes"] as unknown[]).map((x) => this.safeUpper(String(x))).filter(Boolean)
      : [];

    const createdAt = this.safeDate(r["createdAt"]);
    const updatedAt = this.safeDate(r["updatedAt"]);

    // createdBy/updatedBy could be string OR object
    const createdBy = this.readActor(r["createdBy"]);
    const updatedBy = this.readActor(r["updatedBy"]);


    const id =
      this.readString(r["bankId"]) ??
      this.readString(r["_id"]) ??
      this.readString(r["id"]) ??
      "";

    return {
      bankId: id,
      name: this.safeTrim(r["name"]),
      countryCca2: this.safeUpper(r["countryCca2"]),
      bankCode: this.safeTrim(r["bankCode"]),
      swiftBic: this.safeTrim(r["swiftBic"]),
      status: this.safeTrim(r['status']),
      supportedCurrencyCodes: supported,
      createdAt,
      createdBy,
      updatedAt,
      updatedBy,
    };
  }

  private readActor(v: unknown): string {
    if (!v) return "-";
    if (typeof v === "string") return v.trim() || "-";

    const rec = this.asRecord(v);
    if (!rec) return "-";

    // common keys in your project: username, name, userId
    const username = this.safeTrim(rec["username"]);
    if (username) return username;

    const name = this.safeTrim(rec["name"]);
    if (name) return name;

    const userId = this.safeTrim(rec["userId"]);
    if (userId) return userId;

    return "-";
  }

  private safeDate(v: unknown): string {
    const s = this.safeTrim(v);
    if (!s) return "-";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s; // already formatted
    return d.toLocaleString();
  }

  // =============================================================================
  // Utils
  // =============================================================================
  private clamp(n: number, min: number, max: number): number {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
  }

  private safeTrim(v: unknown): string {
    return typeof v === "string" ? v.trim() : "";
  }

  private safeUpper(v: unknown): string {
    return typeof v === "string" ? v.trim().toUpperCase() : "";
  }

  private asRecord(v: unknown): Record<string, unknown> | null {
    if (!v || typeof v !== "object") return null;
    return v as Record<string, unknown>;
  }

  private readString(v: unknown): string | null {
    if (typeof v !== "string") return null;
    const s = v.trim();
    return s ? s : null;
  }

  private errMsg(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    try {
      return JSON.stringify(err);
    } catch {
      return "Unknown error";
    }
  }
}
