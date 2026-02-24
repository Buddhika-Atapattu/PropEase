// Path: src/app/services/teamManagement/workItems/work-item.ws.service.ts
// ============================================================================
// WorkItemWsService (client)
// ----------------------------------------------------------------------------
// Uses backend canonical WS event names (work-item.ws.events.ts).
// Strategy: listen for changes and refetch via REST when needed.
// ============================================================================

import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";

import { io, type Socket } from "socket.io-client";
import { environment } from "../../../../environments/environment";

import type { WorkItemDto } from "../../../types/team-management/work-items/work-item.types";

export class WorkItemWsEvents {
  // Client → Server
  public static readonly Subscribe = "workItem:subscribe";
  public static readonly Unsubscribe = "workItem:unsubscribe";
  public static readonly Get = "workItem:get";
  public static readonly List = "workItem:list";
  public static readonly Count = "workItem:count";

  public static readonly Create = "workItem:create";
  public static readonly Update = "workItem:update";
  public static readonly Delete = "workItem:delete";

  public static readonly SetStatus = "workItem:setStatus";
  public static readonly SetPriority = "workItem:setPriority";
  public static readonly SetCaptain = "workItem:setCaptain";
  public static readonly SetAssignedMembers = "workItem:setAssignedMembers";
  public static readonly SetDueAt = "workItem:setDueAt";
  public static readonly SetBlocked = "workItem:setBlocked";

  public static readonly AppendEvidence = "workItem:appendEvidence";
  public static readonly RemoveEvidence = "workItem:removeEvidence";

  public static readonly AppendTag = "workItem:appendTag";
  public static readonly RemoveTag = "workItem:removeTag";

  public static readonly AppendActivity = "workItem:appendActivity";

  // Server → Client
  public static readonly Ready = "workItem:ready";
  public static readonly Error = "workItem:error";

  public static readonly Created = "workItem:created";
  public static readonly Updated = "workItem:updated";
  public static readonly Deleted = "workItem:deleted";
  public static readonly BulkChanged = "workItem:bulkChanged";

  public static readonly ActivityAppended = "workItem:activityAppended";

  public static readonly ReloadHint = "workItem:reloadHint";
  public static readonly CountsChanged = "workItem:countsChanged";
}

export interface WorkItemWsSubscribeRequest {
  teamId?: string;
  userId?: string;
  workItemId?: string;

  wantCounts?: boolean;
  wantReloadHints?: boolean;
  wantActivityStream?: boolean;
}

export interface WorkItemWsErrorDto {
  message: string;
  code?: string;
  requestId?: string;
  details?: unknown;
}

export interface WorkItemCountsChangedDto {
  teamId?: string;
  total?: number;
  byStatus?: Record<string, number>;
}

@Injectable({ providedIn: "root" })
export class WorkItemWsService {
  private socket: Socket | null = null;

  private readonly ready$ = new Subject<void>();
  private readonly error$ = new Subject<WorkItemWsErrorDto>();

  private readonly created$ = new Subject<WorkItemDto>();
  private readonly updated$ = new Subject<WorkItemDto>();
  private readonly deleted$ = new Subject<{ workItemId?: string; id?: string }>();

  private readonly bulkChanged$ = new Subject<void>();
  private readonly activityAppended$ = new Subject<{ workItemId?: string; activity?: unknown }>();

  private readonly reloadHint$ = new Subject<{ message?: string; workItemId?: string }>();
  private readonly countsChanged$ = new Subject<WorkItemCountsChangedDto>();

  public constructor() {}

  // Streams
  public onReady(): Observable<void> {
    return this.ready$.asObservable();
  }
  public onError(): Observable<WorkItemWsErrorDto> {
    return this.error$.asObservable();
  }
  public onCreated(): Observable<WorkItemDto> {
    return this.created$.asObservable();
  }
  public onUpdated(): Observable<WorkItemDto> {
    return this.updated$.asObservable();
  }
  public onDeleted(): Observable<{ workItemId?: string; id?: string }> {
    return this.deleted$.asObservable();
  }
  public onBulkChanged(): Observable<void> {
    return this.bulkChanged$.asObservable();
  }
  public onActivityAppended(): Observable<{ workItemId?: string; activity?: unknown }> {
    return this.activityAppended$.asObservable();
  }
  public onReloadHint(): Observable<{ message?: string; workItemId?: string }> {
    return this.reloadHint$.asObservable();
  }
  public onCountsChanged(): Observable<WorkItemCountsChangedDto> {
    return this.countsChanged$.asObservable();
  }

  // Connection
  public connect(): void {
    if (this.socket) return;

    this.socket = io(environment.wsOrigin, {
      transports: ["websocket"],
    });

    this.bindCoreListeners(this.socket);
  }

  public subscribe(req: WorkItemWsSubscribeRequest): void {
    this.ensureConnected();
    const payload = this.omitUndefined(req);
    this.socket?.emit(WorkItemWsEvents.Subscribe, payload);
  }

  public unsubscribe(req?: WorkItemWsSubscribeRequest): void {
    this.ensureConnected();
    const payload: Partial<WorkItemWsSubscribeRequest> = req ? this.omitUndefined(req) : {};
    this.socket?.emit(WorkItemWsEvents.Unsubscribe, payload);
  }

  public disconnect(): void {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }

  // Internals
  private ensureConnected(): void {
    if (!this.socket) this.connect();
  }

  private bindCoreListeners(sock: Socket): void {
    sock.on(WorkItemWsEvents.Ready, () => this.ready$.next());

    sock.on(WorkItemWsEvents.Error, (dto: WorkItemWsErrorDto) => {
      this.error$.next(dto);
      // eslint-disable-next-line no-console
      console.log(`[Error:] WorkItem WS error: ${dto?.message ?? "unknown"}\n`);
    });

    sock.on(WorkItemWsEvents.Created, (dto: WorkItemDto) => this.created$.next(dto));
    sock.on(WorkItemWsEvents.Updated, (dto: WorkItemDto) => this.updated$.next(dto));
    sock.on(WorkItemWsEvents.Deleted, (dto: { workItemId?: string; id?: string }) => this.deleted$.next(dto));

    sock.on(WorkItemWsEvents.BulkChanged, () => this.bulkChanged$.next());

    sock.on(WorkItemWsEvents.ActivityAppended, (dto: { workItemId?: string; activity?: unknown }) => {
      this.activityAppended$.next(dto ?? {});
    });

    sock.on(WorkItemWsEvents.ReloadHint, (dto: { message?: string; workItemId?: string }) => {
      this.reloadHint$.next(dto ?? {});
    });

    sock.on(WorkItemWsEvents.CountsChanged, (dto: WorkItemCountsChangedDto) => {
      this.countsChanged$.next(dto ?? {});
    });
  }

  /**
   * exactOptionalPropertyTypes-safe omit undefined keys.
   * NOTE: uses `T extends object` to avoid index-signature errors.
   */
  private omitUndefined<T extends object>(obj: T): Partial<T> {
    const out: Partial<T> = {};
    for (const k of Object.keys(obj) as Array<keyof T>) {
      const v = obj[k];
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
}
