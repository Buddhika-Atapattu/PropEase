// Path: src/app/pages/property/edit-property-listing/edit-property-listing.component.ts

import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
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
import * as table from '@angular/material/table';
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
} from '../../../components/dialogs/notificationBar/notificationBar.component';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import { MapComponent } from '../../../components/shared/map/map.component';
import { TextEditorComponent } from '../../../components/shared/textEditor/text-editor';
import { SafeUrlPipe } from '../../../pipes/safe-url.pipe';
import {
  APIsService,
  Country,
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
  propertyDocBackend,
  propertyDocPreview,
  propertyImages,
  BackEndPropertyData,
  CountryDetails,
  CountryDetailsCustomType,
} from '../../../services/property/property.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';

/**
 * Local interface for image preview data.
 */
interface PropertyImagePreview {
  URL: string;
  width: number;
  name: string;
  height: number;
}

@Component( {
  selector: 'app-edit-property-listing',
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

    // Angular Material
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
    table.MatTableModule,
    MatAutocompleteModule,

    // CDK
    DragDropModule,

    // Router
    RouterModule,

    // Pipes
    AsyncPipe,
  ],
  templateUrl: './edit-property-listing.component.html',
  styleUrl: './edit-property-listing.component.scss',
} )
export class EditPropertyListingComponent
  implements OnInit, OnDestroy, AfterViewInit {

  // ─────────────────────────────────────────────────────────────
  // View children
  // ─────────────────────────────────────────────────────────────
  @ViewChild( 'propertyImages' ) propertyImages!: ElementRef<HTMLInputElement>;
  @ViewChild( 'propertyDocs' ) propertyDocs!: ElementRef<HTMLInputElement>;
  @ViewChild( ProgressBarComponent ) progress!: ProgressBarComponent;
  @ViewChild( NotificationDialogComponent ) notification!: NotificationDialogComponent;
  @ViewChild( MapComponent ) map!: MapComponent;
  @ViewChildren( 'tabElement', { read: ElementRef } )
  tabElements!: QueryList<ElementRef>;

  // ─────────────────────────────────────────────────────────────
  // Global state / environment
  // ─────────────────────────────────────────────────────────────

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  protected loggedUser: User | null = null;
  protected loggedUsername: string = '';

  protected isFormError: boolean = false;
  protected isFormErrorText: string = '';

  protected istabOpenButtonActive: boolean = false;

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
  protected AddressCountries: Country[] = [];
  protected AddressFilteredCountries!: Observable<Country[]>;
  protected AddressCountryControl: FormControl = new FormControl( '' );

  protected countryMissMatch: boolean = false;
  private typeAddressCountry: string = '';

  // Location / Google Map
  protected mapLocationLat: GoogleMapLocation[ 'lat' ] = 0;
  protected mapLocationLng: GoogleMapLocation[ 'lng' ] = 0;
  protected GoogleMapLocationEmbeddedUrl: GoogleMapLocation[ 'embeddedUrl' ] = '';

  private location: Property[ 'location' ] | null = null;

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

  /**
   * 05.1. isPriceCurrencyPanelOpen -> open panel
   * 05.2. countryControlWithCurrency -> Angular FormControl
   * 05.3. filteredCountriesWithCurrency -> filtered country list
   * 05.4. selectedCountryWithCurrency -> selected country object
   * 05.5. allCountriesWithCurrency -> all country data from API
   * 05.6. isCurrencySelected -> check currency selection
   * 05.7. countryActualCurrency -> actual currency code (e.g. "LKR")
   * 05.8. isCountryOfCurrencySelected -> ensure country is selected
   * 05.9. countryOfCurrencySelectedError -> error flag for currency panel
   */
  protected isPriceCurrencyPanelOpen: boolean = false;
  protected countryControlWithCurrency: FormControl = new FormControl( '' );
  protected filteredCountriesWithCurrency!: Observable<CountryDetailsCustomType[]>;
  protected selectedCountryWithCurrency: CountryDetails | null = null;
  protected allCountriesWithCurrency: CountryDetailsCustomType[] = [];
  protected isCurrencySelected: boolean = false;
  private isCountryOfCurrencySelected: boolean = false;
  protected countryOfCurrencySelectedError: boolean = false;

  protected countryActualCurrency: string = '';
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
  protected featureAmenity: string = '';
  protected isAmenitiesNotIncluded: boolean = false;
  protected amenitiesNotIncludedText: string = '';

  // ─────────────────────────────────────────────────────────────
  // 07. Media
  // ─────────────────────────────────────────────────────────────

  // Images
  protected isPropertyImageDragOver: boolean = false;
  protected propertyImagePreview: PropertyImagePreview[] = [];
  private selcetedPropertyImages: File[] = [];
  protected isPropertyImageTypeMissMatched: boolean = false;
  protected propertyErrorText: string = 'Error';

  private allowedImageTypes: string[] = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
  ];

  protected uploadedImages: propertyImages[] = [];
  private removeImages: propertyImages[] = [];

  // Documents
  private propertyDocuments: File[] = [];
  protected isPropertyDocsDragOver: boolean = false;
  protected propertyDocsPreview: propertyDocPreview[] = [];
  protected uploadedDocuments: propertyDocBackend[] = [];
  protected uploadedDucumentsPreview: propertyDocPreview[] = [];
  protected isPropertyDocTypeMissMatched: boolean = false;
  private removeDocuments: propertyDocBackend[] = [];

  private readonly propertyFormallowedDocs: string[] = [
    // Word Documents
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
    'application/rtf',

    // Excel Documents
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    'text/csv',
    'text/tab-separated-values',

    // PowerPoint Documents
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.template',

    // OpenDocument Formats
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',

    // PDF
    'application/pdf',

    // Plain Text
    'text/plain',
  ];

  protected videoTour: Property[ 'videoTour' ] | null = null;
  protected virtualTour: Property[ 'virtualTour' ] | null = null;
  protected isIframeEmbed: boolean = false;

  protected videoPreviewURL: string = '';
  protected virtualPreviewURL: string = '';

  // ─────────────────────────────────────────────────────────────
  // 08. Listing Management
  // ─────────────────────────────────────────────────────────────

  protected listingDate: Property[ 'listingDate' ] = new Date();
  protected availabilityDate: Property[ 'availabilityDate' ] = new Date();
  protected listingExpiryDate: Property[ 'listingExpiryDate' ] = new Date();

  // Added by agent
  protected agentName: string = '';
  protected AddedByUsername: AddedBy[ 'username' ] = '';
  protected AddedByName: AddedBy[ 'name' ] = '';
  protected AddedByEmail: AddedBy[ 'email' ] = '';
  protected AddedByRole: AddedBy[ 'role' ] = '';
  protected AddedByContactNumber: AddedBy[ 'contactNumber' ] | null = null;
  protected AddedByAddedAt: AddedBy[ 'addedAt' ] = new Date();
  protected AddesByAddedAtOld: AddedBy[ 'addedAt' ] = new Date();
  private AddedBy: Property[ 'addedBy' ] | null = null;

  protected isAgentNotSelected: boolean = false;
  protected filterAgents: User[] = [];
  protected selectedAgent: User | null = null;

  // Owner information
  protected ownerUsername: string = '';
  protected allUsers: User[] = [];
  protected selectedOwner: User | null = null;
  protected ownerName: string = '';
  protected filterOwners: User[] = [];
  protected isOwnerNotSelected: boolean = false;

  protected rentedDate: Property[ 'rentedDate' ] | undefined = undefined;
  protected soldDate: Property[ 'soldDate' ] | null = null;

  // ─────────────────────────────────────────────────────────────
  // 09. Administrative & Internal Use
  // ─────────────────────────────────────────────────────────────

  protected referenceCode: Property[ 'referenceCode' ] = '';
  protected verificationStatus: Property[ 'verificationStatus' ] = 'Pending';
  protected priority: Property[ 'priority' ] = 'Medium';
  protected status: Property[ 'status' ] = 'Draft';
  protected internalNote: Property[ 'internalNote' ] = '';

  // ─────────────────────────────────────────────────────────────
  // Suggest / option lists
  // ─────────────────────────────────────────────────────────────

  // 01. Property listing
  protected listingOptions: string[] = [ 'Sale', 'Rent', 'Sold', 'Rented' ];
  protected filterListingOptions: string[] = [];

  // 02. Property type
  protected typeOptions: string[] = [
    'Apartment',
    'House',
    'Villa',
    'Commercial',
    'Land',
    '',
  ];
  protected filterTypeOptions: string[] = [];

  // 03. Property amenities
  protected definedFeatureAmenity: string[] = FEATURES_AMENITIES;
  protected filterFeatureAmenity: string[] = [];

  // 04. Furnishing Status
  protected furnishingStatusOptions: string[] = [
    'Unfurnished',
    'Semi-Furnished',
    'Furnished',
  ];
  protected filterFurnishingStatusOptions: string[] = [];

  // 05. Property Condition
  protected propertyConditionOptions: string[] = [
    'New',
    'Excellent',
    'Old',
    'Good',
    'Needs Renovation',
  ];
  protected filterPropertyConditionOptions: string[] = [];

  // 06. Property Availability Status
  protected propertyAvailabilityStatusOptions: string[] = [
    'Available',
    'Not Available',
    'Pending',
    'Ready to Move',
  ];
  protected filterPropertyAvailabilityStatusOptions: string[] = [];

  // 07. Property Priority Options
  protected propertyPriorityOptions: string[] = [ 'High', 'Medium', 'Low' ];
  protected filterPropertyPriorityOptions: string[] = [];

  // 08. Property Verification Status
  protected propertyVerificationStatusOptions: string[] = [
    'Pending',
    'Approved',
    'Rejected',
  ];
  protected filterPropertyVerificationStatusOptions: string[] = [];

  // 09. Status of property
  protected propertyStatusOptions: string[] = [
    'Archived',
    'Draft',
    'Published',
  ];
  protected filterPropertyStatusOptions: string[] = [];

  // 10. Ownership type
  protected ownerShipTypeOptions: string[] = [
    'Freehold',
    'Leasehold',
    'Company',
    'Trust',
  ];
  protected filterOwnerShipTypeOptions: string[] = [];

  // ─────────────────────────────────────────────────────────────
  // TinyMCE
  // ─────────────────────────────────────────────────────────────

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

  protected tabIndicatorsActive: boolean = false;
  protected currentIndex: number = 0;
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

    // Retrieve logged user
    this.loggedUser = this.authService.getLoggedUser;
    this.loggedUsername = this.loggedUser?.username ?? '';

    this.registerCustomIcons();

    // Read route params
    this.route.params.subscribe( ( params ) => {
      this.id = params[ 'propertyID' ];
    } );
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      await this.callTheAPI();

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
  }

  // ─────────────────────────────────────────────────────────────
  // Mobile Tab Button / Tabs
  // ─────────────────────────────────────────────────────────────

  protected tabOpenButtonOperation(): void {
    this.istabOpenButtonActive = !this.istabOpenButtonActive;
  }

  protected tabMaker( index: number, _tabName: string ): void {
    if ( !this.isBrowser ) return;
    this.currentIndex = index;
    setTimeout( () => this.updateIndicatorPosition( index ) );
  }

  private updateIndicatorPosition( index: number ): void {
    const tabEl = this.tabElements.get( index )?.nativeElement;

    if ( tabEl ) {
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

    if ( this.map && this.currentIndex === 1 ) {
      this.map.MapCenterMaker( this.mapLocationLat, this.mapLocationLng, 15 );
    }
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
  // API: Load property data
  // ─────────────────────────────────────────────────────────────

  private async callTheAPI(): Promise<void> {
    if ( !this.id ) return;

    try {
      const response = await this.propertyService.getPropertyById( this.id );

      if ( !response || response.status !== 'success' || !response.success || !response.data ) {
        throw new Error( 'Failed to fetch property data!' );
      }

      const data: BackEndPropertyData | undefined = response.data.system?.property;
      if ( !data ) {
        throw new Error( 'Invalid property data!' );
      }

      // Basic Property Details
      this.title = data.title ?? '';
      this.type = this.capitalize( data.type ?? '' );
      this.filterTypeOperation( this.type );

      this.listing = this.capitalize( data.listing ?? '' );
      this.filterListingOperation( this.listing );

      this.description = data.description ?? '';

      // Location Details
      this.country = data.countryDetails ?? null;

      const addr = data.address ?? {};
      this.AddressHouseNumber = addr.houseNumber ?? '';
      this.AddressStreet = addr.street ?? '';
      this.AddressCity = addr.city ?? '';
      this.AddressStateOrProvince = addr.stateOrProvince ?? '';
      this.AddressPostcode = addr.postcode ?? '';
      this.AddressCountry = addr.country ?? '';
      this.typeAddressCountry = typeof this.AddressCountry === 'string'
        ? this.AddressCountry
        : this.AddressCountry ?? '';

      if ( this.typeAddressCountry ) {
        await this.addressMainFilterCountries( this.typeAddressCountry );
      }

      this.location = data.location ?? null;
      if ( this.location ) {
        this.mapLocationLat = this.location.lat ?? 0;
        this.mapLocationLng = this.location.lng ?? 0;
        this.GoogleMapLocationEmbeddedUrl = this.location.embeddedUrl ?? '';
      } else {
        this.mapLocationLat = 0;
        this.mapLocationLng = 0;
        this.GoogleMapLocationEmbeddedUrl = '';
      }

      // Property Specifications
      this.totalArea = data.totalArea ?? 0;
      this.builtInArea = data.builtInArea ?? 0;
      this.livingRooms = data.livingRooms ?? 0;
      this.balconies = data.balconies ?? 0;
      this.kitchen = data.kitchen ?? 0;
      this.bedrooms = data.bedrooms ?? 0;
      this.bathrooms = data.bathrooms ?? 0;
      this.maidrooms = data.maidrooms ?? 0;
      this.driverRooms = data.driverRooms ?? 0;

      this.furnishingStatus = this.capitalize( data.furnishingStatus ?? '' );
      this.totalFloors = data.totalFloors ?? 0;
      this.numberOfParking = data.numberOfParking ?? 0;

      // Construction & Age
      this.builtYear = data.builtYear ?? 0;
      this.propertyCondition = this.capitalize( data.propertyCondition ?? '' );
      this.developerName = data.developerName ?? '';
      this.projectName = data.projectName ?? '';
      this.ownerShipType = this.capitalize( data.ownerShipType ?? '' );

      if ( data.owner ) {
        await this.filterOwnerThroughAllUsers( data.owner );
      }

      if ( Array.isArray( this.filterOwners ) && this.filterOwners.length === 1 ) {
        this.isOwnerNotSelected = false;
        this.selectedOwner = this.filterOwners[ 0 ];
        this.ownerUsername = this.selectedOwner.username;
        this.ownerName = this.selectedOwner.name;
      } else {
        this.isOwnerNotSelected = true;
        this.selectedOwner = null;
        this.ownerUsername = '';
        this.ownerName = '';
      }

      // Financial Details
      this.price = data.price ?? 0;

      const currencyCode = data.currency ?? '';
      this.countryActualCurrency = currencyCode ? currencyCode.toUpperCase() : '';

      const countryNameCommon = data.countryDetails?.name?.common ?? '';
      if ( countryNameCommon ) {
        await this.selectCountriesWithCurrencies( countryNameCommon );
        this.selectedCountryWithCurrency = data.countryDetails ?? null;
        this.isCurrencySelected = true;
      } else {
        this.selectedCountryWithCurrency = null;
        this.isCurrencySelected = false;
      }

      this.pricePerSqurFeet = data.pricePerSqurFeet ?? 0;
      this.expectedRentYearly = data.expectedRentYearly ?? 0;
      this.expectedRentQuartely = data.expectedRentQuartely ?? 0;
      this.expectedRentMonthly = data.expectedRentMonthly ?? 0;
      this.expectedRentDaily = data.expectedRentDaily ?? 0;

      this.maintenanceFees = data.maintenanceFees ?? 0;
      this.serviceCharges = data.serviceCharges ?? 0;
      this.transferFees = data.transferFees ?? 0;

      this.availabilityStatus = this.capitalize( data.availabilityStatus ?? '' );

      // Features & Amenities
      this.featureAmenities = data.featuresAndAmenities ?? [];

      // Media
      this.uploadedImages = data.images ?? [];
      this.uploadedDocuments = data.propertyDocs ?? [];
      this.uploadImageReorganizingOperation();

      this.videoTour = data.videoTour ?? null;
      this.propertyVideoUrl( this.videoTour ?? '' );

      this.virtualTour = data.virtualTour ?? null;
      this.updateVirtualTourUrl( this.virtualTour ?? '' );

      // Listing Management
      this.listingDate = this.toValidDate( data.listingDate ) ?? new Date();
      this.availabilityDate = this.toValidDate( data.availabilityDate ) ?? new Date();
      this.listingExpiryDate = this.toValidDate( data.listingExpiryDate ) ?? new Date();

      if ( data.addedBy ) {
        await this.filterAgentThroughAllUsers( data.addedBy.name );

        this.AddedBy = data.addedBy;
        this.AddedByUsername = data.addedBy.username;
        this.AddedByName = data.addedBy.name;
        this.AddedByEmail = data.addedBy.email;
        this.AddedByRole = data.addedBy.role;
        this.AddedByContactNumber = data.addedBy.contactNumber;

        const addedAtDate = this.toValidDate( data.addedBy.addedAt ) ?? new Date();
        this.AddedByAddedAt = addedAtDate;
        this.AddesByAddedAtOld = addedAtDate;
        this.agentName = data.addedBy.name;
      } else {
        this.AddedBy = null;
        this.AddedByUsername = '';
        this.AddedByName = '';
        this.AddedByEmail = '';
        this.AddedByRole = '';
        this.AddedByContactNumber = null;
        this.AddedByAddedAt = new Date();
        this.AddesByAddedAtOld = new Date();
        this.agentName = '';
      }

      this.rentedDate = this.toValidDate( data.rentedDate ) ?? undefined;
      this.soldDate = this.toValidDate( data.soldDate );

      // Admin / internal
      this.referenceCode = data.referenceCode ?? '';

      this.verificationStatus = this.capitalize(
        data.verificationStatus ?? '',
      ) as BackEndPropertyData[ 'verificationStatus' ];

      this.priority = this.capitalize(
        data.priority ?? '',
      ) as BackEndPropertyData[ 'priority' ];

      this.status = this.capitalize(
        data.status ?? '',
      ) as BackEndPropertyData[ 'status' ];

      this.internalNote = data.internalNote ?? '';

    } catch ( error: any ) {
      console.error( 'Error loading property details:', error );
      this.notification.notification(
        'error',
        error?.message || 'Failed to load property details!',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Utility helpers
  // ─────────────────────────────────────────────────────────────

  private capitalize( str: string ): string {
    return str ? str.charAt( 0 ).toUpperCase() + str.slice( 1 ) : '';
  }

  private toValidDate(
    value: string | Date | null | undefined,
  ): Date | null {
    if ( !value ) return null;
    if ( value instanceof Date ) return value;

    const d = new Date( value );
    return Number.isNaN( d.getTime() ) ? null : d;
  }

  // ─────────────────────────────────────────────────────────────
  // Sorting helpers for dropdowns
  // ─────────────────────────────────────────────────────────────

  protected propertyListingSort(): string[] {
    const src = this.filterListingOptions.length
      ? this.filterListingOptions
      : this.listingOptions;
    return src.sort( ( a, b ) => a.localeCompare( b ) );
  }

  protected propertyTypeSort(): string[] {
    const src = this.filterTypeOptions.length
      ? this.filterTypeOptions
      : this.typeOptions;
    return src.sort( ( a, b ) => a.localeCompare( b ) );
  }

  protected propertyAmenitiesSort(): string[] {
    const src = this.filterFeatureAmenity.length
      ? this.filterFeatureAmenity
      : this.definedFeatureAmenity;
    return src.sort( ( a, b ) => a.localeCompare( b ) );
  }

  protected propertyFurnishingStatusOptionsSort(): string[] {
    const src = this.filterFurnishingStatusOptions.length
      ? this.filterFurnishingStatusOptions
      : this.furnishingStatusOptions;
    return src.sort( ( a, b ) => a.localeCompare( b ) );
  }

  protected propertyConditionOptionsSort(): string[] {
    const src = this.filterPropertyConditionOptions.length
      ? this.filterPropertyConditionOptions
      : this.propertyConditionOptions;
    return src.sort( ( a, b ) => a.localeCompare( b ) );
  }

  protected propertyAvailabilityStatusOptionsSort(): string[] {
    const src = this.filterPropertyAvailabilityStatusOptions.length
      ? this.filterPropertyAvailabilityStatusOptions
      : this.propertyAvailabilityStatusOptions;
    return src.sort( ( a, b ) => a.localeCompare( b ) );
  }

  protected propertyPriorityOptionsSort(): string[] {
    const src = this.filterPropertyPriorityOptions.length
      ? this.filterPropertyPriorityOptions
      : this.propertyPriorityOptions;
    return src.sort( ( a, b ) => a.localeCompare( b ) );
  }

  protected propertyVerificationStatusOptionsSort(): string[] {
    const src = this.filterPropertyVerificationStatusOptions.length
      ? this.filterPropertyVerificationStatusOptions
      : this.propertyVerificationStatusOptions;
    return src.sort( ( a, b ) => a.localeCompare( b ) );
  }

  protected propertyStatusOptionsSort(): string[] {
    const src = this.filterPropertyStatusOptions.length
      ? this.filterPropertyStatusOptions
      : this.propertyStatusOptions;
    return src.sort( ( a, b ) => a.localeCompare( b ) );
  }

  protected ownerShipTypeOptionsSort(): string[] {
    const src = this.filterOwnerShipTypeOptions.length
      ? this.filterOwnerShipTypeOptions
      : this.ownerShipTypeOptions;
    return src.sort( ( a, b ) => a.localeCompare( b ) );
  }

  // ─────────────────────────────────────────────────────────────
  // Amenities & icons
  // ─────────────────────────────────────────────────────────────

  protected amenityIconMaker( amenity: string ): string {
    return this.propertyService.investigateTheAmenityIcon( amenity );
  }

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
        this.domSanitizer.bypassSecurityTrustResourceUrl(
          `Images/Icons/${ path }`,
        ),
      );
    }
  }

  protected chooceIcon( type: string ): string {
    switch ( type ) {
      case 'doc':
      case 'docx':
      case 'dot':
      case 'dotx':
      case 'rtf':
      case 'odt':
        return 'word';
      case 'txt':
        return 'txt';
      case 'xml':
        return 'xml';
      case 'xls':
      case 'xlsx':
      case 'xlsm':
      case 'xlt':
      case 'xltx':
      case 'ods':
      case 'csv':
      case 'tsv':
        return 'excel';
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
  // Global drag/drop prevent
  // ─────────────────────────────────────────────────────────────

  private preventDefault( event: Event ): void {
    event.preventDefault();
    event.stopPropagation();
  }

  // ─────────────────────────────────────────────────────────────
  // Navigation helpers
  // ─────────────────────────────────────────────────────────────

  protected goToProperties(): void {
    this.router.navigateByUrl( '/', { skipLocationChange: true } ).then( () => {
      this.router.navigate( [ '/dashboard/properties' ] );
    } );
  }

  protected goToListingEdit(): void {
    this.router.navigateByUrl( '/', { skipLocationChange: true } ).then( () => {
      this.router.navigate( [ '/dashboard/property-listing' ] );
    } );
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

    this.onFileSelectedPropertyImage( { target: input } as any );
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

  protected onFileSelectedPropertyImage( event: any ): void {
    const files: FileList = event.target.files;
    if ( files ) {
      this.propertyImagePreviewMaker( files );
    }
  }

  private propertyImagePreviewMaker( files: FileList ): void {
    for ( const file of Array.from( files ) ) {
      if ( !this.allowedImageTypes.includes( file.type ) ) {
        this.isPropertyImageTypeMissMatched = true;
        this.propertyErrorText = `Error: ${ file.name } type ${ file.type } not matched!`;
        return;
      }

      this.selcetedPropertyImages.push( file );

      const reader = new FileReader();
      reader.onload = ( e: any ) => {
        const img = new Image();
        img.onload = () => {
          const data: PropertyImagePreview = {
            URL: e.target.result,
            width: img.width,
            height: img.height,
            name: file.name,
          };
          this.propertyImagePreview.push( data );
        };
        img.src = e.target.result;
      };

      reader.readAsDataURL( file );
    }
  }

  protected removePropertyImage( index: number ): void {
    this.propertyImagePreview.splice( index, 1 );
    this.selcetedPropertyImages.splice( index, 1 );
  }

  protected removePropertyUploadedImage( index: number ): void {
    const removed = this.uploadedImages.splice( index, 1 )[ 0 ];
    if ( removed ) {
      this.removeImages.push( removed );
    }
  }

  protected uploadImageReorganizing( event: CdkDragDrop<any[]> ): void {
    moveItemInArray(
      this.uploadedImages,
      event.previousIndex,
      event.currentIndex,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Property Documents
  // ─────────────────────────────────────────────────────────────

  protected triggerPropertyDocs(): void {
    this.propertyDocs.nativeElement.click();
  }

  protected onPropertyDocsSelect( event: any ): void {
    this.propertyDocsPreviewMaker( event.target.files );
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
      this.propertyDocsPreviewMaker( files );
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
      this.propertyDocsPreviewMaker( input.files );
    }
  }

  private async propertyDocsPreviewMaker( files: FileList ): Promise<void> {
    for ( const file of Array.from( files ) ) {
      if ( !this.propertyFormallowedDocs.includes( file.type ) ) {
        this.isPropertyDocTypeMissMatched = true;
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

  protected removeDocsFromUploaded( index: number ): void {
    this.uploadedDucumentsPreview.splice( index, 1 );
    const removed = this.uploadedDocuments.splice( index, 1 )[ 0 ];
    if ( removed ) {
      this.removeDocuments.push( removed );
    }
  }

  private uploadImageReorganizingOperation(): void {
    this.uploadedDocuments.forEach( ( item ) => {
      const type = item.originalname.split( '.' ).pop() as string;
      const dataArray: propertyDocPreview = {
        name: item.originalname,
        type,
        icon: this.chooceIcon( type ),
      };
      this.uploadedDucumentsPreview.push( dataArray );
    } );
  }

  // ─────────────────────────────────────────────────────────────
  // Filters (types / listing / amenities)
  // ─────────────────────────────────────────────────────────────

  protected filterTypeOperation( data: string ): void {
    this.filterTypeOptions = this.typeOptions.filter( ( option ) =>
      option.toLowerCase().includes( data.toLowerCase() ),
    );
  }

  protected filterListingOperation( data: string ): void {
    this.filterListingOptions = this.listingOptions.filter( ( option ) =>
      option.toLowerCase().includes( data.toLowerCase() ),
    );
  }

  protected filterFeatureAmenityOperation( data: string ): void {
    if ( !this.definedFeatureAmenity.includes( data ) ) {
      this.isAmenitiesNotIncluded = true;
      this.amenitiesNotIncludedText = data;
    }

    this.filterFeatureAmenity = this.definedFeatureAmenity.filter( ( option ) =>
      option.toLowerCase().includes( data.toLowerCase() ),
    );
  }

  protected addNewAminity(): void {
    this.isAmenitiesNotIncluded = false;
    if ( this.amenitiesNotIncludedText.trim() ) {
      this.featureAmenities.push( this.amenitiesNotIncludedText.trim() );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Address country autocomplete
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

    const countries = await this.apiService.getCountries();

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

  protected addressDisplayFlag( country: Country ): string {
    return typeof country === 'string' ? country : country?.name ?? '';
  }

  // ─────────────────────────────────────────────────────────────
  // Currency Controller
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
        map( ( value: string | CountryDetails ) => {
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
      console.error( 'Country did not find!' );
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
    country: CountryDetails | string,
  ): string {
    return typeof country === 'string' ? country : country?.name?.common ?? '';
  }

  // ─────────────────────────────────────────────────────────────
  // Agent Info
  // ─────────────────────────────────────────────────────────────

  protected async filterAgentThroughAllUsers( input: string ): Promise<void> {
    try {
      this.isAgentNotSelected = true;

      const res = await this.apiService.getAllUsers();

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to fetch users!' );
      }

      const users = res.data?.system?.users;
      if ( !Array.isArray( users ) || users.length === 0 ) {
        throw new Error( 'Invalid array of users!' );
      }

      this.allUsers = users;
      this.filterAgents = users.filter( ( user ) =>
        user.name.toLowerCase().includes( input.toLowerCase() ),
      );

      if ( this.filterAgents.length === 1 ) {
        const agent = this.filterAgents[ 0 ];
        this.AddedByName = agent.name;
        this.AddedByEmail = agent.email;
        this.AddedByUsername = agent.username;
        this.AddedByRole = agent.role;
        this.AddedByContactNumber = agent.phoneNumber;
        this.AddedByAddedAt = new Date();
        this.isAgentNotSelected = false;
        this.AddedBy = {
          name: this.AddedByName,
          email: this.AddedByEmail,
          username: this.AddedByUsername,
          role: this.AddedByRole,
          contactNumber: this.AddedByContactNumber,
          addedAt: this.AddedByAddedAt,
        };
      }
    }
    catch ( error ) {
      console.error( error );
    }
  }

  protected getTheSelectedAgent( input: MatAutocompleteSelectedEvent ): void {
    const selectedAgent = input.option.value as string;

    if ( selectedAgent ) {
      this.isAgentNotSelected = false;
      this.selectedAgent =
        this.allUsers.find( ( data ) => {
          const findingUserName = data.name.toLowerCase();
          const typingUserName = selectedAgent.toLowerCase();
          return findingUserName === typingUserName;
        } ) || null;
    } else {
      this.isAgentNotSelected = true;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Owner Info
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
      this.filterOwners = users.filter(
        ( user ) =>
          user.name.toLowerCase().includes( input.toLowerCase() ) ||
          user.username.toLowerCase().includes( input.toLowerCase() ),
      );

      if ( this.filterOwners.length === 1 ) {
        this.isOwnerNotSelected = false;
        this.selectedOwner = this.filterOwners[ 0 ];
        this.ownerUsername = this.selectedOwner.username;
      }
    }
    catch ( error ) {
      console.error( error );
    }

  }

  protected getTheSelectedOwner( input: MatAutocompleteSelectedEvent ): void {
    const selectedOwner = input.option.value as string;

    if ( selectedOwner ) {
      this.isOwnerNotSelected = false;
      this.selectedOwner =
        this.allUsers.find( ( data ) => {
          const findingUserName = data.name.toLowerCase();
          const typingUserName = selectedOwner.toLowerCase();
          return findingUserName === typingUserName;
        } ) || null;
    } else {
      this.isOwnerNotSelected = true;
    }

    if ( this.selectedOwner ) {
      this.ownerUsername = this.selectedOwner.username;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Features / amenities (chips)
  // ─────────────────────────────────────────────────────────────

  protected addFeaturesAmenity( event: MatAutocompleteSelectedEvent ): void {
    const value = event.option.value;
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
      this.featureAmenity = '';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Map / location picking
  // ─────────────────────────────────────────────────────────────

  protected onLocationPicked( event: { lat: number; lng: number; } ): void {
    this.mapLocationLat = event.lat;
    this.mapLocationLng = event.lng;
    this.GoogleMapLocationEmbeddedUrl =
      `https://www.google.com/maps?q=${ this.mapLocationLat },${ this.mapLocationLng }&hl=en&z=14&output=embed`;

    this.location = {
      lat: this.mapLocationLat,
      lng: this.mapLocationLng,
      embeddedUrl: this.GoogleMapLocationEmbeddedUrl,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Video / Virtual Tour
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
  // Form Submit
  // ─────────────────────────────────────────────────────────────

  protected async submit(): Promise<void> {
    try {
      if ( this.loggedUser === null ) {
        throw new Error( 'User need to login to the system before property update' );
      }

      // Build Address object
      const AddressValue: Address = {
        houseNumber: this.AddressHouseNumber.trim(),
        street: ( this.AddressStreet ?? '' ).trim(),
        city: this.AddressCity.trim(),
        stateOrProvince: ( this.AddressStateOrProvince ?? '' ).trim(),
        postcode: this.AddressPostcode.trim(),
        country: this.typeAddressCountry.trim(),
      };

      const formData = new FormData();


      // Basic Property Details validation
      if ( !this.title ) throw new Error( 'Title is required!' );
      if ( !this.type ) throw new Error( 'Type is required!' );
      if ( !this.listing ) throw new Error( 'Listing is required!' );
      if ( !this.description ) throw new Error( 'Discription is required!' );

      // Location Details validation
      if ( !this.AddressHouseNumber ) throw new Error( 'House number is required!' );
      if ( !this.AddressStreet ) throw new Error( 'Address streat is required!' );
      if ( !this.AddressCity ) throw new Error( 'Address city is required!' );
      if ( !this.AddressStateOrProvince ) {
        throw new Error( 'Address state or province is required!' );
      }
      if ( !this.AddressPostcode ) throw new Error( 'Address postcode is required!' );
      if ( !this.typeAddressCountry ) throw new Error( 'Country is required!' );

      // Property Specifications validation
      if ( this.totalArea <= 0 ) {
        throw new Error( 'Total area is required and must be greater than 0!' );
      }
      if ( this.builtInArea <= 0 ) {
        throw new Error( 'Built in area is required and must be greater than 0!' );
      }
      if ( this.balconies == null ) throw new Error( 'Balconies is required!' );
      if ( this.kitchen == null ) throw new Error( 'Kitchen is required!' );
      if ( this.bedrooms == null ) throw new Error( 'Bedrooms is required!' );
      if ( this.bathrooms == null ) throw new Error( 'Bathrooms is required!' );
      if ( this.maidrooms == null ) throw new Error( 'Maidrooms is required!' );
      if ( this.driverRooms == null ) throw new Error( 'Driver rooms is required!' );

      if ( !this.furnishingStatus ||
        !this.furnishingStatusOptions.includes( this.furnishingStatus ) ) {
        throw new Error( 'Select the furnishing status!' );
      }

      if ( !this.totalFloors ) {
        throw new Error( 'Number of floors is required!' );
      }
      if ( !this.numberOfParking ) {
        throw new Error( 'Number of parking is required!' );
      }

      // Construction & Age validation
      if ( this.builtYear == null ) {
        throw new Error( 'Built year is required!' );
      }

      if ( !this.propertyCondition ||
        !this.propertyConditionOptions.includes( this.propertyCondition ) ) {
        throw new Error( 'Select the property condition!' );
      }

      if ( !this.developerName ) {
        throw new Error( 'Developer name is required!' );
      }

      if ( !this.ownerShipType ||
        !this.ownerShipTypeOptions.includes( this.ownerShipType ) ) {
        throw new Error( 'Owner ship type is required!' );
      }

      if ( !this.selectedOwner ) {
        throw new Error( 'Owner is required!' );
      }

      // Financial Details validation
      if ( !this.price ) throw new Error( 'Price is required!' );
      if ( !this.countryActualCurrency ) throw new Error( 'Currency is required!' );
      if ( !this.pricePerSqurFeet ) {
        throw new Error( 'Price per squr feet is required!' );
      }
      if ( !this.maintenanceFees ) {
        throw new Error( 'Maintenance fees is required!' );
      }
      if ( !this.serviceCharges ) {
        throw new Error( 'Service charges is required!' );
      }

      if ( !this.availabilityStatus ||
        !this.propertyAvailabilityStatusOptions.includes( this.availabilityStatus ) ) {
        throw new Error( 'Property availability status is required!' );
      }

      // Features & Amenities validation
      if ( !this.featureAmenities || this.featureAmenities.length === 0 ) {
        throw new Error( 'Feature amenities is required!' );
      }

      // Listing Management validation
      if ( !this.listingDate ) {
        throw new Error( 'Property listing date is required!' );
      }
      if ( !this.AddedBy ) {
        throw new Error( 'Select the agent of the property!' );
      }

      // Admin & Internal validation
      if ( !this.verificationStatus ||
        !this.propertyVerificationStatusOptions.includes( this.verificationStatus ) ) {
        throw new Error(
          'Property verification status is required, select from the list!',
        );
      }

      if ( !this.priority ||
        !this.propertyPriorityOptions.includes( this.priority ) ) {
        throw new Error( 'Property priority is required, select from the list!' );
      }

      if ( !this.status ||
        !this.propertyStatusOptions.includes( this.status ) ) {
        throw new Error( 'Property status is required, select from the list!' );
      }

      if ( !this.internalNote ) {
        throw new Error( 'Internal note is required!' );
      }

      // ─────────────────────────────────────────────────────────
      // Populate FormData
      // ─────────────────────────────────────────────────────────

      this.progress.start();

      // Basic Property Details
      formData.append( 'id', this.id.trim() );
      formData.append( 'title', this.title.trim() );
      formData.append( 'type', this.type.trim() );
      formData.append( 'listing', this.listing.trim() );
      formData.append( 'description', this.description.trim() );

      // Location Details
      formData.append( 'countryDetails', JSON.stringify( this.country ).trim() );
      formData.append( 'address', JSON.stringify( AddressValue ).trim() );
      formData.append( 'location', JSON.stringify( this.location ).trim() );

      // Property Specifications
      formData.append( 'totalArea', this.totalArea.toString().trim() );
      formData.append( 'builtInArea', this.builtInArea.toString().trim() );
      formData.append( 'livingRooms', this.livingRooms.toString().trim() );
      formData.append( 'balconies', this.balconies.toString().trim() );
      formData.append( 'kitchen', this.kitchen.toString().trim() );
      formData.append( 'bedrooms', this.bedrooms.toString().trim() );
      formData.append( 'bathrooms', this.bathrooms.toString().trim() );
      formData.append( 'maidrooms', this.maidrooms.toString().trim() );
      formData.append( 'driverRooms', this.driverRooms.toString().trim() );
      formData.append( 'furnishingStatus', this.furnishingStatus.toString().trim() );
      formData.append( 'totalFloors', this.totalFloors.toString().trim() );
      formData.append( 'numberOfParking', this.numberOfParking.toString().trim() );

      // Construction & Age
      formData.append( 'builtYear', this.builtYear.toString().trim() );
      formData.append( 'propertyCondition', this.propertyCondition.toString().trim() );
      formData.append( 'developerName', this.developerName.toString().trim() );
      formData.append(
        'projectName',
        this.projectName ? this.projectName.toString().trim() : '',
      );
      formData.append( 'ownerShipType', this.ownerShipType.toString().trim() );

      // Financial Details
      formData.append( 'price', this.price.toString().trim() );
      formData.append( 'currency', this.countryActualCurrency.toString().trim() );
      formData.append( 'pricePerSqurFeet', this.pricePerSqurFeet.toString().trim() );
      formData.append(
        'expectedRentYearly',
        this.expectedRentYearly ? this.expectedRentYearly.toString().trim() : '',
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
      formData.append( 'maintenanceFees', this.maintenanceFees.toString().trim() );
      formData.append( 'serviceCharges', this.serviceCharges.toString().trim() );
      formData.append(
        'transferFees',
        this.transferFees ? this.transferFees.toString().trim() : '',
      );
      formData.append( 'availabilityStatus', this.availabilityStatus.toString().trim() );

      // Features & Amenities
      formData.append(
        'featuresAndAmenities',
        JSON.stringify( this.featureAmenities ).trim(),
      );

      // Media - new uploads
      for ( const file of this.selcetedPropertyImages ) {
        formData.append( 'images', file, file.name );
      }
      for ( const file of this.propertyDocuments ) {
        formData.append( 'documents', file, file.name );
      }

      // Media - existing
      formData.append( 'existingImages', JSON.stringify( this.uploadedImages ).trim() );
      formData.append(
        'existingDocuments',
        JSON.stringify( this.uploadedDocuments ).trim(),
      );

      // Media - removed
      formData.append( 'removeImages', JSON.stringify( this.removeImages ).trim() );
      formData.append(
        'removeDocuments',
        JSON.stringify( this.removeDocuments ).trim(),
      );

      formData.append(
        'videoTour',
        this.videoTour ? this.videoTour.toString().trim() : '',
      );
      formData.append(
        'virtualTour',
        this.virtualTour ? this.virtualTour.toString().trim() : '',
      );

      // Listing Management
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

      // Administrative & Internal Use
      formData.append( 'referenceCode', this.referenceCode.toString().trim() );
      formData.append(
        'verificationStatus',
        this.verificationStatus.toString().trim(),
      );
      formData.append( 'priority', this.priority.toString().trim() );
      formData.append( 'status', this.status.toString().trim() );
      formData.append( 'internalNote', this.internalNote.toString().trim() );
      formData.append(
        'rentedDate',
        this.rentedDate ? this.rentedDate.toISOString().trim() : '',
      );
      formData.append(
        'soldDate',
        this.soldDate ? this.soldDate.toISOString().trim() : '',
      );
      formData.append( 'updator', this.loggedUser?.username ?? '' );

      // ─────────────────────────────────────────────────────────
      // API Call
      // ─────────────────────────────────────────────────────────

      try {
        const res = await this.propertyService.updateProperty( formData, this.id );
        this.notification.notification( res.status, res.message );
      } catch ( err: any ) {
        const status = err?.error?.status ?? 'error';
        const msg =
          err?.error?.message ??
          err?.message ??
          'Failed to update property!';
        this.notification.notification( status, msg );
        this.progress.error();
      } finally {
        this.progress.complete();
        setTimeout( () => {
          this.router.navigate( [ '/dashboard/properties' ] );
        }, 2000 );
      }
    } catch ( error: any ) {
      this.progress.error();
      const message = error?.message ?? 'Unknown error while updating property.';
      this.notification.notification( 'error', message );
    }
  }
}
