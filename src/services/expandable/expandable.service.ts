import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ExpandableService {
  private isBrowser: boolean;
  private isExpandedSubject = new BehaviorSubject<boolean>(true);
  private isExpandedStorageKey = 'isExpanded';

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      // const storedValue = localStorage.getItem(this.isExpandedStorageKey);
      // const value = storedValue !== null ? JSON.parse(storedValue) : true;
      // this.isExpandedSubject.next(value);
    }
  }

  /** Getter: Always the current value */
  get isExpanded(): boolean {
    return this.isExpandedSubject.value;
  }

  /** Getter: Observable to subscribe */
  get isExpanded$() {
    return this.isExpandedSubject.asObservable();
  }

  /** Toggle the panel expansion */
  toggle(): void {
    const newExpandState = !this.isExpandedSubject.value;
    this.updateState(newExpandState);
  }

  /** Set expand/collapse explicitly */
  setExpanded(value: boolean): void {
    this.updateState(value);
  }

  /** Internal method to update state */
  private updateState(value: boolean): void {
    this.isExpandedSubject.next(value);

    if (this.isBrowser) {
      // localStorage.setItem(this.isExpandedStorageKey, JSON.stringify(value));
    }
  }
}
