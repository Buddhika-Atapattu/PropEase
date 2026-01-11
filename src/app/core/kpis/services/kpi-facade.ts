import { Injectable } from '@angular/core';
import { filter, Observable } from 'rxjs';

import { KpiApiService } from './kpi-api';
import { KpiRealtimeService } from './kpi-realtime';
import { KpiTopicRouterService } from './kpi-topic-router';

import type { RealtimeEventEnvelope } from '../types/kpi-realtime.types';
import type { KpiInvalidateEvent } from '../types/kpi-events';

@Injectable({ providedIn: 'root' })
export class KpiFacadeService {
  public constructor(
    private readonly api: KpiApiService,
    private readonly realtime: KpiRealtimeService,
    private readonly router: KpiTopicRouterService
  ) {}

  // REST
  public realtimeHealth(): Promise<boolean> {
    return this.api.realtimeHealth();
  }

  // WS
  public connectRealtime(): void {
    this.realtime.connect();
  }

  public disconnectRealtime(): void {
    this.realtime.disconnect();
  }

  public listenInvalidations$(): Observable<RealtimeEventEnvelope<KpiInvalidateEvent>> {
    return this.realtime.getEvents$().pipe(
      filter((e) => e?.payload?.kind === 'kpi_scope_invalidated')
    );
  }

  public joinOrg(orgId: string): void {
    this.realtime.joinRoom(this.router.buildAudienceRoom('org', orgId));
  }

  public joinBranch(branchId: string): void {
    this.realtime.joinRoom(this.router.buildAudienceRoom('branch', branchId));
  }

  public joinTeam(teamId: string): void {
    this.realtime.joinRoom(this.router.buildAudienceRoom('team', teamId));
  }

  public joinMember(memberId: string): void {
    this.realtime.joinRoom(this.router.buildAudienceRoom('member', memberId));
  }

  public joinProperty(propertyId: string): void {
    this.realtime.joinRoom(this.router.buildAudienceRoom('property', propertyId));
  }
}
