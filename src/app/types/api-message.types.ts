// Path: src/app/types/api-message.types.ts
//Imports
import { User } from '../services/APIs/apis.service';
import { Lease, LeaseWithProperty, Tenant, ComplaintClient } from '../services/tenant/tenant.service';
import { BackEndPropertyData } from '../services/property/property.service';
import type { TeamManagementDto, WorkEvent, WorkItem } from '../services/teamManagementService/team-management.service';


/**
 * Minimal file metadata used across backend.
 * Pure JSON (no File, no Buffer here).
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

export interface UploadedFile {
  originalName?: string;
  storedName?: string;
  mimeType?: string;
  size?: string;
  path?: string;
  URL?: string;
  extension?: string;
  download?: string;
  uploader?: string;
  uploadDate?: Date;
}

/** Main document interface for each user's uploaded file set */
export interface UserDocumentEntity {
  username: string;
  files: UploadedFile[];
  createdAt: Date;
  updatedAt: Date;
}

/* ──────────────────────────────────────────────────────────────
   Basic status type for consistency across all APIs
   ────────────────────────────────────────────────────────────── */
export type ApiStatus = 'success' | 'error' | 'fail';

/* ──────────────────────────────────────────────────────────────
   Pagination meta sent from backend to frontend
   ────────────────────────────────────────────────────────────── */
export interface DateRange {
  start: string | Date;
  end: string | Date;
}

export interface PaginationMeta {
  /** Zero-based page index used internally (ex: 0, 1, 2...) */
  index?: number;

  /** Page size (limit per page) */
  limit?: number;

  /** Total number of records in DB (after filters/search) */
  total?: number;

  /** First record position in this page (0-based) */
  start?: number | undefined;

  /** Last record position in this page (0-based, inclusive) */
  end?: number;

  /** Optional search term used to filter data */
  search?: string;

  /** Optional date range term used to filter data */
  dateRange?: DateRange;

  /** Convenience flags – can be calculated on backend or frontend */
  hasNext?: boolean;

  hasPrevious?: boolean;

  hasResults?: boolean;

  hasMore?: boolean;

  nextCursor?: string | undefined;
}

/* ──────────────────────────────────────────────────────────────
   Validation payload (JWT, CSRF, etc.)
   Extend this later if you want more validation info.
   ────────────────────────────────────────────────────────────── */
export interface ValidationUnit {
  /** Access / session / CSRF token */
  token?: string;

  /** Explicit flag for validity – optional */
  isValid?: boolean;

  /** ISO string expiry time if relevant (ex: JWT exp) */
  expiresAt?: string;
}

/* ──────────────────────────────────────────────────────────────
   Strongly-typed system data payload
   (All your core domain models live here)
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

  workItem?: WorkItem;
  workItems?: WorkItem[];

  event?: WorkEvent;
  events?: WorkEvent[];

  file?: FileMetaBase;
  files?: FileMetaBase[];


  /** Optional numeric summaries – very common in dashboards */
  totalUsers?: number;
  totalProperties?: number;
  totalTenants?: number;
  totalComplaints?: number;
}

/* ──────────────────────────────────────────────────────────────
   Generic Data wrapper
   - TSystem: shape of "system" (domain) payload
   - TOther:  any extra payload (charts, filters, etc.) WITHOUT using `any`
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
  /** Quick boolean flag for client checks (if (!res.success) ...) */
  success: boolean;

  /** Narrowed status values for better type safety */
  status: ApiStatus;

  /** Human-readable message (toast/alert) */
  message: string;

  /** Main payload */
  data: TData | null;

  /** Optional: ISO timestamp of response generation */
  timestamp?: string;

  /** Optional: backend route path (useful for logging/debugging) */
  path?: string;

  /** Optional: correlation ID / request ID for tracing */
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

