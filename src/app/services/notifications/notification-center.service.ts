// Path: src/app/services/notifications/notification-center.service.ts

import { isPlatformBrowser } from "@angular/common";
import { Inject, Injectable, OnDestroy, PLATFORM_ID } from "@angular/core";
import { Observable, ReplaySubject, Subject, Subscription } from "rxjs";

import { NotificationRestApiService, type NotificationInboxLoadResult, type NotificationInboxCountResult, type NotificationInboxMutationResult } from "./notification-rest-api.service";
import { NotificationSocketService } from "./notification-socket.service";
import { NotificationRouteMapService } from "./notification-route-map.service";

import type { NotificationInboxItemDto, NotificationLoadFilters, NotificationLoadRequest, NotificationTarget } from "../../types/notifications/notification.types";
import type { NotifyNewPayload, NotifyPatchPayload, NotifyCountPayload, NotifyBulkPayload } from "../../types/notifications/notification.ws.types";

/* =============================================================================
 * NotificationCenterService (Facade / Centraliser)
 * -----------------------------------------------------------------------------
 * 01) Introduction to the class and its usage
 * - This is the SINGLE entry-point for Notifications in the Angular app.
 * - It centralizes:
 *    (a) REST inbox operations (load/count/read/archive)
 *    (b) WebSocket live events (new/patch/count/bulk)
 *    (c) actionKey route resolving + safe navigation
 *    (d) sound playback when a notification event is received
 *
 * 02) Important matters
 * - SSR/Electron-safe: audio + socket start only in browser runtime.
 * - Never throws to UI on socket events; it emits safe streams.
 * - Sound is user-configurable and can be muted globally.
 *
 * 03) Why we make this class
 * - So your feature modules import/DI ONLY ONE service instead of 3–4.
 * - So sound policy is enforced in one place (easy to maintain + audit).
 *
 * Security note (ISO/IEC 27001 / 27002 mindset):
 * - This class does NOT trust inbound WS payloads blindly for navigation.
 * - Navigation uses your deterministic route map resolver.
 * - Sound plays are throttled to prevent event-flood abuse UX.
 * ============================================================================= */

export type NotificationSoundMode =
  | "off"          // never play sound
  | "on_new_only"  // play only on notify:new
  | "on_any";      // play on new/patch/bulk as well (NOT recommended)

export interface NotificationSoundConfig {
  enabled: boolean;
  mode: NotificationSoundMode;

  /**
   * Expected: a valid browser URL.
   * Recommended: "assets/sounds/notify.mp3"
   */
  src: string;

  /**
   * Expected: 0..1
   * Default: 0.8
   */
  volume: number;

  /**
   * Expected: a minimum gap between plays (ms)
   * Default: 1200ms
   */
  throttleMs: number;
}

@Injectable({ providedIn: "root" })
export class NotificationCenterService implements OnDestroy {
  private readonly isBrowser: boolean;

  // ---------------------------------------------------------------------------
  // Live streams re-exposed by the facade
  // ---------------------------------------------------------------------------

  private readonly wsNew$ = new Subject<NotifyNewPayload>();
  private readonly wsPatch$ = new Subject<NotifyPatchPayload>();
  private readonly wsBulk$ = new Subject<NotifyBulkPayload>();
  private readonly wsCount$ = new ReplaySubject<NotifyCountPayload>(1);

  private readonly wsConnected$ = new ReplaySubject<boolean>(1);

  // ---------------------------------------------------------------------------
  // Audio policy
  // ---------------------------------------------------------------------------

  private soundCfg: NotificationSoundConfig = {
    enabled: true,
    mode: "on_new_only",
    src: "public/sounds/notification.mp3",
    volume: 0.8,
    throttleMs: 1200
  };

  private audioEl: HTMLAudioElement | null = null;
  private lastSoundAt = 0;

  // ---------------------------------------------------------------------------
  // Internal subscriptions
  // ---------------------------------------------------------------------------

  private subs = new Subscription();
  private started = false;

  constructor(
    private readonly rest: NotificationRestApiService,
    private readonly socket: NotificationSocketService,
    private readonly routeMap: NotificationRouteMapService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    // initial state
    this.wsConnected$.next(false);

    // Bridge socket streams into facade streams (one place to attach sound logic)
    this.bindSocketStreams();
  }

  /* ========================================================================== */
  /* 04) Public API — WebSocket lifecycle                                       */
  /* ========================================================================== */

