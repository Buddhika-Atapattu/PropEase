// Path: src/app/components/shared/notification/notification.ts

import { isPlatformBrowser } from "@angular/common";
import { CommonModule } from "@angular/common";
import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from "@angular/core";

import { MatBadgeModule } from "@angular/material/badge";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule, MatMenuTrigger } from "@angular/material/menu";

import { Observable, Subject, fromEvent, of, timer } from "rxjs";
import { catchError, distinctUntilChanged, map, startWith, switchMap, takeUntil } from "rxjs/operators";

import { Router } from "@angular/router";

import { AuthService } from "../../../services/auth/auth.service";
import { NotificationDialogComponent } from "../../dialogs/notificationBar/notificationBar.component";

// ✅ NEW: single facade import
import { NotificationCenterService } from "../../../services/notifications/notification-center.service";

// ✅ NEW: canonical notification contracts (frontend mirror of backend)
import type {
  NotificationInboxItemDto,
  NotificationLoadRequest,
  NotificationTarget,
} from "../../../types/notifications/notification.types";

/* =============================================================================
 * NotificationComponent (Upgraded to NotificationCenterService integration)
 * -----------------------------------------------------------------------------
 * 01) Introduction to the class and its usage
 * - This is the top-right notification bell UI.
 * - It renders the inbox preview list, unread badge, and supports quick navigation.
 * - It only depends on ONE central facade: NotificationCenterService.
 *
 * 02) Important matters
 * - SSR/Electron safe: no direct DOM usage unless platform is browser.
 * - Uses visibility-aware polling fallback (in case WS misses or disconnects).
 *
 * 03) Why we make this class / why upgrade
 * - Avoid importing multiple notification services per component.
 * - Sound, routing rules, WS streams, REST calls are centralized in NotificationCenterService.
 *
 * ISO/IEC 27001/27002 note:
 * - UI does not “trust” WS payload for navigation directly.
 * - Navigation is resolved via route-map service behind NotificationCenterService.
 * ============================================================================= */

@Component( {
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
  styleUrls: [ "./notification.scss" ],
} )
export class NotificationComponent implements OnInit, OnDestroy {
  @ViewChild( "menuTrigger", { static: false } ) public menuTrigger!: MatMenuTrigger;
  @ViewChild( NotificationDialogComponent, { static: true } ) public notificationBar!: NotificationDialogComponent;

  // UI tabs
  protected activeTab: "direct" | "overall" = "direct";

  // New facade-driven streams
  protected connected$!: Observable<boolean>;
  protected unreadCount$!: Observable<number>;

  // Loaded inbox list (REST snapshot)
  protected inboxItems$!: Observable<NotificationInboxItemDto[]>;

  // Split views
  protected directItems$!: Observable<NotificationInboxItemDto[]>;
  protected overallItems$!: Observable<NotificationInboxItemDto[]>;

  protected isLoggedIn = false;

  private readonly destroy$ = new Subject<void>();
  private readonly isBrowser: boolean;

  // Auth context (stored as strings to avoid TS “no overlap” issues)
  private myUserId = "";
  private myUsername = "";
  private myRole = "";
  private myTeamCodes: string[] = [];

  constructor (
    private readonly notify: NotificationCenterService,
    private readonly auth: AuthService,
    private readonly router: Router,
    @Inject( PLATFORM_ID ) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
  }

