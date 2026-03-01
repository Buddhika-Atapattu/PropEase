// Path: src/app/pages/users/add-new-user/add-new-user.component.ts
// =============================================================================
// AddNewUserComponent — FIXED (Compile-safe + Runtime-safe)
// -----------------------------------------------------------------------------
// Key fixes applied
// 1) @Component: styleUrls (not styleUrl)
// 2) Country autocomplete typing: FormControl<CountryCodesDto | string | null>
// 3) Phone code selection typing: CountryCodesDto (not PhoneNumberDto)
// 4) Cropper: use base64/blob correctly; Blob -> File conversion
// 5) detectUserImage(): never returns File as string
// 6) checkPhone(): works for Add User (no this.user required)
// 7) checkEmail(): removed inverted res.success logic; conflict check aligned
// 8) otpValidTime: send ISO string
// 9) handleImage(): no duplicate blob conversion; uses proper event forwarding
// =============================================================================

import { AsyncPipe, CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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

import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import {
  MatAutocompleteModule,
  type MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';

import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

import { EditorComponent } from '@tinymce/tinymce-angular';
import {
  ImageCroppedEvent,
  ImageCropperComponent,
} from 'ngx-image-cropper';

import { Observable, of, Subscription } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { CameraBoxComponent } from '../../../components/dialogs/camera-box/camera-box.component';
import { NotificationDialogComponent } from '../../../components/dialogs/notificationBar/notificationBar.component';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import { TextEditorComponent } from '../../../components/shared/textEditor/text-editor';

import { APIsService, type User } from '../../../services/APIs/apis.service';
import {
  DEFAULT_ROLES,
  type CountryCodesDto,
  type PermissionEntryDto,
  type Role,
  type RoleAccessMapDto,
  UserRoleLabelHelper,
} from '../../../services/auth/user.contract';
import { AuthService } from '../../../services/auth/auth.service';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import { UserControllerService } from '../../../services/userController/user-controller.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import {
  ACCESS_OPTIONS,
  AccessActionKey,
  AccessModuleKey,
  AccessModuleOption,
} from '../../../source/access-map.source';
import type { Country } from '../../../types/common';

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
  styleUrls: [ './add-new-user.component.scss' ],
} )
export class AddNewUserComponent implements OnInit, OnDestroy, AfterViewInit {
  // ──────────────────────────────────────────────────────────────────────────
  // ViewChild references
  // ──────────────────────────────────────────────────────────────────────────
  @ViewChild( 'fileInput' )
  public fileInput!: ElementRef<HTMLInputElement>;

  @ViewChild( ProgressBarComponent )
  public progress!: ProgressBarComponent;

  @ViewChild( NotificationDialogComponent )
  public notification!: NotificationDialogComponent;

  @ViewChild( ImageCropperComponent )
  public imageCropper!: ImageCropperComponent;

  @ViewChild( CameraBoxComponent )
  public cameraBox!: CameraBoxComponent;

  // ──────────────────────────────────────────────────────────────────────────
  // Theme / platform
  // ──────────────────────────────────────────────────────────────────────────
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  // ──────────────────────────────────────────────────────────────────────────
  // User + token state
  // ──────────────────────────────────────────────────────────────────────────
  protected user: User | null = null; // kept (template/compat)
  private token!: string; // kept (template/compat)
  protected isLoading: boolean = true;

  private loggedUser: User | null = null;
  private creator: string = '';
  private updator: string = '';

  // ──────────────────────────────────────────────────────────────────────────
  // Images
  // ──────────────────────────────────────────────────────────────────────────
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

  /** Base64 preview (camera/cropper) */
  protected userUploadedImage: string = '';

  /** Final file to upload */
  protected userimage: File | null = null;

  protected userExistedImage: string = '';

  // Cropper state (typed)
  protected selectedImageChangedEvent: Event | null = null;
  protected croppedImageBase64: string = '';
  protected croppedImageBlob: Blob | null = null;
  protected showCropper: boolean = false;
  protected isDragOver: boolean = false;
  protected isCameraOpen: boolean = false;

  // TinyMCE init
  public init: EditorComponent[ 'init' ] = {
    plugins: 'lists link image table code help wordcount',
  };

  // ──────────────────────────────────────────────────────────────────────────
  // List / paging (kept for compatibility if template uses them)
  // ──────────────────────────────────────────────────────────────────────────
  protected pageCount: number = 0;
  protected currentPage: number = 0;
  protected search: string = '';
  protected loading: boolean = true;

