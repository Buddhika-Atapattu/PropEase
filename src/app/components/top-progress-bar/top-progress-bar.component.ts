import {
  Component,
  Inject,
  PLATFORM_ID,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
} from '@angular/router';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-top-progress-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="isBrowser">
      <div class="progress-bar-container" *ngIf="loading">
        <div class="progress-bar"></div>
      </div>
    </ng-container>
  `,
  styleUrl: './top-progress-bar.component.scss',
  host: {ngSkipHydration: ''},
})
export class TopProgressBarComponent implements OnInit, OnDestroy {
  loading = false;
  isBrowser = false;
  private routerSub!: Subscription;

  constructor (
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if(this.isBrowser) {
      this.routerSub = this.router.events.subscribe((event) => {
        if(event instanceof NavigationStart) {
          this.loading = true;
        } else if(
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError
        ) {
          setTimeout(() => (this.loading = false), 300);
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }
}
