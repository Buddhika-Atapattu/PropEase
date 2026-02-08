// Path: src/app/services/team-management/team-management.service.ts
// ============================================================================
// TeamManagementService (Simplified + Maintainable)
// ----------------------------------------------------------------------------
// Goals:
// - Keep routes explicit (no route-map engine)
// - Keep SSR/Electron safe upload handling (browser-only FormData)
// - Keep MSG normalization + safe error mapping
// - Keep completion confirmation endpoints (mark completed + signature + approve/reject)
// - Keep analytics endpoints (users, counts, domain filters)
// - Add: Team KPI REST (read-only)
// - Add: WorkItem REST (since BE now exposes /api-work-item)
// - Keep: Work events endpoints (/api-work-event)
// ----------------------------------------------------------------------------
// Notes:
// - This file uses split types from: team-management.types.ts
// - This service returns Promise<MSG> for consistency with your existing code.
// - Where a caller needs Observables, wrap with from(service.method()).
// ============================================================================

import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { MSG } from '../../types/api-message.types';

import type { User } from '../APIs/apis.service';

import type {
  ISODateString,
  TeamDomain,
  TeamManagementDto,
  TeamMemberDto,
  UserTeams,
  AssignedTaskDto,
  CompletionSignerRole,
  WorkItem,
  WorkItemStatus,
  WorkItemPriority,
  AddTaskCommentRequestDto,
  TaskEvidenceDto,
} from './team-management.types';

@Injectable( { providedIn: 'root' } )
export class TeamManagementService {
  // ----------------------------------------------------------------------------
  // API roots (simple, explicit)
  // ----------------------------------------------------------------------------
  private readonly apiRoot: string;
  private readonly teamRoot: string;
  private readonly taskRoot: string;
  private readonly teamKpiRoot: string;
  private readonly workItemRoot: string;
  private readonly workEventRoot: string;

  private readonly isBrowser: boolean;

  public constructor (
    private readonly http: HttpClient,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
  ) {
    const root: string = ( environment.apiOrigin ?? 'http://localhost:3000' ).replace( /\/+$/, '' );
    this.apiRoot = root;

    this.teamRoot = `${ this.apiRoot }/api-team-management`;
    this.taskRoot = `${ this.teamRoot }/task`;
    this.teamKpiRoot = `${ this.teamRoot }/kpi`;

    this.workItemRoot = `${ this.apiRoot }/api-work-item`;
    this.workEventRoot = `${ this.apiRoot }/api-work-event`;

    this.isBrowser = isPlatformBrowser( this.platformId );
  }

  // ============================================================================
  // Core helpers (simple + readable)
  // ============================================================================

  private requireNonEmpty( label: string, value: string ): string {
    const safe: string = String( value ?? '' ).trim();
    if ( !safe ) throw new Error( `${ label } is required` );
    return safe;
  }

  private buildParams(
    record: Record<string, string | number | boolean | undefined | null>,
  ): HttpParams {
    let params = new HttpParams();

    Object.entries( record ).forEach( ( [ key, value ] ) => {
      if ( value !== undefined && value !== null ) {
        params = params.set( key, String( value ) );
      }
    } );

    return params;
  }

  private buildUrl( base: string, ...segments: Array<string | number> ): string {
    if ( !segments.length ) return base;
    const tail: string = segments.map( ( s ) => encodeURIComponent( String( s ) ) ).join( '/' );
    return `${ base }/${ tail }`;
  }

  private normalizeToMSG( raw: unknown ): MSG {
    const r = raw as {
      success?: boolean;
      status?: string;
      message?: string;
      data?: unknown;
    };

    // If backend already returns MSG-like envelope, keep it.
    if ( r && typeof r === 'object' && typeof r.message === 'string' ) {
      return {
        success: r.success ?? false,
        status: String( r.status ?? 'error' ).toLowerCase() === 'success' ? 'success' : 'error',
        message: r.message,
        data: ( r.data ?? null ) as any,
      };
    }

    // Otherwise wrap as "OK"
    return { success: true, status: 'success', message: 'OK', data: raw as any };
  }

