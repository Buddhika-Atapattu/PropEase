// Path: src/app/services/payments/payments.service.ts
// =============================================================================
// PaymentsService (FE Facade)
// -----------------------------------------------------------------------------
// Goal:
// - Import ONLY PaymentsService everywhere.
// - Access module APIs via:
//     this.payments.banks.*
//     this.payments.bankAccounts.*
//     this.payments.transactions.*
//
// Bonus:
// - Re-export all related REST services + types from ONE place.
// =============================================================================

import { Injectable } from "@angular/core";

import { PaymentBankRestService } from "./banks/payment-bank.rest.service";
import { PaymentBankAccountRestService } from "./banks/payment-bank-account.rest.service";
import { PaymentTransactionRestService } from "./transactions/payment-transaction.rest.service";

@Injectable({ providedIn: "root" })
export class PaymentsService {
  public constructor(
    public readonly banks: PaymentBankRestService,
    public readonly bankAccounts: PaymentBankAccountRestService,
    public readonly transactions: PaymentTransactionRestService,
  ) {}
}

// -----------------------------------------------------------------------------
// Re-exports (single import location for types if you want it)
// Example:
//   import { PaymentsService, BankCreateInput, PaymentTransactionCreateInput } from ".../payments.service";
// -----------------------------------------------------------------------------
export * from "./banks/payment-bank.rest.service";
export * from "./banks/payment-bank-account.rest.service";
export * from "./transactions/payment-transaction.rest.service";
