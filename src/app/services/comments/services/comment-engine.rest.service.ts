// Path: src/app/service/comments/services/comment-engine.rest.service.ts
// ============================================================================
// PropEase FE — CommentEngineRestService (REST only)
// ----------------------------------------------------------------------------
// Responsibilities:
//   ✅ Calls backend REST endpoints (no WebSocket here)
//   ✅ Builds query params safely (exactOptionalPropertyTypes-safe)
//   ✅ Builds FormData for multipart comment add (attachments/files)
//   ✅ Class-based only (no standalone helper functions)
// ----------------------------------------------------------------------------
// Key FIXES applied:
//   1) loadAdvanced(): req.filters is optional -> buildLoadParams accepts filters? and omits if empty
//   2) applyFilters(): section is NOT always required (advanced/count can be broad). We only set if provided.
//      - If your backend *requires* section for some endpoints, validate at call-site, not globally.
//   3) FormData: fixed wrong field names:
//        - rootCommentId -> threadRootId (matches your contract)
//        - isPinned -> pinned (matches your contract)
//   4) FormData: supports both `attachments` and `files` arrays (your contract has both)
//   5) Param keys: advanced paging uses `mode/offset/limit/cursor` while legacy load uses `start/limit`
//   6) Omits optional fields entirely (never sets undefined)
//
// NOTE:
// - This file assumes CommentEngineEndpoints has: LOAD, LOAD_ADVANCED, COUNT_ADVANCED, COUNT_LOAD,
//   ADD, GET_BY_ID(id), EDIT(id), DELETE(id), PIN_TOGGLE(id).
// - This file assumes CommentRestEditRequest has: id, messageHtml?, audience?, attachments? (undefined|null|array)
// ============================================================================

import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

import type {
  CommentLoadFilters,
  CommentLoadRequest,
  CommentPagination,
  CommentRestAddRequest,
  CommentSortOrder,
} from "../contracts/comment.contract";

import type { CommentRestEditRequest } from "../contracts/comment.rest.contract";

import { MSG } from "../../../types/api-message.types";
import { CommentEngineEndpoints } from "./comment-engine.endpoints";

@Injectable({ providedIn: "root" })
export class CommentEngineRestService {
  public constructor(private readonly http: HttpClient) {}

  // ===========================================================================
  // LOAD (simple) — maps to GET /load
  // - Your backend expects legacy params: start, limit (+ filters + sort)
  // ===========================================================================
  public load(params: {
    filters: CommentLoadFilters;
    start: number; // legacy offset name used by /load
    limit: number;
    sort?: CommentSortOrder;
  }): Observable<MSG> {
    const qp = this.buildLoadParams({
      filters: params.filters,
      pagination: { mode: "offset", offset: params.start, limit: params.limit },
      sort: params.sort ?? "newest",
      useLegacyStart: true,
    });

    return this.http.get<MSG>(CommentEngineEndpoints.LOAD, { params: qp });
  }

  // ===========================================================================
  // LOAD ADVANCED — maps to GET /load-advanced
  // - filters optional (broad queries allowed)
  // ===========================================================================
  public loadAdvanced(req: CommentLoadRequest): Observable<MSG> {
    const qp = this.buildLoadParams({
      filters: req.filters, // ✅ optional supported
      pagination: req.pagination,
      sort: req.sort ?? "newest",
      useLegacyStart: false,
    });

    return this.http.get<MSG>(CommentEngineEndpoints.LOAD_ADVANCED, { params: qp });
  }

  // ===========================================================================
  // COUNT (advanced) — maps to GET /count-advanced
  // - filters optional by contract; but this method requires a filters object input.
  //   (That object can be empty: {}.)
  // ===========================================================================
  public countAdvanced(filters: CommentLoadFilters): Observable<MSG> {
    const qp = this.buildFiltersParams(filters);
    return this.http.get<MSG>(CommentEngineEndpoints.COUNT_ADVANCED, { params: qp });
  }

