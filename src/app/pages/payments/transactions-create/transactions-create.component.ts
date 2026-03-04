// Path: src/app/pages/payments/transactions-create/transactions-create.component.ts
// =============================================================================
// PaymentsTransactionsCreateComponent — FIXED (Datepicker typing + Safe DTO + Alias Existence Check + Debug Logs)
// =============================================================================

import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { Observable, Subject, of } from "rxjs";
import { map, startWith, takeUntil } from "rxjs/operators";

// RxJS operators (MUST)
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  tap,
} from "rxjs/operators";

// Angular Material
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import type { MatAutocompleteSelectedEvent } from "@angular/material/autocomplete";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatNativeDateModule } from "@angular/material/core";
import { MatTooltipModule } from "@angular/material/tooltip";

// Services
import { APIsService } from "../../../services/APIs/apis.service";
import { AuthService } from "../../../services/auth/auth.service";
import { PaymentsService } from "../../../services/payments/payments.service";

// Types
import {
  PaymentMethodKind,
  type PaymentTransactionCreateInputDto,
} from "../../../types/payments/transactions/payment-transaction.types";

// Components
import { NotificationDialogComponent } from "../../../components/dialogs/notificationBar/notificationBar.component";
import { ProgressBarComponent } from "../../../components/dialogs/progress-bar/progress-bar.component";
import { Dropdown } from "../../../components/shared/dropdown/dropdown";

// Country utils
import type { CountryDetailsCustomType } from "../../../services/property/property.service";
import {
  CountryCurrencyCard,
  CountryCurrencyMapper,
} from "../../../utils/country/country-currency.mapper";

type CreateFormShape = {
  countryQuery: FormControl<string | CountryCurrencyCard>;
  countryCurrency: FormControl<CountryCurrencyCard | null>;

  currencyCode: FormControl<string>;
  amount: FormControl<number>;
  method: FormControl<PaymentTransactionCreateInputDto["method"]>;

  bankAccountAlias: FormControl<string>;
  externalRef: FormControl<string>;
  notes: FormControl<string>;

  /**
   * IMPORTANT:
   * Angular Material Datepicker emits Date | null (NOT string).
   */
  transactionAt: FormControl<Date | null>;
};

