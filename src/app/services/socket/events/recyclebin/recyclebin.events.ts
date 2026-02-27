// Path: src/app/socket/events/recyclebin/recyclebin.events.ts
// =============================================================================
// RecycleBin — WebSocket Events (Frontend Mirror)
// -----------------------------------------------------------------------------
// 01. Introduction
// - Centralizes FE WebSocket event names, room conventions, and payload DTOs.
// - Mirrors backend RecycleBin taxonomy: rb:*
//
// 02. Important matters
// - Rooms must be stable and consistent with SocketConnectionHandler conventions.
// - Payloads are FE-safe: IDs are strings (no ObjectId).
// - Optional props must be omitted by emitters (exactOptionalPropertyTypes-safe).
//
// 03. Why we make this file
// - Avoid hard-coded strings scattered across UI/services.
// - Prevent drift between backend WS emit and frontend WS listen.
//
// 04. Usage hint
// - socket.join(RecycleBinRooms.COMPANY)
// - socket.join(RecycleBinRooms.role(auth.role))
// - socket.on(RecycleBinEvents.SOFT_DELETED, (p: RecycleBinSoftDeletedPayload) => ...)
//
// 05. Keep in mind
// - Do not log full payloads (may contain snapshot references).
// =============================================================================

import type { RecycleBinEntryDto } from "../../../../types/recyclebin/recyclebin.types";

/* =============================================================================
 * A) Rooms (Stable Forever)
 * ========================================================================== */

export class RecycleBinRooms {
  private constructor() {}

  public static readonly COMPANY: string = " company";

  /**
   * Role audience room.
   *
   * @param roleKey
   * - Expected: role key string (e.g. "Admin", "Manager", "Staff")
   * - Used for: role-level broadcast
   */
  public static role(roleKey: string): string {
    const r = typeof roleKey === "string" ? roleKey.trim() : "";
    return ` role.${ r || "Unknown" }`;
  }

  /**
   * Team audience room.
   *
   * @param teamCode
   * - Expected: team code string (e.g. "TEAM-001")
   * - Used for: team-scoped broadcast
   */
  public static team(teamCode: string): string {
    const t = typeof teamCode === "string" ? teamCode.trim() : "";
    return ` team.${ t || "Unknown" }`;
  }

  /**
   * User audience room.
   *
   * @param username
   * - Expected: username string
   * - Used for: user-specific messages
   */
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

  /**
   * If restore creates a *new* live record ID (rare),
   * backend may send restoredRefId.
   *
   * IMPORTANT:
   * - Optional must be omitted by emitters (never pass undefined).
   */
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

/**
 * When backend pushes a single list item update (optional feature),
 * we standardize the item shape to the main entry DTO.
 */
export interface RecycleBinListItemPayload {
  item: RecycleBinEntryDto;
}
