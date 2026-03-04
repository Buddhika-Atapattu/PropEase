// Path: src/app/pages/payments/overview/overview.component.ts
// =============================================================================
// PaymentOverviewComponent
// -----------------------------------------------------------------------------
// Purpose
// - Payments module dashboard (launcher)
// - Provides navigation shortcuts to sub-routes (router only)
//
// Important
// - No business logic
// - SSR-safe
// =============================================================================

import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Router } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";

@Component({
  selector: "app-payment-overview",
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  templateUrl: "./overview.component.html",
  styleUrls: ["./overview.component.scss"],
})
export class PaymentOverviewComponent {
  public constructor(private readonly router: Router) {}

  // ===========================================================================
  // Top CTA
  // ===========================================================================

  public goTransactionCreate(): void {
    this.router.navigate(["/dashboard/payments/transactions-create"]);
  }

  // ===========================================================================
  // Second row navigation
  // ===========================================================================

  public goBanksList(): void {
    this.router.navigate(["/dashboard/payments/banks-list"]);
  }

  public goBankAccountsList(): void {
    // NOTE:
    // Your routes file currently has a duplication/typo for bank account list route.
    // The correct intended path should be: /dashboard/payments/banks-account-list
    // If your real path differs, change it here only.
    this.router.navigate(["/dashboard/payments/banks-account-list"]);
  }

  public goTransactionsList(): void {
    this.router.navigate(["/dashboard/payments/transactions-list"]);
  }

  // ===========================================================================
  // Existing tiles (keep if you still want them)
  // ===========================================================================

  public goList(): void {
    // NOTE: Your routes show /transactions-list, but old code navigated /list.
    // Keep /transactions-list as canonical list route.
    this.goTransactionsList();
  }

  public goPending(): void {
    this.router.navigate(["/dashboard/payments/transactions-list"], {
      queryParams: { status: "pending" },
    });
  }

  public goPaid(): void {
    this.router.navigate(["/dashboard/payments/transactions-list"], {
      queryParams: { status: "paid" },
    });
  }

  public goRefunded(): void {
    this.router.navigate(["/dashboard/payments/transactions-list"], {
      queryParams: { status: "refunded" },
    });
  }
}
