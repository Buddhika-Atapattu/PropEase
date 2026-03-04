// Path: src/app/pages/payments/banks-item/banks-item.component.ts
import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  Inject,
  PLATFORM_ID,
} from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";

import { Subject, of } from "rxjs";
import { catchError, takeUntil } from "rxjs/operators";

// Material
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatChipsModule } from "@angular/material/chips";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatDividerModule } from "@angular/material/divider";

// App UI
import { ProgressBarComponent } from "../../../components/dialogs/progress-bar/progress-bar.component";
import { NotificationDialogComponent } from "../../../components/dialogs/notificationBar/notificationBar.component";

// Services
import { PaymentsService } from "../../../services/payments/payments.service";

// Types
import type { MSG } from "../../../types/api-message.types";
import type { BankCoreDto } from "../../../types/payments/bank-registry/banks/bank.types";

type BankViewModel = {
  bankId: string;
  name: string;
  status: string;

  countryCca2: string;
  bankCode: string;
  swiftBic: string;
  supportedCurrencyCodes: string[];

  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  province: string;
  postalCode: string;

  phoneDisplay: string;

  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

@Component({
  selector: "app-banks-item",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,

    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,

    NotificationDialogComponent,
    ProgressBarComponent,
  ],
  templateUrl: "./banks-item.component.html",
  styleUrls: ["./banks-item.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BanksItemComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(ProgressBarComponent) public progressBar!: ProgressBarComponent;
  @ViewChild(NotificationDialogComponent)
  public notificationDialog!: NotificationDialogComponent;

  public loading = false;
  public error: string | null = null;

  public bankId = "";
  public bank: BankViewModel | null = null;

  private readonly destroy$ = new Subject<void>();
  private readonly isBrowser: boolean;

  public constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly payments: PaymentsService,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  public ngOnInit(): void {
    this.bankId = this.safeTrim(this.route.snapshot.paramMap.get("bankId"));
    if (!this.bankId) {
      this.uiPatch(() => {
        this.error = "[Error:] Missing bankId in route.\n";
      });
      return;
    }
  }

  /**
   * Load AFTER view init so ProgressBar ViewChild exists on first paint.
   */
  public ngAfterViewInit(): void {
    if (!this.bankId) return;
    this.loadBank(this.bankId);
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =============================================================================
  // Actions
  // =============================================================================
  public back(): void {
    void this.router.navigate(["/dashboard/payments/banks-list"]);
  }

  public edit(): void {
    void this.router.navigate(["/dashboard/payments/banks-update", this.bankId]);
  }

  public delete(): void {
    if (!this.bankId || !this.bank) return;

    // SSR/Electron-safe guard
    const ok = this.isBrowser
      ? window.confirm(`Delete bank "${this.bank.name}"? This cannot be undone.`)
      : false;

    if (!ok) return;

    this.uiPatch(() => {
      this.loading = true;
      this.error = null;
      this.progressBar?.start();
    });

    this.payments.banks
      .delete$(this.bankId)
      .pipe(
        takeUntil(this.destroy$),
        catchError((err: unknown) => {
          this.uiPatch(() => {
            this.loading = false;
            this.error = `[Error:] ${this.errMsg(err)}\n`;
            this.notificationDialog?.notification(
              "error",
              this.errMsg(err) ?? "Delete failed"
            );
            this.progressBar?.stop();
          });
          return of(null);
        })
      )
      .subscribe((msg: MSG | null) => {
        this.uiPatch(() => {
          this.loading = false;

          if (!msg?.success) {
            this.error = msg?.message ?? "[Error:] Delete failed.\n";
            this.notificationDialog?.notification(
              "error",
              msg?.message ?? "Delete failed"
            );
            this.progressBar?.stop();
            return;
          }

          this.notificationDialog?.notification(
            "success",
            msg.message ?? "Deleted"
          );
          this.progressBar?.complete();
          this.back();
        });
      });
  }

  public refresh(): void {
    if (!this.bankId) return;
    this.loadBank(this.bankId);
  }

  // =============================================================================
  // Load
  // =============================================================================
  private loadBank(bankId: string): void {
    this.uiPatch(() => {
      this.loading = true;
      this.error = null;
      this.bank = null; // force skeleton branch deterministically
    });

    this.payments.banks
      .getByBankId$(bankId)
      .pipe(
        takeUntil(this.destroy$),
        catchError((err: unknown) => {
          this.uiPatch(() => {
            this.loading = false;
            this.error = `[Error:] ${this.errMsg(err)}\n`;
            this.notificationDialog?.notification(
              "error",
              this.errMsg(err) ?? "Failed to load bank"
            );
          });
          return of(null);
        })
      )
      .subscribe((msg: MSG | null) => {
        this.uiPatch(() => {
          this.loading = false;

          if (!msg?.success) {
            this.error = msg?.message ?? "[Error:] Failed to load bank.\n";
            this.progressBar?.stop();
            return;
          }

          const dto = this.extractBankDtoRobust(msg);
          if (!dto) {
            this.error = "[Error:] Bank payload not found in response.\n";
            return;
          }

          this.bank = this.toViewModel(dto);
        });
      });
  }

  /**
   * Runs state updates inside Angular zone + triggers OnPush refresh.
   */
  private uiPatch(mut: () => void): void {
    this.zone.run(() => {
      mut();
      this.cdr.markForCheck();
    });
  }

  // =============================================================================
  // Envelope extraction
  // =============================================================================
  private extractBankDtoRobust(msg: MSG): BankCoreDto | null {
    const dataRec = this.asRecord(msg.data);
    if (!dataRec) return null;

    const systemRec = this.asRecord(dataRec["system"]);
    const otherRec = this.asRecord(dataRec["other"]);

    const sysBank = systemRec ? systemRec["bank"] : null;
    const bank1 = this.asBankCoreDto(sysBank);
    if (bank1) return bank1;

    const sysBanks = systemRec ? systemRec["banks"] : null;
    const bank2 = this.firstBankFromUnknownArray(sysBanks);
    if (bank2) return bank2;

    const otherBank = otherRec ? otherRec["bank"] : null;
    const bank3 = this.asBankCoreDto(otherBank);
    if (bank3) return bank3;

    const otherResult = otherRec ? this.asRecord(otherRec["result"]) : null;
    const bank4 = this.asBankCoreDto(otherResult ? otherResult["bank"] : null);
    if (bank4) return bank4;

    const items = otherResult ? otherResult["items"] : null;
    const bank5 = this.firstBankFromUnknownArray(items);
    if (bank5) return bank5;

    return null;
  }

  private firstBankFromUnknownArray(v: unknown): BankCoreDto | null {
    if (!Array.isArray(v) || v.length === 0) return null;
    return this.asBankCoreDto(v[0]);
  }

  private asBankCoreDto(v: unknown): BankCoreDto | null {
    const rec = this.asRecord(v);
    if (!rec) return null;

    const bankId = this.safeTrim(rec["bankId"]);
    const name = this.safeTrim(rec["name"]);
    if (!bankId || !name) return null;

    return v as BankCoreDto;
  }

  private toViewModel(dto: BankCoreDto): BankViewModel {
    const supported = Array.isArray(dto.supportedCurrencyCodes)
      ? dto.supportedCurrencyCodes
      : [];

    const bankCode = this.safeTrim(dto.bankCode);
    const swiftBic = this.safeTrim(dto.swiftBic);

    const createdBy = this.actorToText(dto.createdBy);
    const updatedBy = dto.updatedBy ? this.actorToText(dto.updatedBy) : "-";

    const phoneDisplay = this.formatPhone(dto.phone);

    return {
      bankId: dto.bankId,
      name: dto.name,
      status: String(dto.status),

      countryCca2: String(dto.countryCca2),
      bankCode: bankCode || "-",
      swiftBic: swiftBic || "-",
      supportedCurrencyCodes: supported,

      addressLine1: dto.addressLine1,
      addressLine2: this.safeTrim(dto.addressLine2) || "-",
      city: dto.city,
      district: dto.district,
      province: dto.province,
      postalCode: dto.postalCode,

      phoneDisplay,

      createdAt: this.formatDate(dto.createdAt),
      updatedAt: this.formatDate(dto.updatedAt),
      createdBy,
      updatedBy,
    };
  }

  private actorToText(v: unknown): string {
    const rec = this.asRecord(v);
    if (!rec) return "-";

    const username = this.safeTrim(rec["username"]);
    if (username) return username;

    const name = this.safeTrim(rec["name"]);
    if (name) return name;

    const userId = this.safeTrim(rec["userId"]);
    if (userId) return userId;

    return "-";
  }

  private formatPhone(v: unknown): string {
    const rec = this.asRecord(v);
    if (!rec) return "-";

    const codeObj = this.asRecord(rec["code"]);
    const code = codeObj ? this.safeTrim(codeObj["code"]) : "";
    const number = this.safeTrim(rec["number"]);

    if (!code && !number) return "-";
    return `${code} ${number}`.trim();
  }

  private formatDate(v: unknown): string {
    const s = this.safeTrim(v);
    if (!s) return "-";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString();
  }

  // =============================================================================
  // Safe utils
  // =============================================================================
  private safeTrim(v: unknown): string {
    return typeof v === "string" ? v.trim() : "";
  }

  private asRecord(v: unknown): Record<string, unknown> | null {
    if (!v || typeof v !== "object") return null;
    return v as Record<string, unknown>;
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
