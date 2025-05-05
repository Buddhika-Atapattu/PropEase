import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
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
import { MatIconModule } from '@angular/material/icon';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule } from '@angular/material/select';
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
import { SkeletonLoaderComponent } from '../shared/skeleton-loader/skeleton-loader.component';
import { File } from 'buffer';
import { Observable, of } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

interface userActiveStatusType {
  typeName: string;
  isActive: boolean;
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
  ],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'], // Correct: `styleUrls` not `styleUrl`
})
export class UserProfileComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  private isEditable: boolean = false;
  protected user: LoggedUserType | null = null;
  protected isEditing: boolean = false;

  //User data
  protected firstname: BaseUser['firstName'] = '';
  protected middlename: BaseUser['middleName'] = '';
  protected lastname: BaseUser['lastName'] = '';
  protected email: BaseUser['email'] = '';
  protected phone: BaseUser['phoneNumber'] = '';
  protected street: Address['street'] = '';
  protected houseNumber: Address['houseNumber'] = '';
  protected city: Address['city'] = '';
  protected postcode: Address['postcode'] = '';
  protected country: Address['country'] = '';
  protected stateOrProvince: Address['stateOrProvince'] = '';
  protected role: Role['role'] = 'user';
  protected userimage: BaseUser['image'] = '';
  protected age: BaseUser['age'] = 0;
  protected isActive: BaseUser['isActive'] = false;
  protected updatedAt: BaseUser['updatedAt'] = new Date();
  protected countries: Country[] = [];
  protected typedCountry: Country | string | null = '';
  protected countryControl = new FormControl<string>('');
  protected filteredCountries!: Observable<Country[]>;
  protected readonly definedRole: Role[] = [
    { role: 'admin' },
    { role: 'agent' },
    { role: 'tenant' },
    { role: 'operator' },
    { role: 'developer' },
    { role: 'user' },
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

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private authService: AuthService,
    private API: APIsService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
    this.user = this.authService.getLoggedUser;
    if (this.user !== null) {
      this.firstname = this.user.firstName;
      this.middlename = this.user.middleName;
      this.lastname = this.user.lastName;
      this.email = this.user.email;
      this.phone = this.user.phoneNumber;
      this.street = this.user.address.street;
      this.houseNumber = this.user.address.houseNumber;
      this.city = this.user.address.city;
      this.postcode = this.user.address.postcode;
      this.country = this.user.address.country;
      this.stateOrProvince = this.user.address.stateOrProvince;
      this.role = this.user.role.role;
      this.userimage = this.user.image;
      this.age = this.user.age;
      this.isActive = this.user.isActive;
      this.updatedAt = this.user.updatedAt;
      this.countryControl.setValue(this.user.address.country ?? null);
      this.onCountryChange(this.user.address.country ?? '');
      this.isAdmin = this.user.role.role === 'admin';
      this.birthDay = this.user.dateOfBirth || null;
    }
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
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
      this.userimage = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.userUploadedImage = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  protected async updateUserData(): Promise<void> {
    if (this.user !== null) {
      const formData = new FormData();
      formData.append('firstname', this.firstname);
      formData.append('middlename', this.middlename || '');
      formData.append('lastname', this.lastname);
      formData.append('email', this.email);
      formData.append('phone', this.phone || '');
      formData.append('street', this.street);
      formData.append('houseNumber', this.houseNumber || '');
      formData.append('city', this.city);
      formData.append('postcode', this.postcode);
      formData.append('country', this.country || '');
      formData.append('stateOrProvince', this.stateOrProvince || '');
      formData.append('role', this.role);
      formData.append('image', this.userimage || '');
      formData.append('age', this.age.toString());
      formData.append('isActive', this.isActive.toString());
      formData.append('updatedAt', this.updatedAt.toString());
      formData.append('dateOfBirth', this.birthDay?.toString() || '');
      formData.append('username', this.user?.username || '');
      const user = this.user?.username;
      await this.API.updateUser(formData, user);
      console.log(formData);
    } else {
      console.error('User: ', this.user);
    }
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
