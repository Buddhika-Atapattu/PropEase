// Path: src/components/user-info-panel/user-info-panel.component.ts
// =============================================================================
// UserInfoPanelComponent (NotificationCenterService aligned + SSR-safe)
// -----------------------------------------------------------------------------
// 01) Introduction
// - Small user header panel showing current user + unread notification count.
// - Allows profile navigation + logout.
//
// 02) Important matters
// - SSR-safe: NEVER touch window/document/localStorage unless isBrowser.
// - Logout should delegate to AuthService.clearCredentials() (single source of truth).
//
// 03) Why we make these changes
// - Fix Angular metadata key: `styleUrls` (not `styleUrl`)
// - Fix unreadCount$ typing: counts$() returns NotificationCountResponse, not Observable<...>|null mismatch.
// - Avoid duplicate cleanup: AuthService.clearCredentials already handles storage + socket + notification stop.
//
// 04) Parameter notes
// - closePanel: emits boolean to parent to close overlay.
//
// 05) Usage hint
// <app-user-info-panel (closePanel)="..." />
//
// 06) Keep in mind
// - If you want to show only unread number, use unreadCountNumber$ derived stream.
// =============================================================================

import { CommonModule, isPlatformBrowser } from "@angular/common";
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
} from "@angular/core";
import { Router } from "@angular/router";
import { Subscription, type Observable } from "rxjs";
import { map } from "rxjs/operators";

import { APIsService, User } from "../../services/APIs/apis.service";
import { AuthService } from "../../services/auth/auth.service";
import { WindowsRefService } from "../../services/windowRef/windowRef.service";
import { NotificationCenterService } from "../../services/notifications/notification-center.service";

import type { NotificationCountResponse } from "../../types/notifications/notification.types";

@Component({
  selector: "app-user-info-panel",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./user-info-panel.component.html",
  styleUrls: ["./user-info-panel.component.scss"], // ✅ FIX: styleUrls (plural)
})
export class UserInfoPanelComponent implements OnInit, OnDestroy {
  @Output() public closePanel = new EventEmitter<boolean>();

  protected mode: boolean | null = null;
  protected readonly isBrowser: boolean;

  private modeSub: Subscription | null = null;

  protected user: User | null = null;

  /**
   * Full counts stream (total + unread).
   *
   * Expected by templates that show badge etc.
   */
  protected counts$!: Observable<NotificationCountResponse>;

  /**
   * Convenience stream if template wants just unread as a number.
   */
  protected unreadCountNumber$!: Observable<number>;

  public constructor(
    private readonly windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) platformId: object,
    protected readonly authService: AuthService,
    protected readonly router: Router,
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly apiService: APIsService,
    private readonly notificationService: NotificationCenterService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.user = this.authService.getLoggedUser;
  }

  public ngOnInit(): void {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe({
        next: (val) => (this.mode = val),
        error: () => undefined,
      });
    }

    // ✅ Center service already exposes reactive counts
    this.counts$ = this.notificationService.counts$();
    this.unreadCountNumber$ = this.counts$.pipe(map((c) => c.unread));
  }

  public ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.modeSub = null;
  }

  @HostListener("document:click", ["$event"])
  public onDocumentClick(event: Event): void {
    const target = event.target as Node | null;
    const clickedInside = !!target && this.elementRef.nativeElement.contains(target);

    if (!clickedInside) {
      this.close(false);
    }
  }

  /**
   * Logout
   * ------
   * Why:
   * - AuthService.clearCredentials is your canonical logout flow:
   *   clears tokens, storage, socket disconnect, notification stop, and flags.
   *
   * Keep in mind:
   * - Must guard browser-only actions.
   */
  protected async logout(): Promise<void> {
    try {
      await this.authService.clearCredentials(); // ✅ single source of truth

      if (this.isBrowser) {
        // Best-effort cookie cleanup (only if you still use these cookies)
        document.cookie = "username=; Max-Age=0; path=/";
        document.cookie = "password=; Max-Age=0; path=/";
      }

      this.close(false);
      await this.router.navigate(["/login"]);
      return;
    } catch (err: unknown) {
      console.error("[Error:] [UserInfoPanelComponent.logout] ", err, "\n");
      this.close(false);
    }
  }

  /**
   * Open profile
   * ------------
   * - Generates token and navigates to user profile.
   */
  protected async open(): Promise<void> {
    try {
      if (!this.user?.username) {
        throw new Error("Invalid user!");
      }

      const res = await this.apiService.generateToken(this.user.username);

      if (!res.success || res.status !== "success") {
        throw new Error("Failed to generate token");
      }

      const token = this.apiService.extractTokenFromMsg(res);
      if (!token) {
        throw new Error("Invalid token!");
      }

      await this.router.navigate(["/dashboard/users/user-profile", token]);
      return;
    } catch (error: unknown) {
      console.error("[Error:] [UserInfoPanelComponent.open] ", error, "\n");
    } finally {
      this.close(false);
    }
  }

  protected close(closed: boolean): void {
    this.closePanel.emit(closed);
  }
}
