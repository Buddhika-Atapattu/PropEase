// Path: src/app/team-management/view/view.component.ts

import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import {
  DEFAULT_TEAM_DOMAINS,
  TeamDomain,
  TeamManagementDto,
  type TeamMemberDto
} from '../../../types/team-management/team-main/team-management.types';

import { TeamManagementService } from '../../../services/teamManagementService/team-management.service';

import { ChartService, ChartBuild, PieEntry, SeriesEntry } from '../../../services/chartService/chart-service';
import { NotificationDialogComponent } from '../../../components/dialogs/notificationBar/notificationBar.component';
import { CustomTableComponent } from '../../../components/shared/custom-table/custom-table.component';
import { GoogleChartsModule } from 'angular-google-charts';
import { APIsService } from '../../../services/APIs/apis.service';

type TableColumn = Readonly<{
  key: string;
  label: string;
  type?: 'text' | 'date' | 'image' | 'kpiSpark' | 'badge';
  width?: string;
  align?: 'left' | 'center' | 'right';
}>;

type TeamKpiCard = Readonly<{
  key: string;
  title: string;
  value: string;
  hint: string;
  tone: 'ok' | 'warn' | 'danger' | 'muted';
}>;

type KpiSparkCell = Readonly<{
  score: number;     // 0..100
  delta: number;     // +/- proxy
  series: number[];
  tone: 'ok' | 'warn' | 'danger' | 'muted';
}>;

type TeamMemberRow = Readonly<{
  avatarText: string;
  name: string;
  username: string;
  email: string;
  roleInTeam: string;
  joinedAt: string | null;
  tenureDays: number | null;
  teamsCount: number;

  // new: real KPI columns
  participationPct: number;     // 0..100 (based on tasks)
  accuracyPct: number;          // 0..100 (based on dueAt/completedAt when available)
  perf: KpiSparkCell;           // composite
}>;

type PeriodKey = '7d' | '30d' | '90d' | 'thisMonth' | 'all';

type PeriodOption = Readonly<{ key: PeriodKey; label: string; }>;

type TeamFilters = Readonly<{
  period: PeriodKey;
  role: 'all' | 'captain' | 'lead' | 'supervisor' | 'member' | 'observer';
  minParticipation: number; // 0..100
  minPerformance: number;   // 0..100
}>;

type TeamBenchmark = Readonly<{
  rank: number;
  totalTeams: number;
  percentile: number; // 0..100 (higher is better)
}>;

// Minimal task shape (safe)
type TaskDto = Readonly<{
  id?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;

  // if exists => real accuracy possible
  dueAt?: string;
  completedAt?: string;

  // assignment can be various shapes depending on your backend
  assignedToId?: string;
  assignedToUsername?: string;

  assignedTo?: Readonly<{
    id?: string;
    username?: string;
  }>;
}>;

// Snapshot from backend for comparing teams (keep minimal)
type TeamSnapshot = Readonly<{
  teamCode: string;
  teamName: string;
  domain?: string;
  memberTotal?: number;
  updatedAt?: string;

  // optional precomputed values if your backend provides (best case)
  healthScore?: number;
}>;

@Component({
  selector: 'app-team-management-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NotificationDialogComponent,
    CustomTableComponent,
    GoogleChartsModule,
  ],
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss',
})
export class ViewComponent implements OnInit {
  @ViewChild( NotificationDialogComponent, { static: true } )
  protected notificationBar!: NotificationDialogComponent;

  protected readonly defaultDomains: ReadonlyArray<TeamDomain> = DEFAULT_TEAM_DOMAINS;

  private teamCode: string | null = null;

  protected team: TeamManagementDto | null = null;

  protected isLoading: boolean = false;
  protected readonly DEFAULT_TEAM_LOGO: string = 'Images/System-images/noImage.png';

  // =======================
  // Filters
  // =======================
  protected readonly periodOptions: PeriodOption[] = [
    { key: '7d', label: 'Last 7 days' },
    { key: '30d', label: 'Last 30 days' },
    { key: '90d', label: 'Last 90 days' },
    { key: 'thisMonth', label: 'This month' },
    { key: 'all', label: 'All time' },
  ];

  protected filters: TeamFilters = {
    period: '30d',
    role: 'all',
    minParticipation: 0,
    minPerformance: 0,
  };

  // =======================
  // Data
  // =======================
  protected allTasks: TaskDto[] = [];
  protected periodTasks: TaskDto[] = [];

  protected periodTaskTotal: number = 0;
  protected periodTaskCompleted: number = 0;

  // =======================
  // UI state
  // =======================
  protected kpiCards: TeamKpiCard[] = [];

  protected memberRows: TeamMemberRow[] = [];
  protected filteredMemberRows: TeamMemberRow[] = [];
  protected memberColumns: TableColumn[] = [];

  // =======================
  // Charts
  // =======================
  protected roleChart: ChartBuild | null = null;
  protected taskChart: ChartBuild | null = null;
  protected tenureChart: ChartBuild | null = null;
  protected healthGauge: ChartBuild | null = null;
  protected engagementGauge: ChartBuild | null = null;

  protected participationChart: ChartBuild | null = null;
  protected memberPerfChart: ChartBuild | null = null;

