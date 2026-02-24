/* ============================================================================
 * PropEase FE API Message Types (Backend → Frontend contract aligned)
 * ----------------------------------------------------------------------------
 * Source of truth: backend `src/types/api-message.ts`
 *
 * Key rules:
 * ✅ This file models the *envelope* only (ApiResponse/ApiData/SystemData)
 * ✅ Domain objects inside `system` must be DTO-safe (no Mongoose/Document)
 * ✅ Dates from backend arrive as ISO strings
 * ✅ exactOptionalPropertyTypes-safe: optional props must be omitted when absent
 * ========================================================================== */

import type { User } from "../services/APIs/apis.service";

// Leases (use whatever your FE already uses as a DTO-safe payload)
import { Lease, LeaseWithProperty, Tenant, ComplaintClient } from '../services/tenant/tenant.service';

// Properties / Tenants / Complaints (DTO-safe client types)
import type { BackEndPropertyData } from "../services/property/property.service";

// Team Management DTOs (DTO-safe)
import type {
  TeamMainDto
} from "./team-management/teamMain/team-main.types";

import { WorkEventDto } from './team-management/work-events/work-event.types';

import { WorkItemDto } from './team-management/work-items/work-item.types';

import { TeamTaskDto } from './team-management/team-task/team-task.types';

import { MemberActivityDto } from './team-management/member-activities/member-activities.types';

import { MilestoneDto } from './team-management/milestone/milestone.types';

// RecycleBin DTO
import type { RecycleBinEntryDto } from "./recyclebin/recyclebin.types";

// Comments DTO
import type { CommentDto } from "../services/comments/contracts/comment.contract";
import type { ISODateString } from "./common";
import type { NotificationInboxItemDto } from "./notifications/notification.types";

/* ──────────────────────────────────────────────────────────────
   01) Core primitives
   ────────────────────────────────────────────────────────────── */

export type ApiStatus = "success" | "error" | "fail";

/* ──────────────────────────────────────────────────────────────
   02) Common envelope types
   ────────────────────────────────────────────────────────────── */

export interface DateRange {
  start: ISODateString;
  end: ISODateString;
}

export interface PaginationMeta {
  index?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;

  // Optional / future / UI computed
  start?: number;
  end?: number;
  search?: string;
  dateRange?: DateRange;

  hasNext?: boolean;
  hasPrevious?: boolean;
  hasResults?: boolean;

  nextCursor?: string;
}

export interface ValidationUnit {
  token?: string;
  isValid?: boolean;

  /** ISO string */
  expiresAt?: string;
}

/* ──────────────────────────────────────────────────────────────
   03) File metadata (align with backend FileMetaPacket)
   NOTE:
   - If you already have a canonical FileMetaPacket in FE, import that instead.
   - This is a DTO-safe minimal mirror.
   ────────────────────────────────────────────────────────────── */

export interface FileMetaPacket {
  /** Public-relative disk path under "public/..." (NO leading "/") */
  relPath: string;

  /** Client URL (may start with "/" or be absolute) */
  url: string;

  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;

  /** ISO string */
  uploadedAt?: string;

  /** Optional label/grouping */
  label?: string;
}

/* ──────────────────────────────────────────────────────────────
   04) Files entity (legacy user document storage)
   ────────────────────────────────────────────────────────────── */

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

  uploadDate?: string;
}

export interface UserDocumentEntity {
  username: string;
  files: UploadedFile[];

  createdAt: string;
  updatedAt: string;
}

/* ──────────────────────────────────────────────────────────────
   05) Domain payload dictionary (SystemData)
   MUST match backend keys.
   ────────────────────────────────────────────────────────────── */

export interface SystemData {
  // Users
  user?: User;
  users?: User[];

  // Leases
  lease?: Lease;
  leases?: Lease[];

  leaseWithProperty?: LeaseWithProperty;
  leaseWithProperties?: LeaseWithProperty[];

  // Properties
  property?: BackEndPropertyData;
  properties?: BackEndPropertyData[];

  // Tenants
  tenant?: Tenant;
  tenants?: Tenant[];

  // Complaints
  complaint?: ComplaintClient;
  complaints?: ComplaintClient[];

  // Files
  fileUpload?: UserDocumentEntity;
  fileUploads?: UserDocumentEntity[];
  file?: FileMetaPacket;
  files?: FileMetaPacket[];

  // Team Management
  team?: TeamMainDto;
  teams?: TeamMainDto[];

  // Team Tasks
  teamTask?: TeamTaskDto;
  teamTasks?: TeamTaskDto[];

  // Work items / events
  workItem?: WorkItemDto;
  workItems?: WorkItemDto[];
  event?: WorkEventDto;
  events?: WorkEventDto[];

