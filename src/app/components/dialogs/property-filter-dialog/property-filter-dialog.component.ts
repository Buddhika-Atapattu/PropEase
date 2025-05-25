import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  AfterViewInit,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import {
  FormBuilder,
  Validators,
  FormsModule,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { isPlatformBrowser, CommonModule, AsyncPipe } from '@angular/common';
import { WindowsRefService } from '../../../../services/windowRef.service';
import { Subscription } from 'rxjs';
import { MatSliderModule } from '@angular/material/slider';
import {
  ChangeContext,
  NgxSliderModule,
  Options,
} from '@angular-slider/ngx-slider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
// MatButtonToggleModule,

@Component({
  selector: 'app-property-filter-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatRadioModule,
    MatStepperModule,
    MatTableModule,
    MatSliderModule,
    NgxSliderModule,
    MatAutocompleteModule,
    MatButtonToggleModule,
    MatDialogModule,
  ],
  templateUrl: './property-filter-dialog.component.html',
  styleUrl: './property-filter-dialog.component.scss',
})
export class PropertyFilterDialogComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  // Dialog data
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  //Price range variables
  protected minPriceInput: number = 0;
  protected maxPriceInput: number = 0;
  protected isSliderChanging: boolean = false;

  protected sliderOptions: Options = {
    floor: 0,
    ceil: 100000000,
    step: 1,
    minRange: 0,
    maxRange: 100000000,
    maxLimit: 100000000,
    minLimit: 0,
    rotate: 0,
    animate: true,
    draggableRange: true,
    showSelectionBar: true,
    translate: (value: number): string => {
      return `${value.toLocaleString()}`;
    },
  };

  protected maxPrice: number = Number(this.sliderOptions.ceil) ?? 100;
  protected minPrice: number = Number(this.sliderOptions.floor) ?? 0;

  //Beds
  protected beds: number = 0;

  //Bathrooms
  protected bathrooms: number = 0;

  //Amenities
  protected amenities: string[] = FEATURES_AMENITIES;
  protected isAmenityInputTyping: boolean = false;
  protected amenity: string = '';
  protected filteredAmenities: string[] = [];
  protected selectedAmenities: string[] = [];

  protected typeOptions: string[] = [
    'Apartment',
    'House',
    'Villa',
    'Commercial',
    'Land',
    'Stodio',
  ];
  protected filterTypeOptions: string[] = [];
  protected selectedType: string = '';
  protected isTypeSelectChanging: boolean = false;

  protected statusOptions: string[] = ['Sale', 'Rent', 'Sold', 'Rented'];
  protected filterStatusOptions: string[] = [];
  protected selectedStatus: string = '';
  protected isStatusSelectChanging: boolean = false;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(MAT_DIALOG_DATA)
    public data: any = {},
    public dialogRef: MatDialogRef<PropertyFilterDialogComponent>,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    // Force redraw after DOM
  }

  ngOnDestroy(): void {}

  //<==================== Sort property type ====================>

  protected propertyTypeSort(): string[] {
    if (this.filterTypeOptions.length === 0) {
      return this.typeOptions.sort((a, b) => a.localeCompare(b));
    } else {
      return this.filterTypeOptions.sort((a, b) => a.localeCompare(b));
    }
  }
  //<==================== End sort property type ====================>

  //<==================== Sort property status ====================>
  protected propertyStatusSort(): string[] {
    if (this.filterStatusOptions.length === 0) {
      return this.statusOptions.sort((a, b) => a.localeCompare(b));
    } else {
      return this.filterStatusOptions.sort((a, b) => a.localeCompare(b));
    }
  }
  //<==================== End sort property status ====================>

  //<==================== Sort property amenities ====================>
  protected propertyAmenitiesSort(): string[] {
    if (this.filteredAmenities.length === 0) {
      return this.amenities.sort((a, b) => a.localeCompare(b));
    } else {
      return this.filteredAmenities.sort((a, b) => a.localeCompare(b));
    }
  }
  //<==================== End sort property amenities ====================>

  //<=========================== type changing ===========================>
  protected typeChanging(): void {
    this.isTypeSelectChanging = true;
  }
  //<=========================== end type changing ===========================>

  //<=========================== status changing ===========================>
  protected statusChanging(): void {
    this.isStatusSelectChanging = true;
  }
  //<=========================== end status changing ===========================>

  //<=========================== Price Range ===========================>
  protected detectSliderChange(value: ChangeContext) {
    this.isSliderChanging = true;
    if (value.pointerType === 1) {
      this.maxPriceInput = value.highValue ?? this.maxPriceInput;
    } else {
      this.minPriceInput = value.value ?? this.minPriceInput;
    }
  }
  protected onMinInputChange(value: number) {
    this.isSliderChanging = true;
    this.minPrice = value;
  }

  protected onMaxInputChange(value: number) {
    this.isSliderChanging = true;
    this.maxPrice = value;
  }
  //<=========================== End price Range ===========================>

  //<=========================== Amenities ===========================>
  protected onAmenitiesChange(input: string): void {
    this.filteredAmenities = this.amenities.filter((amenity) =>
      amenity.toLowerCase().includes(input.toLowerCase())
    );
  }

  protected addNewAminity() {
    if (!this.selectedAmenities.includes(this.amenity)) {
      this.selectedAmenities.push(this.amenity);
    }
  }

  protected removeAmenity(index: number) {}
  //<=========================== End amenities ===========================>
  //<=========================== Close pannel ===========================>
  protected closeFilter() {
    this.dialogRef.close();
  }
  //<=========================== End close pannel ===========================>

  //<=========================== Submit ===========================>
  protected onSubmit() {
    const data = {
      minPrice: this.minPriceInput,
      maxPrice: this.maxPriceInput,
      beds: this.beds,
      bathrooms: this.bathrooms,
      amenities: this.selectedAmenities,
      type: this.selectedType,
      status: this.selectedStatus,
    };
    this.dialogRef.close(data);
  }
  //<=========================== End submit ===========================>
}
