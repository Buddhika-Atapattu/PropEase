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
  private hasChecked = new BehaviorSubject(false);
  public readonly hasChecked$ = this.hasChecked.asObservable();

  public readonly isOnline$ = this.status$.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.monitorNetworkStatus();
  }

  private monitorNetworkStatus(): void {
    if (!this.isBrowser) return;

    const googlePingUrl = 'https://www.google.com/generate_204';

    const pingGoogle$ = () =>
      this.http.get(googlePingUrl, { responseType: 'text' }).pipe(
        mapTo(true),
        catchError(() => of(false))
      );

    // 1. Check on app start
    // pingGoogle$().subscribe((status) => this.status$.next(status));

    pingGoogle$().subscribe((status) => {
      this.status$.next(status);
      this.hasChecked.next(true);
    });

    // 2. Re-check every 60 seconds
    timer(60000, 60000)
      .pipe(switchMap(() => pingGoogle$()))
      .subscribe((status) => this.status$.next(status));

    // 3. React to browser events, but verify with ping
    merge(fromEvent(window, 'online'), fromEvent(window, 'offline'))
      .pipe(switchMap(() => pingGoogle$()))
      .subscribe((status) => this.status$.next(status));
  }
}