  /**
   * Start Notification WebSocket and activate sound policy.
   *
   * @param token
   * - Expected: auth token string used by backend socket auth (optional if your backend doesn't require it)
   *
   * Usage hint:
   * - Call once after login OR after you obtain guard/ws token.
   *
   * Keep in mind:
   * - This does nothing on SSR.
   * - Safe to call multiple times.
   */
  public async start(token?: string): Promise<void> {
    if (!this.isBrowser) return;

    if (this.started) {
      // if already started, still ensure socket connected
      await this.socket.start(token);
      return;
    }

    this.started = true;

    await this.socket.start(token);

    // Ensure audio is prepared (browser only)
    this.ensureAudioPrepared();
  }

  /**
   * Stop Notification WebSocket and clear runtime state.
   *
   * Keep in mind:
   * - Does not destroy REST; only stops socket + live listening.
   */
  public stop(): void {
    this.socket.stop();
    this.wsConnected$.next(false);
    this.started = false;
  }

  public onConnected$(): Observable<boolean> {
    return this.wsConnected$.asObservable();
  }

  /* ========================================================================== */
  /* 04) Public API — WebSocket streams                                          */
  /* ========================================================================== */

  public onNew$(): Observable<NotifyNewPayload> {
    return this.wsNew$.asObservable();
  }

  public onPatch$(): Observable<NotifyPatchPayload> {
    return this.wsPatch$.asObservable();
  }

  public onBulk$(): Observable<NotifyBulkPayload> {
    return this.wsBulk$.asObservable();
  }

  public onCount$(): Observable<NotifyCountPayload> {
    return this.wsCount$.asObservable();
  }

  /* ========================================================================== */
  /* 04) Public API — REST passthrough                                           */
  /* ========================================================================== */

  /**
   * Load inbox using REST.
   *
   * @param request
   * - Expected: NotificationLoadRequest (username + page + limit + optional filters)
   */
  public loadInbox$(request: NotificationLoadRequest): Observable<NotificationInboxLoadResult> {
    return this.rest.loadInbox$(request);
  }

  /**
   * Count inbox using REST.
   *
   * @param filters
   * - Expected: NotificationLoadFilters
   */
  public countInbox$(filters: NotificationLoadFilters): Observable<NotificationInboxCountResult> {
    return this.rest.countInbox$(filters);
  }

  /**
   * Mark a single inbox item as read.
   *
   * @param inboxId
   * - Expected: NotificationInboxItemDto.inboxId (string)
   */
  public markRead$(inboxId: string): Observable<NotificationInboxMutationResult> {
    return this.rest.markRead$(inboxId);
  }

  /**
   * Mark all inbox items as read.
   */
  public markAllRead$(): Observable<NotificationInboxMutationResult> {
    return this.rest.markAllRead$();
  }

  /**
   * Archive a single inbox item.
   *
   * @param inboxId
   * - Expected: NotificationInboxItemDto.inboxId (string)
   */
  public archiveOne$(inboxId: string): Observable<NotificationInboxMutationResult> {
    return this.rest.archiveOne$(inboxId);
  }

  /* ========================================================================== */
  /* 04) Public API — navigation helpers                                         */
  /* ========================================================================== */

  /**
   * Navigate using NotificationTarget (actionKey + params).
   *
   * @param target
   * - Expected: NotificationTarget from backend payload
   *
   * Keep in mind:
   * - Uses your deterministic route-map resolver (priority aware).
   * - Safe in SSR (no-op).
   */
  public async navigateByTarget(target: NotificationTarget | null | undefined): Promise<boolean> {
    return await this.routeMap.navigateByTarget(target);
  }

  /**
   * Convenience: navigate by inbox item (if it contains target).
   *
   * @param item
   * - Expected: NotificationInboxItemDto
   */
  public async navigateByInboxItem(item: NotificationInboxItemDto | null | undefined): Promise<boolean> {
    const target = item?.notification?.target ?? null;
    return await this.navigateByTarget(target);
  }

  /* ========================================================================== */
  /* 04) Public API — sound controls                                             */
  /* ========================================================================== */

  /**
   * Update sound configuration centrally.
   *
   * @param cfg
   * - Expected: Partial NotificationSoundConfig
   *
   * Usage hint:
   * - Call from a Settings page (toggle sound, volume slider, etc.).
   *
   * Keep in mind:
   * - This does not persist; persistence should be done by caller (localStorage/user preferences).
   */
  public setSoundConfig(cfg: Partial<NotificationSoundConfig>): void {
    this.soundCfg = this.mergeSoundConfig(this.soundCfg, cfg);

    if (!this.isBrowser) return;

    // prepare with new src/volume
    this.ensureAudioPrepared(true);
  }

  public getSoundConfig(): NotificationSoundConfig {
    return { ...this.soundCfg };
  }

  /**
   * Immediate test play (useful in Settings UI).
   */
  public testSound(): void {
    this.playSoundSafe("manual_test");
  }

  /* ========================================================================== */
  /* Lifecycle                                                                   */
  /* ========================================================================== */

