// Path: src/app/services/recyclebin/recyclebin.service.ts
// =============================================================================
// RecycleBinService (Frontend)
// -----------------------------------------------------------------------------
// PURPOSE
// - Single source of truth for recycle bin HTTP calls.
// - Mirrors backend router endpoints exactly.
//
// IMPORTANT MATTERS
// - SSR/Electron safe: no window/document.
// - exactOptionalPropertyTypes-safe: omit optionals (never pass undefined).
// - No free functions: helpers are private class methods.
// - Errors returned as thrown Error (caller can show toast).
//
// WHY THIS CLASS EXISTS
// - Centralizes URLs, params building, and response unwrapping.
// - Prevents duplicated query-string bugs across components.
// =============================================================================

import { HttpClient, HttpParams } from "@angular/common/http";
import { Inject, Injectable, PLATFORM_ID } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { isPlatformBrowser } from "@angular/common";

import { environment } from "../../../environments/environment";

import type {
  ApiOkEnvelope,
  PageQuery,
  RecycleBinCountResult,
  RecycleBinEntryDto,
  RecycleBinListFilters,
  RecycleBinListItemDto,
  RecycleBinPurgeResult,
  RecycleBinRestorePrepareDto,
  RecycleBinSnapshotReadDto,
} from "../../types/recyclebin/recyclebin.types";

@Injectable({ providedIn: "root" })
export class RecycleBinService {
  private readonly isBrowser: boolean;

  /**
   * Base URL builder for this module.
   *
   * @important
   * - Keep ONE place to change API mount path.
   * - If your backend is mounted as `/api-recyclebin`, keep it consistent here.
   */
  private readonly baseUrl: string;

  public constructor(
    private readonly http: HttpClient,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Adjust ONLY if your backend mount differs.
    // Example mount: app.use("/api-recyclebin", RecycleBinRoutes)
    this.baseUrl = `${environment.apiOrigin}/api-recyclebin`;
  }

  // ===========================================================================
  // 01) LIST
  // GET /list?page=1&limit=20&sourceKey=...&status=... etc
  // ===========================================================================

  /**
   * Load recycle-bin list items.
   *
   * @param options.filters
   * - Optional filters for server-side filtering:
   *   sourceKey, search, status, deletedByUsername, date range, tagsAny, module, entity
   *
   * @param options.page
   * - Pagination (1-based):
   *   { page: 1, limit: 20 }
   *
   * @usageHint
   * const res = await recycleBinService.list({ page: {page:1,limit:20}, filters:{ status:"recorded" } });
   * this.items = res.items; this.total = res.total;
   */
  public async list(options: {
    page: PageQuery;
    filters?: RecycleBinListFilters;
  }): Promise<{ items: RecycleBinListItemDto[]; total: number }> {
    const params = this.buildListParams(options.page, options.filters);

    type Envelope = ApiOkEnvelope<"recycleBinItems", RecycleBinListItemDto[]>;
    const env = await this.get<Envelope>(`${this.baseUrl}/list`, params);

    const items = env.data["recycleBinItems"] ?? [];
    const total = this.readTotalFromEnvelope(env);

    return { items, total };
  }

  // ===========================================================================
  // 02) COUNT
  // GET /count?sourceKey=...&status=... etc
  // ===========================================================================

  /**
   * Count recycle-bin entries.
   *
   * @param filters
   * - Same filtering rules as list() but without page/limit.
   *
   * @usageHint
   * const total = await recycleBinService.count({ status:"recorded" });
   */
  public async count(filters?: RecycleBinListFilters): Promise<number> {
    const params = this.buildFiltersParams(filters);

    type Envelope = ApiOkEnvelope<"other", Record<string, unknown>>;
    const env = await this.get<Envelope>(`${this.baseUrl}/count`, params);

    // Backend: ok(..., { pagination: { total: result.total } })
    const total = this.readTotalFromEnvelope(env);
    return total;
  }

  // ===========================================================================
  // 03) SNAPSHOT
  // GET /:entryId/snapshot
  // ===========================================================================

  /**
   * Load a recycle-bin snapshot (preview modal).
   *
   * @param entryId
   * - Recycle-bin entry id (string).
   */
  public async readSnapshot(entryId: string): Promise<RecycleBinSnapshotReadDto> {
    const id = this.safeSeg(entryId);

    type Envelope = ApiOkEnvelope<"recycleBinItem", RecycleBinEntryDto>;
    const env = await this.get<Envelope>(`${this.baseUrl}/${id}/snapshot`);

    const entry = env.data["recycleBinItem"];
    const snapshotData = this.readOtherObject(env, "snapshotData");
    const meta = this.readOtherObject(env, "metadata");

    return { entry, snapshotData, meta };
  }

  // ===========================================================================
  // 04) RESTORE PREPARE
  // POST /:entryId/restore/prepare
  // ===========================================================================

  /**
   * Prepare restore (server returns snapshot + files manifest).
   *
   * @param entryId
   * - Recycle-bin entry id (string).
   *
   * @usageHint
   * const prep = await recycleBinService.prepareRestore(entryId);
   * // use prep.snapshotData + prep.files in your domain restore step
   */
  public async prepareRestore(entryId: string): Promise<RecycleBinRestorePrepareDto> {
    const id = this.safeSeg(entryId);

    type Envelope = ApiOkEnvelope<"recycleBinItem", RecycleBinEntryDto>;
    const env = await this.post<Envelope>(`${this.baseUrl}/${id}/restore/prepare`, {});

    const entry = env.data["recycleBinItem"];
    const snapshotData = this.readOtherObject(env, "snapshotData");
    const files = this.readOtherArray(env, "files");

    return { entry, snapshotData, files };
  }

