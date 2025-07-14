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

interface USBDevice {
  deviceId: string;
  vendorId: number;
  productId: number;
  manufacturerName?: string;
  productName?: string;
  serialNumber?: string;
  [key: string]: any;
}

// SkeletonLoaderComponent,ProgressBarComponent,
@Component({
  selector: 'app-file-scanner',
  standalone: true,
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
  templateUrl: './file-scanner.html',
  styleUrl: './file-scanner.scss',
})
export class FileScanner
  implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  @ViewChild(NotificationComponent, { static: true })
  notification!: NotificationComponent;
  // Dialog data
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  protected isLoading: boolean = true;

  protected uploadUrl: string = '';
  private token: string = '';
  protected qrDataUrl: string = '';
  protected fileReceived: boolean = false;

  private tenantUsername: string = '';

  protected selectionMedia: 'Scanner' | 'Mobile' = 'Scanner';

  protected USBDevices: any[] = [];
  protected WiFiDevices: any[] = [];

  protected isElectron: boolean = false;

  protected scanners: string[] = [];
  protected selectedScanner: string = '';

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(MAT_DIALOG_DATA)
    public data: any = {},
    public dialogRef: MatDialogRef<FileScanner>,
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

    this.tenantUsername = this.data.tenantUsername;
    if (this.scanService.isElectron()) {
      this.isElectron = this.scanService.isElectron();
    }

    if (!this.isElectron) {
      this.selectionMedia = 'Mobile';
    }
  }

  async ngOnInit() {
    await this.createQRCode();

    if (this.isElectron) {
      this.isLoading = true;

      try {
        const [usbDevices, wifiDevices] = await Promise.all([
          window.electron.getUSBDevices(),
          window.electron.detectWiFiScanners(),
        ]);

        this.USBDevices = usbDevices;
        this.WiFiDevices = wifiDevices;

        const usbScannerNames = usbDevices.map(
          (item) => item.manufacturer || item.product
        );

        const wifiScannerNames = wifiDevices.map(
          (item) => item.hostname || item.ip
        );

        this.scanners = [...usbScannerNames, ...wifiScannerNames];

        console.log(this.scanners);
      } catch (err) {
        console.error('Scanner fetch failed:', err);
      } finally {
        this.isLoading = false;
      }
    }

    this.cdr.detectChanges();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && changes['data'].currentValue) {
    }
  }

  ngAfterViewInit(): void {
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  private async createQRCode(): Promise<void> {
    try {
      const tenantUserName = this.data?.tenantUsername;
      if (!tenantUserName) throw new Error('Tenant username is missing');

      const payload = {
        tenant: tenantUserName,
        issuedAt: Date.now(),
      };
      const uniqueToken = await this.crypto.encrypt(JSON.stringify(payload));

      if (!uniqueToken) throw new Error('Encryption failed!');

      this.token = uniqueToken as string;

      const encodedToken = encodeURIComponent(uniqueToken);

      const protocol = window.location.protocol;
      // const host = window.location.host.includes('localhost')
      //   ? PC_IP_PLUS_PORT
      //   : window.location.host;
      const host = window.location.host;
      const baseUrl = `${protocol}//${host}`;
      const uploadUrl = `${baseUrl}/mobile-upload/${encodedToken}`;

      const qrCodeDataUrl = await toDataURL(uploadUrl);

      this.qrDataUrl = qrCodeDataUrl;
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  }

  protected onSelectionMedia() { }

  protected async onSelectingScanner() {
    let selectedDevice: any;

    if (this.selectedScanner) {
      selectedDevice =
        this.USBDevices.find(
          (item) =>
            item.manufacturer === this.selectedScanner ||
            item.product === this.selectedScanner
        ) ||
        this.WiFiDevices.find(
          (item) =>
            item.hostname === this.selectedScanner ||
            item.ip === this.selectedScanner
        );

      if (selectedDevice) {
        console.log('Selected device:', selectedDevice);

        // Notify Electron to scan
        try {
          const result = await window.electron.scanDocument(selectedDevice);
          console.log('Scan result:', result);
          // Handle result (e.g., display scanned image or PDF)
        } catch (err) {
          console.error('Scan failed:', err);
        }
      }
    }
  }

  protected onScannerChange() { }

  protected pannelClose() {
    this.dialogRef.close({
      token: this.token,
    });
  }
}
