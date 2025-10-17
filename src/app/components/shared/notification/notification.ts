import {Component, OnInit, OnDestroy, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatMenuModule, MatMenuTrigger} from '@angular/material/menu';
import {MatIconModule} from '@angular/material/icon';
import {MatBadgeModule} from '@angular/material/badge';
import {MatButtonModule} from '@angular/material/button';
import {Observable, Subject, timer, fromEvent} from 'rxjs';
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
import {Router} from '@angular/router';

import {
  NotificationService,
  Notification,
} from '../../../services/notifications/notification-service';
import {AuthService} from '../../../services/auth/auth.service';
import {NotificationsRoutingService} from '../../../services/notificationRouting/notifications-routing-service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, MatMenuModule, MatIconModule, MatBadgeModule, MatButtonModule],
  templateUrl: './notification.html',
  styleUrls: ['./notification.scss'],
})
export class NotificationComponent implements OnInit, OnDestroy {
  @ViewChild('menuTrigger', {static: false}) menuTrigger!: MatMenuTrigger;

  protected notifications$!: Observable<Notification[]>;
  protected unreadCount$!: Observable<number>;
  protected connected$!: Observable<boolean>;

  protected activeTab: 'direct' | 'overall' = 'direct';
  protected directNotifications$!: Observable<Notification[]>;
  protected overallNotifications$!: Observable<Notification[]>;

  protected isLoggedIn = false;
  private username = '';
  private role:
    | 'admin'
    | 'agent'
    | 'tenant'
    | 'owner'
    | 'operator'
    | 'manager'
    | 'developer'
    | 'user'
    | '' = '';

  private destroy$ = new Subject<void>();

  constructor (
    private readonly notificationService: NotificationService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private notificationsRoutingService: NotificationsRoutingService
  ) {}

  ngOnInit(): void {
    // Streams
    this.notifications$ = this.notificationService.items$;
    this.unreadCount$ = this.notificationService.unreadCount$();
    this.connected$ = this.notificationService.connected$;

    // Auth
    this.isLoggedIn = this.authService.isUserLoggedIn;
    const me = this.authService.getLoggedUser;
    this.username = me?.username || '';
    this.role = me?.role || '';

    // Predicates
    const isDirect = (n: Notification) => {
      const names = n.audience?.usernames ?? [];
      const roles = n.audience?.roles ?? [];
      const modeOk =
        n.audience?.mode === 'broadcast' ||
        n.audience?.mode === 'user' ||
        n.audience?.mode === 'role';

      const includesMeByName = names.includes(this.username);
      const includesMeByRole = !!this.role && roles.includes(this.role as Exclude<typeof this.role, ''>);
      return modeOk && (includesMeByName || includesMeByRole);
    };

    const isOverall = (n: Notification) => {
      if(this.role !== 'admin') return false;
      const names = n.audience?.usernames ?? [];
      const roles = n.audience?.roles ?? [];
      const modeOk =
        n.audience?.mode === 'broadcast' ||
        n.audience?.mode === 'user' ||
        n.audience?.mode === 'role';

      const targetsMeByName = names.includes(this.username);
      const targetsMeByRole = !!this.role && roles.includes(this.role as Exclude<typeof this.role, ''>);
      return modeOk && !(targetsMeByName || targetsMeByRole);
    };

    // Split views
    this.directNotifications$ = this.notifications$.pipe(map((list) => list.filter(isDirect)));
    this.overallNotifications$ = this.notifications$.pipe(map((list) => list.filter(isOverall)));

    // Initial fetch
    this.notificationService.load({limit: 30}).catch((error) => {
      console.error('[notif] initial load failed', error);
    });

    // Optional real-time: only if your service exposes it (safe guard)
    const maybeOnNew = (this.notificationService as any).onNew?.bind(this.notificationService);
    if(typeof maybeOnNew === 'function') {
      maybeOnNew()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (n: Notification) => this.notificationService.upsert?.(n),
          error: () => {/* ignore; polling handles resilience */},
        });
    }

    // Visibility-aware polling with backoff
    const visible$ = fromEvent(document, 'visibilitychange').pipe(
      map(() => document.visibilityState === 'visible'),
      startWith(document.visibilityState === 'visible'),
      distinctUntilChanged()
    );

    visible$
      .pipe(
        switchMap((isVisible) => {
          const intervalMs = isVisible ? 30_000 : 180_000; // 30s vs 3min
          // Fire on each tick
          return timer(intervalMs, intervalMs).pipe(map(() => undefined));
        }),
        // Call load() and convert to retry-able observable
        switchMap(() =>
          this.notificationService.load$?.({limit: 30}) ??
          // Fallback if you don't have load$:
          // Wrap promise -> observable for the same pipeline
          new Observable<void>((sub) => {
            this.notificationService
              .load({limit: 30})
              .then(() => {
                sub.next();
                sub.complete();
              })
              .catch((e) => sub.error(e));
          })
        ),
        retryWhen((errors) =>
          errors.pipe(
            // backoff: 5s → 15s → 45s → 135s → cap at 300s
            scan((acc: number) => Math.min(acc ? acc * 3 : 5000, 300000), 0),
            delayWhen((ms: number) => timer(ms))
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Refresh when menu opens */
  protected onOpenMenu(): void {
    this.notificationService.load({limit: 30}).catch(() => {});
  }

  protected setTab(tab: 'direct' | 'overall', ev?: MouseEvent) {
    ev?.stopPropagation();
    this.activeTab = tab;
  }

  protected async markOneRead(notification: Notification, ev?: MouseEvent) {
    ev?.stopPropagation();
    try {
      await this.notificationService.markRead(notification._id);
      await await this.notificationsRoutingService.navigateTo(notification);
      this.closeMenu();
    } catch(e) {
      console.error('[notif] markOneRead failed', e);
    }
  }

  protected async markAllAsRead() {
    try {
      await this.notificationService.markAllRead();
    } catch(e) {
      console.error('[notif] markAllAsRead failed', e);
    }
  }

  protected iconFor(n: Notification): string {
    switch(n.severity) {
      case 'success':
        return 'check_circle';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'notifications';
    }
  }

  private closeMenu() {
    this.menuTrigger?.closeMenu();
  }

  protected viewAllNotifications(): void {
    if(!this.isLoggedIn) return;
    this.closeMenu();
    this.router.navigate(['/dashboard/all-notifications']);
  }

  protected trackById(_: number, item: Notification) {
    return item._id;
  }
}
