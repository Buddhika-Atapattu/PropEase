// Path: src/app/services/payments/transactions/payment-transaction.rest.service.ts
// =============================================================================
// PaymentTransactionRestService (FE) — CONTRACT-CORRECT
// -----------------------------------------------------------------------------
// Backend routes (as per your PaymentRouter):
// - POST   /api-payments/transactions/create
// - GET    /api-payments/transactions
// - GET    /api-payments/transactions/count
// - POST   /api-payments/transactions/evidence/upload/:transactionId
// - GET    /api-payments/transactions/:transactionId
// - PUT    /api-payments/transactions/:transactionId
// - DELETE /api-payments/transactions/:transactionId
// - POST   /api-payments/transactions/:transactionId/approve
// - POST   /api-payments/transactions/:transactionId/reject
//
// IMPORTANT FE RULE:
// - create/update/evidence upload MUST be multipart/form-data
//   - payload: JSON string
//   - evidence: multiple files (same field name)
// =============================================================================

import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { catchError, map } from "rxjs/operators";

import { environment } from "../../../../environments/environment";
import type { MSG } from "../../../types/api-message.types";

import type {
  PaymentTransactionApproveInputDto,
  PaymentTransactionCreateInputDto,
  PaymentTransactionListFilters,
  PaymentTransactionPaymentStatusInputDto,
  PaymentTransactionRejectInputDto,
  PaymentTransactionUpdateInputDto,
} from "../../../types/payments/transactions/payment-transaction.types";

@Injectable({ providedIn: "root" })
export class PaymentTransactionRestService {
  private readonly base = `${environment.apiOrigin}/api-payments`;

  private static readonly PAYLOAD_FIELD = "payload";
  private static readonly EVIDENCE_FIELD = "evidence";

  public constructor(private readonly http: HttpClient) {}

  // ===========================================================================
  // CREATE (multipart/form-data)
  // ===========================================================================

  public create$(
    input: PaymentTransactionCreateInputDto,
    evidenceFiles?: ReadonlyArray<File> | null,
  ): Observable<MSG> {
    const url = this.join(this.base, "transactions", "create");

    const fd = this.toMultipartPayload({
      payload: input,
      includeEmptyPayload: true,
      evidenceFiles,
    });

    return this.http.post<MSG>(url, fd);
  }

  // ===========================================================================
  // LIST / COUNT (query)
  // ===========================================================================

  public list$(options: {
    page: number;
    limit: number;
    filters?: Omit<PaymentTransactionListFilters, "companyId">; // companyId comes from auth (backend)
  }): Observable<MSG> {
    const url = this.join(this.base, "transactions");

    const params = this.toParams({
      page: options.page,
      limit: options.limit,
      ...(options.filters ?? {}),
    });

    return this.http.get<MSG>(url, { params });
  }

  public count$(
    filters?: Omit<PaymentTransactionListFilters, "companyId">,
  ): Observable<MSG> {
    const url = this.join(this.base, "transactions", "count");
    const params = this.toParams(filters ?? {});
    return this.http.get<MSG>(url, { params });
  }

  // ===========================================================================
  // READ ONE
  // ===========================================================================

  public getByTransactionId$(transactionId: string): Observable<MSG> {
    const id = this.mustText(transactionId, "transactionId");
    const url = this.join(this.base, "transactions", encodeURIComponent(id));
    return this.http.get<MSG>(url);
  }

  // ===========================================================================
  // UPDATE (multipart/form-data)
  // ===========================================================================

  public update$(
    transactionId: string,
    patch: PaymentTransactionUpdateInputDto,
    evidenceFiles?: ReadonlyArray<File> | null,
  ): Observable<MSG> {
    const id = this.mustText(transactionId, "transactionId");
    const url = this.join(this.base, "transactions", encodeURIComponent(id));

    // Important:
    // - undefined fields must be omitted from payload (PATCH semantics)
    // - empty string "" is allowed (backend can interpret as UNSET for optional strings)
    const cleanedPatch = this.omitUndefined(patch);

    const fd = this.toMultipartPayload({
      payload: cleanedPatch,
      includeEmptyPayload: true,
      evidenceFiles,
    });

    return this.http.put<MSG>(url, fd);
  }

  // ===========================================================================
  // EVIDENCE UPLOAD ONLY (multipart/form-data)
  // ===========================================================================