  private mapError( error: unknown ): MSG {
    if ( typeof error === 'string' ) {
      return { success: false, status: 'error', message: error, data: null };
    }

    if ( error && typeof error === 'object' ) {
      const anyE = error as { error?: any; message?: string; };

      const beMessage = anyE?.error?.message;
      if ( typeof beMessage === 'string' && beMessage.trim() ) {
        return { success: false, status: 'error', message: beMessage, data: anyE.error };
      }

      if ( typeof anyE?.message === 'string' && anyE.message.trim() ) {
        return { success: false, status: 'error', message: anyE.message, data: null };
      }
    }

    return { success: false, status: 'error', message: 'Unexpected error', data: error as any };
  }

  /**
   * Single HTTP gateway:
   * - keeps all methods tiny and consistent
   * - future changes (headers, options, etc.) are in ONE place
   */
  private async request(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
    params?: HttpParams,
  ): Promise<MSG> {
    try {
      let raw: unknown;

      if ( method === 'GET' ) {
        raw = await firstValueFrom( this.http.get( url, { params } ) );
      } else if ( method === 'POST' ) {
        raw = await firstValueFrom( this.http.post( url, body ?? {}, { params } ) );
      } else if ( method === 'PATCH' ) {
        raw = await firstValueFrom( this.http.patch( url, body ?? {}, { params } ) );
      } else {
        raw = await firstValueFrom( this.http.delete( url, { params } ) );
      }

      return this.normalizeToMSG( raw );
    } catch ( e ) {
      return this.mapError( e );
    }
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
    const p = this.buildParams( { index, limit, search, domain, isActive } );
    const url = this.buildUrl( this.teamRoot, 'all' );
    return this.request( 'GET', url, undefined, p );
  }

  public async getTeamById( teamId: string ): Promise<MSG> {
    const id = this.requireNonEmpty( 'Team ID', teamId );
    const url = this.buildUrl( this.teamRoot, id );
    return this.request( 'GET', url );
  }

  public async getTeamByName( teamName: string ): Promise<MSG> {
    const name = this.requireNonEmpty( 'Team name', teamName );
    const url = this.buildUrl( this.teamRoot, 'teamName', name );
    return this.request( 'GET', url );
  }

  public async createTeam( body: unknown ): Promise<MSG> {
    const url = this.buildUrl( this.teamRoot, 'create' );
    return this.request( 'POST', url, body );
  }

  public async updateTeam(
    teamId: string,
    payload: FormData | Partial<TeamManagementDto>,
  ): Promise<MSG> {
    const id = this.requireNonEmpty( 'Team ID', teamId );
    const url = this.buildUrl( this.teamRoot, 'update', id );
    return this.request( 'PATCH', url, payload );
  }

  public async deleteTeam( teamId: string, soft: boolean = true ): Promise<MSG> {
    const id = this.requireNonEmpty( 'Team ID', teamId );
    const p = this.buildParams( { soft } );
    const url = this.buildUrl( this.teamRoot, 'delete', id );
    return this.request( 'DELETE', url, undefined, p );
  }

  // ============================================================================
  // Tasks & evidence
  // ============================================================================

  public async assignTask( teamId: string, body: { task: AssignedTaskDto; } | unknown ): Promise<MSG> {
    const id = this.requireNonEmpty( 'Team ID', teamId );
    const url = this.buildUrl( this.taskRoot, 'assign-task', id );
    return this.request( 'POST', url, body );
  }

  public async getAllTasksForTeam( teamId: string ): Promise<MSG> {
    const id = this.requireNonEmpty( 'Team ID', teamId );
    const url = this.buildUrl( this.taskRoot, 'get-tasks', id );
    return this.request( 'GET', url );
  }

  /**
   * Attach evidence metadata to an existing task.
   * Backend:
   *   POST /api-team-management/task/evidence/attach/:teamId/:taskId
   */
  public async attachEvidenceMeta( teamId: string, taskId: string, payload: unknown ): Promise<MSG> {
    const tId = this.requireNonEmpty( 'Team ID', teamId );
    const kId = this.requireNonEmpty( 'Task ID', taskId );

    const url = this.buildUrl( this.taskRoot, 'evidence', 'attach', tId, kId );
    return this.request( 'POST', url, payload ?? {} );
  }

