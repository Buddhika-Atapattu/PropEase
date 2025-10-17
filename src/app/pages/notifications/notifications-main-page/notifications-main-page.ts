import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  AfterViewInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {
  Subscription,
  BehaviorSubject,
  combineLatest,
  Observable,
  distinctUntilChanged,
  firstValueFrom
} from 'rxjs';
import {map, startWith, debounceTime} from 'rxjs/operators';
import {ActivatedRoute, Router} from '@angular/router';
import {FormControl, ReactiveFormsModule} from '@angular/forms';

import {MatTabsModule} from '@angular/material/tabs';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatChipsModule, MatChipSelectionChange} from '@angular/material/chips';
import {MatBadgeModule} from '@angular/material/badge';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatCardModule} from '@angular/material/card';
import {MatPaginatorModule, PageEvent} from '@angular/material/paginator';
import {MatTooltipModule} from '@angular/material/tooltip';

import {WindowsRefService} from '../../../services/windowRef/windowRef.service';
import {AuthService, LoggedUserType} from '../../../services/auth/auth.service';
import {
  NotificationService,
  Notification,
} from '../../../services/notifications/notification-service';
import {SkeletonLoaderComponent} from '../../../components/shared/skeleton-loader/skeleton-loader.component';
import {NotificationsRoutingService} from '../../../services/notificationRouting/notifications-routing-service';



/** Tabs */
type TabKey = 'all' | 'unread' | 'direct' | 'overall';

type TitleCategory =
  | 'User' | 'Tenant' | 'Property' | 'Lease' | 'Agent' | 'Developer'
  | 'Maintenance' | 'Complaint' | 'Team' | 'Registration' | 'Payment' | 'System';

