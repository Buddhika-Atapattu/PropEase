// Path: src/app/components/shared/notification/notification.ts
// =============================================================================
// NotificationComponent (NotificationCenterService compatible)
// =============================================================================

import { isPlatformBrowser, CommonModule } from "@angular/common";
import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from "@angular/core";

import { MatBadgeModule } from "@angular/material/badge";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule, MatMenuTrigger } from "@angular/material/menu";

import { Observable, Subject, fromEvent, of, timer } from "rxjs";
import { catchError, distinctUntilChanged, map, startWith, switchMap, take, takeUntil } from "rxjs/operators";

import { Router } from "@angular/router";

import { AuthService } from "../../../services/auth/auth.service";
import { NotificationDialogComponent } from "../../dialogs/notificationBar/notificationBar.component";

import { NotificationCenterService } from "../../../services/notifications/notification-center.service";
import { NotificationRouteMapService } from "../../../services/notifications/notification-route-map.service";

import type {
  NotificationInboxItemDto,
  NotificationAudience,
  NotificationLoadFilters,
} from "../../../types/notifications/notification.types";

import type { Role } from "../../../services/auth/user.contract";
import type { NotificationScope, NotificationPriorityScope } from "../../../services/notifications/notification-socket.service";

@Component({
  selector: "app-notification",
  standalone: true,
  imports: [
    CommonModule,
    MatMenuModule,
    MatIconModule,
    MatBadgeModule,
    MatButtonModule,
    NotificationDialogComponent,
  ],
  templateUrl: "./notification.html",
  styleUrls: ["./notification.scss"],
})
export class NotificationComponent implements OnInit, OnDestroy {
  @ViewChild("menuTrigger", { static: false }) public menuTrigger!: MatMenuTrigger;
  @ViewChild(NotificationDialogComponent, { static: true }) public notificationBar!: NotificationDialogComponent;

  protected activeTab: "direct" | "overall" = "direct";

  protected connected$!: Observable<boolean>;
  protected unreadCount$!: Observable<number>;

  // ✅ inbox stream comes directly from center (push + load snapshot hydrate)
  protected inboxItems$!: Observable<NotificationInboxItemDto[]>;

  // Split views
  protected directItems$!: Observable<NotificationInboxItemDto[]>;
  protected overallItems$!: Observable<NotificationInboxItemDto[]>;

  protected isLoggedIn = false;

  private readonly destroy$ = new Subject<void>();
  private readonly isBrowser: boolean;

  // Auth context
  private myUserId = "";
  private myUsername = "";
  private myRole: Role = "user";
  private myTeamCodes: string[] = [];

  // Query defaults for refresh
  private readonly scope: NotificationScope = "user";
  private readonly priorityScope: NotificationPriorityScope = "all";
  private readonly loadLimit: number = 30;

