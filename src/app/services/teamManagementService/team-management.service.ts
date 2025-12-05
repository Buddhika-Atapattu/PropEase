// Path: src/app/services/team-management/team-management.service.ts

import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { MSG } from '../../types/api-message.types';
import { User } from '../APIs/apis.service';

// ─────────────────────────────────────────────
// Shared types (aligned with backend)
// ─────────────────────────────────────────────

export type ISODateString = string;

export type TeamDomain =
  | 'sales'
  | 'development'
  | 'support'
  | 'operations'
  | 'marketing'
  | 'finance'
  | 'other';

export type TaskStatus =
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface GeoLocation {
  lat: number;
  lng: number;
  embeddedUrl: string;
}

export interface Address {
  houseNumber?: string;
  street?: string;
  city: string;
  provinceOrState?: string;
  country: string;
}

/**
 * Frontend evidence model (for UI).
 * NOTE: Backend expects its own TaskEvidence shape; this interface is for UI
 * typing only. Components are responsible for mapping to DTOs.
 */
export interface TaskEvidence {
  name: string;
  file?: File;
  url?: string;
  storageKey?: string;
  uploadedById?: string;
  uploadedByName?: string;
  uploadedAt?: ISODateString;
}

export interface AssignedTask {
  id: string;
  name: string;
  description: string;
  location?: GeoLocation;
  address?: Address;
  assignedMembers?: User[];
  assignedTaskCaptain?: User;
  status?: TaskStatus;
  priority?: TaskPriority;
  plannedStartAt?: ISODateString;
  plannedEndAt?: ISODateString;
  completedAt?: ISODateString;
  evidence?: TaskEvidence[];
  notes?: string;
}

export interface TeamManagement {
  id: string;
  teamName: string;
  domain: TeamDomain;
  description: string;
  members: User[];
  captain: User;
  memberTotal: number;
  assignTasks: AssignedTask[];
  teamLogo?: TaskEvidence;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  isActive?: boolean;
}

// ─────────────────────────────────────────────
// API map key + helpers
// ─────────────────────────────────────────────

type TeamAPIKey =
  | 'getTeams'
  | 'getTeamById'
  | 'createTeam'
  | 'updateTeam'
  | 'assignTask'
  | 'attachEvidenceMeta'
  | 'uploadTeamLogo'
  | 'uploadTaskEvidence'
  | 'deleteTeam'
  | 'getTeamTotals'
  | 'getTeamTotalsByDomain'
  | 'usersNoTeam'
  | 'usersNoTeamCount'
  | 'usersInTeams'
  | 'usersInTeamsCount'
  | 'usersNoTeamByDomain'
  | 'usersNoTeamByDomainCount'
  | 'usersInTeamsByDomain'
  | 'usersInTeamsByDomainCount';

type Anchor = string | number;
type Anchors = Anchor[];

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────

@Injectable( {
  providedIn: 'root',
} )
export class TeamManagementService {

  private readonly root: string = ( environment.apiOrigin ?? 'http://localhost:3000' ).replace( /\/+$/, '' );;
  private readonly teamManagementAPIRoot: string = `${ this.root }/api-team-management`;
  private readonly isBrowser: boolean;

  public constructor (
    private readonly http: HttpClient,
    @Inject( PLATFORM_ID ) private readonly platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
  }

  // ─────────────────────────────────────────────
  // Core private helpers (validation + mapping)
  // ─────────────────────────────────────────────

  private toParams(
    record: Record<string, string | number | boolean | undefined | null>
  ): HttpParams {
    let p = new HttpParams();
    Object.entries( record ).forEach( ( [ k, v ] ) => {
      if ( v != null ) p = p.set( k, String( v ) );
    } );
    return p;
  }

  private mapError( e: unknown ): MSG {
    const fallback: MSG = {
      success: false,
      status: 'error',
      message: 'Unexpected error',
      data: e as any,
    };

    if ( typeof e === 'string' ) {
      return {
        success: false,
        status: 'error',
        message: e,
        data: null,
      };
    }

    if ( e && typeof e === 'object' ) {
      const anyE = e as { error?: any; message?: string; };
      if ( anyE?.error && typeof anyE.error === 'object' ) {
        const emsg =
          ( anyE.error as any ).message ||
          anyE.message ||
          'Request failed';
        return {
          success: false,
          status: 'error',
          message: emsg,
          data: anyE.error,
        };
      }
      if ( anyE?.message ) {
        return {
          success: false,
          status: 'error',
          message: anyE.message,
          data: null,
        };
      }
    }

    return fallback;
  }

