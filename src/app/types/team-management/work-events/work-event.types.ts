// Path: src/app/types/team-management/work-events/work-event.types.ts
// ============================================================================
// WorkEvent Types (Frontend Mirror) — DTO-safe contract
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
export const WORK_EVENT_TYPE = [
  "meeting",
  "deadline",
  "milestone",
  "site_visit",
  "inspection",
  "handover",
  "call",
  "note",
  "other",
] as const;

export type WorkEventType = ( typeof WORK_EVENT_TYPE )[ number ];

export const WORK_EVENT_STATUS = [ "scheduled", "in_progress", "completed", "cancelled" ] as const;
export type WorkEventStatus = ( typeof WORK_EVENT_STATUS )[ number ];

export const WORK_EVENT_VISIBILITY = [ "team", "private", "company" ] as const;
export type WorkEventVisibility = ( typeof WORK_EVENT_VISIBILITY )[ number ];

// ----------------------------------------------------------------------------
// Location / Address
// ----------------------------------------------------------------------------
export interface GeoPointDto {
  lat: number;
  lng: number;
}

export interface EventAddressDto {
  line1?: string;
  line2?: string;
  city?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}

// ----------------------------------------------------------------------------
// Attachments / evidence
// ----------------------------------------------------------------------------
export interface EventFileMetaDto {
  relPath: string;
  url: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt?: ISODateString;
  label?: string;
}

export interface WorkEventAttachmentDto {
  id?: string;
  label: string;
  file: EventFileMetaDto;

  storageKey?: string;
  uploadedByUserId?: string;
  uploadedByUsername?: string;
  uploadedAt?: ISODateString;
}

// ----------------------------------------------------------------------------
// Minimal user snapshot
// ----------------------------------------------------------------------------
export interface WorkEventUserMiniDto {
  userId: string;
  username: string;

  displayName?: string;
  email?: string;
  photoUrl?: string;
}

// ----------------------------------------------------------------------------
// WorkEvent DTO
// ----------------------------------------------------------------------------
export interface WorkEventDto {
  _id: string;

  // grouping
  teamCode: string;
  teamMongoId?: string;
  domain?: string;

  // content
  title: string;
  description?: string;

  type: WorkEventType;
  status: WorkEventStatus;
  visibility?: WorkEventVisibility;

  // scheduling
  startAt: ISODateString;
  endAt?: ISODateString;

  // ownership
  createdByUserId?: string;
  createdByUsername?: string;

  hostUserId?: string | null;
  hostUsername?: string | null;
  hostUser?: WorkEventUserMiniDto | null;

  participantUserIds?: string[];
  participantUsernames?: string[];
  participantUsers?: WorkEventUserMiniDto[];

  // optional location/address
  location?: GeoPointDto | null;
  address?: EventAddressDto | null;

  // attachments
  attachments?: WorkEventAttachmentDto[];

  // audit
  createdAt: ISODateString;
  updatedAt: ISODateString;
  isActive?: boolean;
}

// ----------------------------------------------------------------------------
// REST payloads
// ----------------------------------------------------------------------------
export interface WorkEventCreateRequest {
  teamCode: string;

  title: string;
  description?: string;

  type: WorkEventType;
  status?: WorkEventStatus;
  visibility?: WorkEventVisibility;

  startAt: ISODateString;
  endAt?: ISODateString;

  hostUserId?: string | null;
  participantUserIds?: string[];

  location?: GeoPointDto | null;
  address?: EventAddressDto | null;
}

export interface WorkEventUpdateRequest {
  title?: string;
  description?: string;

  type?: WorkEventType;
  status?: WorkEventStatus;
  visibility?: WorkEventVisibility;

  startAt?: ISODateString;
  endAt?: ISODateString;

  hostUserId?: string | null;
  participantUserIds?: string[];

  location?: GeoPointDto | null;
  address?: EventAddressDto | null;
}

// ----------------------------------------------------------------------------
// List filters (common calendar style)
// ----------------------------------------------------------------------------
export interface WorkEventListQuery {
  teamCode?: string;
  teamMongoId?: string;

  type?: WorkEventType;
  status?: WorkEventStatus;

  from?: ISODateString;
  to?: ISODateString;

  q?: string;

  page?: number;
  limit?: number;
}
