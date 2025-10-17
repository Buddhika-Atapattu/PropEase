import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
  HostListener,
  AfterViewInit,
  QueryList,
  ViewChildren,
} from '@angular/core';
import {
  CommonModule,
  PlatformLocation,
  isPlatformBrowser,
} from '@angular/common';
import {
  FormBuilder,
  Validators,
  FormsModule,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatRadioModule } from '@angular/material/radio';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { Subscription, of, pipe } from 'rxjs';
import { Observable } from 'rxjs';
import { EditorComponent } from '@tinymce/tinymce-angular';
import { AuthService, BaseUser } from '../../../services/auth/auth.service';
import {
  PropertyService,
  Property,
  FEATURES_AMENITIES,
  GoogleMapLocation,
  AddedBy,
  Address,
  propertyDocPreview,
  MSG,
} from '../../../services/property/property.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import {
  msgTypes,
  NotificationDialogComponent,
} from '../../../components/dialogs/notification/notification.component';
import { DomSanitizer } from '@angular/platform-browser';
import { map, startWith } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import {
  APIsService,
  Country,
  CountryDetails,
  CountryDetailsCustomType,
  UsersType,
} from '../../../services/APIs/apis.service';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MapComponent } from '../../../components/shared/map/map.component';
import { SafeUrlPipe } from '../../../pipes/safe-url.pipe';
import { getCountries } from '@yusifaliyevpro/countries';

interface propertyImagePreview {
  URL: string;
  width: number;
  name: string;
  height: number;
}

