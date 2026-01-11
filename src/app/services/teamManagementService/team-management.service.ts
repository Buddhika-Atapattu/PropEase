// Path: src/app/services/team-management/team-management.service.ts
// ============================================================================
// TeamManagementService
// ----------------------------------------------------------------------------
// - Angular HTTP wrapper for Team Management + Work Event APIs
// - DTO types aligned to backend models
// - SSR/Electron safe (guards browser-only upload APIs via isPlatformBrowser)
// ============================================================================

import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { MSG } from '../../types/api-message.types';
import { User } from '../APIs/apis.service';

// ============================================================================
// Shared Types (BE-aligned)
// ============================================================================

export type ISODateString = string;

// ----------------------------------------------------------------------------
// Team domain
// ----------------------------------------------------------------------------
export type TeamDomain =
  | 'sales'
  | 'development'
  | 'support'
  | 'operations'
  | 'marketing'
  | 'finance'
  | 'other';

export const DEFAULT_TEAM_DOMAINS: ReadonlyArray<TeamDomain> = [
  'development',
  'finance',
  'marketing',
  'operations',
  'other',
  'sales',
  'support',
] as const;

// ----------------------------------------------------------------------------
// Task status & priority
// ----------------------------------------------------------------------------
export type TaskStatus =
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled';

export const DEFAULT_TASK_STATUS: ReadonlyArray<TaskStatus> = [
  'blocked',
  'cancelled',
  'completed',
  'draft',
  'in_progress',
  'pending',
] as const;

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export const DEFAULT_TASK_PRIORITIES: ReadonlyArray<TaskPriority> = [
  'critical',
  'high',
  'low',
  'medium',
] as const;

// ----------------------------------------------------------------------------
// Location & Address
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// File meta (BE-aligned)
// ----------------------------------------------------------------------------
export interface FileMetaBase {
  originalName: string;
  storedName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
}

// ----------------------------------------------------------------------------
// Evidence (DTO + UI helper)
// ----------------------------------------------------------------------------
export interface TaskEvidenceDto {
  name: string;
  file?: FileMetaBase | File;
  url?: string;
  storageKey?: string;

  uploadedById?: string; // ObjectId -> string in JSON
  uploadedByName?: User[ 'username' ];
  uploadedAt?: ISODateString;
}

// UI-only helper (browser File), not stored in DB directly
export interface TaskEvidenceUI {
  name: string;
  file?: File;
  url?: string;
  storageKey?: string;
  uploadedById?: string;
  uploadedByName?: User[ 'username' ];
  uploadedAt?: ISODateString;
}

// ----------------------------------------------------------------------------
// Assigned task (BE-aligned)
// ----------------------------------------------------------------------------
export interface AssignedTaskDto {
  id: string;
  name: string;
  description: string;

  location?: GeoLocation;
  address?: Address;

  assignedMembers?: string[];
  assignedTaskCaptain?: string;

  status?: TaskStatus;
  priority?: TaskPriority;

  plannedStartAt?: ISODateString;
  plannedEndAt?: ISODateString;
  completedAt?: ISODateString;

  evidence?: TaskEvidenceDto[];
  notes?: string;
}

// ----------------------------------------------------------------------------
// Team roles (BE-aligned)
// ----------------------------------------------------------------------------
export const TEAM_ROLES = [
  'captain',
  'member',
  'lead',
  'supervisor',
  'observer',
  'mechanic',
  'carpenter',
  'electrician',
  'plumber',
  'technician',
  'welder',
  'driver',
  'cleaner',
  'security',
  'gardener',
  'painter',
  'mason',
  'helper',
] as const;

export type RoleInTeam = ( typeof TEAM_ROLES )[ number ];
export const DEFAULT_ROLES_IN_TEAM: ReadonlyArray<RoleInTeam> = TEAM_ROLES;

export type OrgUnitType = 'team' | 'department' | 'squad' | 'board';


// Teams with their domains when taking users in a team
export type UserTeams = {
  teamName: TeamManagementDto[ 'teamName' ];
  domain: TeamDomain;
};

