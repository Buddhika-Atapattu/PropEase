// deleted-item-notifications.ts
import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  AfterViewInit,
  Pipe,
  PipeTransform,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';

import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription, firstValueFrom} from 'rxjs';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';
import {
  NotificationService,
  Notification,
  Severity,
  responseMSG,
} from '../../../services/notifications/notification-service';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {MatIconModule} from '@angular/material/icon';
import {ProgressBarComponent} from '../../../components/dialogs/progress-bar/progress-bar.component';
import {NotificationDialogComponent} from '../../../components/dialogs/notification/notification.component';

/* ───────────────────────────────
 * Simple value renderer for meta grid
 * - Shortens long JSON/arrays, keeps it readable in tiles
 * ─────────────────────────────── */
@Pipe({name: 'metaRender', standalone: true})
export class MetaRenderPipe implements PipeTransform {
  transform(v: any): string {
    if(v == null) return '';
    if(typeof v === 'string') return v;
    try {
      const s = JSON.stringify(v);
      return s.length > 80 ? s.slice(0, 77) + '…' : s;
    } catch {
      return String(v);
    }
  }
}

/**
 * Deleted Item Review Page
 * - Pulls the selected notification from the query param (?selected=...)
 * - Shows a rich, adaptive summary and metadata grid
 * - Provides “Restore” and “Permanently Delete” actions (confirm banners)
 * - Uses Bootstrap classes for responsiveness; lives entirely inside .main-panel
 */
