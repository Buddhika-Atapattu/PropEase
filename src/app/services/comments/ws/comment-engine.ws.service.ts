// Path: src/app/services/comments/ws/comment-engine.ws.service.ts
// ============================================================================
// PropEase FE — CommentEngineWsService (WebSocket only) — CANONICAL (Phase-2)
// ----------------------------------------------------------------------------
// Responsibilities:
//   ✅ Realtime subscribe/unsubscribe per target
//   ✅ Listen to broadcasts (created/updated/deleted/pinned/unpinned/toggled)
//   ✅ Expose RxJS Observables for comment realtime
//   ✅ Strong typing, exactOptionalPropertyTypes-safe (never pass undefined)
//
// IMPORTANT ALIGNMENT NOTES:
//   - Backend gateway only handles:
//       client -> server: comments:subscribe, comments:unsubscribe
//       server -> client: subscribed/unsubscribed + created/updated/deleted/pinned/unpinned/toggled
//   - ALL writes must be REST (add/edit/delete/pin/unpin/toggle) then backend broadcasts WS.
//   - Frontend must NOT build room names; backend is authoritative for rooms.
// ============================================================================

import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";

import type {
  CommentDto,
  CommentTargetDto,
} from "../contracts/comment.contract";

import { COMMENTS_WS_EVENTS } from "./comments-ws.events";

/**
 * If you already have a socket client wrapper in PropEase,
 * adapt it to this interface and pass into connect().
 */
export interface SocketLike {
  connected: boolean;
  connect(): void;
  disconnect(): void;

  on(event: string, cb: (payload: any) => void): void;
  off(event: string, cb?: (payload: any) => void): void;

  emit(event: string, payload?: any): void;
  emit(event: string, payload: any, ack: (resp: any) => void): void;
}

/* ========================================================================== *
 * WS ACK CONTRACT (Socket.IO)
 * ========================================================================== */

export interface WsAckOk<T> {
  ok: true;
  data: T;
}

export interface WsAckErr {
  ok: false;
  message: string;
}

export type WsAck<T> = WsAckOk<T> | WsAckErr;

/* ========================================================================== *
 * CANONICAL WS PAYLOADS (aligned to backend gateway)
 * ========================================================================== */

export interface CommentsWsSubscribePayload {
  target: CommentTargetDto;
  focus?: {
    subSection?: string;
    module?: string;
    scopeKey?: string;
    scopeValue?: string;
  };
}

export interface CommentsWsSubscribedPayload {
  target: CommentTargetDto;
  rooms: string[];
}

export interface CommentsWsUnsubscribePayload {
  target: CommentTargetDto;
  focus?: {
    subSection?: string;
    module?: string;
    scopeKey?: string;
    scopeValue?: string;
  };
}

export interface CommentsWsUnsubscribedPayload {
  target: CommentTargetDto;
  rooms: string[];
}

export interface CommentsWsCreatedPayload {
  target: CommentTargetDto;
  comment: CommentDto;
}

export interface CommentsWsUpdatedPayload {
  target: CommentTargetDto;
  id: string;
  patch?: Record<string, unknown>;
  updatedComment?: CommentDto;
}

export interface CommentsWsDeletedPayload {
  target: CommentTargetDto;
  id: string;
}

export interface CommentsWsPinnedPayload {
  target: CommentTargetDto;
  id: string;
  pinnedAtIso: string;
  pinnedByUserId: string;
}

export interface CommentsWsUnpinnedPayload {
  target: CommentTargetDto;
  id: string;
}

export interface CommentsWsToggledPayload {
  target: CommentTargetDto;
  id: string;
  isPinned: boolean;
}

export interface CommentsWsErrorPayload {
  message: string;
}

/* ========================================================================== *
 * SERVICE
 * ========================================================================== */

@Injectable({ providedIn: "root" })
export class CommentEngineWsService {
  private socket: SocketLike | null = null;

  // ---------------------- Rx Streams (public) ----------------------

  private readonly connectedSubject = new Subject<boolean>();

  private readonly subscribedSubject = new Subject<CommentsWsSubscribedPayload>();
  private readonly unsubscribedSubject = new Subject<CommentsWsUnsubscribedPayload>();

  private readonly createdSubject = new Subject<CommentsWsCreatedPayload>();
  private readonly updatedSubject = new Subject<CommentsWsUpdatedPayload>();
  private readonly deletedSubject = new Subject<CommentsWsDeletedPayload>();