export interface TeamMemberDto {
// Major data
  id: string;
  username: User[ 'username' ];

  // BE allows these optional
  user?: User | null;
  teams?: UserTeams[] | null;

  // Latest team data
  roleInTeam?: RoleInTeam | null;
  reason?: string | null;
  joinedAt?: ISODateString | null;
  domain?: TeamDomain | null;
  teamName?: TeamManagementDto[ 'teamName' ] | null;
  teamReason?: string | null;
}

export interface UserWithTeams extends User {
  teams?: UserTeams[];
}

export interface TeamManagementDto {
  teamCode: string;
  teamName: string;
  orgType?: OrgUnitType;
  domain: TeamDomain;
  description: string;

  members: TeamMemberDto[];
  captain: TeamMemberDto;

  memberTotal: number;
  assignTasks: AssignedTaskDto[];
  teamLogo?: TaskEvidenceDto;

  createdAt: ISODateString;
  updatedAt: ISODateString;
  isActive?: boolean;
}

// ----------------------------------------------------------------------------
// Users-with-teams payload (/users/all)
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Work item + events (BE-aligned)
// ----------------------------------------------------------------------------
export type WorkItemKind =
  | 'sales_lead'
  | 'property_viewing'
  | 'offer_negotiation'
  | 'lease_signing'
  | 'rent_collection'
  | 'marketing_campaign'
  | 'social_post'
  | 'complaint_handling'
  | 'maintenance_job'
  | 'inspection'
  | 'cleaning_job'
  | 'dev_task'
  | 'support_ticket'
  | 'hr_recruitment'
  | 'hr_training'
  | 'hr_performance_review'
  | 'other';

export type WorkItemStatus =
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled'
  | 'backlog'
  | 'open'
  | 'done';

export type WorkItemPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskEvidence {
  name: string;
  file?: FileMetaBase;
  url?: string;
  storageKey?: string;

  uploadedById?: string;
  uploadedByName?: User[ 'username' ];
  uploadedAt?: ISODateString;
}

export interface WorkItem {
  id: string; // human-friendly ID like WORK-2025...
  teamId: string; // TeamManagement.id (code)
  teamMongoId: string; // TeamManagement._id (ObjectId)
  domain: TeamDomain;

  kind: WorkItemKind;
  status: WorkItemStatus;
  priority: WorkItemPriority;

  createdById: string;
  createdByUsername: string;
  assignedMembers: string[];
  captainUserId?: string;

  propertyId?: string;
  tenantId?: string;
  leaseId?: string;
  complaintId?: string;
  buildingId?: string;

  title: string;
  description: string;

  createdAt: ISODateString;
  updatedAt: ISODateString;
  plannedStartAt?: ISODateString;
  plannedEndAt?: ISODateString;
  startedAt?: ISODateString;
  completedAt?: ISODateString;
  cancelledAt?: ISODateString;

  expectedValue?: number;
  actualValue?: number;
  commissionAmount?: number;
  timeSpentMinutes?: number;

  location?: GeoLocation;
  address?: Address;

  evidence?: TaskEvidence[];
  tags?: string[];
}

export type WorkEventKind =
  | 'workitem_created'
  | 'status_changed'
  | 'priority_changed'
  | 'assigned_members_changed'
  | 'value_updated'
  | 'evidence_added'
  | 'comment_added'
  | 'team_changed'
  | 'domain_changed';

export interface WorkEvent {
  workItemId: string;
  workItemMongoId: string;
  teamId: string;
  teamMongoId: string;
  domain: TeamDomain;

  kind: WorkEventKind;

  actorUserId?: string;
  actorUsername?: string;
  actorRole?: string;

  fromStatus?: WorkItemStatus;
  toStatus?: WorkItemStatus;

  fromPriority?: WorkItemPriority;
  toPriority?: WorkItemPriority;

  payload?: Record<string, unknown>;

  createdAt: ISODateString;

  year: number;
  month: number;
  day: number;
  yearMonth: string;
}

// ============================================================================
// API routing model
// ============================================================================

