// ============================================================================
// KPI DTOs used by REST submission (frontend contract)
// ============================================================================

export type ISODateString = string;

export interface KpiDealFactDto {
  orgId: string;
  agentId: string;

  branchId?: string;
  regionId?: string;
  teamId?: string;
  propertyId?: string;

  dealType: string;
  status: string;
  propertyType?: string;

  dealValue: number;
  commissionAmount: number;
  currencyCode: string;

  closedAtISO: ISODateString;
}

export interface KpiSatisfactionFactDto {
  orgId: string;
  agentId: string;

  branchId?: string;
  regionId?: string;
  teamId?: string;

  rating: number;
  comment?: string;

  submittedAtISO: ISODateString;
}

export interface KpiMaintenanceEventDto {
  orgId: string;
  memberId: string;
  ticketId: string;

  branchId?: string;
  regionId?: string;
  teamId?: string;
  propertyId?: string;

  eventType: string;
  slaMinutes: number;
  priority?: string;

  occurredAtISO: ISODateString;
}

export interface KpiTeamTaskFactDto {
  orgId: string;
  taskId: string;

  assigneeScope: 'team' | 'member';

  branchId?: string;
  regionId?: string;
  teamId?: string;
  memberId?: string;
  propertyId?: string;

  category: string;
  status: string;
  priority?: string;

  title: string;
  description?: string;

  assignedAtISO: ISODateString;
  expectedEndAtISO: ISODateString;

  startedAtISO?: ISODateString;
  completedAtISO?: ISODateString;

  evidenceCount?: number;
  hasEvidence?: boolean;

  lastWarningAtISO?: ISODateString;
  lastWarningLevel?: '75' | '90' | 'overdue';
}

export interface KpiTeamTaskEvidenceDto {
  orgId: string;
  taskId: string;
  evidenceId: string;

  branchId?: string;
  regionId?: string;
  teamId?: string;
  memberId?: string;
  propertyId?: string;

  evidenceType: string;
  ref: string;
  submittedAtISO: ISODateString;
}

export interface KpiTeamTaskEventDto {
  orgId: string;
  taskId: string;
  eventId: string;

  assigneeScope: 'team' | 'member';

  branchId?: string;
  regionId?: string;
  teamId?: string;
  memberId?: string;
  propertyId?: string;

  eventType: string;
  status: string;
  category: string;
  priority?: string;

  occurredAtISO: ISODateString;
  note?: string;
}
