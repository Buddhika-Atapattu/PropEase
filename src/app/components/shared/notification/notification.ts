import {Component, OnInit, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatMenuModule, MatMenuTrigger} from '@angular/material/menu';
import {MatIconModule} from '@angular/material/icon';
import {MatBadgeModule} from '@angular/material/badge';
import {MatButtonModule} from '@angular/material/button';
import {Observable, map} from 'rxjs';
import {Router} from '@angular/router';

import {
  NotificationService,
  Notification,
} from '../../../services/notifications/notification-service';
import {AuthService} from '../../../services/auth/auth.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, MatMenuModule, MatIconModule, MatBadgeModule, MatButtonModule],
  templateUrl: './notification.html',
  styleUrls: ['./notification.scss'],
})
export class NotificationComponent implements OnInit {

  /** Capture the notification menu */
  @ViewChild('menuTrigger', {static: false}) menuTrigger!: MatMenuTrigger;

  /** All notifications from service */
  protected notifications$!: Observable<Notification[]>;
  /** Unread count */
  protected unreadCount$!: Observable<number>;
  /** Socket connection */
  protected connected$!: Observable<boolean>;

  /** UI tab */
  protected activeTab: 'direct' | 'overall' = 'direct';

  /** Split streams */
  protected directNotifications$!: Observable<Notification[]>;
  protected overallNotifications$!: Observable<Notification[]>;

  /** Auth state */
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


  private menu: MatMenuModule | undefined;


  constructor (
    private readonly notificationService: NotificationService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    // Core streams
    this.notifications$ = this.notificationService.items$;
    this.unreadCount$ = this.notificationService.unreadCount$();
    this.connected$ = this.notificationService.connected$;

    // Auth info
    this.isLoggedIn = this.authService.isUserLoggedIn;
    const me = this.authService.getLoggedUser;
    this.username = me?.username || '';
    this.role = me?.role || '';

    // ⚠️ FIX: parenthesis / precedence + safe access via optional chaining
    // We want: (mode is one of) AND (includes me by username or role)
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

    // Admin sees "overall": notifications that do NOT target the current admin directly
    const isOverall = (n: Notification) => {
      if(this.role !== 'admin') return false; // overall is admin-only

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

    // Split streams using the predicates
    this.directNotifications$ = this.notifications$.pipe(map(list => list.filter(isDirect)));
    this.overallNotifications$ = this.notifications$.pipe(map(list => list.filter(isOverall)));

    // Initial fetch (server supports legacy limit/skip mapping in our service)
    this.notificationService.load({limit: 30}).catch((error) => {
      console.error('[notif] initial load failed', error);
    });
  }

  /** Refresh when menu opens */
  protected onOpenMenu(): void {
    // You can also pass onlyUnread:true to fetch only unread for the menu
    this.notificationService.load({limit: 30}).catch(() => {});
  }

  /** Tab switching (stopPropagation prevents menu close) */
  protected setTab(tab: 'direct' | 'overall', ev?: MouseEvent) {
    ev?.stopPropagation();
    this.activeTab = tab;
  }

  /** Mark a single notification read */
  protected async markOneRead(id: string, ev?: MouseEvent) {
    ev?.stopPropagation();
    try {
      await this.notificationService.markRead(id);
    } catch(e) {
      console.error('[notif] markOneRead failed', e);
    }
  }

  /** Mark all read */
  protected async markAllAsRead() {
    try {
      await this.notificationService.markAllRead();
    } catch(e) {
      console.error('[notif] markAllAsRead failed', e);
    }
  }

  /** Icon by severity (kept) */
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
    this.menuTrigger.closeMenu();
  }


  /** Navigate to full notification page */
  protected viewAllNotifications(): void {
    if(!this.isLoggedIn) return;
    this.closeMenu();
    this.router.navigate(['/dashboard/all-notifications']);
  }

  /** TrackBy optimization */
  protected trackById(_: number, item: Notification) {
    return item._id;
  }
}
