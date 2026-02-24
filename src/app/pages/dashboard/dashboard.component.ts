// Path: src/app/pages/dashboard/dashboard.component.ts
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  Event as RouterEvent,
  RouterModule
} from '@angular/router';

import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { BreadcrumbsComponent } from '../../components/shared/breadcrumbs/breadcrumbs.component';
import { NotificationComponent } from '../../components/shared/notification/notification';
import { SkeletonLoaderComponent } from '../../components/shared/skeleton-loader/skeleton-loader.component';
import { TopProgressBarComponent } from '../../components/top-progress-bar/top-progress-bar.component';
import { UserInfoPanelComponent } from '../../components/user-info-panel/user-info-panel.component';
import { User } from '../../services/APIs/apis.service';
import { AssetUrlService } from '../../services/asset/asset-url.service';
import { AuthService } from '../../services/auth/auth.service';
import { ExpandableService } from '../../services/expandable/expandable.service';
import { WindowsRefService } from '../../services/windowRef/windowRef.service';

/* Fullscreen menu */
import {
  FullscreenMenuComponent, FullscreenMenuProfile
} from '../../components/fullscreen-menu/fullscreen-menu.component';

/* list-main-panel only for its static menuLists (shared source) + link type*/
import { FullscreenMenuLink, ListMainPanelComponent } from '../../components/list-main-panel/list-main-panel.component';
import { PreloaderComponent } from '../../components/shared/preloader/preloader.component';

