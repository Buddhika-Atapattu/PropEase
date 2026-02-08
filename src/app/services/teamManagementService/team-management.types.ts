// Path: src/app/services/team-management/team-management.types.ts
// ============================================================================
// Team Management Types (FE ↔ BE aligned)
// ----------------------------------------------------------------------------
// Rules:
// - Keep only TYPES + constants here (no service logic).
// - Dates coming from backend JSON are ISO strings (NOT Date objects).
// - "Small feature payloads" (eg: task comment upload results) should be returned
//   in ApiResponse.data.other (NOT in SystemData). This file only defines DTOs.
// ----------------------------------------------------------------------------
// NOTE ON COMMENTS:
// - BE schema currently has `AssignedTask.comment: Comments[]`.
// - We extend FE contract to support optional attachments per comment via:
//     TaskCommentDto.attachments?: TaskEvidenceDto[]
//   (Router can map that into TaskEvidence meta or store as-is if you extend BE.)
// ============================================================================

import type { User } from '../APIs/apis.service';

// ============================================================================
// 0) Core Primitive
// ============================================================================

/** Usage: all backend dates in JSON (createdAt, updatedAt, timing.*) */
export type ISODateString = string;

// ============================================================================
// 1) Shared Addressing / Location Types
//    Usage: AssignedTaskDto.location/address, WorkItem.location/address
// ============================================================================

export interface GeoLocation {
  lat: number;
  lng: number;
  embeddedUrl: string;
}

export interface Address {
  houseNumber?: string;
  street?: string;
  city: string;
  provinceOrState?: string;
  country: string;
}

// ============================================================================
// 2) Shared File Types
//    Usage: Evidence DTOs, comment attachments, signatures, uploads meta
// ============================================================================

export interface FileMetaBase {
  originalName: string;
  storedName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Task evidence item aligned to BE TaskEvidence:
 * - In API payloads: file should be FileMetaBase (JSON).
 * - In UI: you may hold a File object temporarily (TaskEvidenceUI).
 */
export interface TaskEvidenceDto {
  name: string;
  file?: FileMetaBase | File; // allow UI helper usage
  url?: string;
  storageKey?: string;

  uploadedById?: string;
  uploadedByName?: User['username'];
  uploadedAt?: ISODateString;
}

/** Usage: UI-only helper before upload (never send File via JSON) */
export interface TaskEvidenceUI {
  name: string;
  file?: File;

  url?: string;
  storageKey?: string;

  uploadedById?: string;
  uploadedByName?: User['username'];
  uploadedAt?: ISODateString;
}

// ============================================================================
// 3) Team Domain
//    Usage: TeamManagementDto.domain, WorkItem.domain, WorkEvent.domain
// ============================================================================

export type TeamDomain =
  | 'sales'
  | 'development'
  | 'support'
  | 'operations'
  | 'marketing'
  | 'finance'
  | 'other';

export const DEFAULT_TEAM_DOMAINS: ReadonlyArray<TeamDomain> = [
  'development',
  'finance',
  'marketing',
  'operations',
  'other',
  'sales',
  'support',
] as const;

// ============================================================================
// 4) Task Status & Priority
//    Usage: AssignedTaskDto.status / priority
// ============================================================================

export type TaskStatus =
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled'
  | 'completed_pending_confirmation';

export const DEFAULT_TASK_STATUS: ReadonlyArray<TaskStatus> = [
  'blocked',
  'cancelled',
  'draft',
  'pending',
  'in_progress',
  'completed_pending_confirmation',
  'completed',
] as const;

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export const DEFAULT_TASK_PRIORITIES: ReadonlyArray<TaskPriority> = [
  'critical',
  'high',
  'low',
  'medium',
] as const;

// ============================================================================
// 5) Task Completion Confirmation (Customer / Supervisor signatures)
//    Usage: AssignedTaskDto.completionConfirmation
// ============================================================================

export type CompletionSignerRole = 'customer' | 'supervisor';

export type CompletionConfirmationStatus =
  | 'not_required'
  | 'pending'
  | 'rejected'
  | 'confirmed';

export interface TaskCompletionSignatureDto {
  role: CompletionSignerRole;

