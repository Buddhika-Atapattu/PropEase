// Path: src/app/types/team-management/member-activities/member-activities.types.ts
// =============================================================================
// Member Activities Types (FE ↔ BE aligned)
// Mirrors: src/types/teamManagement/memberActivities/memberActivities.types.ts
// Rules:
// - NO mongoose Types here (ObjectId => string)
// - NO Date objects here (Date => ISODateString)
// - Optional fields are OMITTED (never undefined)
// =============================================================================

import type { ISODateString } from "../../common"

// ----------------------------------------------------------------------------
// Enums
// ----------------------------------------------------------------------------

export const MEMBER_ACTIVITY_TYPE = [
  "milestone",
  "progress_update",
  "status_change",
  "blocker_reported",
  "evidence_added",
  "note",
] as const;

export type MemberActivityType = (typeof MEMBER_ACTIVITY_TYPE)[number];

export const MEMBER_ACTIVITY_STATUS = [
  "planned",
  "active",
  "done",
  "missed",
  "cancelled",
] as const;

export type MemberActivityStatus = (typeof MEMBER_ACTIVITY_STATUS)[number];

// ----------------------------------------------------------------------------
// Evidence packet
// ----------------------------------------------------------------------------

export interface MemberActivityEvidenceDto {
  label: string;
  relPath: string;
  url: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
  uploadedAt: ISODateString;
}

// ----------------------------------------------------------------------------
// Blocker structure
// ----------------------------------------------------------------------------

export type MemberActivityBlockerSeverity = "low" | "medium" | "high";

export interface MemberActivityBlockerDto {
  title: string;
  details?: string;
  severity: MemberActivityBlockerSeverity;

  reportedAt: ISODateString;
  resolvedAt?: ISODateString;
}

// ----------------------------------------------------------------------------
// MemberActivity DTO (FE)
// ----------------------------------------------------------------------------

export type MemberActivitySource = "rest" | "ws" | "system";

export interface MemberActivityDto {
  activityMongoId: string; // String(_id)

  // Relations (string IDs)
  workItemMongoId: string;
  teamMongoId: string;
  userMongoId: string;

  // Audit
  createdByUserMongoId: string;
  requestId?: string;
  source?: MemberActivitySource;

  // Activity classification
  type: MemberActivityType;

  // Calendar event fields
  title: string;
  notes?: string;

  startAt: ISODateString;
  endAt: ISODateString;
  allDay: boolean;
  timezone?: string;

  status: MemberActivityStatus;

  // Optional progress impact
  progressBefore?: number;
  progressAfter?: number;

  // Optional milestone identifier
  milestoneId?: string;

  // Evidence / blockers
  evidence?: MemberActivityEvidenceDto[];
  blockers?: MemberActivityBlockerDto[];

  // Timestamps
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
