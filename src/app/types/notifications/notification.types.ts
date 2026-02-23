// Path: src/app/types/notifications/notification.types.ts

/* ============================================================================
 * Notification Hub — Frontend Canonical Types
 * ----------------------------------------------------------------------------
 * ✅ MUST match backend: src/types/notification/notification.types.ts
 * ✅ No mongoose / no express
 * ✅ IDs are strings
 * ✅ Dates are ISO strings
 * ✅ exactOptionalPropertyTypes-safe: omit optional props when absent
 * ========================================================================== */

import type { ISODateString } from "../common";
import type { NotificationActionKey } from "./notification-action-keys.catalog";

/* =============================================================================
 * 01) Basic domain enums / unions
 * ========================================================================== */

export type NotificationSeverity = "info" | "success" | "warning" | "error";

export type NotificationCategory =
  | "User"
  | "Tenant"
  | "Property"
  | "Lease"
  | "Complaint"
  | "Payment"
  | "Team"
  | "Comment"
  | "System";

export type NotificationEventKey = string;

/* =============================================================================
 * 02) Audience model
 * ========================================================================== */

export type NotificationAudience =
  | { mode: "Company" }
  | { mode: "Role"; roleKey: string }
  | { mode: "Team"; teamCode: string }
  | { mode: "User"; userId: string };

/* =============================================================================
 * 03) Actor model
 * ========================================================================== */

export interface NotificationActorDto {
  userId: string;
  username: string;
  role: string;

  teamCodes?: string[];
  branchId?: string;
}

/* =============================================================================
 * 04) Target navigation model
 * ========================================================================== */

export interface NotificationTarget {
  module?: string;
  category?: string;
  refId?: string;

  route?: string;

  actionKey?: NotificationActionKey;

  params?: Record<string, unknown>;
}

/* =============================================================================
 * 05) Delivery switches
 * ========================================================================== */

export interface NotificationDeliveryDrivers {
  audit: boolean;
  email: boolean;
  external: boolean;
  mq: boolean;
  push: boolean;
  sms: boolean;
}

/* =============================================================================
 * 06) Emit input (frontend usually doesn't emit; kept for completeness)
 * ========================================================================== */

export interface NotificationEmitInput {
  eventKey: NotificationEventKey;

  // ✅ Always array even single
  audiences: NotificationAudience[];

  // ⚠ legacy fallback
  audience?: NotificationAudience;

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
 * 07) Core notification DTO
 * ========================================================================== */

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

  audiences: NotificationAudience[];

  createdAt: string;
  expiresAt?: string;
}

export interface NotificationUserStateDto {
  userId: string;
  username?: string;

  notificationId: string;

  isRead: boolean;
  readAt?: ISODateString;

  /**
   * Soft delete (trash)
   */
  isDeleted: boolean;
  deletedAt?: Date;

  /**
   * Archive (hide without deleting)
   */
  isArchived: boolean;
  archivedAt?: ISODateString;

  deliveredAt: ISODateString;
  notification?: NotificationCoreDto;
}

/* =============================================================================
 * 08) Inbox item DTO
 * ========================================================================== */

export interface NotificationInboxItemDto {
  inboxId: string;

  userId: string;
  username: string;

  isRead: boolean;
  readAt?: string;

  isDeleted: boolean;

  notification: NotificationCoreDto;
}

/* =============================================================================
 * 09) Load / filter contracts
 * ========================================================================== */

export interface NotificationLoadFilters {
  search?: string;
  category?: NotificationCategory;
  severity?: NotificationSeverity;

  mode?: NotificationAudience["mode"];

  unreadOnly?: boolean;

  includeDeleted?: boolean;
  includeArchived?: boolean;

  from?: string;
  to?: string;
}

export interface NotificationLoadRequest {
  username: string;
  page: number;
  limit: number;
  filters?: NotificationLoadFilters;
}

export interface NotificationLoadResponse {
  items: NotificationInboxItemDto[];
  other: { total: number };
}

export interface NotificationCountResponse {
  total: number;
  unread: number;
}
