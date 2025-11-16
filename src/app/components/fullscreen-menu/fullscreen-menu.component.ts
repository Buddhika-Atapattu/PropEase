import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  Renderer2,
  OnChanges, SimpleChanges, ViewChild
} from '@angular/core';
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
import {Observable, Subject, timer, fromEvent} from 'rxjs';
import {CommonModule, isPlatformBrowser} from '@angular/common';
import {MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer} from '@angular/platform-browser';
import {MatRippleModule} from '@angular/material/core';
import {Router} from '@angular/router';
import {type FullscreenMenuLink} from '../list-main-panel/list-main-panel.component';
import {NotificationService, type Notification} from '../../services/notifications/notification-service';
import {NotificationsRoutingService} from '../../services/notificationRouting/notifications-routing-service'
import {AuthService} from '../../services/auth/auth.service';
import {User} from '../../services/APIs/apis.service';
import {MatMenuModule, MatMenuTrigger} from '@angular/material/menu';
import {APIsService, type MSG} from '../../services/APIs/apis.service';




export interface FullscreenMenuProfile {
  name: string;
  email?: string | null;
  avatarSrc?: string | null;
}

@Component({
  selector: 'app-fullscreen-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatRippleModule],
  templateUrl: './fullscreen-menu.component.html',
  styleUrls: ['./fullscreen-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FullscreenMenuComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  /** Controls visibility from parent */
  @Input() open = false;

  /** Profile header (optional) */
  @Input() profile: FullscreenMenuProfile | null = null;

  /** Menu items (same shape you already use) */
  @Input({required: true}) links: FullscreenMenuLink[] = [];

  /** Current router url fragment to highlight active route */
  @Input() currentUrl = '';

  /** Emits when the overlay requests close */
  @Output() closed = new EventEmitter<void>();

  /** Emits (parent, child, grandchild) path triplet for navigation */
  @Output() navigate = new EventEmitter<{p: string | null; c: string | null; g: string | null}>();

  @ViewChild('menuTrigger', {static: false}) menuTrigger!: MatMenuTrigger;

  private isBrowser: boolean;

  private unlisteners: Array<() => void> = [];

  /** Which body to show */
  protected activeView: 'menu' | 'notifications' = 'menu';

  // Notification
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
    private readonly el: ElementRef<HTMLElement>,
    private readonly r2: Renderer2,
    private readonly router: Router,
    @Inject(PLATFORM_ID) platformId: object,
    private readonly notificationService: NotificationService,
    private readonly notificationsRoutingService: NotificationsRoutingService,
    private readonly authService: AuthService,
    private readonly matIconRegistry: MatIconRegistry,
    private readonly domSanitizer: DomSanitizer,
    private readonly apiService: APIsService,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // === Life-cycle ===========================================================
  ngOnInit(): void {

    // Register Menu Item Icons
    this.makeIcons();
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
    this.directNotifications$ = this.notifications$.pipe(map(list => list.filter(isDirect)));
    this.overallNotifications$ = this.notifications$.pipe(map(list => list.filter(isOverall)));

    // Initial fetch
    this.notificationService.load({limit: 30}).catch((error) => {
      console.error('[notif] initial load failed', error);
    });

    // Optional real-time
    const maybeOnNew = (this.notificationService as any).onNew?.bind(this.notificationService);
    if(typeof maybeOnNew === 'function') {
      maybeOnNew()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (n: Notification) => this.notificationService.upsert?.(n),
          error: () => { /* ignore; polling handles resilience */},
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
          return timer(intervalMs, intervalMs).pipe(map(() => undefined));
        }),
        switchMap(() =>
          this.notificationService.load$?.({limit: 30}) ??
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
            scan((acc: number) => Math.min(acc ? acc * 3 : 5000, 300000), 0),
            delayWhen((ms: number) => timer(ms))
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  ngAfterViewInit(): void {
    this.applyBodyScrollLock(this.open);
    // Close on ESC (browser only)
    if(this.isBrowser) {
      const offKey = this.r2.listen('document', 'keydown', (e: KeyboardEvent) => {
        if(e.key === 'Escape' && this.open) {
          this.requestClose();
        }
      });
      this.unlisteners.push(offKey);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if(changes['open'] && !changes['open'].firstChange) {
      this.applyBodyScrollLock(this.open);
    }
  }

  ngOnDestroy(): void {
    // release listeners + scroll lock
    this.unlisteners.forEach(u => u());
    this.applyBodyScrollLock(false);
  }

  /** Toggle helpers (called by header pills) */
  protected showMenu(): void {
    this.activeView = 'menu';
  }

  protected showNotifications(): void {
    this.activeView = 'notifications';
  }


  /**
   * FIX: Actually navigate.
   * We use the routing service’s convenience method which builds the UrlTree and navigates.
   * Then we mark as read and close the menu.
   */
  /* Ensure selecting a notification also closes the overlay at end */
  protected async markOneRead(notification: Notification, ev?: MouseEvent) {
    ev?.stopPropagation();
    ev?.preventDefault();
    try {
      const ok = await this.notificationsRoutingService.navigateToAny(notification);
      await this.notificationService.markRead(notification._id);
      if(ok) this.requestClose();  // close overlay after action
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
    if(!this.authService.getLoggedUser) return;
    this.requestClose();
    this.router.navigate(['/dashboard/notifications/all-notifications']);
  }

  protected trackById(_: number, item: Notification) {
    return item._id;
  }

  private makeIcons() {

    const icons: {
      name: string;
      icon: string;
    }[] = [
        {name: 'home-icon', icon: 'Images/Icons/home.svg'},
        {name: 'property-icon', icon: 'Images/Icons/property.svg'},
        {name: 'users-icon', icon: 'Images/Icons/users.svg'},
        {name: 'tenant-icon', icon: 'Images/Icons/tenant.svg'},
        {name: 'agent-icon', icon: 'Images/Icons/agents.svg'},
        {name: 'report-icon', icon: 'Images/Icons/report.svg'},
        {name: 'owner-icon', icon: 'Images/Icons/owner.svg'},
        {name: 'payment-icon', icon: 'Images/Icons/payments.svg'},
        {name: 'access-icon', icon: 'Images/Icons/access-control.svg'},
        {name: 'bill-list-icon', icon: 'Images/Icons/bill-list.svg'},
        {name: 'certification-icon', icon: 'Images/Icons/certification.svg'},
        {name: 'create-icon', icon: 'Images/Icons/create.svg'},
        {name: 'documents-icon', icon: 'Images/Icons/documents.svg'},
        {name: 'notifications-icon', icon: 'Images/Icons/notification.svg'},
        {name: 'log-icon', icon: 'Images/Icons/log.svg'},
        {name: 'complaints-icon', icon: 'Images/Icons/complaints.svg'},
      ]
    icons.forEach((icon) => {
      this.matIconRegistry.addSvgIcon(
        icon.name,
        this.domSanitizer.bypassSecurityTrustResourceUrl(icon.icon)
      );
    });
  }

  protected activeItem(
    parent: FullscreenMenuLink | null,
    child: FullscreenMenuLink | null
  ): boolean {
    try {
      if(!parent?.url) return false;

      // Current path → segments (lowercased, no empty parts, no query/hash)
      const rawPath = window.location.pathname.split('?')[0].split('#')[0];
      const segs = rawPath.split('/').filter(Boolean).map(s => s.toLowerCase());

      // Helper to get last segment of a link
      const parentSeg = this.lastSeg(parent.url);
      const childSeg = child?.url ? this.lastSeg(child.url) : null;

      // True if current path contains the parent segment OR the child segment
      const matchParent = !!parentSeg && segs.includes(parentSeg);
      const matchChild = !!childSeg && segs.includes(childSeg);

      return matchParent || matchChild;
    } catch(err) {
      console.error('activeItem() failed:', err);
      return false;
    }
  }

  /** Extract last path segment from a link URL, normalized to lowercase. */
  private lastSeg(url: string): string {
    return url.split('/').filter(Boolean).pop()!.toLowerCase();
  }


  // === Public API (template) ================================================
  /** Backdrop click */
  onBackdrop(): void {
    this.requestClose();
  }

  /** Navigate helper that emits to parent; parent can call router */
  go(item: FullscreenMenuLink): void {
    if(!item.commands) return;
    this.router.navigate(['dashboard', ...item.commands])
    this.requestClose();
  }

  /** Top-level expand/collapse */
  toggleTop(index: number): void {
    this.toggleSection(`.lvl-1[data-idx="${index}"]`);
  }

  /** Second-level expand/collapse */
  toggleSub(i: number, j: number): void {
    this.toggleSection(`.lvl-2[data-idx="${i}-${j}"]`);
  }

  /** Trackers for *ngFor performance */
  trackTop = (_: number, it: FullscreenMenuLink) => it.url ?? it.icon_text;
  trackSub = (_: number, it: FullscreenMenuLink) => it.url ?? it.icon_text;
  trackChild = (_: number, it: FullscreenMenuLink) => it.url ?? it.icon_text;

  public get firstName(): string {
    const raw = (this.profile?.name ?? '').trim();
    if(!raw) return 'User';
    const first = raw.split(/\s+/)[0];
    return first || 'User';
  }

  protected async viewUserProfile(): Promise<void> {
    try {
      if(!this.authService.getLoggedUser) throw new Error('Invalid ligin!');
      const user: User = this.authService.getLoggedUser;
      if(!user.username) throw new Error('Invalid username');
      const res = await this.apiService.generateToken(user.username);
      if(!res.token) throw new Error('Invalid token!');
      this.router.navigate(['/dashboard/users/user-profile/', res.token]);
    }
    catch(error) {
      console.error(error);
      return;
    }
    finally {
      this.requestClose();
    }
  }

  // === Private helpers (class-based) ========================================
  /** Smooth height toggle for collapsibles */
  private toggleSection(selector: string): void {
    const host = this.el.nativeElement;
    const section = host.querySelector<HTMLElement>(selector);
    if(!section) return;
    const body = section.querySelector<HTMLElement>('.collapse-body');
    if(!body) return;

    const isOpen = section.classList.contains('open');
    if(isOpen) {
      // collapse
      const start = body.scrollHeight;
      body.style.height = `${start}px`;
      // force reflow to ensure transition
      void body.offsetHeight;
      body.style.height = '0px';
      section.classList.remove('open');
    } else {
      // expand
      body.style.height = 'auto';
      const end = body.scrollHeight;
      body.style.height = '0px';
      // force reflow
      void body.offsetHeight;
      body.style.height = `${end}px`;
      section.classList.add('open');
    }
  }

  /** Close request with cleanup */
  private requestClose(): void {
    this.open = false;
    this.applyBodyScrollLock(false);
    this.closed.emit();
  }

  /** Prevent background scroll when open */
  private applyBodyScrollLock(lock: boolean): void {
    if(!this.isBrowser) return;
    const body = document.body;
    if(lock) {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = '';
    }
  }

  /** Active state utility for top/sub/grandchild items */
  protected isActive(candidate: string | null): boolean {
    if(!candidate) return false;
    return this.currentUrl.includes(candidate);
  }
}
