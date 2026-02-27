// Path: src/app/services/notifications/notification-route-map.service.ts

import { isPlatformBrowser } from "@angular/common";
import { Inject, Injectable, PLATFORM_ID } from "@angular/core";
import { Router, type UrlTree, type Route, type Routes } from "@angular/router";
import { APIsService } from "../APIs/apis.service";

import { routes } from "../../app.routes";

import type { NotificationTarget } from "../../types/notifications/notification.types";
import type { MSG } from "../../types/api-message.types";

/* ============================================================================
 * NotificationRouteMapService
 * ----------------------------------------------------------------------------
 * PURPOSE
 * - Single deterministic resolver for:
 *      NotificationTarget.actionKey + NotificationTarget.params
 *   -> best matching Angular route (based on route metadata)
 *
 * WHY THIS EXISTS
 * - Backend emits actionKey + params (not raw routes)
 * - Frontend selects safest landing route:
 *     ✅ VIEW pages (priority 100)
 *     ✅ DASHBOARD pages (priority 70)
 *     ✅ LIST pages (priority 40)
 *     ✅ NOTIFICATION CENTER fallback (priority 10)
 *
 * SECURITY / RELIABILITY RULES
 * - Never throws (navigation should not crash the app).
 * - SSR safe: navigation does nothing on server.
 * - Token-required actions (user account) are resolved with async token generation.
 *
 * SPECIAL CASE
 * - Your user profile route needs a token:
 *     "user-profile/:token"
 *   Token param name is EXACTLY: "token"
 *   Token is generated using backend API: apiService.generateToken(username)
 * ========================================================================== */

type RouteDataMeta = {
  actionKeys?: string[];
  actionKeyPriority?: number;
  requiredParams?: string[];
};

type Candidate = {
  actionKey: string;
  priority: number;
  requiredParams: string[];
  fullSegments: string[];
};

@Injectable({ providedIn: "root" })
export class NotificationRouteMapService {
  private readonly isBrowser: boolean;

  /**
   * ActionKeys that REQUIRE generating a user-account token before navigation.
   * These will be routed to:
   *   user-profile/:token
   * where token is generated from params.username.
   */
  private readonly UserAccountTokenKeySet: Set<string> = new Set([
    "user:account.created",
    "user:account.updated",
    "user:account.activated",
    "user:account.deactivated",
    "user:account.password.reset",
    "user:account.password.changed",
    "user:account.locked",
    "user:account.unlocked",
    "user:account.role.changed",
    "user:profile.updated",
  ]);

  /**
   * Index:
   *  actionKey -> candidates (sorted later by chooseBestCandidate)
   */
  private readonly index = new Map<string, Candidate[]>();

  /**
   * Default fallback route if nothing matches.
   * Change this ONLY if you rename the notifications center route.
   */
  private readonly fallbackSegments: string[] = [
    "dashboard",
    "notifications",
    "all-notifications",
  ];

  constructor(
    private readonly router: Router,
    private readonly apiService: APIsService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Build the index once (routes are static)
    this.buildIndex();
  }

  /* ==========================================================================
   * PUBLIC API
   * ======================================================================== */

