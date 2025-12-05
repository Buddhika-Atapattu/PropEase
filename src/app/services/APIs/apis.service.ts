// Path: src/app/services/APIs/apis.service.ts

import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getCountries } from '@yusifaliyevpro/countries';
import { firstValueFrom } from 'rxjs';

import { MSG } from '../../types/api-message.types';
import type { UserCredentials } from '../auth/auth.service';
import {
  CountryDetailsCustomType,
  CountryDetails,
  Address,
} from '../property/property.service';
import {
  AccessModuleKey,
  AccessActionKey,
} from '../../source/access-map.source';

/* ─────────────────────────────────────────────────────────────────────────────
 *  Country / currency related types
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CurrencyFormat {
  country: string;
  symbol: any;
  flags: {
    png: string;
    svg: string;
    alt?: string;
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
    png: string;
    svg: string;
    alt?: string;
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  Access / role model (shared with FE + BE)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Backend/DB-friendly permission block:
 *  - module  → machine key from ACCESS_OPTIONS (AccessModuleKey)
 *  - actions → list of action IDs from that module (AccessActionKey[])
 */
export interface PermissionEntry {
  module: AccessModuleKey;
  actions: AccessActionKey[];
}

/**
 * Wrapper around permissions stored on the user:
 *  - role        → effective role name
 *  - permissions → list of (module, actions[])
 *
 * This should mirror your backend user.access shape.
 */
export interface ROLE_ACCESS_MAP {
  role: Role;
  permissions: PermissionEntry[];
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  User & roles
 * ──────────────────────────────────────────────────────────────────────────── */

export type Role =
  | 'admin'
  | 'agent'
  | 'tenant'
  | 'owner'
  | 'operator'
  | 'manager'
  | 'developer'
  | 'user';

export const DEFAULT_ROLES: Role[] = [
  'admin',
  'agent',
  'developer',
  'manager',
  'operator',
  'owner',
  'tenant',
  'user',
];

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
  role: Role;
  gender: string;
  address: Address;
  isActive: boolean;

  /**
   * Canonical access payload.
   *  - Stored in DB as user.access
   *  - Used by guards and FE role editor
   */
  access: ROLE_ACCESS_MAP;

  nationality?: string;
  nicOrPassport?: string;

  creator: string;
  updator?: string;

  multiAuthEnabled: boolean;
  multiAuthActivatedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type UserSections = keyof User;

export interface NewUser extends User {
  password: string;
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

/* ─────────────────────────────────────────────────────────────────────────────
 *  APIsService
 * ──────────────────────────────────────────────────────────────────────────── */

@Injectable( {
  providedIn: 'root',
} )
export class APIsService {
  private isBrowser: boolean;
  private baseURL: string = 'http://localhost:3000';
  private userAPI: string = 'api-user';

  constructor (
    private http: HttpClient,
    @Inject( PLATFORM_ID ) private platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
  }

  /* ─────────────────────────────────────────────────────────────
     Small internal helpers (reuse & safety)
  ───────────────────────────────────────────────────────────── */

  /**
   * Build a full URL like "http://localhost:3000/api-user/xyz".
   */
  private buildUserUrl( path: string ): string {
    return `${ this.baseURL }/${ this.userAPI }/${ path }`;
  }

  /**
   * Safely extract `data.other` as a plain Record, or undefined.
   * This keeps all "other" logic in one place.
   */
  private getOtherRecord(
    data: MSG[ 'data' ] | undefined | null,
  ): Record<string, unknown> | undefined {
    if ( !data ) {
      return undefined;
    }

    const rawOther = ( data as { other?: unknown; } ).other;

    if (
      !rawOther ||
      typeof rawOther !== 'object' ||
      Array.isArray( rawOther )
    ) {
      return undefined;
    }

    return rawOther as Record<string, unknown>;
  }