  // ===========================================================================
  // COUNT (load) — maps to GET /count-load (alias)
  // ===========================================================================
  public countLoad(filters: CommentLoadFilters): Observable<MSG> {
    const qp = this.buildFiltersParams(filters);
    return this.http.get<MSG>(CommentEngineEndpoints.COUNT_LOAD, { params: qp });
  }

  // ===========================================================================
  // GET BY ID — maps to GET /get/:id
  // ===========================================================================
  public getById(id: string): Observable<MSG> {
    const safeId = this.normalizeRequiredString(id, "comment id");
    return this.http.get<MSG>(CommentEngineEndpoints.GET_BY_ID(safeId));
  }

  // ===========================================================================
  // ADD (multipart) — maps to POST /add
  // ===========================================================================
  public addComment(req: CommentRestAddRequest): Observable<MSG> {
    const fd = this.buildAddFormData(req);
    return this.http.post<MSG>(CommentEngineEndpoints.ADD, fd);
  }

  // ===========================================================================
  // EDIT — maps to PATCH /edit/:id
  // ===========================================================================
  public edit(req: CommentRestEditRequest): Observable<MSG> {
    const safeId = this.normalizeRequiredString(req.id, "comment id");

    const body: Record<string, unknown> = {};

    if (typeof req.messageHtml === "string") {
      const html = req.messageHtml.trim();
      if (!html) throw new Error("messageHtml cannot be empty.");
      body["messageHtml"] = html;
    }

    if (typeof req.audience === "string") {
      const aud = req.audience.trim();
      if (!aud) throw new Error("audience cannot be empty.");
      body["audience"] = aud;
    }

    // attachments semantics:
    // - undefined => untouched
    // - null => clear
    // - array => replace
    if (typeof req.attachments !== "undefined") {
      body["attachments"] = req.attachments;
    }

    return this.http.patch<MSG>(CommentEngineEndpoints.EDIT(safeId), body);
  }

  // ===========================================================================
  // DELETE — maps to DELETE /delete/:id
  // ===========================================================================
  public delete(id: string): Observable<MSG> {
    const safeId = this.normalizeRequiredString(id, "comment id");
    return this.http.delete<MSG>(CommentEngineEndpoints.DELETE(safeId));
  }

  // ===========================================================================
  // PIN TOGGLE — maps to PATCH /pin-toggle/:id  body: { pinned: boolean }
  // (If your backend uses /pin/:id for toggle, keep endpoint mapping there.)
  // ===========================================================================
  public pinToggle(id: string, pinned: boolean): Observable<MSG> {
    const safeId = this.normalizeRequiredString(id, "comment id");
    const body: { pinned: boolean } = { pinned: Boolean(pinned) };
    return this.http.patch<MSG>(CommentEngineEndpoints.PIN_TOGGLE(safeId), body);
  }

  public pin(id: string): Observable<MSG> {
    return this.pinToggle(id, true);
  }

  public unpin(id: string): Observable<MSG> {
    return this.pinToggle(id, false);
  }

  // ===========================================================================
  // INTERNAL — QueryParam builders
  // ===========================================================================

  private buildLoadParams(input: {
    filters?: CommentLoadFilters; // ✅ optional
    pagination: CommentPagination;
    sort: CommentSortOrder;
    useLegacyStart: boolean;
  }): HttpParams {
    let params = new HttpParams();

    // filters (only apply if provided and has at least 1 meaningful field)
    if (input.filters && this.hasAnyFilter(input.filters)) {
      params = this.applyFilters(params, input.filters);
    }

    // sort
    params = params.set("sort", input.sort);

    // pagination
    if (input.pagination.mode === "offset") {
      const offset = this.toSafeInt(input.pagination.offset, 0);
      const limit = this.toSafeInt(input.pagination.limit, 20);

      if (input.useLegacyStart) {
        // legacy router expects start/limit
        params = params.set("start", String(offset)).set("limit", String(limit));
      } else {
        // advanced router expects mode/offset/limit
        params = params.set("mode", "offset").set("offset", String(offset)).set("limit", String(limit));
      }
    } else {
      const limit = this.toSafeInt(input.pagination.limit, 20);
      params = params.set("mode", "cursor").set("limit", String(limit));

      const cursor = this.normalizeOptionalString(input.pagination.cursor);
      if (cursor) {
        params = params.set("cursor", cursor);
      }
    }

    return params;
  }

