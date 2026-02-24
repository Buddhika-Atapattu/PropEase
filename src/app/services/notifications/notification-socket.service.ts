// Path: src/app/services/notifications/notification-socket.service.ts
// =============================================================================
// NotificationSocketService (WS Push + WS RPC)
// =============================================================================

import { Inject, Injectable, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import type { Socket } from "socket.io-client";

import { SocketService } from "../socket/socket-service";

import type {
  NotificationInboxItemDto,
  NotificationCountResponse,
  NotificationLoadFilters,
} from "../../types/notifications/notification.types";

/* =============================================================================
 * A) WS Push events (must match backend NotificationEvents)
 * ========================================================================== */

export class NotificationWsPushEvents {
  private constructor() {}

  public static readonly NEW = "notify:new";
  public static readonly PATCH = "notify:patch";
  public static readonly COUNT = "notify:count";
  public static readonly BULK = "notify:bulk";
}

/* =============================================================================
 * B) WS RPC events (MUST match backend NotificationRpcEvents exactly)
 * Backend source:
 *   src/socket/events/notifications/notification.rpc.events.ts
 * ========================================================================== */

export class NotificationWsRpcEvents {
  private constructor() {}

  public static readonly INBOX_LIST = "notification:rpc:inbox:list";
  public static readonly INBOX_COUNTS = "notification:rpc:inbox:counts";
  public static readonly MARK_READ = "notification:rpc:mark:read";
  public static readonly MARK_ALL_READ = "notification:rpc:mark:all-read";
}

/* =============================================================================
 * C) WS RPC payload shapes (FE <-> BE)
 * ========================================================================== */

export type NotificationScope = "user" | "role" | "company";
export type NotificationPriorityScope = "all" | "prioritized" | "unprioritized";

export type WsAck<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export interface WsInboxListReq {
  scope: NotificationScope;
  priorityScope: NotificationPriorityScope;
  page: number;
  limit: number;
  filters: NotificationLoadFilters;
}

export interface WsInboxListRes {
  items: NotificationInboxItemDto[];
  other: { total: number; unread: number; prioritized: number; unprioritized: number };
}

export interface WsInboxCountsReq {
  scope: NotificationScope;
  priorityScope: NotificationPriorityScope;
  filters: NotificationLoadFilters;
}

export interface WsInboxCountsRes {
  total: number;
  unread: number;
  prioritized: number;
  unprioritized: number;
}

export interface WsMarkReadReq {
  inboxId: string;
}

export interface WsMarkReadRes {
  changed: boolean;
}

export interface WsMarkAllReadRes {
  changedCount: number;
}

/* =============================================================================
 * D) Push payloads (match backend notification.events.ts)
 * ========================================================================== */

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

@Injectable({ providedIn: "root" })
export class NotificationSocketService {
  private readonly isBrowser: boolean;

  private readonly connected$ = new BehaviorSubject<boolean>(false);

  private readonly onNew$ = new Subject<NotifyNewPayload>();
  private readonly onPatch$ = new Subject<NotifyPatchPayload>();
  private readonly onCount$ = new Subject<NotifyCountPayload>();
  private readonly onBulk$ = new Subject<NotifyBulkPayload>();

  public constructor(
    private readonly socketService: SocketService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.bindConnectionFlags();
    this.bindPushEvents();
  }

  public isConnected$(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  public onNewNotification$(): Observable<NotifyNewPayload> {
    return this.onNew$.asObservable();
  }

  public onPatchNotification$(): Observable<NotifyPatchPayload> {
    return this.onPatch$.asObservable();
  }

  public onCountUpdate$(): Observable<NotifyCountPayload> {
    return this.onCount$.asObservable();
  }

  public onBulkUpdate$(): Observable<NotifyBulkPayload> {
    return this.onBulk$.asObservable();
  }

  public async rpcInboxList(req: WsInboxListReq): Promise<WsInboxListRes> {
    const safeReq = this.safeListReq(req);
    const ack = await this.emitAck<WsInboxListReq, WsInboxListRes>(
      NotificationWsRpcEvents.INBOX_LIST,
      safeReq,
      15000
    );
    return this.mustOk(ack);
  }

  public async rpcInboxCounts(req: WsInboxCountsReq): Promise<WsInboxCountsRes> {
    const safeReq = this.safeCountsReq(req);
    const ack = await this.emitAck<WsInboxCountsReq, WsInboxCountsRes>(
      NotificationWsRpcEvents.INBOX_COUNTS,
      safeReq,
      12000
    );
    return this.mustOk(ack);
  }

  public async rpcMarkRead(inboxId: string): Promise<WsMarkReadRes> {
    const req: WsMarkReadReq = { inboxId: this.safeId(inboxId, "inboxId") };
    const ack = await this.emitAck<WsMarkReadReq, WsMarkReadRes>(
      NotificationWsRpcEvents.MARK_READ,
      req,
      12000
    );
    return this.mustOk(ack);
  }

  public async rpcMarkAllRead(): Promise<WsMarkAllReadRes> {
    const ack = await this.emitAck<object, WsMarkAllReadRes>(
      NotificationWsRpcEvents.MARK_ALL_READ,
      {},
      15000
    );
    return this.mustOk(ack);
  }

  private bindConnectionFlags(): void {
    if (!this.isBrowser) return;

    const s = this.tryGetSocket();
    if (!s) return;

    s.on("connect", () => this.connected$.next(true));
    s.on("disconnect", () => this.connected$.next(false));
  }

  private bindPushEvents(): void {
    if (!this.isBrowser) return;

    const s = this.tryGetSocket();
    if (!s) return;

    s.on(NotificationWsPushEvents.NEW, (p: NotifyNewPayload) => this.onNew$.next(p));
    s.on(NotificationWsPushEvents.PATCH, (p: NotifyPatchPayload) => this.onPatch$.next(p));
    s.on(NotificationWsPushEvents.COUNT, (p: NotifyCountPayload) => this.onCount$.next(p));
    s.on(NotificationWsPushEvents.BULK, (p: NotifyBulkPayload) => this.onBulk$.next(p));
  }

  private tryGetSocket(): Socket | null {
    const holder = this.socketService as unknown as { socket?: unknown };
    if (!holder.socket) return null;
    return holder.socket as Socket;
  }

  private requireSocket(): Socket {
    const s = this.tryGetSocket();
    if (!s) throw new Error("NotificationSocketService: socket not ready");
    return s;
  }

  private emitAck<Req, Res>(event: string, payload: Req, timeoutMs: number): Promise<WsAck<Res>> {
    const s = this.requireSocket();

    return new Promise<WsAck<Res>>((resolve) => {
      let done = false;

      const t = window.setTimeout(() => {
        if (done) return;
        done = true;
        resolve({ ok: false, message: `WS timeout for event: ${event}` });
      }, Math.max(1000, timeoutMs));

      s.emit(event, payload, (ack: WsAck<Res>) => {
        if (done) return;
        done = true;
        window.clearTimeout(t);

        if (!ack || typeof ack !== "object") {
          resolve({ ok: false, message: `Invalid ACK for event: ${event}` });
          return;
        }

        resolve(ack);
      });
    });
  }

  private mustOk<T>(ack: WsAck<T>): T {
    if (!ack.ok) throw new Error(ack.message || "WS request failed");
    return ack.data;
  }

  private safeId(v: unknown, label: string): string {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) throw new Error(`${label} is required`);
    return s;
  }

  private safePage(v: unknown): number {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.floor(n);
  }

  private safeLimit(v: unknown): number {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 1) return 10;
    return Math.min(Math.floor(n), 100);
  }

  private safeFilters(filters: NotificationLoadFilters | null | undefined): NotificationLoadFilters {
    const f = filters && typeof filters === "object" ? filters : {};
    return f;
  }

  private safeScope(v: unknown): NotificationScope {
    if (v === "user" || v === "role" || v === "company") return v;
    return "user";
  }

  private safePriority(v: unknown): NotificationPriorityScope {
    if (v === "all" || v === "prioritized" || v === "unprioritized") return v;
    return "all";
  }

  private safeListReq(req: WsInboxListReq): WsInboxListReq {
    if (!req) throw new Error("list request is required");

    return {
      scope: this.safeScope(req.scope),
      priorityScope: this.safePriority(req.priorityScope),
      page: this.safePage(req.page),
      limit: this.safeLimit(req.limit),
      filters: this.safeFilters(req.filters),
    };
  }

  private safeCountsReq(req: WsInboxCountsReq): WsInboxCountsReq {
    if (!req) throw new Error("counts request is required");

    return {
      scope: this.safeScope(req.scope),
      priorityScope: this.safePriority(req.priorityScope),
      filters: this.safeFilters(req.filters),
    };
  }
}
