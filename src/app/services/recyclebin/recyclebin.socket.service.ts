// Path: src/app/services/recyclebin/recyclebin.socket.service.ts
// =============================================================================
// RecycleBinSocketService (WS Push Listener) — STRICT + SSR/Electron Safe (FIXED)
// =============================================================================

import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, Subject, combineLatest, filter } from "rxjs";

import type { Socket } from "socket.io-client";

import type { AuthUserDto } from "../../types/recyclebin/recyclebin.types";
import {
  RecycleBinEvents,
  RecycleBinRooms,
  type RecycleBinSoftDeletedPayload,
  type RecycleBinRestoredPayload,
  type RecycleBinPermanentDeletedPayload,
  type RecycleBinCountPayload,
  type RecycleBinBulkPayload,
  type RecycleBinListItemPayload,
} from "../socket/events/recyclebin/recyclebin.events";

import { SocketService } from "../socket/socket-service";
import { DEFAULT_ROLES, type Role } from "../../types/common";

/* =============================================================================
 * A) Internal constants (class-based)
 * ========================================================================== */
class RecycleBinSocketConst {
  private constructor() {}

  /**
   * Room join event name.
   *
   * Important:
   * - Keep this aligned with backend "universal join" handler.
   * - If backend uses another name, update ONLY here.
   */
  public static readonly JOIN_EVENT: string = "join";
}

@Injectable({ providedIn: "root" })
export class RecycleBinSocketService {
  // =============================================================================
  // A) Public streams (push events)
  // =============================================================================

  private readonly softDeletedSubject = new Subject<RecycleBinSoftDeletedPayload>();
  public readonly softDeleted$ = this.softDeletedSubject.asObservable();

  private readonly restoredSubject = new Subject<RecycleBinRestoredPayload>();
  public readonly restored$ = this.restoredSubject.asObservable();

  private readonly permanentDeletedSubject = new Subject<RecycleBinPermanentDeletedPayload>();
  public readonly permanentDeleted$ = this.permanentDeletedSubject.asObservable();

  private readonly countSubject = new Subject<RecycleBinCountPayload>();
  public readonly count$ = this.countSubject.asObservable();

  private readonly bulkSubject = new Subject<RecycleBinBulkPayload>();
  public readonly bulk$ = this.bulkSubject.asObservable();

  private readonly listItemSubject = new Subject<RecycleBinListItemPayload>();
  public readonly listItem$ = this.listItemSubject.asObservable();

  // =============================================================================
  // B) Internal state
  // =============================================================================

  private readonly authUserSubject = new BehaviorSubject<AuthUserDto | null>(null);

  private activeSocket: Socket | null = null;

  /**
   * We bind listeners per socket instance.
   * This token increments when socket identity changes.
   */
  private boundSocketId: string | null = null;

  public constructor(private readonly socketService: SocketService) {
    this.bootstrap();
  }

  // =============================================================================
  // C) Public API
  // =============================================================================

  public setAuthUser(authUser: AuthUserDto): void {
    const safe: AuthUserDto = this.normalizeAuthUser(authUser);
    this.authUserSubject.next(safe);

    if (this.activeSocket) {
      this.joinAudienceRooms(this.activeSocket, safe);
    }
  }

  public clearAuthUser(): void {
    this.authUserSubject.next(null);
  }

  // =============================================================================
  // D) Boot / Bind
  // =============================================================================

  private bootstrap(): void {
    combineLatest([this.socketService.socketReady$, this.authUserSubject])
      .pipe(filter(([ready, auth]) => Boolean(ready) && Boolean(auth)))
      .subscribe(() => {
        const socket = this.socketService.getSocketSnapshot();
        const auth = this.authUserSubject.value;

        if (!socket || !auth) return;

        this.activeSocket = socket;

        // 1) Rooms first (so we receive pushes right away)
        this.joinAudienceRooms(socket, auth);

        // 2) Bind listeners per socket instance
        this.bindListenersForSocket(socket);
      });
  }

  /**
   * Bind WS listeners per socket instance.
   *
   * Why:
   * - SocketService may recreate socket on reconnect / token rotation.
   * - We must avoid duplicate handlers AND must rebind on new instance.
   */
  private bindListenersForSocket(socket: Socket): void {
    const socketId = this.getSocketIdentity(socket);

    // Same socket instance already bound
    if (this.boundSocketId === socketId) return;

    // New socket instance: ensure old handlers are not duplicated
    this.boundSocketId = socketId;

    // Always clean, then bind
    socket.off(RecycleBinEvents.SOFT_DELETED);
    socket.off(RecycleBinEvents.RESTORED);
    socket.off(RecycleBinEvents.PERMANENT_DELETED);
    socket.off(RecycleBinEvents.COUNT);
    socket.off(RecycleBinEvents.BULK);
    socket.off(RecycleBinEvents.LIST_ITEM);

    socket.on(RecycleBinEvents.SOFT_DELETED, (p: RecycleBinSoftDeletedPayload) => {
      if (!this.isSoftDeletedPayload(p)) return;
      this.softDeletedSubject.next(p);
    });

    socket.on(RecycleBinEvents.RESTORED, (p: RecycleBinRestoredPayload) => {
      if (!this.isRestoredPayload(p)) return;
      this.restoredSubject.next(p);
    });

    socket.on(RecycleBinEvents.PERMANENT_DELETED, (p: RecycleBinPermanentDeletedPayload) => {
      if (!this.isPermanentDeletedPayload(p)) return;
      this.permanentDeletedSubject.next(p);
    });

    socket.on(RecycleBinEvents.COUNT, (p: RecycleBinCountPayload) => {
      if (!this.isCountPayload(p)) return;
      this.countSubject.next(p);
    });

    socket.on(RecycleBinEvents.BULK, (p: RecycleBinBulkPayload) => {
      if (!this.isBulkPayload(p)) return;
      this.bulkSubject.next(p);
    });

    socket.on(RecycleBinEvents.LIST_ITEM, (p: RecycleBinListItemPayload) => {
      if (!this.isListItemPayload(p)) return;
      this.listItemSubject.next(p);
    });
  }

