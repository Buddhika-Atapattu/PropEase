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
import { ScanService, DeviceInfo } from '../../../services/scan/scan.service';
import { QRCode, QRCodeErrorCorrectionLevel, toDataURL } from 'qrcode';
import { PC_IP_PLUS_PORT } from '../../../../environments/environment';

@Component({
  selector: 'app-file-viewer',
  imports: [
    CommonModule,
    NotificationComponent,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatMomentDateModule,
    MatSelectModule,
    MatDividerModule,
    MatDialogModule,
    MatProgressBarModule,
  ],
  templateUrl: './file-viewer.html',
  styleUrl: './file-viewer.scss',
})
export class FileViewer implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  @ViewChild(NotificationComponent, { static: true })
  notification!: NotificationComponent;

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  protected isLoading: boolean = true;

  protected fileURL: string = '';
  private token: string = '';


  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(MAT_DIALOG_DATA)
    public data: any = {},
    public dialogRef: MatDialogRef<FileViewer>,
    private cdr: ChangeDetectorRef,
    private scanService: ScanService,
    private router: Router,
    private crypto: CryptoService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  ngOnInit(): void {
    this.fileURL = this.data.document;
    this.token = this.data.token;
    this.cdr.detectChanges();
  }

  
  ngAfterViewInit(): void {}
  ngOnChanges(changes: SimpleChanges): void {}
  ngOnDestroy(): void {}

  protected pannelClose() {
    this.dialogRef.close({
      token: this.token,
    });
  }
}
