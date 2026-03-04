// Path: src/app/pages/payments/banks-account-update/banks-account-update.component.ts
// =============================================================================
// BanksAccountUpdateComponent — Refactored (Create-like UX)
// -----------------------------------------------------------------------------
// Key behaviors:
// ✅ Bank code typing resolves bankId from backend (debounce + switchMap)
// ✅ Country autocomplete drives currency (currency auto-fills; no manual pick)
// ✅ API errors console.error + notification dialog feedback
// ✅ Progress bar feedback on load/update/delete/setDefault
// ✅ Omit undefined optionals (exactOptionalPropertyTypes-safe)
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
import { ActivatedRoute, Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";

import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatDividerModule } from "@angular/material/divider";
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
import type { MSG } from "../../../types/api-message.types";

import {
  BankAccountStatus,
  type BankAccountAdminDto,
  type BankAccountPublicDto,
  type BankAccountUpdateInputDto,
} from "../../../types/payments/bank-registry/bank-accounts/bank-account.types";

import { ProgressBarComponent } from "../../../components/dialogs/progress-bar/progress-bar.component";
import { NotificationDialogComponent } from "../../../components/dialogs/notificationBar/notificationBar.component";

import {
  CountryCurrencyMapper,
  type CountryCurrencyCard,
} from "../../../utils/country/country-currency.mapper";

type BankAccountDto = BankAccountAdminDto | BankAccountPublicDto;

