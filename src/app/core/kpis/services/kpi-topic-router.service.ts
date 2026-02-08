import { Injectable } from '@angular/core';
import type { KpiScope } from '../types/kpi-events';

@Injectable({ providedIn: 'root' })
export class KpiTopicRouterService {
  public constructor() {}

  /**
   * Topic format must match backend builder policy.
   * Keep it centralized so you don’t scatter topic strings across the UI.
   */
  public buildInvalidateTopic(scope: KpiScope, targetId: string): string {
    // Example aligned to backend: kpi/<scope>/<id>/signal/...
    // If your backend differs, change ONLY here.
    return `kpi/${scope}/${targetId}/signal`;
  }

  public buildAudienceRoom(kind: 'org' | 'branch' | 'property' | 'team' | 'member', id: string): string {
    // Socket.IO room convention (future proof)
    return `${kind}:${id}`;
  }
}
