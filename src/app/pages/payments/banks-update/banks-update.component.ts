// Path: src/app/pages/payments/banks-update/banks-update.component.ts
// =============================================================================
// BanksUpdateComponent (FE)
// - Loads bank by :bankId route param
// - Stores DTO first, then patches ONLY after (countries + phone codes) are ready
// - Fixes OnPush + Electron/Zone rendering via uiPatch()
// - Extracts from canonical envelope: msg.data.system.bank
// - exactOptionalPropertyTypes-safe: optional props omitted when empty
// =============================================================================

import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
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
import { ActivatedRoute, Router } from "@angular/router";

import { Observable, Subject, of, from } from "rxjs";
import {
  catchError,
  filter,
  map,
  startWith,
  switchMap,
  takeUntil,
  tap,
} from "rxjs/operators";

// Angular Material
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSelectModule } from "@angular/material/select";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import type { MatAutocompleteSelectedEvent } from "@angular/material/autocomplete";

// Services
import { PaymentsService } from "../../../services/payments/payments.service";
import { APIsService } from "../../../services/APIs/apis.service";

// Types
import type { MSG } from "../../../types/api-message.types";
import {
  BankStatus,
  type BankCoreDto,
  type BankCreateInput,
} from "../../../types/payments/bank-registry/banks/bank.types";

import {
  CountryCurrencyCard,
  CountryCurrencyMapper,
} from "../../../utils/country/country-currency.mapper";

import { ProgressBarComponent } from "../../../components/dialogs/progress-bar/progress-bar.component";
import { NotificationDialogComponent } from "../../../components/dialogs/notificationBar/notificationBar.component";

import type { PhoneNumber } from "../../../types/common";
import type { CountryCodesDto } from "../../../services/auth/user.contract";

// =============================================================================
// Form typing
// =============================================================================
type UpdateFormShape = {
  // Country autocomplete
  countryQuery: FormControl<string | CountryCurrencyCard>;
  countryCurrency: FormControl<CountryCurrencyCard | null>;
  countryCca2: FormControl<string>;

  name: FormControl<string>;
  bankCode: FormControl<string>;
  swiftBic: FormControl<string>;

  status: FormControl<BankStatus>;

  addressLine1: FormControl<string>;
  addressLine2: FormControl<string>;
  city: FormControl<string>;
  district: FormControl<string>;
  province: FormControl<string>;
  postalCode: FormControl<string>;

  // Phone split fields
  phoneCodeQuery: FormControl<string | CountryCodesDto>;
  phoneCodeSelected: FormControl<CountryCodesDto | null>;
  phoneNumberOnly: FormControl<string>;

  // Final phone object (set on submit)
  phone: FormControl<PhoneNumber | null>;

  supportedCurrencyCodes: FormControl<string[]>;
  notes: FormControl<string>;
};

