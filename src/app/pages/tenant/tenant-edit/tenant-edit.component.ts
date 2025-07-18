import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
  HostListener,
  ChangeDetectorRef,
} from '@angular/core';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {of, Subscription} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {
  APIsService,
  BaseUser,
  Country,
  CountryCodes, ROLE_ACCESS_MAP
} from '../../../services/APIs/apis.service';
import {SkeletonLoaderComponent} from '../../../components/shared/skeleton-loader/skeleton-loader.component';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatButtonModule} from '@angular/material/button';
import {MatExpansionModule} from '@angular/material/expansion';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {
  MatMomentDateModule
} from '@angular/material-moment-adapter';
import {MatSelectModule} from '@angular/material/select';
import {MatDividerModule} from '@angular/material/divider';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatTooltipModule} from '@angular/material/tooltip';
import {
  AuthService,
  LoggedUserType,
} from '../../../services/auth/auth.service';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {DomSanitizer} from '@angular/platform-browser';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {
  NotificationComponent,
  NotificationType,
} from '../../../components/dialogs/notification/notification.component';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {ProgressBarComponent} from '../../../components/dialogs/progress-bar/progress-bar.component';
import {ImageCropperComponent} from 'ngx-image-cropper';
import {CryptoService} from '../../../services/cryptoService/crypto.service';
import {CameraBoxComponent} from '../../../components/dialogs/camera-box/camera-box.component';
import {EditorComponent} from '@tinymce/tinymce-angular';
import {FormBuilder} from '@angular/forms';
import {FileScanner} from '../../../components/dialogs/file-scanner/file-scanner';
import {ScanService} from '../../../services/scan/scan.service';
import {TokenService} from '../../../services/token/token.service';
import {FileViewer} from '../../../components/dialogs/file-viewer/file-viewer';
import {
  BASE_SECURITY_DEPOSIT_OPTIONS, DEFAULT_COMPANY_POLICY,
  DEFAULT_RULES_AND_REGULATIONS,
  LATE_PAYMENT_PENALTY_OPTIONS,
  LatePaymentPenalty,
  LeaseAgreement,
  NOTICE_PERIOD_OPTIONS,
  NoticePeriod,
  PAYMENT_FREQUENCIES,
  PAYMENT_METHODS,
  PaymentFrequency,
  PaymentMethod,
  RENT_DUE_DATE_OPTIONS,
  RentDueDate,
  SecurityDeposit,
  Signatures,
  SystemMetadata,
  TenantService,
  CurrencyFormat,
  UtilityResponsibility,
  RulesAndRegulations,
  Lease
} from '../../../services/tenant/tenant.service';
import {
  AddedBy,
  Address,
  BackEndPropertyData, PropertyService
} from '../../../services/property/property.service';
import {
  CustomTableComponent,
  ButtonDataType,
  ButtonType,
  CustomTableColumnType
} from '../../../components/shared/custom-table/custom-table.component';
import {SafeUrlPipe} from '../../../pipes/safe-url.pipe';
import {SignSignature} from '../../../components/dialogs/sign-signature/sign-signature.component';
import {UserControllerService} from '../../../services/userController/user-controller.service';
import {HttpErrorResponse} from '@angular/common/http';
import {SwitchButton} from '../../../components/shared/buttons/switch-button/switch-button.component';

// EditorComponent,CameraBoxComponent,

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

interface TenantScannedFilesDataJSON {
  [tenantUsername: string]: ScannedFileRecordJSON[];
}

interface PropertyCustomTableDataType {
  image: string;
  id: BackEndPropertyData['id'];
  type: BackEndPropertyData['type'];
  title: BackEndPropertyData['title'];
  listing: BackEndPropertyData['listing'];
  furnishingStatus: BackEndPropertyData['furnishingStatus'];
  developerName: BackEndPropertyData['developerName'];
  projectName: BackEndPropertyData['projectName'];
  builtYear: BackEndPropertyData['builtYear'];
  address: string;
}


@Component({
  selector: 'app-tenant-edit',
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
    NotificationComponent,
    ProgressBarComponent,
    CustomTableComponent,
    SafeUrlPipe,
    MatTooltipModule,
    MatExpansionModule,
    SwitchButton
  ],
  templateUrl: './tenant-edit.component.html',
  styleUrl: './tenant-edit.component.scss',
})
export class TenantEditComponent implements OnInit, AfterViewInit, OnDestroy {
  //<=============================== COMPONENT PROPERTIES ===============================>
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  @ViewChild(ProgressBarComponent) progress!: ProgressBarComponent;
  @ViewChild(NotificationComponent) notification!: NotificationComponent;
  @ViewChild(ImageCropperComponent) imageCropper!: ImageCropperComponent;
  @ViewChild(CameraBoxComponent) cameraBox!: CameraBoxComponent;

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  protected modeSub: Subscription | null = null;
  protected isLoading: boolean = true;
  protected loggedUser: LoggedUserType | null = null;

