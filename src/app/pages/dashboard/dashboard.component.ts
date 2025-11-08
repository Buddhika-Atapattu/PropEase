import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  AfterViewInit,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {ListMainPanelComponent} from '../../components/list-main-panel/list-main-panel.component';
import {CommonModule, isPlatformBrowser} from '@angular/common';
import {RouterModule, Router} from '@angular/router';
import {TopProgressBarComponent} from '../../components/top-progress-bar/top-progress-bar.component';
import {ModeChangerComponent} from '../../components/mode-changer/mode-changer.component';
import {UserInfoPanelComponent} from '../../components/user-info-panel/user-info-panel.component';
import {WindowsRefService} from '../../services/windowRef/windowRef.service';
import {ExpandableService} from '../../services/expandable/expandable.service';
import {
  AuthService,
  LoggedUserType,
} from '../../services/auth/auth.service';
import {Subscription} from 'rxjs';
import {SkeletonLoaderComponent} from '../../components/shared/skeleton-loader/skeleton-loader.component';
import {ActivityTrackerService} from '../../services/activityTacker/activity-tracker.service';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatBadgeModule} from '@angular/material/badge';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatMenuModule} from '@angular/material/menu';
import {NotificationComponent} from '../../components/shared/notification/notification';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ListMainPanelComponent,
    RouterModule,
    ModeChangerComponent,
    TopProgressBarComponent,
    UserInfoPanelComponent,
    SkeletonLoaderComponent,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatTooltipModule,
    MatMenuModule,
    NotificationComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  protected menuOpen = false;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  protected isExpanded = true;
  private modeSub: Subscription | null = null;
  private expandSub: Subscription | null = null;
  protected user: LoggedUserType | null = null;
  protected isLoading = true;
  protected isMobile = false;

  protected isMobileMenuOpen = false;

  // NOTE: public/… paths (no leading slash) for Electron-friendly relative resolution
  private readonly DEFAULT_USER_IMAGE = 'Images/user-images/dummy-user/dummy-user.jpg';
  private readonly DEFAULT_COVER_NO_BG_IMAGE = 'Images/company-images/cover-no-bg.webp';

  constructor (
    private windowRef: WindowsRefService,
    private authService: AuthService,
    private expandableService: ExpandableService,
    private router: Router,
    private activityTrackerService: ActivityTrackerService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cd: ChangeDetectorRef,
    private zone: NgZone,
    private dom: DomSanitizer
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    const logged = this.authService.getLoggedUser;
    if(logged) {
      this.user = logged;
      setTimeout(() => {this.isLoading = false;}, 500);
      // Normalize any accidental absolute /public/... to public/...
      if(typeof this.user.image === 'string') {
        this.user.image = this.normalizePublicPath(this.user.image);
      }
    }
  }

  async ngOnInit() {
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {this.mode = val;});
      this.expandSub = this.expandableService.isExpanded$.subscribe((expanded) => {this.isExpanded = expanded;});
    }

    const role = this.authService.getLoggedUser?.role;
    if(role && this.isBrowser) {
      await this.authService.sendUserCredentialsAndGetUserData(role);
      await this.authService.afterUserLoggedInOperatios();
    }

    if(this.windowRef) {
      this.windowRef.windowWidth$.subscribe((width) => {
        this.zone.run(() => {
          this.isMobile = width < 768;
          this.cd.detectChanges();
        });
      });
    }
  }

  ngAfterViewInit(): void {}

  protected openMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  /** Always returns a SafeUrl for the default local asset in public/. */
  private get defaultSafeUserImage(): SafeUrl {
    return this.dom.bypassSecurityTrustUrl(this.DEFAULT_USER_IMAGE);
  }

  /** Logo from public/. */
  protected get noBGImage(): SafeUrl {
    return this.dom.bypassSecurityTrustUrl(this.DEFAULT_COVER_NO_BG_IMAGE);
  }

  /** Ensure paths use "public/…" (no leading slash). */
  private normalizePublicPath(path: string): string {
    const trimmed = path.trim();
    if(!trimmed) return this.DEFAULT_USER_IMAGE;
    // Turn "/public/..." into "public/..."
    if(/^\/public\//i.test(trimmed)) return trimmed.replace(/^\/+/, '');
    return trimmed;
  }

  /**
   * Electron-friendly sanitizer for <img [src]>:
   * - Accepts relative "public/…", "./public/…", "../public/…"
   * - Accepts http/https/blob and data:image/*
   * - Rejects javascript: and unknown schemes
   * - Returns SafeUrl
   */
  protected sanitizeURL(url: unknown): SafeUrl {
    if(typeof url !== 'string') return this.defaultSafeUserImage;

    let input = url.trim();
    if(!input) return this.defaultSafeUserImage;

    // Normalize any /public/... to public/...
    if(/^\/public\//i.test(input)) input = input.replace(/^\/+/, '');

    const lower = input.toLowerCase();
    if(lower.startsWith('javascript:')) return this.defaultSafeUserImage;

    // Allow common relative public paths
    const isRelativePublic =
      /^(public\/|\.{1,2}\/public\/)/i.test(input);

    if(!isRelativePublic) {
      // Validate absolute URLs (browser only)
      if(this.isBrowser) {
        try {
          const u = new URL(input);
          const okProto = ['http:', 'https:', 'blob:', 'data:', 'file:'].includes(u.protocol);
          if(!okProto) return this.defaultSafeUserImage;
          if(u.protocol === 'data:' && !/^data:image\//i.test(input)) {
            return this.defaultSafeUserImage;
          }
        } catch {
          return this.defaultSafeUserImage;
        }
      } else {
        // SSR conservative check
        const ok = /^(https?:|blob:|data:image\/|file:)/i.test(input);
        if(!ok) return this.defaultSafeUserImage;
      }
    }
    // At this point it's a known-safe scheme or relative public path.
    return this.dom.bypassSecurityTrustUrl(input);
  }

  protected onProfilePanelClosed(_closed: boolean) {
    this.menuOpen = false;
    this.isMobileMenuOpen = false;
  }

  protected mobileMenuOpen(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  protected mobileMenuOpenFromLink(input: boolean): void {
    this.isMobileMenuOpen = !input;
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.expandSub?.unsubscribe();
  }
}