  private normalizeToMSG( raw: unknown ): MSG {
    const r = raw as {
      success?: boolean;
      status?: string;
      message?: string;
      data?: unknown;
    };

    if ( typeof r?.message === 'string' ) {
      return {
        success: r.success ?? false,
        status: r.status?.toLowerCase() === 'success' ? 'success' : 'error',
        message: r.message,
        data: ( r.data ?? null ) as any,
      };
    }

    return {
      success: true,
      status: 'success',
      message: 'OK',
      data: raw as any,
    };
  }

  private buildUrl( base: string, anchors?: Anchors ): string {
    if ( !anchors || anchors.length === 0 ) return base;
    const encoded = anchors.map( a => encodeURIComponent( String( a ) ) );
    return `${ base }/${ encoded.join( '/' ) }`;
  }

  /**
   * Single source of truth for backend paths.
   * Components only see logical keys.
   */
  private apiMap(
    key: TeamAPIKey,
    params?: HttpParams,
    anchors?: Anchors
  ): string {
    let base!: string;

    switch ( key ) {
      case 'getTeams':
        base = `${ this.teamManagementAPIRoot }/all`;
        break;

      case 'getTeamById':
        base = `${ this.teamManagementAPIRoot }`;
        break;

      case 'createTeam':
        base = `${ this.teamManagementAPIRoot }/create`;
        break;

      case 'updateTeam':
        base = `${ this.teamManagementAPIRoot }/update`;
        break;

      case 'assignTask':
        base = `${ this.teamManagementAPIRoot }/assign-task`;
        break;

      case 'attachEvidenceMeta':
        base = `${ this.teamManagementAPIRoot }/evidence/attach`;
        break;

      case 'uploadTeamLogo':
        base = `${ this.teamManagementAPIRoot }/upload/logo`;
        break;

      case 'uploadTaskEvidence':
        base = `${ this.teamManagementAPIRoot }/upload/evidence`;
        break;

      case 'deleteTeam':
        base = `${ this.teamManagementAPIRoot }/delete`;
        break;

      case 'getTeamTotals':
        base = `${ this.teamManagementAPIRoot }/stats/teams-total`;
        break;

      case 'getTeamTotalsByDomain':
        base = `${ this.teamManagementAPIRoot }/stats/teams-total/domain`;
        break;

      case 'usersNoTeam':
        base = `${ this.teamManagementAPIRoot }/users/no-team`;
        break;

      case 'usersNoTeamCount':
        base = `${ this.teamManagementAPIRoot }/users/no-team/count`;
        break;

      case 'usersInTeams':
        base = `${ this.teamManagementAPIRoot }/users/in-teams`;
        break;

      case 'usersInTeamsCount':
        base = `${ this.teamManagementAPIRoot }/users/in-teams/count`;
        break;

      case 'usersNoTeamByDomain':
        base = `${ this.teamManagementAPIRoot }/users/no-team/domain`;
        break;

      case 'usersNoTeamByDomainCount':
        base = `${ this.teamManagementAPIRoot }/users/no-team/domain`;
        break;

      case 'usersInTeamsByDomain':
        base = `${ this.teamManagementAPIRoot }/users/in-teams/domain`;
        break;

      case 'usersInTeamsByDomainCount':
        base = `${ this.teamManagementAPIRoot }/users/in-teams/domain`;
        break;

      default:
        throw new Error( `Unknown TeamAPIKey: ${ key }` );
    }

    const url = this.buildUrl( base, anchors );
    if ( params ) {
      return `${ url }?${ params.toString() }`;
    }
    return url;
  }

  // ─────────────────────────────────────────────
  // Team CRUD (JSON only)
  // ─────────────────────────────────────────────