  // ===========================================================================
  // 05) RESTORE MARK
  // POST /:entryId/restore/mark
  // ===========================================================================

  /**
   * Mark restored (call AFTER domain restore succeeds).
   *
   * @param entryId
   * - Recycle-bin entry id (string).
   */
  public async markRestored(entryId: string): Promise<void> {
    const id = this.safeSeg(entryId);

    type Envelope = ApiOkEnvelope<"other", { entryId: string }>;
    await this.post<Envelope>(`${this.baseUrl}/${id}/restore/mark`, {});
  }

  // ===========================================================================
  // 06) PURGE (PERMANENT DELETE)
  // DELETE /:entryId/purge
  // ===========================================================================

  /**
   * Permanently delete a recycle-bin entry (high privilege).
   *
   * @param entryId
   * - Recycle-bin entry id (string).
   *
   * @returns RecycleBinPurgeResult
   * - { entryId, purged }
   */
  public async purge(entryId: string): Promise<RecycleBinPurgeResult> {
    const id = this.safeSeg(entryId);

    type Envelope = ApiOkEnvelope<"other", RecycleBinPurgeResult>;
    const env = await this.delete<Envelope>(`${this.baseUrl}/${id}/purge`);

    return env.data["other"];
  }

  // ===========================================================================
  // Internals (NO free functions)
  // ===========================================================================

  private async get<T>(url: string, params?: HttpParams): Promise<T> {
    try {
      const obs$ = this.http.get<T>(url, params ? { params } : {});
      return await firstValueFrom(obs$);
    } catch (e: unknown) {
      throw this.toHttpError(e, "GET", url);
    }
  }

  private async post<T>(url: string, body: Record<string, unknown>, params?: HttpParams): Promise<T> {
    try {
      const obs$ = this.http.post<T>(url, body, params ? { params } : {});
      return await firstValueFrom(obs$);
    } catch (e: unknown) {
      throw this.toHttpError(e, "POST", url);
    }
  }

  private async delete<T>(url: string, params?: HttpParams): Promise<T> {
    try {
      const obs$ = this.http.delete<T>(url, params ? { params } : {});
      return await firstValueFrom(obs$);
    } catch (e: unknown) {
      throw this.toHttpError(e, "DELETE", url);
    }
  }

  /**
   * Build HttpParams for list().
   * - Adds page/limit always.
   * - Adds filters only when present.
   */
  private buildListParams(page: PageQuery, filters?: RecycleBinListFilters): HttpParams {
    let p = new HttpParams();

    p = p.set("page", String(page.page));
    p = p.set("limit", String(page.limit));

    const fp = this.buildFiltersParams(filters);
    fp.keys().forEach((k) => {
      const v = fp.get(k);
      if (typeof v === "string" && v.length > 0) {
        p = p.set(k, v);
      }
    });

    return p;
  }

  /**
   * Build HttpParams for filters.
   * exactOptionalPropertyTypes-safe:
   * - Only sets a param if value exists.
   */
  private buildFiltersParams(filters?: RecycleBinListFilters): HttpParams {
    let p = new HttpParams();
    if (!filters) return p;

    p = this.setIfStr(p, "sourceKey", filters.sourceKey);
    p = this.setIfStr(p, "search", filters.search);
    p = this.setIfStr(p, "status", filters.status);
    p = this.setIfStr(p, "deletedByUsername", filters.deletedByUsername);
    p = this.setIfStr(p, "deletedFromIso", filters.deletedFromIso);
    p = this.setIfStr(p, "deletedToIso", filters.deletedToIso);
    p = this.setIfStr(p, "module", filters.module);
    p = this.setIfStr(p, "entity", filters.entity);

    // tagsAny -> csv
    if (Array.isArray(filters.tagsAny) && filters.tagsAny.length > 0) {
      const csv = filters.tagsAny.map((x) => x.trim()).filter((x) => x.length > 0).join(",");
      if (csv.length > 0) p = p.set("tagsAny", csv);
    }

    return p;
  }

  private setIfStr(p: HttpParams, key: string, v: string | undefined): HttpParams {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) return p;
    return p.set(key, s);
  }

  /**
   * Read total from multiple possible backend meta locations.
   * (Some endpoints return { pagination: { total } } and some nest under other.)
   */
  private readTotalFromEnvelope(env: { pagination?: { total?: number }; other?: Record<string, unknown> }): number {
    const top = env.pagination?.total;
    if (typeof top === "number" && Number.isFinite(top)) return top;

    const other = env.other;
    if (other && typeof other["pagination"] === "object" && other["pagination"] !== null) {
      const pg = other["pagination"] as { total?: unknown };
      if (typeof pg.total === "number" && Number.isFinite(pg.total)) return pg.total;
    }

    return 0;
  }

  private readOtherObject(env: { other?: Record<string, unknown> }, key: string): Record<string, unknown> {
    const other = env.other;
    if (!other) return {};
    const v = other[key];
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    return {};
  }

  private readOtherArray(env: { other?: Record<string, unknown> }, key: string): Array<any> {
    const other = env.other;
    if (!other) return [];
    const v = other[key];
    if (Array.isArray(v)) return v;
    return [];
  }

  /**
   * Safe URL segment (prevents accidental slashes and empty ids).
   */
  private safeSeg(v: string): string {
    const s = typeof v === "string" ? v.trim() : "";
    return encodeURIComponent(s.replaceAll("/", ""));
  }

  private toHttpError(e: unknown, method: string, url: string): Error {
    const msg = e instanceof Error ? e.message : "Request failed";
    return new Error(`[RecycleBinService] ${method} ${url} -> ${msg}`);
  }
}