  // =============================================================================
  // E) Rooms
  // =============================================================================

  private joinAudienceRooms(socket: Socket, auth: AuthUserDto): void {
    // Company
    socket.emit(RecycleBinSocketConst.JOIN_EVENT, RecycleBinRooms.company());

    // Role
    socket.emit(RecycleBinSocketConst.JOIN_EVENT, RecycleBinRooms.role(auth.role));

    // Teams
    for (const teamCode of auth.teamCodes ?? []) {
      const t = typeof teamCode === "string" ? teamCode.trim() : "";
      if (!t) continue;
      socket.emit(RecycleBinSocketConst.JOIN_EVENT, RecycleBinRooms.team(t));
    }

    // User
    socket.emit(RecycleBinSocketConst.JOIN_EVENT, RecycleBinRooms.user(auth.username));
  }

  // =============================================================================
  // F) Validation helpers (class-based)
  // =============================================================================

  private normalizeAuthUser(auth: AuthUserDto): AuthUserDto {
    const username = typeof auth.username === "string" ? auth.username.trim() : "";
    const role = typeof auth.role === "string" ? auth.role.trim() : "";

    const safe: AuthUserDto = {
      userId: auth.userId,
      username: username || auth.username,
      role: this.filterRole(role || auth.role),
    };

    if (Array.isArray(auth.teamCodes) && auth.teamCodes.length > 0) {
      const cleaned: string[] = auth.teamCodes
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter((x) => Boolean(x));
      if (cleaned.length > 0) safe.teamCodes = cleaned;
    }

    if (typeof auth.branchId === "string" && auth.branchId.trim()) safe.branchId = auth.branchId.trim();
    if (typeof auth.sub === "string" && auth.sub.trim()) safe.sub = auth.sub.trim();

    return safe;
  }

  private filterRole(r: unknown): Role {
    const role = typeof r === "string" ? r.toLowerCase().trim() : "";
    if (!role) throw new Error("[Error:] [RecycleBinSocketService:] Invalid text in filter role\n");

    const safeRole: Role | undefined = DEFAULT_ROLES.find((v) => v.toLowerCase() === role.toLowerCase());
    if (!safeRole) throw new Error("[Error:] [RecycleBinSocketService:] Invalid role\n");

    return safeRole;
  }

  /**
   * Socket identity helper.
   *
   * Important:
   * - socket.io-client usually exposes socket.id after connect.
   * - If not connected yet, fallback to object identity string.
   */
  private getSocketIdentity(socket: Socket): string {
    const sid = typeof socket.id === "string" ? socket.id : "";
    if (sid) return sid;

    // Fallback: stable-ish marker per runtime
    return `obj:${String((socket as unknown as { nsp?: unknown }).nsp ?? "nsp")}`;
  }

  private isSoftDeletedPayload(v: unknown): v is RecycleBinSoftDeletedPayload {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return typeof o["entryId"] === "string" && typeof o["sourceKey"] === "string" && typeof o["refId"] === "string";
  }

  private isRestoredPayload(v: unknown): v is RecycleBinRestoredPayload {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    if (typeof o["entryId"] !== "string") return false;
    if (typeof o["sourceKey"] !== "string") return false;
    if (typeof o["refId"] !== "string") return false;

    if ("restoredRefId" in o && typeof o["restoredRefId"] !== "string") return false;
    return true;
  }

  private isPermanentDeletedPayload(v: unknown): v is RecycleBinPermanentDeletedPayload {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return typeof o["entryId"] === "string" && typeof o["sourceKey"] === "string" && typeof o["refId"] === "string";
  }

  private isCountPayload(v: unknown): v is RecycleBinCountPayload {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    if (typeof o["total"] !== "number") return false;

    const opt = ["recorded", "restoreInProgress", "restored", "failed"];
    for (const k of opt) {
      if (k in o && typeof o[k] !== "number") return false;
    }
    return true;
  }

  private isBulkPayload(v: unknown): v is RecycleBinBulkPayload {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    const r = o["reason"];
    return r === "bulk-update" || r === "system-refresh" || r === "rebuild";
  }

  private isListItemPayload(v: unknown): v is RecycleBinListItemPayload {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return typeof o["item"] === "object" && o["item"] !== null;
  }
}
