// Path: src/app/services/comments/contracts/comment.contract.ts
// ============================================================================
// PropEase FE — Comment Engine Contracts (Backend-Matched / Canonical)
// ----------------------------------------------------------------------------
// ✅ Frontend-safe: NO mongoose imports, NO backend model imports.
// ✅ Backend-aligned DTO shapes (CommentDto, filters, request/response, target).
// ✅ exactOptionalPropertyTypes-safe: OMIT optional props (never set undefined).
// ✅ Supports File[] via multipart contracts (CommentRestAddRequest).
// ============================================================================

/* ========================================================================== *
 * 1) KEYS (canonical unions)
 * ========================================================================== */

export type CommentSectionKey =
  | "Users"
  | "Properties"
  | "Complaints"
  | "Tenants"
  | "Leases"
  | "Teams";

export const CommentSectionKeyValues: ReadonlyArray<CommentSectionKey> = [
  "Users",
  "Properties",
  "Complaints",
  "Tenants",
  "Leases",
  "Teams",
] as const;

/**
 * Teams-only subSections (business-level, NOT mongoose paths).
 * Keep spelling identical to backend.
 */
export type CommentSubSectionKey = "Teams" | "WorkItems" | "Events";

export const CommentSubSectionKeyValues: ReadonlyArray<CommentSubSectionKey> = [
  "Teams",
  "WorkItems",
  "Events",
] as const;

/** Alias used in some UI parts. */
export type TeamCommentSubSectionKey = CommentSubSectionKey;
export const TeamCommentSubSectionKeyValues = CommentSubSectionKeyValues;

/* ========================================================================== *
 * 2) COMMON PRIMITIVES
 * ========================================================================== */

export type ISODateString = string;
export type CommentSortOrder = "newest" | "oldest";

/* ========================================================================== *
 * 3) AUDIENCE (mirror backend)
 * ========================================================================== */

export type CommentAudience =
  | "all"
  | "executive"
  | "board"
  | "director"
  | "ceo"
  | "cfo"
  | "coo"
  | "cto"
  | "cio"
  | "admin"
  | "system"
  | "user"
  | "owner"
  | "tenant"
  | "agent"
  | "broker"
  | "landlord"
  | "leasing"
  | "leasing_manager"
  | "property_manager"
  | "facility_manager"
  | "estate_manager"
  | "operator"
  | "manager"
  | "lead"
  | "supervisor"
  | "captain"
  | "member"
  | "observer"
  | "finance"
  | "accountant"
  | "accounts_payable"
  | "accounts_receivable"
  | "billing"
  | "payroll"
  | "procurement"
  | "legal"
  | "compliance"
  | "auditor"
  | "hr"
  | "reception"
  | "customer_support"
  | "call_center"
  | "developer"
  | "qa"
  | "devops"
  | "it_support"
  | "data_analyst"
  | "mechanic"
  | "carpenter"
  | "electrician"
  | "plumber"
  | "technician"
  | "welder"
  | "driver"
  | "cleaner"
  | "security"
  | "gardener"
  | "painter"
  | "mason"
  | "helper"
  | "inspector"
  | "surveyor";

export const CommentAudienceValues = [
  "all",
  "executive",
  "board",
  "director",
  "ceo",
  "cfo",
  "coo",
  "cto",
  "cio",
  "admin",
  "system",
  "user",
  "owner",
  "tenant",
  "agent",
  "broker",
  "landlord",
  "leasing",
  "leasing_manager",
  "property_manager",
  "facility_manager",
  "estate_manager",
  "operator",
  "manager",
  "lead",
  "supervisor",
  "captain",
  "member",
  "observer",
  "finance",
  "accountant",
  "accounts_payable",
  "accounts_receivable",
  "billing",
  "payroll",
  "procurement",
  "legal",
  "compliance",
  "auditor",
  "hr",
  "reception",
  "customer_support",
  "call_center",
  "developer",
  "qa",
  "devops",
  "it_support",
  "data_analyst",
  "mechanic",
  "carpenter",
  "electrician",
  "plumber",
  "technician",
  "welder",
  "driver",
  "cleaner",
  "security",
  "gardener",
  "painter",
  "mason",
  "helper",
  "inspector",
  "surveyor",
] as const satisfies ReadonlyArray<CommentAudience>;

/* ========================================================================== *
 * 4) ATTACHMENTS (backend-aligned)
 * ========================================================================== */

export type CommentAttachmentSource = "unknown" | "remote" | "local";
export const CommentAttachmentSourceValues = ["unknown", "remote", "local"] as const;

export interface CommentAttachmentDto {
  url: string;
  name: string;

  mimetype?: string | null;
  source: CommentAttachmentSource;

  sizeBytes?: number | null;
  uploadedAtIso?: ISODateString | null;
  checksumSha256?: string | null;
}

/* ========================================================================== *
 * 5) TARGET DTO (STRICT UNION — matches backend rule)
 * ========================================================================== */

type CommentTargetBase = {
  refId: string;

  module?: string;
  scope?: Record<string, unknown> | null;

  /**
   * Optional override used by backend runtime mapping (rare).
   * If present, backend validates it.
   */
  modelName?: string;
};

