import {AsyncPipe, CommonModule, isPlatformBrowser} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
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
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {
  MatMomentDateModule
} from '@angular/material-moment-adapter';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatDialogModule} from '@angular/material/dialog';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSelectModule} from '@angular/material/select';
import {DomSanitizer} from '@angular/platform-browser';
import {ActivatedRoute, Router} from '@angular/router';
import {EditorComponent} from '@tinymce/tinymce-angular';
import {ImageCroppedEvent, ImageCropperComponent} from 'ngx-image-cropper';
import {Observable, Subscription} from 'rxjs';
import {map, startWith} from 'rxjs/operators';
import {CameraBoxComponent} from '../../components/dialogs/camera-box/camera-box.component';
import {
  msgTypes,
  NotificationDialogComponent,
} from '../../components/dialogs/notification/notification.component';
import {ProgressBarComponent} from '../../components/dialogs/progress-bar/progress-bar.component';
import {SkeletonLoaderComponent} from '../../components/shared/skeleton-loader/skeleton-loader.component';
import {
  APIsService,
  Country,
  MSG_DATA_TYPE,
  PermissionEntry,
  ROLE_ACCESS_MAP,
  validateType,
} from '../../services/APIs/apis.service';
import {
  ACCESS_OPTIONS,
  AccessMap,
  AuthService,
  DEFAULT_ROLE_ACCESS,
  getDefaultAccessByRole,
  LoggedUserType,
  Role,
  UsersType,
} from '../../services/auth/auth.service';
import {CryptoService} from '../../services/cryptoService/crypto.service';
import {UserControllerService} from '../../services/userController/user-controller.service';
import {WindowsRefService} from '../../services/windowRef/windowRef.service';

interface userAccessType {
  access: string[];
}

interface userActiveStatusType {
  typeName: string;
  isActive: boolean;
}

interface MODEL_CHECK {
  model: string;
  check: boolean;
  action: string;
}

//  SkeletonLoaderComponent, NotificationDialogComponent, ProgressBarComponent,

