// At the top of the file if still needed
/// <reference path="../../../../../types/typings.d.ts" />

import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  AfterViewInit,
  CUSTOM_ELEMENTS_SCHEMA,
  OnChanges,
  SimpleChanges,
  HostListener,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  APIsService,
  BaseUser,
  Country,
  MSG_DATA_TYPE,
  PermissionEntry,
  ROLE_ACCESS_MAP,
  validateType,
} from '../../../services/APIs/apis.service';
import { SkeletonLoaderComponent } from '../../../components/shared/skeleton-loader/skeleton-loader.component';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MatMomentDateModule,
  MomentDateAdapter,
} from '@angular/material-moment-adapter';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { DomSanitizer } from '@angular/platform-browser';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import { CameraBoxComponent } from '../../../components/dialogs/camera-box/camera-box.component';
import { EditorComponent } from '@tinymce/tinymce-angular';
import { AuthService } from '../../../services/auth/auth.service';
import Tesseract from 'tesseract.js';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
  MatDialogModule,
} from '@angular/material/dialog';
import { isPlatformBrowser, CommonModule, AsyncPipe } from '@angular/common';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { Subscription } from 'rxjs';
import {
  BackEndPropertyData,
  MSG,
  PropertyService,
} from '../../../services/property/property.service';
import { NotificationComponent } from '../notification/notification.component';
import { LeaseWithProperty, TenantService } from '../../../services/tenant/tenant.service';

@Component({
  selector: 'app-lease-agreements',
  imports: [CommonModule, NotificationComponent, SkeletonLoaderComponent],
  standalone: true,
  templateUrl: './lease-agreements.html',
  styleUrl: './lease-agreements.scss'
})
export class LeaseAgreements implements OnInit, OnDestroy, AfterViewInit, OnChanges {

  @ViewChild(NotificationComponent) notificationComponent!: NotificationComponent
  protected lease: LeaseWithProperty | null = null;
  protected tenant: BaseUser | null = null;
  protected isLoading: boolean = false;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  protected modeSub: Subscription | null = null;

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
    private propertyService: PropertyService,
    private cryptoService: CryptoService,
    private authService: AuthService,
    private TenantService: TenantService,
    private router: Router,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(MAT_DIALOG_DATA)
    public data: any = {},
    public dialogRef: MatDialogRef<LeaseAgreements>,
    private cdr: ChangeDetectorRef,
    private windowRef: WindowsRefService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnInit(): Promise<void> {
    try {
      if (this.isBrowser) {
        this.modeSub = this.windowRef.mode$.subscribe((val) => {
          this.mode = val;
        });
      }
      if (this.data) {
        this.lease = this.data.lease as LeaseWithProperty;
        this.tenant = this.data.tenant as BaseUser;
      }
      else {
        this.lease = null;
        this.tenant = null;
        throw new Error('No data found!');
      }
    }
    catch (error) {
      console.error(error);
      this.dialogRef.close();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
  }

  ngAfterViewInit(): void {
  }

  ngOnDestroy(): void {

  }

  protected generateTenantImage(image: string, gender: string): string {
    try {
      const imageArray: string[] = image ? image.split('/') : [];

      if (Array.isArray(imageArray) && imageArray.length > 0) {
        const lastSegment = imageArray[imageArray.length - 1];
        const extension = lastSegment.split('.').pop()?.toLowerCase();

        if (extension && this.definedImageExtentionArray.includes(extension)) {
          this.definedImage = image;
        } else {
          this.definedImage = gender.toLowerCase() === 'male'
            ? this.definedMaleDummyImageURL
            : this.definedWomanDummyImageURL;
        }
      } else {
        // Handle case where image is empty or malformed
        this.definedImage = gender.toLowerCase() === 'male'
          ? this.definedMaleDummyImageURL
          : this.definedWomanDummyImageURL;
      }

      return this.definedImage;

    } catch (error) {
      console.error('Error generating tenant image:', error);
      return gender.toLowerCase() === 'male'
        ? this.definedMaleDummyImageURL
        : this.definedWomanDummyImageURL;
    }
  }

  protected pannelClose() {
    this.dialogRef.close();
  }
}