@Component({
  selector: "app-transactions-create",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,

    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTooltipModule,

    NotificationDialogComponent,
    ProgressBarComponent,
    Dropdown,
  ],
  templateUrl: "./transactions-create.component.html",
  styleUrls: ["./transactions-create.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsTransactionsCreateComponent implements OnInit, OnDestroy {
  @ViewChild(ProgressBarComponent)
  public progressBar?: ProgressBarComponent;

  @ViewChild(NotificationDialogComponent)
  public notificationDialog?: NotificationDialogComponent;

  // ===========================================================================
  // UI State
  // ===========================================================================
  public loading = false;
  protected evidence: File[] = [];

  // ===========================================================================
  // Helpers
  // ===========================================================================
  protected readonly DEFAULT_METHODS: PaymentTransactionCreateInputDto["method"][] =
    [
      PaymentMethodKind.BankTransfer,
      PaymentMethodKind.Card,
      PaymentMethodKind.Cash,
      PaymentMethodKind.Cheque,
      PaymentMethodKind.Gateway,
    ];

  protected allCurencies: CountryCurrencyCard[] = [];
  protected filteredCountries$: Observable<CountryCurrencyCard[]> = of([]);

  /**
   * Alias check UI state:
   * - null => not checked / cleared / unknown due to error
   * - true => exists
   * - false => not found
   */
  protected aliasExists: boolean | null = null;
  private lastAliasState: boolean | null = null;

  // ===========================================================================
  // Typed Reactive Form
  // ===========================================================================
  public readonly form: FormGroup<CreateFormShape>;

  // ===========================================================================
  // Internals
  // ===========================================================================
  private readonly destroy$ = new Subject<void>();

  public constructor(
    protected readonly router: Router,
    private readonly fb: FormBuilder,

    private readonly paymentService: PaymentsService,
    private readonly authService: AuthService,
    private readonly apiService: APIsService,
  ) {
    this.form = this.fb.group<CreateFormShape>({
      countryQuery: this.fb.control<string | CountryCurrencyCard>("", {
        nonNullable: true,
      }),
      countryCurrency: this.fb.control<CountryCurrencyCard | null>(null),

      currencyCode: this.fb.control<string>("LKR", {
        validators: [Validators.required],
        nonNullable: true,
      }),

      amount: this.fb.control<number>(0, {
        validators: [Validators.required, Validators.min(0.01)],
        nonNullable: true,
      }),

      method: this.fb.control<PaymentTransactionCreateInputDto["method"]>(
        PaymentMethodKind.BankTransfer,
        { validators: [Validators.required], nonNullable: true },
      ),

      bankAccountAlias: this.fb.control<string>("", { nonNullable: true }),
      externalRef: this.fb.control<string>("", { nonNullable: true }),
      notes: this.fb.control<string>("", { nonNullable: true }),

      transactionAt: this.fb.control<Date | null>(null),
    });
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  public async ngOnInit(): Promise<void> {
    void this.authService; // keep for consistency (auth bootstrap side effects)

    this.safeInfo("[Info:] [TransactionsCreate] ngOnInit()\n");

    try {
      const rawCountries = await this.apiService.getCountriesCurrencies();
      this.allCurencies = CountryCurrencyMapper.toCurrencyCards(rawCountries);

      this.safeInfo(
        `[Info:] [TransactionsCreate] countries/currencies loaded: ${this.allCurencies.length}\n`,
      );
    } catch (err) {
      this.safeError(
        `[Error:] [TransactionsCreate] load countries/currencies failed: ${this.errMsg(err)}\n`,
      );
      this.safeNotifyError(
        "[Error:] Failed to load countries/currencies. Please refresh.\n",
      );
    }

    this.filteredCountries$ = this.form.controls.countryQuery.valueChanges.pipe(
      startWith(this.form.controls.countryQuery.value),
      map((v) => this.normalizeQueryText(v)),
      map((q) => this.filterCountriesByText(q)),
    );

    // ✅ alias existence check (SUBSCRIBED + debounced + cancel-safe)
    this.bindAliasExistenceCheck();

    // Debug logs
    this.bindFormDebug();
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.safeInfo("[Info:] [TransactionsCreate] destroyed\n");
  }

  public backToOverview(): void {
    this.safeInfo("[Info:] [TransactionsCreate] navigate -> payments overview\n");
    void this.router.navigate(["/dashboard/payments/transactions-list"]);
  }

  // ===========================================================================
  // Autocomplete
  // ===========================================================================
  public displayCountryCard(value: string | CountryCurrencyCard): string {
    if (typeof value === "string") return value;
    return value?.name ?? "";
  }

  public onCountryOptionSelected(ev: MatAutocompleteSelectedEvent): void {
    const card = ev.option.value as CountryCurrencyCard | null;
    if (!card) return;

    this.form.controls.countryCurrency.setValue(card);
    this.form.controls.currencyCode.setValue(card.currency);
    this.form.controls.countryQuery.setValue(card);

    this.safeInfo(
      `[Info:] [TransactionsCreate] country selected: ${card.name} | currency=${card.currency}\n`,
    );
  }

  protected clearCountrySelection(): void {
    this.form.controls.countryCurrency.setValue(null);
    this.form.controls.countryQuery.setValue("");
    this.safeInfo("[Info:] [TransactionsCreate] country cleared\n");
  }

  // ===========================================================================
  // Bank Account Alias Existence Check
  // ===========================================================================
  private bindAliasExistenceCheck(): void {
    const ctrl = this.form.controls.bankAccountAlias;

    ctrl.valueChanges
      .pipe(
        startWith(ctrl.value.trim()),
        map((v) => (typeof v === "string" ? v.trim() : "")),
        debounceTime(350),
        distinctUntilChanged(),
        tap((alias) =>
          this.safeInfo(`[Info:] [TxCreate] alias typed: "${alias}"\n`),
        ),
        switchMap((alias) => {
          if (!alias) {
            return of({ alias, exists: null as boolean | null });
          }

          // Treat "GET by alias" success => exists
          return this.paymentService.bankAccounts.getByAccountAlias$(alias).pipe(
            map(() => ({ alias, exists: true as const })),
            catchError((err: unknown) => {
              // 404 => not found
              if (this.isNotFound(err)) return of({ alias, exists: false as const });

              // other errors => unknown
              this.safeWarn(
                `[Warning:] [TxCreate] alias check failed: ${this.errMsg(err)}\n`,
              );
              return of({ alias, exists: null as boolean | null });
            }),
          );
        }),
        tap((r) =>
          this.safeInfo(
            `[Info:] [TxCreate] alias check result: ${r.alias} => ${String(r.exists)}\n`,
          ),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((r) => {
        this.aliasExists = r.exists;

        // Prevent spam: notify only when state changes
        if (this.lastAliasState === r.exists) return;
        this.lastAliasState = r.exists;

        if (r.exists === true) {
          this.safeNotifySuccess(
            `[Success:] Bank account alias exists: "${r.alias}"\n`,
          );
          return;
        }

        if (r.exists === false) {
          this.safeNotifyError(
            `[Error:] Bank account alias NOT found: "${r.alias}"\n`,
          );
          return;
        }

        if (!r.alias) {
          this.safeInfo("[Info:] [TxCreate] alias cleared; existence reset.\n");
          return;
        }

        this.safeNotifyError(
          `[Warning:] Unable to verify alias right now: "${r.alias}"\n`,
        );
      });
  }

  private isNotFound(err: unknown): boolean {
    return err instanceof HttpErrorResponse && err.status === 404;
  }

  // ===========================================================================
  // Files
  // ===========================================================================
  protected filesChange(f: File[]): void {
    if (!Array.isArray(f) || f.length === 0) {
      this.safeWarn("[Warning:] [TransactionsCreate] filesChange empty\n");
      return;
    }

    const incoming = f.filter((x) => this.isValidEvidenceFile(x));
    const merged = [...this.evidence];

    for (const file of incoming) {
      const key = this.fileKey(file);
      const exists = merged.some((m) => this.fileKey(m) === key);
      if (!exists) merged.push(file);
    }

    this.evidence = merged;

    this.safeInfo(
      `[Info:] [TransactionsCreate] evidence updated. total=${this.evidence.length}\n`,
    );
  }

  protected removeEvidenceAt(index: number): void {
    if (index < 0 || index >= this.evidence.length) return;
    const next = [...this.evidence];
    next.splice(index, 1);
    this.evidence = next;

    this.safeInfo(
      `[Info:] [TransactionsCreate] evidence removed index=${index}. total=${this.evidence.length}\n`,
    );
  }

  protected clearEvidence(): void {
    this.evidence = [];
    this.safeInfo("[Info:] [TransactionsCreate] evidence cleared\n");
  }

  // ===========================================================================
  // Submit
  // ===========================================================================
  protected submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.safeWarn("[Warning:] [TransactionsCreate] submit blocked: form.invalid\n");
      this.safeNotifyError("[Error:] Please fix validation errors.\n");
      return;
    }

    if (!this.evidence || this.evidence.length === 0) {
      this.safeWarn("[Warning:] [TransactionsCreate] submit blocked: evidence missing\n");
      this.safeNotifyError("[Error:] Evidence is required to create a transaction.\n");
      return;
    }

    const payload = this.buildCreatePayload();
    if (!payload) {
      this.safeWarn("[Warning:] [TransactionsCreate] submit blocked: payload null\n");
      this.safeNotifyError("[Error:] Invalid payload. Check your inputs.\n");
      return;
    }

    this.safeInfo(`[Info:] [TransactionsCreate] submit payload: ${this.safeJson(payload)}\n`);
    this.safeInfo(
      `[Info:] [TransactionsCreate] evidence: count=${this.evidence.length} names=${this.evidence
        .map((x) => x.name)
        .join(", ")}\n`,
    );

    this.safeProgressStart();

    this.paymentService.transactions
      .create$(payload, this.evidence)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (msg) => {
          this.safeInfo(`[Success:] [TransactionsCreate] create$ ok: ${this.safeJson(msg)}\n`);

          this.safeProgressSuccess();
          this.safeNotifySuccess("[Success:] Transaction created successfully.\n");

          this.form.reset({
            countryQuery: "",
            countryCurrency: null,
            currencyCode: payload.currencyCode || "LKR",
            amount: 0,
            method: PaymentMethodKind.BankTransfer,
            bankAccountAlias: "",
            externalRef: "",
            notes: "",
            transactionAt: null,
          });

          this.aliasExists = null;
          this.lastAliasState = null;
          this.clearEvidence();

          void this.router.navigate(["/dashboard/payments/transactions-list"]);
        },
        error: (err: unknown) => {
          this.safeError(`[Error:] [TransactionsCreate] create$ failed: ${this.errMsg(err)}\n`);

          this.safeProgressError();
          this.safeNotifyError(
            `[Error:] Failed to create transaction. ${this.errMsg(err)}\n`,
          );
        },
      });
  }

  // ===========================================================================
  // Internals (debug + DTO)
  // ===========================================================================
  private bindFormDebug(): void {
    this.form.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const method = this.form.controls.method.value;
        const bankAccountAlias = this.form.controls.bankAccountAlias.value;
        const amount = this.form.controls.amount.value;
        const currencyCode = this.form.controls.currencyCode.value;
        const txAt = this.form.controls.transactionAt.value;

        this.safeInfo(
          `[Info:] [TransactionsCreate] form change | method=${method} | bankAccountAlias=${bankAccountAlias} | alias=${bankAccountAlias} | amount=${amount} | currency=${currencyCode} | transactionAt=${txAt ? txAt.toISOString() : "(null)"}\n`,
        );
      });
  }

  private buildCreatePayload(): PaymentTransactionCreateInputDto | null {
    const currencyCode = this.form.controls.currencyCode.value.trim();
    const amount = this.form.controls.amount.value;
    const method = this.form.controls.method.value;

    if (!currencyCode) return null;
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const bankAccountAlias = this.form.controls.bankAccountAlias.value.trim();
    const externalRef = this.form.controls.externalRef.value.trim();
    const notes = this.form.controls.notes.value.trim();

    const txAtDate = this.form.controls.transactionAt.value;
    const transactionAt = this.toIsoOrEmpty(txAtDate);

    if (method === PaymentMethodKind.BankTransfer || method === PaymentMethodKind.Cheque) {
      if (!bankAccountAlias) {
        this.safeWarn("[Warning:] [TransactionsCreate] bankAccountAlias required for BankTransfer/Cheque\n");
        this.safeNotifyError("[Error:] Bank Account is required for Bank Transfer / Cheque.\n");
        return null;
      }
    }

    return {
      amount,
      currencyCode,
      method,
      bankAccountAlias: bankAccountAlias || "",
      externalRef: externalRef || "",
      notes: notes || "",
      transactionAt: transactionAt || "",
    };
  }

  private normalizeQueryText(value: string | CountryCurrencyCard): string {
    if (typeof value === "string") return value.trim();
    return (value?.name ?? "").trim();
  }

  private filterCountriesByText(text: string): CountryCurrencyCard[] {
    const q = (text || "").trim().toLowerCase();
    if (!q) return [...this.allCurencies];

    return this.allCurencies.filter((c) => {
      const name = c.name.toLowerCase();
      const currency = c.currency.toLowerCase();
      return name.includes(q) || currency.includes(q);
    });
  }

  // kept (unused but harmless if you use later)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private pickSingleCurrency(country: CountryDetailsCustomType): { code: string; display: string } | null {
    const cur = country?.currencies;
    if (!cur) return null;

    const codes = Object.keys(cur).filter(Boolean).sort((a, b) => a.localeCompare(b));
    if (codes.length === 0) return null;

    const code = codes[0];
    const meta = cur[code];

    const currencyName = meta?.name?.trim() ?? "";
    const symbolRaw = meta?.symbol?.trim() ?? "";
    const symbolUpper = symbolRaw ? symbolRaw.toUpperCase() : "";

    if (!currencyName && !symbolUpper) return null;

    const display =
      currencyName && symbolUpper
        ? `${currencyName} (${symbolUpper})`
        : currencyName
          ? currencyName
          : symbolUpper;

    return { code, display };
  }

  private toIsoOrEmpty(d: Date | null): string {
    if (!d) return "";
    if (!(d instanceof Date)) return "";
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString();
  }

  private isValidEvidenceFile(file: File): boolean {
    if (!file) return false;
    if (file.size <= 0) return false;
    return true;
  }

  private fileKey(f: File): string {
    return `${f.name}::${f.size}::${f.lastModified}`;
  }

  // ===========================================================================
  // Progress + Notification safe wrappers
  // ===========================================================================
  private safeProgressStart(): void {
    this.loading = true;

    const pb = this.progressBar as unknown as
      | { start?: () => void; show?: () => void; open?: () => void }
      | undefined;

    this.safeInfo("[Info:] [TransactionsCreate] progress start\n");

    if (pb?.start) pb.start();
    else if (pb?.show) pb.show();
    else if (pb?.open) pb.open();
  }

  private safeProgressSuccess(): void {
    this.loading = false;

    const pb = this.progressBar as unknown as
      | { complete?: () => void; hide?: () => void; close?: () => void }
      | undefined;

    this.safeInfo("[Info:] [TransactionsCreate] progress success\n");

    if (pb?.complete) pb.complete();
    else if (pb?.hide) pb.hide();
    else if (pb?.close) pb.close();
  }

  private safeProgressError(): void {
    this.loading = false;

    const pb = this.progressBar as unknown as
      | { stop?: () => void; hide?: () => void; close?: () => void }
      | undefined;

    this.safeInfo("[Info:] [TransactionsCreate] progress error\n");

    if (pb?.stop) pb.stop();
    else if (pb?.hide) pb.hide();
    else if (pb?.close) pb.close();
  }

  private safeNotifySuccess(msg: string): void {
    if (this.notificationDialog?.notification) {
      this.notificationDialog.notification("success", msg.trim());
    }
    this.safeInfo(msg);
  }

  private safeNotifyError(msg: string): void {
    if (this.notificationDialog?.notification) {
      this.notificationDialog.notification("error", msg.trim());
    }
    this.safeError(msg);
  }

  // ===========================================================================
  // Error helpers + Console policy
  // ===========================================================================
  private errMsg(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const msg = (err.error as { message?: string } | null)?.message;
      return msg ?? err.message ?? "HTTP error";
    }
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    try {
      return JSON.stringify(err);
    } catch {
      return "Unknown error";
    }
  }

  private safeJson(v: unknown): string {
    try {
      return JSON.stringify(v);
    } catch {
      return "[Unserializable]";
    }
  }

  private safeInfo(msg: string): void {
    // eslint-disable-next-line no-console
    console.log(msg.endsWith("\n") ? msg : msg + "\n");
  }

  private safeWarn(msg: string): void {
    // eslint-disable-next-line no-console
    console.warn(msg.endsWith("\n") ? msg : msg + "\n");
  }

  private safeError(msg: string): void {
    // eslint-disable-next-line no-console
    console.error(msg.endsWith("\n") ? msg : msg + "\n");
  }
}
