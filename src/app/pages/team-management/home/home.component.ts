// Path: src/app/pages/team-management/home/home.component.ts

import { Component, ViewChild, OnInit, type OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';

import { HttpErrorResponse } from '@angular/common/http';

// Services
import type { TeamDomain, TeamManagementDto, TaskStatus } from '../../../services/teamManagementService/team-management.service';
import { DEFAULT_TEAM_DOMAINS, TeamManagementService } from '../../../services/teamManagementService/team-management.service';
import { APIsService } from '../../../services/APIs/apis.service';
import { PaginationUtil } from '../../../source/utility/pagination.utils';

// Charts
import { GoogleChartsModule } from 'angular-google-charts';
import { ChartService, ChartBuild, PieEntry, SeriesEntry } from '../../../services/chartService/chart-service';

// Components
import {
  CustomTableComponent,
  TableColumn,
  TableUiButton,
  TableUiButtonClickConfig,
} from '../../../components/shared/custom-table/custom-table.component';
import { NotificationDialogComponent } from '../../../components/dialogs/notificationBar/notificationBar.component';

interface AllTeamData {
  teamLogo: string;
  teamId: string;
  teamName: string;
  teamTotal: number;

  captainImage: string;
  captainName: string;

  domain: TeamDomain;
  assignedTasks: number;
  completedTasks: number;
}

type ExecutiveKpiCard = Readonly<{
  key: string;
  title: string;
  value: string;
  hint: string;
  tone: 'ok' | 'warn' | 'danger' | 'muted';
}>;

type DomainPerfRow = Readonly<{
  domain: TeamDomain;
  teams: number;
  assigned: number;
  completed: number;
  pending: number;
  completionRate: number; // 0..100
  topTeamName: string;
  topTeamCompleted: number;
  topMemberName: string;
  topMemberCompleted: number;
}>;

@Component( {
  selector: 'app-team-management-home',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatTooltipModule,
    NotificationDialogComponent,
    CustomTableComponent,
    GoogleChartsModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
} )
export class HomeComponent implements OnInit, OnDestroy {

  @ViewChild( NotificationDialogComponent, { static: true } )
  public notificationDialog!: NotificationDialogComponent;

  // ─────────────────────────────────────────────────────────────
  // Table state (private backing fields)
  // ─────────────────────────────────────────────────────────────
  private _allTeamIsLoading: boolean = false;
  private _allTeamIndex: number = 0;
  private _allTeamLimit: number = 5;
  private _allTeamSearch: string = '';

  private _allTeamLoadInFlight: boolean = false;

  // ─────────────────────────────────────────────────────────────
  // Public UI bindings
  // ─────────────────────────────────────────────────────────────
  protected allTeamTableTitle: string = 'All teams';
  protected allTeamTotal: number = 0;

  private readonly allTeamActionButtons: ReadonlyArray<TableUiButton> = [
    { id: 'team.assignTask', iconKey: 'task.assign', label: 'Assign Task', tooltip: 'Assign Task', tone: 'good' },
    { id: 'team.view', iconKey: 'view', label: 'View', tooltip: 'View Team', tone: 'normal' },
    { id: 'team.edit', iconKey: 'edit', label: 'Edit', tooltip: 'Edit Team', tone: 'normal' },
  ] as const;

  protected allTeamTableColumns: TableColumn[] = [
    { key: 'teamLogo', label: 'Team Logo' },
    { key: 'teamId', label: 'Team ID' },
    { key: 'teamName', label: 'Team Name' },
    { key: 'teamTotal', label: 'Team Total' },
    { key: 'captainImage', label: 'Captain' },
    { key: 'captainName', label: 'Captain Name' },
    { key: 'domain', label: 'Team Domain' },
    { key: 'assignedTasks', label: 'Total Assigned Tasks' },
    { key: 'completedTasks', label: 'Total Completed Tasks' },
    {
      key: 'assignTaskAction',
      label: 'Assign Task',
      render: 'multipleActions',
      multipleActions: [ this.allTeamActionButtons[ 0 ] ],
    },
    {
      key: 'viewTeamAction',
      label: 'View Team',
      render: 'multipleActions',
      multipleActions: [ this.allTeamActionButtons[ 1 ] ],
    },
    {
      key: 'editTeamAction',
      label: 'Edit Team',
      render: 'multipleActions',
      multipleActions: [ this.allTeamActionButtons[ 2 ] ],
    },
  ];

  protected allTeamTableData: AllTeamData[] = [];

  // ─────────────────────────────────────────────────────────────
  // EXECUTIVE DASHBOARD STATE (NEW)
  // ─────────────────────────────────────────────────────────────
  protected executiveKpis: ExecutiveKpiCard[] = [];
  protected domainPerformance: DomainPerfRow[] = [];

  // charts (GoogleCharts via ChartService)
  protected domainCompletionChart: ChartBuild | null = null; // column: Completed/Pending per domain
  protected domainRateChart: ChartBuild | null = null;       // column: completion rate per domain
  protected topTeamsChart: ChartBuild | null = null;         // bar: top teams overall by completed

  // top lists (for quick cards)
  protected topTeamsOverall: Array<{ teamName: string; domain: TeamDomain; completed: number; assigned: number; }> = [];
  protected bestDomain: TeamDomain | null = null;

  // ─────────────────────────────────────────────────────────────
  // Getters / setters (paginator bindings)
  // ─────────────────────────────────────────────────────────────

  public get allTeamIsLoading(): boolean {
    return this._allTeamIsLoading;
  }

  public set allTeamIsLoading( value: boolean ) {
    const next = !!value;
    const isRisingEdge = !this._allTeamIsLoading && next;

    this._allTeamIsLoading = next;

    if ( !isRisingEdge ) return;

    if ( this._allTeamLoadInFlight ) return;
    this._allTeamLoadInFlight = true;

    void this.allTeamLoadInit( this._allTeamIndex, this._allTeamLimit, this._allTeamSearch )
      .finally( () => {
        this._allTeamLoadInFlight = false;
        this._allTeamIsLoading = false;
      } );
  }

  public get allTeamIndex(): number {
    return this._allTeamIndex;
  }
  public set allTeamIndex( value: number ) {
    this._allTeamIndex = value;
    void this.allTeamLoadInit( this._allTeamIndex, this._allTeamLimit, this._allTeamSearch );
  }

  public get allTeamLimit(): number {
    return this._allTeamLimit;
  }
  public set allTeamLimit( value: number ) {
    this._allTeamLimit = value;
    void this.allTeamLoadInit( this._allTeamIndex, this._allTeamLimit, this._allTeamSearch );
  }

  public get allTeamSearch(): string {
    return this._allTeamSearch;
  }
  public set allTeamSearch( value: string ) {
    this._allTeamSearch = String( value ?? '' ).trim();
    void this.allTeamLoadInit( this._allTeamIndex, this._allTeamLimit, this._allTeamSearch );
  }

  // ✅ DO NOT CHANGE YOUR CONSTRUCTOR — keep as-is.
  public constructor (
    private readonly router: Router,
    private readonly teamService: TeamManagementService,
    private readonly apiService: APIsService,
    private readonly chartService: ChartService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────
  public async ngOnInit(): Promise<void> {
    await this.allTeamLoadInit( this._allTeamIndex, this._allTeamLimit, this._allTeamSearch );
  }

  public ngOnDestroy(): void {
    // reserved
  }

  // ─────────────────────────────────────────────────────────────
  // UI actions
  // ─────────────────────────────────────────────────────────────
  protected async createTeamRouter(): Promise<boolean> {
    return await this.router.navigate( [ '/dashboard/team-management/create' ] );
  }

  protected async allTeamActionButtonCentra( value: TableUiButtonClickConfig ): Promise<void> {
    try {
      if ( !value ) throw new Error( 'Invalid button event data!' );

      const id = String( value.id ?? '' ).trim();
      const teamID = String( value.row?.teamId ?? '' ).trim(); // teamId = teamCode
      if ( !teamID ) throw new Error( 'Invalid team ID!' );

      switch ( id ) {
        case 'team.assignTask':
          await this.router.navigate( [ '/dashboard/team-management/asign-task', teamID ] );
          return;

        case 'team.view':
          await this.router.navigate( [ '/dashboard/team-management/view', teamID ] );
          return;

        case 'team.edit':
          await this.router.navigate( [ '/dashboard/team-management/edit', teamID ] );
          return;

        default:
          return;
      }
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [TeamHome] action handler failed.\n', error );
    }
  }

  protected async fetchAllTeamTableData(): Promise<void> {
    await this.allTeamLoadInit( this._allTeamIndex, this._allTeamLimit, this._allTeamSearch );
  }

  // ─────────────────────────────────────────────────────────────
  // Data loading
  // ─────────────────────────────────────────────────────────────
  private async allTeamLoadInit( index: number, limit: number, search?: string ): Promise<void> {
    try {
      this._allTeamIsLoading = true;

      // Reset UI states
      this.allTeamTableData = [];
      this.executiveKpis = [];
      this.domainPerformance = [];
      this.domainCompletionChart = null;
      this.domainRateChart = null;
      this.topTeamsChart = null;
      this.topTeamsOverall = [];
      this.bestDomain = null;

      // 1) Totals
      const totalRes = await this.teamService.getTeamTotals();
      if ( !totalRes.success ) throw new Error( totalRes.message ?? 'Failed to fetch total number of teams!' );

      const rawTotal = this.apiService.extractNumberFromOther( totalRes.data, 'totalTeams' );
      if ( rawTotal === null || rawTotal === undefined ) throw new Error( 'Invalid total number of teams!' );
      if ( !Number.isFinite( rawTotal ) || !Number.isInteger( rawTotal ) || rawTotal < 0 ) {
        throw new Error( 'Invalid data format of total number of teams!' );
      }

      const totalItems = rawTotal;
      this.allTeamTotal = totalItems;

      // 2) Pagination safety (table)
      const safeLimit = PaginationUtil.safeLimit( limit, totalItems );
      const totalPages = Math.max( 1, Math.ceil( totalItems / safeLimit ) );
      const safeIndex = PaginationUtil.safeIndex( index, totalPages );

      const safeSearch = typeof search === 'string' && search.trim() ? search.trim() : undefined;

      // 3) Fetch teams (table page)
      const res = await this.teamService.getTeams( safeIndex, safeLimit, safeSearch );
      if ( !res.success ) throw new Error( res.message ?? 'Failed to fetch team data!' );

      const rawTeamsPage = this.pickTeamsArray( res.data );
      if ( !Array.isArray( rawTeamsPage ) ) throw new Error( 'Invalid array of team data!' );

      // Build table rows from page
      const tableData: AllTeamData[] = [];
      for ( const team of rawTeamsPage ) {
        try {
          tableData.push( this.buildAllTeamTableRow( team ) );
        } catch ( rowErr ) {
          // eslint-disable-next-line no-console
          console.warn( '[Warning:] [TeamHome] Skipping invalid team row.\n', rowErr );
        }
      }
      this.allTeamTableData = [ ...tableData ];

      // ✅ 4) Fetch ALL teams for EXECUTIVE analytics (real backend data)
      // If totalTeams is huge later, you can switch to a backend analytics endpoint.
      const analyticsTeams = await this.fetchAllTeamsForAnalytics( totalItems, safeSearch );

      // 5) Compute executive KPIs + charts from real data
      this.buildExecutiveDashboard( analyticsTeams );

      return;

    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [TeamHome] Failed to load teams.\n', error );

      let message = 'Unexpected error occured!';
      if ( error instanceof HttpErrorResponse ) {
        message = error.error?.message ?? message;
      } else if ( error instanceof Error ) {
        message = error.message;
      }

      this.notificationDialog.notification( 'error', message );
      return;

    } finally {
      setTimeout( () => {
        this._allTeamIsLoading = false;
      }, 250 );
    }
  }

  private async fetchAllTeamsForAnalytics( totalItems: number, search?: string ): Promise<TeamManagementDto[]> {
    if ( totalItems <= 0 ) return [];

    // Fetch everything in one shot (real backend call)
    const res = await this.teamService.getTeams( 0, totalItems, search );
    if ( !res?.success ) return [];

    const all = this.pickTeamsArray( res.data );
    return Array.isArray( all ) ? all : [];
  }

  private pickTeamsArray( data: any ): TeamManagementDto[] {
    const d = data as any;
    return (
      d?.other?.teams ??
      d?.teams ??
      d?.system?.teams ??
      d?.other?.data?.teams ??
      []
    ) as TeamManagementDto[];
  }

  private buildAllTeamTableRow( data: TeamManagementDto ): AllTeamData {
    const teamLogo: string = String( data.teamLogo?.url ?? '' ).trim() || '';

    const teamId: string = String( data.teamCode ?? '' ).trim();
    if ( !teamId ) throw new Error( 'Invalid team id!' );

    const teamName: string = String( data.teamName ?? '' ).trim();
    if ( !teamName ) throw new Error( 'Invalid team name!' );

    const teamTotal: number = Number( data.memberTotal );
    if ( !Number.isFinite( teamTotal ) || !Number.isInteger( teamTotal ) || teamTotal < 0 ) {
      throw new Error( 'Invalid total number of members!' );
    }

    const captainImage: string = String( ( data.captain as any )?.user?.image ?? '' ).trim() || '';
    const captainName: string =
      String( ( data.captain as any )?.user?.name ?? '' ).trim() ||
      String( data.captain?.username ?? '' ).trim();

    if ( !captainName ) throw new Error( 'Invalid captain name!' );

    const domain: TeamDomain = data.domain as TeamDomain;
    if ( !domain || !DEFAULT_TEAM_DOMAINS.includes( domain ) ) {
      throw new Error( 'Invalid team domain!' );
    }

    const taskArray = Array.isArray( data.assignTasks ) ? data.assignTasks : [];
    const assignedTasks: number = taskArray.length;

    const completedTasks: number = taskArray.reduce( ( total: number, task ) => {
      const st = String( ( task as any )?.status ?? '' ).toLowerCase() as TaskStatus;
      return st === 'completed' ? total + 1 : total;
    }, 0 );

    return {
      teamLogo,
      teamId,
      teamName,
      teamTotal,
      captainImage,
      captainName,
      domain,
      assignedTasks,
      completedTasks,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // EXECUTIVE DASHBOARD (REAL DATA AGGREGATION)
  // ─────────────────────────────────────────────────────────────
  private buildExecutiveDashboard( allTeams: TeamManagementDto[] ): void {
    const domainAgg = this.initDomainAgg();

    // For "top team overall"
    const topTeams: Array<{ teamName: string; domain: TeamDomain; completed: number; assigned: number; }> = [];

    for ( const t of allTeams ) {
      const domain: TeamDomain = ( t.domain as TeamDomain );
      if ( !domain || !DEFAULT_TEAM_DOMAINS.includes( domain ) ) continue;

      const tasks = Array.isArray( t.assignTasks ) ? t.assignTasks : [];
      const assigned = tasks.length;
      const completed = tasks.reduce( ( sum: number, x: any ) => {
        const st = String( x?.status ?? '' ).toLowerCase();
        return st === 'completed' ? sum + 1 : sum;
      }, 0 );

      domainAgg[ domain ].teams += 1;
      domainAgg[ domain ].assigned += assigned;
      domainAgg[ domain ].completed += completed;

      topTeams.push( {
        teamName: String( t.teamName ?? 'Unknown' ).trim() || 'Unknown',
        domain,
        completed,
        assigned,
      } );

      // Domain top team
      if ( completed > domainAgg[ domain ].topTeamCompleted ) {
        domainAgg[ domain ].topTeamCompleted = completed;
        domainAgg[ domain ].topTeamName = String( t.teamName ?? '' ).trim() || 'Unknown';
      }

      // Domain top performer (member) from tasks
      // We count completed tasks per username from tasks payload.
      this.accumulateMemberCompletions( domainAgg[ domain ].memberCompleted, t );
    }

    // Finalize domain rows
    const rows: DomainPerfRow[] = DEFAULT_TEAM_DOMAINS.map( ( d ) => {
      const a = domainAgg[ d ];
      const pending = Math.max( 0, a.assigned - a.completed );
      const rate = a.assigned > 0 ? ( a.completed / a.assigned ) * 100 : 0;

      const topMember = this.pickTopMember( a.memberCompleted );

      return {
        domain: d,
        teams: a.teams,
        assigned: a.assigned,
        completed: a.completed,
        pending,
        completionRate: this.round2( rate ),
        topTeamName: a.topTeamName || '—',
        topTeamCompleted: a.topTeamCompleted,
        topMemberName: topMember?.name ?? '—',
        topMemberCompleted: topMember?.completed ?? 0,
      };
    } );

    // Best domain (by completion rate, tie-break by completed volume)
    const best = [ ...rows ]
      .filter( r => r.assigned > 0 )
      .sort( ( x, y ) => ( y.completionRate - x.completionRate ) || ( y.completed - x.completed ) )[ 0 ];

    this.bestDomain = best?.domain ?? null;

    // Top teams overall
    this.topTeamsOverall = topTeams
      .sort( ( a, b ) => ( b.completed - a.completed ) || ( b.assigned - a.assigned ) )
      .slice( 0, 8 );

    this.domainPerformance = rows;

    // Executive KPI cards
    const companyAssigned = rows.reduce( ( s, r ) => s + r.assigned, 0 );
    const companyCompleted = rows.reduce( ( s, r ) => s + r.completed, 0 );
    const companyRate = companyAssigned > 0 ? ( companyCompleted / companyAssigned ) * 100 : 0;

    const topTeam = this.topTeamsOverall[ 0 ] ?? null;

    this.executiveKpis = [
      {
        key: 'companyRate',
        title: 'Company Completion Rate',
        value: `${ this.round0( companyRate ) }%`,
        hint: `${ companyCompleted } completed out of ${ companyAssigned } assigned`,
        tone: this.scoreTone( companyRate ),
      },
      {
        key: 'bestDomain',
        title: 'Best Performing Domain',
        value: this.bestDomain ? String( this.bestDomain ) : '—',
        hint: best ? `${ best.completed } completed • ${ best.completionRate }% rate` : 'No tasks yet',
        tone: best ? this.scoreTone( best.completionRate ) : 'muted',
      },
      {
        key: 'topTeam',
        title: 'Top Team Overall',
        value: topTeam ? topTeam.teamName : '—',
        hint: topTeam ? `${ topTeam.completed } completed • ${ topTeam.domain }` : 'No teams',
        tone: topTeam ? this.scoreTone( topTeam.completed > 0 ? 80 : 40 ) : 'muted',
      },
      {
        key: 'workload',
        title: 'Pending Workload',
        value: `${ Math.max( 0, companyAssigned - companyCompleted ) }`,
        hint: 'Assigned - Completed (company-wide)',
        tone: ( companyAssigned - companyCompleted ) <= 10 ? 'ok' : ( companyAssigned - companyCompleted ) <= 30 ? 'warn' : 'danger',
      },
    ];

    // Charts
    this.buildExecutiveCharts( rows, this.topTeamsOverall );
  }

  private initDomainAgg(): Record<TeamDomain, {
    teams: number;
    assigned: number;
    completed: number;
    topTeamName: string;
    topTeamCompleted: number;
    memberCompleted: Record<string, { name: string; completed: number; }>;
  }> {
    const out = {} as any;
    for ( const d of DEFAULT_TEAM_DOMAINS ) {
      out[ d ] = {
        teams: 0,
        assigned: 0,
        completed: 0,
        topTeamName: '',
        topTeamCompleted: 0,
        memberCompleted: {},
      };
    }
    return out;
  }

  private accumulateMemberCompletions(
    bucket: Record<string, { name: string; completed: number; }>,
    team: TeamManagementDto
  ): void {
    const tasks = Array.isArray( team.assignTasks ) ? team.assignTasks : [];

    // Build a lookup of known users in this team (captain + members)
    const knownUsers: Array<{ username: string; name: string; }> = [];

    const capUsername = String( ( team.captain as any )?.user?.username ?? team.captain?.username ?? '' ).trim();
    const capName = String( ( team.captain as any )?.user?.name ?? capUsername ).trim();
    if ( capUsername ) knownUsers.push( { username: capUsername, name: capName } );

    const members = Array.isArray( ( team as any )?.members ) ? ( team as any ).members : [];
    for ( const m of members ) {
      const u = String( m?.user?.username ?? m?.username ?? '' ).trim();
      if ( !u ) continue;
      const n = String( m?.user?.name ?? u ).trim();
      knownUsers.push( { username: u, name: n } );
    }

    const nameByUsername = new Map<string, string>( knownUsers.map( x => [ x.username, x.name ] ) );

    // Count completed tasks per assignee username
    for ( const t of tasks ) {
      const st = String( ( t as any )?.status ?? '' ).toLowerCase();
      if ( st !== 'completed' ) continue;

      const assigneeUsername =
        String( ( t as any )?.assignedTo?.username ?? ( t as any )?.assignee?.username ?? ( t as any )?.username ?? '' ).trim();

      if ( !assigneeUsername ) continue;

      const displayName = nameByUsername.get( assigneeUsername ) ?? assigneeUsername;

      if ( !bucket[ assigneeUsername ] ) {
        bucket[ assigneeUsername ] = { name: displayName, completed: 0 };
      }
      bucket[ assigneeUsername ].completed += 1;
    }
  }

  private pickTopMember( bucket: Record<string, { name: string; completed: number; }> )
    : { name: string; completed: number; } | null {
    const arr = Object.values( bucket );
    if ( arr.length === 0 ) return null;
    return arr.sort( ( a, b ) => b.completed - a.completed )[ 0 ] ?? null;
  }

  private buildExecutiveCharts( rows: DomainPerfRow[], topTeams: Array<{ teamName: string; domain: TeamDomain; completed: number; assigned: number; }> ): void {
    // 1) Completed vs Pending per domain (Column)
    const cats = rows.map( r => String( r.domain ) );
    const completedSeries: SeriesEntry = { name: 'Completed', values: rows.map( r => r.completed ), type: 'bars' };
    const pendingSeries: SeriesEntry = { name: 'Pending', values: rows.map( r => r.pending ), type: 'bars' };

    this.domainCompletionChart = this.chartService.buildColumn(
      'Company Performance by Domain',
      cats,
      [ completedSeries, pendingSeries ],
      {
        height: 320,
        legend: { position: 'right' },
        vAxis: { title: 'Tasks', minValue: 0 },
        hAxis: { title: 'Domains' },
      }
    );

    // 2) Completion rate per domain (Column)
    const rateSeries: SeriesEntry = { name: 'Completion %', values: rows.map( r => r.completionRate ), type: 'bars' };

    this.domainRateChart = this.chartService.buildColumn(
      'Completion Rate by Domain',
      cats,
      [ rateSeries ],
      {
        height: 320,
        legend: { position: 'none' },
        vAxis: { title: 'Rate %', minValue: 0, maxValue: 100 },
        hAxis: { title: 'Domains' },
      }
    );

    // 3) Top teams overall (Bar)
    const tCats = topTeams.map( x => x.teamName );
    const tSeries: SeriesEntry = { name: 'Completed', values: topTeams.map( x => x.completed ), type: 'bars' };

    this.topTeamsChart = this.chartService.buildBar(
      'Top Teams (Completed Tasks)',
      tCats,
      [ tSeries ],
      {
        height: 340,
        legend: { position: 'none' },
        hAxis: { title: 'Completed Tasks', minValue: 0 },
        vAxis: { title: 'Teams' },
      }
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Small helpers
  // ─────────────────────────────────────────────────────────────
  private round0( v: number ): number {
    return Math.round( Number.isFinite( v ) ? v : 0 );
  }
  private round2( v: number ): number {
    if ( !Number.isFinite( v ) ) return 0;
    return Math.round( v * 100 ) / 100;
  }

  private scoreTone( score: number ): 'ok' | 'warn' | 'danger' | 'muted' {
    if ( !Number.isFinite( score ) ) return 'muted';
    if ( score >= 75 ) return 'ok';
    if ( score >= 55 ) return 'warn';
    return 'danger';
  }
}