  signerUserId?: string;
  signerUsername?: string;

  /** customer name / free-text name */
  signerName?: string;

  comment?: string;

  signatureFile?: FileMetaBase;
  signatureUrl?: string;
  signatureStorageKey?: string;

  signedAt?: ISODateString;
}

export interface TaskCompletionConfirmationDto {
  status: CompletionConfirmationStatus;

  requiredRoles?: CompletionSignerRole[];
  signatures?: TaskCompletionSignatureDto[];

  confirmedAt?: ISODateString;
  confirmedByUserId?: string;
  confirmedByUsername?: string;

  rejectedAt?: ISODateString;
  rejectedByUserId?: string;
  rejectedByUsername?: string;
  rejectReason?: string;
}

// ============================================================================
// 6) Task Timing (KPI-ready anchors)
//    Usage: AssignedTaskDto.timing (preferred over root date fields)
// ============================================================================

export interface TaskTimingDto {
  createdAt?: ISODateString | null;
  updatedAt?: ISODateString | null;

  firstResponseAt?: ISODateString | null;
  startedAt?: ISODateString | null;
  lastBlockedAt?: ISODateString | null;

  completedAt?: ISODateString | null;
  confirmedAt?: ISODateString | null;
  cancelledAt?: ISODateString | null;
}

// ============================================================================
// 7) Task Comments (embedded in AssignedTask.comment[])
//    Usage:
//      - DTO rendering: AssignedTaskDto.comment[]
//      - Request payload: AddTaskCommentRequestDto
// ----------------------------------------------------------------------------
// IMPORTANT:
// - BE currently stores: { taskId, commentor, comment, createdAt }
// - FE extends contract with `attachments?: TaskEvidenceDto[]`
//   so router can persist/link attachments if you implement it.
// ============================================================================

export interface TaskCommentDto {
  /** BE: required */
  taskId: string;

  /** BE: required (username string) */
  commentor: string;

  /** BE: required */
  comment: string;

  /** BE: optional (schema default) */
  createdAt?: ISODateString;

  /** FE extension: optional attachments (metadata only) */
  attachments?: TaskEvidenceDto[];
}

/**
 * Payload for POST /api-team-management/task/comment/add/:teamCode/:taskId
 * Router should accept { comment: {...} } OR direct {...}.
 *
 * Attachments are metadata-only objects (NO File object here).
 * The storageKey/url come from the upload endpoint response.
 */
export interface AddTaskCommentRequestDto {
  commentor: User['username'];
  comment: string;

  attachments?: Array<{
    /** optional display name */
    name?: string;

    storageKey: string;
    url: string;

    uploadedAt?: ISODateString;
    uploadedByName?: User['username'];

    fileMeta?: FileMetaBase;
  }>;
}

// ============================================================================
// 8) Assigned Task (Team embedded task)
//    Usage: TeamManagementDto.assignTasks[]
// ============================================================================

export interface AssignedTaskDto {
  id: string;
  name: string;
  description: string;

  location?: GeoLocation;
  address?: Address;

  assignedMembers?: string[];
  assignedTaskCaptain?: string;

  status?: TaskStatus;
  priority?: TaskPriority;

  plannedStartAt?: ISODateString;
  plannedEndAt?: ISODateString;

  /**
   * UI legacy support:
   * BE prefers timing.completedAt. Keep this optional for compatibility if some
   * endpoints still emit it at root level.
   */
  completedAt?: ISODateString;

  completionConfirmation?: TaskCompletionConfirmationDto;

  evidence?: TaskEvidenceDto[];
  notes?: string;

  /** Your task assign router currently supports this field name */
  compliantId?: string;

  /** BE authoritative KPI-ready object */
  timing?: TaskTimingDto;

  /** BE field name is `comment` (array) */
  comment?: TaskCommentDto[];

