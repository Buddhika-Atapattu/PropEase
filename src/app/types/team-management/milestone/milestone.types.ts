// Path: src/app/types/team-management/milestone/milestone.types.ts
// ============================================================================
// Milestone Types (Frontend Mirror) — DTO-safe contract
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
export const MILESTONE_STATUS = [ "planned", "in_progress", "completed", "cancelled" ] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUS)[number];

export const MILESTONE_PRIORITY = ["low", "medium", "high", "urgent"] as const;
export type MilestonePriority = (typeof MILESTONE_PRIORITY)[number];

// ----------------------------------------------------------------------------
// Attachments / evidence
// ----------------------------------------------------------------------------
export interface MilestoneFileMetaDto {
  relPath: string;
  url: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt?: ISODateString;
  label?: string;
}

export interface MilestoneAttachmentDto {
  id?: string;
  label: string;
  file: MilestoneFileMetaDto;

  storageKey?: string;
  uploadedByUserId?: string;
  uploadedByUsername?: string;
  uploadedAt?: ISODateString;
}

// ----------------------------------------------------------------------------
// Minimal user snapshot
// ----------------------------------------------------------------------------
export interface MilestoneUserMiniDto {
  userId: string;
  username: string;

  displayName?: string;
  email?: string;
  photoUrl?: string;
}

// ----------------------------------------------------------------------------
// Milestone DTO
// ----------------------------------------------------------------------------
export interface MilestoneDto {
  _id: string;

  // grouping
  teamCode: string;
  teamMongoId?: string;
  domain?: string;

  // content
  title: string;
  description?: string;

  status: MilestoneStatus;
  priority: MilestonePriority;

  // scheduling
  targetAt: ISODateString;
  completedAt?: ISODateString;

  // ownership
  createdByUserId?: string;
  createdByUsername?: string;

  ownerUserId?: string | null;
  ownerUsername?: string | null;
  ownerUser?: MilestoneUserMiniDto | null;

  // optional participants
  participantUserIds?: string[];
  participantUsernames?: string[];
  participantUsers?: MilestoneUserMiniDto[];

  // optional attachments
  attachments?: MilestoneAttachmentDto[];

  // audit
  createdAt: ISODateString;
  updatedAt: ISODateString;
  isActive?: boolean;
}

// ----------------------------------------------------------------------------
// REST payloads
// ----------------------------------------------------------------------------
export interface MilestoneCreateRequest {
  teamCode: string;

  title: string;
  description?: string;

  status?: MilestoneStatus;
  priority?: MilestonePriority;

  targetAt: ISODateString;

  ownerUserId?: string | null;
  participantUserIds?: string[];
}

export interface MilestoneUpdateRequest {
  title?: string;
  description?: string;

  status?: MilestoneStatus;
  priority?: MilestonePriority;

  targetAt?: ISODateString;
  completedAt?: ISODateString;

  ownerUserId?: string | null;
  participantUserIds?: string[];
}

// ----------------------------------------------------------------------------
// List filters
// ----------------------------------------------------------------------------
export interface MilestoneListQuery {
  teamCode?: string;
  teamMongoId?: string;

  status?: MilestoneStatus;
  priority?: MilestonePriority;

  from?: ISODateString;
  to?: ISODateString;

  q?: string;

  page?: number;
  limit?: number;
}
