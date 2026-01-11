import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ImageCroppedEvent, ImageCropperComponent } from 'ngx-image-cropper';
import { Subscription } from 'rxjs';
import { TenantService } from '../../services/tenant/tenant.service';
import { TokenService, type fileType } from '../../services/token/token.service';
import { NotificationDialogComponent } from '../../components/dialogs/notificationBar/notificationBar.component';
import { APIsService } from '../../services/APIs/apis.service';


@Component( {
  selector: 'app-mobile-support-file-upload',
  standalone: true,
  imports: [ CommonModule, ImageCropperComponent, NotificationDialogComponent ],
  templateUrl: './mobile-support-file-upload.html',
  styleUrl: './mobile-support-file-upload.scss',
} )
export class MobileSupportFileUpload
  implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild( 'videoRef', { static: false } )
  videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild( 'canvas', { static: false } )
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild( NotificationDialogComponent, { static: true } ) notificationDialog!: NotificationDialogComponent;

  @ViewChild( 'hiddenFileInput' ) hiddenFileInput!: ElementRef<HTMLInputElement>;

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

  constructor (
    @Inject( PLATFORM_ID ) private platformId: Object,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private tokenService: TokenService,
    private readonly tenantService: TenantService,
    private readonly apiService: APIsService
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.activatedRoute.url.subscribe( ( segments ) => {
      const path = segments.map( ( s ) => s.path ).join( '/' );
    } );
    this.activatedRoute.params.subscribe( ( params ) => {
      this.token = encodeURIComponent( params[ 'token' ] );
    } );

    this.isCameraOpen = true;
  }
  ngOnInit(): void {}

  ngAfterViewInit(): void {
    if ( this.isBrowser ) {
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
    this.router.navigate( [ '/' ] );
  }

  private async requestCameraAccessAndEnumerate(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia( {
        video: {
          facingMode: 'environment',
          aspectRatio: 16 / 9,
        },
      } );
      this.mediaStream = stream;

      const video = this.videoRef.nativeElement;
      video.srcObject = stream;
      await video.play();

      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter( ( d ) => d.kind === 'videoinput' );
    } catch ( err ) {
      console.error( 'Camera access or device enumeration failed:', err );
      alert( 'Failed to access camera devices. Check browser permissions.' );
    }
  }

  private stopCamera(): void {
    if ( this.mediaStream ) {
      this.mediaStream.getTracks().forEach( ( track ) => track.stop() );
      this.mediaStream = null;
    }
  }

  protected onCaptureImage(): void {
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext( '2d' );
    if ( !ctx ) return;

    ctx.drawImage( video, 0, 0, canvas.width, canvas.height );
    const imageData = canvas.toDataURL( 'image/png' ) || canvas.toDataURL();

    if ( imageData ) {
      this.handleImage( imageData );
    }
    this.stopCamera();
  }

  protected handleImage( imageData: string ) {
    this.uploadedImage = imageData;
    this.image = this.convertToTheBlob( imageData );
    this.isCameraOpen = false;

    const file = this.convertToTheBlob( imageData );
    const dt = new DataTransfer();
    dt.items.add( file );

    const simulatedEvent = {
      target: {
        files: dt.files,
      },
    };

    this.onFileSelected( simulatedEvent );
  }

  protected convertToTheBlob( data: string ): File {
    const byteString = atob( data.split( ',' )[ 1 ] ); // decode base64
    const byteArray = new Uint8Array( byteString.length );
    for ( let i = 0; i < byteString.length; i++ ) {
      byteArray[ i ] = byteString.charCodeAt( i );
    }
    const blob = new Blob( [ byteArray ], { type: 'image/png' } );
    return new File( [ blob ], 'image.png', { type: 'image/png' } );
  }

  //<===================== End Capturing The Image =====================>

  //<===================== Image Cropped =====================>
  protected onFileSelected( event: any ): void {
    this.selectedImageChangedEvent = event;
    this.showCropper = true;
  }

  protected imageCropped( event: ImageCroppedEvent ): void {
    this.croppedImageBase64 = event.objectUrl as string;
    this.croppedImage = event;
  }

  protected saveCroppedImage(): void {
    this.uploadedImage = this.croppedImage.objectUrl;

    // Convert the cropped Blob into a File
    const blob = this.croppedImage.blob;
    const fileName = `cropped-image-${ Date.now() }.png`;
    this.image = new File( [ blob ], fileName, { type: blob.type } );

    console.log( 'Converted cropped Blob to File:', this.image );

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
    try {
      if ( !( this.image instanceof File ) ) {
        throw new Error( 'Data is not file type!' );
      }
      const formData: FormData = new FormData();
      formData.append( 'image', this.image as File, 'image.png' );
      formData.append( 'token', this.token );

      const res = await this.tenantService.getTenantMobileFileUpload( this.token, formData );

      if ( !res.success || res.status !== 'success' ) {
        this.notificationDialog.notification( 'error', 'Failed to upload image!' );
        throw new Error( 'Failed to upload image!' );
      }

      if ( !res.data ) {
        throw new Error( 'Invalid data!' );
      }

      this.tokenService.mobileTenantFileUploadToken = this.token;

      const file: fileType | null = this.apiService.extractObjectFromOther( res.data, 'record' );

      if ( !file ) {
        throw new Error( 'Invalid file data' );
      }

      this.tokenService.mobileTenantFileUploadTokenFileData = file;

      this.tokenService.mobileTenantFileUploadTokenFileDataURL = this.tokenService.mobileTenantFileUploadTokenFileData.path;
    }
    catch ( error ) {
      console.error( error );
    }
    finally {
      this.router.navigate( [ '/login' ] );
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }
}
