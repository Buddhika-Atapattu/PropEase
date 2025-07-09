import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  AfterViewInit,
} from '@angular/core';
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

@Component({
  selector: 'app-sign-signature',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './sign-signature.component.html',
  styleUrl: './sign-signature.component.scss',
})
export class SignSignature implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('signaturePadCanvas', { static: true })
  signaturePadCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: true })
  fileInput!: ElementRef<HTMLInputElement>;

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected type: string = '';

  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  protected uploadedFile: File | null = null;
  private lastX = 0;
  private lastY = 0;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(MAT_DIALOG_DATA)
    public data: any,
    public dialogRef: MatDialogRef<SignSignature>
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  ngOnInit(): void {
    this.uploadedFile = this.data.signature;
    this.type = this.data.type;
  }

  ngAfterViewInit() {
    const canvas = this.signaturePadCanvas.nativeElement;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#000';
  }

  ngOnDestroy(): void {}

  protected triggerInput() {
    this.fileInput.nativeElement.click();
  }

  protected startSigning(event: MouseEvent | TouchEvent) {
    this.drawing = true;
    this.ctx.beginPath();
    const pos = this.getEventPosition(event);
    this.ctx.moveTo(pos.x, pos.y);
  }

  protected drawSignature(event: MouseEvent | TouchEvent) {
    if (!this.drawing) return;
    const pos = this.getEventPosition(event);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
  }

  protected endSigning() {
    this.drawing = false;
  }

  protected clearSignature() {
    const canvas = this.signaturePadCanvas.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  protected getEventPosition(event: MouseEvent | TouchEvent): {
    x: number;
    y: number;
  } {
    const canvas = this.signaturePadCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else if (event instanceof TouchEvent && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  protected handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadedFile = input.files[0];
    }
  }

  protected handleDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.uploadedFile = event.dataTransfer.files[0];
    }
  }

  protected preventDefault(event: DragEvent) {
    event.preventDefault();
  }

  protected handlePaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          this.uploadedFile = file;
        }
      }
    }
  }

  protected saveSignature(): void {
    const canvas = this.signaturePadCanvas.nativeElement;

    if (this.uploadedFile) {
      // If user uploaded a file instead of drawing
      this.dialogRef.close(this.uploadedFile);
    } else {
      // Convert canvas to Blob
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'signature.png', { type: 'image/png' });
          this.dialogRef.close(file);
        } else {
          console.warn('No signature drawn or blob could not be created.');
          this.dialogRef.close(null);
        }
      }, 'image/png');
    }
  }

  protected pannelClose() {
    this.dialogRef.close();
  }
}