  /**
   * Resolve a NotificationTarget into a UrlTree (SYNC).
   *
   * NOTE:
   * - This method does NOT call HTTP APIs.
   * - If you need token-required routes, use resolveTargetToUrlTreeAsync().
   */
  public resolveTargetToUrlTree(
    target: NotificationTarget | undefined | null
  ): UrlTree {
    try {
      // 1) Legacy route string fallback
      const legacy = this.safeString(target?.route);
      if (legacy) {
        return this.router.parseUrl(legacy);
      }

      // 2) Canonical path: actionKey + params
      const actionKey = this.safeString(target?.actionKey);
      if (!actionKey) {
        return this.router.createUrlTree(this.fallbackSegments);
      }

      const params = this.safeParams(target?.params);

      const candidates = this.index.get(actionKey) ?? [];
      const chosen = this.chooseBestCandidate(candidates, params);

      if (!chosen) {
        return this.router.createUrlTree(this.fallbackSegments);
      }

      const segs = this.applyParamsToSegments(chosen.fullSegments, params);
      return this.router.createUrlTree(segs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      // eslint-disable-next-line no-console
      console.error(
        `[Error:] [NotificationRouteMapService] resolveTargetToUrlTree failed: ${msg}\n`
      );
      return this.router.createUrlTree(this.fallbackSegments);
    }
  }

  /**
   * Resolve a NotificationTarget into a UrlTree (ASYNC).
   *
   * WHY ASYNC:
   * - Some actionKeys (UserAccountTokenKeySet) require generating token via API.
   *
   * RESULT:
   * - For user-account actionKeys, navigates to:
   *     user-profile/:token
   *   where token param name is EXACTLY "token".
   */
  public async resolveTargetToUrlTreeAsync(
    target: NotificationTarget | undefined | null
  ): Promise<UrlTree> {
    try {
      // 1) Legacy route string fallback
      const legacy = this.safeString(target?.route);
      if (legacy) {
        return this.router.parseUrl(legacy);
      }

      // 2) Canonical path: actionKey + params
      const actionKey = this.safeString(target?.actionKey);
      if (!actionKey) {
        return this.router.createUrlTree(this.fallbackSegments);
      }

      const params = this.safeParams(target?.params);

      const candidates = this.index.get(actionKey) ?? [];
      const chosen = this.chooseBestCandidate(candidates, params);

      if (!chosen) {
        return this.router.createUrlTree(this.fallbackSegments);
      }

      // ---------------------------------------------------------------------
      // 🔐 USER ACCOUNT TOKEN WIRING
      // ---------------------------------------------------------------------
      if (this.UserAccountTokenKeySet.has(actionKey)) {
        // Expecting backend payload:
        //  target.params.username = "<username>"
        const username = this.extractUsernameFromParams(params);

        if (username) {
          const token = await this.generateUserToken(username);

          // Your route is: "user-profile/:token"
          // So we MUST inject params.token for path replacement.
          const withTokenParams: Record<string, unknown> = {
            ...params,
            token,
          };

          const segs = this.applyParamsToSegments(
            chosen.fullSegments,
            withTokenParams
          );

          return this.router.createUrlTree(segs);
        }

        // If username missing, do not crash navigation.
        // eslint-disable-next-line no-console
        console.warn(
          `[Warning:] [NotificationRouteMapService] User-account actionKey needs params.username but it was missing. actionKey=${actionKey}\n`
        );
      }

      // Normal route build (no token required)
      const segs = this.applyParamsToSegments(chosen.fullSegments, params);
      return this.router.createUrlTree(segs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      // eslint-disable-next-line no-console
      console.error(
        `[Error:] [NotificationRouteMapService] resolveTargetToUrlTreeAsync failed: ${msg}\n`
      );
      return this.router.createUrlTree(this.fallbackSegments);
    }
  }

  /**
   * Navigate based on NotificationTarget.
   * - Safe: does nothing on SSR.
   * - Uses async resolver to support token generation.
   */
  public async navigateByTarget(
    target: NotificationTarget | undefined | null
  ): Promise<boolean> {
    if (!this.isBrowser) return false;

    try {
      const tree = await this.resolveTargetToUrlTreeAsync(target);
      return await this.router.navigateByUrl(tree);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      // eslint-disable-next-line no-console
      console.error(
        `[Error:] [NotificationRouteMapService] navigateByTarget failed: ${msg}\n`
      );
      return false;
    }
  }

  /**
   * Debug helper: list all candidates registered for an actionKey.
   */
  public debugCandidates(actionKey: string): Candidate[] {
    const k = this.safeString(actionKey);
    return this.index.get(k) ?? [];
  }

  /* ==========================================================================
   * INDEX BUILD
   * ======================================================================== */

  private buildIndex(): void {
    this.index.clear();
    this.walkRoutes(routes as Routes, []);
  }

  /**
   * Walk Routes recursively and register routes that declare route.data.actionKeys.
   * - redirectTo routes are ignored (not real landing pages).
   * - wildcard ** ignored.
   */
  private walkRoutes(list: Routes, parentSegments: string[]): void {
    for (const r of list ?? []) {
      const path = this.safeString(r?.path);

      // Ignore wildcards
      if (path === "**") continue;

      // Ignore redirects
      const redirectTo = this.safeString((r as Route)?.redirectTo);
      if (redirectTo) continue;

      // Build full segments (skip empty path segment)
      const currentSegments =
        path && path !== "" ? [...parentSegments, path] : [...parentSegments];

      // Read metadata from route.data
      const meta = this.readMeta((r as Route)?.data);

      // Register actionKeys on this route
      if (meta.actionKeys && meta.actionKeys.length > 0) {
        this.registerRoute(meta, currentSegments);
      }

      // Recurse children
      const children = (r as Route)?.children;
      if (Array.isArray(children) && children.length > 0) {
        this.walkRoutes(children, currentSegments);
      }
    }
  }

  private readMeta(data: unknown): RouteDataMeta {
    if (!this.isObject(data)) return {};

    const actionKeysRaw = (data as Record<string, unknown>)["actionKeys"];
    const requiredParamsRaw = (data as Record<string, unknown>)["requiredParams"];
    const priorityRaw = (data as Record<string, unknown>)["actionKeyPriority"];

    const actionKeys = Array.isArray(actionKeysRaw)
      ? actionKeysRaw.map((x) => this.safeString(x)).filter((x) => !!x)
      : [];

    const requiredParams = Array.isArray(requiredParamsRaw)
      ? requiredParamsRaw.map((x) => this.safeString(x)).filter((x) => !!x)
      : [];

    const priority = this.safeInt(priorityRaw, 0);

    const out: RouteDataMeta = {};
    if (actionKeys.length > 0) out.actionKeys = actionKeys;
    if (requiredParams.length > 0) out.requiredParams = requiredParams;
    if (priority > 0) out.actionKeyPriority = priority;

    return out;
  }

  private registerRoute(meta: RouteDataMeta, fullSegments: string[]): void {
    const keys = meta.actionKeys ?? [];
    const priority = this.safeInt(meta.actionKeyPriority, 10);
    const required = meta.requiredParams ?? [];

    for (const actionKey of keys) {
      const arr = this.index.get(actionKey) ?? [];

      arr.push({
        actionKey,
        priority,
        requiredParams: required,
        fullSegments,
      });

      this.index.set(actionKey, arr);
    }
  }

  /* ==========================================================================
   * TOKEN GENERATION
   * ======================================================================== */

  /**
   * Generate user token for user-profile routing.
   *
   * IMPORTANT:
   * - Uses safeUsername (trimmed) to call backend.
   * - Throws on invalid token response (caller catches and falls back safely).
   */
  private async generateUserToken(username: string): Promise<string> {
    const safeUsername: string | undefined =
      typeof username === "string" ? username.trim() : undefined;

    if (!safeUsername) {
      throw new Error("Undefined username!");
    }

    const tokenRes: MSG = await this.apiService.generateToken(safeUsername);
    if (!tokenRes.success) {
      throw new Error(tokenRes.message ?? "Failed to make token!");
    }

    const token: string | null = this.apiService.extractTokenFromMsg(tokenRes);
    if (!token) {
      throw new Error("Invalid token!");
    }

    return token.trim();
  }

  /**
   * Extract username from params.
   * Backend contract should send:
   *   params.username = "<username>"
   */
  private extractUsernameFromParams(params: Record<string, unknown>): string {
    const normalized = this.normalizeParamKeys(params);

    // Primary expected key
    const primary = this.safeString(normalized["username"]);
    if (primary) return primary;

    // Optional fallback keys (if older payloads exist)
    const alt1 = this.safeString(normalized["user"]);
    if (alt1) return alt1;

    const alt2 = this.safeString(normalized["uname"]);
    if (alt2) return alt2;

    return "";
  }

  /* ==========================================================================
   * CHOOSING BEST ROUTE
   * ======================================================================== */

  private chooseBestCandidate(
    candidates: Candidate[],
    params: Record<string, unknown>
  ): Candidate | null {
    const usable = candidates.filter((c) =>
      this.hasRequiredParams(c.requiredParams, params)
    );
    if (usable.length === 0) return null;

    usable.sort((a, b) => {
      // 1) priority desc
      if (b.priority !== a.priority) return b.priority - a.priority;

      // 2) more required params desc
      if (b.requiredParams.length !== a.requiredParams.length) {
        return b.requiredParams.length - a.requiredParams.length;
      }

      // 3) longer route path desc
      return b.fullSegments.length - a.fullSegments.length;
    });

    return usable[0] ?? null;
  }

  private hasRequiredParams(
    required: string[],
    params: Record<string, unknown>
  ): boolean {
    const normalized = this.normalizeParamKeys(params);

    for (const key of required ?? []) {
      const v = normalized[key.toLowerCase()];
      const s = this.safeString(v);
      if (!s) return false;
    }

    return true;
  }

  /* ==========================================================================
   * PATH PARAM APPLICATION
   * ======================================================================== */

  /**
   * Converts route segments like:
   *  ["dashboard", "tenant", "view-lease/:leaseID"]
   * into:
   *  ["dashboard", "tenant", "view-lease", "<leaseID value>"]
   *
   * IMPORTANT:
   * - Your routes often contain params in the SAME segment (e.g. "view-lease/:leaseID")
   * - So we split each segment by "/" and replace ":param" tokens.
   */
  private applyParamsToSegments(
    segments: string[],
    params: Record<string, unknown>
  ): string[] {
    const normalized = this.normalizeParamKeys(params);
    const out: string[] = [];

    for (const seg of segments) {
      const parts = this.safeString(seg).split("/").filter((p) => !!p);

      for (const part of parts) {
        if (part.startsWith(":")) {
          const key = part.slice(1).toLowerCase();
          const v = this.safeString(normalized[key]);
          out.push(v);
        } else {
          out.push(part);
        }
      }
    }

    return out.filter((x) => !!this.safeString(x));
  }

  /* ==========================================================================
   * UTILITIES
   * ======================================================================== */

  private safeParams(v: unknown): Record<string, unknown> {
    if (this.isObject(v)) return v;
    return {};
  }

  private isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
  }

  private safeString(v: unknown): string {
    if (typeof v === "string") return v.trim();
    if (typeof v === "number") return String(v);
    return "";
  }

  private safeInt(v: unknown, fallback: number): number {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.floor(n);
  }

  /**
   * Normalize param keys to lowercase for case-insensitive lookup.
   */
  private normalizeParamKeys(params: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    for (const key of Object.keys(params ?? {})) {
      out[key.toLowerCase()] = params[key];
    }

    return out;
  }
}