const CATEGORY_OPTIONS: Array<TitleCategory | 'All'> = [
  'All',
  'User',
  'Tenant',
  'Property',
  'Lease',
  'Agent',
  'Developer',
  'Maintenance',
  'Complaint',
  'Team',
  'Registration',
  'Payment',
  'System',
];

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatBadgeModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatPaginatorModule,
    MatTooltipModule,
    ReactiveFormsModule,
    SkeletonLoaderComponent
  ],
  templateUrl: './notifications-main-page.html',
  styleUrl: './notifications-main-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsMainPage implements OnInit, AfterViewInit, OnDestroy {

  /** Theme mode from global service (bool or null until first emit) */
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  /** Core streams */
  protected notifications$!: Observable<Notification[]>;
  protected unreadNotifications$!: Observable<Notification[]>;
  protected unreadCount$!: Observable<number>;
  protected connected$!: Observable<boolean>;

  /** Audience-derived subsets */
  protected directNotifications$!: Observable<Notification[]>;
  protected overallNotifications$!: Observable<Notification[]>;

  /** Logged user */
  private username = '';
  private role:
    | 'admin' | 'agent' | 'tenant' | 'owner'
    | 'operator' | 'manager' | 'developer' | 'user'
    | '' = '';

  /** UI state */
  protected activeTab$ = new BehaviorSubject<TabKey>('all');
  protected searchCtrl = new FormControl<string>('', {nonNullable: true});

  /** Category chips */
  protected categories = CATEGORY_OPTIONS;
  protected activeCategory$ = new BehaviorSubject<TitleCategory | 'All'>('All');

  /** Pagination state */
  protected pageSizeOptions = [10, 20, 30, 50];
  private pageIndex$ = new BehaviorSubject<number>(0); // 0-based
  private pageSize$ = new BehaviorSubject<number>(10);

  /** Loading (skeletons) */
  protected loading$ = new BehaviorSubject<boolean>(false);

  /** View-model */
  protected filteredItems$!: Observable<Notification[]>;
  protected totalCount$!: Observable<number>;
  protected pageItems$!: Observable<Notification[]>;

  /** Number-row paginator helpers */
  protected totalPages$!: Observable<number>;
  protected currentPage$!: Observable<number>;
  protected pageNumbers$!: Observable<number[]>;

  /** Socket connected snapshot */
  private connSub?: Subscription;
  protected connected!: boolean;

  /** Logged User snapshot */
  private me: LoggedUserType | null = null;

  constructor (
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private notificationService: NotificationService,
    private readonly notificationsRoutingService: NotificationsRoutingService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    // Theme
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {this.mode = val;});
    }

    // Core data streams
    this.notifications$ = this.notificationService.items$;
    this.unreadNotifications$ = this.notificationService.unreadNotifications$();
    this.unreadCount$ = this.notificationService.unreadCount$();
    this.connected$ = this.notificationService.connected$;



    this.connSub = this.connected$.pipe(distinctUntilChanged())
      .subscribe(isOn => (this.connected = isOn));



    // Logged user (for audience predicates)
    this.me = this.authService.getLoggedUser;
    this.username = this.me?.username || '';
    this.role = this.me?.role || '';

    // Audience derived
    this.directNotifications$ = this.notifications$.pipe(
      map(list =>
        list.filter(n => {
          const names = n.audience?.usernames ?? [];
          const roles = n.audience?.roles ?? [];
          const includesMe =
            names.includes(this.username) ||
            (!!this.role && roles.includes(this.role as Exclude<typeof this.role, ''>));

          const modeOk =
            n.audience?.mode === 'broadcast' ||
            n.audience?.mode === 'user' ||
            n.audience?.mode === 'role';

          return modeOk && includesMe;
        })
      )
    );

    this.overallNotifications$ = this.notifications$.pipe(
      map(list =>
        list.filter(n => {
          if(this.role !== 'admin') return false;

          const modeOk =
            n.audience?.mode === 'broadcast' ||
            n.audience?.mode === 'user' ||
            n.audience?.mode === 'role';
          if(!modeOk) return false;

          const names = n.audience?.usernames ?? [];
          const roles = n.audience?.roles ?? [];
          const targetsMe =
            names.includes(this.username) ||
            (!!this.role && roles.includes(this.role as Exclude<typeof this.role, ''>));

          return !targetsMe;
        })
      )
    );

    // Tab + search + category filter (LOCAL)
    this.filteredItems$ = combineLatest([
      this.notifications$,            // raw list from service
      this.directNotifications$,       // derived
      this.overallNotifications$,      // derived
      this.activeTab$,                 // tab
      this.activeCategory$,            // <-- include category subject
      this.searchCtrl.valueChanges.pipe(startWith(''), debounceTime(150)), // search
    ]).pipe(
      map(([all, direct, overall, tab, activeCat, q]) => {
        // choose the right pool by tab
        const pool =
          tab === 'all' ? all :
            tab === 'unread' ? all.filter(n => !n.userState?.isRead) :
              tab === 'direct' ? direct : overall;

        // apply local category filter (instant feedback)
        const withCategory = (activeCat && activeCat !== 'All')
          ? pool.filter(n => n.category === activeCat)
          : pool;

        // apply local search
        const query = q?.trim().toLowerCase();
        if(!query) return withCategory;

        return withCategory.filter(n => {
          const title = (n.title ?? '').toLowerCase();
          const body = (n.body ?? '').toLowerCase();
          const tags = (n.tags ?? []).map(t => t.toLowerCase());
          return title.includes(query) || body.includes(query) || tags.some(t => t.includes(query));
        });
      })
    );

    // Counts + page slice
    this.totalCount$ = this.filteredItems$.pipe(map(arr => arr.length));
    this.pageItems$ = combineLatest([this.filteredItems$, this.pageIndex$, this.pageSize$]).pipe(
      map(([items, pageIndex, pageSize]) => {
        const start = pageIndex * pageSize;
        return items.slice(start, start + pageSize);
      })
    );

    // Paginator meta
    this.totalPages$ = combineLatest([this.totalCount$, this.pageSize$]).pipe(
      map(([count, size]) => Math.max(1, Math.ceil((count || 0) / (size || 1))))
    );
    this.currentPage$ = this.pageIndex$.pipe(map(i => i + 1));
    this.pageNumbers$ = combineLatest([this.currentPage$, this.totalPages$]).pipe(
      map(([current, total]) => {
        const windowSize = 5;
        let start = Math.max(1, current - 2);
        let end = Math.min(total, current + 2);

        while(end - start + 1 < Math.min(windowSize, total)) {
          if(start > 1) start--;
          else if(end < total) end++;
          else break;
        }

        const pages: number[] = [];
        for(let p = start; p <= end; p++) pages.push(p);
        return pages; // e.g., current=5 -> [3,4,5,6,7]
      })
    );

    // Initial fetch
    this.fetchPage();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.connSub?.unsubscribe();

    this.loading$.complete();
    this.pageIndex$.complete();
    this.pageSize$.complete();
    this.activeTab$.complete();
    this.activeCategory$.complete();
  }

  /** Manual refresh */
  protected refresh() {this.fetchPage();}

  /** Mark a single notification as read */
  protected async markRead(id: string) {
    if(!id) return;
    try {
      await this.notificationService.markRead(id);
      this.refresh();
    } catch(err) {
      console.error('markRead failed', err);
    }
  }

  /** Search */
  protected search(q: string) {
    const query = (q ?? '').trim();
    this.searchCtrl.setValue(query, {emitEvent: true});
    this.pageIndex$.next(0);
    this.fetchPage();
  }

  /** Chip selection handler: ensures subject reflects UI state */
  protected onCategorySelect(cat: TitleCategory | 'All', ev: MatChipSelectionChange) {
    if(!ev.selected) return;      // only react when a chip becomes selected
    this.activeCategory$.next(cat);
    this.pageIndex$.next(0);
    this.fetchPage();              // still call BE so pagination/counts align
  }

  /** Tab change */
  protected onTabChange(idx: number) {
    const key: TabKey = idx === 0 ? 'all' : idx === 1 ? 'unread' : idx === 2 ? 'direct' : 'overall';
    this.activeTab$.next(key);
    this.pageIndex$.next(0);
    this.fetchPage();
  }

  /** If using MatPaginator somewhere else */
  protected onPage(e: PageEvent) {
    this.pageIndex$.next(e.pageIndex);
    this.pageSize$.next(e.pageSize);
    this.fetchPage();
  }

  /** Number-row paginator actions (1-based) */
  protected async goToPage(p: number) {
    if(p < 1) return;
    const total = await firstValueFrom(this.totalPages$);
    const clamped = Math.min(total, Math.max(1, p));
    this.pageIndex$.next(clamped - 1);
    this.fetchPage();
  }
  protected async prevPage(step = 1) {
    const current = await firstValueFrom(this.currentPage$);
    this.goToPage(current - step);
  }
  protected async nextPage(step = 1) {
    const current = await firstValueFrom(this.currentPage$);
    this.goToPage(current + step);
  }
  protected async skipBack() {this.prevPage(3);}
  protected async skipForward() {this.nextPage(3);}

  /** Mark all currently visible (paged) notifications as read. */
  protected async markAllVisibleAsRead(items: Notification[] | null | undefined) {
    if(!items?.length) return;
    try {
      await this.notificationService.markManyAsRead(items.map(n => n._id));
      this.refresh();
    } catch(err) {
      console.error('markManyAsRead failed', err);
    }
  }

  /** TrackBy for *ngFor perf */
  protected trackById(_: number, n: Notification) {return n._id;}

  /** Icon by severity (public so the template can call it) */
  iconFor(n: Notification): string {
    switch(n.severity) {
      case 'success': return 'check_circle';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'notifications';
    }
  }

  /** Fetch a page from backend with filters */
  private async fetchPage() {
    this.loading$.next(true);
    try {
      const tab = this.activeTab$.value;
      const onlyUnread = tab === 'unread';
      const cat = this.activeCategory$.value;
      const category = cat === 'All' ? undefined : cat;

      await this.notificationService.load({
        page: this.pageIndex$.value,
        limit: this.pageSize$.value,
        onlyUnread,
        search: this.searchCtrl.value || undefined,
        category,
      });
    } catch(err) {
      console.error('Failed to load notifications:', err);
    } finally {
      this.loading$.next(false);
    }
  }

  /** Open notification: internal links use Router; http(s) open in a new tab. Also mark read. */
  protected async openNotification(notification: Notification): Promise<void> {
    await this.notificationsRoutingService.navigateTo(notification);
    if(!notification.userState?.isRead) this.markRead(notification._id);
  }
}
