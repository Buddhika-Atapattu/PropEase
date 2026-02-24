// Path: src/app/services/teamManagement/teamMain/team-main.rest.service.ts
// ============================================================================
// TeamMainRestService (FIXED to return MSG envelope)
// ----------------------------------------------------------------------------
// PURPOSE
// - Team MAIN REST calls using backend → frontend MSG<ApiData> envelope.
// - Uses system slices: TeamManagementApiData → system.team / system.teams
//
// RESPONSE SHAPE
// - Observable<MSG<TeamManagementApiData>>
//   where msg.data?.system?.team | teams contains TeamMainDto / TeamMainDto[]
//
// IMPORTANT
// - exactOptionalPropertyTypes-safe: we omit undefined keys from PATCH payloads.
// - For counts endpoints, backend often returns totals under data.other.total.
// ============================================================================

import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

import type { MSG, TeamManagementApiData } from "../../../types/api-message.types";

import type {
  TeamDomain,
  TeamMainCreateRequest,
  TeamMainUpdateRequest,
} from "../../../types/team-management/teamMain/team-main.types";

import { environment } from "../../../../environments/environment";

@Injectable({ providedIn: "root" })
export class TeamMainRestService {
  private readonly baseUrl: string;

  public constructor(private readonly http: HttpClient) {
    this.baseUrl = this.safeJoin(environment.apiOrigin, "/api-team-management");
  }

  /**
   * Create a new team.
   *
   * @param payload
   * - Expected: TeamMainCreateRequest
   * - Usage: backend returns MSG with system.team (enriched TeamMainDto)
   */
  public createTeam(payload: FormData): Observable<MSG<TeamManagementApiData>> {
    const url = this.safeJoin(this.baseUrl, "/create");
    return this.http.post<MSG<TeamManagementApiData>>(url, payload);
  }

  /**
   * Get a team by teamName.
   *
   * @param teamName
   * - Expected: exact team name string (URL-safe)
   * - Usage: backend returns MSG with system.team
   */
  public getByTeamName(teamName: string): Observable<MSG<TeamManagementApiData>> {
    const url = this.safeJoin(this.baseUrl, `/teamName/${encodeURIComponent(teamName)}`);
    return this.http.get<MSG<TeamManagementApiData>>(url);
  }

  /**
   * List all teams.
   * - Usage: backend returns MSG with system.teams
   */
  public listAllTeams(): Observable<MSG<TeamManagementApiData>> {
    const url = this.safeJoin(this.baseUrl, "/all");
    return this.http.get<MSG<TeamManagementApiData>>(url);
  }

  /**
   * Get a team by teamCode.
   * - Usage: backend returns MSG with system.team
   */
  public getByTeamCode(teamCode: string): Observable<MSG<TeamManagementApiData>> {
    const url = this.safeJoin(this.baseUrl, `/${encodeURIComponent(teamCode)}`);
    return this.http.get<MSG<TeamManagementApiData>>(url);
  }

  /**
   * Update team by teamCode.
   *
   * @param teamCode
   * - Expected: stable team code
   *
   * @param payload
   * - Expected: partial TeamMainUpdateRequest
   * - Rule: DO NOT pass undefined values (omit them)
   *
   * - Usage: backend returns MSG with system.team (updated + enriched)
   */
  public updateTeam(
    teamCode: string,
    payload: FormData
  ): Observable<MSG<TeamManagementApiData>> {
    const url = this.safeJoin(this.baseUrl, `/update/${encodeURIComponent(teamCode)}`);
    const safePayload = this.omitUndefined(payload); // ✅ now compiles
    return this.http.patch<MSG<TeamManagementApiData>>(url, safePayload);
  }

  /**
   * Delete team by teamCode.
   * - Usage: backend typically returns success message + possibly other payload.
   */
  public deleteTeam(teamCode: string): Observable<MSG<TeamManagementApiData>> {
    const url = this.safeJoin(this.baseUrl, `/delete/${encodeURIComponent(teamCode)}`);
    return this.http.delete<MSG<TeamManagementApiData>>(url);
  }

