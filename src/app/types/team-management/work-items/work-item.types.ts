// Path: src/app/types/team-management/work-items/work-item.types.ts
// =============================================================================
// WorkItem — Frontend Types (FE ↔ BE aligned)
// -----------------------------------------------------------------------------
// Mirrors backend:
//   src/types/teamManagement/workItem/workItem.types.ts
//
// Rules:
// - NO mongoose imports
// - ObjectId => string
// - Date => ISODateString
// - Optional fields are omitted (never undefined)
// =============================================================================

import type { ISODateString } from "../../common";

// ----------------------------------------------------------------------------
// Enums (const arrays for strict literal typing)
// ----------------------------------------------------------------------------

export const WORK_ITEM_STATUS = [
  "assigned",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
] as const;

export type WorkItemStatus = (typeof WORK_ITEM_STATUS)[number];

export const WORK_ITEM_PRIORITY = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export type WorkItemPriority = (typeof WORK_ITEM_PRIORITY)[number];

export const DEADLINE_POLICY = ["soft", "hard"] as const;
export type DeadlinePolicy = (typeof DEADLINE_POLICY)[number];

// ----------------------------------------------------------------------------
// Evidence (aligned with backend WorkItemEvidence)
// ----------------------------------------------------------------------------

export interface WorkItemEvidenceDto {
  label: string;

  /** public/uploads/... */
  relPath: string;

  /** FE-friendly URL */
  url: string;

  mimeType: string;
  originalName: string;
  sizeBytes: number;

  uploadedAt: ISODateString;
}

// ----------------------------------------------------------------------------
// Member progress (cached summary for UI)
// ----------------------------------------------------------------------------

export interface WorkItemMemberProgressDto {
  userId: string;

  progress: number; // 0..100

  status: WorkItemStatus;

  lastActivityAt: ISODateString;
}

// ----------------------------------------------------------------------------
// WorkItem DTO (Lean-safe API contract)
// ----------------------------------------------------------------------------

export interface WorkItemDto {
  workItemMongoId: string; // replaces backend _id

  workItemCode: string;

  teamId: string;

  taskId?: string;

  assignedByUserId: string;
  assignedToUserIds: string[];
  assignedAt: ISODateString;

  expectedStartAt?: ISODateString;
  expectedCompleteAt: ISODateString;

  deadlinePolicy: DeadlinePolicy;
  graceMinutes?: number;

  statusCurrent: WorkItemStatus;
  priority: WorkItemPriority;

  progressCurrent: number;

  lastActivityAt?: ISODateString;

  completedAt?: ISODateString;
  completedByUserId?: string;

  memberProgress?: WorkItemMemberProgressDto[];

  completionEvidenceSummary?: WorkItemEvidenceDto[];

  createdByUserId: string;
  updatedByUserId?: string;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ----------------------------------------------------------------------------
// Common list wrapper (optional utility)
// ----------------------------------------------------------------------------

export interface WorkItemListResult {
  items: WorkItemDto[];
  other: { total: number };
}
