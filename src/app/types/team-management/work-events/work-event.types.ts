// Path: src/app/types/team-management/work-events/work-event.types.ts
// =============================================================================
// WorkEvent — Frontend Types (FE ↔ BE aligned)
// -----------------------------------------------------------------------------
// Mirrors backend DTO contract exported from:
//   src/models/teamManagement/workEvent.model.ts  (WorkEventDto)
// and uses shared enums from:
//   - TeamMain: TeamDomain
//   - WorkItem: WorkItemPriority / WorkItemStatus
//
// Rules:
// - NO mongoose Types here (ObjectId => string)
// - Dates are ISODateString (NOT Date objects)
// - Optional fields are OMITTED (never undefined)
// =============================================================================

import type { ISODateString } from "../../common";
import type { TeamDomain } from "../team-main/team-management.types";
import type {
  WorkItemPriority,
  WorkItemStatus,
} from "../work-items/work-item.types";

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

export type WorkEventKind =
  | "workitem_created"
  | "status_changed"
  | "priority_changed"
  | "assigned_members_changed"
  | "value_updated"
  | "evidence_added"
  | "comment_added"
  | "team_changed"
  | "domain_changed"
  // KPI-ready extensions
  | "sla_updated"
  | "blocked"
  | "unblocked"
  | "timer_started"
  | "timer_stopped"
  | "completion_requested"
  | "completion_confirmed"
  | "completion_rejected"
  | "reopened";

export type WorkEventSource = "ui" | "system" | "automation" | "import";

// ─────────────────────────────────────────────
// Delta + Snapshot
// ─────────────────────────────────────────────

export interface WorkEventDeltaDto {
  /** ex: "status", "priority", "assignedMembers", "sla.dueAt" */
  field: string;

  from?: unknown;
  to?: unknown;
}

export interface WorkEventSnapshotDto {
  teamName?: string;
  teamCode?: string;

  domain?: TeamDomain;

  workItemName?: string;
  workItemType?: string;

  assigneeUserIds?: string[];
  assigneeUsernames?: string[];

  priority?: WorkItemPriority;
  status?: WorkItemStatus;
}

// ─────────────────────────────────────────────
// DTO (Lean-safe API contract) ✅
// ─────────────────────────────────────────────

export interface WorkEventDto {
  workItemId: string;
  workItemMongoId: string;

  teamId: string;
  teamMongoId: string;

  domain: TeamDomain;

  kind: WorkEventKind;

  actorUserId?: string;
  actorUsername?: string;
  actorRole?: string;

  source?: WorkEventSource;
  requestId?: string;
  deviceId?: string;

  fromStatus?: WorkItemStatus;
  toStatus?: WorkItemStatus;

  fromPriority?: WorkItemPriority;
  toPriority?: WorkItemPriority;

  delta?: WorkEventDeltaDto[];

  payload?: Record<string, unknown>;

  snapshot?: WorkEventSnapshotDto;

  createdAt: ISODateString;

  year: number;
  month: number;
  day: number;
  yearMonth: string;

  weekOfYear?: number;
  hour?: number;
}

// ─────────────────────────────────────────────
// Common list wrapper (matches your backend list style)
// ─────────────────────────────────────────────

export interface ListResult<T> {
  items: T[];
  other: { total: number };
}
