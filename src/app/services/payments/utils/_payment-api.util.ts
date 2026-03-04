// Path: src/app/services/payments/_payment-api.util.ts
// =============================================================================
// PaymentsApiUtil (FE) — STATIC CLASS (no free functions)
// -----------------------------------------------------------------------------
// 01) Introduction
// - Single utility class for Payments REST layer.
// - Provides:
//   A) safeJoin(): stable URL join (absolute + relative)
//   B) toHttpParams(): query params builder (omits undefined/null/"")
//   C) toTransactionFormData(): multipart/form-data builder for transactions
//
// 02) Important matters
// - exactOptionalPropertyTypes-safe mindset: optional values are OMITTED, not set to undefined.
// - Query filters: empty strings should NOT be sent (backend treats absence as "no filter").
// - Transactions: if you need strict multipart contract, this helper supports BOTH modes:
//   - mode="payload" (recommended): send JSON string under "payload" + evidence files.
//   - mode="scalars": send scalar fields as individual form fields + evidence files.
//   Choose one and keep it consistent with backend.
//
// 03) Why we make this class
// - Avoid duplicated URL/params/FormData logic across payment services.
// - Ensure consistent filtering semantics and stable request shapes.
// - Centralize patch semantics ("" means UNSET, undefined means OMIT).
//
// 04) Usage hint
// - URL: PaymentsApiUtil.safeJoin(base, "transactions", "create")
// - Params: PaymentsApiUtil.toHttpParams({ page, limit, search })
// - FormData: PaymentsApiUtil.toTransactionFormData({ fields, evidenceFiles, mode: "payload" })
//
// 05) Keep in mind
// - For SSR/Electron: URL joining here is string-only (no window/document usage).
// - Avoid sending empty filter strings; backend should not receive them.
// =============================================================================

import { HttpParams } from "@angular/common/http";

export class PaymentsApiUtil {
  private static readonly DEFAULT_EVIDENCE_FIELD = "evidence";
  private static readonly DEFAULT_PAYLOAD_FIELD = "payload";

  // ---------------------------------------------------------------------------
  // URL JOIN
  // ---------------------------------------------------------------------------

  /**
   * Join URL parts safely with stable trimming of slashes.
   *
   * @param parts
   * - Expected: string segments like ["https://host/api", "transactions", "create"]
   * - Usage: safeJoin(base, "transactions", id)
   *
   * @returns
   * - Absolute URL if base is absolute (http/https)
   * - Otherwise returns a leading-slash relative path ("/api/...").
   */
  public static safeJoin(...parts: string[]): string {
    const cleaned = parts
      .filter((x) => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim());

    if (cleaned.length === 0) return "";

    const first = cleaned[0];

    // If base is absolute (http/https), join via URL so it stays absolute.
    if (/^https?:\/\//i.test(first)) {
      const base = first.endsWith("/") ? first : `${first}/`;
      const rest = cleaned
        .slice(1)
        .map((x) => x.replace(/(^\/+|\/+$)/g, ""))
        .filter(Boolean)
        .join("/");

      return new URL(rest, base).toString().replace(/\/+$/g, "");
    }

    // Otherwise treat as relative path on same origin.
    const joined = cleaned
      .map((x) => x.replace(/(^\/+|\/+$)/g, ""))
      .filter(Boolean)
      .join("/");

    return `/${joined}`;
  }

  // ---------------------------------------------------------------------------
  // QUERY PARAMS
  // ---------------------------------------------------------------------------

  /**
   * Build HttpParams by omitting undefined/null/"" and trimming strings.
   *
   * @param obj
   * - Expected: plain object of query parameters.
   * - Rule: undefined/null are omitted.
   * - Rule: "" (after trim) is omitted (backend filter semantics).
   * - Arrays: appends multiple values under same key.
   */
  public static toHttpParams(obj: Record<string, unknown>): HttpParams {
    let params = new HttpParams();

    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue;

      // match backend semantics: empty string should not be sent for filters
      if (typeof v === "string" && v.trim().length === 0) continue;

      if (Array.isArray(v)) {
        for (const item of v) {
          if (item === undefined || item === null) continue;
          const s = String(item).trim();
          if (!s) continue;
          params = params.append(k, s);
        }
        continue;
      }

      const s = String(v).trim();
      if (!s) continue;

      params = params.set(k, s);
    }

    return params;
  }

  // ---------------------------------------------------------------------------
  // TRANSACTION FORM DATA
  // ---------------------------------------------------------------------------

  /**
   * Build multipart/form-data payload for Payment Transactions.
   *
   * Two supported request shapes (choose one consistently with backend):
   *
   * 1) mode: "payload"  ✅ Recommended
   *    - fd.append("payload", JSON.stringify(fields))
   *    - fd.append("evidence", file) ...
   *
   * 2) mode: "scalars"
   *    - fd.append("bankAccountId", "...")
   *    - fd.append("amount", "...")
   *    - fd.append("evidence", file) ...
   *
   * PATCH semantics:
   * - If caller explicitly passes "" we send "" (backend interprets as UNSET)
   * - If caller passes undefined we OMIT (backend = no-change)
   *
   * @param options.fields
   * - Expected: plain JSON object (create/update/approve/reject body)
   *
   * @param options.evidenceFiles
   * - Optional: File[] for evidence (0..n)
   *
   * @param options.evidenceFieldName
   * - Optional: defaults to "evidence"
   *
   * @param options.payloadFieldName
   * - Optional: defaults to "payload" (used only when mode="payload")
   *
   * @param options.mode
   * - Optional: "payload" | "scalars"
   * - Default: "payload" (recommended for your “everything through FormData” rule)
   */
  public static toTransactionFormData(options: {
    fields: Record<string, unknown>;
    evidenceFiles?: File[] | null;
    evidenceFieldName?: string;
    payloadFieldName?: string;
    mode?: "payload" | "scalars";
  }): FormData {
    const fd = new FormData();

    const mode = options.mode ?? "payload";
    const evidenceField = options.evidenceFieldName ?? PaymentsApiUtil.DEFAULT_EVIDENCE_FIELD;

    if (mode === "payload") {
      const payloadField = options.payloadFieldName ?? PaymentsApiUtil.DEFAULT_PAYLOAD_FIELD;

      // ✅ Single canonical JSON payload (recommended)
      // Note: JSON.stringify will preserve "" values (used for UNSET semantics)
      fd.append(payloadField, JSON.stringify(options.fields ?? {}));
    } else {
      // ✅ Scalar fields (legacy mode)
      // Note: "" is allowed (UNSET semantics), undefined/null are omitted.
      for (const [k, v] of Object.entries(options.fields ?? {})) {
        if (v === undefined || v === null) continue;

        if (typeof v === "string") {
          fd.append(k, v); // includes "" for UNSET
          continue;
        }

        if (v instanceof Date) {
          fd.append(k, v.toISOString());
          continue;
        }

        fd.append(k, String(v));
      }
    }

    const files = options.evidenceFiles ?? null;
    if (files && Array.isArray(files)) {
      for (const f of files) {
        fd.append(evidenceField, f, f.name);
      }
    }

    return fd;
  }
}
