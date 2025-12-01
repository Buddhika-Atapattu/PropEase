import {
  AsyncPipe,
  CommonModule,
  isPlatformBrowser,
} from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import {
  MatIconModule,
  MatIconRegistry,
} from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { DomSanitizer } from '@angular/platform-browser';
import {
  ActivatedRoute,
  Router,
  RouterModule,
} from '@angular/router';
import { EditorComponent } from '@tinymce/tinymce-angular';
import {
  Observable,
  Subscription,
  of,
} from 'rxjs';
import {
  map,
  startWith,
} from 'rxjs/operators';

import {
  NotificationDialogComponent,
} from '../../../components/dialogs/notification/notificationBar.component';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import { MapComponent } from '../../../components/shared/map/map.component';
import { TextEditorComponent } from '../../../components/shared/textEditor/text-editor';
import { SafeUrlPipe } from '../../../pipes/safe-url.pipe';
import {
  APIsService,
  Country,
  CountryDetails,
  CountryDetailsCustomType,
  User,
} from '../../../services/APIs/apis.service';
import { AuthService } from '../../../services/auth/auth.service';
import {
  AddedBy,
  Address,
  FEATURES_AMENITIES,
  GoogleMapLocation,
  Property,
  PropertyService,
  propertyDocPreview,
} from '../../../services/property/property.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';

// ─────────────────────────────────────────────────────────────
// Local interfaces / types
// ─────────────────────────────────────────────────────────────

interface PropertyImagePreview {
  URL: string;
  width: number;
  name: string;
  height: number;
}

