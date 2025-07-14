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
import { BackEndPropertyData } from '../../../services/property/property.service';

@Component({
  selector: 'app-view-property-images',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './view-property-images.component.html',
  styleUrl: './view-property-images.component.scss',
})
export class ViewPropertyImagesComponent
  implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('indicatorContainer', { static: false })
  private indicatorContainerRef!: ElementRef<HTMLDivElement>;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  protected currentImageIndex: number = 0;
  protected propertyImages: BackEndPropertyData['images'] = [];

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(MAT_DIALOG_DATA)
    public data: any = {},
    public dialogRef: MatDialogRef<ViewPropertyImagesComponent>,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }
  ngOnInit(): void {
    this.propertyImages = this.data.images;
    this.currentImageIndex = this.data.currentImageIndex;
  }
  ngAfterViewInit(): void { }

  ngOnDestroy(): void { }

  protected changeImage(index: number) {
    this.currentImageIndex = index;
    this.cdr.detectChanges();
  }

  private scrollToCurrentIndicator(): void {

    if (!this.isBrowser || !this.indicatorContainerRef) return;

    const container = this.indicatorContainerRef.nativeElement;
    const activeEl = document.getElementById(
      'indicator-' + this.currentImageIndex
    );

    if (container && activeEl) {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();

      // Calculate offset relative to container
      const offsetLeft = activeEl.offsetLeft;
      const offsetWidth = activeEl.offsetWidth;

      // Option 1: center the active item
      const scrollTo = offsetLeft - container.clientWidth / 2 + offsetWidth / 2;

      container.scrollTo({
        left: scrollTo,
        behavior: 'smooth',
      });
    }
  }

  protected prevImage() {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex -= 1;
    } else {
      this.currentImageIndex = this.propertyImages.length - 1;
    }

    this.scrollToCurrentIndicator();
    this.cdr.detectChanges();

  }

  protected nextImage() {
    if (this.currentImageIndex < this.propertyImages.length - 1) {
      this.currentImageIndex += 1;
    } else {
      this.currentImageIndex = 0;
    }

    this.scrollToCurrentIndicator();
    this.cdr.detectChanges();

  }

  protected downloadImage(url: string) {
    if (!this.isBrowser) return;
    window.open(url, '_blank');
  }

  protected closeTheDialog() {
    this.dialogRef.close();
  }
}
