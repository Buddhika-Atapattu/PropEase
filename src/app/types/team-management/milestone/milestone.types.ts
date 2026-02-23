// Path: src/app/types/team-management/milestone/milestone.types.ts
// =============================================================================
// Milestone Types (FE ↔ BE aligned)
// Mirrors: src/types/teamManagement/milestones/milestone.types.ts
// Rules:
// - NO mongoose Types here (ObjectId => string)
// - NO Date objects here (Date => ISODateString)
// - Optional fields are OMITTED (never undefined)
// =============================================================================

import type { ISODateString } from "../../common";

// ----------------------------------------------------------------------------
// Enums
// ----------------------------------------------------------------------------

export const MILESTONE_STATUS = [
  "planned",
  "active",
  "done",
  "missed",
  "cancelled",
] as const;

export type MilestoneStatus = (typeof MILESTONE_STATUS)[number];

export const MILESTONE_PRIORITY = ["low", "medium", "high", "urgent"] as const;
export type MilestonePriority = (typeof MILESTONE_PRIORITY)[number];

// ----------------------------------------------------------------------------
// Evidence packet
// ----------------------------------------------------------------------------

export interface MilestoneEvidenceDto {
  label: string;
  relPath: string;
  url: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
  uploadedAt: ISODateString;
}

// ----------------------------------------------------------------------------
// Milestone DTO (FE)
// ----------------------------------------------------------------------------

export type MilestoneSource = "rest" | "ws" | "system";

export interface MilestoneDto {
  milestoneMongoId: string; // String(_id)

  // Relations (string IDs)
  workItemMongoId: string;
  teamMongoId: string;

  // Owner (member who planned this)
  userMongoId: string;

  // Audit
  createdByUserMongoId: string;
  updatedByUserMongoId?: string;

  requestId?: string;
  source?: MilestoneSource;

  // Planning fields
  title: string;
  notes?: string;

  startAt: ISODateString;
  endAt: ISODateString;
  allDay: boolean;
  timezone?: string;

  status: MilestoneStatus;
  priority: MilestonePriority;

  // Optional progress target impact
  progressTarget?: number;

  // Optional tags
  tags?: string[];

  // Optional evidence
  evidence?: MilestoneEvidenceDto[];

  // Timestamps
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
