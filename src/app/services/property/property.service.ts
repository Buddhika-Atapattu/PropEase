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
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';

export interface Property {
  // Basic Property Details
  id: string;
  title: string;
  type:
    | 'Apartment'
    | 'House'
    | 'Villa'
    | 'Commercial'
    | 'Land'
    | 'Stodio'
    | string;
  listing: 'Sale' | 'Rent' | 'Sold' | 'Rented' | string;
  description: string;
  // End Basic Property Details

  // Location Details
  countryDetails: CountryDetails;
  address: Address;
  location?: GoogleMapLocation;
  // End Location Details

  // Property Specifications
  totalArea: number; // in square feet or meters
  builtInArea: number; // in square feet or meters
  livingRooms: number;
  balconies: number;
  kitchen: number;
  bedrooms: number;
  bathrooms: number;
  maidrooms: number;
  driverRooms: number;
  furnishingStatus: 'Furnished' | 'Semi-Furnished' | 'Unfurnished' | string;
  totalFloors: number;
  numberOfParking: number;
  // End Property Specifications

  // Construction & Age
  builtYear: number;
  propertyCondition:
    | 'New'
    | 'Old'
    | 'Excellent'
    | 'Good'
    | 'Needs Renovation'
    | string;
  developerName: string;
  projectName?: string;
  ownerShipType: 'Freehold' | 'Leasehold' | 'Company' | 'Trust' | string;
  // End Construction & Age

  // Financial Details
  price: number;
  currency: string;
  pricePerSqurFeet: number;
  expectedRentYearly?: number;
  expectedRentQuartely?: number;
  expectedRentMonthly?: number;
  expectedRentDaily?: number;
  maintenanceFees: number;
  serviceCharges: number;
  transferFees?: number;
  availabilityStatus:
    | 'Available'
    | 'Not Available'
    | 'Pending'
    | 'Ready to Move'
    | string;
  // End Financial Details

  // Features & Amenities
  featuresAndAmenities: string[];
  // End Features & Amenities

  // Media
  images: File[];
  documents: File[];
  videoTour?: string;
  virtualTour?: string;
  // End Media

  // Listing Management
  listingDate: Date | null;
  availabilityDate?: Date | null;
  listingExpiryDate?: Date | null;
  rentedDate?: Date | null;
  soldDate?: Date | null;
  addedBy: AddedBy;
  owner: string;
  // End Listing Management

  // Administrative & Internal Use
  referenceCode: string;
  verificationStatus: 'Pending' | 'Verified' | 'Rejected' | 'Approved';
  priority: 'High' | 'Medium' | 'Low';
  status: 'Draft' | 'Published' | 'Archived';
  internalNote: string;
  // End Administrative & Internal Use
}

export interface Address {
  houseNumber: string;
  street?: string;
  city: string;
  stateOrProvince?: string;
  postcode: string;
  country: string;
}

export interface CountryDetailsCustomType {
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

  flag?: string; // Emoji flag (e.g., 🇪🇷)

  flags: {
    png: string; // PNG flag image URL
    svg: string; // SVG flag image URL
    alt?: string; // Description of the flag
  };

  maps?: {
    googleMaps: string;
    openStreetMaps: string;
  };

  postalCode?: {
    format?: string;
    regex?: string;
  };
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
  addedAt: Date | string | null;
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
  'Built in Wardrobes',
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
  'Walk-in Closet',
  'View of Landmark',
  'Lobby in Building',
  'Kitchen Appliances',

  // USA
  'Basement',
  'Fireplace',
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

export interface BackEndPropertyData
  extends Omit<Property, 'images' | 'documents'> {
  propertyDocs: propertyDocBackend[];
  images: propertyImages[];
}

@Injectable({
  providedIn: 'root',
})
export class PropertyService {
  private isBrowser: boolean;

