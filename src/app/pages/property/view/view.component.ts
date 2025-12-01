// Path: src/app/pages/property/view/view.component.ts
import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import {
  BackEndPropertyData,
  PropertyService,
} from '../../../services/property/property.service';
import {
  MatIconModule,
  MatIconRegistry,
} from '@angular/material/icon';
import {
  DomSanitizer,
  SafeResourceUrl,
} from '@angular/platform-browser';
import {
  MatDialog,
  MatDialogModule,
} from '@angular/material/dialog';

import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import {
  APIsService,
  User,
} from '../../../services/APIs/apis.service';

import { SafeUrlPipe } from '../../../pipes/safe-url.pipe';
import { ViewPropertyImagesComponent } from '../../../components/dialogs/view-property-images/view-property-images.component';
import { PropertyMoreDetailsPannelComponent } from '../../../components/dialogs/property-more-details-pannel/property-more-details-pannel.component';
import { ShareComponent } from '../../../components/dialogs/share/share.component';


@Component( {
  selector: 'app-view',
  standalone: true,
  imports: [ CommonModule, MatIconModule, MatDialogModule, SafeUrlPipe ],
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss',
} )
export class ViewComponent
  implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  @ViewChild( 'sliderContainer', { static: false } )
  sliderContainer!: ElementRef<HTMLElement>;

  // ─────────────────────────────────────────────
  // General state
  // ─────────────────────────────────────────────

  protected mode: boolean | null = null;
  protected readonly isBrowser: boolean;

  private modeSub: Subscription | null = null;
  private routeUrlSub: Subscription | null = null;
  private routeParamSub: Subscription | null = null;

  protected propertyID = '';
  protected property: BackEndPropertyData | null = null;
  protected propertyImages: BackEndPropertyData[ 'images' ] = [];

  protected currentImageIndex = 0;

  // Tile grid (for the animation)
  private readonly rows = 10;
  private readonly cols = 10;
  protected imageTiles: string[] = [];

  protected isImageTrasform = false;

  protected owner: User | null = null;
  protected agent: User | null = null;

  protected isIframeEmbed = false;
  protected videoPreviewURL = '';
  protected virtualPreviewURL = '';

  private sliderInterval: ReturnType<typeof setInterval> | null = null;
  private sliderInitDone = false;

  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly activatedRoute: ActivatedRoute,
    private readonly router: Router,
    private readonly propertyService: PropertyService,
    private readonly matIconRegistry: MatIconRegistry,
    private readonly domSanitizer: DomSanitizer,
    private readonly dialog: MatDialog,
    private readonly apiService: APIsService,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    // Keep subscriptions so we can clean up in ngOnDestroy
    this.routeUrlSub = this.activatedRoute.url.subscribe( ( segments ) => {
      const path = segments.map( ( s ) => s.path ).join( '/' );
      // path is available if needed (breadcrumbs / logging etc.)
    } );

    this.routeParamSub = this.activatedRoute.params.subscribe( ( params ) => {
      this.propertyID = params[ 'propertyID' ] ?? '';
    } );

    this.registerIcons();
  }

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    if ( !this.isBrowser ) return;

    this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
      this.mode = val;
    } );

    try {
      await this.loadProperty();
      await Promise.all( [ this.getOwnerDetails(), this.getAgentDetails() ] );
      this.createImageTiles();
      this.setInitialImage();
    } catch ( err ) {
      console.error( '[ViewComponent] init failed:', err );
    }
  }

  ngAfterViewInit(): void {
    // everything slider-related is kicked off from AfterViewChecked
  }

  ngAfterViewChecked(): void {
    if ( !this.sliderInitDone && this.sliderContainer?.nativeElement ) {
      this.sliderInitDone = true;
      this.initImageSlider();
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.routeUrlSub?.unsubscribe();
    this.routeParamSub?.unsubscribe();

    if ( this.sliderInterval ) {
      clearInterval( this.sliderInterval );
      this.sliderInterval = null;
    }
  }

  // ─────────────────────────────────────────────
  // Icon registration
  // ─────────────────────────────────────────────

  private registerIcons(): void {
    const icons: { name: string; path: string; }[] = [
      { name: 'viewImages', path: 'Images/Icons/view-images.svg' },
      { name: 'maid', path: 'Images/Icons/maid.svg' },
    ];

    for ( const icon of icons ) {
      this.matIconRegistry.addSvgIcon(
        icon.name,
        this.domSanitizer.bypassSecurityTrustResourceUrl( icon.path ),
      );
    }
  }

  // ─────────────────────────────────────────────
  // Amenity icon
  // ─────────────────────────────────────────────

  protected amenityIconMaker( amenity: string ): string {
    return this.propertyService.investigateTheAmenityIcon( amenity );
  }

  // ─────────────────────────────────────────────
  // Navigation helpers
  // ─────────────────────────────────────────────

  protected goToProperties(): void {
    this.router
      .navigateByUrl( '/', { skipLocationChange: true } )
      .then( () => this.router.navigate( [ '/dashboard/properties' ] ) );
  }

  protected goToPropertyView(): void {
    this.router
      .navigateByUrl( '/', { skipLocationChange: true } )
      .then( () =>
        this.router.navigate( [
          '/dashboard/properties/property-view',
          this.propertyID,
        ] ),
      );
  }

  // ─────────────────────────────────────────────
  // API – property & user details
  // ─────────────────────────────────────────────

  private async loadProperty(): Promise<void> {
    try {
      if ( !this.propertyID ) {
        throw new Error( 'Invalid property id!' );
      }

      const res = await this.propertyService.getPropertyById( this.propertyID );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to fetch property data' );
      }

      const property: BackEndPropertyData | undefined =
        res.data?.system?.property;

      if ( !property ) {
        throw new Error( 'Invalid property data!' );
      }

      this.property = property;
      this.propertyImages = property.images ?? [];

      // Initialize video & virtual tour
      this.propertyVideoUrl( property.videoTour ?? '' );
      this.updateVirtualTourUrl( property.virtualTour ?? '' );
    } catch ( error ) {
      console.error( '[ViewComponent] loadProperty failed:', error );
    }
  }

  private async getOwnerDetails(): Promise<void> {
    try {
      if ( !this.property || !this.property.owner ) {
        throw new Error( 'Invalid owner data!' );
      }

      const res = await this.apiService.getUserByUsername(
        this.property.owner,
      );

      if ( res.status !== 'success' ) {
        throw new Error( 'Owner not found!' );
      }

      const user = res.data?.system?.user;

      if ( !user ) {
        throw new Error( 'Invalid owner data!' );
      }

      this.owner = user;
    } catch ( err ) {
      console.error( '[ViewComponent] getOwnerDetails failed:', err );
    }
  }

  private async getAgentDetails(): Promise<void> {
    try {
      if ( !this.property || !this.property.addedBy?.username ) {
        throw new Error( 'Invalid agent data!' );
      }

      const res = await this.apiService.getUserByUsername(
        this.property.addedBy.username,
      );

      const user = res.data?.system?.user;

      if ( !user ) {
        throw new Error( 'Invalid owner data!' );
      }

      if ( res.status !== 'success' ) {
        throw new Error( 'Agent not found!' );
      }

      this.agent = user;
    } catch ( err ) {
      console.error( '[ViewComponent] getAgentDetails failed:', err );
    }
  }

  // ─────────────────────────────────────────────
  // Image slider (tiles + animation)
  // ─────────────────────────────────────────────

  private createImageTiles(): void {
    if ( !this.propertyImages || this.propertyImages.length === 0 ) return;
    this.imageTiles = this.generateTilePositions();
  }

  private setInitialImage(): void {
    if ( !this.propertyImages || this.propertyImages.length === 0 ) return;

    const initialImageUrl =
      this.propertyImages[ this.currentImageIndex ]?.imageURL ?? '';

    if ( !initialImageUrl ) return;

    const tileElements =
      this.sliderContainer?.nativeElement.querySelectorAll( '.tile' ) ??
      document.querySelectorAll( '.tile' );

    tileElements.forEach( ( tile ) => {
      const element = tile as HTMLElement;
      element.style.backgroundImage = `url(${ initialImageUrl })`;
      element.style.opacity = '1';
      element.style.transform = 'scale(1) rotateY(0deg)';
    } );
  }

  private animateTheImage( nextIndex: number ): void {
    if ( !this.isBrowser ) return;
    if ( !this.propertyImages || this.propertyImages.length === 0 ) return;

    this.isImageTrasform = true;

    const oldImageUrl =
      this.propertyImages[ this.currentImageIndex ]?.imageURL ?? '';
    const newImageUrl = this.propertyImages[ nextIndex ]?.imageURL ?? '';

    if ( !newImageUrl ) {
      this.isImageTrasform = false;
      return;
    }

    const tileElements =
      this.sliderContainer?.nativeElement.querySelectorAll( '.tile' ) ??
      document.querySelectorAll( '.tile' );

    const maxDelay = ( this.cols - 1 + ( this.rows - 1 ) ) * 50;
    const animationDuration = 500;

    // Reset all tiles to old image
    tileElements.forEach( ( tile ) => {
      const element = tile as HTMLElement;
      element.style.backgroundImage = `url(${ oldImageUrl })`;
      element.style.transform = 'scale(1) rotateY(0deg)';
      element.style.opacity = '1';
    } );

    // Animate tiles to new image
    tileElements.forEach( ( tile, i ) => {
      const delay =
        ( ( i % this.cols ) + Math.floor( i / this.cols ) ) * 50;

      setTimeout( () => {
        const element = tile as HTMLElement;
        element.style.backgroundImage = `url(${ newImageUrl })`;
        element.style.transform =
          'scale(0) rotateY(90deg) rotateX(90deg) rotateZ(90deg)';
        element.style.opacity = '0';

        // reset transform to show final state
        setTimeout( () => {
          element.style.transform = 'scale(1) rotateY(0deg)';
          element.style.opacity = '1';
        }, 0 );
      }, delay );
    } );

    setTimeout( () => {
      this.currentImageIndex = nextIndex;
      this.isImageTrasform = false;
    }, maxDelay + animationDuration );
  }

  private generateTilePositions(): string[] {
    const tiles: string[] = [];

    for ( let row = 0; row < this.rows; row++ ) {
      for ( let col = 0; col < this.cols; col++ ) {
        const backgroundPosition = `-${ col * ( 600 / this.cols ) }px -${ row * ( 400 / this.rows )
          }px`;
        tiles.push( backgroundPosition );
      }
    }

    return tiles;
  }

  protected trackByIndex( index: number ): number {
    return index;
  }

  protected prevImage(): void {
    if ( !this.propertyImages || this.propertyImages.length === 0 ) return;

    const nextIndex =
      ( this.currentImageIndex - 1 + this.propertyImages.length ) %
      this.propertyImages.length;
    this.animateTheImage( nextIndex );
  }

  protected nextImage(): void {
    if ( !this.propertyImages || this.propertyImages.length === 0 ) return;

    const nextIndex =
      ( this.currentImageIndex + 1 ) % this.propertyImages.length;
    this.animateTheImage( nextIndex );
  }

  private initImageSlider(): void {
    if ( !this.isBrowser ) return;
    if ( !this.sliderContainer?.nativeElement ) return;
    if ( !this.propertyImages || this.propertyImages.length <= 1 ) return;

    const startSlider = (): void => {
      if ( this.sliderInterval ) return;
      this.sliderInterval = setInterval( () => {
        this.nextImage();
      }, 10000 );
    };

    const stopSlider = (): void => {
      if ( this.sliderInterval ) {
        clearInterval( this.sliderInterval );
        this.sliderInterval = null;
      }
    };

    const container = this.sliderContainer.nativeElement;
    container.addEventListener( 'mouseenter', () => stopSlider() );
    container.addEventListener( 'mouseleave', () => startSlider() );

    startSlider();
  }

  // ─────────────────────────────────────────────
  // Dialogs
  // ─────────────────────────────────────────────

  protected imagePreview(): void {
    this.dialog.open( ViewPropertyImagesComponent, {
      width: '75vw',
      height: 'auto',
      data: {
        images: this.propertyImages,
        currentImageIndex: this.currentImageIndex,
      },
    } );
  }

  protected shareGoogleLoacation(): void {
    this.dialog.open( ShareComponent, {
      width: 'auto',
      minWidth: '20vw',
      maxWidth: '50vw',
      height: 'auto',
      maxHeight: '80vh',
      minHeight: '5vh',
      autoFocus: false,
      enterAnimationDuration: '100ms',
      exitAnimationDuration: '100ms',
      data: {
        property: this.property ?? '',
      },
    } );
  }

  protected openMoreDetailsPannel(): void {
    this.dialog.open( PropertyMoreDetailsPannelComponent, {
      width: '95vw',
      height: '95vh',
      maxHeight: '95vh',
      maxWidth: '95vw',
      data: {
        property: this.property,
      },
    } );
  }

  // ─────────────────────────────────────────────
  // Virtual tour & video
  // ─────────────────────────────────────────────

  protected updateVirtualTourUrl( input: string ): void {
    this.virtualPreviewURL = input;
  }

  protected propertyVideoUrl( input: string ): void {
    const youtubeMatch = input.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    );
    const vimeoMatch = input.match( /vimeo\.com\/(\d+)/ );
    const driveMatch = input.match( /drive\.google\.com\/file\/d\/([^/]+)/ );

    if ( youtubeMatch ) {
      const videoId = youtubeMatch[ 1 ];
      this.videoPreviewURL = `https://www.youtube.com/embed/${ videoId }`;
      this.isIframeEmbed = true;
    } else if ( vimeoMatch ) {
      const videoId = vimeoMatch[ 1 ];
      this.videoPreviewURL = `https://player.vimeo.com/video/${ videoId }`;
      this.isIframeEmbed = true;
    } else if ( driveMatch ) {
      const fileId = driveMatch[ 1 ];
      this.videoPreviewURL = `https://drive.google.com/file/d/${ fileId }/preview`;
      this.isIframeEmbed = true;
    } else if ( input.includes( 'dropbox.com' ) ) {
      this.videoPreviewURL = input.replace( '?dl=0', '?raw=1' );
      this.isIframeEmbed = false;
    } else {
      this.videoPreviewURL = input;
      this.isIframeEmbed = false;
    }
  }
}
