// Path: src/app/services/notifications/notification-rest-api.service.ts
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, throwError } from "rxjs";
import { map, catchError } from "rxjs/operators";

import { environment } from "../../../environments/environment";

import type { MSG } from "../../types/api-message.types";
import type {
  NotificationInboxItemDto,
  NotificationLoadFilters,
  NotificationLoadRequest
} from "../../types/notifications/notification.types";

/* ============================================================================
 * NotificationRestApiService (Observable-first)
 * ----------------------------------------------------------------------------
 * Mirrors backend NotificationHubController routes (POST):
 *  - /api-notification/inbox/load
 *  - /api-notification/inbox/count
 *  - /api-notification/inbox/:inboxId/read
 *  - /api-notification/inbox/read-all
 *  - /api-notification/inbox/:inboxId/archive
 *
 * Backend response shapes used (ApiResponseBuilder.ok):
 *  - load:   system.notifications = NotificationInboxItemDto[], pagination.total = number
 *  - count:  other = { unread }, pagination.total = number
 *  - mut:    other = { changed/inboxId/unread }, pagination.total = number
 *
 * Rules:
 * - class-based only
 * - null-safe MSG parsing
 * - exactOptionalPropertyTypes-safe: omit optional fields when absent
 * ========================================================================== */

export interface NotificationInboxLoadResult {
  items: NotificationInboxItemDto[];
  total: number;
}

export interface NotificationInboxCountResult {
  total: number;
  unread: number;
}

export interface NotificationInboxMutationResult {
  total: number;
  unread: number;

  inboxId?: string;
  changed?: boolean;
  changedCount?: number;
}

@Injectable({ providedIn: "root" })
export class NotificationRestApiService {
  private readonly apiBase = environment.apiOrigin ?? 'http://localhost:3000';

  constructor(private readonly http: HttpClient) {}

  // ---------------------------------------------------------------------------
  // URL builders (single point of change)
  // ---------------------------------------------------------------------------

  private buildBase(): string {
    // Matches your controller comments: /api-notification/...
    return `${this.apiBase}/api-notification`;
  }

  private urlLoad(): string {
    return `${this.buildBase()}/inbox/load`;
  }

  private urlCount(): string {
    return `${this.buildBase()}/inbox/count`;
  }

  private urlMarkRead(inboxId: string): string {
    return `${this.buildBase()}/inbox/${this.safeSeg(inboxId)}/read`;
  }

  private urlMarkAllRead(): string {
    return `${this.buildBase()}/inbox/read-all`;
  }

  private urlArchive(inboxId: string): string {
    return `${this.buildBase()}/inbox/${this.safeSeg(inboxId)}/archive`;
  }

  // ---------------------------------------------------------------------------
  // API: Queries
  // ---------------------------------------------------------------------------

  public loadInbox$(request: NotificationLoadRequest): Observable<NotificationInboxLoadResult> {
    const url = this.urlLoad();
    const body = this.normalizeLoadRequest(request);

    return this.http.post<MSG>(url, body).pipe(
      map((msg) => this.assertSuccess(msg, "loadInbox")),
      map((msg) => {
        const items = this.readSystemArray<NotificationInboxItemDto>(msg, "notifications");
        const total = this.readPaginationTotal(msg);
        return { items, total };
      }),
      catchError((err) => this.toHttpError("loadInbox", err))
    );
  }

  public countInbox$(filters: NotificationLoadFilters): Observable<NotificationInboxCountResult> {
    const url = this.urlCount();
    const body: { filters: NotificationLoadFilters } = { filters: this.normalizeFilters(filters) };

    return this.http.post<MSG>(url, body).pipe(
      map((msg) => this.assertSuccess(msg, "countInbox")),
      map((msg) => {
        const other = this.readOtherObject<{ unread?: unknown }>(msg);
        const unread = this.safeInt(other.unread, 0);
        const total = this.readPaginationTotal(msg);
        return { total, unread };
      }),
      catchError((err) => this.toHttpError("countInbox", err))
    );
  }

  // ---------------------------------------------------------------------------
  // API: Mutations
  // ---------------------------------------------------------------------------

  public markRead$(inboxId: string): Observable<NotificationInboxMutationResult> {
    const url = this.urlMarkRead(inboxId);

    return this.http.post<MSG>(url, {}).pipe(
      map((msg) => this.assertSuccess(msg, "markRead")),
      map((msg) => {
        const other = this.readOtherObject<{
          inboxId?: unknown;
          changed?: unknown;
          unread?: unknown;
        }>(msg);

        const out: NotificationInboxMutationResult = {
          total: this.readPaginationTotal(msg),
          unread: this.safeInt(other.unread, 0)
        };

        const inboxIdSafe = this.safeString(other.inboxId);
        if (inboxIdSafe) out.inboxId = inboxIdSafe;

        if (typeof other.changed === "boolean") out.changed = other.changed;

        return out;
      }),
      catchError((err) => this.toHttpError("markRead", err))
    );
  }

