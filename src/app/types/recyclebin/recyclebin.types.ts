// Path: src/app/types/recyclebin/recyclebin.types.ts
// =============================================================================
// RecycleBin (Frontend Types)
// -----------------------------------------------------------------------------
// 01. Introduction
// - Frontend-friendly DTO + filter contracts for the Recycle Bin UI.
// - Mirrors backend `src/types/recyclebin/recyclebin.types.ts` but removes
//   mongoose-only types (ObjectId / ClientSession).
//
// 02. Important matters
// - Dates are ISO strings in UI/API layer.
// - Optional properties MUST be omitted by callers (never pass undefined).
// - `snapshotData` can be heavy; UI should treat it as optional in list views.
//
// 03. Why we make these types
// - Strong typing for list, preview, restore, purge workflows.
// - Prevent drift between backend and frontend contracts.
//
// 04. Usage hint
// - Use RecycleBinListFilters + PageQuery for list/count.
// - Use RecycleBinSnapshotReadDto for preview.
// - Use RecycleBinRestorePrepareDto for restore prepare.
//
// 05. Keep in mind
// - tagsAny is serialized as CSV in query params: "a,b,c".
// =============================================================================

import type { ISODateString, Role } from "../common";


/** Must match backend union exactly */
export type RecycleBinStatus =
  | "recording"
  | "recorded"
  | "restore_in_progress"
  | "restored"
  | "purged"
  | "failed";

/** Dynamic source key (module/domain) */
export type RecycleSourceKey = string;


/**
 * Minimal AuthUser shape used by UI.
 * - Keep only what UI needs (align with backend AuthUser contract).
 * - Optional props must be OMITTED by callers (never set undefined).
 */
export interface AuthUserDto {
  userId: string;
  username: string;
  role: Role;

  teamCodes?: string[];
  branchId?: string;
  sub?: string;
}

/**
 * File packet used across your system (Frontend DTO).
 * - Keep aligned with backend FileMetaPacket as used in controllers.
 * - UI should NOT depend on absDiskPath, but it may be present.
 */
export interface FileMetaPacketDto {
  originalName: string;
  storedName: string;

  extension: string;
  mimeType: string;
  sizeBytes: number;

  /** e.g. "public/uploads/..." (your Electron-safe convention) */
  relativePath: string;

  /** absolute URL built by backend (UI can use directly) */
  publicUrl: string;

  /** backend internal path (UI should ignore; may not exist on some payloads) */
  absDiskPath?: string;

  fieldName: string;

  /** ISO timestamp (prefer this) */
  uploadedAtIso: ISODateString;

  encoding?: string;
  checksumSha256?: string;
}

/**
 * Canonical entry DTO returned by your backend.
 * Mirrors backend RecycleBinEntryDto.
 *
 * Important:
 * - `snapshotData` is OPTIONAL in UI type to allow list endpoints to omit it.
 *   (Even if backend currently includes it, keeping it optional prevents UI coupling.)
 */
export interface RecycleBinEntryDto {
  entryId: string;

  sourceKey: RecycleSourceKey;
  refId: string;

  label: string;
  description?: string;

  deletedAtIso: ISODateString;
  deletedBy: AuthUserDto;

  recycleDirRelPath: string;
  snapshotRelPath: string;
  metaRelPath: string;
  filesDirRelPath: string;

  files: FileMetaPacketDto[];

  /** Heavy payload; might be omitted in list */
  snapshotData?: Record<string, unknown>;

  tags?: string[];
  module?: string;
  entity?: string;
  extra?: Record<string, unknown>;

  status: RecycleBinStatus;

  restoredAtIso?: ISODateString;
  restoredBy?: AuthUserDto;

  purgedAtIso?: ISODateString;
  purgedBy?: AuthUserDto;
}

/**
 * List filters used by the UI.
 * Serialized to query params by the REST service.
 */
export interface RecycleBinListFilters {
  sourceKey?: RecycleSourceKey;
  search?: string;

  status?: RecycleBinStatus;
  deletedByUsername?: string;

  deletedFromIso?: ISODateString;
  deletedToIso?: ISODateString;

  tagsAny?: string[];

  module?: string;
  entity?: string;
}

/**
 * Pagination
 * - Backend appears to use 1-based paging (keep consistent).
 * - `limit` supports -1 / 0 semantics depending on your API,
 *   but UI usually clamps it (service-level).
 */
export interface PageQuery {
  page: number;
  limit: number;
}

/**
 * Normalized list payload for UI state.
 */
export interface RecycleBinListUiResult {
  items: RecycleBinEntryDto[];
  total: number;
  page: number;
  limit: number;
}

/** Snapshot response used by Preview UI */
export interface RecycleBinSnapshotReadDto {
  entry: RecycleBinEntryDto;

  /** Full snapshot (domain-specific JSON) */
  snapshotData: Record<string, unknown>;

  /** meta.json payload (file manifest, deletion plan, etc.) */
  meta: Record<string, unknown>;
}

/** Restore prepare response used by restore flow */
export interface RecycleBinRestorePrepareDto {
  entry: RecycleBinEntryDto;
  snapshotData: Record<string, unknown>;
  files: FileMetaPacketDto[];
}

/** Purge response */
export interface RecycleBinPurgeResultDto {
  entryId: string;
  purged: boolean;
}

/**
 * ApiResponseBuilder envelope (Frontend view).
 *
 * Important matters:
 * - Keep flexible because some endpoints place pagination and extras under `other`.
 * - data keys differ per endpoint: recycleBinItems / recycleBinItem / other
 */
export interface MsgEnvelope<TData extends Record<string, unknown> = Record<string, unknown>> {
  status: boolean;
  message: string;
  data: TData;
  other?: Record<string, unknown>;
}
