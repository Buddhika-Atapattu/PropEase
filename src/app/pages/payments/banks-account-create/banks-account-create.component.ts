// Path: src/app/pages/payments/banks-account-create/banks-account-create.component.ts
// =============================================================================
// BanksAccountCreateComponent — Country → Currency derived + BankCode → BankId resolver
// -----------------------------------------------------------------------------
// Key behaviors:
// ✅ Country autocomplete drives currency selection (currency auto-fills)
// ✅ Bank code typing resolves bankId from backend (debounce + switchMap)
// ✅ API errors console.error + notification dialog feedback
// ✅ Progress bar feedback on submit
// ✅ Omit undefined optionals (exactOptionalPropertyTypes-safe)
// ✅ Payload matches backend BankAccountCreateInputDto (flat branchName/branchCode)
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
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";

import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatAutocompleteModule } from "@angular/material/autocomplete";

import { from, Observable, of, Subject } from "rxjs";
import {
  catchError,
  finalize,
  map,
  startWith,
  takeUntil,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  tap,
} from "rxjs/operators";

import { PaymentsService } from "../../../services/payments/payments.service";
import { APIsService } from "../../../services/APIs/apis.service";
import { MSG } from "../../../types/api-message.types";

import {
  BankAccountStatus,
  type BankAccountCreateInputDto,
} from "../../../types/payments/bank-registry/bank-accounts/bank-account.types";

import { ProgressBarComponent } from "../../../components/dialogs/progress-bar/progress-bar.component";
import { NotificationDialogComponent } from "../../../components/dialogs/notificationBar/notificationBar.component";

import {
  CountryCurrencyMapper,
  type CountryCurrencyCard,
} from "../../../utils/country/country-currency.mapper";

