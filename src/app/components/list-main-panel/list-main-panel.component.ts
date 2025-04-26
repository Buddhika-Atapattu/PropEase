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
import { ExpandableService } from '../../../services/expandable/expandable.service';

interface PageLinkLists {
  url: string;
  mat_icon: string;
  icon_text: string;
}

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
  private expandSub: Subscription | null = null;
  protected linkLists: PageLinkLists[] = [
    {
      url: 'home',
      mat_icon: 'home',
      icon_text: 'Home',
    },
    {
      url: 'properties',
      mat_icon: 'business',
      icon_text: 'Properties',
    },
    {
      url: 'tenat',
      mat_icon: 'business',
      icon_text: 'Properties',
    },
  ];

  isExpanded = signal(true);
  // delayedExpandedClass = signal(false);

  constructor(
    private windowRef: WindowsRefService,
    private expandableService: ExpandableService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });

      this.expandSub = this.expandableService.isExpanded$.subscribe(
        (expanded) => {
          console.log('Expanded:', expanded);
          this.isExpanded.set(expanded);
          this.applyPanelState(expanded);
        }
      );
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.expandSub?.unsubscribe();
  }

  // togglePanel(): void {
  //   const expanded = !this.isExpanded();
  //   this.expandableService.setExpanded(expanded);
  //   this.isExpanded.set(expanded);
  //   this.applyPanelState(expanded);
  // }

  togglePanel(): void {
    const expanded = !this.isExpanded();
    this.expandableService.setExpanded(expanded);
    this.isExpanded.set(expanded);
    this.applyPanelState(expanded);

    console.log('toggle status', this.isExpanded());

    if (this.isBrowser) {
      if (this.isExpanded() === true && isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          const iconText = document.querySelectorAll(
            '.delay-expand'
          ) as NodeListOf<HTMLElement>;
          if (!iconText) return;
          iconText.forEach((element) => {
            element.style.opacity = '1';
            element.style.display = 'inline';
            element.style.transition = 'opacity 0.2s ease';
          });
          console.log('Got it after expansion');
        }, 0);
      } else {
        if (this.isExpanded() === false && isPlatformBrowser(this.platformId)) {
          const iconText = document.querySelectorAll(
            '.delay-expand'
          ) as NodeListOf<HTMLElement>;
          if (!iconText) return;
          iconText.forEach((element) => {
            element.style.opacity = '0';
            element.style.display = 'none';
          });
        }
      }
    }
  }

  applyPanelState(isExpanded: boolean): void {
    const sidePanel = document.querySelector('.side-panel') as HTMLElement;
    if (!sidePanel) return;

    // sidePanel.style.transition = 'all 2s ease';
    if (isExpanded) {
      sidePanel.classList.remove('side-panel-collapsed');
    } else {
      sidePanel.classList.add('side-panel-collapsed');
    }
  }

  navigateTo(path: string): void {
    this.router.navigate(['/dashboard', path]);
  }
}
