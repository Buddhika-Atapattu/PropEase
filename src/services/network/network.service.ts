// network.service.ts
import { Injectable, inject, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, fromEvent, merge, of, timer } from 'rxjs';
import { mapTo, startWith, switchMap, catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  private isBrowser: boolean;
  private http = inject(HttpClient);
  private status$ = new BehaviorSubject<boolean>(navigator.onLine);

  public readonly isOnline$ = this.status$.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.monitorNetworkStatus();
  }

  private monitorNetworkStatus(): void {
    if (this.isBrowser) {
      const online$ = fromEvent(window, 'online').pipe(mapTo(true));
      const offline$ = fromEvent(window, 'offline').pipe(mapTo(false));

      merge(online$, offline$)
        .pipe(startWith(navigator.onLine))
        .subscribe((status) => this.status$.next(status));

      timer(0, 60000)
        .pipe(
          switchMap(() =>
            this.http.get('/ping', { responseType: 'text' }).pipe(
              mapTo(true),
              catchError(() => of(false))
            )
          )
        )
        .subscribe((isReachable) => this.status$.next(isReachable));
    }
  }
}