  // team vs teams
  protected teamCompareChart: ChartBuild | null = null;
  protected benchmark: TeamBenchmark | null = null;

  // Role counts
  protected roleCounts: { lead: number; member: number; supervisor: number; observer: number; captain: number; } =
    { lead: 0, member: 0, supervisor: 0, observer: 0, captain: 0 };

  // comparison snapshot cache
  private teamSnapshots: TeamSnapshot[] = [];

  // ---------- UI helpers ----------
  protected get teamLogoSrc(): string {
    const anyTeam: unknown = this.team;
    const t = anyTeam as { teamLogo?: { url?: string; }, teamLogoUrl?: string; } | null;
    const url = String( t?.teamLogo?.url ?? t?.teamLogoUrl ?? '' ).trim();
    return url || this.DEFAULT_TEAM_LOGO;
  }

  protected get teamName(): string {
    const t = this.team as unknown as { teamName?: string; } | null;
    return String( t?.teamName ?? 'Team' ).trim();
  }

  protected get teamDomain(): string {
    const t = this.team as unknown as { domain?: string; } | null;
    return String( t?.domain ?? '' ).trim();
  }

  protected get teamCodeLabel(): string {
    const t = this.team as unknown as { teamCode?: string; } | null;
    return String( t?.teamCode ?? this.teamCode ?? '' ).trim();
  }

  protected get captainName(): string {
    const anyTeam = this.team as unknown as { captain?: any; } | null;
    const cap = anyTeam?.captain ?? null;
    const name = String( cap?.user?.name ?? cap?.user?.username ?? cap?.username ?? 'Captain' ).trim();
    return name || 'Captain';
  }

  protected get captainRole(): string {
    const anyTeam = this.team as unknown as { captain?: any; } | null;
    const cap = anyTeam?.captain ?? null;
    return String( cap?.roleInTeam ?? 'captain' ).trim().toLowerCase() || 'captain';
  }

  protected get captainEmail(): string {
    const anyTeam = this.team as unknown as { captain?: any; } | null;
    const cap = anyTeam?.captain ?? null;
    return String( cap?.user?.email ?? '' ).trim();
  }

  protected get captainJoinedAt(): string | null {
    const anyTeam = this.team as unknown as { captain?: any; } | null;
    const cap = anyTeam?.captain ?? null;
    return this.tryIso( cap?.joinedAt );
  }

  constructor (
    private readonly teamService: TeamManagementService,
    private readonly router: Router,
    private readonly activeRouter: ActivatedRoute,
    private readonly chartService: ChartService,
    private readonly apiService: APIsService
  ) {
    this.activeRouter.params.subscribe( async ( params ): Promise<void> => {
      try {
        const teamCode: string = String( params[ 'teamID' ] ?? '' ).trim();
        if ( !teamCode ) throw new Error( 'Team code is invalid' );

        await this.loadInit( teamCode );
      } catch ( error ) {
        console.error( '[Error:] [TeamView] Route param resolve failed.\n', error );
        const message: string = ( error instanceof Error ) ? error.message : 'Unexpected error occured!';
        this.notificationBar.notification( 'error', message );
      }
    } );
  }

  public async ngOnInit(): Promise<void> {
    // route subscription triggers loadInit()
  }

  // =========================================================================
  // MAIN LOAD
  // =========================================================================
  private async loadInit( teamCode: string ): Promise<void> {
    try {
      this.isLoading = true;

      if ( !teamCode || typeof teamCode !== 'string' ) {
        throw new Error( 'Invalid team code!' );
      }

      // 1) Load TEAM
      const res = await this.teamService.getTeamById( teamCode.trim() );
      if ( !res?.success ) throw new Error( res?.message ?? 'Failed to fetch data!' );

      const team = this.extractTeamFromResponse( res );
      if ( !team ) throw new Error( 'Team payload not found in response.' );

      this.team = team;
      this.teamCode = String( ( team as any )?.teamCode ?? teamCode ).trim() || teamCode;

      // 2) Load tasks (all) for this team, then apply period slicing
      await this.loadTeamTasks();

      // 3) Load team snapshots (for benchmarking) - safe if API not ready
      await this.loadTeamSnapshotsForBenchmark();

      // 4) Build UI
      this.buildMemberColumns();
      this.buildMemberRowsFromPeriod();   // participation + accuracy computed from periodTasks
      this.applyFilters();                // builds filteredMemberRows
      this.buildKpisFromPeriod();
      this.buildCharts();

    } catch ( error ) {
      console.error( '[Error:] [TeamView] Failed to load team view.\n', error );

      const message: string =
        ( error instanceof HttpErrorResponse )
          ? ( error.error?.message ?? 'Request failed!' )
          : ( ( error instanceof Error ) ? error.message : 'Unexpected error occured!' );

      this.notificationBar.notification( 'error', message );

      this.team = null;
      this.memberRows = [];
      this.filteredMemberRows = [];
      this.kpiCards = [];
      this.roleCounts = { lead: 0, member: 0, supervisor: 0, observer: 0, captain: 0 };

      this.roleChart = null;
      this.taskChart = null;
      this.tenureChart = null;
      this.healthGauge = null;
      this.engagementGauge = null;
      this.participationChart = null;
      this.memberPerfChart = null;

      this.teamCompareChart = null;
      this.benchmark = null;

      this.allTasks = [];
      this.periodTasks = [];
      this.periodTaskTotal = 0;
      this.periodTaskCompleted = 0;

    } finally {
      this.isLoading = false;
    }
  }

