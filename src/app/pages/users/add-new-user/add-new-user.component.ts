// Path: src/app/pages/users/add-new-user/add-new-user.component.ts

// ──────────────────────────────────────────────────────────────────────────────
// Angular core / common
// ──────────────────────────────────────────────────────────────────────────────
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import {
  AsyncPipe,
  CommonModule,
  isPlatformBrowser,
} from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

// ──────────────────────────────────────────────────────────────────────────────
// Forms / Material
// ──────────────────────────────────────────────────────────────────────────────
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';

// ──────────────────────────────────────────────────────────────────────────────
// Angular router / platform
// ──────────────────────────────────────────────────────────────────────────────
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';

// ──────────────────────────────────────────────────────────────────────────────
// Third-party components
// ──────────────────────────────────────────────────────────────────────────────
import { EditorComponent } from '@tinymce/tinymce-angular';
import {
  ImageCropperComponent,
  ImageCroppedEvent,
} from 'ngx-image-cropper';

// ──────────────────────────────────────────────────────────────────────────────
// RxJS
// ──────────────────────────────────────────────────────────────────────────────
import { Observable, Subscription } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

// ──────────────────────────────────────────────────────────────────────────────
// Shared components / dialogs
// ──────────────────────────────────────────────────────────────────────────────
import {
  NotificationDialogComponent,
  msgTypes,
} from '../../../components/dialogs/notification/notificationBar.component';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import { CameraBoxComponent } from '../../../components/dialogs/camera-box/camera-box.component';
import { TextEditorComponent } from '../../../components/shared/textEditor/text-editor';

// ──────────────────────────────────────────────────────────────────────────────
// Services and types
// ──────────────────────────────────────────────────────────────────────────────
import {
  APIsService,
  Country,
  DEFAULT_ROLES,
  PermissionEntry,
  ROLE_ACCESS_MAP,
  type User,
} from '../../../services/APIs/apis.service';
import {
  AuthService
} from '../../../services/auth/auth.service';
import { Role } from '../../../services/APIs/apis.service';
import {
  ACCESS_OPTIONS,
  AccessModuleOption,
  AccessModuleKey,
  AccessActionKey,
} from '../../../source/access-map.source';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import { UserControllerService } from '../../../services/userController/user-controller.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';

// ──────────────────────────────────────────────────────────────────────────────
// Local interfaces
// ──────────────────────────────────────────────────────────────────────────────


interface userActiveStatusType {
  typeName: string;
  isActive: boolean;
}

