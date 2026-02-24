// Path: src/app/services/teamManagement/workEvents/work-event.ws.service.ts
// ============================================================================
// WorkEventWsService (client)
// ----------------------------------------------------------------------------
// Strategy: listen for changes + invalidate calendar views.
// ============================================================================

import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";

import { io, type Socket } from "socket.io-client";
import { environment } from "../../../../environments/environment";

import type { WorkEventDto } from "../../../types/team-management/work-events/work-event.types";

export class WorkEventWsEvents {
  // Client → Server
  public static readonly Subscribe = "workEvent:subscribe";
  public static readonly Unsubscribe = "workEvent:unsubscribe";

  // Server → Client
  public static readonly Ready = "workEvent:ready";
  public static readonly Error = "workEvent:error";

  public static readonly Created = "workEvent:created";
  public static readonly Updated = "workEvent:updated";
  public static readonly Deleted = "workEvent:deleted";
  public static readonly BulkChanged = "workEvent:bulkChanged";

  public static readonly ReloadHint = "workEvent:reloadHint";
  public static readonly CountsChanged = "workEvent:countsChanged";
}

export interface WorkEventWsSubscribeRequest {
  teamCode?: string;
  teamMongoId?: string;

  from?: string;
  to?: string;

  wantCounts?: boolean;
  wantReloadHints?: boolean;
}

export interface WorkEventWsErrorDto {
  message: string;
  code?: string;
  requestId?: string;
  details?: unknown;
}

export interface WorkEventCountsChangedDto {
  teamCode?: string;
  total?: number;
  byStatus?: Record<string, number>;
}

@Injectable({ providedIn: "root" })
export class WorkEventWsService {
  private socket: Socket | null = null;

  private readonly ready$ = new Subject<void>();
  private readonly error$ = new Subject<WorkEventWsErrorDto>();

  private readonly created$ = new Subject<WorkEventDto>();
  private readonly updated$ = new Subject<WorkEventDto>();
  private readonly deleted$ = new Subject<{ eventId?: string; id?: string }>();

  private readonly bulkChanged$ = new Subject<void>();
  private readonly reloadHint$ = new Subject<{ message?: string; eventId?: string }>();
  private readonly countsChanged$ = new Subject<WorkEventCountsChangedDto>();

  public constructor() {}

  public onReady(): Observable<void> {
    return this.ready$.asObservable();
  }
  public onError(): Observable<WorkEventWsErrorDto> {
    return this.error$.asObservable();
  }
  public onCreated(): Observable<WorkEventDto> {
    return this.created$.asObservable();
  }
  public onUpdated(): Observable<WorkEventDto> {
    return this.updated$.asObservable();
  }
  public onDeleted(): Observable<{ eventId?: string; id?: string }> {
    return this.deleted$.asObservable();
  }
  public onBulkChanged(): Observable<void> {
    return this.bulkChanged$.asObservable();
  }
  public onReloadHint(): Observable<{ message?: string; eventId?: string }> {
    return this.reloadHint$.asObservable();
  }
  public onCountsChanged(): Observable<WorkEventCountsChangedDto> {
    return this.countsChanged$.asObservable();
  }

  public connect(): void {
    if (this.socket) return;

    this.socket = io(environment.wsOrigin, { transports: ["websocket"] });
    this.bindCoreListeners(this.socket);
  }

  public subscribe(req: WorkEventWsSubscribeRequest): void {
    this.ensureConnected();
    const payload = this.omitUndefined(req);
    this.socket?.emit(WorkEventWsEvents.Subscribe, payload);
  }

  public unsubscribe(req?: WorkEventWsSubscribeRequest): void {
    this.ensureConnected();
    const payload: Partial<WorkEventWsSubscribeRequest> = req ? this.omitUndefined(req) : {};
    this.socket?.emit(WorkEventWsEvents.Unsubscribe, payload);
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
    sock.on(WorkEventWsEvents.Ready, () => this.ready$.next());

    sock.on(WorkEventWsEvents.Error, (dto: WorkEventWsErrorDto) => {
      this.error$.next(dto);
      // eslint-disable-next-line no-console
      console.log(`[Error:] WorkEvent WS error: ${dto?.message ?? "unknown"}\n`);
    });

    sock.on(WorkEventWsEvents.Created, (dto: WorkEventDto) => this.created$.next(dto));
    sock.on(WorkEventWsEvents.Updated, (dto: WorkEventDto) => this.updated$.next(dto));
    sock.on(WorkEventWsEvents.Deleted, (dto: { eventId?: string; id?: string }) => this.deleted$.next(dto));

    sock.on(WorkEventWsEvents.BulkChanged, () => this.bulkChanged$.next());

    sock.on(WorkEventWsEvents.ReloadHint, (dto: { message?: string; eventId?: string }) => {
      this.reloadHint$.next(dto ?? {});
    });

    sock.on(WorkEventWsEvents.CountsChanged, (dto: WorkEventCountsChangedDto) => {
      this.countsChanged$.next(dto ?? {});
    });
  }

  private omitUndefined<T extends object>(obj: T): Partial<T> {
    const out: Partial<T> = {};
    for (const k of Object.keys(obj) as Array<keyof T>) {
      const v = obj[k];
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
}