  public constructor(
    private readonly notify: NotificationCenterService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly notificationRouter: NotificationRouteMapService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  public ngOnInit(): void {
    // -------------------------------------------------------------------------
    // Auth context
    // -------------------------------------------------------------------------
    this.isLoggedIn = this.auth.isUserLoggedIn;

    const me = this.auth.getLoggedUser;
    this.myUserId = this.safeStr((me as unknown as { userId?: string })?.userId);
    this.myUsername = this.safeStr((me as unknown as { username?: string })?.username);
    this.myRole = ((me as unknown as { role?: Role })?.role ?? "user") as Role;
    this.myTeamCodes = this.safeArrStr((me as unknown as { teamCodes?: string[] })?.teamCodes);

    // -------------------------------------------------------------------------
    // WS connection + unread count (live)
    // -------------------------------------------------------------------------
    this.connected$ = this.notify.onConnected$();
    this.unreadCount$ = this.notify.unreadCount$().pipe(startWith(0));

    // -------------------------------------------------------------------------
    // Inbox list stream (center managed)
    // -------------------------------------------------------------------------
    this.inboxItems$ = this.notify.notifications$();

    // -------------------------------------------------------------------------
    // Split views using NEW audience model
    // -------------------------------------------------------------------------
    this.directItems$ = this.inboxItems$.pipe(
      map((list) => list.filter((x) => this.isDirectToMe(x?.notification?.audiences ?? [])))
    );

    this.overallItems$ = this.inboxItems$.pipe(
      map((list) => list.filter((x) => this.isOverallVisibleToAdmin(x?.notification?.audiences ?? [])))
    );

    // -------------------------------------------------------------------------
    // Initial load (WS-first, REST fallback inside center)
    // -------------------------------------------------------------------------
    this.refreshOnce("init");

    // -------------------------------------------------------------------------
    // WS: on new notification => refresh list snapshot
    // - sound handled inside NotificationCenterService push binding
    // -------------------------------------------------------------------------
    this.notify
      .onNew(false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.refreshOnce("push_new"),
        error: (err: unknown) => {
          console.error(`[Error:] [NotificationComponent] onNew stream error: ${this.errMsg(err)}\n`);
        },
      });

    // -------------------------------------------------------------------------
    // Visibility-aware polling fallback (30s visible, 3min hidden)
    // -------------------------------------------------------------------------
    if (this.isBrowser) {
      const visible$ = fromEvent(document, "visibilitychange").pipe(
        map(() => document.visibilityState === "visible"),
        startWith(document.visibilityState === "visible"),
        distinctUntilChanged()
      );

      visible$
        .pipe(
          switchMap((isVisible) => {
            const intervalMs = isVisible ? 30_000 : 180_000;
            return timer(intervalMs, intervalMs).pipe(map(() => undefined));
          }),
          switchMap(() => this.refresh$()),
          takeUntil(this.destroy$)
        )
        .subscribe();
    }
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Refresh when menu opens */
  protected onOpenMenu(): void {
    this.refreshOnce("menu_open");
  }

  protected setTab(tab: "direct" | "overall", ev?: MouseEvent): void {
    ev?.stopPropagation();
    this.activeTab = tab;
  }

  protected async markOneRead(item: NotificationInboxItemDto, ev?: MouseEvent): Promise<void> {
    ev?.stopPropagation();
    ev?.preventDefault();

    try {
      const ok = await this.notificationRouter.navigateByTarget(item.notification.target);

      const inboxId = this.safeStr((item as unknown as { inboxId?: string })?.inboxId);
      if (!inboxId) {
        if (ok) this.closeMenu();
        return;
      }

      this.notify.markRead$(inboxId).pipe(take(1)).subscribe({
        next: () => {
          this.refreshOnce("mark_one");
          if (ok) this.closeMenu();
        },
        error: (err: unknown) => {
          console.error(`[Error:] [NotificationComponent] markRead failed: ${this.errMsg(err)}\n`);
        },
      });
    } catch (err: unknown) {
      console.error(`[Error:] [NotificationComponent] navigate/markOneRead failed: ${this.errMsg(err)}\n`);
    }
  }

  protected markAllAsRead(): void {
    this.notify.markAllRead$().pipe(take(1)).subscribe({
      next: () => this.refreshOnce("mark_all"),
      error: (err: unknown) => {
        console.error(`[Error:] [NotificationComponent] markAllRead failed: ${this.errMsg(err)}\n`);
      },
    });
  }

  protected iconFor(item: NotificationInboxItemDto): string {
    const sev = this.safeStr((item?.notification as unknown as { severity?: string })?.severity);
    switch (sev) {
      case "success":
        return "check_circle";
      case "warning":
        return "warning";
      case "error":
        return "error";
      default:
        return "notifications";
    }
  }

  protected viewAllNotifications(): void {
    if (!this.isLoggedIn) return;
    this.closeMenu();
    this.router.navigate(["/dashboard/notifications/all-notifications"]).catch(() => {});
  }

  protected trackById(_: number, item: NotificationInboxItemDto): string {
    const inboxId = this.safeStr((item as unknown as { inboxId?: string })?.inboxId);
    if (inboxId) return inboxId;

    const notifId = this.safeStr((item?.notification as unknown as { notificationId?: string })?.notificationId);
    return notifId || String(_);
  }

  protected canShowOverallTab(): boolean {
    return this.myRole === "admin";
  }

  private closeMenu(): void {
    this.menuTrigger?.closeMenu();
  }

  // ---------------------------------------------------------------------------
  // Refresh helpers (new system)
  // ---------------------------------------------------------------------------

  private refreshOnce(reason: "init" | "push_new" | "menu_open" | "mark_one" | "mark_all"): void {
    this.refresh$().pipe(take(1)).subscribe({
      next: () => undefined,
      error: (err: unknown) => {
        console.error(`[Error:] [NotificationComponent] refresh failed (${reason}): ${this.errMsg(err)}\n`);
      },
    });
  }

  private refresh$(): Observable<void> {
    if (!this.isLoggedIn) return of(undefined);

    const filters: NotificationLoadFilters = {};

    // ✅ hydrate center inbox + counts
    return this.notify.load$({
      scope: this.scope,
      priorityScope: this.priorityScope,
      page: 1,
      limit: this.loadLimit,
      filters,
    }).pipe(
      catchError(() => of(undefined)),
      map(() => undefined),
    );
  }

  // ---------------------------------------------------------------------------
  // Audience matching (use your union safely)
  // ---------------------------------------------------------------------------

  private isDirectToMe(audiences: ReadonlyArray<NotificationAudience>): boolean {
    if (!Array.isArray(audiences) || audiences.length === 0) return false;

    for (const a of audiences) {
      switch (a.mode) {
        case "Company":
          return true;

        case "Role": {
          const role = this.safeStr((a as unknown as { role?: string })?.role);
          if (role && role === this.myRole) return true;
          break;
        }

        case "Team": {
          const teamCode = this.safeStr((a as unknown as { teamCode?: string })?.teamCode);
          if (teamCode && this.myTeamCodes.includes(teamCode)) return true;
          break;
        }

        case "User": {
          const userId = this.safeStr((a as unknown as { userId?: string })?.userId);
          const username = this.safeStr((a as unknown as { username?: string })?.username);

          if (this.myUserId && userId && userId === this.myUserId) return true;
          if (this.myUsername && username && username === this.myUsername) return true;
          break;
        }

        default:
          break;
      }
    }

    return false;
  }

  private isOverallVisibleToAdmin(audiences: ReadonlyArray<NotificationAudience>): boolean {
    if (!this.canShowOverallTab()) return false;
    return !this.isDirectToMe(audiences);
  }

  // ---------------------------------------------------------------------------
  // Small safe helpers
  // ---------------------------------------------------------------------------

  private safeStr(v: unknown): string {
    return typeof v === "string" ? v.trim() : "";
  }

  private safeArrStr(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.filter((x) => typeof x === "string").map((x) => x.trim()).filter((x) => !!x);
  }

  private errMsg(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err ?? "unknown_error");
  }
}