  /**
   * GET /all
   * Paginated list of teams with filters.
   * Component is responsible for consuming pagination metadata from data.other.pagination.
   */
  public async getTeams(
    index: number = 0,
    limit: number = 10,
    search?: string,
    domain?: TeamDomain,
    isActive?: boolean
  ): Promise<MSG> {
    try {
      const params = this.toParams( {
        index,
        limit,
        search,
        domain,
        isActive,
      } );

      const url = this.apiMap( 'getTeams', params );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /:teamId
   */
  public async getTeamById( teamId: string ): Promise<MSG> {
    try {
      const safeId = ( teamId || '' ).trim();
      if ( !safeId ) {
        throw new Error( 'Team ID is required' );
      }

      const url = this.apiMap( 'getTeamById', undefined, [ safeId ] );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * POST /create
   * Component builds the payload (JSON) and passes it here.
   * No FormData logic inside the service.
   */
  public async createTeam( body: unknown ): Promise<MSG> {
    try {
      const url = this.apiMap( 'createTeam' );
      const raw = await firstValueFrom(
        this.http.post<MSG | unknown>( url, body )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * PATCH /update/:teamId
   * Component decides which fields to patch and shapes the payload.
   */
  public async updateTeam(
    teamId: string,
    patch: unknown
  ): Promise<MSG> {
    try {
      const safeId = ( teamId || '' ).trim();
      if ( !safeId ) {
        throw new Error( 'Team ID is required for update' );
      }

      const url = this.apiMap( 'updateTeam', undefined, [ safeId ] );
      const raw = await firstValueFrom(
        this.http.patch<MSG | unknown>( url, patch )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * DELETE /delete/:teamId?soft=true|false
   */
  public async deleteTeam(
    teamId: string,
    soft: boolean = true
  ): Promise<MSG> {
    try {
      const safeId = ( teamId || '' ).trim();
      if ( !safeId ) {
        throw new Error( 'Team ID is required for delete' );
      }

      const params = this.toParams( { soft } );
      const url = this.apiMap( 'deleteTeam', params, [ safeId ] );

      const raw = await firstValueFrom(
        this.http.delete<MSG | unknown>( url )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  // ─────────────────────────────────────────────
  // Task & evidence (JSON only)
  // ─────────────────────────────────────────────

  /**
   * POST /assign-task/:teamId
   * Component passes correct body:
   *   { task: { ... } }
   */
  public async assignTask(
    teamId: string,
    body: unknown
  ): Promise<MSG> {
    try {
      const safeId = ( teamId || '' ).trim();
      if ( !safeId ) {
        throw new Error( 'Team ID is required for assignTask' );
      }

      const url = this.apiMap( 'assignTask', undefined, [ safeId ] );
      const raw = await firstValueFrom(
        this.http.post<MSG | unknown>( url, body )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * POST /evidence/attach/:teamId/:taskId
   * Component passes:
   *   { evidences: [ { ... } ] }
   * aligned with backend `buildEvidenceFromMeta`.
   */
  public async attachEvidenceMeta(
    teamId: string,
    taskId: string,
    body: unknown
  ): Promise<MSG> {
    try {
      const safeTeamId = ( teamId || '' ).trim();
      const safeTaskId = ( taskId || '' ).trim();

      if ( !safeTeamId || !safeTaskId ) {
        throw new Error( 'Team ID and Task ID are required for evidence attach' );
      }

      const url = this.apiMap(
        'attachEvidenceMeta',
        undefined,
        [ safeTeamId, safeTaskId ]
      );

      const raw = await firstValueFrom(
        this.http.post<MSG | unknown>( url, body )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  // ─────────────────────────────────────────────
  // Upload endpoints (FormData built in component)
  // ─────────────────────────────────────────────

  /**
   * POST /upload/logo/:teamId
   * Component builds FormData:
   *   const fd = new FormData();
   *   fd.append('files', file);
   */
  public async uploadTeamLogo(
    teamId: string,
    formData: FormData
  ): Promise<MSG> {
    try {
      if ( !this.isBrowser ) {
        return {
          success: false,
          status: 'error',
          message: 'Logo upload is only supported in browser environment',
          data: null,
        };
      }

      const safeId = ( teamId || '' ).trim();
      if ( !safeId ) {
        throw new Error( 'Team ID is required for logo upload' );
      }

      const url = this.apiMap( 'uploadTeamLogo', undefined, [ safeId ] );
      const raw = await firstValueFrom(
        this.http.post<MSG | unknown>( url, formData )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * POST /upload/evidence/:teamId/:taskId
   * Component builds FormData with multiple files:
   *   fd.append('files', file1);
   *   fd.append('files', file2);
   */
  public async uploadTaskEvidence(
    teamId: string,
    taskId: string,
    formData: FormData
  ): Promise<MSG> {
    try {
      if ( !this.isBrowser ) {
        return {
          success: false,
          status: 'error',
          message: 'Evidence upload is only supported in browser environment',
          data: null,
        };
      }

      const safeTeamId = ( teamId || '' ).trim();
      const safeTaskId = ( taskId || '' ).trim();

      if ( !safeTeamId || !safeTaskId ) {
        throw new Error( 'Team ID and Task ID are required for evidence upload' );
      }

      const url = this.apiMap(
        'uploadTaskEvidence',
        undefined,
        [ safeTeamId, safeTaskId ]
      );

      const raw = await firstValueFrom(
        this.http.post<MSG | unknown>( url, formData )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  // ─────────────────────────────────────────────
  // Team totals / stats
  // ─────────────────────────────────────────────

  /**
   * GET /stats/teams-total
   * data.other:
   *   { totalTeams, totalActive, totalInactive, domainTotals }
   */
  public async getTeamTotals(): Promise<MSG> {
    try {
      const url = this.apiMap( 'getTeamTotals' );
      const raw = await firstValueFrom(
        this.http.get<MSG | unknown>( url )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /stats/teams-total/domain/:domain?active=true|false
   */
  public async getTeamTotalsByDomain(
    domain: TeamDomain,
    active?: boolean
  ): Promise<MSG> {
    try {
      const safeDomain = ( domain || '' ).trim();
      if ( !safeDomain ) {
        throw new Error( 'Domain is required for team domain totals' );
      }

      const params = this.toParams( { active } );
      const url = this.apiMap(
        'getTeamTotalsByDomain',
        params,
        [ safeDomain ]
      );

      const raw = await firstValueFrom(
        this.http.get<MSG | unknown>( url )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  // ─────────────────────────────────────────────
  // User membership analytics – global
  // ─────────────────────────────────────────────

  /**
   * GET /users/no-team
   * Users not in any team (paginated).
   */
  public async getUsersWithoutAnyTeam(
    index: number = 0,
    limit: number = 10
  ): Promise<MSG> {
    try {
      const params = this.toParams( { index, limit } );
      const url = this.apiMap( 'usersNoTeam', params );
      const raw = await firstValueFrom(
        this.http.get<MSG | unknown>( url )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /users/no-team/count
   * Total users not in any team.
   */
  public async getUsersWithoutAnyTeamCount(): Promise<MSG> {
    try {
      const url = this.apiMap( 'usersNoTeamCount' );
      const raw = await firstValueFrom(
        this.http.get<MSG | unknown>( url )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /users/in-teams
   * Users that belong to at least one team (paginated).
   */
  public async getUsersInAnyTeam(
    index: number = 0,
    limit: number = 10
  ): Promise<MSG> {
    try {
      const params = this.toParams( { index, limit } );
      const url = this.apiMap( 'usersInTeams', params );
      const raw = await firstValueFrom(
        this.http.get<MSG | unknown>( url )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /users/in-teams/count
   * Total users that belong to at least one team.
   */
  public async getUsersInAnyTeamCount(): Promise<MSG> {
    try {
      const url = this.apiMap( 'usersInTeamsCount' );
      const raw = await firstValueFrom(
        this.http.get<MSG | unknown>( url )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  // ─────────────────────────────────────────────
  // User membership analytics – domain-specific
  // ─────────────────────────────────────────────

  /**
   * GET /users/no-team/domain/:domain
   * Users not in any team of the given domain (paginated).
   */
  public async getUsersWithoutTeamByDomain(
    domain: TeamDomain,
    index: number = 0,
    limit: number = 10
  ): Promise<MSG> {
    try {
      const safeDomain = ( domain || '' ).trim();
      if ( !safeDomain ) {
        throw new Error( 'Domain is required for usersWithoutTeamByDomain' );
      }

      const params = this.toParams( { index, limit } );
      const url = this.apiMap(
        'usersNoTeamByDomain',
        params,
        [ safeDomain ]
      );

      const raw = await firstValueFrom(
        this.http.get<MSG | unknown>( url )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /users/no-team/domain/:domain/count
   */
  public async getUsersWithoutTeamByDomainCount(
    domain: TeamDomain
  ): Promise<MSG> {
    try {
      const safeDomain = ( domain || '' ).trim();
      if ( !safeDomain ) {
        throw new Error( 'Domain is required for usersWithoutTeamByDomainCount' );
      }

      const url = this.apiMap(
        'usersNoTeamByDomainCount',
        undefined,
        [ safeDomain, 'count' ]
      );

      const raw = await firstValueFrom(
        this.http.get<MSG | unknown>( url )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /users/in-teams/domain/:domain
   * Users that belong to at least one team in given domain (paginated).
   */
  public async getUsersInTeamByDomain(
    domain: TeamDomain,
    index: number = 0,
    limit: number = 10
  ): Promise<MSG> {
    try {
      const safeDomain = ( domain || '' ).trim();
      if ( !safeDomain ) {
        throw new Error( 'Domain is required for usersInTeamByDomain' );
      }

      const params = this.toParams( { index, limit } );
      const url = this.apiMap(
        'usersInTeamsByDomain',
        params,
        [ safeDomain ]
      );

      const raw = await firstValueFrom(
        this.http.get<MSG | unknown>( url )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /users/in-teams/domain/:domain/count
   */
  public async getUsersInTeamByDomainCount(
    domain: TeamDomain
  ): Promise<MSG> {
    try {
      const safeDomain = ( domain || '' ).trim();
      if ( !safeDomain ) {
        throw new Error( 'Domain is required for usersInTeamByDomainCount' );
      }

      const url = this.apiMap(
        'usersInTeamsByDomainCount',
        undefined,
        [ safeDomain, 'count' ]
      );

      const raw = await firstValueFrom(
        this.http.get<MSG | unknown>( url )
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }
}