  /** UI-friendly mirrors (optional) */
  createdAt?: ISODateString | null;
  updatedAt?: ISODateString | null;
}

// ============================================================================
// 9) Team Roles / Membership
//    Usage: TeamMemberDto.roleInTeam, TeamManagementDto.orgType
// ============================================================================

export const TEAM_ROLES = [
  'captain',
  'member',
  'lead',
  'supervisor',
  'observer',
  'mechanic',
  'carpenter',
  'electrician',
  'plumber',
  'technician',
  'welder',
  'driver',
  'cleaner',
  'security',
  'gardener',
  'painter',
  'mason',
  'helper',
] as const;

export type RoleInTeam = (typeof TEAM_ROLES)[number];
export const DEFAULT_ROLES_IN_TEAM: ReadonlyArray<RoleInTeam> = TEAM_ROLES;

export type OrgUnitType = 'team' | 'department' | 'squad' | 'board';

export type UserTeams = {
  teamName: string;
  domain: TeamDomain;
};

export interface TeamMemberDto {
  id: string;
  username: User['username'];

  /** Optional (populated/aggregated DTO) */
  user?: User | null;
  teams?: UserTeams[] | null;

  roleInTeam?: RoleInTeam | null;
  reason?: string | null;
  joinedAt?: ISODateString | null;

  /** optional snapshot fields used by aggregations */
  domain?: TeamDomain | null;
  teamName?: string | null;
  teamReason?: string | null;
}

// ============================================================================
// 10) Team Root DTO (main module DTO)
//     Usage: SystemData.team / teams
// ============================================================================

export interface TeamManagementDto {
  teamCode: string;
  teamName: string;

  orgType?: OrgUnitType;
  domain: TeamDomain;

  description: string;

  members: TeamMemberDto[];
  captain: TeamMemberDto;

  memberTotal: number;

  /** Embedded tasks */
  assignTasks: AssignedTaskDto[];

  /** Team logo uses TaskEvidence DTO shape */
  teamLogo?: TaskEvidenceDto;

  createdAt: ISODateString;
  updatedAt: ISODateString;

  isActive?: boolean;
}

export interface UserWithTeams extends User {
  teams?: UserTeams[];
}

// ============================================================================
// 11) Work Items (BE-aligned to current WorkItem router/model)
//     Usage: SystemData.workItem / workItems
// ============================================================================

export type WorkItemKind =
  | 'sales_lead'
  | 'property_viewing'
  | 'offer_negotiation'
  | 'lease_signing'
  | 'rent_collection'
  | 'marketing_campaign'
  | 'social_post'
  | 'complaint_handling'
  | 'maintenance_job'
  | 'inspection'
  | 'cleaning_job'
  | 'dev_task'
  | 'support_ticket'
  | 'hr_recruitment'
  | 'hr_training'
  | 'hr_performance_review'
  | 'other';

export type WorkItemStatus =
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled'
  | 'backlog'
  | 'open'
  | 'done';

export type WorkItemPriority = 'low' | 'medium' | 'high' | 'critical';

/** Usage: metadata-only evidence on WorkItem (no File object in payload) */
export interface WorkItemEvidenceDto {
  name: string;

  storageKey?: string;
  url?: string;

  uploadedById?: string;
  uploadedByName?: User['username'];
  uploadedAt?: ISODateString;
}

/** Usage: WorkItem.timing (required in BE create; always ISO strings) */
export interface WorkItemTimingDto {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Usage: WorkItem.audit (required on create; BE router writes defaults) */
export interface WorkItemAuditDto {
  source: 'ui' | 'system' | 'api' | string;

  requestId?: string;
  deviceId?: string;

  createdById: string;
  createdByUsername: string;

  lastUpdatedById?: string;
  lastUpdatedByUsername?: string;
}

/** Usage: WorkItem.value (required; always present on create) */
export interface WorkItemValueMetricsDto {
  expectedValue: number;
  actualValue: number;
  commissionAmount: number;
}

export interface WorkItem {
  id: string; // business id like WORK-xxxx
  teamId: string; // teamCode
  teamMongoId: string; // mongo _id string (DTO)
  domain: TeamDomain;

