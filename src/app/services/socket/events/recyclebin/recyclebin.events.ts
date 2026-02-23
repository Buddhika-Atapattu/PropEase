// Path: src/app/socket/events/recyclebin/recyclebin.events.ts
// =============================================================================
// RecycleBin — WebSocket Events (Frontend Mirror)
// -----------------------------------------------------------------------------
// PURPOSE
// - FE imports stable event names + room conventions from ONE place.
// - Align with backend taxonomy: rb:*
//
// IMPORTANT
// - Payloads here are FE-safe (no Mongo ObjectId).
// =============================================================================

import type { RecycleBinListItemDto } from "../../../../types/recyclebin/recyclebin.types";

/* =============================================================================
 * A) Rooms (Stable Forever)
 * ========================================================================== */

export class RecycleBinRooms {
  private constructor() {}

  public static readonly COMPANY: string = "aud.company";

  public static role(roleKey: string): string {
    const r = typeof roleKey === "string" ? roleKey.trim() : "";
    return `aud.role.${r || "Unknown"}`;
  }

  public static team(teamCode: string): string {
    const t = typeof teamCode === "string" ? teamCode.trim() : "";
    return `aud.team.${t || "Unknown"}`;
  }

  public static user(username: string): string {
    const u = typeof username === "string" ? username.trim() : "";
    return `user:${u || "unknown"}`;
  }
}

/* =============================================================================
 * B) Event Names
 * ========================================================================== */

export class RecycleBinEvents {
  private constructor() {}

  public static readonly SOFT_DELETED: string = "rb:soft-deleted";
  public static readonly RESTORED: string = "rb:restored";
  public static readonly PERMANENT_DELETED: string = "rb:permanent-deleted";
  public static readonly COUNT: string = "rb:count";
  public static readonly BULK: string = "rb:bulk";
}

/* =============================================================================
 * C) Payload Contracts (WS Layer Only)
 * ========================================================================== */

export interface RecycleBinSoftDeletedPayload {
  sourceKey: string;
  refId: string;
  entryId: string;
}

export interface RecycleBinRestoredPayload {
  entryId: string;
  sourceKey: string;
  refId: string;
  restoredRefId?: string;
}

export interface RecycleBinPermanentDeletedPayload {
  entryId: string;
  sourceKey: string;
  refId: string;
}

export interface RecycleBinCountPayload {
  total: number;
}

export interface RecycleBinBulkPayload {
  reason: "bulk-update" | "system-refresh" | "rebuild";
}

export interface RecycleBinListItemPayload {
  item: RecycleBinListItemDto;
}