type TeamAPIKey =
  // Team
  | 'getTeams'
  | 'getTeamById'
  | 'getTeamByName'
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
  | 'usersInTeamsByDomainCount'
  | 'allUsers'
  // Work events
  | 'workEventsAll'
  | 'workEventsByWorkItem'
  | 'workEventsByTeam'
  | 'workEventsStatsByWorkItem'
  // Tasks
  | 'getAllTasksForTeam';
;

type ApiNamespace = 'team' | 'workEvent' | 'task';

type Anchor = string | number;
type Anchors = Anchor[];

interface ApiRouteDef {
  ns: ApiNamespace;
  path: string;
}

// ============================================================================
// Service
// ============================================================================

@Injectable( { providedIn: 'root' } )
export class TeamManagementService {
  // ----------------------------------------------------------------------------
  // API roots
  // ----------------------------------------------------------------------------
  private readonly root: string = ( environment.apiOrigin ?? 'http://localhost:3000' )
    .replace( /\/+$/, '' );

  private readonly teamManagementAPIRoot: string = `${ this.root }/api-team-management`;
  private readonly workEventAPIRoot: string = `${ this.root }/api-work-event`;
  private readonly taskAPIRoot: string = `${ this.root }/api-team-management/task`;

  // ----------------------------------------------------------------------------
  // Runtime flags
  // ----------------------------------------------------------------------------
  private readonly isBrowser: boolean;

  // ----------------------------------------------------------------------------
  // Route map
  // ----------------------------------------------------------------------------
  private readonly apiRoutes: Record<TeamAPIKey, ApiRouteDef> = {
    // ───── Team ─────
    getTeams: { ns: 'team', path: '/all' },
    getTeamById: { ns: 'team', path: '' },
    getTeamByName: { ns: 'team', path: '/teamName' },
    createTeam: { ns: 'team', path: '/create' },
    updateTeam: { ns: 'team', path: '/update' },
    assignTask: { ns: 'team', path: '/assign-task' },
    attachEvidenceMeta: { ns: 'team', path: '/evidence/attach' },
    uploadTeamLogo: { ns: 'team', path: '/upload/logo' },
    uploadTaskEvidence: { ns: 'team', path: '/upload/evidence' },
    deleteTeam: { ns: 'team', path: '/delete' },

    getTeamTotals: { ns: 'team', path: '/stats/teams-total' },
    getTeamTotalsByDomain: { ns: 'team', path: '/stats/teams-total/domain' },

    usersNoTeam: { ns: 'team', path: '/users/no-team' },
    usersNoTeamCount: { ns: 'team', path: '/users/no-team/count' },

    usersInTeams: { ns: 'team', path: '/users/in-teams' },
    usersInTeamsCount: { ns: 'team', path: '/users/in-teams/count' },

    // NOTE: Count versions append "/count" as an anchor, to keep the route map minimal.
    usersNoTeamByDomain: { ns: 'team', path: '/users/no-team/domain' },
    usersNoTeamByDomainCount: { ns: 'team', path: '/users/no-team/domain' },

    usersInTeamsByDomain: { ns: 'team', path: '/users/in-teams/domain' },
    usersInTeamsByDomainCount: { ns: 'team', path: '/users/in-teams/domain' },

    allUsers: { ns: 'team', path: '/users/all' },

    // ───── Work events ─────
    workEventsAll: { ns: 'workEvent', path: '/all' },
    workEventsByWorkItem: { ns: 'workEvent', path: '/by-workitem' },
    workEventsByTeam: { ns: 'workEvent', path: '/by-team' },
    workEventsStatsByWorkItem: { ns: 'workEvent', path: '/stats/workitem' },

    // ───── Tasks ─────
    getAllTasksForTeam: { ns: 'task', path: '/get-tasks' },
  };

  public constructor (
    private readonly http: HttpClient,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
  }

  // ============================================================================
  // Core helpers
  // ============================================================================

  private toParams(
    record: Record<string, string | number | boolean | undefined | null>,
  ): HttpParams {
    let params = new HttpParams();

    Object.entries( record ).forEach( ( [ key, value ] ) => {
      if ( value != null ) {
        params = params.set( key, String( value ) );
      }
    } );

    return params;
  }

