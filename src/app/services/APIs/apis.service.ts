// Path: src/app/services/APIs/apis.service.ts
// ============================================================================
// APIsService
// ----------------------------------------------------------------------------
// Responsibilities
//   • Centralised HTTP client for:
//       - User API          →   http://<baseURL>/api-user/*
//       - Auth API          →   http://<baseURL>/api/auth/*
//       - MFA API           →   http://<baseURL>/api/mfa/*
//       - WS Token helpers  →   http://<baseURL>/api/auth/ws-token/*
//       - External country / currency sources
//
//   • Safe helpers for reading `res.data.other`:
//       - extractBooleanFromOther
//       - extractStringFromOther
//       - extractNumberFromOther
//       - extractObjectFromOther
//       - extractArrayFromOther
//       - extractTokenFromMsg
//
// Design notes
//   • `baseURL` is the root for your backend (TODO: wire from environment).
//   • `userAPI` holds the segment for user routes ("api-user").
//   • All public methods return a strongly-typed MSG wrapper.
// ============================================================================

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
import { environment } from '../../../environments/environment';

/* ========================================================================== *
 *  Country / currency related types
 * ========================================================================== */

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

/* ========================================================================== *
 *  Access / role model (shared with FE + BE)
 * ========================================================================== */

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

/* ========================================================================== *
 *  User & roles
 * ========================================================================== */

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

/** Country code info for phone numbers. */
export interface CountryCodes {
  name: string;
  code: string;
  flags: {
    png: string;
    svg: string;
    alt?: string;
  };
}

/** Phone number structure attached to User. */
export interface PhoneNumber {
  code: CountryCodes;
  number: string;
}

export interface User {
  // Basic identity
  name: string;
  username: string;
  email: string;
  dateOfBirth: Date;
  age: number;
  gender: string;
  image?: string | File;
  phoneNumber?: PhoneNumber;
  bio: string;
  nationality: string;
  nicOrPassport: string;

  // Role & access
  role: Role;
  address: Address;
  isActive: boolean;
  access: ROLE_ACCESS_MAP;

  // Verification
  otpVerifycation: boolean;
  otpToken: string;
  otpTokenExpires: Date;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationTokenExpires?: Date;

  // Admin controls
  autoDelete: boolean;
  creator: string;
  updator?: string;

  // MFA
  multiAuthEnabled: boolean;    // user chose to enable MFA
  multiAuthActivatedAt?: Date;  // when QR + foreign app completed

  // Timestamps (Mongoose)
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

export interface MultiAuthData {
  username?: string;
  qr?: string;
  expiresAt?: string;
  uri?: string;
  pairingToken: string;
  deviceName?: string;
  devicePlatform?: string;
}

/* ========================================================================== *
 *  APIsService
 * ========================================================================== */

@Injectable( {
  providedIn: 'root',
} )
export class APIsService {
  // --------------------------------------------------------------------------
  // Core configuration
  // --------------------------------------------------------------------------

  private readonly isBrowser: boolean;

  /**
   * Root backend URL.
   * TODO: Replace with environment.apiOrigin / apiBase when wiring configs.
   */
  private readonly baseURL: string = environment.apiOrigin ?? 'http://localhost:3000';

  /**
   * Base segment for user-related routes.
   * Full prefix: `${baseURL}/${userAPI}` → e.g. http://localhost:3000/api-user
   */
  private readonly userAPI: string = 'api-user';

  constructor (
    private readonly http: HttpClient,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
  }

  // ==========================================================================
  //  INTERNAL HELPERS
  // ==========================================================================

  // --------------------------------------------------------------------------
  //  URL builders
  // --------------------------------------------------------------------------

  /**
   * Build a full user API URL like:
   *   http://localhost:3000/api-user/<path>
   */
  private buildUserUrl( path: string ): string {
    return `${ this.baseURL }/${ this.userAPI }/${ path }`;
  }

  // --------------------------------------------------------------------------
  //  Safe "other" extractors for MSG.data.other
  // --------------------------------------------------------------------------

  /**
   * Safely extract `data.other` as a plain Record<string, unknown>, or `undefined`.
   * All other extractors are built on top of this helper.
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
   * Generic extractor: get a boolean from `other[key]`.
   * Returns null if key is missing or value is not a boolean.
   */
  public extractBooleanFromOther(
    data: MSG[ 'data' ] | undefined | null,
    key: string,
  ): boolean | null {
    const other = this.getOtherRecord( data );
    if ( !other || !( key in other ) ) {
      return null;
    }

    const value = other[ key ];

    if ( typeof value !== 'boolean' ) {
      return null;
    }

    return value;
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
   * It only validates "non-null object and not an array".
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
        throw new Error( 'Invalid "other" data set!' );
      }

      if ( !( key in other ) ) {
        throw new Error( `Key "${ key }" not found inside "other" data set!` );
      }

      const value = other[ key ];

      if ( !Array.isArray( value ) ) {
        throw new Error( 'Expected array for "other[key]" value.' );
      }

      return value as T[];
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [APIsService.extractArrayFromOther] ', error, '\n' );
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