@Component({
  selector: 'app-property-listing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ProgressBarComponent,
    NotificationDialogComponent,
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
    EditorComponent,
    RouterModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    AsyncPipe,
    MapComponent,
    SafeUrlPipe,
  ],
  templateUrl: './property-listing.component.html',
  styleUrl: './property-listing.component.scss',
})
export class PropertyListingComponent
  implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('propertyImages') propertyImages!: ElementRef<HTMLInputElement>;
  @ViewChild('propertyDocs') propertyDocs!: ElementRef<HTMLInputElement>;
  @ViewChild(ProgressBarComponent) progress!: ProgressBarComponent;
  @ViewChild(NotificationDialogComponent) notification!: NotificationDialogComponent;
  @ViewChild(MapComponent) map!: MapComponent;

  protected isFormError: boolean = false;
  protected isFormErrorText: string = '';

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected loggedUser: BaseUser | null = null;
  protected loggedUsername: string = '';

  protected istabOpenButtonActive: boolean = false;

  //01. <================== Basic Property Details ==================>
  protected id: Property['id'] = '';
  protected title: Property['title'] = '';
  protected type: Property['type'] = '';
  protected listing: Property['listing'] = '';
  protected description: Property['description'] = '';
  //<================== End Basic Property Details ==================>

  //02. <================== Location Details ==================>

  // ******* Counrty Details *******
  protected country: Property['countryDetails'] | null = null;
  // ******* Address *******
  protected AddressHouseNumber: Address['houseNumber'] = '';
  protected AddressStreet: Address['street'] = '';
  protected AddressCity: Address['city'] = '';
  protected AddressStateOrProvince: Address['stateOrProvince'] = '';
  protected AddressPostcode: Address['postcode'] = '';
  //This one gets the detailed country object

  //Country detection of Address
  protected AddressCountry: Country | string = '';
  protected AddressFilteredCountries!: Observable<Country[]>;
  protected AddressCountries: Country[] = [];
  protected AddressCountryControl: FormControl = new FormControl('');
  protected countryMissMatch: boolean = false;
  private typeAddressCountry: string = '';

  // ******* Location *******
  protected mapLocationLat: GoogleMapLocation['lat'] = 0;
  protected mapLocationLng: GoogleMapLocation['lng'] = 0;
  protected GoogleMapLocationEmbeddedUrl: GoogleMapLocation['embeddedUrl'] = '';

  private location: Property['location'] = {
    lat: this.mapLocationLat,
    lng: this.mapLocationLng,
    embeddedUrl: this.GoogleMapLocationEmbeddedUrl,
  };

  //<================== End Location Details ==================>

  //03. <================== Property Specifications ==================>
  protected totalArea: Property['totalArea'] = 0;
  protected builtInArea: Property['builtInArea'] = 0;
  protected livingRooms: Property['livingRooms'] = 0;
  protected balconies: Property['balconies'] = 0;
  protected kitchen: Property['kitchen'] = 0;
  protected bedrooms: Property['bedrooms'] = 0;
  protected bathrooms: Property['bathrooms'] = 0;
  protected maidrooms: Property['maidrooms'] = 0;
  protected driverRooms: Property['driverRooms'] = 0;
  protected furnishingStatus: Property['furnishingStatus'] = 'Unfurnished';
  protected totalFloors: Property['totalFloors'] = 0;
  protected numberOfParking: Property['numberOfParking'] = 0;
  //<================== End Property Specifications ==================>

  //04. <================== Construction & Age ==================>
  protected builtYear: Property['builtYear'] = 0;
  protected propertyCondition: Property['propertyCondition'] = 'New';
  protected developerName: Property['developerName'] = '';
  protected projectName: Property['projectName'] = '';
  protected ownerShipType: Property['ownerShipType'] = 'Freehold';
  //<================== End Construction & Age ==================>

  //05. <================== Financial Details ==================>
  protected price: Property['price'] = 0;
  /*

  05.1. isPriceCurrencyPanelOpen -> open pannel
  05.2. countryControlWithCurrency -> declaring and initializing an Angular FormControl
  05.3. filteredCountriesWithCurrency -> store the values that filter through all country
  05.4. selectedCountryWithCurrency -> selected country pbject
  05.5. allCountriesWithCurrency -> all counrty from the api
  05.6. isCurrencySelected -> check whether the currency is selected before closing the pannel
  05.7. countryActualCurrency -> get the actual country by text "Sri Lanka"
  05.8. isCountryOfCurrencySelected -> check the country is selected before closing the pannel
  05.9. countryOfCurrencySelectedError -> detect the error before clossing the pannel

  */
  protected isPriceCurrencyPanelOpen: boolean = false;
  protected countryControlWithCurrency: FormControl = new FormControl('');
  protected filteredCountriesWithCurrency!: Observable<
    CountryDetailsCustomType[]
  >;
  protected allCountriesWithCurrency: CountryDetailsCustomType[] = [];
  protected selectedCountryWithCurrency: CountryDetails | null = null; // this will store the selected currency
  protected isCurrencySelected: boolean = false;
  private isCountryOfCurrencySelected: boolean = false;
  protected countryOfCurrencySelectedError: boolean = false;

  protected countryActualCurrency: string = '';
  protected pricePerSqurFeet: Property['pricePerSqurFeet'] = 0;
  protected expectedRentYearly: Property['expectedRentYearly'] = 0;
  protected expectedRentQuartely: Property['expectedRentQuartely'] = 0;
  protected expectedRentMonthly: Property['expectedRentMonthly'] = 0;
  protected expectedRentDaily: Property['expectedRentDaily'] = 0;
  protected maintenanceFees: Property['maintenanceFees'] = 0;
  protected serviceCharges: Property['serviceCharges'] = 0;
  protected transferFees: Property['transferFees'] = 0;
  protected availabilityStatus: Property['availabilityStatus'] = '';
  //<================== End Financial Details ==================>

  //06. <================== Features & Amenities ==================>
  protected featureAmenities: Property['featuresAndAmenities'] = [];
  protected featureAmenity: string = '';
  protected isAmenitiesNotIncluded: boolean = false;
  protected amenitiesNotIncludedText: string = '';
  //<================== End Features & Amenities ==================>

  //07. <================== Media ==================>
  //Image
  protected isPropertyImageDragOver: boolean = false;
  protected propertyImagePreview: propertyImagePreview[] = [];
  private selcetedPropertyImages: File[] = [];
  protected isPropertyImageTypeMissMatched: boolean = false;
  protected propertyErrorText: string = 'Error';
  private allowedImageTypes: string[] = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
  ];

  // Documents
  private propertyDocuments: File[] = [];
  protected isPropertyDocsDragOver: boolean = false;
  protected propertyDocsPreview: propertyDocPreview[] = [];

  private readonly propertyFormallowedDocs = [
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

  protected videoTour: Property['videoTour'] = '';
  protected virtualTour: Property['virtualTour'] = '';
  protected isIframeEmbed: boolean = false;

  protected videoPreviewURL: string = '';

  protected virtualPreviewURL: string = '';
  //<================== End Media ==================>

  //.08 <================== Listing Management ==================>
  protected listingDate: Property['listingDate'] = new Date();
  protected availabilityDate: Property['availabilityDate'] = new Date();
  protected listingExpiryDate: Property['listingExpiryDate'] = new Date();

  // Added by agent
  protected AddedByUsername: AddedBy['username'] = '';
  protected AddedByName: AddedBy['name'] = '';
  protected AddedByEmail: AddedBy['email'] = '';
  protected AddedByRole: AddedBy['role'] = '';
  protected AddedByContactNumber: AddedBy['contactNumber'] = '';
  protected AddedByAddedAt: AddedBy['addedAt'] = new Date();
  private AddedBy: Property['addedBy'] = {
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

  //Owner information
  protected ownerUsername: string = '';
  protected allUsers: UsersType[] = [];
  protected selectedOwner: UsersType | null = null;
  protected ownerName: string = '';
  protected filterOwner: UsersType[] = [];
  protected isOwnerNotSelected: boolean = false;

  //<================== End Listing Management ==================>

  //09. <================== Administrative & Internal Use ==================>
  protected referenceCode: Property['referenceCode'] = '';
  protected verificationStatus: Property['verificationStatus'] = 'Pending';
  protected priority: Property['priority'] = 'Medium';
  protected status: Property['status'] = 'Draft';
  protected internalNote: Property['internalNote'] = '';

  //<================== End Administrative & Internal Use ==================>

  //Predefined variables for suggests

  //01. Property listing
  protected statusOptions: string[] = ['Sale', 'Rent', 'Sold', 'Rented'];
  protected filterStatusOptions: string[] = [];

  //02. Property type
  protected typeOptions: string[] = [
    'Apartment',
    'House',
    'Villa',
    'Commercial',
    'Land',
    'Stodio',
  ];
  protected filterTypeOptions: string[] = [];

  //03. Property amenities
  protected definedFeatureAmenity: string[] = FEATURES_AMENITIES;
  protected filterFeatureAmenity: string[] = [];

  //04. Furnishing Status
  protected furnishingStatusOptions: string[] = [
    'Unfurnished',
    'Semi-Furnished',
    'Furnished',
  ];
  protected filterFurnishingStatusOptions: string[] = [];

  //05. Property Condition
  protected propertyConditionOptions: string[] = [
    'New',
    'Excellent',
    'Old',
    'Good',
    'Needs Renovation',
  ];
  protected filterPropertyConditionOptions: string[] = [];

  //06. Property Availability Status
  protected propertyAvailabilityStatusOptions: string[] = [
    'Available',
    'Not Available',
    'Pending',
    'Ready to Move',
  ];
  protected filterPropertyAvailabilityStatusOptions: string[] = [];

  //07. Property Priority Options
  protected propertyPriorityOptions: string[] = ['High', 'Medium', 'Low'];
  protected filterPropertyPriorityOptions: string[] = [];

  //08. Property Verification Status
  protected propertyVerificationStatusOptions: string[] = [
    'Pending',
    'Approved',
    'Rejected',
  ];
  protected filterPropertyVerificationStatusOptions: string[] = [];

  //09. Status of property
  protected propertyStatusOptions: string[] = [
    'Archived',
    'Draft',
    'Published',
  ];
  protected filterPropertyStatusOptions: string[] = [];

  //10. Ownership type
  protected ownerShipTypeOptions: string[] = [
    'Freehold',
    'Leasehold',
    'Company',
    'Trust',
  ];
  protected filterOwnerShipTypeOptions: string[] = [];

  //Text editor
  init: EditorComponent['init'] = {
    plugins: 'lists link image table code help wordcount',
  };

  // Tab Indicator list
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
  @ViewChildren('tabElement', { read: ElementRef })
  tabElements!: QueryList<ElementRef>;
  protected currentIndex = 0;
  protected indicatorStyle: { width?: string; transform?: string } = {};

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private authService: AuthService,
    private propertyService: PropertyService,
    private APIs: APIsService,
    private crypto: CryptoService,
    private router: Router
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });

    //Assign the values to logged user
    this.loggedUser = this.authService.getLoggedUser;
    this.loggedUsername = this.loggedUser?.username as string;
    this.AddedByUsername = this.loggedUser?.username as string;
    this.AddedByName = this.loggedUser?.name as string;
    this.AddedByEmail = this.loggedUser?.email as string;
    this.AddedByRole = this.loggedUser?.role as string;
    this.AddedByContactNumber = this.loggedUser?.phoneNumber as string;
    this.AddedByAddedAt = new Date();

    this.registerCustomIcons();
    this.id = this.propertyService.generatePropertyId();
    // this.propertyService.amenityIconMaker();
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });

      window.addEventListener('dragover', this.preventDefault, {
        passive: false,
      });

      window.addEventListener('drop', this.preventDefault, {
        passive: false,
      });
    }
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      setTimeout(() => this.updateIndicatorPosition(this.currentIndex));
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      window.removeEventListener('dragover', this.preventDefault);
      window.removeEventListener('drop', this.preventDefault);
    }

    this.modeSub?.unsubscribe();
  }

  //<==================== VALIDATION OF LOGGED USER ACTIVITIES ====================>
  protected isUserCanAssignAgentToTheProperty(): boolean {
    return (
      this.loggedUser?.access.permissions.some(
        (permission) =>
          permission.module === 'Property Management' &&
          permission.actions.includes('assign agent')
      ) ?? false
    );
  }

  protected isUserCanUploadDocumentsToTheProperty(): boolean {
    return (
      this.loggedUser?.access.permissions.some(
        (permission) =>
          permission.module === 'Property Management' &&
          permission.actions.includes('upload documents')
      ) ?? false
    );
  }

  protected isUserCanManageAmenitiesToTheProperty(): boolean {
    return (
      this.loggedUser?.access.permissions.some(
        (permission) =>
          permission.module === 'Property Management' &&
          permission.actions.includes('manage amenities')
      ) ?? false
    );
  }

  protected isUserCanChangeListingStatusOfTheProperty(): boolean {
    return (
      this.loggedUser?.access.permissions.some(
        (permission) =>
          permission.module === 'Property Management' &&
          permission.actions.includes('change status')
      ) ?? false
    );
  }

  //<==================== END VALIDATION OF LOGGED USER ACTIVITIES ====================>

  //<==================== Mobile Tab Open Button ====================>
  protected tabOpenButtonOperation() {
    this.istabOpenButtonActive = !this.istabOpenButtonActive;
  }
  //<==================== End Mobile Tab Open Button ====================>

  //<==================== Tab Make ====================>
  protected tabMaker(index: number, tabName: string) {
    if (!this.isBrowser) return;
    this.currentIndex = index;
    setTimeout(() => this.updateIndicatorPosition(index));
  }

  private updateIndicatorPosition(index: number): void {
    const tabEl = this.tabElements.get(index)?.nativeElement;

    if (tabEl) {
      const { offsetLeft, offsetWidth } = tabEl;

      const newStyle = {
        width: `${offsetWidth}px`,
        transform: `translateX(${offsetLeft}px)`,
      };

      // Only update if it has changed
      if (
        this.indicatorStyle['width'] !== newStyle.width ||
        this.indicatorStyle['transform'] !== newStyle.transform
      ) {
        this.indicatorStyle = newStyle;
      }
      this.istabOpenButtonActive = false;
    }
  }
  //<==================== End tab Make ====================>

  //<==================== Page Go Back ====================>
  protected goBack() {
    if (this.currentIndex > 0) {
      this.tabMaker(
        this.currentIndex - 1,
        this.tabIndicators[this.currentIndex - 1]
      );
    }
  }
  //<==================== End Page Go Back ====================>

  //<==================== Page Go Next ====================>
  protected goNext() {
    if (this.currentIndex < this.tabIndicators.length - 1) {
      this.tabMaker(
        this.currentIndex + 1,
        this.tabIndicators[this.currentIndex + 1]
      );
    }
  }
  //<==================== End Page Go Next ====================>

  //<==================== Making sort ====================>
  //01. Propert type sort
  protected propertyTypeSort(): string[] {
    if (this.filterTypeOptions.length === 0) {
      return this.typeOptions.sort((a, b) => a.localeCompare(b));
    } else {
      return this.filterTypeOptions.sort((a, b) => a.localeCompare(b));
    }
  }

  //02. Propert listing sort
  protected propertyStatusSort(): string[] {
    if (this.filterStatusOptions.length === 0) {
      return this.statusOptions.sort((a, b) => a.localeCompare(b));
    } else {
      return this.filterStatusOptions.sort((a, b) => a.localeCompare(b));
    }
  }

  //03. Propert amenities sort
  protected propertyAmenitiesSort(): string[] {
    if (this.filterFeatureAmenity.length === 0) {
      return this.definedFeatureAmenity.sort((a, b) => a.localeCompare(b));
    } else {
      return this.filterFeatureAmenity.sort((a, b) => a.localeCompare(b));
    }
  }

  //04. Propert furnishing status sort
  protected propertyFurnishingStatusOptionsSort() {
    if (this.filterFurnishingStatusOptions.length === 0) {
      return this.furnishingStatusOptions.sort((a, b) => a.localeCompare(b));
    } else {
      return this.filterFurnishingStatusOptions.sort((a, b) =>
        a.localeCompare(b)
      );
    }
  }

  //05. Propert condition status sort
  protected propertyConditionOptionsSort() {
    if (this.filterPropertyConditionOptions.length === 0) {
      return this.propertyConditionOptions.sort((a, b) => a.localeCompare(b));
    } else {
      return this.filterPropertyConditionOptions.sort((a, b) =>
        a.localeCompare(b)
      );
    }
  }

  //06. Propert availability status sort
  protected propertyAvailabilityStatusOptionsSort() {
    if (this.filterPropertyAvailabilityStatusOptions.length === 0) {
      return this.propertyAvailabilityStatusOptions.sort((a, b) =>
        a.localeCompare(b)
      );
    } else {
      return this.filterPropertyAvailabilityStatusOptions.sort((a, b) =>
        a.localeCompare(b)
      );
    }
  }

  //07. Propert priority status sort
  protected propertyPriorityOptionsSort() {
    if (this.filterPropertyPriorityOptions.length === 0) {
      return this.propertyPriorityOptions.sort((a, b) => a.localeCompare(b));
    } else {
      return this.filterPropertyPriorityOptions.sort((a, b) =>
        a.localeCompare(b)
      );
    }
  }

  //08. Property Verification Status
  protected propertyVerificationStatusOptionsSort() {
    if (this.filterPropertyVerificationStatusOptions.length === 0) {
      return this.propertyVerificationStatusOptions.sort((a, b) =>
        a.localeCompare(b)
      );
    } else {
      return this.filterPropertyVerificationStatusOptions.sort((a, b) =>
        a.localeCompare(b)
      );
    }
  }

  //09. Status of property
  protected propertyStatusOptionsSort() {
    if (this.filterPropertyStatusOptions.length === 0) {
      return this.propertyStatusOptions.sort((a, b) => a.localeCompare(b));
    } else {
      return this.filterPropertyStatusOptions.sort((a, b) =>
        a.localeCompare(b)
      );
    }
  }

  //10. Ownership type
  protected ownerShipTypeOptionsSort() {
    if (this.filterOwnerShipTypeOptions.length === 0) {
      return this.ownerShipTypeOptions.sort((a, b) => a.localeCompare(b));
    } else {
      return this.filterOwnerShipTypeOptions.sort((a, b) => a.localeCompare(b));
    }
  }

  //<==================== End Making sort ====================>

  //<==================== Amenity Icon Maker ====================>
  protected amenityIconMaker(amenity: string): string {
    return this.propertyService.investigateTheAmenityIcon(amenity);
  }
  //<==================== End Amenity Icon Maker ====================>

  //<==================== Mat icons maker ====================>
  private registerCustomIcons(): void {
    const iconMap = {
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

    for (const [name, path] of Object.entries(iconMap)) {
      this.matIconRegistry.addSvgIcon(
        name,
        this.domSanitizer.bypassSecurityTrustResourceUrl(
          `/Images/Icons/${path}`
        )
      );
    }
  }
  //<==================== End mat icons maker ====================>

  //<==================== Choose the correct icon for the file type ====================>
  protected chooceIcon(type: string): string {
    switch (type) {
      case 'doc':
        return 'word';
      case 'docx':
        return 'word';
      case 'dot':
        return 'word';
      case 'dotx':
        return 'word';
      case 'rtf':
        return 'word';
      case 'odt':
        return 'word';
      case 'txt':
        return 'txt';
      case 'xml':
        return 'xml';
      case 'xls':
        return 'excel';
      case 'xlsx':
        return 'excel';
      case 'xlsm':
        return 'excel';
      case 'xlt':
        return 'excel';
      case 'xltx':
        return 'excel';
      case 'ods':
        return 'excel';
      case 'csv':
        return 'excel';
      case 'tsv':
        return 'excel';
      case 'ppt':
        return 'powerpoint';
      case 'pptx':
        return 'powerpoint';
      case 'pptm':
        return 'powerpoint';
      case 'pot':
        return 'powerpoint';
      case 'potx':
        return 'powerpoint';
      case 'odp':
        return 'powerpoint';
      case 'pdf':
        return 'pdf';
      case 'zip':
        return 'zip';
      case 'png':
        return 'image';
      case 'jpeg':
        return 'image';
      case 'webp':
        return 'image';
      case 'gif':
        return 'image';
      case 'jpg':
        return 'image';
      case 'ico':
        return 'image';
      case 'svg':
        return 'image';
      default:
        return 'file';
    }
  }
  //<==================== End choose the correct icon for the file type ====================>

  /**
   * Prevents the default behavior of an event (e.g., drag/drop).
   * This is used to stop the browser from opening dropped files or other unintended actions.
   * @param event The event to be prevented.
   */
  private preventDefault(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Navigates the user to the main properties listing page.
   * Useful after successfully creating or updating a property.
   */
  protected goToProperties(): void {
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/dashboard/properties']);
    });
  }

  /**
   * Navigates the user back to the property listing form.
   * Useful for quickly reloading the form or returning after a navigation away.
   */
  protected goToListing(): void {
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/dashboard/property-listing']);
    });
  }

  //<==================== Property Images ====================>
  protected closePropertyImagesError() {
    this.isPropertyImageTypeMissMatched = false;
    this.propertyErrorText = '';
  }

  // Trigger property images input
  protected triggerPropertyImages() {
    this.propertyImages.nativeElement.click();
  }

  // Handle property images paste
  protected handlePastePropertyImage(event: ClipboardEvent): void {
    event.preventDefault();

    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          this.processPastedPropertyImage(file);
        }
      }
    }
  }

  //Process property images paste
  protected processPastedPropertyImage(file: File) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const input = this.propertyImages.nativeElement;
    input.files = dataTransfer.files;

    // Trigger the same file selection logic
    this.onFileSelectedPropertyImage({ target: input } as any);
  }

  //Process property image drop
  protected onDropPropertyImage(event: DragEvent): void {
    event.preventDefault();
    this.isPropertyImageDragOver = false;

    console.log('event.dataTransfer?.files: ', event.dataTransfer?.files);

    const files = event.dataTransfer?.files;
    if (files) {
      this.propertyImagePreviewMaker(files);
    }
  }

  //Process property image drag over
  protected onDragOverPropertyImage(event: DragEvent): void {
    event.preventDefault(); // Crucial to allow drop
    event.stopPropagation();
    if (event.currentTarget === event.target) {
      this.isPropertyImageDragOver = true;
    }
  }

  //Process property image drap leave
  protected onDragLeavePropertyImage(event: DragEvent) {
    event.preventDefault();
    this.isPropertyImageDragOver = false;
  }

  //Process property image select
  protected onFileSelectedPropertyImage(event: any): void {
    const files = event.target.files;
    this.propertyImagePreviewMaker(files);
  }

  /**

  * Property image preview maker
  * Property images push into the selected property images array

  **/
  private propertyImagePreviewMaker(files: FileList): void {
    // Loop through images of property

    for (let file of Array.from(files)) {
      // Check if file is an image
      if (!this.allowedImageTypes.includes(file.type)) {
        this.isPropertyImageTypeMissMatched = true;
        this.propertyErrorText = `Error: ${file.name} type ${file.type} not matched!`;
        return;
      }

      //Define data for selcetedPropertyImages

      // Push the data to the selcetedPropertyImages
      this.selcetedPropertyImages.push(file);

      // Define reader
      const reader = new FileReader();

      // Call reader onload function
      reader.onload = (e: any) => {
        //Define canva image
        const img = new Image();

        img.onload = () => {
          //Define data for propertyImagePreview
          const data: propertyImagePreview = {
            URL: e.target.result,
            width: img.width,
            height: img.height,
            name: file.name,
          };

          this.propertyImagePreview.push(data);
        };

        img.src = e.target.result;
      };

      reader.readAsDataURL(file);
    }

    console.log(this.propertyImagePreview.length);
  }

  //Remove image from arrays
  protected removePropertyImage(index: number) {
    this.propertyImagePreview.splice(index, 1);
    this.selcetedPropertyImages.splice(index, 1);
  }

  //<==================== End Property Images ====================>

  //<==================== Property Docs ====================>

  /**
   * Opens the file input dialog for selecting property documents.
   */
  protected triggerPropertyDocs(): void {
    this.propertyDocs.nativeElement.click();
  }

  /**
   * Handles the file select event.
   */
  protected onPropertyDocsSelect(event: any) {
    this.propertyDocsPreviewMaker(event.target.files);
  }

  /**
   * Handles the drag over event when files are dragged over the drop zone.
   * Prevents default behavior to allow dropping.
   */
  protected onDragOverPropertyDocs(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget === event.target) {
      this.isPropertyDocsDragOver = true;
    }
  }

  /**
   * Handles when files are dropped into the drop zone.
   * Validates and processes the dropped files.
   */
  protected onDropPropertyDocs(event: DragEvent): void {
    event.preventDefault();
    this.isPropertyDocsDragOver = false;

    const files = event.dataTransfer?.files;
    if (files) {
      this.propertyDocsPreviewMaker(files);
    }
  }

  /**
   * Handles the drag leave event from the drop zone.
   */
  protected onDragLeavePropertyDocs(event: DragEvent): void {
    event.preventDefault();
    this.isPropertyDocsDragOver = false;
  }

  /**
   * Handles the paste event to support pasting documents directly.
   * Extracts files from clipboard items and processes them.
   */
  protected handlePastePropertyDocs(event: ClipboardEvent): void {
    event.preventDefault();

    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          this.processPastedPropertyDocs(file);
        }
      }
    }
  }

  /**
   * Helper method to process a file pasted via clipboard.
   * Wraps file into a FileList and reuses the existing logic.
   */
  protected processPastedPropertyDocs(file: File): void {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const input = this.propertyDocs.nativeElement;
    input.files = dataTransfer.files;

    // Trigger the same selection handler
    this.propertyDocsPreviewMaker(input.files!);
  }

  /**
   * Processes and validates selected or dropped document files.
   * Generates previews for allowed document types.
   */
  private async propertyDocsPreviewMaker(files: FileList): Promise<void> {
    for (let file of Array.from(files)) {
      if (!this.propertyFormallowedDocs.includes(file.type)) {
        await this.notification.notification(
          'error',
          `Error: ${file.name} type ${file.type} is not allowed!`
        );
        return;
      }

      const reader = new FileReader();

      reader.onload = (item) => {
        const fileContent = item.target?.result as string;
        const fileName = file.name;
        const fileExtension = file.name.split('.').pop() as string;

        const data: propertyDocPreview = {
          name: fileName,
          type: fileExtension,
          icon: this.chooceIcon(fileExtension),
        };
        this.propertyDocsPreview.push(data);
      };

      this.propertyDocuments.push(file);

      reader.readAsDataURL(file);
    }
  }

  protected removeDocs(index: number) {
    this.propertyDocsPreview.splice(index, 1);
    this.propertyDocuments.splice(index, 1);
  }

  //<==================== End Property Docs ====================>

  //<==================== Filter Property Type ====================>
  protected filterTypeOperation(data: string): void {
    this.filterTypeOptions = this.typeOptions.filter((option) =>
      option.toLowerCase().includes(data.toLowerCase())
    );
  }
  //<==================== End Filter Property Type ====================>

  //<==================== Filter Property Status ====================>
  protected filterStatusOperation(data: string): void {
    this.filterStatusOptions = this.statusOptions.filter((option) =>
      option.toLowerCase().includes(data.toLowerCase())
    );
  }
  //<==================== End Filter Property Status ====================>
  //<==================== Filter Property Amenities ====================>
  protected filterFeatureAmenityOperation(data: string): void {
    if (!this.definedFeatureAmenity.includes(data)) {
      this.isAmenitiesNotIncluded = true;
      this.amenitiesNotIncludedText = data;
    }
    this.filterFeatureAmenity = this.definedFeatureAmenity.filter((option) =>
      option.toLowerCase().includes(data.toLowerCase())
    );
  }

  protected addNewAminity() {
    this.isAmenitiesNotIncluded = false;
    this.featureAmenities.push(this.amenitiesNotIncludedText);
  }
  //<==================== End Filter Property Amenities ====================>

  //<==================== Filter address section country ====================>
  protected async addressMainFilterCountries(
    data: string | { name: string }
  ): Promise<void> {
    // Normalize the country input to string
    if (
      typeof data === 'object' &&
      data &&
      'name' in data &&
      typeof data.name === 'string'
    ) {
      this.typeAddressCountry = data.name.toLowerCase();
    } else if (typeof data === 'string') {
      this.typeAddressCountry = data.toLowerCase();
    } else {
      this.typeAddressCountry = '';
    }

    const countries: Country[] = await this.APIs.getCountries();

    if (!Array.isArray(countries)) return;

    this.AddressCountries = countries;

    this.AddressFilteredCountries =
      this.AddressCountryControl.valueChanges.pipe(
        startWith(this.typeAddressCountry),
        map((value: string | Country | null) => {
          const name =
            typeof value === 'string'
              ? value.toLowerCase()
              : typeof value?.name === 'string'
                ? value.name.toLowerCase()
                : '';

          return name
            ? this.addressFilterCountries(name)
            : this.AddressCountries.slice();
        })
      );
  }

  protected addressFilterCountries(name: string): Country[] {
    const filterValue = name.toLowerCase();
    return this.AddressCountries.filter((c) =>
      c.name.toLowerCase().includes(filterValue)
    );
  }

  protected addressDisplayFlag(country: Country): string {
    return typeof country === 'string' ? country : country?.name ?? '';
  }
  //<==================== End filter address section country ====================>

  //<==================== Currency Controller ====================>

  protected openCurrency() {
    this.isPriceCurrencyPanelOpen = true;
    this.isCurrencySelected = false;
    this.countryActualCurrency = '';
    this.selectedCountryWithCurrency = null;
    this.allCountriesWithCurrency = [];
    this.filteredCountriesWithCurrency = of([]);
    this.isCountryOfCurrencySelected = false;
  }

  protected closeCurrency() {
    if (this.isCountryOfCurrencySelected) {
      this.isPriceCurrencyPanelOpen = false;
      this.countryOfCurrencySelectedError = false;
    } else {
      this.countryOfCurrencySelectedError = true;
    }
  }

  protected async selectCountriesWithCurrencies(input: string): Promise<void> {
    const countries = await this.APIs.getCustomCountryDetails();

    if (!Array.isArray(countries)) return;

    this.filteredCountriesWithCurrency =
      this.countryControlWithCurrency.valueChanges.pipe(
        startWith(input),
        map((value: string | CountryDetailsCustomType) => {
          const name =
            typeof value === 'string'
              ? value.toLowerCase()
              : value?.name?.common?.toLowerCase() ?? '';
          return name
            ? countries.filter((country) =>
              country?.name?.common?.toLowerCase().includes(name)
            )
            : countries.slice();
        })
      );
  }

  protected async selectCountryWithCurrency(
    event: MatAutocompleteSelectedEvent
  ): Promise<void> {
    const data = event.option.value as CountryDetailsCustomType;
    const countryName = data.name.common;
    // Ensure region is always a string
    const country: CountryDetails[] = await this.APIs.getCountryByName(
      countryName
    );

    if (!Array.isArray(country) || country.length === 0) {
      console.error('Country did not find!');
      return;
    }

    this.country = country[0];

    const currencySymbol = this.country?.currencies
      ? Object.keys(this.country?.currencies ?? {})[0]
      : '';

    this.isCurrencySelected = true;
    this.countryActualCurrency = currencySymbol;

    if (this.countryActualCurrency) {
      this.isCountryOfCurrencySelected = true;
      this.countryOfCurrencySelectedError = false;
    }
  }

  protected displayCountryWithCurrencyFlag(
    country: CountryDetailsCustomType | string
  ): string {
    return typeof country === 'string' ? country : country?.name?.common ?? '';
  }
  //<==================== End currency Controller ====================>

  //<==================== Property owner infor ====================>
  protected async filterOwnerThroughAllUsers(input: string): Promise<void> {
    this.isOwnerNotSelected = true;
    const users = await this.APIs.getAllUsers();
    if (users) {
      this.allUsers = users;
      this.filterOwner = users.filter((user) =>
        user.name.toLowerCase().includes(input.toLowerCase())
      );
    }
  }

  protected getTheSelectedOwner(input: MatAutocompleteSelectedEvent): void {
    const selectedOwner = input.option.value;
    if (selectedOwner) {
      this.isOwnerNotSelected = false;
      this.selectedOwner =
        this.allUsers.find((data) => {
          const findingUserName = data.name.toLowerCase();
          const typingUserName = selectedOwner.toLowerCase();
          return findingUserName === typingUserName;
        }) || null;
    } else {
      this.isOwnerNotSelected = true;
    }
    if (this.selectedOwner) this.ownerUsername = this.selectedOwner.username;
  }
  //<==================== End Property owner infor ====================>

  //<==================== featureAmenity ====================>

  protected addFeaturesAmenity(event: MatAutocompleteSelectedEvent) {
    if (!this.featureAmenities.includes(event.option.value)) {
      this.featureAmenities.push(event.option.value);
    }
  }

  protected cancelAmenty(number: number) {
    this.featureAmenities.splice(number, 1);
  }

  protected addFeaturesAmenityEnter(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Enter' && this.featureAmenity !== '') {
      this.featureAmenities.push(this.featureAmenity);
    }
  }

  //<==================== End featureAmenity ====================>

  //<==================== Map ====================>

  protected onLocationPicked(event: { lat: number; lng: number }) {
    this.mapLocationLat = event.lat;
    this.mapLocationLng = event.lng;
    this.GoogleMapLocationEmbeddedUrl = `https://www.google.com/maps?q=${this.mapLocationLat},${this.mapLocationLng}&hl=en&z=14&output=embed`;
    // this.GoogleMapLocationEmbeddedUrl = `https://www.google.com/maps/embed/v1/view?key=AIzaSyDtyUEKZAgXCBiuteyZVvaAaV0OVm-Wydc&center=${this.mapLocationLat},${this.mapLocationLng}&zoom=14`;
    this.location = {
      lat: this.mapLocationLat,
      lng: this.mapLocationLng,
      embeddedUrl: this.GoogleMapLocationEmbeddedUrl,
    };
  }

  //<==================== End Map ====================>

  //<==================== Property Video Preview ====================>
  protected propertyVideoUrl(input: string): void {
    const youtubeMatch = input.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    const vimeoMatch = input.match(/vimeo\.com\/(\d+)/);
    const driveMatch = input.match(/drive\.google\.com\/file\/d\/([^/]+)/);

    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      this.videoPreviewURL = `https://www.youtube.com/embed/${videoId}`;
      this.isIframeEmbed = true;
    } else if (vimeoMatch) {
      const videoId = vimeoMatch[1];
      this.videoPreviewURL = `https://player.vimeo.com/video/${videoId}`;
      this.isIframeEmbed = true;
    } else if (driveMatch) {
      const fileId = driveMatch[1];
      this.videoPreviewURL = `https://drive.google.com/file/d/${fileId}/preview`;
      this.isIframeEmbed = true;
    } else if (input.includes('dropbox.com')) {
      this.videoPreviewURL = input.replace('?dl=0', '?raw=1');
      this.isIframeEmbed = false;
    } else {
      this.videoPreviewURL = input;
      this.isIframeEmbed = false;
    }
  }
  //<==================== End Property Video Preview ====================>

  //<==================== 360° Virtual Preview ====================>
  protected updateVirtualTourUrl(input: string): void {
    this.virtualPreviewURL = input; // trust the embed URL or transform if needed
  }
  //<==================== End 360° Virtual Preview ====================>

  //<==================== Form submit ====================>
  protected async submit() {
    try {
      // Assemble the Address
      const Address: Address = {
        houseNumber: this.AddressHouseNumber.trim(),
        street: (this.AddressStreet ?? '').trim(),
        city: this.AddressCity.trim(),
        stateOrProvince: (this.AddressStateOrProvince ?? '').trim(),
        postcode: this.AddressPostcode.trim(),
        country: this.typeAddressCountry.trim(),
      };

      // Assemble the Agent info
      this.AddedBy = {
        username: this.AddedByUsername.trim(),
        name: this.AddedByName.trim(),
        email: this.AddedByEmail.trim(),
        role: this.AddedByRole.trim(),
        contactNumber: (this.AddedByContactNumber ?? '').trim(),
        addedAt:
          this.AddedByAddedAt instanceof Date
            ? this.AddedByAddedAt.toISOString().trim()
            : (this.AddedByAddedAt ?? '').trim(),
      };

      const formData = new FormData();

      // Error validation

      if (
        !this.isUserCanAssignAgentToTheProperty() &&
        !this.isUserCanUploadDocumentsToTheProperty() &&
        !this.isUserCanManageAmenitiesToTheProperty() &&
        !this.isUserCanChangeListingStatusOfTheProperty()
      ) {
        throw new Error('User does not have permission to perform the action.');
      }

      // Basic Property Details
      if (!this.title) {
        throw new Error('Title is required!');
      }
      if (!this.type) {
        throw new Error('Type is required!');
      }
      if (!this.listing) {
        throw new Error('Listing is required!');
      }
      if (!this.description) {
        throw new Error('Discription is required!');
      }
      // End Basic Property Details

      // Location Details
      if (!this.AddressHouseNumber) {
        throw new Error('House number is required!');
      }

      if (!this.AddressStreet) {
        throw new Error('Address streat is required!');
      }

      if (!this.AddressCity) {
        throw new Error('Address city is required!');
      }

      if (!this.AddressStateOrProvince) {
        throw new Error('Address state or province is required!');
      }

      if (!this.AddressPostcode) {
        throw new Error('Address postcode is required!');
      }

      if (!this.typeAddressCountry) {
        throw new Error('Country is required!');
      }
      // End Location Details

      // Property Specifications
      if (this.totalArea !== 0 && !this.totalArea) {
        throw new Error('Total area is required!');
      }

      if (this.builtInArea !== 0 && !this.builtInArea) {
        throw new Error('Built in area is required!');
      }

      if (this.balconies == null || this.balconies === undefined) {
        throw new Error('Balconies is required!');
      }

      if (this.kitchen == null || this.kitchen === undefined) {
        throw new Error('Kitchen is required!');
      }

      if (this.bedrooms == null || this.bedrooms === undefined) {
        throw new Error('Bedrooms is required!');
      }

      if (this.bathrooms == null || this.bathrooms === undefined) {
        throw new Error('Bathrooms is required!');
      }

      if (this.maidrooms === null || this.maidrooms === undefined) {
        throw new Error('Maidrooms is required!');
      }

      if (this.driverRooms == null || this.driverRooms === undefined) {
        throw new Error('Driver rooms is required!');
      }

      if (
        !this.furnishingStatus &&
        !this.furnishingStatusOptions.includes(this.furnishingStatus)
      ) {
        throw new Error('Select the furnishing status!');
      }

      if (!this.totalFloors) {
        throw new Error('Number of floors is required!');
      }

      if (!this.numberOfParking) {
        throw new Error('Number of parking is required!');
      }
      // End Property Specifications

      // Construction & Age
      if (!this.builtYear && this.builtYear !== 0) {
        throw new Error('Built year is required!');
      }

      if (
        !this.propertyCondition &&
        !this.propertyConditionOptions.includes(this.propertyCondition)
      ) {
        throw new Error('Select the property condition!');
      }

      if (!this.developerName) {
        throw new Error('Developer name is required!');
      }

      if (!this.ownerShipType) {
        throw new Error('Owner ship type is required!');
      }

      if (!this.ownerName) {
        throw new Error('Owner is required!');
      }
      // End Construction & Age

      // Financial Details
      if (!this.price) {
        throw new Error('Price is required!');
      }

      if (!this.countryActualCurrency) {
        throw new Error('Currency is required!');
      }

      if (!this.pricePerSqurFeet) {
        throw new Error('Price per squr feet is required!');
      }

      if (!this.maintenanceFees) {
        throw new Error('Maintenance fees is required!');
      }

      if (!this.serviceCharges) {
        throw new Error('Service charges is required!');
      }

      if (
        !this.availabilityStatus &&
        !this.propertyAvailabilityStatusOptions.includes(
          this.availabilityStatus
        )
      ) {
        throw new Error('Property availability status is required!');
      }
      // End Financial Details

      // Features & Amenities
      if (this.featureAmenities.length === 0) {
        throw new Error('Feature amenities is required!');
      }
      // End Features & Amenities

      // Media
      if (this.selcetedPropertyImages.length === 0) {
        throw new Error('Property images is required!');
      }

      if (this.propertyDocuments.length === 0) {
        throw new Error('Property documents is required!');
      }
      // End Media

      // Listing Management
      if (!this.listingDate) {
        throw new Error('Property listing date is required!');
      }

      if (!this.AddedBy) {
        throw new Error('Select the owner of the property!');
      }
      // End Listing Management

      // Administrative & Internal Use
      if (!this.listingDate) {
        throw new Error('Property listing date is required!');
      }

      if (
        !this.verificationStatus &&
        !this.propertyVerificationStatusOptions.includes(
          this.verificationStatus
        )
      ) {
        throw new Error(
          'Property verification status is required, select from the list!'
        );
      }

      if (
        !this.priority &&
        !this.propertyPriorityOptions.includes(this.priority)
      ) {
        throw new Error('Property priority is required, select from the list!');
      }

      if (!this.status && !this.propertyStatusOptions.includes(this.priority)) {
        throw new Error('Property status is required, select from the list!');
      }

      if (!this.internalNote) {
        throw new Error('Internal note is required!');
      }
      // End Administrative & Internal Use

      // For appending

      //Progress bar start
      this.progress.start();

      //Start Form Append

      // Basic Property Details
      formData.append('id', this.id.trim());
      formData.append('title', this.title.trim());
      formData.append('type', this.type.trim());
      formData.append('listing', this.listing.trim());
      formData.append('description', this.description.trim());
      // End Basic Property Details

      // Location Details
      formData.append('countryDetails', JSON.stringify(this.country).trim());
      formData.append('address', JSON.stringify(Address).trim());
      formData.append('location', JSON.stringify(this.location).trim());
      // End Location Details

      // Property Specifications
      formData.append('totalArea', this.totalArea.toString().trim());
      formData.append('builtInArea', this.builtInArea.toString().trim());
      formData.append('livingRooms', this.livingRooms.toString().trim());
      formData.append('balconies', this.balconies.toString().trim());
      formData.append('kitchen', this.kitchen.toString().trim());
      formData.append('bedrooms', this.bedrooms.toString().trim());
      formData.append('bathrooms', this.bathrooms.toString().trim());
      formData.append('maidrooms', this.maidrooms.toString().trim());
      formData.append('driverRooms', this.driverRooms.toString().trim());
      formData.append(
        'furnishingStatus',
        this.furnishingStatus.toString().trim()
      );
      formData.append('totalFloors', this.totalFloors.toString().trim());
      formData.append(
        'numberOfParking',
        this.numberOfParking.toString().trim()
      );
      // End Property Specifications

      // Construction & Age
      formData.append('builtYear', this.builtYear.toString().trim());
      formData.append(
        'propertyCondition',
        this.propertyCondition.toString().trim()
      );
      formData.append('developerName', this.developerName.toString().trim());
      formData.append(
        'projectName',
        this.projectName ? this.projectName.toString().trim() : ''
      );
      formData.append('ownerShipType', this.ownerShipType.toString().trim());
      // End Construction & Age

      // Financial Details
      formData.append('price', this.price.toString().trim());
      formData.append('currency', this.countryActualCurrency.toString().trim());
      formData.append(
        'pricePerSqurFeet',
        this.pricePerSqurFeet.toString().trim()
      );
      formData.append(
        'expectedRentYearly',
        this.expectedRentYearly ? this.expectedRentYearly.toString().trim() : ''
      );
      formData.append(
        'expectedRentQuartely',
        this.expectedRentQuartely
          ? this.expectedRentQuartely.toString().trim()
          : ''
      );
      formData.append(
        'expectedRentMonthly',
        this.expectedRentMonthly
          ? this.expectedRentMonthly.toString().trim()
          : ''
      );
      formData.append(
        'expectedRentDaily',
        this.expectedRentDaily ? this.expectedRentDaily.toString().trim() : ''
      );
      formData.append(
        'maintenanceFees',
        this.maintenanceFees.toString().trim()
      );
      formData.append('serviceCharges', this.serviceCharges.toString().trim());
      formData.append(
        'transferFees',
        this.transferFees ? this.transferFees.toString().trim() : ''
      );
      formData.append(
        'availabilityStatus',
        this.availabilityStatus.toString().trim()
      );
      // End Financial Details

      // Features & Amenities
      formData.append(
        'featuresAndAmenities',
        JSON.stringify(this.featureAmenities).trim()
      );
      // End Features & Amenities

      // Media
      // Append each property image file individually
      for (let file of this.selcetedPropertyImages) {
        formData.append('images', file, file.name);
      }
      // Append each property document file individually
      this.propertyDocuments.forEach((file, idx) => {
        formData.append('documents', file, file.name);
      });
      formData.append(
        'videoTour',
        this.videoTour ? this.videoTour.toString().trim() : ''
      );
      formData.append(
        'virtualTour',
        this.virtualTour ? this.virtualTour.toString().trim() : ''
      );
      // End Media

      // Listing Management
      formData.append('listingDate', this.listingDate.toISOString().trim());
      formData.append(
        'availabilityDate',
        this.availabilityDate ? this.availabilityDate.toISOString().trim() : ''
      );
      formData.append(
        'listingExpiryDate',
        this.listingExpiryDate
          ? this.listingExpiryDate.toISOString().trim()
          : ''
      );
      formData.append('addedBy', JSON.stringify(this.AddedBy).trim());
      formData.append(
        'owner',
        this.selectedOwner?.username ? this.selectedOwner?.username : ''
      );
      // End Listing Management

      // Administrative & Internal Use
      formData.append('referenceCode', this.referenceCode.toString().trim());
      formData.append(
        'verificationStatus',
        this.verificationStatus.toString().trim()
      );
      formData.append('priority', this.priority.toString().trim());
      formData.append('status', this.status.toString().trim());
      formData.append('internalNote', this.internalNote.toString().trim());
      // End Administrative & Internal Use

      // API calling
      await this.propertyService
        .createProperties(formData, this.id)
        .then((res) => {
          console.log(res);
          this.notification.notification(res.status, res.message);
        })
        .catch((error) => {
          if (error) {
            console.log('Error: ', error.error);
            this.notification.notification(
              error.error.status,
              error.error.message
            );
            this.progress.error();
          }
        })
        .finally(() => {
          this.progress.complete();
          setTimeout(() => {
            this.router.navigate(['/dashboard/properties']);
          }, 2000);
        });
    } catch (error) {
      if (error) {
        this.notification.notification('error', error as string);
      }
    }
  }
  //<==================== End Form submit ====================>
}
