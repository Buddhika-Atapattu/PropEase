// Path: src/app/pages/team-management/home/home.component.ts

import {
  Component,
  ViewChild,
  OnInit,
  type OnDestroy,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { HttpErrorResponse } from '@angular/common/http';

// Services
import {
  TeamDomain,
  TeamManagementDto,
  TaskStatus,
  DEFAULT_TEAM_DOMAINS,
} from '../../../services/teamManagementService/team-management.types';
import {

  TeamManagementService,
} from '../../../services/teamManagementService/team-management.service';
import { APIsService } from '../../../services/APIs/apis.service';
import { PaginationUtil } from '../../../source/utility/pagination.utils';

// Charts
import { GoogleChartsModule } from 'angular-google-charts';
import type {
  ChartBuild,
  SeriesEntry,
  PieEntry,
  GoogleChartOptions,
} from '../../../services/chartService/chart-service';
import { ChartService } from '../../../services/chartService/chart-service';

// Components
import {
  CustomTableComponent,
  TableColumn,
  TableUiButton,
  TableUiButtonClickConfig,
} from '../../../components/shared/custom-table/custom-table.component';
import { NotificationDialogComponent } from '../../../components/dialogs/notificationBar/notificationBar.component';

/**
 * UI Table Row Shape
 * Teaching note:
 *  - Keep this “flat”, because tables render columns easily when fields are flat.
 *  - Any nested DTO should be normalized into primitive fields here.
 */
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

/**
 * KPI Card (exec dashboard)
 * Teaching note:
 *  - Immutable cards = easy rendering and avoids mutation bugs.
 */
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

/**
 * TaskShape
 * Teaching note:
 *  - Backend DTO may evolve. So we “defensively read”.
 *  - That means: everything optional, and we convert to safe primitives.
 */
type TaskShape = {
  status?: string;

  assignedAtISO?: string;
  createdAtISO?: string;

  expectedEndAtISO?: string;
  dueAtISO?: string;

  completedAtISO?: string;

  evidenceCount?: number;
  hasEvidence?: boolean;

  lastWarningLevel?: string;

  assignedTo?: { username?: string; };
  assignee?: { username?: string; };
  username?: string;

  satisfactionScore?: number;
};

type StatusKey =
  | 'completed'
  | 'pending'
  | 'in_progress'
  | 'draft'
  | 'cancelled'
  | 'reopened'
  | 'other';

type StatusCounts = Record<StatusKey, number>;

/**
 * Strong tuple type:
 *  - Solves your TS error: '(string | number)[][]' is not assignable to '[string, number][]'
 */
type LabelValuePair = readonly [ string, number ];

@Component( {
  selector: 'app-team-management-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
  // Platform guard (SSR-safe)
  // Teaching note:
  //  - In SSR/hydration, `window/document` can be undefined.
  //  - Always gate browser-only operations behind this check.
  // ─────────────────────────────────────────────────────────────
  private readonly platformId = inject( PLATFORM_ID );

  private isBrowser(): boolean {
    return isPlatformBrowser( this.platformId );
  }

  // ─────────────────────────────────────────────────────────────
  // Table state (private backing fields)
  // Teaching note:
  //  - Backing fields + getters/setters prevents accidental template mutation.
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
    {
      id: 'team.assignTask',
      iconKey: 'task.assign',
      label: 'Assign Task',
      tooltip: 'Assign Task',
      tone: 'good',
    },
    {
      id: 'team.view',
      iconKey: 'view',
      label: 'View',
      tooltip: 'View Team',
      tone: 'normal',
    },
    {
      id: 'team.edit',
      iconKey: 'edit',
      label: 'Edit',
      tooltip: 'Edit Team',
      tone: 'normal',
    },
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
  // EXEC DASHBOARD (KPIs + domain summary)
  // ─────────────────────────────────────────────────────────────
  protected executiveKpis: ExecutiveKpiCard[] = [];
  protected domainPerformance: DomainPerfRow[] = [];

  protected domainPerformanceTableColumns: TableColumn[] = [
    { key: 'domain', label: 'Domain' },
    { key: 'teams', label: 'Teams' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'completed', label: 'Completed' },
    { key: 'pending', label: 'Pending' },
    { key: 'completionRate', label: 'Completion %' },
    { key: 'topTeamName', label: 'Top Team' },
    { key: 'topTeamCompleted', label: 'Team Completed' },
    { key: 'topMemberName', label: 'Top Performer' },
    { key: 'topMemberCompleted', label: 'Member Completed' },
  ];
  protected domainPerformanceTableData: Array<Record<string, unknown>> = [];

  // ─────────────────────────────────────────────────────────────
  // REQUIRED 6 CHARTS (as per your spec)
  // ─────────────────────────────────────────────────────────────
  protected allTeamPerformancePieChart: ChartBuild | null = null; // (01) Pie (3D)
  protected teamCompletionRateBarChart: ChartBuild | null = null; // (02) Bar/Column
  protected criticalHoldersPieChart: ChartBuild | null = null; // (03) Pie (3D)
  protected mostSatisfactoryTeamsPieChart: ChartBuild | null = null; // (04) Pie (3D)
  protected teamActiveStatusPieChart: ChartBuild | null = null; // (05) Pie (3D)
  protected periodPerformanceChart: ChartBuild | null = null; // (06) Pie (3D)

  // Optional extras you already had
  protected domainCompletionChart: ChartBuild | null = null;
  protected domainRateChart: ChartBuild | null = null;
  protected topTeamsChart: ChartBuild | null = null;

  protected topTeamsOverall: Array<{
    teamName: string;
    domain: TeamDomain;
    completed: number;
    assigned: number;
    completionRate: number;
  }> = [];
  protected bestDomain: TeamDomain | null = null;

  // ─────────────────────────────────────────────────────────────
  // Time period filter (Requirement #06)
  // ─────────────────────────────────────────────────────────────
  protected periodFrom: string = '';
  protected periodTo: string = '';

  protected periodAssigned: number = 0;
  protected periodCompleted: number = 0;
  protected periodRate: number = 0;

  private analyticsTeamsCache: TeamManagementDto[] = [];

  // ✅ Keep constructor signature exactly as your wiring expects
  public constructor (
    private readonly router: Router,
    private readonly teamService: TeamManagementService,
    private readonly apiService: APIsService,
    private readonly chartService: ChartService
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Getters / setters (paginator bindings)
  // Teaching note:
  //  - Your custom-table triggers data fetch by toggling isReload.
  //  - We use “rising edge” detection to avoid multiple calls.
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

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────
  public async ngOnInit(): Promise<void> {
    await this.allTeamLoadInit( this._allTeamIndex, this._allTeamLimit, this._allTeamSearch );

    if ( this.isBrowser() ) {
      // reserved for realtime KPI later
    }
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
      const teamID = String( value.row?.teamId ?? '' ).trim();
      if ( !teamID ) throw new Error( 'Invalid team ID!' );

      switch ( id ) {
        case 'team.assignTask':
          await this.router.navigate( [ `/dashboard/team-management/assign-task/${ teamID }/dashboard` ] );
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
  // Requirement #06: Time period selector
  // ─────────────────────────────────────────────────────────────
  protected applyPeriodFilter(): void {
    // No refetch: compute from cached analytics dataset
    this.computePeriodPerformanceFromCache();
  }

  protected resetPeriodFilter(): void {
    this.periodFrom = '';
    this.periodTo = '';
    this.computePeriodPerformanceFromCache();
  }

  // ─────────────────────────────────────────────────────────────
  // Data loading (REST source-of-truth)
  // Teaching note:
  //  - We fetch: totals -> page -> full analytics dataset
  //  - Then we compute: KPIs + charts in memory
  // ─────────────────────────────────────────────────────────────
  private async allTeamLoadInit( index: number, limit: number, search?: string ): Promise<void> {
    try {
      this._allTeamIsLoading = true;

      this.resetUiStateBeforeLoad();

      // 1) totals
      const totalRes = await this.teamService.getTeamTotals();
      if ( !totalRes.success ) throw new Error( totalRes.message ?? 'Failed to fetch total number of teams!' );

      const rawTotal = this.apiService.extractNumberFromOther( totalRes.data, 'totalTeams' );
      if ( rawTotal === null || rawTotal === undefined ) throw new Error( 'Invalid total number of teams!' );

      if ( !Number.isFinite( rawTotal ) || !Number.isInteger( rawTotal ) || rawTotal < 0 ) {
        throw new Error( 'Invalid data format of total number of teams!' );
      }

      const totalItems = rawTotal;
      this.allTeamTotal = totalItems;

      // 2) pagination safety
      const safeLimit = PaginationUtil.safeLimit( limit, totalItems );
      const totalPages = Math.max( 1, Math.ceil( totalItems / safeLimit ) );
      const safeIndex = PaginationUtil.safeIndex( index, totalPages );
      const safeSearch = typeof search === 'string' && search.trim() ? search.trim() : undefined;

      // 3) table page
      const res = await this.teamService.getTeams( safeIndex, safeLimit, safeSearch );
      if ( !res.success ) throw new Error( res.message ?? 'Failed to fetch team data!' );

      const rawTeamsPage = this.pickTeamsArray( res.data );
      if ( !Array.isArray( rawTeamsPage ) ) throw new Error( 'Invalid array of team data!' );

      this.allTeamTableData = this.buildAllTeamTableData( rawTeamsPage );

      // 4) analytics set (fetch all teams once) — cached for period filter recalculation
      const analyticsTeams = await this.fetchAllTeamsForAnalytics( totalItems, safeSearch );
      this.analyticsTeamsCache = analyticsTeams;

      // 5) KPIs + required charts
      this.buildExecutiveDashboardAndCharts( analyticsTeams );

      // 6) domain table data
      this.domainPerformanceTableData = this.domainPerformance.map( ( r ) => ( {
        domain: String( r.domain ),
        teams: r.teams,
        assigned: r.assigned,
        completed: r.completed,
        pending: r.pending,
        completionRate: `${ r.completionRate }%`,
        topTeamName: r.topTeamName,
        topTeamCompleted: r.topTeamCompleted,
        topMemberName: r.topMemberName,
        topMemberCompleted: r.topMemberCompleted,
      } ) );

      // 7) period performance defaults (no filter => full dataset)
      this.computePeriodPerformanceFromCache();
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
      // Small delay prevents flicker
      setTimeout( () => {
        this._allTeamIsLoading = false;
      }, 250 );
    }
  }

  /**
   * Reset UI bindings before each load
   * Teaching note:
   *  - Always clear charts before refilling. Otherwise old charts remain visible and confuse users.
   */
  private resetUiStateBeforeLoad(): void {
    this.allTeamTableData = [];
    this.executiveKpis = [];
    this.domainPerformance = [];
    this.domainPerformanceTableData = [];

    this.allTeamPerformancePieChart = null;
    this.teamCompletionRateBarChart = null;
    this.criticalHoldersPieChart = null;
    this.mostSatisfactoryTeamsPieChart = null;
    this.teamActiveStatusPieChart = null;
    this.periodPerformanceChart = null;

    this.domainCompletionChart = null;
    this.domainRateChart = null;
    this.topTeamsChart = null;

    this.topTeamsOverall = [];
    this.bestDomain = null;
  }

  private async fetchAllTeamsForAnalytics( totalItems: number, search?: string ): Promise<TeamManagementDto[]> {
    if ( totalItems <= 0 ) return [];

    const res = await this.teamService.getTeams( 0, totalItems, search );
    if ( !res?.success ) return [];

    const all = this.pickTeamsArray( res.data );
    return Array.isArray( all ) ? all : [];
  }

  /**
   * DTO adapter: extract “teams array” from multiple possible response shapes.
   * Teaching note:
   *  - This defends against backend response nesting changes without breaking FE.
   */
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

  private buildAllTeamTableData( rawTeamsPage: TeamManagementDto[] ): AllTeamData[] {
    const out: AllTeamData[] = [];

    for ( const team of rawTeamsPage ) {
      try {
        out.push( this.buildAllTeamTableRow( team ) );
      } catch ( rowErr ) {
        // eslint-disable-next-line no-console
        console.warn( '[Warning:] [TeamHome] Skipping invalid team row.\n', rowErr );
      }
    }

    return out;
  }

  private buildAllTeamTableRow( data: TeamManagementDto ): AllTeamData {
    const teamLogo: string = String( data.teamLogo?.url ?? '' ).trim() || '';

    const teamId: string = String( data.teamCode ?? '' ).trim();
    if ( !teamId ) throw new Error( 'Invalid team id!' );

    const teamName: string = String( data.teamName ?? '' ).trim();
    if ( !teamName ) throw new Error( 'Invalid team name!' );

    const teamTotal: number = this.safeInt( data.memberTotal );

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

    const completedTasks: number = taskArray.reduce( ( total: number, task: any ) => {
      const st = String( task?.status ?? '' ).toLowerCase() as TaskStatus;
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
  // Executive dashboard + REQUIRED 6 charts
  // ─────────────────────────────────────────────────────────────
  private buildExecutiveDashboardAndCharts( allTeams: TeamManagementDto[] ): void {
    const domainAgg = this.initDomainAgg();

    const teamStats: Array<{
      teamName: string;
      domain: TeamDomain;
      assigned: number;
      completed: number;
      pending: number;
      completionRate: number;
    }> = [];

    const allTasks: TaskShape[] = [];
    let totalMembers = 0;

    for ( const t of allTeams ) {
      const domain: TeamDomain = t.domain as TeamDomain;
      if ( !domain || !DEFAULT_TEAM_DOMAINS.includes( domain ) ) continue;

      totalMembers += this.safeInt( t.memberTotal );

      const tasks = Array.isArray( t.assignTasks ) ? ( t.assignTasks as any[] ) : [];
      const assigned = tasks.length;
      const completed = this.countCompleted( tasks );
      const pending = Math.max( 0, assigned - completed );
      const rate = assigned > 0 ? ( completed / assigned ) * 100 : 0;

      // domain totals
      domainAgg[ domain ].teams += 1;
      domainAgg[ domain ].assigned += assigned;
      domainAgg[ domain ].completed += completed;

      // collect tasks for global KPIs / charts
      for ( const x of tasks ) allTasks.push( x as TaskShape );

      teamStats.push( {
        teamName: String( t.teamName ?? 'Unknown' ).trim() || 'Unknown',
        domain,
        assigned,
        completed,
        pending,
        completionRate: this.round2( rate ),
      } );

      if ( completed > domainAgg[ domain ].topTeamCompleted ) {
        domainAgg[ domain ].topTeamCompleted = completed;
        domainAgg[ domain ].topTeamName = String( t.teamName ?? '' ).trim() || 'Unknown';
      }

      this.accumulateMemberCompletions( domainAgg[ domain ].memberCompleted, t );
    }

    // domain rows
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

    this.domainPerformance = rows;

    // best domain
    const best =
      [ ...rows ]
        .filter( ( r ) => r.assigned > 0 )
        .sort( ( x, y ) => ( y.completionRate - x.completionRate ) || ( y.completed - x.completed ) )[ 0 ] ?? null;

    this.bestDomain = best?.domain ?? null;

    // company totals
    const companyAssigned = teamStats.reduce( ( s, r ) => s + r.assigned, 0 );
    const companyCompleted = teamStats.reduce( ( s, r ) => s + r.completed, 0 );
    const companyPending = Math.max( 0, companyAssigned - companyCompleted );
    const companyRate = companyAssigned > 0 ? ( companyCompleted / companyAssigned ) * 100 : 0;

    // status breakdown
    const statusCounts: StatusCounts = this.countStatuses( allTasks );

    // SLA-like indicators
    const overdueCount = this.countOverdue( allTasks );
    const dueSoonCount = this.countDueSoon( allTasks, 7 );

    const evidenceCoverage = this.calcEvidenceCoverage( allTasks );
    const avgEvidenceCount = this.calcAvgEvidenceCount( allTasks );
    const medianCompletionHours = this.medianCompletionHours( allTasks );

    const warning75 = this.countWarningLevel( allTasks, '75' );
    const warning90 = this.countWarningLevel( allTasks, '90' );
    const warningOverdue = this.countWarningLevel( allTasks, 'overdue' );

    // Active vs idle teams
    const activeTeams = teamStats.filter( ( t ) => t.assigned > 0 ).length;
    const idleTeams = Math.max( 0, teamStats.length - activeTeams );

    // Productivity
    const avgTasksPerTeam = activeTeams > 0 ? companyAssigned / activeTeams : 0;
    const avgCompletedPerTeam = activeTeams > 0 ? companyCompleted / activeTeams : 0;

    // Top teams overall
    this.topTeamsOverall = [ ...teamStats ]
      .sort( ( a, b ) => ( b.completed - a.completed ) || ( b.assigned - a.assigned ) )
      .slice( 0, 10 );

    const topTeam = this.topTeamsOverall[ 0 ] ?? null;

    // KPI cards
    this.executiveKpis = [
      this.kpi(
        'companyRate',
        'Company Completion Rate',
        `${ this.round0( companyRate ) }%`,
        `${ companyCompleted } completed of ${ companyAssigned }`,
        this.scoreTone( companyRate )
      ),
      this.kpi(
        'companyAssigned',
        'Total Assigned Tasks',
        `${ companyAssigned }`,
        'Company-wide assigned workload',
        companyAssigned > 0 ? 'ok' : 'muted'
      ),
      this.kpi(
        'companyCompleted',
        'Total Completed Tasks',
        `${ companyCompleted }`,
        'Company-wide completed volume',
        companyCompleted > 0 ? 'ok' : 'muted'
      ),
      this.kpi(
        'companyPending',
        'Pending Workload',
        `${ companyPending }`,
        'Assigned - Completed (company-wide)',
        companyPending <= 10 ? 'ok' : companyPending <= 30 ? 'warn' : 'danger'
      ),

      this.kpi(
        'teamsTotal',
        'Total Teams',
        `${ teamStats.length }`,
        'Teams in analytics dataset',
        teamStats.length > 0 ? 'ok' : 'muted'
      ),
      this.kpi(
        'membersTotal',
        'Total Members',
        `${ totalMembers }`,
        'Sum of memberTotal across teams',
        totalMembers > 0 ? 'ok' : 'muted'
      ),
      this.kpi(
        'activeTeams',
        'Active Teams',
        `${ activeTeams }`,
        'Teams with at least 1 task',
        activeTeams > 0 ? 'ok' : 'warn'
      ),
      this.kpi(
        'idleTeams',
        'Idle Teams',
        `${ idleTeams }`,
        'Teams with 0 tasks (attention)',
        idleTeams === 0 ? 'ok' : idleTeams <= 3 ? 'warn' : 'danger'
      ),

      this.kpi(
        'bestDomain',
        'Best Domain',
        best ? String( best.domain ) : '—',
        best ? `${ best.completionRate }% • ${ best.completed } completed` : 'No domain tasks',
        best ? this.scoreTone( best.completionRate ) : 'muted'
      ),
      this.kpi(
        'topTeam',
        'Top Team Overall',
        topTeam ? topTeam.teamName : '—',
        topTeam ? `${ topTeam.completed } completed` : 'No team data',
        topTeam ? 'ok' : 'muted'
      ),
      this.kpi(
        'topTeamLoad',
        'Top Team Load',
        topTeam ? `${ topTeam.assigned }` : '—',
        topTeam ? 'Assigned tasks for top team' : 'No team data',
        topTeam ? 'ok' : 'muted'
      ),

      this.kpi(
        'overdue',
        'Overdue Tasks',
        `${ overdueCount }`,
        'Expected end date passed, not completed',
        overdueCount === 0 ? 'ok' : overdueCount <= 5 ? 'warn' : 'danger'
      ),
      this.kpi(
        'dueSoon',
        'Due Soon (7 days)',
        `${ dueSoonCount }`,
        'Tasks expected within next 7 days',
        dueSoonCount <= 10 ? 'ok' : dueSoonCount <= 25 ? 'warn' : 'danger'
      ),

      this.kpi(
        'warning75',
        'Warning Level 75%',
        `${ warning75 }`,
        'Tasks flagged at 75% threshold',
        warning75 === 0 ? 'ok' : 'warn'
      ),
      this.kpi(
        'warning90',
        'Warning Level 90%',
        `${ warning90 }`,
        'Tasks flagged at 90% threshold',
        warning90 === 0 ? 'ok' : 'warn'
      ),
      this.kpi(
        'warningOverdue',
        'Warning: Overdue',
        `${ warningOverdue }`,
        'Tasks flagged overdue by warning engine',
        warningOverdue === 0 ? 'ok' : 'danger'
      ),

      this.kpi(
        'statusCompleted',
        'Status: Completed',
        `${ statusCounts[ 'completed' ] }`,
        'Count of completed tasks',
        statusCounts[ 'completed' ] > 0 ? 'ok' : 'muted'
      ),
      this.kpi(
        'statusInProgress',
        'Status: In Progress',
        `${ statusCounts[ 'in_progress' ] }`,
        'Count of tasks in progress',
        statusCounts[ 'in_progress' ] > 0 ? 'ok' : 'muted'
      ),
      this.kpi(
        'statusPending',
        'Status: Pending',
        `${ statusCounts[ 'pending' ] }`,
        'Count of pending tasks',
        statusCounts[ 'pending' ] > 30 ? 'warn' : ( statusCounts[ 'pending' ] > 0 ? 'ok' : 'muted' )
      ),
      this.kpi(
        'statusCancelled',
        'Status: Cancelled',
        `${ statusCounts[ 'cancelled' ] }`,
        'Count of cancelled tasks',
        statusCounts[ 'cancelled' ] === 0 ? 'ok' : 'warn'
      ),

      this.kpi(
        'evidenceCoverage',
        'Evidence Coverage',
        `${ this.round0( evidenceCoverage.rate ) }%`,
        `${ evidenceCoverage.withEvidence }/${ evidenceCoverage.total } tasks have evidence`,
        this.scoreTone( evidenceCoverage.rate )
      ),
      this.kpi(
        'avgEvidence',
        'Avg Evidence/Task',
        `${ this.round2( avgEvidenceCount ) }`,
        'Average evidenceCount across tasks',
        avgEvidenceCount >= 1 ? 'ok' : avgEvidenceCount > 0 ? 'warn' : 'danger'
      ),

      this.kpi(
        'medianCompletion',
        'Median Completion Time',
        medianCompletionHours === null ? '—' : `${ this.round2( medianCompletionHours ) }h`,
        medianCompletionHours === null ? 'Need assigned+completed timestamps' : 'Median hours assigned→completed',
        medianCompletionHours === null
          ? 'muted'
          : ( medianCompletionHours <= 24 ? 'ok' : medianCompletionHours <= 72 ? 'warn' : 'danger' )
      ),

      this.kpi(
        'avgTasksPerTeam',
        'Avg Tasks/Active Team',
        `${ this.round2( avgTasksPerTeam ) }`,
        'Assigned / ActiveTeams',
        avgTasksPerTeam <= 10 ? 'ok' : avgTasksPerTeam <= 25 ? 'warn' : 'danger'
      ),
      this.kpi(
        'avgCompletedPerTeam',
        'Avg Completed/Active Team',
        `${ this.round2( avgCompletedPerTeam ) }`,
        'Completed / ActiveTeams',
        avgCompletedPerTeam <= 8 ? 'ok' : avgCompletedPerTeam <= 20 ? 'warn' : 'danger'
      ),
    ];

    // REQUIRED charts (pie charts are 3D)
    this.buildRequiredCharts( teamStats, allTasks, companyCompleted, companyPending, activeTeams, idleTeams );

    // Optional charts
    this.buildLegacyCharts( rows );
  }

  // ─────────────────────────────────────────────────────────────
  // REQUIRED CHARTS
  // Teaching note:
  //  - Pie charts = 3D per your requirement.
  //  - Bar chart remains 2D (Google does not support 3D bars).
  // ─────────────────────────────────────────────────────────────
  private buildRequiredCharts(
    teamStats: Array<{ teamName: string; assigned: number; completed: number; pending: number; completionRate: number; domain: TeamDomain; }>,
    allTasks: TaskShape[],
    companyCompleted: number,
    companyPending: number,
    activeTeams: number,
    idleTeams: number
  ): void {
    // (01) All team performance (Pie 3D): Completed vs Pending company-wide
    const perfEntries: PieEntry[] = this.toPieEntries( [
      this.pair( 'Completed', companyCompleted ),
      this.pair( 'Pending', companyPending ),
    ] );

    this.allTeamPerformancePieChart = perfEntries.length
      ? this.chartService.buildPie3D(
        'All Team Performance',
        perfEntries,
        this.pie3dDefaults( 320 )
      )
      : null;

    // (02) Completion rate by team (Column/Bar): top 10 by assigned volume
    const topByVolume = [ ...teamStats ]
      .filter( ( t ) => t.assigned > 0 )
      .sort( ( a, b ) => ( b.assigned - a.assigned ) || ( b.completed - a.completed ) )
      .slice( 0, 10 );

    const categories = topByVolume.map( ( t ) => t.teamName );
    const rateSeries: SeriesEntry = {
      name: 'Completion %',
      values: topByVolume.map( ( t ) => t.completionRate ),
      type: 'bars',
    };

    this.teamCompletionRateBarChart = categories.length
      ? this.chartService.buildColumn(
        'Task Completion Rate by Team',
        categories,
        [ rateSeries ],
        this.columnDefaults( 340, 'Teams', 'Completion %', 0, 100 )
      )
      : null;

    // (03) Most critical task holders (Pie 3D): overdue tasks per assignee
    const overdueByUser = this.groupOverdueByAssignee( allTasks );

    const criticalPairs: LabelValuePair[] = Object.entries( overdueByUser )
      .map( ( [ user, count ] ) => this.pair( user, this.safeInt( count ) ) )
      .sort( ( a, b ) => b[ 1 ] - a[ 1 ] )
      .slice( 0, 7 );

    const criticalEntries = this.toPieEntries( criticalPairs );

    this.criticalHoldersPieChart = criticalEntries.length
      ? this.chartService.buildPie3D(
        'Most Critical Task Holders',
        criticalEntries,
        this.pie3dDefaults( 320 )
      )
      : null;

    // (04) Most satisfactory teams (Pie 3D):
    // Proxy metric until real satisfactionScore is integrated:
    //  - high completionRate
    //  - minimum workload to avoid noise
    const satisfactory = [ ...teamStats ]
      .filter( ( t ) => t.assigned >= 3 )
      .sort( ( a, b ) => ( b.completionRate - a.completionRate ) || ( b.completed - a.completed ) )
      .slice( 0, 7 );

    const satPairs: LabelValuePair[] = satisfactory.map( ( t ) => this.pair( t.teamName, this.round2( t.completionRate ) ) );
    const satEntries = this.toPieEntries( satPairs );

    this.mostSatisfactoryTeamsPieChart = satEntries.length
      ? this.chartService.buildPie3D(
        'Most Satisfactory Teams (Proxy)',
        satEntries,
        this.pie3dDefaults( 320 )
      )
      : null;

    // (05) Team active status (Pie 3D): active vs idle teams
    const activeEntries = this.toPieEntries( [
      this.pair( 'Active', activeTeams ),
      this.pair( 'Idle', idleTeams ),
    ] );

    this.teamActiveStatusPieChart = activeEntries.length
      ? this.chartService.buildPie3D(
        'Team Active Status',
        activeEntries,
        this.pie3dDefaults( 320 )
      )
      : null;

    // (06) Period performance is built in computePeriodPerformanceFromCache()
  }

  // ─────────────────────────────────────────────────────────────
  // Requirement #06: Time period performance (Pie 3D)
  // Teaching note:
  //  - Assigned in period: assignedAtISO or createdAtISO
  //  - Completed in period: completedAtISO
  // ─────────────────────────────────────────────────────────────
  private computePeriodPerformanceFromCache(): void {
    const allTasks = this.extractAllTasksFromTeams( this.analyticsTeamsCache );

    const from = this.parseDateOnly( this.periodFrom );
    const to = this.parseDateOnly( this.periodTo );

    const hasRange = !!from && !!to && from.getTime() <= to.getTime();

    let assignedCount = 0;
    let completedCount = 0;

    for ( const t of allTasks ) {
      const assignedIso = String( t.assignedAtISO ?? t.createdAtISO ?? '' ).trim();
      const completedIso = String( t.completedAtISO ?? '' ).trim();

      const assignedAt = this.parseIso( assignedIso );
      const completedAt = this.parseIso( completedIso );

      if ( !hasRange ) {
        // No filter => whole dataset
        if ( assignedIso ) assignedCount += 1;
        if ( completedAt ) completedCount += 1;
        continue;
      }

      const fromMs = from!.getTime();
      const toMs = this.endOfDay( to! ).getTime();

      if ( assignedAt && assignedAt.getTime() >= fromMs && assignedAt.getTime() <= toMs ) assignedCount += 1;
      if ( completedAt && completedAt.getTime() >= fromMs && completedAt.getTime() <= toMs ) completedCount += 1;
    }

    this.periodAssigned = assignedCount;
    this.periodCompleted = completedCount;

    const pending = Math.max( 0, this.periodAssigned - this.periodCompleted );
    const rate = this.periodAssigned > 0 ? ( this.periodCompleted / this.periodAssigned ) * 100 : 0;
    this.periodRate = this.round0( rate );

    const entries = this.toPieEntries( [
      this.pair( 'Completed', this.periodCompleted ),
      this.pair( 'Pending', pending ),
    ] );

    this.periodPerformanceChart = entries.length
      ? this.chartService.buildPie3D(
        'Period Performance (Completed vs Pending)',
        entries,
        this.pie3dDefaults( 320 )
      )
      : null;
  }

  // ─────────────────────────────────────────────────────────────
  // OPTIONAL / Legacy charts
  // ─────────────────────────────────────────────────────────────
  private buildLegacyCharts( rows: DomainPerfRow[] ): void {
    const cats = rows.map( ( r ) => String( r.domain ) );

    const completedSeries: SeriesEntry = {
      name: 'Completed',
      values: rows.map( ( r ) => r.completed ),
      type: 'bars',
    };

    const pendingSeries: SeriesEntry = {
      name: 'Pending',
      values: rows.map( ( r ) => r.pending ),
      type: 'bars',
    };

    this.domainCompletionChart = this.chartService.buildColumn(
      'Completed vs Pending by Domain',
      cats,
      [ completedSeries, pendingSeries ],
      this.columnDefaults( 320, 'Domains', 'Tasks', 0 )
    );

    const rateSeries: SeriesEntry = {
      name: 'Completion %',
      values: rows.map( ( r ) => r.completionRate ),
      type: 'bars',
    };

    this.domainRateChart = this.chartService.buildColumn(
      'Completion Rate by Domain',
      cats,
      [ rateSeries ],
      this.columnDefaults( 320, 'Domains', 'Rate %', 0, 100 )
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Chart option factories (normalized)
  // Teaching note:
  //  - All charts share a consistent chartArea and legend behavior.
  //  - Tooltip HTML must be enabled in ChartService (applyThemeDefaults).
  // ─────────────────────────────────────────────────────────────
  private pie3dDefaults( height: number ): GoogleChartOptions {
    return {
      height,
      legend: { position: 'right' },
      chartArea: { width: '85%', height: '80%' },
      is3D: true, // ✅ 3D pie
      pieSliceText: 'percentage',
      tooltip: { isHtml: true, trigger: 'focus', showColorCode: true },
    };
  }

  private columnDefaults(
    height: number,
    hTitle: string,
    vTitle: string,
    minValue: number,
    maxValue?: number
  ): GoogleChartOptions {
    return {
      height,
      legend: { position: 'none' },
      chartArea: { width: '80%', height: '75%' },
      hAxis: { title: hTitle },
      vAxis: {
        title: vTitle,
        minValue,
        ...( typeof maxValue === 'number' ? { maxValue } : {} ),
      },
      tooltip: { isHtml: true, trigger: 'focus', showColorCode: true },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Aggregation helpers
  // ─────────────────────────────────────────────────────────────
  private initDomainAgg(): Record<
    TeamDomain,
    {
      teams: number;
      assigned: number;
      completed: number;
      topTeamName: string;
      topTeamCompleted: number;
      memberCompleted: Record<string, { name: string; completed: number; }>;
    }
  > {
    const out = {} as Record<
      TeamDomain,
      {
        teams: number;
        assigned: number;
        completed: number;
        topTeamName: string;
        topTeamCompleted: number;
        memberCompleted: Record<string, { name: string; completed: number; }>;
      }
    >;

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

  private countCompleted( tasks: any[] ): number {
    return tasks.reduce( ( sum: number, x: any ) => {
      const st = String( x?.status ?? '' ).toLowerCase();
      return st === 'completed' ? sum + 1 : sum;
    }, 0 );
  }

  private accumulateMemberCompletions(
    bucket: Record<string, { name: string; completed: number; }>,
    team: TeamManagementDto
  ): void {
    const tasks = Array.isArray( team.assignTasks ) ? team.assignTasks : [];

    // Build a name map for better tooltip labels
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

    const nameByUsername = new Map<string, string>( knownUsers.map( ( x ) => [ x.username, x.name ] ) );

    for ( const t of tasks as any[] ) {
      const st = String( t?.status ?? '' ).toLowerCase();
      if ( st !== 'completed' ) continue;

      const assigneeUsername = String(
        t?.assignedTo?.username ?? t?.assignee?.username ?? t?.username ?? ''
      ).trim();

      if ( !assigneeUsername ) continue;

      const displayName = nameByUsername.get( assigneeUsername ) ?? assigneeUsername;

      if ( !bucket[ assigneeUsername ] ) bucket[ assigneeUsername ] = { name: displayName, completed: 0 };
      bucket[ assigneeUsername ].completed += 1;
    }
  }

  private pickTopMember( bucket: Record<string, { name: string; completed: number; }> ): { name: string; completed: number; } | null {
    const arr = Object.values( bucket );
    if ( arr.length === 0 ) return null;
    return arr.sort( ( a, b ) => b.completed - a.completed )[ 0 ] ?? null;
  }

  private countStatuses( allTasks: TaskShape[] ): StatusCounts {
    const out: StatusCounts = {
      completed: 0,
      pending: 0,
      in_progress: 0,
      draft: 0,
      cancelled: 0,
      reopened: 0,
      other: 0,
    };

    for ( const t of allTasks ) {
      const st = String( t?.status ?? '' ).toLowerCase() as StatusKey;
      if ( st in out ) out[ st ] += 1;
      else out.other += 1;
    }

    return out;
  }

  private countOverdue( allTasks: TaskShape[] ): number {
    const now = Date.now();
    let count = 0;

    for ( const t of allTasks ) {
      const st = String( t?.status ?? '' ).toLowerCase();
      if ( st === 'completed' || st === 'cancelled' ) continue;

      const dueIso = String( t?.expectedEndAtISO ?? t?.dueAtISO ?? '' ).trim();
      const due = this.parseIso( dueIso );
      if ( !due ) continue;

      if ( due.getTime() < now ) count += 1;
    }

    return count;
  }

  private countDueSoon( allTasks: TaskShape[], days: number ): number {
    const now = Date.now();
    const horizon = now + days * 24 * 60 * 60 * 1000;

    let count = 0;

    for ( const t of allTasks ) {
      const st = String( t?.status ?? '' ).toLowerCase();
      if ( st === 'completed' || st === 'cancelled' ) continue;

      const dueIso = String( t?.expectedEndAtISO ?? t?.dueAtISO ?? '' ).trim();
      const due = this.parseIso( dueIso );
      if ( !due ) continue;

      const ms = due.getTime();
      if ( ms >= now && ms <= horizon ) count += 1;
    }

    return count;
  }

  private calcEvidenceCoverage( allTasks: TaskShape[] ): { total: number; withEvidence: number; rate: number; } {
    const total = allTasks.length;
    let withEvidence = 0;

    for ( const t of allTasks ) {
      const hasEvidence = t?.hasEvidence === true || ( typeof t?.evidenceCount === 'number' && t.evidenceCount > 0 );
      if ( hasEvidence ) withEvidence += 1;
    }

    const rate = total > 0 ? ( withEvidence / total ) * 100 : 0;
    return { total, withEvidence, rate };
  }

  private calcAvgEvidenceCount( allTasks: TaskShape[] ): number {
    let sum = 0;
    let count = 0;

    for ( const t of allTasks ) {
      if ( typeof t?.evidenceCount === 'number' && Number.isFinite( t.evidenceCount ) ) {
        sum += t.evidenceCount;
        count += 1;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  private medianCompletionHours( allTasks: TaskShape[] ): number | null {
    const durations: number[] = [];

    for ( const t of allTasks ) {
      const st = String( t?.status ?? '' ).toLowerCase();
      if ( st !== 'completed' ) continue;

      const assignedIso = String( t?.assignedAtISO ?? t?.createdAtISO ?? '' ).trim();
      const completedIso = String( t?.completedAtISO ?? '' ).trim();

      const a = this.parseIso( assignedIso );
      const c = this.parseIso( completedIso );
      if ( !a || !c ) continue;

      const ms = c.getTime() - a.getTime();
      if ( ms <= 0 ) continue;

      durations.push( ms / ( 1000 * 60 * 60 ) );
    }

    if ( durations.length === 0 ) return null;

    durations.sort( ( x, y ) => x - y );
    const mid = Math.floor( durations.length / 2 );

    if ( durations.length % 2 === 1 ) return durations[ mid ] ?? null;
    return ( ( durations[ mid - 1 ] ?? 0 ) + ( durations[ mid ] ?? 0 ) ) / 2;
  }

  private countWarningLevel( allTasks: TaskShape[], level: string ): number {
    let count = 0;
    for ( const t of allTasks ) {
      const lv = String( t?.lastWarningLevel ?? '' ).trim();
      if ( lv === level ) count += 1;
    }
    return count;
  }

  private groupOverdueByAssignee( allTasks: TaskShape[] ): Record<string, number> {
    const now = Date.now();
    const out: Record<string, number> = {};

    for ( const t of allTasks ) {
      const st = String( t?.status ?? '' ).toLowerCase();
      if ( st === 'completed' || st === 'cancelled' ) continue;

      const dueIso = String( t?.expectedEndAtISO ?? t?.dueAtISO ?? '' ).trim();
      const due = this.parseIso( dueIso );
      if ( !due ) continue;

      if ( due.getTime() >= now ) continue;

      const user = String( t?.assignedTo?.username ?? t?.assignee?.username ?? t?.username ?? '' ).trim() || 'Unknown';
      out[ user ] = ( out[ user ] ?? 0 ) + 1;
    }

    return out;
  }

  private extractAllTasksFromTeams( teams: TeamManagementDto[] ): TaskShape[] {
    const out: TaskShape[] = [];
    for ( const t of teams ) {
      const tasks = Array.isArray( t.assignTasks ) ? ( t.assignTasks as any[] ) : [];
      for ( const x of tasks ) out.push( x as TaskShape );
    }
    return out;
  }

  // ─────────────────────────────────────────────────────────────
  // Tuple + PieEntry helpers (fixes TS errors cleanly)
  // ─────────────────────────────────────────────────────────────
  private pair( label: string, value: number ): LabelValuePair {
    return [ String( label ?? '' ).trim() || 'Unknown', this.safeInt( value ) ] as const;
  }

  private toPieEntries( pairs: readonly LabelValuePair[] ): PieEntry[] {
    // Teaching note:
    //  - PieEntry is the native input for ChartService.buildPie/buildPie3D
    //  - We filter out 0 values so slices don’t vanish weirdly.
    const out: PieEntry[] = [];
    for ( const [ label, value ] of pairs ) {
      if ( value <= 0 ) continue;
      out.push( { label, value } );
    }
    return out;
  }

  // ─────────────────────────────────────────────────────────────
  // Small helpers
  // ─────────────────────────────────────────────────────────────
  private kpi( key: string, title: string, value: string, hint: string, tone: ExecutiveKpiCard[ 'tone' ] ): ExecutiveKpiCard {
    return { key, title, value, hint, tone };
  }

  private safeInt( v: unknown ): number {
    const n = Number( v );
    if ( !Number.isFinite( n ) ) return 0;
    return Math.max( 0, Math.floor( n ) );
  }

  private parseIso( iso: string ): Date | null {
    if ( !iso ) return null;
    const d = new Date( iso );
    return Number.isFinite( d.getTime() ) ? d : null;
  }

  private parseDateOnly( yyyyMmDd: string ): Date | null {
    const s = String( yyyyMmDd ?? '' ).trim();
    if ( !s ) return null;

    // date-only input => local midnight
    const d = new Date( `${ s }T00:00:00` );
    return Number.isFinite( d.getTime() ) ? d : null;
  }

  private endOfDay( d: Date ): Date {
    return new Date( d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999 );
  }

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