// ModeChangerComponent,
@Component( {
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,

    /* header + panels */

    TopProgressBarComponent,
    UserInfoPanelComponent,
    NotificationComponent,
    BreadcrumbsComponent,
    PreloaderComponent,

    /* list + fullscreen menu */
    ListMainPanelComponent,
    FullscreenMenuComponent,

    /* material bits */
    SkeletonLoaderComponent,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatTooltipModule,
    MatMenuModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: [ './dashboard.component.scss' ],
} )
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild( 'userDesktopImage', { static: false } )
  private userimage?: ElementRef<HTMLImageElement>;
  @ViewChild( PreloaderComponent, { static: false } ) preloaderComponent?: PreloaderComponent;

  /* UI state */
  protected menuOpen = false;           // user profile panel
  protected isMobileMenuOpen = false;   // FULLSCREEN MENU (mobile)
  protected mode: boolean | null = null;
  protected isExpanded = true;
  protected isMobile = false;
  private routerSub: Subscription | null = null;

  /* data */
  protected user: User | null = null;
  protected isLoading = true;
  protected currentFullURL = '';
  protected linkLists: FullscreenMenuLink[] = [];
  protected userProfileData!: FullscreenMenuProfile;

  /* env */
  protected isBrowser: boolean;

  private modeSub: Subscription | null = null;
  private expandSub: Subscription | null = null;

  protected collapsed: boolean = false;


  // Public asset fallbacks (handled by AssetUrlService)
  private readonly DEFAULT_USER_IMAGE = 'Images/user-images/dummy-user/dummy-user.jpg';
  private readonly DEFAULT_COVER_NO_BG_IMAGE = 'Images/company-images/logo/logo/without-bg-50-x-50.png';

  public constructor (
    private readonly windowRef: WindowsRefService,
    private readonly authService: AuthService,
    private readonly expandableService: ExpandableService,
    private readonly router: Router,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly cd: ChangeDetectorRef,
    private readonly zone: NgZone,
    private readonly dom: DomSanitizer,
    private readonly assets: AssetUrlService,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    /* Logged user bootstrap */
    const logged = this.authService.getLoggedUser;
    if ( logged ) {
      this.user = logged;
      this.userProfileData = {
        name: this.user.name ?? 'User',
        email: this.user.email ?? '',
        avatarSrc: this.user.image as string ?? 'Images/user-images/dummy-user/dummy-user.jpg',
      };
      setTimeout( () => ( this.isLoading = false ), 300 );
    }

    /* Source menu links from ListMainPanelComponent static registry */
    // Ensure your ListMainPanelComponent exposes: `public static menuLists: FullscreenMenuLink[]`
    this.linkLists = ( ListMainPanelComponent as any ).menuLists ?? [];

    this.routerSub = this.router.events.subscribe( ( event: RouterEvent ) => {
      if ( event instanceof NavigationStart ) {
        // Optional: only react for dashboard child routes
        if ( !event.url.startsWith( '/dashboard' ) ) return;

        this.preloaderComponent?.start();
      }

      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        // small delay so it doesn't flicker on fast routes
        setTimeout( () => {
          this.preloaderComponent?.complete();
        }, 200 );
      }
    } );
  }

  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => ( this.mode = val ) );
      this.expandSub = this.expandableService.isExpanded$.subscribe(
        ( expanded ) => ( this.isExpanded = expanded ),
      );

      /* mobile detection with resize stream */
      this.windowRef.windowWidth$.subscribe( ( width ) => {
        this.zone.run( () => {
          this.isMobile = width < 768;
          // this.cd.detectChanges();
        } );
      } );
    }
  }

  ngAfterViewInit(): void {}

  /* URLs via AssetUrlService */

  protected detectCollapse( value: boolean ): void {
    this.collapsed = value;
  }

  protected get noBGImage(): SafeUrl {
    const url = this.assets.publicAssetUrl( this.DEFAULT_COVER_NO_BG_IMAGE );
    return this.dom.bypassSecurityTrustUrl( url );
  }

  protected detectImageError( event: Event ) {
    const imgElement = event.target as HTMLImageElement;

    // Prevent infinite loop if fallback image also fails
    if ( imgElement.src.includes( this.DEFAULT_USER_IMAGE ) ) {
      return;
    }

    // Apply fallback image
    imgElement.src = this.DEFAULT_USER_IMAGE;
  }

  protected sanitizeURL( url: unknown ): SafeUrl {
    const raw = ( typeof url === 'string' && url.trim() )
      ? url.trim()
      : this.assets.userAvatar( this.user?.username || ( this.user as any )?._id );

    if ( /^(https?:|blob:)/i.test( raw ) ) return this.dom.bypassSecurityTrustUrl( raw );
    if ( /^data:/i.test( raw ) ) {
      const safe = /^data:image\//i.test( raw )
        ? raw
        : this.assets.publicAssetUrl( this.DEFAULT_USER_IMAGE );
      return this.dom.bypassSecurityTrustUrl( safe );
    }
    if ( /^javascript:/i.test( raw ) ) {
      return this.dom.bypassSecurityTrustUrl( this.assets.publicAssetUrl( this.DEFAULT_USER_IMAGE ) );
    }

    const rel = raw.replace( /^\/+/, '' );
    const lower = rel.toLowerCase();
    const isUploads = lower.startsWith( 'uploads/' ) || lower.includes( '/uploads/' );
    const isBucket =
      lower.startsWith( 'users/' ) ||
      lower.startsWith( 'tenants/' ) ||
      lower.startsWith( 'leases/' ) ||
      lower.startsWith( 'properties/' ) ||
      lower.startsWith( 'richtext/' );

    if ( isUploads || isBucket ) {
      const abs = this.assets.absoluteMediaUrl( rel );
      return this.dom.bypassSecurityTrustUrl( abs );
    }

    const pub = this.assets.publicAssetUrl( rel );
    return this.dom.bypassSecurityTrustUrl( pub );
  }

  /* UI handlers */

  protected onProfilePanelClosed( _closed: boolean ): void {
    this.menuOpen = false;
  }


  protected onMenuNavigate( e: { p: string | null; c: string | null; g: string | null; } ): void {
    if ( e.p && e.c && e.g ) { this.router.navigate( [ '/dashboard', e.p, e.c, e.g ] ); return; }
    if ( e.p && e.c ) { this.router.navigate( [ '/dashboard', e.p, e.c ] ); return; }
    if ( e.p ) { this.router.navigate( [ '/dashboard', e.p ] ); return; }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.expandSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.routerSub = null;
  }
}