  /**
   * Upload team logo (multipart/form-data).
   *
   * @param teamCode
   * - Expected: team code
   *
   * @param file
   * - Expected: image file
   *
   * IMPORTANT
   * - Field name MUST match backend multer field name.
   * - Keep "logo" unless your backend uses a different field.
   *
   * - Usage: backend returns MSG with system.team
   */
  public uploadTeamLogo(teamCode: string, file: File): Observable<MSG<TeamManagementApiData>> {
    const url = this.safeJoin(this.baseUrl, `/upload/logo/${encodeURIComponent(teamCode)}`);

    const fd = new FormData();
    fd.append("logo", file);

    return this.http.post<MSG<TeamManagementApiData>>(url, fd);
  }

  /**
   * Team totals (global).
   * - Usage: backend returns MSG with data.other.total (most common)
   */
  public getTeamTotals(): Observable<MSG<TeamManagementApiData>> {
    const url = this.safeJoin(this.baseUrl, "/stats/teams-total");
    return this.http.get<MSG<TeamManagementApiData>>(url);
  }

  /**
   * Team totals by domain.
   * - Usage: backend returns MSG with data.other.total
   */
  public getTeamTotalsByDomain(domain: TeamDomain): Observable<MSG<TeamManagementApiData>> {
    const url = this.safeJoin(this.baseUrl, `/stats/teams-total/domain/${encodeURIComponent(domain)}`);
    return this.http.get<MSG<TeamManagementApiData>>(url);
  }

  /**
   * Users with NO team (list).
   * - Usage: backend returns MSG with system.users OR other list depending on controller.
   * - For now keep envelope typed; you’ll finalize SystemData keys later.
   */
  public listUsersNoTeam(domain?: TeamDomain): Observable<MSG> {
    const url = domain
      ? this.safeJoin(this.baseUrl, `/users/no-team/domain/${encodeURIComponent(domain)}`)
      : this.safeJoin(this.baseUrl, "/users/no-team");

    return this.http.get<MSG>(url);
  }

  /**
   * Users with NO team (count).
   * - Usage: backend returns MSG with data.other.total
   */
  public countUsersNoTeam(domain?: TeamDomain): Observable<MSG> {
    const url = domain
      ? this.safeJoin(this.baseUrl, `/users/no-team/domain/${encodeURIComponent(domain)}/count`)
      : this.safeJoin(this.baseUrl, "/users/no-team/count");

    return this.http.get<MSG>(url);
  }

  /**
   * Users IN teams (list).
   */
  public listUsersInTeams(domain?: TeamDomain): Observable<MSG> {
    const url = domain
      ? this.safeJoin(this.baseUrl, `/users/in-teams/domain/${encodeURIComponent(domain)}`)
      : this.safeJoin(this.baseUrl, "/users/in-teams");

    return this.http.get<MSG>(url);
  }

  /**
   * Users IN teams (count).
   */
  public countUsersInTeams(domain?: TeamDomain): Observable<MSG> {
    const url = domain
      ? this.safeJoin(this.baseUrl, `/users/in-teams/domain/${encodeURIComponent(domain)}/count`)
      : this.safeJoin(this.baseUrl, "/users/in-teams/count");

    return this.http.get<MSG>(url);
  }

  /**
   * Users ALL (list).
   */
  public listAllUsers(): Observable<MSG> {
    const url = this.safeJoin(this.baseUrl, "/users/all");
    return this.http.get<MSG>(url);
  }

  // ===========================================================================
  // Internals (class-based helpers; TS strict-safe)
  // ===========================================================================

  private safeJoin(a: string, b: string): string {
    const a2 = a.endsWith("/") ? a.slice(0, -1) : a;
    const b2 = b.startsWith("/") ? b : `/${b}`;
    return `${a2}${b2}`;
  }

  /**
   * Omit undefined keys (exactOptionalPropertyTypes-safe).
   *
   * @param obj
   * - Expected: any plain object (DTO/payload)
   * - Usage: remove keys where value is undefined so PATCH doesn't accidentally overwrite.
   */
  private omitUndefined<T extends object>(obj: T): Partial<T> {
    const out: Partial<T> = {};

    // Key trick:
    // - Object.keys returns string[]
    // - We cast to (keyof T)[] so TS understands indexing is valid.
    for (const k of Object.keys(obj) as Array<keyof T>) {
      const v = obj[k];
      if (v !== undefined) {
        out[k] = v;
      }
    }

    return out;
  }
}
