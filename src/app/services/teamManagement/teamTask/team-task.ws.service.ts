// Path: src/app/services/teamManagement/teamTask/team-task.ws.service.ts
// ============================================================================
// TeamTaskWsService (client)
// ----------------------------------------------------------------------------
// Canonical WS event names from backend: team-task.ws.events.ts
// - Created / Updated / Deleted / BulkChanged / ReloadHint / CountsChanged
// - Ready / Error
//
// Strategy
// - WS is for realtime invalidation + stream updates.
// - Reads still use REST for guaranteed consistency.
// ============================================================================

import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";

import { io, type Socket } from "socket.io-client";
import { environment } from "../../../../environments/environment";

import type { TeamTaskDto } from "../../../types/team-management/team-task/team-task.types";

export class TeamTaskWsEvents {
  // Client → Server
  public static readonly Subscribe = "teamTask:subscribe";
  public static readonly Unsubscribe = "teamTask:unsubscribe";

  // Server → Client
  public static readonly Ready = "teamTask:ready";
  public static readonly Error = "teamTask:error";

  public static readonly Created = "teamTask:created";
  public static readonly Updated = "teamTask:updated";
  public static readonly Deleted = "teamTask:deleted";
  public static readonly BulkChanged = "teamTask:bulkChanged";

  public static readonly ReloadHint = "teamTask:reloadHint";
  public static readonly CountsChanged = "teamTask:countsChanged";
}

export interface TeamTaskWsSubscribeRequest {
  teamCode?: string;
  teamMongoId?: string;
  taskMongoId?: string;

  // UI wants (optional hints)
  wantCounts?: boolean;
  wantReloadHints?: boolean;
}

export interface TeamTaskWsErrorDto {
  message: string;
  code?: string;
  requestId?: string;
  details?: unknown;
}

export interface TeamTaskCountsChangedDto {
  teamCode?: string;
  total?: number;
  byStatus?: Record<string, number>;
}

@Injectable({ providedIn: "root" })
export class TeamTaskWsService {
  private socket: Socket | null = null;

  private readonly ready$ = new Subject<void>();
  private readonly error$ = new Subject<TeamTaskWsErrorDto>();

  private readonly created$ = new Subject<TeamTaskDto>();
  private readonly updated$ = new Subject<TeamTaskDto>();
  private readonly deleted$ = new Subject<{ taskMongoId?: string; id?: string }>();

  private readonly bulkChanged$ = new Subject<void>();
  private readonly reloadHint$ = new Subject<{ message?: string; taskMongoId?: string }>();
  private readonly countsChanged$ = new Subject<TeamTaskCountsChangedDto>();

  public constructor() {}

  // Streams
  public onReady(): Observable<void> {
    return this.ready$.asObservable();
  }
  public onError(): Observable<TeamTaskWsErrorDto> {
    return this.error$.asObservable();
  }
  public onCreated(): Observable<TeamTaskDto> {
    return this.created$.asObservable();
  }
  public onUpdated(): Observable<TeamTaskDto> {
    return this.updated$.asObservable();
  }
  public onDeleted(): Observable<{ taskMongoId?: string; id?: string }> {
    return this.deleted$.asObservable();
  }
  public onBulkChanged(): Observable<void> {
    return this.bulkChanged$.asObservable();
  }
  public onReloadHint(): Observable<{ message?: string; taskMongoId?: string }> {
    return this.reloadHint$.asObservable();
  }
  public onCountsChanged(): Observable<TeamTaskCountsChangedDto> {
    return this.countsChanged$.asObservable();
  }

  public connect(): void {
    if (this.socket) return;

    this.socket = io(environment.wsOrigin, {
      transports: ["websocket"],
    });

    this.bindCoreListeners(this.socket);
  }

  public subscribe(req: TeamTaskWsSubscribeRequest): void {
    this.ensureConnected();
    const payload = this.omitUndefined(req); // ✅ fixed typing
    this.socket?.emit(TeamTaskWsEvents.Subscribe, payload);
  }

  public unsubscribe(req?: TeamTaskWsSubscribeRequest): void {
    this.ensureConnected();
    const payload: Partial<TeamTaskWsSubscribeRequest> = req ? this.omitUndefined(req) : {};
    this.socket?.emit(TeamTaskWsEvents.Unsubscribe, payload);
  }

  public disconnect(): void {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private ensureConnected(): void {
    if (!this.socket) this.connect();
  }

  private bindCoreListeners(sock: Socket): void {
    sock.on(TeamTaskWsEvents.Ready, () => this.ready$.next());

    sock.on(TeamTaskWsEvents.Error, (dto: TeamTaskWsErrorDto) => {
      this.error$.next(dto);
      // eslint-disable-next-line no-console
      console.log(`[Error:] TeamTask WS error: ${dto?.message ?? "unknown"}\n`);
    });

    sock.on(TeamTaskWsEvents.Created, (dto: TeamTaskDto) => this.created$.next(dto));
    sock.on(TeamTaskWsEvents.Updated, (dto: TeamTaskDto) => this.updated$.next(dto));

    sock.on(TeamTaskWsEvents.Deleted, (dto: { taskMongoId?: string; id?: string }) => this.deleted$.next(dto));

    sock.on(TeamTaskWsEvents.BulkChanged, () => this.bulkChanged$.next());

    sock.on(TeamTaskWsEvents.ReloadHint, (dto: { message?: string; taskMongoId?: string }) => {
      this.reloadHint$.next(dto ?? {});
    });

    sock.on(TeamTaskWsEvents.CountsChanged, (dto: TeamTaskCountsChangedDto) => {
      this.countsChanged$.next(dto ?? {});
    });
  }

  /**
   * exactOptionalPropertyTypes-safe omit undefined keys.
   * NOTE: uses `T extends object` to avoid index-signature error.
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
