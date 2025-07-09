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
import { WindowsRefService } from '../../services/windowRef/windowRef.service';
import { isPlatformBrowser, CommonModule, AsyncPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MatMomentDateModule,
  MomentDateAdapter,
} from '@angular/material-moment-adapter';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
} from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  Role,
  UsersType,
  ACCESS_OPTIONS,
  getDefaultAccessByRole,
  DEFAULT_ROLE_ACCESS,
  AccessMap,
  LoggedUserType,
} from '../../services/auth/auth.service';
import {
  APIsService,
  BaseUser,
  Country,
  MSG_DATA_TYPE,
  PermissionEntry,
  ROLE_ACCESS_MAP,
  validateType,
} from '../../services/APIs/apis.service';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { DomSanitizer } from '@angular/platform-browser';
import { MatDialogModule } from '@angular/material/dialog';
import {
  msgTypes,
  NotificationComponent,
} from '../../components/dialogs/notification/notification.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProgressBarComponent } from '../../components/dialogs/progress-bar/progress-bar.component';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { CryptoService } from '../../services/cryptoService/crypto.service';
import { CameraBoxComponent } from '../../components/dialogs/camera-box/camera-box.component';
import { EditorComponent } from '@tinymce/tinymce-angular';
import { AuthService } from '../../services/auth/auth.service';
import { SkeletonLoaderComponent } from '../../components/shared/skeleton-loader/skeleton-loader.component';

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

