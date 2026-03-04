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
import { ActivatedRoute, Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { Observable, Subject, of } from "rxjs";
import { map, startWith, takeUntil } from "rxjs/operators";

// Angular Material
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import type { MatAutocompleteSelectedEvent } from "@angular/material/autocomplete";
import { MatDatepickerModule } from "@angular/material/datepicker";

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

// Country mapper
import {
  CountryCurrencyCard,
  CountryCurrencyMapper,
} from "../../../utils/country/country-currency.mapper";

type UpdateFormShape = {
  countryQuery: FormControl<string | CountryCurrencyCard>;
  countryCurrency: FormControl<CountryCurrencyCard | null>;

  currencyCode: FormControl<string>;
  amount: FormControl<number>;
  method: FormControl<PaymentTransactionCreateInputDto["method"]>;

  bankAccountAlias: FormControl<string>;
  externalRef: FormControl<string>;
  notes: FormControl<string>;

  transactionAt: FormControl<Date | null>;
};

type TxReadDto = {
  _id: string;
  amount: number;
  currencyCode: string;
  method: PaymentTransactionCreateInputDto["method"];
  bankAccountAlias?: string;
  externalRef?: string;
  notes?: string;
  transactionAt?: string; // ISO from backend
};

@Component({
  selector: "app-update-transactions",
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

    NotificationDialogComponent,
    ProgressBarComponent,
    Dropdown,
  ],
  templateUrl: "./update-transactions.component.html",
  styleUrl: "./update-transactions.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsUpdateTransactionsComponent implements OnInit, OnDestroy {
  @ViewChild(ProgressBarComponent)
  public progressBar?: ProgressBarComponent;

  @ViewChild(NotificationDialogComponent)
  public notificationDialog?: NotificationDialogComponent;

  public loading = false;

  public evidence: File[] = [];
  public transactionId = "";

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

  public readonly form: FormGroup<UpdateFormShape>;

  private readonly destroy$ = new Subject<void>();

  public constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly fb: FormBuilder,

    private readonly paymentService: PaymentsService,
    private readonly authService: AuthService,
    private readonly apiService: APIsService,
  ) {
    this.form = this.fb.group<UpdateFormShape>({
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

  public async ngOnInit(): Promise<void> {
    void this.authService;

    this.transactionId = this.route.snapshot.paramMap.get("transactionId") ?? "";
    this.safeInfo(`[Info:] UpdateTransactions init | id=${this.transactionId}\n`);

    if (!this.transactionId) {
      this.safeNotifyError("[Error:] Missing transactionId in route.\n");
      void this.router.navigate(["/dashboard/payments/transactions-list"]);
      return;
    }

    await this.loadCountries();
    this.bindAutocomplete();

    // IMPORTANT: initial load alignment
    this.loadOneAndPatch();
    this.bindFormDebug();
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===========================================================================
  // UI Actions
  // ===========================================================================
  public backToOverview(): void {
    this.safeInfo("[Info:] navigate back to payments overview\n");
    void this.router.navigate(["/dashboard/payments/transactions-list"]);
  }

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
      `[Info:] Country selected: ${card.name} | currency=${card.currency}\n`,
    );
  }

  public clearCountrySelection(): void {
    this.form.controls.countryCurrency.setValue(null);
    this.form.controls.countryQuery.setValue("");
    this.safeInfo("[Info:] Country selection cleared\n");
  }

  public filesChange(files: File[]): void {
    if (!Array.isArray(files) || files.length === 0) return;

    const merged = [...this.evidence];
    for (const f of files) {
      if (!this.isValidEvidenceFile(f)) continue;
      const exists = merged.some((m) => this.fileKey(m) === this.fileKey(f));
      if (!exists) merged.push(f);
    }
    this.evidence = merged;

    this.safeInfo(`[Info:] Evidence updated total=${this.evidence.length}\n`);
  }

  public removeEvidenceAt(i: number): void {
    if (i < 0 || i >= this.evidence.length) return;
    const next = [...this.evidence];
    next.splice(i, 1);
    this.evidence = next;
    this.safeInfo(`[Info:] Evidence removed index=${i} total=${this.evidence.length}\n`);
  }

  public clearEvidence(): void {
    this.evidence = [];
    this.safeInfo("[Info:] Evidence cleared\n");
  }

  // ===========================================================================
  // Load + Patch (alignment core)
  // ===========================================================================
  private loadOneAndPatch(): void {
    this.safeProgressStart();

    // NOTE:
    // Align this call to your service:
    // Example expected: paymentService.transactions.getOne$(transactionId)
    // <-- align to your service
    const read$ = this.paymentService.transactions.getByTransactionId$(this.transactionId);

    read$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (msg) => {
        const dto = this.extractTxDto(msg);

        this.safeInfo(`[Info:] loadOne success raw=${this.safeJson(msg)}\n`);

        if (!dto) {
          this.safeProgressError();
          this.safeNotifyError("[Error:] Transaction payload not found in response.\n");
          return;
        }

        this.patchFormFromDto(dto);
        this.safeProgressSuccess();
        this.safeNotifySuccess("[Success:] Transaction loaded.\n");
      },
      error: (err: unknown) => {
        this.safeError(`[Error:] loadOne failed. ${this.errMsg(err)}\n`);
        this.safeProgressError();
        this.safeNotifyError(`[Error:] Failed to load transaction. ${this.errMsg(err)}\n`);
      },
    });
  }

  private patchFormFromDto(dto: TxReadDto): void {
    // KEY: Patch as a single atomic patch -> prevents “partial UI”
    const txAt = this.isoToDate(dto.transactionAt ?? "");

    this.form.patchValue(
      {
        currencyCode: dto.currencyCode ?? "LKR",
        amount: Number.isFinite(dto.amount) ? dto.amount : 0,
        method: dto.method ?? PaymentMethodKind.BankTransfer,
        bankAccountAlias: (dto.bankAccountAlias ?? "").trim(),
        externalRef: (dto.externalRef ?? "").trim(),
        notes: (dto.notes ?? "").trim(),
        transactionAt: txAt,
      },
      { emitEvent: false }, // IMPORTANT: prevents debug stream spamming before UI settles
    );

    // countryQuery alignment (best effort): match currency to a country card
    const match = this.allCurencies.find((c) => c.currency === dto.currencyCode);
    if (match) {
      this.form.controls.countryCurrency.setValue(match);
      this.form.controls.countryQuery.setValue(match);
    } else {
      // keep query empty so user can search, but currency is filled
      this.form.controls.countryCurrency.setValue(null);
      this.form.controls.countryQuery.setValue("");
    }

    this.safeInfo(
      `[Info:] patchFormFromDto done | txAt=${txAt ? txAt.toISOString() : "(null)"} | matchCountry=${match ? match.name : "(none)"}\n`,
    );
  }

  // ===========================================================================
  // Update submit
  // ===========================================================================
  public submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.safeNotifyError("[Error:] Please fix validation errors.\n");
      return;
    }

    const payload = this.buildUpdatePayload();
    if (!payload) {
      this.safeNotifyError("[Error:] Invalid payload. Check your inputs.\n");
      return;
    }

    this.safeInfo(`[Info:] update payload=${this.safeJson(payload)}\n`);
    this.safeInfo(`[Info:] update evidence count=${this.evidence.length}\n`);

    this.safeProgressStart();

    // NOTE:
    // Align this call to your service:
    // Example expected: paymentService.transactions.update$(transactionId, payload, evidence?)
    // <-- align to your service
    const update$ = this.paymentService.transactions.update$(this.transactionId, payload)

    update$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (msg) => {
        this.safeInfo(`[Info:] update success raw=${this.safeJson(msg)}\n`);
        this.safeProgressSuccess();
        this.safeNotifySuccess("[Success:] Transaction updated successfully.\n");
        void this.router.navigate(["/dashboard/payments/transactions-list"]);
      },
      error: (err: unknown) => {
        this.safeError(`[Error:] update failed. ${this.errMsg(err)}\n`);
        this.safeProgressError();
        this.safeNotifyError(`[Error:] Failed to update. ${this.errMsg(err)}\n`);
      },
    });
  }

  private buildUpdatePayload(): PaymentTransactionCreateInputDto | null {
    const currencyCode = this.form.controls.currencyCode.value.trim();
    const amount = this.form.controls.amount.value;
    const method = this.form.controls.method.value;

    if (!currencyCode) return null;
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const bankAccountAlias = this.form.controls.bankAccountAlias.value.trim();
    const externalRef = this.form.controls.externalRef.value.trim();
    const notes = this.form.controls.notes.value.trim();
    const transactionAt = this.toIsoOrEmpty(this.form.controls.transactionAt.value);

    if (
      method === PaymentMethodKind.BankTransfer ||
      method === PaymentMethodKind.Cheque
    ) {
      if (!bankAccountAlias) {
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

  // ===========================================================================
  // Countries + Autocomplete
  // ===========================================================================
  private async loadCountries(): Promise<void> {
    try {
      const rawCountries = await this.apiService.getCountriesCurrencies();
      this.allCurencies = CountryCurrencyMapper.toCurrencyCards(rawCountries);
      this.safeInfo(`[Info:] Countries loaded: ${this.allCurencies.length}\n`);
    } catch (err) {
      this.safeError(`[Error:] Countries load failed. ${this.errMsg(err)}\n`);
      this.safeNotifyError("[Error:] Failed to load countries.\n");
    }
  }

  private bindAutocomplete(): void {
    this.filteredCountries$ = this.form.controls.countryQuery.valueChanges.pipe(
      startWith(this.form.controls.countryQuery.value),
      map((v) => this.normalizeQueryText(v)),
      map((q) => this.filterCountriesByText(q)),
    );
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

  // ===========================================================================
  // Extraction helpers (msg envelope tolerant)
  // ===========================================================================
  private extractTxDto(msg: unknown): TxReadDto | null {
    // Supports either:
    // - msg.data.system.transaction
    // - msg.data.system.transactions[0]
    // - msg.data.other.transaction
    // - direct dto
    if (!msg || typeof msg !== "object") return null;

    const root = msg as Record<string, unknown>;

    // direct dto
    if (typeof root["_id"] === "string" && typeof root["currencyCode"] === "string") {
      return root as unknown as TxReadDto;
    }

    const data = root["data"];
    if (!data || typeof data !== "object") return null;

    const dataObj = data as Record<string, unknown>;
    const system = dataObj["system"];
    const other = dataObj["other"];

    const sysObj = system && typeof system === "object" ? (system as Record<string, unknown>) : null;
    const othObj = other && typeof other === "object" ? (other as Record<string, unknown>) : null;

    const txFromSystem = sysObj?.["transaction"];
    if (txFromSystem && typeof txFromSystem === "object") return txFromSystem as TxReadDto;

    const listFromSystem = sysObj?.["transactions"];
    if (Array.isArray(listFromSystem) && listFromSystem[0] && typeof listFromSystem[0] === "object") {
      return listFromSystem[0] as TxReadDto;
    }

    const txFromOther = othObj?.["transaction"];
    if (txFromOther && typeof txFromOther === "object") return txFromOther as TxReadDto;

    return null;
  }

  // ===========================================================================
  // Date + Files
  // ===========================================================================
  private isoToDate(iso: string): Date | null {
    const raw = (iso || "").trim();
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d;
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
  // Debug bindings
  // ===========================================================================
  private bindFormDebug(): void {
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      const method = this.form.controls.method.value;
      const bankAccountAlias = this.form.controls.bankAccountAlias.value;
      const amount = this.form.controls.amount.value;
      const currencyCode = this.form.controls.currencyCode.value;
      const txAt = this.form.controls.transactionAt.value;

      this.safeInfo(
        `[Info:] form change | method=${method} | bankAccountAlias=${bankAccountAlias} | amount=${amount} | currency=${currencyCode} | transactionAt=${txAt ? txAt.toISOString() : "(null)"}\n`,
      );
    });
  }

  // ===========================================================================
  // Progress + Notification wrappers
  // ===========================================================================
  private safeProgressStart(): void {
    this.loading = true;
    const pb = this.progressBar as unknown as { start?: () => void; show?: () => void; open?: () => void } | undefined;

    this.safeInfo("[Info:] progress start\n");
    if (pb?.start) pb.start();
    else if (pb?.show) pb.show();
    else if (pb?.open) pb.open();
  }

  private safeProgressSuccess(): void {
    this.loading = false;
    const pb = this.progressBar as unknown as { complete?: () => void; hide?: () => void; close?: () => void } | undefined;

    this.safeInfo("[Info:] progress success\n");
    if (pb?.complete) pb.complete();
    else if (pb?.hide) pb.hide();
    else if (pb?.close) pb.close();
  }

  private safeProgressError(): void {
    this.loading = false;
    const pb = this.progressBar as unknown as { stop?: () => void; hide?: () => void; close?: () => void } | undefined;

    this.safeInfo("[Info:] progress error\n");
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

  private safeError(msg: string): void {
    // eslint-disable-next-line no-console
    console.error(msg.endsWith("\n") ? msg : msg + "\n");
  }
}
