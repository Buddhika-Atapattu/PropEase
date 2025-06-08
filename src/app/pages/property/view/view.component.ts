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
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
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
import { ViewPropertyImagesComponent } from '../../../components/dialogs/view-property-images/view-property-images.component';
import { APIsService, UsersType } from '../../../../services/APIs/apis.service';
import { SafeUrlPipe } from '../../../pipes/safe-url.pipe';

@Component({
  selector: 'app-view',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatDialogModule, SafeUrlPipe],
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
  protected owner: UsersType | null = null;
  protected agent: UsersType | null = null;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private propertyService: PropertyService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private dialog: MatDialog,
    private apiService: APIsService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.activatedRoute.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
    this.activatedRoute.params.subscribe((params) => {
      this.propertyID = params['propertyID'];
    });
    this.iconMaker();
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
      await this.callTheApi();
      await this.getOwnerDetails();
      await this.getAgentDetails();
      this.createImageTiles();
      this.setInitialImage();
      
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  //<==================== Icon maker ====================>
  private iconMaker() {
    const icons = [
      { name: 'viewImages', path: '/Images/Icons/view-images.svg' },
      { name: 'maid', path: '/Images/Icons/maid.svg' },
    ];

    for (let icon of icons) {
      this.matIconRegistry.addSvgIcon(
        icon.name,
        this.domSanitizer.bypassSecurityTrustResourceUrl(icon.path)
      );
    }
  }
  //<==================== End Icon maker ====================>

  //<==================== Page indicator ====================>
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
  //<==================== End Page indicator ====================>

  //<==================== Call the API to get property data ====================>
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
  //<==================== End Call the API to get property data ====================>

  //<==================== Image slider ====================>
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
  }

  private animateTheImage(index: number) {
    if (this.isBrowser) {
      this.isImageTrasform = true;
      const oldImageUrl = this.propertyImages[this.currentImageIndex].imageURL;
      const newImageUrl = this.propertyImages[index].imageURL;
      const tileElements = document.querySelectorAll('.tile');

      const maxDelay = (this.cols - 1 + (this.rows - 1)) * 50; // based on delay logic
      const animationDuration = 500;

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

      setTimeout(() => {
        this.currentImageIndex = index;
        this.isImageTrasform = false;
      }, maxDelay + animationDuration);
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
  //<==================== End Image slider ====================>

  //<==================== Open the dialod for the image preview ====================>
  protected imagePreview() {
    const dialogRef = this.dialog.open(ViewPropertyImagesComponent, {
      data: {
        images: this.propertyImages,
        currentImageIndex: this.currentImageIndex,
      },
      width: '75vw',
      height: '100%',
    });

    dialogRef.afterClosed().subscribe((result) => {});
  }

  //<==================== End Open the dialod for the image preview ====================>

  //<==================== Get the owner details by calling the api ====================>
  private async getOwnerDetails() {
    if (
      this.property &&
      this.property.addedBy &&
      this.property.addedBy.username
    ) {
      await this.propertyService
        .getUserData(this.property.owner)
        .then((response: MSG) => {
          this.owner = response.data as UsersType;
        })
        .catch((error: MSG) => {
          console.error(error);
        });
    } else {
      console.warn('Property or owner information is missing.');
    }
  }
  //<==================== End get the owner details by calling the api ====================>

  //<==================== Get the agent details by calling the api ====================>
  private async getAgentDetails() {
    if (
      this.property &&
      this.property.addedBy &&
      this.property.addedBy.username
    ) {
      await this.propertyService
        .getUserData(this.property.addedBy.username)
        .then((response: MSG) => {
          this.agent = response.data as UsersType;
        })
        .catch((error: MSG) => {
          console.error(error);
        });
    } else {
      console.warn('Property or owner information is missing.');
    }
  }
  //<==================== End get the agent details by calling the api ====================>
}