  protected readonly definedMaleDummyImageURL =
    '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL =
    '/Images/user-images/dummy-user/dummy_woman.jpg';
  protected definedImage: string =
    '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedImageExtentionArray: string[] = [
    'jpg',
    'webp',
    'jpeg',
    'png',
    'ico',
    'gif',
  ];

  protected init: EditorComponent['init'] = {
    plugins: 'lists link image table code help wordcount',
  };

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
  private commonCountryCodes: CountryCodes[] = [];
  //<=============================== END COMPONENT PROPERTIES ===============================>

  // <=============================== LEASE INFORMATION ===============================>
  private leaseID: string = '';
  private lease: Lease | null = null
  // <=============================== Tenant Information ===============================>
  protected tenant: BaseUser | null = null;

  // <=============================== Tenant Basic Information ===============================>

  // 01 row
  protected tenantFullName: string = '';
  protected tenantEmail: string = '';
  protected isTenantEmailValid: boolean = true;

  // 02 row
  protected tenantNationality: string = '';
  protected tenantDateOfBirth: Date = new Date();
  protected tenantPhoneNumber: string = '';
  protected tenantPhoneCodeId: string = '';
  protected phoneCodes: CountryCodes[] = [];
  protected phoneCodeId: string = '';
  protected filterTenantPhoneCodes!: Observable<CountryCodes[]>;
  protected tenantPhoneCodeDetails: CountryCodes | null = null;
  protected tenantGender: string = '';

  // 03 row
  protected tenantNicOrPassport: string = '';
  protected identificationFileSelectionOption:
    | 'file-selection'
    | 'drag-and-drop'
    | 'file-scan'
    | '' = '';

  // Identification File Upload
  protected isDragOver: boolean = false;
  protected tenantScanedDocuments: File[] = [];
  protected tenantUploadedScanedDocuments: ScannedFileRecordJSON[] = [];
  protected tenantUploadedScanedDocumentsRemoved: ScannedFileRecordJSON[] = [];
  protected tenantScaannedDocumentPreview: FilePreViewType[] = [];
  private tenantUsername: string = '';
  private mobileFileUploadToken: string = '';

  // <=============================== End Tenant Basic Information ===============================>

  // <=============================== Tenant Address ===============================>
  // 04 row
  protected tenantHouseNumber: string = '';
  protected tenantStreet: string = '';
  protected tenantCity: string = '';
  protected tenantStateOrProvince: string = '';
  protected tenantPostalCode: string = '';
  protected tenantCountry: string = '';
  protected tenantCountries: Country[] = [];
  private _tenantCountry: Country | null = null;
  protected filterTenantCountries!: Observable<Country[]>;
  // <=============================== End Tenant Address ===============================>

  // <=============================== Tenant Emergengy Contact ===============================>
  // 05 row
  protected emergencyContactName: string = '';
  protected emergencyContactRelationship: string = '';
  protected isEmergencyContactValid: boolean = true;
  protected emergencyContactSpanMessage: string = '';
  protected emergencyContactContact: string = '';
  // <=============================== End Tenant Emergengy Contact ===============================>

  // <=============================== End Tenant Information ===============================>

  // <=============================== Co-Tenant Information ===============================>
  protected coTenantFullName: string = '';
  protected coTenantEmail: string = '';
  protected isCoTenantEmailValid: boolean = true;
  protected coTenantPhoneNumber: string = '';
  protected coTenantPhoneCodeDetails: CountryCodes | null = null;
  protected coTenantPhoneCodeId: string = '';
  protected filterCoTenantPhoneCodes!: Observable<CountryCodes[]>;
  protected coTenantGender: string = '';
  protected coTenantNicOrPassport: string = '';
  protected coTenantAge: number = 0;
  protected coTenantRelationship: string = '';
  protected coTenantIdDocumentUrl: string = '';
  protected coTenantUploadedIdDocumentUrl: string = '';
  // <=============================== End Co-Tenant Information ===============================>

  // <=============================== Property Informations ===============================>
  protected properties: BackEndPropertyData[] = [];
  private selectedProperty: BackEndPropertyData | null = null;
  protected propertyId: BackEndPropertyData['id'] = '';
  protected propertyTitle: BackEndPropertyData['title'] = '';
  protected location: BackEndPropertyData['location'] | undefined = undefined;
  protected propertylocaaationLat: number = 0;
  protected propertylocaaationLng: number = 0;
  protected propertyGeoLocation: string = ''; // for map
  protected propertyHouserNumber: Address['houseNumber'] = '';
  protected propertyStreet: Address['street'] = '';
  protected propertyCity: Address['city'] = '';
  protected propertyStateOrProvince: Address['stateOrProvince'] = '';
  protected propertyPostalCode: Address['postcode'] = '';
  protected propertyCountry: Address['country'] = '';
  protected propertyType: BackEndPropertyData['listing'] = '';
  protected propertyBuiltYear: BackEndPropertyData['builtYear'] = 0;
  protected furnishingStatus: BackEndPropertyData['furnishingStatus'] = '';
  protected includedAmenities: BackEndPropertyData['featuresAndAmenities'] = [];
  protected parkingSpots: BackEndPropertyData['numberOfParking'] = 0;
  protected propertyDeveloperName: BackEndPropertyData['developerName'] = '';
  protected propertyProjectName: BackEndPropertyData['projectName'] = '';
  protected isPropertySelected: boolean = false;

  // Custom tabl variables
  private _propertyTableIsReloading: boolean = false;
  private _propertyTablePageSize: number = 1;
  private _propertyTablePageSizeOptions: number[] = [5, 10, 25, 100];
  private _propertyTablePageIndex: number = 0;
  private _propertyTablePageCount: number = 0;
  private _propertyTableType: string = 'property';
  private _propertyTabletSearchText: string = '';
  private _propertyTableButtonAction: ButtonType = {
    type: 'add',
  };

  private _propertyTableButtonOperation: ButtonType = {
    type: 'view',
  };
  private _propertyTableTotalDataCount: number = 0;

  private _propertyTableButtonActionTrigger: ButtonDataType = {
    type: 'add',
    data: null,
  };

  private _propertyTableButtonOperationTrigger: ButtonDataType = {
    type: 'add',
    data: null,
  };
  private _propertyTableNotification: NotificationType = {
    type: 'success',
    message: '',
  };
  private _propertyTableData: PropertyCustomTableDataType[] = [];
  private _propertyTableColumns: CustomTableColumnType[] = [];
  private _propertyLength: number = 0;
  // End Custom tabl variables

  // <=============================== End Property Informations ===============================>

  // <=============================== Lease Agreement ===============================>
  protected _startDate: LeaseAgreement['startDate'] = new Date();
  protected _endDate: LeaseAgreement['endDate'] = new Date();
  protected _durationMonths: LeaseAgreement['durationMonths'] = 0;
  protected monthlyRent: LeaseAgreement['monthlyRent'] = 0;

  // currency
  protected currencyLeaseAgreement: string = '';
  private _currency: CurrencyFormat | null = null;
  protected currencies: CurrencyFormat[] = [];
  protected filterCurrencies$!: Observable<CurrencyFormat[]>;

  // paymentFrequency
  protected paymentFrequencyLeaseAgreement: string = '';
  protected paymentFrequency: PaymentFrequency | null = null;
  protected readonly paymentFrequencies: PaymentFrequency[] =
    PAYMENT_FREQUENCIES;
  protected filterPaymentFrequencies$!: Observable<PaymentFrequency[]>;


  // paymentMethod
  protected paymentMethodLeaseAgreement: string = '';
  protected paymentMethod: PaymentMethod | null = null;
  protected readonly paymentMethods: PaymentMethod[] = PAYMENT_METHODS;
  protected filterPaymentMethods$!: Observable<PaymentMethod[]>;

  // securityDeposit
  protected securityDepositLeaseAgreement: string = '';
  protected securityDeposit: SecurityDeposit | null = null;
  protected readonly securityDeposits: SecurityDeposit[] =
    BASE_SECURITY_DEPOSIT_OPTIONS;
  protected filterSecurityDeposits$!: Observable<SecurityDeposit[]>;

  // rentDueDate
  protected rentDueDateLeaseAgreement: string = '';
  protected rentDueDate: RentDueDate | null = null;
  protected readonly rentDueDates: RentDueDate[] = RENT_DUE_DATE_OPTIONS;
  protected filterRentDueDates$!: Observable<RentDueDate[]>;

  // latePaymentPenalty
  protected latePaymentPenaltyLeaseAgreement: string = '';
  private _latePaymentPenalty: LatePaymentPenalty | null = null;
  protected selectedLatePaymentPenalties: LatePaymentPenalty[] = [];
  protected readonly latePaymentPenalties: LatePaymentPenalty[] =
    LATE_PAYMENT_PENALTY_OPTIONS;
  protected filterLatePaymentPenalties$!: Observable<
    LatePaymentPenalty[]
  >;
  protected latePaymentPenaltyLabelHint: string = '';

  // utilityResponsibilities
  protected utilityResponsibilitiesLeaseAgreement: string = '';
  protected selectedUtilityResponsibilities: UtilityResponsibility[] = [];
  private _utilityResponsibility: UtilityResponsibility | null = null;
  protected readonly utilityResponsibilitiesOptions: UtilityResponsibility[] =
    [];
  protected filterUtilityResponsibilities$!: Observable<
    UtilityResponsibility[]
  >;

  // noticePeriodDays
  protected noticePeriodDaysLeaseAgreement: string = '';
  protected noticePeriodDays: NoticePeriod | null = null;
  protected readonly NoticePeriods: NoticePeriod[] =
    NOTICE_PERIOD_OPTIONS;
  protected filterNoticePeriodOptions$!: Observable<NoticePeriod[]>;

  // Today
  protected today: Date = new Date();

  // <=============================== End Lease Agreement ===============================>
  // <=============================== Rule And Regulation ===============================>
  protected rulesAndRegulation: RulesAndRegulations['rule'] = '';
  protected rulesAndRegulationDescription: RulesAndRegulations['description'] =
    '';
  private _rulesAndRegulations: RulesAndRegulations[] = [];
  private _rulesAndRegulation: RulesAndRegulations | null = null;
  protected readonly rulesAndRegulationsOptions: RulesAndRegulations[] =
    DEFAULT_RULES_AND_REGULATIONS;
  protected filterRulesAndRegulations$!: Observable<RulesAndRegulations[]>;
  protected selectedRuleAndRegulations: RulesAndRegulations[] = [];
  protected isRuleAndRegulationEditable: boolean = false;

  // <=============================== End Rule And Regulation ===============================>

  // <=============================== Company Policy ===============================>
  protected readonly companyPolicy: string = DEFAULT_COMPANY_POLICY;
  protected isReadTheCompanyPolicy: boolean = false;
  // <=============================== End Company Policy ===============================>

  // <=============================== Signatures ===============================>
  protected tenantSignature: Signatures['tenantSignature'] | null = null;
  protected tenantPreviewImageData: string = '';
  protected landlordSignature: Signatures['landlordSignature'] | null = null;
  protected landloadPreviewImageData: string = '';
  protected signedAt: Signatures['signedAt'] = this.today;
  private ipAddress: string = '';
  protected userAgent: AddedBy | null = null;
  // <=============================== End Signatures ===============================>

  // <=============================== System Metadata ===============================>
  private ocrAutoFillStatus: SystemMetadata['ocrAutoFillStatus'] = false;
  private validationStatus: SystemMetadata['validationStatus'] = 'pending';
  private language: SystemMetadata['language'] = 'en';
  private leaseTemplateVersion: SystemMetadata['leaseTemplateVersion'] =
    '1.0.0';
  private lastUpdated: SystemMetadata['lastUpdated'] = this.today.toISOString();
  // <=============================== End System Metadata ===============================>

  constructor (
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: APIsService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private cryptoService: CryptoService,
    private authService: AuthService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private scanService: ScanService,
    private tokenService: TokenService,
    private cdr: ChangeDetectorRef,
    private propertyService: PropertyService,
    private tenantService: TenantService,
    private userControllerService: UserControllerService,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.loggedUser = this.authService.getLoggedUser;
    if(this.loggedUser)
      this.userAgent = {
        name: this.loggedUser?.name,
        email: this.loggedUser?.email,
        addedAt: this.today.toISOString(),
        role: this.loggedUser?.role,
        username: this.loggedUser?.username,
      };

    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });

    this.route.params.subscribe(async (params) => {
      this.leaseID = params['leaseID'];
      await this.apiService.getCountryCodes().then((res) => {
        this.commonCountryCodes = res;
      });
      await this.loadData();
    });
  }

  async ngOnInit(): Promise<void> {
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
      this.registerCustomIcons();
      await this.getAllCountries();
      await this.getCountryCodes();
      await this.getAllProperties();
      await this.makeCurrenciesList();
      this.makePropertyTablePagination(0, 2)
      this.isLoading = false;
    }
  }

  async ngAfterViewInit(): Promise<void> {}

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  protected onReload(): void {
    const currentUrl = this.router.url;
    this.router.navigateByUrl('/', {skipLocationChange: true}).then(() => {
      this.router.navigate([currentUrl]);
    });
  }

  //<=========================== Check The Logged User Privileges ===========================>
  private hasFullLeaseManagementPrivileges(): boolean {
    const requiredModule = 'Lease Management';
    const requiredActions: string[] = [
      'view',
      'create',
      'update',
      'terminate',
      'renew',
      'upload document',
      'track expiry',
    ];

    const permissions: ROLE_ACCESS_MAP['permissions'] =
      this.loggedUser?.access?.permissions ?? [];

    const leasePermissions = permissions.find(
      (perm) => perm.module.toLowerCase() === requiredModule.toLowerCase()
    );

    if(!leasePermissions) {
      return false;
    }

    return requiredActions.every((action) =>
      leasePermissions.actions.includes(action)
    );
  }
  //<=========================== End Check The Logged User Privileges ===========================>

  //<=========================== Icon Register ===========================>
  private registerCustomIcons(): void {
    const iconMap = {
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

    for(const [name, path] of Object.entries(iconMap)) {
      this.matIconRegistry.addSvgIcon(
        name,
        this.domSanitizer.bypassSecurityTrustResourceUrl(
          `/Images/Icons/${path}`
        )
      );
    }
  }
  //<=========================== End Icon Register ===========================>

  //<=========================== Icon Chooser ===========================>
  protected chooceIcon(type: string): string {
    switch(type) {
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
  //<=========================== End Icon Chooser ===========================>

  //<=========================== Load Initial Tenant Data ===========================>
  private async loadData() {
    try {
      this.isLoading = true;

      const response = await this.tenantService.getLeaseAgreementByLeaseID(this.leaseID.trim())
      if(response.status !== 'success') throw new Error('Loading lease agreement failed!');
      this.lease = response.data as Lease;


      const tenantUsername = this.lease.tenantInformation.tenantUsername;
      const tenantDataResponse = await this.tenantService.getTenantByUsername(tenantUsername.trim());
      if(tenantDataResponse.status !== 'success') throw new Error('Loading tenant data failed!');
      this.tenant = tenantDataResponse.data as BaseUser;

      // Tenant Information:
      this.tenantFullName = this.lease.tenantInformation.fullName;
      this.tenantEmail = this.lease.tenantInformation.email;
      this.tenantNationality = this.lease.tenantInformation.nationality;
      this.tenantDateOfBirth = new Date(this.lease.tenantInformation.dateOfBirth);
      this.tenantPhoneCodeId = this.lease.tenantInformation.phoneCodeDetails.code;
      this.tenantPhoneNumber = this.lease.tenantInformation.phoneNumber.split(this.tenantPhoneCodeId)[0];
      this.tenantPhoneCodeDetails = this.lease.tenantInformation.phoneCodeDetails;
      this.tenantGender = this.lease.tenantInformation.gender;
      this.tenantNicOrPassport = this.lease.tenantInformation.nicOrPassport;


      type ScannedDoc = ScannedFileRecordJSON;

      const raw = this.lease?.tenantInformation?.scannedDocuments ?? [];

      // Ensure we end up with ScannedDoc[]
      this.tenantUploadedScanedDocuments = raw.reduce<ScannedDoc[]>((acc, entry) => {
        if(Array.isArray(entry)) {
          acc.push(...(entry as ScannedDoc[]));
        } else if(entry) {
          acc.push(entry as ScannedDoc);
        }
        return acc;
      }, []);

      this.tenantUploadedScanedDocuments.forEach((item) => {
        const files = item.files;
        files.forEach((doc) => {
          const file = doc.file;
          const filename = file.filename;
          const fileExtension = file.filename.split('.').pop() as string;
          const fieldname = file.fieldname;
          const originalname = file.originalname;
          const URL = file.URL;
          const mimetype = file.mimetype;
          const icon = this.chooceIcon(fileExtension);
          const fileSize = file.size;
          const data: FilePreViewType = {
            icon: icon,
            name: filename,
            size: fileSize,
            URL: URL,
            token: '',
            type: mimetype,
          }
          this.tenantScaannedDocumentPreview.push(data);
        })
      })

      this.tenantUsername = this.lease.tenantInformation.tenantUsername;

      // Tenant Address
      this.tenantHouseNumber = this.tenant.address.houseNumber;
      this.tenantStreet = this.tenant.address.street;
      this.tenantCity = this.tenant.address.city;
      this.tenantStateOrProvince = this.tenant.address.stateOrProvince ?? '';
      this.tenantPostalCode = this.tenant.address.postcode;
      this.tenantCountry = this.tenant.address.country ?? '';
      if(this.tenantCountry) this.onTenantCountryChange(this.tenantCountry);

      // Emergency Contact
      this.emergencyContactName = this.lease.tenantInformation.emergencyContact.name;
      this.emergencyContactRelationship = this.lease.tenantInformation.emergencyContact.relationship;
      this.emergencyContactContact = this.lease.tenantInformation.emergencyContact.contact;

      // Co-Tenant Information
      this.coTenantFullName = this.lease.coTenant?.fullName ?? '';
      this.coTenantEmail = this.lease.coTenant?.email ?? '';
      this.coTenantPhoneCodeId = this.lease.coTenant?.phoneCode ?? '';
      this.coTenantPhoneNumber = this.lease.coTenant?.phoneNumber ? this.lease.coTenant?.phoneNumber.split(this.coTenantPhoneCodeId)[0] : '';
      this.onCoTenantPhoneCodeChange(this.lease.coTenant?.phoneCode ?? '');
      this.coTenantGender = this.lease.coTenant?.gender ?? '';
      this.coTenantNicOrPassport = this.lease.coTenant?.nicOrPassport ?? '';
      this.coTenantAge = this.lease.coTenant?.age ?? 0;
      this.coTenantRelationship = this.lease.coTenant?.relationship ?? '';

      //Property Information
      this.propertyId = this.lease.propertyID ?? '';
      this.handlePropertyTableOperationTrigger(this.propertyId);

      // Lease Agreement
      this.startDate = new Date(this.lease.leaseAgreement.startDate);
      this.endDate = new Date(this.lease.leaseAgreement.endDate);
      this.monthlyRent = this.lease.leaseAgreement.monthlyRent;

      // currency
      this.currencyLeaseAgreement = this.lease.leaseAgreement.currency.currency;
      this._currency = this.lease.leaseAgreement.currency;

      // paymentFrequency
      this.paymentFrequencyLeaseAgreement = this.lease.leaseAgreement.paymentFrequency.name;
      this.paymentFrequency = this.lease.leaseAgreement.paymentFrequency;

      // paymentMethod
      this.paymentMethodLeaseAgreement = this.lease.leaseAgreement.paymentMethod.name;
      this.paymentMethod = this.lease.leaseAgreement.paymentMethod;

      // securityDeposit
      this.securityDepositLeaseAgreement = this.lease.leaseAgreement.securityDeposit.name;
      this.securityDeposit = this.lease.leaseAgreement.securityDeposit;

      // rentDueDate
      this.rentDueDateLeaseAgreement = this.lease.leaseAgreement.rentDueDate.label;
      this.rentDueDate = this.lease.leaseAgreement.rentDueDate;

      // latePaymentPenalty
      this.latePaymentPenaltyLeaseAgreement = this.lease.leaseAgreement.latePaymentPenalties[this.lease.leaseAgreement.latePaymentPenalties.length - 1].label;
      this._latePaymentPenalty = this.lease.leaseAgreement.latePaymentPenalties[this.lease.leaseAgreement.latePaymentPenalties.length - 1];
      this.selectedLatePaymentPenalties = this.lease.leaseAgreement.latePaymentPenalties;

      // utilityResponsibilities
      this.utilityResponsibilitiesLeaseAgreement = this.makeCapitalize(this.lease.leaseAgreement.utilityResponsibilities[this.lease.leaseAgreement.utilityResponsibilities.length - 1].utility + ' - ' + this.lease.leaseAgreement.utilityResponsibilities[this.lease.leaseAgreement.utilityResponsibilities.length - 1].paidBy);
      this.selectedUtilityResponsibilities = this.lease.leaseAgreement.utilityResponsibilities;
      this._utilityResponsibility = this.lease.leaseAgreement.utilityResponsibilities[this.lease.leaseAgreement.utilityResponsibilities.length - 1];

      // noticePeriodDays
      this.noticePeriodDaysLeaseAgreement = this.lease.leaseAgreement.noticePeriodDays.label;
      this.noticePeriodDays = this.lease.leaseAgreement.noticePeriodDays;

      //Rule and regulations
      this.rulesAndRegulation = this.lease.rulesAndRegulations[this.lease.rulesAndRegulations.length - 1].rule;
      this._rulesAndRegulation = this.lease.rulesAndRegulations[this.lease.rulesAndRegulations.length - 1];
      this.selectedRuleAndRegulations = this.lease.rulesAndRegulations;

      // Company Policy
      this.isReadTheCompanyPolicy = this.lease.isReadTheCompanyPolicy;

      // Signatures
      this.tenantSignature = this.lease.signatures.tenantSignature as FILE;
      this.tenantPreviewImageData = this.tenantSignature ? this.tenantSignature.URL as FILE['URL'] : '';
      this.landlordSignature = this.lease.signatures.landlordSignature as FILE;
      this.landloadPreviewImageData = this.landlordSignature ? this.landlordSignature.URL as FILE['URL'] : '';
      this.signedAt = new Date(this.lease.signatures.signedAt ?? '');
      this.userAgent = this.lease.signatures.userAgent;

      this.ocrAutoFillStatus = this.lease.systemMetadata.ocrAutoFillStatus;
      this.validationStatus = this.lease.systemMetadata.validationStatus;
      this.language = this.lease.systemMetadata.language;
      this.leaseTemplateVersion = this.calculateLetastVersion(this.lease.systemMetadata.leaseTemplateVersion);
      this.lastUpdated = new Date().toISOString();

    }
    catch(error) {
      console.error(error);
      if(error instanceof HttpErrorResponse) {
        this.notification.notification(
          error.error.status,
          error.error.message
        );
      }
      else if(typeof error === 'string') {
        this.notification.notification('error', error);
      }
      else {
        // setTimeout( () => {
        //   this.router.navigate( [ '/dashboard/tenant/tenant-home/' ] );
        // }, 1000 )
      }
    }
    finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private calculateLetastVersion(input: string): string {
    if(typeof input !== 'string') return '';

    const regex = /^\d+\.\d+\.\d+$/;
    if(!regex.test(input.trim())) return '';

    const numberArray = input.trim().split('.');

    const lastIndex = numberArray.length - 1;
    const lastNumber = parseInt(numberArray[lastIndex], 10);

    numberArray[lastIndex] = (lastNumber + 1).toString();

    return numberArray.join('.');
  }
  //<=========================== End Load Initial Tenant Data ===========================>

  //<=========================== Extract Country Code ===========================>
  private extractCountryCodeAndPhone(phoneNumber: string): {
    code: string;
    number: string;
  } {
    try {
      if(!phoneNumber || typeof phoneNumber !== 'string') {
        throw new Error('Invalid input');
      }

      const regex = /^\+?\d{1,4}[\s\-\.]?\(?\d{1,4}\)?[\s\-\.]?\d{1,4}[\s\-\.]?\d{1,9}$/;
      if(!regex.test(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      // Normalize: remove spaces, dashes, parentheses
      const normalized = phoneNumber.replace(/[\s\-\(\)\.]/g, '');

      // Ensure it starts with +
      const withPlus = normalized.startsWith('+') ? normalized : '+' + normalized;

      // Sort codes from longest to shortest (e.g., +971 before +94)
      const sortedCodes = this.phoneCodes.sort((a, b) => b.code.length - a.code.length);

      for(const code of sortedCodes.map(item => item.code)) {
        if(withPlus.startsWith(code)) {
          const number = withPlus.slice(code.length);
          return {code, number};
        }
      }

      throw new Error('Country code not found');

    }
    catch(error) {
      console.error(error)
      return {
        code: '',
        number: '',
      };
    }
  }
  //<=========================== End Extract Country Code ===========================>

  //<=========================== Is Phone Number Valid Number ===========================>
  protected phoneNumberValid(phoneNumber: string): boolean {
    return phoneNumber.trim().length > 0
      ? this.userControllerService.isPhoneNumberValid(phoneNumber)
      : true;
  }
  //<=========================== End Is Phone Number Valid Number ===========================>

  //<=========================== Tenant Email Verification ===========================>
  protected async onTenantEmailChange(email: string) {
    await this.userControllerService
      .emailValidator(email)
      .then((res) => {
        if(res.status === 'success') {
          this.isTenantEmailValid = res.data.validation;
        } else {
          this.isTenantEmailValid = false;
        }
      })
      .catch((error: HttpErrorResponse) => {
        if(error.status === 400 || error.status === 500) {
          this.isTenantEmailValid = false;
        }
      });
  }
  //<=========================== Tenant Email Verification ===========================>

  //<=========================== Auto Assigning The Phone Code If It Is Empty ===========================>
  private autoAssigningThePhoneCodeIfItIsEmpty(country: string): CountryCodes {
    return (
      (this.commonCountryCodes.find(
        (item) => item.name.toLowerCase() === country.toLowerCase()
      ) as CountryCodes) ?? undefined
    );
  }

  //<=========================== End Auto Assigning The Phone Code If It Is Empty ===========================>

  //<=========================== Generate The Tenant Image Based On The Tenant Gender ===========================>
  protected generateTenantImage(image: string, gender: string): string {
    const imageArray: string[] = image ? image.split('/') : [];
    if(Array.isArray(imageArray) && imageArray.length > 0) {
      if(
        this.definedImageExtentionArray.includes(
          imageArray[imageArray.length - 1].split('.')[1]
        )
      ) {
        this.definedImage = image;
      } else {
        if(gender.toLowerCase() === 'male') {
          this.definedImage = this.definedMaleDummyImageURL;
        } else {
          this.definedImage = this.definedWomanDummyImageURL;
        }
      }
    }
    return this.definedImage;
  }
  //<=========================== End Generate The Tenant Image Based On The Tenant Gender ===========================>

  //<=========================== Page Indicator For The Tenant Dashboard ===========================>
  protected goToTenants() {
    this.router.navigateByUrl('/', {skipLocationChange: true}).then(() => {
      this.router.navigate(['/dashboard/tenant/tenant-home/']);
    });
  }
  //<=========================== End Page Indicator For The Tenant Dashboard ===========================>

  //<=========================== Page Indicator For The Tenant View ===========================>
  protected async goLease() {
    if(this.tenant) {
      this.router.navigate(['/dashboard/tenant/tenant-lease', this.leaseID]);
    }
  }
  //<=========================== Page Indicator For The Tenant View ===========================>

  //<=========================== Page Indicator For The Tenant Profile ===========================>
  protected async goToTenant() {
    if(this.tenant) {
      const tenant = await this.apiService.generateToken(this.tenant?.username);
      if(tenant)
        this.router
          .navigateByUrl('/', {skipLocationChange: true})
          .then(() => {
            this.router.navigate([
              '/dashboard/tenant/tenant-view/',
              tenant.token,
            ]);
          });
    }
  }
  //<=========================== End Page Indicator For The Tenant Profile ===========================>

  //<=========================== Processing The File Past Of The Tenant Identification Document Upload ===========================>
  @HostListener('document:paste', ['$event'])
  protected identificationFileHandlePaste(event: ClipboardEvent): void {
    const target = event.target as HTMLElement;

    // Allow default behavior for text inputs and editable fields
    if(
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.hasAttribute('contenteditable')
    ) {
      return; // Don't block default paste
    }

    // Now prevent default only for custom paste handling (images, etc.)
    event.preventDefault();

    // Custom paste handling for image files
    const items = event.clipboardData?.items;
    if(!items) return;

    for(const item of items) {
      if(item.kind === 'file') {
        const file = item.getAsFile();
        if(file) {
          this.processIdentificationFilePasted(file);
        }
      }
    }
  }

  protected processIdentificationFilePasted(file: File) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const input = this.fileInput.nativeElement;
    input.files = dataTransfer.files;

    // Trigger the same file selection logic
    this.onIdentificationFileSelectionChange({target: input} as any);
  }
  //<=========================== End Processing The File Past Of The Tenant Identification Document Upload ===========================>

  //<=========================== Documant Drag And Drop Section ===========================>
  protected onIdentificationFileDragOver(event: DragEvent): void {
    event.preventDefault(); // Crucial to allow drop
    this.isDragOver = true;
  }

  protected onIdentificationFileDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  protected onIdentificationFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if(files && files.length > 0) {
      const file = files[0];
      if(file.type.startsWith('image/')) {
        this.processIdentificationFileDropped(file);
      }
    }
  }

  protected processIdentificationFileDropped(file: File) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const input = this.fileInput.nativeElement;
    input.files = dataTransfer.files;

    // Trigger your upload handler
    this.onIdentificationFileSelectionChange({target: input} as any);
  }
  //<=========================== End Documant Drag And Drop Section ===========================>

  //<=========================== Preventing The Default Behaviour Of The Browser When The File Past Or Drag And Drop ===========================>
  protected preventDefault(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }
  //<=========================== End Preventing The Default Behaviour Of The Browser When The File Past Or Drag And Drop ===========================>

  //<=========================== Trigger The File Input ===========================>
  protected triggerTenantIdentificationFileInput() {
    document.querySelector<HTMLInputElement>('#fileInput')?.click();
  }
  //<=========================== End Trigger The File Input ===========================>

  //<=========================== On Identification File Selection And Process ===========================>
  protected onIdentificationFileSelectionChange(event: any): void {
    if(event.target.files && event.target.files.length > 0) {
      const files = event.target.files as File[];
      this.tenantScanedDocuments.push(...files);

      for(let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileSize = file.size;
        const name = file.name;
        const type = file.type;
        const fileExtensionPart = file.name.split('.').pop();
        const fileExtension = fileExtensionPart
          ? fileExtensionPart.toLowerCase()
          : '';
        const data = {
          icon: this.chooceIcon(fileExtension),
          name: name,
          size: fileSize,
          type: type,
          token: '',
        };
        this.tenantScaannedDocumentPreview.push(data);
      }
    } else {
      this.notification.notification('warning', 'No files selected.');
    }
  }
  //<=========================== End On Identification File Selection And Process ===========================>

  //<=========================== Identification File Upload Choose Section And Process ===========================>
  protected onIdentificationFileSelection() {
    switch(this.identificationFileSelectionOption) {
      case 'file-selection':
        return this.triggerTenantIdentificationFileInput();
      case 'drag-and-drop':
        break;
      case 'file-scan':
        return this.triggerScanner();
      default:
        return;
    }
  }
  //<=========================== End Identification File Upload Choose Section And Process ===========================>

  //<=========================== File Process To View ===========================>
  protected processFileToView(file: any): void {
    console.log(file);
  }
  //<=========================== End File Process To View ===========================>

  //<=========================== Remove Scanned Document From The List ===========================>
  protected async removeScannedDocument(document: any) {
    try {
      // uploadedIdentificationFileRemoved
      const file = this.tenantScanedDocuments.find(
        (item) => item.name === document.name
      );

      const uploadedFile = this.tenantUploadedScanedDocuments.find(
        (item) => item.token === document.token
      );

      if(file) {
        const index = this.tenantScanedDocuments.indexOf(file);
        this.tenantScanedDocuments.splice(index, 1);
        this.tenantScaannedDocumentPreview.splice(index, 1);
      } else if(uploadedFile) {
        const index = this.tenantUploadedScanedDocuments.indexOf(uploadedFile);
        this.tenantUploadedScanedDocuments.splice(index, 1);
        this.tenantUploadedScanedDocumentsRemoved.push(uploadedFile);
      } else {
        throw new Error('File not found in the list.');
      }

      this.cdr.detectChanges();
    } catch(error) {
      this.notification.notification('error', String(error));
    }
  }
  //<=========================== End Remove Scanned Document From The List ===========================>

  //<=========================== Open File Scanner Section ===========================>
  protected triggerScanner() {
    const fileScanner = this.dialog.open(FileScanner, {
      width: 'auto',
      height: 'auto',
      minWidth: '50vw',
      minHeight: '50vh',
      maxWidth: '100vw',
      maxHeight: '100vh',
      data: {
        tenantUsername: this.tenantUsername,
      },
    });

    fileScanner.afterClosed().subscribe(async (result) => {
      if(result) this.mobileFileUploadToken = result.token;
      if(this.mobileFileUploadToken) this.getMobileUploadedFile();
    });
  }
  //<=========================== End Open File Scanner Section ===========================>

  //<=========================== Get The Mobile Uploaded File Section ===========================>
  //First Try
  private async getMobileUploadedFile() {
    try {
      this.isLoading = true;
      if(!this.tenantUsername) throw new Error('Tenant username is missing');
      await this.scanService
        .getReasonFileUploadsByTenantUsername(this.tenantUsername)
        .then((res) => {
          if(res.status === 'success') {
            const data = res.data as ScannedFileRecordJSON[];
            this.tenantUploadedScanedDocuments = data;

            this.tenantUploadedScanedDocuments.forEach((item) => {
              item.files.forEach((fileItem) => {
                const extention =
                  fileItem.file.originalname
                    .split('.')
                    .pop()
                    ?.toLocaleLowerCase() ?? '';
                const icon = this.chooceIcon(extention);
                const URL = fileItem.file.URL;
                const name = fileItem.file.filename;
                const size = fileItem.file.size;
                const type = fileItem.file.mimetype;
                const token = fileItem.token;
                console.log(item.token === fileItem.token);
                this.tenantScaannedDocumentPreview.push({
                  icon: icon,
                  name: name,
                  size: size,
                  type: type,
                  token: token,
                  URL: URL,
                });
              });
            });
            console.log(this.tenantUploadedScanedDocuments);
          } else {
            throw new Error(res.message);
          }
        })
        .catch((error: HttpErrorResponse) => {
          console.error(error);
          throw new Error(error.error.message || 'Failed to fetch uploaded files');
        });

      this.isLoading = false;
    } catch(error) {
      console.error(error);
      const status = 'error';
      let messsage: string;
      if(error instanceof Error) {
        messsage = error.message;
      } else if(
        typeof error === 'object' &&
        error !== null &&
        'error' in error &&
        typeof (error as any).error === 'object' &&
        (error as any).error !== null &&
        'message' in (error as any).error
      ) {
        messsage = (error as any).error.message as string;
      } else {
        messsage = 'An unknown error occurred';
      }
      this.notification.notification(status, messsage);
    }
  }

  //<=========================== End Get The Mobile Uploaded File Section ===========================>

  //<=========================== Open Dialog For The Document To View ===========================>
  protected viewScannedDocument(document: string) {
    if(document) {
      const fileViewer = this.dialog.open(FileViewer, {
        width: 'auto',
        height: 'auto',
        minWidth: '50vw',
        minHeight: '50vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        data: {
          document: document,
          token: this.mobileFileUploadToken,
        },
      });

      fileViewer.afterClosed().subscribe((result) => {
        if(result) {
          console.log(result);
        }
      });
    }
  }
  //<=========================== End Open Dialog For The Document To View ===========================>

  //<=========================== Address Country Detection ===========================>
  private async getAllCountries() {
    await this.apiService.getCountries().then((res: Country[]) => {
      this.tenantCountries = res;
    });
  }

  protected onTenantCountryChange(input: string): Country[] {
    let filterValue = '';

    if(typeof input === 'string') {
      filterValue = input.toLowerCase().trim();
    } else if(input && typeof input === 'object' && 'currency' in input) {
      filterValue = (input as Country).name.toLowerCase();
    } else {
      filterValue = '';
    }

    if(
      filterValue &&
      this.tenantCountries &&
      Array.isArray(this.tenantCountries)
    ) {
      this.filterTenantCountries = of(
        this.tenantCountries.filter((option) => {
          return option.name.toLowerCase().includes(filterValue);
        })
      );

      this.filterTenantCountries.subscribe((countries: Country[]) => {
        if(countries.length === 1) {
          const country = countries[0];
          this.tenantCountry = country.name;
          this._tenantCountry = country;
        }
      })
    }
    return this.tenantCountries;
  }

  protected onTenantCountrySelectionChange(
    input: MatAutocompleteSelectedEvent
  ) {
    const value = input.option.value as Country;
    this.tenantCountry = value.name;
    this._tenantCountry = value;
  }

  protected displayFn(country: Country): string {
    return typeof country === 'string' ? country : country?.name ?? '';
  }

  protected displayPhoneCode(country: CountryCodes): string {
    return typeof country === 'string' ? country : country?.code ?? '';
  }
  //<=========================== End Address Country Detection ===========================>

  //<=========================== Get Country Code ===========================>
  private async getCountryCodes() {
    this.apiService
      .getCountryCodes()
      .then((res) => {
        this.phoneCodes = res;
      })
      .catch((error: HttpErrorResponse) => {
        console.error(error);
        if(error.status === 404) {
          this.notification.notification('error', 'Country codes not found.');
        }
        else {
          this.notification.notification('error', 'Failed to load country codes.');
        }
      });
  }
  //<=========================== End Get Country Code ===========================>

  //<=========================== Tenant Phone Code Change ===========================>
  protected onTenantPhoneCodeChange(input: any): void {
    let filterValue = '';

    if(typeof input === 'string') {
      filterValue = input.toLowerCase().trim();
    } else if(input && typeof input === 'object' && 'currency' in input) {
      filterValue = (input as CountryCodes).code.toLowerCase();
    } else {
      filterValue = '';
    }

    this.filterTenantPhoneCodes = of(
      this.phoneCodes.filter((item) => {
        return item.code.toLowerCase().includes(filterValue.toLowerCase());
      })
    );
  }

  protected onTenantPhoneCodeSelectionChange(
    input: MatAutocompleteSelectedEvent
  ) {
    const value = input.option.value as CountryCodes;
    this.tenantPhoneCodeId = value.code;
    this.tenantPhoneCodeDetails = value;
  }
  //<=========================== End Tenant Phone Code Change ===========================>

  //<=========================== Co-Tenant Email Change ===========================>
  protected async onCoTenantEmailChange(email: string) {
    await this.userControllerService
      .emailValidator(email)
      .then((res) => {
        console.log(res);
        if(res.status === 'success') {
          this.isCoTenantEmailValid = res.data.validation;
        } else {
          this.isCoTenantEmailValid = false;
        }
      })
      .catch((error: HttpErrorResponse) => {
        if(error.status === 400 || error.status === 500) {
          this.isCoTenantEmailValid = false;
        }

      });
  }
  //<=========================== End Co-Tenant Email Change ===========================>

  //<=========================== Co-Tenant Phone Code Change ===========================>
  protected onCoTenantPhoneCodeChange(input: any): void {
    let filterValue = '';

    if(typeof input === 'string') {
      filterValue = input.toLowerCase().trim();
    } else if(input && typeof input === 'object' && 'currency' in input) {
      filterValue = (input as CountryCodes).code.toLowerCase();
    } else {
      filterValue = '';
    }

    this.filterCoTenantPhoneCodes = of(
      this.phoneCodes.filter((item) => {
        return item.code.toLowerCase().includes(filterValue.toLowerCase());
      })
    );

    this.filterCoTenantPhoneCodes.subscribe((codes: CountryCodes[]) => {
      if(codes.length === 1) this.coTenantPhoneCodeDetails = codes[0];
      else this.coTenantPhoneCodeDetails = null;
    })
  }

  protected onCoTenantPhoneCodeSelectionChange(
    input: MatAutocompleteSelectedEvent
  ) {
    const value = input.option.value as CountryCodes;
    this.coTenantPhoneCodeId = value.code;
    this.coTenantPhoneCodeDetails = value;
  }
  //<=========================== End Co-Tenant Phone Code Change ===========================>

  //<=========================== Eemergency Contact ===========================>
  protected async emergencyContactChange(input: string) {

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isMatched = emailRegex.test(input.trim());
    if(isMatched) {
      await this.userControllerService.emailValidator(input.trim()).then((res) => {
        if(res.status === 'success') {
          this.isEmergencyContactValid = res.data.validation;
          this.emergencyContactSpanMessage = res.data.message;
        } else {
          this.isEmergencyContactValid = false;
        }
      }).catch((error: HttpErrorResponse) => {
        if(error.status >= 400 && error.status < 500) {
          this.isEmergencyContactValid = false;
          this.emergencyContactSpanMessage = error.error.message || 'Invalid email format.';
        }
        else if(error.status === 500) {
          this.isEmergencyContactValid = false;
          this.emergencyContactSpanMessage = 'Internal server error. Please try again later.';
        } else {
          this.isEmergencyContactValid = false;
          this.emergencyContactSpanMessage = 'An unexpected error occurred.';
        }
      });

    } else {
      const isPhoneValid = await this.phoneNumberValid(input.trim());
      if(isPhoneValid) {
        this.isEmergencyContactValid = true;
        this.emergencyContactSpanMessage = 'Valid phone number.';
      } else {
        this.isEmergencyContactValid = false;
        this.emergencyContactSpanMessage = 'Invalid phone number.';
      }
    }
    this.cdr.detectChanges();
  }
  //<=========================== End Eemergency Contact ===========================>

  //<=========================== Property Infomations ===========================>
  //<=========================== Get All Properties From API ===========================>
  private async getAllProperties() {
    try {
      this.isLoading = true;
      const response = await this.propertyService.getAllProperties();
      if(response.status === 'success') {
        this.properties = response.data as BackEndPropertyData[];
      }
      else {
        throw new Error("Unexpected error occurred. Please try again later.");
      }
    }
    catch(error) {
      console.error(error);
      if(error instanceof HttpErrorResponse) {
        this.notification.notification('error', error.error.message);
      }
      else if(typeof error === 'string') {
        this.notification.notification('error', error);
      }
      else if(error instanceof Error) {
        this.notification.notification('error', error.message);
      }
    }
    finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }
  //<=========================== End Get All Properties From API ===========================>

  //<=========================== Property Table Getters And Setters ===========================>
  get propertyTableIsReloading(): boolean {
    return this._propertyTableIsReloading;
  }

  set propertyTableIsReloading(value: boolean) {
    this._propertyTableIsReloading = value;
    this.handlePropertyTableReloading();
  }

  get propertyTablePageSize(): number {
    return this._propertyTablePageSize;
  }

  set propertyTablePageSize(value: number) {
    this._propertyTablePageSize = value;
  }

  get propertyTablePageSizeOptions(): number[] {
    return this._propertyTablePageSizeOptions;
  }

  set propertyTablePageSizeOptions(value: number[]) {
    this._propertyTablePageSizeOptions = value;
  }

  get propertyTablePageIndex(): number {
    return this._propertyTablePageIndex;
  }

  set propertyTablePageIndex(value: number) {
    this._propertyTablePageIndex = value;
    this.handelPageIndex();
  }

  get propertyTablePageCount(): number {
    return this._propertyTablePageCount;
  }

  set propertyTablePageCount(value: number) {
    this._propertyTablePageCount = value;
  }

  get propertyTableType(): string {
    return this._propertyTableType;
  }

  set propertyTableType(value: string) {
    this._propertyTableType = value;
  }

  get propertyTabletSearchText(): string {
    return this._propertyTabletSearchText;
  }

  set propertyTabletSearchText(value: string) {
    this._propertyTabletSearchText = value;
    this.handlePropertySearch();
  }

  get propertyTableButtonAction(): ButtonType {
    return this._propertyTableButtonAction;
  }

  set propertyTableButtonAction(value: ButtonType) {
    this._propertyTableButtonAction = value;
  }

  get propertyTableButtonOperation(): ButtonType {
    return this._propertyTableButtonOperation;
  }

  set propertyTableButtonOperation(value: ButtonType) {
    this._propertyTableButtonOperation = value;
  }

  get propertyTableTotalDataCount(): number {
    return this._propertyTableTotalDataCount;
  }

  set propertyTableTotalDataCount(value: number) {
    this._propertyTableTotalDataCount = value;
  }

  get propertyTableButtonActionTrigger(): ButtonDataType {
    return this._propertyTableButtonActionTrigger;
  }

  set propertyTableButtonActionTrigger(value: ButtonDataType) {
    this._propertyTableButtonActionTrigger = value;
    this.handlePropertyTableActionTrigger();
  }

  get propertyTableButtonOperationTrigger(): ButtonDataType {
    return this._propertyTableButtonOperationTrigger;
  }

  set propertyTableButtonOperationTrigger(value: ButtonDataType) {
    this._propertyTableButtonOperationTrigger = value;
    this.handlePropertyTableOperationTrigger(this._propertyTableButtonOperationTrigger);
  }

  get propertyTableNotification(): NotificationType {
    return this._propertyTableNotification;
  }

  set propertyTableNotification(value: NotificationType) {
    this._propertyTableNotification = value;
  }

  get propertyTableData(): PropertyCustomTableDataType[] {
    return this._propertyTableData;
  }

  set propertyTableData(value: PropertyCustomTableDataType[]) {
    this._propertyTableData = value;
  }

  get propertyTableColumns(): CustomTableColumnType[] {
    return this._propertyTableColumns;
  }

  set propertyTableColumns(value: CustomTableColumnType[]) {
    this._propertyTableColumns = value;
  }

  get propertyLength(): number {
    return this._propertyLength;
  }

  set propertyLength(value: number) {
    this._propertyLength = value;
  }

  //<=========================== End Property Table Getters And Setters ===========================>

  //<=========================== Property Common Handlers ===========================>
  protected gotoTheProperty(propertyID: string) {
    if(this.isBrowser) {
      this.router.navigate(['/dashboard/property-view', propertyID]);
    }
  }

  // Make each word first letter capitalize
  protected makeCapitalize(text: string): string {
    const data = text
      .split(' ')
      .map(
        (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      );

    return data.join(' ');
  }

  protected makeIcon(icon: string): string {
    return this.propertyService.investigateTheAmenityIcon(icon);
  }
  //<=========================== End Property Common Handlers ===========================>

  //<=========================== Handle Property Table Getters And Setters ===========================>
  private async handlePropertyTableReloading() {
    if(this._propertyTableIsReloading) {
      await this.getAllProperties();
      this._propertyTableIsReloading = false;
    } else {
      return;
    }
  }

  private handelPageIndex() {
    const pageIndex = this._propertyTablePageIndex;
    const pageSize = this._propertyTablePageSize;
    this.makePropertyTablePagination(pageIndex, pageSize);
  }

  private handlePropertyTableActionTrigger() {
    const propertyID = this._propertyTableButtonActionTrigger.data.element.id;
    this.gotoTheProperty(propertyID);
  }

  private async handlePropertyTableOperationTrigger(input: any) {
    try {
      const propertyID = typeof input === 'string' ? input :
        this._propertyTableButtonOperationTrigger.data.element.id;

      if(!propertyID) throw new Error('Could not found property ID!')

      const leaseResponse = await this.tenantService.getAllLeases();

      if(leaseResponse.status !== 'success') throw new Error('Could not found leases!');

      const leases = leaseResponse.data as Lease[];

      const isPropertySelected = leases.some(
        (lease: Lease) => lease.propertyID === propertyID && lease.leaseID !== this.leaseID
      );

      if(isPropertySelected) throw new Error('Property is already selected!');

      const selectedProperty = this.properties.find((property: BackEndPropertyData) => property.id === propertyID);

      if(!selectedProperty) throw new Error('Could not found property!');

      this.registerProperty(selectedProperty);
    }
    catch(error) {
      if(error instanceof HttpErrorResponse) this.notification.notification('error', error.error.message);
      else if(typeof error === 'string') this.notification.notification('error', error);
      else if(error instanceof Error) this.notification.notification('error', error.message);
      else this.notification.notification('error', 'Unknown error occurred!');
      return;
    }
  }

  private handlePropertySearch(): void {
    const filterValue = this._propertyTabletSearchText.toLowerCase().trim();

    if(filterValue) {
      this.propertyTableData = [];

      const filterData = this.properties.filter((item) => {
        return (
          item.listing.toLowerCase().includes(filterValue) ||
          item.furnishingStatus.toLowerCase().includes(filterValue) ||
          item.projectName?.toLowerCase().includes(filterValue) ||
          item.title?.toLowerCase().includes(filterValue) ||
          item.developerName?.toLowerCase().includes(filterValue) ||
          item.type?.toLowerCase().includes(filterValue) ||
          item.builtYear?.toString().includes(filterValue) ||
          item.description?.toLowerCase().includes(filterValue) ||
          item.address.city?.toLowerCase().includes(filterValue) ||
          item.address.country?.toLowerCase().includes(filterValue) ||
          item.address.street?.toLowerCase().includes(filterValue) ||
          item.address.stateOrProvince?.toLowerCase().includes(filterValue)
        );
      });

      const data: PropertyCustomTableDataType[] = [];

      filterData.forEach((item) => {
        const property: PropertyCustomTableDataType = {
          image: item.images[0].imageURL,
          id: item.id,
          type: item.type,
          listing: item.listing,
          furnishingStatus: item.furnishingStatus,
          developerName: item.developerName,
          title: item.title,
          builtYear: item.builtYear,
          projectName: item.projectName,
          address: `No.${item.address.houseNumber},<br/>
            ${item.address.street},<br/>
            ${item.address.city},<br/>
            ${item.address.stateOrProvince},<br/>
            ${item.address.country},<br/>
            ${item.address.postcode}`,
        };
        data.push(property);
      });

      if(data.length > 0) {
        const pageOptions: number[] = [];

        for(let i = 1; i < data.length; i++) {
          if(i % this.propertyTablePageSize !== 0) continue;
          pageOptions.push(i);
        }

        if(pageOptions.length === 0) {
          pageOptions.push(data.length);
        }

        // Defined page size options
        this.propertyTablePageSizeOptions = pageOptions;

        // Defined table page count
        this.propertyTablePageCount = Math.ceil(
          data.length / this.propertyTablePageSize
        );

        this.propertyLength = data.length;

        // Assign data to the table that will be displayed
        const tableData = data.slice(
          this.propertyTablePageSize * 0,
          this.propertyTablePageSize * (0 + 1)
        );

        this.propertyTableData = tableData;

        this.cdr.detectChanges();
      } else {
        this.notification.notification('warning', 'No data found!');
      }
    } else {
      this.makePropertyTablePagination(
        this.propertyTablePageIndex,
        this.propertyTablePageSize
      );
    }
  }

  private makePropertyTablePagination(index: number, pageSize: number): void {
    // Make the data reload before start
    this.propertyTableIsReloading = true;

    // Assign the all properties to the variable
    const allData = this.properties;

    // Process the page size options
    const pageOptions: number[] = [];
    for(let i = 1; i < allData.length; i++) {
      if(i % pageSize !== 0) continue;
      pageOptions.push(i);
    }

    if(pageOptions.length === 0) {
      pageOptions.push(allData.length);
    }

    // Defined page size options
    this.propertyTablePageSizeOptions = pageOptions;

    // Defined table page count
    this.propertyTablePageCount = Math.ceil(allData.length / pageSize);

    // Defined tabal type and name
    this.propertyTableType = 'Property';

    // Defined button types
    this.propertyTableButtonAction = {
      type: 'view',
    };
    this.propertyTableButtonOperation = {
      type: 'add',
    };

    this.propertyTablePageSize = pageSize;

    // Assign data to the table that will be displayed
    const data = allData.slice(pageSize * index, pageSize * (index + 1));

    //Organize data
    const organizedData: PropertyCustomTableDataType[] = [];
    data.forEach((item) => {
      const property: PropertyCustomTableDataType = {
        image: item.images[0].imageURL,
        id: item.id,
        type: item.type,
        listing: item.listing,
        furnishingStatus: item.furnishingStatus,
        developerName: item.developerName,
        title: item.title,
        builtYear: item.builtYear,
        projectName: item.projectName,
        address: `No.${item.address.houseNumber},<br/>
        ${item.address.street},<br/>
        ${item.address.city},<br/>
        ${item.address.stateOrProvince},<br/>
        ${item.address.country},<br/>
        ${item.address.postcode}`,
      };
      organizedData.push(property);
    });

    this.propertyTableData = organizedData;
    // Defined total table data count of data
    this.propertyTableTotalDataCount = allData.length;

    // Defined the table columns
    this.propertyTableColumns = [
      {key: 'propertyimage', label: 'Image'},
      {key: 'type', label: 'Type'},
      {key: 'listing', label: 'Listing'},
      {key: 'furnishingStatus', label: 'Furnishing Status'},
      {key: 'developerName', label: 'Developer Name'},
      {key: 'projectName', label: 'Project Name'},
      {key: 'title', label: 'Title'},
      {key: 'builtYear', label: 'Built Year'},
      {key: 'address', label: 'Address'},
      {key: 'actions', label: 'View'},
      {key: 'operation', label: 'Add'},
    ];

    // Defined the total data count (full array length)
    this.propertyLength = allData.length;

    this.propertyTableIsReloading = false;
    this.cdr.detectChanges();
  }
  //<=========================== End Handle Property Table Getters And Setters ===========================>

  private registerProperty(property: BackEndPropertyData) {
    try {
      if(!property) {this.resetProperty(); throw new Error("Could not find the property!");}

      // Assigning the property
      this.selectedProperty = property;

      // Reset selection
      this.isPropertySelected = false;

      // Basic identification
      this.propertyId = property.id;
      this.propertyTitle = this.makeCapitalize(property.title);

      // Location (Geographic coordinates and map)
      this.location = property.location;
      this.propertylocaaationLat = property.location?.lat ?? 0;
      this.propertylocaaationLng = property.location?.lng ?? 0;
      this.propertyGeoLocation = property.location?.embeddedUrl ?? '';

      // Address details
      this.propertyHouserNumber = this.makeCapitalize(
        property.address.houseNumber
      );
      this.propertyStreet = this.makeCapitalize(
        property.address.street as string
      );
      this.propertyCity = this.makeCapitalize(property.address.city);
      this.propertyStateOrProvince = this.makeCapitalize(
        property.address.stateOrProvince as string
      );
      this.propertyPostalCode = property.address.postcode;
      this.propertyCountry = this.makeCapitalize(property.address.country);

      // Classification and listing
      this.propertyType = this.makeCapitalize(property.listing);
      this.furnishingStatus = this.makeCapitalize(property.furnishingStatus);

      // Developer/project metadata
      this.propertyDeveloperName = this.makeCapitalize(property.developerName);
      this.propertyProjectName = this.makeCapitalize(
        property.projectName as string
      );
      this.propertyBuiltYear = property.builtYear;

      // Features and amenities
      property.featuresAndAmenities.forEach((item) => {
        const amenity = this.makeCapitalize(item);
        this.includedAmenities.push(amenity);
      });

      this.parkingSpots = property.numberOfParking;
      this.isPropertySelected = true;
    }
    catch(error) {
      console.log(error);
      if(typeof error === "string") this.notification.notification('error', error);
      if(error instanceof Error) this.notification.notification('error', error.message);
      return;
    }
    finally {
      this.cdr.detectChanges()
    }
  }

  private resetProperty() {
    // Reset selection
    this.isPropertySelected = false;

    // Basic identification
    this.propertyId = '';
    this.propertyTitle = '';

    // Location (Geographic coordinates and map)
    this.location = undefined;
    this.propertylocaaationLat = 0;
    this.propertylocaaationLng = 0;
    this.propertyGeoLocation = '';

    // Address details
    this.propertyHouserNumber = '';
    this.propertyStreet = '';
    this.propertyCity = '';
    this.propertyStateOrProvince = '';
    this.propertyPostalCode = '';
    this.propertyCountry = '';

    // Classification and listing
    this.propertyType = '';
    this.furnishingStatus = '';

    // Developer/project metadata
    this.propertyDeveloperName = '';
    this.propertyProjectName = '';
    this.propertyBuiltYear = 0;

    // Features and amenities
    this.includedAmenities = [];
    this.parkingSpots = 0;
  }

  //<=========================== End Property Infomations ===========================>

  //<=========================== Lease Agreement ===========================>

  //<=========================== Getter and Setter ===========================>
  get startDate(): Date {
    return this._startDate;
  }

  set startDate(value: Date) {
    this._startDate = value;
    this.handleStartDate();
  }

  get endDate(): Date {
    return this._endDate;
  }

  set endDate(value: Date) {
    this._endDate = value;
    this.handleEndDate();
  }

  get durationMonths(): number {
    return this._durationMonths;
  }

  set durationMonths(value: number) {
    this._durationMonths = value;
    this.handleDurationMonths();
  }

  //<=========================== End Getter and Setter ===========================>

  //<=========================== Handlers ===========================>

  //<=========================== Handle The Start Date Operation ===========================>
  private handleStartDate(): void {
    if(this._durationMonths > 0) {
      const start = new Date(this._startDate);
      const newEnd = new Date(start);
      newEnd.setMonth(start.getMonth() + this._durationMonths);
      this._endDate = newEnd;
    } else if(this._endDate) {
      const start = new Date(this._startDate);
      const end = new Date(this._endDate);
      const months = this.calculateMonthDiff(start, end);
      this._durationMonths = months;
    }
  }
  //<=========================== End Handle The Start Date Operation ===========================>

  //<=========================== Handle The End Date Operation ===========================>
  private handleEndDate(): void {
    if(this._startDate) {
      const start = new Date(this._startDate);
      const end = new Date(this._endDate);
      const months = this.calculateMonthDiff(start, end);
      this._durationMonths = months;
    } else if(this._durationMonths > 0) {
      const end = new Date(this._endDate);
      const newStart = new Date(end);
      newStart.setMonth(end.getMonth() - this._durationMonths);
      this._startDate = newStart;
    }
  }
  //<=========================== End Handle The End Date Operation ===========================>

  //<=========================== Handle The Duration Months Operation ===========================>
  private handleDurationMonths(): void {
    if(this._startDate) {
      const start = new Date(this._startDate);
      const newEnd = new Date(start);
      newEnd.setMonth(start.getMonth() + this._durationMonths);
      this._endDate = newEnd;
    } else if(this._endDate) {
      const end = new Date(this._endDate);
      const newStart = new Date(end);
      newStart.setMonth(end.getMonth() - this._durationMonths);
      this._startDate = newStart;
    }
  }
  //<=========================== End Handle The Duration Months Operation ===========================>

  //<=========================== Handle Currency Change Operation ===========================>
  protected handleCurrencyFilterChange(input: string): void {
    let filterValue = '';

    if(typeof input === 'string') {
      filterValue = input.toLowerCase().trim();
    } else if(input && typeof input === 'object' && 'currency' in input) {
      filterValue = (input as CurrencyFormat).currency.toLowerCase();
    } else {
      filterValue = '';
    }

    this.filterCurrencies$ = of(this.currencies).pipe(
      map((items: CurrencyFormat[]) =>
        items.filter(
          (item) =>
            item.country.toLowerCase().includes(filterValue) ||
            item.currency.toLowerCase().includes(filterValue)
        )
      )
    );

    this.filterCurrencies$.subscribe((currencies) => {
      if(currencies.length === 1) this._currency = currencies[0];
      else this._currency = null;
    });
  }

  protected onCurrencySelectionChange(input: MatAutocompleteSelectedEvent): void {
    const value = input.option.value as CurrencyFormat;
    this.currencyLeaseAgreement = value.currency;
    this._currency = value;
  }

  protected displayCurrency(currency: CurrencyFormat): string {
    if(!currency) return '';
    return typeof currency === 'string' ? currency : currency?.currency ?? '';
  }
  //<=========================== End Handle Currency Change Operation ===========================>

  //<=========================== Handle Payment Frequency Change Operation ===========================>
  protected handlePaymentFrequencyFilterChange(input: string): void {
    let filterValue = '';
    if(typeof input === 'string') {
      filterValue = input.toLowerCase().trim();
    } else if(input && typeof input === 'object' && 'name' in input) {
      filterValue = (input as PaymentFrequency).name.toLowerCase();
    } else {
      filterValue = '';
    }

    this.filterPaymentFrequencies$ = of(this.paymentFrequencies).pipe(
      map((items: PaymentFrequency[]) =>
        items.filter(
          (item) =>
            item.name.toLowerCase().includes(filterValue) ||
            (item.unit && item.unit.toLowerCase().includes(filterValue))
        )
      )
    );

    this.filterPaymentFrequencies$.subscribe((paymentFrequencies) => {
      if(paymentFrequencies.length === 1)
        this.paymentFrequency = paymentFrequencies[0];
      else this.paymentFrequency = null;
    });
  }

  protected onPaymentFrequencySelectionChange(input: MatAutocompleteSelectedEvent): void {
    const value = input.option.value as PaymentFrequency;
    this.paymentFrequencyLeaseAgreement = value.name;
    this.paymentFrequency = value;
  }

  protected displayPaymentFrequency(
    paymentFrequency: PaymentFrequency
  ): string {
    if(!paymentFrequency) return '';
    return typeof paymentFrequency === 'string'
      ? paymentFrequency
      : paymentFrequency?.name ?? '';
  }
  //<=========================== End Handle Payment Frequency Change Operation ===========================>

  //<=========================== End Handle Payment Frequency Change Operation ===========================>
  protected handlePaymentMethodFilterChange(input: string): void {
    let filterValue = '';
    if(typeof input === 'string') {
      filterValue = input.toLowerCase().trim();
    } else if(input && typeof input === 'object' && 'name' in input) {
      filterValue = (input as PaymentMethod).name.toLowerCase();
    } else {
      filterValue = '';
    }

    this.filterPaymentMethods$ = of(this.paymentMethods).pipe(
      map((items: PaymentMethod[]) =>
        items.filter(
          (item) =>
            item.name.toLowerCase().includes(filterValue) ||
            (item.category && item.category.toLowerCase().includes(filterValue))
        )
      )
    );

    this.filterPaymentMethods$.subscribe((paymentMethods) => {
      if(paymentMethods.length === 1) {
        this.paymentMethodLeaseAgreement = paymentMethods[0].name;
        this.paymentMethod = paymentMethods[0]
      }
      else {this.paymentMethod = null};
    });
  }

  protected onPaymentMethodSelectionChange(input: MatAutocompleteSelectedEvent): void {
    const value = input.option.value as PaymentMethod;
    this.paymentMethodLeaseAgreement = value.name;
    this.paymentMethod = value;
  }

  protected displayPaymentMethod(paymentMethod: PaymentMethod): string {
    if(!paymentMethod) return '';
    return typeof paymentMethod === 'string'
      ? paymentMethod
      : paymentMethod.name ?? '';
  }
  //<=========================== End Handle Payment Frequency Change Operation ===========================>

  //<=========================== Handle Security Deposit Change Operation ===========================>
  protected handleSecurityDepositFilterChange(input: string): void {
    let filterValue = '';
    if(typeof input === 'string') {
      filterValue = input.toLowerCase().trim();
    } else if(input && typeof input === 'object' && 'type' in input) {
      filterValue = (input as SecurityDeposit).name.toLowerCase();
    } else {
      filterValue = '';
    }

    this.filterSecurityDeposits$ = of(this.securityDeposits).pipe(
      map((items: SecurityDeposit[]) =>
        items.filter((item) => item.name.toLowerCase().includes(filterValue))
      )
    );

    this.filterSecurityDeposits$.subscribe((securityDeposits) => {
      if(securityDeposits.length === 1) {
        const selected = securityDeposits[0];
        const data: SecurityDeposit = {
          id: selected.id,
          name: selected.name,
          description: `${selected.name} deposit (${selected.refundable ? 'refundable' : 'non-refundable'
            }).`,
          refundable: selected.refundable,
          isEditable: false
        };
        this.securityDepositLeaseAgreement = selected.name;
        this.securityDeposit = data;
      } else {
        this.securityDeposit = null;
      }
    });
  }

  protected onSecurityDepositSelectionChange(
    input: MatAutocompleteSelectedEvent
  ): void {
    const value = input.option.value as SecurityDeposit;
    this.securityDepositLeaseAgreement = value.name;
    const data: SecurityDeposit = {
      id: value.id,
      name: value.name,
      description: `${value.name} deposit (${value.refundable ? 'refundable' : 'non-refundable'
        }).`,
      refundable: value.refundable,
    };
    this.securityDeposit = data;
  }

  protected displaySecurityDeposit(
    securityDeposit: SecurityDeposit
  ): string {
    if(!securityDeposit) return '';
    return typeof securityDeposit === 'string'
      ? securityDeposit
      : securityDeposit.name;
  }

  //<=========================== End Handle Security Deposit Change Operation ===========================>

  //<=========================== Handle Rent Due Date Change Operation ===========================>
  protected handleRentDueDateFilterChange(input: string): void {
    let filterValue = '';
    if(typeof input === 'string') {
      filterValue = input.toLowerCase().trim();
    } else if(input && typeof input === 'object' && 'label' in input) {
      filterValue = (input as RentDueDate).label.toLowerCase();
    } else {
      filterValue = '';
    }

    this.filterRentDueDates$ = of(this.rentDueDates).pipe(
      map((items: RentDueDate[]) =>
        items.filter((item) => item.label.toLowerCase().includes(filterValue))
      )
    );

    this.filterRentDueDates$.subscribe((rentDueDates) => {
      if(rentDueDates.length === 1) this.rentDueDate = rentDueDates[0];
      else this.rentDueDate = null;
    });
  }

  protected onRentDueDateSelectionChange(
    input: MatAutocompleteSelectedEvent
  ): void {
    const value = input.option.value as RentDueDate;
    this.rentDueDateLeaseAgreement = value.label;
    this.rentDueDate = value;
  }

  protected displayRentDueDate(rentDueDate: RentDueDate): string {
    if(!rentDueDate) return '';
    return typeof rentDueDate === 'string' ? rentDueDate : rentDueDate.label;
  }
  //<=========================== End Handle Rent Due Date Change Operation ===========================>

  //<=========================== Handle Late Payment Penalty Change Operation ===========================>
  protected handleLatePaymentPenaltyFilterChange(input: string): void {
    try {
      const text = input.trim();
      if(this.isValidPenaltyFormat(text)) {
        const label: LatePaymentPenalty['label'] = text;
        const type: LatePaymentPenalty['type'] = text
          .split('-')[0]
          .trim() as LatePaymentPenalty['type'];
        const afterType: string = text.split('-')[1].trim();
        if(!this.containsNumber(afterType)) {
          throw new Error('Add the number as percentage or fixed fee!');
        }
        const numbers = this.extractAllNumbers(afterType);
        const value: LatePaymentPenalty['value'] = numbers[0];
        let description: LatePaymentPenalty['description'] = ``;

        const contrastType = type.split(' ');

        switch(contrastType[0].toLowerCase()) {
          case 'fixed':
            description = `A fixed penalty of ${value} will be charged for any late payment, regardless of the amount or duration.`;
            break;
          case 'percentage':
            description = `A penalty of ${value}% will be applied to the overdue amount for late payments.`;
            break;
          case 'per-day':
            description = `A penalty of ${value} will be charged for each day the payment is overdue.`;
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

        this.latePaymentPenaltyLeaseAgreement = data.label
        this._latePaymentPenalty = data;
      } else {
        throw new Error('Follow the format!');
      }
    } catch(error) {
      this.notification.notification('error', error as string);
    }
  }

  protected addULatePaymentPenalties() {
    try {
      if(!this._latePaymentPenalty)
        throw new Error('Invalid late payment penalty!');
      if(
        this.checkLatePaymentPenaltiesExist(
          this.selectedLatePaymentPenalties,
          this._latePaymentPenalty
        )
      )
        throw new Error('Penalty already exist!');

      this.selectedLatePaymentPenalties.push(this._latePaymentPenalty);
      this._latePaymentPenalty = null;
      this.latePaymentPenaltyLeaseAgreement = '';
    } catch(error) {
      this.notification.notification('warning', String(error));
    }
  }

  protected removePaymentPenalty(
    item: LatePaymentPenalty,
    index: number
  ) {
    this.selectedLatePaymentPenalties.splice(index, 1);
    this.notification.notification('info', 'Penalty removed!');
  }

  private checkLatePaymentPenaltiesExist(
    array: LatePaymentPenalty[],
    data: LatePaymentPenalty
  ): boolean {
    return array.some((item) => {
      item.label.toLowerCase() === data.label.toLowerCase() ||
        item.type.toLowerCase() === data.type.toLowerCase();
    });
  }

  private containsNumber(input: string): boolean {
    return /\d/.test(input);
  }

  private extractAllNumbers(input: string): number[] {
    const matches = input.match(/\d{1,3}(,\d{3})*(\.\d+)?|\d+(\.\d+)?/g);
    return matches ? matches.map((n) => parseFloat(n.replace(/,/g, ''))) : [];
  }

  private isValidPenaltyFormat(input: string): boolean {
    const currencyPattern = '[A-Z]{3}'; // Matches 3-letter currency codes like USD, LKR, INR
    const amountPattern = '\\d{1,3}(,\\d{3})*(\\.\\d{1,2})?|\\d+(\\.\\d{1,2})?'; // Supports both 1,000.50 and 1000.50

    const fixedFeeRegex = new RegExp(
      `^Fixed\\s+Fee\\s+-\\s+${currencyPattern}\\s+(${amountPattern})$`,
      'i'
    );

    const percentageRegex = /^Percentage\s+-\s+\d+(\.\d+)?%\s+of\s+Due\s+Amount$/i;

    const perDayRegex = new RegExp(
      `^Per\\s+Day\\s+-\\s+${currencyPattern}\\s+(${amountPattern})\\/day$`,
      'i'
    );

    const trimmedInput = input.trim();

    return (
      fixedFeeRegex.test(trimmedInput) ||
      percentageRegex.test(trimmedInput) ||
      perDayRegex.test(trimmedInput)
    );
  }

  protected displayHint(): string {
    const currency = this.getCurrency();
    return `Please type the penalty in one of the following formats:<br/>
    <ul class="hint m-0">
    <li>Fixed Fee - ${currency} 1000</li>
    <li>Percentage - 5% of Due Amount</li>
    <li>Per Day - ${currency} 200/day</li>
    </ul>`;
  }

  private getCurrency(): string {
    if(typeof this.currencyLeaseAgreement === 'string') {
      return this.currencyLeaseAgreement;
    }
    if(
      this.currencyLeaseAgreement &&
      typeof this.currencyLeaseAgreement === 'object' &&
      'currency' in this.currencyLeaseAgreement &&
      typeof (this.currencyLeaseAgreement as any).currency === 'string'
    ) {
      return (this.currencyLeaseAgreement as {currency: string}).currency;
    }
    return 'USD';
  }
  //<=========================== End Handle Late Payment Penalty Change Operation ===========================>

  //<=========================== Handle Utility Responsibilities Change Operation ===========================>
  protected handleUtilityResponsibilitiesFilterChange(input: string): void {
    try {
      const text = input.trim();

      if(this.checkUtilityRegex(text)) {
        const dataArray = text.split('-');
        const utility = dataArray[0].trim().toLowerCase();
        const responsibleParty = dataArray[1].trim().toLowerCase();
        const responsiblePartyArray: string[] = [
          'landlord',
          'tenant',
          'shared',
          'real estate company',
        ];

        if(!utility) {
          throw new Error('Invalid utility');
        }

        if(!responsiblePartyArray.includes(responsibleParty)) {
          throw new Error('Invalid responsible party');
        }

        const id = `${this.makeCapitalize(utility)}-${this.makeCapitalize(
          responsibleParty
        )}-${new Date().toISOString()}`;

        const description = `${this.makeCapitalize(
          utility
        )} has to pay by ${this.makeCapitalize(responsibleParty)}`;

        const paidByValue = responsibleParty
          .toLowerCase()
          .trim() as UtilityResponsibility['paidBy'];

        const data: UtilityResponsibility = {
          id,
          utility: this.makeCapitalize(utility),
          paidBy: paidByValue,
          description,
          isEditable: false,
        };

        if(
          !this.checkIsUtilityExist(this.selectedUtilityResponsibilities, data)
        ) {
          this.utilityResponsibilitiesLeaseAgreement = text
          this._utilityResponsibility = data;
        }
      } else {
        throw new Error(
          'Follow the format -> "Utility Name - Responsible Party"'
        );
      }
    } catch(error) {
      this.notification.notification('warning', String(error));
    }
  }

  protected addUtilities() {
    try {
      if(!this._utilityResponsibility) throw new Error('Invalid utility!');
      this.selectedUtilityResponsibilities.push(this._utilityResponsibility);
      this.utilityResponsibilitiesLeaseAgreement = '';
      this._utilityResponsibility = null;
    } catch(error) {
      this.notification.notification('warning', String(error));
    }
  }

  protected removeUtility(item: UtilityResponsibility, index: number) {
    this.selectedUtilityResponsibilities.splice(index, 1);
    this.notification.notification('info', 'Utility removed!');
  }

  private checkIsUtilityExist(
    utilities: UtilityResponsibility[],
    utility: UtilityResponsibility
  ): boolean {
    return utilities.some(
      (item) =>
        item.utility.toLowerCase() === utility.utility.toLowerCase() &&
        item.paidBy.toLowerCase() === utility.paidBy.toLowerCase()
    );
  }

  private checkUtilityRegex(text: string): boolean {
    const utilityRegex = /^[A-Za-z\s]+-\s*[A-Za-z\s]+$/;
    return utilityRegex.test(text);
  }

  protected hintUtilityResponsibilities(): string {
    return `Type in this format <i class="fa-solid fa-arrow-right"></i> "Utility Name - Responsible Party"`;
  }

  //<=========================== End Handle Utility Responsibilities Change Operation ===========================>

  //<=========================== Handle Notice Period Days Change Operation ===========================>
  protected handleNoticePeriodDaysFilterChange(input: string): void {
    let filterValue = '';
    if(typeof input === 'string') {
      filterValue = input.toLowerCase().trim();
    } else if(input && typeof input === 'object' && 'label' in input) {
      filterValue = (input as NoticePeriod).label.toLowerCase();
    } else {
      filterValue = '';
    }

    this.filterNoticePeriodOptions$ = of(this.NoticePeriods).pipe(
      map((NoticePeriods) =>
        NoticePeriods.filter((option) => {
          return option.label.toLowerCase().includes(filterValue);
        })
      )
    );

    this.filterNoticePeriodOptions$.subscribe((noticePeriodOptions) => {
      if(noticePeriodOptions.length === 1) {
        this.noticePeriodDays = noticePeriodOptions[0];
        this.noticePeriodDaysLeaseAgreement = noticePeriodOptions[0].label;
      }
      else {this.noticePeriodDays = null;}
    });
  }

  protected onNotificationPeriodDaysSelectionChange(
    input: MatAutocompleteSelectedEvent
  ): void {
    if(input.option.value) {
      const data = input.option.value as NoticePeriod;
      this.noticePeriodDaysLeaseAgreement = data.label;
      this.noticePeriodDays = data;
    }
  }


  protected displayNotificationPeriodDays(input: NoticePeriod): string {
    if(!input) return '';
    return typeof input === 'string' ? input : input.label;
  }

  //<=========================== End Handle Notice Period Days Change Operation ===========================>

  //<=========================== Handle Rules And Regulations Change Operation ===========================>
  protected handleRulesAndRegulationsFilterChange(input: string): void {
    let filterValue = '';
    if(typeof input === 'string') {
      filterValue = input.toLowerCase().trim();
    } else if(input && typeof input === 'object' && 'rule' in input) {
      filterValue = (input as RulesAndRegulations).rule.toLowerCase();
    } else {
      filterValue = '';
    }

    this.filterRulesAndRegulations$ = of(this.rulesAndRegulationsOptions).pipe(
      map((ruleAndRegulation) =>
        ruleAndRegulation.filter((option) => {
          return option.rule.toLowerCase().includes(filterValue);
        })
      )
    );

    this.filterRulesAndRegulations$.subscribe(
      (filtered: RulesAndRegulations[]) => {
        if(filtered.length === 1) {
          // Exact or close match found — select it
          this._rulesAndRegulation = filtered[0];
          this._rulesAndRegulation.isEditable = false;
        } else if(filterValue.length > 0) {
          // No match — create new entry
          this.notification.notification(
            'info',
            'No existing match found. A new rule will be created when added.'
          );
          const capitalizedRule = this.makeCapitalize(filterValue);
          const newRule: RulesAndRegulations = {
            rule: capitalizedRule,
            description: 'Custom rule. Click edit to modify the description.',
            isEditable: false,
          };
          this._rulesAndRegulation = newRule;
        } else {
          this._rulesAndRegulation = null;
        }
      }
    );
  }

  protected handleRulesAndRegulationsAdd(): void {
    try {
      if(!this._rulesAndRegulation) {
        throw new Error('Invalid rules and regulations!');
      }

      const isInTheArray = this.selectedRuleAndRegulations.some(
        (item) =>
          this._rulesAndRegulation &&
          item.rule.toLowerCase() ===
          this._rulesAndRegulation.rule.toLowerCase()
      );

      if(!isInTheArray) {
        this.selectedRuleAndRegulations.push(this._rulesAndRegulation);
        this._rulesAndRegulation = null;
        this.rulesAndRegulation = '';
        this.filterRulesAndRegulations$ = of([]);
      } else {
        this.notification.notification(
          'warning',
          'Rule already exists in the list'
        );
      }
    } catch(error) {
      this.notification.notification(
        'error',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  protected onRulesAndRegulationsSelectionChange(
    input: MatAutocompleteSelectedEvent
  ): void {
    const data = input.option.value as RulesAndRegulations;
    this.rulesAndRegulation = data.rule;
    this._rulesAndRegulation = data;
  }

  protected displayRulesAndRegulations(input: RulesAndRegulations): string {
    if(!input) return '';
    return typeof input === 'string' ? input : input.rule;
  }

  protected handleRulesAndRegulationsRemove(
    input: RulesAndRegulations,
    index: number
  ): void {
    this.selectedRuleAndRegulations.splice(index, 1);
    this.notification.notification('info', 'Rule And Regulation removed!');
  }
  //<=========================== End Handle Rules And Regulations Change Operation ===========================>

  //<=========================== Handle Tenant Signature Change Operation ===========================>
  protected handleAddTenantSignature() {
    this.tenantSignature = null;
    this.tenantPreviewImageData = '';
    const tenantSignature = this.dialog.open(SignSignature, {
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
    });

    tenantSignature.afterClosed().subscribe((result) => {
      if(result) {
        this.tenantSignature = result;
        this.makeImagePreview(result).then((dataUri) => {
          this.tenantPreviewImageData = dataUri;
        });
      } else {
        this.notification.notification(
          'warning',
          'Tenant signature is required!'
        );
      }
    });
  }
  protected handleAddLandlordSignature() {
    this.landlordSignature = null;
    this.landloadPreviewImageData = '';
    const landloadSignature = this.dialog.open(SignSignature, {
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
    });

    landloadSignature.afterClosed().subscribe((result) => {
      if(result) {
        this.landlordSignature = result;
        this.makeImagePreview(result).then((dataUri) => {
          this.landloadPreviewImageData = dataUri;
        });
      } else {
        this.notification.notification(
          'warning',
          'Landload signature is required!'
        );
      }
    });
  }

  private makeImagePreview(input: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(reader.result as string);
      };

      reader.onerror = (error) => {
        reject(error);
      };

      reader.readAsDataURL(input);
    });
  }
  //<=========================== End Handle Tenant Signature Change Operation ===========================>

  //<=========================== End Handlers ===========================>

  //<=========================== Utility ===========================>
  private calculateMonthDiff(start: Date, end: Date): number {
    return (
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth())
    );
  }

  protected disablePastDates(date: Date | null): boolean {
    if(date === null) return false;
    const today = new Date();
    return date < today;
  }

  private async makeCurrenciesList(): Promise<void> {
    try {
      await this.apiService
        .getCustomCountryDetails()
        .then((res) => {
          const responsData = res;
          const data: CurrencyFormat[] = [];
          responsData.forEach((item) => {
            const country = item.name.common || item.name.official;
            let currency = '';
            let symbol = '';
            if(item.currencies && typeof item.currencies === 'object') {
              const currencyKeys = Object.keys(item.currencies);
              if(currencyKeys.length > 0) {
                currencyKeys.forEach((currency) => {
                  if(item.currencies && item.currencies[currency]) {
                    const organizedData: CurrencyFormat = {
                      country: country,
                      currency: Object.keys(item.currencies)[0],
                      symbol: item.currencies[currency].symbol,
                      flags: item.flags,
                    };
                    if(!data.includes(organizedData)) {
                      data.push(organizedData);
                    }
                  }
                });
              }
            }
          });
          this.currencies = data;
          this.sortCurrency();
        })
        .catch((error: HttpErrorResponse) => {
          if(error.status >= 400 && error.status < 500) {
            this.notification.notification("error", "Failed to fetch currency data. Please check your network connection or try again later.");
          }
          else if(error.status === 404) {
            this.notification.notification("error", "Currency data not found, please try again later.");
          }
          else if(error.status === 500) {
            this.notification.notification("error", "Internal server error, please try again later.");
          }
          else {
            this.notification.notification("error", "An unexpected error occurred, please try again later.");
          }
        });
    } catch(error) {
      console.error(error);
    }
  }

  private sortCurrency(): CurrencyFormat[] {
    return this.currencies.sort((a, b) => {
      if(a.country < b.country) {
        return -1;
      } else if(a.country > b.country) {
        return 1;
      } else {
        return 0;
      }
    });
  }

  private isBrowserFile(file: unknown): file is File {
    return typeof File !== 'undefined' && file instanceof File;
  }
  //<=========================== End Utility ===========================>

  //<=========================== End Lease Agreement ===========================>
  //<=========================== Making The Lease Agreement By Submitting ===========================>
  protected async submitLeaseAgreement(): Promise<void> {
    try {
      const scannedDocuments = [...this.tenantScanedDocuments, ...this.tenantUploadedScanedDocuments];
      // Is user privilege to make lease agreement
      if(!this.leaseID) throw new Error("Lease ID is required!");

      if(!this.hasFullLeaseManagementPrivileges())
        throw new Error("You don't have full lease management privileges!");

      // Tenant information

      if(!this.tenantFullName) throw new Error('Tenant fullname is required!');

      if(!this.tenantEmail) throw new Error('Tenant email is required!');

      if(!this.isTenantEmailValid) throw new Error('Invalid tenant email!');

      if(!this.tenantPhoneCodeDetails)
        throw new Error('Tenant phone code is required!');

      if(!this.tenantPhoneCodeId)
        throw new Error('Tenant phone code is required!');

      if(!this.tenantPhoneNumber)
        throw new Error('Tenant phone number is required!');

      if(!this.tenantGender) throw new Error('Tenant gender is required!');

      if(!this.tenantNationality)
        throw new Error('Tenant nationality is required!');

      if(scannedDocuments.length === 0)
        throw new Error('Tenant scanned documents is required!');

      if(!this.tenantNicOrPassport)
        throw new Error('Tenant NIC or passport is required!');

      // Tenant Address
      if(!this.tenantHouseNumber)
        throw new Error('Tenant address house number is required!');

      if(!this.tenantStreet)
        throw new Error('Tenant address street is required!');

      if(!this.tenantCity) throw new Error('Tenant address city is required!');

      if(!this.tenantStateOrProvince)
        throw new Error('Tenant address state or privince is required!');

      if(!this._tenantCountry)
        throw new Error('Tenant address country is required!');

      if(!this.tenantPostalCode)
        throw new Error('Tenant address postcode is required!');

      if(!this.tenantPostalCode)
        throw new Error('Tenant address postcode is required!');

      // Emergency contact
      if(!this.emergencyContactName)
        throw new Error('Emergency contact person name is required!');

      if(!this.emergencyContactRelationship)
        throw new Error('Emergency contact person relationship is required!');

      if(!this.emergencyContactContact)
        throw new Error('Emergency contact is required!');

      if(!this.isEmergencyContactValid) throw new Error('Provide valid contact email or phone number!');

      // Property information
      if(!this.selectedProperty)
        throw new Error('Property is required, please select a property!');

      if(!this.propertyId)
        throw new Error('Property ID is required, please select a property!');

      if(!this.propertyTitle)
        throw new Error(
          'Property title is required, please select a property!'
        );

      if(!this.propertyType)
        throw new Error('Property type is required, please select a property!');

      if(!this.furnishingStatus)
        throw new Error(
          'Property furnishing status is required, please select a property!'
        );

      if(!this.propertyBuiltYear)
        throw new Error(
          'Property build year is required, please select a property!'
        );

      if(!this.propertyGeoLocation)
        throw new Error(
          'Property location is required, please select a property!'
        );

      if(!this.includedAmenities)
        throw new Error(
          'Property amenities is required, please select a property!'
        );

      // Lease Agreement
      if(!this.startDate) throw new Error('Lease starting date is required!');

      if(!this.endDate) throw new Error('Lease ending date is required!');

      if(!this.durationMonths)
        throw new Error('Lease duration in months is required!');

      if(!this.monthlyRent) throw new Error('Lease monthly rent is required!');

      if(!this.currencyLeaseAgreement)
        throw new Error('Lease currency is required!');

      if(!this._currency) throw new Error('Lease currency is required!');

      if(!this.paymentFrequencyLeaseAgreement)
        throw new Error('Lease payment frequency is required!');

      if(!this.paymentMethodLeaseAgreement)
        throw new Error('Lease payment method is required!');

      if(!this.securityDepositLeaseAgreement)
        throw new Error('Lease security deposit is required!');

      if(!this.rentDueDateLeaseAgreement)
        throw new Error('Lease rent due date is required!');

      if(this.selectedLatePaymentPenalties.length === 0)
        throw new Error('Lease late payment penalties are required!');

      if(this.selectedUtilityResponsibilities.length === 0)
        throw new Error('Lease utility responsibilities are required!');

      if(!this.noticePeriodDaysLeaseAgreement)
        throw new Error('Lease notice period days are required!');

      // Rule and regulations
      if(this.selectedRuleAndRegulations.length === 0)
        throw new Error('Lease rule and regulations are required!');

      // Is company policy read
      if(!this.isReadTheCompanyPolicy)
        throw new Error('Please read the company policy and confirm!');

      // Signatures
      if(!this.tenantSignature)
        throw new Error('Tenant signature is required!');

      if(!this.landlordSignature)
        throw new Error('Landlord signature is required!');

      const formData: FormData = new FormData();

      // Process and organize data
      // Organize address
      const tenantAddress = {
        houseNumber: this.tenantHouseNumber,
        street: this.tenantStreet,
        city: this.tenantCity,
        stateOrProvince: this.tenantStateOrProvince,
        country: this._tenantCountry,
        postalCode: this.tenantPostalCode,
      };

      // Organize emergency contact
      const emergencyContact = {
        name: this.emergencyContactName,
        relationship: this.emergencyContactRelationship,
        contact: this.emergencyContactContact,
      };

      // Organize system meta data
      const systemMetaData = {
        ocrAutoFillStatus: this.ocrAutoFillStatus,
        validationStatus: this.validationStatus,
        language: this.language,
        leaseTemplateVersion: this.leaseTemplateVersion,
        lastUpdated: this.lastUpdated,
      };

      this.progress.start();

      // Lease ID

      formData.append('leaseID', this.leaseID);

      // Tenant Information
      formData.append('tenantUsername', this.tenant?.username.trim() ?? '');
      formData.append('tenantFullName', this.tenantFullName.trim());
      formData.append('tenantEmail', this.tenantEmail.trim());
      formData.append('tenantNationality', this.tenantNationality.trim());

      formData.append(
        'tenantDateOfBirth',
        this.tenantDateOfBirth.toISOString().trim()
      );

      formData.append(
        'tenantPhoneCodeDetails',
        JSON.stringify(this.tenantPhoneCodeDetails)
      );
      formData.append(
        'tenantPhoneNumber', this.tenantPhoneNumber.trim()
      );
      formData.append('tenantGender', this.tenantGender.trim());
      formData.append('tenantNICOrPassport', this.tenantNicOrPassport.trim());

      // Tenant scanned documents section
      if(this.tenantScanedDocuments.length > 0) {
        this.tenantScanedDocuments.forEach((item) => {
          formData.append('tenantScanedDocuments', item);
        });
      }
      formData.append(
        'tenantUploadedScanedDocuments',
        JSON.stringify(this.tenantUploadedScanedDocuments)
      );
      formData.append(
        'tenantUploadedScanedDocumentsRemoved',
        JSON.stringify(this.tenantUploadedScanedDocumentsRemoved)
      );

      // Address
      formData.append('tenantAddress', JSON.stringify(tenantAddress));

      // Emergency contact
      formData.append('emergencyContact', JSON.stringify(emergencyContact));

      // Co-Tenant
      formData.append('coTenantFullname', this.coTenantFullName.trim());
      formData.append('coTenantEmail', this.coTenantEmail.trim());
      formData.append('coTenantPhoneCodeId', this.coTenantPhoneCodeId.trim());
      formData.append(
        'coTenantPhoneNumber', this.coTenantPhoneNumber.trim()
      );
      formData.append('coTenantGender', this.coTenantGender.trim());
      formData.append(
        'coTenantNicOrPassport',
        this.coTenantNicOrPassport.trim()
      );
      formData.append('coTenantAge', String(this.coTenantAge).trim());
      formData.append('coTenantRelationship', this.coTenantRelationship.trim());

      // Property Information
      formData.append(
        'selectedProperty',
        JSON.stringify(this.selectedProperty)
      );

      // Lease Agreement
      formData.append('startDate', this.startDate.toISOString().trim());
      formData.append('endDate', this.endDate.toISOString().trim());
      formData.append('durationMonths', String(this.durationMonths).trim());
      formData.append('monthlyRent', String(this.monthlyRent).trim());
      formData.append('currency', JSON.stringify(this._currency));
      formData.append(
        'paymentFrequency',
        JSON.stringify(this.paymentFrequency)
      );
      formData.append('paymentMethod', JSON.stringify(this.paymentMethod));
      formData.append('securityDeposit', JSON.stringify(this.securityDeposit));
      formData.append('rentDueDate', JSON.stringify(this.rentDueDate));
      formData.append(
        'selectedLatePaymentPenalties',
        JSON.stringify(this.selectedLatePaymentPenalties)
      );
      formData.append(
        'selectedUtilityResponsibilities',
        JSON.stringify(this.selectedUtilityResponsibilities)
      );
      formData.append(
        'noticePeriodDays',
        JSON.stringify(this.noticePeriodDays)
      );

      // Rules and regulations
      formData.append(
        'selectedRuleAndRegulations',
        JSON.stringify(this.selectedRuleAndRegulations)
      );

      // Check whether user read the company policy
      formData.append(
        'isReadTheCompanyPolicy',
        String(this.isReadTheCompanyPolicy)
      );



      // // Tenant signature
      // formData.append('tenantSignature', this.tenantSignature as File);
      // // Landlord signature
      // formData.append('landlordSignature', this.landlordSignature as File);

      // Tenant signature
      if(this.isBrowserFile(this.tenantSignature)) {
        formData.append('tenantSignature', this.tenantSignature);
      } else {
        formData.append('tenantOldSignature', JSON.stringify(this.tenantSignature));
      }

      // Landlord signature
      if(this.isBrowserFile(this.landlordSignature)) {
        formData.append('landlordSignature', this.landlordSignature);
      } else {
        formData.append('landlordOldSignature', JSON.stringify(this.landlordSignature));
      }

      formData.append('signedAt', this.signedAt.toISOString().trim());
      formData.append('ipAddress', this.ipAddress.trim());
      formData.append('userAgent', JSON.stringify(this.userAgent));

      // System meta data ocrAutoFillStatus
      formData.append('systemMetaData', JSON.stringify(systemMetaData));

      // Call the api
      await this.tenantService
        .updateLeaseAgreement(formData, this.leaseID)
        .then((res) => {
          if(res.status === 'success') {
            this.notification.notification(
              res.status,
              res.message
            );
          } else {
            this.notification.notification(
              res.status,
              res.message
            );
          }
          setTimeout(() => {
            this.goToTenant();
          }, 1000);
        })
        .catch((error: HttpErrorResponse) => {
          console.error(error);
          if(error.status >= 400 && error.status < 500) {
            this.notification.notification("error", "Failed to submit lease agreement. Please check your input and try again.");
          }
          else if(error.status === 404) {
            this.notification.notification("error", "Lease agreement not found, please try again later.");
          }
          else if(error.status === 500) {
            this.notification.notification("error", "Internal server error, please try again later.");
          }
          else {
            this.notification.notification("error", "An unexpected error occurred, please try again later.");
          }
        })
        .finally(() => {
          this.progress.complete();
        });
    } catch(error) {
      console.error(error);
      const status = 'error';
      let messsage: string;
      if(error instanceof Error) {
        messsage = error.message;
      } else if(
        typeof error === 'object' &&
        error !== null &&
        'error' in error &&
        typeof (error as any).error === 'object' &&
        (error as any).error !== null &&
        'message' in (error as any).error
      ) {
        messsage = (error as any).error.message as string;
      } else {
        messsage = 'An unknown error occurred';
      }
      this.notification.notification(status, messsage);
    }
  }
  //<=========================== End Making The Lease Agreement By Submitting ===========================>
}