  public ngOnInit(): void {
  // -------------------------------------------------------------------------
    // Auth context
    // -------------------------------------------------------------------------
    this.isLoggedIn = this.auth.isUserLoggedIn;

    const me = this.auth.getLoggedUser;
    this.myUserId = this.safeStr( ( me as unknown as { userId?: string; } )?.userId );
    this.myUsername = this.safeStr( ( me as unknown as { username?: string; } )?.username );
    this.myRole = this.safeStr( ( me as unknown as { role?: string; } )?.role );
    this.myTeamCodes = this.safeArrStr( ( me as unknown as { teamCodes?: string[]; } )?.teamCodes );

    // -------------------------------------------------------------------------
    // WS: connection + unread count (live)
    // -------------------------------------------------------------------------
    this.connected$ = this.notify.onConnected$();
    this.unreadCount$ = this.notify.onCount$().pipe(
      map( ( c ) => {
        const n = ( c as unknown as { unread?: number; } )?.unread;
        return typeof n === "number" && Number.isFinite( n ) ? n : 0;
      } ),
      startWith( 0 )
    );

    // -------------------------------------------------------------------------
    // REST: initial inbox snapshot (limit 30)
    // -------------------------------------------------------------------------
    this.inboxItems$ = this.loadInboxStream( { limit: 30 } );

    // -------------------------------------------------------------------------
    // Split views using NEW audience model
    // -------------------------------------------------------------------------
    this.directItems$ = this.inboxItems$.pipe(
      map( ( list ) => list.filter( ( x ) => this.isDirectToMe( x?.notification?.audiences ?? [] ) ) )
    );

    this.overallItems$ = this.inboxItems$.pipe(
      map( ( list ) => list.filter( ( x ) => this.isOverallVisibleToAdmin( x?.notification?.audiences ?? [] ) ) )
    );

    // -------------------------------------------------------------------------
    // WS: on new notification => refresh snapshot + badge auto updates
    // (Sound handled inside NotificationCenterService)
    // -------------------------------------------------------------------------
    this.notify
      .onNew$()
      .pipe( takeUntil( this.destroy$ ) )
      .subscribe( {
        next: () => {
          // Refresh list snapshot silently (inbox list is REST-based)
          this.refreshInboxSnapshot( { limit: 30 } );
        },
        error: ( err ) => {
          // eslint-disable-next-line no-console
          console.error( `[Error:] [NotificationComponent] onNew stream error: ${ this.errMsg( err ) }\n` );
        },
      } );

    // -------------------------------------------------------------------------
    // Visibility-aware polling fallback (30s visible, 3min hidden)
    // -------------------------------------------------------------------------
    if ( this.isBrowser ) {
      const visible$ = fromEvent( document, "visibilitychange" ).pipe(
        map( () => document.visibilityState === "visible" ),
        startWith( document.visibilityState === "visible" ),
        distinctUntilChanged()
      );

      visible$
        .pipe(
          switchMap( ( isVisible ) => {
            const intervalMs = isVisible ? 30_000 : 180_000;
            return timer( intervalMs, intervalMs ).pipe( map( () => undefined ) );
          } ),
          switchMap( () => this.notify.loadInbox$( {
            username: this.myUsername,
            page: 1,
            limit: 30
          } satisfies NotificationLoadRequest ).pipe(
            catchError( () => of( null ) )
          ) ),
          takeUntil( this.destroy$ )
        )
        .subscribe( {
          next: () => {
            // Sync local snapshot after polling
            this.refreshInboxSnapshot( { limit: 30 } );
          },
        } );
    }
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Refresh when menu opens (manual refresh on demand) */
  protected onOpenMenu(): void {
    this.refreshInboxSnapshot( { limit: 30 } );
  }

  protected setTab( tab: "direct" | "overall", ev?: MouseEvent ): void {
    ev?.stopPropagation();
    this.activeTab = tab;
  }

  /**
   * Navigate + mark single notification as read
   *
   * @param item
   * - Expected: NotificationInboxItemDto
   *
   * Keep in mind:
   * - Navigation is resolved via actionKey route map inside NotificationCenterService.
   * - Mark read is performed via REST.
   */
  protected async markOneRead( item: NotificationInboxItemDto, ev?: MouseEvent ): Promise<void> {
    ev?.stopPropagation();
    ev?.preventDefault();

    try {
      const ok = await this.notify.navigateByInboxItem( item );

      const inboxId = this.safeStr( ( item as unknown as { inboxId?: string; } )?.inboxId );
      if ( inboxId ) {
        this.notify.markRead$( inboxId ).pipe( takeUntil( this.destroy$ ) ).subscribe( {
          next: () => {
            this.refreshInboxSnapshot( { limit: 30 } );
            if ( ok ) this.closeMenu();
          },
          error: ( err ) => {
            // eslint-disable-next-line no-console
            console.error( `[Error:] [NotificationComponent] markRead failed: ${ this.errMsg( err ) }\n` );
          },
        } );
      } else {
        if ( ok ) this.closeMenu();
      }
    } catch ( err ) {
      // eslint-disable-next-line no-console
      console.error( `[Error:] [NotificationComponent] navigate/markOneRead failed: ${ this.errMsg( err ) }\n` );
    }
  }

  protected markAllAsRead(): void {
    this.notify.markAllRead$().pipe( takeUntil( this.destroy$ ) ).subscribe( {
      next: () => this.refreshInboxSnapshot( { limit: 30 } ),
      error: ( err ) => {
        // eslint-disable-next-line no-console
        console.error( `[Error:] [NotificationComponent] markAllRead failed: ${ this.errMsg( err ) }\n` );
      },
    } );
  }

  protected iconFor( item: NotificationInboxItemDto ): string {
    const sev = this.safeStr( ( item?.notification as unknown as { severity?: string; } )?.severity );
    switch ( sev ) {
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
    if ( !this.isLoggedIn ) return;
    this.closeMenu();
    this.router.navigate( [ "/dashboard/notifications/all-notifications" ] ).catch( () => {} );
  }

  protected trackById( _: number, item: NotificationInboxItemDto ): string {
    return this.safeStr( ( item as unknown as { inboxId?: string; } )?.inboxId )
      || this.safeStr( ( item?.notification as unknown as { notificationId?: string; } )?.notificationId );
  }

  protected canShowOverallTab(): boolean {
    // Keep as your legacy concept: "overall" is for admin-like roles
    // We store role as string to avoid TS “no overlap” compile issues.
    return this.myRole === "admin";
  }

  private closeMenu(): void {
    this.menuTrigger?.closeMenu();
  }

  // ---------------------------------------------------------------------------
  // REST snapshot helpers
  // ---------------------------------------------------------------------------

  private loadInboxStream( options: { limit: number; } ): Observable<NotificationInboxItemDto[]> {
    if ( !this.isLoggedIn || !this.myUsername ) return of( [] );

    const req: NotificationLoadRequest = {
      username: this.myUsername,
      page: 1,
      limit: options.limit,
    };

    return this.notify.loadInbox$( req ).pipe(
      map( ( res ) => {
        const items = ( res as unknown as { items?: NotificationInboxItemDto[]; } )?.items;
        return Array.isArray( items ) ? items : [];
      } ),
      catchError( () => of( [] ) )
    );
  }

  private refreshInboxSnapshot( options: { limit: number; } ): void {
    // A simple approach: rebind inboxItems$ stream (Angular async pipe will refresh)
    this.inboxItems$ = this.loadInboxStream( options );

    // keep split views in sync
    this.directItems$ = this.inboxItems$.pipe(
      map( ( list ) => list.filter( ( x ) => this.isDirectToMe( x?.notification?.audiences ?? [] ) ) )
    );
    this.overallItems$ = this.inboxItems$.pipe(
      map( ( list ) => list.filter( ( x ) => this.isOverallVisibleToAdmin( x?.notification?.audiences ?? [] ) ) )
    );
  }

  // ---------------------------------------------------------------------------
  // Audience matching (NEW model)
  // audiences: NotificationAudience[] union:
  //  - { mode:"Company" }
  //  - { mode:"Role", roleKeys:string[] }
  //  - { mode:"Team", teamCodes:string[] }
  //  - { mode:"User", userIds?:string[], usernames?:string[] }
  // ---------------------------------------------------------------------------

  private isDirectToMe( audiences: unknown[] ): boolean {
    if ( !Array.isArray( audiences ) || audiences.length === 0 ) return false;

    for ( const a of audiences ) {
      const mode = this.safeStr( ( a as { mode?: string; } )?.mode );

      if ( mode === "Company" ) {
        // “Company” is global; still counts as direct to everyone
        return true;
      }

      if ( mode === "Role" ) {
        const roleKeys = this.safeArrStr( ( a as { roleKeys?: string[]; } )?.roleKeys );
        if ( this.myRole && roleKeys.includes( this.myRole ) ) return true;
      }

      if ( mode === "Team" ) {
        const teamCodes = this.safeArrStr( ( a as { teamCodes?: string[]; } )?.teamCodes );
        if ( this.myTeamCodes.some( ( t ) => teamCodes.includes( t ) ) ) return true;
      }

      if ( mode === "User" ) {
        const userIds = this.safeArrStr( ( a as { userIds?: string[]; } )?.userIds );
        const usernames = this.safeArrStr( ( a as { usernames?: string[]; } )?.usernames );

        if ( this.myUserId && userIds.includes( this.myUserId ) ) return true;
        if ( this.myUsername && usernames.includes( this.myUsername ) ) return true;
      }
    }

    return false;
  }

  private isOverallVisibleToAdmin( audiences: unknown[] ): boolean {
    // Legacy behavior:
    // - “overall” is visible to admin but not explicitly targeting them.
    if ( !this.canShowOverallTab() ) return false;

    const targetsMe = this.isDirectToMe( audiences );
    return !targetsMe;
  }

  // ---------------------------------------------------------------------------
  // small safe helpers (no free functions outside class)
  // ---------------------------------------------------------------------------

  private safeStr( v: unknown ): string {
    return typeof v === "string" ? v.trim() : "";
  }

  private safeArrStr( v: unknown ): string[] {
    if ( !Array.isArray( v ) ) return [];
    return v.filter( ( x ) => typeof x === "string" ).map( ( x ) => x.trim() ).filter( ( x ) => !!x );
  }

  private errMsg( err: unknown ): string {
    if ( err instanceof Error ) return err.message;
    return String( err ?? "unknown_error" );
  }
}
