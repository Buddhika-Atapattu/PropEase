// Path: src/app/pages/tenant/view-lease-agreement/view-lease-agreement.ts

// ──────────────────────────────────────────────────────────────────────────────
// Angular core / common
// ──────────────────────────────────────────────────────────────────────────────
import {
  AfterViewInit,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

// ──────────────────────────────────────────────────────────────────────────────
// Angular routing / dialogs / icons
// ──────────────────────────────────────────────────────────────────────────────
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

// ──────────────────────────────────────────────────────────────────────────────
// RxJS
// ──────────────────────────────────────────────────────────────────────────────
import { Subscription } from 'rxjs';

// ──────────────────────────────────────────────────────────────────────────────
// Shared components / pipes
// ──────────────────────────────────────────────────────────────────────────────
import { NotificationDialogComponent } from '../../../components/dialogs/notificationBar/notificationBar.component';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import { SkeletonLoaderComponent } from '../../../components/shared/skeleton-loader/skeleton-loader.component';
import { FileOpener } from '../../../components/dialogs/file-opener/file-opener';
import { LeaseAgreements } from '../../../components/dialogs/lease-agreements/lease-agreements';
import { SafeUrlPipe } from '../../../pipes/safe-url.pipe';

// ──────────────────────────────────────────────────────────────────────────────
// Services
// ──────────────────────────────────────────────────────────────────────────────
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import {
  Lease,
  LeaseWithProperty,
  ScannedFileRecordJSON,
  TenantService,
} from '../../../services/tenant/tenant.service';
import {
  BackEndPropertyData,
  PropertyService,
} from '../../../services/property/property.service';
import { AuthService } from '../../../services/auth/auth.service';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import { APIsService, User } from '../../../services/APIs/apis.service';

// ──────────────────────────────────────────────────────────────────────────────
// Local interfaces
// ──────────────────────────────────────────────────────────────────────────────

interface ScannedFilePreview {
  icon: string;
  name: string;
  size?: number;
  type?: string;
  token?: string;
  URL?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

@Component( {
  selector: 'app-view-lease-agreement',
  standalone: true,
  imports: [
    CommonModule,
    NotificationDialogComponent,
    ProgressBarComponent,
    SkeletonLoaderComponent,
    MatDialogModule,
    MatIconModule,
    SafeUrlPipe,
  ],
  templateUrl: './view-lease-agreement.html',
  styleUrl: './view-lease-agreement.scss',
} )
export class ViewLeaseAgreement implements OnInit, AfterViewInit, OnDestroy {

  // ────────────────────────────────────────────────────────────────────────────
  // ViewChilds
  // ────────────────────────────────────────────────────────────────────────────

  @ViewChild( NotificationDialogComponent )
  protected notificationDialog!: NotificationDialogComponent;

  @ViewChild( ProgressBarComponent )
  protected progressBarComponent!: ProgressBarComponent;

  // ────────────────────────────────────────────────────────────────────────────
  // General state
  // ────────────────────────────────────────────────────────────────────────────

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  protected loggedUser: User | null = null;

  // Lease / property / tenant
  private leaseID: string = '';
  private propertyID: string = '';
  private tenantUsername: string = '';

  protected lease: Lease | null = null;
  protected selectedProperty: BackEndPropertyData | null = null;
  protected tenant: User | null = null;

  protected isLoading: boolean = false;

  // Scanned files
  protected scannedDocuments: ScannedFileRecordJSON[] = [];
  protected scannedFilePreview: ScannedFilePreview[] = [];

  // Tenant image handling
  protected readonly definedMaleDummyImageURL: string =
    'Images/user-images/dummy-user/dummy-user.jpg';

  protected readonly definedWomanDummyImageURL: string =
    'Images/user-images/dummy-user/dummy_woman.jpg';

  protected definedImage: string =
    'Images/user-images/dummy-user/dummy-user.jpg';

  protected readonly definedImageExtentionArray: string[] = [
    'jpg',
    'webp',
    'jpeg',
    'png',
    'ico',
    'gif',
  ];

  // ────────────────────────────────────────────────────────────────────────────
  // Constructor
  // ────────────────────────────────────────────────────────────────────────────

  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly tenantService: TenantService,
    private readonly authService: AuthService,
    private readonly propertyService: PropertyService,
    private readonly dialog: MatDialog,
    private readonly cryptoService: CryptoService, // kept for template usage if needed
    private readonly apiService: APIsService,
    private readonly matIconRegistry: MatIconRegistry,
    private readonly domSanitizer: DomSanitizer,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.loggedUser = this.authService.getLoggedUser;

    // Optional URL watcher (currently unused, kept for future)
    this.route.url.subscribe( ( segments ) => {
      const path = segments.map( ( s ) => s.path ).join( '/' );
      // console.debug('[ViewLeaseAgreement] route path:', path);
    } );

    // Resolve leaseID from route params and load data chain
    this.route.params.subscribe( async ( params ) => {
      this.leaseID = params[ 'leaseID' ];

      await this.loadLeaseAgreement();
      await this.loadSelectedProperty();
      await this.loadTenant();
    } );

    this.registerCustomIcons();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ────────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }
  }

  ngAfterViewInit(): void {
    // View is now ready – nothing specific yet
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Shared error helper
  // ────────────────────────────────────────────────────────────────────────────

  private notifyError(
    error: unknown,
    fallbackMessage: string,
  ): void {
    console.error( error );

    if ( !this.notificationDialog ) {
      return;
    }

    if ( error instanceof HttpErrorResponse ) {
      this.notificationDialog.notification( 'error', error.message );
      return;
    }

    if ( typeof error === 'string' ) {
      this.notificationDialog.notification( 'error', error );
      return;
    }

    if ( error instanceof Error ) {
      this.notificationDialog.notification( 'error', error.message );
      return;
    }

    this.notificationDialog.notification( 'error', fallbackMessage );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Load: Lease agreement
  // ────────────────────────────────────────────────────────────────────────────

  private async loadLeaseAgreement(): Promise<void> {
    try {
      this.isLoading = true;

      if ( !this.leaseID ) {
        throw new Error( 'No lease ID found!' );
      }

      const response = await this.tenantService.getLeaseAgreementByLeaseID(
        this.leaseID,
      );

      if ( response.status !== 'success' ) {
        throw new Error( 'Lease could not be found!' );
      }

      const lease: Lease | undefined = response.data?.system?.lease;

      if ( !lease ) {
        throw new Error( 'No lease found!' );
      }

      this.lease = lease;

      // Flatten scanned documents
      this.scannedDocuments = this.flattenScannedDocuments(
        this.lease.tenantInformation?.scannedDocuments ?? [],
      );

      if ( this.scannedDocuments.length === 0 ) {
        throw new Error( 'No scanned documents found!' );
      }

      // Build preview list
      this.scannedFilePreview = this.buildScannedFilePreviews(
        this.scannedDocuments,
      );

      // Extract property ID & tenant username for later calls
      this.propertyID = this.lease.propertyID ?? '';

      if ( !this.propertyID ) {
        throw new Error( 'No property ID found!' );
      }

      this.tenantUsername = this.lease.tenantInformation.tenantUsername;

      if ( !this.tenantUsername ) {
        throw new Error( 'No tenant username found!' );
      }
    } catch ( error ) {
      this.notifyError( error, 'Failed to load lease agreement.' );
    } finally {
      setTimeout( () => {
        this.isLoading = false;
      }, 500 );
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Load: Selected property
  // ────────────────────────────────────────────────────────────────────────────

  private async loadSelectedProperty(): Promise<void> {
    try {
      if ( !this.propertyID ) {
        throw new Error( 'No property ID found!' );
      }

      const response = await this.propertyService.getPropertyById(
        this.propertyID,
      );

      if ( response.status !== 'success' ) {
        throw new Error( 'Property could not be found!' );
      }

      const property = response.data?.system?.property;

      if ( !property ) {
        throw new Error( 'No property found!' );
      }
      this.selectedProperty = property;
    } catch ( error ) {
      this.notifyError( error, 'Failed to load property data.' );
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Load: Tenant
  // ────────────────────────────────────────────────────────────────────────────

  private async loadTenant(): Promise<void> {
    try {
      if ( !this.tenantUsername ) {
        throw new Error( 'No tenant username found!' );
      }

      const response = await this.apiService.getUserByUsername(
        this.tenantUsername,
      );

      // NOTE: backend uses 'true' as status string here
      if ( response.status !== 'success' ) {
        throw new Error( 'Tenant could not be found!' );
      }

      const tenant: User | undefined = response.data?.system?.user;

      if ( !tenant ) {
        throw new Error( 'No tenant found!' );
      }
      this.tenant = tenant;
    } catch ( error ) {
      this.notifyError( error, 'Failed to load tenant data.' );
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Navigation helpers
  // ────────────────────────────────────────────────────────────────────────────

  protected goToTenantsDashboard(): void {
    this.router
      .navigateByUrl( '/', { skipLocationChange: true } )
      .then( () => {
        this.router.navigate( [ '/dashboard/tenant/tenant-home/' ] );
      } )
      .catch( ( error ) => {
        this.notifyError( error, 'Failed to navigate to tenants dashboard.' );
      } );
  }

  protected async goToTenant(): Promise<void> {
    try {
      if ( !this.tenant ) {
        throw new Error( 'No tenant information available.' );
      }

      const res = await this.apiService.generateToken( this.tenant.username );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to generate tenant token.' );
      }

      const token = this.apiService.extractTokenFromMsg( res );

      if ( !token ) {
        throw new Error( 'Invalid token generated!' );
      }

      await this.router.navigateByUrl( '/', { skipLocationChange: true } );
      await this.router.navigate( [
        '/dashboard/tenant/tenant-view/',
        token,
      ] );
    } catch ( error ) {
      this.notifyError( error, 'Unable to load tenant view.' );
    }
  }

  protected goLease(): void {
    this.router.navigate( [ '/dashboard/tenant/view-lease', this.leaseID ] )
      .catch( ( error ) => {
        this.notifyError( error, 'Failed to navigate to lease view.' );
      } );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Tenant image helper
  // ────────────────────────────────────────────────────────────────────────────

  protected generateTenantImage(
    image: string,
    gender: string,
  ): string {
    try {
      const segments: string[] = image ? image.split( '/' ) : [];

      if ( segments.length > 0 ) {
        const lastSegment: string = segments[ segments.length - 1 ];
        const extension: string | undefined = lastSegment
          .split( '.' )
          .pop()
          ?.toLowerCase();

        if (
          extension &&
          this.definedImageExtentionArray.includes( extension )
        ) {
          this.definedImage = image;
        } else {
          this.definedImage = this.getDummyImageByGender( gender );
        }
      } else {
        this.definedImage = this.getDummyImageByGender( gender );
      }

      return this.definedImage;
    } catch ( error ) {
      console.error( 'Error generating tenant image:', error );
      return this.getDummyImageByGender( gender );
    }
  }

  private getDummyImageByGender( gender: string ): string {
    return gender.toLowerCase() === 'male'
      ? this.definedMaleDummyImageURL
      : this.definedWomanDummyImageURL;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // View scanned document
  // ────────────────────────────────────────────────────────────────────────────

  protected viewScannedDocument(
    document: ScannedFilePreview,
  ): void {
    try {
      const dialogRef = this.dialog.open( FileOpener, {
        width: '100%',
        height: '100%',
        minWidth: '25vw',
        minHeight: '25vh',
        maxWidth: '75vw',
        maxHeight: '75vh',
        data: document,
      } );

      dialogRef.afterClosed().subscribe( ( result ) => {
        // Optional: handle result if needed
        // console.debug('[FileOpener closed]:', result);
      } );
    } catch ( error ) {
      this.notifyError( error, 'Failed to open scanned document.' );
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Custom icons registration
  // ────────────────────────────────────────────────────────────────────────────

  private registerCustomIcons(): void {
    const iconBasePath: string = 'Images/Icons';

    const iconMap: Record<string, string> = {
      document: 'documents.svg',
      upload: 'upload.svg',
      pdf: 'file-types/pdf.svg',
      txt: 'file-types/txt.svg',
      xml: 'file-types/xml.svg',
      excel: 'file-types/excel.svg',
      word: 'file-types/word.svg',
      powerpoint: 'file-types/powerpoint.svg',
      zip: 'file-types/zip.svg',
      file: 'file-types/file-empty.svg',
      jpeg: 'file-types/jpeg.svg',
      png: 'file-types/png.svg',
      webp: 'file-types/webp.svg',
      gif: 'file-types/gif.svg',
      jpg: 'file-types/jpg.svg',
      ico: 'file-types/ico.svg',
      svg: 'file-types/svg.svg',
      image: 'file-types/image.svg',
      viewImages: 'view-images.svg',
      maid: 'maid.svg',
    };

    Object.entries( iconMap ).forEach( ( [ name, path ] ) => {
      this.matIconRegistry.addSvgIcon(
        name,
        this.domSanitizer.bypassSecurityTrustResourceUrl(
          `${ iconBasePath }/${ path }`,
        ),
      );
    } );
  }

  protected amenityIconMaker( amenity: string ): string {
    return this.propertyService.investigateTheAmenityIcon( amenity );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // File icon chooser
  // ────────────────────────────────────────────────────────────────────────────

  protected chooceFileIcon( type: string ): string {
    const lower = type.toLowerCase();

    const wordTypes: string[] = [
      'doc',
      'docx',
      'dot',
      'dotx',
      'rtf',
      'odt',
    ];
    const excelTypes: string[] = [
      'xls',
      'xlsx',
      'xlsm',
      'xlt',
      'xltx',
      'ods',
      'csv',
      'tsv',
    ];
    const pptTypes: string[] = [
      'ppt',
      'pptx',
      'pptm',
      'pot',
      'potx',
      'odp',
    ];
    const imageTypes: string[] = [
      'png',
      'jpeg',
      'webp',
      'gif',
      'jpg',
      'ico',
      'svg',
    ];

    if ( wordTypes.includes( lower ) ) {
      return 'word';
    }
    if ( excelTypes.includes( lower ) ) {
      return 'excel';
    }
    if ( pptTypes.includes( lower ) ) {
      return 'powerpoint';
    }
    if ( lower === 'txt' ) {
      return 'txt';
    }
    if ( lower === 'xml' ) {
      return 'xml';
    }
    if ( lower === 'pdf' ) {
      return 'pdf';
    }
    if ( lower === 'zip' ) {
      return 'zip';
    }
    if ( imageTypes.includes( lower ) ) {
      return 'image';
    }

    return 'file';
  }

  // ────────────────────────────────────────────────────────────────────────────
  // String combine helper (optional)
  // ────────────────────────────────────────────────────────────────────────────

  protected makeStringCombineWhenItMightUndefined(
    valueOne: string | undefined,
    valueTwo: string | undefined,
  ): string {
    try {
      const v1: string = ( valueOne ?? '' ).trim();
      const v2: string = ( valueTwo ?? '' ).trim();

      if ( !v1 && !v2 ) {
        return '';
      }
      if ( !v1 ) {
        return v2;
      }
      if ( !v2 ) {
        return v1;
      }

      return `${ v1 } ${ v2 }`;
    } catch ( error ) {
      console.error( error );
      return '';
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Visit property details
  // ────────────────────────────────────────────────────────────────────────────

  protected viewPropertyDetails(): void {
    try {
      const propertyID: string = this.selectedProperty?.id ?? '';

      if ( !propertyID ) {
        throw new Error( 'No property ID found!' );
      }

      this.router
        .navigate( [ '/dashboard/properties/property-view', propertyID ] )
        .catch( ( error ) => {
          this.notifyError( error, 'Unable to view property details.' );
        } );
    } catch ( error ) {
      this.notifyError( error, 'Unable to view property details.' );
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Edit lease agreement
  // ────────────────────────────────────────────────────────────────────────────

  protected onEditLease(): void {
    if ( !this.lease?.leaseID ) {
      this.notifyError( 'No lease ID found!', 'Unable to edit lease.' );
      return;
    }

    this.router
      .navigate( [ '/dashboard/tenant/edit-lease', this.lease.leaseID ] )
      .catch( ( error ) => {
        this.notifyError( error, 'Unable to edit lease.' );
      } );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // View lease agreement (dialog)
  // ────────────────────────────────────────────────────────────────────────────

  protected async viewLeaseAgreement(): Promise<void> {
    try {
      const leaseID: string | undefined = this.lease?.leaseID;
      if ( !leaseID ) {
        throw new Error( 'No lease ID found!' );
      }

      const tenant: User | null = this.tenant;
      if ( !tenant ) {
        throw new Error( 'Tenant not found!' );
      }

      if ( !this.selectedProperty ) {
        throw new Error( 'No property found!' );
      }

      if ( !this.lease ) {
        throw new Error( 'No lease found!' );
      }

      const leaseWithProperty: LeaseWithProperty = {
        ...this.lease,
        property: this.selectedProperty,
      };

      const dialogRef = this.dialog.open( LeaseAgreements, {
        width: '100%',
        height: '100%',
        maxWidth: '90vw',
        maxHeight: '90vh',
        panelClass: 'fullscreen-dialog',
        data: {
          lease: leaseWithProperty,
          tenant,
        },
      } );

      dialogRef.afterClosed().subscribe( () => {
        // Optional: handle dialog result
      } );
    } catch ( error ) {
      this.notifyError(
        error,
        'Failed to open lease agreement preview dialog.',
      );
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Create complaint
  // ────────────────────────────────────────────────────────────────────────────

  protected async createComplaint(): Promise<void> {
    try {
      if ( !this.tenant ) {
        throw new Error( 'Tenant is invalid!' );
      }

      if ( !this.leaseID ) {
        throw new Error( 'Lease ID is empty!' );
      }

      const res = await this.apiService.generateToken( this.tenant.username );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to generate token!' );
      }

      const token = this.apiService.extractTokenFromMsg( res );

      if ( !token ) {
        throw new Error( 'Invalid token' );
      }

      await this.router.navigate(
        [
          '/dashboard/tenant/complaints/create-complaint',
          encodeURIComponent( token ),
        ],
        { queryParams: { leaseID: this.leaseID } },
      );
    } catch ( error ) {
      this.notifyError( error, 'Unexpected error occurred while creating complaint.' );
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Private helpers: scanned documents
  // ────────────────────────────────────────────────────────────────────────────

  private flattenScannedDocuments(
    raw: unknown,
  ): ScannedFileRecordJSON[] {
    type ScannedDoc = ScannedFileRecordJSON;

    if ( !Array.isArray( raw ) ) {
      return [];
    }

    return raw.reduce<ScannedDoc[]>( ( acc, entry ) => {
      if ( Array.isArray( entry ) ) {
        acc.push( ...( entry as ScannedDoc[] ) );
      } else if ( entry ) {
        acc.push( entry as ScannedDoc );
      }
      return acc;
    }, [] );
  }

  private buildScannedFilePreviews(
    docs: ScannedFileRecordJSON[],
  ): ScannedFilePreview[] {
    const previews: ScannedFilePreview[] = [];

    docs.forEach( ( item ) => {
      item.files.forEach( ( doc ) => {
        const name: string = doc.file.filename;
        const type: string = doc.file.mimetype;
        const size: number = doc.file.size;
        const token: string = doc.token ?? '';
        const URL: string = doc.file.URL;

        const extension: string = name.split( '.' ).pop()?.toLowerCase() ?? '';
        const icon: string = this.chooceFileIcon( extension );

        previews.push( {
          icon,
          name,
          size,
          type,
          token,
          URL,
        } );
      } );
    } );

    return previews;
  }
}
