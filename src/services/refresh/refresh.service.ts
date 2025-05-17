import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RefreshService {
  private refreshTrigger = new Subject<void>();
  refresh$ = this.refreshTrigger.asObservable();

  constructor() { }

  triggerRefresh() {
    this.refreshTrigger.next();
  }
}
