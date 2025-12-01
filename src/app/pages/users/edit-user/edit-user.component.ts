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
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
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

// ──────────────────────────────────────────────────────────────────────────────
// Router / platform
// ──────────────────────────────────────────────────────────────────────────────
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

// ──────────────────────────────────────────────────────────────────────────────
// Third-party components
// ──────────────────────────────────────────────────────────────────────────────
import { EditorComponent } from '@tinymce/tinymce-angular';
import {
  ImageCroppedEvent,
  ImageCropperComponent,
} from 'ngx-image-cropper';

// ──────────────────────────────────────────────────────────────────────────────
// RxJS
// ──────────────────────────────────────────────────────────────────────────────
import { Observable, Subscription } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

// ──────────────────────────────────────────────────────────────────────────────
// App components / dialogs
// ──────────────────────────────────────────────────────────────────────────────
import { CameraBoxComponent } from '../../../components/dialogs/camera-box/camera-box.component';
import { NotificationDialogComponent } from '../../../components/dialogs/notification/notificationBar.component';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import { TextEditorComponent } from '../../../components/shared/textEditor/text-editor';

// ──────────────────────────────────────────────────────────────────────────────
// Services & types
// ──────────────────────────────────────────────────────────────────────────────
import {
  APIsService,
  User,
  Country,
  PermissionEntry,
  ROLE_ACCESS_MAP,
} from '../../../services/APIs/apis.service';
import {
  ACCESS_OPTIONS,
  AccessMap,
  AuthService,
  DEFAULT_ROLE_ACCESS,
  Role,
} from '../../../services/auth/auth.service';
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
  selector: 'app-edit-user',
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
  templateUrl: './edit-user.component.html',
  styleUrl: './edit-user.component.scss',
} )
export class EditUserComponent
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
  // Theme / platform
  // ──────────────────────────────────────────────────────────────────────────
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  // ──────────────────────────────────────────────────────────────────────────
  // User + token state
  // ──────────────────────────────────────────────────────────────────────────
  protected user: User | null = null;
  private token!: string;
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

  protected userUploadedImage: string = '';
  protected userimage: File | null = null;
  protected userExistedImage: string = '';

  // Cropper state
  protected selectedImageChangedEvent: any = null;
  protected croppedImageBase64: string = '';
  protected showCropper: boolean = false;
  protected croppedImage: any = '';
  protected isDragOver: boolean = false;
  protected isCameraOpen: boolean = false;

  // TinyMCE init
  init: EditorComponent[ 'init' ] = {
    plugins: 'lists link image table code help wordcount',
  };

  // ──────────────────────────────────────────────────────────────────────────
  // List / paging (kept for compatibility if template uses them)
  // ──────────────────────────────────────────────────────────────────────────
  protected users: User[] = [];
  protected pageCount: number = 0;
  protected currentPage: number = 0;
  protected search: string = '';
  protected loading: boolean = true;

  // ──────────────────────────────────────────────────────────────────────────
  // Country / autocomplete
  // ──────────────────────────────────────────────────────────────────────────
  protected countryControl = new FormControl<string>( '' );
  protected countries: Country[] = [];
  protected filteredCountries!: Observable<Country[]>;
  protected typedCountry: Country | string | null = '';

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
  private readonly phonePattern: RegExp = /^\+?[0-9\s\-()]{10,15}$/; // (not used directly but kept)

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

  protected modelCheck: MODEL_CHECK = {
    model: '',
    check: false,
    action: '',
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Access / roles
  // ──────────────────────────────────────────────────────────────────────────
  protected accessOptions = ACCESS_OPTIONS;
  protected autoSelectedRoleAccess: Record<Role, AccessMap> =
    DEFAULT_ROLE_ACCESS;

  protected selectedPermissions: {
    [ module: string ]: { [ action: string ]: boolean; };
  } = {};

  protected allSelected: { [ module: string ]: boolean; } = {};

  // full user access payload (for current user being edited)
  protected userAccess: ROLE_ACCESS_MAP = {} as ROLE_ACCESS_MAP;

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

  protected readonly definedGender: string[] = [
    'Male',
    'Female',
    'Other',
  ];

  protected readonly userActiveStatus: userActiveStatusType[] = [
    { typeName: 'Active', isActive: true },
    { typeName: 'Inactive', isActive: false },
  ];

  // ──────────────────────────────────────────────────────────────────────────
  // Constructor
  // ──────────────────────────────────────────────────────────────────────────
  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly activatedRouter: ActivatedRoute,
    private readonly router: Router,
    private readonly apiService: APIsService,
    private readonly crypto: CryptoService,
    private readonly matIconRegistry: MatIconRegistry,
    private readonly domSanitizer: DomSanitizer,
    private readonly authService: AuthService,
    private readonly userControlService: UserControllerService,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.activatedRouter.url.subscribe( () => {
      // reserved for future
    } );
    this.registerIcons();

    this.loggedUser = this.authService.getLoggedUser;
    this.updator = this.loggedUser ? this.loggedUser.username : '';

    this.activatedRouter.params.subscribe( ( param ) => {
      this.token = param[ 'token' ];
    } );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ──────────────────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      // Prevent default drag/drop behavior globally
      window.addEventListener( 'dragover', this.preventDefault, {
        passive: false,
      } );
      window.addEventListener( 'drop', this.preventDefault, {
        passive: false,
      } );

      this.modeSub = this.windowRef.mode$.subscribe(
        ( val ) => ( this.mode = val ),
      );

      await this.loadData();
    }
  }

  ngAfterViewInit(): void {
    // View children ready
  }

  ngOnDestroy(): void {
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
        this.domSanitizer.bypassSecurityTrustResourceUrl( icon.path ),
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

  protected detectUserImage( image: string, gender: string ): string {
    if ( typeof image === 'string' ) {
      const imageArray: string[] = image ? image.split( '/' ) : [];
      if ( imageArray.length > 0 ) {
        const lastSegment = imageArray[ imageArray.length - 1 ];
        const ext = lastSegment.split( '.' )[ 1 ];
        if ( ext && this.definedImageExtentionArray.includes( ext ) ) {
          return image;
        }
      }
    }

    return gender.toLowerCase() === 'male'
      ? this.definedMaleDummyImageURL
      : this.definedWomanDummyImageURL;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Accessor for template
  // ──────────────────────────────────────────────────────────────────────────
  get userData(): User | null {
    return this.user ?? null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Permission helpers
  // ──────────────────────────────────────────────────────────────────────────
  private hasPermissionAction(
    action:
      | 'change username'
      | 'reset password'
      | 'activate'
      | 'deactivate'
      | 'assign roles',
  ): boolean {
    const user = this.loggedUser;
    if ( !user?.access?.permissions ) return false;

    return user.access.permissions.some(
      ( permission ) =>
        permission.module === 'User Management' &&
        permission.actions.includes( action ),
    );
  }

  protected isUserCanChangeTheUserName(): boolean {
    return this.hasPermissionAction( 'change username' );
  }

  protected isUserCanResetThePassword(): boolean {
    return this.hasPermissionAction( 'reset password' );
  }

  protected isUserCanMakeUserActivate(): boolean {
    return this.hasPermissionAction( 'activate' );
  }

  protected isUserCanMakeUserDeactivate(): boolean {
    return this.hasPermissionAction( 'deactivate' );
  }

  protected isUserCanAssignUserRoles(): boolean {
    return this.hasPermissionAction( 'assign roles' );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Load user data by token
  // ──────────────────────────────────────────────────────────────────────────
  private async loadData(): Promise<void> {
    try {
      if ( !this.token ) throw new Error( 'Invalid user token' );

      const res = await this.apiService.getUserByToken( this.token );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to fetch user data from token' );
      }

      const user = res.data?.system?.user;
      if ( !user ) {
        throw new Error( 'Invalid user data!' );
      }

      this.user = user;
      this.assignValues();
    } catch ( err ) {
      console.error( err );
      this.notification.notification(
        'error',
        'Loading user data failed!',
      );
      setTimeout( () => {
        this.router.navigate( [ '/dashboard/unauthorized' ] );
      }, 500 );
    }
  }

  private assignValues(): void {
    try {
      if ( !this.user ) throw new Error( 'Invalid user!' );

      // basic
      this.fullname = this.user.name;
      this.userGender =
        this.user.gender.charAt( 0 ).toUpperCase() +
        this.user.gender.slice( 1 );
      this.detectGender( this.userGender );

      this.username = this.user.username;
      this.email = this.user.email;
      this.oldEmail = this.user.email;
      this.phone = this.user.phoneNumber ?? '';

      this.dateOfBirth = new Date( this.user.dateOfBirth ?? '' );
      this.age = this.user.age;
      this.isValidAge = this.user.age >= 18;

      this.isActive = this.user.isActive;
      this.role = this.user.role;
      this.userBio = this.user.bio;

      this.updatedAt = new Date( this.user.updatedAt ?? '' );
      this.createdAt = new Date( this.user.createdAt ?? '' );
      this.creator = this.user.creator ?? '';
      this.updator = this.user.updator ?? this.updator;

      // address
      this.houseNumber = this.user.address.houseNumber;
      this.street = this.user.address.street;
      this.city = this.user.address.city;
      this.stateOrProvince = this.user.address.stateOrProvince ?? '';
      this.postcode = this.user.address.postcode;

      const country = this.user.address.country ?? '';
      this.countryControl.setValue( country );
      this.typedCountry = country;
      this.onCountryChange( country );

      // access
      this.userAccess = this.user.access;
      this.setPermissionsByRole( this.user.role as Role );

      this.userAccess.permissions.forEach( ( permission ) => {
        this.hasModel( permission.module );
        this.toggleModule( true, permission.module );
        permission.actions.forEach( ( action ) => {
          this.hasAccess( action, permission.module );
          this.toggleAccess( true, permission.module, action );
        } );
      } );
      this.updateAllSelectedStates();

      // image
      this.userExistedImage = this.user.image as string;

      setTimeout( () => {
        this.isLoading = false;
      }, 500 );
    } catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'Invalid user data!' );
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

    // allow normal paste in inputs / editable fields
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
    this.detectUserImage( this.userUploadedImage, this.userGender );
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
  // Page indicators
  // ──────────────────────────────────────────────────────────────────────────
  protected goToUsers(): void {
    this.router
      .navigateByUrl( '/', { skipLocationChange: true } )
      .then( () => this.router.navigate( [ '/dashboard/users' ] ) )
      .catch( ( err ) =>
        this.notifyError( err, 'Failed to navigate to users page.' ),
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
          'Failed to navigate to add new user page.',
        ),
      );
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
  // Username / password / email / phone checks
  // ──────────────────────────────────────────────────────────────────────────
  protected async checkUsername( event: Event ): Promise<void> {
    try {

      const input = event.target as HTMLInputElement;
      const value = input.value.trim();

      this.usernameMatchPattern = this.usernamePattern.test( value );

      if ( !this.usernameMatchPattern ) {
        this.notification.notification( 'warning', 'Invalid username pattern!' );
      }

      const res = await this.apiService.getUserByUsername(
        value,
      );

      if ( res.status !== 'success' ) {
        throw new Error( 'Failed to fetch validation!' );
      }

      const user = res.data?.system?.user;

      if ( user ) {
        this.notification.notification( 'error', 'Username already exsited!' );
      }

      this.isUsernameExist = !!user;

    }
    catch ( error ) {
      console.error( error );
    }
  }

  protected checkPassword( event: Event ): void {
    const input = event.target as HTMLInputElement;
    const password = input.value;
    this.passwordMatchPattern = this.strongPasswordPattern.test(
      password,
    );
  }

  protected async checkEmail( input: string ): Promise<void> {
    try {
      if ( !this.emailPattern.test( input ) ) {
        this.isEmailError = true;
        this.emailErrorMessage = 'Invalid email format';
        return;
      }

      const checking: boolean = await this.emailValidator( input.trim(), 'User' );

      if ( !checking ) {
        this.isEmailError = true;
        this.emailErrorMessage = 'Invalid email';
        throw new Error( 'Invalid email' );
      }



      this.isEmailError = !checking;
      this.emailErrorMessage = !checking ? 'Invalid email' : 'Valid email';

      const res = await this.apiService.getUserByEmail( input );

      if ( res.status !== 'success' ) {
        throw new Error( 'Failed to confirm is the email exist!' );
      }

      const user: User | undefined = res.data?.system?.user;

      const other = this.apiService.extractObjectFromOther<{ status: boolean; }>( res.data, 'other' );
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
        this.notification.notification( 'error', error as string );
      }
    }
  }

  private async emailValidator( email: string, user: string ): Promise<boolean> {
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
        this.notification.notification( 'warning', 'Invalid email format!' );
        throw new Error( 'Invalid email format!' );
      }

      const res = await this.userControlService.emailValidator( rowEmail );

      if ( res.status !== 'success' ) {
        this.notification.notification( 'error', `Failed to validate email of ${ rowUser }` );
        throw new Error( `Failed to validate email of ${ rowUser }` );
      }

      const validatedEmail = this.apiService.extractStringFromOther( res.data, 'email' );
      const validationObj = this.apiService.extractObjectFromOther<{
        format: boolean,
        mx: boolean;
      }>( res.data, 'validation' );
      const domain = this.apiService.extractStringFromOther( res.data, 'domain' );

      if ( !validatedEmail ) {
        throw new Error( 'Invalid email!' );
      }

      if ( !domain ) {
        throw new Error( 'Invalid domain!' );
      }

      if ( !validationObj?.format || !validationObj.mx ) {
        this.notification.notification( 'error', `Please enter valid email address of ${ rowUser }` );
        throw new Error( `Please enter valid email address of ${ rowUser }` );
      }

      return true;

    }
    catch ( error ) {
      console.error( error );
      return false;
    }
  }

  protected async checkPhone( input: string ): Promise<void> {
    try {
      const safeInput = input.trim();
      const checking =
        await this.userControlService.isPhoneNumberValid(
          safeInput,
        );
      const isExistChecking = await this.apiService.getUserByPhone(
        safeInput,
      );

      if ( isExistChecking.status === 'error' ) {
        if ( !checking ) {
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

  // ──────────────────────────────────────────────────────────────────────────
  // Role access autocomplete
  // ──────────────────────────────────────────────────────────────────────────
  protected hasModel( model: string ): boolean {
    return (
      this.role in this.autoSelectedRoleAccess &&
      model in this.autoSelectedRoleAccess[ this.role as Role ]
    );
  }

  protected hasAccess( access: string, model: string ): boolean {
    if (
      this.role in this.autoSelectedRoleAccess &&
      model in this.autoSelectedRoleAccess[ this.role as Role ]
    ) {
      return this.autoSelectedRoleAccess[ this.role as Role ][
        model
      ].includes( access );
    }
    return false;
  }

  protected toggleAccess(
    isChecked: boolean,
    module: string,
    action: string,
  ): void {
    if ( !( this.role in this.autoSelectedRoleAccess ) ) return;

    const accessMap = this.autoSelectedRoleAccess[ this.role as Role ];

    if ( isChecked ) {
      if ( !accessMap[ module ] ) {
        accessMap[ module ] = [];
      }

      if ( !accessMap[ module ].includes( action ) ) {
        accessMap[ module ].push( action );
      }
    } else {
      const index = accessMap[ module ]?.indexOf( action ) ?? -1;
      if ( index !== -1 ) {
        accessMap[ module ].splice( index, 1 );
      }

      if ( accessMap[ module ]?.length === 0 ) {
        delete accessMap[ module ];
      }
    }
  }

  protected toggleModule( isChecked: boolean, module: string ): void {
    if ( !( this.role in this.autoSelectedRoleAccess ) ) return;

    const accessMap = this.autoSelectedRoleAccess[ this.role as Role ];

    if ( isChecked ) {
      const fullActions =
        ACCESS_OPTIONS.find( ( opt ) => opt.module === module )
          ?.actions || [];
      accessMap[ module ] = [ ...fullActions ];
    } else {
      delete accessMap[ module ];
    }
  }

  protected setPermissionsByRole( role: Role ): void {
    this.selectedPermissions =
      this.authService.getDefaultAccessByRole( role );
    this.updateAllSelectedStates();
  }

  protected updateAllSelectedStates(): void {
    for ( const mod of this.accessOptions ) {
      const allTrue = mod.actions.every(
        ( act ) => this.selectedPermissions[ mod.module ]?.[ act ],
      );
      this.allSelected[ mod.module ] = allTrue;
    }
  }

  protected toggleAllActions(
    module: string,
    isChecked: boolean,
  ): void {
    for ( const action in this.selectedPermissions[ module ] ) {
      this.selectedPermissions[ module ][ action ] = isChecked;
    }
    this.updateAllSelectedStates();
  }

  protected onPermissionChange(): void {
    this.updateAllSelectedStates();
  }

  protected getRoleAccessPayload(): ROLE_ACCESS_MAP {
    const role = this.role;
    const permissions: PermissionEntry[] = [];

    if ( role in this.autoSelectedRoleAccess ) {
      const modules = this.autoSelectedRoleAccess[ role as Role ];

      for ( const [ module, actions ] of Object.entries( modules ) ) {
        if ( actions.length > 0 ) {
          permissions.push( { module, actions } );
        }
      }
    }

    return { role, permissions };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Update user (method name kept as insertNewUser for template)
  // ──────────────────────────────────────────────────────────────────────────
  protected async insertNewUser(): Promise<void> {
    try {
      const verifyEmail: object =
        await this.crypto.generateEmailVerificationToken();
      const now = new Date();
      const oneMonth = new Date(
        new Date( now.setMonth( now.getMonth() + 1 ) ).getTime(),
      );

      // permission check
      if (
        !this.isUserCanMakeUserActivate() &&
        !this.isUserCanMakeUserDeactivate() &&
        !this.isUserCanAssignUserRoles()
      ) {
        throw new Error(
          'User does not have permission to perform the action.',
        );
      }

      // required fields
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
      if ( !this.age )
        throw new Error( 'User age is required' );
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
        throw new Error( 'Password does not match the pattern' );
      }

      if ( !this.usernameMatchPattern ) {
        throw new Error( 'Username does not match the pattern' );
      }

      if ( !this.isValidAge ) {
        throw new Error( 'User does not fit the age criteria' );
      }

      // Build formdata
      const formData: FormData = new FormData();
      this.progress.start();

      formData.append( 'username', this.username.trim() );
      formData.append( 'password', this.password.trim() );
      formData.append( 'name', this.fullname.trim() );
      formData.append( 'email', this.email.trim() );
      formData.append( 'oldEmail', this.oldEmail.trim() );
      formData.append(
        'dateOfBirth',
        this.dateOfBirth.toISOString().trim(),
      );
      formData.append( 'age', this.age.toString().trim() );
      formData.append(
        'gender',
        this.userGender.toLowerCase().trim(),
      );
      formData.append( 'bio', this.userBio.trim() );
      formData.append( 'phoneNumber', this.phone.trim() );

      if ( this.userimage ) {
        formData.append(
          'userimage',
          this.userimage,
          `${ this.username }_image.png`,
        );
      } else {
        formData.append( 'userimage', this.userExistedImage );
      }

      formData.append( 'role', this.role );
      formData.append( 'isActive', this.isActive.toString() );
      formData.append( 'street', this.street.trim() );
      formData.append(
        'houseNumber',
        this.houseNumber.toString().trim(),
      );
      formData.append( 'city', this.city.trim() );
      formData.append(
        'stateOrProvince',
        this.stateOrProvince.trim(),
      );
      formData.append( 'postcode', this.postcode.toString().trim() );

      const countryValue = this.countryControl.value ?? '';
      formData.append( 'country', countryValue.trim() );

      formData.append(
        'access',
        JSON.stringify( roleAccess ).trim(),
      );
      formData.append(
        'otpToken',
        JSON.stringify( verifyEmail ).trim(),
      );
      formData.append(
        'otpValidTime',
        JSON.stringify( { otpValidTime: oneMonth } ),
      );
      formData.append( 'updatedAt', this.updatedAt.toString() );
      formData.append( 'creator', this.creator );
      formData.append( 'updator', this.updator );

      const res = await this.apiService.updateUser( formData, this.username );

      if ( res && res.status === 'success' ) {
        this.notification.notification( res.status, res.message );
      } else {
        this.notification.notification(
          'error',
          res?.message ?? 'User update failed',
        );
      }
    } catch ( error ) {
      if ( error ) {
        this.notification.notification(
          'error',
          ( error as Error ).message ?? ( error as string ),
        );
      }
    } finally {
      this.progress.complete();
      setTimeout( () => {
        this.router.navigate( [ '/dashboard/users' ] );
      }, 1000 );
    }
  }
}
