import {Injectable, inject, PLATFORM_ID} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {isPlatformBrowser} from '@angular/common';
import {BehaviorSubject} from 'rxjs';
import {io, Socket} from 'socket.io-client';

export interface RealtimeNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  meta?: Record<string, any>;
  createdAt: string;
  // enriched client-side (optional):
  isRead?: boolean;
  deliveryId?: string;
}


export interface DeliveryItem {
  _id: string;                  // deliveryId
  isRead: boolean;
  deliveredAt: string;
  notification: {
    _id: string;
    type: string;
    title: string;
    body: string;
    meta?: Record<string, any>;
    createdAt: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private socket: Socket | null = null;

  private _items$ = new BehaviorSubject<RealtimeNotification[]>([]);
  items$ = this._items$.asObservable();

  /** set from your auth flow */
  initConnection(apiBase: string, auth: {userId?: string; token?: string}) {
    if(!isPlatformBrowser(this.platformId)) return; // SSR-safe
    if(this.socket) return; // already connected

    this.socket = io(apiBase, {
      transports: ['websocket'],
      auth,                // { userId }  OR  { token }
      withCredentials: true
    });

    this.socket.on('connect', () => {
      // console.log('socket connected');
    });

    this.socket.on('notification:new', (n: RealtimeNotification) => {
      // Prepend, keep max ~100
      const list = [n, ...this._items$.value].slice(0, 100);
      this._items$.next(list);
    });

    this.socket.on('disconnect', () => { /* auto-reconnect by default */});
  }

  /** initial load from REST */
  loadInitial() {
    return this.http.get<DeliveryItem[]>('/api-notification/my')
      .subscribe(rows => {
        const mapped: RealtimeNotification[] = rows.map(r => ({
          id: r.notification._id,
          type: r.notification.type,
          title: r.notification.title,
          body: r.notification.body,
          meta: r.notification.meta,
          createdAt: r.notification.createdAt,
          isRead: r.isRead,
          deliveryId: r._id
        }));
        this._items$.next(mapped);
      });
  }

  markRead(deliveryId: string) {
    return this.http.patch(`/api-notification/my/${deliveryId}/read`, {})
      .subscribe(() => {
        this._items$.next(
          this._items$.value.map(n =>
            n.deliveryId === deliveryId ? {...n, isRead: true} : n
          )
        );
      });
  }

  unreadCount(): number {
    return this._items$.value.filter(n => !n.isRead).length;
  }

  /** optional clear on logout */
  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this._items$.next([]);
  }
}