@Component({
  selector: "app-banks-update",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,

    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatAutocompleteModule,

    NotificationDialogComponent,
    ProgressBarComponent,
  ],
  templateUrl: "./banks-update.component.html",
  styleUrls: ["./banks-update.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BanksUpdateComponent implements OnInit, OnDestroy {
  @ViewChild(ProgressBarComponent)
  public progressBar!: ProgressBarComponent;

  @ViewChild(NotificationDialogComponent)
  public notificationDialog!: NotificationDialogComponent;

  // Bank id from route
  private bankId = "";

  // ===========================================================================
  // Country/Currency
  // ===========================================================================
  protected allCurrencies: CountryCurrencyCard[] = [];
  protected filteredCountries$: Observable<CountryCurrencyCard[]> = of([]);

  // ===========================================================================
  // Phone code autocomplete
  // ===========================================================================
  protected allPhoneCodes: CountryCodesDto[] = [];
  protected filteredPhoneCodes$: Observable<CountryCodesDto[]> = of([]);

  // ===========================================================================
  // UI / State
  // ===========================================================================
  public loading = false;
  public error: string | null = null;

  public readonly form: FormGroup<UpdateFormShape>;
  public readonly default_status: BankStatus[] = [
    BankStatus.Active,
    BankStatus.Inactive,
  ];

  // ===========================================================================
  // Internals (race-free patching)
  // ===========================================================================
  private readonly destroy$ = new Subject<void>();

  private pendingBank: BankCoreDto | null = null;
  private countriesReady = false;
  private phoneReady = false;
  private hasPatchedInitial = false;

  // ===========================================================================
  // Constructor
  // ===========================================================================
  public constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly payments: PaymentsService,
    private readonly apiService: APIsService,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone
  ) {
    this.form = this.buildForm();
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  public ngOnInit(): void {
    this.loadCountries();
    this.loadPhoneCodes();

    // Route -> Load bank -> store DTO -> patch later (once lists ready)
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        map((pm) => (pm.get("bankId") ?? "").trim()),
        filter((id) => id.length > 0),
        tap((id) => (this.bankId = id)),
        tap(() => {
          this.uiPatch(() => {
            this.loading = true;
            this.error = null;
            this.progressBar?.start();
          });
        }),
        switchMap((id) =>
          this.payments.banks.getByBankId$(id).pipe(
            catchError((err: unknown) => {
              console.error(
                "[Error:] [BanksUpdateComponent:] loadBank failed.\n"
              );
              this.uiPatch(() => {
                this.loading = false;
                this.error = `[Error:] ${this.errMsg(err)}\n`;
                this.notificationDialog?.notification(
                  "error",
                  this.errMsg(err) ?? "Failed to load bank"
                );
                this.progressBar?.stop();
              });
              return of(null);
            })
          )
        )
      )
      .subscribe((msg: MSG | null) => {
        if (!msg) return;

        if (!msg.success) {
          this.uiPatch(() => {
            this.loading = false;
            this.error = msg.message ?? "[Error:] Failed to load bank.\n";
            this.progressBar?.stop();
          });
          return;
        }

        const bank = this.extractBankFromMsg(msg);
        if (!bank) {
          this.uiPatch(() => {
            this.loading = false;
            this.error = "[Error:] Bank payload missing in response.\n";
            this.progressBar?.stop();
          });
          return;
        }

        this.pendingBank = bank;
        this.tryPatchInitial();

        this.uiPatch(() => {
          this.loading = false;
          this.progressBar?.complete();
        });
      });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===========================================================================
  // UI patch helper (OnPush + Electron-safe)
  // ===========================================================================
  private uiPatch(mut: () => void): void {
    this.zone.run(() => {
      mut();
      this.cdr.markForCheck();
    });
  }

  // ===========================================================================
  // Load supporting lists
  // ===========================================================================
  private loadCountries(): void {
    from(this.apiService.getCountriesCurrencies())
      .pipe(
        takeUntil(this.destroy$),
        map((raw: unknown) => this.asArray(raw)),
        catchError((err: unknown) => {
          console.error(
            "[Error:] [BanksUpdateComponent:] loadCountries failed.\n"
          );
          this.uiPatch(() => {
            this.error = `[Error:] ${this.errMsg(err)}\n`;
          });
          return of([] as unknown[]);
        })
      )
      .subscribe((rawCountriesArr: unknown[]) => {
        this.allCurrencies = CountryCurrencyMapper.toCurrencyCards(rawCountriesArr);

        this.filteredCountries$ = this.form.controls.countryQuery.valueChanges.pipe(
          startWith(this.form.controls.countryQuery.value),
          map((v) => this.normalizeCountryQueryText(v)),
          map((q) => this.filterCountriesByText(q))
        );

        this.countriesReady = true;
        this.tryPatchInitial();
        this.uiPatch(() => {});
      });
  }

  private loadPhoneCodes(): void {
    from(this.apiService.getCountryCodes())
      .pipe(
        takeUntil(this.destroy$),
        catchError((err: unknown) => {
          console.error(
            "[Error:] [BanksUpdateComponent:] loadPhoneCodes failed.\n"
          );
          this.uiPatch(() => {
            this.notificationDialog?.notification(
              "error",
              this.errMsg(err) ?? "Failed to load phone codes"
            );
          });
          return of([] as CountryCodesDto[]);
        })
      )
      .subscribe((rows: CountryCodesDto[]) => {
        this.allPhoneCodes = Array.isArray(rows) ? rows : [];

        this.filteredPhoneCodes$ = this.form.controls.phoneCodeQuery.valueChanges.pipe(
          startWith(this.form.controls.phoneCodeQuery.value),
          map((v) => this.normalizePhoneCodeQueryText(v)),
          map((q) => this.filterPhoneCodesByText(q))
        );

        this.phoneReady = true;
        this.tryPatchInitial();
        this.uiPatch(() => {});
      });
  }

  // ===========================================================================
  // Patch only when ALL prerequisites are ready
  // ===========================================================================
  private tryPatchInitial(): void {
    if (this.hasPatchedInitial) return;
    if (!this.pendingBank) return;
    if (!this.countriesReady) return;
    if (!this.phoneReady) return;

    this.uiPatch(() => {
      this.patchFormFromBank(this.pendingBank as BankCoreDto);
      this.hasPatchedInitial = true;
    });
  }

  // ===========================================================================
  // Country autocomplete
  // ===========================================================================
  public displayCountryCard(value: string | CountryCurrencyCard): string {
    if (typeof value === "string") return value;
    return value?.name ?? "";
  }

  public onCountryOptionSelected(ev: MatAutocompleteSelectedEvent): void {
    const card = ev.option.value as CountryCurrencyCard | null;
    if (!card) return;

    const meta = this.resolveCountryCardMeta(card);
    if (!meta) {
      console.warn("[Warning:] Selected country card missing cca2/currency.\n");
      return;
    }

    this.uiPatch(() => {
      this.form.controls.countryCurrency.setValue(card);
      this.form.controls.countryQuery.setValue(card);
      this.form.controls.countryCca2.setValue(meta.cca2);

      // keep existing supported currencies if already selected; otherwise seed primary
      const current = this.form.controls.supportedCurrencyCodes.value;
      const next = Array.isArray(current) && current.length > 0 ? current : [meta.code];
      this.form.controls.supportedCurrencyCodes.setValue(next);
    });
  }

  public clearCountrySelection(): void {
    this.uiPatch(() => {
      this.form.controls.countryCurrency.setValue(null);
      this.form.controls.countryQuery.setValue("");
      this.form.controls.countryCca2.setValue("LK");
      this.form.controls.supportedCurrencyCodes.setValue(["LKR"]);
    });
  }

  // ===========================================================================
  // Phone code autocomplete
  // ===========================================================================
  public displayPhoneCode(value: string | CountryCodesDto): string {
    if (typeof value === "string") return value;
    const name = this.safeTrim(value?.name);
    const code = this.safeTrim(value?.code);
    return name && code ? `${name} (${code})` : name || code || "";
  }

  public onPhoneCodeSelected(ev: MatAutocompleteSelectedEvent): void {
    const codeDto = ev.option.value as CountryCodesDto | null;
    if (!codeDto) return;

    this.uiPatch(() => {
      this.form.controls.phoneCodeSelected.setValue(codeDto);
      this.form.controls.phoneCodeQuery.setValue(codeDto);
    });
  }

  public clearPhoneSelection(): void {
    this.uiPatch(() => {
      this.form.controls.phoneCodeSelected.setValue(null);
      this.form.controls.phoneCodeQuery.setValue("");
      this.form.controls.phoneNumberOnly.setValue("");
      this.form.controls.phone.setValue(null);
    });
  }

  // ===========================================================================
  // Submit update
  // ===========================================================================
  public submitUpdate(): void {
    this.hydratePhoneControlFromSplitInputs();

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.uiPatch(() => {
        this.error = "[Error:] Please fix validation errors.\n";
      });
      return;
    }

    const bankId = this.bankId.trim();
    if (!bankId) {
      this.uiPatch(() => {
        this.error = "[Error:] Missing bankId.\n";
      });
      return;
    }

    const patch = this.buildUpdatePayload();
    if (!patch) {
      this.uiPatch(() => {
        this.error = "[Error:] Invalid payload.\n";
      });
      return;
    }

    this.uiPatch(() => {
      this.loading = true;
      this.error = null;
      this.progressBar?.start();
    });

    this.payments.banks
      .update$(bankId, patch)
      .pipe(
        takeUntil(this.destroy$),
        catchError((err: unknown) => {
          console.error("[Error:] [BanksUpdateComponent:] update failed.\n");
          this.uiPatch(() => {
            this.loading = false;
            this.error = `[Error:] ${this.errMsg(err)}\n`;
            this.notificationDialog?.notification(
              "error",
              this.errMsg(err) ?? "Bank update failed!"
            );
            this.progressBar?.stop();
          });
          return of(null);
        })
      )
      .subscribe((msg: MSG | null) => {
        this.uiPatch(() => {
          this.loading = false;

          if (!msg) return;

          if (!msg.success) {
            this.error = msg.message ?? "[Error:] Bank update failed.\n";
            this.notificationDialog?.notification(
              "error",
              msg.message ?? "Bank update failed!"
            );
            this.progressBar?.stop();
            return;
          }

          const updated = this.extractBankFromMsg(msg);
          if (updated) {
            this.pendingBank = updated;
            // patch immediately now (lists already ready)
            this.patchFormFromBank(updated);
          }

          this.notificationDialog?.notification(
            "success",
            msg.message ?? "Bank updated!"
          );
          this.progressBar?.complete();
          setTimeout(()=> this.router.navigate(['/dashboard/payments/banks-list']), 1000)
        });
      });
  }

  public goBack(): void {
    void this.router.navigate(["/payments/banks"]);
  }

  // ===========================================================================
  // Form build + patch + payload build
  // ===========================================================================
  private buildForm(): FormGroup<UpdateFormShape> {
    const nn = this.fb.nonNullable;

    return nn.group({
      countryQuery: nn.control<string | CountryCurrencyCard>(""),
      countryCurrency: this.fb.control<CountryCurrencyCard | null>(null),

      countryCca2: nn.control("LK", {
        validators: [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)],
      }),

      name: nn.control("", {
        validators: [Validators.required, Validators.minLength(2)],
      }),
      bankCode: nn.control(""),
      swiftBic: nn.control(""),

      status: nn.control(BankStatus.Active, { validators: [Validators.required] }),

      addressLine1: nn.control("", {
        validators: [Validators.required, Validators.minLength(2)],
      }),
      addressLine2: nn.control(""),
      city: nn.control("", { validators: [Validators.required] }),
      district: nn.control("", { validators: [Validators.required] }),
      province: nn.control("", { validators: [Validators.required] }),
      postalCode: nn.control("", { validators: [Validators.required] }),

      phoneCodeQuery: nn.control<string | CountryCodesDto>(""),
      phoneCodeSelected: this.fb.control<CountryCodesDto | null>(null, {
        validators: [Validators.required],
      }),
      phoneNumberOnly: nn.control("", {
        validators: [Validators.required, Validators.minLength(5)],
      }),

      phone: this.fb.control<PhoneNumber | null>(null, {
        validators: [Validators.required],
      }),

      supportedCurrencyCodes: nn.control(["LKR"], { validators: [Validators.required] }),
      notes: nn.control(""),
    });
  }

  private patchFormFromBank(bank: BankCoreDto): void {
    const b = bank as unknown as Record<string, unknown>;

    // country
    const cca2 = this.safeUpper(b["countryCca2"]);
    const card =
      this.allCurrencies.find((x) => this.safeUpper(x.cca2) === cca2) ?? null;

    // supported currencies
    const supportedUnknown = b["supportedCurrencyCodes"];
    const supported =
      Array.isArray(supportedUnknown) && supportedUnknown.length > 0
        ? supportedUnknown.filter((x) => typeof x === "string") as string[]
        : ["LKR"];

    // phone (resolve by phone.code.code)
    const phone = (b["phone"] ?? null) as PhoneNumber | null;
    const codeStr = this.safeTrim(phone?.code?.code ?? "");
    const numberOnly = this.safeTrim(phone?.number ?? "");

    const selected = codeStr
      ? this.allPhoneCodes.find((p) => this.safeTrim(p.code) === codeStr) ?? null
      : null;


    // patch core fields
    this.form.patchValue({
      // country controls
      countryCurrency: card,
      countryQuery: card ?? "",
      countryCca2: card?.cca2 ?? (cca2 || "LK"),

      name: this.safeTrim(b["name"]),
      bankCode: this.safeTrim(b["bankCode"] ?? ""),
      swiftBic: this.safeTrim(b["swiftBic"] ?? ""),
      status: ((b["status"] ?? BankStatus.Active) as BankStatus),

      addressLine1: this.safeTrim(b["addressLine1"]),
      addressLine2: this.safeTrim(b["addressLine2"] ?? ""),
      city: this.safeTrim(b["city"]),
      district: this.safeTrim(b["district"]),
      province: this.safeTrim(b["province"]),
      postalCode: this.safeTrim(b["postalCode"]),

      supportedCurrencyCodes: supported,
      notes: this.safeTrim(b["notes"] ?? ""),

      phoneCodeSelected: selected,
      phoneCodeQuery: selected ?? (codeStr ? codeStr : ""),
      phoneNumberOnly: numberOnly,
      phone: phone ? phone : null,
    });

    // enforce object display for displayWith
    if (card) this.form.controls.countryQuery.setValue(card);
    if (selected) this.form.controls.phoneCodeQuery.setValue(selected);
  }

  private buildUpdatePayload(): BankCreateInput | null {
    const name = this.safeTrim(this.form.controls.name.value);
    const cca2 = this.safeUpper(this.form.controls.countryCca2.value);

    if (!name) return null;
    if (!cca2 || cca2.length !== 2) return null;

    const supportedCurrencyCodes = this.optStrArray(this.form.controls.supportedCurrencyCodes.value);
    if (supportedCurrencyCodes.length === 0) return null;

    const status = this.form.controls.status.value;

    const addressLine1 = this.safeTrim(this.form.controls.addressLine1.value);
    const addressLine2Raw = this.safeTrim(this.form.controls.addressLine2.value);
    const city = this.safeTrim(this.form.controls.city.value);
    const district = this.safeTrim(this.form.controls.district.value);
    const province = this.safeTrim(this.form.controls.province.value);
    const postalCode = this.safeTrim(this.form.controls.postalCode.value);

    const phone = this.form.controls.phone.value;
    if (!phone) return null;

    const bankCode = this.safeTrim(this.form.controls.bankCode.value);
    const swiftBic = this.safeTrim(this.form.controls.swiftBic.value);
    const notes = this.safeTrim(this.form.controls.notes.value);

    const base: BankCreateInput = {
      name,
      countryCca2: cca2,
      supportedCurrencyCodes,
      status,

      addressLine1,
      city,
      district,
      province,
      postalCode,
      phone,
    };

    return {
      ...base,
      ...(addressLine2Raw ? { addressLine2: addressLine2Raw } : {}),
      ...(bankCode ? { bankCode } : {}),
      ...(swiftBic ? { swiftBic } : {}),
      ...(notes ? { notes } : {}),
    };
  }

  // ===========================================================================
  // Envelope extraction (canonical)
  // ===========================================================================
  private extractBankFromMsg(msg: MSG): BankCoreDto | null {
    const dataRec = this.asRecord((msg as unknown as { data?: unknown }).data);
    if (!dataRec) return null;

    const systemRec = this.asRecord(dataRec["system"]);
    if (systemRec && typeof systemRec["bank"] === "object" && systemRec["bank"]) {
      return systemRec["bank"] as BankCoreDto;
    }

    // fallback shapes (older)
    if (typeof dataRec["bank"] === "object" && dataRec["bank"]) {
      return dataRec["bank"] as BankCoreDto;
    }

    const otherRec = this.asRecord(dataRec["other"]);
    if (otherRec && typeof otherRec["bank"] === "object" && otherRec["bank"]) {
      return otherRec["bank"] as BankCoreDto;
    }

    return null;
  }

  // ===========================================================================
  // Phone hydrate
  // ===========================================================================
  private hydratePhoneControlFromSplitInputs(): void {
    const selected = this.form.controls.phoneCodeSelected.value;

    const typed = this.form.controls.phoneCodeQuery.value;
    const typedDto = this.asCountryCodesDto(typed);

    const best = selected ?? typedDto;
    const numberOnly = this.safeTrim(this.form.controls.phoneNumberOnly.value);

    const phone = this.buildPhoneNumber(best, numberOnly);
    this.form.controls.phone.setValue(phone);
  }

  private buildPhoneNumber(
    codeDto: CountryCodesDto | null,
    numberOnly: string
  ): PhoneNumber | null {
    const num = this.safeTrim(numberOnly);
    if (!num) return null;

    const dto = codeDto;
    if (!dto) return null;

    const name = this.safeTrim(dto.name);
    const code = this.safeTrim(dto.code);

    const flagsRec = this.asRecord(dto.flags);
    const png = this.safeTrim(flagsRec?.["png"]);
    const svg = this.safeTrim(flagsRec?.["svg"]);
    const alt = this.safeTrim(flagsRec?.["alt"]);

    if (!name || !code) return null;
    if (!png || !svg) return null;

    const flags = alt ? { png, svg, alt } : { png, svg };

    return {
      code: { name, code, flags },
      number: num,
    };
  }

  // ===========================================================================
  // Filter helpers
  // ===========================================================================
  private normalizeCountryQueryText(
    value: string | CountryCurrencyCard
  ): string {
    if (typeof value === "string") return value.trim();
    return (value?.name ?? "").trim();
  }

  private filterCountriesByText(text: string): CountryCurrencyCard[] {
    const q = (text || "").trim().toLowerCase();
    if (!q) return [...this.allCurrencies];

    return this.allCurrencies.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const currency = (c.currency || "").toLowerCase();
      const cca2 = (c.cca2 || "").toLowerCase();
      return name.includes(q) || currency.includes(q) || cca2.includes(q);
    });
  }

  private resolveCountryCardMeta(
    card: CountryCurrencyCard
  ): { cca2: string; code: string } | null {
    const cca2 = this.safeUpper(card.cca2 ?? "");
    const code = this.safeUpper(card.currency ?? "");
    if (!cca2 || cca2.length !== 2) return null;
    if (!code) return null;
    return { cca2, code };
  }

  private normalizePhoneCodeQueryText(value: string | CountryCodesDto): string {
    if (typeof value === "string") return value.trim();
    const name = this.safeTrim(value?.name);
    const code = this.safeTrim(value?.code);
    return `${name} ${code}`.trim();
  }

  private filterPhoneCodesByText(text: string): CountryCodesDto[] {
    const q = (text || "").trim().toLowerCase();
    if (!q) return [...this.allPhoneCodes];

    return this.allPhoneCodes.filter((c) => {
      const name = (c?.name ?? "").toLowerCase();
      const code = (c?.code ?? "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }

  private asCountryCodesDto(v: unknown): CountryCodesDto | null {
    if (!v || typeof v !== "object") return null;
    const rec = v as Record<string, unknown>;
    const name = this.safeTrim(rec["name"]);
    const code = this.safeTrim(rec["code"]);
    const flags = rec["flags"];
    if (!name || !code) return null;
    if (!flags || typeof flags !== "object") return null;
    return v as CountryCodesDto;
  }

  // ===========================================================================
  // Safe helpers
  // ===========================================================================
  private asArray(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
  }

  private asRecord(v: unknown): Record<string, unknown> | null {
    if (!v || typeof v !== "object") return null;
    return v as Record<string, unknown>;
  }

  private safeTrim(v: unknown): string {
    if (typeof v !== "string") return "";
    return v.trim();
  }

  private safeUpper(v: unknown): string {
    if (typeof v !== "string") return "";
    return v.trim().toUpperCase();
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

  private optStrArray(arg: unknown): string[] {
    if (!Array.isArray(arg) || arg.length === 0) return [];

    const out: string[] = [];
    const seen = new Set<string>();

    for (const raw of arg) {
      if (typeof raw !== "string") continue;

      const cleaned = this.cleanPlainText(raw);
      if (!cleaned) continue;

      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      out.push(cleaned);

      if (out.length >= 200) break;
    }

    return out;
  }

  private cleanPlainText(input: string): string {
    let s = input.trim();
    if (!s) return "";

    s = s.replace(/<[^>]*>/g, " ");

    s = s
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");

    s = s.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
    s = s.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g, "");

    try {
      s = s.replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, "");
    } catch {
      s = s.replace(
        /[^A-Za-z0-9\s.,:;!?'"()\-_/\\[\]{}@#&+*=<>|]/g,
        ""
      );
    }

    s = s.replace(/\s+/g, " ").trim();
    if (s.length > 300) s = s.slice(0, 300).trim();

    return s;
  }
}
