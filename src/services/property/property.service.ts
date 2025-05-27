import { Injectable } from '@angular/core';
import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { firstValueFrom, Subscription, pipe, take } from 'rxjs';
import { CryptoService } from '../cryptoService/crypto.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

export interface Property {
  id: string;
  title: string;
  description: string;
  type:
    | 'apartment'
    | 'house'
    | 'villa'
    | 'commercial'
    | 'land'
    | 'stodio'
    | string;
  status: 'Sale' | 'Rent' | 'Sold' | 'Rented' | string;
  price: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  maidrooms: number;
  area: number; // in square feet or meters
  images: File[];
  propertyDocs: File[];
  address: Address;
  countryDetails: CountryDetails;
  featuresAndAmenities: string[];
  addedBy: AddedBy;
  location?: GoogleMapLocation;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  houseNumber: string;
  street?: string;
  city: string;
  stateOrProvince?: string;
  postcode: string;
  country: string;
}

export interface CountryDetails {
  name: {
    common: string; // Commonly used name (e.g., "Eritrea")
    official: string; // Official full name
    nativeName?: {
      [langCode: string]: {
        official: string;
        common: string;
      };
    };
  };
  tld?: string[]; // Top-level domain (e.g., [".er"])
  cca2: string; // ISO 3166-1 alpha-2 country code (e.g., "ER")
  cca3?: string; // ISO 3166-1 alpha-3 code
  ccn3?: string; // ISO numeric country code
  cioc?: string; // International Olympic Committee code
  independent?: boolean;
  status?: string;
  unMember?: boolean;

  currencies?: {
    [code: string]: {
      name: string; // Currency name (e.g., "Eritrean nakfa")
      symbol: string; // Currency symbol (e.g., "Nfk")
    };
  };

  idd?: {
    root: string; // Phone code root (e.g., "+2")
    suffixes: string[]; // List of suffixes (e.g., ["91"])
  };

  capital?: string[]; // Capital city (e.g., ["Asmara"])
  altSpellings?: string[]; // Other spellings
  region: string; // Continent or major region (e.g., "Africa")
  subregion?: string; // Subregion (e.g., "Eastern Africa")

  languages?: {
    [langCode: string]: string; // Language map (e.g., { "eng": "English" })
  };

  latlng: [number, number]; // Latitude and longitude
  landlocked?: boolean;
  borders?: string[]; // Bordering country codes
  area: number; // Total area in square kilometers

  demonyms?: {
    eng: { m: string; f: string }; // Demonyms in English
    [langCode: string]: { m: string; f: string };
  };

  translations?: {
    [langCode: string]: {
      official: string;
      common: string;
    };
  };

  flag?: string; // Emoji flag (e.g., 🇪🇷)
  flags: {
    png: string; // PNG flag image URL
    svg: string; // SVG flag image URL
    alt?: string; // Description of the flag
  };

  coatOfArms?: {
    png?: string;
    svg?: string;
  };

  maps?: {
    googleMaps: string;
    openStreetMaps: string;
  };

  population: number;
  fifa?: string;
  car?: {
    signs: string[];
    side: 'left' | 'right';
  };

  timezones: string[]; // Timezones (e.g., ["UTC+03:00"])
  continents: string[]; // Continent list (e.g., ["Africa"])

  startOfWeek?: string; // "monday", "sunday", etc.

  capitalInfo?: {
    latlng: [number, number];
  };

  postalCode?: {
    format?: string;
    regex?: string;
  };
}

export interface AddedBy {
  username: string;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'owner' | string;
  contactNumber?: string;
  addedAt: Date | string;
}

export interface PropertyFilter {
  minPrice: number;
  maxPrice: number;
  beds: string;
  bathrooms: string;
  amenities: string[];
  type: string;
  status: string;
}

export interface PriceRange {
  min: number;
  max: number;
}

export interface GoogleMapLocation {
  lat: number;
  lng: number;
  embeddedUrl: string;
}

