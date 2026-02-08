// Path: src/app/services/comments/services/comment-engine.facade.service.ts
// ============================================================================
// CommentEngineFacadeService (Single Track) — Observable-only
// ----------------------------------------------------------------------------
// ✅ REST returns Observable<MSG> (universal API rule)
// ✅ WS uses streams for events; subscribe/unsubscribe exposed as Observable<void>
// ✅ No Promise in Facade (single async model)
// ============================================================================

import { Injectable } from "@angular/core";
import { from, Observable } from "rxjs";

import type { MSG } from "../../../types/api-message.types";

import type {
  CommentLoadFilters,
  CommentLoadRequest,
  CommentTargetDto,
  CommentRestAddRequest,
} from "../contracts/comment.contract";

import type {
  CommentRestEditRequest,
} from "../contracts/comment.rest.contract";

import {
  CommentEngineWsService,
  SocketLike,
  CommentsWsSubscribedPayload,
  CommentsWsUnsubscribedPayload
} from "../ws/comment-engine.ws.service";
import { CommentEngineRestService } from "./comment-engine.rest.service";

@Injectable({ providedIn: "root" })
export class CommentEngineFacadeService {
  public constructor(
    private readonly rest: CommentEngineRestService,
    private readonly ws: CommentEngineWsService,
  ) {}

  /* ======================================================================== *
   * REST — Load / Count / CRUD (universal MSG) — Observable only
   * ======================================================================== */

  public load(params: {
    filters: CommentLoadFilters;
    start: number;
    limit: number;
    sort?: "newest" | "oldest";
  }): Observable<MSG> {
    return this.rest.load(params);
  }

  public loadAdvanced(req: CommentLoadRequest): Observable<MSG> {
    return this.rest.loadAdvanced(req);
  }

  public countLoad(filters: CommentLoadFilters): Observable<MSG> {
    return this.rest.countLoad(filters);
  }

  public countAdvanced(filters: CommentLoadFilters): Observable<MSG> {
    return this.rest.countAdvanced(filters);
  }

  public getById(id: string): Observable<MSG> {
    return this.rest.getById(id);
  }

  public addComment(data: CommentRestAddRequest): Observable<MSG> {
    return this.rest.addComment(data);
  }

  public edit(req: CommentRestEditRequest): Observable<MSG> {
    return this.rest.edit(req);
  }

  public delete(id: string): Observable<MSG> {
    return this.rest.delete(id);
  }

  /* ======================================================================== *
   * WS — Wiring (connect/disconnect)
   * ======================================================================== */

  public connectWs(socket: SocketLike): void {
    this.ws.connect(socket);
  }

  public disconnectWs(): void {
    this.ws.disconnect();
  }

  /**
   * WS subscribe/unsubscribe are "writes" to socket.
   * Your WS service likely uses Promise-based acks — we expose Observable for consistency.
   */
  public subscribe(target: CommentTargetDto): Observable<CommentsWsSubscribedPayload> {
    return from(this.ws.subscribe(target));
  }

  public unsubscribe(target: CommentTargetDto): Observable<CommentsWsUnsubscribedPayload> {
    return from(this.ws.unsubscribe(target));
  }

  /* ======================================================================== *
   * WS — Streams (GETTERS)
   * ======================================================================== */

  public get connected$() {
    return this.ws.connected$;
  }

  public get subscribed$() {
    return this.ws.subscribed$;
  }

  public get unsubscribed$() {
    return this.ws.unsubscribed$;
  }

  public get created$() {
    return this.ws.created$;
  }

  public get updated$() {
    return this.ws.updated$;
  }

  public get deleted$() {
    return this.ws.deleted$;
  }

  public get pinned$() {
    return this.ws.pinned$;
  }

  public get unpinned$() {
    return this.ws.unpinned$;
  }

  public get toggled$() {
    return this.ws.toggled$;
  }

  public get error$() {
    return this.ws.error$;
  }

  /* ======================================================================== *
   * PIN / UNPIN — REST ONLY (backend WS does not accept pin requests)
   * ======================================================================== */

  public pinToggle(commentId: string, pinned: boolean): Observable<MSG> {
    const safeId = this.toNonEmptyString(commentId, "Comment id is required for pin/unpin.");
    return this.rest.pinToggle(safeId, pinned);
  }

  public pin(commentId: string): Observable<MSG> {
    return this.pinToggle(commentId, true);
  }

  public unpin(commentId: string): Observable<MSG> {
    return this.pinToggle(commentId, false);
  }

  /* ======================================================================== *
   * INTERNAL
   * ======================================================================== */

  private toNonEmptyString(v: unknown, message: string): string {
    const s = String(v ?? "").trim();
    if (!s) throw new Error(message);
    return s;
  }

  // Keep for future, but note: uses `any` in your version — avoid using unless needed.
  // If you ever need it, we can make MSG generic-safe and remove any.
  private wrapWsDataAsMsg<T>(data: T, message: string): MSG {
    const msg: MSG = {
      success: true,
      status: "success",
      message,
      data: data as any,
    };
    return msg;
  }
}
