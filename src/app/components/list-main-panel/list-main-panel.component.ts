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
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { MatTooltipModule } from '@angular/material/tooltip';

interface PageLinkLists {
  url: string;
  mat_icon: string;
  icon_text: string;
  toolTip?: string;
}

@Component({
  selector: 'app-list-main-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
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
      mat_icon: 'home-icon',
      icon_text: 'Home',
      toolTip: 'Home',
    },
    {
      url: 'properties',
      mat_icon: 'property-icon',
      icon_text: 'Properties',
      toolTip: 'Properties',
    },
    {
      url: 'tenat',
      mat_icon: 'tenant-icon',
      icon_text: 'Tenants',
      toolTip: 'Tenants',
    },
    {
      url: 'agent',
      mat_icon: 'agent-icon',
      icon_text: 'Agents',
      toolTip: 'Agents',
    },
    {
      url: 'report',
      mat_icon: 'report-icon',
      icon_text: 'Reports',
      toolTip: 'Reports',
    },
    {
      url: 'owner',
      mat_icon: 'owner-icon',
      icon_text: 'Owners',
      toolTip: 'Owners',
    },
    {
      url: 'payments',
      mat_icon: 'payment-icon',
      icon_text: 'Payments',
      toolTip: 'Payments',
    },
    {
      url: 'accessControl',
      mat_icon: 'access-icon',
      icon_text: 'Access Control',
      toolTip: 'Access Control',
    },
  ];

  isExpanded = signal(true);
  // delayedExpandedClass = signal(false);

  constructor(
    private windowRef: WindowsRefService,
    private expandableService: ExpandableService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    // home icon
    this.matIconRegistry.addSvgIcon(
      'home-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl('/Images/Icons/home.svg')
    );
    // property icon
    this.matIconRegistry.addSvgIcon(
      'property-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/property.svg'
      )
    );
    // tenant icon
    this.matIconRegistry.addSvgIcon(
      'tenant-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/tenant.svg'
      )
    );
    // agent icon
    this.matIconRegistry.addSvgIcon(
      'agent-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/agents.svg'
      )
    );
    // report icon
    this.matIconRegistry.addSvgIcon(
      'report-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/report.svg'
      )
    );
    // owner icon
    this.matIconRegistry.addSvgIcon(
      'owner-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/owner.svg'
      )
    );
    // payment icon
    this.matIconRegistry.addSvgIcon(
      'payment-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/payments.svg'
      )
    );
    // access icon
    this.matIconRegistry.addSvgIcon(
      'access-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/access-control.svg'
      )
    );
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
