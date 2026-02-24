// Path: src/app/services/teamManagement/memberActivities/member-activities.ws.service.ts
// ============================================================================
// MemberActivitiesWsService (client)
// ----------------------------------------------------------------------------
// Strategy: stream live activity feed updates for dashboards / member profile.
// ============================================================================

import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";

import { io, type Socket } from "socket.io-client";
import { environment } from "../../../../environments/environment";

import type { MemberActivityDto } from "../../../types/team-management/member-activities/member-activities.types";

export class MemberActivitiesWsEvents {
  // Client → Server
  public static readonly Subscribe = "memberActivity:subscribe";
  public static readonly Unsubscribe = "memberActivity:unsubscribe";

  // Server → Client
  public static readonly Ready = "memberActivity:ready";
  public static readonly Error = "memberActivity:error";

  public static readonly Created = "memberActivity:created";
  public static readonly Deleted = "memberActivity:deleted";
  public static readonly BulkChanged = "memberActivity:bulkChanged";

  public static readonly ReloadHint = "memberActivity:reloadHint";
  public static readonly CountsChanged = "memberActivity:countsChanged";
}

export interface MemberActivitiesWsSubscribeRequest {
  teamCode?: string;
  teamMongoId?: string;

  actorUserId?: string;
  actorUsername?: string;

  wantCounts?: boolean;
  wantReloadHints?: boolean;
}

export interface MemberActivitiesWsErrorDto {
  message: string;
  code?: string;
  requestId?: string;
  details?: unknown;
}

export interface MemberActivitiesCountsChangedDto {
  teamCode?: string;
  total?: number;
  byType?: Record<string, number>;
  bySeverity?: Record<string, number>;
}

@Injectable({ providedIn: "root" })
export class MemberActivitiesWsService {
  private socket: Socket | null = null;

  private readonly ready$ = new Subject<void>();
  private readonly error$ = new Subject<MemberActivitiesWsErrorDto>();

  private readonly created$ = new Subject<MemberActivityDto>();
  private readonly deleted$ = new Subject<{ activityId?: string; id?: string }>();

  private readonly bulkChanged$ = new Subject<void>();
  private readonly reloadHint$ = new Subject<{ message?: string; activityId?: string }>();
  private readonly countsChanged$ = new Subject<MemberActivitiesCountsChangedDto>();

  public constructor() {}

  // Streams
  public onReady(): Observable<void> {
    return this.ready$.asObservable();
  }
  public onError(): Observable<MemberActivitiesWsErrorDto> {
    return this.error$.asObservable();
  }
  public onCreated(): Observable<MemberActivityDto> {
    return this.created$.asObservable();
  }
  public onDeleted(): Observable<{ activityId?: string; id?: string }> {
    return this.deleted$.asObservable();
  }
  public onBulkChanged(): Observable<void> {
    return this.bulkChanged$.asObservable();
  }
  public onReloadHint(): Observable<{ message?: string; activityId?: string }> {
    return this.reloadHint$.asObservable();
  }
  public onCountsChanged(): Observable<MemberActivitiesCountsChangedDto> {
    return this.countsChanged$.asObservable();
  }

  // Connection
  public connect(): void {
    if (this.socket) return;

    this.socket = io(environment.wsOrigin, { transports: ["websocket"] });
    this.bindCoreListeners(this.socket);
  }

  public subscribe(req: MemberActivitiesWsSubscribeRequest): void {
    this.ensureConnected();
    const payload = this.omitUndefined(req);
    this.socket?.emit(MemberActivitiesWsEvents.Subscribe, payload);
  }

  public unsubscribe(req?: MemberActivitiesWsSubscribeRequest): void {
    this.ensureConnected();
    const payload: Partial<MemberActivitiesWsSubscribeRequest> = req ? this.omitUndefined(req) : {};
    this.socket?.emit(MemberActivitiesWsEvents.Unsubscribe, payload);
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
    sock.on(MemberActivitiesWsEvents.Ready, () => this.ready$.next());

    sock.on(MemberActivitiesWsEvents.Error, (dto: MemberActivitiesWsErrorDto) => {
      this.error$.next(dto);
      // eslint-disable-next-line no-console
      console.log(`[Error:] MemberActivity WS error: ${dto?.message ?? "unknown"}\n`);
    });

    sock.on(MemberActivitiesWsEvents.Created, (dto: MemberActivityDto) => this.created$.next(dto));

    sock.on(MemberActivitiesWsEvents.Deleted, (dto: { activityId?: string; id?: string }) => {
      this.deleted$.next(dto ?? {});
    });

    sock.on(MemberActivitiesWsEvents.BulkChanged, () => this.bulkChanged$.next());

    sock.on(MemberActivitiesWsEvents.ReloadHint, (dto: { message?: string; activityId?: string }) => {
      this.reloadHint$.next(dto ?? {});
    });

    sock.on(MemberActivitiesWsEvents.CountsChanged, (dto: MemberActivitiesCountsChangedDto) => {
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
