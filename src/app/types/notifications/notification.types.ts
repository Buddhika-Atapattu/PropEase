/* ============================================================================
 * Notification Hub — Frontend Canonical Types (DTO-only)
 * ----------------------------------------------------------------------------
 * GOAL
 * - Mirror backend DTO contracts (NO mongoose, NO express, NO sessions)
 * - IDs are strings
 * - Dates are ISODateString
 * - exactOptionalPropertyTypes-safe: optional props are OMITTED (never undefined)
 *
 * KEEP OUT of this file
 * - Backend service/controller inputs (ClientSession, etc.)
 * - Aggregation row shapes ($project interfaces)
 * - Engine internals (DefaultRule, resolver contexts, etc.)
 * ========================================================================== */

import type { User } from "../../services/APIs/apis.service";
import type { ISODateString, Role } from "../common";
import type { NotificationActionKey } from "./notification-action-keys.catalog";

/* =============================================================================
 * 01) Atomic primitives (smallest)
 * ========================================================================== */

/** Backend event key string (ex: "lease:created", "payment:failed", etc.) */
export type NotificationEventKey = string;

/** Your UI/engine severity levels (must match backend union). */
export type NotificationSeverity = "info" | "success" | "warning" | "error";

/**
 * Notification categories (must match backend).
 *
 * NOTE
 * - Your earlier TS error shows backend has "Security" and "Audit".
 * - Keep this union strictly aligned with backend categories.
 */
export type NotificationCategory =
  | 'All'
  | "System"
  | "Security"
  | "Audit"
  | "User"
  | "Team"
  | "Tenant"
  | "Lease"
  | "Payment"
  | "Property"
  | "Complaint"
  | "Comment";

/** Allowed audience modes (mirrors backend). */
export type NotificationAudienceMode = "User" | "Role" | "Team" | "Company";

/** Scope used by WS-RPC / UI tabs */
export type NotificationScope = "user" | "role" | "company";

/** Priority segmentation used by WS-RPC / UI tabs */
export type NotificationPriorityScope = "all" | "prioritized" | "unprioritized";

/** ✅ Runtime enum lists used by WS/REST sanitizers (NO undefined values). */
export const NOTIFICATION_CATEGORY_VALUES = [
  "All",
  "User",
  "Tenant",
  "Property",
  "Lease",
  "Complaint",
  "Payment",
  "Team",
  "Comment",
  "System",
  "Security",
  "Audit",
] as const satisfies readonly NotificationCategory[];

export const NOTIFICATION_SEVERITY_VALUES = [
  "info",
  "success",
  "warning",
  "error",
] as const satisfies readonly NotificationSeverity[];

export const NOTIFICATION_AUDIENCE_MODE_VALUES = [
  "User",
  "Team",
  "Company",
  "Role",
] as const satisfies readonly NonNullable<NotificationLoadFilters[ "mode" ]>[];

/* =============================================================================
 * 02) Audience DTOs (small → medium)
 * ========================================================================== */

/**
 * Audience descriptor (who should receive the notification).
 *
 * Usage
 * - Stored in the master notification as an ARRAY: audiences: NotificationAudience[]
 * - Filters can match on audiences.mode or elemMatch blocks (backend aggregation)
 */
export type NotificationAudience =
  | { mode: "Company"; }
  | { mode: "Role"; roleKey: Role; }
  | { mode: "Team"; teamCode: string; }
  | { mode: "User"; userId: string; };

/* =============================================================================
 * 03) Actor DTO (who triggered it)
 * ========================================================================== */

/**
 * Actor identity describing who caused the event.
 *
 * Usage
 * - Display "Triggered by X"
 * - Audit attribution
 * - Targeting logic for “self vs others” UI decisions
 */
export interface NotificationActorDto {
  userId: string;
  username: string;
  role: Role;

  /** Optional: user may belong to multiple teams */
  teamCodes?: string[];

  /** Optional: branch scoping if your org model uses branches */
  branchId?: string;
}

/* =============================================================================
 * 04) Target DTO (how UI should navigate/open context)
 * ========================================================================== */

/**
 * Target navigation object.
 *
 * Usage
 * - Used by FE route-map service to decide navigation
 * - actionKey is your canonical route action identifier
 * - params carries route/query/state inputs (must be JSON-safe)
 */
export interface NotificationTarget {
  module?: string;
  category?: string;
  refId?: string;

  route?: string;

  actionKey?: NotificationActionKey;

  /** JSON-safe parameters */
  params?: Record<string, unknown>;
}

/* =============================================================================
 * 05) Delivery driver switches (optional)
 * ========================================================================== */

