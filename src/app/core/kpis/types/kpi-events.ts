// ============================================================================
// KPI event types delivered via realtime channel (invalidate + future snapshot)
// ============================================================================

export type KpiScope = 'organisation' | 'branch' | 'property' | 'team' | 'member' | 'maintenance';

export interface KpiInvalidateEvent {
  kind: 'kpi_scope_invalidated';
  // topic already provides scope + id, but signal has useful metadata
  signal: {
    type: string;
    domain: string;
    scope: string;
    targetId: string;
    occurredAtISO: string;
    reason: string;

    orgId?: string;
    branchId?: string;
    regionId?: string;
    teamId?: string;
    memberId?: string;
    propertyId?: string;
  };
}
