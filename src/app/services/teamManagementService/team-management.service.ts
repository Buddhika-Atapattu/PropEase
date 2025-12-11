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

export const DEFAULT_TEAM_DOMAINS: ReadonlyArray<TeamDomain> = [
  'development',
  'finance',
  'marketing',
  'operations',
  'other',
  'sales',
  'support',
] as const;

// Task-level status for TeamManagement.assignTasks
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

export const DEFAULT_TASK_PRIORITYIES: ReadonlyArray<TaskPriority> = [
  'critical',
  'high',
  'low',
  'medium',
];

// ─────────────────────────────────────────────
// Work item & event types (aligned with backend models)
// ─────────────────────────────────────────────

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
 * Backend has its own TaskEvidence shape. Components must map this DTO to backend format.
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

export const TEAM_ROLES = [
  // Core roles
  'captain',
  'member',
  'lead',
  'supervisor',
  'observer',

  // Trade-based / functional roles
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

export interface TeamMember extends User {
  roleInTeam?: RoleInTeam;
  reason?: string;          // why this user is in the team
  joinedAt?: ISODateString;          // ✅ when this user joined THIS team
}

export interface TeamManagement {
  id: string;
  teamName: string;
  domain: TeamDomain;
  description: string;
  members: TeamMember[];
  captain: TeamMember;
  memberTotal: number;
  assignTasks: AssignedTask[];
  teamLogo?: TaskEvidence;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  isActive?: boolean;
}

export interface AllUserWithTeams extends User {
  domain?: TeamDomain,
  teamName?: TeamManagement[ "teamName" ],
  roleInTeam?: 'member' | 'lead' | 'supervisor' | 'observer' | null;
  teamReason?: string | null;
  teamJoinedAt?: ISODateString | null;
  teams: {
    domain?: TeamDomain,
    teamName?: TeamManagement[ "teamName" ],
  }[];
}

// WorkItem FE view (only fields we care about on UI; backend can have more)
export interface WorkItem {
  _id: string;
  id: string;
  teamId: string;
  teamMongoId: string;
  domain: TeamDomain;

  kind: WorkItemKind;
  status: WorkItemStatus;
  priority: TaskPriority;

  createdById: string;
  createdByUsername: string;

  assignedMembers?: string[];      // user ids
  captainUserId?: string;

  propertyId?: string;
  tenantId?: string;
  leaseId?: string;
  complaintId?: string;
  buildingId?: string;

  title: string;
  description?: string;

  createdAt: ISODateString;
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

// WorkEvent types =================================================================

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
  _id: string;
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
  fromPriority?: TaskPriority;
  toPriority?: TaskPriority;

  payload?: Record<string, unknown>;

  createdAt: ISODateString; // ISO string in backend model
  year: number;
  month: number;
  day: number;
  yearMonth: string;
}

export interface WorkEventStats {
  workItemId: string;
  byKind: Record<WorkEventKind, number>;
}

// ─────────────────────────────────────────────
// API map keys + helpers
// ─────────────────────────────────────────────

type TeamAPIKey =
  // Team management
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
  | 'workEventsStatsByWorkItem';

type Anchor = string | number;
type Anchors = Anchor[];

type ApiNamespace = 'team' | 'workEvent';

interface ApiRouteDef {
  ns: ApiNamespace;
  path: string; // path relative to its namespace root, e.g. "/all", "/users/no-team"
}

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────

@Injectable( {
  providedIn: 'root',
} )
export class TeamManagementService {
  private readonly root: string = ( environment.apiOrigin ?? 'http://localhost:3000' ).replace(
    /\/+$/,
    '',
  );

  private readonly teamManagementAPIRoot: string = `${ this.root }/api-team-management`;
  private readonly workEventAPIRoot: string = `${ this.root }/api-work-event`;

  private readonly isBrowser: boolean;

  // Centralised route registry for both Team + WorkEvent APIs
  private readonly apiRoutes: Record<TeamAPIKey, ApiRouteDef>;

  public constructor (
    private readonly http: HttpClient,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    // Initialise route table once.
    this.apiRoutes = {
      // ───── Team ─────
      getTeams: { ns: 'team', path: '/all' },
      getTeamById: { ns: 'team', path: '' }, // + /:teamId via anchors
      getTeamByName: { ns: 'team', path: '/teamName' }, // + /:teamId via anchors
      createTeam: { ns: 'team', path: '/create' },
      updateTeam: { ns: 'team', path: '/update' }, // + /:teamId
      assignTask: { ns: 'team', path: '/assign-task' }, // + /:teamId
      attachEvidenceMeta: { ns: 'team', path: '/evidence/attach' }, // + /:teamId/:taskId
      uploadTeamLogo: { ns: 'team', path: '/upload/logo' }, // + /:teamId
      uploadTaskEvidence: { ns: 'team', path: '/upload/evidence' }, // + /:teamId/:taskId
      deleteTeam: { ns: 'team', path: '/delete' }, // + /:teamId
      getTeamTotals: { ns: 'team', path: '/stats/teams-total' },
      getTeamTotalsByDomain: { ns: 'team', path: '/stats/teams-total/domain' }, // + /:domain
      usersNoTeam: { ns: 'team', path: '/users/no-team' },
      usersNoTeamCount: { ns: 'team', path: '/users/no-team/count' },
      usersInTeams: { ns: 'team', path: '/users/in-teams' },
      usersInTeamsCount: { ns: 'team', path: '/users/in-teams/count' },
      usersNoTeamByDomain: { ns: 'team', path: '/users/no-team/domain' }, // + /:domain
      usersNoTeamByDomainCount: {
        ns: 'team',
        path: '/users/no-team/domain',
      }, // + /:domain/count
      usersInTeamsByDomain: {
        ns: 'team',
        path: '/users/in-teams/domain',
      }, // + /:domain
      usersInTeamsByDomainCount: {
        ns: 'team',
        path: '/users/in-teams/domain',
      }, // + /:domain/count
      allUsers: { ns: 'team', path: '/users/all' },

      // ───── Work events ─────
      workEventsAll: { ns: 'workEvent', path: '/all' },
      workEventsByWorkItem: { ns: 'workEvent', path: '/by-workitem' }, // + /:workItemId
      workEventsByTeam: { ns: 'workEvent', path: '/by-team' }, // + /:teamId
      workEventsStatsByWorkItem: {
        ns: 'workEvent',
        path: '/stats/workitem',
      }, // + /:workItemId
    };
  }

  // ─────────────────────────────────────────────
  // Core private helpers (validation + mapping)
  // ─────────────────────────────────────────────

  private toParams(
    record: Record<string, string | number | boolean | undefined | null>,
  ): HttpParams {
    let p = new HttpParams();
    Object.entries( record ).forEach( ( [ k, v ] ) => {
      if ( v != null ) {
        p = p.set( k, String( v ) );
      }
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
          ( anyE.error as any ).message || anyE.message || 'Request failed';
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
    if ( !anchors || anchors.length === 0 ) {
      return base;
    }
    const encoded = anchors.map( ( a ) => encodeURIComponent( String( a ) ) );
    return `${ base }/${ encoded.join( '/' ) }`;
  }

  /**
   * Single source of truth for backend paths.
   * Uses apiRoutes + namespace to determine correct root.
   */
  private buildApiUrl(
    key: TeamAPIKey,
    params?: HttpParams,
    anchors?: Anchors,
  ): string {
    const def = this.apiRoutes[ key ];
    if ( !def ) {
      throw new Error( `Unknown TeamAPIKey: ${ key }` );
    }

    const nsRoot =
      def.ns === 'team' ? this.teamManagementAPIRoot : this.workEventAPIRoot;

    const base = `${ nsRoot }${ def.path }`;
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
   */
  public async getTeams(
    index: number = 0,
    limit: number = 10,
    search?: string,
    domain?: TeamDomain,
    isActive?: boolean,
  ): Promise<MSG> {
    try {
      const params = this.toParams( {
        index,
        limit,
        search,
        domain,
        isActive,
      } );

      const url = this.buildApiUrl( 'getTeams', params );
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

      const url = this.buildApiUrl( 'getTeamById', undefined, [ safeId ] );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }
  /**
   * GET /:teamName
   */
  public async getTeamByName( teamName: string ): Promise<MSG> {
    try {
      const safeName = ( teamName || '' ).trim();
      if ( !safeName ) {
        throw new Error( 'Team ID is required' );
      }

      const url = this.buildApiUrl( 'getTeamByName', undefined, [ safeName ] );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * POST /create
   */
  public async createTeam( body: unknown ): Promise<MSG> {
    try {
      const url = this.buildApiUrl( 'createTeam' );
      const raw = await firstValueFrom(
        this.http.post<MSG | unknown>( url, body ),
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * PATCH /update/:teamId
   *
   * Accepts:
   *  - FormData   → for multipart updates (e.g. team JSON + teamLogo)
   *  - JSON patch → for pure JSON updates (no file upload)
   *
   * Example (multipart with logo):
   *
   *   const formData = new FormData();
   *   formData.append('team', JSON.stringify(teamPayload));
   *   if (logoFile) {
   *     formData.append('teamLogo', logoFile);
   *   }
   *   await teamService.updateTeam(teamId, formData);
   */
  public async updateTeam(
    teamId: string,
    payload: FormData | Partial<TeamManagement>,
  ): Promise<MSG> {
    try {
      const safeId: string = ( teamId || '' ).trim();
      if ( !safeId ) {
        throw new Error( 'Team ID is required for update' );
      }

      const url: string = this.buildApiUrl( 'updateTeam', undefined, [ safeId ] );

      const raw = await firstValueFrom(
        this.http.patch<MSG | unknown>( url, payload ),
      );

      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * DELETE /delete/:teamId?soft=true|false
   */
  public async deleteTeam( teamId: string, soft: boolean = true ): Promise<MSG> {
    try {
      const safeId = ( teamId || '' ).trim();
      if ( !safeId ) {
        throw new Error( 'Team ID is required for delete' );
      }

      const params = this.toParams( { soft } );
      const url = this.buildApiUrl( 'deleteTeam', params, [ safeId ] );

      const raw = await firstValueFrom( this.http.delete<MSG | unknown>( url ) );
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
   * body: { task: { ... } }
   */
  public async assignTask( teamId: string, body: unknown ): Promise<MSG> {
    try {
      const safeId = ( teamId || '' ).trim();
      if ( !safeId ) {
        throw new Error( 'Team ID is required for assignTask' );
      }

      const url = this.buildApiUrl( 'assignTask', undefined, [ safeId ] );
      const raw = await firstValueFrom(
        this.http.post<MSG | unknown>( url, body ),
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * POST /evidence/attach/:teamId/:taskId
   * body: { evidences: [ { ... } ] }
   */
  public async attachEvidenceMeta(
    teamId: string,
    taskId: string,
    body: unknown,
  ): Promise<MSG> {
    try {
      const safeTeamId = ( teamId || '' ).trim();
      const safeTaskId = ( taskId || '' ).trim();

      if ( !safeTeamId || !safeTaskId ) {
        throw new Error(
          'Team ID and Task ID are required for evidence attach',
        );
      }

      const url = this.buildApiUrl(
        'attachEvidenceMeta',
        undefined,
        [ safeTeamId, safeTaskId ],
      );

      const raw = await firstValueFrom(
        this.http.post<MSG | unknown>( url, body ),
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
   */
  public async uploadTeamLogo(
    teamId: string,
    formData: FormData,
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

      const url = this.buildApiUrl( 'uploadTeamLogo', undefined, [ safeId ] );
      const raw = await firstValueFrom(
        this.http.post<MSG | unknown>( url, formData ),
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * POST /upload/evidence/:teamId/:taskId
   */
  public async uploadTaskEvidence(
    teamId: string,
    taskId: string,
    formData: FormData,
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

      const url = this.buildApiUrl(
        'uploadTaskEvidence',
        undefined,
        [ safeTeamId, safeTaskId ],
      );

      const raw = await firstValueFrom(
        this.http.post<MSG | unknown>( url, formData ),
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
   * data.other: { totalTeams, totalActive, totalInactive, domainTotals }
   */
  public async getTeamTotals(): Promise<MSG> {
    try {
      const url = this.buildApiUrl( 'getTeamTotals' );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
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
    active?: boolean,
  ): Promise<MSG> {
    try {
      const safeDomain = ( domain || '' ).trim();
      if ( !safeDomain ) {
        throw new Error( 'Domain is required for team domain totals' );
      }

      const params = this.toParams( { active } );
      const url = this.buildApiUrl(
        'getTeamTotalsByDomain',
        params,
        [ safeDomain ],
      );

      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
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
   */
  public async getUsersWithoutAnyTeam(
    index: number = 0,
    limit: number = 10,
  ): Promise<MSG> {
    try {
      const params = this.toParams( { index, limit } );
      const url = this.buildApiUrl( 'usersNoTeam', params );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /users/no-team/count
   */
  public async getUsersWithoutAnyTeamCount(): Promise<MSG> {
    try {
      const url = this.buildApiUrl( 'usersNoTeamCount' );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /users/in-teams
   */
  public async getUsersInAnyTeam(
    index: number = 0,
    limit: number = 10,
  ): Promise<MSG> {
    try {
      const params = this.toParams( { index, limit } );
      const url = this.buildApiUrl( 'usersInTeams', params );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /users/in-teams/count
   */
  public async getUsersInAnyTeamCount(): Promise<MSG> {
    try {
      const url = this.buildApiUrl( 'usersInTeamsCount' );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
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
   */
  public async getUsersWithoutTeamByDomain(
    domain: TeamDomain,
    index: number = 0,
    limit: number = 10,
  ): Promise<MSG> {
    try {
      const safeDomain = ( domain || '' ).trim();
      if ( !safeDomain ) {
        throw new Error( 'Domain is required for usersWithoutTeamByDomain' );
      }

      const params = this.toParams( { index, limit } );
      const url = this.buildApiUrl(
        'usersNoTeamByDomain',
        params,
        [ safeDomain ],
      );

      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /users/no-team/domain/:domain/count
   */
  public async getUsersWithoutTeamByDomainCount(
    domain: TeamDomain,
  ): Promise<MSG> {
    try {
      const safeDomain = ( domain || '' ).trim();
      if ( !safeDomain ) {
        throw new Error( 'Domain is required for usersWithoutTeamByDomainCount' );
      }

      const url = this.buildApiUrl(
        'usersNoTeamByDomainCount',
        undefined,
        [ safeDomain, 'count' ],
      );

      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /users/in-teams/domain/:domain
   */
  public async getUsersInTeamByDomain(
    domain: TeamDomain,
    index: number = 0,
    limit: number = 10,
  ): Promise<MSG> {
    try {
      const safeDomain = ( domain || '' ).trim();
      if ( !safeDomain ) {
        throw new Error( 'Domain is required for usersInTeamByDomain' );
      }

      const params = this.toParams( { index, limit } );
      const url = this.buildApiUrl(
        'usersInTeamsByDomain',
        params,
        [ safeDomain ],
      );

      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /users/in-teams/domain/:domain/count
   */
  public async getUsersInTeamByDomainCount(
    domain: TeamDomain,
  ): Promise<MSG> {
    try {
      const safeDomain = ( domain || '' ).trim();
      if ( !safeDomain ) {
        throw new Error( 'Domain is required for usersInTeamByDomainCount' );
      }

      const url = this.buildApiUrl(
        'usersInTeamsByDomainCount',
        undefined,
        [ safeDomain, 'count' ],
      );

      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /users/all?index=&limit=&search=
   */
  public async getAllUsersWithTeams(
    index: number,
    limit: number,
    search?: string,
  ): Promise<MSG> {
    try {
      const params = this.toParams( { index, limit, search } );
      const url = this.buildApiUrl( 'allUsers', params );
      const raw = await firstValueFrom( this.http.get<MSG | unknown>( url ) );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  // ─────────────────────────────────────────────
  // Work events – queries
  // ─────────────────────────────────────────────

  /**
   * GET /api-work-event/all
   * Optional filters:
   *   workItemId, teamId, domain, kind, actor, fromStatus, toStatus,
   *   fromPriority, toPriority, from, to
   */
  public async getWorkEvents(
    index: number = 0,
    limit: number = 20,
    filters?: {
      workItemId?: string;
      teamId?: string;
      domain?: TeamDomain;
      kind?: WorkEventKind;
      actor?: string;
      fromStatus?: WorkItemStatus;
      toStatus?: WorkItemStatus;
      fromPriority?: TaskPriority;
      toPriority?: TaskPriority;
      from?: string | Date;
      to?: string | Date;
    },
  ): Promise<MSG> {
    try {
      const paramsObject: Record<string, string | number | boolean | null> = {
        index,
        limit,
      };

      if ( filters ) {
        if ( filters.workItemId ) paramsObject[ 'workItemId' ] = filters.workItemId;
        if ( filters.teamId ) paramsObject[ 'teamId' ] = filters.teamId;
        if ( filters.domain ) paramsObject[ 'domain' ] = filters.domain;
        if ( filters.kind ) paramsObject[ 'kind' ] = filters.kind;
        if ( filters.actor ) paramsObject[ 'actor' ] = filters.actor;
        if ( filters.fromStatus ) paramsObject[ 'fromStatus' ] = filters.fromStatus;
        if ( filters.toStatus ) paramsObject[ 'toStatus' ] = filters.toStatus;
        if ( filters.fromPriority )
          paramsObject[ 'fromPriority' ] = filters.fromPriority;
        if ( filters.toPriority )
          paramsObject[ 'toPriority' ] = filters.toPriority;

        if ( filters.from ) {
          const d = new Date( filters.from );
          if ( !Number.isNaN( d.getTime() ) ) {
            paramsObject[ 'from' ] = d.toISOString();
          }
        }
        if ( filters.to ) {
          const d = new Date( filters.to );
          if ( !Number.isNaN( d.getTime() ) ) {
            paramsObject[ 'to' ] = d.toISOString();
          }
        }
      }

      const params = this.toParams( paramsObject );
      const url = this.buildApiUrl( 'workEventsAll', params );
      const raw = await firstValueFrom(
        this.http.get<MSG | unknown>( url ),
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /api-work-event/by-workitem/:workItemId
   */
  public async getWorkEventsByWorkItem(
    workItemId: string,
    index: number = 0,
    limit: number = 20,
    kind?: WorkEventKind,
    from?: string | Date,
    to?: string | Date,
  ): Promise<MSG> {
    try {
      const safeId = ( workItemId || '' ).trim();
      if ( !safeId ) {
        throw new Error( 'workItemId is required for getWorkEventsByWorkItem' );
      }

      const paramsObject: Record<string, string | number | boolean | null> = {
        index,
        limit,
      };

      if ( kind ) paramsObject[ 'kind' ] = kind;
      if ( from ) {
        const d = new Date( from );
        if ( !Number.isNaN( d.getTime() ) ) paramsObject[ 'from' ] = d.toISOString();
      }
      if ( to ) {
        const d = new Date( to );
        if ( !Number.isNaN( d.getTime() ) ) paramsObject[ 'to' ] = d.toISOString();
      }

      const params = this.toParams( paramsObject );
      const url = this.buildApiUrl(
        'workEventsByWorkItem',
        params,
        [ safeId ],
      );
      const raw = await firstValueFrom(
        this.http.get<MSG | unknown>( url ),
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /api-work-event/by-team/:teamId
   */
  public async getWorkEventsByTeam(
    teamId: string,
    index: number = 0,
    limit: number = 20,
    domain?: TeamDomain,
    kind?: WorkEventKind,
    from?: string | Date,
    to?: string | Date,
  ): Promise<MSG> {
    try {
      const safeTeamId = ( teamId || '' ).trim();
      if ( !safeTeamId ) {
        throw new Error( 'teamId is required for getWorkEventsByTeam' );
      }

      const paramsObject: Record<string, string | number | boolean | null> = {
        index,
        limit,
      };

      if ( domain ) paramsObject[ 'domain' ] = domain;
      if ( kind ) paramsObject[ 'kind' ] = kind;
      if ( from ) {
        const d = new Date( from );
        if ( !Number.isNaN( d.getTime() ) ) paramsObject[ 'from' ] = d.toISOString();
      }
      if ( to ) {
        const d = new Date( to );
        if ( !Number.isNaN( d.getTime() ) ) paramsObject[ 'to' ] = d.toISOString();
      }

      const params = this.toParams( paramsObject );
      const url = this.buildApiUrl( 'workEventsByTeam', params, [ safeTeamId ] );
      const raw = await firstValueFrom(
        this.http.get<MSG | unknown>( url ),
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }

  /**
   * GET /api-work-event/stats/workitem/:workItemId
   * Returns MSG with data.other.byKind
   */
  public async getWorkItemEventStats(
    workItemId: string,
  ): Promise<MSG> {
    try {
      const safeId = ( workItemId || '' ).trim();
      if ( !safeId ) {
        throw new Error( 'workItemId is required for getWorkItemEventStats' );
      }

      const url = this.buildApiUrl(
        'workEventsStatsByWorkItem',
        undefined,
        [ safeId ],
      );
      const raw = await firstValueFrom(
        this.http.get<MSG | unknown>( url ),
      );
      return this.normalizeToMSG( raw );
    } catch ( error ) {
      return this.mapError( error );
    }
  }
}