  private readonly pinnedSubject = new Subject<CommentsWsPinnedPayload>();
  private readonly unpinnedSubject = new Subject<CommentsWsUnpinnedPayload>();
  private readonly toggledSubject = new Subject<CommentsWsToggledPayload>();

  private readonly errorSubject = new Subject<CommentsWsErrorPayload>();

  public readonly connected$: Observable<boolean> = this.connectedSubject.asObservable();

  public readonly subscribed$: Observable<CommentsWsSubscribedPayload> = this.subscribedSubject.asObservable();
  public readonly unsubscribed$: Observable<CommentsWsUnsubscribedPayload> = this.unsubscribedSubject.asObservable();

  public readonly created$: Observable<CommentsWsCreatedPayload> = this.createdSubject.asObservable();
  public readonly updated$: Observable<CommentsWsUpdatedPayload> = this.updatedSubject.asObservable();
  public readonly deleted$: Observable<CommentsWsDeletedPayload> = this.deletedSubject.asObservable();

  public readonly pinned$: Observable<CommentsWsPinnedPayload> = this.pinnedSubject.asObservable();
  public readonly unpinned$: Observable<CommentsWsUnpinnedPayload> = this.unpinnedSubject.asObservable();
  public readonly toggled$: Observable<CommentsWsToggledPayload> = this.toggledSubject.asObservable();

  public readonly error$: Observable<CommentsWsErrorPayload> = this.errorSubject.asObservable();

  // Keep bound handlers so `off()` works correctly
  private readonly onSubscribed = (p: unknown): void => this.subscribedSubject.next(this.asSubscribed(p));
  private readonly onUnsubscribed = (p: unknown): void => this.unsubscribedSubject.next(this.asUnsubscribed(p));

  private readonly onCreated = (p: unknown): void => this.createdSubject.next(this.asCreated(p));
  private readonly onUpdated = (p: unknown): void => this.updatedSubject.next(this.asUpdated(p));
  private readonly onDeleted = (p: unknown): void => this.deletedSubject.next(this.asDeleted(p));

  private readonly onPinned = (p: unknown): void => this.pinnedSubject.next(this.asPinned(p));
  private readonly onUnpinned = (p: unknown): void => this.unpinnedSubject.next(this.asUnpinned(p));
  private readonly onToggled = (p: unknown): void => this.toggledSubject.next(this.asToggled(p));

  private readonly onError = (p: unknown): void => this.errorSubject.next(this.asError(p));

  // ----------------------------------------------------------------

  /**
   * Attach the shared socket instance used in your app.
   *
   * Example:
   *   commentsWs.connect(this.wsClient.socket);
   */
  public connect(socket: SocketLike): void {
    if (!socket) throw new Error("Socket instance is required.");

    // detach previous listeners if any
    this.detachListeners();

    this.socket = socket;

    if (!this.socket.connected) {
      this.socket.connect();
    }

    this.attachListeners();
    this.connectedSubject.next(this.socket.connected);
  }

  public disconnect(): void {
    this.detachListeners();

    if (this.socket && this.socket.connected) {
      this.socket.disconnect();
    }

    this.socket = null;
    this.connectedSubject.next(false);
  }

  public isConnected(): boolean {
    return !!this.socket?.connected;
  }

  // ===========================================================================
  // SUBSCRIBE / UNSUBSCRIBE (CANONICAL)
  // ===========================================================================

  public async subscribe(
    target: CommentTargetDto,
    focus?: { subSection?: string; module?: string; scopeKey?: string; scopeValue?: string },
  ): Promise<CommentsWsSubscribedPayload> {
    const sock = this.requireSocket();

    const payload: CommentsWsSubscribePayload = {
      target: this.sanitizeTarget(target),
      ...(focus ? { focus: this.sanitizeFocus(focus) } : {}),
    };

    return await this.emitAck<CommentsWsSubscribedPayload>(sock, COMMENTS_WS_EVENTS.SUBSCRIBE, payload);
  }

  public async unsubscribe(
    target: CommentTargetDto,
    focus?: { subSection?: string; module?: string; scopeKey?: string; scopeValue?: string },
  ): Promise<CommentsWsUnsubscribedPayload> {
    const sock = this.requireSocket();

    const payload: CommentsWsUnsubscribePayload = {
      target: this.sanitizeTarget(target),
      ...(focus ? { focus: this.sanitizeFocus(focus) } : {}),
    };

    return await this.emitAck<CommentsWsUnsubscribedPayload>(sock, COMMENTS_WS_EVENTS.UNSUBSCRIBE, payload);
  }

