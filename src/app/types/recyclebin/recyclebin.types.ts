// Path: src/app/types/recyclebin/recyclebin.types.ts
// =============================================================================
// RecycleBin — Frontend Contracts / DTOs / Request Shapes (FE-FRIENDLY MIRROR)
// -----------------------------------------------------------------------------
// ✅ Goal
// - Mirror backend recyclebin contracts but remove backend-only dependencies
// - FE uses string IDs + ISO date strings
//
// ✅ Key rules
// - Dates are ISO strings (ISODateString)
// - Mongo _id is exposed as entryId string
// - Optional fields are OMITTED (never send undefined)
// =============================================================================

// IMPORTANT:
// Keep these imports aligned with your FRONTEND common types.
// If your FE uses a different path, update imports accordingly.
import type { AuthUser, FileMetaPacket } from "../common";

// =============================================================================
// 0) Shared primitives
// =============================================================================

/** Your system uses ISO strings heavily for FE/API */
export type ISODateString = string;

/** Matches the backend model RecycleBinStatus union exactly */
export type RecycleBinStatus =
  | "recording"
  | "recorded"
  | "restore_in_progress"
  | "restored"
  | "purged"
  | "failed";

/**
 * Recycle source key (dynamic)
 * Examples: "teamTask", "workItem", "property", "lease"
 */
export type RecycleSourceKey = string;

// =============================================================================
// 1) DTO Shapes (Frontend/API)
// =============================================================================

/**
 * Canonical DTO for a recycle bin entry for API/FE.
 * - Dates are ISO strings
 * - Mongo _id is exposed as entryId string
 * - Mirrors the backend model fields 1:1 (but DTO conversions already applied)
 */
export interface RecycleBinEntryDto {
  entryId: string;

  sourceKey: string;
  refId: string;

  label: string;
  description?: string;

  deletedAtIso: ISODateString;
  deletedBy: AuthUser;

  recycleDirRelPath: string;
  snapshotRelPath: string;
  metaRelPath: string;
  filesDirRelPath: string;

  files: FileMetaPacket[];
  snapshotData: Record<string, unknown>;

  tags?: string[];
  module?: string;
  entity?: string;
  extra?: Record<string, unknown>;

  status: RecycleBinStatus;

  restoredAtIso?: ISODateString;
  restoredBy?: AuthUser;

  purgedAtIso?: ISODateString;
  purgedBy?: AuthUser;
}

/**
 * Lightweight DTO for list screens (faster + smaller payload).
 * Mirrors the backend list item but intentionally excludes snapshotData.
 */
export interface RecycleBinListItemDto {
  entryId: string;

  sourceKey: string;
  refId: string;

  label: string;
  description?: string;

  deletedAtIso: ISODateString;
  deletedBy: AuthUser;

  status: RecycleBinStatus;

  filesCount: number;

  recycleDirRelPath: string;

  tags?: string[];
  module?: string;
  entity?: string;

  restoredAtIso?: ISODateString;
  purgedAtIso?: ISODateString;
}

/**
 * Snapshot read response used by "Preview" UI.
 * - snapshotData prefers disk snapshot.json, but API returns the final resolved data
 * - meta is loaded from meta.json (or fallback object)
 */
export interface RecycleBinSnapshotReadDto {
  entry: RecycleBinEntryDto;
  snapshotData: Record<string, unknown>;
  meta: Record<string, unknown>;
}

/**
 * Restore prepare response
 * - Caller uses snapshotData + files manifest to re-create record and move files back
 */
export interface RecycleBinRestorePrepareDto {
  entry: RecycleBinEntryDto;
  snapshotData: Record<string, unknown>;
  files: FileMetaPacket[];
}

// =============================================================================
// 2) FE Request / Response payloads (Controller-facing contracts)
// =============================================================================

/**
 * Listing filters (aligned to backend model fields)
 * NOTE: All fields are optional; omit when not used.
 */
export interface RecycleBinListFilters {
  sourceKey?: string;
  search?: string; // label/refId/deletedBy.username

  status?: RecycleBinStatus;
  deletedByUsername?: string;

  deletedFromIso?: ISODateString; // inclusive
  deletedToIso?: ISODateString; // inclusive

  tagsAny?: string[];
  module?: string;
  entity?: string;
}

/**
 * Pagination request (1-based)
 */
export interface PageQuery {
  page: number;
  limit: number;
}

/**
 * List result (generic form returned by API)
 */
export interface RecycleBinListResult<TItem = RecycleBinListItemDto> {
  items: TItem[];
  other: { total: number };
}

/**
 * Count result
 */
export interface RecycleBinCountResult {
  total: number;
}

/**
 * Restore/Purge requests (what FE sends to backend)
 * - FE cannot send session; session is backend-only
 */
export interface RecycleBinPrepareRestoreRequest {
  entryId: string;
  restoredBy: AuthUser;
}

export interface RecycleBinMarkRestoredRequest {
  entryId: string;
  restoredBy: AuthUser;
}

export interface RecycleBinPurgeRequest {
  entryId: string;
  purgedBy: AuthUser;
}

export interface RecycleBinPurgeResult {
  purged: boolean;
  entryId: string;
}

// =============================================================================
// 3) Notes for FE usage
// =============================================================================
// - NEVER send optional props as `undefined` in payloads.
//   Build payloads by conditionally adding fields.
// - Treat snapshotData / meta as unknown JSON objects:
//   UI should render safely (key/value viewer) and avoid assuming schema.
// =============================================================================
