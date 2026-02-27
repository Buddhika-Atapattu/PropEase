// Path: src/app/services/notifications/notification-socket.service.ts
// =============================================================================
// NotificationSocketService (WS Push + WS RPC) — CLEAN + STRICT (BE-ALIGNED)
// =============================================================================
// 01) Introduction
// - A single, stable gateway for Notification realtime features.
// - Handles:
//    A) WS Push events (notify:new / notify:patch / notify:count / notify:bulk)
//    B) WS RPC events (inbox list / counts / mark read / mark all read)
//
// 02) Important matters
// - This service MUST NOT depend on notification UI being opened.
// - It binds events as soon as SocketService exposes a socket instance
//   via `socketReady$` (integrates with your SocketService lifecycle).
// - No "private socket property peeking" is used.
//
// 03) Backend alignment
// - Push events + rooms are defined in backend:
//     src/socket/events/notifications/notification.events.ts
// - RPC events + payload contracts are defined in backend:
//     src/socket/events/notifications/notification.rpc.events.ts
//
// 04) exactOptionalPropertyTypes-safe
// - Optional fields are OMITTED (never assigned `undefined`).
// =============================================================================

import { isPlatformBrowser } from "@angular/common";
import { Inject, Injectable, OnDestroy, PLATFORM_ID } from "@angular/core";
import { BehaviorSubject, Observable, Subject, Subscription } from "rxjs";
import type { Socket as IoSocket } from "socket.io-client";

import { SocketService } from "../socket/socket-service";

// ✅ Use the SAME FE types you generated from backend contracts.
// IMPORTANT: your import path earlier had "types/notifications/..."
// but your backend types are under "types/notification/..."
// Use the FE path that actually exists in your project.
import type {
  NotificationInboxItemDto,
  NotificationLoadFilters,
} from "../../types/notifications/notification.types";

import {
  NotificationEvents,
  NotificationRpcEvents
} from '../socket/events/notifications/notification.events';

// If you have this type in FE, keep it. Otherwise, we provide a local one below.
import type { NotificationCountResponse } from "../../types/notifications/notification.types";


/* =============================================================================
 * D) WS RPC payload shapes (FE <-> BE)
 * Must match backend notification.rpc.events.ts
 * ========================================================================== */

export type NotificationScope = "user" | "role" | "company";
export type NotificationPriorityScope = "all" | "prioritized" | "unprioritized";

/**
 * Backend contract:
 * export interface WsAck<TData> { ok:boolean; message?:string; data?:TData; }
 *
 * ✅ We keep it compatible and still strict.
 */
export interface WsAck<T> {
  ok: boolean;
  message?: string;
  data?: T;
}

export interface WsInboxListReq {
  scope: NotificationScope;
  priorityScope: NotificationPriorityScope;
  page: number;
  limit: number;
  filters: NotificationLoadFilters;
}

export interface WsInboxListRes {
  items: NotificationInboxItemDto[];
  other: {
    total: number;
    unread: number;
    prioritized: number;
    unprioritized: number;
  };
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

export interface WsMarkAllReadReq {}

export interface WsMarkAllReadRes {
  changedCount: number;
}

export interface WsArchiveOneReq {
  inboxId: string;
}

export interface WsArchiveOneRes {
  changed: boolean;
}

/* =============================================================================
 * E) Push payloads (must match backend emit payloads)
 * ========================================================================== */

/**
 * If NotificationCountResponse is not available in your FE types yet,
 * keep this as the fallback minimal shape. (Uncomment if needed)
 *
 * export interface NotificationCountResponse {
 *   total: number;
 *   unread: number;
 *   prioritized: number;
 *   unprioritized: number;
 * }
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

    // ✅ allow update only body + title
    notification?: {
      title?: string;
      body?: string;
    };
  };
  count?: NotificationCountResponse;
}

export type NotifyCountPayload = NotificationCountResponse;

export interface NotifyBulkPayload {
  reason: "bulk-update" | "server-sync" | "policy-change" | "unknown";
  count?: NotificationCountResponse;
}

export interface NotifyDeletePayload {
  // Prefer notificationId (deletes all inbox rows belonging to that notification)
  notificationId?: string;

  // Fallback: single inbox row delete
  inboxId?: string;

  count?: NotificationCountResponse;
}

/**
 * Optional domain-level notifications (RecycleBin restore/purge => notify:*).
 * Keep it generic to avoid over-coupling here.
 */
export interface NotifyDomainEventPayload {
  module?: string;
  refId?: string;
  entryId?: string;
  message?: string;
  ts?: string;
}

@Injectable( { providedIn: "root" } )
export class NotificationSocketService implements OnDestroy {
  private readonly isBrowser: boolean;