@Component({
  selector: 'app-add-new-user',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
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
    NotificationDialogComponent,
    ProgressBarComponent,
    ImageCropperComponent,
    EditorComponent,
    CameraBoxComponent,
    SkeletonLoaderComponent,
  ],
  standalone: true,
  templateUrl: './add-new-user.component.html',
  styleUrl: './add-new-user.component.scss',
})
export class AddNewUserComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  @ViewChild(ProgressBarComponent) progress!: ProgressBarComponent;
  @ViewChild(NotificationDialogComponent) notification!: NotificationDialogComponent;
  @ViewChild(ImageCropperComponent) imageCropper!: ImageCropperComponent;
  @ViewChild(CameraBoxComponent) cameraBox!: CameraBoxComponent;

  protected readonly definedMaleDummyImageURL =
    '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL =
    '/Images/user-images/dummy-user/dummy_woman.jpg';
  protected definedImage: string =
    '/Images/user-images/dummy-user/dummy-user.jpg';

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected users: UsersType[] = [];
  protected pageCount: number = 0;
  protected currentPage: number = 0;
  protected search: string = '';
  protected loading: boolean = true;
  protected userUploadedImage: string = '';
  protected countryControl = new FormControl<string>('');

  protected countries: Country[] = [];
  protected filteredCountries!: Observable<Country[]>;
  protected isValidAge: boolean = false;
  protected isUsernameExist: boolean = false;
  protected hidePassword: boolean = true;
  private readonly strongPasswordPattern: RegExp =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,}$/;
  private readonly usernamePattern: RegExp = /^[a-zA-Z0-9._-]{4,20}$/;
  protected usernameMatchPattern: boolean = true;
  protected passwordMatchPattern: boolean = true;
  protected isEmailError: boolean = false;
  protected emailErrorMessage: string = '';
  private readonly emailPattern: RegExp =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  protected isPhoneError: boolean = false;
  protected phoneErrorMessage: string = '';
  protected readonly definedGender: string[] = ['Male', 'Female', 'Other'];
  protected accessOptions = ACCESS_OPTIONS;
  protected selectedPermissions: {
    [module: string]: {[action: string]: boolean};
  } = {};
  protected allSelected: {[module: string]: boolean} = {};
  protected autoSelectedRoleAccess: Record<Role, AccessMap> =
    DEFAULT_ROLE_ACCESS;
  protected isCameraOpen: boolean = false;
  private loogedUser: LoggedUserType | null = null;

  //User data
  protected username: string = '';
  protected password: string = '';
  protected fullname: string = '';
  protected email: string = '';
  protected phone: string = '';
  protected street: string = '';
  protected typedCountry: Country | string | null = '';
  protected houseNumber: string = '';
  protected city: string = '';
  protected postcode: string = '';
  protected stateOrProvince: string = '';
  protected role: string = '';
  protected userimage: File | null = null;
  protected age: string = '';
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
  protected bioData: string = '';

  //User access
  protected userAccess: userAccessType[] = [];

  //defined roles
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

  //User status manager
  protected readonly userActiveStatus: userActiveStatusType[] = [
    {
      typeName: 'Active',
      isActive: true,
    },
    {
      typeName: 'Inactive',
      isActive: false,
    },
  ];

  //<=========== Cropper Variables =========>
  protected selectedImageChangedEvent: any = null;
  protected croppedImageBase64: string = '';
  // userUploadedImage: string = ''; // This will be shown as final image
  protected showCropper = false;
  protected croppedImage: any = '';

  init: EditorComponent['init'] = {
    plugins: 'lists link image table code help wordcount',
  };

  protected isDragOver: boolean = false;

  constructor (
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private activeRouter: ActivatedRoute,
    private router: Router,
    private API: APIsService,
    private crypto: CryptoService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private authService: AuthService,
    private userControlService: UserControllerService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.activeRouter.url.subscribe(() => {});
    this.iconCreator();
    this.loogedUser = this.authService.getLoggedUser;
  }

  async ngOnInit(): Promise<void> {
    if(this.isBrowser) {
      // Prevent default drag/drop behavior globally
      window.addEventListener('dragover', this.preventDefault, {
        passive: false,
      });
      window.addEventListener('drop', this.preventDefault, {passive: false});

      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  ngAfterViewInit() {}

  //<==================== User Validation Operations ====================>
  protected isUserCanMakeUserActivate(): boolean {
    return (
      this.loogedUser?.access.permissions.some(
        (permission) =>
          permission.module === 'User Management' &&
          permission.actions.includes('activate')
      ) ?? false
    );
  }

  protected isUserCanMakeUserDeactivate(): boolean {
    return (
      this.loogedUser?.access.permissions.some(
        (permission) =>
          permission.module === 'User Management' &&
          permission.actions.includes('deactivate')
      ) ?? false
    );
  }

  protected isUserCanAssignUserRoles(): boolean {
    return (
      this.loogedUser?.access.permissions.some(
        (permission) =>
          permission.module === 'User Management' &&
          permission.actions.includes('assign roles')
      ) ?? false
    );
  }
  //<==================== End User Validation Operations ====================>

  private iconCreator() {
    const icons = [
      {name: 'camera', path: '/Images/Icons/camera.svg'},
      {name: 'upload', path: '/Images/Icons/upload.svg'},
      {name: 'insert', path: '/Images/Icons/user-plus.svg'},
    ];

    for(let icon of icons) {
      this.matIconRegistry.addSvgIcon(
        icon.name,
        this.domSanitizer.bypassSecurityTrustResourceUrl(icon.path)
      );
    }
  }

  protected detectGender(value: string) {
    if(value === 'Male') {
      this.definedImage = this.definedMaleDummyImageURL;
    } else if(value === 'Female') {
      this.definedImage = this.definedWomanDummyImageURL;
    } else {
      this.definedImage = this.definedMaleDummyImageURL;
    }
  }

  //<=========== Capture the image and upload the image ============>

  protected openCamera(): void {
    this.isCameraOpen = true;
  }

  protected closeCamera(): void {
    this.isCameraOpen = false;
  }

  protected handleImage(imageData: string) {
    this.userUploadedImage = imageData;
    this.userimage = this.convertToTheBlob(imageData);
    this.isCameraOpen = false;

    const file = this.convertToTheBlob(imageData);
    const dt = new DataTransfer();
    dt.items.add(file);

    const simulatedEvent = {
      target: {
        files: dt.files,
      },
    };

    this.onFileSelected(simulatedEvent);
  }

  protected convertToTheBlob(data: string): File {
    const byteString = atob(data.split(',')[1]); // decode base64
    const byteArray = new Uint8Array(byteString.length);
    for(let i = 0; i < byteString.length; i++) {
      byteArray[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([byteArray], {type: 'image/png'});
    return new File([blob], 'image.png', {type: 'image/png'});
  }

  //<=========== End Capture the image and upload the image ============>

  //<=========== Image Past On File Input ============>

  @HostListener('document:paste', ['$event'])
  protected handlePaste(event: ClipboardEvent): void {
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
          this.processPastedFile(file);
        }
      }
    }
  }

  protected processPastedFile(file: File) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const input = this.fileInput.nativeElement;
    input.files = dataTransfer.files;

    // Trigger the same file selection logic
    this.onFileSelected({target: input} as any);
  }

  //<=========== End Image Past On File Input ============>

  //<=========== Image Drag and Dropt ============>

  protected onDragOver(event: DragEvent): void {
    event.preventDefault(); // Crucial to allow drop
    this.isDragOver = true;
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if(files && files.length > 0) {
      const file = files[0];
      if(file.type.startsWith('image/')) {
        this.processDroppedFile(file);
      }
    }
  }

  protected processDroppedFile(file: File) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const input = this.fileInput.nativeElement;
    input.files = dataTransfer.files;

    // Trigger your upload handler
    this.onFileSelected({target: input} as any);
  }

  private preventDefault(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  //<=========== End Image Drag and Dropt ============>

  //<=========== Image Upload with Cropper ============>
  protected triggerFileInput() {
    document.querySelector<HTMLInputElement>('#fileInput')?.click();
  }

  protected onFileSelected(event: any): void {
    this.selectedImageChangedEvent = event;
    this.showCropper = true;
  }

  protected imageCropped(event: ImageCroppedEvent): void {
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

  //<=========== End Image Upload with Cropper ============>

  //<=========== Page indicator ============>
  protected goToUsers() {
    this.router.navigateByUrl('/', {skipLocationChange: true}).then(() => {
      this.router.navigate(['/dashboard/users']);
    });
  }

  protected async goToUser() {
    this.router.navigateByUrl('/', {skipLocationChange: true}).then(() => {
      this.router.navigate(['/dashboard/add-new-user']);
    });
  }
  //<=========== End Page indicator ============>

  //<=========== Check the Age ============>

  protected checkAge(value: string | number) {
    const age = Number(value);
    this.age = age.toString();
    this.isValidAge = age >= 18;
  }

  //<=========== End Check the Age ============>

  //<=========== Validating the Date of birth ============>
  protected validateDateOfBirth(value: Date | string): void {
    if(!value) {
      this.isValidAge = false;
      this.age = '';
      return;
    }

    const dateOfBirth = new Date(value);
    const today = new Date();

    // Calculate age precisely, accounting for month/day
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    const dayDiff = today.getDate() - dateOfBirth.getDate();

    if(monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }

    this.age = age.toString();
    this.isValidAge = age >= 18;
  }

  protected async onCountryChange(value: string): Promise<void> {
    this.typedCountry = value;
    this.countries = await this.mainFilterCountries();
  }

  private async mainFilterCountries(): Promise<Country[]> {
    const countries: Country[] = await this.API.getCountries();
    if(!Array.isArray(countries)) return [];

    if(countries) {
      this.countries = countries;
      this.filteredCountries = this.countryControl.valueChanges.pipe(
        startWith(this.typedCountry),
        map((value: string | Country | null) => {
          const name = typeof value === 'string' ? value : value?.name;
          return name ? this._filterCountries(name) : this.countries.slice();
        })
      );
    }
    return this.countries;
  }

  private _filterCountries(name: string): Country[] {
    const filterValue = name.toLowerCase();
    return this.countries.filter((c) =>
      c.name.toLowerCase().includes(filterValue)
    );
  }

  protected displayFn(country: Country): string {
    return typeof country === 'string' ? country : country?.name ?? '';
  }
  //<=========== End Country selector ============>

  //<=========== Checking the username ============>
  protected async checkUsername(event: Event): Promise<void> {
    this.usernameMatchPattern = false;
    const input = event.target as HTMLInputElement;
    if(this.usernamePattern.test(input.value)) {
      this.usernameMatchPattern = true;
    } else {
      this.usernameMatchPattern = false;
    }
    if(this.usernameMatchPattern) {
      const checking: validateType = await this.API.getUserByUsername(
        input.value
      );
      if(checking.status === 'true') {
        this.isUsernameExist = true;
      } else {
        this.isUsernameExist = false;
      }
    }
  }
  //<=========== End Checking the username ============>

  //<=========== Checking the password ============>
  protected checkPassword(event: Event) {
    this.passwordMatchPattern = false;
    const input = event.target as HTMLInputElement;
    const password = input.value;
    if(this.strongPasswordPattern.test(password)) {
      this.passwordMatchPattern = true;
    } else {
      this.passwordMatchPattern = false;
    }
  }
  //<=========== End Checking the password ============>

  //<=========== Checking the email ============>
  protected async checkEmail(input: string): Promise<void> {
    try {
      if(this.emailPattern.test(input)) {
        const checking = await this.userControlService.emailValidator(input);
        if(checking.status === 'success') {
          this.isEmailError = checking.data.validation;
          this.emailErrorMessage = checking.message;
          const existEmail = await this.API.getUserByEmail(input);
          if(existEmail.status === 'true') {
            this.isEmailError = true;
            this.emailErrorMessage = 'Email already exist';
            throw new Error('Email already exist');
          }
          else {
            this.isEmailError = false;
            this.emailErrorMessage = '';
          }
        }
        else {
          this.isEmailError = true;
          this.emailErrorMessage = 'Invalid email';
          throw new Error('Invalid email');
        }
      }
      else {
        this.isEmailError = true;
        this.emailErrorMessage = 'Invalid email format';
      }
    }
    catch(error) {
      console.error(error);
      if(error instanceof HttpErrorResponse) {
        this.isEmailError = true;
        this.emailErrorMessage = error.error.message;
        this.notification.notification('error', error.error.message);
      }
      else {
        this.notification.notification('error', error as string);
      }
    }
  }
  //<=========== End Checking the password ============>

  protected async checkPhone(input: string): Promise<void> {
    try {
      const safeInput = input.trim();
      const checking = await this.userControlService.isPhoneNumberValid(safeInput);
      const isExistChecking = await this.API.getUserByPhone(safeInput);
      if(isExistChecking.status === 'error') {
        if(!checking) {
          this.isPhoneError = true;
          this.phoneErrorMessage = 'Invalid phone number';
          throw new Error('Invalid phone number');
        }
        else {
          this.isPhoneError = false;
          this.phoneErrorMessage = '';
        }
      }
      else if(isExistChecking.status === 'success') {
        this.isPhoneError = true;
        this.phoneErrorMessage = isExistChecking.message;
        throw new Error(isExistChecking.message);
      }
    }
    catch(error) {
      console.error(error);
      if(error instanceof HttpErrorResponse) {
        this.isPhoneError = true;
        this.phoneErrorMessage = error.error.message;
        this.notification.notification('error', error.error.message);
      }
      else {
        this.notification.notification('error', error as string);
      }
    }
  }

  //<======= Role Access autocomplete =======>
  protected hasModel(model: string): boolean {
    // const
    if(
      this.role in this.autoSelectedRoleAccess &&
      model in this.autoSelectedRoleAccess[this.role as Role]
    ) {
      return true;
    }
    return false;
  }

  protected hasAccess(access: string, model: string): boolean {
    if(
      this.role in this.autoSelectedRoleAccess &&
      model in this.autoSelectedRoleAccess[this.role as Role] &&
      this.autoSelectedRoleAccess[this.role as Role][model].includes(access)
    ) {
      return true;
    }
    return false;
  }

  protected toggleAccess(
    isChecked: boolean,
    module: string,
    action: string
  ): void {
    if(!(this.role in this.autoSelectedRoleAccess)) return;

    const accessMap = this.autoSelectedRoleAccess[this.role as Role];

    if(isChecked) {
      // If module doesn't exist yet, create it
      if(!accessMap[module]) {
        accessMap[module] = [];
      }

      // Add action if it's not already there
      if(!accessMap[module].includes(action)) {
        accessMap[module].push(action);
      }
    } else {
      // Remove action if it exists
      const index = accessMap[module]?.indexOf(action);
      if(index !== -1) {
        accessMap[module].splice(index, 1);
      }

      // If the module has no more actions, remove the module key itself
      if(accessMap[module]?.length === 0) {
        delete accessMap[module];
      }
    }
  }

  protected toggleModule(isChecked: boolean, module: string): void {
    if(!(this.role in this.autoSelectedRoleAccess)) return;

    const accessMap = this.autoSelectedRoleAccess[this.role as Role];

    if(isChecked) {
      const fullActions =
        ACCESS_OPTIONS.find((opt) => opt.module === module)?.actions || [];
      accessMap[module] = [...fullActions];
    } else {
      delete accessMap[module]; // or set it to an empty array if you prefer
    }
  }

  protected setPermissionsByRole(role: Role) {
    this.selectedPermissions = getDefaultAccessByRole(role);
    this.updateAllSelectedStates();
  }

  protected updateAllSelectedStates() {
    for(const mod of this.accessOptions) {
      const allTrue = mod.actions.every(
        (act) => this.selectedPermissions[mod.module]?.[act]
      );
      this.allSelected[mod.module] = allTrue;
    }
  }

  protected toggleAllActions(module: string, isChecked: boolean) {
    for(const action in this.selectedPermissions[module]) {
      this.selectedPermissions[module][action] = isChecked;
    }
    this.updateAllSelectedStates();
  }

  protected onPermissionChange() {
    this.updateAllSelectedStates();
  }

  protected getRoleAccessPayload(): ROLE_ACCESS_MAP {
    const role = this.role;
    const permissions: PermissionEntry[] = [];

    if(role in this.autoSelectedRoleAccess) {
      const modules = this.autoSelectedRoleAccess[role as Role];

      for(const [module, actions] of Object.entries(modules)) {
        if(actions.length > 0) {
          permissions.push({module, actions});
        }
      }
    }

    return {role, permissions};
  }

  //<=======End  Role Access autocomplete =======>

  protected async insertNewUser() {
    try {
      if(
        !this.isUserCanMakeUserActivate() &&
        !this.isUserCanMakeUserDeactivate() &&
        !this.isUserCanAssignUserRoles()
      ) {
        throw new Error('User does not have permission to perform the action.');
      }

      if(!this.fullname) {
        throw new Error('User full name is required');
      }
      if(!this.userGender) {
        throw new Error('User gender is required');
      }
      if(!this.email) {
        throw new Error('User email is required');
      }
      if(!this.phone) {
        throw new Error('User phone is required');
      }
      if(!this.houseNumber) {
        throw new Error('User house number is required');
      }
      if(!this.street) {
        throw new Error('User street is required');
      }
      if(!this.city) {
        throw new Error('User city is required');
      }
      if(!this.postcode) {
        throw new Error('User postcode is required');
      }
      if(!this.countryControl.value) {
        throw new Error('User country is required');
      }
      if(!this.dateOfBirth) {
        throw new Error('User date of birth is required');
      }
      if(!this.age) {
        throw new Error('User age is required');
      }
      if(!this.isValidAge) {
        throw new Error('User age is not valid');
      }
      if(!this.isActive) {
        throw new Error('User active status is required');
      }
      if(!this.userBio) {
        throw new Error('User bio is required');
      }
      if(!this.role) {
        throw new Error('User role is required');
      }
      if(!this.getRoleAccessPayload()) {
        throw new Error('User access is required');
      }

      if(!this.password) {
        throw new Error('User password is required');
      }

      if(this.isEmailError) {
        throw new Error(this.emailErrorMessage);
      }

      if(this.isPhoneError) {
        throw new Error(this.phoneErrorMessage);
      }

      if(this.isUsernameExist) {
        throw new Error('Username already exist');
      }

      if(!this.passwordMatchPattern) {
        throw new Error('Password does not match the pattern');
      }

      if(!this.usernameMatchPattern) {
        throw new Error('Username does not match the pattern');
      }

      if(!this.isValidAge) {
        throw new Error('User does not fit the age criteria');
      }

      const formData: FormData = new FormData();
      this.progress.start();

      formData.append('name', this.fullname.trim());
      formData.append('username', this.username.trim());
      formData.append('email', this.email.trim());
      formData.append('userPassword', this.password.trim());
      formData.append('phoneNumber', this.phone.trim());
      formData.append('role', this.role.trim());
      formData.append(
        'access',
        JSON.stringify(this.getRoleAccessPayload()).trim()
      );
      formData.append('isActive', this.isActive.toString().trim());
      formData.append('dateOfBirth', this.dateOfBirth.toString().trim());
      formData.append('age', this.age.trim());
      formData.append('gender', this.userGender.toLowerCase().trim());
      formData.append('houseNumber', this.houseNumber.trim());
      formData.append('street', this.street.trim());
      formData.append('city', this.city.trim());
      formData.append('postcode', this.postcode.trim());
      formData.append('bio', this.userBio.trim());
      if(typeof this.typedCountry === 'string') {
        formData.append('country', this.typedCountry.trim());
      } else {
        formData.append('country', this.typedCountry?.name.trim() as string);
      }
      formData.append('stateOrProvince', this.stateOrProvince.trim());

      if(this.userimage !== null) {
        formData.append(
          'userimage',
          this.userimage,
          `${this.username}_image.png`
        );
      } else {
        console.error('Image is empty!');
        return false;
      }

      const verifyEmail: object =
        await this.crypto.generateEmailVerificationToken();
      formData.append('verifyEmail', JSON.stringify(verifyEmail).trim());
      const now = new Date();
      const oneMonth = new Date(
        new Date(now.setMonth(now.getMonth() + 1)).getTime()
      );

      formData.append(
        'otpValidTime',
        JSON.stringify({
          otpValidTime: oneMonth,
        })
      );
      formData.append('updatedAt', this.updatedAt.toString());
      formData.append('createdAt', this.createdAt.toString());
      formData.append('creator', this.loogedUser?.username as string);

      await this.API.createNewUser(formData)
        .then((data: MSG_DATA_TYPE | null) => {
          if(this.notification && data)
            this.notification.notification(
              data?.status as msgTypes,
              data?.message as string
            );
        })
        .finally(() => {
          stop();
          this.progress.complete();
        });
      setTimeout(() => {
        this.router.navigate(['/dashboard/users']);
      }, 1000);
      return true;
    } catch(error) {
      console.log(error);
      this.notification.notification('error', error as string);
      return false;
    }
  }

  ngOnDestroy(): void {
    if(this.isBrowser) {
      window.removeEventListener('dragover', this.preventDefault);
      window.removeEventListener('drop', this.preventDefault);
    }

    this.modeSub?.unsubscribe();
  }
}