  // ===========================================================================
  // INTERNALS — socket + listeners
  // ===========================================================================

  private requireSocket(): SocketLike {
    if (!this.socket) {
      throw new Error("CommentEngineWsService is not connected. Call connect(socket) first.");
    }
    return this.socket;
  }

  private attachListeners(): void {
    if (!this.socket) return;

    // server -> client broadcasts
    this.socket.on(COMMENTS_WS_EVENTS.SUBSCRIBED, this.onSubscribed);
    this.socket.on(COMMENTS_WS_EVENTS.UNSUBSCRIBED, this.onUnsubscribed);

    this.socket.on(COMMENTS_WS_EVENTS.CREATED, this.onCreated);
    this.socket.on(COMMENTS_WS_EVENTS.UPDATED, this.onUpdated);
    this.socket.on(COMMENTS_WS_EVENTS.DELETED, this.onDeleted);

    this.socket.on(COMMENTS_WS_EVENTS.PINNED, this.onPinned);
    this.socket.on(COMMENTS_WS_EVENTS.UNPINNED, this.onUnpinned);
    this.socket.on(COMMENTS_WS_EVENTS.TOGGLED, this.onToggled);

    this.socket.on(COMMENTS_WS_EVENTS.ERROR, this.onError);
  }

  private detachListeners(): void {
    if (!this.socket) return;

    this.socket.off(COMMENTS_WS_EVENTS.SUBSCRIBED, this.onSubscribed);
    this.socket.off(COMMENTS_WS_EVENTS.UNSUBSCRIBED, this.onUnsubscribed);

    this.socket.off(COMMENTS_WS_EVENTS.CREATED, this.onCreated);
    this.socket.off(COMMENTS_WS_EVENTS.UPDATED, this.onUpdated);
    this.socket.off(COMMENTS_WS_EVENTS.DELETED, this.onDeleted);

    this.socket.off(COMMENTS_WS_EVENTS.PINNED, this.onPinned);
    this.socket.off(COMMENTS_WS_EVENTS.UNPINNED, this.onUnpinned);
    this.socket.off(COMMENTS_WS_EVENTS.TOGGLED, this.onToggled);

    this.socket.off(COMMENTS_WS_EVENTS.ERROR, this.onError);
  }

  /**
   * Ack wrapper:
   * - uses Socket.IO style ack callback
   * - enforces { ok: true, data } | { ok:false, message }
   */
  private async emitAck<T>(sock: SocketLike, event: string, payload: unknown): Promise<T> {
    return await new Promise<T>((resolve, reject): void => {
      sock.emit(event, payload, (ack: WsAck<T>): void => {
        if (!ack || typeof ack !== "object") {
          reject(new Error(`Invalid WS ack for "${event}".`));
          return;
        }

        if ((ack as WsAckOk<T>).ok === true) {
          resolve((ack as WsAckOk<T>).data);
          return;
        }

        const msg = String((ack as WsAckErr).message ?? `WS error on "${event}"`);
        reject(new Error(msg));
      });
    });
  }

  // ===========================================================================
  // INTERNALS — sanitize DTOs (exactOptionalPropertyTypes safe)
  // ===========================================================================

  private sanitizeTarget(target: CommentTargetDto): CommentTargetDto {
    const section = String((target as any)?.section ?? "").trim();
    const refId = String((target as any)?.refId ?? "").trim();

    if (!section) throw new Error("target.section is required.");
    if (!refId) throw new Error("target.refId is required.");

    const out: Record<string, unknown> = { section, refId };

    const subSection =
      typeof (target as any)?.subSection === "string" ? String((target as any).subSection).trim() : "";
    const module =
      typeof (target as any)?.module === "string" ? String((target as any).module).trim() : "";
    const modelName =
      typeof (target as any)?.modelName === "string" ? String((target as any).modelName).trim() : "";

    const scopeRaw = (target as any)?.scope;
    const scope = scopeRaw && typeof scopeRaw === "object" ? (scopeRaw as Record<string, unknown>) : null;

    // Only include optionals when present (never set undefined)
    if (subSection) out["subSection"] = subSection;
    if (module) out["module"] = module;
    if (modelName) out["modelName"] = modelName;

    // NOTE: backend allows scope to be null; keep consistent
    out["scope"] = scope;

    return out as CommentTargetDto;
  }