export type CommentTargetDto =
  | {
      section: "Users";
      subSection?: never;
    } & CommentTargetBase
  | {
      section: "Properties";
      subSection?: never;
    } & CommentTargetBase
  | {
      section: "Complaints";
      subSection?: never;
    } & CommentTargetBase
  | {
      section: "Tenants";
      subSection?: never;
    } & CommentTargetBase
  | {
      section: "Leases";
      subSection?: never;
    } & CommentTargetBase
  | {
      section: "Teams";
      subSection: CommentSubSectionKey; // REQUIRED ✅
    } & CommentTargetBase;

export type CommentSection = CommentSectionKey;
export type CommentSubSection = CommentSubSectionKey;

/**
 * Used only for parsing loose multipart fields before you build CommentTargetDto.
 * (DO NOT store this shape as canonical target.)
 */
export type CommentTargetPeekDto = {
  section: CommentSection;
  refId: string;
  subSection?: string; // optional here (transport)
  scope?: Record<string, unknown> | null;
  module?: string;
  modelName?: string;
};

/* ========================================================================== *
 * 6) AUTHOR DTO (backend-aligned)
 * ========================================================================== */

export interface CommentAuthorDto {
  authorId: string;
  name: string;
  role?: CommentAudience | null;
  image?: string | null;
}

/* ========================================================================== *
 * 7) COMMENT DTO (backend-aligned)
 * ========================================================================== */

export interface CommentDto {
  commentTarget: CommentTargetDto;

  commentId: string;

  // Author (flat fields)
  byUserId: string;
  byName: string;
  byUsername: string;
  byAvatarUrl?: string | null;

  // Visibility
  audience: CommentAudience;

  // Content
  messageHtml: string;

  // Attachments
  attachments?: CommentAttachmentDto[] | null;

  // Optional enriched author block
  author?: CommentAuthorDto | null;

  // Threading (nested replies)
  parentCommentId?: string | null;
  threadRootId?: string | null;
  depth?: number | null;
  path?: string | null;

  // Pin support
  pinned?: boolean | null;
  pinnedAtIso?: ISODateString | null;
  pinnedByUserId?: string | null;

  // Timestamps (backend requires both)
  createdAtIso: ISODateString;
  updatedAtIso: ISODateString;
}

/* ========================================================================== *
 * 8) LOAD FILTERS / PAGINATION (backend-aligned)
 * ========================================================================== */

export interface CommentLoadFilters {
  // Target filtering
  section?: CommentSection;
  subSection?: string; // keep string for forward-compat; runtime validates via registry
  refId?: string;
  module?: string;

  // Scope match support
  scopeKey?: string;
  scopeValue?: string;

  // Author / audience
  byUserId?: string;
  audience?: CommentAudience;

  // Thread filtering
  threadRootId?: string;
  parentCommentId?: string;
  topLevelOnly?: boolean;
  pinnedOnly?: boolean;

  // Date range (ISO strings)
  fromIso?: ISODateString;
  toIso?: ISODateString;

  // Search
  q?: string;
}

export type CommentPagination =
  | { mode: "offset"; offset: number; limit: number }
  | {
      mode: "cursor";
      limit: number;
      cursor?: string;
    };

export interface CommentLoadRequest {
  filters?: CommentLoadFilters | undefined; // backend: optional
  pagination: CommentPagination;
  sort?: CommentSortOrder; // backend: optional
}

export interface CommentLoadResponse {
  rows: CommentDto[];
  total: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

/**
 * FE-safe replacement for backend legacy mongoose FilterQuery<any>.
 * Keep it as a plain record.
 */
export interface CommentCountRequest {
  entityFilter: Record<string, unknown>;
  filters?: CommentLoadFilters;
}

/* ========================================================================== *
 * 9) REST CONTRACTS (multipart + edit)
 * ========================================================================== */

/**
 * Browser-compatible subset of File.
 * (Real browser File extends this structurally.)
 */
export interface FileLike {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface CommentRestAddRequest {
  // content
  messageHtml: string;
  audience: CommentAudience;

  /**
   * Target can be passed as a JSON string (multipart safe).
   * Backend rest service can parse this first if present.
   */
  commentTargetJson?: string;

  /**
   * Or pass raw target fields (legacy / UI convenience).
   * IMPORTANT: For Teams, subSection is required.
   */
  section?: CommentTargetDto["section"];
  subSection?: CommentSubSectionKey;
  refId?: string;
  module?: string;
  modelName?: string;
  scopeJson?: string;

  // threading / pin transport
  commentId?: string;
  parentCommentId?: string;
  threadRootId?: string;
  pinned?: boolean;

  /**
   * ✅ FE File[] support (multipart upload):
   * - Use FormData in request layer.
   * - Types allow File[] directly.
   */
  files?: File[];
  attachments?: File[];
}

export interface CommentRestEditRequest {
  id: string;

  messageHtml?: string;
  audience?: CommentAudience;

  attachments?: CommentAttachmentDto[] | null;
}

export interface CommentRestEnvelope<T> {
  ok?: boolean;
  message?: string;

  comments?: T;
  comment?: T;
  other?: T;

  pagination?: unknown;
  meta?: unknown;
}

export type CommentRestCountResponse = CommentRestEnvelope<{
  total: number;
  filters?: CommentLoadFilters;
}>;
