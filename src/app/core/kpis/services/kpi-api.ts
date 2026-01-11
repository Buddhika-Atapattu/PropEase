import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';

import type {
  KpiDealFactDto,
  KpiSatisfactionFactDto,
  KpiMaintenanceEventDto,
  KpiTeamTaskFactDto,
  KpiTeamTaskEvidenceDto,
  KpiTeamTaskEventDto,
} from '../types/kpi-dtos';

interface ApiMsg<T> {
  success: boolean;
  status: 'success' | 'error';
  message: string;
  timestamp: string;
  data?: T;
  errors?: string[];
}

@Injectable({ providedIn: 'root' })
export class KpiApiService {
  private readonly baseUrl: string;

  public constructor(private readonly http: HttpClient) {
    this.baseUrl = `${environment.apiOrigin}/api-kpis`;
  }

  public async submitDealFact(dto: KpiDealFactDto): Promise<string> {
    const url = `${this.baseUrl}/facts/deals`;
    const res = await firstValueFrom(this.http.post<ApiMsg<{ id: string }>>(url, dto));
    return res.data?.id ?? '';
  }

  public async submitSatisfactionFact(dto: KpiSatisfactionFactDto): Promise<string> {
    const url = `${this.baseUrl}/facts/satisfaction`;
    const res = await firstValueFrom(this.http.post<ApiMsg<{ id: string }>>(url, dto));
    return res.data?.id ?? '';
  }

  public async submitMaintenanceEvent(dto: KpiMaintenanceEventDto): Promise<string> {
    const url = `${this.baseUrl}/facts/maintenance/events`;
    const res = await firstValueFrom(this.http.post<ApiMsg<{ id: string }>>(url, dto));
    return res.data?.id ?? '';
  }

  public async submitTeamTaskFact(dto: KpiTeamTaskFactDto): Promise<string> {
    const url = `${this.baseUrl}/facts/team/tasks`;
    const res = await firstValueFrom(this.http.post<ApiMsg<{ id: string }>>(url, dto));
    return res.data?.id ?? '';
  }

  public async submitTeamTaskEvidence(dto: KpiTeamTaskEvidenceDto): Promise<string> {
    const url = `${this.baseUrl}/facts/team/task-evidence`;
    const res = await firstValueFrom(this.http.post<ApiMsg<{ id: string }>>(url, dto));
    return res.data?.id ?? '';
  }

  public async submitTeamTaskEvent(dto: KpiTeamTaskEventDto): Promise<string> {
    const url = `${this.baseUrl}/facts/team/task-events`;
    const res = await firstValueFrom(this.http.post<ApiMsg<{ id: string }>>(url, dto));
    return res.data?.id ?? '';
  }

  public async realtimeHealth(): Promise<boolean> {
    const url = `${this.baseUrl}/realtime/health`;
    const res = await firstValueFrom(this.http.get<ApiMsg<unknown>>(url));
    return res.success === true;
  }
}