export const FEATURES_AMENITIES: string[] = [
  // Common
  'Air Conditioning',
  'Heating',
  'Balcony',
  'Garden',
  'Garage',
  'Covered Parking',
  'Swimming Pool',
  'Built-in Wardrobes',
  'Furnished',
  'Unfurnished',
  'Pets Allowed',
  'Security System',
  'Internet / Wi-Fi',
  'Cable TV',
  'Laundry Room',
  'Storage Room',
  'Maintenance Staff',
  'CCTV',
  'Fire Alarm',
  'Elevator',

  // Luxury
  'Private Pool',
  'Sauna / Steam Room',
  'Jacuzzi',
  'Home Theater',
  'Smart Home System',
  'Private Gym',
  'Barbecue Area',
  'Wine Cellar',
  'Game Room',
  'Servant Quarters',
  'Private Elevator',
  'Rooftop Terrace',
  'Infinity Pool',

  // UAE
  'Maid Room',
  'Driver Room',
  'Prayer Room',
  'Central A/C',
  'Chiller Free',
  'Shared Gym',
  'Shared Pool',
  'Near Metro Station',
  'Near Mosque',
  'Sea View',
  'Burj Khalifa View',
  'View of Water',
  "Children's Play Area",

  // USA
  'Basement',
  'Fireplace',
  'Walk-in Closet',
  'Attic',
  'Deck / Patio',
  'Central Heating',
  'Storm Shelter',
  'Two-Car Garage',

  // UK
  'Conservatory',
  'Utility Room',
  'Loft Storage',
  'Bay Windows',
  'Off-street Parking',
  'Double Glazing',
  'Council Tax Included',

  // Australia
  'Rainwater Tank',
  'Solar Panels',
  'Outdoor Entertainment Area',
  'Bore Water',
  'Reverse Cycle Aircon',
  'Shed',
  'Fenced Yard',

  // Sri Lanka
  'Well Water',
  'Overhead Tank',
  'Servant Toilet',
  'Parapet Wall',
  'Tiled Roof',
  'Water Heater',
  'Ceiling Fan',
  'Outdoor Kitchen',
];

export interface propertyDocPreview {
  name: string;
  type: string;
  icon: string;
}

export interface MSG {
  message: string;
  status: string;
  data: any;
}

export interface propertyImages {
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
  imageURL: string;
}

export interface propertyDocBackend {
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
  documentURL: string;
}

export interface BackEndPropertyData {
  propertyDocs: propertyDocBackend[];
  images: propertyImages[];
  // Include all other properties from Property
  id: string;
  title: string;
  description: string;
  type:
    | 'apartment'
    | 'house'
    | 'villa'
    | 'commercial'
    | 'land'
    | 'stodio'
    | string;
  status: 'Sale' | 'Rent' | 'Sold' | 'Rented' | string;
  price: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  maidrooms: number;
  area: number;
  address: Address;
  countryDetails: CountryDetails;
  featuresAndAmenities: string[];
  addedBy: AddedBy;
  location?: GoogleMapLocation;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class PropertyService {
  private isBrowser: boolean;
  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cryptoService: CryptoService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  public generatePropertyId(): string {
    const prefix = 'PROP';
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 100000);
    return `${prefix}-${timestamp}-${random.toString().padStart(5, '0')}`;
  }

  //<==================== API ====================>
  //Insert a property
  public async createProperties(data: FormData, id: string): Promise<MSG> {
    console.log(data);
    return firstValueFrom(
      this.http.post<MSG>(
        ` http://localhost:3000/api-property/insert-property/${id}`,
        data
      )
    );
  }

  /*
  This api gets all properties with pagination
  Also this will get the search and filtered properties
  */
  public async getPropertiesWithPaginationAndFilter(
    start: number,
    end: number,
    search?: string,
    filter?: string
  ): Promise<MSG> {
    let params = new HttpParams();
    if (search !== undefined && search !== '' && search !== null) {
      params = params.append('search', search);
    }
    if (filter !== undefined && filter !== '' && filter !== null) {
      params = params.append('filter', filter);
    }
    return firstValueFrom(
      this.http.get<MSG>(
        `http://localhost:3000/api-property/get-all-properties-with-pagination/${start}/${end}`,
        { params }
      )
    );
  }

  //This will gets property by id
  public async getPropertyById(id: string): Promise<MSG> {
    return firstValueFrom(
      this.http.get<MSG>(
        `http://localhost:3000/api-property/get-single-property-by-id/${id}`
      )
    );
  }
  //<==================== END API ====================>
}
