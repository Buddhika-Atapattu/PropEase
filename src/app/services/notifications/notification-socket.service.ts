import { isPlatformBrowser } from "@angular/common";
import { Inject, Injectable, PLATFORM_ID } from "@angular/core";
import { Observable, ReplaySubject, Subject } from "rxjs";

import { environment } from "../../../environments/environment";

import type { NotifyNewPayload, NotifyPatchPayload, NotifyCountPayload, NotifyBulkPayload } from "../../types/notifications/notification.ws.types";

/* ============================================================================
 * NotificationSocketService (Frontend)
 * ----------------------------------------------------------------------------
 * SINGLE gateway for Notification Hub WebSocket communication.
 *
 * - Holds event names inside the class (single source of truth)
 * - Exposes typed Observables to the rest of the app
 * - SSR/Electron safe: does not connect unless in browser
 * - No any, class-based only
 * ========================================================================== */

type SocketIoClient = {
  on: (event: string, cb: (payload: unknown) => void) => void;
  off: (event: string) => void;
  emit: (event: string, payload?: unknown) => void;
  connect: () => void;
  disconnect: () => void;
  connected: boolean;
};

@Injectable({ providedIn: "root" })
export class NotificationSocketService {
  // ---------------------------------------------------------------------------
  // 01) Event names (kept INSIDE class as you requested)
  // ---------------------------------------------------------------------------

  private readonly EVT_NEW = "notify:new";
  private readonly EVT_PATCH = "notify:patch";
  private readonly EVT_COUNT = "notify:count";
  private readonly EVT_BULK = "notify:bulk";

  // Optional system events (useful for monitoring)
  private readonly EVT_CONNECT = "connect";
  private readonly EVT_DISCONNECT = "disconnect";
  private readonly EVT_CONNECT_ERROR = "connect_error";

  // ---------------------------------------------------------------------------
  // 02) Streams
  // ---------------------------------------------------------------------------

  private readonly new$ = new Subject<NotifyNewPayload>();
  private readonly patch$ = new Subject<NotifyPatchPayload>();
  private readonly count$ = new ReplaySubject<NotifyCountPayload>(1); // keep latest badge count
  private readonly bulk$ = new Subject<NotifyBulkPayload>();

  // Connection state streams
  private readonly connected$ = new ReplaySubject<boolean>(1);

  // ---------------------------------------------------------------------------
  // 03) Runtime state
  // ---------------------------------------------------------------------------

  private readonly isBrowser: boolean;
  private socket: SocketIoClient | null = null;
  private started = false;