interface MODEL_CHECK {
  model: string;
  check: boolean;
  action: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

@Component( {
  selector: 'app-add-new-user',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    // Material
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatAutocompleteModule,
    AsyncPipe,
    MatDatepickerModule,
    MatMomentDateModule,
    MatSelectModule,
    MatDividerModule,
    MatDialogModule,
    MatProgressBarModule,
    // App components
    NotificationDialogComponent,
    ProgressBarComponent,
    ImageCropperComponent,
    CameraBoxComponent,
    TextEditorComponent,
  ],
  templateUrl: './add-new-user.component.html',
  styleUrl: './add-new-user.component.scss',
} )
export class AddNewUserComponent
  implements OnInit, OnDestroy, AfterViewInit {
  // ──────────────────────────────────────────────────────────────────────────
  // ViewChild references
  // ──────────────────────────────────────────────────────────────────────────

  @ViewChild( 'fileInput' )
  fileInput!: ElementRef<HTMLInputElement>;

  @ViewChild( ProgressBarComponent )
  progress!: ProgressBarComponent;

  @ViewChild( NotificationDialogComponent )
  notification!: NotificationDialogComponent;

  @ViewChild( ImageCropperComponent )
  imageCropper!: ImageCropperComponent;

  @ViewChild( CameraBoxComponent )
  cameraBox!: CameraBoxComponent;

  // ──────────────────────────────────────────────────────────────────────────
  // Theme / platform / auth state
  // ──────────────────────────────────────────────────────────────────────────

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  private loogedUser: User | null = null; // (kept name as-is for template compatibility)

  // ──────────────────────────────────────────────────────────────────────────
  // User list / page state (currently unused for creation, but kept)
  // ──────────────────────────────────────────────────────────────────────────
  protected users: User[] = [];
  protected pageCount: number = 0;
  protected currentPage: number = 0;
  protected search: string = '';
  protected loading: boolean = true;

  // ──────────────────────────────────────────────────────────────────────────
  // Avatar / image state
  // ──────────────────────────────────────────────────────────────────────────

  protected readonly definedMaleDummyImageURL: string =
    'Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL: string =
    'Images/user-images/dummy-user/dummy_woman.jpg';
  protected definedImage: string =
    'Images/user-images/dummy-user/dummy-user.jpg';

  protected userUploadedImage: string = '';

  // Cropper state
  protected selectedImageChangedEvent: any = null;
  protected croppedImageBase64: string = '';
  protected showCropper: boolean = false;
  protected croppedImage: any = '';

  protected isDragOver: boolean = false;
  protected isCameraOpen: boolean = false;

  // Final uploaded file
  protected userimage: File | null = null;

  // TinyMCE init
  init: EditorComponent[ 'init' ] = {
    plugins: 'lists link image table code help wordcount',
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Country / autocomplete
  // ──────────────────────────────────────────────────────────────────────────

  protected countryControl = new FormControl<string>( '' );
  protected typedCountry: Country | string | null = '';
  protected countries: Country[] = [];
  protected filteredCountries!: Observable<Country[]>;

  // ──────────────────────────────────────────────────────────────────────────
  // Validation patterns / flags
  // ──────────────────────────────────────────────────────────────────────────

  protected isValidAge: boolean = false;
  protected isUsernameExist: boolean = false;
  protected hidePassword: boolean = true;

  private readonly strongPasswordPattern: RegExp =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,}$/;
  private readonly usernamePattern: RegExp = /^[a-zA-Z0-9._-]{4,20}$/;
  private readonly emailPattern: RegExp =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  protected usernameMatchPattern: boolean = true;
  protected passwordMatchPattern: boolean = true;

  protected isEmailError: boolean = false;
  protected emailErrorMessage: string = '';

  protected isPhoneError: boolean = false;
  protected phoneErrorMessage: string = '';

  // ──────────────────────────────────────────────────────────────────────────
  // User data fields
  // ──────────────────────────────────────────────────────────────────────────

  protected username: string = '';
  protected password: string = '';
  protected fullname: string = '';
  protected email: string = '';
  protected phone: string = '';
  protected street: string = '';
  protected houseNumber: string = '';
  protected city: string = '';
  protected postcode: string = '';
  protected stateOrProvince: string = '';
  protected role: string = '';
  protected age: string = '';
  protected dateOfBirth: Date = new Date();
  protected isActive: boolean = false;
  protected updatedAt: Date = new Date();
  protected createdAt: Date = new Date();
  protected userGender: string = '';
  protected userBio: string = '';
  protected bioData: string = '';

  protected modelCheck: MODEL_CHECK = {
    model: '',
    check: false,
    action: '',
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Access / roles
  // ──────────────────────────────────────────────────────────────────────────

  /** Full access catalogue used by the template */
  protected readonly accessOptions: ReadonlyArray<AccessModuleOption> = ACCESS_OPTIONS;

  /** Canonical permission catalogue – used for lookups (never mutated) */
  protected readonly allPermissionAccesses: ReadonlyArray<AccessModuleOption> = ACCESS_OPTIONS;

  /**
   * Current selection of access for the chosen role.
   * This is the ONLY source of truth we will send to backend.
   */
  private originalSelectionOfAccess: ROLE_ACCESS_MAP | null = null;

  // defined roles
  protected readonly definedRole: Role[] = [
    'admin',
    'agent',
    'tenant',
    'owner',
    'operator',
    'manager',
    'developer',
    'user',
  ];

  // User status choices
  protected readonly userActiveStatus: userActiveStatusType[] = [
    { typeName: 'Active', isActive: true },
    { typeName: 'Inactive', isActive: false },
  ];

  // Genders
  protected readonly definedGender: string[] = [
    'Male',
    'Female',
    'Other',
  ];


  // ──────────────────────────────────────────────────────────────────────────
  // Constructor
  // ──────────────────────────────────────────────────────────────────────────

  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly activeRouter: ActivatedRoute,
    private readonly router: Router,
    private readonly apiService: APIsService,
    private readonly crypto: CryptoService,
    private readonly matIconRegistry: MatIconRegistry,
    private readonly domSanitizer: DomSanitizer,
    private readonly authService: AuthService,
    private readonly userControlService: UserControllerService,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.activeRouter.url.subscribe( () => {
      // reserved for future
    } );
    this.registerIcons();
    this.loogedUser = this.authService.getLoggedUser;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ──────────────────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      // Global drag/drop prevention for browser only
      window.addEventListener( 'dragover', this.preventDefault, {
        passive: false,
      } );
      window.addEventListener( 'drop', this.preventDefault, {
        passive: false,
      } );

      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }
  }

  ngAfterViewInit(): void {
    // View initialized – file input and cropper are ready
  }

  ngOnDestroy(): void {
    if ( this.isBrowser ) {
      window.removeEventListener( 'dragover', this.preventDefault );
      window.removeEventListener( 'drop', this.preventDefault );
    }

    this.modeSub?.unsubscribe();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Shared helpers
  // ──────────────────────────────────────────────────────────────────────────

  private notifyError(
    error: unknown,
    fallbackMessage: string,
  ): void {
    console.error( error );

    if ( !this.notification ) {
      return;
    }

    if ( error instanceof HttpErrorResponse ) {
      const msg = error.error?.message ?? error.message;
      this.notification.notification( 'error', msg );
      return;
    }

    if ( typeof error === 'string' ) {
      this.notification.notification( 'error', error );
      return;
    }

    if ( error instanceof Error ) {
      this.notification.notification( 'error', error.message );
      return;
    }

    this.notification.notification( 'error', fallbackMessage );
  }



  // ──────────────────────────────────────────────────────────────────────────
  // Icon registration
  // ──────────────────────────────────────────────────────────────────────────

  private registerIcons(): void {
    const icons = [
      { name: 'camera', path: 'Images/Icons/camera.svg' },
      { name: 'upload', path: 'Images/Icons/upload.svg' },
      { name: 'insert', path: 'Images/Icons/user-plus.svg' },
    ];

    for ( const icon of icons ) {
      this.matIconRegistry.addSvgIcon(
        icon.name,
        this.domSanitizer.bypassSecurityTrustResourceUrl( icon.path ),
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gender → dummy image
  // ──────────────────────────────────────────────────────────────────────────

  protected detectGender( value: string ): void {
    if ( value === 'Male' ) {
      this.definedImage = this.definedMaleDummyImageURL;
    } else if ( value === 'Female' ) {
      this.definedImage = this.definedWomanDummyImageURL;
    } else {
      this.definedImage = this.definedMaleDummyImageURL;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Camera capture → File
  // ──────────────────────────────────────────────────────────────────────────

  protected openCamera(): void {
    this.isCameraOpen = true;
  }

  protected closeCamera(): void {
    this.isCameraOpen = false;
  }

  protected handleImage( imageData: string ): void {
    this.userUploadedImage = imageData;
    this.userimage = this.convertToBlob( imageData );
    this.isCameraOpen = false;

    const file = this.convertToBlob( imageData );
    const dt = new DataTransfer();
    dt.items.add( file );

    const simulatedEvent = {
      target: {
        files: dt.files,
      },
    };

    this.onFileSelected( simulatedEvent );
  }

  protected convertToBlob( data: string ): File {
    const byteString = atob( data.split( ',' )[ 1 ] );
    const byteArray = new Uint8Array( byteString.length );

    for ( let i = 0; i < byteString.length; i++ ) {
      byteArray[ i ] = byteString.charCodeAt( i );
    }

    const blob = new Blob( [ byteArray ], { type: 'image/png' } );
    return new File( [ blob ], 'image.png', { type: 'image/png' } );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Paste image handler
  // ──────────────────────────────────────────────────────────────────────────

  @HostListener( 'document:paste', [ '$event' ] )
  protected handlePaste( event: ClipboardEvent ): void {
    const target = event.target as HTMLElement;

    // Allow normal paste in inputs / editable fields
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.hasAttribute( 'contenteditable' )
    ) {
      return;
    }

    event.preventDefault();

    const items = event.clipboardData?.items;
    if ( !items ) return;

    for ( const item of items ) {
      if ( item.kind === 'file' ) {
        const file = item.getAsFile();
        if ( file ) {
          this.processPastedFile( file );
        }
      }
    }
  }

  protected processPastedFile( file: File ): void {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add( file );

    const input = this.fileInput.nativeElement;
    input.files = dataTransfer.files;

    this.onFileSelected( { target: input } as any );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Drag & drop image
  // ──────────────────────────────────────────────────────────────────────────

  protected onDragOver( event: DragEvent ): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  protected onDragLeave( event: DragEvent ): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  protected onDrop( event: DragEvent ): void {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if ( files && files.length > 0 ) {
      const file = files[ 0 ];
      if ( file.type.startsWith( 'image/' ) ) {
        this.processDroppedFile( file );
      }
    }
  }

  protected processDroppedFile( file: File ): void {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add( file );

    const input = this.fileInput.nativeElement;
    input.files = dataTransfer.files;

    this.onFileSelected( { target: input } as any );
  }

  private preventDefault( event: Event ): void {
    event.preventDefault();
    event.stopPropagation();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Image upload + cropper
  // ──────────────────────────────────────────────────────────────────────────

  protected triggerFileInput(): void {
    // Use ViewChild instead of document.querySelector
    if ( this.fileInput?.nativeElement ) {
      this.fileInput.nativeElement.click();
    }
  }

  protected onFileSelected( event: any ): void {
    this.selectedImageChangedEvent = event;
    this.showCropper = true;
  }

  protected imageCropped( event: ImageCroppedEvent ): void {
    this.croppedImageBase64 = event.objectUrl as string;
    this.croppedImage = event;
  }

  protected saveCroppedImage(): void {
    this.userUploadedImage = this.croppedImageBase64;
    this.userimage = this.croppedImage.blob;
    this.showCropper = false;
    this.resetCropper();
  }

  protected cancelCrop(): void {
    this.userUploadedImage = '';
    this.userimage = null;
    this.resetCropper();
  }

  private resetCropper(): void {
    this.selectedImageChangedEvent = null;
    this.croppedImageBase64 = '';
    this.showCropper = false;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Page indicators navigation
  // ──────────────────────────────────────────────────────────────────────────

  protected goToUsers(): void {
    this.router
      .navigateByUrl( '/', { skipLocationChange: true } )
      .then( () => this.router.navigate( [ '/dashboard/users' ] ) )
      .catch( ( err ) =>
        this.notifyError( err, 'Failed to navigate to users list.' ),
      );
  }

  protected async goToUser(): Promise<void> {
    this.router
      .navigateByUrl( '/', { skipLocationChange: true } )
      .then( () =>
        this.router.navigate( [ '/dashboard/add-new-user' ] ),
      )
      .catch( ( err ) =>
        this.notifyError(
          err,
          'Failed to navigate to add new user.',
        ),
      );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Age / date of birth
  // ──────────────────────────────────────────────────────────────────────────

  protected checkAge( value: string | number ): void {
    const age = Number( value );
    this.age = age.toString();
    this.isValidAge = age >= 18;
  }

  protected validateDateOfBirth( value: Date | string ): void {
    if ( !value ) {
      this.isValidAge = false;
      this.age = '';
      return;
    }

    const dateOfBirth = new Date( value );
    const today = new Date();

    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    const dayDiff = today.getDate() - dateOfBirth.getDate();

    if ( monthDiff < 0 || ( monthDiff === 0 && dayDiff < 0 ) ) {
      age--;
    }

    this.age = age.toString();
    this.isValidAge = age >= 18;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Country select / autocomplete
  // ──────────────────────────────────────────────────────────────────────────

  protected async onCountryChange( value: string ): Promise<void> {
    this.typedCountry = value;
    this.countries = await this.mainFilterCountries();
  }

  private async mainFilterCountries(): Promise<Country[]> {
    const countries: Country[] = await this.apiService.getCountries();
    if ( !Array.isArray( countries ) ) return [];

    this.countries = countries;
    this.filteredCountries = this.countryControl.valueChanges.pipe(
      startWith( this.typedCountry ),
      map( ( value: string | Country | null ) => {
        const name = typeof value === 'string' ? value : value?.name;
        return name
          ? this.filterCountries( name )
          : this.countries.slice();
      } ),
    );

    return this.countries;
  }

  private filterCountries( name: string ): Country[] {
    const filterValue = name.toLowerCase();
    return this.countries.filter( ( c ) =>
      c.name.toLowerCase().includes( filterValue ),
    );
  }

  protected displayFn( country: Country | string | null ): string {
    if ( typeof country === 'string' ) return country;
    return country?.name ?? '';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Username / password / email / phone validation
  // ──────────────────────────────────────────────────────────────────────────

  protected async checkUsername( event: Event ): Promise<void> {
    try {
      const input = event.target as HTMLInputElement;
      const value = input.value.trim();

      this.usernameMatchPattern = this.usernamePattern.test(
        value,
      );

      if ( !this.usernameMatchPattern ) {
        this.notification.notification(
          'warning',
          'Invalid username pattern!',
        );
      }

      const res = await this.apiService.getUserByUsername( value );

      if ( res.status !== 'success' ) {
        throw new Error( 'Failed to fetch validation!' );
      }

      const user = res.data?.system?.user;

      if ( user ) {
        this.notification.notification(
          'error',
          'Username already exsited!',
        );
      }

      this.isUsernameExist = !!user;
    } catch ( error ) {
      console.error( error );
    }
  }

  protected checkPassword( event: Event ): void {
    const input = event.target as HTMLInputElement;
    const password = input.value;
    this.passwordMatchPattern =
      this.strongPasswordPattern.test( password );
  }

  protected async checkEmail( input: string ): Promise<void> {
    try {
      if ( !this.emailPattern.test( input ) ) {
        this.isEmailError = true;
        this.emailErrorMessage = 'Invalid email format';
        return;
      }

      const checking: boolean = await this.emailValidator(
        input.trim(),
        'User',
      );

      if ( !checking ) {
        this.isEmailError = true;
        this.emailErrorMessage = 'Invalid email';
        throw new Error( 'Invalid email' );
      }

      this.isEmailError = !checking;
      this.emailErrorMessage = !checking
        ? 'Invalid email'
        : 'Valid email';

      const res = await this.apiService.getUserByEmail( input );

      if ( res.status !== 'success' ) {
        throw new Error(
          'Failed to confirm is the email exist!',
        );
      }

      const user: User | undefined = res.data?.system?.user;

      const other =
        this.apiService.extractObjectFromOther<{
          status: boolean;
        }>( res.data, 'other' );
      const status = other?.status;

      if ( user && status ) {
        this.isEmailError = true;
        this.emailErrorMessage = 'Email already exist';
        throw new Error( 'Email already exist' );
      }

      this.isEmailError = false;
      this.emailErrorMessage = '';
    } catch ( error ) {
      console.error( error );
      if ( error instanceof HttpErrorResponse ) {
        this.notification.notification(
          'error',
          error.error.message,
        );
      } else {
        this.notification.notification(
          'error',
          error as string,
        );
      }
    }
  }

  private async emailValidator(
    email: string,
    user: string,
  ): Promise<boolean> {
    try {
      const rowEmail = email.trim();
      const rowUser = user.trim();

      if ( !rowEmail ) {
        throw new Error( 'Empty email!' );
      }

      if ( !rowUser ) {
        throw new Error( 'Empty user!' );
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isMatched = emailRegex.test( rowEmail );

      if ( !isMatched ) {
        this.notification.notification(
          'warning',
          'Invalid email format!',
        );
        throw new Error( 'Invalid email format!' );
      }

      const res =
        await this.userControlService.emailValidator( rowEmail );

      if ( res.status !== 'success' ) {
        this.notification.notification(
          'error',
          `Failed to validate email of ${ rowUser }`,
        );
        throw new Error(
          `Failed to validate email of ${ rowUser }`,
        );
      }

      const validatedEmail =
        this.apiService.extractStringFromOther(
          res.data,
          'email',
        );
      const validationObj =
        this.apiService.extractObjectFromOther<{
          format: boolean;
          mx: boolean;
        }>( res.data, 'validation' );
      const domain = this.apiService.extractStringFromOther(
        res.data,
        'domain',
      );

      if ( !validatedEmail ) {
        throw new Error( 'Invalid email!' );
      }

      if ( !domain ) {
        throw new Error( 'Invalid domain!' );
      }

      if ( !validationObj?.format || !validationObj.mx ) {
        this.notification.notification(
          'error',
          `Please enter valid email address of ${ rowUser }`,
        );
        throw new Error(
          `Please enter valid email address of ${ rowUser }`,
        );
      }

      return true;
    } catch ( error ) {
      console.error( error );
      return false;
    }
  }

  protected async checkPhone( input: string ): Promise<void> {
    try {
      const safeInput = input.trim();
      const isValid =
        await this.userControlService.isPhoneNumberValid(
          safeInput,
        );
      const isExistChecking =
        await this.apiService.getUserByPhone( safeInput );

      if ( isExistChecking.status === 'error' ) {
        if ( !isValid ) {
          this.isPhoneError = true;
          this.phoneErrorMessage = 'Invalid phone number';
          throw new Error( 'Invalid phone number' );
        } else {
          this.isPhoneError = false;
          this.phoneErrorMessage = '';
        }
      } else if ( isExistChecking.status === 'success' ) {
        this.isPhoneError = true;
        this.phoneErrorMessage = isExistChecking.message;
        throw new Error( isExistChecking.message );
      }
    } catch ( error ) {
      console.error( error );
      if ( error instanceof HttpErrorResponse ) {
        this.isPhoneError = true;
        this.phoneErrorMessage = error.error.message;
      }
      this.notifyError( error, 'Phone number validation failed.' );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Role access helpers: role change, module toggle, action toggle
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 1) When role changes:
   *    - validate role
   *    - get default access map from AuthService
   *    - build ROLE_ACCESS_MAP (all default actions pre-selected)
   */
  protected whileRoleChange( role: Role ): void {
    try {
      // Keep selected role in component state
      this.role = role;

      // Validate role against DEFAULT_ROLES (array, so use includes)
      if ( !role || !DEFAULT_ROLES.includes( role ) ) {
        this.notification.notification( 'warning', 'Invalid role selection!' );
        this.originalSelectionOfAccess = null;
        return;
      }

      // Default modules for this role
      const defaultModules: ReadonlyArray<AccessModuleOption> =
        this.authService.filterDefaultAccessBaseRole( role );

      // Build canonical ROLE_ACCESS_MAP using ONLY ids from access map
      const permissions: PermissionEntry[] = defaultModules.map(
        ( mod ): PermissionEntry => ( {
          module: mod.module as AccessModuleKey,
          actions: mod.actions.map( ( a ) => a.id as AccessActionKey ),
        } ),
      );

      this.originalSelectionOfAccess = {
        role,
        permissions,
      };
    } catch ( error ) {
      console.error( error );
      this.originalSelectionOfAccess = null;
    }
  }


  /**
   * Helper: check if a module is currently selected in originalSelectionOfAccess.
   * Used by template:
   *   [checked]="hasModel(mainItem.module)"
   */
  protected hasModel( model: string ): boolean {
    if ( !this.originalSelectionOfAccess ) return false;

    return this.originalSelectionOfAccess.permissions.some(
      ( p ) => p.module.toLowerCase() === model.toLowerCase(),
    );
  }


  /**
   * Helper: check if a concrete action (by id) is selected under a module.
   * Used by template:
   *   [checked]="hasAccess(subItem.id, mainItem.module)"
   */
  protected hasAccess( accessId: string, model: string ): boolean {
    if ( !this.originalSelectionOfAccess ) return false;

    const perm = this.originalSelectionOfAccess.permissions.find(
      ( p ) => p.module.toLowerCase() === model.toLowerCase(),
    );
    if ( !perm ) return false;

    return perm.actions.some(
      ( a ) => a.toLowerCase() === accessId.toLowerCase(),
    );
  }

  /**
   * 2) When a single action checkbox is toggled.
   *    - We:
   *        • validate role
   *        • look up canonical module + action from allPermissionAccesses
   *        • add/remove that action id from originalSelectionOfAccess
   *    - If after removal, module has 0 actions, we also remove the module
   *      (so the parent module checkbox will become unchecked).
   */
  protected toggleAccess(
    isChecked: boolean,
    module: string,
    actionId: string, // this is subItem.id from template
  ): void {
    const safeRole = this.role as Role | undefined;
    if ( !safeRole || !DEFAULT_ROLES.includes( safeRole ) ) {
      return;
    }

    // Find canonical module definition
    const moduleDef = this.allPermissionAccesses.find(
      ( m ) => m.module.toLowerCase() === module.toLowerCase(),
    );
    if ( !moduleDef ) return;

    // Find canonical action definition
    const actionDef = moduleDef.actions.find(
      ( a ) => a.id.toLowerCase() === actionId.toLowerCase(),
    );
    if ( !actionDef ) return;

    // Lazily initialise our selection map if needed
    if (
      !this.originalSelectionOfAccess ||
      this.originalSelectionOfAccess.role !== safeRole
    ) {
      this.originalSelectionOfAccess = {
        role: safeRole,
        permissions: [],
      };
    }

    const perms = this.originalSelectionOfAccess.permissions;

    // Find or create the module entry
    let moduleEntry = perms.find(
      ( p ) =>
        p.module.toLowerCase() === moduleDef.module.toLowerCase(),
    );

    if ( !moduleEntry ) {
      moduleEntry = {
        module: moduleDef.module as AccessModuleKey,
        actions: [],
      };
      perms.push( moduleEntry );
    }

    const actionKey = actionDef.id as AccessActionKey;

    if ( isChecked ) {
      // Add canonical action id if missing
      if ( !moduleEntry.actions.includes( actionKey ) ) {
        moduleEntry.actions.push( actionKey );
      }
    } else {
      // Remove the action id
      const idx = moduleEntry.actions.indexOf( actionKey );
      if ( idx !== -1 ) {
        moduleEntry.actions.splice( idx, 1 );
      }

      // If no actions left → remove module entry
      if ( moduleEntry.actions.length === 0 ) {
        const mIdx = perms.indexOf( moduleEntry );
        if ( mIdx !== -1 ) {
          perms.splice( mIdx, 1 );
        }
      }
    }
  }


  /**
   * 3) When the module “select all” checkbox is toggled.
   *    - If checked → all actions in that module are selected
   *    - If unchecked → whole module removed
   */
  protected toggleModule(
    isChecked: boolean,
    module: string,
  ): void {
    const safeRole = this.role as Role | undefined;
    if ( !safeRole || !DEFAULT_ROLES.includes( safeRole ) ) {
      return;
    }

    // Find canonical module definition
    const moduleDef = this.allPermissionAccesses.find(
      ( m ) => m.module.toLowerCase() === module.toLowerCase(),
    );
    if ( !moduleDef ) return;

    // Lazily initialise selection map
    if (
      !this.originalSelectionOfAccess ||
      this.originalSelectionOfAccess.role !== safeRole
    ) {
      this.originalSelectionOfAccess = {
        role: safeRole,
        permissions: [],
      };
    }

    const perms = this.originalSelectionOfAccess.permissions;
    const idx = perms.findIndex(
      ( p ) => p.module.toLowerCase() === moduleDef.module.toLowerCase(),
    );

    if ( isChecked ) {
      // All canonical action ids for this module
      const allActionIds: AccessActionKey[] = moduleDef.actions.map(
        ( a ) => a.id as AccessActionKey,
      );

      if ( idx === -1 ) {
        perms.push( {
          module: moduleDef.module as AccessModuleKey,
          actions: allActionIds,
        } );
      } else {
        perms[ idx ].actions = allActionIds;
      }
    } else {
      // Remove entire module from permissions
      if ( idx !== -1 ) {
        perms.splice( idx, 1 );
      }
    }
  }


  /**
   * Getter used by insertNewUser().
   * If nothing was selected yet, returns an empty map for the current role.
   */
  protected getRoleAccessPayload(): ROLE_ACCESS_MAP {
    const safeRole = this.role as Role;

    if ( this.originalSelectionOfAccess && this.originalSelectionOfAccess.role === safeRole ) {
      return this.originalSelectionOfAccess;
    }

    return {
      role: safeRole,
      permissions: [],
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Insert new user
  // ──────────────────────────────────────────────────────────────────────────

  protected async insertNewUser(): Promise<boolean> {
    try {
      // Permission check


      // Required field checks (user info)
      if ( !this.fullname )
        throw new Error( 'User full name is required' );
      if ( !this.userGender )
        throw new Error( 'User gender is required' );
      if ( !this.email )
        throw new Error( 'User email is required' );
      if ( !this.phone )
        throw new Error( 'User phone is required' );
      if ( !this.houseNumber )
        throw new Error( 'User house number is required' );
      if ( !this.street )
        throw new Error( 'User street is required' );
      if ( !this.city )
        throw new Error( 'User city is required' );
      if ( !this.postcode )
        throw new Error( 'User postcode is required' );
      if ( !this.countryControl.value )
        throw new Error( 'User country is required' );
      if ( !this.dateOfBirth )
        throw new Error( 'User date of birth is required' );
      if ( !this.age ) throw new Error( 'User age is required' );
      if ( !this.isValidAge )
        throw new Error( 'User age is not valid' );
      if ( !this.isActive )
        throw new Error( 'User active status is required' );
      if ( !this.userBio )
        throw new Error( 'User bio is required' );
      if ( !this.role )
        throw new Error( 'User role is required' );

      const roleAccess = this.getRoleAccessPayload();
      if ( !roleAccess || !roleAccess.permissions.length ) {
        throw new Error( 'User access is required' );
      }

      if ( !this.password )
        throw new Error( 'User password is required' );

      if ( this.isEmailError ) {
        throw new Error( this.emailErrorMessage );
      }
      if ( this.isPhoneError ) {
        throw new Error( this.phoneErrorMessage );
      }
      if ( this.isUsernameExist ) {
        throw new Error( 'Username already exist' );
      }
      if ( !this.passwordMatchPattern ) {
        throw new Error(
          'Password does not match the pattern',
        );
      }
      if ( !this.usernameMatchPattern ) {
        throw new Error(
          'Username does not match the pattern',
        );
      }
      if ( !this.isValidAge ) {
        throw new Error(
          'User does not fit the age criteria',
        );
      }

      if ( !this.userimage ) {
        console.error( 'Image is empty!' );
        throw new Error( 'User image is required' );
      }

      // Build form data
      const formData: FormData = new FormData();
      this.progress.start();

      formData.append( 'name', this.fullname.trim() );
      formData.append( 'username', this.username.trim() );
      formData.append( 'email', this.email.trim() );
      formData.append( 'userPassword', this.password.trim() );
      formData.append( 'phoneNumber', this.phone.trim() );
      formData.append( 'role', this.role.trim() );

      formData.append(
        'access',
        JSON.stringify( roleAccess ).trim(),
      );
      formData.append(
        'isActive',
        this.isActive.toString().trim(),
      );
      formData.append(
        'dateOfBirth',
        this.dateOfBirth.toString().trim(),
      );
      formData.append( 'age', this.age.trim() );
      formData.append(
        'gender',
        this.userGender.toLowerCase().trim(),
      );
      formData.append( 'houseNumber', this.houseNumber.trim() );
      formData.append( 'street', this.street.trim() );
      formData.append( 'city', this.city.trim() );
      formData.append( 'postcode', this.postcode.trim() );
      formData.append( 'bio', this.userBio.trim() );

      if ( typeof this.typedCountry === 'string' ) {
        formData.append( 'country', this.typedCountry.trim() );
      } else {
        formData.append(
          'country',
          this.typedCountry?.name.trim() as string,
        );
      }

      formData.append(
        'stateOrProvince',
        this.stateOrProvince.trim(),
      );

      // Image
      formData.append(
        'userimage',
        this.userimage,
        `${ this.username }_image.png`,
      );

      // Email verification token
      const verifyEmail: object =
        await this.crypto.generateEmailVerificationToken();
      formData.append(
        'verifyEmail',
        JSON.stringify( verifyEmail ).trim(),
      );

      // OTP validity
      const now = new Date();
      const oneMonth = new Date(
        new Date( now.setMonth( now.getMonth() + 1 ) ).getTime(),
      );
      formData.append(
        'otpValidTime',
        JSON.stringify( { otpValidTime: oneMonth } ),
      );

      formData.append( 'multiAuthEnabled', 'false' );

      formData.append( 'updatedAt', this.updatedAt.toString() );
      formData.append( 'createdAt', this.createdAt.toString() );
      formData.append(
        'creator',
        this.loogedUser?.username as string,
      );

      const res = await this.apiService.createNewUser( formData );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to process user creation!' );
      }

      return true;
    } catch ( error ) {
      console.error( error );
      if ( error instanceof Error ) {
        this.notification?.notification(
          'error',
          error.message,
        );
      } else {
        this.notifyError( error, 'Failed to create user.' );
      }
      return false;
    } finally {
      this.progress.complete();
      setTimeout( () => {
        this.router.navigate( [ '/dashboard/users' ] );
      }, 1000 );
    }
  }
}
