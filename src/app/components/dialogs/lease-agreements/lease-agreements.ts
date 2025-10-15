import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ChangeDetectorRef,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {Subscription} from 'rxjs';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';

import {LeaseWithProperty, TenantService} from '../../../services/tenant/tenant.service';
import {BaseUser} from '../../../services/APIs/apis.service';
import {NotificationComponent} from '../notification/notification.component';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';
import {SkeletonLoaderComponent} from '../../../components/shared/skeleton-loader/skeleton-loader.component';
import {SafeUrlPipe} from '../../../pipes/safe-url.pipe';
import {NgxExtendedPdfViewerModule} from 'ngx-extended-pdf-viewer';
import {Router} from '@angular/router';
import {AuthService} from '../../../services/auth/auth.service';

// SkeletonLoaderComponent, SafeUrlPipe
@Component({
  selector: 'app-lease-agreements',
  standalone: true,
  imports: [CommonModule, NotificationComponent, MatProgressSpinnerModule, NgxExtendedPdfViewerModule],
  templateUrl: './lease-agreements.html',
  styleUrl: './lease-agreements.scss'
})
export class LeaseAgreements implements OnInit, OnDestroy, AfterViewInit, OnChanges {

  @ViewChild(NotificationComponent) notificationComponent!: NotificationComponent;
  protected lease: LeaseWithProperty | null = null;
  protected tenant: BaseUser | null = null;
  protected isLoading: boolean = false;
  protected isBrowser: boolean;
  protected modeSub: Subscription | null = null;
  protected PDFURL: SafeResourceUrl | null = null;
  protected pdfBlob: string = '';

  protected readonly definedMaleDummyImageURL = '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL = '/Images/user-images/dummy-user/dummy_woman.jpg';
  protected definedImage: string = '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedImageExtentionArray: string[] = ['jpg', 'webp', 'jpeg', 'png', 'ico', 'gif'];

  constructor (
    private tenantService: TenantService,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(MAT_DIALOG_DATA) public data: any = {},
    public dialogRef: MatDialogRef<LeaseAgreements>,
    private cdr: ChangeDetectorRef,
    private windowRef: WindowsRefService,
    private sanitizer: DomSanitizer,
    private router: Router,
    private authService: AuthService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnInit(): Promise<void> {
    try {
      if(this.isBrowser) {
        this.modeSub = this.windowRef.mode$.subscribe((val) => {});
      }
      if(this.data) {
        this.lease = this.data.lease as LeaseWithProperty;
        this.tenant = this.data.tenant as BaseUser;
        await this.loadPDF();
      } else {
        this.lease = null;
        this.tenant = null;
        throw new Error('No data found!');
      }
    } catch(error) {
      console.error(error);
      this.dialogRef.close();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {}

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    if(this.PDFURL) {
      this.PDFURL = null;
    }
    if(this.modeSub) {
      this.modeSub.unsubscribe();
    }
  }

  private async loadPDF(): Promise<void> {
    try {
      this.isLoading = true;
      if(!this.lease) throw new Error('No lease found!');
      const leaseID = this.lease.leaseID;
      if(!leaseID) throw new Error('No lease ID found!');
      if(this.authService.getLoggedUser === null) throw new Error('User not authenticated')

      const blob = await this.tenantService.downloadLeaseAgreement(leaseID, 'view', this.authService.getLoggedUser.username);

      const isPDF = blob.type === 'application/pdf' && blob.size > 1000;
      if(!isPDF) {
        const text = await blob.text();
        throw new Error(`Expected PDF blob, got text: ${text}`);
      }


      const objectUrl = URL.createObjectURL(blob);
      this.pdfBlob = objectUrl;
      this.PDFURL = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);

    } catch(error) {
      console.error('Failed to load PDF:', error);
      this.PDFURL = null;
    } finally {
      this.isLoading = false;
    }
  }

  protected generateTenantImage(image: string, gender: string): string {
    try {
      const imageArray: string[] = image ? image.split('/') : [];

      if(imageArray.length > 0) {
        const lastSegment = imageArray[imageArray.length - 1];
        const extension = lastSegment.split('.').pop()?.toLowerCase();

        if(extension && this.definedImageExtentionArray.includes(extension)) {
          this.definedImage = image;
        } else {
          this.definedImage = gender.toLowerCase() === 'male'
            ? this.definedMaleDummyImageURL
            : this.definedWomanDummyImageURL;
        }
      } else {
        this.definedImage = gender.toLowerCase() === 'male'
          ? this.definedMaleDummyImageURL
          : this.definedWomanDummyImageURL;
      }

      return this.definedImage;
    } catch(error) {
      console.error('Error generating tenant image:', error);
      return gender.toLowerCase() === 'male'
        ? this.definedMaleDummyImageURL
        : this.definedWomanDummyImageURL;
    }
  }

  protected onEditLease(): void {
    this.pannelClose();
    this.router.navigate(['/dashboard/tenant/tenant-lease', this.lease?.leaseID]);
  }

  protected pannelClose() {
    if(this.PDFURL) {
      this.PDFURL = null;
    }
    this.dialogRef.close();
  }
}