  // Auth token is optional here; depends on your backend socket auth design.
  private authToken: string | null = null;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.connected$.next(false);
  }

  // ---------------------------------------------------------------------------
  // Public Observables (consumers subscribe here)
  // ---------------------------------------------------------------------------

  public onNew$(): Observable<NotifyNewPayload> {
    return this.new$.asObservable();
  }

  public onPatch$(): Observable<NotifyPatchPayload> {
    return this.patch$.asObservable();
  }

  public onCount$(): Observable<NotifyCountPayload> {
    return this.count$.asObservable();
  }

  public onBulk$(): Observable<NotifyBulkPayload> {
    return this.bulk$.asObservable();
  }

  public onConnected$(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Call once after login / when you have a valid auth token.
   * Safe to call multiple times; it will reconnect if token changed.
   */
  public async start(token?: string): Promise<void> {
    if (!this.isBrowser) return;

    const nextToken = this.safeString(token);
    if (nextToken) this.authToken = nextToken;

    // if already started and socket exists, just ensure connected
    if (this.started && this.socket) {
      if (!this.socket.connected) this.socket.connect();
      return;
    }

    this.started = true;

    try {
      this.socket = await this.buildSocketClient();
      this.bindCoreEvents(this.socket);
      this.bindNotificationEvents(this.socket);

      this.socket.connect();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      // eslint-disable-next-line no-console
      console.error(`[Error:] [NotificationSocketService] start failed: ${msg}\n`);
      this.connected$.next(false);
    }
  }

  public stop(): void {
    if (!this.socket) return;

    try {
      this.unbindNotificationEvents(this.socket);
      this.socket.disconnect();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      // eslint-disable-next-line no-console
      console.error(`[Error:] [NotificationSocketService] stop failed: ${msg}\n`);
    } finally {
      this.socket = null;
      this.started = false;
      this.connected$.next(false);
    }
  }

  public isConnected(): boolean {
    return this.socket?.connected === true;
  }

  // ---------------------------------------------------------------------------
  // Optional outbound emits (if later needed)
  // ----------------------------------------------------------------------------
  // Today your backend pushes deltas; UI doesn't need to emit notification events.
  // But keeping a safe hook helps future features (ack, preferences, etc.)
  // ---------------------------------------------------------------------------

  public emitClientPing(): void {
    if (!this.socket) return;
    this.socket.emit("notify:client-ping", { at: new Date().toISOString() });
  }

  // ---------------------------------------------------------------------------
  // Socket factory (lazy import for SSR safety)
  // ---------------------------------------------------------------------------

  private async buildSocketClient(): Promise<SocketIoClient> {
    // Dynamic import prevents SSR crash.
    const mod = await import("socket.io-client");
    const io = mod.io;

    const url = this.pickSocketUrl();

    // If your backend expects token in auth, this is correct for Socket.IO v4+
    const socket = io(url, {
      transports: ["websocket"],
      autoConnect: false,
      auth: this.authToken ? { token: this.authToken } : undefined
    }) as unknown as SocketIoClient;

    return socket;
  }

  private pickSocketUrl(): string {
    // Prefer a dedicated socket URL if you have it, otherwise fallback to API base.
    const envAny = environment as unknown as { SOCKET_URL?: string; WS_URL?: string; API_BASE_URL?: string };

    const v1 = this.safeString(envAny.SOCKET_URL);
    if (v1) return v1;

    const v2 = this.safeString(envAny.WS_URL);
    if (v2) return v2;

    const v3 = this.safeString(envAny.API_BASE_URL);
    if (v3) return v3;

    // worst-case fallback (still valid local dev)
    return "http://localhost:3000";
  }

  // ---------------------------------------------------------------------------
  // Binding
  // ---------------------------------------------------------------------------

  private bindCoreEvents(sock: SocketIoClient): void {
    sock.on(this.EVT_CONNECT, () => {
      this.connected$.next(true);
      // eslint-disable-next-line no-console
      console.log(`[Info:] [NotificationSocketService] connected\n`);
    });

    sock.on(this.EVT_DISCONNECT, () => {
      this.connected$.next(false);
      // eslint-disable-next-line no-console
      console.log(`[Warning:] [NotificationSocketService] disconnected\n`);
    });

    sock.on(this.EVT_CONNECT_ERROR, (p: unknown) => {
      const msg = this.safeString((p as { message?: unknown } | null)?.message);
      // eslint-disable-next-line no-console
      console.error(`[Error:] [NotificationSocketService] connect_error: ${msg || "unknown"}\n`);
      this.connected$.next(false);
    });
  }

  private bindNotificationEvents(sock: SocketIoClient): void {
    sock.on(this.EVT_NEW, (payload: unknown) => {
      const p = this.asNotifyNew(payload);
      if (!p) return;
      this.new$.next(p);

      // optional: server can include count
      if (p.count) this.count$.next(p.count);
    });

    sock.on(this.EVT_PATCH, (payload: unknown) => {
      const p = this.asNotifyPatch(payload);
      if (!p) return;
      this.patch$.next(p);

      if (p.count) this.count$.next(p.count);
    });

    sock.on(this.EVT_COUNT, (payload: unknown) => {
      const p = this.asNotifyCount(payload);
      if (!p) return;
      this.count$.next(p);
    });

    sock.on(this.EVT_BULK, (payload: unknown) => {
      const p = this.asNotifyBulk(payload);
      if (!p) return;
      this.bulk$.next(p);

      if (p.count) this.count$.next(p.count);
    });
  }

  private unbindNotificationEvents(sock: SocketIoClient): void {
    sock.off(this.EVT_NEW);
    sock.off(this.EVT_PATCH);
    sock.off(this.EVT_COUNT);
    sock.off(this.EVT_BULK);
  }

  // ---------------------------------------------------------------------------
  // Payload guards (no any; minimal runtime validation)
  // ---------------------------------------------------------------------------

  private asNotifyNew(v: unknown): NotifyNewPayload | null {
    if (!this.isObject(v)) return null;
    const item = (v as { item?: unknown }).item;
    if (!this.isObject(item)) return null;

    const out: NotifyNewPayload = { item: item as any }; // typed via DTO contract; shape is validated elsewhere

    const count = (v as { count?: unknown }).count;
    if (this.isObject(count)) out.count = count as any;

    return out;
  }

  private asNotifyPatch(v: unknown): NotifyPatchPayload | null {
    if (!this.isObject(v)) return null;

    const inboxId = this.safeString((v as { inboxId?: unknown }).inboxId);
    if (!inboxId) return null;

    const patch = (v as { patch?: unknown }).patch;
    if (!this.isObject(patch)) return null;

    const out: NotifyPatchPayload = { inboxId, patch: patch as any };

    const count = (v as { count?: unknown }).count;
    if (this.isObject(count)) out.count = count as any;

    return out;
  }

  private asNotifyCount(v: unknown): NotifyCountPayload | null {
    if (!this.isObject(v)) return null;

    const total = this.safeInt((v as { total?: unknown }).total);
    const unread = this.safeInt((v as { unread?: unknown }).unread);

    if (total === null || unread === null) return null;

    return { total, unread };
  }

  private asNotifyBulk(v: unknown): NotifyBulkPayload | null {
    if (!this.isObject(v)) return null;

    const reason = this.safeString((v as { reason?: unknown }).reason) as NotifyBulkPayload["reason"];
    if (!reason) return null;

    const out: NotifyBulkPayload = { reason };

    const count = (v as { count?: unknown }).count;
    if (this.isObject(count)) out.count = count as any;

    return out;
  }

  // ---------------------------------------------------------------------------
  // Utils (class-based)
  // ---------------------------------------------------------------------------

  private isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
  }

  private safeString(v: unknown): string {
    if (typeof v === "string") return v.trim();
    if (typeof v === "number") return String(v);
    return "";
  }

  private safeInt(v: unknown): number | null {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.floor(n);
  }
}
