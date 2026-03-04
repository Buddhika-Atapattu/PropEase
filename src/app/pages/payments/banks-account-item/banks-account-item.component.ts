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
import { ActivatedRoute, Router } from "@angular/router";

import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatChipsModule } from "@angular/material/chips";
import { MatDividerModule } from "@angular/material/divider";

import { Subject, distinctUntilChanged, map, takeUntil } from "rxjs";
import { finalize } from "rxjs/operators";

import { PaymentsService } from "../../../services/payments/payments.service";
import type { MSG } from "../../../types/api-message.types";
import type {
  BankAccountAdminDto,
  BankAccountDto,
} from "../../../types/payments/bank-registry/bank-accounts/bank-account.types";

import { ProgressBarComponent } from "../../../components/dialogs/progress-bar/progress-bar.component";
import { NotificationDialogComponent } from "../../../components/dialogs/notificationBar/notificationBar.component";

@Component({
  selector: "app-banks-account-item",
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    ProgressBarComponent,
    NotificationDialogComponent,
  ],
  templateUrl: "./banks-account-item.component.html",
  styleUrl: "./banks-account-item.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BanksAccountItemComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  public loading = false;

  public accountId = "";
  public item: BankAccountDto | null = null;

  public constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly payments: PaymentsService,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {}

  public ngOnInit(): void {
    // ✅ React to later route changes (same component reused with different :accountId)
    this.route.paramMap
      .pipe(
        map((p) => String(p.get("accountId") ?? "").trim()),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (accountId: string) => {
          if (!accountId) {
            this.item = null;
            this.accountId = "";
            this.cdr.markForCheck();
            void this.router.navigateByUrl("/dashboard/payments/banks-account-list");
            return;
          }

          this.accountId = accountId;
          this.load();
        },
      });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =============================================================================
  // Union guards (admin vs public)
  // =============================================================================

  public isAdminDto(item: BankAccountDto | null | undefined): item is BankAccountAdminDto {
    return (
      !!item &&
      typeof item === "object" &&
      "accountNumber" in item &&
      typeof (item as { accountNumber?: unknown }).accountNumber === "string"
    );
  }

  public hasText(v: unknown): boolean {
    return typeof v === "string" && v.trim().length > 0;
  }

  // =============================================================================
  // Navigation
  // =============================================================================

  public backToList(): void {
    void this.router.navigateByUrl("/dashboard/payments/banks-account-list");
  }

  public goUpdate(): void {
    if (!this.accountId) return;
    void this.router.navigateByUrl(`/dashboard/payments/banks-account-update/${this.accountId}`);
  }

  // =============================================================================
  // Actions
  // =============================================================================

  public setDefault(): void {
    if (this.loading || !this.accountId) return;

    this.loading = true;
    this.cdr.markForCheck();

    this.payments.bankAccounts
      .setDefault$(this.accountId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (_msg: MSG) => {
          // reload to reflect isDefault (role-aware DTO may change too)
          this.load();
        },
        error: (_err: unknown) => {
          // keep global error handler behavior
        },
      });
  }

  public delete(): void {
    if (this.loading || !this.accountId) return;

    const ok = this.confirmDelete();
    if (!ok) return;

    this.loading = true;
    this.cdr.markForCheck();

    this.payments.bankAccounts
      .delete$(this.accountId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (_msg: MSG) => {
          void this.router.navigateByUrl("/dashboard/payments/banks-account-list");
        },
        error: (_err: unknown) => {},
      });
  }

  // =============================================================================
  // View helpers
  // =============================================================================

  public get statusLabel(): string {
    const s = this.item?.status;
    return this.hasText(s) ? String(s) : "unknown";
  }

  public get statusChipClass(): string {
    const s = String(this.item?.status ?? "").toLowerCase();
    if (s === "active") return "chip chip-active";
    if (s === "inactive") return "chip chip-inactive";
    return "chip";
  }

  public get defaultLabel(): string {
    return this.item?.isDefault ? "Default" : "Not default";
  }

  // =============================================================================
  // Load
  // =============================================================================

  private load(): void {
    if (!this.accountId) return;

    this.loading = true;
    this.item = null;
    this.cdr.markForCheck();

    this.payments.bankAccounts
      .getByAccountId$(this.accountId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (msg: MSG) => {
          // Backend contract: SystemData key = bankAccount
          const item = msg?.data?.system?.bankAccount ?? null;
          this.item = item;
          this.cdr.markForCheck(); // ✅ critical for OnPush/zoneless
        },
        error: (_err: unknown) => {
          this.item = null;
          this.cdr.markForCheck();
        },
      });
  }

  private confirmDelete(): boolean {
    // ✅ SSR/Electron safe confirmation
    const canUseBrowserDialogs = isPlatformBrowser(this.platformId) && typeof window !== "undefined";
    if (!canUseBrowserDialogs) return true;
    return window.confirm("Delete this bank account to Recycle Bin?");
  }
}
