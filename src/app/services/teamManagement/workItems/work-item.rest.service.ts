// Path: src/app/services/teamManagement/workItems/work-item.rest.service.ts
// ============================================================================
// WorkItemRestService (MSG envelope + multipart-safe)
// ----------------------------------------------------------------------------
// Backend mount (PropEase):
// - /api-work-item
//
// Responses use MSG<ApiData> envelope.
// Work items are typically returned under system.workItem / system.workItems.
// ============================================================================

import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";

import type { MSG, WorkApiData } from "../../../types/api-message.types";
import { environment } from "../../../../environments/environment";

import type {
  WorkItemAppendActivityRequest,
  WorkItemCreateRequest,
  WorkItemListQuery,
  WorkItemStatus,
  WorkItemPriority,
  WorkItemUpdateRequest,
} from "../../../types/team-management/work-items/work-item.types";

@Injectable({ providedIn: "root" })
export class WorkItemRestService {
  private readonly baseUrl: string;

  public constructor(private readonly http: HttpClient) {
    this.baseUrl = this.safeJoin(environment.apiOrigin, "/api-work-item");
  }

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  public getById(workItemId: string): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(workItemId)}`);
    return this.http.get<MSG<WorkApiData>>(url);
  }

  /**
   * List work items.
   *
   * Backend expects FILTERS via query params (teamId required).
   */
  public list(query: WorkItemListQuery): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, "/list");
    const params = this.toParams(query);
    return this.http.get<MSG<WorkApiData>>(url, { params });
  }

  /**
   * Count work items (count is returned in pagination.total typically).
   */
  public count(query: Omit<WorkItemListQuery, "page" | "limit">): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, "/count");
    const params = this.toParams(query);
    return this.http.get<MSG<WorkApiData>>(url, { params });
  }

  // ---------------------------------------------------------------------------
  // WRITE (multipart create/update)
  // ---------------------------------------------------------------------------

  /**
   * Create work item (multipart).
   *
   * Upload fields supported by backend middleware:
   * - files[]
   * - attachments[]
   * - evidence[]
   */
  public create(
    payload: WorkItemCreateRequest,
    uploads?: { files?: File[]; attachments?: File[]; evidence?: File[] }
  ): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, "/create");
    const fd = this.buildMultipart(payload, uploads);
    return this.http.post<MSG<WorkApiData>>(url, fd);
  }

  /**
   * Update work item (multipart).
   */
  public update(
    workItemId: string,
    payload: WorkItemUpdateRequest,
    uploads?: { files?: File[]; attachments?: File[]; evidence?: File[] }
  ): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(workItemId)}`);
    const fd = this.buildMultipart(payload, uploads);
    return this.http.patch<MSG<WorkApiData>>(url, fd);
  }

  public remove(workItemId: string): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(workItemId)}`);
    return this.http.delete<MSG<WorkApiData>>(url);
  }

  // ---------------------------------------------------------------------------
  // ATOMIC OPS
  // ---------------------------------------------------------------------------

  public setStatus(workItemId: string, status: WorkItemStatus): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(workItemId)}/status`);
    return this.http.patch<MSG<WorkApiData>>(url, { status });
  }

  public setPriority(workItemId: string, priority: WorkItemPriority): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(workItemId)}/priority`);
    return this.http.patch<MSG<WorkApiData>>(url, { priority });
  }

  public setDueAt(workItemId: string, expectedCompleteAt: string): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(workItemId)}/due-at`);
    return this.http.patch<MSG<WorkApiData>>(url, { expectedCompleteAt });
  }

  public setAssignedMembers(workItemId: string, assignedToUserIds: string[]): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(workItemId)}/assigned-members`);
    return this.http.patch<MSG<WorkApiData>>(url, { assignedToUserIds });
  }

  // ---------------------------------------------------------------------------
  // ACTIVITY
  // ---------------------------------------------------------------------------

  public appendActivity(workItemId: string, payload: WorkItemAppendActivityRequest): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(workItemId)}/activity`);
    return this.http.post<MSG<WorkApiData>>(url, this.omitUndefined(payload));
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  private safeJoin(a: string, b: string): string {
    const a2 = a.endsWith("/") ? a.slice(0, -1) : a;
    const b2 = b.startsWith("/") ? b : `/${b}`;
    return `${a2}${b2}`;
  }

  /**
   * exactOptionalPropertyTypes-safe omit undefined keys.
   * NOTE: uses `T extends object` to avoid index-signature errors.
   */
  private omitUndefined<T extends object>(obj: T): Partial<T> {
    const out: Partial<T> = {};
    for (const k of Object.keys(obj) as Array<keyof T>) {
      const v = obj[k];
      if (v !== undefined) out[k] = v;
    }
    return out;
  }

  /**
   * Convert a query object to HttpParams, omitting undefined.
   */
  private toParams<T extends object>(query: T): HttpParams {
    let params = new HttpParams();
    const safe = this.omitUndefined(query);

    for (const k of Object.keys(safe) as Array<keyof typeof safe>) {
      const v = safe[k];
      if (v === undefined) continue;

      if (Array.isArray(v)) {
        // backend doesn't parse repeated keys in this controller; send JSON for arrays
        params = params.set(String(k), JSON.stringify(v));
        continue;
      }

      params = params.set(String(k), String(v));
    }

    return params;
  }

  /**
 * Multipart builder:
 * - primitive -> string
 * - arrays/objects -> JSON string
 * - null -> "null" (backend supports this pattern)
 *
 * @param payload
 * - Expected: DTO/payload object (no index signature required)
 */
private buildMultipart<T extends object>(
  payload: T,
  uploads?: { files?: File[]; attachments?: File[]; evidence?: File[] }
): FormData {
  const fd = new FormData();

  for (const key of Object.keys(payload) as Array<keyof T>) {
    const raw: unknown = payload[key];

    if (raw === undefined) continue;

    if (raw === null) {
      fd.append(String(key), "null");
      continue;
    }

    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      fd.append(String(key), String(raw));
      continue;
    }

    // arrays/objects -> JSON
    fd.append(String(key), JSON.stringify(raw));
  }

  if (uploads?.files?.length) for (const f of uploads.files) fd.append("files", f);
  if (uploads?.attachments?.length) for (const f of uploads.attachments) fd.append("attachments", f);
  if (uploads?.evidence?.length) for (const f of uploads.evidence) fd.append("evidence", f);

  return fd;
}
}
