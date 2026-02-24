// Path: src/app/services/teamManagement/workEvents/work-event.rest.service.ts
// ============================================================================
// WorkEventRestService (MSG envelope + multipart-safe)
// ----------------------------------------------------------------------------
// Backend mount: /api-work-event
//
// Responses use MSG<WorkApiData> envelope.
// Work events are returned under system.event / system.events.
// ============================================================================

import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";

import type { MSG, WorkApiData } from "../../../types/api-message.types";
import { environment } from "../../../../environments/environment";

import type {
  WorkEventCreateRequest,
  WorkEventListQuery,
  WorkEventUpdateRequest,
  WorkEventStatus,
  WorkEventType,
} from "../../../types/team-management/work-events/work-event.types";

@Injectable({ providedIn: "root" })
export class WorkEventRestService {
  private readonly baseUrl: string;

  public constructor(private readonly http: HttpClient) {
    this.baseUrl = this.safeJoin(environment.apiOrigin, "/api-work-event");
  }

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  public getById(eventId: string): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(eventId)}`);
    return this.http.get<MSG<WorkApiData>>(url);
  }

  public list(query: WorkEventListQuery): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, "/list");
    const params = this.toParams(query);
    return this.http.get<MSG<WorkApiData>>(url, { params });
  }

  public count(query: Omit<WorkEventListQuery, "page" | "limit">): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, "/count");
    const params = this.toParams(query);
    return this.http.get<MSG<WorkApiData>>(url, { params });
  }

  // ---------------------------------------------------------------------------
  // WRITE (multipart supported for attachments/evidence if enabled in backend)
  // ---------------------------------------------------------------------------

  public create(
    payload: WorkEventCreateRequest,
    uploads?: { attachments?: File[]; files?: File[]; evidence?: File[] }
  ): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, "/create");
    const fd = this.buildMultipart(payload, uploads);
    return this.http.post<MSG<WorkApiData>>(url, fd);
  }

  public update(
    eventId: string,
    payload: WorkEventUpdateRequest,
    uploads?: { attachments?: File[]; files?: File[]; evidence?: File[] }
  ): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(eventId)}`);
    const fd = this.buildMultipart(payload, uploads);
    return this.http.patch<MSG<WorkApiData>>(url, fd);
  }

  public remove(eventId: string): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(eventId)}`);
    return this.http.delete<MSG<WorkApiData>>(url);
  }

  // ---------------------------------------------------------------------------
  // ATOMIC OPS (common)
  // ---------------------------------------------------------------------------

  public setStatus(eventId: string, status: WorkEventStatus): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(eventId)}/status`);
    return this.http.patch<MSG<WorkApiData>>(url, { status });
  }

  public setType(eventId: string, type: WorkEventType): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(eventId)}/type`);
    return this.http.patch<MSG<WorkApiData>>(url, { type });
  }

  public setWindow(eventId: string, startAt: string, endAt?: string): Observable<MSG<WorkApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(eventId)}/window`);
    return this.http.patch<MSG<WorkApiData>>(url, this.omitUndefined({ startAt, endAt }));
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  private safeJoin(a: string, b: string): string {
    const a2 = a.endsWith("/") ? a.slice(0, -1) : a;
    const b2 = b.startsWith("/") ? b : `/${b}`;
    return `${a2}${b2}`;
  }

  private omitUndefined<T extends object>(obj: T): Partial<T> {
    const out: Partial<T> = {};
    for (const k of Object.keys(obj) as Array<keyof T>) {
      const v = obj[k];
      if (v !== undefined) out[k] = v;
    }
    return out;
  }

  private toParams<T extends object>(query: T): HttpParams {
    let params = new HttpParams();
    const safe = this.omitUndefined(query);

    for (const k of Object.keys(safe) as Array<keyof typeof safe>) {
      const v = safe[k];
      if (v === undefined) continue;

      if (Array.isArray(v)) {
        params = params.set(String(k), JSON.stringify(v));
        continue;
      }

      params = params.set(String(k), String(v));
    }

    return params;
  }

  private buildMultipart<T extends object>(
    payload: T,
    uploads?: { attachments?: File[]; files?: File[]; evidence?: File[] }
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

      fd.append(String(key), JSON.stringify(raw));
    }

    if (uploads?.attachments?.length) for (const f of uploads.attachments) fd.append("attachments", f);
    if (uploads?.files?.length) for (const f of uploads.files) fd.append("files", f);
    if (uploads?.evidence?.length) for (const f of uploads.evidence) fd.append("evidence", f);

    return fd;
  }
}
