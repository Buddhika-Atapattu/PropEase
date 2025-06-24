import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  AfterViewInit,
} from '@angular/core';
import { WindowsRefService } from '../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule, AsyncPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import {
  MatCheckboxChange,
  MatCheckboxModule,
} from '@angular/material/checkbox';
import {
  AuthService,
  UserCredentials,
  NewUser,
  Address,
  Role,
  UsersType,
  LoggedUserType,
  BaseUser,
  UpdateUserType,
} from '../../../services/auth/auth.service';
import { APIsService, Country } from '../../../services/APIs/apis.service';
import { SkeletonLoaderComponent } from '../../components/shared/skeleton-loader/skeleton-loader.component';
import { Observable, of, firstValueFrom } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { DomSanitizer } from '@angular/platform-browser';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
  MatDialogModule,
} from '@angular/material/dialog';
import { UserProfileDataSaveConfirmationComponent } from '../../components/dialogs/user-profile-data-save-confirmation/user-profile-data-save-confirmation.component';
import {
  msg,
  msgTypes,
  NotificationComponent,
} from '../../components/dialogs/notification/notification.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProgressBarComponent } from '../../components/dialogs/progress-bar/progress-bar.component';

interface userActiveStatusType {
  typeName: string;
  isActive: boolean;
}