/**
 * Delivery driver flags (mainly backend concern, but DTO-visible).
 *
 * Usage
 * - FE might show icons (email/push/sms) for debugging or admin tooling.
 * - For normal user UI, you can ignore this object.
 */
export interface NotificationDeliveryDrivers {
  audit: boolean;
  email: boolean;
  external: boolean;
  mq: boolean;
  push: boolean;
  sms: boolean;
}

/* =============================================================================
 * 06) Emit input DTO (kept for completeness; FE usually does NOT emit)
 * ========================================================================== */

/**
 * Emit input contract (backend accepts this).
 *
 * Usage (FE)
 * - Typically NOT used from UI
 * - Useful for admin tools / manual emits / tests
 *
 * IMPORTANT
 * - audiences MUST be an array (even if single recipient)
 * - Do NOT include legacy `audience` here (remove drift); backend canonical is audiences[]
 */
export interface NotificationEmitInput {
  eventKey: NotificationEventKey;

  audiences: NotificationAudience[];

  actor: NotificationActorDto;

  target?: NotificationTarget;

  delivery?: NotificationDeliveryDrivers;

  vars?: Record<string, unknown>;

  category?: NotificationCategory;
  severity?: NotificationSeverity;

  icon?: string;
  tags?: string[];
}

/* =============================================================================
 * 07) Core notification DTO (master notification document)
 * ========================================================================== */

/**
 * Master notification DTO (content + audiences + actor + target).
 *
 * Usage
 * - Part of inbox items (NotificationInboxItemDto.notification)
 * - Render title/body, badges, action buttons
 */
export interface NotificationCoreDto {
  id: string;

  eventKey: NotificationEventKey;
  category: NotificationCategory;
  severity: NotificationSeverity;

  title: string;
  body: string;

  icon?: string;
  tags?: string[];

  target?: NotificationTarget;

  actor: NotificationActorDto;

  /** Always array */
  audiences: NotificationAudience[];

  createdAt: ISODateString;
  expiresAt?: ISODateString;
}

/* =============================================================================
 * 08) User state DTO (optional, if you ever expose raw state rows)
 * ========================================================================== */

/**
 * User-state row DTO (per-user inbox state).
 *
 * Usage
 * - Most UI uses NotificationInboxItemDto instead.
 * - Keep this only if you plan to expose “raw state rows” separately.
 */
export interface NotificationUserStateDto {
  userId: string;
  username?: string;

  notificationId: string;

  isRead: boolean;
  readAt?: ISODateString;

  /** Soft delete (trash) */
  isDeleted: boolean;
  deletedAt?: ISODateString;

  /** Archive (hide without deleting) */
  isArchived: boolean;
  archivedAt?: ISODateString;

  deliveredAt: ISODateString;

  /** Optional joined master notification */
  notification?: NotificationCoreDto;
}

/* =============================================================================
 * 09) Inbox item DTO (main UI consumption type)
 * ========================================================================== */

/**
 * Inbox item DTO = (user state + joined master notification)
 *
 * Usage
 * - Primary list rendering model for UI
 * - inboxId is the per-user row id (user_notifications._id as string)
 */
export interface NotificationInboxItemDto {
  inboxId: string;

  userId: string;
  username: string;

  isRead: boolean;
  readAt?: ISODateString;

  isDeleted: boolean;

  notification: NotificationCoreDto;
}

/* =============================================================================
 * 10) Query / load contracts (largest DTO layer)
 * ========================================================================== */

/**
 * Filters sent to backend for server-side filtering.
 *
 * exactOptionalPropertyTypes note
 * - These are optional fields.
 * - In builder functions, ONLY set them when defined.
 */
export interface NotificationLoadFilters {
  category?: NotificationCategory;
  severity?: NotificationSeverity;
  mode?: "User" | "Team" | "Company" | "Role";
  search?: string;
  from?: ISODateString;
  to?: ISODateString;
  unreadOnly?: boolean;
  includeDeleted?: boolean;
  includeArchived?: boolean;
}

/**
 * Load request contract.
 *
 * IMPORTANT
 * - filters is REQUIRED in backend (you enforced this already)
 * - always pass {} when no filters are needed
 */
export interface NotificationLoadRequest {
  userId: string,
  username: string;
  page: number;
  limit: number;
  filters: NotificationLoadFilters;
  me: User;
}

/** List response for “classic inbox load”. */
export interface NotificationLoadResponse {
  items: NotificationInboxItemDto[];
  other: { total: number; };
}

/** Count response used for badges (classic total/unread). */
export interface NotificationCountResponse {
  total: number;
  unread: number;
  prioritized: number;
  unprioritized: number;
}

export interface NotificationTitleBodyPatch {
  title?: string;
  body?: string;
}


