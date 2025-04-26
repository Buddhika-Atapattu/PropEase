import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { WindowsRefService } from '../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

@Component({
  selector: 'app-list-main-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './list-main-panel.component.html',
  styleUrl: './list-main-panel.component.scss',
})
export class ListMainPanelComponent implements OnInit, OnDestroy {
  mode: boolean | null = null;
  isBrowser: boolean;
  private modeSub: Subscription | null = null;

  isExpanded = signal(true); // Using Angular signals for reactivity

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private routes: Router
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  togglePanel(): void {
    this.isExpanded.set(!this.isExpanded());
    const sidePanel = document.querySelector('.side-panel') as HTMLElement;

    if (!sidePanel) return;

    // First, clear any previous inline transition
    sidePanel.style.transition = 'all 2s ease';

    if (this.isExpanded()) {
      // Expanded - full size
      sidePanel.classList.remove('side-panel-collapsed');
    } else {
      // Collapsed - small icon size
      sidePanel.classList.add('side-panel-collapsed');
    }
  }

  navigateTo(path: string): void {
    this.routes.navigate(['/dashboard', path]);
  }
}
