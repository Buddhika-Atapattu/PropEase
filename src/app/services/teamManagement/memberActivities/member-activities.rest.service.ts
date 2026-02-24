// Path: src/app/services/teamManagement/memberActivities/member-activities.rest.service.ts
// ============================================================================
// MemberActivitiesRestService (MSG envelope)
// ----------------------------------------------------------------------------
// Backend mount: /api-member-activity   (verify mount name in RoutesBootstrap)
// Returns:
// - system.memberActivity / system.memberActivities
// ============================================================================

import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";

import type { MSG, MemberActivityApiData } from "../../../types/api-message.types";
import { environment } from "../../../../environments/environment";

import type {
  MemberActivityCreateRequest,
  MemberActivityListQuery,
} from "../../../types/team-management/member-activities/member-activities.types";

@Injectable({ providedIn: "root" })
export class MemberActivitiesRestService {
  private readonly baseUrl: string;

  public constructor(private readonly http: HttpClient) {
    // ✅ If your backend uses a different base path, change here only.
    this.baseUrl = this.safeJoin(environment.apiOrigin, "/api-member-activity");
  }

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  public getById(activityId: string): Observable<MSG<MemberActivityApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(activityId)}`);
    return this.http.get<MSG<MemberActivityApiData>>(url);
  }

  public list(query: MemberActivityListQuery): Observable<MSG<MemberActivityApiData>> {
    const url = this.safeJoin(this.baseUrl, "/list");
    const params = this.toParams(query);
    return this.http.get<MSG<MemberActivityApiData>>(url, { params });
  }

  public count(query: Omit<MemberActivityListQuery, "page" | "limit">): Observable<MSG<MemberActivityApiData>> {
    const url = this.safeJoin(this.baseUrl, "/count");
    const params = this.toParams(query);
    return this.http.get<MSG<MemberActivityApiData>>(url, { params });
  }

  // ---------------------------------------------------------------------------
  // WRITE
  // ---------------------------------------------------------------------------

  public create(payload: MemberActivityCreateRequest): Observable<MSG<MemberActivityApiData>> {
    const url = this.safeJoin(this.baseUrl, "/create");
    return this.http.post<MSG<MemberActivityApiData>>(url, this.omitUndefined(payload));
  }

  public remove(activityId: string): Observable<MSG<MemberActivityApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(activityId)}`);
    return this.http.delete<MSG<MemberActivityApiData>>(url);
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
}
