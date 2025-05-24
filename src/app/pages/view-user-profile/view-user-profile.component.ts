import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChildren,
  QueryList,
  ElementRef,
} from '@angular/core';
import { WindowsRefService } from '../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import { APIsService, BaseUser } from '../../../services/APIs/apis.service';
import { SkeletonLoaderComponent } from '../../components/shared/skeleton-loader/skeleton-loader.component';
import { UserInformationsComponent } from '../../components/tabs/user-informations/user-informations.component';
import { AccessabilitiesComponent } from '../../components/tabs/accessabilities/accessabilities.component';
import { DocumentsComponent } from '../../components/tabs/documents/documents.component';
import { ActivitiesComponent } from '../../components/tabs/activities/activities.component';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService } from '../../../services/auth/auth.service';
import { RefreshService } from '../../../services/refresh/refresh.service';

@Component({
  selector: 'app-view-user-profile',
  imports: [
    CommonModule,
    SkeletonLoaderComponent,
    UserInformationsComponent,
    AccessabilitiesComponent,
    DocumentsComponent,
    ActivitiesComponent,
    MatTabsModule,
  ],
  templateUrl: './view-user-profile.component.html',
  styleUrl: './view-user-profile.component.scss',
})
export class ViewUserProfileComponent implements OnInit, OnDestroy {
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  private username: string = '';
  protected user: BaseUser | null = null;
  protected isLoading: boolean = true;
  protected readonly definedMaleDummyImageURL =
    '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL =
    '/Images/user-images/dummy-user/dummy_woman.jpg';
  protected definedImage: string =
    '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedImageExtentionArray: string[] = [
    'jpg',
    'webp',
    'jpeg',
    'png',
    'ico',
    'gif',
  ];

  protected isInfoPanelOpen: boolean = true;
  protected isAccessibilityPanelOpen: boolean = false;
  protected isDocumentsPanelOpen: boolean = false;
  protected isActivitiesPanelOpen: boolean = false;
  protected isPropertiesPanelOpen: boolean = false;

  protected definedUserImage: string = '';
  protected LOGGED_USER: BaseUser | null = null;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private activatedRouter: ActivatedRoute,
    private crypto: CryptoService,
    private APIs: APIsService,
    private authService: AuthService,
    private refreshService: RefreshService
  ) {
    this.LOGGED_USER = this.authService.getLoggedUser;
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.activatedRouter.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
    this.activatedRouter.params.subscribe((param) => {
      this.username = param['username'];
      this.loadData();
      this.isInfoPanelOpen = true;
      this.isAccessibilityPanelOpen = false;
      this.isDocumentsPanelOpen = false;
      this.isActivitiesPanelOpen = false;
      this.isPropertiesPanelOpen = false;
    });
  }

  async ngOnInit() {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }

    Promise.resolve();
  }

  private async loadData() {
    if (this.isBrowser) {
      const data = await this.APIs.getUserByToken(this.username);
      if (data) {
        this.user = data.user;
        if (typeof this.user.image === 'string') {
          const imageArray: string[] = this.user.image
            ? this.user.image.split('/')
            : [];
          if (imageArray.length > 0) {
            if (
              this.definedImageExtentionArray.includes(
                imageArray[imageArray.length - 1].split('.')[1]
              )
            ) {
              this.definedImage = this.user.image;
            } else {
              if (this.user.gender === 'male') {
                this.definedImage = this.definedMaleDummyImageURL;
              } else {
                this.definedImage = this.definedWomanDummyImageURL;
              }
            }
          }
        }
        this.definedImage;
        setTimeout(() => {
          this.isLoading = false;
        }, 500);
      } else {
        this.router.navigate(['/dashboard/unauthorized']);
      }
    }
  }

  protected goToUsers() {
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/dashboard/users']);
    });
  }

  protected async goToUser() {
    if (this.user) {
      const username = await this.APIs.generateToken(this.user?.username);
      if (username)
        this.router
          .navigateByUrl('/', { skipLocationChange: true })
          .then(() => {
            this.router.navigate([
              '/dashboard/view-user-profile',
              username.token,
            ]);
          });
    }
  }

  protected goToInfomation() {
    this.isInfoPanelOpen = true;
    this.isAccessibilityPanelOpen = false;
    this.isDocumentsPanelOpen = false;
    this.isActivitiesPanelOpen = false;
    this.isPropertiesPanelOpen = false;
  }
  protected goToAccessibility() {
    this.isInfoPanelOpen = false;
    this.isAccessibilityPanelOpen = true;
    this.isDocumentsPanelOpen = false;
    this.isActivitiesPanelOpen = false;
    this.isPropertiesPanelOpen = false;
  }
  protected goToDocuments() {
    this.isInfoPanelOpen = false;
    this.isAccessibilityPanelOpen = false;
    this.isDocumentsPanelOpen = true;
    this.isActivitiesPanelOpen = false;
    this.isPropertiesPanelOpen = false;
  }
  protected goToActivities() {
    this.isInfoPanelOpen = false;
    this.isAccessibilityPanelOpen = false;
    this.isDocumentsPanelOpen = false;
    this.isActivitiesPanelOpen = true;
    this.isPropertiesPanelOpen = false;
  }
  protected goToProperties() {
    this.isInfoPanelOpen = false;
    this.isAccessibilityPanelOpen = false;
    this.isDocumentsPanelOpen = false;
    this.isActivitiesPanelOpen = false;
    this.isPropertiesPanelOpen = true;
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }
}
