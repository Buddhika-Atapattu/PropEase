import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { KpiFacadeService } from './kpi-facade';

@Injectable({ providedIn: 'root' })
export class KpiRuntimeService {
  private started: boolean;
  private sub: Subscription | null;

  public constructor(private readonly kpis: KpiFacadeService) {
    this.started = false;
    this.sub = null;
  }

  public start(orgId: string): void {
    if (this.started) return;

    this.kpis.connectRealtime();
    this.kpis.joinOrg(orgId);

    // Example: listen and trigger refresh (you will plug into your KPI dashboard store)
    this.sub = this.kpis.listenInvalidations$().subscribe((evt) => {
      console.log('[Info:] [KPI] invalidate event received.\n', evt);
      // TODO: call dashboard refresh or store invalidation
    });

    this.started = true;
  }

  public stop(): void {
    if (!this.started) return;

    if (this.sub) {
      this.sub.unsubscribe();
      this.sub = null;
    }

    this.kpis.disconnectRealtime();
    this.started = false;
  }
}
