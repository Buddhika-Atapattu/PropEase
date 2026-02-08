// Path: src/app/services/comments/contracts/comment.rest.contract.ts
// ============================================================================
// PropEase FE — Comment REST Contracts (SINGLE TRUTH)
// ----------------------------------------------------------------------------
// ✅ REST-only request/response shapes for Comment Engine endpoints.
// ✅ Reuses domain types from comment.contract.ts (no re-definitions).
// ✅ subSection uses CommentTargetDto["subSection"] (Teams-safe).
// ============================================================================

import type {
  CommentAttachmentDto,
  CommentAudience,
  CommentDto,
  CommentLoadFilters,
  CommentLoadRequest,
  CommentLoadResponse,
  CommentPagination,
  CommentSortOrder,
  CommentTargetDto,
  ISODateString,
} from "./comment.contract";

/* ========================================================================== *
 * QUERY TYPES (used by REST service param builders)
 * ========================================================================== */

export interface CommentRestLoadQuery {
  filters: CommentLoadFilters;
  pagination: CommentPagination;
  sort?: CommentSortOrder;

  /**
   * Legacy compatibility:
   * some endpoints use start/limit instead of offset/limit + mode.
   * Keep this as service-level behavior (not contract-level).
   */
}

export interface CommentRestCountQuery {
  filters: CommentLoadFilters;
}

/* ========================================================================== *
 * EDIT (PATCH /edit/:id)
 * ========================================================================== */

export interface CommentRestEditRequest {
  id: string;

  messageHtml?: string;
  audience?: CommentAudience;

  // semantics:
  // - undefined => untouched
  // - null => clear
  // - array => replace
  attachments?: CommentAttachmentDto[] | null;
}

/* ========================================================================== *
 * PIN / UNPIN (PATCH /pin/:id)
 * ========================================================================== */

export interface CommentRestPinToggleRequest {
  pinned: boolean;
}

/* ========================================================================== *
 * API DATA SHAPES (payload only; actual envelope is MSG in your project)
 * ----------------------------------------------------------------------------
 * These are the stable "data" shapes that backend should put into MSG.data.
 * ========================================================================== */

export interface CommentRestCountData {
  total: number;
  filters?: CommentLoadFilters;
}

export interface CommentRestGetData {
  comment: CommentDto | null;
}

export interface CommentRestDeleteData {
  id: string;
  deleted: boolean;
}

export interface CommentRestPinToggleData {
  id: string;
  pinned: boolean;
  comment?: CommentDto | null;
}

export type CommentRestLoadData = CommentLoadResponse;
export type CommentRestLoadAdvancedData = CommentLoadResponse;
export type CommentRestAddData = CommentDto;
export type CommentRestEditData = CommentDto;

/* ========================================================================== *
 * Re-exports (optional convenience)
 * ========================================================================== */

export type {
  CommentLoadRequest,
  CommentLoadResponse,
  ISODateString,
};
