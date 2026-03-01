// Path: src/app/socket/events/recyclebin/recyclebin.events.ts
// =============================================================================
// RecycleBin — WebSocket Events (Frontend Mirror) — ROOM NAMES FIXED
// =============================================================================

import type { RecycleBinEntryDto } from "../../../../types/recyclebin/recyclebin.types";
import { UniversalSocketRooms } from "../universal-socket.events";

/* =============================================================================
 * A) Rooms (Stable Forever) — MUST MATCH GLOBAL RULES
 * - company
 * - role.<role>
 * - team.<teamCode>
 * - user.<username>
 * ========================================================================== */
export class RecycleBinRooms {
  private constructor() {}

  public static company(): string {
    return UniversalSocketRooms.COMPANY;
  }

  public static role(roleKey: string): string {
    const r = typeof roleKey === "string" ? roleKey.trim() : "";
    return UniversalSocketRooms.role( roleKey );
  }

  public static team(teamCode: string): string {
    const t = typeof teamCode === "string" ? teamCode.trim() : "";
    return UniversalSocketRooms.team( teamCode );
  }

  public static user(username: string): string {
    const u = typeof username === "string" ? username.trim() : "";
    return UniversalSocketRooms.user( username );
  }
}

/* =============================================================================
 * B) Event Names (Stable Forever)
 * ========================================================================== */
export class RecycleBinEvents {
  private constructor() {}

  public static readonly SOFT_DELETED: string = "rb:soft-deleted";
  public static readonly RESTORED: string = "rb:restored";
  public static readonly PERMANENT_DELETED: string = "rb:permanent-deleted";
  public static readonly COUNT: string = "rb:count";
  public static readonly BULK: string = "rb:bulk";

  public static readonly LIST_ITEM: string = "rb:list-item";
}

/* =============================================================================
 * C) Payload Contracts (WS Layer Only)
 * ========================================================================== */

export interface RecycleBinSoftDeletedPayload {
  entryId: string;
  sourceKey: string;
  refId: string;
  label?: string;
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

  recorded?: number;
  restoreInProgress?: number;
  restored?: number;
  failed?: number;
}

export interface RecycleBinBulkPayload {
  reason: "bulk-update" | "system-refresh" | "rebuild";
}

export interface RecycleBinListItemPayload {
  item: RecycleBinEntryDto;
}
