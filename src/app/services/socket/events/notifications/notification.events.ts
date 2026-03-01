// Path: src/app/socket/events/notifications/notification.events.ts
// =============================================================================
// Notifications — WebSocket Events (Frontend Mirror)
// -----------------------------------------------------------------------------
// 01) Introduction
// - FE mirror of backend NotificationEvents + NotificationRooms.
// - Must remain byte-for-byte compatible for event keys.
//
// 02) Important matters
// - Rooms are universal: user:<username>, role:<role>, team:<teamCode>, company
// - Do NOT invent room names elsewhere.
//
// 03) Why we make this
// - NotificationHub / NotificationSocketService rely on these stable constants.
//
// 04) Usage hint
// - socket.on(NotificationEvents.NEW, ...)
// - socket.emit(NotificationRpcEvents.INBOX_LIST, req, ack)
// =============================================================================

import { UniversalSocketRooms } from "../universal-socket.events";

export class NotificationEvents {
  private constructor() {}

  public static readonly NEW = "notify:new";
  public static readonly PATCH = "notify:patch";
  public static readonly DELETE =  "notify:delete";
  public static readonly COUNT = "notify:count";
  public static readonly BULK = "notify:bulk";

  public static readonly DOMAIN_RESTORED = "notify:domain-restored";
  public static readonly DOMAIN_PURGED = "notify:domain-purged";
}

export class NotificationRooms {
  private constructor() {}

  public static readonly COMPANY: string = UniversalSocketRooms.COMPANY;

  public static user(username: string): string {
    const u = typeof username === "string" ? username.trim() : "";
    return UniversalSocketRooms.user( username );
  }

  public static role(roleKey: string): string {
    const r = typeof roleKey === "string" ? roleKey.trim() : "";
    return UniversalSocketRooms.role( roleKey );
  }

  public static team(teamCode: string): string {
    const t = typeof teamCode === "string" ? teamCode.trim() : "";
    return UniversalSocketRooms.team( teamCode );
  }
}

export class NotificationRpcEvents {
  private constructor() {}

  public static readonly INBOX_LIST = "notify:rpc:inbox:list";
  public static readonly INBOX_COUNTS = "notify:rpc:inbox:counts";
  public static readonly MARK_READ = "notify:rpc:mark:read";
  public static readonly MARK_ALL_READ = "notify:rpc:mark:all-read";
  public static readonly ARCHIVE_ONE = "notify:rpc:archive:one";
}
