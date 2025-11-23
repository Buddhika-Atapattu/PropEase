import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getCountries } from '@yusifaliyevpro/countries';
import { firstValueFrom } from 'rxjs';

export interface CurrencyFormat {
  country: string;
  symbol: any;
  flags: {
    png: string; // PNG flag image URL
    svg: string; // SVG flag image URL
    alt?: string; // Description of the flag
  };
  currency: string;
}

export interface Country {
  name: string;
  code: string;
  emoji: string;
  unicode: string;
  image: string;
}

export interface CountryCodes {
  name: string;
  code: string;
  flags: {
    png: string; // PNG flag image URL
    svg: string; // SVG flag image URL
    alt?: string; // Description of the flag
  };
}

export interface CountryDetailsCustomType {
  name: {
    common: string; // Commonly used name (e.g., "Eritrea")
    official: string; // Official full name
    nativeName?: {
      [ langCode: string ]: {
        official: string;
        common: string;
      };
    };
  };

  currencies?: {
    [ code: string ]: {
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
      [ langCode: string ]: {
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
    [ code: string ]: {
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
    [ langCode: string ]: string; // Language map (e.g., { "eng": "English" })
  };

  latlng: [ number, number ]; // Latitude and longitude
  landlocked?: boolean;
  borders?: string[]; // Bordering country codes
  area: number; // Total area in square kilometers

  demonyms?: {
    eng: { m: string; f: string; }; // Demonyms in English
    [ langCode: string ]: { m: string; f: string; };
  };

  translations?: {
    [ langCode: string ]: {
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
    latlng: [ number, number ];
  };

  postalCode?: {
    format?: string;
    regex?: string;
  };
}

export interface UserCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface Address {
  street: string;
  houseNumber: string;
  city: string;
  postcode: string;
  country?: string;
  stateOrProvince?: string;
}

export interface PermissionEntry {
  module: string;
  actions: string[];
}

export interface ROLE_ACCESS_MAP {
  role: string;
  permissions: PermissionEntry[];
}

export type Role =
  | 'admin'
  | 'agent'
  | 'tenant'
  | 'owner'
  | 'operator'
  | 'manager'
  | 'developer'
  | 'user';

export interface User {
  __id?: string;
  __v?: number;
  name: string;
  username: string;
  email: string;
  dateOfBirth?: Date | null;
  age: number;
  image?: string | File;
  phoneNumber?: string;
  phoneCodeDetails?: CountryCodes | null;
  bio: string;
  role:
  | 'admin'
  | 'agent'
  | 'tenant'
  | 'owner'
  | 'operator'
  | 'manager'
  | 'developer'
  | 'user';
  gender: string;
  address: Address;
  isActive: boolean;
  access: ROLE_ACCESS_MAP;
  nationality?: string;
  nicOrPassport?: string;
  creator: string;
  updator?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewUser extends User {
  password: string;
}


export type AccessMap = {
  [ module: string ]: string[]; // list of actions allowed
};

export interface MSG {
  count?: number;
  start?: number;
  end?: number;
  limit?: number;
  success?: boolean;
  status: string;
  message: string;
  data: any;
  token?: string;
  user?: User;
}

export interface validateType {
  status: string;
  user: User;
}

export interface UDER_DOC_TYPES extends MSG {
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  path: string;
  URL: string;
  extension: string;
  uploadDate: Date;
  download: string;
}
@Injectable( {
  providedIn: 'root',
} )
export class APIsService {
  private isBrowser: boolean;
  private baseURL: string = 'http://localhost:3000';
  private userAPI: string = 'api-user';

  constructor (
    private http: HttpClient,
    @Inject( PLATFORM_ID ) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
  }

  public async getAllUsers(): Promise<User[]> {
    return (
      ( await firstValueFrom(
        this.http.get<User[]>( `${ this.baseURL }/${ this.userAPI }/users` )
      ) )
    );
  }

  public async verifyUser( user: UserCredentials ): Promise<MSG> {
    return (
      ( await firstValueFrom(
        this.http.post<MSG>(
          `${ this.baseURL }/${ this.userAPI }/verify-user`,
          user
        )
      ) )
    );
  }

  public async getCountries(): Promise<Country[]> {
    const countries = await firstValueFrom(
      this.http.get<Country[]>(
        'https://cdn.jsdelivr.net/npm/country-flag-emoji-json@2.0.0/dist/index.json'
      )
    );
    return countries;
  }

  public async updateUser(
    user: FormData,
    username: string
  ): Promise<MSG> {
    return await firstValueFrom(
      this.http.put<MSG>(
        `${ this.baseURL }/${ this.userAPI }/user-update/${ username }`,
        user
      )
    );
  }

  public async getAllUsersWithPagination(
    start: number,
    limit: number,
    search?: string
  ): Promise<MSG> {
    let params = new HttpParams();
    if ( search !== undefined ) {
      params = params.set( 'search', search.trim() );
    }
    return await firstValueFrom(
      this.http.get<MSG>(
        `${ this.baseURL }/${ this.userAPI }/users-with-pagination/${ start }/${ limit }`,
        { params }
      )
    );
  }

  public async getAllUserCount(): Promise<MSG> {
    return await firstValueFrom(
      this.http.get<MSG>(
        `${ this.baseURL }/${ this.userAPI }/users-count`,
      )
    );
  }

  public async getUserByUsername( username: string ): Promise<validateType> {
    return await firstValueFrom(
      this.http.get<validateType>(
        `${ this.baseURL }/${ this.userAPI }/user-username/${ username }`
      )
    );
  }

  public async getUserByEmail( email: string ): Promise<validateType> {
    return await firstValueFrom(
      this.http.get<validateType>(
        `${ this.baseURL }/${ this.userAPI }/user-email/${ email }`
      )
    );
  }

  public async getUserByPhone( phone: string ): Promise<MSG> {
    return await firstValueFrom(
      this.http.get<MSG>(
        `${ this.baseURL }/${ this.userAPI }/user-phone/${ phone }`
      )
    );
  }

  public async createNewUser( data: FormData ): Promise<MSG> {
    return await firstValueFrom(
      this.http.post<MSG>(
        `${ this.baseURL }/${ this.userAPI }/create-user`,
        data
      )
    );
  }

  public async generateToken( username: string ): Promise<MSG> {
    return await firstValueFrom(
      this.http.post<MSG>(
        `${ this.baseURL }/${ this.userAPI }/generate-token`,
        { username: username }
      )
    );
  }

  public async uploadDocuments(
    data: FormData,
    username: string
  ): Promise<MSG> {
    return await firstValueFrom(
      this.http.post<MSG>(
        `${ this.baseURL }/${ this.userAPI }/user-document-upload/${ username }`,
        data
      )
    );
  }

  public async getUserByToken( token: string ): Promise<MSG> {
    return await firstValueFrom(
      this.http.get<MSG>(
        `${ this.baseURL }/${ this.userAPI }/user-token/${ token }`
      )
    );
  }

  public async getUserDocuments( username: string ): Promise<UDER_DOC_TYPES> {
    return await firstValueFrom(
      this.http.get<UDER_DOC_TYPES>(
        `${ this.baseURL }/${ this.userAPI }/uploads/${ username }/documents`
      )
    );
  }

  public async getAllCountryWithCurrency(): Promise<CountryDetails[]> {
    return await firstValueFrom(
      this.http.get<CountryDetails[]>( 'https://restcountries.com/v3.1/all' )
    );
  }

  public async getCountryByName( name: string ): Promise<CountryDetails[]> {
    return await firstValueFrom(
      this.http.get<CountryDetails[]>(
        `https://restcountries.com/v3.1/name/${ name }?fullText=true`
      )
    );
  }

  public async getCustomCountryDetails(): Promise<CountryDetailsCustomType[]> {
    const countries = ( await getCountries( {
      fields: [
        'name',
        'currencies',
        'idd',
        'flag',
        'flags',
        'maps',
        'postalCode',
      ],
    } ) ) as CountryDetailsCustomType[];
    return countries;
  }

  public async getCountryCodes(): Promise<CountryCodes[]> {
    const countries = await this.getCustomCountryDetails();
    const countriesCodes: CountryCodes[] = [];
    countries.forEach( ( country ) => {
      countriesCodes.push( {
        name: country.name.common,
        code: ( country.idd?.root ?? '' ) + ( country.idd?.suffixes?.[ 0 ] ?? '' ),
        flags: {
          png: country.flags.png,
          svg: country.flags.svg,
          alt: country.flags.alt,
        },
      } );
    } );

    return countriesCodes;
  }

  public async deleteUserByUsername( username: string, deletedBy: string ): Promise<MSG> {
    return await firstValueFrom(
      this.http.delete<MSG>(
        `${ this.baseURL }/${ this.userAPI }/user-delete/${ username }/${ deletedBy }`
      )
    );
  }
}
