import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  AfterViewInit,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { WindowsRefService } from '../../services/windowRef/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { SafeUrlPipe } from '../../pipes/safe-url.pipe';
import { PropertyMoreDetailsPannelComponent } from '../../components/dialogs/property-more-details-pannel/property-more-details-pannel.component';
import { APIsService } from '../../services/APIs/apis.service';
import { TokenService } from '../../services/token/token.service';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';

@Component({
  selector: 'app-mobile-support-file-upload',
  standalone: true,
  imports: [CommonModule, ImageCropperComponent],
  templateUrl: './mobile-support-file-upload.html',
  styleUrl: './mobile-support-file-upload.scss',
})
export class MobileSupportFileUpload
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('videoRef', { static: false })
  videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('hiddenFileInput') hiddenFileInput!: ElementRef<HTMLInputElement>;

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  protected videoDevices: MediaDeviceInfo[] = [];
  protected selectedDeviceId: string | null = null;
  private mediaStream: MediaStream | null = null;
  protected captureImage: string = '';
  protected isCameraOpen: boolean = false;

  private isDragging = false;
  private offsetX = 0;
  private offsetY = 0;

  protected token: string = '';

  protected selectedImageChangedEvent: any = null;
  protected croppedImageBase64: string = '';
  protected showCropper = false;
  protected croppedImage: any = '';
  protected uploadedImage: string = '';
  protected image: File | null = null;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private apiServices: APIsService,
    private tokenService: TokenService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.activatedRoute.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
    this.activatedRoute.params.subscribe((params) => {
      this.token = encodeURIComponent(params['token']);
    });

    this.isCameraOpen = true;
  }
  ngOnInit(): void {}

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.requestCameraAccessAndEnumerate();
    }
  }

  //<===================== Capturing The Image =====================>
  protected async retry() {
    await this.requestCameraAccessAndEnumerate();
    this.isCameraOpen = true;
  }

  protected cancel() {
    this.isCameraOpen = false;
    this.mediaStream = null;
    this.captureImage = '';
    this.stopCamera();
    this.router.navigate(['/']);
  }

  private async requestCameraAccessAndEnumerate(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          aspectRatio: 16 / 9,
        },
      });
      this.mediaStream = stream;

      const video = this.videoRef.nativeElement;
      video.srcObject = stream;
      await video.play();

      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter((d) => d.kind === 'videoinput');
    } catch (err) {
      console.error('Camera access or device enumeration failed:', err);
      alert('Failed to access camera devices. Check browser permissions.');
    }
  }

  private stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  protected onCaptureImage(): void {
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/png') || canvas.toDataURL();

    if (imageData) {
      this.handleImage(imageData);
    }
    this.stopCamera();
  }

  protected handleImage(imageData: string) {
    this.uploadedImage = imageData;
    this.image = this.convertToTheBlob(imageData);
    this.isCameraOpen = false;

    const file = this.convertToTheBlob(imageData);
    const dt = new DataTransfer();
    dt.items.add(file);

    const simulatedEvent = {
      target: {
        files: dt.files,
      },
    };

    this.onFileSelected(simulatedEvent);
  }

  protected convertToTheBlob(data: string): File {
    const byteString = atob(data.split(',')[1]); // decode base64
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      byteArray[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: 'image/png' });
    return new File([blob], 'image.png', { type: 'image/png' });
  }

  //<===================== End Capturing The Image =====================>

  //<===================== Image Cropped =====================>
  protected onFileSelected(event: any): void {
    this.selectedImageChangedEvent = event;
    this.showCropper = true;
  }

  protected imageCropped(event: ImageCroppedEvent): void {
    this.croppedImageBase64 = event.objectUrl as string;
    this.croppedImage = event;
  }

  protected saveCroppedImage(): void {
    this.uploadedImage = this.croppedImage.objectUrl;

    // Convert the cropped Blob into a File
    const blob = this.croppedImage.blob;
    const fileName = `cropped-image-${Date.now()}.png`;
    this.image = new File([blob], fileName, { type: blob.type });

    console.log('Converted cropped Blob to File:', this.image);

    this.showCropper = false;
    this.resetCropper();
  }

  protected cancelCrop(): void {
    this.uploadedImage = '';
    this.image = null;
    this.resetCropper();
  }

  private resetCropper(): void {
    this.selectedImageChangedEvent = null;
    this.croppedImageBase64 = '';
    this.showCropper = false;
  }
  //<===================== End Image Cropped =====================>

  protected async upload() {
    if (this.image instanceof File) {
      const formData: FormData = new FormData();
      formData.append('image', this.image as File, 'image.png');
      formData.append('token', this.token);
      await this.apiServices
        .getTenantMobileFileUpload(this.token, formData)
        .then((res) => {
          console.log(res);
          if (res) {
            this.tokenService.mobileTenantFileUploadToken = this.token;
            this.tokenService.mobileTenantFileUploadTokenFileData =
              res.data.file;
            this.tokenService.mobileTenantFileUploadTokenFileDataURL =
              res.data.file.path;
          }
        })
        .catch((err) => {
          console.log(err);
        });

      this.router.navigate(['/']); // Navigate to the home page
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }
}