  /**
   * Generic extractor: get a string from `other[key]`.
   * Returns null if missing, not a string, or empty after trim.
   */
  public extractStringFromOther(
    data: MSG[ 'data' ] | undefined | null,
    key: string,
  ): string | null {
    const other = this.getOtherRecord( data );
    if ( !other || !( key in other ) ) {
      return null;
    }

    const value = other[ key ];

    if ( typeof value !== 'string' ) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Generic extractor: get a number from `other[key]`.
   * Returns null if missing, NaN, or not a finite number.
   */
  public extractNumberFromOther(
    data: MSG[ 'data' ] | undefined | null,
    key: string,
  ): number | null {
    const other = this.getOtherRecord( data );
    if ( !other || !( key in other ) ) {
      return null;
    }

    const value = other[ key ];

    const num =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number( value )
          : NaN;

    if ( !Number.isFinite( num ) ) {
      return null;
    }

    return num;
  }

  /**
   * Generic extractor: get an object from `other[key]` and cast to T.
   * It only checks that it's a non-null object (no arrays).
   */
  public extractObjectFromOther<T extends object>(
    data: MSG[ 'data' ] | undefined | null,
    key: string,
  ): T | null {
    const other = this.getOtherRecord( data );
    const sanitizedKey = key.trim();

    if ( !other || !( sanitizedKey in other ) ) {
      return null;
    }

    const value = other[ sanitizedKey ];

    if ( !value || typeof value !== 'object' || Array.isArray( value ) ) {
      return null;
    }

    return value as T;
  }

  /**
   * Generic extractor: get an array from `other[key]` and cast elements.
   * Only checks Array.isArray; caller is responsible for element shape.
   */
  public extractArrayFromOther<T>(
    data: MSG[ 'data' ] | undefined | null,
    key: string,
  ): T[] | null {
    try {
      const other = this.getOtherRecord( data );

      if ( !other ) {
        throw new Error( 'Invalid other data set!' );
      }

      if ( !( key in other ) ) {
        throw new Error( 'Invalid key in other data set!' );
      }

      const value = other[ key ];

      if ( !Array.isArray( value ) ) {
        throw new Error( 'Invalid array of value set!' );
      }

      return value as T[];
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( error );
      return null;
    }
  }

  /**
   * Specialised helper for the very common "token in other" case.
   * Uses extractStringFromOther under the hood.
   */
  public extractTokenFromMsg( res: MSG ): string | null {
    return this.extractStringFromOther( res.data, 'token' );
  }

  /* ─────────────────────────────────────────────────────────────
     HTTP helper methods (optional but nice)
  ───────────────────────────────────────────────────────────── */

  private async get<T>( url: string, params?: HttpParams ): Promise<T> {
    return await firstValueFrom(
      this.http.get<T>( url, params ? { params } : undefined ),
    );
  }

  private async post<T>( url: string, body: unknown ): Promise<T> {
    return await firstValueFrom( this.http.post<T>( url, body ) );
  }

  private async put<T>( url: string, body: unknown ): Promise<T> {
    return await firstValueFrom( this.http.put<T>( url, body ) );
  }

  private async delete<T>( url: string ): Promise<T> {
    return await firstValueFrom( this.http.delete<T>( url ) );
  }

  /* ─────────────────────────────────────────────────────────────
     User API methods
  ───────────────────────────────────────────────────────────── */

  public async getAllUsers(): Promise<MSG> {
    return await this.get<MSG>( this.buildUserUrl( 'users' ) );
  }

  public async verifyUser( user: UserCredentials ): Promise<MSG> {
    return await this.post<MSG>(
      this.buildUserUrl( 'verify-user' ),
      user,
    );
  }

  public async updateUser(
    user: FormData,
    username: string,
  ): Promise<MSG> {
    return await this.put<MSG>(
      this.buildUserUrl( `user-update/${ username }` ),
      user,
    );
  }

  public async getAllUsersWithPagination(
    start: number,
    limit: number,
    search?: string,
  ): Promise<MSG> {
    let params = new HttpParams();

    if ( search !== undefined ) {
      params = params.set( 'search', search.trim() );
    }

    return await this.get<MSG>(
      this.buildUserUrl(
        `users-with-pagination/${ start }/${ limit }`,
      ),
      params,
    );
  }

  public async getAllUserCount(): Promise<MSG> {
    return await this.get<MSG>( this.buildUserUrl( 'users-count' ) );
  }

  public async createNewUser( data: FormData ): Promise<MSG> {
    return await this.post<MSG>(
      this.buildUserUrl( 'create-user' ),
      data,
    );
  }

  public async generateToken( username: string ): Promise<MSG> {
    return await this.post<MSG>(
      this.buildUserUrl( 'generate-token' ),
      { username },
    );
  }

  public async uploadDocuments(
    data: FormData,
    username: string,
  ): Promise<MSG> {
    return await this.post<MSG>(
      this.buildUserUrl( `user-document-upload/${ username }` ),
      data,
    );
  }

  public async getUserByUsername( username: string ): Promise<MSG> {
    return await firstValueFrom(
      this.http.get<MSG>(
        `${ this.baseURL }/${ this.userAPI }/user-username/${ username }`,
      ),
    );
  }

  public async getUserByToken( token: string ): Promise<MSG> {
    return await this.get<MSG>(
      this.buildUserUrl( `user-token/${ token }` ),
    );
  }

  public async getUserByEmail( email: string ): Promise<MSG> {
    return await firstValueFrom(
      this.http.get<MSG>(
        `${ this.baseURL }/${ this.userAPI }/user-email/${ email }`,
      ),
    );
  }

  public async getUserByPhone( phone: string ): Promise<MSG> {
    return await firstValueFrom(
      this.http.get<MSG>(
        `${ this.baseURL }/${ this.userAPI }/user-phone/${ phone }`,
      ),
    );
  }

  public async deleteUserByUsername(
    username: string,
    deletedBy: string,
  ): Promise<MSG> {
    return await this.delete<MSG>(
      this.buildUserUrl(
        `user-delete/${ username }/${ deletedBy }`,
      ),
    );
  }

  public async getSectionKeyFromUser(
    username: string,
    section: UserSections,
  ): Promise<MSG> {
    return await this.get<MSG>(
      this.buildUserUrl(
        `user-section-key/${ username.trim() }/${ section.trim() }`,
      ),
    );
  }

  public async getUserDocuments( username: string ): Promise<MSG> {
    const path = `uploads/${ username }/documents`;
    return await firstValueFrom(
      this.http.get<MSG>( this.buildUserUrl( path ) ),
    );
  }


  public async login( data: { username: string; password: string; } ): Promise<MSG> {
    const url = `${ this.baseURL }/api/auth/login`;
    return await this.post<MSG>( url, data ); // will be JSON
  }

  public async logout(): Promise<MSG> {
    const url = `${ this.baseURL }/api/auth/logout`;

    return await firstValueFrom(
      this.http.post<MSG>(
        url,
        {},                                 // empty body
        { withCredentials: true }           // VERY IMPORTANT: send cookies
      )
    );
  }
  /* ─────────────────────────────────────────────────────────────
     Country / currency helpers
  ───────────────────────────────────────────────────────────── */

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
        code:
          ( country.idd?.root ?? '' ) +
          ( country.idd?.suffixes?.[ 0 ] ?? '' ),
        flags: {
          png: country.flags.png,
          svg: country.flags.svg,
          alt: country.flags.alt,
        },
      } );
    } );

    return countriesCodes;
  }

  public async getAllCountryWithCurrency(): Promise<CountryDetails[]> {
    return await firstValueFrom(
      this.http.get<CountryDetails[]>(
        'https://restcountries.com/v3.1/all',
      ),
    );
  }

  public async getCountryByName(
    name: string,
  ): Promise<CountryDetails[]> {
    return await firstValueFrom(
      this.http.get<CountryDetails[]>(
        `https://restcountries.com/v3.1/name/${ name }?fullText=true`,
      ),
    );
  }

  public async getCountries(): Promise<Country[]> {
    const countries = await firstValueFrom(
      this.http.get<Country[]>(
        'https://cdn.jsdelivr.net/npm/country-flag-emoji-json@2.0.0/dist/index.json',
      ),
    );
    return countries;
  }
}