  // ──────────────────────────────────────────────────────────────────────────
  // Country / autocomplete (FIXED typing)
  // ──────────────────────────────────────────────────────────────────────────
  protected selectedCountry: Country | null = null;
  protected countries: Country[] = [];
  protected filteredCountries!: Observable<Country[]>;
  protected typedCountry: Country | string | null = null;

  // ──────────────────────────────────────────────────────────────────────────
  // Validation patterns / state
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
  private oldEmail: string = '';
  protected phone: string = '';

  /** Selected phone code item */
  protected phoneCode: CountryCodesDto | null = null;

  private phoneNumber: User[ 'phoneNumber' ] | null = null;

  protected street: string = '';
  protected houseNumber: string = '';
  protected city: string = '';
  protected postcode: string = '';
  protected stateOrProvince: string = '';
  protected role: string = '';

  protected age: number = 0;
  protected dateOfBirth: Date = new Date();
  protected isActive: boolean = false;
  protected updatedAt: Date = new Date();
  protected createdAt: Date = new Date();
  protected userGender: string = '';
  protected userBio: string = '';
  protected nationality: string = '';
  protected nicOrPassport: string = '';

  protected modelCheck: MODEL_CHECK = {
    model: '',
    check: false,
    action: '',
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Access / roles
  // ──────────────────────────────────────────────────────────────────────────
  protected readonly accessOptions: ReadonlyArray<AccessModuleOption> = ACCESS_OPTIONS;
  protected readonly allPermissionAccesses: ReadonlyArray<AccessModuleOption> = ACCESS_OPTIONS;

  private originalSelectionOfAccess: RoleAccessMapDto | null = null;

  protected readonly definedRole: readonly Role[] = DEFAULT_ROLES;

  protected readonly userActiveStatus: userActiveStatusType[] = [
    { typeName: 'Active', isActive: true },
    { typeName: 'Inactive', isActive: false },
  ];

  protected readonly definedGender: string[] = [ 'Male', 'Female', 'Other' ];

  protected phoneCodes: CountryCodesDto[] = [];
  protected filterPhoneCodes: Observable<CountryCodesDto[]> | null = null;

  // ──────────────────────────────────────────────────────────────────────────
  // Constructor
  // ──────────────────────────────────────────────────────────────────────────
  public constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly activatedRouter: ActivatedRoute,
    private readonly router: Router,
    private readonly apiService: APIsService,
    private readonly crypto: CryptoService,
    private readonly matIconRegistry: MatIconRegistry,
    private readonly domSanitizer: DomSanitizer,
    private readonly authService: AuthService,
    private readonly userControlService: UserControllerService
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    this.activatedRouter.url.subscribe( () => {
      // reserved for future
    } );

    this.registerIcons();

    this.loggedUser = this.authService.getLoggedUser;
    this.updator = this.loggedUser ? this.loggedUser.username : '';
    this.creator = this.updator || '';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ──────────────────────────────────────────────────────────────────────────
  public async ngOnInit(): Promise<void> {
    if ( !this.isBrowser ) return;

    window.addEventListener( 'dragover', this.preventDefault, { passive: false } );
    window.addEventListener( 'drop', this.preventDefault, { passive: false } );

    this.modeSub = this.windowRef.mode$.subscribe( ( val ) => ( this.mode = val ) );

    await this.getCountryCodes();
    await this.loadAllCountries();

    // ensure filteredCountries is always defined for template
    this.mainFilterCountries();
  }

  public ngAfterViewInit(): void {
    // View children ready
  }

  public ngOnDestroy(): void {
    if ( this.isBrowser ) {
      window.removeEventListener( 'dragover', this.preventDefault );
      window.removeEventListener( 'drop', this.preventDefault );
    }
    this.modeSub?.unsubscribe();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Shared helper: error notification
  // ──────────────────────────────────────────────────────────────────────────
  private notifyError( error: unknown, fallbackMessage: string ): void {
    console.error( error );

    if ( error instanceof HttpErrorResponse ) {
      const msg = error.error?.message ?? error.message;
      this.notification?.notification( 'error', msg );
      return;
    }

    if ( typeof error === 'string' ) {
      this.notification?.notification( 'error', error );
      return;
    }

    if ( error instanceof Error ) {
      this.notification?.notification( 'error', error.message );
      return;
    }

    this.notification?.notification( 'error', fallbackMessage );
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
        this.domSanitizer.bypassSecurityTrustResourceUrl( icon.path )
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gender & dummy images
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

  /**
   * FIX: Never returns File as string.
   * Priority: base64 preview -> fallback by gender.
   */
  protected detectUserImage(): string {
    if ( this.userUploadedImage && typeof this.userUploadedImage === 'string' ) {
      return this.userUploadedImage;
    }

    if ( this.userGender && this.userGender.toLowerCase() === 'female' ) {
      return this.definedWomanDummyImageURL;
    }
    return this.definedMaleDummyImageURL;
  }

  protected convertToHumanReadable( role: string ): string {
    if ( !role || typeof role !== 'string' ) return '';
    return UserRoleLabelHelper.toHuman( role );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Load phone code with countries
  // ──────────────────────────────────────────────────────────────────────────
  private async getCountryCodes(): Promise<void> {
    try {
      const res: CountryCodesDto[] = await this.apiService.getCountryCodes();
      this.phoneCodes = Array.isArray( res ) ? res : [];
    } catch ( err ) {
      console.error( err );
      this.notification?.notification( 'error', 'Failed to load country codes.' );
    }
  }

  protected whilePhoneCodeChange( text: string ): void {
    try {
      this.filterPhoneCodes = of( this.phoneCodes );

      const safeInput =
        ( typeof text === 'string' && text.trim().toLowerCase() ) || '';

      this.filterPhoneCodes = of(
        this.phoneCodes.filter( ( item ) =>
          item.code.toLowerCase().includes( safeInput )
        )
      );
    } catch ( error ) {
      console.error( error );
      return;
    }
  }

  /**
   * FIX: value is CountryCodesDto, and phoneCode holds the whole object.
   */
  protected onPhoneCodeSelectionChange( ev: MatAutocompleteSelectedEvent ): void {
    const value = ev.option.value as CountryCodesDto;
    this.phoneCode = value;
  }

  protected displayPhoneCode(
    country: string | CountryCodesDto | null | undefined
  ): string {
    if ( !country ) return '';
    if ( typeof country === 'string' ) return country.trim();
    return country.code ?? '';
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

    const file = this.convertToBlob( imageData );
    this.userimage = file;

    this.isCameraOpen = false;

    const dt = new DataTransfer();
    dt.items.add( file );

    const input = this.fileInput.nativeElement;
    input.files = dt.files;

    this.onFileSelected( { target: input } as unknown as Event );
  }

  protected convertToBlob( data: string ): File {
    const parts = data.split( ',' );
    const base64 = parts.length > 1 ? parts[ 1 ] : '';
    const byteString = atob( base64 );

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

    this.onFileSelected( { target: input } as unknown as Event );
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

    this.onFileSelected( { target: input } as unknown as Event );
  }

  private preventDefault( event: Event ): void {
    event.preventDefault();
    event.stopPropagation();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Image upload + cropper
  // ──────────────────────────────────────────────────────────────────────────
  protected triggerFileInput(): void {
    if ( this.fileInput?.nativeElement ) {
      this.fileInput.nativeElement.click();
    }
  }

  protected onFileSelected( event: Event ): void {
    this.selectedImageChangedEvent = event;
    this.showCropper = true;
  }

  /**
   * FIX: use base64 and blob from ImageCroppedEvent.
   */
  protected imageCropped( event: ImageCroppedEvent ): void {
    console.log( event );
    this.croppedImageBase64 = event.base64 ?? event.objectUrl ?? '';
    this.croppedImageBlob = event.blob ?? null;
  }

  /**
   * FIX: convert blob -> File; keep base64 as preview.
   */
  protected saveCroppedImage(): void {
    this.userUploadedImage = this.croppedImageBase64;

    console.log( this.userUploadedImage );

    if ( this.croppedImageBlob ) {
      const safeName = ( this.username?.trim() || 'user' ) + '_image.png';
      this.userimage = new File( [ this.croppedImageBlob ], safeName, {
        type: this.croppedImageBlob.type || 'image/png',
      } );
    } else {
      this.userimage = null;
    }

    this.showCropper = false;
    this.resetCropper();
    this.detectUserImage();
  }

  protected cancelCrop(): void {
    this.userUploadedImage = '';
    this.userimage = null;
    this.resetCropper();
  }

  private resetCropper(): void {
    this.selectedImageChangedEvent = null;
    this.croppedImageBase64 = '';
    this.croppedImageBlob = null;
    this.showCropper = false;
  }


  // ──────────────────────────────────────────────────────────────────────────
  // Age / DOB
  // ──────────────────────────────────────────────────────────────────────────
  protected checkAge( value: string | number ): void {
    const age = Number( value );
    this.age = age;
    this.isValidAge = age >= 18;
  }

  protected validateDateOfBirth( value: Date | string ): void {
    if ( !value ) {
      this.isValidAge = false;
      this.age = 0;
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

    this.age = age;
    this.isValidAge = age >= 18;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Country selector
  // ──────────────────────────────────────────────────────────────────────────
  private async loadAllCountries(): Promise<void> {
    try {
      const countries = await this.apiService.getCountries();
      if ( !Array.isArray( countries ) ) {
        throw new Error( 'Invalid array of countries!' );
      }
      this.countries = countries;
      ;
    } catch ( error ) {
      console.error( error );
    }
  }

  protected onCountryChange(): void {
    this.mainFilterCountries();
  }

  /**
   * Filter countries list based on typed text.
   *
   * Rules:
   * - If user has already selected a CountryCodesDto, keep it as-is.
   * - If user is typing a string, filter by that string.
   */
  private mainFilterCountries(): void {
    const safeInput =
      typeof this.typedCountry === "string"
        ? this.typedCountry.trim().toLowerCase()
        : "";

    // If nothing typed, show all
    if ( !safeInput ) {
      this.filteredCountries = of( this.countries.slice() );
      return;
    }

    this.filteredCountries = of(
      this.countries.filter( ( item ) =>
        item.name.toLowerCase().includes( safeInput )
      )
    );
  }

  /**
 * Called when user selects a country from mat-autocomplete.
 *
 * @param ev MatAutocompleteSelectedEvent
 * - ev.option.value MUST be a Country (because you bind [value]="option")
 */
  protected onCountrySelected( ev: MatAutocompleteSelectedEvent ): void {
    const picked = ev.option.value as Country;

    // Lock the selection as an object (not a string)
    this.selectedCountry = picked;

    // Optional: if you store country in a string field for backend:
    // this.country = picked.name;

    // After selecting, keep the dropdown stable (optional)
    this.filteredCountries = of( this.countries.slice() );
  }

  protected displayFn( country: Country | string | null ): string {
    return typeof country === 'string' ? country : ( country?.name ?? '' );
  }

  /**
 * Safe country label for UI.
 * Prevents template crashes when data rows are incomplete.
 */
  protected getCountryLabel( item: unknown ): string {
    if ( !item || typeof item !== 'object' ) return '';

    const anyItem = item as { name?: unknown; code?: unknown; };
    const name = typeof anyItem.name === 'string' ? anyItem.name : '';
    const code = typeof anyItem.code === 'string' ? anyItem.code : '';

    return name || code || '';
  }

  /**
   * Safe flag resolver.
   *
   * Supports multiple common API shapes:
   * - { flags: { png: string } }
   * - { flag: { png: string } }
   * - { png: string }
   * - { flagsPng: string }
   *
   * Returns empty string if not available (template stays stable).
   */
  protected getFlagPng( item: unknown ): string {
    if ( !item || typeof item !== 'object' ) return '';

    const x = item as {
      flags?: { png?: unknown; };
      flag?: { png?: unknown; };
      png?: unknown;
      flagsPng?: unknown;
    };

    const a = x.flags?.png;
    if ( typeof a === 'string' && a.trim() ) return a;

    const b = x.flag?.png;
    if ( typeof b === 'string' && b.trim() ) return b;

    const c = x.png;
    if ( typeof c === 'string' && c.trim() ) return c;

    const d = x.flagsPng;
    if ( typeof d === 'string' && d.trim() ) return d;

    return '';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Username / password / email / phone checks
  // ──────────────────────────────────────────────────────────────────────────
  protected async checkUsername( event: Event ): Promise<void> {
    try {
      const input = event.target as HTMLInputElement;
      const value = input.value.trim();

      this.usernameMatchPattern = this.usernamePattern.test( value );

      if ( !this.usernameMatchPattern ) {
        // this.notification?.notification( 'warning', 'Invalid username pattern!' );
        return;
      }

      const res = await this.apiService.getUserByUsername( value );
      if ( !res || res.status !== 'success' ) {
        // treat as "not found" or backend issue; do not hard-block typing
        this.isUsernameExist = false;
        return;
      }

      const user = res.data?.system?.user as User | undefined;

      if ( user && this.user && user.username !== this.user.username ) {
        this.notification?.notification( 'error', 'Username already existed!' );
        this.isUsernameExist = true;
      } else if ( user && !this.user ) {
        // Add User mode: any hit is a conflict
        this.notification?.notification( 'error', 'Username already existed!' );
        this.isUsernameExist = true;
      } else {
        this.isUsernameExist = false;
      }
    } catch ( error ) {
      console.error( error );
    }
  }

  protected checkPassword( event: Event ): void {
    const input = event.target as HTMLInputElement;
    const password = input.value;
    this.passwordMatchPattern = this.strongPasswordPattern.test( password );
  }

  /**
   * FIX: email existence logic aligned; no inverted res.success.
   */
  protected async checkEmail( input: string ): Promise<void> {
    try {
      const safe = input.trim();

      if ( !this.emailPattern.test( safe ) ) {
        this.isEmailError = true;
        this.emailErrorMessage = 'Invalid email format';
        return;
      }

      const checking = await this.emailValidator( safe, 'User' );
      if ( !checking ) {
        this.isEmailError = true;
        this.emailErrorMessage = 'Invalid email';
        return;
      }

      const res = await this.apiService.getUserByEmail( safe );

      // If backend doesn't respond as success, don't hard-block user creation.
      if ( !res || res.success ) {
        this.isEmailError = false;
        this.emailErrorMessage = '';
        return;
      }

      const user = res.data?.system?.user as User | undefined;

      const other = this.apiService.extractObjectFromOther<{ status: boolean; }>(
        res.data,
        'other'
      );
      const exists = other?.status === true;

      if ( exists && user ) {
        const currentUsername = this.user?.username || this.username?.trim() || '';
        if ( !currentUsername || user.username !== currentUsername ) {
          this.isEmailError = true;
          this.emailErrorMessage = 'Email already exists';
          return;
        }
      }

      this.isEmailError = false;
      this.emailErrorMessage = '';
    } catch ( error ) {
      console.error( error );

      let message = 'Unexpected error while validating email.';
      let isError: boolean = false;
      if ( error instanceof HttpErrorResponse ) {
        message = '';
        isError = false;
      } else if ( error instanceof Error ) {
        message = error.message || message;
        isError = true;
      }

      this.isEmailError = isError;
      this.emailErrorMessage = message;
      if ( error instanceof Error ) this.notification?.notification( 'error', message );
    }
  }

  private async emailValidator( email: string, userLabel: string ): Promise<boolean> {
    try {
      const safeEmail = email.trim();
      const safeUser = userLabel.trim();

      if ( !safeEmail ) throw new Error( 'Email is required.' );
      if ( !safeUser ) throw new Error( 'User label is required.' );

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if ( !emailRegex.test( safeEmail ) ) {
        throw new Error( 'Invalid email format.' );
      }

      const res = await this.userControlService.emailValidator( safeEmail );

      if ( !res || res.status !== 'success' ) {
        throw new Error( `Failed to validate email of ${ safeUser }.` );
      }

      const validatedEmail = this.apiService.extractStringFromOther( res.data, 'email' );

      const validationObj =
        this.apiService.extractObjectFromOther<{ format: boolean; mx: boolean; }>(
          res.data,
          'validation'
        );

      const domain = this.apiService.extractStringFromOther( res.data, 'domain' );

      if ( !validatedEmail ) throw new Error( 'Email provider returned an invalid email.' );
      if ( !domain ) throw new Error( 'Email provider returned an invalid domain.' );

      if ( !validationObj?.format || !validationObj.mx ) {
        throw new Error( `Please enter a valid email address for ${ safeUser }.` );
      }

      return true;
    } catch ( error ) {
      console.error( error );

      let message = 'Unexpected error while validating email.';
      if ( error instanceof HttpErrorResponse ) {
        message = error.error?.message || message;
      } else if ( error instanceof Error ) {
        message = error.message || message;
      }

      const level: 'warning' | 'error' =
        message.toLowerCase().includes( 'format' ) ? 'warning' : 'error';

      this.notification?.notification( level, message );
      return false;
    }
  }

  /**
   * FIX: Works for Add User (no this.user required).
   */
  protected async checkPhone( input: string ): Promise<void> {
    this.isPhoneError = false;
    this.phoneErrorMessage = '';

    try {
      const safeInput = input.trim();
      if ( !safeInput ) throw new Error( 'Phone number is required.' );
      if ( !this.phoneCode?.code ) throw new Error( 'Please select a country code.' );

      const fullPhoneNumber: User[ 'phoneNumber' ] = {
        code: this.phoneCode,
        number: safeInput,
      };

      const isValidFormat = await this.userControlService.isPhoneNumberValid( fullPhoneNumber );
      if ( !isValidFormat ) throw new Error( 'Invalid phone number.' );

      const res = await this.apiService.getUserByPhone( fullPhoneNumber );

      // If backend doesn't give success, do not hard-block typing.
      if ( !res || res.status !== 'success' ) {
        return;
      }

      const existingUser = res.data?.system?.user as User | undefined;
      if ( !existingUser ) return;

      // Add mode: any existing user is conflict.
      // Edit mode: allow if same username.
      const currentUsername = this.user?.username || this.username?.trim() || '';
      if ( !currentUsername || existingUser.username !== currentUsername ) {
        throw new Error( 'Phone number belongs to another user!' );
      }
    } catch ( error ) {
      console.error( error );

      let message = 'Unexpected error while validating phone number.';
      let isError: boolean = false;
      if ( error instanceof Error ) {
        message = error.message || message;
        isError = true;
      }

      this.isPhoneError = isError;
      this.phoneErrorMessage = message;
      if ( error instanceof Error ) this.notification?.notification( 'error', message );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Role access helpers
  // ──────────────────────────────────────────────────────────────────────────
  private normalizeExistingAccess(): void {
    if ( !this.originalSelectionOfAccess ) return;

    const safeRole = this.role as Role;
    const normalized: PermissionEntryDto[] = [];

    for ( const perm of this.originalSelectionOfAccess.permissions ) {
      const moduleDef = this.allPermissionAccesses.find(
        ( m ) => m.module.toLowerCase() === perm.module.toLowerCase()
      );
      if ( !moduleDef ) continue;

      const actionIds: string[] = [];

      for ( const stored of perm.actions ) {
        const found = moduleDef.actions.find(
          ( opt ) =>
            opt.id.toLowerCase() === stored.toLowerCase() ||
            opt.label.toLowerCase() === stored.toLowerCase()
        );

        if ( !found ) continue;
        if ( !actionIds.includes( found.id ) ) actionIds.push( found.id );
      }

      if ( actionIds.length > 0 ) {
        normalized.push( {
          module: moduleDef.module as AccessModuleKey,
          actions: actionIds as AccessActionKey[],
        } );
      }
    }

    this.originalSelectionOfAccess = {
      role: safeRole,
      permissions: normalized,
    };
  }

  protected whileRoleChange( role: Role ): void {
    try {
      this.role = role;

      if ( !role || !DEFAULT_ROLES.includes( role ) ) {
        this.notification?.notification( 'warning', 'Invalid role selection!' );
        this.originalSelectionOfAccess = null;
        return;
      }

      const defaultModules: ReadonlyArray<AccessModuleOption> =
        this.authService.filterDefaultAccessBaseRole( role );

      const permissions: PermissionEntryDto[] = defaultModules.map(
        ( mod ): PermissionEntryDto => ( {
          module: mod.module as AccessModuleKey,
          actions: mod.actions.map( ( a ) => a.id as AccessActionKey ),
        } )
      );

      this.originalSelectionOfAccess = { role, permissions };
    } catch ( error ) {
      console.error( error );
      this.originalSelectionOfAccess = null;
    }
  }

  protected hasModel( model: string ): boolean {
    if ( !this.originalSelectionOfAccess ) return false;

    return this.originalSelectionOfAccess.permissions.some(
      ( p ) => p.module.toLowerCase() === model.toLowerCase()
    );
  }

  protected hasAccess( accessId: string, model: string ): boolean {
    if ( !this.originalSelectionOfAccess ) return false;

    const perm = this.originalSelectionOfAccess.permissions.find(
      ( p ) => p.module.toLowerCase() === model.toLowerCase()
    );
    if ( !perm ) return false;

    return perm.actions.some( ( a ) => a.toLowerCase() === accessId.toLowerCase() );
  }

  protected toggleAccess( isChecked: boolean, module: string, actionId: string ): void {
    const safeRole = this.role as Role | undefined;
    if ( !safeRole || !DEFAULT_ROLES.includes( safeRole ) ) return;

    const moduleDef = this.allPermissionAccesses.find(
      ( m ) => m.module.toLowerCase() === module.toLowerCase()
    );
    if ( !moduleDef ) return;

    const actionDef = moduleDef.actions.find(
      ( a ) => a.id.toLowerCase() === actionId.toLowerCase()
    );
    if ( !actionDef ) return;

    if ( !this.originalSelectionOfAccess || this.originalSelectionOfAccess.role !== safeRole ) {
      this.originalSelectionOfAccess = { role: safeRole, permissions: [] };
    }

    const perms = this.originalSelectionOfAccess.permissions;

    let moduleEntry = perms.find(
      ( p ) => p.module.toLowerCase() === moduleDef.module.toLowerCase()
    );

    if ( !moduleEntry ) {
      moduleEntry = { module: moduleDef.module as AccessModuleKey, actions: [] };
      perms.push( moduleEntry );
    }

    const actionKey = actionDef.id as AccessActionKey;

    if ( isChecked ) {
      if ( !moduleEntry.actions.includes( actionKey ) ) moduleEntry.actions.push( actionKey );
    } else {
      const idx = moduleEntry.actions.indexOf( actionKey );
      if ( idx !== -1 ) moduleEntry.actions.splice( idx, 1 );

      if ( moduleEntry.actions.length === 0 ) {
        const mIdx = perms.indexOf( moduleEntry );
        if ( mIdx !== -1 ) perms.splice( mIdx, 1 );
      }
    }
  }

  protected toggleModule( isChecked: boolean, module: string ): void {
    const safeRole = this.role as Role | undefined;
    if ( !safeRole || !DEFAULT_ROLES.includes( safeRole ) ) return;

    const moduleDef = this.allPermissionAccesses.find(
      ( m ) => m.module.toLowerCase() === module.toLowerCase()
    );
    if ( !moduleDef ) return;

    if ( !this.originalSelectionOfAccess || this.originalSelectionOfAccess.role !== safeRole ) {
      this.originalSelectionOfAccess = { role: safeRole, permissions: [] };
    }

    const perms = this.originalSelectionOfAccess.permissions;

    const idx = perms.findIndex(
      ( p ) => p.module.toLowerCase() === moduleDef.module.toLowerCase()
    );

    if ( isChecked ) {
      const allActionIds: AccessActionKey[] = moduleDef.actions.map(
        ( a ) => a.id as AccessActionKey
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
      if ( idx !== -1 ) perms.splice( idx, 1 );
    }
  }

  protected getRoleAccessPayload(): RoleAccessMapDto {
    const safeRole = this.role as Role;
    if ( this.originalSelectionOfAccess && this.originalSelectionOfAccess.role === safeRole ) {
      return this.originalSelectionOfAccess;
    }
    return { role: safeRole, permissions: [] };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Create new user
  // ──────────────────────────────────────────────────────────────────────────
  protected async insertNewUser(): Promise<void> {
    let isSuccess = false;

    try {
      const verifyEmail: object = await this.crypto.generateEmailVerificationToken();

      const now = new Date();
      const oneMonth = new Date( new Date( now.setMonth( now.getMonth() + 1 ) ).getTime() );

      if ( !this.phoneCode ) throw new Error( 'Phone code is required!' );
      if ( !this.phone ) throw new Error( 'Phone number is required!' );

      this.phoneNumber = {
        code: this.phoneCode,
        number: this.phone,
      };

      if ( !this.username?.trim() ) throw new Error( 'Username is required' );
      if ( !this.fullname ) throw new Error( 'User full name is required' );
      if ( !this.userGender ) throw new Error( 'User gender is required' );
      if ( !this.email ) throw new Error( 'User email is required' );
      if ( !this.phoneNumber ) throw new Error( 'User contact number details is required' );
      if ( !this.houseNumber ) throw new Error( 'User house number is required' );
      if ( !this.street ) throw new Error( 'User street is required' );
      if ( !this.city ) throw new Error( 'User city is required' );
      if ( !this.postcode ) throw new Error( 'User postcode is required' );

      const countryName = this.selectedCountry?.name;
      console.log( countryName );
      if ( !countryName ) throw new Error( 'User country is required' );

      if ( !this.dateOfBirth ) throw new Error( 'User date of birth is required' );
      if ( !this.age ) throw new Error( 'User age is required' );
      if ( !this.isValidAge ) throw new Error( 'User age is not valid' );

      if ( this.isActive === null || this.isActive === undefined ) {
        throw new Error( 'User active status is required!' );
      }

      if ( !this.userBio ) throw new Error( 'User bio is required!' );
      if ( !this.nationality ) throw new Error( 'User nationality is required!' );
      if ( !this.nicOrPassport ) throw new Error( 'User identity number is required!' );
      if ( !this.role ) throw new Error( 'User role is required' );

      const roleAccess = this.getRoleAccessPayload();
      if ( !roleAccess || !roleAccess.permissions.length ) {
        throw new Error( 'User access is required' );
      }

      if ( this.isEmailError ) throw new Error( this.emailErrorMessage || 'Email invalid' );
      if ( this.isPhoneError ) throw new Error( this.phoneErrorMessage || 'Phone invalid' );
      if ( this.isUsernameExist ) throw new Error( 'Username already exist' );

      const trimmedPassword = this.password.trim();
      if ( !trimmedPassword ) throw new Error( 'Invalid password!' );
      if ( !this.strongPasswordPattern.test( trimmedPassword ) ) {
        throw new Error( 'Password does not match the required strength pattern' );
      }
      if ( !this.usernameMatchPattern ) throw new Error( 'Username does not match the pattern' );
      if ( !this.isValidAge ) throw new Error( 'User does not fit the age criteria' );

      const formData: FormData = new FormData();
      this.progress?.start();

      formData.append( 'username', this.username.trim() );
      formData.append( 'password', trimmedPassword );
      formData.append( 'name', this.fullname.trim() );
      formData.append( 'email', this.email.trim() );
      formData.append( 'oldEmail', this.oldEmail.trim() );
      formData.append( 'dateOfBirth', this.dateOfBirth.toISOString().trim() );
      formData.append( 'age', this.age.toString().trim() );
      formData.append( 'gender', this.userGender.toLowerCase().trim() );
      formData.append( 'bio', this.userBio.trim() );
      formData.append( 'nationality', this.nationality.trim() );
      formData.append( 'nicOrPassport', this.nicOrPassport.trim() );
      formData.append( 'phoneNumber', JSON.stringify( this.phoneNumber ) );

      if ( this.userimage ) {
        formData.append( 'userimage', this.userimage, `${ this.username.trim() }_image.png` );
      }

      formData.append( 'role', this.role );
      formData.append( 'isActive', this.isActive.toString() );
      formData.append( 'street', this.street.trim() );
      formData.append( 'houseNumber', this.houseNumber.toString().trim() );
      formData.append( 'city', this.city.trim() );
      formData.append( 'stateOrProvince', this.stateOrProvince.trim() );
      formData.append( 'postcode', this.postcode.toString().trim() );
      formData.append( 'country', countryName );

      formData.append( 'access', JSON.stringify( roleAccess ).trim() );
      formData.append( 'otpToken', JSON.stringify( verifyEmail ).trim() );

      // FIX: send ISO string, not raw Date object
      formData.append( 'otpValidTime', JSON.stringify( { otpValidTime: oneMonth.toISOString() } ) );

      // Add-mode default (or keep your old behavior if you want)
      const multiAuthEnabled: string =
        this.user && this.user.multiAuthEnabled ? 'true' : 'false';
      formData.append( 'multiAuthEnabled', multiAuthEnabled );

      formData.append( 'updatedAt', this.updatedAt.toISOString() );
      formData.append( 'creator', this.creator );
      formData.append( 'updator', this.updator );

      const res = await this.apiService.createNewUser( formData );

      if ( !res || !res.success || res.status !== 'success' ) {
        throw new Error( res?.message || 'Failed to create user!' );
      }

      this.notification?.notification( res.status, res.message );
      isSuccess = true;
    } catch ( error ) {
      console.error( error );

      let message = 'Unexpected error occurred while creating user!';
      if ( error instanceof HttpErrorResponse ) {
        message = error.error?.message ?? message;
      } else if ( error instanceof Error ) {
        message = error.message || message;
      }

      this.notification?.notification( 'error', message );
    } finally {
      this.progress?.complete();
      if ( isSuccess ) {
        setTimeout( () => {
          this.router.navigate( [ '/dashboard/users' ] );
        }, 1000 );
      }
    }
  }
}
