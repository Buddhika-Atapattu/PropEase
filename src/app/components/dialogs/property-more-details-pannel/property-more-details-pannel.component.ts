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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MapComponent } from '../../shared/map/map.component';

@Component({
  selector: 'app-property-more-details-pannel',
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
    MapComponent,
  ],
  standalone: true,
  templateUrl: './property-more-details-pannel.component.html',
  styleUrl: './property-more-details-pannel.component.scss',
})
export class PropertyMoreDetailsPannelComponent
  implements OnInit, OnDestroy, AfterViewInit
{
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
    public data: any = {},
    public dialogRef: MatDialogRef<PropertyMoreDetailsPannelComponent>,
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
  }

  ngOnDestroy(): void {}

   //<==================== Mobile Tab Open Button ====================>
  protected tabOpenButtonOperation(){
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

  protected pannelClose() {
    this.dialogRef.close();
  }
}
