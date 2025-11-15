// Path: src/app/pages/notifications/notifications-main-page.ts
import {CommonModule, isPlatformBrowser} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Renderer2
} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  Observable,
  Subscription
} from 'rxjs';
import {debounceTime, map, startWith} from 'rxjs/operators';

import {MatBadgeModule} from '@angular/material/badge';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatChipSelectionChange, MatChipsModule} from '@angular/material/chips';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatPaginatorModule, PageEvent} from '@angular/material/paginator';
import {MatTabsModule} from '@angular/material/tabs';
import {MatTooltipModule} from '@angular/material/tooltip';

import {SkeletonLoaderComponent} from '../../../components/shared/skeleton-loader/skeleton-loader.component';
import {User} from '../../../services/APIs/apis.service';
import {AuthService} from '../../../services/auth/auth.service';
import {NotificationsRoutingService} from '../../../services/notificationRouting/notifications-routing-service';
import {
  Notification,
  NotificationService,
} from '../../../services/notifications/notification-service';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';

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
  protected activeTab$: BehaviorSubject<TabKey> = new BehaviorSubject<TabKey>('all');
  protected searchCtrl: FormControl<string> = new FormControl<string>('', {nonNullable: true});

  /** Category chips */
  protected categories: Array<TitleCategory | 'All'> = CATEGORY_OPTIONS;
  protected activeCategory$: BehaviorSubject<TitleCategory | 'All'> =
    new BehaviorSubject<TitleCategory | 'All'>('All');

  /** Pagination state */
  protected pageSizeOptions: number[] = [10, 20, 30, 50];
  private pageIndex$: BehaviorSubject<number> = new BehaviorSubject<number>(0); // 0-based
  private pageSize$: BehaviorSubject<number> = new BehaviorSubject<number>(10);

  /** Loading (skeletons) */
  protected loading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

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
  private me: User | null = null;

  public constructor (
    private readonly windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService,
    private readonly notificationsRoutingService: NotificationsRoutingService,
    private readonly renderer: Renderer2
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  public ngOnInit(): void {
    // Theme
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val: boolean | null): void => {
        this.mode = val;
      });
    }

    // Core data streams from service
    this.notifications$ = this.notificationService.items$;
    this.unreadNotifications$ = this.notificationService.unreadNotifications$();
    this.unreadCount$ = this.notificationService.unreadCount$();
    this.connected$ = this.notificationService.connected$;

    this.connSub = this.notificationService.connected$
      .pipe(distinctUntilChanged())
      .subscribe((isOn: boolean): void => {
        // Keep existing behaviour; if UI expects "!connected" you can invert here.
        this.connected = !isOn;
      });

    // Logged user (for audience predicates)
    this.me = this.authService.getLoggedUser;
    this.username = this.me?.username || '';
    this.role = this.me?.role || '';

    // Audience derived (direct)
    this.directNotifications$ = this.notifications$.pipe(
      map((list: Notification[]) =>
        list.filter((n: Notification) => {
          const names: string[] = n.audience?.usernames ?? [];
          const roles: string[] = n.audience?.roles ?? [];
          const includesMe: boolean =
            names.includes(this.username) ||
            (!!this.role && roles.includes(this.role as Exclude<typeof this.role, ''>));

          const modeOk: boolean =
            n.audience?.mode === 'broadcast' ||
            n.audience?.mode === 'user' ||
            n.audience?.mode === 'role';

          return modeOk && includesMe;
        })
      )
    );

    // Audience derived (overall – admin sees others)
    this.overallNotifications$ = this.notifications$.pipe(
      map((list: Notification[]) =>
        list.filter((n: Notification) => {
          if(this.role !== 'admin') {
            return false;
          }

          const modeOk: boolean =
            n.audience?.mode === 'broadcast' ||
            n.audience?.mode === 'user' ||
            n.audience?.mode === 'role';
          if(!modeOk) {
            return false;
          }

          const names: string[] = n.audience?.usernames ?? [];
          const roles: string[] = n.audience?.roles ?? [];
          const targetsMe: boolean =
            names.includes(this.username) ||
            (!!this.role && roles.includes(this.role as Exclude<typeof this.role, ''>));

          return !targetsMe;
        })
      )
    );

    // Tab + search + category filter (LOCAL ONLY)
    this.filteredItems$ = combineLatest([
      this.notifications$,             // raw list from service (shared)
      this.directNotifications$,       // derived
      this.overallNotifications$,      // derived
      this.activeTab$,                 // tab selection
      this.activeCategory$,            // category chip
      this.searchCtrl.valueChanges.pipe(
        startWith<string>(''),
        debounceTime(150)
      ),                               // search query
    ]).pipe(
      map(([all, direct, overall, tab, activeCat, q]) => {
        // pick pool by tab
        const pool: Notification[] =
          tab === 'all'
            ? all
            : tab === 'unread'
              ? all.filter((n: Notification) => !n.userState?.isRead)
              : tab === 'direct'
                ? direct
                : overall;

        // category filter (local)
        const withCategory: Notification[] =
          activeCat && activeCat !== 'All'
            ? pool.filter((n: Notification) => n.category === activeCat)
            : pool;

        // search filter (local)
        const query: string = q?.trim().toLowerCase() ?? '';
        if(!query) {
          return withCategory;
        }

        return withCategory.filter((n: Notification) => {
          const title: string = (n.title ?? '').toLowerCase();
          const body: string = (n.body ?? '').toLowerCase();
          const tags: string[] = (n.tags ?? []).map((t: string) => t.toLowerCase());

          return (
            title.includes(query) ||
            body.includes(query) ||
            tags.some((t: string) => t.includes(query))
          );
        });
      })
    );

    // Counts + page slice (LOCAL pagination)
    this.totalCount$ = this.filteredItems$.pipe(
      map((arr: Notification[]) => arr.length)
    );

    this.pageItems$ = combineLatest([
      this.filteredItems$,
      this.pageIndex$,
      this.pageSize$
    ]).pipe(
      map(([items, pageIndex, pageSize]: [Notification[], number, number]) => {
        const start: number = pageIndex * pageSize;
        return items.slice(start, start + pageSize);
      })
    );

    // Paginator meta for number-row
    this.totalPages$ = combineLatest([
      this.totalCount$,
      this.pageSize$
    ]).pipe(
      map(([count, size]: [number, number]) =>
        Math.max(1, Math.ceil((count || 0) / (size || 1)))
      )
    );

    this.currentPage$ = this.pageIndex$.pipe(
      map((i: number) => i + 1)
    );

    this.pageNumbers$ = combineLatest([
      this.currentPage$,
      this.totalPages$
    ]).pipe(
      map(([current, total]: [number, number]) => {
        const windowSize: number = 5;
        let start: number = Math.max(1, current - 2);
        let end: number = Math.min(total, current + 2);

        while(end - start + 1 < Math.min(windowSize, total)) {
          if(start > 1) {
            start--;
          } else if(end < total) {
            end++;
          } else {
            break;
          }
        }

        const pages: number[] = [];
        for(let p: number = start; p <= end; p++) {
          pages.push(p);
        }
        return pages; // e.g., current=5 -> [3,4,5,6,7]
      })
    );

    // Initial fetch (backend-agnostic)
    this.fetchPage();
  }

  public ngAfterViewInit(): void {}

  public ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.connSub?.unsubscribe();

    this.loading$.complete();
    this.pageIndex$.complete();
    this.pageSize$.complete();
    this.activeTab$.complete();
    this.activeCategory$.complete();
  }

  /** Manual refresh – only re-calls backend */
  protected refresh(): void {
    this.fetchPage();
  }

  /** Mark a single notification as read */
  protected async markRead(id: string): Promise<void> {
    if(!id) {
      return;
    }
    try {
      await this.notificationService.markRead(id);
      this.refresh();
    } catch(err) {
      console.error('markRead failed', err);
    }
  }

  /** Search – LOCAL filter only */
  protected search(q: string): void {
    const query: string = (q ?? '').trim();
    if(query === this.searchCtrl.value) {
      return;
    }
    this.searchCtrl.setValue(query, {emitEvent: true});
    this.pageIndex$.next(0);
  }

  /** Category chip selection – LOCAL filter only */
  protected onCategorySelect(
    cat: TitleCategory | 'All',
    ev: MatChipSelectionChange
  ): void {
    if(!ev.selected) {
      return; // only react when a chip becomes selected
    }
    this.activeCategory$.next(cat);
    this.pageIndex$.next(0);
  }

  /** Tab change – LOCAL filter only */
  protected onTabChange(idx: number): void {
    const key: TabKey =
      idx === 0 ? 'all' :
        idx === 1 ? 'unread' :
          idx === 2 ? 'direct' :
            'overall';

    this.activeTab$.next(key);
    this.pageIndex$.next(0);
  }

  /** MatPaginator handler – LOCAL pagination only */
  protected onPage(e: PageEvent): void {
    this.pageIndex$.next(e.pageIndex);
    this.pageSize$.next(e.pageSize);
  }

  /** Number-row paginator actions (1-based) – LOCAL pagination only */
  protected async goToPage(p: number): Promise<void> {
    if(p < 1) {
      return;
    }
    const total: number = await firstValueFrom(this.totalPages$);
    const clamped: number = Math.min(total, Math.max(1, p));
    this.pageIndex$.next(clamped - 1);
  }

  protected async prevPage(step: number = 1): Promise<void> {
    const current: number = await firstValueFrom(this.currentPage$);
    await this.goToPage(current - step);
  }

  protected async nextPage(step: number = 1): Promise<void> {
    const current: number = await firstValueFrom(this.currentPage$);
    await this.goToPage(current + step);
  }

  protected async skipBack(): Promise<void> {
    await this.prevPage(3);
  }

  protected async skipForward(): Promise<void> {
    await this.nextPage(3);
  }

  /** Mark all currently visible (paged) notifications as read. */
  protected async markAllVisibleAsRead(
    items: Notification[] | null | undefined
  ): Promise<void> {
    if(!items?.length) {
      return;
    }
    try {
      await this.notificationService.markManyAsRead(items.map((n: Notification) => n._id));
      this.refresh();
    } catch(err) {
      console.error('markManyAsRead failed', err);
    }
  }

  /** TrackBy for *ngFor perf */
  protected trackById(_: number, n: Notification): string {
    return n._id;
  }

  /** Icon by severity (public so the template can call it) */
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

  /**
   * Fetch a page from backend.
   * ❗ Does NOT use tab/category/search – those are LOCAL-ONLY filters.
   */
  private async fetchPage(): Promise<void> {
    this.loading$.next(true);

    try {
      await this.notificationService.load({
        page: this.pageIndex$.value,
        limit: this.pageSize$.value,
        // no tab/category/search here – keeps this screen independent
      });
    } catch(err) {
      console.error('Failed to load notifications:', err);
    } finally {
      // keep your skeleton delay
      await new Promise<void>((resolve: () => void) => setTimeout(resolve, 1000));
      this.loading$.next(false);
    }
  }

  /** Open notification and mark as read if needed. */
  protected async openNotification(notification: Notification): Promise<void> {
    await this.notificationsRoutingService.navigateToAny(notification);
    if(!notification.userState?.isRead) {
      await this.markRead(notification._id);
    }
  }
}
