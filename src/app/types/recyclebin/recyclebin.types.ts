// Path: src/app/types/recyclebin/recyclebin.types.ts
// =============================================================================
// RecycleBin (Frontend Types)
// -----------------------------------------------------------------------------
// 01. Introduction
// - Frontend-friendly DTO + filter contracts for the Recycle Bin UI.
// - Mirrors backend `src/types/recyclebin/recyclebin.types.ts` but removes
//   all mongoose-only types (ObjectId / ClientSession).
//
// 02. Important matters
// - Dates are ISO strings in the UI/API layer.
// - Optional properties should be omitted by callers (avoid passing undefined).
// - `snapshotData` is heavy; list endpoints might still include it depending on backend.
//   (Your backend currently returns RecycleBinEntryDto for list; UI can ignore snapshotData.)
//
// 03. Why we make these types
// - Strong typing for table listing, filters, preview modal, restore workflow.
// - Prevent DTO drift between frontend and backend.
//
// 04. Usage hint
// - Use `RecycleBinListFilters` + `PageQuery` for list requests.
// - Use `RecycleBinSnapshotReadDto` for preview.
// - Use `RecycleBinRestorePrepareDto` for restore prepare.
//
// 05. Keep in mind
// - `tagsAny` is serialized as CSV in query params: "a,b,c".
// =============================================================================

/** ISO date string used across the UI/API boundary */
export type ISODateString = string;

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
 */
export interface AuthUserDto {
  userId: string;
  username: string;
  role: string;

  teamCodes?: string[];
  branchId?: string;
  sub?: string;
}

/**
 * File packet used across your system.
 * - Keep aligned with backend FileMetaPacket.
 */
export interface FileMetaPacketDto {
  originalName: string;
  storedName: string;

  extension: string;
  mimeType: string;
  sizeBytes: number;

  relativePath: string; // "public/...."
  publicUrl: string;    // absolute URL built by backend
  absDiskPath: string;  // backend internal path (UI may ignore)

  fieldName: string;
  uploadedAtIso: ISODateString;

  encoding?: string;
  checksumSha256?: string;
}

/**
 * Canonical entry DTO returned by your backend.
 * Mirrors backend RecycleBinEntryDto.
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
  snapshotData: Record<string, unknown>;

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
 * Pagination (1-based page like backend)
 */
export interface PageQuery {
  page: number;
  limit: number;
}

/**
 * What the UI wants after list is normalized:
 * - items array
 * - total count for paginator
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
  snapshotData: Record<string, unknown>;
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
 * Generic backend envelope (your ApiResponseBuilder shape can vary).
 * We keep it flexible but safe.
 */
export interface MsgEnvelope {
  status: boolean;
  message: string;
  data: Record<string, unknown>;
}