@Component({
  selector: 'app-deleted-item-notifications',
  standalone: true,
  imports: [CommonModule, MetaRenderPipe, MatIconModule, ProgressBarComponent, NotificationDialogComponent],
  templateUrl: './deleted-item-notifications.html',
  styleUrl: './deleted-item-notifications.scss',
})
export class DeletedItemNotificationsPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(ProgressBarComponent) progress!: ProgressBarComponent;
  @ViewChild(NotificationDialogComponent) notificationDialogComponent!: NotificationDialogComponent;
  /** Theme mode (from your WindowRefService); gate rendering until known */
  protected mode: boolean | null = null;
  protected isBrowser: boolean;

  /** Page state */
  protected loading = true;
  protected error: string | null = null;

  /** Current notification (selected via query param ?selected=) */
  protected notification: Notification | null = null;

  /** Flattened primary metadata for a friendly grid */
  protected primaryMeta: Array<{key: string; value: any}> = [];

  /** UI toggles */
  protected showRaw = false;
  protected confirm: 'restore' | 'delete' | null = null;

  private modeSub: Subscription | null = null;
  private qpSub: Subscription | null = null;

  protected readonly dummyUserImg = '/Images/user-images/dummy-user/dummy-user.jpg';

  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private readonly platformId: Object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly notif: NotificationService,
    private readonly http: HttpClient
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    // Watch theme/“mode” like in your other pages
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => (this.mode = val));
    }


    // Read ?selected=… and load the corresponding notification from service
    this.qpSub = this.route.queryParamMap.subscribe(async (params) => {
      const id = params.get('selected');
      if(!id) {
        this.loading = false;
        this.error = 'No deleted item selected.';
        return;
      }
      await this.resolveNotification(id);
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.qpSub?.unsubscribe();
  }

  /** Severity → chip class mapping for a bit of visual flavor */
  protected severityClass(s?: Severity) {
    switch(s) {
      case 'success':
        return 'bg-success-subtle text-success';
      case 'warning':
        return 'bg-warning-subtle text-warning';
      case 'error':
        return 'bg-danger-subtle text-danger';
      default:
        return 'bg-info-subtle text-info';
    }
  }

  /** Toggle the raw JSON view of metadata */
  protected toggleRaw() {
    this.showRaw = !this.showRaw;
  }

  /** Ask for actions (shows confirmation banners) */
  protected askRestore() {
    this.confirm = 'restore';
  }
  protected askPermanentDelete() {
    this.confirm = 'delete';
  }
  protected cancelConfirm() {
    this.confirm = null;
  }

  /** Go back to the Deleted Items hub */
  protected backToList() {
    this.router.navigate(['/dashboard/all-notifications']);
  }

  /**
   * Restore action:
   * - Calls your backend (adapt URL if needed)
   * - On success, navigates back to Deleted Items
   */
  protected async restore(notification: Notification) {
    try {
      this.loading = true;
      this.progress.start();

      // Send JSON, not FormData
      const payload = {notification};  // or send just { id: notification.id } if that’s all backend needs

      await this.notif.restoreDeleteJson(payload)   // <-- see service below
        .then((res: responseMSG | undefined) => {
          console.log(res);
          if(res && res.status === 'success') {
            this.notificationDialogComponent.notification('success', res.message);
          }
          else {
            this.notificationDialogComponent.notification('error', 'Failed to restore the item!');
          }
        })
        .catch((error) => {
          console.error(error);
          this.notificationDialogComponent.notification('error', 'Failed to restore the item!');
          this.progress.stop();
        })
        .finally(() => {
          this.progress.complete();
          this.loading = false;
          this.confirm = null;
          this.backToList();
        });

    } catch(e: any) {
      this.loading = false;
      this.error = e?.message || 'Failed to restore the item.';
      console.error('Error: ' + e);
    }
  }

  /**
   * Permanent delete action:
   * - Calls your backend (adapt URL if needed)
   * - On success, navigates back to Deleted Items
   */
  protected async permanentDelete(id: string) {
    try {
      this.loading = true;
      await firstValueFrom(
        this.http.post(`/api-notification/permanent-delete`, {id}, {headers: this.authHeaders()})
      );
      this.loading = false;
      this.confirm = null;
      this.backToList();
    } catch(e: any) {
      this.loading = false;
      this.error = e?.message || 'Failed to permanently delete the item.';
    }
  }

  /* ───────────────────────── internals ───────────────────────── */

  /** Resolve the selected notification (from cache or by refetch) */
  private async resolveNotification(id: string) {
    this.loading = true;
    this.error = null;

    // Try from cache first
    const cached = await firstValueFrom(this.notif.itemById$(id));
    if(cached) {
      this.setNotification(cached);
      this.loading = false;
      return;
    }

    // If not found, pull a fresh page
    try {
      await this.notif.load({page: 0, limit: 50});
      const after = await firstValueFrom(this.notif.itemById$(id));
      if(after) {
        this.setNotification(after);
        this.loading = false;
        return;
      }
      this.error = 'Selected item not found in recent list.';
    } catch(e: any) {
      this.error = e?.message || 'Failed to load deleted item.';
    } finally {
      this.loading = false;
    }
  }

  /** Keep one place to normalize + extract a clean metadata grid */
  private setNotification(n: Notification) {
    this.notification = n;
    this.primaryMeta = this.extractPrimaryMeta(n);
  }

  /** Pull friendly “key” fields out of arbitrary metadata */
  private extractPrimaryMeta(n: Notification) {
    const meta = n.metadata || {};
    const candidates = [
      'propertyID', 'propertyId', 'propId',
      'tenantID', 'tenantId',
      'leaseID', 'leaseId',
      'username', 'user', 'owner',
      'title', 'status', 'state', 'reason', 'by', 'byUser', 'byRole',
    ];

    const rows: Array<{key: string; value: any}> = [];
    for(const key of candidates) {
      const v = meta[key];
      if(v !== undefined && v !== null && String(v).trim?.() !== '') {
        rows.push({key, value: v});
      }
    }

    const extras = Object.keys(meta)
      .filter((k) => !candidates.includes(k))
      .slice(0, 8);
    for(const k of extras) rows.push({key: k, value: meta[k]});

    return rows;
  }

  /** Build Authorization header if you keep tokens in localStorage */
  private authHeaders(): HttpHeaders {
    let token: string | null = null;
    try {
      token = localStorage.getItem('auth_token');
    } catch {}
    return token ? new HttpHeaders({Authorization: `Bearer ${token}`}) : new HttpHeaders();
  }

  /** Choose the best available image; fall back to dummy. */
  protected getUserImage(meta: Record<string, any>): string {
    // Strict-safe index-signature access everywhere
    const updated = meta?.['UpdatedUserData'];
    const user = meta?.['user'];

    const img1 = updated?.['image'];
    const img2 = user?.['image'];

    const chosen = (typeof img1 === 'string' && img1.trim())
      ? img1
      : (typeof img2 === 'string' && img2.trim() ? img2 : '');

    return chosen || this.dummyUserImg;
  }

  /** If the image URL 404s or fails, swap to dummy (prevents broken icon). */
  protected setFallback(ev: Event): void {
    const img = ev.target as HTMLImageElement | null;
    if(img && img.src !== this.dummyUserImg) {
      img.src = this.dummyUserImg;
    }
  }

  /** Pick a sensible display name from multiple possible locations. */
  protected getUserName(meta: Record<string, any>): string {
    const updated = meta?.['UpdatedUserData'];
    const user = meta?.['user'];

    const name1 = updated?.['name'];
    const name2 = user?.['name'];
    const user1 = updated?.['username'];
    const user2 = user?.['username'];
    const userFlat =
      (typeof meta?.['username'] === 'string' && meta?.['username'].trim())
        ? meta?.['username']
        : (typeof meta?.['owner'] === 'string' && meta?.['owner'].trim() ? meta?.['owner'] : undefined);

    const chosen =
      (typeof name1 === 'string' && name1.trim() && name1) ||
      (typeof name2 === 'string' && name2.trim() && name2) ||
      (typeof user1 === 'string' && user1.trim() && user1) ||
      (typeof user2 === 'string' && user2.trim() && user2) ||
      userFlat;

    return chosen || 'Unknown User';
  }
}
