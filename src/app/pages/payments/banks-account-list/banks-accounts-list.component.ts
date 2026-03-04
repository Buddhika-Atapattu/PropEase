// Path: src/app/pages/payments/banks-account-list/banks-accounts-list.component.ts

import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { Router } from "@angular/router";
import { finalize } from "rxjs/operators";

import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatDividerModule } from "@angular/material/divider";
import { MatTooltipModule } from "@angular/material/tooltip";

import { PaymentsService } from "../../../services/payments/payments.service";
import type { MSG } from "../../../types/api-message.types";
import {
  BankAccountStatus,
  type BankAccountAdminDto,
  type BankAccountPublicDto,
} from "../../../types/payments/bank-registry/bank-accounts/bank-account.types";

import { ProgressBarComponent } from "../../../components/dialogs/progress-bar/progress-bar.component";
import { NotificationDialogComponent } from "../../../components/dialogs/notificationBar/notificationBar.component";

type BankAccountDto = BankAccountAdminDto | BankAccountPublicDto;

@Component({
  selector: "app-banks-account-list",
  standalone: true,
  imports: [
    CommonModule,

    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatTooltipModule,

    ProgressBarComponent,
    NotificationDialogComponent,
  ],
  templateUrl: "./banks-accounts-list.component.html",
  styleUrls: ["./banks-accounts-list.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BanksAccountListComponent {
  public loading = false;
  public deletingId: string | null = null;

  public readonly BankAccountStatus = BankAccountStatus;

  public includeInactive: boolean = false;

  public items: ReadonlyArray<BankAccountDto> = [];

  public constructor(
    private readonly payments: PaymentsService,
    private readonly router: Router,
  ) {
    this.load();
  }

  // ===========================================================================
  // Load
  // ===========================================================================

  public load(): void {
    this.loading = true;

    // Backend contract after your update: only includeInactive is needed
    this.payments.bankAccounts
      .listPublic$({ includeInactive: this.includeInactive })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (msg: MSG) => this.onLoadOk(msg),
        error: (err: unknown) => this.onLoadFail(err),
      });
  }

  private onLoadOk(msg: MSG): void {
    const list =
      (msg?.data?.system as { bankAccounts?: BankAccountDto[] } | undefined)?.bankAccounts ??
      [];

    this.items = Array.isArray(list) ? list : [];
  }

  private onLoadFail(err: unknown): void {
    console.error("[Error:] [BanksAccountListComponent:] load:\n", err, "\n");
    this.items = [];
  }

  public toggleIncludeInactive(v: boolean): void {
    this.includeInactive = v;
    this.load();
  }

  // ===========================================================================
  // Navigation
  // ===========================================================================

  public goCreate(): void {
    void this.router.navigateByUrl("/dashboard/payments/banks-account-create");
  }

  public view(accountId: string): void {
    // If you don’t have a dedicated view component, you can route to update page as view.
    // Adjust routes as per your app route table.
    void this.router.navigateByUrl(`/dashboard/payments/banks-account-item/${encodeURIComponent(accountId)}`);
  }

  public update(accountId: string): void {
    void this.router.navigateByUrl(`/dashboard/payments/banks-account-update/${encodeURIComponent(accountId)}`);
  }

  // ===========================================================================
  // Delete (Recycle Bin workflow)
  // ===========================================================================

  public delete(accountId: string): void {
    const ok = window.confirm("Delete this bank account to Recycle Bin?");
    if (!ok) return;

    this.deletingId = accountId;

    this.payments.bankAccounts
      .delete$(accountId)
      .pipe(finalize(() => (this.deletingId = null)))
      .subscribe({
        next: (_msg: MSG) => {
          // remove from local list for instant UX
          this.items = this.items.filter((x) => x.accountId !== accountId);
        },
        error: (err: unknown) => {
          console.error("[Error:] [BanksAccountListComponent:] delete:\n", err, "\n");
        },
      });
  }

  // ===========================================================================
  // UI helpers
  // ===========================================================================

  public trackByAccountId(_: number, item: BankAccountDto): string {
    return item.accountId;
  }

  public isActive(item: BankAccountDto): boolean {
    return item.status === BankAccountStatus.Active;
  }

  public subtitle(item: BankAccountDto): string {
    const parts: string[] = [];
    if (this.hasText(item.bankNameSnapshot)) parts.push(String(item.bankNameSnapshot));
    if (this.hasText(item.bankCodeSnapshot)) parts.push(String(item.bankCodeSnapshot));
    if (this.hasText(item.swiftBicSnapshot)) parts.push(String(item.swiftBicSnapshot));
    return parts.join(" • ");
  }

  private hasText(v: unknown): boolean {
    return typeof v === "string" && v.trim().length > 0;
  }
}