  private buildUrl( base: string, anchors?: Anchors ): string {
    if ( !anchors || anchors.length === 0 ) return base;

    const encoded = anchors.map( ( a ) => encodeURIComponent( String( a ) ) );
    return `${ base }/${ encoded.join( '/' ) }`;
  }

  private buildApiUrl( key: TeamAPIKey, params?: HttpParams, anchors?: Anchors ): string {
    const def = this.apiRoutes[ key ];
    if ( !def ) throw new Error( `Unknown TeamAPIKey: ${ key }` );
    let nsRoot: string;

    switch ( def.ns ) {
      case 'team':
        nsRoot = this.teamManagementAPIRoot;
        break;
      case 'workEvent':
        nsRoot = this.workEventAPIRoot;
        break;
      case 'task':
        nsRoot = this.taskAPIRoot;
        break;
      default:
        throw new Error( `Unhandled API namespace: ${ def.ns }` );
    }

    const url = this.buildUrl( `${ nsRoot }${ def.path }`, anchors );

    return params ? `${ url }?${ params.toString() }` : url;
  }

  private normalizeToMSG( raw: unknown ): MSG {
    const r = raw as { success?: boolean; status?: string; message?: string; data?: unknown; };

    if ( typeof r?.message === 'string' ) {
      return {
        success: r.success ?? false,
        status: r.status?.toLowerCase() === 'success' ? 'success' : 'error',
        message: r.message,
        data: ( r.data ?? null ) as any,
      };
    }

    // If backend returns plain data (not MSG), treat it as success payload.
    return { success: true, status: 'success', message: 'OK', data: raw as any };
  }

  private mapError( error: unknown ): MSG {
    const fallback: MSG = {
      success: false,
      status: 'error',
      message: 'Unexpected error',
      data: error as any,
    };

    if ( typeof error === 'string' ) {
      return { success: false, status: 'error', message: error, data: null };
    }

    if ( error && typeof error === 'object' ) {
      const anyE = error as { error?: any; message?: string; };

      // Angular HttpErrorResponse often puts server response under "error"
      if ( anyE?.error && typeof anyE.error === 'object' ) {
        const msg = ( anyE.error as any )?.message || anyE.message || 'Request failed';
        return { success: false, status: 'error', message: msg, data: anyE.error };
      }

      if ( typeof anyE?.message === 'string' && anyE.message.trim() ) {
        return { success: false, status: 'error', message: anyE.message, data: null };
      }
    }

    return fallback;
  }

  // Normalizer for /users/all to guarantee `teams: []`
  private normalizeUsersWithTeams( input: unknown ): TeamMemberDto[] {
    if ( !Array.isArray( input ) ) return [];

    return input.map( ( u: any ) => {
      const teamsArr = Array.isArray( u?.teams ) ? u.teams : [];

      const teams: UserTeams[] = teamsArr
        .map( ( t: any ) => ( {
          teamName: String( t?.teamName ?? '' ).trim(),
          domain: String( t?.domain ?? '' ).trim().toLowerCase() as TeamDomain,
        } ) )
        .filter( ( t: UserTeams ) => !!t.teamName && !!t.domain );

      const out: TeamMemberDto = {
        ...( u as User ),
        id: ( u?.id ?? undefined ) as TeamMemberDto[ 'id' ],
        domain: ( u?.domain ?? null ) as TeamDomain | null,
        teamName: ( u?.teamName ?? null ) as TeamManagementDto[ 'teamName' ] | null,
        roleInTeam: ( u?.roleInTeam ?? undefined ) as RoleInTeam | undefined,
        teamReason: ( u?.teamReason ?? null ) as string | null,
        joinedAt: ( u?.teamJoinedAt ?? null ) as ISODateString | null,
        teams,
      };

      return out;
    } );
  }

  private requireNonEmpty( label: string, value: string ): string {
    const safe = ( value || '' ).trim();
    if ( !safe ) throw new Error( `${ label } is required` );
    return safe;
  }

