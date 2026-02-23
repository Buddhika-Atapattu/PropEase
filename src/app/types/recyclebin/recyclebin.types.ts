// Path: src/app/types/recyclebin/recyclebin.types.ts
// =============================================================================
// RecycleBin — Frontend Contracts (FE Mirror of Backend)
// -----------------------------------------------------------------------------
// PURPOSE
// - This file is the FRONTEND mirror of the BACKEND canonical recycle-bin contract.
// - No Mongo types here (no ObjectId, no Date objects). Use string ids + ISO strings.
//
// IMPORTANT (PropEase rules)
// - exactOptionalPropertyTypes-safe:
//   - optional fields must be omitted, NEVER set to undefined.
// =============================================================================

import type { AuthUser, FileMetaPacket } from "../common";

// =============================================================================
// 0) Shared primitives
// =============================================================================

/** ISO string used across FE/BE */
export type ISODateString = string;

/** Must match backend RecycleBinStatus union exactly */
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
// 1) DTO Shapes (API/FE)
// =============================================================================

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

  /**
   * NOTE
   * - backend entry has snapshotData in the DB record, but list screens should avoid loading it.
   * - for snapshot preview, use /:entryId/snapshot which returns snapshotData separately.
   */
  snapshotData?: Record<string, unknown>;

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
 * Lightweight DTO for list screens (preferred).
 * Mirrors backend list-item DTO: excludes snapshotData
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

export interface RecycleBinSnapshotReadDto {
  entry: RecycleBinEntryDto;
  snapshotData: Record<string, unknown>;
  meta: Record<string, unknown>;
}

export interface RecycleBinRestorePrepareDto {
  entry: RecycleBinEntryDto;
  snapshotData: Record<string, unknown>;
  files: FileMetaPacket[];
}

// =============================================================================
// 2) Filters / List / Count
// =============================================================================

export interface RecycleBinListFilters {
  sourceKey?: string;
  search?: string;

  status?: RecycleBinStatus;
  deletedByUsername?: string;

  deletedFromIso?: ISODateString; // inclusive
  deletedToIso?: ISODateString;   // inclusive

  tagsAny?: string[];
  module?: string;
  entity?: string;
}

export interface PageQuery {
  page: number;  // 1-based
  limit: number; // max 100 (backend clamps)
}

export interface RecycleBinListResult<TItem = RecycleBinListItemDto> {
  items: TItem[];
  other: { total: number };
}

export interface RecycleBinCountResult {
  total: number;
}

export interface RecycleBinPurgeResult {
  purged: boolean;
  entryId: string;
}

// =============================================================================
// 3) FE-friendly API Response wrapper (fits ApiResponseBuilder pattern)
// =============================================================================
// Your backend uses ApiResponseBuilder.ok(res, key, data, msg, meta?).
// Most PropEase APIs look like:
//
// {
//   "status": true,
//   "message": "...",
//   "data": { "<key>": <payload> },
//   "other": { ...optional... },
//   "pagination": { "total": number }  // sometimes nested inside meta
// }
//
// We keep it tolerant but typed.
// =============================================================================

export interface ApiOkEnvelope<TDataKey extends string, TPayload> {
  status: boolean;
  message: string;
  data: Record<TDataKey, TPayload>;
  other?: Record<string, unknown>;
  pagination?: { total?: number };
}