@Component( {
  selector: 'app-property-listing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,

    // Shared components
    ProgressBarComponent,
    NotificationDialogComponent,
    MapComponent,
    TextEditorComponent,
    SafeUrlPipe,
    AsyncPipe,

    // Material
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatRadioModule,
    MatStepperModule,
    MatTableModule,
    MatAutocompleteModule,

    // Router
    RouterModule,
  ],
  templateUrl: './property-listing.component.html',
  styleUrl: './property-listing.component.scss',
} )
export class PropertyListingComponent
  implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild( 'propertyImages' )
  propertyImages!: ElementRef<HTMLInputElement>;

  @ViewChild( 'propertyDocs' )
  propertyDocs!: ElementRef<HTMLInputElement>;

  @ViewChild( ProgressBarComponent )
  progress!: ProgressBarComponent;

  @ViewChild( NotificationDialogComponent )
  notification!: NotificationDialogComponent;

  @ViewChild( MapComponent )
  map!: MapComponent;

  @ViewChildren( 'tabElement', { read: ElementRef } )
  tabElements!: QueryList<ElementRef>;

  // ─────────────────────────────────────────────────────────────
  // General state
  // ─────────────────────────────────────────────────────────────

  protected isFormError = false;
  protected isFormErrorText = '';

  protected mode: boolean | null = null;
  protected readonly isBrowser: boolean;

  private modeSub: Subscription | null = null;
  private routeSub: Subscription | null = null;

  protected loggedUser: User | null = null;
  protected loggedUsername = '';

  protected istabOpenButtonActive = false;

  // ─────────────────────────────────────────────────────────────
  // 01. Basic Property Details
  // ─────────────────────────────────────────────────────────────

  protected id: Property[ 'id' ] = '';
  protected title: Property[ 'title' ] = '';
  protected type: Property[ 'type' ] = '';
  protected listing: Property[ 'listing' ] = '';
  protected description: Property[ 'description' ] = '';

  // ─────────────────────────────────────────────────────────────
  // 02. Location Details
  // ─────────────────────────────────────────────────────────────

  // Country details
  protected country: Property[ 'countryDetails' ] | null = null;

  // Address
  protected AddressHouseNumber: Address[ 'houseNumber' ] = '';
  protected AddressStreet: Address[ 'street' ] = '';
  protected AddressCity: Address[ 'city' ] = '';
  protected AddressStateOrProvince: Address[ 'stateOrProvince' ] = '';
  protected AddressPostcode: Address[ 'postcode' ] = '';

  protected AddressCountry: Country | string = '';
  protected AddressFilteredCountries!: Observable<Country[]>;
  protected AddressCountries: Country[] = [];
  protected AddressCountryControl: FormControl = new FormControl( '' );
  protected countryMissMatch = false;
  private typeAddressCountry = '';

  // Location (map)
  protected mapLocationLat: GoogleMapLocation[ 'lat' ] = 0;
  protected mapLocationLng: GoogleMapLocation[ 'lng' ] = 0;
  protected GoogleMapLocationEmbeddedUrl: GoogleMapLocation[ 'embeddedUrl' ] = '';

  private location: Property[ 'location' ] = {
    lat: this.mapLocationLat,
    lng: this.mapLocationLng,
    embeddedUrl: this.GoogleMapLocationEmbeddedUrl,
  };

  // ─────────────────────────────────────────────────────────────
  // 03. Property Specifications
  // ─────────────────────────────────────────────────────────────

  protected totalArea: Property[ 'totalArea' ] = 0;
  protected builtInArea: Property[ 'builtInArea' ] = 0;
  protected livingRooms: Property[ 'livingRooms' ] = 0;
  protected balconies: Property[ 'balconies' ] = 0;
  protected kitchen: Property[ 'kitchen' ] = 0;
  protected bedrooms: Property[ 'bedrooms' ] = 0;
  protected bathrooms: Property[ 'bathrooms' ] = 0;
  protected maidrooms: Property[ 'maidrooms' ] = 0;
  protected driverRooms: Property[ 'driverRooms' ] = 0;
  protected furnishingStatus: Property[ 'furnishingStatus' ] = 'Unfurnished';
  protected totalFloors: Property[ 'totalFloors' ] = 0;
  protected numberOfParking: Property[ 'numberOfParking' ] = 0;

  // ─────────────────────────────────────────────────────────────
  // 04. Construction & Age
  // ─────────────────────────────────────────────────────────────

  protected builtYear: Property[ 'builtYear' ] = 0;
  protected propertyCondition: Property[ 'propertyCondition' ] = 'New';
  protected developerName: Property[ 'developerName' ] = '';
  protected projectName: Property[ 'projectName' ] = '';
  protected ownerShipType: Property[ 'ownerShipType' ] = 'Freehold';

  // ─────────────────────────────────────────────────────────────
  // 05. Financial Details
  // ─────────────────────────────────────────────────────────────

  protected price: Property[ 'price' ] = 0;

  protected isPriceCurrencyPanelOpen = false;
  protected countryControlWithCurrency: FormControl = new FormControl( '' );
  protected filteredCountriesWithCurrency!: Observable<CountryDetailsCustomType[]>;
  protected allCountriesWithCurrency: CountryDetailsCustomType[] = [];
  protected selectedCountryWithCurrency: CountryDetails | null = null;
  protected isCurrencySelected = false;
  private isCountryOfCurrencySelected = false;
  protected countryOfCurrencySelectedError = false;

  protected countryActualCurrency = '';
  protected pricePerSqurFeet: Property[ 'pricePerSqurFeet' ] = 0;
  protected expectedRentYearly: Property[ 'expectedRentYearly' ] = 0;
  protected expectedRentQuartely: Property[ 'expectedRentQuartely' ] = 0;
  protected expectedRentMonthly: Property[ 'expectedRentMonthly' ] = 0;
  protected expectedRentDaily: Property[ 'expectedRentDaily' ] = 0;
  protected maintenanceFees: Property[ 'maintenanceFees' ] = 0;
  protected serviceCharges: Property[ 'serviceCharges' ] = 0;
  protected transferFees: Property[ 'transferFees' ] = 0;
  protected availabilityStatus: Property[ 'availabilityStatus' ] = '';

  // ─────────────────────────────────────────────────────────────
  // 06. Features & Amenities
  // ─────────────────────────────────────────────────────────────

  protected featureAmenities: Property[ 'featuresAndAmenities' ] = [];
  protected featureAmenity = '';
  protected isAmenitiesNotIncluded = false;
  protected amenitiesNotIncludedText = '';

  // ─────────────────────────────────────────────────────────────
  // 07. Media
  // ─────────────────────────────────────────────────────────────

  // Images
  protected isPropertyImageDragOver = false;
  protected propertyImagePreview: PropertyImagePreview[] = [];
  private selectedPropertyImages: File[] = [];
  protected isPropertyImageTypeMissMatched = false;
  protected propertyErrorText = 'Error';

  private readonly allowedImageTypes: string[] = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
  ];

  // Documents
  private propertyDocuments: File[] = [];
  protected isPropertyDocsDragOver = false;
  protected propertyDocsPreview: propertyDocPreview[] = [];

  private readonly propertyFormAllowedDocs: string[] = [
    // Word
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
    'application/rtf',

    // Excel
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    'text/csv',
    'text/tab-separated-values',

    // PowerPoint
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.template',

    // OpenDocument
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',

    // PDF
    'application/pdf',

    // Plain text
    'text/plain',
  ];

  protected videoTour: Property[ 'videoTour' ] = '';
  protected virtualTour: Property[ 'virtualTour' ] = '';
  protected isIframeEmbed = false;

  protected videoPreviewURL = '';
  protected virtualPreviewURL = '';

  // ─────────────────────────────────────────────────────────────
  // 08. Listing Management
  // ─────────────────────────────────────────────────────────────

  protected listingDate: Property[ 'listingDate' ] = new Date();
  protected availabilityDate: Property[ 'availabilityDate' ] = new Date();
  protected listingExpiryDate: Property[ 'listingExpiryDate' ] = new Date();

  protected AddedByUsername: AddedBy[ 'username' ] = '';
  protected AddedByName: AddedBy[ 'name' ] = '';
  protected AddedByEmail: AddedBy[ 'email' ] = '';
  protected AddedByRole: AddedBy[ 'role' ] = '';
  protected AddedByContactNumber: AddedBy[ 'contactNumber' ] = '';
  protected AddedByAddedAt: AddedBy[ 'addedAt' ] = new Date();

  private AddedBy: Property[ 'addedBy' ] = {
    username: this.AddedByUsername,
    name: this.AddedByName,
    email: this.AddedByEmail,
    role: this.AddedByRole,
    contactNumber: this.AddedByContactNumber,
    addedAt:
      this.AddedByAddedAt instanceof Date
        ? this.AddedByAddedAt.toISOString()
        : this.AddedByAddedAt,
  };

  // Owner info
  protected ownerUsername = '';
  protected allUsers: User[] = [];
  protected selectedOwner: User | null = null;
  protected ownerName = '';
  protected filterOwner: User[] = [];
  protected isOwnerNotSelected = false;

  // ─────────────────────────────────────────────────────────────
  // 09. Administrative & Internal Use
  // ─────────────────────────────────────────────────────────────

  protected referenceCode: Property[ 'referenceCode' ] = '';
  protected verificationStatus: Property[ 'verificationStatus' ] = 'Pending';
  protected priority: Property[ 'priority' ] = 'Medium';
  protected status: Property[ 'status' ] = 'Draft';
  protected internalNote: Property[ 'internalNote' ] = '';

  // ─────────────────────────────────────────────────────────────
  // Predefined options / suggestions
  // ─────────────────────────────────────────────────────────────

  protected statusOptions: string[] = [ 'Sale', 'Rent', 'Sold', 'Rented' ];
  protected filterStatusOptions: string[] = [];

  protected typeOptions: string[] = [
    'Apartment',
    'House',
    'Villa',
    'Commercial',
    'Land',
    '',
  ];
  protected filterTypeOptions: string[] = [];

  protected definedFeatureAmenity: string[] = FEATURES_AMENITIES;
  protected filterFeatureAmenity: string[] = [];

  protected furnishingStatusOptions: string[] = [
    'Unfurnished',
    'Semi-Furnished',
    'Furnished',
  ];
  protected filterFurnishingStatusOptions: string[] = [];

  protected propertyConditionOptions: string[] = [
    'New',
    'Excellent',
    'Old',
    'Good',
    'Needs Renovation',
  ];
  protected filterPropertyConditionOptions: string[] = [];

  protected propertyAvailabilityStatusOptions: string[] = [
    'Available',
    'Not Available',
    'Pending',
    'Ready to Move',
  ];
  protected filterPropertyAvailabilityStatusOptions: string[] = [];

  protected propertyPriorityOptions: string[] = [ 'High', 'Medium', 'Low' ];
  protected filterPropertyPriorityOptions: string[] = [];

  protected propertyVerificationStatusOptions: string[] = [
    'Pending',
    'Approved',
    'Rejected',
  ];
  protected filterPropertyVerificationStatusOptions: string[] = [];

  protected propertyStatusOptions: string[] = [
    'Archived',
    'Draft',
    'Published',
  ];
  protected filterPropertyStatusOptions: string[] = [];

  protected ownerShipTypeOptions: string[] = [
    'Freehold',
    'Leasehold',
    'Company',
    'Trust',
  ];
  protected filterOwnerShipTypeOptions: string[] = [];

  // Text editor init
  init: EditorComponent[ 'init' ] = {
    plugins: 'lists link image table code help wordcount',
  };

  // ─────────────────────────────────────────────────────────────
  // Tab indicator
  // ─────────────────────────────────────────────────────────────

  protected tabIndicators: string[] = [
    'Basic',
    'Location',
    'Specifications',
    'Construction',
    'Financial',
    'Features',
    'Media',
    'Listing',
    'Admin',
  ];

  protected tabIndicatorsActive = false;
  protected currentIndex = 0;
  protected indicatorStyle: { width?: string; transform?: string; } = {};

  // ─────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────

  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly route: ActivatedRoute,
    private readonly matIconRegistry: MatIconRegistry,
    private readonly domSanitizer: DomSanitizer,
    private readonly authService: AuthService,
    private readonly propertyService: PropertyService,
    private readonly apiService: APIsService,
    private readonly router: Router,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    this.routeSub = this.route.url.subscribe( ( segments ) => {
      const path = segments.map( ( s ) => s.path ).join( '/' );
      // path available if ever needed
    } );

    // Logged user
    this.loggedUser = this.authService.getLoggedUser;
    this.loggedUsername = this.loggedUser?.username ?? '';

    this.AddedByUsername = this.loggedUser?.username ?? '';
    this.AddedByName = this.loggedUser?.name ?? '';
    this.AddedByEmail = this.loggedUser?.email ?? '';
    this.AddedByRole = this.loggedUser?.role ?? '';
    this.AddedByContactNumber = this.loggedUser?.phoneNumber ?? '';
    this.AddedByAddedAt = new Date();

    this.registerCustomIcons();
    this.id = this.propertyService.generatePropertyId();
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );

      window.addEventListener( 'dragover', this.preventDefault, {
        passive: false,
      } );
      window.addEventListener( 'drop', this.preventDefault, {
        passive: false,
      } );
    }
  }

  ngAfterViewInit(): void {
    if ( this.isBrowser ) {
      setTimeout( () => this.updateIndicatorPosition( this.currentIndex ) );
    }
  }

  ngOnDestroy(): void {
    if ( this.isBrowser ) {
      window.removeEventListener( 'dragover', this.preventDefault );
      window.removeEventListener( 'drop', this.preventDefault );
    }

    this.modeSub?.unsubscribe();
    this.routeSub?.unsubscribe();
  }

  // ─────────────────────────────────────────────────────────────
  // Permissions
  // ─────────────────────────────────────────────────────────────

  protected isUserCanAssignAgentToTheProperty(): boolean {
    return (
      this.loggedUser?.access.permissions.some(
        ( permission ) =>
          permission.module === 'Property Management' &&
          permission.actions.includes( 'assign agent' ),
      ) ?? false
    );
  }

  protected isUserCanUploadDocumentsToTheProperty(): boolean {
    return (
      this.loggedUser?.access.permissions.some(
        ( permission ) =>
          permission.module === 'Property Management' &&
          permission.actions.includes( 'upload documents' ),
      ) ?? false
    );
  }

  protected isUserCanManageAmenitiesToTheProperty(): boolean {
    return (
      this.loggedUser?.access.permissions.some(
        ( permission ) =>
          permission.module === 'Property Management' &&
          permission.actions.includes( 'manage amenities' ),
      ) ?? false
    );
  }

  protected isUserCanChangeListingStatusOfTheProperty(): boolean {
    return (
      this.loggedUser?.access.permissions.some(
        ( permission ) =>
          permission.module === 'Property Management' &&
          permission.actions.includes( 'change status' ),
      ) ?? false
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Mobile tab open button
  // ─────────────────────────────────────────────────────────────

  protected tabOpenButtonOperation(): void {
    this.istabOpenButtonActive = !this.istabOpenButtonActive;
  }

  // ─────────────────────────────────────────────────────────────
  // Tabs
  // ─────────────────────────────────────────────────────────────

  protected tabMaker( index: number, _tabName: string ): void {
    if ( !this.isBrowser ) return;
    this.currentIndex = index;
    setTimeout( () => this.updateIndicatorPosition( index ) );
  }

  private updateIndicatorPosition( index: number ): void {
    const tabEl = this.tabElements.get( index )?.nativeElement;
    if ( !tabEl ) return;

    const { offsetLeft, offsetWidth } = tabEl;

    const newStyle = {
      width: `${ offsetWidth }px`,
      transform: `translateX(${ offsetLeft }px)`,
    };

    if (
      this.indicatorStyle.width !== newStyle.width ||
      this.indicatorStyle.transform !== newStyle.transform
    ) {
      this.indicatorStyle = newStyle;
    }

    this.istabOpenButtonActive = false;
  }

  protected goBack(): void {
    if ( this.currentIndex > 0 ) {
      this.tabMaker( this.currentIndex - 1, this.tabIndicators[ this.currentIndex - 1 ] );
    }
  }

  protected goNext(): void {
    if ( this.currentIndex < this.tabIndicators.length - 1 ) {
      this.tabMaker( this.currentIndex + 1, this.tabIndicators[ this.currentIndex + 1 ] );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Sorting helpers
  // ─────────────────────────────────────────────────────────────

  private sortOptions( base: string[], filter: string[] ): string[] {
    const source = filter.length === 0 ? base : filter;
    return [ ...source ].sort( ( a, b ) => a.localeCompare( b ) );
  }

  protected propertyTypeSort(): string[] {
    return this.sortOptions( this.typeOptions, this.filterTypeOptions );
  }

  protected propertyStatusSort(): string[] {
    return this.sortOptions( this.statusOptions, this.filterStatusOptions );
  }

  protected propertyAmenitiesSort(): string[] {
    return this.sortOptions( this.definedFeatureAmenity, this.filterFeatureAmenity );
  }

  protected propertyFurnishingStatusOptionsSort(): string[] {
    return this.sortOptions(
      this.furnishingStatusOptions,
      this.filterFurnishingStatusOptions,
    );
  }

  protected propertyConditionOptionsSort(): string[] {
    return this.sortOptions(
      this.propertyConditionOptions,
      this.filterPropertyConditionOptions,
    );
  }

  protected propertyAvailabilityStatusOptionsSort(): string[] {
    return this.sortOptions(
      this.propertyAvailabilityStatusOptions,
      this.filterPropertyAvailabilityStatusOptions,
    );
  }

  protected propertyPriorityOptionsSort(): string[] {
    return this.sortOptions(
      this.propertyPriorityOptions,
      this.filterPropertyPriorityOptions,
    );
  }

  protected propertyVerificationStatusOptionsSort(): string[] {
    return this.sortOptions(
      this.propertyVerificationStatusOptions,
      this.filterPropertyVerificationStatusOptions,
    );
  }

  protected propertyStatusOptionsSort(): string[] {
    return this.sortOptions(
      this.propertyStatusOptions,
      this.filterPropertyStatusOptions,
    );
  }

  protected ownerShipTypeOptionsSort(): string[] {
    return this.sortOptions(
      this.ownerShipTypeOptions,
      this.filterOwnerShipTypeOptions,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Amenities
  // ─────────────────────────────────────────────────────────────

  protected amenityIconMaker( amenity: string ): string {
    return this.propertyService.investigateTheAmenityIcon( amenity );
  }

  protected addFeaturesAmenity( event: MatAutocompleteSelectedEvent ): void {
    const value = event.option.value as string;
    if ( !this.featureAmenities.includes( value ) ) {
      this.featureAmenities.push( value );
    }
  }

  protected cancelAmenty( index: number ): void {
    this.featureAmenities.splice( index, 1 );
  }

  protected addFeaturesAmenityEnter( event: Event ): void {
    const keyboardEvent = event as KeyboardEvent;
    if ( keyboardEvent.key === 'Enter' && this.featureAmenity.trim() !== '' ) {
      this.featureAmenities.push( this.featureAmenity.trim() );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Mat icon registration
  // ─────────────────────────────────────────────────────────────

  private registerCustomIcons(): void {
    const iconMap: Record<string, string> = {
      document: 'documents.svg',
      fileExcel: 'fileExcel.svg',
      search: 'search.svg',
      reset: 'reset.svg',
      download: 'download.svg',
      eye: 'eye',
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
      close: 'wrong.svg',
    };

    for ( const [ name, path ] of Object.entries( iconMap ) ) {
      this.matIconRegistry.addSvgIcon(
        name,
        this.domSanitizer.bypassSecurityTrustResourceUrl( `Images/Icons/${ path }` ),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // File icon chooser
  // ─────────────────────────────────────────────────────────────

  protected chooceIcon( type: string ): string {
    switch ( type ) {
      // Word
      case 'doc':
      case 'docx':
      case 'dot':
      case 'dotx':
      case 'rtf':
      case 'odt':
        return 'word';

      // Text
      case 'txt':
        return 'txt';
      case 'xml':
        return 'xml';

      // Excel
      case 'xls':
      case 'xlsx':
      case 'xlsm':
      case 'xlt':
      case 'xltx':
      case 'ods':
      case 'csv':
      case 'tsv':
        return 'excel';

      // PowerPoint
      case 'ppt':
      case 'pptx':
      case 'pptm':
      case 'pot':
      case 'potx':
      case 'odp':
        return 'powerpoint';

      case 'pdf':
        return 'pdf';
      case 'zip':
        return 'zip';

      // Images
      case 'png':
      case 'jpeg':
      case 'webp':
      case 'gif':
      case 'jpg':
      case 'ico':
      case 'svg':
        return 'image';

      default:
        return 'file';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Drag/drop helpers
  // ─────────────────────────────────────────────────────────────

  private readonly preventDefault = ( event: Event ): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  // ─────────────────────────────────────────────────────────────
  // Navigation helpers
  // ─────────────────────────────────────────────────────────────

  protected goToProperties(): void {
    this.router
      .navigateByUrl( '/', { skipLocationChange: true } )
      .then( () => this.router.navigate( [ '/dashboard/properties' ] ) );
  }

  protected goToListing(): void {
    this.router
      .navigateByUrl( '/', { skipLocationChange: true } )
      .then( () => this.router.navigate( [ '/dashboard/property-listing' ] ) );
  }

  // ─────────────────────────────────────────────────────────────
  // Property Images
  // ─────────────────────────────────────────────────────────────

  protected closePropertyImagesError(): void {
    this.isPropertyImageTypeMissMatched = false;
    this.propertyErrorText = '';
  }

  protected triggerPropertyImages(): void {
    this.propertyImages.nativeElement.click();
  }

  protected handlePastePropertyImage( event: ClipboardEvent ): void {
    event.preventDefault();

    const items = event.clipboardData?.items;
    if ( !items ) return;

    for ( const item of items ) {
      if ( item.kind === 'file' ) {
        const file = item.getAsFile();
        if ( file ) {
          this.processPastedPropertyImage( file );
        }
      }
    }
  }

  protected processPastedPropertyImage( file: File ): void {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add( file );

    const input = this.propertyImages.nativeElement;
    input.files = dataTransfer.files;

    this.onFileSelectedPropertyImage( { target: input } as unknown as Event );
  }

  protected onDropPropertyImage( event: DragEvent ): void {
    event.preventDefault();
    this.isPropertyImageDragOver = false;

    const files = event.dataTransfer?.files;
    if ( files ) {
      this.propertyImagePreviewMaker( files );
    }
  }

  protected onDragOverPropertyImage( event: DragEvent ): void {
    event.preventDefault();
    event.stopPropagation();

    if ( event.currentTarget === event.target ) {
      this.isPropertyImageDragOver = true;
    }
  }

  protected onDragLeavePropertyImage( event: DragEvent ): void {
    event.preventDefault();
    this.isPropertyImageDragOver = false;
  }

  protected onFileSelectedPropertyImage( event: Event ): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if ( !files ) return;
    this.propertyImagePreviewMaker( files );
  }

  private propertyImagePreviewMaker( files: FileList ): void {
    for ( const file of Array.from( files ) ) {
      if ( !this.allowedImageTypes.includes( file.type ) ) {
        this.isPropertyImageTypeMissMatched = true;
        this.propertyErrorText = `Error: ${ file.name } type ${ file.type } not allowed!`;
        return;
      }

      this.selectedPropertyImages.push( file );

      const reader = new FileReader();
      reader.onload = ( e: ProgressEvent<FileReader> ) => {
        const result = e.target?.result;
        if ( !result ) return;

        const img = new Image();
        img.onload = () => {
          const data: PropertyImagePreview = {
            URL: result as string,
            width: img.width,
            height: img.height,
            name: file.name,
          };
          this.propertyImagePreview.push( data );
        };
        img.src = result as string;
      };

      reader.readAsDataURL( file );
    }
  }

  protected removePropertyImage( index: number ): void {
    this.propertyImagePreview.splice( index, 1 );
    this.selectedPropertyImages.splice( index, 1 );
  }

  // ─────────────────────────────────────────────────────────────
  // Property Docs
  // ─────────────────────────────────────────────────────────────

  protected triggerPropertyDocs(): void {
    this.propertyDocs.nativeElement.click();
  }

  protected onPropertyDocsSelect( event: Event ): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if ( !files ) return;
    void this.propertyDocsPreviewMaker( files );
  }

  protected onDragOverPropertyDocs( event: DragEvent ): void {
    event.preventDefault();
    event.stopPropagation();
    if ( event.currentTarget === event.target ) {
      this.isPropertyDocsDragOver = true;
    }
  }

  protected onDropPropertyDocs( event: DragEvent ): void {
    event.preventDefault();
    this.isPropertyDocsDragOver = false;

    const files = event.dataTransfer?.files;
    if ( files ) {
      void this.propertyDocsPreviewMaker( files );
    }
  }

  protected onDragLeavePropertyDocs( event: DragEvent ): void {
    event.preventDefault();
    this.isPropertyDocsDragOver = false;
  }

  protected handlePastePropertyDocs( event: ClipboardEvent ): void {
    event.preventDefault();

    const items = event.clipboardData?.items;
    if ( !items ) return;

    for ( const item of items ) {
      if ( item.kind === 'file' ) {
        const file = item.getAsFile();
        if ( file ) {
          this.processPastedPropertyDocs( file );
        }
      }
    }
  }

  protected processPastedPropertyDocs( file: File ): void {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add( file );

    const input = this.propertyDocs.nativeElement;
    input.files = dataTransfer.files;

    if ( input.files ) {
      void this.propertyDocsPreviewMaker( input.files );
    }
  }

  private async propertyDocsPreviewMaker( files: FileList ): Promise<void> {
    for ( const file of Array.from( files ) ) {
      if ( !this.propertyFormAllowedDocs.includes( file.type ) ) {
        await this.notification.notification(
          'error',
          `Error: ${ file.name } type ${ file.type } is not allowed!`,
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const fileName = file.name;
        const fileExtension = file.name.split( '.' ).pop() as string;

        const data: propertyDocPreview = {
          name: fileName,
          type: fileExtension,
          icon: this.chooceIcon( fileExtension ),
        };

        this.propertyDocsPreview.push( data );
      };

      this.propertyDocuments.push( file );
      reader.readAsDataURL( file );
    }
  }

  protected removeDocs( index: number ): void {
    this.propertyDocsPreview.splice( index, 1 );
    this.propertyDocuments.splice( index, 1 );
  }

  // ─────────────────────────────────────────────────────────────
  // Filters (type / status / amenities)
  // ─────────────────────────────────────────────────────────────

  protected filterTypeOperation( data: string ): void {
    const safe = data.toLowerCase();
    this.filterTypeOptions = this.typeOptions.filter( ( option ) =>
      option.toLowerCase().includes( safe ),
    );
  }

  protected filterStatusOperation( data: string ): void {
    const safe = data.toLowerCase();
    this.filterStatusOptions = this.statusOptions.filter( ( option ) =>
      option.toLowerCase().includes( safe ),
    );
  }

  protected filterFeatureAmenityOperation( data: string ): void {
    if ( !this.definedFeatureAmenity.includes( data ) ) {
      this.isAmenitiesNotIncluded = true;
      this.amenitiesNotIncludedText = data;
    }

    const safe = data.toLowerCase();
    this.filterFeatureAmenity = this.definedFeatureAmenity.filter( ( option ) =>
      option.toLowerCase().includes( safe ),
    );
  }

  protected addNewAminity(): void {
    this.isAmenitiesNotIncluded = false;
    if ( this.amenitiesNotIncludedText.trim() ) {
      this.featureAmenities.push( this.amenitiesNotIncludedText.trim() );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Address – country autocomplete
  // ─────────────────────────────────────────────────────────────

  protected async addressMainFilterCountries(
    data: string | { name: string; },
  ): Promise<void> {
    if ( typeof data === 'object' && data && typeof data.name === 'string' ) {
      this.typeAddressCountry = data.name.toLowerCase();
    } else if ( typeof data === 'string' ) {
      this.typeAddressCountry = data.toLowerCase();
    } else {
      this.typeAddressCountry = '';
    }

    const countries: Country[] = await this.apiService.getCountries();
    if ( !Array.isArray( countries ) ) return;

    this.AddressCountries = countries;

    this.AddressFilteredCountries =
      this.AddressCountryControl.valueChanges.pipe(
        startWith( this.typeAddressCountry ),
        map( ( value: string | Country | null ) => {
          const name =
            typeof value === 'string'
              ? value.toLowerCase()
              : typeof value?.name === 'string'
                ? value.name.toLowerCase()
                : '';

          return name
            ? this.addressFilterCountries( name )
            : this.AddressCountries.slice();
        } ),
      );
  }

  protected addressFilterCountries( name: string ): Country[] {
    const filterValue = name.toLowerCase();
    return this.AddressCountries.filter( ( c ) =>
      c.name.toLowerCase().includes( filterValue ),
    );
  }

  protected addressDisplayFlag( country: Country | string ): string {
    return typeof country === 'string' ? country : country?.name ?? '';
  }

  // ─────────────────────────────────────────────────────────────
  // Currency controller
  // ─────────────────────────────────────────────────────────────

  protected openCurrency(): void {
    this.isPriceCurrencyPanelOpen = true;
    this.isCurrencySelected = false;
    this.countryActualCurrency = '';
    this.selectedCountryWithCurrency = null;
    this.allCountriesWithCurrency = [];
    this.filteredCountriesWithCurrency = of( [] );
    this.isCountryOfCurrencySelected = false;
  }

  protected closeCurrency(): void {
    if ( this.isCountryOfCurrencySelected ) {
      this.isPriceCurrencyPanelOpen = false;
      this.countryOfCurrencySelectedError = false;
    } else {
      this.countryOfCurrencySelectedError = true;
    }
  }

  protected async selectCountriesWithCurrencies( input: string ): Promise<void> {
    const countries = await this.apiService.getCustomCountryDetails();
    if ( !Array.isArray( countries ) ) return;

    this.filteredCountriesWithCurrency =
      this.countryControlWithCurrency.valueChanges.pipe(
        startWith( input ),
        map( ( value: string | CountryDetailsCustomType ) => {
          const name =
            typeof value === 'string'
              ? value.toLowerCase()
              : value?.name?.common?.toLowerCase() ?? '';
          return name
            ? countries.filter( ( country ) =>
              country?.name?.common?.toLowerCase().includes( name ),
            )
            : countries.slice();
        } ),
      );
  }

  protected async selectCountryWithCurrency(
    event: MatAutocompleteSelectedEvent,
  ): Promise<void> {
    const data = event.option.value as CountryDetailsCustomType;
    const countryName = data.name.common;

    const country: CountryDetails[] = await this.apiService.getCountryByName(
      countryName,
    );

    if ( !Array.isArray( country ) || country.length === 0 ) {
      console.error( 'Country not found!' );
      return;
    }

    this.country = country[ 0 ];

    const currencySymbol = this.country?.currencies
      ? Object.keys( this.country.currencies )[ 0 ]
      : '';

    this.isCurrencySelected = true;
    this.countryActualCurrency = currencySymbol;

    if ( this.countryActualCurrency ) {
      this.isCountryOfCurrencySelected = true;
      this.countryOfCurrencySelectedError = false;
    }
  }

  protected displayCountryWithCurrencyFlag(
    country: CountryDetailsCustomType | string,
  ): string {
    return typeof country === 'string' ? country : country?.name?.common ?? '';
  }

  // ─────────────────────────────────────────────────────────────
  // Property owner info
  // ─────────────────────────────────────────────────────────────

  protected async filterOwnerThroughAllUsers( input: string ): Promise<void> {
    try {
      this.isOwnerNotSelected = true;
      const res = await this.apiService.getAllUsers();

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to fetch users!' );
      }

      const users = res.data?.system?.users;
      if ( !Array.isArray( users ) || users.length === 0 ) {
        throw new Error( 'Invalid array of users!' );
      }


      this.allUsers = users;
      const safe = input.toLowerCase();
      this.filterOwner = users.filter( ( user ) =>
        user.name.toLowerCase().includes( safe ),
      );
    }
    catch ( error ) {
      console.error( error );
    }

  }

  protected getTheSelectedOwner( input: MatAutocompleteSelectedEvent ): void {
    const selectedOwnerName = input.option.value as string;

    if ( selectedOwnerName ) {
      this.isOwnerNotSelected = false;
      this.selectedOwner =
        this.allUsers.find(
          ( user ) =>
            user.name.toLowerCase() === selectedOwnerName.toLowerCase(),
        ) ?? null;
    } else {
      this.isOwnerNotSelected = true;
      this.selectedOwner = null;
    }

    if ( this.selectedOwner ) {
      this.ownerUsername = this.selectedOwner.username;
      this.ownerName = this.selectedOwner.name;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Map
  // ─────────────────────────────────────────────────────────────

  protected onLocationPicked( event: { lat: number; lng: number; } ): void {
    this.mapLocationLat = event.lat;
    this.mapLocationLng = event.lng;
    this.GoogleMapLocationEmbeddedUrl = `https://www.google.com/maps?q=${ this.mapLocationLat },${ this.mapLocationLng }&hl=en&z=14&output=embed`;

    this.location = {
      lat: this.mapLocationLat,
      lng: this.mapLocationLng,
      embeddedUrl: this.GoogleMapLocationEmbeddedUrl,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Video & virtual tour
  // ─────────────────────────────────────────────────────────────

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

  protected updateVirtualTourUrl( input: string ): void {
    this.virtualPreviewURL = input;
  }

  // ─────────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────────

  protected async submit(): Promise<void> {
    try {
      // Permission guard
      if (
        !this.isUserCanAssignAgentToTheProperty() &&
        !this.isUserCanUploadDocumentsToTheProperty() &&
        !this.isUserCanManageAmenitiesToTheProperty() &&
        !this.isUserCanChangeListingStatusOfTheProperty()
      ) {
        throw new Error( 'User does not have permission to perform this action.' );
      }

      // Address
      const address: Address = {
        houseNumber: this.AddressHouseNumber.trim(),
        street: ( this.AddressStreet ?? '' ).trim(),
        city: this.AddressCity.trim(),
        stateOrProvince: ( this.AddressStateOrProvince ?? '' ).trim(),
        postcode: this.AddressPostcode.trim(),
        country: this.typeAddressCountry.trim(),
      };

      // Agent info
      this.AddedBy = {
        username: this.AddedByUsername.trim(),
        name: this.AddedByName.trim(),
        email: this.AddedByEmail.trim(),
        role: this.AddedByRole.trim(),
        contactNumber: ( this.AddedByContactNumber ?? '' ).trim(),
        addedAt:
          this.AddedByAddedAt instanceof Date
            ? this.AddedByAddedAt.toISOString().trim()
            : ( this.AddedByAddedAt ?? '' ).toString().trim(),
      };

      const formData = new FormData();

      // ── Basic validations ───────────────────────────────

      // Basic property details
      if ( !this.title ) throw new Error( 'Title is required!' );
      if ( !this.type ) throw new Error( 'Type is required!' );
      if ( !this.listing ) throw new Error( 'Listing is required!' );
      if ( !this.description ) throw new Error( 'Description is required!' );

      // Location
      if ( !this.AddressHouseNumber ) throw new Error( 'House number is required!' );
      if ( !this.AddressStreet ) throw new Error( 'Address street is required!' );
      if ( !this.AddressCity ) throw new Error( 'Address city is required!' );
      if ( !this.AddressStateOrProvince ) {
        throw new Error( 'Address state or province is required!' );
      }
      if ( !this.AddressPostcode ) throw new Error( 'Address postcode is required!' );
      if ( !this.typeAddressCountry ) throw new Error( 'Country is required!' );

      // Property Specifications
      if ( this.totalArea !== 0 && !this.totalArea ) {
        throw new Error( 'Total area is required!' );
      }
      if ( this.builtInArea !== 0 && !this.builtInArea ) {
        throw new Error( 'Built-in area is required!' );
      }
      if ( this.balconies == null ) throw new Error( 'Balconies is required!' );
      if ( this.kitchen == null ) throw new Error( 'Kitchen is required!' );
      if ( this.bedrooms == null ) throw new Error( 'Bedrooms is required!' );
      if ( this.bathrooms == null ) throw new Error( 'Bathrooms is required!' );
      if ( this.maidrooms == null ) throw new Error( 'Maidrooms is required!' );
      if ( this.driverRooms == null ) throw new Error( 'Driver rooms is required!' );
      if (
        !this.furnishingStatus ||
        !this.furnishingStatusOptions.includes( this.furnishingStatus )
      ) {
        throw new Error( 'Select the furnishing status!' );
      }
      if ( !this.totalFloors ) throw new Error( 'Number of floors is required!' );
      if ( !this.numberOfParking ) {
        throw new Error( 'Number of parking is required!' );
      }

      // Construction & Age
      if ( !this.builtYear && this.builtYear !== 0 ) {
        throw new Error( 'Built year is required!' );
      }
      if (
        !this.propertyCondition ||
        !this.propertyConditionOptions.includes( this.propertyCondition )
      ) {
        throw new Error( 'Select the property condition!' );
      }
      if ( !this.developerName ) {
        throw new Error( 'Developer name is required!' );
      }
      if ( !this.ownerShipType ) {
        throw new Error( 'Ownership type is required!' );
      }
      if ( !this.ownerName ) {
        throw new Error( 'Owner is required!' );
      }

      // Financial Details
      if ( !this.price ) throw new Error( 'Price is required!' );
      if ( !this.countryActualCurrency ) throw new Error( 'Currency is required!' );
      if ( !this.pricePerSqurFeet ) {
        throw new Error( 'Price per square feet is required!' );
      }
      if ( !this.maintenanceFees ) {
        throw new Error( 'Maintenance fees is required!' );
      }
      if ( !this.serviceCharges ) {
        throw new Error( 'Service charges is required!' );
      }
      if (
        !this.availabilityStatus ||
        !this.propertyAvailabilityStatusOptions.includes(
          this.availabilityStatus,
        )
      ) {
        throw new Error( 'Property availability status is required!' );
      }

      // Features & Amenities
      if ( this.featureAmenities.length === 0 ) {
        throw new Error( 'Feature amenities are required!' );
      }

      // Media
      if ( this.selectedPropertyImages.length === 0 ) {
        throw new Error( 'Property images are required!' );
      }
      if ( this.propertyDocuments.length === 0 ) {
        throw new Error( 'Property documents are required!' );
      }

      // Listing Management
      if ( !this.listingDate ) {
        throw new Error( 'Property listing date is required!' );
      }
      if ( !this.AddedBy ) {
        throw new Error( 'Agent / AddedBy info is required!' );
      }

      // Admin & internal
      if (
        !this.verificationStatus ||
        !this.propertyVerificationStatusOptions.includes(
          this.verificationStatus,
        )
      ) {
        throw new Error(
          'Property verification status is required, select from the list!',
        );
      }
      if (
        !this.priority ||
        !this.propertyPriorityOptions.includes( this.priority )
      ) {
        throw new Error( 'Property priority is required, select from the list!' );
      }
      if ( !this.status || !this.propertyStatusOptions.includes( this.status ) ) {
        throw new Error( 'Property status is required, select from the list!' );
      }
      if ( !this.internalNote ) {
        throw new Error( 'Internal note is required!' );
      }

      // ── Build FormData ───────────────────────────────

      this.progress.start();

      // Basic
      formData.append( 'id', this.id.trim() );
      formData.append( 'title', this.title.trim() );
      formData.append( 'type', this.type.trim() );
      formData.append( 'listing', this.listing.trim() );
      formData.append( 'description', this.description.trim() );

      // Location
      formData.append(
        'countryDetails',
        JSON.stringify( this.country ?? null ).trim(),
      );
      formData.append( 'address', JSON.stringify( address ).trim() );
      formData.append( 'location', JSON.stringify( this.location ).trim() );

      // Specs
      formData.append( 'totalArea', this.totalArea.toString().trim() );
      formData.append( 'builtInArea', this.builtInArea.toString().trim() );
      formData.append( 'livingRooms', this.livingRooms.toString().trim() );
      formData.append( 'balconies', this.balconies.toString().trim() );
      formData.append( 'kitchen', this.kitchen.toString().trim() );
      formData.append( 'bedrooms', this.bedrooms.toString().trim() );
      formData.append( 'bathrooms', this.bathrooms.toString().trim() );
      formData.append( 'maidrooms', this.maidrooms.toString().trim() );
      formData.append( 'driverRooms', this.driverRooms.toString().trim() );
      formData.append( 'furnishingStatus', this.furnishingStatus.trim() );
      formData.append( 'totalFloors', this.totalFloors.toString().trim() );
      formData.append(
        'numberOfParking',
        this.numberOfParking.toString().trim(),
      );

      // Construction
      formData.append( 'builtYear', this.builtYear.toString().trim() );
      formData.append( 'propertyCondition', this.propertyCondition.trim() );
      formData.append( 'developerName', this.developerName.trim() );
      formData.append( 'projectName', ( this.projectName ?? '' ).trim() );
      formData.append( 'ownerShipType', this.ownerShipType.trim() );

      // Financial
      formData.append( 'price', this.price.toString().trim() );
      formData.append( 'currency', this.countryActualCurrency.trim() );
      formData.append(
        'pricePerSqurFeet',
        this.pricePerSqurFeet.toString().trim(),
      );
      formData.append(
        'expectedRentYearly',
        this.expectedRentYearly
          ? this.expectedRentYearly.toString().trim()
          : '',
      );
      formData.append(
        'expectedRentQuartely',
        this.expectedRentQuartely
          ? this.expectedRentQuartely.toString().trim()
          : '',
      );
      formData.append(
        'expectedRentMonthly',
        this.expectedRentMonthly
          ? this.expectedRentMonthly.toString().trim()
          : '',
      );
      formData.append(
        'expectedRentDaily',
        this.expectedRentDaily ? this.expectedRentDaily.toString().trim() : '',
      );
      formData.append(
        'maintenanceFees',
        this.maintenanceFees.toString().trim(),
      );
      formData.append(
        'serviceCharges',
        this.serviceCharges.toString().trim(),
      );
      formData.append(
        'transferFees',
        this.transferFees ? this.transferFees.toString().trim() : '',
      );
      formData.append(
        'availabilityStatus',
        this.availabilityStatus.toString().trim(),
      );

      // Features
      formData.append(
        'featuresAndAmenities',
        JSON.stringify( this.featureAmenities ).trim(),
      );

      // Media
      for ( const file of this.selectedPropertyImages ) {
        formData.append( 'images', file, file.name );
      }
      for ( const file of this.propertyDocuments ) {
        formData.append( 'documents', file, file.name );
      }
      formData.append( 'videoTour', ( this.videoTour ?? '' ).trim() );
      formData.append( 'virtualTour', ( this.virtualTour ?? '' ).trim() );

      // Listing
      formData.append( 'listingDate', this.listingDate.toISOString().trim() );
      formData.append(
        'availabilityDate',
        this.availabilityDate
          ? this.availabilityDate.toISOString().trim()
          : '',
      );
      formData.append(
        'listingExpiryDate',
        this.listingExpiryDate
          ? this.listingExpiryDate.toISOString().trim()
          : '',
      );
      formData.append( 'addedBy', JSON.stringify( this.AddedBy ).trim() );
      formData.append(
        'owner',
        this.selectedOwner?.username ? this.selectedOwner.username : '',
      );

      // Admin
      formData.append( 'referenceCode', ( this.referenceCode ?? '' ).trim() );
      formData.append(
        'verificationStatus',
        this.verificationStatus.toString().trim(),
      );
      formData.append( 'priority', this.priority.toString().trim() );
      formData.append( 'status', this.status.toString().trim() );
      formData.append( 'internalNote', this.internalNote.toString().trim() );

      // API call
      await this.propertyService
        .createProperties( formData, this.id )
        .then( ( res ) => {
          console.log( res );
          this.notification.notification( res.status, res.message );
        } )
        .catch( ( error ) => {
          console.error( 'Error: ', error?.error );
          this.notification.notification(
            error?.error?.status ?? 'error',
            error?.error?.message ?? 'Property creation failed!',
          );
          this.progress.error();
        } )
        .finally( () => {
          this.progress.complete();
          setTimeout( () => {
            this.router.navigate( [ '/dashboard/properties' ] );
          }, 2000 );
        } );
    } catch ( err ) {
      const message =
        err instanceof Error ? err.message : String( err ?? 'Unknown error' );
      this.notification.notification( 'error', message );
    }
  }
}