  // --------------------------------------------------------------------------
  //  Minimal HTTP wrapper helpers
  // --------------------------------------------------------------------------

  private async get<T>( url: string, params?: HttpParams ): Promise<T> {
    return await firstValueFrom(
      this.http.get<T>( url, params ? { params } : undefined ),
    );
  }

  private async post<T>(
    url: string,
    body: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const headers = extraHeaders ?? {};
    return await firstValueFrom( this.http.post<T>( url, body, { headers } ) );
  }

  private async put<T>( url: string, body: unknown ): Promise<T> {
    return await firstValueFrom( this.http.put<T>( url, body ) );
  }

  private async delete<T>( url: string ): Promise<T> {
    return await firstValueFrom( this.http.delete<T>( url ) );
  }

  // ==========================================================================
  //  USER API ( /api-user/* )
  // ==========================================================================

  /**
   * GET /api-user/users
   *   → All users (no pagination).
   */
  public async getAllUsers(): Promise<MSG> {
    return await this.get<MSG>( this.buildUserUrl( 'users' ) );
  }

  /**
   * POST /api-user/verify-user
   *   → Legacy login verification (mostly replaced by /api/auth/login).
   */
  public async verifyUser( user: UserCredentials ): Promise<MSG> {
    return await this.post<MSG>(
      this.buildUserUrl( 'verify-user' ),
      user,
    );
  }

  /**
   * PUT /api-user/user-update/:username
   *   → Update user profile (FormData for file/image support).
   */
  public async updateUser(
    user: FormData,
    username: string,
  ): Promise<MSG> {
    return await this.put<MSG>(
      this.buildUserUrl( `user-update/${ username }` ),
      user,
    );
  }

