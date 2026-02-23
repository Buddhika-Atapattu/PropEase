// Path: src/app/types/team-management/team-task/team-task.types.ts
// =============================================================================
// Team Task Types (FE ↔ BE aligned)
// -----------------------------------------------------------------------------
// Mirrors: src/models/teamManagement/teamTask.types.ts (backend)
// Rules:
// - NO mongoose Types here (ObjectId => string)
// - NO Date objects here (Date => ISODateString)
// - Optional fields are OMITTED (never undefined)
// =============================================================================

import type { User } from "../../../services/APIs/apis.service";
import type {
  ISODateString,
  Address,
  GeoLocation,
  FileMetaPacket,
} from "../../common";
import {TeamDomain} from '../team-main/team-management.types'

// ─────────────────────────────────────────────
// Deadline policy (formerly SLA)
// ─────────────────────────────────────────────

export type TaskUrgencyLevel = "low" | "medium" | "high" | "critical";

export interface TaskDeadlinePolicyDto {
  dueAt?: ISODateString | null;
  breachAt?: ISODateString | null;
  urgency?: TaskUrgencyLevel | null;
}

// ─────────────────────────────────────────────
// Task enums
// ─────────────────────────────────────────────

export const TASK_STATUSES = [
  "draft",
  "pending",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
  "completed_pending_confirmation",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

// ─────────────────────────────────────────────
// Task timing (anchors for KPI / lifecycle)
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Runtime metrics (KPI-ready)
// ─────────────────────────────────────────────

export interface TaskRuntimeMetricsDto {
  effortPoints?: number;
  complexity?: number;

  estimatedMinutes?: number;
  actualMinutes?: number;

  reopenedCount?: number;
  rejectedCount?: number;

  customerSatisfactionScore?: number;
  supervisorQualityScore?: number;
}

// ─────────────────────────────────────────────
// Audit meta (security + analytics)
// ─────────────────────────────────────────────

export type WorkSource = "ui" | "system" | "automation" | "import";

export interface TaskAuditMetaDto {
  source?: WorkSource;

  requestId?: string;
  deviceId?: string;

  createdByUserId?: string;
  createdByUsername?: User["username"];

  lastUpdatedByUserId?: string;
  lastUpdatedByUsername?: User["username"];
}

// ─────────────────────────────────────────────
// Blocked window
// ─────────────────────────────────────────────

export interface TaskBlockedWindowDto {
  from: ISODateString;
  to?: ISODateString | null;

  reason?: string | null;

  setByUserId?: string;
  setByUsername?: User["username"];
}

// ─────────────────────────────────────────────
// Assignee history
// ─────────────────────────────────────────────

export interface TaskAssigneeHistoryEntryDto {
  userId: string;
  username: User["username"];

  from: ISODateString;
  to?: ISODateString | null;

  changedByUserId?: string;
  changedByUsername?: User["username"];

  reason?: string | null;
}

// ─────────────────────────────────────────────
// Completion confirmation
// ─────────────────────────────────────────────

export type CompletionSignerRole = "customer" | "supervisor";

export type CompletionConfirmationStatus =
  | "not_required"
  | "pending"
  | "rejected"
  | "confirmed";

export interface TaskCompletionSignatureDto {
  role: CompletionSignerRole;

  signerUserId?: string;
  signerUsername?: User["username"];
  signerName?: string;

  signatureFile?: FileMetaPacket;
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
  confirmedByUsername?: User["username"];

  rejectedAt?: ISODateString;
  rejectedByUserId?: string;
  rejectedByUsername?: User["username"];

  rejectReason?: string;
}

// ─────────────────────────────────────────────
// Evidence
// ─────────────────────────────────────────────

/**
 * FE-safe evidence:
 * - In JSON payloads: file is FileMetaBase
 * - In UI: you may temporarily hold File (never send File via JSON)
 */
export interface TaskEvidenceDto {
  name: string;

  file?: FileMetaPacket | File;

  url?: string;
  storageKey?: string;

  uploadedById?: string;
  uploadedByName?: User["username"];
  uploadedAt?: ISODateString;
}

// ─────────────────────────────────────────────
// Generic list wrapper (your standard pattern)
// ─────────────────────────────────────────────

export interface ListResult<T> {
  items: T[];
  other: { total: number };
}

export interface PaginationInput {
  page: number;
  limit: number;
  skip?: number;
}

export type TeamTaskSortKey =
  | "createdAt"
  | "updatedAt"
  | "name"
  | "status"
  | "priority"
  | "dueAt"
  | "workItemCount";

export type SortDirection = "asc" | "desc";

export interface TeamTaskSortInput {
  key: TeamTaskSortKey;
  dir: SortDirection;
}

export type TeamTaskLoadMode = "minimal" | "full" | "users" | "advanced";

// ─────────────────────────────────────────────
// Filters (FE/API)
// ─────────────────────────────────────────────

export interface TeamTaskFilterInput {
  teamCode?: string;
  teamMongoId?: string;

  domain?: TeamDomain;

  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];

  assignedMemberId?: string;
  assignedCaptainId?: string;

  label?: string;

  text?: string;

  createdFrom?: ISODateString;
  createdTo?: ISODateString;

  updatedFrom?: ISODateString;
  updatedTo?: ISODateString;

  dueFrom?: ISODateString;
  dueTo?: ISODateString;

  hasEvidence?: boolean;
  isActiveOnly?: boolean;
}