  public uploadEvidence$(
    transactionId: string,
    evidenceFiles: ReadonlyArray<File>,
  ): Observable<MSG> {
    const id = this.mustText(transactionId, "transactionId");
    const url = this.join(
      this.base,
      "transactions",
      "evidence",
      "upload",
      encodeURIComponent(id),
    );

    const fd = new FormData();

    // Evidence files (multiple)
    for (const f of evidenceFiles ?? []) {
      if (f instanceof File) {
        fd.append(PaymentTransactionRestService.EVIDENCE_FIELD, f, f.name);
      }
    }

    // Some backends require payload always; yours DOES NOT for evidence-only.
    // So we do NOT append payload here.

    return this.http.post<MSG>(url, fd);
  }

  // ===========================================================================
  // APPROVE / REJECT (JSON)
  // ===========================================================================

  public approve$(
    transactionId: string,
    input?: PaymentTransactionApproveInputDto,
  ): Observable<MSG> {
    const id = this.mustText(transactionId, "transactionId");
    const url = this.join(this.base, "transactions", encodeURIComponent(id), "approve");
    return this.http.post<MSG>(url, input ?? {});
  }

  public reject$(
    transactionId: string,
    input: PaymentTransactionRejectInputDto,
  ): Observable<MSG> {
    const id = this.mustText(transactionId, "transactionId");
    const url = this.join(this.base, "transactions", encodeURIComponent(id), "reject");
    return this.http.post<MSG>(url, input);
  }

  public status$(
    transactionId: string,
    input: PaymentTransactionPaymentStatusInputDto,
  ): Observable<MSG> {
    const id = this.mustText(transactionId, "transactionId");
    const url = this.join(this.base, "transactions", encodeURIComponent(id), "status");
    return this.http.post<MSG>(url, input);
  }

  // ===========================================================================
  // DELETE
  // ===========================================================================

  public delete$(transactionId: string): Observable<MSG> {
    const id = this.mustText(transactionId, "transactionId");
    const url = this.join(this.base, "transactions", encodeURIComponent(id));
    return this.http.delete<MSG>(url);
  }

  // ===========================================================================
  // BANK ACCOUNT ALIAS EXISTS (NO new endpoint needed)
  // ---------------------------------------------------------------------------
  // Uses existing backend route:
  //   GET /api-payments/bank-accounts/alias/:alias
  //
  // Behavior:
  // - 200 => true
  // - 404 => false
  // - other errors => false (or rethrow if you prefer)
  // ===========================================================================

  public bankAccountAliasExists$(alias: string): Observable<boolean> {
    const a = this.mustText(alias, "alias");
    const url = this.join(this.base, "bank-accounts", "alias", encodeURIComponent(a));

    // If your backend returns 404 via ApiResponseBuilder.notFound,
    // HttpClient will error -> we map 404 to false.
    return this.http.get<MSG>(url).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  // ===========================================================================
  // Internal helpers
  // ===========================================================================

  private toMultipartPayload(options: {
    payload: object;
    includeEmptyPayload: boolean;
    evidenceFiles?: ReadonlyArray<File> | null;
  }): FormData {
    const fd = new FormData();

    // payload (JSON string)
    const payloadJson = JSON.stringify(options.payload ?? {});
    if (options.includeEmptyPayload) {
      fd.append(PaymentTransactionRestService.PAYLOAD_FIELD, payloadJson);
    } else {
      // If you ever want payload optional:
      if (payloadJson !== "{}") {
        fd.append(PaymentTransactionRestService.PAYLOAD_FIELD, payloadJson);
      }
    }

    // evidence (multiple)
    for (const f of options.evidenceFiles ?? []) {
      if (f instanceof File) {
        fd.append(PaymentTransactionRestService.EVIDENCE_FIELD, f, f.name);
      }
    }

    return fd;
  }

  private toParams(obj: Record<string, unknown>): HttpParams {
    let params = new HttpParams();

    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue;

      // arrays not expected here; if needed later, expand
      const s = String(v).trim();
      if (!s) continue;

      params = params.set(k, s);
    }

    return params;
  }

  private omitUndefined<T extends object>(obj: T): T {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) out[k] = v;
    }
    return out as T;
  }

  private join(...parts: string[]): string {
    return parts
      .filter((x) => typeof x === "string" && x.length > 0)
      .map((x, i) => {
        const s = x.trim();
        if (i === 0) return s.replace(/\/+$/g, "");
        return s.replace(/^\/+/g, "").replace(/\/+$/g, "");
      })
      .join("/");
  }

  private mustText(v: unknown, name: string): string {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) throw new Error(`[Error:] Missing required ${name}.\n`);
    return s;
  }
}