@Component({
  selector: 'app-edit-user',
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
    NotificationComponent,
    ProgressBarComponent,
    ImageCropperComponent,
    EditorComponent,
    CameraBoxComponent,
    SkeletonLoaderComponent,
  ],
  standalone: true,
  templateUrl: './edit-user.component.html',
  styleUrl: './edit-user.component.scss',
})
export class EditUserComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  @ViewChild(ProgressBarComponent) progress!: ProgressBarComponent;
  @ViewChild(NotificationComponent) notification!: NotificationComponent;
  @ViewChild(ImageCropperComponent) imageCropper!: ImageCropperComponent;
  @ViewChild(CameraBoxComponent) cameraBox!: CameraBoxComponent;

  protected user: BaseUser | null = null;
  protected isLoading: boolean = true;
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
  protected isEmailExist: boolean = false;
  protected emailMatchPattern: boolean = true;
  private readonly emailPattern: RegExp =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  private readonly phonePattern: RegExp = /^\+?[0-9\s\-()]{10,15}$/;
  protected phoneMatchPattern: boolean = true;
  protected isPhoneExist: boolean = false;
  protected readonly definedGender: string[] = ['Male', 'Female', 'Other'];
  protected accessOptions = ACCESS_OPTIONS;
  protected selectedPermissions: {
    [module: string]: { [action: string]: boolean };
  } = {};
  protected allSelected: { [module: string]: boolean } = {};
  protected autoSelectedRoleAccess: Record<Role, AccessMap> =
    DEFAULT_ROLE_ACCESS;
  protected isCameraOpen: boolean = false;
  private loggedUser: LoggedUserType | null = null;

  //User data
  protected username: string = '';
  protected password: string = '';
  protected fullname: string = '';
  protected email: string = '';
  private oldEmail: string = '';
  protected phone: string = '';
  protected street: string = '';
  protected typedCountry: Country | string | null = '';
  protected houseNumber: string = '';
  protected city: string = '';
  protected postcode: string = '';
  protected stateOrProvince: string = '';
  protected role: string = '';
  protected userimage: File | null = null;
  protected userExistedImage: string = '';
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
  private creator: string = '';
  private updator: string = '';

  //User access
  protected userAccess: ROLE_ACCESS_MAP = {} as ROLE_ACCESS_MAP;

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
  protected showCropper = false;
  protected croppedImage: any = '';

  init: EditorComponent['init'] = {
    plugins: 'lists link image table code help wordcount',
  };

  protected isDragOver: boolean = false;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private activatedRouter: ActivatedRoute,
    private router: Router,
    private API: APIsService,
    private crypto: CryptoService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private authService: AuthService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.activatedRouter.url.subscribe((segments) => {});
    this.iconCreator();
    this.loggedUser = this.authService.getLoggedUser;
    this.updator = this.loggedUser !== null ? this.loggedUser.username : '';

    this.activatedRouter.params.subscribe((param) => {
      this.username = param['username'];
    });
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      // Prevent default drag/drop behavior globally
      window.addEventListener('dragover', this.preventDefault, {
        passive: false,
      });
      window.addEventListener('drop', this.preventDefault, { passive: false });

      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
      await this.loadData();
    }
  }

  ngAfterViewInit() {}

  private iconCreator() {
    const icons = [
      { name: 'camera', path: '/Images/Icons/camera.svg' },
      { name: 'upload', path: '/Images/Icons/upload.svg' },
      { name: 'insert', path: '/Images/Icons/user-plus.svg' },
    ];

    for (let icon of icons) {
      this.matIconRegistry.addSvgIcon(
        icon.name,
        this.domSanitizer.bypassSecurityTrustResourceUrl(icon.path)
      );
    }
  }

  protected detectGender(value: string) {
    if (value === 'Male') {
      this.definedImage = this.definedMaleDummyImageURL;
    } else if (value === 'Female') {
      this.definedImage = this.definedWomanDummyImageURL;
    } else {
      this.definedImage = this.definedMaleDummyImageURL;
    }
  }

  //<==================== User Validation Operations ====================>
  protected isUserCanChangeTheUserName(): boolean {
    return (
      this.loggedUser?.access.permissions.some(
        (permission) =>
          permission.module === 'User Management' &&
          permission.actions.includes('change username')
      ) ?? false
    );
  }

  protected isUserCanResetThePassword(): boolean {
    return (
      this.loggedUser?.access.permissions.some(
        (permission) =>
          permission.module === 'User Management' &&
          permission.actions.includes('reset password')
      ) ?? false
    );
  }

  protected isUserCanMakeUserActivate(): boolean {
    return (
      this.loggedUser?.access.permissions.some(
        (permission) =>
          permission.module === 'User Management' &&
          permission.actions.includes('activate')
      ) ?? false
    );
  }

  protected isUserCanMakeUserDeactivate(): boolean {
    return (
      this.loggedUser?.access.permissions.some(
        (permission) =>
          permission.module === 'User Management' &&
          permission.actions.includes('deactivate')
      ) ?? false
    );
  }

  protected isUserCanAssignUserRoles(): boolean {
    return (
      this.loggedUser?.access.permissions.some(
        (permission) =>
          permission.module === 'User Management' &&
          permission.actions.includes('assign roles')
      ) ?? false
    );
  }
  //<==================== End User Validation Operations ====================>

  //<==================== Load Data ====================>
  private async loadData() {
    if (this.isBrowser) {
      await this.API.getUserByToken(this.username)
        .then((data) => {
          if (data.user) {
            const user = data.user;
            // Assising the user all data
            this.fullname = user.name;
            this.userGender =
              user.gender.charAt(0).toUpperCase() + user.gender.slice(1);
            this.detectGender(this.userGender);
            this.username = user.username;
            this.email = user.email;
            this.oldEmail = user.email;
            this.phone = user.phoneNumber ?? '';
            this.dateOfBirth = new Date(user.dateOfBirth ?? '');
            this.age = user.age;
            this.isValidAge = user.age >= 18;
            this.isActive = user.isActive;
            this.role = user.role;
            this.userBio = user.bio;
            this.updatedAt = new Date(user.updatedAt ?? '');
            this.createdAt = new Date(user.createdAt ?? '');
            this.creator = user.creator ?? '';
            this.updator = user.updator ?? '';

            // Address
            this.houseNumber = user.address.houseNumber;
            this.street = user.address.street;
            this.city = user.address.city;
            this.stateOrProvince = user.address.stateOrProvince ?? '';
            this.postcode = user.address.postcode;
            this.countryControl.setValue(user.address.country ?? '');
            this.typedCountry = user.address.country ?? '';
            this.onCountryChange(user.address.country ?? '');

            this.userAccess = user.access;
            this.setPermissionsByRole(user.role as Role);

            this.userAccess.permissions.forEach((permission) => {
              this.hasModel(permission.module);
              this.toggleModule(true, permission.module);
              permission.actions.forEach((action) => {
                this.hasAccess(action, permission.module);
                this.toggleAccess(true, permission.module, action);
              });
            });
            this.updateAllSelectedStates();

            // Assising the user image
            this.userExistedImage = user.image as string;
            setTimeout(() => {
              this.isLoading = false;
            }, 500);
          }
        })
        .catch((error) => {
          if (error) {
            this.router.navigate(['/dashboard/unauthorized']);
          }
        });
    }
  }

  protected detectUserImage(image: string, gender: string): string {
    if (typeof image === 'string') {
      const imageArray: string[] = image ? image.split('/') : [];
      if (imageArray.length > 0) {
        if (
          this.definedImageExtentionArray.includes(
            imageArray[imageArray.length - 1].split('.')[1]
          )
        ) {
          return image;
        } else {
          if (gender === 'male') {
            return this.definedMaleDummyImageURL;
          } else {
            return this.definedWomanDummyImageURL;
          }
        }
      }
    } else {
      return gender.toLowerCase() === 'male'
        ? this.definedMaleDummyImageURL
        : this.definedWomanDummyImageURL;
    }
    // Ensure a string is always returned
    return gender.toLowerCase() === 'male'
      ? this.definedMaleDummyImageURL
      : this.definedWomanDummyImageURL;
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
    for (let i = 0; i < byteString.length; i++) {
      byteArray[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: 'image/png' });
    return new File([blob], 'image.png', { type: 'image/png' });
  }

  //<=========== End Capture the image and upload the image ============>

  //<=========== Image Past On File Input ============>

  @HostListener('document:paste', ['$event'])
  protected handlePaste(event: ClipboardEvent): void {
    const target = event.target as HTMLElement;

    // Allow default behavior for text inputs and editable fields
    if (
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
    if (!items) return;

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
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
    this.onFileSelected({ target: input } as any);
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
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
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
    this.onFileSelected({ target: input } as any);
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
    this.detectUserImage(this.userUploadedImage, this.userGender);
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
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/dashboard/users']);
    });
  }

  protected async goToUser() {
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/dashboard/add-new-user']);
    });
  }
  //<=========== End Page indicator ============>

  //<=========== Check the Age ============>

  protected checkAge(value: string | number) {
    const age = Number(value);
    this.isValidAge = age >= 18;
  }

  //<=========== End Check the Age ============>

  //<=========== Validating the Date of birth ============>
  protected validateDateOfBirth(value: Date | string): void {
    if (!value) {
      this.isValidAge = false;
      this.age = 0;
      return;
    }

    const dateOfBirth = new Date(value);
    const today = new Date();

    // Calculate age precisely, accounting for month/day
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    const dayDiff = today.getDate() - dateOfBirth.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }
    this.isValidAge = age >= 18;
  }

  protected async onCountryChange(value: string): Promise<void> {
    this.typedCountry = value;
    this.countries = await this.mainFilterCountries();
  }

  private async mainFilterCountries(): Promise<Country[]> {
    const countries: Country[] = await this.API.getCountries();
    if (!Array.isArray(countries)) return [];

    if (countries) {
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
    if (this.usernamePattern.test(input.value)) {
      this.usernameMatchPattern = true;
    } else {
      this.usernameMatchPattern = false;
    }
    if (this.usernameMatchPattern) {
      const checking: validateType = await this.API.getUserByUsername(
        input.value
      );
      if (checking.status === 'true') {
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
    if (this.strongPasswordPattern.test(password)) {
      this.passwordMatchPattern = true;
    } else {
      this.passwordMatchPattern = false;
    }
  }
  //<=========== End Checking the password ============>

  //<=========== Checking the email ============>
  protected async checkEmail(event: Event): Promise<void> {
    this.emailMatchPattern = false;
    const input = event.target as HTMLInputElement;
    if (this.emailPattern.test(input.value)) {
      this.emailMatchPattern = true;
    } else {
      this.emailMatchPattern = false;
    }
    if (this.emailMatchPattern) {
      const checking: validateType = await this.API.getUserByEmail(input.value);
      if (checking.status === 'true') {
        this.isEmailExist = true;
      } else {
        this.isEmailExist = false;
      }
    }
  }
  //<=========== End Checking the password ============>

  protected async checkPhone(event: Event): Promise<void> {
    this.phoneMatchPattern = false;
    const input = event.target as HTMLInputElement;
    const phone = input.value;
    if (this.phonePattern.test(phone)) {
      this.phoneMatchPattern = true;
      const checking: validateType = await this.API.getUserByPhone(phone);
      if (checking.status === 'true') {
        this.isPhoneExist = true;
      } else {
        this.isPhoneExist = false;
      }
    } else {
      this.phoneMatchPattern = false;
    }
  }

  //<======= Role Access autocomplete =======>
  /**
   * Checks if the current role has any access defined for a given module.
   * @param model - The module name to check.
   * @returns true if the module exists under the current role's access; otherwise, false.
   */
  protected hasModel(model: string): boolean {
    if (
      this.role in this.autoSelectedRoleAccess &&
      model in this.autoSelectedRoleAccess[this.role as Role]
    ) {
      return true;
    }
    return false;
  }

  /**
   * Checks if the current role has a specific action (like 'read', 'write') under a module.
   * @param access - The specific permission to check.
   * @param model - The module in which the permission should be checked.
   * @returns true if the permission exists; otherwise, false.
   */
  protected hasAccess(access: string, model: string): boolean {
    if (
      this.role in this.autoSelectedRoleAccess &&
      model in this.autoSelectedRoleAccess[this.role as Role] &&
      this.autoSelectedRoleAccess[this.role as Role][model].includes(access)
    ) {
      return true;
    }
    return false;
  }

  /**
   * Adds or removes a specific permission (action) for the current role and module.
   * Used when a checkbox is toggled in the UI for individual permissions.
   * @param isChecked - True if permission is being added, false if removed.
   * @param module - The target module name.
   * @param action - The specific action/permission.
   */
  protected toggleAccess(
    isChecked: boolean,
    module: string,
    action: string
  ): void {
    if (!(this.role in this.autoSelectedRoleAccess)) return;

    const accessMap = this.autoSelectedRoleAccess[this.role as Role];

    if (isChecked) {
      // Create the module entry if it doesn't exist
      if (!accessMap[module]) {
        accessMap[module] = [];
      }

      // Add the action if it isn't already present
      if (!accessMap[module].includes(action)) {
        accessMap[module].push(action);
      }
    } else {
      // Remove the action if it exists
      const index = accessMap[module]?.indexOf(action);
      if (index !== -1) {
        accessMap[module].splice(index, 1);
      }

      // If the module has no more actions, remove the module key itself
      if (accessMap[module]?.length === 0) {
        delete accessMap[module];
      }
    }
  }

  /**
   * Toggles the full set of actions for a given module based on a "select all" checkbox.
   * @param isChecked - True if all actions are selected, false if they are to be removed.
   * @param module - The module whose permissions are being toggled.
   */
  protected toggleModule(isChecked: boolean, module: string): void {
    if (!(this.role in this.autoSelectedRoleAccess)) return;

    const accessMap = this.autoSelectedRoleAccess[this.role as Role];

    if (isChecked) {
      const fullActions =
        ACCESS_OPTIONS.find((opt) => opt.module === module)?.actions || [];
      accessMap[module] = [...fullActions];
    } else {
      delete accessMap[module]; // Removes entire module permission entry
    }
  }

  /**
   * Initializes permission checkboxes for a newly selected role.
   * Loads default permissions associated with the selected role.
   * @param role - The role whose default permissions are to be loaded.
   */
  protected setPermissionsByRole(role: Role) {
    this.selectedPermissions = getDefaultAccessByRole(role);
    this.updateAllSelectedStates();
  }

  /**
   * Updates the UI state that tracks whether all checkboxes in a module are selected.
   * Used to control "select all" checkboxes at the module level.
   */
  protected updateAllSelectedStates() {
    for (const mod of this.accessOptions) {
      const allTrue = mod.actions.every(
        (act) => this.selectedPermissions[mod.module]?.[act]
      );
      this.allSelected[mod.module] = allTrue;
    }
  }

  /**
   * Toggles all individual actions (checkboxes) under a module.
   * This supports bulk selection or deselection at module level.
   * @param module - Module name to be toggled.
   * @param isChecked - State to apply to all actions (true = checked).
   */
  protected toggleAllActions(module: string, isChecked: boolean) {
    for (const action in this.selectedPermissions[module]) {
      this.selectedPermissions[module][action] = isChecked;
    }
    this.updateAllSelectedStates();
  }

  /**
   * Recalculates module-level "select all" checkboxes when an individual action is changed.
   */
  protected onPermissionChange() {
    this.updateAllSelectedStates();
  }

  /**
   * Converts the current access selection UI state into a payload suitable for saving to the DB.
   * @returns An object containing the role and its permission structure.
   */
  protected getRoleAccessPayload(): ROLE_ACCESS_MAP {
    const role = this.role;
    const permissions: PermissionEntry[] = [];

    if (role in this.autoSelectedRoleAccess) {
      const modules = this.autoSelectedRoleAccess[role as Role];

      for (const [module, actions] of Object.entries(modules)) {
        if (actions.length > 0) {
          permissions.push({ module, actions });
        }
      }
    }

    return { role, permissions };
  }

  // <======= End Role Access Autocomplete Section =======>

  protected async insertNewUser() {
    try {
      const verifyEmail: object =
        await this.crypto.generateEmailVerificationToken();

      const now = new Date();

      const oneMonth = new Date(
        new Date(now.setMonth(now.getMonth() + 1)).getTime()
      );

      if (
        !this.isUserCanMakeUserActivate() &&
        !this.isUserCanMakeUserDeactivate() &&
        !this.isUserCanAssignUserRoles()
      ) {
        throw new Error('User does not have permission to perform the action.');
      }

      if (!this.fullname) {
        throw new Error('User full name is required');
      }
      if (!this.userGender) {
        throw new Error('User gender is required');
      }
      if (!this.email) {
        throw new Error('User email is required');
      }
      if (!this.phone) {
        throw new Error('User phone is required');
      }
      if (!this.houseNumber) {
        throw new Error('User house number is required');
      }
      if (!this.street) {
        throw new Error('User street is required');
      }
      if (!this.city) {
        throw new Error('User city is required');
      }
      if (!this.postcode) {
        throw new Error('User postcode is required');
      }
      if (!this.countryControl.value) {
        throw new Error('User country is required');
      }
      if (!this.dateOfBirth) {
        throw new Error('User date of birth is required');
      }
      if (!this.age) {
        throw new Error('User age is required');
      }
      if (!this.isValidAge) {
        throw new Error('User age is not valid');
      }
      if (!this.isActive) {
        throw new Error('User active status is required');
      }
      if (!this.userBio) {
        throw new Error('User bio is required');
      }
      if (!this.role) {
        throw new Error('User role is required');
      }
      if (!this.getRoleAccessPayload()) {
        throw new Error('User access is required');
      }

      if (this.isEmailExist) {
        throw new Error('Email already exist');
      }

      if (this.isPhoneExist) {
        throw new Error('Phone already exist');
      }

      if (this.isUsernameExist) {
        throw new Error('Username already exist');
      }

      if (!this.passwordMatchPattern) {
        throw new Error('Password does not match the pattern');
      }

      if (!this.emailMatchPattern) {
        throw new Error('Email does not match the pattern');
      }

      if (!this.usernameMatchPattern) {
        throw new Error('Username does not match the pattern');
      }

      if (!this.phoneMatchPattern) {
        throw new Error('Contact number does not match the pattern');
      }

      if (!this.isValidAge) {
        throw new Error('User does not fit the age criteria');
      }

      const formData: FormData = new FormData();
      this.progress.start();
      formData.append('username', this.username.trim());
      formData.append('password', this.password.trim());
      formData.append('name', this.fullname.trim());
      formData.append('email', this.email.trim());
      formData.append('oldEmail', this.oldEmail.trim());
      formData.append('dateOfBirth', this.dateOfBirth.toISOString().trim());
      formData.append('age', this.age.toString().trim());
      formData.append(
        'gender',
        this.userGender.toString().toLowerCase().trim()
      );
      formData.append('bio', this.userBio.trim());
      formData.append('phoneNumber', this.phone.toString().trim());

      if (this.userimage !== null) {
        console.log('Image not null');
        formData.append(
          'userimage',
          this.userimage as File,
          `${this.username}_image.png`
        );
      } else {
        console.log('Image null: ', this.userExistedImage);
        formData.append('userimage', this.userExistedImage);
      }
      formData.append('role', this.role);
      formData.append('isActive', this.isActive.toString());
      formData.append('street', this.street.trim());
      formData.append('houseNumber', this.houseNumber.toString().trim());
      formData.append('city', this.city.trim());
      formData.append('stateOrProvince', this.stateOrProvince.trim());
      formData.append('postcode', this.postcode.toString().trim());
      formData.append('country', this.countryControl.value.trim());
      formData.append(
        'access',
        JSON.stringify(this.getRoleAccessPayload()).trim()
      );
      formData.append('otpToken', JSON.stringify(verifyEmail).trim());
      formData.append(
        'otpValidTime',
        JSON.stringify({
          otpValidTime: oneMonth,
        })
      );
      formData.append('updatedAt', this.updatedAt.toString());
      formData.append('creator', this.creator as string);
      formData.append('updator', this.updator as string);

      await this.API.updateUser(formData, this.username)
        .then((res) => {
          console.log(res);
          if (res && res.status === 'success') {
            this.notification.notification(res.status, res.message);
          } else {
            this.notification.notification('Error', 'User update failed');
          }
        })
        .catch((res) => {
          if (res && res.status === 'error') {
            this.notification.notification(res.status, res.message);
          } else {
            this.notification.notification('Error', 'User update failed');
          }
        })
        .finally(() => {
          this.progress.complete();
          setTimeout(() => {
            this.router.navigate(['/dashboard/users']);
          }, 1000);
        });
    } catch (error) {
      if (error) {
        this.notification.notification('error', error as string);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      window.removeEventListener('dragover', this.preventDefault);
      window.removeEventListener('drop', this.preventDefault);
    }

    this.modeSub?.unsubscribe();
  }
}
