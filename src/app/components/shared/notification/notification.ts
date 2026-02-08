// src/app/components/shared/notification/notification.ts
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { Observable, Subject, timer, fromEvent } from 'rxjs';
import {
  map,
  takeUntil,
  distinctUntilChanged,
  startWith,
  switchMap,
  retryWhen,
  scan,
  delayWhen,
} from 'rxjs/operators';
import { Router } from '@angular/router';

import {
  NotificationService,
  Notification,
} from '../../../services/notifications/notification-service';
import { AuthService } from '../../../services/auth/auth.service';
import { NotificationsRoutingService } from '../../../services/notificationRouting/notifications-routing-service';
import { NotificationDialogComponent } from '../../dialogs/notificationBar/notificationBar.component';
import type { Role } from '../../../services/auth/user.contract';

@Component( {
  selector: 'app-notification',
  standalone: true,
  imports: [ CommonModule, MatMenuModule, MatIconModule, MatBadgeModule, MatButtonModule, NotificationDialogComponent ],
  templateUrl: './notification.html',
  styleUrls: [ './notification.scss' ],
} )
export class NotificationComponent implements OnInit, OnDestroy {
  @ViewChild( 'menuTrigger', { static: false } ) menuTrigger!: MatMenuTrigger;
  @ViewChild( NotificationDialogComponent, { static: true } ) notificationBar !: NotificationDialogComponent;

  protected notifications$!: Observable<Notification[]>;
  protected unreadCount$!: Observable<number>;
  protected connected$!: Observable<boolean>;

  protected activeTab: 'direct' | 'overall' = 'direct';
  protected directNotifications$!: Observable<Notification[]>;
  protected overallNotifications$!: Observable<Notification[]>;

  protected isLoggedIn = false;
  private username = '';
  private role: Role | null = null;

  private destroy$ = new Subject<void>();

  constructor (
    private readonly notificationService: NotificationService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly notificationsRoutingService: NotificationsRoutingService
  ) {}

  ngOnInit(): void {
    // Core streams
    this.notifications$ = this.notificationService.items$;
    this.unreadCount$ = this.notificationService.unreadCount$();
    this.connected$ = this.notificationService.connected$;

    // Auth context
    this.isLoggedIn = this.authService.isUserLoggedIn;
    const me = this.authService.getLoggedUser;
    this.username = me?.username || '';
    this.role = me?.role || null;

    // Predicates
    const isDirect = ( n: Notification ) => {
      const names = n.audience?.usernames ?? [];
      const roles = n.audience?.roles ?? [];
      const modeOk =
        n.audience?.mode === 'broadcast' ||
        n.audience?.mode === 'user' ||
        n.audience?.mode === 'role';

      const includesMeByName = names.includes( this.username );
      const includesMeByRole =
        !!this.role && roles.includes( this.role as Exclude<typeof this.role, ''> );

      return modeOk && ( includesMeByName || includesMeByRole );
    };

    const isOverall = ( n: Notification ) => {
      if ( this.role !== 'admin' ) return false;

      const names = n.audience?.usernames ?? [];
      const roles = n.audience?.roles ?? [];
      const modeOk =
        n.audience?.mode === 'broadcast' ||
        n.audience?.mode === 'user' ||
        n.audience?.mode === 'role';

      const targetsMeByName = names.includes( this.username );
      const targetsMeByRole =
        !!this.role && roles.includes( this.role as Exclude<typeof this.role, ''> );

      // "Overall" = visible to admin, but not explicitly targeting them
      return modeOk && !( targetsMeByName || targetsMeByRole );
    };

    // Split views
    this.directNotifications$ = this.notifications$.pipe( map( list => list.filter( isDirect ) ) );
    this.overallNotifications$ = this.notifications$.pipe( map( list => list.filter( isOverall ) ) );

    // NOTE: Initial REST load is done by AuthService.initRealtimeIfNeeded().
    // We do NOT call load() here again to avoid duplicate calls.

    // Realtime stream (sound handled inside NotificationService.onNew(true))
    this.notificationService
      .onNew( true )
      .pipe( takeUntil( this.destroy$ ) )
      .subscribe( {
        next: ( n: Notification ) => {
          // Service already upserts; this is just for debugging / extra effects
          console.log( '[NotificationComponent] new notification received:', n._id );
        },
        error: ( err ) => {
          console.error( '[NotificationComponent] realtime notifications error', err );
        },
      } );

    // Visibility-aware polling with backoff (fallback if WS fails or misses some)
    const visible$ = fromEvent( document, 'visibilitychange' ).pipe(
      map( () => document.visibilityState === 'visible' ),
      startWith( document.visibilityState === 'visible' ),
      distinctUntilChanged()
    );

    visible$
      .pipe(
        switchMap( ( isVisible ) => {
          const intervalMs = isVisible ? 30_000 : 180_000; // 30s vs 3min
          return timer( intervalMs, intervalMs ).pipe( map( () => undefined ) );
        } ),
        switchMap( () =>
          // Use observable version if available, else wrap Promise
          this.notificationService.load$?.( { limit: 30 } ) ??
          new Observable<void>( ( sub ) => {
            this.notificationService
              .load( { limit: 30 } )
              .then( () => {
                sub.next();
                sub.complete();
              } )
              .catch( ( e ) => sub.error( e ) );
          } )
        ),
        retryWhen( ( errors ) =>
          errors.pipe(
            scan( ( acc: number ) => Math.min( acc ? acc * 3 : 5000, 300000 ), 0 ),
            delayWhen( ( ms: number ) => timer( ms ) )
          )
        ),
        takeUntil( this.destroy$ )
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Refresh when menu opens (manual refresh on demand) */
  protected onOpenMenu(): void {
    this.notificationService.load( { limit: 30 } ).catch( () => {} );
  }

  protected setTab( tab: 'direct' | 'overall', ev?: MouseEvent ) {
    ev?.stopPropagation();
    this.activeTab = tab;
  }

  /** Navigate + mark single notification as read */
  protected async markOneRead( notification: Notification, ev?: MouseEvent ) {
    ev?.stopPropagation();
    ev?.preventDefault();

    try {
      const ok = await this.notificationsRoutingService.navigateToAny( notification );
      await this.notificationService.markRead( notification._id );
      if ( ok ) this.closeMenu();
    } catch ( e ) {
      console.error( '[notif] markOneRead failed', e );
    }
  }

  protected async markAllAsRead() {
    try {
      await this.notificationService.markAllRead();
    } catch ( e ) {
      console.error( '[notif] markAllAsRead failed', e );
    }
  }

  protected iconFor( n: Notification ): string {
    switch ( n.severity ) {
      case 'success': return 'check_circle';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'notifications';
    }
  }

  private closeMenu() {
    this.menuTrigger?.closeMenu();
  }

  protected viewAllNotifications(): void {
    if ( !this.isLoggedIn ) return;
    this.closeMenu();
    this.router.navigate( [ '/dashboard/notifications/all-notifications' ] );
  }

  protected trackById( _: number, item: Notification ) {
    return item._id;
  }
}
