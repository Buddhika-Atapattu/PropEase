import {
  Component,
  OnInit,
  AfterViewInit,
  Inject,
  PLATFORM_ID,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { PlacesService } from '../../../services/places/places.service';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

declare const google: any;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent implements OnInit, AfterViewInit {
  @Input() mode: boolean = false;
  @Output() locationSelected = new EventEmitter<{ lat: number; lng: number }>();
  @ViewChild('map', { static: false }) mapElement!: ElementRef<HTMLDivElement>;
  private latitude: number = 0;
  private longitude: number = 0;
  private zoom: number = 0;

  protected searchTerm: string = '';
  private isBrowser: boolean;
  protected suggestions: google.maps.places.AutocompletePrediction[] = [];
  protected searchSubject = new Subject<string>();
  protected isSearching: boolean = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private placesService: PlacesService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((input) => {
        if (input.length < 2) {
          this.suggestions = [];
          return;
        }

        this.placesService
          .getAutocompleteSuggestions(input)
          .subscribe((res: any) => {
            this.suggestions = res.predictions || [];
          });
      });
  }

  async ngAfterViewInit(): Promise<void> {
    const { Map } = await google.maps.importLibrary('maps');
    const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

    const map = new Map(this.mapElement.nativeElement, {
      center: {
        lat: this.latitude !== 0 ? this.latitude : 7.8731,
        lng: this.longitude !== 0 ? this.longitude : 80.7718,
      },
      zoom: this.zoom !== 0 ? this.zoom : 10,
      mapId: '9ea7a2bc2028bb7af08edbe5',
    });

    const marker = new AdvancedMarkerElement({
      map,
      position: {
        lat: this.latitude !== 0 ? this.latitude : 7.8731,
        lng: this.longitude !== 0 ? this.longitude : 80.7718,
      },
    });

    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        console.log({ lat, lng });

        this.locationSelected.emit({ lat, lng });
        marker.position = { lat, lng };
      }
    });
  }

  public MapCenterMaker(lat: number, lng: number, zoom: number): void {
    if (!this.isBrowser) return;
    this.latitude = lat;
    this.longitude = lng;
    this.zoom = zoom;
    this.ngAfterViewInit();
  }

  protected async onSearchChange(input: string) {
    this.isSearching = true;
    this.searchSubject.next(input);
  }

  protected async searchLocation(
    input: google.maps.places.AutocompletePrediction
  ): Promise<void> {
    this.isSearching = false;

    if (!this.isBrowser) return;

    const place: string = input.description;
    this.searchTerm = place;
    this.suggestions = [];
    console.log(this.suggestions);
    this.searchSubject.next(place);

    const { Map } = await google.maps.importLibrary('maps');
    const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

    const map = new Map(this.mapElement.nativeElement, {
      center: { lat: 7.8731, lng: 80.7718 },
      zoom: 20,
      mapId: '9ea7a2bc2028bb7af08edbe5',
    });

    const marker = new AdvancedMarkerElement({
      map,
      position: { lat: 7.8731, lng: 80.7718 },
    });

    const geocoder = new google.maps.Geocoder();
    interface GeocoderResult {
      geometry?: {
        location: {
          lat: () => number;
          lng: () => number;
        };
      };
    }

    type GeocoderStatus =
      | 'OK'
      | 'ZERO_RESULTS'
      | 'OVER_QUERY_LIMIT'
      | 'REQUEST_DENIED'
      | 'INVALID_REQUEST'
      | 'UNKNOWN_ERROR';

    geocoder.geocode(
      { address: place },
      (results: GeocoderResult[] | null, status: GeocoderStatus) => {
        if (status === 'OK' && results && results[0].geometry?.location) {
          const loc = results[0].geometry.location;
          const lat: number = loc.lat();
          const lng: number = loc.lng();
          map.setCenter({ lat, lng });
          map.setZoom(14);
          marker.position = { lat, lng };
          this.locationSelected.emit({ lat, lng });
        }
      }
    );
  }
}
