import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  signal,
  Output,
  EventEmitter,
  ElementRef,
  Input,
} from '@angular/core';
import { WindowsRefService } from '../../services/windowRef/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Router, NavigationEnd } from '@angular/router';
import { ExpandableService } from '../../services/expandable/expandable.service';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth/auth.service';
import { LoggedUserType } from '../../services/APIs/apis.service';

interface PageLinkLists {
  url: string | null;
  mat_icon: string;
  icon_text: string;
  toolTip?: string;
  sub?: PageLinkLists[] | null;
}

@Component({
  selector: 'app-list-main-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './list-main-panel.component.html',
  styleUrl: './list-main-panel.component.scss',
})
export class ListMainPanelComponent implements OnInit, OnDestroy {
  @Output() closeMobileMenu = new EventEmitter<boolean>();
  @Input() isMobile: boolean = false;
  mode: boolean | null = null;
  isBrowser: boolean;
  private modeSub: Subscription | null = null;
  private expandSub: Subscription | null = null;
  protected currecntURL: string = '';
  protected loggedUser: LoggedUserType | null = null;
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
      url: 'users',
      mat_icon: 'users-icon',
      icon_text: 'Users',
      toolTip: 'Users',
    },
    {
      url: 'tenant',
      mat_icon: 'tenant-icon',
      icon_text: 'Tenants',
      toolTip: 'Tenants',
      sub: [
        {
          url: 'tenant-home',
          mat_icon: 'home-icon',
          icon_text: 'Home',
          toolTip: 'Home',
        },
        {
          url: null,
          mat_icon: 'payment-icon',
          icon_text: 'Payments',
          toolTip: 'Payments',
          sub: [
            {
              url: 'payments-list',
              mat_icon: 'bill-list-icon',
              icon_text: 'List',
              toolTip: 'List',
            },
            {
              url: 'payments-upload-proof',
              mat_icon: 'certification-icon',
              icon_text: 'Upload',
              toolTip: 'Upload',
            },
          ],
        },
        {
          url: null,
          mat_icon: 'complaints-icon',
          icon_text: 'Complaints',
          toolTip: 'Complaints',
          sub: [
            {
              url: 'complaints-create',
              mat_icon: 'create-icon',
              icon_text: 'Create',
              toolTip: 'Create',
            },
            {
              url: 'complaints-status-view',
              mat_icon: 'certification-icon',
              icon_text: 'Upload',
              toolTip: 'Upload',
            },
          ],
        },
        {
          url: 'documents',
          mat_icon: 'documents-icon',
          icon_text: 'Documents',
          toolTip: 'Documents',
        },
        {
          url: 'notifications',
          mat_icon: 'notifications-icon',
          icon_text: 'Notifications',
          toolTip: 'Notifications',
        },
        {
          url: 'activity-log',
          mat_icon: 'log-icon',
          icon_text: 'Log',
          toolTip: 'Log',
        },
      ],
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
      url: 'access-control',
      mat_icon: 'access-icon',
      icon_text: 'Access Control',
      toolTip: 'Access Control',
    },
  ];

  isExpanded = signal(true);
  // delayedExpandedClass = signal(false);

  protected activeParentRoute: string = '';
  protected currentFullURL: string = '';
  private currentOpenIndex: number | null = null;

  constructor(
    private windowRef: WindowsRefService,
    private expandableService: ExpandableService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private authService: AuthService,
    private elementRef: ElementRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.loggedUser = this.authService.getLoggedUser;

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
    // users icon
    this.matIconRegistry.addSvgIcon(
      'users-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/users.svg'
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
    // bill list icon
    this.matIconRegistry.addSvgIcon(
      'bill-list-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/bill-list.svg'
      )
    );
    // certification icon
    this.matIconRegistry.addSvgIcon(
      'certification-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/certification.svg'
      )
    );
    // create icon
    this.matIconRegistry.addSvgIcon(
      'create-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/create.svg'
      )
    );
    // documents icon
    this.matIconRegistry.addSvgIcon(
      'documents-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/documents.svg'
      )
    );
    // notification icon
    this.matIconRegistry.addSvgIcon(
      'notifications-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/notification.svg'
      )
    );
    // log icon
    this.matIconRegistry.addSvgIcon(
      'log-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl('/Images/Icons/log.svg')
    );
    // complaints icon
    this.matIconRegistry.addSvgIcon(
      'complaints-icon',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/complaints.svg'
      )
    );

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentFullURL = event.urlAfterRedirects;
        const urlArray: Array<string> = event.urlAfterRedirects.split('/');
        const dashboardIndex = urlArray.indexOf('dashboard');
        const url: string = urlArray[urlArray.length - 1];
        this.activeParentRoute =
          dashboardIndex !== -1 && urlArray.length > dashboardIndex + 1
            ? urlArray[dashboardIndex + 1]
            : '';
        this.currecntURL = url;
      });
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });

      this.expandSub = this.expandableService.isExpanded$.subscribe(
        (expanded) => {
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

  protected togglePanel(): void {
    const expanded = !this.isExpanded();
    this.expandableService.setExpanded(expanded);
    this.isExpanded.set(expanded);
    this.applyPanelState(expanded);

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
        }, 0);
      } else {
        if (this.isExpanded() === false && isPlatformBrowser(this.platformId)) {
          this.toggleDropdown(this.currentOpenIndex as number);
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

  protected applyPanelState(isExpanded: boolean): void {
    const sidePanel = document.querySelector('.side-panel') as HTMLElement;
    if (!sidePanel) return;

    // sidePanel.style.transition = 'all 2s ease';
    if (isExpanded) {
      sidePanel.classList.remove('side-panel-collapsed');
    } else {
      sidePanel.classList.add('side-panel-collapsed');
    }
  }

  protected isSubItemActive(
    parent: string | null,
    subItemUrl: string | null,
    childItemUrl?: string | null
  ): boolean {
    if (parent && subItemUrl && childItemUrl) {
      return this.currentFullURL.includes(
        `/${parent}/${subItemUrl}/${childItemUrl}`
      );
    } else if (parent && subItemUrl === null && childItemUrl) {
      return this.currentFullURL.includes(`/${parent}/${childItemUrl}`);
    }
    return false;
  }

  protected navigateTo(
    parentPath: string | null,
    childPath: string | null,
    childChildrenPath: string | null
  ): void {
    this.closeMobileMenu.emit(true);
    if (parentPath && childPath === null && childChildrenPath) {
      this.router.navigate(['/dashboard', parentPath, childChildrenPath]);
    } else if (parentPath && childPath) {
      this.router.navigate(['/dashboard', parentPath, childPath]);
    } else {
      this.router.navigate(['/dashboard', parentPath]);
    }
  }

  //<=================== Dropdown Menu =====================>

  protected toggleDropdown(index: number): void {
    this.currentOpenIndex = index;

    const listItems = this.elementRef.nativeElement.querySelectorAll('ul > li');

    const element = listItems[index] as HTMLElement;
    if (!element) return;

    const icon = element.querySelector(
      'button > span > span.dropdown-icon > i'
    ) as HTMLElement;

    const isCurrentlyOpen = element.classList.contains('open');

    // Close all other dropdowns
    this.elementRef.nativeElement
      .querySelectorAll('ul > li.open')
      .forEach((el: Element) => {
        if ((el as HTMLElement).classList.contains('open')) {
          (el as HTMLElement).classList.remove('open');
        }
        const openIcon = el.querySelector(
          'button > span > span.dropdown-icon > i'
        ) as HTMLElement;
        if (openIcon) {
          openIcon.classList.remove('fa-chevron-up');
          openIcon.classList.add('fa-chevron-down');
        }
      });

    // Toggle current dropdown
    if (!isCurrentlyOpen) {
      element.classList.add('open');
      if (icon) {
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
      }
    } else {
      // Already closed by bulk close, just ensure icon is reverted
      if (icon) {
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
      }
    }
  }

  protected toggleDropdownByElement(event: Event): void {
    event.stopPropagation();
    const btn = event.currentTarget as HTMLElement;
    const li = btn.closest('li');
    if (!li) return;

    const icons = li.querySelectorAll('button > span > span.dropdown-icon > i');
    const buttons = li.querySelectorAll('button.sub-btn');

    const isOpen = li.classList.contains('open');

    if (isOpen) {
      // Close current
      li.classList.remove('open');

      if (icons) {
        icons.forEach((icon) => {
          icon.classList.remove('fa-chevron-up');
          icon.classList.add('fa-chevron-down');
        });
      }

      if (buttons) {
        buttons.forEach((button) => {
          if (button.classList.contains('active')) {
            button.classList.remove('active');
          }
        });
      }
    } else {
      // Close siblings
      const siblings = li.parentElement?.children;
      if (siblings) {
        Array.from(siblings).forEach((sibling) => {
          if (sibling !== li && sibling.classList.contains('open')) {
            sibling.classList.remove('open');
            const siblingIcons = sibling.querySelectorAll(
              'button > span > span.dropdown-icon > i'
            );
            const siblingButtons = sibling.querySelectorAll('button');

            siblingIcons.forEach((icon) => {
              icon.classList.remove('fa-chevron-up');
              icon.classList.add('fa-chevron-down');
            });

            if (siblingButtons) {
              siblingButtons.forEach((button) => {
                if (button.classList.contains('active')) {
                  button.classList.remove('active');
                }
              });
            }
          }
        });
      }

      // Open clicked
      li.classList.add('open');

      if (icons) {
        icons.forEach((icon) => {
          icon.classList.remove('fa-chevron-down');
          icon.classList.add('fa-chevron-up');
        });
      }

      if (buttons) {
        buttons.forEach((button) => {
          if (!button.classList.contains('active')) {
            button.classList.add('active');
          }
        });
      }
    }
  }
}
