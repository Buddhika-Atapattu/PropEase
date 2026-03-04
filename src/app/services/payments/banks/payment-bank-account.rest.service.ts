// Path: src/app/services/payments/bank-accounts/payment-bank-account.rest.service.ts
// =============================================================================
// PaymentBankAccountRestService (FE) — matches PaymentRouter:
// - GET    /api-payments/bank-accounts/public
// - POST   /api-payments/bank-accounts
// - GET    /api-payments/bank-accounts/:accountId
// - PUT    /api-payments/bank-accounts/:accountId
// - PUT    /api-payments/bank-accounts/:accountId/default
// - DELETE /api-payments/bank-accounts/:accountId
// =============================================================================

import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { PaymentsApiUtil } from "../utils/_payment-api.util";
import { MSG } from '../../../types/api-message.types';
import { environment } from "../../../../environments/environment";
import type { BankAccountCreateInputDto, BankAccountUpdateInputDto } from "../../../types/payments/bank-registry/bank-accounts/bank-account.types";


@Injectable( { providedIn: "root" } )
export class PaymentBankAccountRestService {
  private readonly base = `${ environment.apiOrigin }/api-payments`;

  public constructor ( private readonly http: HttpClient ) {}

  /**
   * Public list for payment form selection
   * - includeInactive optional
   */
  public listPublic$(filters?: { includeInactive?: boolean }): Observable<MSG> {
    const url = PaymentsApiUtil.safeJoin(this.base, "bank-accounts", "public");
    const params = PaymentsApiUtil.toHttpParams(filters ?? {});
    return this.http.get<MSG>(url, { params });
  }

  public create$( input: BankAccountCreateInputDto ): Observable<MSG> {
    const url = PaymentsApiUtil.safeJoin( this.base, "bank-accounts", "create" );
    return this.http.post<MSG>( url, input );
  }

  public getByAccountId$( accountId: string ): Observable<MSG> {
    const url = PaymentsApiUtil.safeJoin( this.base, "bank-accounts", "accountId", accountId );
    return this.http.get<MSG>( url );
  }

  public getByAccountAlias$( alias: string ): Observable<MSG> {
    const url = PaymentsApiUtil.safeJoin( this.base, "bank-accounts", "alias", alias );
    return this.http.get<MSG>( url );
  }

  public update$( accountId: string, patch: BankAccountUpdateInputDto ): Observable<MSG> {
    const url = PaymentsApiUtil.safeJoin( this.base, "bank-accounts", "update", accountId );
    return this.http.put<MSG>( url, patch );
  }

  public setDefault$( accountId: string ): Observable<MSG> {
    const url = PaymentsApiUtil.safeJoin( this.base, "bank-accounts", "default", accountId );
    return this.http.put<MSG>( url, {} );
  }

  public delete$( accountId: string ): Observable<MSG> {
    const url = PaymentsApiUtil.safeJoin( this.base, "bank-accounts", "delete", accountId );
    return this.http.delete<MSG>( url );
  }
}
