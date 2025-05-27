import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  Input,
  AfterViewInit,
} from '@angular/core';
import { WindowsRefService } from '../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { filter, Subscription } from 'rxjs';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { APIsService, UsersType } from '../../../services/APIs/apis.service';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { SkeletonLoaderComponent } from '../../components/shared/skeleton-loader/skeleton-loader.component';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import { AuthService, BaseUser } from '../../../services/auth/auth.service';
import { PropertyFilterDialogComponent } from '../../components/dialogs/property-filter-dialog/property-filter-dialog.component';
import { BackEndPropertyData } from '../../../services/property/property.service';

@Component({
  selector: 'app-property-view-card',
  imports: [CommonModule, MatIconModule, SkeletonLoaderComponent],
  templateUrl: './property-view-card.component.html',
  styleUrl: './property-view-card.component.scss',
})
export class PropertyViewCardComponent implements OnInit, AfterViewInit {
  @Input() property: BackEndPropertyData | null = null;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  protected LOGGED_USER: BaseUser | null = null;
  private modeSub: Subscription | null = null;
  protected loading: boolean = true;
  private routeSub: Subscription | null = null;
  private routerSub: Subscription | null = null;
  

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private APIsService: APIsService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private crypto: CryptoService
  ) {
    this.LOGGED_USER = this.authService.getLoggedUser;
    this.isBrowser = isPlatformBrowser(this.platformId);
    setInterval(() => {
      this.loading = false;
    }, 500);
    this.iconMaker();
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }

    this.routeSub = this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
  }

  ngAfterViewInit() {
    // Logic to execute after the view has been initialized
  }

  private iconMaker() {
    const iconMap = [
      { name: 'view', path: '/Images/Icons/view.svg' },
      { name: 'edit', path: '/Images/Icons/pencil-square.svg' },
      { name: 'delete', path: '/Images/Icons/delete.svg' },
      { name: 'add-new-user', path: '/Images/Icons/add-new-user.svg' },
      { name: 'search', path: '/Images/Icons/search.svg' },
      { name: 'filter', path: '/Images/Icons/filter.svg' },
    ];

    for (let icon of iconMap) {
      this.matIconRegistry.addSvgIcon(
        icon.name.toString(),
        this.domSanitizer.bypassSecurityTrustResourceUrl(icon.path.toString())
      );
    }
  }

  protected gotoTheProperty(propertyID: string) {
    if (this.isBrowser) {
      this.router.navigate(['/dashboard/property-view', propertyID]);
    }
  }
}