  public ngOnDestroy(): void {
    try {
      this.subs.unsubscribe();
      this.stop();
      this.audioEl = null;
    } catch {
      // ignore
    }
  }

  /* ========================================================================== */
  /* Internals — socket binding + sound policy                                   */
  /* ========================================================================== */

  private bindSocketStreams(): void {
    // Connection state
    this.subs.add(
      this.socket.onConnected$().subscribe({
        next: (isOn) => this.wsConnected$.next(isOn),
        error: () => this.wsConnected$.next(false)
      })
    );

    // notify:new
    this.subs.add(
      this.socket.onNew$().subscribe({
        next: (p) => {
          this.wsNew$.next(p);

          if (p.count) this.wsCount$.next(p.count);

          // Sound policy: by default play only on NEW
          this.playSoundSafe("notify:new");
        }
      })
    );

    // notify:patch
    this.subs.add(
      this.socket.onPatch$().subscribe({
        next: (p) => {
          this.wsPatch$.next(p);

          if (p.count) this.wsCount$.next(p.count);

          if (this.soundCfg.mode === "on_any") {
            this.playSoundSafe("notify:patch");
          }
        }
      })
    );

    // notify:bulk
    this.subs.add(
      this.socket.onBulk$().subscribe({
        next: (p) => {
          this.wsBulk$.next(p);

          if (p.count) this.wsCount$.next(p.count);

          if (this.soundCfg.mode === "on_any") {
            this.playSoundSafe("notify:bulk");
          }
        }
      })
    );

    // notify:count
    this.subs.add(
      this.socket.onCount$().subscribe({
        next: (p) => this.wsCount$.next(p)
      })
    );
  }

  /**
   * Play sound respecting:
   * - enabled flag
   * - mode flag
   * - throttle window
   * - SSR safety
   */
  private playSoundSafe(reason: string): void {
    if (!this.isBrowser) return;
    if (!this.soundCfg.enabled) return;

    if (this.soundCfg.mode === "off") return;

    // Only new-only mode means ignore non-new reasons
    if (this.soundCfg.mode === "on_new_only" && reason !== "notify:new" && reason !== "manual_test") {
      return;
    }

    const now = Date.now();
    const gap = now - this.lastSoundAt;

    if (gap < this.soundCfg.throttleMs) {
      return;
    }

    this.lastSoundAt = now;

    try {
      this.ensureAudioPrepared();
      if (!this.audioEl) return;

      this.audioEl.currentTime = 0;
      void this.audioEl.play().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err ?? "unknown");
        // eslint-disable-next-line no-console
        console.warn(`[Warning:] [NotificationCenterService] sound play blocked: ${msg}\n`);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err ?? "unknown");
      // eslint-disable-next-line no-console
      console.error(`[Error:] [NotificationCenterService] sound play failed: ${msg}\n`);
    }
  }

  /**
   * Prepare audio element lazily.
   *
   * @param force
   * - Expected: true to re-create element (src/volume changed)
   */
  private ensureAudioPrepared(force?: boolean): void {
    if (!this.isBrowser) return;

    if (!force && this.audioEl) {
      // update volume only
      this.audioEl.volume = this.clamp01(this.soundCfg.volume);
      return;
    }

    const src = this.safeString(this.soundCfg.src);
    if (!src) return;

    try {
      const a = new Audio(src);
      a.preload = "auto";
      a.volume = this.clamp01(this.soundCfg.volume);
      this.audioEl = a;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err ?? "unknown");
      // eslint-disable-next-line no-console
      console.error(`[Error:] [NotificationCenterService] audio init failed: ${msg}\n`);
      this.audioEl = null;
    }
  }

  private mergeSoundConfig(base: NotificationSoundConfig, patch: Partial<NotificationSoundConfig>): NotificationSoundConfig {
    const out: NotificationSoundConfig = { ...base };

    if (typeof patch.enabled === "boolean") out.enabled = patch.enabled;

    const mode = this.safeString(patch.mode) as NotificationSoundMode;
    if (mode === "off" || mode === "on_new_only" || mode === "on_any") out.mode = mode;

    const src = this.safeString(patch.src);
    if (src) out.src = src;

    if (typeof patch.volume === "number") out.volume = this.clamp01(patch.volume);

    if (typeof patch.throttleMs === "number" && Number.isFinite(patch.throttleMs) && patch.throttleMs >= 0) {
      out.throttleMs = Math.floor(patch.throttleMs);
    }

    return out;
  }

  private clamp01(v: number): number {
    if (!Number.isFinite(v)) return 0.8;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  private safeString(v: unknown): string {
    if (typeof v === "string") return v.trim();
    if (typeof v === "number") return String(v);
    return "";
  }
}
