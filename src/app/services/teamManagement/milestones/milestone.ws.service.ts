// Path: src/app/services/teamManagement/milestones/milestone.ws.service.ts
// ============================================================================
// MilestoneWsService (client)
// ----------------------------------------------------------------------------
// Strategy: stream milestone changes + invalidate list/dashboard.
// ============================================================================

import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";

import { io, type Socket } from "socket.io-client";
import { environment } from "../../../../environments/environment";

import type { MilestoneDto } from "../../../types/team-management/milestone/milestone.types";

export class MilestoneWsEvents {
  // Client → Server
  public static readonly Subscribe = "milestone:subscribe";
  public static readonly Unsubscribe = "milestone:unsubscribe";

  // Server → Client
  public static readonly Ready = "milestone:ready";
  public static readonly Error = "milestone:error";

  public static readonly Created = "milestone:created";
  public static readonly Updated = "milestone:updated";
  public static readonly Deleted = "milestone:deleted";
  public static readonly BulkChanged = "milestone:bulkChanged";

  public static readonly ReloadHint = "milestone:reloadHint";
  public static readonly CountsChanged = "milestone:countsChanged";
}

export interface MilestoneWsSubscribeRequest {
  teamCode?: string;
  teamMongoId?: string;

  wantCounts?: boolean;
  wantReloadHints?: boolean;
}

export interface MilestoneWsErrorDto {
  message: string;
  code?: string;
  requestId?: string;
  details?: unknown;
}

export interface MilestoneCountsChangedDto {
  teamCode?: string;
  total?: number;
  byStatus?: Record<string, number>;
}

@Injectable({ providedIn: "root" })
export class MilestoneWsService {
  private socket: Socket | null = null;

  private readonly ready$ = new Subject<void>();
  private readonly error$ = new Subject<MilestoneWsErrorDto>();

  private readonly created$ = new Subject<MilestoneDto>();
  private readonly updated$ = new Subject<MilestoneDto>();
  private readonly deleted$ = new Subject<{ milestoneId?: string; id?: string }>();

  private readonly bulkChanged$ = new Subject<void>();
  private readonly reloadHint$ = new Subject<{ message?: string; milestoneId?: string }>();
  private readonly countsChanged$ = new Subject<MilestoneCountsChangedDto>();

  public constructor() {}

  public onReady(): Observable<void> {
    return this.ready$.asObservable();
  }
  public onError(): Observable<MilestoneWsErrorDto> {
    return this.error$.asObservable();
  }
  public onCreated(): Observable<MilestoneDto> {
    return this.created$.asObservable();
  }
  public onUpdated(): Observable<MilestoneDto> {
    return this.updated$.asObservable();
  }
  public onDeleted(): Observable<{ milestoneId?: string; id?: string }> {
    return this.deleted$.asObservable();
  }
  public onBulkChanged(): Observable<void> {
    return this.bulkChanged$.asObservable();
  }
  public onReloadHint(): Observable<{ message?: string; milestoneId?: string }> {
    return this.reloadHint$.asObservable();
  }
  public onCountsChanged(): Observable<MilestoneCountsChangedDto> {
    return this.countsChanged$.asObservable();
  }

  public connect(): void {
    if (this.socket) return;

    this.socket = io(environment.wsOrigin, { transports: ["websocket"] });
    this.bindCoreListeners(this.socket);
  }

  public subscribe(req: MilestoneWsSubscribeRequest): void {
    this.ensureConnected();
    const payload = this.omitUndefined(req);
    this.socket?.emit(MilestoneWsEvents.Subscribe, payload);
  }

  public unsubscribe(req?: MilestoneWsSubscribeRequest): void {
    this.ensureConnected();
    const payload: Partial<MilestoneWsSubscribeRequest> = req ? this.omitUndefined(req) : {};
    this.socket?.emit(MilestoneWsEvents.Unsubscribe, payload);
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
    sock.on(MilestoneWsEvents.Ready, () => this.ready$.next());

    sock.on(MilestoneWsEvents.Error, (dto: MilestoneWsErrorDto) => {
      this.error$.next(dto);
      // eslint-disable-next-line no-console
      console.log(`[Error:] Milestone WS error: ${dto?.message ?? "unknown"}\n`);
    });

    sock.on(MilestoneWsEvents.Created, (dto: MilestoneDto) => this.created$.next(dto));
    sock.on(MilestoneWsEvents.Updated, (dto: MilestoneDto) => this.updated$.next(dto));
    sock.on(MilestoneWsEvents.Deleted, (dto: { milestoneId?: string; id?: string }) => this.deleted$.next(dto));

    sock.on(MilestoneWsEvents.BulkChanged, () => this.bulkChanged$.next());

    sock.on(MilestoneWsEvents.ReloadHint, (dto: { message?: string; milestoneId?: string }) => {
      this.reloadHint$.next(dto ?? {});
    });

    sock.on(MilestoneWsEvents.CountsChanged, (dto: MilestoneCountsChangedDto) => {
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
