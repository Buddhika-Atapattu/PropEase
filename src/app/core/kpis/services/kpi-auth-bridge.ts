import { Injectable } from '@angular/core';

/**
 * This service is the ONLY place KPI realtime reads security tokens.
 * That keeps realtime layer isolated from the rest of your security module.
 */
@Injectable({ providedIn: 'root' })
export class KpiAuthBridgeService {
  public constructor(
    // TODO: inject your existing security service here (token store)
    // private readonly security: SecuritySessionService,
  ) {}

  public getSessionToken(): string {
    // return this.security.getSessionToken();
    return '';
  }

  public getGuardToken(): string {
    // return this.security.getGuardToken();
    return '';
  }

  public getWsToken(): string {
    // return this.security.getWsToken();
    return '';
  }
}
