// Path: src/app/services/teamManagement/kpis/team-kpi.rest.service.ts
// ============================================================================
// TeamKpiRestService
// ----------------------------------------------------------------------------
// Backend routes (TeamKpiRouter):
// - GET  /api-team-management/kpi/keys
// - GET  /api-team-management/kpi/metric/:key   (query: scope,targetId,from,to + optional filters)
// - POST /api-team-management/kpi/batch        (body: { keys: string[] } + same query)
// - GET  /api-team-management/kpi/member-profile
//
// IMPORTANT
// - KPI payloads arrive under MSG.data.other (not system)
// - Omit undefined query params (exactOptionalPropertyTypes-safe)
// ============================================================================

import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

import { environment } from "../../../../environments/environment";

import type { MSG } from "../../../types/api-message.types";
import type {
  TeamKpiQuery,
  TeamManagementKpiKey
} from "../../../types/team-management/kpis/team-kpi.types";

@Injectable({ providedIn: "root" })
export class TeamKpiRestService {
  private readonly baseUrl: string;

  public constructor(private readonly http: HttpClient) {
    // Router lives under Team Management mount
    this.baseUrl = this.safeJoin(environment.apiOrigin, "/api-team-management/kpi");
  }

  /**
   * Load KPI keys + allowed scopes + labels.
   *
   * Response:
   * - MSG.data.other.keys: TeamKpiKeyInfoDto[]
   */
  public listKeys(): Observable<MSG> {
    const url = this.safeJoin(this.baseUrl, "/keys");
    return this.http.get<MSG>(url);
  }

  /**
   * Load single KPI metric snapshot by key.
   *
   * @param key
   * - Expected: TeamManagementKpiKey (strict union)
   *
   * @param query
   * - Expected: scope,targetId,from,to (+ optional filters)
   *
   * Response:
   * - MSG.data.other.metric: value mapped by key
   */
  public getMetric<K extends TeamManagementKpiKey>(
    key: K,
    query: TeamKpiQuery
  ): Observable<MSG> {
    const url = this.safeJoin(this.baseUrl, `/metric/${encodeURIComponent(key)}`);
    const params = this.toParams(query);
    return this.http.get<MSG>(url, { params });
  }

  /**
   * Compute multiple KPIs in one request (dashboard optimization).
   *
   * @param keys
   * - Expected: non-empty TeamManagementKpiKey[]
   *
   * @param query
   * - Expected: scope,targetId,from,to (+ optional filters)
   *
   * Response:
   * - MSG.data.other.results: Record<key, value|{error}>
   */
  public batch(
    keys: TeamManagementKpiKey[],
    query: TeamKpiQuery
  ): Observable<MSG> {
    const url = this.safeJoin(this.baseUrl, "/batch");
    const params = this.toParams(query);
    return this.http.post<MSG>(url, { keys }, { params });
  }

  /**
   * Member profile endpoint (existing controller route inside KPI router).
   * Keep it generic until you finalize the profile DTO.
   */
  public getMemberProfile(query?: {
    teamCode?: string;
    userId?: string;
    username?: string;
  }): Observable<MSG> {
    const url = this.safeJoin(this.baseUrl, "/member-profile");
    const params = query ? this.toParams(query) : undefined;
    return this.http.get<MSG>(url, params ? { params } : undefined);
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
