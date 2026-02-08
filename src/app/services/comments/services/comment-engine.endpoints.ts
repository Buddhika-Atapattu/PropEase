// ============================================================================
// PropEase FE — Comment Engine Endpoints (REST + WS)
// ----------------------------------------------------------------------------
// Single source of truth for endpoint paths.
// Change here ONLY if backend mount path changes.
// ============================================================================

// Path: src/app/services/comments/services/comment-engine.endpoints.ts
import { environment } from "../../../../environments/environment";

export class CommentEngineEndpoints {
  private static readonly apiRoot: string = String(environment.apiOrigin ?? "http://localhost:3000")
    .trim()
    .replace(/\/+$/, ""); // remove trailing slashes

  private static readonly basePath: string = "/api-comments";

  public static readonly REST_BASE: string =
    `${CommentEngineEndpoints.apiRoot}${CommentEngineEndpoints.basePath}`;

  public static readonly WS_NAMESPACE: string = "/";

  public static readonly LOAD: string = `${CommentEngineEndpoints.REST_BASE}/load`;
  public static readonly LOAD_ADVANCED: string = `${CommentEngineEndpoints.REST_BASE}/load-advanced`;
  public static readonly COUNT_ADVANCED: string = `${CommentEngineEndpoints.REST_BASE}/count-advanced`;
  public static readonly COUNT_LOAD: string = `${CommentEngineEndpoints.REST_BASE}/count-load`;

  public static readonly GET_BY_ID = (id: string): string =>
    `${CommentEngineEndpoints.REST_BASE}/get/${encodeURIComponent(String(id).trim())}`;

  public static readonly ADD: string = `${CommentEngineEndpoints.REST_BASE}/add`;

  public static readonly EDIT = (id: string): string =>
    `${CommentEngineEndpoints.REST_BASE}/edit/${encodeURIComponent(String(id).trim())}`;

  public static readonly DELETE = (id: string): string =>
    `${CommentEngineEndpoints.REST_BASE}/delete/${encodeURIComponent(String(id).trim())}`;


public static readonly PIN_TOGGLE = (id: string): string =>
  `${CommentEngineEndpoints.REST_BASE}/pin-toggle/${encodeURIComponent(String(id).trim())}`;

// If you prefer explicit routes instead of toggle:
public static readonly PIN = (id: string): string =>
  `${CommentEngineEndpoints.REST_BASE}/pin/${encodeURIComponent(String(id).trim())}`;

public static readonly UNPIN = (id: string): string =>
  `${CommentEngineEndpoints.REST_BASE}/unpin/${encodeURIComponent(String(id).trim())}`;
}