  private sanitizeFocus(focus: { subSection?: string; module?: string; scopeKey?: string; scopeValue?: string }): {
    subSection?: string;
    module?: string;
    scopeKey?: string;
    scopeValue?: string;
  } {
    const subSection = typeof focus.subSection === "string" ? focus.subSection.trim() : "";
    const module = typeof focus.module === "string" ? focus.module.trim() : "";
    const scopeKey = typeof focus.scopeKey === "string" ? focus.scopeKey.trim() : "";
    const scopeValue = typeof focus.scopeValue === "string" ? focus.scopeValue.trim() : "";

    // scope pair rule (must match backend)
    if ((scopeKey && !scopeValue) || (!scopeKey && scopeValue)) {
      throw new Error("focus.scopeKey and focus.scopeValue must be provided together.");
    }

    const out: Record<string, unknown> = {};

    if (subSection) out["subSection"] = subSection;
    if (module) out["module"] = module;
    if (scopeKey && scopeValue) {
      out["scopeKey"] = scopeKey;
      out["scopeValue"] = scopeValue;
    }

    return out as {
      subSection?: string;
      module?: string;
      scopeKey?: string;
      scopeValue?: string;
    };
  }

  // ===========================================================================
  // INTERNALS — defensive payload parsing
  // ===========================================================================

  private asSubscribed(p: unknown): CommentsWsSubscribedPayload {
    const o = (p ?? {}) as Record<string, unknown>;
    return {
      target: (o["target"] ?? {}) as CommentTargetDto,
      rooms: Array.isArray(o["rooms"]) ? (o["rooms"] as string[]) : [],
    };
  }

  private asUnsubscribed(p: unknown): CommentsWsUnsubscribedPayload {
    const o = (p ?? {}) as Record<string, unknown>;
    return {
      target: (o["target"] ?? {}) as CommentTargetDto,
      rooms: Array.isArray(o["rooms"]) ? (o["rooms"] as string[]) : [],
    };
  }

  private asCreated(p: unknown): CommentsWsCreatedPayload {
    const o = (p ?? {}) as Record<string, unknown>;
    return {
      target: (o["target"] ?? {}) as CommentTargetDto,
      comment: (o["comment"] ?? {}) as CommentDto,
    };
  }

  private asUpdated(p: unknown): CommentsWsUpdatedPayload {
    const o = (p ?? {}) as Record<string, unknown>;

    const out: Record<string, unknown> = {
      target: (o["target"] ?? {}) as CommentTargetDto,
      id: String(o["id"] ?? "").trim(),
    };

    if (typeof o["patch"] !== "undefined") out["patch"] = o["patch"] as Record<string, unknown>;
    if (typeof o["updatedComment"] !== "undefined") out["updatedComment"] = o["updatedComment"] as CommentDto;

    return out as unknown as CommentsWsUpdatedPayload;
  }

  private asDeleted(p: unknown): CommentsWsDeletedPayload {
    const o = (p ?? {}) as Record<string, unknown>;
    return {
      target: (o["target"] ?? {}) as CommentTargetDto,
      id: String(o["id"] ?? "").trim(),
    };
  }

  private asPinned(p: unknown): CommentsWsPinnedPayload {
    const o = (p ?? {}) as Record<string, unknown>;
    return {
      target: (o["target"] ?? {}) as CommentTargetDto,
      id: String(o["id"] ?? "").trim(),
      pinnedAtIso: String(o["pinnedAtIso"] ?? "").trim(),
      pinnedByUserId: String(o["pinnedByUserId"] ?? "").trim(),
    };
  }

  private asUnpinned(p: unknown): CommentsWsUnpinnedPayload {
    const o = (p ?? {}) as Record<string, unknown>;
    return {
      target: (o["target"] ?? {}) as CommentTargetDto,
      id: String(o["id"] ?? "").trim(),
    };
  }

  private asToggled(p: unknown): CommentsWsToggledPayload {
    const o = (p ?? {}) as Record<string, unknown>;
    return {
      target: (o["target"] ?? {}) as CommentTargetDto,
      id: String(o["id"] ?? "").trim(),
      isPinned: Boolean(o["isPinned"]),
    };
  }

  private asError(p: unknown): CommentsWsErrorPayload {
    const o = (p ?? {}) as Record<string, unknown>;
    const msg = String(o["message"] ?? "Unknown WS error").trim();
    return { message: msg || "Unknown WS error" };
  }
}
