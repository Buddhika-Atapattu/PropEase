// Path: src/app/types/team-management/team-task/team-task.types.ts
// ============================================================================
// TeamTask Types (Frontend Mirror) — DTO-safe contract
// ----------------------------------------------------------------------------
// PURPOSE
// - FE mirror of backend TeamTaskDto (NO Mongoose Types here)
// - ISO date strings from backend
// - exactOptionalPropertyTypes-safe: optional props should be omitted (not undefined)
// ============================================================================

export type ISODateString = string;

// ----------------------------------------------------------------------------
// Enums (const arrays to keep strict union types)
// ----------------------------------------------------------------------------
export const TEAM_TASK_STATUS = [
  "draft",
  "pending",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
  "completed_pending_confirmation",
] as const;

export type TeamTaskStatus = ( typeof TEAM_TASK_STATUS )[ number ];

export const TEAM_TASK_PRIORITY = [ "low", "medium", "high", "urgent" ] as const;
export type TeamTaskPriority = ( typeof TEAM_TASK_PRIORITY )[ number ];

export const DEADLINE_POLICY = [ "soft", "hard" ] as const;
export type DeadlinePolicy = ( typeof DEADLINE_POLICY )[ number ];

// ----------------------------------------------------------------------------
// Minimal user snapshot used inside task DTO (DTO-safe)
// ----------------------------------------------------------------------------
export interface TeamTaskUserMiniDto {
  userId: string;
  username: string;

  displayName?: string;
  email?: string;
  photoUrl?: string;
}

// ----------------------------------------------------------------------------
// Evidence / attachments (align to backend FileMetaPacket + TaskEvidence DTO)
// ----------------------------------------------------------------------------
export interface TaskFileMetaDto {
  relPath: string; // "public/uploads/..."
  url: string; // client URL
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;

  uploadedAt?: ISODateString;
  label?: string;
}

/**
 * Evidence packet used by TeamTask (backend usually stores label + file packet + storageKey).
 */
export interface TeamTaskEvidenceDto {
  id?: string; // evidenceMongoId or internal id
  label: string;

  file: TaskFileMetaDto;

  storageKey?: string; // used by backend deleteEvidence route
  uploadedByUserId?: string;
  uploadedByUsername?: string;
  uploadedAt?: ISODateString;
}

// ----------------------------------------------------------------------------
// Location / Address (task optional)
// ----------------------------------------------------------------------------
export interface GeoPointDto {
  lat: number;
  lng: number;
}

export interface TaskAddressDto {
  line1?: string;
  line2?: string;
  city?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}

// ----------------------------------------------------------------------------
// Timing / Audit / SLA shapes (kept generic but DTO-safe)
// ----------------------------------------------------------------------------
export interface TaskTimingDto {
  createdAt?: ISODateString;
  startedAt?: ISODateString;
  completedAt?: ISODateString;

  // Optional durations computed by backend (seconds)
  totalSeconds?: number;
  activeSeconds?: number;
}

export interface TaskAuditDto {
  createdByUserId?: string;
  createdByUsername?: string;

  lastUpdatedByUserId?: string;
  lastUpdatedByUsername?: string;

  lastActivityAt?: ISODateString;
}

/**
 * SLA / deadline policy data — backend may map SLA → deadlinePolicy.
 */
export interface TaskSlaDto {
  deadlinePolicy?: DeadlinePolicy;

  dueAt?: ISODateString;
  graceMinutes?: number;
}

// ----------------------------------------------------------------------------
// Main DTO
// ----------------------------------------------------------------------------
export interface TeamTaskDto {
  _id: string;

  // identity / grouping
  teamCode: string;
  teamMongoId?: string;

  domain?: string;

  // main content
  title: string;
  description?: string;

  status: TeamTaskStatus;
  priority: TeamTaskPriority;

  labels?: string[];

  // ownership
  captainUserId?: string | null;
  captainUsername?: string | null;
  captainUser?: TeamTaskUserMiniDto | null;

  assignedMemberIds?: string[];
  assignedMemberUsernames?: string[];
  assignedMemberUsers?: TeamTaskUserMiniDto[];

  // optional rich data
  notes?: string | null;

  location?: GeoPointDto | null;
  address?: TaskAddressDto | null;

  evidence?: TeamTaskEvidenceDto[];

  // audit/timing
  audit?: TaskAuditDto;
  timing?: TaskTimingDto;
  sla?: TaskSlaDto;

  createdAt: ISODateString;
  updatedAt: ISODateString;

  isActive?: boolean;
}

// ----------------------------------------------------------------------------
// REST payloads (separate from DTO)
// ----------------------------------------------------------------------------
export interface TeamTaskCreateRequest {
  teamCode: string;

  title: string;
  description?: string;

  status?: TeamTaskStatus;
  priority?: TeamTaskPriority;

  labels?: string[];

  captainUserId?: string | null;
  assignedMemberIds?: string[];

  notes?: string | null;

  location?: GeoPointDto | null;
  address?: TaskAddressDto | null;

  sla?: TaskSlaDto;
}

export interface TeamTaskUpdateRequest {
  title?: string;
  description?: string;

  status?: TeamTaskStatus;
  priority?: TeamTaskPriority;

  labels?: string[];

  captainUserId?: string | null;
  assignedMemberIds?: string[];

  notes?: string | null;

  location?: GeoPointDto | null;
  address?: TaskAddressDto | null;

  sla?: TaskSlaDto;
}