  // Member Activities (✅ OPTIONAL to match backend)
  memberActivity?: MemberActivityDto;
  memberActivities?: MemberActivityDto[];

  // Milestones (✅ OPTIONAL to match backend)
  milestone?: MilestoneDto;
  milestones?: MilestoneDto[];

  // Comments (✅ OPTIONAL)
  comment?: CommentDto;
  comments?: CommentDto[];

  // RecycleBin (✅ OPTIONAL)
  recycleBinItem?: RecycleBinEntryDto;
  recycleBinItems?: RecycleBinEntryDto[];

  // Notification
  notification?: NotificationInboxItemDto;
  notifications?: NotificationInboxItemDto[];

  // Dashboard summaries
  totalUsers?: number;
  totalProperties?: number;
  totalTenants?: number;
  totalComplaints?: number;
}

/* ──────────────────────────────────────────────────────────────
   06) Generic wrappers (ApiData, ApiResponse)
   ────────────────────────────────────────────────────────────── */

export interface ApiData<
  TSystem = SystemData,
  TOther extends Record<string, unknown> = Record<string, unknown>
> {
  pagination?: PaginationMeta;
  validation?: ValidationUnit;

  system?: TSystem;
  other?: TOther;
}

export interface ApiResponse<TData = ApiData> {
  success: boolean;
  status: ApiStatus;
  message: string;

  data: TData | null;

  timestamp?: string;
  path?: string;
  requestId?: string;
}

// Backwards-compatible alias
export type MSG<TData = ApiData> = ApiResponse<TData>;

/* ──────────────────────────────────────────────────────────────
   07) Convenience extraction types (null-safe)
   Matches backend pattern (double NonNullable)
   ────────────────────────────────────────────────────────────── */

export type PaginationType =
  NonNullable<NonNullable<MSG[ "data" ]>[ "pagination" ]>;

export type ValidationType =
  NonNullable<NonNullable<MSG[ "data" ]>[ "validation" ]>;

export type SystemType =
  NonNullable<NonNullable<MSG[ "data" ]>[ "system" ]>;

export type OtherType =
  NonNullable<NonNullable<MSG[ "data" ]>[ "other" ]>;

/* ──────────────────────────────────────────────────────────────
   08) System slices (module-specific strong typing)
   Mirrors backend slice exports.
   ────────────────────────────────────────────────────────────── */

export type LeaseSystemData = Pick<SystemData, "lease" | "leases">;
export type PropertySystemData = Pick<SystemData, "property" | "properties">;
export type TenantSystemData = Pick<SystemData, "tenant" | "tenants">;
export type ComplaintSystemData = Pick<SystemData, "complaint" | "complaints">;
export type FileUploadSystemData = Pick<SystemData, "fileUpload" | "fileUploads">;

export type TeamManagementSystemData = Pick<SystemData, "team" | "teams">;

export type WorkSystemData = Pick<SystemData, "workItem" | "workItems" | "event" | "events">;

export type TeamTaskSystemData = Pick<SystemData, "teamTask" | "teamTasks">;

export type FileMetaSystemData = Pick<SystemData, "file" | "files">;

export type DashboardSystemData = Pick<
  SystemData,
  "totalUsers" | "totalProperties" | "totalTenants" | "totalComplaints"
>;

export type CommentSystemData = Pick<SystemData, "comment" | "comments">;

export type MemberActivitySystemData = Pick<SystemData, "memberActivity" | "memberActivities">;

export type MilestoneSystemData = Pick<SystemData, "milestone" | "milestones">;

export type RecycleBinSystemData = Pick<SystemData, "recycleBinItem" | "recycleBinItems">;

/* ──────────────────────────────────────────────────────────────
   09) ApiData aliases per module (same idea as backend)
   ────────────────────────────────────────────────────────────── */

export type LeaseApiData = ApiData<LeaseSystemData>;
export type PropertyApiData = ApiData<PropertySystemData>;
export type TenantApiData = ApiData<TenantSystemData>;
export type ComplaintApiData = ApiData<ComplaintSystemData>;
export type FileUploadApiData = ApiData<FileUploadSystemData>;
export type TeamManagementApiData = ApiData<TeamManagementSystemData>;
export type WorkApiData = ApiData<WorkSystemData>;
export type TeamTaskApiData = ApiData<TeamTaskSystemData>;
export type FileMetaApiData = ApiData<FileMetaSystemData>;
export type DashboardApiData = ApiData<DashboardSystemData>;
export type CommentApiData = ApiData<CommentSystemData>;
export type MemberActivityApiData = ApiData<MemberActivitySystemData>;
export type MilestoneApiData = ApiData<MilestoneSystemData>;
export type RecycleBinApiData = ApiData<RecycleBinSystemData>;
