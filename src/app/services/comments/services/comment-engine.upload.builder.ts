// ============================================================================
// PropEase FE — Comment Engine Upload Contracts
// ----------------------------------------------------------------------------
// Purpose:
//  - Types for standalone upload endpoints (NOT /add multipart)
//  - Maps backend UploadedFileMeta -> CommentAttachmentDto
// ============================================================================

import type { CommentAttachmentDto } from "../contracts/comment.contract";

/**
 * Mirrors backend "UploadedFileMeta" (from FileUploader.handleMultiFieldUploadWithMeta()).
 *
 * IMPORTANT:
 * - `relativePath` should be a PropEase-safe relative URL (no leading "/")
 *   OR may be an absolute URL depending on backend implementation.
 */
export interface UploadedFileMeta {
  originalName: string;
  storedName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;

  /**
   * Backend may send:
   * - "uploads/comments/<...>/attachments/<file>"
   * OR
   * - "http(s)://host/uploads/comments/<...>/attachments/<file>"
   */
  relativePath: string;
}

/**
 * Response shape for upload endpoints.
 * You can keep it generic and match backend response keys later.
 */
export interface CommentEngineUploadResponse {
  uploaded: Record<string, UploadedFileMeta[]>;
}

/**
 * Helper output for UI composer:
 * - attachments for comment payload
 * - raw meta if UI needs it (preview, delete, etc.)
 */
export interface CommentEngineUploadResult {
  uploaded: Record<string, UploadedFileMeta[]>;
  attachments: CommentAttachmentDto[];
}