  private extractTeamFromResponse( res: unknown ): TeamManagementDto | null {
    const r = res as any;
    const t1 = r?.data?.system?.team;
    const t2 = r?.data?.team;
    const t3 = r?.data?.system?.team?.team;
    const t4 = r?.data?.data?.team;

    const team = ( t1 ?? t2 ?? t3 ?? t4 ?? null ) as TeamManagementDto | null;
    return team && typeof team === 'object' ? team : null;
  }

  // =========================================================================
  // FILTERS (public because template calls it)
  // =========================================================================
  protected applyFilters(): void {
    // 1) rebuild period tasks when period changes
    this.sliceTasksByPeriod();

    // 2) rebuild members from period (so participation/accuracy reflect selected time period)
    this.buildMemberRowsFromPeriod();

    // 3) apply member filters on top
    const role = this.filters.role;
    const minPart = this.clamp( this.filters.minParticipation, 0, 100 );
    const minPerf = this.clamp( this.filters.minPerformance, 0, 100 );

    this.filteredMemberRows = this.memberRows.filter( ( m ): boolean => {
      const roleOk = role === 'all' ? true : m.roleInTeam === role;
      const partOk = m.participationPct >= minPart;
      const perfOk = m.perf.score >= minPerf;
      return roleOk && partOk && perfOk;
    } );

    // 4) refresh KPIs + charts (because they are filter/period-aware)
    this.buildKpisFromPeriod();
    this.buildCharts();
  }

  protected resetFilters(): void {
    this.filters = {
      period: '30d',
      role: 'all',
      minParticipation: 0,
      minPerformance: 0,
    };

    this.applyFilters();
  }

  // =========================================================================
  // LOAD TASKS
  // =========================================================================
  private async loadTeamTasks(): Promise<void> {
    try {
      if ( !this.teamCode ) throw new Error( 'Team code is missing, cannot load tasks.' );

      const res = await this.teamService.getAllTasksForTeam( this.teamCode );
      if ( !res?.success ) throw new Error( res?.message ?? 'Failed to fetch task assignment data!' );

      const tasksRaw = this.apiService.extractArrayFromOther( res.data, 'tasks' );

      const tasks: TaskDto[] = Array.isArray( tasksRaw )
        ? ( tasksRaw.flat().filter( Boolean ) as TaskDto[] )
        : [];

      this.allTasks = tasks;

      // initial slice uses current filter period
      this.sliceTasksByPeriod();

    } catch ( error ) {
      console.error( '[Error:] [TeamView] Failed to load tasks.\n', error );
      this.notificationBar.notification( 'error', ( error instanceof Error ) ? error.message : 'Failed to load tasks.' );

      this.allTasks = [];
      this.periodTasks = [];
      this.periodTaskTotal = 0;
      this.periodTaskCompleted = 0;
    }
  }

  private sliceTasksByPeriod(): void {
    const range = this.getPeriodRange( this.filters.period );
    if ( !range ) {
      this.periodTasks = [ ...this.allTasks ];
    } else {
      this.periodTasks = this.allTasks.filter( ( t ): boolean => {
        const iso = this.pickTaskTimeIso( t );
        if ( !iso ) return false;

        const ms = Date.parse( iso );
        if ( Number.isNaN( ms ) ) return false;

        return ms >= range.fromMs && ms <= range.toMs;
      } );
    }

    this.periodTaskTotal = this.periodTasks.length;
    this.periodTaskCompleted = this.periodTasks.filter( ( t ) =>
      String( t.status ?? '' ).trim().toLowerCase() === 'completed'
    ).length;
  }

  /**
   * Task “time” for period filtering:
   * - prefer completedAt
   * - else updatedAt
   * - else createdAt
   */
  private pickTaskTimeIso( t: TaskDto ): string | null {
    const c1 = this.tryIso( t.completedAt );
    if ( c1 ) return c1;

    const c2 = this.tryIso( t.updatedAt );
    if ( c2 ) return c2;

    const c3 = this.tryIso( t.createdAt );
    if ( c3 ) return c3;

    return null;
  }

  private getPeriodRange( key: PeriodKey ): { fromMs: number; toMs: number; } | null {
    const now = Date.now();

    if ( key === 'all' ) return null;

    if ( key === '7d' ) return { fromMs: now - ( 7 * 86400000 ), toMs: now };
    if ( key === '30d' ) return { fromMs: now - ( 30 * 86400000 ), toMs: now };
    if ( key === '90d' ) return { fromMs: now - ( 90 * 86400000 ), toMs: now };

    // thisMonth
    const d = new Date( now );
    const from = new Date( d.getFullYear(), d.getMonth(), 1 ).getTime();
    return { fromMs: from, toMs: now };
  }