  private buildFiltersParams(filters: CommentLoadFilters): HttpParams {
    let params = new HttpParams();

    if (this.hasAnyFilter(filters)) {
      params = this.applyFilters(params, filters);
    }

    return params;
  }

  /**
   * IMPORTANT CHANGE:
   * - We DO NOT force `section` to exist globally.
   * - If your backend requires it for specific endpoints, validate in those methods.
   */
  private applyFilters(params: HttpParams, filters: CommentLoadFilters): HttpParams {
    // Target filtering
    params = this.setIfNonEmpty(params, "section", this.normalizeOptionalString(filters.section));
    params = this.setIfNonEmpty(params, "subSection", this.normalizeOptionalString(filters.subSection));
    params = this.setIfNonEmpty(params, "refId", this.normalizeOptionalString(filters.refId));
    params = this.setIfNonEmpty(params, "module", this.normalizeOptionalString(filters.module));

    // Scope match support
    params = this.setIfNonEmpty(params, "scopeKey", this.normalizeOptionalString(filters.scopeKey));
    params = this.setIfNonEmpty(params, "scopeValue", this.normalizeOptionalString(filters.scopeValue));

    // Author / audience
    params = this.setIfNonEmpty(params, "byUserId", this.normalizeOptionalString(filters.byUserId));
    params = this.setIfNonEmpty(params, "audience", this.normalizeOptionalString(filters.audience));

    // Thread filtering
    params = this.setIfNonEmpty(params, "threadRootId", this.normalizeOptionalString(filters.threadRootId));
    params = this.setIfNonEmpty(params, "parentCommentId", this.normalizeOptionalString(filters.parentCommentId));

    // Flags
    params = this.setIfBoolean(params, "topLevelOnly", filters.topLevelOnly);
    params = this.setIfBoolean(params, "pinnedOnly", filters.pinnedOnly);

    // Date range
    params = this.setIfNonEmpty(params, "fromIso", this.normalizeOptionalString(filters.fromIso));
    params = this.setIfNonEmpty(params, "toIso", this.normalizeOptionalString(filters.toIso));

    // Search
    params = this.setIfNonEmpty(params, "q", this.normalizeOptionalString(filters.q));

    return params;
  }

  private setIfNonEmpty(params: HttpParams, key: string, value: string | null): HttpParams {
    if (!value) return params;
    return params.set(key, value);
  }

  private setIfBoolean(params: HttpParams, key: string, value: boolean | undefined): HttpParams {
    if (typeof value !== "boolean") return params;
    return params.set(key, String(value));
  }

  private hasAnyFilter(f: CommentLoadFilters): boolean {
    // We only treat it “present” if at least one meaningful field exists.
    // (So passing {} won't spam the query string.)
    if (this.normalizeOptionalString(f.section)) return true;
    if (this.normalizeOptionalString(f.subSection)) return true;
    if (this.normalizeOptionalString(f.refId)) return true;
    if (this.normalizeOptionalString(f.module)) return true;

    if (this.normalizeOptionalString(f.scopeKey)) return true;
    if (this.normalizeOptionalString(f.scopeValue)) return true;

    if (this.normalizeOptionalString(f.byUserId)) return true;
    if (this.normalizeOptionalString(f.audience)) return true;

    if (this.normalizeOptionalString(f.threadRootId)) return true;
    if (this.normalizeOptionalString(f.parentCommentId)) return true;

    if (typeof f.topLevelOnly === "boolean") return true;
    if (typeof f.pinnedOnly === "boolean") return true;

    if (this.normalizeOptionalString(f.fromIso)) return true;
    if (this.normalizeOptionalString(f.toIso)) return true;

    if (this.normalizeOptionalString(f.q)) return true;

    return false;
  }