  /**
   * Upload evidence files for a team task.
   * Backend:
   *   POST /api-team-management/task/upload/evidence/:teamId/:taskId
   */
  public async uploadTaskEvidence( teamId: string, taskId: string, formData: FormData ): Promise<MSG> {
    if ( !this.isBrowser ) {
      return {
        success: false,
        status: 'error',
        message: 'Evidence upload is only supported in browser environment',
        data: null,
      };
    }

    const tId = this.requireNonEmpty( 'Team ID', teamId );
    const kId = this.requireNonEmpty( 'Task ID', taskId );

    const url = this.buildUrl( this.taskRoot, 'upload', 'evidence', tId, kId );
    return this.request( 'POST', url, formData );
  }

  // ============================================================================
  // Completion confirmation flow
  // ============================================================================

  public async markTaskCompleted(
    teamId: string,
    taskId: string,
    payload?: { completedAt?: ISODateString; notes?: string; } | unknown,
  ): Promise<MSG> {
    const tId = this.requireNonEmpty( 'Team ID', teamId );
    const kId = this.requireNonEmpty( 'Task ID', taskId );

    const url = this.buildUrl( this.taskRoot, 'mark-completed', tId, kId );
    return this.request( 'POST', url, payload ?? {} );
  }

  public async submitCompletionSignatureMultipart(
    teamId: string,
    taskId: string,
    input: {
      role: CompletionSignerRole;
      signatureFile: File;

      signerName?: string;
      signerUserId?: string;
      signerUsername?: string;
      comment?: string;
    },
  ): Promise<MSG> {
    if ( !this.isBrowser ) {
      return {
        success: false,
        status: 'error',
        message: 'Signature upload is only supported in browser environment',
        data: null,
      };
    }

    const tId = this.requireNonEmpty( 'Team ID', teamId );
    const kId = this.requireNonEmpty( 'Task ID', taskId );

    const fd = new FormData();
    fd.append( 'role', String( input.role ) );
    if ( input.signerName ) fd.append( 'signerName', String( input.signerName ) );
    if ( input.signerUserId ) fd.append( 'signerUserId', String( input.signerUserId ) );
    if ( input.signerUsername ) fd.append( 'signerUsername', String( input.signerUsername ) );
    if ( input.comment ) fd.append( 'comment', String( input.comment ) );
    fd.append( 'signature', input.signatureFile, input.signatureFile.name );

    const url = this.buildUrl( this.taskRoot, 'completion-signature', tId, kId );
    return this.request( 'POST', url, fd );
  }

  public async submitCompletionSignatureBase64(
    teamId: string,
    taskId: string,
    body: {
      role: CompletionSignerRole;
      signatureBase64: string;
      signerName?: string;
      signerUserId?: string;
      signerUsername?: string;
      comment?: string;
      signedAt?: ISODateString;
    } | unknown,
  ): Promise<MSG> {
    const tId = this.requireNonEmpty( 'Team ID', teamId );
    const kId = this.requireNonEmpty( 'Task ID', taskId );

    const url = this.buildUrl( this.taskRoot, 'completion-signature', tId, kId );
    return this.request( 'POST', url, body );
  }

  public async approveTaskCompletion(
    teamId: string,
    taskId: string,
    body?: { comment?: string; } | unknown,
  ): Promise<MSG> {
    const tId = this.requireNonEmpty( 'Team ID', teamId );
    const kId = this.requireNonEmpty( 'Task ID', taskId );

    const url = this.buildUrl( this.taskRoot, 'approve-completion', tId, kId );
    return this.request( 'POST', url, body ?? {} );
  }

  public async rejectTaskCompletion(
    teamId: string,
    taskId: string,
    body: { reason: string; comment?: string; } | unknown,
  ): Promise<MSG> {
    const tId = this.requireNonEmpty( 'Team ID', teamId );
    const kId = this.requireNonEmpty( 'Task ID', taskId );

    const url = this.buildUrl( this.taskRoot, 'reject-completion', tId, kId );
    return this.request( 'POST', url, body );
  }

  // ============================================================================
  // Upload endpoints (browser-only FormData)
  // ============================================================================

  public async uploadTeamLogo( teamId: string, formData: FormData ): Promise<MSG> {
    if ( !this.isBrowser ) {
      return {
        success: false,
        status: 'error',
        message: 'Logo upload is only supported in browser environment',
        data: null,
      };
    }

    const id = this.requireNonEmpty( 'Team ID', teamId );
    const url = this.buildUrl( this.teamRoot, 'upload', 'logo', id );
    return this.request( 'POST', url, formData );
  }

  // ============================================================================
  // Stats
  // ============================================================================