  // =========================================================================
  // TEAM SNAPSHOTS (BENCHMARK)
  // =========================================================================
  private async loadTeamSnapshotsForBenchmark(): Promise<void> {
    try {
      // You must implement this API in your service/backend:
      // - returns small list: teamCode, teamName, memberTotal, updatedAt, optional healthScore
      const res = await this.teamService.getTeamsSnapshotForBenchmark();

      if ( !res?.success ) {
        this.teamSnapshots = [];
        this.benchmark = null;
        this.teamCompareChart = null;
        return;
      }

      const raw = this.apiService.extractArrayFromOther( res.data, 'teams' );
      const teams: TeamSnapshot[] = Array.isArray( raw ) ? ( raw as TeamSnapshot[] ) : [];

      this.teamSnapshots = teams.filter( ( x ) => Boolean( x?.teamCode ) );

      this.buildBenchmarkAndCompareChart();

    } catch ( error ) {
      console.error( '[Warning:] [TeamView] Benchmark snapshot not available.\n', error );
      this.teamSnapshots = [];
      this.benchmark = null;
      this.teamCompareChart = null;
    }
  }

  private buildBenchmarkAndCompareChart(): void {
    if ( !this.teamCode || !this.team ) {
      this.benchmark = null;
      this.teamCompareChart = null;
      return;
    }

    if ( !Array.isArray( this.teamSnapshots ) || this.teamSnapshots.length === 0 ) {
      this.benchmark = null;
      this.teamCompareChart = null;
      return;
    }

    // if backend already provides healthScore => use it
    // else compute locally with same algorithm using available fields (memberTotal + updatedAt)
    const scored = this.teamSnapshots.map( ( s ) => {
      const score = Number.isFinite( s.healthScore as number )
        ? Number( s.healthScore )
        : this.computeTeamHealthScoreFromSnapshot( s );

      return { snap: s, score: this.clamp( score, 0, 100 ) };
    } );

    scored.sort( ( a, b ) => b.score - a.score );

    const total = scored.length;
    const idx = scored.findIndex( ( x ) => x.snap.teamCode === this.teamCode );
    if ( idx < 0 ) {
      this.benchmark = null;
      this.teamCompareChart = null;
      return;
    }

    const rank = idx + 1;
    const percentile = total <= 1 ? 100 : Math.round( ( ( total - rank ) / ( total - 1 ) ) * 100 );

    this.benchmark = {
      rank,
      totalTeams: total,
      percentile,
    };

    // compare chart: show top 7 + current team (if not top)
    const top = scored.slice( 0, 7 );
    const current = scored[ idx ];
    const list = top.some( ( x ) => x.snap.teamCode === current.snap.teamCode )
      ? top
      : [ ...top, current ];

    const categories = list.map( ( x ) => String( x.snap.teamName ?? x.snap.teamCode ).trim() );
    const values = list.map( ( x ) => Math.round( x.score ) );

    const series: SeriesEntry[] = [
      { name: 'Health', values, type: 'bars' }
    ];

    this.teamCompareChart = this.chartService.buildColumn(
      'Team Health vs Teams',
      categories,
      series,
      {
        height: 260,
        legend: { position: 'none' },
        vAxis: { title: 'Health (0-100)', minValue: 0, maxValue: 100 },
        hAxis: { title: 'Teams' },
      }
    );
  }

  /**
   * Local fallback scoring when backend does NOT provide healthScore.
   * Uses same mental model you already used:
   * - engagement from updatedAt recency
   * - capacity from memberTotal
   */
  private computeTeamHealthScoreFromSnapshot( s: TeamSnapshot ): number {
    const memberTotal = Number( s.memberTotal ?? 0 );
    const updatedIso = this.tryIso( s.updatedAt );
    const updatedDaysAgo = updatedIso ? this.daysFrom( updatedIso ) : null;

    const engagementScore = updatedDaysAgo === null ? 50 : this.clamp( 100 - ( updatedDaysAgo * 4.2 ), 0, 100 );
    const capacityScore = this.capacityScore( memberTotal, 5, 12 );

    // if we don't know leadership/stability for other teams, don't fake it heavily:
    const stabilityScore = this.clamp( 55 + ( memberTotal * 2 ), 0, 100 );

    return this.clamp(
      stabilityScore * 0.45 +
      engagementScore * 0.35 +
      capacityScore * 0.20,
      0,
      100
    );
  }

  // =========================================================================
  // TABLE COLUMNS
  // =========================================================================
  private buildMemberColumns(): void {
    this.memberColumns = [
      { key: 'avatarText', label: 'Avatar', type: 'badge', width: '86px', align: 'center' },
      { key: 'name', label: 'Member', type: 'text', width: '280px' },
      { key: 'roleInTeam', label: 'Role', type: 'badge', width: '140px', align: 'center' },
      { key: 'joinedAt', label: 'Joined', type: 'date', width: '160px' },
      { key: 'teamsCount', label: 'Teams', type: 'text', width: '110px', align: 'center' },

      // new KPI columns
      { key: 'participationPct', label: 'Participation', type: 'text', width: '130px', align: 'center' },
      { key: 'accuracyPct', label: 'Accuracy', type: 'text', width: '110px', align: 'center' },

      { key: 'perf', label: 'Performance', type: 'kpiSpark', width: '260px' },
    ];
  }

