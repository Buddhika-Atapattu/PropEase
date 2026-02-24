// Path: src/app/services/teamManagement/kpis/team-kpi.ws.service.ts
// ============================================================================
// TeamKpiWsService (client integration point)
// ----------------------------------------------------------------------------
// Backend currently exposes KPI via REST (no KPI-specific socket events).
// This service exists to keep your strict "REST + WS + TYPES" file pattern.
//
// Usage idea:
// - Subscribe to other team WS services (teamTask/workItem/...)
// - When "bulkChanged" or "countsChanged" happens -> call hintReload()
// - KPI dashboard listens to onReloadHint() and triggers REST batch()
// ============================================================================

import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";

import type { TeamManagementKpiKey } from "../../../types/team-management/kpis/team-kpi.types";

export interface TeamKpiReloadHint {
  reason:
    | "team:created"
    | "team:updated"
    | "team:deleted"
    | "teamTask:changed"
    | "workItem:changed"
    | "workEvent:changed"
    | "milestone:changed"
    | "memberActivity:changed"
    | "manual";

  teamCode?: string;
  keysHint?: TeamManagementKpiKey[];
  message?: string;
}

@Injectable({ providedIn: "root" })
export class TeamKpiWsService {
  private readonly reloadHint$ = new Subject<TeamKpiReloadHint>();

  public constructor() {}

  public onReloadHint(): Observable<TeamKpiReloadHint> {
    return this.reloadHint$.asObservable();
  }

  /**
   * Emit an internal reload hint.
   *
   * @param hint.reason
   * - Expected: why KPI should refresh (maps nicely to WS events)
   *
   * @param hint.teamCode
   * - Optional: if refresh is scoped to a team
   *
   * @param hint.keysHint
   * - Optional: if you want to refresh only specific KPI keys
   */
  public hintReload(hint: TeamKpiReloadHint): void {
    // exactOptionalPropertyTypes-safe: emit as-is (caller must omit undefined)
    this.reloadHint$.next(hint);
  }
}
