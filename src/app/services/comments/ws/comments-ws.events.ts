// ============================================================================
// Comments WS Events (canonical) — MUST MATCH BACKEND
// Path: src/app/services/comments/ws/comments-ws.events.ts
// ============================================================================

export const COMMENTS_WS_EVENTS = {
  // Client -> Server
  SUBSCRIBE: "comments:subscribe",
  UNSUBSCRIBE: "comments:unsubscribe",

  // Server -> Client (broadcasts)
  SUBSCRIBED: "comments:subscribed",
  UNSUBSCRIBED: "comments:unsubscribed",

  CREATED: "comments:created",
  UPDATED: "comments:updated",
  DELETED: "comments:deleted",

  PINNED: "comments:pinned",
  UNPINNED: "comments:unpinned",
  TOGGLED: "comments:toggled",

  ERROR: "comments:error",
} as const;

export type CommentsWsEventKey =
  (typeof COMMENTS_WS_EVENTS)[keyof typeof COMMENTS_WS_EVENTS];
