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
  ViewChildren,
  QueryList,
  OnChanges,
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
  BackEndPropertyData,
} from '../../../services/property/property.service';
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
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { Subscription } from 'rxjs';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MapComponent } from '../../shared/map/map.component';
import { SafeUrlPipe } from '../../../pipes/safe-url.pipe';

// MapComponent,
@Component({
  selector: 'app-property-more-details-pannel',
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
    MatAutocompleteModule,
    MatButtonToggleModule,
    MatDialogModule,

    SafeUrlPipe,
  ],
  templateUrl: './property-more-details-pannel.component.html',
  styleUrl: './property-more-details-pannel.component.scss',
})
export class PropertyMoreDetailsPannelComponent
  implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  // Dialog data
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  //Property details
  protected property: BackEndPropertyData | null = null;

  //Map
  @ViewChild(MapComponent) map!: MapComponent;
  // ******* Location *******
  protected mapLocationLat: GoogleMapLocation['lat'] = 0;
  protected mapLocationLng: GoogleMapLocation['lng'] = 0;
  protected GoogleMapLocationEmbeddedUrl: GoogleMapLocation['embeddedUrl'] = '';

  protected propertySpecs: { [key: string]: string }[] = [];
  protected financeSpecs: { [key: string]: string }[] = [];
  protected constructionSpecs: { [key: string]: string }[] = [];
  protected listingSpecs: { [key: string]: string }[] = [];
  protected statusSpecs: { [key: string]: string }[] = [];

  private location: Property['location'] = {
    lat: this.mapLocationLat,
    lng: this.mapLocationLng,
    embeddedUrl: this.GoogleMapLocationEmbeddedUrl,
  };

  // Tab Indicator list
  protected tabIndicators: string[] = [
    'Basic',
    'Location',
    'Specifications',
    'Construction',
    'Financial',
    'Listing',
    'Admin',
  ];

  protected tabIndicatorsActive: boolean = false;
  @ViewChildren('tabElement', { read: ElementRef })
  tabElements!: QueryList<ElementRef>;
  protected currentIndex = 0;
  protected indicatorStyle: { width?: string; transform?: string } = {};

  protected istabOpenButtonActive: boolean = false;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(MAT_DIALOG_DATA)
    protected data: any = {},
    protected dialogRef: MatDialogRef<PropertyMoreDetailsPannelComponent>,
    private cdr: ChangeDetectorRef,
    private propertyService: PropertyService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
    this.property = data.property;
    if (this.property) {
      this.mapLocationLat = this.property.location?.lat ?? 0;
      this.mapLocationLng = this.property.location?.lng ?? 0;
    }
  }

  ngOnInit(): void {
    this.modeSub = this.windowRef.mode$.subscribe((val) => {
      this.mode = val;
    });
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      setTimeout(() => this.updateIndicatorPosition(this.currentIndex));
    }
    this.initializePropertyData();
  }

  ngOnChanges(): void {

  }

  ngOnDestroy(): void { }

  private initializePropertyData(): void {
    if (!this.property) return;

    this.propertySpecs = this.propertySpecifications();
    this.financeSpecs = this.financialDetails();
    this.constructionSpecs = this.constructionAndAge();
    this.listingSpecs = this.propertyDateDetails();
    this.statusSpecs = this.propertyStatusDetails();

    this.cdr.detectChanges();
  }

  //<==================== Mobile Tab Open Button ====================>
  protected tabOpenButtonOperation() {
    this.istabOpenButtonActive = !this.istabOpenButtonActive;
  }
  //<==================== End Mobile Tab Open Button ====================>

  //<==================== Tab Make ====================>
  protected tabMaker(index: number, tabName: string) {
    if (!this.isBrowser) return;
    this.currentIndex = index;
    setTimeout(() => this.updateIndicatorPosition(index));
  }

  private updateIndicatorPosition(index: number): void {
    const tabEl = this.tabElements.get(index)?.nativeElement;

    if (tabEl) {
      const { offsetLeft, offsetWidth } = tabEl;

      const newStyle = {
        width: `${offsetWidth}px`,
        transform: `translateX(${offsetLeft}px)`,
      };

      // Only update if it has changed
      if (
        this.indicatorStyle['width'] !== newStyle.width ||
        this.indicatorStyle['transform'] !== newStyle.transform
      ) {
        this.indicatorStyle = newStyle;
      }

      this.istabOpenButtonActive = false;
    }

    if (this.map && this.currentIndex === 1) {
      this.map.MapCenterMaker(this.mapLocationLat, this.mapLocationLng, 15);
    }
  }
  //<==================== End tab Make ====================>

  //<==================== Page Go Back ====================>
  protected goBack() {
    if (this.currentIndex > 0) {
      this.tabMaker(
        this.currentIndex - 1,
        this.tabIndicators[this.currentIndex - 1]
      );
    }
  }
  //<==================== End Page Go Back ====================>

  //<==================== Page Go Next ====================>
  protected goNext() {
    if (this.currentIndex < this.tabIndicators.length - 1) {
      this.tabMaker(
        this.currentIndex + 1,
        this.tabIndicators[this.currentIndex + 1]
      );
    }
  }
  //<==================== End Page Go Next ====================>

  protected onLocationPicked(event: { lat: number; lng: number }) {
    this.mapLocationLat = event.lat;
    this.mapLocationLng = event.lng;
    this.GoogleMapLocationEmbeddedUrl = `https://www.google.com/maps/embed/v1/view?key=AIzaSyDtyUEKZAgXCBiuteyZVvaAaV0OVm-Wydc&center=${this.mapLocationLat},${this.mapLocationLng}&zoom=14`;
    // this.GoogleMapLocationEmbeddedUrl = `https://www.google.com/maps?q=${this.mapLocationLat},${this.mapLocationLng}&hl=es;z=14&output=embed`;
    this.location = {
      lat: this.mapLocationLat,
      lng: this.mapLocationLng,
      embeddedUrl: this.GoogleMapLocationEmbeddedUrl,
    };
  }

  protected propertySpecifications(): { [key: string]: string }[] {
    if (!this.property) return [];

    const addSqFt = (value: number) =>
      `${value} <span>ft<sup>2</sup></span>`;

    const safe = (value: number | string | null | undefined, fallback: string) =>
      value === 0 || value === null || value === undefined || value === '' ? fallback : String(value);

    return [
      {
        "Total Area": safe(this.property.totalArea, "No total area").includes("No")
          ? "No total area"
          : addSqFt(Number(this.property.totalArea)),
      },
      {
        "Built In Area": safe(this.property.builtInArea, "No built-in area").includes("No")
          ? "No built-in area"
          : addSqFt(Number(this.property.builtInArea)),
      },
      {
        "Living Rooms": safe(this.property.livingRooms, "No living room"),
      },
      {
        "Kitchens": safe(this.property.kitchen, "No kitchen"),
      },
      {
        "Bedrooms": safe(this.property.bedrooms, "No bedrooms"),
      },
      {
        "Bathrooms": safe(this.property.bathrooms, "No bathrooms"),
      },
      {
        "Maidrooms": safe(this.property.maidrooms, "No maidroom"),
      },
      {
        "Driver Rooms": safe(this.property.driverRooms, "No driver room"),
      },
      {
        "Total Floors": safe(this.property.totalFloors, "Only base floor"),
      },
      {
        "Parkings": safe(this.property.numberOfParking, "No parking"),
      },
      {
        "Furnished Status": this.property.furnishingStatus ?? "Not specified",
      },
    ];
  }

  protected constructionAndAge(): { [key: string]: string }[] {
    if (!this.property) return [];

    const addSqFt = (value: number) =>
      `${value} <span>ft<sup>2</sup></span>`;

    const safe = (value: number | string | null | undefined, fallback: string) =>
      value === 0 || value === null || value === undefined || value === '' ? fallback : String(value);

    return (
      [
        {
          "Built Year": safe(this.property.builtYear, "No built year mentioned"),
        },
        {
          "Property Condition": safe(this.property.propertyCondition, "No property condition mentioned"),
        },
        {
          "Developer Name": safe(this.property.developerName, "No developer name mentioned"),
        },
        {
          "Project Name": safe(this.property.projectName, "No project name mentioned"),
        },
        {
          "Owner Ship Type": safe(this.property.ownerShipType, "No owner ship type mentioned"),
        },
      ]
    )
  }

  protected financialDetails(): { [key: string]: string }[] {
    if (!this.property) return [];

    const currency = this.property.currency ?? '';

    const formatCurrency = (value: number | null | undefined): string =>
      value && value > 0
        ? `${value.toLocaleString()} ${currency}`
        : "Not specified";

    const formatText = (
      value: string | null | undefined,
      fallback: string
    ): string =>
      value && value.trim() !== "" ? value : fallback;

    return [
      {
        "Price of the Property": formatCurrency(this.property.price),
      },
      {
        "Price per Square Feet": formatCurrency(this.property.pricePerSqurFeet),
      },
      {
        "Expected Rent per Year": formatCurrency(this.property.expectedRentYearly),
      },
      {
        "Expected Rent per Quarter": formatCurrency(this.property.expectedRentQuartely),
      },
      {
        "Expected Rent per Month": formatCurrency(this.property.expectedRentMonthly),
      },
      {
        "Expected Rent per Day": formatCurrency(this.property.expectedRentDaily),
      },
      {
        "Maintenance Fee": formatCurrency(this.property.maintenanceFees),
      },
      {
        "Service Charge": formatCurrency(this.property.serviceCharges),
      },
      {
        "Transfer Fee": formatCurrency(this.property.transferFees),
      },
      {
        "Availability Status": formatText(this.property.availabilityStatus, "Not specified"),
      },
      {
        "Ownership Type": formatText(this.property.ownerShipType, "Not specified"),
      },
    ];
  }

  protected propertyDateDetails(): { [key: string]: string }[] {
    if (!this.property) return [];

    const formatDate = (date: string | Date | null | undefined): string =>
      date ? new Date(date).toLocaleDateString('en-GB') : "Not specified";

    const addIfExists = (
      label: string,
      dateValue: Date | string | null | undefined
    ): { [key: string]: string } | null => {
      if (!dateValue) return null;
      return { [label]: formatDate(dateValue) };
    };

    const details: ({ [key: string]: string } | null)[] = [
      addIfExists("Listing Date", this.property.listingDate),
      addIfExists("Availability Date", this.property.availabilityDate),
      addIfExists("Listing Expiring Date", this.property.listingExpiryDate),
      addIfExists("Rented Date", this.property.rentedDate),
      addIfExists("Sold Date", this.property.soldDate),
    ];

    // Filter out nulls
    return details.filter((item): item is { [key: string]: string } => !!item);
  }

  protected propertyStatusDetails(): { [key: string]: string }[] {
    if (!this.property) return [];

    const safe = (value: string | number | null | undefined, fallback: string): string =>
      value === null || value === undefined || value === '' ? fallback : String(value);

    return [
      {
        "Property Reference Code": safe(this.property.referenceCode, "No reference code"),
      },
      {
        "Property Verification Status": safe(this.property.verificationStatus, "Not verified"),
      },
      {
        "Property Priority Status": safe(this.property.priority, "Not specified"),
      },
      {
        "Property Status": safe(this.property.status, "Not specified"),
      },
    ];
  }

  protected trackByKey(index: number, item: { [key: string]: string }): string {
    return Object.keys(item)[0];
  }

  protected getKey(obj: { [key: string]: string }): string {
    return Object.keys(obj)[0];
  }

  protected pannelClose() {
    this.dialogRef.close();
  }
}
