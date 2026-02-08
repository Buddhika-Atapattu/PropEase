// Path: src/app/types/api-message.types.ts
// ============================================================================
// PropEase FE API Message Types (Backend-Contract Aligned)
// ----------------------------------------------------------------------------
// Key fixes vs your previous version:
// ✅ All backend JSON date/time fields are typed as ISO strings (NOT Date)
//    - Angular receives JSON => dates arrive as strings unless you manually convert.
// ✅ Pagination keys aligned with backend (index/limit/total/hasMore)
//    - Extra optional fields kept, but NOT assumed to be provided by backend.
// ✅ SystemData keys match backend ApiResponseBuilder + ApiDataBuilder contracts.
// ============================================================================

// Imports (domain DTOs used inside "system")
import { User } from '../services/APIs/apis.service';
import { Lease, LeaseWithProperty, Tenant, ComplaintClient } from '../services/tenant/tenant.service';
import { BackEndPropertyData } from '../services/property/property.service';
import type { TeamManagementDto, WorkEvent, WorkItem } from '../services/teamManagementService/team-management.types';
import { CommentDto } from '../services/comments/contracts/comment.contract'

/**
 * Minimal file metadata used across backend.
 * Pure JSON only.
 */
export interface FileMetaBase {
  /** Original filename sent by client (as uploaded) */
  originalName: string;

  /** Stored filename on disk or in bucket (unique) */
  storedName: string;

  /** File extension without dot, e.g. "pdf", "jpg" */
  extension: string;

  /** MIME type, e.g. "application/pdf", "image/jpeg" */
  mimeType: string;

  /** Size in bytes */
  sizeBytes: number;
}

/**
 * NOTE:
 * - Backend sends JSON values; dates come as ISO strings.
 * - If you want Date objects in UI, parse them in UI/service layer.
 */
export interface UploadedFile {
  originalName?: string;
  storedName?: string;
  mimeType?: string;

  /** (Legacy) your previous type used string; keep as string for compatibility */
  size?: string;

  path?: string;
  URL?: string;
  extension?: string;
  download?: string;
  uploader?: string;

  /** ✅ ISO string from backend */
  uploadDate?: string;
}

/** Main document interface for each user's uploaded file set */
export interface UserDocumentEntity {
  username: string;
  files: UploadedFile[];

  /** ✅ ISO string from backend */
  createdAt: string;

  /** ✅ ISO string from backend */
  updatedAt: string;
}

/* ──────────────────────────────────────────────────────────────
   Basic status type for consistency across all APIs
   ────────────────────────────────────────────────────────────── */
export type ApiStatus = 'success' | 'error' | 'fail';

/* ──────────────────────────────────────────────────────────────
   Pagination meta sent from backend to frontend
   ────────────────────────────────────────────────────────────── */

/**
 * When you send filters to backend, you may use string/Date in UI.
 * But backend responses should be treated as string if echoed back.
 */
export interface DateRange {
  start: string | Date;
  end: string | Date;
}

/**
 * Backend currently sends (commonly):
 *  - index, limit, total, hasMore
 *
 * Extra fields are kept OPTIONAL for future expansion,
 * but frontend must not assume backend always provides them.
 */
export interface PaginationMeta {
  /** Zero-based page index */
  index?: number;

  /** Page size */
  limit?: number;

  /** Total DB records count */
  total?: number;

  /** Backend convenience flag */
  hasMore?: boolean;

  // Optional / future / UI-computed fields (keep optional)
  start?: number;
  end?: number;
  search?: string;
  dateRange?: DateRange;

  hasNext?: boolean;
  hasPrevious?: boolean;
  hasResults?: boolean;

  nextCursor?: string;
}

/* ──────────────────────────────────────────────────────────────
   Validation payload (JWT, CSRF, etc.)
   ────────────────────────────────────────────────────────────── */
export interface ValidationUnit {
  token?: string;
  isValid?: boolean;

  /** ✅ ISO string expiry time if relevant */
  expiresAt?: string;
}

/* ──────────────────────────────────────────────────────────────
   Strongly-typed system data payload
   ────────────────────────────────────────────────────────────── */
export interface SystemData {
  user?: User;
  users?: User[];

  lease?: Lease;
  leases?: Lease[];

  leaseWithProperty?: LeaseWithProperty;
  leaseWithProperties?: LeaseWithProperty[];

  property?: BackEndPropertyData;
  properties?: BackEndPropertyData[];

  tenant?: Tenant;
  tenants?: Tenant[];

  complaint?: ComplaintClient;
  complaints?: ComplaintClient[];

  fileUpload?: UserDocumentEntity;
  fileUploads?: UserDocumentEntity[];

  team?: TeamManagementDto;
  teams?: TeamManagementDto[];

  /**
   * IMPORTANT:
   * These MUST match backend DTO shapes:
   * - IDs should be string (teamMongoId, userId, etc.)
   * - dates should be ISO strings (timing.createdAt, createdAt, etc.)
   */
  workItem?: WorkItem;
  workItems?: WorkItem[];

  event?: WorkEvent;
  events?: WorkEvent[];

  file?: FileMetaBase;
  files?: FileMetaBase[];

  comment?: CommentDto;
  comments?: CommentDto[];

  /** Common dashboard summaries */
  totalUsers?: number;
  totalProperties?: number;
  totalTenants?: number;
  totalComplaints?: number;
}

/* ──────────────────────────────────────────────────────────────
   Generic Data wrapper
   ────────────────────────────────────────────────────────────── */
export interface ApiData<
  TSystem = SystemData,
  TOther extends Record<string, unknown> = Record<string, unknown>
> {
  pagination?: PaginationMeta;
  validation?: ValidationUnit;
  system?: TSystem;

  /**
   * Extra data that doesn’t belong to core domain models.
   * Example:
   *  - chartData
   *  - filters
   *  - temporary UI hints
   */
  other?: TOther;
}

/* ──────────────────────────────────────────────────────────────
   Base API response shape used everywhere
   ────────────────────────────────────────────────────────────── */
export interface ApiResponse<TData = ApiData> {
  success: boolean;
  status: ApiStatus;
  message: string;

  /** Main payload */
  data: TData | null;

  /** ✅ Backend sends ISO string */
  timestamp?: string;

  /** Optional: backend route path */
  path?: string;

  /** Optional: correlation ID / request ID */
  requestId?: string;
}

/* ──────────────────────────────────────────────────────────────
   Backwards-compatible alias (your old MSG name)
   ────────────────────────────────────────────────────────────── */
export type MSG<TData = ApiData> = ApiResponse<TData>;

export type PaginationType = NonNullable<MSG[ 'data' ]>[ 'pagination' ];
export type ValidationType = NonNullable<MSG[ 'data' ]>[ 'validation' ];
export type SystemType = NonNullable<MSG[ 'data' ]>[ 'system' ];
export type OtherType = NonNullable<MSG[ 'data' ]>[ 'other' ];