  public async getTeamTotals(): Promise<MSG> {
    const url = this.buildUrl( this.teamRoot, 'stats', 'teams-total' );
    return this.request( 'GET', url );
  }

  public async getTeamTotalsByDomain( domain: TeamDomain, active?: boolean ): Promise<MSG> {
    const d = this.requireNonEmpty( 'Domain', domain );
    const p = this.buildParams( { active } );
    const url = this.buildUrl( this.teamRoot, 'stats', 'teams-total', 'domain', d );
    return this.request( 'GET', url, undefined, p );
  }

  // ============================================================================
  // Users analytics
  // ============================================================================

  public async getUsersWithoutAnyTeam( index: number = 0, limit: number = 10 ): Promise<MSG> {
    const p = this.buildParams( { index, limit } );
    const url = this.buildUrl( this.teamRoot, 'users', 'no-team' );
    return this.request( 'GET', url, undefined, p );
  }

  public async getUsersWithoutAnyTeamCount(): Promise<MSG> {
    const url = this.buildUrl( this.teamRoot, 'users', 'no-team', 'count' );
    return this.request( 'GET', url );
  }

  public async getUsersInAnyTeam( index: number = 0, limit: number = 10 ): Promise<MSG> {
    const p = this.buildParams( { index, limit } );
    const url = this.buildUrl( this.teamRoot, 'users', 'in-teams' );
    return this.request( 'GET', url, undefined, p );
  }

  public async getUsersInAnyTeamCount(): Promise<MSG> {
    const url = this.buildUrl( this.teamRoot, 'users', 'in-teams', 'count' );
    return this.request( 'GET', url );
  }

  public async getUsersWithoutTeamByDomain(
    domain: TeamDomain,
    index: number = 0,
    limit: number = 10,
  ): Promise<MSG> {
    const d = this.requireNonEmpty( 'Domain', domain );
    const p = this.buildParams( { index, limit } );
    const url = this.buildUrl( this.teamRoot, 'users', 'no-team', 'domain', d );
    return this.request( 'GET', url, undefined, p );
  }

  public async getUsersWithoutTeamByDomainCount( domain: TeamDomain ): Promise<MSG> {
    const d = this.requireNonEmpty( 'Domain', domain );
    const url = this.buildUrl( this.teamRoot, 'users', 'no-team', 'domain', d, 'count' );
    return this.request( 'GET', url );
  }

  public async getUsersInTeamByDomain(
    domain: TeamDomain,
    index: number = 0,
    limit: number = 10,
  ): Promise<MSG> {
    const d = this.requireNonEmpty( 'Domain', domain );
    const p = this.buildParams( { index, limit } );
    const url = this.buildUrl( this.teamRoot, 'users', 'in-teams', 'domain', d );
    return this.request( 'GET', url, undefined, p );
  }

  public async getUsersInTeamByDomainCount( domain: TeamDomain ): Promise<MSG> {
    const d = this.requireNonEmpty( 'Domain', domain );
    const url = this.buildUrl( this.teamRoot, 'users', 'in-teams', 'domain', d, 'count' );
    return this.request( 'GET', url );
  }

  /**
   * GET /users/all
   * Ensures data.other.users becomes TeamMemberDto[] even if backend returns a different nesting.
   */
  public async getAllUsersWithTeams( index: number, limit: number, search?: string ): Promise<MSG> {
    try {
      const p = this.buildParams( { index, limit, search } );
      const url = this.buildUrl( this.teamRoot, 'users', 'all' );

      const base = await this.request( 'GET', url, undefined, p );

      const anyData = base.data as any;
      const maybeUsers =
        anyData?.other?.users ??
        anyData?.users ??
        anyData?.data?.other?.users ??
        [];

      const users = this.normalizeUsersWithTeams( maybeUsers );

      return {
        ...base,
        data: {
          ...( anyData ?? {} ),
          other: {
            ...( anyData?.other ?? {} ),
            users,
          },
        },
      };
    } catch ( e ) {
      return this.mapError( e );
    }
  }