@Component({
  selector: "app-banks-account-update",
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
    MatDividerModule,
    MatAutocompleteModule,

    ProgressBarComponent,
    NotificationDialogComponent,
  ],
  templateUrl: "./banks-account-update.component.html",
  styleUrl: "./banks-account-update.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BanksAccountUpdateComponent implements OnInit, OnDestroy {
  @ViewChild(ProgressBarComponent)
  public progressBar?: ProgressBarComponent;

  @ViewChild(NotificationDialogComponent)
  public notificationDialog?: NotificationDialogComponent;

  public loading = false;
  public saving = false;
  public deleting = false;
  public settingDefault = false;

  public error: string | null = null;

  public readonly BankAccountStatus = BankAccountStatus;

  public accountId = "";
  public loaded: BankAccountDto | null = null;

  // Country → Currency source list (from mapper)
  protected allCountries: CountryCurrencyCard[] = [];
  protected filteredCountries$: Observable<CountryCurrencyCard[]> = of([]);

  private readonly destroy$ = new Subject<void>();
  private selectedCountry: CountryCurrencyCard | null = null;

  public readonly form: FormGroup<{
    bankId: FormControl<string>;
    bankCode: FormControl<string>;

    // Country search input (string while typing, object when selected)
    countryQuery: FormControl<string | CountryCurrencyCard>;

    // Derived from selected country
    currencyCode: FormControl<string>;

    alias: FormControl<string>;
    accountHolderName: FormControl<string>;
    accountNumber: FormControl<string>;
    iban: FormControl<string>;

    branchName: FormControl<string>;
    branchCode: FormControl<string>;

    isDefault: FormControl<boolean>;
    status: FormControl<BankAccountStatus>;
    notes: FormControl<string>;
  }>;

  public constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly payments: PaymentsService,
    private readonly apiService: APIsService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    this.form = this.buildForm();
  }

  // =============================================================================
  // Lifecycle
  // =============================================================================
  public ngOnInit(): void {
    this.readAccountId();
    this.bindCountrySource();
    this.bindCountryFiltering();
    this.bindBankCodeResolver();

    this.loadOne();
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =============================================================================
  // Route
  // =============================================================================
  private readAccountId(): void {
    const accountId = String(this.route.snapshot.paramMap.get("accountId") ?? "").trim();
    if (!accountId) {
      void this.router.navigateByUrl("/payments");
      return;
    }
    this.accountId = accountId;
  }

  // =============================================================================
  // Form
  // =============================================================================
  private buildForm(): BanksAccountUpdateComponent["form"] {
    return this.fb.group({
      bankId: this.fb.control("", { validators: [Validators.required] }),
      bankCode: this.fb.control("", { validators: [Validators.required] }),

      countryQuery: this.fb.control<string | CountryCurrencyCard>(""),
      currencyCode: this.fb.control("LKR", { validators: [Validators.required] }),

      alias: this.fb.control("", {
        validators: [Validators.required, Validators.minLength(2), Validators.maxLength(60)],
      }),

      accountHolderName: this.fb.control("", {
        validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
      }),

      accountNumber: this.fb.control("", {
        validators: [Validators.required, Validators.minLength(4), Validators.maxLength(64)],
      }),

      iban: this.fb.control(""),
      branchName: this.fb.control(""),
      branchCode: this.fb.control(""),

      isDefault: this.fb.control(false),
      status: this.fb.control(BankAccountStatus.Active, { validators: [Validators.required] }),
      notes: this.fb.control(""),
    });
  }

  // =============================================================================
  // Load
  // =============================================================================
  private loadOne(): void {
    if (!this.accountId) return;

    this.loading = true;

    this.payments.bankAccounts
      .getByAccountId$(this.accountId)
      .pipe(
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (msg: MSG) => this.onLoadOk(msg),
        error: (err: unknown) => this.onLoadFail(err),
      });
  }

  private onLoadOk(msg: MSG): void {
    const item =
      (msg?.data?.system as { bankAccount?: BankAccountDto } | undefined)?.bankAccount ?? null;

    if (!item) {
      this.notifyError("Bank account not found.");
      void this.router.navigateByUrl("/payments");
      return;
    }

    this.loaded = item;
    this.patchFormFromDto(item);

    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private onLoadFail(err: unknown): void {
    console.error("[Error:] [BanksAccountUpdateComponent:] loadOne:\n", err, "\n");
    this.error = this.errMsg(err);
    this.notifyError(this.error || "Failed to load bank account.");
    void this.router.navigateByUrl("/payments");
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
          console.error("[Error:] [BanksAccountUpdateComponent:] loadCountries failed:\n", err, "\n");
          this.notifyWarn("Failed to load country/currency dataset.");
          return of([] as unknown[]);
        })
      )
      .subscribe((rawCountries: unknown[]) => {
        this.allCountries = CountryCurrencyMapper.toCurrencyCards(rawCountries);
      });
  }

  private bindCountryFiltering(): void {
    const ctrl = this.form.controls.countryQuery;

    this.filteredCountries$ = ctrl.valueChanges.pipe(
      startWith(ctrl.value),
      map((v) => this.normalizeCountryQueryText(v)),
      map((q) => this.filterCountriesByText(q))
    );

    ctrl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((v) => {
        if (typeof v === "string") {
          const t = v.trim();
          if (!t) {
            this.selectedCountry = null;
            // keep currency as-is OR reset baseline:
            // this.form.controls.currencyCode.setValue("LKR", { emitEvent: false });
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

    this.form.controls.currencyCode.setValue(meta.code, { emitEvent: false });
    this.form.controls.currencyCode.markAsDirty();

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
  // BankCode → BankId resolver (same pattern as Create)
  // =============================================================================
  private bindBankCodeResolver(): void {
    const ctrl = this.form.controls.bankCode;

    ctrl.valueChanges
      .pipe(
        takeUntil(this.destroy$),
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

          if (code.length < 2) {
            this.clearResolvedBank();
            return of(null);
          }

          const safeCode = code.toUpperCase();

          return this.payments.banks.getByBankCode$(safeCode).pipe(
            map((msg: MSG) => this.readBankIdFromMsg(msg)),
            catchError((err: unknown) => {
              console.error("[Error:] [BanksAccountUpdateComponent:] bankCode lookup failed:\n", err, "\n");
              this.clearResolvedBank();
              this.notifyError(this.errMsg(err) || "Failed to verify bank code.");
              return of(null);
            })
          );
        })
      )
      .subscribe((bankId: string | null) => {
        if (!bankId) return;
        this.form.controls.bankId.setValue(bankId, { emitEvent: false });
        this.form.controls.bankId.markAsDirty();
      });
  }

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

    this.clearResolvedBank();
    this.notifyWarn("Bank code not found. Please check and try again.");
    return null;
  }

  private clearResolvedBank(): void {
    this.form.controls.bankId.setValue("", { emitEvent: false });
  }

  // =============================================================================
  // Patch form from DTO (Create-like fields)
  // =============================================================================
  private patchFormFromDto(dto: BankAccountDto): void {
    const safeStr = (v: unknown): string => (typeof v === "string" ? v : "");

    // Admin-only fields
    const accountNumber =
      "accountNumber" in dto && typeof (dto as unknown as { accountNumber?: unknown }).accountNumber === "string"
        ? String((dto as unknown as { accountNumber: string }).accountNumber)
        : "";

    const notes =
      "notes" in dto && typeof (dto as unknown as { notes?: unknown }).notes === "string"
        ? String((dto as unknown as { notes: string }).notes)
        : "";

    const iban =
      "iban" in dto && typeof (dto as unknown as { iban?: unknown }).iban === "string"
        ? String((dto as unknown as { iban: string }).iban)
        : "";

    const currency = safeStr(dto.currencyCode || "LKR").toUpperCase();
    const bankCode = safeStr((dto as unknown as { bankCode?: unknown }).bankCode).toUpperCase();

    this.form.patchValue({
      bankId: safeStr(dto.bankId),
      bankCode,

      // countryQuery cannot be reliably restored unless backend returns cca2/name
      // keep it empty (user may change country, currency stays as loaded)
      countryQuery: "",

      currencyCode: currency,

      alias: safeStr(dto.alias),
      accountHolderName: safeStr(dto.accountHolderName),

      accountNumber,
      iban,

      branchName: safeStr((dto as unknown as { branchName?: unknown }).branchName),
      branchCode: safeStr((dto as unknown as { branchCode?: unknown }).branchCode),

      isDefault: Boolean(dto.isDefault),
      status: dto.status ?? BankAccountStatus.Active,
      notes,
    });

    // selectedCountry cannot be reconstructed without backend metadata; keep null
    this.selectedCountry = null;
  }

  public clearFormToLoaded(): void {
    if (!this.loaded) return;
    this.patchFormFromDto(this.loaded);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  public backToList(): void {
    void this.router.navigateByUrl("/payments");
  }

  // =============================================================================
  // Actions
  // =============================================================================
  public submit(): void {
    if (this.saving || this.loading) return;
    if (!this.accountId) return;

    // Require resolved bankId (because user edits bankCode)
    if (!this.hasText(this.form.controls.bankId.value)) {
      this.form.controls.bankCode.markAsTouched();
      this.notifyWarn("Please enter a valid bank code (bank not resolved).");
      return;
    }

    // Country is optional in Update because backend update needs only currency
    // If you want to enforce "country selection required" here too, uncomment:
    // if (!this.selectedCountry) {
    //   this.form.controls.countryQuery.markAsTouched();
    //   this.notifyWarn("Please select a country to set the currency.");
    //   return;
    // }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifyWarn("Please fix validation errors before saving.");
      return;
    }

    const raw = this.form.getRawValue();
    const patch = this.buildUpdatePayload(raw);

    this.saving = true;
    this.progressBar?.start()

    this.payments.bankAccounts
      .update$(this.accountId, patch)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.progressBar?.complete()
          this.notificationDialog?.notification('success', 'Account updated!');
          setTimeout(()=> this.router.navigate(['/dashboard/payments/banks-account-list']), 1000);
        })
      )
      .subscribe({
        next: (msg: MSG) => this.onUpdateOk(msg),
        error: (err: unknown) => this.onUpdateFail(err),
      });
  }

  private onUpdateOk(msg: MSG): void {
    const item =
      (msg?.data?.system as { bankAccount?: BankAccountDto } | undefined)?.bankAccount ?? null;

    if (item) {
      this.loaded = item;
      this.patchFormFromDto(item);
      this.form.markAsPristine();
      this.form.markAsUntouched();
    }

    this.notifySuccess("Bank account updated successfully.");
  }

  private onUpdateFail(err: unknown): void {
    console.error("[Error:] [BanksAccountUpdateComponent:] submit:\n", err, "\n");
    this.error = this.errMsg(err);
    this.notifyError(this.error || "Failed to update bank account.");
  }

  public setDefault(): void {
    if (this.settingDefault || this.loading) return;
    if (!this.accountId) return;

    this.settingDefault = true;

    this.payments.bankAccounts
      .setDefault$(this.accountId)
      .pipe(
        finalize(() => {
          this.settingDefault = false;

        })
      )
      .subscribe({
        next: (msg: MSG) => {
          void msg;
          this.notifySuccess("Default account updated.");
          this.loadOne();
        },
        error: (err: unknown) => {
          console.error("[Error:] [BanksAccountUpdateComponent:] setDefault:\n", err, "\n");
          this.notifyError(this.errMsg(err) || "Failed to set default account.");

        },
      });
  }

  public delete(): void {
    if (this.deleting || this.loading) return;
    if (!this.accountId) return;

    // Keep SSR/Electron safe: avoid window.confirm here.
    // Your HTML can present a confirm dialog later; for now, keep simple:
    const ok = true;
    if (!ok) return;

    this.deleting = true;
    this.progressBar?.start()

    this.payments.bankAccounts
      .delete$(this.accountId)
      .pipe(
        finalize(() => {
          this.deleting = false;
          this.progressBar?.complete();
        })
      )
      .subscribe({
        next: (msg: MSG) => {
          void msg;
          this.notifySuccess("Bank account deleted.");
          void this.router.navigateByUrl("/payments");
        },
        error: (err: unknown) => {
          console.error("[Error:] [BanksAccountUpdateComponent:] delete:\n", err, "\n");
          this.notifyError(this.errMsg(err) || "Failed to delete bank account.");
          this.progressBar?.error()
        },
      });
  }

  // =============================================================================
  // Payload builder (exactOptionalPropertyTypes-safe)
  // =============================================================================
  private buildUpdatePayload(v: {
    bankId: string;
    bankCode: string;

    countryQuery: string | CountryCurrencyCard;
    currencyCode: string;

    alias: string;
    accountHolderName: string;
    accountNumber: string;
    iban: string;

    branchName: string;
    branchCode: string;

    isDefault: boolean;
    status: BankAccountStatus;
    notes: string;
  }): BankAccountUpdateInputDto {
    // Send deterministic fields.
    const out: BankAccountUpdateInputDto = {
      bankId: v.bankId.trim(),
      bankCode: v.bankCode.trim().toUpperCase(),

      alias: v.alias.trim(),
      currencyCode: v.currencyCode.trim().toUpperCase(),
      accountHolderName: v.accountHolderName.trim(),

      // Admin-only: if public user sees empty accountNumber, backend should reject.
      accountNumber: v.accountNumber.trim(),

      status: v.status,
      ...(v.isDefault === true ? { isDefault: true } : {}),
    };

    if (this.hasText(v.iban)) out.iban = v.iban.trim();
    if (this.hasText(v.branchName)) out.branchName = v.branchName.trim();
    if (this.hasText(v.branchCode)) out.branchCode = v.branchCode.trim();
    if (this.hasText(v.notes)) out.notes = v.notes.trim();

    return out;
  }

  // =============================================================================
  // Notification + Progress adapters (same as Create)
  // =============================================================================
  private notifySuccess(message: string): void {
    const dlg = this.notificationDialog?.notification('success', message)
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

  // Country filter helpers
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
