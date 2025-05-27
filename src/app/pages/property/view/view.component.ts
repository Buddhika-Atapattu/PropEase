// view.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { WindowsRefService } from '../../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import {
  BackEndPropertyData,
  MSG,
  PropertyService,
} from '../../../../services/property/property.service';

@Component({
  selector: 'app-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss',
})
export class ViewComponent implements OnInit, OnDestroy {
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected propertyID: string = '';
  protected property: BackEndPropertyData | null = null;
  protected propertyImages: BackEndPropertyData['images'] = [];

  protected currentImageIndex: number = 0;
  private rows: number = 10;
  private cols: number = 10;
  protected imageTiles: string[] = [];
  protected isImageTrasform: boolean = false;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private propertyService: PropertyService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.activatedRoute.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
    this.activatedRoute.params.subscribe((params) => {
      this.propertyID = params['propertyID'];
    });
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
      await this.callTheApi();
      this.createImageTiles();
      this.setInitialImage();
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  protected goToProperties(): void {
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/dashboard/properties']);
    });
  }

  protected goToPropertyView(): void {
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/dashboard/property-view', this.propertyID]);
    });
  }

  private async callTheApi() {
    await this.propertyService
      .getPropertyById(this.propertyID)
      .then((response: MSG) => {
        this.property = response.data as BackEndPropertyData;
        this.propertyImages = this.property.images;
      })
      .catch((error: MSG) => {
        console.error(error);
      });
  }

  private createImageTiles() {
    if (!this.propertyImages || this.propertyImages.length === 0) return;
    this.imageTiles = this.generateTilePositions();
  }

  private setInitialImage() {
    const tileElements = document.querySelectorAll('.tile');
    const initialImageUrl =
      this.propertyImages[this.currentImageIndex].imageURL;
    tileElements.forEach((tile) => {
      const element = tile as HTMLElement;
      element.style.backgroundImage = `url(${initialImageUrl})`;
      element.style.opacity = '1';
      element.style.transform = 'scale(1) rotateY(0deg)';
    });

    console.log(tileElements);
  }

  private animateTheImage(index: number) {
    if (this.isBrowser) {
      this.isImageTrasform = true;
      const oldImageUrl = this.propertyImages[this.currentImageIndex].imageURL;
      const newImageUrl = this.propertyImages[index].imageURL;
      const tileElements = document.querySelectorAll('.tile');

      tileElements.forEach((tile, i) => {
        const element = tile as HTMLElement;
        element.style.backgroundImage = `url(${oldImageUrl})`;
        element.style.transform = 'scale(1) rotateY(0deg)';
        element.style.opacity = '1';
      });

      tileElements.forEach((tile, i) => {
        const delay = ((i % this.cols) + Math.floor(i / this.cols)) * 50;
        setTimeout(() => {
          const element = tile as HTMLElement;
          element.style.backgroundImage = `url(${newImageUrl})`;
          element.style.transform = 'scale(0) rotateY(90deg)';
          element.style.opacity = '0';

          setTimeout(() => {
            element.style.transform = 'scale(1) rotateY(0deg)';
            element.style.opacity = '1';
          }, 0); // match transform duration in CSS
        }, delay);
      });

      setInterval(() => {
        this.isImageTrasform = false;
      }, 1000);

      this.currentImageIndex = index;
    }
  }

  private generateTilePositions(): string[] {
    const tiles: string[] = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const backgroundPosition = `-${col * (600 / this.cols)}px -${
          row * (400 / this.rows)
        }px`;
        tiles.push(backgroundPosition);
      }
    }
    return tiles;
  }

  protected trackByIndex(index: number): number {
    return index;
  }

  protected prevImage() {
    const nextIndex =
      (this.currentImageIndex - 1 + this.propertyImages.length) %
      this.propertyImages.length;
    this.animateTheImage(nextIndex);
  }

  protected nextImage() {
    const nextIndex = (this.currentImageIndex + 1) % this.propertyImages.length;
    this.animateTheImage(nextIndex);
  }
}