  private static readonly HARD_MAX_LIMIT: number = 500;

  private socketSub: Subscription | null = null;
  private activeSocket: IoSocket | null = null;

  // Connection state
  private readonly connected$ = new BehaviorSubject<boolean>( false );

  // Push streams
  private readonly onNew$ = new Subject<NotifyNewPayload>();
  private readonly onPatch$ = new Subject<NotifyPatchPayload>();
  private readonly onCount$ = new Subject<NotifyCountPayload>();
  private readonly onBulk$ = new Subject<NotifyBulkPayload>();
  private readonly onDelete$ = new Subject<NotifyDeletePayload>();

  // Optional domain streams
  private readonly _onDomainRestored$ = new Subject<NotifyDomainEventPayload>();
  private readonly _onDomainPurged$ = new Subject<NotifyDomainEventPayload>();


  public constructor (
    private readonly socketService: SocketService,
    @Inject( PLATFORM_ID ) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
    this.bindWhenSocketReady();
  }

  // ===========================================================================
  // Public Observables
  // ===========================================================================

  /** Observe socket connection state used by notification channel. */
  public isConnected$(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  /** Push: new notification arrived (notify:new). */
  public onNewNotification$(): Observable<NotifyNewPayload> {
    return this.onNew$.asObservable();
  }

  /** Push: existing notification patched (notify:patch). */
  public onPatchNotification$(): Observable<NotifyPatchPayload> {
    return this.onPatch$.asObservable();
  }

  /** Push: counts update (notify:count). */
  public onCountUpdate$(): Observable<NotifyCountPayload> {
    return this.onCount$.asObservable();
  }

  /** Push: bulk update hint (notify:bulk). */
  public onBulkUpdate$(): Observable<NotifyBulkPayload> {
    return this.onBulk$.asObservable();
  }

  /** Push: domain restored event (notify:domain-restored). */
  public onDomainRestored$(): Observable<NotifyDomainEventPayload> {
    return this._onDomainRestored$.asObservable();
  }

  /** Push: domain purged event (notify:domain-purged). */
  public onDomainPurged$(): Observable<NotifyDomainEventPayload> {
    return this._onDomainPurged$.asObservable();
  }

  /** Push: notification deleted (notify:delete). */
  public onDeleteNotification$(): Observable<NotifyDeletePayload> {
    return this.onDelete$.asObservable();
  }

  // ===========================================================================
  // Public RPC (WS Request/Response) API
  // ===========================================================================

  /**
   * Fetch inbox list over WebSocket (RPC).
   *
   * @param req
   * - Expected:
   *   {
   *     scope: "user" | "role" | "company",
   *     priorityScope: "all" | "prioritized" | "unprioritized",
   *     page: number (1-based),
   *     limit: number (1..100),
   *     filters: NotificationLoadFilters
   *   }
   *
   * Usage hint:
   * - Call after SocketService.init(...) so socket exists.
   */
  public async rpcInboxList( req: WsInboxListReq ): Promise<WsInboxListRes> {
    const safeReq = this.safeListReq( req );

    const ack = await this.emitAck<WsInboxListReq, WsInboxListRes>(
      NotificationRpcEvents.INBOX_LIST,
      safeReq,
      15_000
    );

    return this.mustOk( ack );
  }

  /**
   * Fetch inbox counts over WebSocket (RPC).
   *
   * @param req
   * - Expected:
   *   {
   *     scope: "user" | "role" | "company",
   *     priorityScope: "all" | "prioritized" | "unprioritized",
   *     filters: NotificationLoadFilters
   *   }
   */
  public async rpcInboxCounts( req: WsInboxCountsReq ): Promise<WsInboxCountsRes> {
    const safeReq = this.safeCountsReq( req );

    const ack = await this.emitAck<WsInboxCountsReq, WsInboxCountsRes>(
      NotificationRpcEvents.INBOX_COUNTS,
      safeReq,
      12_000
    );

    return this.mustOk( ack );
  }

  /**
   * Mark a single inbox item as read over WebSocket (RPC).
   *
   * @param inboxId
   * - Expected: non-empty inbox item id string
   */
  public async rpcMarkRead( inboxId: string ): Promise<WsMarkReadRes> {
    const req: WsMarkReadReq = { inboxId: this.safeId( inboxId, "inboxId" ) };

    const ack = await this.emitAck<WsMarkReadReq, WsMarkReadRes>(
      NotificationRpcEvents.MARK_READ,
      req,
      12_000
    );

    return this.mustOk( ack );
  }

  /**
   * Mark ALL inbox items as read over WebSocket (RPC).
   */
  public async rpcMarkAllRead(): Promise<WsMarkAllReadRes> {
    const ack = await this.emitAck<WsMarkAllReadReq, WsMarkAllReadRes>(
      NotificationRpcEvents.MARK_ALL_READ,
      {},
      15_000
    );

    return this.mustOk( ack );
  }

  /**
   * Archive a single inbox item over WebSocket (RPC).
   *
   * @param inboxId
   * - Expected: non-empty inbox item id string
   *
   * Why:
   * - Aligns archive action with other inbox mutations (markRead, markAllRead)
   * - Allows WS-first UX (instant) with REST fallback in CenterService
   */
  public async rpcArchiveOne( inboxId: string ): Promise<WsArchiveOneRes> {
    const req: WsArchiveOneReq = { inboxId: this.safeId( inboxId, "inboxId" ) };

    const ack = await this.emitAck<WsArchiveOneReq, WsArchiveOneRes>(
      NotificationRpcEvents.ARCHIVE_ONE,
      req,
      12_000
    );

    return this.mustOk( ack );
  }

  // ===========================================================================
  // Lifecycle (important for memory safety)
  // ===========================================================================

  public ngOnDestroy(): void {
    this.cleanupSocketBindings();

    if ( this.socketSub ) {
      this.socketSub.unsubscribe();
      this.socketSub = null;
    }
  }

  // ===========================================================================
  // Socket binding (NO UI dependency)
  // ===========================================================================

  /**
   * Bind push listeners when SocketService exposes a socket instance.
   *
   * WHY:
   * - SocketService.init() may run AFTER this service is constructed.
   * - We must bind when the socket becomes available (and rebind if replaced).
   */
  private bindWhenSocketReady(): void {
    if ( !this.isBrowser ) return;

    this.socketSub = this.socketService.socketReady$.subscribe( ( sock ) => {
      // Socket torn down (logout)
      if ( !sock ) {
        this.cleanupSocketBindings();
        this.connected$.next( false );
        return;
      }

      // New socket instance (fresh init or re-init)
      if ( this.activeSocket !== sock ) {
        this.cleanupSocketBindings();
        this.activeSocket = sock;
        this.attachSocketBindings( sock );
      }

      // Update initial connected state (important for immediate UI truth)
      this.connected$.next( sock.connected === true );
    } );
  }

  /**
   * Attach all required listeners to a socket instance.
   *
   * @param sock
   * - Expected: active Socket.IO client instance from SocketService
   */
  private attachSocketBindings( sock: IoSocket ): void {
    // Connection flags
    sock.on( "connect", this.handleConnect );
    sock.on( "disconnect", this.handleDisconnect );

    // Push events (NotificationEvents)
    sock.on( NotificationEvents.NEW, this.handlePushNew );
    sock.on( NotificationEvents.PATCH, this.handlePushPatch );
    sock.on( NotificationEvents.DELETE, this.handlePushDelete );
    sock.on( NotificationEvents.COUNT, this.handlePushCount );
    sock.on( NotificationEvents.BULK, this.handlePushBulk );

    // Optional domain events
    sock.on( NotificationEvents.DOMAIN_RESTORED, this.handleDomainRestored );
    sock.on( NotificationEvents.DOMAIN_PURGED, this.handleDomainPurged );
  }

  /**
   * Remove listeners from current socket (if any).
   * Safe to call multiple times.
   */
  private cleanupSocketBindings(): void {
    const sock = this.activeSocket;
    if ( !sock ) return;

    // Connection flags
    sock.off( "connect", this.handleConnect );
    sock.off( "disconnect", this.handleDisconnect );

    // Push events
    sock.off( NotificationEvents.NEW, this.handlePushNew );
    sock.off( NotificationEvents.PATCH, this.handlePushPatch );
    sock.off( NotificationEvents.DELETE, this.handlePushDelete );
    sock.off( NotificationEvents.COUNT, this.handlePushCount );
    sock.off( NotificationEvents.BULK, this.handlePushBulk );

    // Optional domain events
    sock.off( NotificationEvents.DOMAIN_RESTORED, this.handleDomainRestored );
    sock.off( NotificationEvents.DOMAIN_PURGED, this.handleDomainPurged );

    this.activeSocket = null;
  }

  // ===========================================================================
  // Stable handlers (arrow functions keep `this` and allow off(..., same ref))
  // ===========================================================================

  private readonly handleConnect = (): void => {
    this.connected$.next( true );
  };

  private readonly handleDisconnect = (): void => {
    this.connected$.next( false );
  };

  private readonly handlePushNew = ( raw: unknown ): void => {
    const p = this.normalizeNotifyNew( raw );
    if ( !p ) return;
    this.onNew$.next( p );
  };

  private readonly handlePushPatch = ( raw: unknown ): void => {
    const p = this.normalizeNotifyPatch( raw );
    if ( !p ) return;
    this.onPatch$.next( p );
  };

  private readonly handlePushDelete = ( raw: unknown ): void => {
    const p = this.normalizeNotifyDelete( raw );
    if ( !p ) return;
    this.onDelete$.next( p );
  };

  private readonly handlePushCount = ( raw: unknown ): void => {
    const p = this.normalizeCount( raw );
    if ( !p ) return;
    this.onCount$.next( p );
  };

  private readonly handlePushBulk = ( raw: unknown ): void => {
    const p = this.normalizeNotifyBulk( raw );
    if ( !p ) return;
    this.onBulk$.next( p );
  };

  private readonly handleDomainRestored = ( raw: unknown ): void => {
    const p = this.normalizeDomainEvent( raw );
    this._onDomainRestored$.next( p );
  };

  private readonly handleDomainPurged = ( raw: unknown ): void => {
    const p = this.normalizeDomainEvent( raw );
    this._onDomainPurged$.next( p );
  };

  // ===========================================================================
  // WS emit helpers (ack + timeout)
  // ===========================================================================

  /**
   * Get active socket or throw (RPC requires a live socket instance).
   */
  private requireSocket(): IoSocket {
    const s = this.activeSocket ?? this.socketService.getSocketSnapshot();
    if ( !s ) {
      throw new Error( "NotificationSocketService: socket not ready" );
    }
    return s;
  }

  /**
   * Emit an RPC event with ack and timeout.
   *
   * @param event
   * - Expected: exact WS event name used by backend RPC handler.
   *
   * @param payload
   * - Expected: request DTO for that event.
   *
   * @param timeoutMs
   * - Expected: max time to wait for ack. Minimum enforced: 1000ms.
   */
  private emitAck<Req, Res>( event: string, payload: Req, timeoutMs: number ): Promise<WsAck<Res>> {
    if ( !this.isBrowser ) {
      return Promise.resolve( { ok: false, message: "WS unavailable (not in browser)" } );
    }

    const sock = this.requireSocket();

    return new Promise<WsAck<Res>>( ( resolve ) => {
      let done = false;

      const ms = Math.max( 1000, Math.floor( timeoutMs ) );
      const t = window.setTimeout( () => {
        if ( done ) return;
        done = true;
        resolve( { ok: false, message: `WS timeout for event: ${ event }` } );
      }, ms );

      // Socket.IO ack callback receives a single "ack" object
      sock.emit( event, payload, ( ack: unknown ) => {
        if ( done ) return;
        done = true;
        window.clearTimeout( t );

        const normalized = this.normalizeAck<Res>( ack );
        resolve( normalized );
      } );
    } );
  }

  /**
   * Enforce ok ack; otherwise throw.
   *
   * @param ack
   * - Expected: WsAck<T> envelope from backend.
   */
  private mustOk<T>( ack: WsAck<T> ): T {
    if ( !ack.ok ) throw new Error( ack.message || "WS request failed" );
    // data may be omitted by backend only if ok=false; for ok=true we require it.
    if ( ack.data === undefined ) throw new Error( "WS response missing data" );
    return ack.data;
  }

  // ===========================================================================
  // Sanitizers (defensive, exactOptionalPropertyTypes-friendly)
  // ===========================================================================

  private safeId( v: unknown, label: string ): string {
    const s = typeof v === "string" ? v.trim() : "";
    if ( !s ) throw new Error( `${ label } is required` );
    return s;
  }

  private safePage( v: unknown ): number {
    const n = typeof v === "number" ? v : Number( v );
    if ( !Number.isFinite( n ) || n < 1 ) return 1;
    return Math.floor( n );
  }

  private safeLimit( v: unknown ): number {
    const n = typeof v === "number" ? v : Number( v );

    // Missing/invalid => default 100 (your choice)
    if ( !Number.isFinite( n ) ) return 100;

    // ✅ 0 or negative => "load all"
    if ( n <= 0 ) return NotificationSocketService.HARD_MAX_LIMIT;

    return Math.min( Math.floor( n ), NotificationSocketService.HARD_MAX_LIMIT );
  }

  private safeFilters( filters: NotificationLoadFilters | null | undefined ): NotificationLoadFilters {
    const f = filters && typeof filters === "object" ? filters : ( {} as NotificationLoadFilters );
    return f;
  }

  private safeScope( v: unknown ): NotificationScope {
    if ( v === "user" || v === "role" || v === "company" ) return v;
    return "user";
  }

  private safePriority( v: unknown ): NotificationPriorityScope {
    if ( v === "all" || v === "prioritized" || v === "unprioritized" ) return v;
    return "all";
  }

  private safeListReq( req: WsInboxListReq ): WsInboxListReq {
    if ( !req ) throw new Error( "list request is required" );

    return {
      scope: this.safeScope( req.scope ),
      priorityScope: this.safePriority( req.priorityScope ),
      page: this.safePage( req.page ),
      limit: this.safeLimit( req.limit ),
      filters: this.safeFilters( req.filters ),
    };
  }

  private safeCountsReq( req: WsInboxCountsReq ): WsInboxCountsReq {
    if ( !req ) throw new Error( "counts request is required" );

    return {
      scope: this.safeScope( req.scope ),
      priorityScope: this.safePriority( req.priorityScope ),
      filters: this.safeFilters( req.filters ),
    };
  }

  // ===========================================================================
  // ACK normalization (no `as any`)
  // ===========================================================================

  private normalizeAck<T>( raw: unknown ): WsAck<T> {
    if ( !raw || typeof raw !== "object" ) {
      return { ok: false, message: "Invalid ACK (not an object)" };
    }

    const obj = raw as Record<string, unknown>;
    const ok = typeof obj[ "ok" ] === "boolean" ? obj[ "ok" ] : false;

    const message =
      typeof obj[ "message" ] === "string" && obj[ "message" ].trim()
        ? obj[ "message" ].trim()
        : undefined;

    // We keep data optional (exact match to backend), but enforce it in mustOk()
    const data = obj[ "data" ];

    if ( !ok ) {
      return { ok: false, message: message || "WS request failed" };
    }

    const out: WsAck<T> = { ok: true };
    if ( message ) out.message = message;
    if ( data !== undefined ) out.data = data as T; // still a cast, but now centralized
    return out;
  }

  // ===========================================================================
  // Push payload normalization (defensive)
  // ===========================================================================

  private normalizeNotifyNew( raw: unknown ): NotifyNewPayload | null {
    if ( !raw || typeof raw !== "object" ) return null;
    const obj = raw as Record<string, unknown>;

    const item = obj[ "item" ] as NotificationInboxItemDto | undefined;
    if ( !item ) return null;

    const out: NotifyNewPayload = { item };

    const count = this.normalizeCount( obj[ "count" ] );
    if ( count ) out.count = count;

    return out;
  }

  private normalizeNotifyPatch( raw: unknown ): NotifyPatchPayload | null {
    if ( !raw || typeof raw !== "object" ) return null;
    const obj = raw as Record<string, unknown>;

    const inboxId = typeof obj[ "inboxId" ] === "string" ? obj[ "inboxId" ].trim() : "";
    if ( !inboxId ) return null;

    const patchRaw = obj[ "patch" ];
    const patchObj =
      patchRaw && typeof patchRaw === "object" ? ( patchRaw as Record<string, unknown> ) : null;
    if ( !patchObj ) return null;

    const patch: NotifyPatchPayload[ "patch" ] = {};

    if ( typeof patchObj[ "isRead" ] === "boolean" ) patch.isRead = patchObj[ "isRead" ];
    if ( typeof patchObj[ "readAt" ] === "string" && patchObj[ "readAt" ].trim() )
      patch.readAt = patchObj[ "readAt" ].trim();

    if ( typeof patchObj[ "isDeleted" ] === "boolean" ) patch.isDeleted = patchObj[ "isDeleted" ];

    if ( typeof patchObj[ "isArchived" ] === "boolean" ) patch.isArchived = patchObj[ "isArchived" ];
    if ( typeof patchObj[ "archivedAt" ] === "string" && patchObj[ "archivedAt" ].trim() )
      patch.archivedAt = patchObj[ "archivedAt" ].trim();

    const notifRaw = patchObj[ "notification" ];
    const notifObj =
      notifRaw && typeof notifRaw === "object" ? ( notifRaw as Record<string, unknown> ) : null;

    if ( notifObj ) {
      const title = typeof notifObj[ "title" ] === "string" ? notifObj[ "title" ].trim() : "";
      const body = typeof notifObj[ "body" ] === "string" ? notifObj[ "body" ].trim() : "";

      if ( title || body ) {
        const nPatch: { title?: string; body?: string; } = {};
        if ( title ) nPatch.title = title;
        if ( body ) nPatch.body = body;

        patch.notification = nPatch;
      }
    }

    const out: NotifyPatchPayload = { inboxId, patch };

    const count = this.normalizeCount( obj[ "count" ] );
    if ( count ) out.count = count;

    return out;
  }

  private normalizeNotifyDelete( raw: unknown ): NotifyDeletePayload | null {
    if ( !raw || typeof raw !== "object" ) return null;
    const obj = raw as Record<string, unknown>;

    const notificationId =
      typeof obj[ "notificationId" ] === "string" ? obj[ "notificationId" ].trim() : "";

    const inboxId =
      typeof obj[ "inboxId" ] === "string" ? obj[ "inboxId" ].trim() : "";

    // Must have at least one identifier
    if ( !notificationId && !inboxId ) return null;

    const out: NotifyDeletePayload = {};

    if ( notificationId ) out.notificationId = notificationId;
    if ( inboxId ) out.inboxId = inboxId;

    const count = this.normalizeCount( obj[ "count" ] );
    if ( count ) out.count = count;

    return out;
  }

  private normalizeCount( raw: unknown ): NotificationCountResponse | null {
    if ( !raw || typeof raw !== "object" ) return null;
    const obj = raw as Record<string, unknown>;

    const total = typeof obj[ "total" ] === "number" ? obj[ "total" ] : NaN;
    const unread = typeof obj[ "unread" ] === "number" ? obj[ "unread" ] : NaN;

    // optional fields depending on your backend response
    const prioritized = typeof obj[ "prioritized" ] === "number" ? obj[ "prioritized" ] : NaN;
    const unprioritized = typeof obj[ "unprioritized" ] === "number" ? obj[ "unprioritized" ] : NaN;

    if ( !Number.isFinite( total ) || !Number.isFinite( unread ) ) return null;

    // Build exactOptionalPropertyTypes-safe object (omit optionals when NaN)
    const out: NotificationCountResponse = {
      total,
      unread,
      prioritized: Number.isFinite( prioritized ) ? prioritized : 0,
      unprioritized: Number.isFinite( unprioritized ) ? unprioritized : 0,
    } as NotificationCountResponse;

    return out;
  }

  private normalizeNotifyBulk( raw: unknown ): NotifyBulkPayload | null {
    if ( !raw || typeof raw !== "object" ) return null;
    const obj = raw as Record<string, unknown>;

    const reasonRaw = typeof obj[ "reason" ] === "string" ? obj[ "reason" ].trim() : "";
    const reason: NotifyBulkPayload[ "reason" ] =
      reasonRaw === "bulk-update" || reasonRaw === "server-sync" || reasonRaw === "policy-change"
        ? reasonRaw
        : "unknown";

    const out: NotifyBulkPayload = { reason };

    const count = this.normalizeCount( obj[ "count" ] );
    if ( count ) out.count = count;

    return out;
  }

  private normalizeDomainEvent( raw: unknown ): NotifyDomainEventPayload {
    if ( !raw || typeof raw !== "object" ) return { message: "unknown" };
    const obj = raw as Record<string, unknown>;

    const module = typeof obj[ "module" ] === "string" ? obj[ "module" ].trim() : undefined;
    const refId = typeof obj[ "refId" ] === "string" ? obj[ "refId" ].trim() : undefined;
    const entryId = typeof obj[ "entryId" ] === "string" ? obj[ "entryId" ].trim() : undefined;
    const message = typeof obj[ "message" ] === "string" ? obj[ "message" ].trim() : undefined;
    const ts = typeof obj[ "ts" ] === "string" ? obj[ "ts" ].trim() : undefined;

    const out: NotifyDomainEventPayload = {};
    if ( module ) out.module = module;
    if ( refId ) out.refId = refId;
    if ( entryId ) out.entryId = entryId;
    if ( message ) out.message = message;
    if ( ts ) out.ts = ts;

    return out;
  }
}