  // =========================================================================
  // MEMBERS FROM PERIOD TASKS (participation + accuracy)
  // =========================================================================
  private buildMemberRowsFromPeriod(): void {
    if ( !this.team ) {
      this.memberRows = [];
      this.filteredMemberRows = [];
      this.roleCounts = { lead: 0, member: 0, supervisor: 0, observer: 0, captain: 0 };
      return;
    }

    const team = this.team as any;
    const members: TeamMemberDto[] = Array.isArray( team?.members ) ? team.members : [];

    const allPeople: any[] = [
      ...( team?.captain ? [ team.captain ] : [] ),
      ...members
    ];

    this.roleCounts = this.computeRoleCounts( allPeople );

    // map tasks -> per member counts
    const memberTaskMap = this.buildMemberTaskStatsFromPeriod( this.periodTasks );

    this.memberRows = members.map( ( m ) => this.mapMemberToRow( m, memberTaskMap ) );
    this.filteredMemberRows = [ ...this.memberRows ];
  }

  private buildMemberTaskStatsFromPeriod( tasks: TaskDto[] ): Map<string, { assigned: number; completed: number; onTimeCompleted: number; }> {
    const map = new Map<string, { assigned: number; completed: number; onTimeCompleted: number; }>();

    for ( const t of tasks ) {
      const key = this.pickAssigneeKey( t );
      if ( !key ) continue;

      const prev = map.get( key ) ?? { assigned: 0, completed: 0, onTimeCompleted: 0 };
      prev.assigned += 1;

      const status = String( t.status ?? '' ).trim().toLowerCase();
      if ( status === 'completed' ) {
        prev.completed += 1;

        // "accuracy": on-time completion when we have dueAt + completedAt
        const dueIso = this.tryIso( t.dueAt );
        const doneIso = this.tryIso( t.completedAt );
        if ( dueIso && doneIso ) {
          const dueMs = Date.parse( dueIso );
          const doneMs = Date.parse( doneIso );
          if ( !Number.isNaN( dueMs ) && !Number.isNaN( doneMs ) && doneMs <= dueMs ) {
            prev.onTimeCompleted += 1;
          }
        }
      }

      map.set( key, prev );
    }

    return map;
  }

  private pickAssigneeKey( t: TaskDto ): string | null {
    const id = String( t.assignedToId ?? t.assignedTo?.id ?? '' ).trim();
    if ( id ) return `id:${ id }`;

    const u = String( t.assignedToUsername ?? t.assignedTo?.username ?? '' ).trim();
    if ( u ) return `u:${ u.toLowerCase() }`;

    return null;
  }

  private mapMemberToRow(
    m: TeamMemberDto,
    taskStats: Map<string, { assigned: number; completed: number; onTimeCompleted: number; }>
  ): TeamMemberRow {
    const safeName: string = String( m?.user?.name ?? '' ).trim();
    const safeUsername: string = String( m?.user?.username ?? m?.username ?? '' ).trim();
    const safeEmail: string = String( m?.user?.email ?? '' ).trim();

    const role: string = String( m?.roleInTeam ?? 'member' ).trim().toLowerCase();
    const joinedAt: string | null = this.tryIso( m?.joinedAt );
    const tenureDays: number | null = joinedAt ? this.daysFrom( joinedAt ) : null;

    const teamsCount: number = Array.isArray( m?.teams ) ? m.teams.length : 0;

    // participation based on period tasks
    const keyId = String( m?.id ?? '' ).trim();
    const lookupA = keyId ? taskStats.get( `id:${ keyId }` ) : undefined;
    const lookupB = safeUsername ? taskStats.get( `u:${ safeUsername.toLowerCase() }` ) : undefined;
    const stats = lookupA ?? lookupB ?? { assigned: 0, completed: 0, onTimeCompleted: 0 };

    const participationPct = this.computeParticipationPct( stats.assigned, this.periodTaskTotal );
    const accuracyPct = this.computeAccuracyPct( stats.completed, stats.onTimeCompleted );

    // performance: combine role/tenure + participation + accuracy
    const perf = this.computeMemberPerformance( role, tenureDays, teamsCount, participationPct, accuracyPct );

    return {
      avatarText: String( m?.user?.image ?? '' ).trim(),
      name: safeName,
      username: safeUsername,
      email: safeEmail,
      roleInTeam: role,
      joinedAt,
      tenureDays,
      teamsCount,
      participationPct,
      accuracyPct,
      perf,
    };
  }

  private computeParticipationPct( assigned: number, totalTasksInPeriod: number ): number {
    if ( !Number.isFinite( assigned ) || !Number.isFinite( totalTasksInPeriod ) || totalTasksInPeriod <= 0 ) return 0;
    return this.clamp( ( assigned / totalTasksInPeriod ) * 100, 0, 100 );
  }

  /**
   * Accuracy definition:
   * - If dueAt+completedAt exist => onTimeCompleted / completed
   * - If not available => fallback to "completed rate" (completed/assigned) is handled via perf, not accuracy
   */
  private computeAccuracyPct( completed: number, onTimeCompleted: number ): number {
    if ( !Number.isFinite( completed ) || completed <= 0 ) return 0;
    if ( !Number.isFinite( onTimeCompleted ) ) return 0;
    return this.clamp( ( onTimeCompleted / completed ) * 100, 0, 100 );
  }

