// Path: src/app/types/team-management/kpis/team-kpi.types.ts
// ============================================================================
// Team Management KPI Types (Frontend Mirror) — DTO-safe + key-driven
// ----------------------------------------------------------------------------
// Backend reference:
// - src/api/teamManagement/teamKpi.router.ts
// - src/KPIs/teamManagement/kpi.keys.ts
//
// Key rules
// - KPI results come via MSG.data.other (NOT system)
// - exactOptionalPropertyTypes-safe: optional props must be omitted (not undefined)
// - Dates are ISO strings in query; backend parses into Date
// ============================================================================

export type ISODateString = string;

// ----------------------------------------------------------------------------
// KPI Scopes (backend kpi.types.ts)
// ----------------------------------------------------------------------------
export type KpiScope = "member" | "team" | "org";

// ----------------------------------------------------------------------------
// Team KPI Keys (backend TM_KPI_KEYS)
// ----------------------------------------------------------------------------
export const TM_KPI_KEYS = [
  "tm.teamMain.teamCount",
  "tm.teamMain.memberCount",
  "tm.teamMain.activeTeams",

  "tm.teamTask.completionRate",
  "tm.teamTask.overdueCount",
  "tm.teamTask.topOverdueHolders",

  "tm.workItem.statusDistribution",
  "tm.workItem.priorityDistribution",
  "tm.workItem.completedCount",

  "tm.workEvent.eventCount",
  "tm.workEvent.todayCount",
  "tm.workEvent.typeDistribution",

  "tm.milestone.completedRate",
  "tm.milestone.activeCount",
  "tm.milestone.overdueCount",

  "tm.memberActivity.activeUsers",
  "tm.memberActivity.activityCount",
  "tm.memberActivity.topActiveUsers",
] as const;

export type TeamManagementKpiKey = (typeof TM_KPI_KEYS)[number];

// ----------------------------------------------------------------------------
// /keys endpoint output
// ----------------------------------------------------------------------------
export interface TeamKpiKeyInfoDto {
  key: TeamManagementKpiKey;
  scopes: KpiScope[];
  label: string;
}

// ----------------------------------------------------------------------------
// Query (metric + batch) — matches router parseTarget/parseWindow/parseFilters
// ----------------------------------------------------------------------------
export interface TeamKpiTargetQuery {
  scope: KpiScope;
  targetId: string; // member: userId, team: teamCode/teamMongoId, org: orgId-like (module decides)
}

export interface TeamKpiWindowQuery {
  from: ISODateString;
  to: ISODateString;
}

/**
 * Optional filters (router supports these keys; omit if not used)
 * - teamId, priority, status, type, domain
 */
export interface TeamKpiFiltersQuery {
  teamId?: string;
  priority?: string;
  status?: string;
  type?: string;
  domain?: string;
}

export type TeamKpiQuery = TeamKpiTargetQuery & TeamKpiWindowQuery & TeamKpiFiltersQuery;

// ----------------------------------------------------------------------------
// KPI Value Shapes (derived from backend services)
// ----------------------------------------------------------------------------

// TeamMain
export interface KpiCountTotal {
  total: number;
}

// TeamTask
export interface KpiCompletionRate {
  completed: number;
  total: number;
  rate: number; // percent (0..100, 2 decimals)
}
export interface KpiOverdueCount {
  overdue: number;
}
export interface KpiTopOverdueHoldersRow {
  userId: string;
  overdue: number;
}

// WorkItem
export interface KpiDistributionRow {
  status?: string;
  priority?: string;
  type?: string;
  count: number;
}
export interface KpiCompletedCount {
  completed: number;
}

// WorkEvent
export interface KpiTodayCount {
  today: number;
}

// Milestone
export interface KpiActiveCount {
  active: number;
}

// MemberActivity
export interface KpiTopActiveUsersRow {
  userId: string;
  count: number;
}

// ----------------------------------------------------------------------------
// Key → Value Map (strong typing per key)
// ----------------------------------------------------------------------------
export interface TeamKpiValueMap {
  "tm.teamMain.teamCount": KpiCountTotal;
  "tm.teamMain.memberCount": KpiCountTotal;
  "tm.teamMain.activeTeams": KpiCountTotal;

  "tm.teamTask.completionRate": KpiCompletionRate;
  "tm.teamTask.overdueCount": KpiOverdueCount;
  "tm.teamTask.topOverdueHolders": KpiTopOverdueHoldersRow[];

  "tm.workItem.statusDistribution": Array<{ status: string; count: number }>;
  "tm.workItem.priorityDistribution": Array<{ priority: string; count: number }>;
  "tm.workItem.completedCount": KpiCompletedCount;

  "tm.workEvent.eventCount": KpiCountTotal;
  "tm.workEvent.todayCount": KpiTodayCount;
  "tm.workEvent.typeDistribution": Array<{ type: string; count: number }>;

  "tm.milestone.completedRate": KpiCompletionRate;
  "tm.milestone.activeCount": KpiActiveCount;
  "tm.milestone.overdueCount": KpiOverdueCount;

  "tm.memberActivity.activeUsers": KpiCountTotal;
  "tm.memberActivity.activityCount": KpiCountTotal;
  "tm.memberActivity.topActiveUsers": KpiTopActiveUsersRow[];
}

// ----------------------------------------------------------------------------
// Batch response shape (engine returns Record<key, value|error>)
// ----------------------------------------------------------------------------
export interface TeamKpiBatchError {
  error: string;
}

export type TeamKpiBatchResults = Partial<
  Record<TeamManagementKpiKey, TeamKpiValueMap[TeamManagementKpiKey] | TeamKpiBatchError>
>;

// ----------------------------------------------------------------------------
// API "other" payloads (MSG.data.other.*)
// ----------------------------------------------------------------------------
export interface TeamKpiOtherKeys {
  keys: TeamKpiKeyInfoDto[];
}

export interface TeamKpiOtherMetric<K extends TeamManagementKpiKey> {
  metric: TeamKpiValueMap[K];
}

export interface TeamKpiOtherBatch {
  results: TeamKpiBatchResults;
}