  public markAllRead$(): Observable<NotificationInboxMutationResult> {
    const url = this.urlMarkAllRead();

    return this.http.post<MSG>(url, {}).pipe(
      map((msg) => this.assertSuccess(msg, "markAllRead")),
      map((msg) => {
        const other = this.readOtherObject<{
          changedCount?: unknown;
          unread?: unknown;
        }>(msg);

        const out: NotificationInboxMutationResult = {
          total: this.readPaginationTotal(msg),
          unread: this.safeInt(other.unread, 0)
        };

        const changedCount = this.safeIntOrUndefined(other.changedCount);
        if (typeof changedCount === "number") out.changedCount = changedCount;

        return out;
      }),
      catchError((err) => this.toHttpError("markAllRead", err))
    );
  }

  public archiveOne$(inboxId: string): Observable<NotificationInboxMutationResult> {
    const url = this.urlArchive(inboxId);

    return this.http.post<MSG>(url, {}).pipe(
      map((msg) => this.assertSuccess(msg, "archiveOne")),
      map((msg) => {
        const other = this.readOtherObject<{
          inboxId?: unknown;
          changed?: unknown;
          unread?: unknown;
        }>(msg);

        const out: NotificationInboxMutationResult = {
          total: this.readPaginationTotal(msg),
          unread: this.safeInt(other.unread, 0)
        };

        const inboxIdSafe = this.safeString(other.inboxId);
        if (inboxIdSafe) out.inboxId = inboxIdSafe;

        if (typeof other.changed === "boolean") out.changed = other.changed;

        return out;
      }),
      catchError((err) => this.toHttpError("archiveOne", err))
    );
  }

  // ---------------------------------------------------------------------------
  // MSG parsing helpers (null-safe)
  // ---------------------------------------------------------------------------

  private assertSuccess(msg: MSG, op: string): MSG {
    if (!msg || msg.success !== true) {
      const m = msg?.message ? String(msg.message) : "Request failed";
      // eslint-disable-next-line no-console
      console.error(`[Error:] [NotificationRestApiService] ${op} failed: ${m}\n`);
      throw new Error(m);
    }
    return msg;
  }

  private readPaginationTotal(msg: MSG): number {
    return this.safeInt(msg.data?.pagination?.total, 0);
  }

  private readSystemArray<T>(msg: MSG, key: string): T[] {
    const sys = msg.data?.system;
    if (!sys) return [];

    const v = (sys as Record<string, unknown>)[key];
    if (Array.isArray(v)) return v as T[];

    return [];
  }

  private readOtherObject<T extends Record<string, unknown>>(msg: MSG): T {
    const other = msg.data?.other;
    if (other && typeof other === "object") return other as T;
    return {} as T;
  }

  // ---------------------------------------------------------------------------
  // Input normalizers (exactOptionalPropertyTypes-safe)
  // ---------------------------------------------------------------------------

  private normalizeLoadRequest(input: NotificationLoadRequest): NotificationLoadRequest {
    const out: NotificationLoadRequest = {
      username: this.mustString(input.username, "username"),
      page: this.safePage(input.page),
      limit: this.safeLimit(input.limit)
    };

    // filters is optional on FE type, but backend safeLoadRequest defaults to {}
    const filters = this.normalizeFilters(input.filters ?? {});
    out.filters = filters;

    return out;
  }

  private normalizeFilters(filters: NotificationLoadFilters): NotificationLoadFilters {
    const out: NotificationLoadFilters = {};

    if (filters.category) out.category = filters.category;
    if (filters.severity) out.severity = filters.severity;
    if (filters.mode) out.mode = filters.mode;

    const search = this.safeString(filters.search);
    if (search) out.search = search;

    const from = this.safeIso(filters.from);
    if (from) out.from = from;

    const to = this.safeIso(filters.to);
    if (to) out.to = to;

    if (typeof filters.unreadOnly === "boolean") out.unreadOnly = filters.unreadOnly;
    if (typeof filters.includeDeleted === "boolean") out.includeDeleted = filters.includeDeleted;
    if (typeof filters.includeArchived === "boolean") out.includeArchived = filters.includeArchived;

    return out;
  }

  // ---------------------------------------------------------------------------
  // Sanitizers
  // ---------------------------------------------------------------------------

  private safeSeg(v: unknown): string {
    return encodeURIComponent(this.safeString(v));
  }

  private mustString(v: unknown, label: string): string {
    const s = this.safeString(v);
    if (!s) throw new Error(`NotificationRestApiService: ${label} is required.`);
    return s;
  }

  private safeString(v: unknown): string {
    if (typeof v === "string") return v.trim();
    if (typeof v === "number") return String(v);
    return "";
  }

  private safeIso(v: unknown): string {
    const s = this.safeString(v);
    if (!s) return "";
    if (!/^\d{4}-\d{2}-\d{2}T/.test(s)) return "";
    return s;
  }

  private safePage(v: unknown): number {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.floor(n);
  }

  private safeLimit(v: unknown): number {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 1) return 10;
    return Math.min(Math.floor(n), 100);
  }

  private safeInt(v: unknown, fallback: number): number {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.floor(n);
  }

  private safeIntOrUndefined(v: unknown): number | undefined {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return undefined;
    return Math.floor(n);
  }

  private toHttpError(op: string, err: unknown): Observable<never> {
    const msg = err instanceof Error ? err.message : String(err ?? "Unknown error");
    // eslint-disable-next-line no-console
    console.error(`[Error:] [NotificationRestApiService] ${op} http error: ${msg}\n`);
    return throwError(() => new Error(msg));
  }
}