  private computeMemberPerformance(
    role: string,
    tenureDays: number | null,
    teamsCount: number,
    participationPct: number,
    accuracyPct: number
  ): KpiSparkCell {
    const roleBoost =
      role === 'lead' ? 10 :
        role === 'supervisor' ? 8 :
          role === 'captain' ? 12 :
            role === 'observer' ? -6 : 0;

    const tenureScore = tenureDays === null ? 45 : this.clamp( ( tenureDays / 180 ) * 100, 0, 100 );
    const loadPenalty = this.clamp( teamsCount * 12, 0, 40 );

    // participation drives real contribution in selected period
    const participationScore = this.clamp( participationPct, 0, 100 );

    // accuracy is meaningful only when dueAt/completedAt exist; otherwise stays 0 (neutralized by weighting)
    const hasAccuracySignal = accuracyPct > 0;
    const accWeight = hasAccuracySignal ? 0.20 : 0.00;

    const base = this.clamp(
      ( tenureScore * 0.35 ) +
      ( participationScore * 0.35 ) +
      ( ( 60 - loadPenalty ) * 0.30 ) +
      ( accuracyPct * accWeight ) +
      roleBoost,
      0,
      100
    );

    const series = this.buildDeterministicSparkSeries( base, tenureDays ?? 0, teamsCount );
    const delta = series.length >= 2 ? ( series[ series.length - 1 ] - series[ 0 ] ) : 0;

    return {
      score: Math.round( base ),
      delta: Math.round( delta ),
      series,
      tone: this.scoreTone( base ),
    };
  }

  private buildDeterministicSparkSeries( base: number, tenureDays: number, teamsCount: number ): number[] {
    const pts: number[] = [];
    const seed = ( tenureDays % 31 ) + ( teamsCount * 7 );

    for ( let i = 0; i < 10; i++ ) {
      const wave = Math.sin( ( i + seed ) / 2.0 ) * 5;
      const drift = ( i - 5 ) * 0.6;
      const load = -teamsCount * 0.8;
      const val = this.clamp( base + wave + drift + load, 0, 100 );
      pts.push( Math.round( val ) );
    }

    return pts;
  }

  // =========================================================================
  // KPI CARDS (PERIOD-AWARE)
  // =========================================================================
  private buildKpisFromPeriod(): void {
    const team: any = this.team as any;
    if ( !team ) {
      this.kpiCards = [];
      return;
    }

    const memberTotal: number = Number( team?.memberTotal ?? this.memberRows.length ?? 0 );

    const updatedAtIso: string | null = this.tryIso( team?.updatedAt );
    const updatedDaysAgo: number | null = updatedAtIso ? this.daysFrom( updatedAtIso ) : null;

    // avg participation & accuracy (from members)
    const avgParticipation = this.avg( this.memberRows.map( ( x ) => x.participationPct ) );
    const avgAccuracy = this.avg( this.memberRows.map( ( x ) => x.accuracyPct ) );

    // leadership coverage
    const leadershipCount: number = ( this.roleCounts.lead + this.roleCounts.supervisor + this.roleCounts.captain );
    const leadershipCoverage: number = memberTotal > 0 ? ( leadershipCount / memberTotal ) * 100 : 0;

    // stability proxy (tenure + multi-team load)
    const avgTenureDays: number =
      this.avg( this.memberRows.map( ( x ) => x.tenureDays ).filter( ( x ): x is number => typeof x === 'number' ) );

    const avgTeams: number = this.avg( this.memberRows.map( ( x ) => x.teamsCount ) );

    const stabilityScore: number = this.clamp(
      ( avgTenureDays / 180 ) * 60 + ( 100 - this.clamp( avgTeams * 18, 0, 100 ) ) * 0.40,
      0,
      100
    );

    const engagementScore: number = updatedDaysAgo === null
      ? 50
      : this.clamp( 100 - ( updatedDaysAgo * 4.2 ), 0, 100 );

    const capacityScore: number = this.capacityScore( memberTotal, 5, 12 );
    const leadershipScore: number = this.bandScore( leadershipCoverage, 10, 30 );

    const healthScore: number = this.clamp(
      stabilityScore * 0.30 +
      engagementScore * 0.20 +
      leadershipScore * 0.15 +
      capacityScore * 0.15 +
      avgParticipation * 0.20,
      0,
      100
    );

    const completionRate: number =
      this.periodTaskTotal > 0 ? ( this.periodTaskCompleted / this.periodTaskTotal ) * 100 : 0;

    this.kpiCards = [
      {
        key: 'health',
        title: 'Team Health',
        value: `${ Math.round( healthScore ) }/100`,
        hint: 'Composite (stability + engagement + leadership + capacity + participation)',
        tone: this.scoreTone( healthScore ),
      },
      {
        key: 'taskCompletion',
        title: 'Task Completion',
        value: this.periodTaskTotal > 0 ? `${ completionRate.toFixed( 0 ) }%` : '-',
        hint: `${ this.periodTaskCompleted }/${ this.periodTaskTotal } completed (${ this.filters.period })`,
        tone: this.scoreTone( completionRate ),
      },
      {
        key: 'participation',
        title: 'Participation',
        value: `${ Math.round( avgParticipation ) }%`,
        hint: 'Avg member participation (tasks assigned / team tasks in period)',
        tone: this.scoreTone( avgParticipation ),
      },
      {
        key: 'accuracy',
        title: 'Accuracy',
        value: avgAccuracy > 0 ? `${ Math.round( avgAccuracy ) }%` : '-',
        hint: avgAccuracy > 0 ? 'Avg on-time completion (requires dueAt + completedAt)' : 'No due/completion timing available',
        tone: avgAccuracy > 0 ? this.scoreTone( avgAccuracy ) : 'muted',
      },
    ];

    // benchmark depends on health card; refresh snapshot compare too
    this.buildBenchmarkAndCompareChart();
  }

