import {
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  OnInit,
  AfterViewInit,
  OnDestroy,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { WindowsRefService } from '../../../../services/windowRef.service';
import { Subscription } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-camera-box',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './camera-box.component.html',
  styleUrl: './camera-box.component.scss',
})
export class CameraBoxComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('cameraBox') cameraBoxRef!: ElementRef<HTMLDivElement>;

  @Output() imageCaptured = new EventEmitter<string>();
  @Output() closeEvent = new EventEmitter<boolean>();

  private isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected videoDevices: MediaDeviceInfo[] = [];
  protected selectedDeviceId: string | null = null;
  private mediaStream: MediaStream | null = null;

  private isDragging = false;
  private offsetX = 0;
  private offsetY = 0;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    this.matIconRegistry.addSvgIcon(
      'close',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/wrong.svg'
      )
    );
  }

  ngOnInit(): void {
    if (!this.isCameraSupported()) {
      alert('Camera API not supported in this browser.');
    }
  }

  async ngAfterViewInit(): Promise<void> {
    if (this.isBrowser) {
      await this.requestCameraAccessAndEnumerate();
      if (this.videoDevices.length && !this.selectedDeviceId) {
        this.selectedDeviceId = this.videoDevices[0].deviceId;
        await this.onSelectCamera(this.selectedDeviceId);
      }
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  private isCameraSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  private async requestCameraAccessAndEnumerate(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.mediaStream = stream;

      const video = this.videoRef.nativeElement;
      video.srcObject = stream;
      await video.play();

      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter((d) => d.kind === 'videoinput');

      // if (this.videoDevices.length > 0 && !this.selectedDeviceId) {
      //   this.selectedDeviceId = this.videoDevices[0].deviceId;
      // }

      this.stopCamera(); // Stop temporary stream used for permission/device list
    } catch (err) {
      console.error('Camera access or device enumeration failed:', err);
      alert('Failed to access camera devices. Check browser permissions.');
    }
  }

  protected async onSelectCamera(deviceId: string): Promise<void> {
    this.selectedDeviceId = deviceId;
    this.stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });

      this.mediaStream = stream;
      const video = this.videoRef.nativeElement;
      video.srcObject = stream;
      await video.play();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        alert('Camera access denied. Please enable it and try again.');
      } else if (err.name === 'NotFoundError') {
        alert('No camera device found.');
      } else {
        console.error('Failed to start camera:', err);
      }
    }
  }

  private stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    const video = this.videoRef.nativeElement;
    video.srcObject = null;
  }

  protected captureImage(): void {
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/png') || canvas.toDataURL();
    this.imageCaptured.emit(imageData);

    this.stopCamera();
  }

  protected onClose(): void {
    this.stopCamera();
    this.closeEvent.emit(true);
  }

  protected onMouseDown(event: MouseEvent): void {
    const box = this.cameraBoxRef.nativeElement;
    this.isDragging = true;
    this.offsetX = event.clientX - box.offsetLeft;
    this.offsetY = event.clientY - box.offsetTop;

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  protected onMouseMove = (event: MouseEvent): void => {
    if (this.isDragging) {
      const box = this.cameraBoxRef.nativeElement;
      box.style.left = `${event.clientX - this.offsetX}px`;
      box.style.top = `${event.clientY - this.offsetY}px`;
    }
  };

  protected onMouseUp = (): void => {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  };
}