  /**
   * GET /api-user/users-with-pagination/:start/:limit
   *   → Paged list of users with optional "search" query param.
   */
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
      this.buildUserUrl( `users-with-pagination/${ start }/${ limit }` ),
      params,
    );
  }

  /**
   * GET /api-user/users-count
   *   → Total user count.
   */
  public async getAllUserCount(): Promise<MSG> {
    return await this.get<MSG>( this.buildUserUrl( 'users-count' ) );
  }

  /**
   * POST /api-user/create-user
   *   → Create user (FormData for avatar/document support).
   */
  public async createNewUser( data: FormData ): Promise<MSG> {
    return await this.post<MSG>(
      this.buildUserUrl( 'create-user' ),
      data,
    );
  }

  /**
   * POST /api-user/generate-token
   *   → Generate OTP / reset-token for a username.
   */
  public async generateToken( username: string ): Promise<MSG> {
    return await this.post<MSG>(
      this.buildUserUrl( 'generate-token' ),
      { username },
    );
  }

  /**
   * POST /api-user/user-document-upload/:username
   *   → Upload user documents via FormData.
   */
  public async uploadDocuments(
    data: FormData,
    username: string,
  ): Promise<MSG> {
    return await this.post<MSG>(
      this.buildUserUrl( `user-document-upload/${ username }` ),
      data,
    );
  }

  /**
   * GET /api-user/user-username/:username
   *   → Fetch a user by username.
   */
  public async getUserByUsername( username: string ): Promise<MSG> {
    return await firstValueFrom(
      this.http.get<MSG>(
        `${ this.baseURL }/${ this.userAPI }/user-username/${ username }`,
      ),
    );
  }

  /**
   * GET /api-user/user-token/:token
   *   → Fetch a user by token (password reset, verify token, etc).
   */
  public async getUserByToken( token: string ): Promise<MSG> {
    return await this.get<MSG>(
      this.buildUserUrl( `user-token/${ token }` ),
    );
  }

  /**
   * GET /api-user/user-email/:email
   *   → Fetch a user by email.
   */
  public async getUserByEmail( email: string ): Promise<MSG> {
    return await firstValueFrom(
      this.http.get<MSG>(
        `${ this.baseURL }/${ this.userAPI }/user-email/${ email }`,
      ),
    );
  }

  /**
   * POST /api-user/user-phone
   *   → Fetch a user by phoneNumber payload.
   */
  public async getUserByPhone( phone: User[ 'phoneNumber' ] ): Promise<MSG> {
    return await this.post<MSG>(
      `${ this.baseURL }/${ this.userAPI }/user-phone`,
      { phone },
    );
  }

  /**
   * DELETE /api-user/user-delete/:username/:deletedBy
   *   → Soft/hard delete user with audit-field "deletedBy".
   */
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

  /**
   * GET /api-user/user-section-key/:username/:section
   *   → Fetch a specific section (field key) from the user document.
   */
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

  /**
   * GET /api-user/uploads/:username/documents
   *   → List user documents for that username.
   */
  public async getUserDocuments( username: string ): Promise<MSG> {
    const path = `uploads/${ username }/documents`;
    return await firstValueFrom(
      this.http.get<MSG>( this.buildUserUrl( path ) ),
    );
  }

  // ==========================================================================
  //  AUTH API ( /api/auth/* )
  // ==========================================================================

  /**
   * POST /api/auth/login
   *   → Main login endpoint (deviceId + credentials).
   */
  public async login(
    data: { username: string; password: string; },
    extraHeaders?: Record<string, string>,
  ): Promise<MSG> {
    const headers = extraHeaders ?? {};
    const url = `${ this.baseURL }/api/auth/login`;
    return await this.post<MSG>( url, data, headers ); // will be JSON
  }

  /**
   * POST /api/auth/logout
   *   → Logout endpoint (relies on cookies / session).
   */
  public async logout(): Promise<MSG> {
    const url = `${ this.baseURL }/api/auth/logout`;

    return await firstValueFrom(
      this.http.post<MSG>(
        url,
        {},                                 // empty body
        { withCredentials: true },         // VERY IMPORTANT: send cookies
      ),
    );
  }

  /**
   * POST /api/auth/regenerate-challenge
   *   → Issue a fresh MFA login challenge.
   * NOTE: Backend currently accepts raw username/string – keep consistent.
   */
  public async regenerateChallenge( username: string ): Promise<MSG> {
    return await this.post<MSG>(
      `${ this.baseURL }/api/auth/regenerate-challenge`,
      username,
    );
  }

  /**
   * POST /api/auth/ws-token/rotate/:username
   *   → Rotate WS token for a given username (for WebSocket clients).
   */
  public async rotateWsToken( username: string ): Promise<MSG> {
    return await this.post(
      `${ this.baseURL }/api/auth/ws-token/rotate/${ username }`,
      {},
    );
  }

  // ==========================================================================
  //  MFA API ( /api/mfa/* )
  // ==========================================================================

  /**
   * POST /api/mfa/initiate
   *   → Start MFA pairing (generate QR + secret for username).
   */
  public async generateMultiAuthQRCode( username: string ): Promise<MSG> {
    return await this.post<MSG>(
      `${ this.baseURL }/api/mfa/initiate`,
      { username },
    );
  }

  /**
   * POST /api/mfa/confirm
   *   → Confirm MFA pairing (foreign app confirms via pairingToken).
   */
  public async getConfirmationOfMultiAuth( data: MultiAuthData ): Promise<MSG> {
    return await this.post<MSG>(
      `${ this.baseURL }/api/mfa/confirm`,
      data,
    );
  }

  /**
   * GET /api/mfa/status/:pairingToken
   *   → Poll MFA pairing status from FE.
   */
  public async getMultiAuthStatus( pairingToken: string ): Promise<MSG> {
    return await firstValueFrom(
      this.http.get<MSG>( `${ this.baseURL }/api/mfa/status/${ pairingToken }` ),
    );
  }

  /**
   * POST /api/mfa/deactive/:username
   *   → Disable MFA for a given username.
   */
  public async deactiveMultiAuth( username: string ): Promise<MSG> {
    return await this.post<MSG>(
      `${ this.baseURL }/api/mfa/deactive/${ username }`,
      {},
    );
  }

  /**
   * POST /api/mfa/initial-verify
   *   → Verify the FIRST code during MFA setup (pairing stage).
   */
  public async mfaInitialVerify( data: { pairingToken: string; code: string; } ): Promise<MSG> {
    return await this.post<MSG>(
      `${ this.baseURL }/api/mfa/initial-verify`,
      data,
    );
  }

  /**
   * POST /api/mfa/user-verify
   *   → Verify MFA code during login (with login challenge token + deviceId).
   */
  public async mfaUserVerify(
    data: { token: string; code: string; deviceId: string; },
  ): Promise<MSG> {
    return await this.post<MSG>(
      `${ this.baseURL }/api/mfa/user-verify`,
      data,
    );
  }

  // ==========================================================================
  //  COUNTRY / CURRENCY HELPERS (external APIs)
  // ==========================================================================

  /**
   * getCustomCountryDetails
   * -----------------------
   * Uses @yusifaliyevpro/countries to fetch an enriched set of
   * country details (name, currencies, IDD, flags, maps, postal codes).
   */
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

  /**
   * getCountryCodes
   * ---------------
   * Builds a compact list of country calling codes + flags, suitable
   * for phone-code dropdowns.
   */
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

  /**
   * GET https://restcountries.com/v3.1/all
   *   → Full country list with currency details.
   */
  public async getAllCountryWithCurrency(): Promise<CountryDetails[]> {
    return await firstValueFrom(
      this.http.get<CountryDetails[]>(
        'https://restcountries.com/v3.1/all',
      ),
    );
  }

  /**
   * GET https://restcountries.com/v3.1/name/:name?fullText=true
   *   → Lookup a country by full name.
   */
  public async getCountryByName(
    name: string,
  ): Promise<CountryDetails[]> {
    return await firstValueFrom(
      this.http.get<CountryDetails[]>(
        `https://restcountries.com/v3.1/name/${ name }?fullText=true`,
      ),
    );
  }

  /**
   * GET country flag emoji JSON (3rd party CDN).
   *   → General-purpose "flags library" response as unknown; caller casts.
   */
  public async getCountries(): Promise<unknown> {
    const countries = await firstValueFrom(
      this.http.get<unknown>(
        'https://cdn.jsdelivr.net/npm/country-flag-emoji-json@2.0.0/dist/index.json',
      ),
    );
    return countries;
  }
}
