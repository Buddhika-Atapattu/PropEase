import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { EditorComponent } from '@tinymce/tinymce-angular';
import { ImageCropperComponent } from 'ngx-image-cropper';
import { Observable, of, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

import { CameraBoxComponent } from '../../../components/dialogs/camera-box/camera-box.component';
import { FileScanner } from '../../../components/dialogs/file-scanner/file-scanner';
import { FileViewer } from '../../../components/dialogs/file-viewer/file-viewer';
import { NotificationDialogComponent } from '../../../components/dialogs/notification/notificationBar.component';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import { SignSignature } from '../../../components/dialogs/sign-signature/sign-signature.component';
import { SwitchButton } from '../../../components/shared/buttons/switch-button/switch-button.component';
import {
  CustomTableComponent,
  TableButton,
  TableButtonActionConfig,
  TableColumn,
} from '../../../components/shared/custom-table/custom-table.component';
import { SkeletonLoaderComponent } from '../../../components/shared/skeleton-loader/skeleton-loader.component';

import { SafeUrlPipe } from '../../../pipes/safe-url.pipe';

import {
  APIsService,
  Country,
  CountryCodes,
  ROLE_ACCESS_MAP,
  User,
} from '../../../services/APIs/apis.service';
import { AuthService } from '../../../services/auth/auth.service';
import {
  AddedBy,
  Address,
  BackEndPropertyData,
  PropertyService,
} from '../../../services/property/property.service';
import { ScanService } from '../../../services/scan/scan.service';
import {
  BASE_SECURITY_DEPOSIT_OPTIONS,
  CurrencyFormat,
  DEFAULT_COMPANY_POLICY,
  DEFAULT_RULES_AND_REGULATIONS,
  LATE_PAYMENT_PENALTY_OPTIONS,
  LatePaymentPenalty,
  Lease,
  LeaseAgreement,
  NOTICE_PERIOD_OPTIONS,
  NoticePeriod,
  PAYMENT_FREQUENCIES,
  PAYMENT_METHODS,
  PaymentFrequency,
  PaymentMethod,
  RENT_DUE_DATE_OPTIONS,
  RentDueDate,
  RulesAndRegulations,
  SecurityDeposit,
  Signatures,
  SystemMetadata,
  TenantService,
  UtilityResponsibility,
} from '../../../services/tenant/tenant.service';
import { UserControllerService } from '../../../services/userController/user-controller.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { PaginationUtil } from '../../../source/utility/pagination.utils';

// -----------------------------------------------------------------------------
// Local interfaces for this component
// -----------------------------------------------------------------------------

interface FilePreViewType {
  icon: string;
  name: string;
  size: number;
  type: string;
  token: string;
  URL?: string;
}

interface FILE {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  filename: string;
  URL: string;
}

interface TokenViceData {
  ageInMinutes: number;
  date: string;
  file: FILE;
  token: string;
  folder: string;
}

interface ScannedFileRecordJSON {
  date: string; // ISO date string
  tenant: string;
  token: string;
  files: TokenViceData[];
  folder: string;
}

interface PropertyCustomTableDataType {
  image: string;
  id: BackEndPropertyData[ 'id' ];
  type: BackEndPropertyData[ 'type' ];
  title: BackEndPropertyData[ 'title' ];
  listing: BackEndPropertyData[ 'listing' ];
  furnishingStatus: BackEndPropertyData[ 'furnishingStatus' ];
  developerName: BackEndPropertyData[ 'developerName' ];
  projectName: BackEndPropertyData[ 'projectName' ];
  builtYear: BackEndPropertyData[ 'builtYear' ];
  address: string;
  viewButton: TableButton;
  addButton: TableButton;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

@Component( {
  selector: 'app-tenant-edit',
  standalone: true,
  imports: [
    CommonModule,
    SkeletonLoaderComponent,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatMomentDateModule,
    MatSelectModule,
    MatDividerModule,
    MatDialogModule,
    MatProgressBarModule,
    NotificationDialogComponent,
    ProgressBarComponent,
    CustomTableComponent,
    SafeUrlPipe,
    MatTooltipModule,
    MatExpansionModule,
    SwitchButton,
  ],
  templateUrl: './tenant-edit.component.html',
  styleUrl: './tenant-edit.component.scss',
} )
export class TenantEditComponent implements OnInit, AfterViewInit, OnDestroy {
  // ============================================================================
  // 1. ViewChild references
  // ============================================================================

  @ViewChild( 'fileInput' ) fileInput!: ElementRef<HTMLInputElement>;

  @ViewChild( ProgressBarComponent ) progress!: ProgressBarComponent;
  @ViewChild( NotificationDialogComponent ) notification!: NotificationDialogComponent;
  @ViewChild( ImageCropperComponent ) imageCropper!: ImageCropperComponent;
  @ViewChild( CameraBoxComponent ) cameraBox!: CameraBoxComponent;

  // ============================================================================
  // 2. Global UI / environment state
  // ============================================================================

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  protected modeSub: Subscription | null = null;
  protected isLoading: boolean = true;
  protected loggedUser: User | null = null;

  protected readonly definedMaleDummyImageURL =
    'Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL =
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

  protected init: EditorComponent[ 'init' ] = {
    plugins: 'lists link image table code help wordcount',
  };

  // Allowed file types for tenant identification / documents
  protected readonly tenantIdentificationAcceptFileTypes: string[] = [
    '.doc',
    '.docx',
    '.dot',
    '.dotx',
    '.rtf',
    '.odt',
    '.txt',
    '.xls',
    '.xlsx',
    '.xlsm',
    '.xlt',
    '.xltx',
    '.ods',
    '.csv',
    '.tsv',
    '.ppt',
    '.pptx',
    '.pot',
    '.potx',
    '.odp',
    '.pps',
    '.pdf',
    '.jpeg',
    '.jpg',
    '.png',
    '.webp',
    '.gif',
    '.ico',
    '.svg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
    'application/rtf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
    'application/vnd.ms-excel.template.macroEnabled.12',
    'application/vnd.ms-excel.addin.macroEnabled.12',
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
    'application/vnd.ms-excel.template.binary.macroEnabled.12',
    'application/vnd.ms-excel.addin.binary.macroEnabled.12',
    'text/csv',
    'text/tsv',
    'application/vnd.ms-powerpoint',
    'text/tab-separated-values',
    'application/vnd.ms-powerpoint.presentation',
    'application/vnd.ms-powerpoint.template',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.template',
    'application/vnd.ms-powerpoint.addin.macroEnabled.12',
    'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    'application/vnd.oasis.opendocument.text-web',
    'application/vnd.oasis.opendocument.spreadsheet-web',
    'application/vnd.oasis.opendocument.presentation',
    'application/pdf',
    'text/plain',
    'image/*',
  ];

  private commonCountryCodes: CountryCodes[] = []; // currently unused; safe to keep
  protected phoneCodes: CountryCodes[] = [];
  protected filterPhoneCodes!: Observable<CountryCodes[]>;

  // ============================================================================
  // 3. Core domain state
  // ============================================================================

  // --- Lease ---
  private leaseID: string = '';
  private lease: Lease | null = null;

  // --- Tenant main object ---
  protected tenant: User | null = null;

  // --- Tenant basic info ---

  // Row 01
  protected tenantFullName: string = '';
  protected tenantEmail: string = '';
  protected isTenantEmailValid: boolean = true;

  // Row 02
  protected tenantNationality: string = '';
  protected tenantDateOfBirth: Date = new Date();
  protected tenantPhoneNumber: string = '';
  protected tenantPhoneCodeDetails: CountryCodes | null = null;
  protected isValidTenantPhoneNumber: boolean = true;
  protected tenantGender: string = '';

  // Row 03 - Identification document
  protected tenantNicOrPassport: string = '';
  protected identificationFileSelectionOption:
    | 'file-selection'
    | 'drag-and-drop'
    | 'file-scan'
    | '' = '';

  protected isDragOver: boolean = false;
  protected tenantScanedDocuments: File[] = [];
  protected tenantUploadedScanedDocuments: ScannedFileRecordJSON[] = [];
  protected tenantUploadedScanedDocumentsRemoved: ScannedFileRecordJSON[] = [];
  protected tenantScaannedDocumentPreview: FilePreViewType[] = [];
  private tenantUsername: string = '';
  private mobileFileUploadToken: string = '';

  // --- Tenant address ---

  protected tenantHouseNumber: string = '';
  protected tenantStreet: string = '';
  protected tenantCity: string = '';
  protected tenantStateOrProvince: string = '';
  protected tenantPostalCode: string = '';
  protected tenantCountry: string = '';
  protected tenantCountries: Country[] = [];
  private _tenantCountry: Country | null = null;
  protected filterTenantCountries!: Observable<Country[]>;

  // --- Emergency contact ---

  protected emergencyContactName: string = '';
  protected emergencyContactRelationship: string = '';
  protected isEmergencyContactValid: boolean = true;
  protected emergencyContactSpanMessage: string = '';
  protected emergencyContactContact: string = '';

  // --- Co-tenant info ---

  protected coTenantFullName: string = '';
  protected coTenantEmail: string = '';
  protected isCoTenantEmailValid: boolean = true;
  protected coTenantPhoneNumber: string = '';
  protected coTenantPhoneCodeDetails: CountryCodes | null = null;
  protected isValidCoTenantPhoneNumber: boolean = true;
  protected coTenantGender: string = '';
  protected coTenantNicOrPassport: string = '';
  protected coTenantAge: number = 0;
  protected coTenantRelationship: string = '';
  protected coTenantIdDocumentUrl: string = '';
  protected coTenantUploadedIdDocumentUrl: string = '';

  // --- Property info & table ---

  protected properties: BackEndPropertyData[] = [];
  private selectedProperty: BackEndPropertyData | null = null;

  protected propertyId: BackEndPropertyData[ 'id' ] = '';
  protected propertyTitle: BackEndPropertyData[ 'title' ] = '';
  protected location: BackEndPropertyData[ 'location' ] | undefined = undefined;

  protected propertylocaaationLat: number = 0;
  protected propertylocaaationLng: number = 0;
  protected propertyGeoLocation: string = ''; // embedded map URL

  protected propertyHouserNumber: Address[ 'houseNumber' ] = '';
  protected propertyStreet: Address[ 'street' ] = '';
  protected propertyCity: Address[ 'city' ] = '';
  protected propertyStateOrProvince: Address[ 'stateOrProvince' ] = '';
  protected propertyPostalCode: Address[ 'postcode' ] = '';
  protected propertyCountry: Address[ 'country' ] = '';
  protected propertyType: BackEndPropertyData[ 'listing' ] = '';
  protected propertyBuiltYear: BackEndPropertyData[ 'builtYear' ] = 0;
  protected furnishingStatus: BackEndPropertyData[ 'furnishingStatus' ] = '';
  protected includedAmenities: BackEndPropertyData[ 'featuresAndAmenities' ] = [];
  protected parkingSpots: BackEndPropertyData[ 'numberOfParking' ] = 0;
  protected propertyDeveloperName: BackEndPropertyData[ 'developerName' ] = '';
  protected propertyProjectName: BackEndPropertyData[ 'projectName' ] = '';
  protected isPropertySelected: boolean = false;

  // Custom table state
  private _propertyTableIsReloading: boolean = false;
  private _propertyTablePageSize: number = 5;
  private _propertyTablePageIndex: number = 0;
  protected propertyTableTotalCount: number = 0;
  protected propertyTableTitle: string = 'Properties Without Leases';
  private _propertyTabletSearchText: string = '';

  protected propertyTableButtonAction: TableButton[] = [
    { action: 'view', icon: 'visibility', label: 'View' },
    { action: 'add', icon: 'add_circle', label: 'Add' },
  ];

  protected propertyTableData: PropertyCustomTableDataType[] = [];
  protected propertyTableColumns: TableColumn[] = [
    { key: 'propertyimage', label: 'Image' },
    { key: 'type', label: 'Type' },
    { key: 'listing', label: 'Listing' },
    { key: 'furnishingStatus', label: 'Furnishing Status' },
    { key: 'developerName', label: 'Developer Name' },
    { key: 'projectName', label: 'Project Name' },
    { key: 'title', label: 'Title' },
    { key: 'builtYear', label: 'Built Year' },
    { key: 'address', label: 'Address' },
    { key: 'viewButton', label: 'View' },
    { key: 'addButton', label: 'Add' },
  ];

  protected isTableVisible: boolean = false;

  // --- Lease agreement core fields ---

  protected _startDate: LeaseAgreement[ 'startDate' ] = new Date();
  protected _endDate: LeaseAgreement[ 'endDate' ] = new Date();
  protected _durationMonths: LeaseAgreement[ 'durationMonths' ] = 0;
  protected monthlyRent: LeaseAgreement[ 'monthlyRent' ] = 0;

  // Currency
  protected currencyLeaseAgreement: string = '';
  private _currency: CurrencyFormat | null = null;
  protected currencies: CurrencyFormat[] = [];
  protected filterCurrencies$!: Observable<CurrencyFormat[]>;

  // Payment frequency
  protected paymentFrequencyLeaseAgreement: string = '';
  protected paymentFrequency: PaymentFrequency | null = null;
  protected readonly paymentFrequencies: PaymentFrequency[] = PAYMENT_FREQUENCIES;
  protected filterPaymentFrequencies$!: Observable<PaymentFrequency[]>;

  // Payment method
  protected paymentMethodLeaseAgreement: string = '';
  protected paymentMethod: PaymentMethod | null = null;
  protected readonly paymentMethods: PaymentMethod[] = PAYMENT_METHODS;
  protected filterPaymentMethods$!: Observable<PaymentMethod[]>;

  // Security deposit
  protected securityDepositLeaseAgreement: string = '';
  protected securityDeposit: SecurityDeposit | null = null;
  protected readonly securityDeposits: SecurityDeposit[] =
    BASE_SECURITY_DEPOSIT_OPTIONS;
  protected filterSecurityDeposits$!: Observable<SecurityDeposit[]>;

  // Rent due date
  protected rentDueDateLeaseAgreement: string = '';
  protected rentDueDate: RentDueDate | null = null;
  protected readonly rentDueDates: RentDueDate[] = RENT_DUE_DATE_OPTIONS;
  protected filterRentDueDates$!: Observable<RentDueDate[]>;

  // Late payment penalties
  protected latePaymentPenaltyLeaseAgreement: string = '';
  private _latePaymentPenalty: LatePaymentPenalty | null = null;
  protected selectedLatePaymentPenalties: LatePaymentPenalty[] = [];
  protected readonly latePaymentPenalties: LatePaymentPenalty[] =
    LATE_PAYMENT_PENALTY_OPTIONS;
  protected filterLatePaymentPenalties$!: Observable<LatePaymentPenalty[]>;
  protected latePaymentPenaltyLabelHint: string = '';

  // Utility responsibilities
  protected utilityResponsibilitiesLeaseAgreement: string = '';
  protected selectedUtilityResponsibilities: UtilityResponsibility[] = [];
  private _utilityResponsibility: UtilityResponsibility | null = null;
  protected readonly utilityResponsibilitiesOptions: UtilityResponsibility[] = [];
  protected filterUtilityResponsibilities$!: Observable<UtilityResponsibility[]>;

  // Notice period
  protected noticePeriodDaysLeaseAgreement: string = '';
  protected noticePeriodDays: NoticePeriod | null = null;
  protected readonly NoticePeriods: NoticePeriod[] = NOTICE_PERIOD_OPTIONS;
  protected filterNoticePeriodOptions$!: Observable<NoticePeriod[]>;

  // Today
  protected today: Date = new Date();

  // --- Rules & Regulations ---

  protected rulesAndRegulation: RulesAndRegulations[ 'rule' ] = '';
  protected rulesAndRegulationDescription: RulesAndRegulations[ 'description' ] =
    '';
  private _rulesAndRegulation: RulesAndRegulations | null = null;
  protected readonly rulesAndRegulationsOptions: RulesAndRegulations[] =
    DEFAULT_RULES_AND_REGULATIONS;
  protected filterRulesAndRegulations$!: Observable<RulesAndRegulations[]>;
  protected selectedRuleAndRegulations: RulesAndRegulations[] = [];
  protected isRuleAndRegulationEditable: boolean = false;

  // --- Company Policy ---

  protected readonly companyPolicy: string = DEFAULT_COMPANY_POLICY;
  protected isReadTheCompanyPolicy: boolean = false;

  // --- Signatures ---

  protected tenantSignature: Signatures[ 'tenantSignature' ] | null = null;
  protected tenantPreviewImageData: string = '';

  protected landlordSignature: Signatures[ 'landlordSignature' ] | null = null;
  protected landloadPreviewImageData: string = '';

  protected signedAt: Signatures[ 'signedAt' ] = this.today;
  private ipAddress: string = '';
  protected userAgent: AddedBy | null = null;

  // --- System metadata ---

  private ocrAutoFillStatus: SystemMetadata[ 'ocrAutoFillStatus' ] = false;
  private validationStatus: SystemMetadata[ 'validationStatus' ] = 'pending';
  private language: SystemMetadata[ 'language' ] = 'en';
  private leaseTemplateVersion: SystemMetadata[ 'leaseTemplateVersion' ] = '1.0.0';
  private lastUpdated: SystemMetadata[ 'lastUpdated' ] =
    this.today.toISOString();

  // ============================================================================
  // 4. Constructor & lifecycle
  // ============================================================================

  constructor (
    private windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private platformId: Object,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: APIsService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private authService: AuthService,
    private dialog: MatDialog,
    private scanService: ScanService,
    private cdr: ChangeDetectorRef,
    private propertyService: PropertyService,
    private tenantService: TenantService,
    private userControllerService: UserControllerService,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.loggedUser = this.authService.getLoggedUser;

    // Prepare userAgent metadata if logged in
    if ( this.loggedUser ) {
      this.userAgent = {
        name: this.loggedUser.name,
        email: this.loggedUser.email,
        addedAt: this.today.toISOString(),
        role: this.loggedUser.role,
        username: this.loggedUser.username,
      };
    }

    // Route URL subscription (kept in case you need it later)
    this.route.url.subscribe( () => {} );

    // Read leaseID from route and load data
    this.route.params.subscribe( async ( params ) => {
      this.leaseID = params[ 'leaseID' ];
      await this.loadData();
    } );
  }

  async ngOnInit(): Promise<void> {
    // Listen to theme mode if in browser
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }

    this.registerCustomIcons();
    await this.getAllCountries();
    await this.getCountryCodes();
    await this.makeCurrenciesList();

    await this.loadPropertiesWithoutLeases(
      this._propertyTablePageIndex,
      this._propertyTablePageSize,
      this._propertyTabletSearchText,
    );
  }

  async ngAfterViewInit(): Promise<void> {
    // Currently not doing anything after view init
    // Keep here in case you want to hook logic later
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ============================================================================
  // 5. Simple navigation & reload helpers
  // ============================================================================

  protected onReload(): void {
    const currentUrl = this.router.url;
    this.router
      .navigateByUrl( '/', { skipLocationChange: true } )
      .then( () => this.router.navigate( [ currentUrl ] ) );
  }

  protected goToTenants(): void {
    this.router
      .navigateByUrl( '/', { skipLocationChange: true } )
      .then( () => this.router.navigate( [ '/dashboard/tenant/tenant-home/' ] ) );
  }

  protected async goLease(): Promise<void> {
    if ( this.tenant ) {
      this.router.navigate( [ '/dashboard/tenant/tenant-lease', this.leaseID ] );
    }
  }

  protected async goToTenant(): Promise<void> {
    if ( this.tenant ) {
      const tenant = await this.apiService.generateToken( this.tenant.username );
      if ( tenant ) {
        this.router
          .navigateByUrl( '/', { skipLocationChange: true } )
          .then( () => {
            this.router.navigate( [
              '/dashboard/tenant/tenant-view/',
              tenant.token,
            ] );
          } );
      }
    }
  }

  // ============================================================================
  // 6. Permissions
  // ============================================================================

  private hasFullLeaseManagementPrivileges(): boolean {
    const requiredModule = 'Lease Management';
    const requiredActions: string[] = [
      'view leases',
      'create lease',
      'update lease',
      'terminate lease',
      'renew lease',
      'upload lease document',
      'track lease expiry',
    ];

    const permissions: ROLE_ACCESS_MAP[ 'permissions' ] =
      this.loggedUser?.access?.permissions ?? [];

    const leasePermissions = permissions.find(
      ( perm ) => perm.module.toLowerCase() === requiredModule.toLowerCase(),
    );

    if ( !leasePermissions ) {
      return false;
    }

    return requiredActions.every( ( action ) =>
      leasePermissions.actions.includes( action ),
    );
  }

  // ============================================================================
  // 7. Icons (registration & mapping)
  // ============================================================================

  private registerCustomIcons(): void {
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

  // Map file extension → icon name
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

  // ============================================================================
  // 8. Initial data loading (lease + tenant + property)
  // ============================================================================

  private async loadData(): Promise<void> {
    try {
      this.isLoading = true;

      // 1) Load lease
      const response = await this.tenantService.getLeaseAgreementByLeaseID(
        this.leaseID.trim(),
      );
      if ( response.status !== 'success' ) {
        throw new Error( 'Loading lease agreement failed!' );
      }
      this.lease = response.data as Lease;

      // 2) Load tenant
      const tenantUsername = this.lease.tenantInformation.tenantUsername;
      const tenantDataResponse =
        await this.tenantService.getTenantByUsername( tenantUsername.trim() );

      if ( tenantDataResponse.status !== 'success' ) {
        throw new Error( 'Loading tenant data failed!' );
      }
      this.tenant = tenantDataResponse.data as User;

      // --- Tenant basic info ---
      this.tenantFullName = this.lease.tenantInformation.fullName;
      this.tenantEmail = this.lease.tenantInformation.email;
      this.tenantNationality = this.lease.tenantInformation.nationality;
      this.tenantDateOfBirth = new Date(
        this.lease.tenantInformation.dateOfBirth,
      );
      this.tenantPhoneCodeDetails =
        this.lease.tenantInformation.phoneCodeDetails;
      this.tenantPhoneNumber = this.extractLocalPhone(
        this.lease.tenantInformation.phoneNumber,
        this.tenantPhoneCodeDetails.code,
      );


      this.tenantGender = this.lease.tenantInformation.gender;
      this.tenantNicOrPassport = this.lease.tenantInformation.nicOrPassport;

      // --- Tenant scanned documents (flattening mixed shapes into array) ---
      type ScannedDoc = ScannedFileRecordJSON;
      const raw = this.lease?.tenantInformation?.scannedDocuments ?? [];

      this.tenantUploadedScanedDocuments = raw.reduce<ScannedDoc[]>(
        ( acc, entry ) => {
          if ( Array.isArray( entry ) ) {
            acc.push( ...( entry as ScannedDoc[] ) );
          } else if ( entry ) {
            acc.push( entry as ScannedDoc );
          }
          return acc;
        },
        [],
      );

      this.tenantUploadedScanedDocuments.forEach( ( item ) => {
        item.files.forEach( ( doc ) => {
          const file = doc.file;
          const fileExtension =
            file.filename.split( '.' ).pop()?.toLowerCase() ?? '';
          const icon = this.chooceIcon( fileExtension );

          const data: FilePreViewType = {
            icon,
            name: file.filename,
            size: file.size,
            URL: file.URL,
            token: '',
            type: file.mimetype,
          };

          this.tenantScaannedDocumentPreview.push( data );
        } );
      } );

      this.tenantUsername = this.lease.tenantInformation.tenantUsername;

      // --- Tenant address ---
      this.tenantHouseNumber = this.tenant.address.houseNumber;
      this.tenantStreet = this.tenant.address.street;
      this.tenantCity = this.tenant.address.city;
      this.tenantStateOrProvince = this.tenant.address.stateOrProvince ?? '';
      this.tenantPostalCode = this.tenant.address.postcode;
      this.tenantCountry = this.tenant.address.country ?? '';
      if ( this.tenantCountry ) {
        this.onTenantCountryChange( this.tenantCountry );
      }

      // --- Emergency contact ---
      this.emergencyContactName =
        this.lease.tenantInformation.emergencyContact.name;
      this.emergencyContactRelationship =
        this.lease.tenantInformation.emergencyContact.relationship;
      this.emergencyContactContact =
        this.lease.tenantInformation.emergencyContact.contact;

      // --- Co-tenant info ---
      this.coTenantFullName = this.lease.coTenant?.fullName ?? '';
      this.coTenantEmail = this.lease.coTenant?.email ?? '';
      this.coTenantPhoneCodeDetails = this.lease.coTenant?.phoneCodeDetails ?? null;
      this.coTenantPhoneNumber = this.lease.coTenant?.phoneNumber
        ? this.extractLocalPhone(
          this.lease.coTenant.phoneNumber,
          this.coTenantPhoneCodeDetails?.code ?? '',
        )
        : '';
      this.coTenantGender = this.lease.coTenant?.gender ?? '';
      this.coTenantNicOrPassport = this.lease.coTenant?.nicOrPassport ?? '';
      this.coTenantAge = this.lease.coTenant?.age ?? 0;
      this.coTenantRelationship = this.lease.coTenant?.relationship ?? '';

      // --- Property info ---
      this.propertyId = this.lease.propertyID ?? '';
      await this.loadSelectedPropertyData( this.propertyId );

      // --- Lease agreement fields ---
      this.startDate = new Date( this.lease.leaseAgreement.startDate );
      this.endDate = new Date( this.lease.leaseAgreement.endDate );
      this.monthlyRent = this.lease.leaseAgreement.monthlyRent;

      // Currency
      this.currencyLeaseAgreement =
        this.lease.leaseAgreement.currency.currency;
      this._currency = this.lease.leaseAgreement.currency;

      // Payment frequency
      this.paymentFrequencyLeaseAgreement =
        this.lease.leaseAgreement.paymentFrequency.name;
      this.paymentFrequency = this.lease.leaseAgreement.paymentFrequency;

      // Payment method
      this.paymentMethodLeaseAgreement =
        this.lease.leaseAgreement.paymentMethod.name;
      this.paymentMethod = this.lease.leaseAgreement.paymentMethod;

      // Security deposit
      this.securityDepositLeaseAgreement =
        this.lease.leaseAgreement.securityDeposit.name;
      this.securityDeposit = this.lease.leaseAgreement.securityDeposit;

      // Rent due date
      this.rentDueDateLeaseAgreement =
        this.lease.leaseAgreement.rentDueDate.label;
      this.rentDueDate = this.lease.leaseAgreement.rentDueDate;

      // Late payment penalties
      const penalties = this.lease.leaseAgreement.latePaymentPenalties;
      if ( penalties && penalties.length > 0 ) {
        const lastPenalty = penalties[ penalties.length - 1 ];
        this.latePaymentPenaltyLeaseAgreement = lastPenalty.label;
        this._latePaymentPenalty = lastPenalty;
        this.selectedLatePaymentPenalties = penalties;
      }

      // Utility responsibilities
      const utilities = this.lease.leaseAgreement.utilityResponsibilities;
      if ( utilities && utilities.length > 0 ) {
        const lastUtility = utilities[ utilities.length - 1 ];
        this.utilityResponsibilitiesLeaseAgreement =
          this.makeCapitalize(
            `${ lastUtility.utility } - ${ lastUtility.paidBy }`,
          );
        this.selectedUtilityResponsibilities = utilities;
        this._utilityResponsibility = lastUtility;
      }

      // Notice period
      this.noticePeriodDaysLeaseAgreement =
        this.lease.leaseAgreement.noticePeriodDays.label;
      this.noticePeriodDays = this.lease.leaseAgreement.noticePeriodDays;

      // Rules & regulations
      if ( this.lease.rulesAndRegulations.length > 0 ) {
        const lastRule =
          this.lease.rulesAndRegulations[
          this.lease.rulesAndRegulations.length - 1
          ];
        this.rulesAndRegulation = lastRule.rule;
        this._rulesAndRegulation = lastRule;
        this.selectedRuleAndRegulations = this.lease.rulesAndRegulations;
      }

      // Company policy
      this.isReadTheCompanyPolicy = this.lease.isReadTheCompanyPolicy;

      // Signatures
      this.tenantSignature = this.lease.signatures.tenantSignature as FILE;
      this.tenantPreviewImageData = this.tenantSignature
        ? ( this.tenantSignature.URL as FILE[ 'URL' ] )
        : '';

      this.landlordSignature = this.lease.signatures.landlordSignature as FILE;
      this.landloadPreviewImageData = this.landlordSignature
        ? ( this.landlordSignature.URL as FILE[ 'URL' ] )
        : '';

      this.signedAt = new Date( this.lease.signatures.signedAt ?? '' );
      this.userAgent = this.lease.signatures.userAgent;

      // System metadata
      this.ocrAutoFillStatus = this.lease.systemMetadata.ocrAutoFillStatus;
      this.validationStatus = this.lease.systemMetadata.validationStatus;
      this.language = this.lease.systemMetadata.language;
      this.leaseTemplateVersion = this.calculateLatestVersion(
        this.lease.systemMetadata.leaseTemplateVersion,
      );
      this.lastUpdated = new Date().toISOString();
    } catch ( error ) {
      console.error( error );

      if ( error instanceof HttpErrorResponse ) {
        this.notification.notification(
          error.error.status,
          error.error.message,
        );
      } else if ( typeof error === 'string' ) {
        this.notification.notification( 'error', error );
      } else {
        // Optionally navigate away or show generic message
        // this.router.navigate(['/dashboard/tenant/tenant-home/']);
      }
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  // ============================================================================
  // 9. Country & phone code helpers
  // ============================================================================

  private async getAllCountries(): Promise<void> {
    try {
      const res = await this.apiService.getCountries();
      this.tenantCountries = res;
    } catch ( err ) {
      console.error( err );
    }
  }

  protected onTenantCountryChange( input: string | Country ): Country[] {
    let filterValue = '';

    if ( typeof input === 'string' ) {
      filterValue = input.toLowerCase().trim();
    } else if ( input && typeof input === 'object' && 'currency' in input ) {
      filterValue = ( input as Country ).name.toLowerCase();
    }

    if (
      filterValue &&
      this.tenantCountries &&
      Array.isArray( this.tenantCountries )
    ) {
      this.filterTenantCountries = of(
        this.tenantCountries.filter( ( option ) =>
          option.name.toLowerCase().includes( filterValue ),
        ),
      );

      this.filterTenantCountries.subscribe( ( countries: Country[] ) => {
        if ( countries.length === 1 ) {
          const country = countries[ 0 ];
          this.tenantCountry = country.name;
          this._tenantCountry = country;
        }
      } );
    }

    return this.tenantCountries;
  }

  protected onTenantCountrySelectionChange(
    input: MatAutocompleteSelectedEvent,
  ): void {
    const value = input.option.value as Country;
    this.tenantCountry = value.name;
    this._tenantCountry = value;
  }

  protected displayFn( country: Country ): string {
    return country?.name ?? '';
  }

  protected displayPhoneCode( country: CountryCodes ): string {
    return country?.code ?? '';
  }

  private async getCountryCodes(): Promise<void> {
    try {
      const res = await this.apiService.getCountryCodes();
      this.phoneCodes = res;
    } catch ( err ) {
      console.error( err );
      this.notification.notification(
        'error',
        'Failed to load country codes.',
      );
    }
  }

  protected onPhoneCodeChange( input: unknown, type: string ): void {
    try {
      // Validation
      if ( !type || typeof type !== 'string' ) {
        throw new Error( 'Invalid tenant type provided.' );
      }

      if ( !input ) {
        throw new Error( 'Invalid phone code provided.' );
      }

      // Reset filter
      this.filterPhoneCodes = of( this.phoneCodes );
      // Confirm type of tenant
      const typeOfCode = type.trim().toLowerCase();
      // Sanitising the input
      const safeInput = ( typeof input === 'string' && input.trim().toLowerCase() )
        || ( typeof input === 'object' && 'code' in input
          ? ( input as CountryCodes ).code.toLowerCase()
          : '' );
      // Filtering based on tenant type
      this.filterPhoneCodes = of(
        this.phoneCodes.filter( ( item ) =>
          item.code.toLowerCase().includes( safeInput ),
        ),
      );

      switch ( typeOfCode ) {
        case 'tenant':
          this.filterPhoneCodes.subscribe( ( codes: CountryCodes[] ) => {
            if ( codes.length === 1 ) {
              this.tenantPhoneCodeDetails = codes[ 0 ];
            } else {
              this.tenantPhoneCodeDetails = null;
            }
          } );
          break;
        case 'co-tenant':
          this.filterPhoneCodes.subscribe( ( codes: CountryCodes[] ) => {
            if ( codes.length === 1 ) {
              this.coTenantPhoneCodeDetails = codes[ 0 ];
            } else {
              this.coTenantPhoneCodeDetails = null;
            }
          } );
          break;
        default:
          throw new Error( 'Invalid phone code type provided.' );
      }
    }
    catch ( error ) {
      console.error( error );
    }
  }

  protected onPhoneCodeSelectionChange(
    input: MatAutocompleteSelectedEvent, type: string,
  ): void {
    const value = input.option.value as CountryCodes;
    switch ( type.trim().toLowerCase() ) {
      case 'tenant':
        this.tenantPhoneCodeDetails = value;
        break;
      case 'co-tenant':
        this.coTenantPhoneCodeDetails = value;
        break;
      default:
        break;
    }
  }


  // ============================================================================
  // 10. Email & phone validation
  // ============================================================================

  protected phoneNumberValid( phoneNumber: string ): boolean {
    return phoneNumber.trim().length > 0
      ? this.userControllerService.isPhoneNumberValid( phoneNumber )
      : true;
  }

  protected async onTenantEmailChange( email: string ): Promise<void> {
    await this.userControllerService
      .emailValidator( email )
      .then( ( res ) => {
        if ( res.status === 'success' ) {
          this.isTenantEmailValid = res.data.validation;
        } else {
          this.isTenantEmailValid = false;
        }
      } )
      .catch( ( error: HttpErrorResponse ) => {
        if ( error.status === 400 || error.status === 500 ) {
          this.isTenantEmailValid = false;
        }
      } );
  }

  protected async onCoTenantEmailChange( email: string ): Promise<void> {
    await this.userControllerService
      .emailValidator( email )
      .then( ( res ) => {
        if ( res.status === 'success' ) {
          this.isCoTenantEmailValid = res.data.validation;
        } else {
          this.isCoTenantEmailValid = false;
        }
      } )
      .catch( ( error: HttpErrorResponse ) => {
        if ( error.status === 400 || error.status === 500 ) {
          this.isCoTenantEmailValid = false;
        }
      } );
  }

  protected async emergencyContactChange( input: string ): Promise<void> {
    const value = input.trim();

    // First treat as email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isMatched = emailRegex.test( value );

    if ( isMatched ) {
      // Validate as email via backend
      await this.userControllerService
        .emailValidator( value )
        .then( ( res ) => {
          if ( res.status === 'success' ) {
            this.isEmergencyContactValid = res.data.validation;
            this.emergencyContactSpanMessage = res.data.message;
          } else {
            this.isEmergencyContactValid = false;
          }
        } )
        .catch( ( error: HttpErrorResponse ) => {
          if ( error.status >= 400 && error.status < 500 ) {
            this.isEmergencyContactValid = false;
            this.emergencyContactSpanMessage =
              error.error.message || 'Invalid email format.';
          } else if ( error.status === 500 ) {
            this.isEmergencyContactValid = false;
            this.emergencyContactSpanMessage =
              'Internal server error. Please try again later.';
          } else {
            this.isEmergencyContactValid = false;
            this.emergencyContactSpanMessage =
              'An unexpected error occurred.';
          }
        } );
    } else {
      // Then treat as phone
      const isPhoneValid = await this.phoneNumberValid( value );
      if ( isPhoneValid ) {
        this.isEmergencyContactValid = true;
        this.emergencyContactSpanMessage = 'Valid phone number.';
      } else {
        this.isEmergencyContactValid = false;
        this.emergencyContactSpanMessage = 'Invalid phone number.';
      }
    }

    this.cdr.detectChanges();
  }

  // ============================================================================
  // 11. Identification file upload: paste / drag-drop / file-select
  // ============================================================================

  @HostListener( 'document:paste', [ '$event' ] )
  protected identificationFileHandlePaste( event: ClipboardEvent ): void {
    const target = event.target as HTMLElement;

    // Allow default behaviour for text inputs and editable fields
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.hasAttribute( 'contenteditable' )
    ) {
      return;
    }

    // Handle custom paste for images, etc.
    event.preventDefault();

    const items = event.clipboardData?.items;
    if ( !items ) return;

    for ( const item of items ) {
      if ( item.kind === 'file' ) {
        const file = item.getAsFile();
        if ( file ) {
          this.processIdentificationFilePasted( file );
        }
      }
    }
  }

  protected processIdentificationFilePasted( file: File ): void {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add( file );

    const input = this.fileInput.nativeElement;
    input.files = dataTransfer.files;

    this.onIdentificationFileSelectionChange( { target: input } as any );
  }

  protected onIdentificationFileDragOver( event: DragEvent ): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  protected onIdentificationFileDragLeave( event: DragEvent ): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  protected onIdentificationFileDrop( event: DragEvent ): void {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if ( files && files.length > 0 ) {
      const file = files[ 0 ];
      if ( file.type.startsWith( 'image/' ) ) {
        this.processIdentificationFileDropped( file );
      }
    }
  }

  protected processIdentificationFileDropped( file: File ): void {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add( file );

    const input = this.fileInput.nativeElement;
    input.files = dataTransfer.files;

    this.onIdentificationFileSelectionChange( { target: input } as any );
  }

  protected preventDefault( event: Event ): void {
    event.preventDefault();
    event.stopPropagation();
  }

  protected triggerTenantIdentificationFileInput(): void {
    document.querySelector<HTMLInputElement>( '#fileInput' )?.click();
  }

  protected onIdentificationFileSelectionChange( event: any ): void {
    if ( event.target.files && event.target.files.length > 0 ) {
      const files = event.target.files as File[];
      this.tenantScanedDocuments.push( ...files );

      for ( const file of files ) {
        const fileExtension =
          file.name.split( '.' ).pop()?.toLowerCase() ?? '';
        const data: FilePreViewType = {
          icon: this.chooceIcon( fileExtension ),
          name: file.name,
          size: file.size,
          type: file.type,
          token: '',
        };
        this.tenantScaannedDocumentPreview.push( data );
      }
    } else {
      this.notification.notification( 'warning', 'No files selected.' );
    }
  }

  protected onIdentificationFileSelection(): void {
    switch ( this.identificationFileSelectionOption ) {
      case 'file-selection':
        this.triggerTenantIdentificationFileInput();
        break;
      case 'drag-and-drop':
        // UI already shows drop area; no action needed
        break;
      case 'file-scan':
        this.triggerScanner();
        break;
      default:
        return;
    }
  }

  protected async removeScannedDocument( document: any ): Promise<void> {
    try {
      // Searching in local new scans
      const file = this.tenantScanedDocuments.find(
        ( item ) => item.name === document.name,
      );

      // Searching in already uploaded ones
      const uploadedFile = this.tenantUploadedScanedDocuments.find(
        ( item ) => item.token === document.token,
      );

      if ( file ) {
        const index = this.tenantScanedDocuments.indexOf( file );
        this.tenantScanedDocuments.splice( index, 1 );
        this.tenantScaannedDocumentPreview.splice( index, 1 );
      } else if ( uploadedFile ) {
        const index =
          this.tenantUploadedScanedDocuments.indexOf( uploadedFile );
        this.tenantUploadedScanedDocuments.splice( index, 1 );
        this.tenantUploadedScanedDocumentsRemoved.push( uploadedFile );
      } else {
        throw new Error( 'File not found in the list.' );
      }

      this.cdr.detectChanges();
    } catch ( error ) {
      this.notification.notification( 'error', String( error ) );
    }
  }

  // ============================================================================
  // 12. Mobile / scanner integration
  // ============================================================================

  protected triggerScanner(): void {
    const fileScanner = this.dialog.open( FileScanner, {
      width: 'auto',
      height: 'auto',
      minWidth: '50vw',
      minHeight: '50vh',
      maxWidth: '100vw',
      maxHeight: '100vh',
      data: {
        tenantUsername: this.tenantUsername,
      },
    } );

    fileScanner.afterClosed().subscribe( async ( result ) => {
      if ( result ) {
        this.mobileFileUploadToken = result.token;
      }
      if ( this.mobileFileUploadToken ) {
        await this.getMobileUploadedFile();
      }
    } );
  }

  private async getMobileUploadedFile(): Promise<void> {
    try {
      this.isLoading = true;

      if ( !this.tenantUsername ) {
        throw new Error( 'Tenant username is missing' );
      }

      const res =
        await this.scanService.getReasonFileUploadsByTenantUsername(
          this.tenantUsername,
        );

      if ( res.status === 'success' ) {
        const data = res.data as ScannedFileRecordJSON[];
        this.tenantUploadedScanedDocuments = data;

        this.tenantUploadedScanedDocuments.forEach( ( item ) => {
          item.files.forEach( ( fileItem ) => {
            const extention =
              fileItem.file.originalname
                .split( '.' )
                .pop()
                ?.toLocaleLowerCase() ?? '';
            const icon = this.chooceIcon( extention );

            this.tenantScaannedDocumentPreview.push( {
              icon,
              name: fileItem.file.filename,
              size: fileItem.file.size,
              type: fileItem.file.mimetype,
              token: fileItem.token,
              URL: fileItem.file.URL,
            } );
          } );
        } );
      } else {
        throw new Error( res.message );
      }
    } catch ( error: any ) {
      console.error( error );

      const status = 'error';
      let message: string;

      if ( error instanceof Error ) {
        message = error.message;
      } else if (
        typeof error === 'object' &&
        error !== null &&
        'error' in error &&
        typeof ( error as any ).error === 'object' &&
        ( error as any ).error !== null &&
        'message' in ( error as any ).error
      ) {
        message = ( error as any ).error.message as string;
      } else {
        message = 'An unknown error occurred';
      }

      this.notification.notification( status, message );
    } finally {
      this.isLoading = false;
    }
  }

  protected viewScannedDocument( document: string ): void {
    if ( !document ) return;

    const fileViewer = this.dialog.open( FileViewer, {
      width: 'auto',
      height: 'auto',
      minWidth: '50vw',
      minHeight: '50vh',
      maxWidth: '100vw',
      maxHeight: '100vh',
      data: {
        document,
        token: this.mobileFileUploadToken,
      },
    } );

    fileViewer.afterClosed().subscribe( ( result ) => {

    } );
  }

  // ============================================================================
  // 13. Property table state & helpers
  // ============================================================================

  get propertyTableIsReloading(): boolean {
    return this._propertyTableIsReloading;
  }

  set propertyTableIsReloading( value: boolean ) {
    this._propertyTableIsReloading = value;
    if ( this._propertyTableIsReloading ) {
      this._propertyTabletSearchText = '';
      this.loadPropertiesWithoutLeases(
        this._propertyTablePageIndex,
        this._propertyTablePageSize,
        this._propertyTabletSearchText,
      );
    }
  }

  get propertyTablePageSize(): number {
    return this._propertyTablePageSize;
  }

  set propertyTablePageSize( value: number ) {
    this._propertyTablePageSize = value;
  }

  get propertyTablePageIndex(): number {
    return this._propertyTablePageIndex;
  }

  set propertyTablePageIndex( value: number ) {
    this._propertyTablePageIndex = value;
    this.loadPropertiesWithoutLeases(
      this._propertyTablePageIndex,
      this._propertyTablePageSize,
      this._propertyTabletSearchText,
    );
  }

  get propertyTabletSearchText(): string {
    return this._propertyTabletSearchText;
  }

  set propertyTabletSearchText( value: string ) {
    this._propertyTabletSearchText = value;
    this.loadPropertiesWithoutLeases(
      this._propertyTablePageIndex,
      this._propertyTablePageSize,
      this._propertyTabletSearchText,
    );
  }

  protected gotoTheProperty( propertyID: string ): void {
    if ( this.isBrowser ) {
      this.router.navigate( [
        '/dashboard/properties/property-view',
        propertyID,
      ] );
    }
  }

  protected makeCapitalize( text: string ): string {
    const data = text
      .split( ' ' )
      .map(
        ( word ) =>
          word.charAt( 0 ).toUpperCase() + word.slice( 1 ).toLowerCase(),
      );

    return data.join( ' ' );
  }

  protected makeIcon( icon: string ): string {
    return this.propertyService.investigateTheAmenityIcon( icon );
  }

  protected async handleButtonsOperations(
    value: TableButtonActionConfig,
  ): Promise<void> {
    try {
      if ( !value ) throw new Error( 'Invalid data!' );

      const propertyID =
        typeof value.data === 'string' ? value.data : value.data.id;
      const action = value.action;

      if ( !action || !propertyID ) {
        throw new Error( 'Invalid property ID or action!' );
      }

      switch ( action ) {
        case 'view':
          this.gotoTheProperty( propertyID );
          break;

        case 'add':
          try {
            const selectedProperty = this.properties.find(
              ( property: BackEndPropertyData ) =>
                property.id === propertyID,
            );

            if ( !selectedProperty ) {
              throw new Error( 'Could not found property!' );
            }

            this.registerProperty( selectedProperty );
          } catch ( error: any ) {
            if ( error instanceof HttpErrorResponse ) {
              this.notification.notification(
                'error',
                error.error.message,
              );
            } else if ( typeof error === 'string' ) {
              this.notification.notification( 'error', error );
            } else if ( error instanceof Error ) {
              this.notification.notification( 'error', error.message );
            } else {
              this.notification.notification(
                'error',
                'Unknown error occurred!',
              );
            }
          }
          break;
      }
    } catch ( err ) {
      console.error( err );
    }
  }

  private async loadSelectedPropertyData( id: string ): Promise<void> {
    try {
      const safeId = id.trim();
      if ( !safeId ) throw new Error( 'Invalide property ID' );

      const res = await this.propertyService.getPropertyById( safeId );
      if ( res.status !== 'success' ) {
        throw new Error( 'Failed to process property!' );
      }

      const property = res.data;
      if ( !property ) {
        throw new Error( 'Invalid property process!' );
      }

      this.selectedProperty = property;
      if ( this.selectedProperty ) {
        this.registerProperty( this.selectedProperty );
      }
    } catch ( err: any ) {
      console.error( err );

      if ( err instanceof Error ) {
        this.notification.notification( 'error', err.message );
      } else if ( err instanceof HttpErrorResponse ) {
        this.notification.notification( 'error', err.message );
      } else {
        this.notification.notification(
          'error',
          'Failed to process property!',
        );
      }
    }
  }

  protected async fetchPropertyTableData(): Promise<void> {
    await this.loadPropertiesWithoutLeases(
      this._propertyTablePageIndex,
      this._propertyTablePageSize,
      this._propertyTabletSearchText,
    );
  }

  private async loadPropertiesWithoutLeases(
    index: number,
    limit: number,
    search?: string,
  ): Promise<void> {
    try {
      this.propertyTableData = [];

      // NOTE: currently counting all properties. Ideally you should
      // call a "count properties without leases" endpoint.
      const res = await this.tenantService.getAllPropertiesCountWithoutLeases();

      if ( res.status !== 'success' ) {
        throw new Error( 'Failed in counting properties!' );
      }

      const total = res.data.total;

      if (
        Number.isNaN( total ) ||
        !Number.isFinite( total ) ||
        !Number.isFinite( total )
      ) {
        throw new Error( 'Invalid properties count!' );
      }

      this.propertyTableTotalCount = total;

      const safeIndex = PaginationUtil.safeIndex( index, total );
      const safeLimit = PaginationUtil.safeLimit( limit, total );
      const start = safeIndex * safeLimit;
      const safeSearch: string | undefined = search && search.trim().length > 0 ? search.trim() : undefined;

      const propertyRes =
        await this.tenantService.getAllPropertiesWithoutLeases(
          start,
          safeLimit,
          safeSearch,
        );

      if ( propertyRes.status !== 'success' ) {
        throw new Error( 'Failed in fetching properties!' );
      }

      const properties: BackEndPropertyData[] = propertyRes.data.properties;

      if ( !Array.isArray( properties ) || properties.length <= 0 ) {
        throw new Error( 'Invalid properties!' );
      }

      const forTableData: PropertyCustomTableDataType[] = [];

      properties.forEach( ( property: BackEndPropertyData ): void => {
        try {
          const data =
            this.makePropertyTableRow( property );
          if ( data ) {
            forTableData.push( data );
          } else {
            throw new Error( 'Table row data is invalid!' );
          }
        } catch ( err ) {
          console.warn( 'Failed in process property: ', err );
        }
      } );

      if ( !Array.isArray( properties ) || properties.length <= 0 ) {
        throw new Error( 'No properties found!' );
      }

      this.propertyTableData = [ ...forTableData ];
    } catch ( err ) {
      console.error( err );
    }
  }

  private makePropertyTableRow(
    data: BackEndPropertyData,
  ): PropertyCustomTableDataType | null {
    try {
      if ( !data ) throw new Error( 'Invalid property data!' );

      const organizedData: PropertyCustomTableDataType = {
        image: data.images[ 0 ].imageURL,
        id: data.id,
        type: data.type,
        listing: data.listing,
        furnishingStatus: data.furnishingStatus,
        developerName: data.developerName,
        title: data.title,
        builtYear: data.builtYear,
        projectName: data.projectName,
        address: `No.${ data.address.houseNumber },<br/>
        ${ data.address.street },<br/>
        ${ data.address.city },<br/>
        ${ data.address.stateOrProvince },<br/>
        ${ data.address.country },<br/>
        ${ data.address.postcode }`,
        viewButton: {
          action: 'view',
          icon: 'visibility',
          label: 'View',
        },
        addButton: {
          action: 'add',
          icon: 'add_circle',
          label: 'Add',
        },
      };

      return organizedData;
    } catch ( err ) {
      console.error( err );
      return null;
    }
  }

  private registerProperty( property: BackEndPropertyData ): void {
    try {
      if ( !property ) {
        this.resetProperty();
        throw new Error( 'Could not find the property!' );
      }

      // Assigning the property
      this.selectedProperty = property;

      // Reset selection (this is basically "selected & locked")
      this.isPropertySelected = false;

      // Identification
      this.propertyId = property.id;
      this.propertyTitle = this.makeCapitalize( property.title );

      // Location
      this.location = property.location;
      this.propertylocaaationLat = property.location?.lat ?? 0;
      this.propertylocaaationLng = property.location?.lng ?? 0;
      this.propertyGeoLocation = property.location?.embeddedUrl ?? '';

      // Address
      this.propertyHouserNumber = this.makeCapitalize(
        property.address.houseNumber,
      );
      this.propertyStreet = this.makeCapitalize(
        property.address.street as string,
      );
      this.propertyCity = this.makeCapitalize( property.address.city );
      this.propertyStateOrProvince = this.makeCapitalize(
        property.address.stateOrProvince as string,
      );
      this.propertyPostalCode = property.address.postcode;
      this.propertyCountry = this.makeCapitalize( property.address.country );

      // Classification / listing
      this.propertyType = this.makeCapitalize( property.listing );
      this.furnishingStatus = this.makeCapitalize(
        property.furnishingStatus,
      );

      // Developer / project
      this.propertyDeveloperName = this.makeCapitalize(
        property.developerName,
      );
      this.propertyProjectName = this.makeCapitalize(
        property.projectName as string,
      );
      this.propertyBuiltYear = property.builtYear;

      // Amenities
      property.featuresAndAmenities.forEach( ( item ) => {
        const amenity = this.makeCapitalize( item );
        this.includedAmenities.push( amenity );
      } );

      this.parkingSpots = property.numberOfParking;
      this.isPropertySelected = true;
    } catch ( error: any ) {
      console.error( error );

      if ( typeof error === 'string' ) {
        this.notification.notification( 'error', error );
      } else if ( error instanceof Error ) {
        this.notification.notification( 'error', error.message );
      }
    } finally {
      this.cdr.detectChanges();
    }
  }

  private resetProperty(): void {
    this.isPropertySelected = false;

    this.propertyId = '';
    this.propertyTitle = '';

    this.location = undefined;
    this.propertylocaaationLat = 0;
    this.propertylocaaationLng = 0;
    this.propertyGeoLocation = '';

    this.propertyHouserNumber = '';
    this.propertyStreet = '';
    this.propertyCity = '';
    this.propertyStateOrProvince = '';
    this.propertyPostalCode = '';
    this.propertyCountry = '';

    this.propertyType = '';
    this.furnishingStatus = '';

    this.propertyDeveloperName = '';
    this.propertyProjectName = '';
    this.propertyBuiltYear = 0;

    this.includedAmenities = [];
    this.parkingSpots = 0;
  }

  // ============================================================================
  // 14. Lease agreement: getters/setters for date logic
  // ============================================================================

  get startDate(): Date {
    return this._startDate;
  }

  set startDate( value: Date ) {
    this._startDate = value;
    this.handleStartDate();
  }

  get endDate(): Date {
    return this._endDate;
  }

  set endDate( value: Date ) {
    this._endDate = value;
    this.handleEndDate();
  }

  get durationMonths(): number {
    return this._durationMonths;
  }

  set durationMonths( value: number ) {
    this._durationMonths = value;
    this.handleDurationMonths();
  }

  private handleStartDate(): void {
    if ( this._durationMonths > 0 ) {
      const start = new Date( this._startDate );
      const newEnd = new Date( start );
      newEnd.setMonth( start.getMonth() + this._durationMonths );
      this._endDate = newEnd;
    } else if ( this._endDate ) {
      const start = new Date( this._startDate );
      const end = new Date( this._endDate );
      const months = this.calculateMonthDiff( start, end );
      this._durationMonths = months;
    }
  }

  private handleEndDate(): void {
    if ( this._startDate ) {
      const start = new Date( this._startDate );
      const end = new Date( this._endDate );
      const months = this.calculateMonthDiff( start, end );
      this._durationMonths = months;
    } else if ( this._durationMonths > 0 ) {
      const end = new Date( this._endDate );
      const newStart = new Date( end );
      newStart.setMonth( end.getMonth() - this._durationMonths );
      this._startDate = newStart;
    }
  }

  private handleDurationMonths(): void {
    if ( this._startDate ) {
      const start = new Date( this._startDate );
      const newEnd = new Date( start );
      newEnd.setMonth( start.getMonth() + this._durationMonths );
      this._endDate = newEnd;
    } else if ( this._endDate ) {
      const end = new Date( this._endDate );
      const newStart = new Date( end );
      newStart.setMonth( end.getMonth() - this._durationMonths );
      this._startDate = newStart;
    }
  }

  // ============================================================================
  // 15. Currency & payment controls
  // ============================================================================

  private async makeCurrenciesList(): Promise<void> {
    try {
      const responsData = await this.apiService.getCustomCountryDetails();
      const data: CurrencyFormat[] = [];

      responsData.forEach( ( item: any ) => {
        const country = item.name.common || item.name.official;

        if ( item.currencies && typeof item.currencies === 'object' ) {
          const currencyKeys = Object.keys( item.currencies );

          currencyKeys.forEach( ( key: string ) => {
            const currencyInfo = item.currencies[ key ];
            if ( !currencyInfo ) return;

            const organizedData: CurrencyFormat = {
              country,
              currency: key,
              symbol: currencyInfo.symbol,
              flags: item.flags,
            };

            const exists = data.some(
              ( d ) =>
                d.country === organizedData.country &&
                d.currency === organizedData.currency,
            );

            if ( !exists ) {
              data.push( organizedData );
            }
          } );
        }
      } );

      if ( Array.isArray( data ) && data.length > 0 ) {
        this.currencies = data;
        this.sortCurrency();
      } else {
        throw new Error( 'Currency data are invalid!' );
      }
    } catch ( error ) {
      console.error( error );
      this.notification.notification(
        'error',
        'An unexpected error occurred, please try again later.',
      );
    }
  }

  private sortCurrency(): CurrencyFormat[] {
    return this.currencies.sort( ( a, b ) => {
      if ( a.country < b.country ) return -1;
      if ( a.country > b.country ) return 1;
      return 0;
    } );
  }

  protected handleCurrencyFilterChange( input: string | CurrencyFormat ): void {
    let filterValue = '';

    if ( typeof input === 'string' ) {
      filterValue = input.toLowerCase().trim();
    } else if ( input && typeof input === 'object' && 'currency' in input ) {
      filterValue = ( input as CurrencyFormat ).currency.toLowerCase();
    }

    this.filterCurrencies$ = of( this.currencies ).pipe(
      map( ( items: CurrencyFormat[] ) =>
        items.filter(
          ( item ) =>
            item.country.toLowerCase().includes( filterValue ) ||
            item.currency.toLowerCase().includes( filterValue ),
        ),
      ),
    );

    this.filterCurrencies$.subscribe( ( currencies ) => {
      if ( currencies.length === 1 ) {
        this._currency = currencies[ 0 ];
      } else {
        this._currency = null;
      }
    } );
  }

  protected onCurrencySelectionChange(
    input: MatAutocompleteSelectedEvent,
  ): void {
    const value = input.option.value as CurrencyFormat;
    this.currencyLeaseAgreement = value.currency;
    this._currency = value;
  }

  protected displayCurrency( currency: CurrencyFormat ): string {
    return currency?.currency ?? '';
  }

  protected handlePaymentFrequencyFilterChange(
    input: string | PaymentFrequency,
  ): void {
    let filterValue = '';

    if ( typeof input === 'string' ) {
      filterValue = input.toLowerCase().trim();
    } else if ( input && typeof input === 'object' && 'name' in input ) {
      filterValue = ( input as PaymentFrequency ).name.toLowerCase();
    }

    this.filterPaymentFrequencies$ = of( this.paymentFrequencies ).pipe(
      map( ( items: PaymentFrequency[] ) =>
        items.filter(
          ( item ) =>
            item.name.toLowerCase().includes( filterValue ) ||
            ( item.unit &&
              item.unit.toLowerCase().includes( filterValue ) ),
        ),
      ),
    );

    this.filterPaymentFrequencies$.subscribe( ( paymentFrequencies ) => {
      if ( paymentFrequencies.length === 1 ) {
        this.paymentFrequency = paymentFrequencies[ 0 ];
      } else {
        this.paymentFrequency = null;
      }
    } );
  }

  protected onPaymentFrequencySelectionChange(
    input: MatAutocompleteSelectedEvent,
  ): void {
    const value = input.option.value as PaymentFrequency;
    this.paymentFrequencyLeaseAgreement = value.name;
    this.paymentFrequency = value;
  }

  protected displayPaymentFrequency(
    paymentFrequency: PaymentFrequency,
  ): string {
    return paymentFrequency?.name ?? '';
  }

  protected handlePaymentMethodFilterChange(
    input: string | PaymentMethod,
  ): void {
    let filterValue = '';

    if ( typeof input === 'string' ) {
      filterValue = input.toLowerCase().trim();
    } else if ( input && typeof input === 'object' && 'name' in input ) {
      filterValue = ( input as PaymentMethod ).name.toLowerCase();
    }

    this.filterPaymentMethods$ = of( this.paymentMethods ).pipe(
      map( ( items: PaymentMethod[] ) =>
        items.filter(
          ( item ) =>
            item.name.toLowerCase().includes( filterValue ) ||
            ( item.category &&
              item.category.toLowerCase().includes( filterValue ) ),
        ),
      ),
    );

    this.filterPaymentMethods$.subscribe( ( paymentMethods ) => {
      if ( paymentMethods.length === 1 ) {
        this.paymentMethodLeaseAgreement = paymentMethods[ 0 ].name;
        this.paymentMethod = paymentMethods[ 0 ];
      } else {
        this.paymentMethod = null;
      }
    } );
  }

  protected onPaymentMethodSelectionChange(
    input: MatAutocompleteSelectedEvent,
  ): void {
    const value = input.option.value as PaymentMethod;
    this.paymentMethodLeaseAgreement = value.name;
    this.paymentMethod = value;
  }

  protected displayPaymentMethod(
    paymentMethod: PaymentMethod,
  ): string {
    return paymentMethod?.name ?? '';
  }

  protected handleSecurityDepositFilterChange(
    input: string | SecurityDeposit,
  ): void {
    let filterValue = '';

    if ( typeof input === 'string' ) {
      filterValue = input.toLowerCase().trim();
    } else if ( input && typeof input === 'object' && 'type' in input ) {
      filterValue = ( input as SecurityDeposit ).name.toLowerCase();
    }

    this.filterSecurityDeposits$ = of( this.securityDeposits ).pipe(
      map( ( items: SecurityDeposit[] ) =>
        items.filter( ( item ) =>
          item.name.toLowerCase().includes( filterValue ),
        ),
      ),
    );

    this.filterSecurityDeposits$.subscribe( ( securityDeposits ) => {
      if ( securityDeposits.length === 1 ) {
        const selected = securityDeposits[ 0 ];
        const data: SecurityDeposit = {
          id: selected.id,
          name: selected.name,
          description: `${ selected.name } deposit (${ selected.refundable ? 'refundable' : 'non-refundable'
            }).`,
          refundable: selected.refundable,
          isEditable: false,
        };
        this.securityDepositLeaseAgreement = selected.name;
        this.securityDeposit = data;
      } else {
        this.securityDeposit = null;
      }
    } );
  }

  protected onSecurityDepositSelectionChange(
    input: MatAutocompleteSelectedEvent,
  ): void {
    const value = input.option.value as SecurityDeposit;
    this.securityDepositLeaseAgreement = value.name;

    const data: SecurityDeposit = {
      id: value.id,
      name: value.name,
      description: `${ value.name } deposit (${ value.refundable ? 'refundable' : 'non-refundable'
        }).`,
      refundable: value.refundable,
      isEditable: false,
    };

    this.securityDeposit = data;
  }

  protected displaySecurityDeposit(
    securityDeposit: SecurityDeposit,
  ): string {
    return securityDeposit?.name ?? '';
  }

  // ============================================================================
  // 16. Rent due date
  // ============================================================================

  protected handleRentDueDateFilterChange(
    input: string | RentDueDate,
  ): void {
    let filterValue = '';

    if ( typeof input === 'string' ) {
      filterValue = input.toLowerCase().trim();
    } else if ( input && typeof input === 'object' && 'label' in input ) {
      filterValue = ( input as RentDueDate ).label.toLowerCase();
    }

    this.filterRentDueDates$ = of( this.rentDueDates ).pipe(
      map( ( items: RentDueDate[] ) =>
        items.filter( ( item ) =>
          item.label.toLowerCase().includes( filterValue ),
        ),
      ),
    );

    this.filterRentDueDates$.subscribe( ( rentDueDates ) => {
      if ( rentDueDates.length === 1 ) {
        this.rentDueDate = rentDueDates[ 0 ];
      } else {
        this.rentDueDate = null;
      }
    } );
  }

  protected onRentDueDateSelectionChange(
    input: MatAutocompleteSelectedEvent,
  ): void {
    const value = input.option.value as RentDueDate;
    this.rentDueDateLeaseAgreement = value.label;
    this.rentDueDate = value;
  }

  protected displayRentDueDate(
    rentDueDate: RentDueDate,
  ): string {
    return rentDueDate?.label ?? '';
  }

  // ============================================================================
  // 17. Late payment penalties
  // ============================================================================

  protected handleLatePaymentPenaltyFilterChange( input: string ): void {
    try {
      const text = input.trim();

      if ( !this.isValidPenaltyFormat( text ) ) {
        throw new Error( 'Follow the format!' );
      }

      const label: LatePaymentPenalty[ 'label' ] = text;
      const type: LatePaymentPenalty[ 'type' ] = text
        .split( '-' )[ 0 ]
        .trim() as LatePaymentPenalty[ 'type' ];

      const afterType: string = text.split( '-' )[ 1 ].trim();

      if ( !this.containsNumber( afterType ) ) {
        throw new Error(
          'Add the number as percentage or fixed fee!',
        );
      }

      const numbers = this.extractAllNumbers( afterType );
      const value: LatePaymentPenalty[ 'value' ] = numbers[ 0 ];

      let description: LatePaymentPenalty[ 'description' ] = '';

      const contrastType = type.split( ' ' );

      switch ( contrastType[ 0 ].toLowerCase() ) {
        case 'fixed':
          description = `A fixed penalty of ${ value } will be charged for any late payment, regardless of the amount or duration.`;
          break;
        case 'percentage':
          description = `A penalty of ${ value }% will be applied to the overdue amount for late payments.`;
          break;
        case 'per-day':
          description = `A penalty of ${ value } will be charged for each day the payment is overdue.`;
          break;
        default:
          description = 'A penalty will be applied for late payments.';
      }

      const data: LatePaymentPenalty = {
        label,
        type,
        value,
        description,
        isEditable: false,
      };

      this.latePaymentPenaltyLeaseAgreement = data.label;
      this._latePaymentPenalty = data;
    } catch ( error ) {
      this.notification.notification( 'error', String( error ) );
    }
  }

  protected addULatePaymentPenalties(): void {
    try {
      if ( !this._latePaymentPenalty ) {
        throw new Error( 'Invalid late payment penalty!' );
      }

      if (
        this.checkLatePaymentPenaltiesExist(
          this.selectedLatePaymentPenalties,
          this._latePaymentPenalty,
        )
      ) {
        throw new Error( 'Penalty already exist!' );
      }

      this.selectedLatePaymentPenalties.push(
        this._latePaymentPenalty,
      );
      this._latePaymentPenalty = null;
      this.latePaymentPenaltyLeaseAgreement = '';
    } catch ( error ) {
      this.notification.notification( 'warning', String( error ) );
    }
  }

  protected removePaymentPenalty( index: number ): void {
    this.selectedLatePaymentPenalties.splice( index, 1 );
    this.notification.notification( 'info', 'Penalty removed!' );
  }

  private checkLatePaymentPenaltiesExist(
    array: LatePaymentPenalty[],
    data: LatePaymentPenalty,
  ): boolean {
    // FIXED: you must return the boolean from .some callback
    return array.some(
      ( item ) =>
        item.label.toLowerCase() === data.label.toLowerCase() ||
        item.type.toLowerCase() === data.type.toLowerCase(),
    );
  }

  private containsNumber( input: string ): boolean {
    return /\d/.test( input );
  }

  private extractAllNumbers( input: string ): number[] {
    const matches =
      input.match( /\d{1,3}(,\d{3})*(\.\d+)?|\d+(\.\d+)?/g );
    return matches
      ? matches.map( ( n ) => parseFloat( n.replace( /,/g, '' ) ) )
      : [];
  }

  private isValidPenaltyFormat( input: string ): boolean {
    const currencyPattern = '[A-Z]{3}';
    const amountPattern =
      '\\d{1,3}(,\\d{3})*(\\.\\d{1,2})?|\\d+(\\.\\d{1,2})?';

    const fixedFeeRegex = new RegExp(
      `^Fixed\\s+Fee\\s+-\\s+${ currencyPattern }\\s+(${ amountPattern })$`,
      'i',
    );

    const percentageRegex =
      /^Percentage\s+-\s+\d+(\.\d+)?%\s+of\s+Due\s+Amount$/i;

    const perDayRegex = new RegExp(
      `^Per\\s+Day\\s+-\\s+${ currencyPattern }\\s+(${ amountPattern })\\/day$`,
      'i',
    );

    const trimmedInput = input.trim();

    return (
      fixedFeeRegex.test( trimmedInput ) ||
      percentageRegex.test( trimmedInput ) ||
      perDayRegex.test( trimmedInput )
    );
  }

  protected displayHint(): string {
    const currency = this.getCurrency();
    return `Please type the penalty in one of the following formats:<br/>
    <ul class="hint m-0">
      <li>Fixed Fee - ${ currency } 1000</li>
      <li>Percentage - 5% of Due Amount</li>
      <li>Per Day - ${ currency } 200/day</li>
    </ul>`;
  }

  private getCurrency(): string {
    if ( typeof this.currencyLeaseAgreement === 'string' ) {
      return this.currencyLeaseAgreement;
    }

    if (
      this.currencyLeaseAgreement &&
      typeof this.currencyLeaseAgreement === 'object' &&
      'currency' in this.currencyLeaseAgreement &&
      typeof ( this.currencyLeaseAgreement as any ).currency === 'string'
    ) {
      return ( this.currencyLeaseAgreement as { currency: string; } ).currency;
    }

    return 'USD';
  }

  // ============================================================================
  // 18. Utility responsibilities
  // ============================================================================

  protected handleUtilityResponsibilitiesFilterChange(
    input: string,
  ): void {
    try {
      const text = input.trim();

      if ( !this.checkUtilityRegex( text ) ) {
        throw new Error(
          'Follow the format -> "Utility Name - Responsible Party"',
        );
      }

      const dataArray = text.split( '-' );
      const utility = dataArray[ 0 ].trim().toLowerCase();
      const responsibleParty = dataArray[ 1 ].trim().toLowerCase();

      const responsiblePartyArray: string[] = [
        'landlord',
        'tenant',
        'shared',
        'real estate company',
      ];

      if ( !utility ) {
        throw new Error( 'Invalid utility' );
      }

      if ( !responsiblePartyArray.includes( responsibleParty ) ) {
        throw new Error( 'Invalid responsible party' );
      }

      const id = `${ this.makeCapitalize(
        utility,
      ) }-${ this.makeCapitalize( responsibleParty ) }-${ new Date().toISOString() }`;

      const description = `${ this.makeCapitalize(
        utility,
      ) } has to pay by ${ this.makeCapitalize( responsibleParty ) }`;

      const paidByValue =
        responsibleParty.toLowerCase().trim() as UtilityResponsibility[ 'paidBy' ];

      const data: UtilityResponsibility = {
        id,
        utility: this.makeCapitalize( utility ),
        paidBy: paidByValue,
        description,
        isEditable: false,
      };

      if (
        !this.checkIsUtilityExist(
          this.selectedUtilityResponsibilities,
          data,
        )
      ) {
        this.utilityResponsibilitiesLeaseAgreement = text;
        this._utilityResponsibility = data;
      }
    } catch ( error ) {
      this.notification.notification( 'warning', String( error ) );
    }
  }

  protected addUtilities(): void {
    try {
      if ( !this._utilityResponsibility ) {
        throw new Error( 'Invalid utility!' );
      }

      this.selectedUtilityResponsibilities.push(
        this._utilityResponsibility,
      );
      this.utilityResponsibilitiesLeaseAgreement = '';
      this._utilityResponsibility = null;
    } catch ( error ) {
      this.notification.notification( 'warning', String( error ) );
    }
  }

  protected removeUtility( index: number ): void {
    this.selectedUtilityResponsibilities.splice( index, 1 );
    this.notification.notification( 'info', 'Utility removed!' );
  }

  private checkIsUtilityExist(
    utilities: UtilityResponsibility[],
    utility: UtilityResponsibility,
  ): boolean {
    return utilities.some(
      ( item ) =>
        item.utility.toLowerCase() ===
        utility.utility.toLowerCase() &&
        item.paidBy.toLowerCase() === utility.paidBy.toLowerCase(),
    );
  }

  private checkUtilityRegex( text: string ): boolean {
    const utilityRegex = /^[A-Za-z\s]+-\s*[A-Za-z\s]+$/;
    return utilityRegex.test( text );
  }

  protected hintUtilityResponsibilities(): string {
    return `Type in this format <i class="fa-solid fa-arrow-right"></i> "Utility Name - Responsible Party"`;
  }

  // ============================================================================
  // 19. Notice period options
  // ============================================================================

  protected handleNoticePeriodDaysFilterChange(
    input: string | NoticePeriod,
  ): void {
    let filterValue = '';

    if ( typeof input === 'string' ) {
      filterValue = input.toLowerCase().trim();
    } else if ( input && typeof input === 'object' && 'label' in input ) {
      filterValue = ( input as NoticePeriod ).label.toLowerCase();
    }

    this.filterNoticePeriodOptions$ = of( this.NoticePeriods ).pipe(
      map( ( NoticePeriods ) =>
        NoticePeriods.filter( ( option ) =>
          option.label.toLowerCase().includes( filterValue ),
        ),
      ),
    );

    this.filterNoticePeriodOptions$.subscribe(
      ( noticePeriodOptions ) => {
        if ( noticePeriodOptions.length === 1 ) {
          this.noticePeriodDays = noticePeriodOptions[ 0 ];
          this.noticePeriodDaysLeaseAgreement =
            noticePeriodOptions[ 0 ].label;
        } else {
          this.noticePeriodDays = null;
        }
      },
    );
  }

  protected onNotificationPeriodDaysSelectionChange(
    input: MatAutocompleteSelectedEvent,
  ): void {
    if ( input.option.value ) {
      const data = input.option.value as NoticePeriod;
      this.noticePeriodDaysLeaseAgreement = data.label;
      this.noticePeriodDays = data;
    }
  }

  protected displayNotificationPeriodDays(
    input: NoticePeriod,
  ): string {
    return input?.label ?? '';
  }

  // ============================================================================
  // 20. Rules & regulations
  // ============================================================================

  protected handleRulesAndRegulationsFilterChange(
    input: string | RulesAndRegulations,
  ): void {
    let filterValue = '';

    if ( typeof input === 'string' ) {
      filterValue = input.toLowerCase().trim();
    } else if ( input && typeof input === 'object' && 'rule' in input ) {
      filterValue = ( input as RulesAndRegulations ).rule.toLowerCase();
    }

    this.filterRulesAndRegulations$ = of(
      this.rulesAndRegulationsOptions,
    ).pipe(
      map( ( ruleAndRegulation ) =>
        ruleAndRegulation.filter( ( option ) =>
          option.rule.toLowerCase().includes( filterValue ),
        ),
      ),
    );

    this.filterRulesAndRegulations$.subscribe(
      ( filtered: RulesAndRegulations[] ) => {
        if ( filtered.length === 1 ) {
          this._rulesAndRegulation = filtered[ 0 ];
          this._rulesAndRegulation.isEditable = false;
        } else if ( filterValue.length > 0 ) {
          this.notification.notification(
            'info',
            'No existing match found. A new rule will be created when added.',
          );
          const capitalizedRule = this.makeCapitalize( filterValue );
          const newRule: RulesAndRegulations = {
            rule: capitalizedRule,
            description:
              'Custom rule. Click edit to modify the description.',
            isEditable: false,
          };
          this._rulesAndRegulation = newRule;
        } else {
          this._rulesAndRegulation = null;
        }
      },
    );
  }

  protected handleRulesAndRegulationsAdd(): void {
    try {
      if ( !this._rulesAndRegulation ) {
        throw new Error( 'Invalid rules and regulations!' );
      }

      const isInTheArray = this.selectedRuleAndRegulations.some(
        ( item ) =>
          item.rule.toLowerCase() ===
          this._rulesAndRegulation!.rule.toLowerCase(),
      );

      if ( !isInTheArray ) {
        this.selectedRuleAndRegulations.push( this._rulesAndRegulation );
        this._rulesAndRegulation = null;
        this.rulesAndRegulation = '';
        this.filterRulesAndRegulations$ = of( [] );
      } else {
        this.notification.notification(
          'warning',
          'Rule already exists in the list',
        );
      }
    } catch ( error ) {
      this.notification.notification(
        'error',
        error instanceof Error ? error.message : String( error ),
      );
    }
  }

  protected onRulesAndRegulationsSelectionChange(
    input: MatAutocompleteSelectedEvent,
  ): void {
    const data = input.option.value as RulesAndRegulations;
    this.rulesAndRegulation = data.rule;
    this._rulesAndRegulation = data;
  }

  protected displayRulesAndRegulations(
    input: RulesAndRegulations,
  ): string {
    return input?.rule ?? '';
  }

  protected handleRulesAndRegulationsRemove( index: number ): void {
    this.selectedRuleAndRegulations.splice( index, 1 );
    this.notification.notification(
      'info',
      'Rule And Regulation removed!',
    );
  }

  // ============================================================================
  // 21. Signatures (tenant & landlord)
  // ============================================================================

  protected handleAddTenantSignature(): void {
    this.tenantSignature = null;
    this.tenantPreviewImageData = '';

    const tenantSignature = this.dialog.open( SignSignature, {
      width: 'auto',
      height: 'auto',
      minWidth: '50vw',
      minHeight: '50vh',
      maxWidth: '100vw',
      maxHeight: '100vh',
      data: {
        signature: this.tenantSignature,
        type: 'Tenant',
      },
    } );

    tenantSignature.afterClosed().subscribe( ( result ) => {
      if ( result ) {
        this.tenantSignature = result;
        this.makeImagePreview( result ).then( ( dataUri ) => {
          this.tenantPreviewImageData = dataUri;
        } );
      } else {
        this.notification.notification(
          'warning',
          'Tenant signature is required!',
        );
      }
    } );
  }

  protected handleAddLandlordSignature(): void {
    this.landlordSignature = null;
    this.landloadPreviewImageData = '';

    const landloadSignature = this.dialog.open( SignSignature, {
      width: 'auto',
      height: 'auto',
      minWidth: '50vw',
      minHeight: '50vh',
      maxWidth: '100vw',
      maxHeight: '100vh',
      data: {
        signature: this.landlordSignature,
        type: 'Landload',
      },
    } );

    landloadSignature.afterClosed().subscribe( ( result ) => {
      if ( result ) {
        this.landlordSignature = result;
        this.makeImagePreview( result ).then( ( dataUri ) => {
          this.landloadPreviewImageData = dataUri;
        } );
      } else {
        this.notification.notification(
          'warning',
          'Landload signature is required!',
        );
      }
    } );
  }

  private makeImagePreview( input: File ): Promise<string> {
    return new Promise( ( resolve, reject ) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve( reader.result as string );
      };

      reader.onerror = ( error ) => {
        reject( error );
      };

      reader.readAsDataURL( input );
    } );
  }

  // ============================================================================
  // 22. Utility helpers
  // ============================================================================

  private calculateMonthDiff( start: Date, end: Date ): number {
    return (
      ( end.getFullYear() - start.getFullYear() ) * 12 +
      ( end.getMonth() - start.getMonth() )
    );
  }

  protected disablePastDates( date: Date | null ): boolean {
    if ( date === null ) return false;
    const today = new Date();
    return date < today;
  }

  private calculateLatestVersion( input: string ): string {
    if ( typeof input !== 'string' ) return '';

    const regex = /^\d+\.\d+\.\d+$/;
    if ( !regex.test( input.trim() ) ) return '';

    const numberArray = input.trim().split( '.' );

    const lastIndex = numberArray.length - 1;
    const lastNumber = parseInt( numberArray[ lastIndex ], 10 );

    numberArray[ lastIndex ] = ( lastNumber + 1 ).toString();

    return numberArray.join( '.' );
  }

  private isBrowserFile( file: unknown ): file is File {
    return typeof File !== 'undefined' && file instanceof File;
  }

  private extractLocalPhone( fullNumber: string, code: string ): string {
    if ( !fullNumber || !code ) {
      return fullNumber?.trim() ?? '';
    }

    const normalized = fullNumber.replace( /\s+/g, '' );
    const normalizedCode = code.replace( /\s+/g, '' );

    if ( !normalized.startsWith( normalizedCode ) ) {
      return fullNumber.trim();
    }

    return normalized.slice( normalizedCode.length );
  }

  // ============================================================================
  // 23. Final submit: update lease agreement
  // ============================================================================

  protected async submitLeaseAgreement(): Promise<void> {
    try {
      const scannedDocuments = [
        ...this.tenantScanedDocuments,
        ...this.tenantUploadedScanedDocuments,
      ];

      // --- Basic checks ---
      if ( !this.leaseID ) {
        throw new Error( 'Lease ID is required!' );
      }

      if ( !this.hasFullLeaseManagementPrivileges() ) {
        throw new Error(
          "You don't have full lease management privileges!",
        );
      }

      // --- Tenant information validations ---
      if ( !this.tenantFullName ) {
        throw new Error( 'Tenant fullname is required!' );
      }

      if ( !this.tenantEmail ) {
        throw new Error( 'Tenant email is required!' );
      }

      if ( !this.isTenantEmailValid ) {
        throw new Error( 'Invalid tenant email!' );
      }

      if ( !this.tenantPhoneCodeDetails ) {
        throw new Error( 'Tenant phone code is required!' );
      }

      if ( !this.tenantPhoneNumber ) {
        throw new Error( 'Tenant phone number is required!' );
      }

      if ( !this.tenantGender ) {
        throw new Error( 'Tenant gender is required!' );
      }

      if ( !this.tenantNationality ) {
        throw new Error( 'Tenant nationality is required!' );
      }

      if ( scannedDocuments.length === 0 ) {
        throw new Error( 'Tenant scanned documents is required!' );
      }

      if ( !this.tenantNicOrPassport ) {
        throw new Error( 'Tenant NIC or passport is required!' );
      }

      // --- Tenant address validations ---
      if ( !this.tenantHouseNumber ) {
        throw new Error( 'Tenant address house number is required!' );
      }

      if ( !this.tenantStreet ) {
        throw new Error( 'Tenant address street is required!' );
      }

      if ( !this.tenantCity ) {
        throw new Error( 'Tenant address city is required!' );
      }

      if ( !this.tenantStateOrProvince ) {
        throw new Error( 'Tenant address state or privince is required!' );
      }

      if ( !this._tenantCountry ) {
        throw new Error( 'Tenant address country is required!' );
      }

      if ( !this.tenantPostalCode ) {
        throw new Error( 'Tenant address postcode is required!' );
      }

      // --- Emergency contact validations ---
      if ( !this.emergencyContactName ) {
        throw new Error(
          'Emergency contact person name is required!',
        );
      }

      if ( !this.emergencyContactRelationship ) {
        throw new Error(
          'Emergency contact person relationship is required!',
        );
      }

      if ( !this.emergencyContactContact ) {
        throw new Error( 'Emergency contact is required!' );
      }

      if ( !this.isEmergencyContactValid ) {
        throw new Error(
          'Provide valid contact email or phone number!',
        );
      }

      // --- Property validations ---
      if ( !this.selectedProperty ) {
        throw new Error(
          'Property is required, please select a property!',
        );
      }

      if ( !this.propertyId ) {
        throw new Error(
          'Property ID is required, please select a property!',
        );
      }

      if ( !this.propertyTitle ) {
        throw new Error(
          'Property title is required, please select a property!',
        );
      }

      if ( !this.propertyType ) {
        throw new Error(
          'Property type is required, please select a property!',
        );
      }

      if ( !this.furnishingStatus ) {
        throw new Error(
          'Property furnishing status is required, please select a property!',
        );
      }

      if ( !this.propertyBuiltYear ) {
        throw new Error(
          'Property build year is required, please select a property!',
        );
      }

      if ( !this.propertyGeoLocation ) {
        throw new Error(
          'Property location is required, please select a property!',
        );
      }

      if ( !this.includedAmenities || this.includedAmenities.length === 0 ) {
        throw new Error(
          'Property amenities is required, please select a property!',
        );
      }

      // --- Lease agreement validations ---
      if ( !this.startDate ) {
        throw new Error( 'Lease starting date is required!' );
      }

      if ( !this.endDate ) {
        throw new Error( 'Lease ending date is required!' );
      }

      if ( !this.durationMonths ) {
        throw new Error( 'Lease duration in months is required!' );
      }

      if ( !this.monthlyRent ) {
        throw new Error( 'Lease monthly rent is required!' );
      }

      if ( !this.currencyLeaseAgreement || !this._currency ) {
        throw new Error( 'Lease currency is required!' );
      }

      if ( !this.paymentFrequencyLeaseAgreement ) {
        throw new Error(
          'Lease payment frequency is required!',
        );
      }

      if ( !this.paymentMethodLeaseAgreement ) {
        throw new Error(
          'Lease payment method is required!',
        );
      }

      if ( !this.securityDepositLeaseAgreement ) {
        throw new Error( 'Lease security deposit is required!' );
      }

      if ( !this.rentDueDateLeaseAgreement ) {
        throw new Error( 'Lease rent due date is required!' );
      }

      if ( this.selectedLatePaymentPenalties.length === 0 ) {
        throw new Error(
          'Lease late payment penalties are required!',
        );
      }

      if ( this.selectedUtilityResponsibilities.length === 0 ) {
        throw new Error(
          'Lease utility responsibilities are required!',
        );
      }

      if ( !this.noticePeriodDaysLeaseAgreement ) {
        throw new Error(
          'Lease notice period days are required!',
        );
      }

      // --- Rules & regulations ---
      if ( this.selectedRuleAndRegulations.length === 0 ) {
        throw new Error( 'Lease rule and regulations are required!' );
      }

      // --- Company policy ---
      if ( !this.isReadTheCompanyPolicy ) {
        throw new Error(
          'Please read the company policy and confirm!',
        );
      }

      // --- Signatures ---
      if ( !this.tenantSignature ) {
        throw new Error( 'Tenant signature is required!' );
      }

      if ( !this.landlordSignature ) {
        throw new Error( 'Landlord signature is required!' );
      }

      // ==========================================================
      // Build FormData payload
      // ==========================================================

      const formData: FormData = new FormData();

      // Tenant address object
      const tenantAddress = {
        houseNumber: this.tenantHouseNumber,
        street: this.tenantStreet,
        city: this.tenantCity,
        stateOrProvince: this.tenantStateOrProvince,
        country: this._tenantCountry,
        postalCode: this.tenantPostalCode,
      };

      // Emergency contact object
      const emergencyContact = {
        name: this.emergencyContactName,
        relationship: this.emergencyContactRelationship,
        contact: this.emergencyContactContact,
      };

      // System metadata object
      const systemMetaData = {
        ocrAutoFillStatus: this.ocrAutoFillStatus,
        validationStatus: this.validationStatus,
        language: this.language,
        leaseTemplateVersion: this.leaseTemplateVersion,
        lastUpdated: this.lastUpdated,
      };

      // Progress start
      this.progress.start();

      // --- Lease ID ---
      formData.append( 'leaseID', this.leaseID );

      // --- Tenant Information ---
      formData.append(
        'tenantUsername',
        this.tenant?.username.trim() ?? '',
      );
      formData.append( 'tenantFullName', this.tenantFullName.trim() );
      formData.append( 'tenantEmail', this.tenantEmail.trim() );
      formData.append(
        'tenantNationality',
        this.tenantNationality.trim(),
      );

      formData.append(
        'tenantDateOfBirth',
        this.tenantDateOfBirth.toISOString().trim(),
      );

      formData.append(
        'tenantPhoneCodeDetails',
        JSON.stringify( this.tenantPhoneCodeDetails ),
      );
      formData.append(
        'tenantPhoneNumber',
        this.tenantPhoneNumber.trim(),
      );
      formData.append( 'tenantGender', this.tenantGender.trim() );
      formData.append(
        'tenantNICOrPassport',
        this.tenantNicOrPassport.trim(),
      );

      // Tenant scanned documents
      if ( this.tenantScanedDocuments.length > 0 ) {
        this.tenantScanedDocuments.forEach( ( item ) => {
          formData.append( 'tenantScanedDocuments', item );
        } );
      }

      formData.append(
        'tenantUploadedScanedDocuments',
        JSON.stringify( this.tenantUploadedScanedDocuments ),
      );

      formData.append(
        'tenantUploadedScanedDocumentsRemoved',
        JSON.stringify( this.tenantUploadedScanedDocumentsRemoved ),
      );

      // Address
      formData.append(
        'tenantAddress',
        JSON.stringify( tenantAddress ),
      );

      // Emergency contact
      formData.append(
        'emergencyContact',
        JSON.stringify( emergencyContact ),
      );

      // Co-tenant
      formData.append( 'coTenantFullname', this.coTenantFullName.trim() );
      formData.append( 'coTenantEmail', this.coTenantEmail.trim() );
      formData.append( 'coTenantPhoneCodeDetails', JSON.stringify( this.coTenantPhoneCodeDetails ) );
      formData.append(
        'coTenantPhoneNumber',
        this.coTenantPhoneNumber.trim(),
      );
      formData.append( 'coTenantGender', this.coTenantGender.trim() );
      formData.append(
        'coTenantNicOrPassport',
        this.coTenantNicOrPassport.trim(),
      );
      formData.append( 'coTenantAge', String( this.coTenantAge ).trim() );
      formData.append(
        'coTenantRelationship',
        this.coTenantRelationship.trim(),
      );

      // Property info
      formData.append(
        'selectedProperty',
        JSON.stringify( this.selectedProperty ),
      );

      // Lease agreement info
      formData.append(
        'startDate',
        this.startDate.toISOString().trim(),
      );
      formData.append( 'endDate', this.endDate.toISOString().trim() );
      formData.append(
        'durationMonths',
        String( this.durationMonths ).trim(),
      );
      formData.append( 'monthlyRent', String( this.monthlyRent ).trim() );
      formData.append( 'currency', JSON.stringify( this._currency ) );
      formData.append(
        'paymentFrequency',
        JSON.stringify( this.paymentFrequency ),
      );
      formData.append(
        'paymentMethod',
        JSON.stringify( this.paymentMethod ),
      );
      formData.append(
        'securityDeposit',
        JSON.stringify( this.securityDeposit ),
      );
      formData.append( 'rentDueDate', JSON.stringify( this.rentDueDate ) );
      formData.append(
        'selectedLatePaymentPenalties',
        JSON.stringify( this.selectedLatePaymentPenalties ),
      );
      formData.append(
        'selectedUtilityResponsibilities',
        JSON.stringify( this.selectedUtilityResponsibilities ),
      );
      formData.append(
        'noticePeriodDays',
        JSON.stringify( this.noticePeriodDays ),
      );

      // Rules & regulations
      formData.append(
        'selectedRuleAndRegulations',
        JSON.stringify( this.selectedRuleAndRegulations ),
      );

      // Company policy confirmation
      formData.append(
        'isReadTheCompanyPolicy',
        String( this.isReadTheCompanyPolicy ),
      );

      // Signatures
      if ( this.isBrowserFile( this.tenantSignature ) ) {
        formData.append( 'tenantSignature', this.tenantSignature );
      } else {
        formData.append(
          'tenantOldSignature',
          JSON.stringify( this.tenantSignature ),
        );
      }

      if ( this.isBrowserFile( this.landlordSignature ) ) {
        formData.append( 'landlordSignature', this.landlordSignature );
      } else {
        formData.append(
          'landlordOldSignature',
          JSON.stringify( this.landlordSignature ),
        );
      }

      // Sign meta
      formData.append( 'signedAt', this.signedAt.toISOString().trim() );
      formData.append( 'ipAddress', this.ipAddress.trim() );
      formData.append( 'userAgent', JSON.stringify( this.userAgent ) );

      // System metadata
      formData.append( 'systemMetaData', JSON.stringify( systemMetaData ) );

      // Call backend API
      await this.tenantService
        .updateLeaseAgreement( formData, this.leaseID )
        .then( ( res ) => {
          this.notification.notification( res.status, res.message );

          setTimeout( () => {
            this.goToTenant();
          }, 1000 );
        } )
        .catch( ( error: HttpErrorResponse ) => {
          console.error( error );

          if ( error.status >= 400 && error.status < 500 ) {
            this.notification.notification(
              'error',
              'Failed to submit lease agreement. Please check your input and try again.',
            );
          } else if ( error.status === 404 ) {
            this.notification.notification(
              'error',
              'Lease agreement not found, please try again later.',
            );
          } else if ( error.status === 500 ) {
            this.notification.notification(
              'error',
              'Internal server error, please try again later.',
            );
          } else {
            this.notification.notification(
              'error',
              'An unexpected error occurred, please try again later.',
            );
          }
        } )
        .finally( () => {
          this.progress.complete();
        } );
    } catch ( error: any ) {
      console.error( error );

      const status = 'error';
      let message: string;

      if ( error instanceof Error ) {
        message = error.message;
      } else if (
        typeof error === 'object' &&
        error !== null &&
        'error' in error &&
        typeof ( error as any ).error === 'object' &&
        ( error as any ).error !== null &&
        'message' in ( error as any ).error
      ) {
        message = ( error as any ).error.message as string;
      } else {
        message = 'An unknown error occurred';
      }

      this.notification.notification( status, message );
    }
  }
}