  private normalizeUsersWithTeams( input: unknown ): TeamMemberDto[] {
    if ( !Array.isArray( input ) ) return [];

    return input.map( ( u: any ) => {
      const teamsArr = Array.isArray( u?.teams ) ? u.teams : [];

      const teams: UserTeams[] = teamsArr
        .map( ( t: any ) => ( {
          teamName: String( t?.teamName ?? '' ).trim(),
          domain: String( t?.domain ?? '' ).trim().toLowerCase() as any,
        } ) )
        .filter( ( t: UserTeams ) => !!t.teamName && !!t.domain );

      const out: TeamMemberDto = {
        ...( u as User ),
        id: String( u?.id ?? u?._id ?? '' ),
        username: String( u?.username ?? '' ),
        teams,
      } as TeamMemberDto;

      return out;
    } );
  }

  // ============================================================================
  // Team KPI (READ-ONLY REST snapshots)
  // Mounted: /api-team-management/kpi
  // ============================================================================

  public async getKpiTaskCompletionRate(
    scope: 'member' | 'team' | 'org',
    targetId: string,
    fromISO: string,
    toISO: string,
  ): Promise<MSG> {
    const p = this.buildParams( {
      scope: this.requireNonEmpty( 'Scope', scope ),
      targetId: this.requireNonEmpty( 'Target ID', targetId ),
      from: this.requireNonEmpty( 'From', fromISO ),
      to: this.requireNonEmpty( 'To', toISO ),
    } );

    const url = this.buildUrl( this.teamKpiRoot, 'task-completion-rate' );
    return this.request( 'GET', url, undefined, p );
  }

  public async getKpiTaskCompletionRateByTeam(
    orgId: string,
    fromISO: string,
    toISO: string,
  ): Promise<MSG> {
    const p = this.buildParams( {
      orgId: this.requireNonEmpty( 'Org ID', orgId ),
      from: this.requireNonEmpty( 'From', fromISO ),
      to: this.requireNonEmpty( 'To', toISO ),
    } );

    const url = this.buildUrl( this.teamKpiRoot, 'task-completion-rate', 'by-team' );
    return this.request( 'GET', url, undefined, p );
  }

  public async getKpiCustomerSatisfaction(
    scope: 'member' | 'team' | 'org',
    targetId: string,
    fromISO: string,
    toISO: string,
  ): Promise<MSG> {
    const p = this.buildParams( {
      scope: this.requireNonEmpty( 'Scope', scope ),
      targetId: this.requireNonEmpty( 'Target ID', targetId ),
      from: this.requireNonEmpty( 'From', fromISO ),
      to: this.requireNonEmpty( 'To', toISO ),
    } );

    const url = this.buildUrl( this.teamKpiRoot, 'customer-satisfaction' );
    return this.request( 'GET', url, undefined, p );
  }

  public async getKpiTopOverdueHolders(
    scope: 'team' | 'org',
    targetId: string,
    fromISO: string,
    toISO: string,
    top: number = 10,
  ): Promise<MSG> {
    const safeTop: number = Number.isFinite( top ) ? Math.max( 1, Math.min( 50, top ) ) : 10;

    const p = this.buildParams( {
      scope: this.requireNonEmpty( 'Scope', scope ),
      targetId: this.requireNonEmpty( 'Target ID', targetId ),
      from: this.requireNonEmpty( 'From', fromISO ),
      to: this.requireNonEmpty( 'To', toISO ),
      top: safeTop,
    } );

    const url = this.buildUrl( this.teamKpiRoot, 'top-overdue-holders' );
    return this.request( 'GET', url, undefined, p );
  }

  /**
   * Member Performance Profile (Aggregated)
   * Backend:
   *   GET /api-team-management/kpi/member-profile?memberId=...&from=...&to=...
   */
  public async getMemberPerformanceProfile(
    memberId: string,
    fromISO: string,
    toISO: string,
    bucket: 'day' | 'week' | 'month' = 'month',
    recentLimit: number = 50,
  ): Promise<MSG> {
    const safeRecent: number = Number.isFinite( recentLimit ) ? Math.max( 1, Math.min( 200, recentLimit ) ) : 50;

    const p = this.buildParams( {
      memberId: this.requireNonEmpty( 'Member ID', memberId ),
      from: this.requireNonEmpty( 'From', fromISO ),
      to: this.requireNonEmpty( 'To', toISO ),
      bucket: String( bucket ?? 'month' ).trim(),
      recentLimit: safeRecent,
    } );

    const url = this.buildUrl( this.teamKpiRoot, 'member-profile' );
    return this.request( 'GET', url, undefined, p );
  }

  // ============================================================================
  // Work Items (/api-work-item)
  // ============================================================================