  // =========================================================================
  // CHARTS
  // =========================================================================
  private buildCharts(): void {
    if ( !this.team ) {
      this.roleChart = null;
      this.taskChart = null;
      this.tenureChart = null;
      this.healthGauge = null;
      this.engagementGauge = null;
      this.participationChart = null;
      this.memberPerfChart = null;
      return;
    }

    // -----------------------------
    // Role donut
    // -----------------------------
    const roleEntries: PieEntry[] = [
      { label: 'Captain', value: this.roleCounts.captain },
      { label: 'Lead', value: this.roleCounts.lead },
      { label: 'Supervisor', value: this.roleCounts.supervisor },
      { label: 'Member', value: this.roleCounts.member },
      { label: 'Observer', value: this.roleCounts.observer },
    ].filter( ( e ) => e.value > 0 );

    this.roleChart = this.chartService.buildDonut(
      'Role Distribution',
      roleEntries,
      0.45,
      { height: 260, legend: { position: 'right' } }
    );

    // -----------------------------
    // Task completion donut (period)
    // -----------------------------
    const completed = this.periodTaskCompleted;
    const pending = Math.max( 0, this.periodTaskTotal - completed );

    const taskEntries: PieEntry[] = [
      { label: 'Completed', value: completed },
      { label: 'Pending', value: pending },
    ].filter( ( e ) => e.value > 0 );

    this.taskChart = this.chartService.buildDonut(
      'Task Completion',
      taskEntries,
      0.50,
      { height: 260, legend: { position: 'right' } }
    );

    // -----------------------------
    // Tenure buckets (all members)
    // -----------------------------
    const buckets = this.buildTenureBuckets( this.memberRows );
    const categories: string[] = Object.keys( buckets );
    const seriesTenure: SeriesEntry[] = [
      { name: 'Members', values: categories.map( ( k ) => buckets[ k ] ?? 0 ), type: 'bars' }
    ];

    this.tenureChart = this.chartService.buildColumn(
      'Tenure Buckets',
      categories,
      seriesTenure,
      {
        height: 260,
        legend: { position: 'none' },
        hAxis: { title: 'Tenure' },
        vAxis: { title: 'Members', minValue: 0 },
      }
    );

    // -----------------------------
    // Gauges (Health + Engagement)
    // -----------------------------
    const healthCard = this.kpiCards.find( ( x ) => x.key === 'health' );
    const engagementValue = this.computeEngagementFromUpdatedAt();

    const healthValue = this.extractScoreFromCard( healthCard?.value );

    this.healthGauge = this.chartService.buildGauge(
      'Team Health',
      [ { label: 'Health', value: healthValue } ],
      {
        height: 220,
        max: 100,
        min: 0,
        greenFrom: 70, greenTo: 100,
        yellowFrom: 45, yellowTo: 70,
        redFrom: 0, redTo: 45,
      }
    );

    this.engagementGauge = this.chartService.buildGauge(
      'Engagement',
      [ { label: 'Engagement', value: engagementValue } ],
      {
        height: 220,
        max: 100,
        min: 0,
        greenFrom: 70, greenTo: 100,
        yellowFrom: 45, yellowTo: 70,
        redFrom: 0, redTo: 45,
      }
    );

    // -----------------------------
    // Member Participation chart (TOP 8)
    // (use FILTERED rows)
    // -----------------------------
    const partTop = [ ...this.filteredMemberRows ]
      .sort( ( a, b ) => b.participationPct - a.participationPct )
      .slice( 0, 8 );

    if ( partTop.length > 0 ) {
      const cats = partTop.map( ( m ) => this.memberLabel( m ) );
      const values = partTop.map( ( m ) => Math.round( m.participationPct ) );

      const s: SeriesEntry[] = [ { name: 'Participation', values, type: 'bars' } ];

      this.participationChart = this.chartService.buildColumn(
        'Member Participation',
        cats,
        s,
        {
          height: 260,
          legend: { position: 'none' },
          vAxis: { title: '%', minValue: 0, maxValue: 100 },
          hAxis: { title: 'Members' },
        }
      );
    } else {
      this.participationChart = null;
    }

    // -----------------------------
    // Member Performance chart (TOP 8)
    // -----------------------------
    const perfTop = [ ...this.filteredMemberRows ]
      .sort( ( a, b ) => b.perf.score - a.perf.score )
      .slice( 0, 8 );

    if ( perfTop.length > 0 ) {
      const cats = perfTop.map( ( m ) => this.memberLabel( m ) );
      const values = perfTop.map( ( m ) => Math.round( m.perf.score ) );

      const s: SeriesEntry[] = [ { name: 'Performance', values, type: 'bars' } ];

      this.memberPerfChart = this.chartService.buildColumn(
        'Member Performance',
        cats,
        s,
        {
          height: 260,
          legend: { position: 'none' },
          vAxis: { title: 'Score (0-100)', minValue: 0, maxValue: 100 },
          hAxis: { title: 'Members' },
        }
      );
    } else {
      this.memberPerfChart = null;
    }
  }

