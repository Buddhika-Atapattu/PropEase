// Path: src/app/services/teamManagement/teamMain/team-main.ws.service.ts
// ============================================================================
// TeamMainWsService (client)
// ----------------------------------------------------------------------------
// PURPOSE
// - Subscribe/unsubscribe to Team MAIN rooms
// - Listen to server events and expose RxJS streams
//
// NOTE
// - This service does NOT replace REST reads.
// - Strategy: listen for invalidate/created/updated/deleted then refetch via REST.
// ============================================================================

import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";

import type {
  TeamMainDto,
  TeamDomain,
} from "../../../types/team-management/teamMain/team-main.types";

// If you already have a central Socket.IO wrapper service, replace this import.
// Example: AppSocketService wraps socket.io-client and handles auth token handshake.
import { io, Socket } from "socket.io-client";
import { environment } from "../../../../environments/environment";

// ----------------------------------------------------------------------------
// Canonical event names (mirror backend TeamWsEvents)
// ----------------------------------------------------------------------------
export class TeamMainWsEvents {
  // Client → Server
  public static readonly Subscribe = "team:subscribe";
  public static readonly Unsubscribe = "team:unsubscribe";

  // Server → Client
  public static readonly Ready = "team:ready";
  public static readonly Error = "team:error";

  public static readonly Created = "team:created";
  public static readonly Updated = "team:updated";
  public static readonly Deleted = "team:deleted";
  public static readonly BulkChanged = "team:bulkChanged";

  public static readonly ListInvalidate = "team:list:invalidate";
  public static readonly ReloadHint = "team:reloadHint";
  public static readonly CountsChanged = "team:countsChanged";
}

export interface TeamWsSubscribeRequest {
  // If your backend supports these, send them; otherwise keep minimal.
  teamCode?: string;
  domain?: TeamDomain;

  // UI hints (optional)
  wantCounts?: boolean;
  wantListInvalidation?: boolean;
}

export interface TeamWsErrorDto {
  message: string;
  code?: string;
  requestId?: string;
  details?: unknown;
}

export interface TeamListInvalidateDto {
  reason: "created" | "updated" | "deleted" | "bulkChanged";
  teamCode?: string;
  teamId?: string;
  hints?: {
    likelyAffectsSort?: boolean;
    likelyAffectsFilters?: boolean;
  };
}

export interface TeamCountsChangedDto {
  // Keep flexible: sidebar badges, etc.
  teamsTotal?: number;
  usersNoTeam?: number;
  usersInTeams?: number;
  domain?: TeamDomain;
}

@Injectable({ providedIn: "root" })
export class TeamMainWsService {
  private socket: Socket | null = null;

  private readonly ready$ = new Subject<void>();
  private readonly error$ = new Subject<TeamWsErrorDto>();

  private readonly created$ = new Subject<TeamMainDto>();
  private readonly updated$ = new Subject<TeamMainDto>();
  private readonly deleted$ = new Subject<{ teamCode?: string; teamId?: string }>();

  private readonly listInvalidate$ = new Subject<TeamListInvalidateDto>();
  private readonly countsChanged$ = new Subject<TeamCountsChangedDto>();

  public constructor() {}

  // ---------------------------------------------------------------------------
  // Public streams
  // ---------------------------------------------------------------------------
  public onReady(): Observable<void> {
    return this.ready$.asObservable();
  }

  public onError(): Observable<TeamWsErrorDto> {
    return this.error$.asObservable();
  }

  public onCreated(): Observable<TeamMainDto> {
    return this.created$.asObservable();
  }

  public onUpdated(): Observable<TeamMainDto> {
    return this.updated$.asObservable();
  }

  public onDeleted(): Observable<{ teamCode?: string; teamId?: string }> {
    return this.deleted$.asObservable();
  }

  public onListInvalidate(): Observable<TeamListInvalidateDto> {
    return this.listInvalidate$.asObservable();
  }

  public onCountsChanged(): Observable<TeamCountsChangedDto> {
    return this.countsChanged$.asObservable();
  }

  /**
   * Connect socket (idempotent).
   *
   * IMPORTANT
   * - Prefer a central Socket wrapper in your app for:
   *   auth token injection, reconnect policy, SSR guard, and shared connection.
   */
  public connect(): void {
    if (this.socket) return;

    this.socket = io(environment.wsOrigin, {
      transports: ["websocket"],
      // If you use auth token headers/handshake, wire it here or via wrapper service:
      // auth: { token: "..." }
    });

    this.bindCoreListeners(this.socket);
  }

  /**
   * Subscribe to Team MAIN rooms.
   *
   * @param req
   * - Expected: subscription hints (teamCode optional)
   * - Usage: call in list screen init + team-details init
   */
  public subscribe(req: TeamWsSubscribeRequest): void {
    this.ensureConnected();
    const payload = this.omitUndefined(req); // ✅ now compiles
    this.socket?.emit(TeamMainWsEvents.Subscribe, payload);
  }

  /**
   * Unsubscribe from Team MAIN rooms.
   */
  public unsubscribe(req?: TeamWsSubscribeRequest): void {
    this.ensureConnected();

    // ✅ keep payload DTO-safe and avoid Record<string, unknown>
    const payload: Partial<TeamWsSubscribeRequest> = req ? this.omitUndefined(req) : {};
    this.socket?.emit(TeamMainWsEvents.Unsubscribe, payload);
  }

  /**
   * Disconnect socket fully (rare; usually keep global connection).
   */
  public disconnect(): void {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  private ensureConnected(): void {
    if (!this.socket) this.connect();
  }

  private bindCoreListeners(sock: Socket): void {
    sock.on(TeamMainWsEvents.Ready, () => {
      this.ready$.next();
    });

    sock.on(TeamMainWsEvents.Error, (dto: TeamWsErrorDto) => {
      this.error$.next(dto);
      // eslint-disable-next-line no-console
      console.log(`[Error:] Team WS error: ${dto?.message ?? "unknown"}\n`);
    });

    sock.on(TeamMainWsEvents.Created, (team: TeamMainDto) => {
      this.created$.next(team);
    });

    sock.on(TeamMainWsEvents.Updated, (team: TeamMainDto) => {
      this.updated$.next(team);
    });

    sock.on(TeamMainWsEvents.Deleted, (dto: { teamCode?: string; teamId?: string }) => {
      this.deleted$.next(dto);
    });

    sock.on(TeamMainWsEvents.ListInvalidate, (dto: TeamListInvalidateDto) => {
      this.listInvalidate$.next(dto);
    });

    sock.on(TeamMainWsEvents.CountsChanged, (dto: TeamCountsChangedDto) => {
      this.countsChanged$.next(dto);
    });
  }

  /**
   * Omit undefined keys (exactOptionalPropertyTypes-safe).
   *
   * @param obj
   * - Expected: any plain object (DTO/payload)
   * - Usage: remove keys where value is undefined before emitting to server
   */
  private omitUndefined<T extends object>(obj: T): Partial<T> {
    const out: Partial<T> = {};

    for (const k of Object.keys(obj) as Array<keyof T>) {
      const v = obj[k];
      if (v !== undefined) {
        out[k] = v;
      }
    }

    return out;
  }
}
