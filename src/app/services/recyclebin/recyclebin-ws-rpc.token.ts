// Path: src/app/services/recyclebin/recyclebin-ws-rpc.token.ts
// =============================================================================
// RecycleBin WS-RPC Injection Token
// =============================================================================
//
// Why:
// - Interfaces are erased at runtime in TypeScript.
// - Angular DI needs a runtime token to inject an optional provider.
// - This token allows WS-RPC layer to be plugged in later without changing Center.
// =============================================================================

import { InjectionToken } from "@angular/core";
import type { RecycleBinWsRpcApi } from "./recyclebin-ws-rpc.api";

export class RecycleBinWsRpcToken {
  private constructor() {}

  /**
   * Runtime DI token for optional WS-RPC provider.
   *
   * Usage hint:
   * - providers: [{ provide: RecycleBinWsRpcToken.TOKEN, useExisting: RecycleBinWsRpcService }]
   */
  public static readonly TOKEN: InjectionToken<RecycleBinWsRpcApi> =
    new InjectionToken<RecycleBinWsRpcApi>("RECYCLEBIN_WS_RPC_API");
}
