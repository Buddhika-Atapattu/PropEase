import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { APIsService, BaseUser } from '../../../services/APIs/apis.service';
import { SkeletonLoaderComponent } from '../../../components/shared/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-tenant-view',
  imports: [CommonModule, SkeletonLoaderComponent],
  templateUrl: './tenant-view.component.html',
  styleUrl: './tenant-view.component.scss',
})
export class TenantViewComponent implements OnInit, AfterViewInit, OnDestroy {
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  private tenantID: string = '';
  protected tenant: BaseUser | null = null;
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

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: APIsService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });

    this.route.params.subscribe(async (params) => {
      this.tenantID = params['tenantID'];
      await this.loadData();
    });
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  private async loadData() {
    await this.apiService
      .getUserByToken(this.tenantID)
      .then((res) => {
        this.tenant = res.user as BaseUser;
        setTimeout(() => {
          this.isLoading = false;
        }, 500);
      })
      .catch((err) => {
        console.error(err);
      });
  }

  protected generateTenantImage(image: string, gender: string): string {
    const imageArray: string[] = image ? image.split('/') : [];
    if (Array.isArray(imageArray) && imageArray.length > 0) {
      if (
        this.definedImageExtentionArray.includes(
          imageArray[imageArray.length - 1].split('.')[1]
        )
      ) {
        this.definedImage = image;
      } else {
        if (gender.toLowerCase() === 'male') {
          this.definedImage = this.definedMaleDummyImageURL;
        } else {
          this.definedImage = this.definedWomanDummyImageURL;
        }
      }
    }
    return this.definedImage;
  }

  protected async makeTenantLease(username:string) {
    if (this.isBrowser && this.tenant) {
      const tokenResult = await this.apiService.generateToken(this.tenant.username);
      this.router.navigate([
        '/dashboard/tenant/tenant-lease',
        tokenResult.token,
      ]);
    }
  }

  protected goToTenants() {
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/dashboard/tenant/tenant-home/']);
    });
  }

  protected async goToTenant() {
    if (this.tenant) {
      const tenant = await this.apiService.generateToken(this.tenant?.username);
      if (tenant)
        this.router
          .navigateByUrl('/', { skipLocationChange: true })
          .then(() => {
            this.router.navigate([
              '/dashboard/tenant/tenant-view/',
              tenant.token,
            ]);
          });
    }
  }
}
