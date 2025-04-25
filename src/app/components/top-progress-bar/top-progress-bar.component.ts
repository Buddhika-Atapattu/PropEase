import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
} from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-top-progress-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="progress-bar-container" *ngIf="loading">
      <div class="progress-bar"></div>
    </div>
  `,
  styleUrl: './top-progress-bar.component.scss',
})
export class TopProgressBarComponent implements OnInit, OnDestroy {
  loading = false;
  private routerSub!: Subscription;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.routerSub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.loading = true;
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        setTimeout(() => (this.loading = false), 300); // smooth exit
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }
}
