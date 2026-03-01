// Path: src/app/services/recyclebin/recyclebin-ws-rpc.api.ts

import type { Observable } from "rxjs";
import type { PageQuery, RecycleBinListFilters, RecycleBinListUiResult } from "../../types/recyclebin/recyclebin.types";

/**
 * OPTIONAL WS RPC service contract.
 * Plug-in later using InjectionToken.
 */
export interface RecycleBinWsRpcApi {
  list$(options: { page: PageQuery; filters?: RecycleBinListFilters }): Observable<RecycleBinListUiResult>;
  count$(filters?: RecycleBinListFilters): Observable<number>;
  isReady$(): Observable<boolean>;
}