  kind: WorkItemKind;
  status: WorkItemStatus;
  priority: WorkItemPriority;

  createdById: string;
  createdByUsername: string;

  assignedMembers: string[];
  captainUserId?: string;

  propertyId?: string;
  tenantId?: string;
  leaseId?: string;
  complaintId?: string;
  buildingId?: string;

  title: string;
  description: string;

  plannedStartAt?: ISODateString | null;
  plannedEndAt?: ISODateString | null;

  startedAt?: ISODateString | null;
  completedAt?: ISODateString | null;
  cancelledAt?: ISODateString | null;

  timing: WorkItemTimingDto;
  audit: WorkItemAuditDto;

  value: WorkItemValueMetricsDto;

  timeSpentMinutes?: number;

  location?: GeoLocation;
  address?: Address;

  evidence?: WorkItemEvidenceDto[];
  tags?: string[];

  isActive?: boolean;
}

// ============================================================================
// 12) Work Events (FE canonical kinds - must match BE stored values)
//     Usage: SystemData.event / events
// ============================================================================

export type WorkEventKind =
  | 'workitem_created'
  | 'status_changed'
  | 'priority_changed'
  | 'assigned_members_changed'
  | 'value_updated'
  | 'evidence_added'
  | 'comment_added'
  | 'team_changed'
  | 'domain_changed';

export interface WorkEvent {
  workItemId: string;
  workItemMongoId?: string;

  teamId: string; // teamCode
  teamMongoId?: string; // mongo _id string (DTO)

  domain: TeamDomain;
  kind: WorkEventKind;

  actorUserId?: string;
  actorUsername?: string;
  actorRole?: string;

  fromStatus?: WorkItemStatus;
  toStatus?: WorkItemStatus;

  fromPriority?: WorkItemPriority;
  toPriority?: WorkItemPriority;

  payload?: Record<string, unknown>;

  createdAt: ISODateString;

  year?: number;
  month?: number;
  day?: number;
  yearMonth?: string;
}

// ============================================================================
// 13) Member Performance Profile (FE contract)
//     Usage: KPI dashboards / member profile views
// ============================================================================

export type MemberProfileTimeBucket = 'day' | 'week' | 'month';

export interface MemberProfileKpiSummary {
  taskCompletionRatePct: number; // 0..100
  customerSatisfactionPct: number; // 0..100
  supervisorSatisfactionPct: number; // 0..100

  participationScore: number; // 0..100 or raw
  totalActivities: number;

  totalTasksAssigned: number;
  totalTasksCompleted: number;
  totalWorkItemsAssigned: number;
  totalWorkItemsCompleted: number;

  overdueCount: number;
  blockedCount: number;
  cancelledCount: number;
}

export interface MemberProfileKpiTrendPoint {
  bucket: MemberProfileTimeBucket;

  /** "2026-01", "2026-W03", "2026-01-20" */
  bucketKey: string;

  completionRatePct: number;
  customerSatisfactionPct: number;
  supervisorSatisfactionPct: number;

  participationScore: number;
  activities: number;
}

export interface MemberProfileRecentActivity {
  createdAt: ISODateString;

  kind: string;

  teamId?: string;
  teamName?: string;

  workItemId?: string;
  taskId?: string;

  title?: string;
  description?: string;
  payload?: Record<string, unknown>;
}

export interface MemberPerformanceProfileDto {
  memberId: string;
  username: string;

  from: ISODateString;
  to: ISODateString;

  summary: MemberProfileKpiSummary;
  trend: MemberProfileKpiTrendPoint[];
  recentActivities: MemberProfileRecentActivity[];

  byTeam?: Array<{
    teamId: string;
    teamName: string;
    domain: TeamDomain;
    summary: MemberProfileKpiSummary;
  }>;
}
