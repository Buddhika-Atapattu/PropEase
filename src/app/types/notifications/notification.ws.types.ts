// Path: src/app/types/notifications/notification.ws.types.ts

import type { NotificationInboxItemDto, NotificationCountResponse } from "./notification.types";

/**
 * MUST align with backend:
 * src/socket/events/notifications/notification.events.ts
 */

export interface NotifyNewPayload {
  item: NotificationInboxItemDto;
  count?: NotificationCountResponse;
}

export interface NotifyPatchPayload {
  inboxId: string;
  patch: {
    isRead?: boolean;
    readAt?: string;

    isDeleted?: boolean;

    isArchived?: boolean;
    archivedAt?: string;
  };
  count?: NotificationCountResponse;
}

export type NotifyCountPayload = NotificationCountResponse;

export interface NotifyBulkPayload {
  reason: "bulk-update" | "server-sync" | "policy-change" | "unknown";
  count?: NotificationCountResponse;
}