  private iconsMap: { [key: string]: string } = {
    // Common
    AirConditioning: 'amenities/air-conditioning.svg',
    Heating: 'amenities/heating.svg',
    Balcony: 'amenities/balcony.svg',
    Garden: 'amenities/garden.svg',
    Garage: 'amenities/garage.svg',
    CoveredParking: 'amenities/covered-parking.svg',
    SwimmingPool: 'amenities/swimming-pool.svg',
    BuiltinWardrobes: 'amenities/built-in-wardrobes.svg',
    PetsAllowed: 'amenities/pets-allowed.svg',
    SecuritySystem: 'amenities/security.svg',
    InternetWiFi: 'amenities/internet-or-wi-fi.svg',
    CableTV: 'amenities/cable-TV.svg',
    LaundryRoom: 'amenities/laundry-room.svg',
    StorageRoom: 'amenities/storage-room.svg',
    MaintenanceStaff: 'amenities/maintenance-staff.svg',
    CCTV: 'amenities/cctv.svg',
    FireAlarm: 'amenities/fire-alarm.svg',
    Elevator: 'amenities/elevator.svg',
    CeilingFan: 'amenities/ceiling-fan.svg',
    CentralHeating: 'amenities/central-heating.svg',
    Fireplace: 'amenities/fireplace.svg',
    OutdoorEntertainmentArea: 'amenities/outdoor-entertainment-area.svg',

    // Luxury
    PrivatePool: 'amenities/private-pool.svg',
    SaunaSteamRoom: 'amenities/sauna-or-steam-room.svg',
    Jacuzzi: 'amenities/jacuzzi.svg',
    HomeTheater: 'amenities/home-theater.svg',
    SmartHomeSystem: 'amenities/smart-home-system.svg',
    PrivateGym: 'amenities/private-gym.svg',
    BarbecueArea: 'amenities/barbecue-area.svg',
    WineCellar: 'amenities/wine-cellar.svg',
    GameRoom: 'amenities/game-room.svg',
    ServantQuarters: 'amenities/servant-quarters.svg',
    PrivateElevator: 'amenities/elevator.svg',
    RooftopTerrace: 'amenities/rooftop-terrace.svg',
    InfinityPool: 'amenities/swimming-pool.svg',

    //UAE
    MaidRoom: 'amenities/maid-room.svg',
    DriverRoom: 'amenities/driver-room.svg',
    PrayerRoom: 'amenities/prayer-room.svg',
    CentralAC: 'amenities/central-AC.svg',
    ChillerFree: 'amenities/chiller-free.svg',
    SharedGym: 'amenities/private-gym.svg',
    SharedPool: 'amenities/swimming-pool.svg',
    NearMetroStation: 'amenities/near-metro-station.svg',
    NearMosque: 'amenities/near-mosque.svg',
    SeaView: 'amenities/sea-view.svg',
    BurjKhalifaView: 'amenities/burj-khalifa-view.svg',
    ViewofWater: 'amenities/lake-view.svg',
    ChildrensPlayArea: 'amenities/childrens-play-area.svg',
    WalkinCloset: 'amenities/walkin-closet.svg',
    ViewofLandmark: 'amenities/view-landmark.svg',
    LobbyinBuilding: 'amenities/lobby.svg',
    KitchenAppliances: 'amenities/kitchen-appliances.svg',
    ChildrensPool: 'amenities/childrens-pool.svg',

    Defalt: 'amenities/default.svg',
  };

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cryptoService: CryptoService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.amenityIconMaker();
  }

  public generatePropertyId(): string {
    const prefix = 'PROP';
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 100000);
    return `${prefix}-${timestamp}-${random.toString().padStart(5, '0')}`;
  }

  // Amenities icon maker
  private amenityIconMaker() {
    for (const [name, path] of Object.entries(this.iconsMap)) {
      this.matIconRegistry.addSvgIcon(
        name,
        this.domSanitizer.bypassSecurityTrustResourceUrl(
          `/Images/Icons/${path}`
        )
      );
    }
  }

  public investigateTheAmenityIcon(amenity: string): string {
    const cleaned = amenity.replace(/[^a-zA-Z0-9]/g, '');
    const cleanedText = cleaned.trim().toLowerCase();
    const matchedKey = Object.keys(this.iconsMap).find(
      (key) => key.toLowerCase() === cleanedText
    );

    if (matchedKey) {
      return matchedKey;
    } else {
      return 'Defalt';
    }
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

  public async getUserData(username: string): Promise<MSG> {
    return firstValueFrom(
      this.http.get<MSG>(`http://localhost:3000/api-user/user-data/${username}`)
    );
  }

  // Delete the property
  public async deleteProperty(id: string): Promise<MSG> {
    return firstValueFrom(
      this.http.delete<MSG>(
        `http://localhost:3000/api-property/delete-property/${id.trim()}`
      )
    );
  }

  public async updateProperty(data: FormData, id: string): Promise<MSG> {
    return firstValueFrom(
      this.http.put<MSG>(
        `http://localhost:3000/api-property/update-property/${id}`,
        data
      )
    );
  }

  public async getAllProperties(): Promise<MSG> {
    return firstValueFrom(
      this.http.get<MSG>(
        `http://localhost:3000/api-property/get-all-properties`
      )
    );
  }

  //<==================== END API ====================>
}