  public async createWorkItem( payload: Partial<WorkItem> | unknown ): Promise<MSG> {
    const url = this.buildUrl( this.workItemRoot, 'create' );
    return this.request( 'POST', url, payload ?? {} );
  }

  public async getWorkItemById( workItemId: string ): Promise<MSG> {
    const id = this.requireNonEmpty( 'WorkItem ID', workItemId );
    const url = this.buildUrl( this.workItemRoot, id );
    return this.request( 'GET', url );
  }

  public async getWorkItemsAll( index: number = 0, limit: number = 50, search?: string ): Promise<MSG> {
    const p = this.buildParams( { index, limit, search } );
    const url = this.buildUrl( this.workItemRoot, 'all' );
    return this.request( 'GET', url, undefined, p );
  }

  public async updateWorkItem( workItemId: string, payload: Partial<WorkItem> | unknown ): Promise<MSG> {
    const id = this.requireNonEmpty( 'WorkItem ID', workItemId );
    const url = this.buildUrl( this.workItemRoot, 'update', id );
    return this.request( 'PATCH', url, payload ?? {} );
  }

  public async updateWorkItemStatus( workItemId: string, status: WorkItemStatus ): Promise<MSG> {
    const id = this.requireNonEmpty( 'WorkItem ID', workItemId );
    const s = this.requireNonEmpty( 'Status', status );
    const url = this.buildUrl( this.workItemRoot, 'status', id );
    return this.request( 'PATCH', url, { status: s } );
  }

  public async updateWorkItemPriority( workItemId: string, priority: WorkItemPriority ): Promise<MSG> {
    const id = this.requireNonEmpty( 'WorkItem ID', workItemId );
    const p = this.requireNonEmpty( 'Priority', priority );
    const url = this.buildUrl( this.workItemRoot, 'priority', id );
    return this.request( 'PATCH', url, { priority: p } );
  }

  public async updateWorkItemValue(
    workItemId: string,
    payload: { expectedValue?: number; actualValue?: number; } | unknown,
  ): Promise<MSG> {
    const id = this.requireNonEmpty( 'WorkItem ID', workItemId );
    const url = this.buildUrl( this.workItemRoot, 'value', id );
    return this.request( 'PATCH', url, payload ?? {} );
  }

  public async moveWorkItem(
    workItemId: string,
    payload: { toStatus: WorkItemStatus; toTeamId?: string; } | unknown,
  ): Promise<MSG> {
    const id = this.requireNonEmpty( 'WorkItem ID', workItemId );
    const url = this.buildUrl( this.workItemRoot, 'move', id );
    return this.request( 'PATCH', url, payload ?? {} );
  }

  // ============================================================================
  // Work events (/api-work-event)
  // ============================================================================

  public async getWorkEventsAll( index: number = 0, limit: number = 50 ): Promise<MSG> {
    const p = this.buildParams( { index, limit } );
    const url = this.buildUrl( this.workEventRoot, 'all' );
    return this.request( 'GET', url, undefined, p );
  }

  public async getWorkEventsByWorkItem( workItemId: string, index: number = 0, limit: number = 50 ): Promise<MSG> {
    const id = this.requireNonEmpty( 'WorkItem ID', workItemId );
    const p = this.buildParams( { index, limit } );
    const url = this.buildUrl( this.workEventRoot, 'by-workitem', id );
    return this.request( 'GET', url, undefined, p );
  }

  public async getWorkEventsByTeam( teamId: string, index: number = 0, limit: number = 50 ): Promise<MSG> {
    const id = this.requireNonEmpty( 'Team ID', teamId );
    const p = this.buildParams( { index, limit } );
    const url = this.buildUrl( this.workEventRoot, 'by-team', id );
    return this.request( 'GET', url, undefined, p );
  }

  public async getWorkEventsStatsByWorkItem( workItemId: string ): Promise<MSG> {
    const id = this.requireNonEmpty( 'WorkItem ID', workItemId );
    const url = this.buildUrl( this.workEventRoot, 'stats', 'workitem', id );
    return this.request( 'GET', url );
  }

  // ============================================================================
  // Benchmark snapshot
  // ============================================================================

  public async getTeamsSnapshotForBenchmark(): Promise<MSG> {
    const url = this.buildUrl( this.teamRoot, 'benchmark-snapshot' );
    return this.request( 'GET', url );
  }
}
