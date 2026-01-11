import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { io, type Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';

import type { RealtimeEventEnvelope } from '../types/kpi-realtime.types';
import type { KpiInvalidateEvent } from '../types/kpi-events';
import { KpiAuthBridgeService } from './kpi-auth-bridge';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

@Injectable({ providedIn: 'root' })
export class KpiRealtimeService {
  private socket: Socket | null;

  private readonly state$: BehaviorSubject<ConnectionState>;
  private readonly events$: Subject<RealtimeEventEnvelope<KpiInvalidateEvent>>;

  public constructor(
    private readonly zone: NgZone,
    private readonly auth: KpiAuthBridgeService
  ) {
    this.socket = null;
    this.state$ = new BehaviorSubject<ConnectionState>('disconnected');
    this.events$ = new Subject<RealtimeEventEnvelope<KpiInvalidateEvent>>();
  }

  public getConnectionState$(): Observable<ConnectionState> {
    return this.state$.asObservable();
  }

  public getEvents$(): Observable<RealtimeEventEnvelope<KpiInvalidateEvent>> {
    return this.events$.asObservable();
  }

  /**
   * Connect once per app session (runtime service will ensure idempotency).
   */
  public connect(): void {
    if (this.socket) return;

    this.state$.next('connecting');

    // Teaching note:
    // Browser Socket.IO cannot set custom headers reliably.
    // Use `auth` payload (recommended) or query params.
    // Backend should validate auth tokens during handshake.
    const authPayload = {
      sessionToken: this.auth.getSessionToken(),
      guardToken: this.auth.getGuardToken(),
      wsToken: this.auth.getWsToken(),
    };

    const url: string = environment.wsOrigin || environment.apiOrigin;

    this.socket = io(url, {
      transports: ['websocket'],
      auth: authPayload,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 800,
      timeout: 10000,
    });

    this.bindSocketEvents();
  }

  public disconnect(): void {
    if (!this.socket) return;

    this.socket.disconnect();
    this.socket = null;
    this.state$.next('disconnected');
  }

  /**
   * Join a KPI audience room (org:<id>, team:<id>, etc.)
   */
  public joinRoom(room: string): void {
    if (!this.socket) return;
    this.socket.emit('kpi:join', { room });
  }

  public leaveRoom(room: string): void {
    if (!this.socket) return;
    this.socket.emit('kpi:leave', { room });
  }

  private bindSocketEvents(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.zone.run(() => this.state$.next('connected'));
    });

    this.socket.on('disconnect', () => {
      this.zone.run(() => this.state$.next('disconnected'));
    });

    // KPI event channel (backend should emit this)
    this.socket.on('kpi:event', (envelope: RealtimeEventEnvelope<KpiInvalidateEvent>) => {
      this.zone.run(() => this.events$.next(envelope));
    });

    this.socket.on('connect_error', (err: unknown) => {
      console.log('[Error:] [KPI Realtime] connect_error.\n', err);
      this.zone.run(() => this.state$.next('disconnected'));
    });
  }
}