// ─────────────────────────────────────────────
// User-lite DTOs for getTaskUsers (FE)
// ─────────────────────────────────────────────

export interface TaskUserLiteDto {
  userId: string;
  username: User["username"];

  fullName?: string;
  email?: string;
  phone?: string;

  role?: string;
  isActive?: boolean;

  imageUrl?: string;
}

export interface TaskUsersResultDto {
  captain?: TaskUserLiteDto | null;
  members: TaskUserLiteDto[];
  other: { memberTotal: number };
}

// ─────────────────────────────────────────────
// TeamTask DTO (FE canonical)
// ─────────────────────────────────────────────

export interface TeamTaskDto {
  taskMongoId: string; // String(_id)
  id: string;

  teamCode: string;
  teamMongoId: string;
  domain: TeamDomain;

  name: string;
  description: string;

  location?: GeoLocation;
  address?: Address;

  assignedMembers?: string[];
  assignedTaskCaptain?: string;

  workItemMongoIds?: string[];
  workItemCount: number;

  status: TaskStatus;
  priority: TaskPriority;

  plannedStartAt?: ISODateString | null;
  plannedEndAt?: ISODateString | null;

  timing: TaskTimingDto;

  deadlinePolicy?: TaskDeadlinePolicyDto;

  metrics?: TaskRuntimeMetricsDto;

  blockedWindows?: TaskBlockedWindowDto[];
  assigneeHistory?: TaskAssigneeHistoryEntryDto[];

  completionConfirmation?: TaskCompletionConfirmationDto;

  evidence?: TaskEvidenceDto[];

  notes?: string;
  labels?: string[];

  audit?: TaskAuditMetaDto;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ─────────────────────────────────────────────
// Create / Update inputs (FE/API)
// ─────────────────────────────────────────────

export interface CreateTeamTaskInputDto {
  id: string;

  teamCode: string;
  teamMongoId: string;
  domain: TeamDomain;

  name: string;
  description: string;

  location?: GeoLocation;
  address?: Address;

  assignedMembers?: string[];
  assignedTaskCaptain?: string;

  workItemMongoIds?: string[];
  workItemCount: number;

  status: TaskStatus;
  priority: TaskPriority;

  plannedStartAt?: ISODateString | null;
  plannedEndAt?: ISODateString | null;

  timing: TaskTimingDto;

  deadlinePolicy?: TaskDeadlinePolicyDto;

  metrics?: TaskRuntimeMetricsDto;

  blockedWindows?: TaskBlockedWindowDto[];
  assigneeHistory?: TaskAssigneeHistoryEntryDto[];

  completionConfirmation?: TaskCompletionConfirmationDto;

  evidence?: TaskEvidenceDto[];

  notes?: string;
  labels?: string[];

  audit?: TaskAuditMetaDto;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface UpdateTeamTaskInputDto {
  name?: string;
  description?: string;
  domain?: TeamDomain | null;

  location?: GeoLocation | null;
  address?: Address | null;

  assignedMembers?: string[] | null;
  assignedTaskCaptain?: string | null;

  plannedStartAt?: ISODateString | null;
  plannedEndAt?: ISODateString | null;

  status?: TaskStatus | null;
  priority?: TaskPriority | null;

  timing?: TaskTimingDto | null;

  deadlinePolicy?: TaskDeadlinePolicyDto | null;

  metrics?: TaskRuntimeMetricsDto | null;

  notes?: string | null;
  labels?: string[] | null;

  completionConfirmation?: TaskCompletionConfirmationDto | null;

  audit?: TaskAuditMetaDto | null;
}

// ─────────────────────────────────────────────
// Key-values payload (dropdown/autocomplete)
// ─────────────────────────────────────────────

export interface TeamTaskKeyValuesDto {
  taskMongoId: string;
  id: string;
  name: string;
  status: TaskStatus;
  priority: TaskPriority;
  domain: TeamDomain;
  updatedAt: ISODateString;
}

export interface TeamTaskKeyValuesMetaDto {
  domains: ReadonlyArray<TeamDomain>;
  statuses: ReadonlyArray<TaskStatus>;
  priorities: ReadonlyArray<TaskPriority>;

  distinctLabels?: string[];
}
