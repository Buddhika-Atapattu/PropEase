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
import { Subscription, pipe } from 'rxjs';
import { Observable } from 'rxjs';
import { EditorComponent } from '@tinymce/tinymce-angular';
import { AuthService, BaseUser } from '../../../../services/auth/auth.service';
import {
  PropertyService,
  Property,
  FEATURES_AMENITIES,
  GoogleMapLocation,
  AddedBy,
  Address,
  propertyDocPreview,
  MSG,
} from '../../../../services/property/property.service';
import { WindowsRefService } from '../../../../services/windowRef.service';
import { CryptoService } from '../../../../services/cryptoService/crypto.service';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import {
  msgTypes,
  NotificationComponent,
} from '../../../components/dialogs/notification/notification.component';
import { DomSanitizer } from '@angular/platform-browser';
import { map, startWith } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import {
  APIsService,
  Country,
  CountryDetails,
  UsersType,
} from '../../../../services/APIs/apis.service';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MapComponent } from '../../../components/shared/map/map.component';

interface propertyImagePreview {
  URL: string;
  width: number;
  name: string;
  height: number;
}

@Component({
  selector: 'app-property-listing',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ProgressBarComponent,
    NotificationComponent,
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
  ],
  templateUrl: './property-listing.component.html',
  styleUrl: './property-listing.component.scss',
})
export class PropertyListingComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  @ViewChild('propertyImages') propertyImages!: ElementRef<HTMLInputElement>;
  @ViewChild('propertyDocs') propertyDocs!: ElementRef<HTMLInputElement>;
  @ViewChild(ProgressBarComponent) progress!: ProgressBarComponent;
  @ViewChild(NotificationComponent) notification!: NotificationComponent;
  @ViewChild(MapComponent) map!: MapComponent;

  protected isFormError: boolean = false;
  protected isFormErrorText: string = '';

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected loggedUser: BaseUser | null = null;
  protected loggedUsername: string = '';

  //<================== Property image section ==================>
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

  //<================== Property Details ==================>

  protected title: Property['title'] = '';
  protected description: Property['description'] = '';
  protected id: Property['id'] = '';
  protected type: Property['type'] = '';
  protected status: Property['status'] = '';
  protected price: Property['price'] = 0;

  //Currency select
  /*

  01. isPriceCurrencyPanelOpen -> open pannel
  02. countryControlWithCurrency -> declaring and initializing an Angular FormControl
  03. filteredCountriesWithCurrency -> store the values that filter through all country
  04. selectedCountryWithCurrency -> selected country pbject
  05. allCountriesWithCurrency -> all counrty from the api
  06. isCurrencySelected -> check whether the currency is selected before closing the pannel
  07. countryActualCurrency -> get the actual country by text "Sri Lanka"
  08. isCountryOfCurrencySelected -> check the country is selected before closing the pannel
  09. countryOfCurrencySelectedError -> detect the error before clossing the pannel

  */
  protected isPriceCurrencyPanelOpen: boolean = false;
  protected countryControlWithCurrency = new FormControl<
    string | CountryDetails
  >('');
  protected filteredCountriesWithCurrency!: Observable<CountryDetails[]>;
  protected selectedCountryWithCurrency: CountryDetails | null = null; // this will store the selected currency
  protected allCountriesWithCurrency: CountryDetails[] = [];
  protected isCurrencySelected: boolean = false;
  protected countryActualCurrency: string = '';
  private isCountryOfCurrencySelected: boolean = false;
  protected countryOfCurrencySelectedError: boolean = false;

  //Owner information
  protected ownerUsername: string = '';
  protected allUsers: UsersType[] = [];
  protected selectedOwner: UsersType | null = null;
  protected ownerName: string = '';
  protected filterOwner: UsersType[] = [];
  protected isOwnerNotSelected: boolean = false;

  //Specific details of property
  protected bedrooms: Property['bedrooms'] = 0;
  protected bathrooms: Property['bathrooms'] = 0;
  protected maidrooms: Property['maidrooms'] = 0;
  protected area: Property['area'] = 0;

  //Address
  protected AddressHouseNumber: Address['houseNumber'] = '';
  protected AddressStreet: Address['street'] = '';
  protected AddressCity: Address['city'] = '';
  protected AddressStateOrProvince: Address['stateOrProvince'] = '';
  protected AddressPostcode: Address['postcode'] = '';
  //This one gets the detailed country object
  protected country: Property['countryDetails'] | null = null;

  //Country detection of Address
  protected AddressCountry: Country | string = '';
  protected AddressFilteredCountries!: Observable<Country[]>;
  protected AddressCountries: Country[] = [];
  protected AddressCountryControl: FormControl = new FormControl('');
  protected countryMissMatch: boolean = false;
  private typeAddressCountry: string = '';

  //AddedBy
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

  //FeatureAmenity

  protected featureAmenities: Property['featuresAndAmenities'] = [];
  protected featureAmenity: string = '';
  protected isAmenitiesNotIncluded: boolean = false;
  protected amenitiesNotIncludedText: string = '';

  //GoogleMapLocation
  protected mapLocationLat: GoogleMapLocation['lat'] = 0;
  protected mapLocationLng: GoogleMapLocation['lng'] = 0;
  protected GoogleMapLocationEmbeddedUrl: GoogleMapLocation['embeddedUrl'] = '';

  private location: Property['location'] = {
    lat: this.mapLocationLat,
    lng: this.mapLocationLng,
    embeddedUrl: this.GoogleMapLocationEmbeddedUrl,
  };

  //Predefined variables for suggests
  /*
  01. Property status
  02. Property type
  03. Property amenities
  */
  protected statusOptions: string[] = ['Sale', 'Rent', 'Sold', 'Rented'];
  protected filterStatusOptions: string[] = [];
  protected typeOptions: string[] = [
    'Apartment',
    'House',
    'Villa',
    'Commercial',
    'Land',
    'Stodio',
  ];
  protected filterTypeOptions: string[] = [];
  protected definedFeatureAmenity: string[] = FEATURES_AMENITIES;
  protected filterFeatureAmenity: string[] = [];

  //Property document upleoad
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

  //Text editor
  init: EditorComponent['init'] = {
    plugins: 'lists link image table code help wordcount',
  };

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
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });

      window.addEventListener('dragover', this.preventDefault, {
        passive: true,
      });
      window.addEventListener('drop', this.preventDefault, { passive: true });

    }
  }

  ngAfterViewInit(): void {
    // this.notification.notification('', '');
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  //<==================== Making sort ====================>
  protected propertyTypeSort(): string[] {
    if (this.filterTypeOptions.length === 0) {
      return this.typeOptions.sort((a, b) => a.localeCompare(b));
    } else {
      return this.filterTypeOptions.sort((a, b) => a.localeCompare(b));
    }
  }

  protected propertyStatusSort(): string[] {
    if (this.filterStatusOptions.length === 0) {
      return this.statusOptions.sort((a, b) => a.localeCompare(b));
    } else {
      return this.filterStatusOptions.sort((a, b) => a.localeCompare(b));
    }
  }

  protected propertyAmenitiesSort(): string[] {
    if (this.filterFeatureAmenity.length === 0) {
      return this.definedFeatureAmenity.sort((a, b) => a.localeCompare(b));
    } else {
      return this.filterFeatureAmenity.sort((a, b) => a.localeCompare(b));
    }
  }

  //<==================== End Making sort ====================>

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

    const files = event.dataTransfer?.files;
    if (files) {
      this.propertyImagePreviewMaker(files);
    }
  }

  //Process property image drag over
  protected onDragOverPropertyImage(event: DragEvent): void {
    event.preventDefault(); // Crucial to allow drop
    this.isPropertyImageDragOver = true;
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
    this.isPropertyDocsDragOver = true;
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
    console.log(this.propertyDocsPreview.length);
    console.log(this.propertyDocuments.length);
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
    if(!this.definedFeatureAmenity.includes(data)) {
      this.isAmenitiesNotIncluded = true;
      this.amenitiesNotIncludedText = data;
    }
    this.filterFeatureAmenity = this.definedFeatureAmenity.filter((option) =>
      option.toLowerCase().includes(data.toLowerCase())
    );
  }

  protected addNewAminity(){
    this.isAmenitiesNotIncluded = false;
    this.featureAmenities.push(this.amenitiesNotIncludedText);

  }
  //<==================== End Filter Property Amenities ====================>

  //<==================== Filter address section country ====================>
  protected async addressMainFilterCountries(data: string): Promise<void> {
    if (
      typeof data !== 'string' &&
      data &&
      typeof (data as any).name === 'string'
    ) {
      this.typeAddressCountry = (data as { name: string }).name;
    } else {
      this.typeAddressCountry = data;
    }
    const countries: Country[] = await this.APIs.getCountries();
    if (!Array.isArray(countries)) return;
    this.AddressCountries = countries;
    if (countries) {
      this.AddressFilteredCountries =
        this.AddressCountryControl.valueChanges.pipe(
          startWith(data),
          map((value: string | Country | null) => {
            const name = typeof value === 'string' ? value : value?.name;
            return name
              ? this.addressFilterCountries(name)
              : this.AddressCountries.slice();
          })
        );
    }
  }

  protected addressFilterCountries(name: string): Country[] {
    const filterValue = name.toLowerCase();
    this.countryMacher();
    return this.AddressCountries.filter((c) =>
      c.name.toLowerCase().includes(filterValue)
    );
  }

  protected addressDisplayFlag(country: Country): string {
    return typeof country === 'string' ? country : country?.name ?? '';
  }

  protected countryMacher() {
    if (
      typeof this.AddressCountry !== 'string' &&
      this.selectedCountryWithCurrency?.name.common === this.AddressCountry.name
    ) {
      this.countryMissMatch = false;
    } else {
      this.countryMissMatch = true;
    }
  }

  //<==================== End filter address section country ====================>

  //<==================== Currency Controller ====================>

  protected openCurrency() {
    this.isPriceCurrencyPanelOpen = true;
    this.isCurrencySelected = false;
    this.countryActualCurrency = '';
    this.selectedCountryWithCurrency = null;
    this.allCountriesWithCurrency = [];
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
    if (!this.allCountriesWithCurrency.length) {
      this.allCountriesWithCurrency =
        await this.APIs.getAllCountryWithCurrency();
    }

    this.filteredCountriesWithCurrency =
      this.countryControlWithCurrency.valueChanges.pipe(
        startWith(input),
        map((value: string | CountryDetails | null) => {
          const name =
            typeof value === 'string' ? value : value?.name?.common ?? '';
          return name
            ? this.allCountriesWithCurrency.filter((country) =>
                country.name.common.toLowerCase().includes(name.toLowerCase())
              )
            : this.allCountriesWithCurrency.slice();
        })
      );
  }

  protected selectCountryWithCurrency(
    event: MatAutocompleteSelectedEvent
  ): void {
    const country = event.option.value as CountryDetails;
    this.country = country;
    this.selectedCountryWithCurrency = country;

    const currencySymbol = this.selectedCountryWithCurrency?.currencies
      ? Object.values(this.selectedCountryWithCurrency.currencies)[0].symbol
      : '';

    this.isCurrencySelected = true;
    this.countryActualCurrency = currencySymbol;
    if (this.countryActualCurrency) {
      this.isCountryOfCurrencySelected = true;
      this.countryOfCurrencySelectedError = false;
    }
    this.countryMacher();
  }

  protected displayCountryWithCurrencyFlag(
    country: CountryDetails | string
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
    this.GoogleMapLocationEmbeddedUrl = `https://www.google.com/maps?q=${this.mapLocationLat},${this.mapLocationLng}&hl=es;z=14&output=embed`;
    this.location = {
      lat: this.mapLocationLat,
      lng: this.mapLocationLng,
      embeddedUrl: this.GoogleMapLocationEmbeddedUrl,
    };
  }

  //<==================== End Map ====================>

  //<==================== Form submit ====================>
  protected async submit() {
    const Address: Address = {
      houseNumber: this.AddressHouseNumber,
      street: this.AddressStreet,
      city: this.AddressCity,
      stateOrProvince: this.AddressStateOrProvince,
      postcode: this.AddressPostcode,
      country: this.typeAddressCountry,
    };

    console.log('Address: ', Address);

    this.location = {
      lat: this.mapLocationLat,
      lng: this.mapLocationLng,
      embeddedUrl: this.GoogleMapLocationEmbeddedUrl,
    };

    this.AddedBy = {
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

    const formData = new FormData();
    if (
      this.isCountryOfCurrencySelected &&
      this.isCurrencySelected &&
      !this.countryMissMatch &&
      !this.isOwnerNotSelected &&
      this.selcetedPropertyImages.length > 0 &&
      this.propertyDocuments.length > 0
    ) {
      this.progress.start();
      formData.append('id', this.id);
      formData.append('title', this.title);
      formData.append('description', this.description);
      formData.append('type', this.type);
      formData.append('status', this.status);
      formData.append('price', this.price.toString());
      formData.append('currency', this.countryActualCurrency);
      formData.append('bedrooms', this.bedrooms.toString());
      formData.append('bathrooms', this.bathrooms.toString());
      formData.append('maidrooms', this.maidrooms.toString());
      formData.append('area', this.area.toString());
      // Append each property image file individually
      for (let file of this.selcetedPropertyImages) {
        formData.append('images', file, file.name);
      }
      // Append each property document file individually
      this.propertyDocuments.forEach((file, idx) => {
        formData.append('propertyDocs', file, file.name);
      });
      formData.append('address', JSON.stringify(Address));
      formData.append('countryDetails', JSON.stringify(this.country));
      formData.append(
        'featuresAndAmenities',
        JSON.stringify(this.featureAmenities)
      );
      formData.append('addedBy', JSON.stringify(this.AddedBy));
      formData.append('location', JSON.stringify(this.location));

      await this.propertyService
        .createProperties(formData, this.id)
        .then((res) => {
          console.log(res);
          this.notification.notification(res.status, res.message);
        })
        .catch((error) => {
          if (error) {
            console.log('Error: ', error);
            this.notification.notification(error.status, error.message);
            this.progress.error();
          }
        })
        .finally(() => {
          this.progress.complete();
        });
    } else {
      console.error('Please fill all the required fields!');
      if (this.isBrowser) {
        await this.notification.notification(
          'error',
          'Please fill all the required fields!'
        );
      }
    }
  }
  //<==================== End Form submit ====================>
}