  // ============================================================================
  // Team CRUD
  // ============================================================================

  public async getTeams(
    index: number = 0,
    limit: number = 10,
    search?: string,
    domain?: TeamDomain,
    isActive?: boolean,
  ): Promise<MSG> {
    try {
      const params = this.toParams( { index, limit, search, domain, isActive } );
      const url = this.buildApiUrl( 'getTeams', params );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async getTeamById( teamId: string ): Promise<MSG> {
    try {
      const safeId = this.requireNonEmpty( 'Team ID', teamId );

      const url = this.buildApiUrl( 'getTeamById', undefined, [ safeId ] );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async getTeamByName( teamName: string ): Promise<MSG> {
    try {
      const safeName = this.requireNonEmpty( 'Team name', teamName );

      const url = this.buildApiUrl( 'getTeamByName', undefined, [ safeName ] );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async createTeam( body: unknown ): Promise<MSG> {
    try {
      const url = this.buildApiUrl( 'createTeam' );
      const raw = await firstValueFrom( this.http.post<MSG | unknown>( url, body ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async updateTeam(
    teamId: string,
    payload: FormData | Partial<TeamManagementDto>,
  ): Promise<MSG> {
    try {
      const safeId = this.requireNonEmpty( 'Team ID', teamId );

      const url = this.buildApiUrl( 'updateTeam', undefined, [ safeId ] );
      const raw = await firstValueFrom( this.http.patch<MSG | unknown>( url, payload ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async deleteTeam( teamId: string, soft: boolean = true ): Promise<MSG> {
    try {
      const safeId = this.requireNonEmpty( 'Team ID', teamId );

      const params = this.toParams( { soft } );
      const url = this.buildApiUrl( 'deleteTeam', params, [ safeId ] );
      const raw = await firstValueFrom( this.http.delete<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  // ============================================================================
  // Tasks & evidence (BE-aligned payloads)
  // ============================================================================

  public async assignTask( teamId: string, body: { task: AssignedTaskDto; } | unknown ): Promise<MSG> {
    try {
      const safeId = this.requireNonEmpty( 'Team ID', teamId );

      const url = this.buildApiUrl( 'assignTask', undefined, [ safeId ] );
      const raw = await firstValueFrom( this.http.post<MSG | unknown>( url, body ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async getAllTasksForTeam( teamId: string ): Promise<MSG> {
    try {
      const safeId = this.requireNonEmpty( 'Team ID', teamId );
      const url = this.buildApiUrl( 'getAllTasksForTeam', undefined, [ safeId ] );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    }
    catch ( error ) {
      return this.mapError( error );
    }
  }

  public async attachEvidenceMeta(
    teamId: string,
    taskId: string,
    body: { evidences: TaskEvidenceDto[]; } | unknown,
  ): Promise<MSG> {
    try {
      const safeTeamId = this.requireNonEmpty( 'Team ID', teamId );
      const safeTaskId = this.requireNonEmpty( 'Task ID', taskId );

      const url = this.buildApiUrl( 'attachEvidenceMeta', undefined, [ safeTeamId, safeTaskId ] );
      const raw = await firstValueFrom( this.http.post<MSG | unknown>( url, body ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  // ============================================================================
  // Upload endpoints (browser-only FormData)
  // ============================================================================

  public async uploadTeamLogo( teamId: string, formData: FormData ): Promise<MSG> {
    try {
      if ( !this.isBrowser ) {
        return {
          success: false,
          status: 'error',
          message: 'Logo upload is only supported in browser environment',
          data: null,
        };
      }

      const safeId = this.requireNonEmpty( 'Team ID', teamId );

      const url = this.buildApiUrl( 'uploadTeamLogo', undefined, [ safeId ] );
      const raw = await firstValueFrom( this.http.post<MSG | unknown>( url, formData ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async uploadTaskEvidence( teamId: string, taskId: string, formData: FormData ): Promise<MSG> {
    try {
      if ( !this.isBrowser ) {
        return {
          success: false,
          status: 'error',
          message: 'Evidence upload is only supported in browser environment',
          data: null,
        };
      }

      const safeTeamId = this.requireNonEmpty( 'Team ID', teamId );
      const safeTaskId = this.requireNonEmpty( 'Task ID', taskId );

      const url = this.buildApiUrl( 'uploadTaskEvidence', undefined, [ safeTeamId, safeTaskId ] );
      const raw = await firstValueFrom( this.http.post<MSG | unknown>( url, formData ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  // ============================================================================
  // Stats
  // ============================================================================

  public async getTeamTotals(): Promise<MSG> {
    try {
      const url = this.buildApiUrl( 'getTeamTotals' );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async getTeamTotalsByDomain( domain: TeamDomain, active?: boolean ): Promise<MSG> {
    try {
      const safeDomain = this.requireNonEmpty( 'Domain', domain );

      const params = this.toParams( { active } );
      const url = this.buildApiUrl( 'getTeamTotalsByDomain', params, [ safeDomain ] );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  // ============================================================================
  // Users analytics
  // ============================================================================

  public async getUsersWithoutAnyTeam( index: number = 0, limit: number = 10 ): Promise<MSG> {
    try {
      const params = this.toParams( { index, limit } );
      const url = this.buildApiUrl( 'usersNoTeam', params );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async getUsersWithoutAnyTeamCount(): Promise<MSG> {
    try {
      const url = this.buildApiUrl( 'usersNoTeamCount' );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async getUsersInAnyTeam( index: number = 0, limit: number = 10 ): Promise<MSG> {
    try {
      const params = this.toParams( { index, limit } );
      const url = this.buildApiUrl( 'usersInTeams', params );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async getUsersInAnyTeamCount(): Promise<MSG> {
    try {
      const url = this.buildApiUrl( 'usersInTeamsCount' );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async getUsersWithoutTeamByDomain(
    domain: TeamDomain,
    index: number = 0,
    limit: number = 10,
  ): Promise<MSG> {
    try {
      const safeDomain = this.requireNonEmpty( 'Domain', domain );

      const params = this.toParams( { index, limit } );
      const url = this.buildApiUrl( 'usersNoTeamByDomain', params, [ safeDomain ] );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async getUsersWithoutTeamByDomainCount( domain: TeamDomain ): Promise<MSG> {
    try {
      const safeDomain = this.requireNonEmpty( 'Domain', domain );

      const url = this.buildApiUrl( 'usersNoTeamByDomainCount', undefined, [ safeDomain, 'count' ] );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async getUsersInTeamByDomain(
    domain: TeamDomain,
    index: number = 0,
    limit: number = 10,
  ): Promise<MSG> {
    try {
      const safeDomain = this.requireNonEmpty( 'Domain', domain );

      const params = this.toParams( { index, limit } );
      const url = this.buildApiUrl( 'usersInTeamsByDomain', params, [ safeDomain ] );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  public async getUsersInTeamByDomainCount( domain: TeamDomain ): Promise<MSG> {
    try {
      const safeDomain = this.requireNonEmpty( 'Domain', domain );

      const url = this.buildApiUrl( 'usersInTeamsByDomainCount', undefined, [ safeDomain, 'count' ] );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /users/all
   * Returns MSG where we ensure data.other.users is UserWithTeams[]
   */
  public async getAllUsersWithTeams( index: number, limit: number, search?: string ): Promise<MSG> {
    try {
      const params = this.toParams( { index, limit, search } );
      const url = this.buildApiUrl( 'allUsers', params );

      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      const msg = this.normalizeToMSG( raw );

      const anyData = msg.data as any;
      const maybeUsers =
        anyData?.other?.users ??
        anyData?.users ??
        anyData?.data?.other?.users ??
        [];

      const users: TeamMemberDto[] = this.normalizeUsersWithTeams( maybeUsers );

      return {
        ...msg,
        data: {
          ...( anyData ?? {} ),
          other: {
            ...( anyData?.other ?? {} ),
            users,
          },
        },
      };
    } catch ( error ) {
      return this.mapError( error );
    }
  }
}