  private memberLabel( m: TeamMemberRow ): string {
    const name = String( m.name ?? '' ).trim();
    const u = String( m.username ?? '' ).trim();
    if ( name ) return name;
    if ( u ) return u;
    return 'Member';
  }

  private computeEngagementFromUpdatedAt(): number {
    const t = this.team as any;
    const updatedAtIso: string | null = this.tryIso( t?.updatedAt );
    const updatedDaysAgo: number | null = updatedAtIso ? this.daysFrom( updatedAtIso ) : null;
    return updatedDaysAgo === null ? 50 : this.clamp( 100 - ( updatedDaysAgo * 4.2 ), 0, 100 );
  }

  // =========================================================================
  // ROLE COUNTS
  // =========================================================================
  private computeRoleCounts( allPeople: any[] ): { lead: number; member: number; supervisor: number; observer: number; captain: number; } {
    const out = { lead: 0, member: 0, supervisor: 0, observer: 0, captain: 0 };

    for ( const p of allPeople ) {
      const r = String( p?.roleInTeam ?? '' ).trim().toLowerCase();

      if ( r === 'captain' ) out.captain += 1;
      else if ( r === 'lead' ) out.lead += 1;
      else if ( r === 'supervisor' ) out.supervisor += 1;
      else if ( r === 'observer' ) out.observer += 1;
      else out.member += 1;
    }

    return out;
  }

  // =========================================================================
  // TENURE BUCKETS
  // =========================================================================
  private buildTenureBuckets( rows: TeamMemberRow[] ): Record<string, number> {
    const buckets: Record<string, number> = {
      '0-30d': 0,
      '31-90d': 0,
      '91-180d': 0,
      '181d+': 0,
    };

    for ( const r of rows ) {
      const d = r.tenureDays ?? 0;

      if ( d <= 30 ) buckets[ '0-30d' ] += 1;
      else if ( d <= 90 ) buckets[ '31-90d' ] += 1;
      else if ( d <= 180 ) buckets[ '91-180d' ] += 1;
      else buckets[ '181d+' ] += 1;
    }

    return buckets;
  }

  private extractScoreFromCard( text: string | undefined ): number {
    const t = String( text ?? '' ).trim();
    if ( !t ) return 0;

    const m = /^(\d+)/.exec( t );
    if ( !m ) return 0;

    const n = Number( m[ 1 ] );
    return Number.isFinite( n ) ? n : 0;
  }

  // =========================================================================
  // HELPERS
  // =========================================================================
  private tryIso( raw: unknown ): string | null {
    if ( typeof raw !== 'string' ) return null;
    const t = raw.trim();
    if ( !t ) return null;
    const ms = Date.parse( t );
    return Number.isNaN( ms ) ? null : t;
  }

  private daysFrom( iso: string ): number {
    const ms = Date.parse( iso );
    const now = Date.now();
    const diff = now - ms;
    return Math.max( 0, Math.floor( diff / 86400000 ) );
  }

  private avg( nums: number[] ): number {
    if ( !Array.isArray( nums ) || nums.length === 0 ) return 0;
    const sum = nums.reduce( ( a, b ) => a + b, 0 );
    return sum / nums.length;
  }

  private clamp( v: number, min: number, max: number ): number {
    if ( !Number.isFinite( v ) ) return min;
    return Math.min( max, Math.max( min, v ) );
  }

  private scoreTone( score: number ): 'ok' | 'warn' | 'danger' | 'muted' {
    if ( !Number.isFinite( score ) ) return 'muted';
    if ( score >= 75 ) return 'ok';
    if ( score >= 55 ) return 'warn';
    return 'danger';
  }

  private capacityScore( count: number, minOk: number, maxOk: number ): number {
    if ( !Number.isFinite( count ) ) return 50;
    if ( count >= minOk && count <= maxOk ) return 100;
    if ( count < minOk ) return this.clamp( ( count / minOk ) * 100, 0, 100 );
    return this.clamp( 100 - ( count - maxOk ) * 8, 0, 100 );
  }

  private bandScore( value: number, minOk: number, maxOk: number ): number {
    if ( !Number.isFinite( value ) ) return 50;
    if ( value >= minOk && value <= maxOk ) return 100;
    if ( value < minOk ) return this.clamp( ( value / minOk ) * 100, 0, 100 );
    return this.clamp( 100 - ( value - maxOk ) * 3, 0, 100 );
  }
}
