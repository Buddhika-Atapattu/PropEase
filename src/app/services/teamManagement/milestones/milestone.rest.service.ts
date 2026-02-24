// Path: src/app/services/teamManagement/milestones/milestone.rest.service.ts
// ============================================================================
// MilestoneRestService (MSG envelope + multipart-safe)
// ----------------------------------------------------------------------------
// Backend mount: /api-milestone   (verify mount name in RoutesBootstrap)
// Returns:
// - system.milestone / system.milestones
// ============================================================================

import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";

import type { MSG, MilestoneApiData } from "../../../types/api-message.types";
import { environment } from "../../../../environments/environment";

import type {
  MilestoneCreateRequest,
  MilestoneListQuery,
  MilestoneStatus,
  MilestoneUpdateRequest,
} from "../../../types/team-management/milestone/milestone.types";

@Injectable({ providedIn: "root" })
export class MilestoneRestService {
  private readonly baseUrl: string;

  public constructor(private readonly http: HttpClient) {
    // ✅ If your backend uses a different base path, change here only.
    this.baseUrl = this.safeJoin(environment.apiOrigin, "/api-milestone");
  }

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  public getById(milestoneId: string): Observable<MSG<MilestoneApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(milestoneId)}`);
    return this.http.get<MSG<MilestoneApiData>>(url);
  }

  public list(query: MilestoneListQuery): Observable<MSG<MilestoneApiData>> {
    const url = this.safeJoin(this.baseUrl, "/list");
    const params = this.toParams(query);
    return this.http.get<MSG<MilestoneApiData>>(url, { params });
  }

  public count(query: Omit<MilestoneListQuery, "page" | "limit">): Observable<MSG<MilestoneApiData>> {
    const url = this.safeJoin(this.baseUrl, "/count");
    const params = this.toParams(query);
    return this.http.get<MSG<MilestoneApiData>>(url, { params });
  }

  // ---------------------------------------------------------------------------
  // WRITE (multipart for attachments if enabled)
  // ---------------------------------------------------------------------------

  public create(
    payload: MilestoneCreateRequest,
    uploads?: { attachments?: File[]; files?: File[]; evidence?: File[] }
  ): Observable<MSG<MilestoneApiData>> {
    const url = this.safeJoin(this.baseUrl, "/create");
    const fd = this.buildMultipart(payload, uploads);
    return this.http.post<MSG<MilestoneApiData>>(url, fd);
  }

  public update(
    milestoneId: string,
    payload: MilestoneUpdateRequest,
    uploads?: { attachments?: File[]; files?: File[]; evidence?: File[] }
  ): Observable<MSG<MilestoneApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(milestoneId)}`);
    const fd = this.buildMultipart(payload, uploads);
    return this.http.patch<MSG<MilestoneApiData>>(url, fd);
  }

  public remove(milestoneId: string): Observable<MSG<MilestoneApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(milestoneId)}`);
    return this.http.delete<MSG<MilestoneApiData>>(url);
  }

  // ---------------------------------------------------------------------------
  // ATOMIC OPS (common)
  // ---------------------------------------------------------------------------

  public setStatus(milestoneId: string, status: MilestoneStatus): Observable<MSG<MilestoneApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(milestoneId)}/status`);
    return this.http.patch<MSG<MilestoneApiData>>(url, { status });
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