  private toSafeInt(v: unknown, fallback: number): number {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    const x = Math.floor(n);
    if (x < 0) return 0;
    return x;
  }

  // ===========================================================================
  // INTERNAL — FormData builder for POST /add
  // ===========================================================================

  private buildAddFormData(req: CommentRestAddRequest): FormData {
    const fd = new FormData();

    // -----------------------------
    // REQUIRED: messageHtml
    // -----------------------------
    const messageHtml = this.normalizeRequiredString(req.messageHtml, "messageHtml");

    // Prevent submitting empty editor content (e.g. "<p><br></p>")
    if (!this.hasMeaningfulHtmlText(messageHtml)) {
      throw new Error("messageHtml is required (non-empty content).");
    }
    fd.append("messageHtml", messageHtml);

    // -----------------------------
    // REQUIRED: audience
    // -----------------------------
    const audience = this.normalizeRequiredString(req.audience, "audience");
    fd.append("audience", audience);

    // -----------------------------
    // TARGET: preferred JSON
    // -----------------------------
    const targetJson = this.normalizeOptionalString(req.commentTargetJson);
    if (targetJson) {
      fd.append("commentTargetJson", targetJson);
    } else {
      // fallback fields
      this.appendIfNonEmpty(fd, "section", this.normalizeOptionalString(req.section));
      this.appendIfNonEmpty(fd, "subSection", this.normalizeOptionalString(req.subSection));
      this.appendIfNonEmpty(fd, "refId", this.normalizeOptionalString(req.refId));
      this.appendIfNonEmpty(fd, "module", this.normalizeOptionalString(req.module));
      this.appendIfNonEmpty(fd, "modelName", this.normalizeOptionalString(req.modelName));

      const scopeJson = this.normalizeOptionalString(req.scopeJson);
      if (scopeJson) {
        fd.append("scopeJson", scopeJson);
      }
    }

    // -----------------------------
    // Threading IDs (contract aligned)
    // -----------------------------
    this.appendIfNonEmpty(fd, "commentId", this.normalizeOptionalString(req.commentId));
    this.appendIfNonEmpty(fd, "parentCommentId", this.normalizeOptionalString(req.parentCommentId));
    this.appendIfNonEmpty(fd, "threadRootId", this.normalizeOptionalString(req.threadRootId));

    // -----------------------------
    // pinned (contract aligned)
    // -----------------------------
    if (typeof req.pinned === "boolean") {
      fd.append("pinned", req.pinned ? "true" : "false");
    }

    // -----------------------------
    // files / attachments (support both keys)
    // -----------------------------
    // Some UI parts may use `files`, some use `attachments`. Accept both.
    const filesA = Array.isArray(req.attachments) ? req.attachments : [];
    const filesB = Array.isArray(req.files) ? req.files : [];

    for (const file of filesA) {
      fd.append("attachments", file, file.name);
    }
    for (const file of filesB) {
      // Keep backend compatibility: still post as "attachments" unless your backend expects "files".
      fd.append("attachments", file, file.name);
    }

    return fd;
  }

  // ===========================================================================
  // Helpers (class-based only)
  // ===========================================================================

  private normalizeRequiredString(value: unknown, field: string): string {
    const v = this.normalizeOptionalString(value);
    if (!v) throw new Error(`${field} is required.`);
    return v;
  }

  private normalizeOptionalString(value: unknown): string | null {
    if (typeof value === "string") {
      const v = value.trim();
      return v ? v : null;
    }
    if (value === null || value === undefined) return null;
    const v = String(value).trim();
    return v ? v : null;
  }

  private appendIfNonEmpty(fd: FormData, key: string, value: string | null): void {
    if (value) fd.append(key, value);
  }

  private hasMeaningfulHtmlText(html: string): boolean {
    const normalized = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&#160;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return normalized.length > 0;
  }
}