export interface MSG_DATA_TYPE extends UpdateUserType {
  status: string;
  message: string;
  user: UpdateUserType;
}

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    SkeletonLoaderComponent,
    MatAutocompleteModule,
    AsyncPipe,
    MatDatepickerModule,
    MatSelectModule,
    MatDividerModule,
    MatDialogModule,
    NotificationComponent,
    MatProgressBarModule,
    ProgressBarComponent,
  ],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'], // Correct: `styleUrls` not `styleUrl`
})
export class UserProfileComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  private isEditable: boolean = false;
  protected user: LoggedUserType | null = null;
  protected isEditing: boolean = false;

  //User data
  protected name: BaseUser['name'] = '';
  protected gender: BaseUser['gender'] = '';
  protected email: BaseUser['email'] = '';
  protected phone: BaseUser['phoneNumber'] = '';
  protected street: Address['street'] = '';
  protected houseNumber: Address['houseNumber'] = '';
  protected city: Address['city'] = '';
  protected postcode: Address['postcode'] = '';
  protected stateOrProvince: Address['stateOrProvince'] = '';
  protected role: Role = 'user';
  protected userimage: BaseUser['image'] = '';
  protected selectedUserImage: File = new File([], '');
  protected age: BaseUser['age'] = 0;
  protected isActive: BaseUser['isActive'] = false;
  protected updatedAt: BaseUser['updatedAt'] = new Date();
  protected country: BaseUser['address']['country'] = '';
  protected countries: Country[] = [];
  protected typedCountry: Country | string | null = '';
  protected countryControl = new FormControl<string>('');
  protected filteredCountries!: Observable<Country[]>;
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
  protected isAdmin: boolean = false;
  protected birthDay: Date | null = new Date();
  protected userUploadedImage: string = '';
  public isEditConfirm: boolean = false;
  protected progerssOfUpload: number = 0;
  @ViewChild(ProgressBarComponent) progress!: ProgressBarComponent;
  @ViewChild(NotificationComponent) notification!: NotificationComponent;
  protected isLoading: boolean = true;
  protected readonly definedGenders: string[] = ['male', 'female', 'other'];

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private authService: AuthService,
    private API: APIsService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private dialog: MatDialog
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
    this.iconMaker();
    this.user = this.authService.getLoggedUser;
    if (this.user !== null) {
      setTimeout(() => {
        this.isLoading = false;
      }, 500);
      this.name = this.user.name;
      this.gender = this.user.gender;
      this.email = this.user.email;
      this.phone = this.user.phoneNumber;
      this.street = this.user.address.street;
      this.houseNumber = this.user.address.houseNumber;
      this.city = this.user.address.city;
      this.postcode = this.user.address.postcode;
      this.stateOrProvince = this.user.address.stateOrProvince;
      this.role = this.user.role;
      this.country = this.user.address.country;
      this.userimage = this.user.image;
      this.age = this.user.age;
      this.isActive = this.user.isActive;
      this.updatedAt = this.user.updatedAt;
      this.countryControl.setValue(this.user.address.country ?? null);
      this.onCountryChange(this.user.address.country ?? '');
      this.isAdmin = this.user.role === 'admin';
      this.birthDay = this.user.dateOfBirth || null;
      if (typeof this.userimage === 'string') {
        const imageURL = this.userimage.split('.');
        if (imageURL[1] === undefined) {
          this.userimage = '/Images/user-images/dummy-user/dummy-user.jpg';
        } else {
          this.userimage = this.user.image;
        }
      }
    }
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  ngAfterViewInit() {
    this.notification.notification('', '');
  }

  private iconMaker() {
    const icons = [
      { name: 'active', path: '/Images/Icons/correct.svg' },
      { name: 'wrong', path: '/Images/Icons/wrong.svg' },
    ];

    for (let icon of icons) {
      this.matIconRegistry.addSvgIcon(
        icon.name,
        this.domSanitizer.bypassSecurityTrustResourceUrl(icon.path)
      );
    }
  }

  displayFn(country: Country): string {
    return typeof country === 'string' ? country : country?.name ?? '';
  }

  protected async onCountryChange(value: string): Promise<void> {
    this.typedCountry = value;
    this.countries = await this.mainFilterCountries(value);
  }

  private async mainFilterCountries(name: string): Promise<Country[]> {
    const countries = await this.API.getCountries();
    if (countries !== null) {
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

  protected changeEdit() {
    this.isEditing = !this.isEditing;
  }

  private _filterCountries(name: string): Country[] {
    const filterValue = name.toLowerCase();
    return this.countries.filter((c) =>
      c.name.toLowerCase().includes(filterValue)
    );
  }

  protected triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input?.files && input.files.length > 0) {
      const file = input.files[0];
      this.selectedUserImage = file;
      this.userimage = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.userUploadedImage = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  protected onImageError() {}

  get modeTheam(): boolean | null {
    return this.mode;
  }

  //Trying to open the dialog find the error
  private async openDialog() {
    try {
      if (this.mode !== null) {
        const dialogRef: MatDialogRef<UserProfileDataSaveConfirmationComponent> =
          this.dialog.open(UserProfileDataSaveConfirmationComponent, {
            data: {
              isEditConfirm: this.isEditConfirm,
            },
          });

        const result = await firstValueFrom(dialogRef.afterClosed());
        this.isEditConfirm = result === true;
      }
    } catch (error) {
      console.error('Dialog failed to open:', error);
    }
  }

  protected async updateUserData(): Promise<void> {
    await this.openDialog().then(async () => {
      if (this.user !== null && this.isEditConfirm) {
        this.progress.start();
        this.progerssOfUpload = 0;
        const formData = new FormData();
        formData.append('name', this.name);
        formData.append('gender', this.gender);
        formData.append('email', this.email);
        formData.append('phone', this.phone || '');
        formData.append('street', this.street);
        formData.append('houseNumber', this.houseNumber || '');
        formData.append('city', this.city);
        formData.append('postcode', this.postcode);
        if (
          typeof this.typedCountry === 'object' &&
          this.typedCountry !== null
        ) {
          formData.append('country', this.typedCountry.name);
        } else if (typeof this.typedCountry === 'string') {
          formData.append('country', this.typedCountry);
        }
        formData.append('stateOrProvince', this.stateOrProvince || '');
        formData.append('role', this.role);
        if (
          typeof File !== 'undefined' &&
          this.selectedUserImage instanceof File
        ) {
          formData.append('userimage', this.selectedUserImage);
        }
        formData.append('age', this.age.toString());
        formData.append('isActive', this.isActive.toString());
        formData.append('updatedAt', this.updatedAt.toString());
        formData.append('dateOfBirth', this.birthDay?.toString() || '');
        formData.append('username', this.user?.username || '');
        const user = this.user?.username;
        await this.API.updateUser(formData, user)
          .then((data: MSG_DATA_TYPE | null) => {
            if (this.notification && data)
              this.notification.notification(
                data?.status as msgTypes,
                data?.message as string
              );
          })
          .finally(() => {
            stop();
            this.progress.complete();
          });
      } else {
        console.error('User: ', this.user);
      }
    });
  }

  get isEditableForm(): boolean {
    return this.isEditable;
  }

  set isEditableForm(value: boolean) {
    this.isEditable = value;
  }

  get getUser(): LoggedUserType | null {
    return this.authService.getLoggedUser;
  }

  get auth(): AuthService {
    return this.authService;
  }

  protected onEdit() {
    this.isEditable = true;
  }

  protected onSubmit() {}

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }
}
