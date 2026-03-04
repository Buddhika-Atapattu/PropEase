// Path: src/app/services/payments/banks/payment-bank.rest.service.ts
// =============================================================================
// PaymentBankRestService (FE) — matches PaymentRouter:
// - GET    /api-payments/banks
// - POST   /api-payments/banks/create
// - GET    /api-payments/banks/:bankId
// - PUT    /api-payments/banks/update/:bankId
// - PUT    /api-payments/banks/:bankId/status
// - DELETE /api-payments/banks/:bankId
// =============================================================================

import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { PaymentsApiUtil } from "../utils/_payment-api.util";
import { MSG } from '../../../types/api-message.types';
import type { BankCreateInput } from "../../../types/payments/bank-registry/banks/bank.types";
import { environment } from "../../../../environments/environment";

export type BankStatus = "active" | "inactive";


export type BankUpdateInput = Partial<BankCreateInput>;

@Injectable( { providedIn: "root" } )
export class PaymentBankRestService {
  private readonly base = `${environment.apiOrigin}/api-payments`;

  public constructor ( private readonly http: HttpClient ) {}

  /**
   * List banks
   * @param page page number
   * @param limit page size
   * @param filters status/countryCca2/q
   */
  public list$( options: {
    onlyActive?: boolean;
    countryCca2?: string;
    search?: string;
    limit?: number;
    page?: number;
  } ): Observable<MSG> {
    const url = PaymentsApiUtil.safeJoin( this.base, "banks" );
    const params = PaymentsApiUtil.toHttpParams( options );
    return this.http.get<MSG>( url, { params } );
  }

  public create$( input: BankCreateInput ): Observable<MSG> {
    const url = PaymentsApiUtil.safeJoin( this.base, "banks", "create" );
    return this.http.post<MSG>( url, input );
  }

  public getByBankId$( bankId: string ): Observable<MSG> {
    const url = PaymentsApiUtil.safeJoin( this.base, "banks", "bankId", bankId );
    return this.http.get<MSG>( url );
  }

  public getByBankCode$( bankCode: string ): Observable<MSG> {
    const url = PaymentsApiUtil.safeJoin( this.base, "banks", "bankCode", bankCode );
    return this.http.get<MSG>( url );
  }

  public update$( bankId: string, patch: BankUpdateInput ): Observable<MSG> {
    const url = PaymentsApiUtil.safeJoin( this.base, "banks", "update", bankId );
    return this.http.put<MSG>( url, patch );
  }

  public setStatus$( bankId: string, status: BankStatus ): Observable<MSG> {
    const url = PaymentsApiUtil.safeJoin( this.base, "banks", bankId, "status" );
    return this.http.put<MSG>( url, { status } );
  }

  public delete$( bankId: string ): Observable<MSG> {
    const url = PaymentsApiUtil.safeJoin( this.base, "banks", bankId );
    return this.http.delete<MSG>( url );
  }
}
