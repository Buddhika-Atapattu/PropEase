// Path: src/app/types/team-management/member-activities/member-activities.types.ts
// ============================================================================
// MemberActivity Types (Frontend Mirror) — DTO-safe contract
// ----------------------------------------------------------------------------
// Key rules
// - No mongoose Types in FE
// - IDs are string
// - Dates are ISO strings
// - exactOptionalPropertyTypes-safe: optional props must be omitted (not undefined)
// ============================================================================

export type ISODateString = string;

// ----------------------------------------------------------------------------
// Enums
// ----------------------------------------------------------------------------
export const MEMBER_ACTIVITY_TYPE = [
  "login",
  "logout",
  "task_created",
  "task_updated",
  "task_completed",
  "work_item_assigned",
  "work_item_updated",
  "event_created",
  "event_updated",
  "comment_added",
  "file_uploaded",
  "status_changed",
  "note",
  "other",
] as const;

export type MemberActivityType = (typeof MEMBER_ACTIVITY_TYPE)[number];

export const MEMBER_ACTIVITY_SEVERITY = [ "info", "success", "warning", "danger" ] as const;
export type MemberActivitySeverity = ( typeof MEMBER_ACTIVITY_SEVERITY )[ number ];

// ----------------------------------------------------------------------------
// Minimal actor snapshot
// ----------------------------------------------------------------------------
export interface MemberActivityActorDto {
  userId: string;
  username: string;

  displayName?: string;
  email?: string;
  photoUrl?: string;
}

// ----------------------------------------------------------------------------
// Target reference (cross-module navigation)
// ----------------------------------------------------------------------------
export interface MemberActivityTargetDto {
  module: string; // e.g. "TeamManagement", "WorkItems", "WorkEvents"
  refId: string;  // domain entity id (string)
  actionKey?: string; // optional deep-link hint
  params?: Record<string, unknown>; // optional navigation params
}

// ----------------------------------------------------------------------------
// MemberActivity DTO
// ----------------------------------------------------------------------------
export interface MemberActivityDto {
  _id: string;

  teamCode?: string;
  teamMongoId?: string;

  actor: MemberActivityActorDto;

  type: MemberActivityType;
  severity: MemberActivitySeverity;

  title: string;
  message?: string;

  target?: MemberActivityTargetDto;

  createdAt: ISODateString;

  // Optional context metadata for audit/analytics (DTO-safe)
  ip?: string;
  userAgent?: string;
}

// ----------------------------------------------------------------------------
// Create payload
// ----------------------------------------------------------------------------
export interface MemberActivityCreateRequest {
  teamCode?: string;
  teamMongoId?: string;

  actorUserId: string;
  actorUsername: string;

  type: MemberActivityType;
  severity?: MemberActivitySeverity;

  title: string;
  message?: string;

  target?: MemberActivityTargetDto;

  ip?: string;
  userAgent?: string;
}

// ----------------------------------------------------------------------------
// List filters
// ----------------------------------------------------------------------------
export interface MemberActivityListQuery {
  teamCode?: string;
  teamMongoId?: string;

  actorUserId?: string;
  actorUsername?: string;

  type?: MemberActivityType;
  severity?: MemberActivitySeverity;

  from?: ISODateString;
  to?: ISODateString;

  q?: string;

  page?: number;
  limit?: number;
}