@Component({
  selector: "app-banks-account-create",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,

    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatAutocompleteModule,

    ProgressBarComponent,
    NotificationDialogComponent,
  ],
  templateUrl: "./banks-account-create.component.html",
  styleUrl: "./banks-account-create.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BanksAccountCreateComponent implements OnInit, OnDestroy {
  @ViewChild(ProgressBarComponent)
  public progressBar!: ProgressBarComponent;

  @ViewChild(NotificationDialogComponent)
  public notificationDialog!: NotificationDialogComponent;

  public loading = false;
  public error: string | null = null;

  public readonly BankAccountStatus = BankAccountStatus;

  // Country → Currency source list (from mapper)
  protected allCountries: CountryCurrencyCard[] = [];
  protected filteredCountries$: Observable<CountryCurrencyCard[]> = of([]);

  private readonly destroy$ = new Subject<void>();

  // Keep the selected country card (drives currency)
  private selectedCountry: CountryCurrencyCard | null = null;

  public readonly form: FormGroup<{
    bankId: FormControl<string>;
    bankCode: FormControl<string>;
    alias: FormControl<string>;

    // Derived from selectedCountry (country.currency)
    currencyCode: FormControl<string>;

    accountHolderName: FormControl<string>;
    accountNumber: FormControl<string>;
    iban: FormControl<string>;

    // ✅ MUST be union typed, otherwise you get the error you reported
    countryQuery: FormControl<string | CountryCurrencyCard>;

    branchName: FormControl<string>;
    branchCode: FormControl<string>;
    isDefault: FormControl<boolean>;
    status: FormControl<BankAccountStatus>;
    notes: FormControl<string>;
  }>;

  public constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly payments: PaymentsService,
    private readonly router: Router,
    private readonly apiService: APIsService
  ) {
    this.form = this.buildForm();
  }

  // =============================================================================
  // Lifecycle
  // =============================================================================
  public ngOnInit(): void {
    this.bindCountrySource();
    this.bindCountryFiltering();
    this.bindBankCodeResolver();
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =============================================================================
  // Form
  // =============================================================================
  private buildForm(): BanksAccountCreateComponent["form"] {
    return this.fb.group({
      // bankId is internal but must be resolved before submit
      bankId: this.fb.control("", { validators: [Validators.required] }),

      // what user types
      bankCode: this.fb.control("", { validators: [Validators.required] }),

      alias: this.fb.control("", {
        validators: [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(60),
        ],
      }),

      currencyCode: this.fb.control("LKR", { validators: [Validators.required] }),

      accountHolderName: this.fb.control("", {
        validators: [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(120),
        ],
      }),

      accountNumber: this.fb.control("", {
        validators: [
          Validators.required,
          Validators.minLength(4),
          Validators.maxLength(64),
        ],
      }),

      iban: this.fb.control(""),

      // ✅ FIX: force union type so inferred group matches declared group
      countryQuery: this.fb.control<string | CountryCurrencyCard>(""),

      branchName: this.fb.control(""),
      branchCode: this.fb.control(""),

      isDefault: this.fb.control(false),

      status: this.fb.control(BankAccountStatus.Active, {
        validators: [Validators.required],
      }),

      notes: this.fb.control(""),
    });
  }

  // =============================================================================
  // Country → Currency behavior
  // =============================================================================
  private bindCountrySource(): void {
    from(this.apiService.getCountriesCurrencies())
      .pipe(
        takeUntil(this.destroy$),
        map((raw: unknown) => this.asArray(raw)),
        catchError((err: unknown) => {
          console.error(
            "[Error:] [BanksAccountCreateComponent:] loadCountries failed:\n",
            err,
            "\n"
          );
          this.error = this.errMsg(err);
          this.notifyError("Failed to load country/currency dataset.");
          return of([] as unknown[]);
        })
      )
      .subscribe((rawCountries: unknown[]) => {
        this.allCountries = CountryCurrencyMapper.toCurrencyCards(rawCountries);

        if (this.allCountries.length === 0) {
          this.notifyWarn("Country list is empty. Currency auto-fill may not work.");
        }
      });
  }

  private bindCountryFiltering(): void {
    const ctrl = this.form.controls.countryQuery;

    this.filteredCountries$ = ctrl.valueChanges.pipe(
      startWith(ctrl.value),
      map((v) => this.normalizeCountryQueryText(v)),
      map((q) => this.filterCountriesByText(q))
    );

    // If user clears the field manually, clear selection & reset currency baseline
    ctrl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((v) => {
        if (typeof v === "string") {
          const text = v.trim();
          if (!text) {
            this.selectedCountry = null;
            this.form.controls.currencyCode.setValue("LKR", { emitEvent: false });
          }
        }
      });
  }

  public displayCountry = (v: string | CountryCurrencyCard): string => {
    if (typeof v === "string") return v;
    return (v?.name ?? "").trim();
  };

  public onCountrySelected(card: CountryCurrencyCard): void {
    this.selectedCountry = card;

    const meta = this.resolveCountryCardMeta(card);
    if (!meta) {
      this.notifyWarn("Selected country has missing currency metadata.");
      return;
    }

    // Currency is derived from country selection
    this.form.controls.currencyCode.setValue(meta.code, { emitEvent: false });
    this.form.controls.currencyCode.markAsDirty();

    // keep the control holding the object (displayWith will show name)
    this.form.controls.countryQuery.setValue(card, { emitEvent: false });
  }

  public clearCountrySelection(): void {
    this.selectedCountry = null;
    this.form.controls.countryQuery.setValue("", { emitEvent: true });
    this.form.controls.currencyCode.setValue("LKR", { emitEvent: false });

    this.form.controls.countryQuery.markAsPristine();
    this.form.controls.countryQuery.markAsUntouched();
  }

  // =============================================================================
  // BankCode → BankId resolver (RxJS)
  // =============================================================================

  /**
   * RxJS reasoning:
   * - debounceTime: wait for user pause
   * - distinctUntilChanged: avoid duplicate calls
   * - switchMap: cancel previous in-flight request when user keeps typing
   */
  private bindBankCodeResolver(): void {
    const ctrl = this.form.controls.bankCode;

    ctrl.valueChanges
      .pipe(
        takeUntil(this.destroy$),

        // normalize input early
        map((v) => (v || "").trim()),
        debounceTime(400),
        distinctUntilChanged(),

        tap((code) => {
          if (!this.hasText(code)) {
            this.clearResolvedBank();
          }
        }),

        switchMap((code) => {
          if (!this.hasText(code)) return of(null);

          // minimum sanity (adjust if your codes are shorter/longer)
          if (code.length < 2) {
            this.clearResolvedBank();
            return of(null);
          }

          const safeCode = code.toUpperCase();

          // IMPORTANT: must exist in your FE PaymentBanks service.
          // Expected response: msg.data.system.bank or msg.data.system.banks[0]
          return this.payments.banks.getByBankCode$(safeCode).pipe(
            map((msg: MSG) => this.readBankIdFromMsg(msg)),
            catchError((err: unknown) => {
              console.error(
                "[Error:] [BanksAccountCreateComponent:] bankCode lookup failed:\n",
                err,
                "\n"
              );

              this.clearResolvedBank();
              this.notifyError(this.errMsg(err) || "Failed to verify bank code.");
              return of(null);
            })
          );
        })
      )
      .subscribe((bankId: string | null) => {
        if (!bankId) return;

        // ✅ found: patch hidden bankId
        this.form.controls.bankId.setValue(bankId, { emitEvent: false });
        this.form.controls.bankId.markAsDirty();
      });
  }

  /**
   * Extract bankId from MSG envelope.
   * Supports both:
   * - sys.bank._id   (most common)
   * - sys.bank.bankId (fallback)
   * - sys.banks[0]._id
   * - sys.banks[0].bankId
   */
  private readBankIdFromMsg(msg: MSG): string | null {
    const sys = msg?.data?.system as unknown as {
      bank?: { _id?: string; bankId?: string };
      banks?: Array<{ _id?: string; bankId?: string }>;
    } | undefined;

    const id1 = sys?.bank?._id;
    if (this.hasText(id1)) return id1!.trim();

    const id1b = sys?.bank?.bankId;
    if (this.hasText(id1b)) return id1b!.trim();

    const id2 = sys?.banks?.[0]?._id;
    if (this.hasText(id2)) return id2!.trim();

    const id2b = sys?.banks?.[0]?.bankId;
    if (this.hasText(id2b)) return id2b!.trim();

    // not found: bank code doesn't exist
    this.clearResolvedBank();
    this.notifyWarn("Bank code not found. Please check and try again.");
    return null;
  }

  private clearResolvedBank(): void {
    this.form.controls.bankId.setValue("", { emitEvent: false });
  }

  // =============================================================================
  // Actions
  // =============================================================================
  public clearForm(): void {
    this.selectedCountry = null;

    this.form.reset({
      bankId: "",
      bankCode: "",
      alias: "",
      currencyCode: "LKR",
      accountHolderName: "",
      accountNumber: "",
      iban: "",
      countryQuery: "",
      branchName: "",
      branchCode: "",
      isDefault: false,
      status: BankAccountStatus.Active,
      notes: "",
    });

    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  public backToList(): void {
    void this.router.navigateByUrl("/dashboard/payments/banks-account-list");
  }

  public submit(): void {
    if (this.loading) return;

    // Require country selection so currency is truly derived
    if (!this.selectedCountry) {
      this.form.controls.countryQuery.markAsTouched();
      this.notifyWarn("Please select a country to set the currency.");
      return;
    }

    // Require resolved bankId from bankCode lookup
    if (!this.hasText(this.form.controls.bankId.value)) {
      this.form.controls.bankCode.markAsTouched();
      this.notifyWarn("Please enter a valid bank code (bank not resolved).");
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifyWarn("Please fix validation errors before submitting.");
      return;
    }

    const v = this.form.getRawValue();
    const payload = this.buildCreatePayload(v);

    this.loading = true;
    this.progressStart("Creating bank account...");

    this.payments.bankAccounts
      .create$(payload)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.progressDone();
        })
      )
      .subscribe({
        next: (msg: MSG) => this.onCreateOk(msg),
        error: (err: unknown) => this.onCreateFail(err),
      });
  }

  // =============================================================================
  // Payload builder (matches backend BankAccountCreateInputDto)
  // =============================================================================
  private buildCreatePayload(v: {
    bankId: string;
    bankCode: string;
    alias: string;

    currencyCode: string;

    accountHolderName: string;
    accountNumber: string;
    iban: string;

    countryQuery: string | CountryCurrencyCard;

    branchName: string;
    branchCode: string;

    isDefault: boolean;
    status: BankAccountStatus;
    notes: string;
  }): BankAccountCreateInputDto {
    const out: BankAccountCreateInputDto = {
      bankId: v.bankId.trim(),
      bankCode: v.bankCode.trim().toUpperCase(),
      alias: v.alias.trim(),

      accountHolderName: v.accountHolderName.trim(),
      accountNumber: v.accountNumber.trim(),

      currencyCode: v.currencyCode.trim().toUpperCase() as never, // CurrencyCode is usually string union
      status: v.status,

      ...(v.isDefault === true ? { isDefault: true } : {}),
    };

    // flat optional fields (branch details)
    if (this.hasText(v.branchName)) out.branchName = v.branchName.trim();
    if (this.hasText(v.branchCode)) out.branchCode = v.branchCode.trim();

    if (this.hasText(v.iban)) out.iban = v.iban.trim();
    if (this.hasText(v.notes)) out.notes = v.notes.trim();

    return out;
  }

  // =============================================================================
  // Submit handlers
  // =============================================================================
  private onCreateOk(msg: MSG): void {
    void msg;
    this.notifySuccess("Bank account created successfully.");
    void this.router.navigateByUrl("/payments");
  }

  private onCreateFail(err: unknown): void {
    console.error(
      "[Error:] [BanksAccountCreateComponent:] create failed:\n",
      err,
      "\n"
    );

    this.error = this.errMsg(err);
    this.notifyError(this.error || "Failed to create bank account.");
    this.progressError();
  }

  // =============================================================================
  // Notification + Progress adapters (safe, avoids compile errors)
  // =============================================================================
  private notifySuccess(message: string): void {
    const dlg = this.notificationDialog as unknown as {
      success?: (m: string) => void;
      showSuccess?: (m: string) => void;
      openSuccess?: (m: string) => void;
      open?: (type: "success" | "error" | "warning" | "info", m: string) => void;
    };

    if (typeof dlg.success === "function") dlg.success(message);
    else if (typeof dlg.showSuccess === "function") dlg.showSuccess(message);
    else if (typeof dlg.openSuccess === "function") dlg.openSuccess(message);
    else if (typeof dlg.open === "function") dlg.open("success", message);
  }

  private notifyError(message: string): void {
    const dlg = this.notificationDialog as unknown as {
      error?: (m: string) => void;
      showError?: (m: string) => void;
      openError?: (m: string) => void;
      open?: (type: "success" | "error" | "warning" | "info", m: string) => void;
    };

    if (typeof dlg.error === "function") dlg.error(message);
    else if (typeof dlg.showError === "function") dlg.showError(message);
    else if (typeof dlg.openError === "function") dlg.openError(message);
    else if (typeof dlg.open === "function") dlg.open("error", message);
  }

  private notifyWarn(message: string): void {
    const dlg = this.notificationDialog as unknown as {
      warn?: (m: string) => void;
      warning?: (m: string) => void;
      showWarning?: (m: string) => void;
      open?: (type: "success" | "error" | "warning" | "info", m: string) => void;
    };

    if (typeof dlg.warn === "function") dlg.warn(message);
    else if (typeof dlg.warning === "function") dlg.warning(message);
    else if (typeof dlg.showWarning === "function") dlg.showWarning(message);
    else if (typeof dlg.open === "function") dlg.open("warning", message);
  }

  private progressStart(label: string): void {
    const bar = this.progressBar as unknown as {
      start?: (m?: string) => void;
      open?: (m?: string) => void;
    };

    if (typeof bar.start === "function") bar.start(label);
    else if (typeof bar.open === "function") bar.open(label);
  }

  private progressDone(): void {
    const bar = this.progressBar as unknown as {
      complete?: () => void;
      done?: () => void;
      close?: () => void;
    };

    if (typeof bar.complete === "function") bar.complete();
    else if (typeof bar.done === "function") bar.done();
    else if (typeof bar.close === "function") bar.close();
  }

  private progressError(): void {
    const bar = this.progressBar as unknown as {
      stopError?: () => void;
      error?: () => void;
      fail?: () => void;
    };

    if (typeof bar.stopError === "function") bar.stopError();
    else if (typeof bar.error === "function") bar.error();
    else if (typeof bar.fail === "function") bar.fail();
  }

  // =============================================================================
  // Helpers
  // =============================================================================
  private hasText(v: string | null | undefined): boolean {
    return typeof v === "string" && v.trim().length > 0;
  }

  private asArray(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
  }

  private errMsg(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const anyErr = err.error as unknown as { message?: string };
      return anyErr?.message ?? err.message;
    }
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    try {
      return JSON.stringify(err);
    } catch {
      return "Unknown error";
    }
  }

  // =============================================================================
  // Country filter helpers
  // =============================================================================
  private normalizeCountryQueryText(value: string | CountryCurrencyCard): string {
    if (typeof value === "string") return value.trim();
    return (value?.name ?? "").trim();
  }

  private filterCountriesByText(text: string): CountryCurrencyCard[] {
    const q = (text || "").trim().toLowerCase();
    if (!q) return [...this.allCountries];

    return this.allCountries.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const currency = (c.currency || "").toLowerCase();
      const cca2 = (c.cca2 || "").toLowerCase();
      return name.includes(q) || currency.includes(q) || cca2.includes(q);
    });
  }

  private resolveCountryCardMeta(card: CountryCurrencyCard): { cca2: string; code: string } | null {
    const cca2 = this.safeUpper(card.cca2 ?? "");
    const code = this.safeUpper(card.currency ?? "");

    if (!cca2 || cca2.length !== 2) return null;
    if (!code) return null;

    return { cca2, code };
  }

  private safeUpper(v: unknown): string {
    if (typeof v !== "string") return "";
    return v.trim().toUpperCase();
  }
}
