// Path: src/app/team-management/view/view.component.ts

import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
  DEFAULT_TEAM_DOMAINS,
  TeamManagementService,
  TeamDomain,
  TeamManagementDto,
  type TeamMemberDto
} from '../../../services/teamManagementService/team-management.service';

import { ChartService, ChartBuild, PieEntry, SeriesEntry } from '../../../services/chartService/chart-service'; // <-- use your real path

import { NotificationDialogComponent } from '../../../components/dialogs/notificationBar/notificationBar.component';
import { CustomTableComponent } from '../../../components/shared/custom-table/custom-table.component';
import { GoogleChartsModule } from 'angular-google-charts';
import { APIsService } from '../../../services/APIs/apis.service';

// If you already have a ColumnConfig type in CustomTable, use it instead of this local type.
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
  score: number;              // 0..100 (proxy score)
  delta: number;              // +/- (proxy)
  series: number[];           // deterministic points for sparkline
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
  perf: KpiSparkCell;
}>;

@Component({
  selector: 'app-team-management-view',
  standalone: true,
  imports: [
    CommonModule,
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

  // Keep ID/code from route
  private teamCode: string | null = null;

  protected team: TeamManagementDto | null = null;

  protected completedTasksCount: number = 0;
  protected totalTasksCount: number = 0; // real from BE task API

  protected isLoading: boolean = false;
  protected readonly DEFAULT_TEAM_LOGO: string = 'Images/System-images/noImage.png';

  // =======================
  // Bootstrap view state
  // =======================
  protected kpiCards: TeamKpiCard[] = [];

  protected memberRows: TeamMemberRow[] = [];
  protected memberColumns: TableColumn[] = [];

  // =======================
  // ChartService outputs
  // (bind directly in template)
  // =======================
  protected roleChart: ChartBuild | null = null;
  protected taskChart: ChartBuild | null = null;
  protected tenureChart: ChartBuild | null = null;
  protected healthGauge: ChartBuild | null = null;
  protected engagementGauge: ChartBuild | null = null;

  // Counts used for legend and KPI logic
  protected roleCounts: { lead: number; member: number; supervisor: number; observer: number; captain: number; } =
    { lead: 0, member: 0, supervisor: 0, observer: 0, captain: 0 };

  // ---------- UI helpers ----------
  protected get teamLogoSrc(): string {
    const anyTeam: any = this.team as any;
    const url = String( anyTeam?.teamLogo?.url ?? anyTeam?.teamLogoUrl ?? '' ).trim();
    return url || this.DEFAULT_TEAM_LOGO;
  }

  protected get teamName(): string {
    return String( ( this.team as any )?.teamName ?? 'Team' ).trim();
  }

  protected get teamDomain(): string {
    return String( ( this.team as any )?.domain ?? '' ).trim();
  }

  protected get teamCodeLabel(): string {
    return String( ( this.team as any )?.teamCode ?? this.teamCode ?? '' ).trim();
  }

  protected get captainName(): string {
    const cap: any = ( this.team as any )?.captain ?? null;
    const name = String( cap?.user?.name ?? cap?.user?.username ?? cap?.username ?? 'Captain' ).trim();
    return name || 'Captain';
  }

  protected get captainRole(): string {
    const cap: any = ( this.team as any )?.captain ?? null;
    const role = String( cap?.roleInTeam ?? 'captain' ).trim().toLowerCase();
    return role || 'captain';
  }

  protected get captainEmail(): string {
    const cap: any = ( this.team as any )?.captain ?? null;
    return String( cap?.user?.email ?? '' ).trim();
  }

  protected get captainJoinedAt(): string | null {
    const cap: any = ( this.team as any )?.captain ?? null;
    return this.tryIso( cap?.joinedAt );
  }

  constructor (
    private readonly teamService: TeamManagementService,
    private readonly router: Router,
    private readonly activeRouter: ActivatedRoute,
    private readonly chartService: ChartService,
    private readonly apiService: APIsService
  ) {
    // Route param -> load
    this.activeRouter.params.subscribe( async ( params ): Promise<void> => {
      try {
        const teamCode: string = params[ 'teamID' ];
        if ( !teamCode ) throw new Error( 'Team code is invalid' );

        await this.loadInit( teamCode );
      } catch ( error ) {
        console.error( '[Error:] [TeamView] Route param resolve failed.\n', error );

        const message: string =
          ( error instanceof Error ) ? error.message : 'Unexpected error occured!';

        this.notificationBar.notification( 'error', message );
      }
    } );
  }

  public async ngOnInit(): Promise<void> {
    // Intentionally empty – route params subscription triggers loadInit()
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

      // 1) Load TEAM (real)
      const res = await this.teamService.getTeamById( teamCode.trim() );

      if ( !res?.success ) {
        throw new Error( res?.message ?? 'Failed to fetch data!' );
      }

      // 2) Extract TEAM safely (supports multiple BE envelopes)
      const team = this.extractTeamFromResponse( res );
      if ( !team ) {
        throw new Error( 'Team payload not found in response.' );
      }

      this.team = team;
      this.teamCode = String( ( team as any )?.teamCode ?? teamCode ).trim() || teamCode;

      // 3) Build UI state
      //    - tasks -> counts (real)
      //    - members -> rows, columns
      //    - KPI cards
      //    - charts
      await this.loadTaskAssignmentView();
      this.buildMemberColumns();
      this.buildMemberRows();
      this.buildKpis();
      this.buildCharts();

    } catch ( error ) {
      console.error( '[Error:] [TeamView] Failed to load team view.\n', error );

      const message: string =
        ( error instanceof HttpErrorResponse )
          ? ( error.error?.message ?? 'Request failed!' )
          : ( ( error instanceof Error ) ? error.message : 'Unexpected error occured!' );

      this.notificationBar.notification( 'error', message );

      // Reset view state on failure (avoid stale UI)
      this.team = null;
      this.memberRows = [];
      this.kpiCards = [];
      this.roleCounts = { lead: 0, member: 0, supervisor: 0, observer: 0, captain: 0 };
      this.roleChart = null;
      this.taskChart = null;
      this.tenureChart = null;
      this.healthGauge = null;
      this.engagementGauge = null;
      this.completedTasksCount = 0;
      this.totalTasksCount = 0;

    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Supports multiple back-end envelopes without breaking the UI.
   * You already used: res.data.system.team
   * This also supports: res.data.team, res.data.system.team.team, res.data.data.team etc.
   */
  private extractTeamFromResponse( res: any ): TeamManagementDto | null {
    const t1 = res?.data?.system?.team;
    const t2 = res?.data?.team;
    const t3 = res?.data?.system?.team?.team; // in case BE nests again
    const t4 = res?.data?.data?.team;

    const team = ( t1 ?? t2 ?? t3 ?? t4 ?? null ) as TeamManagementDto | null;
    return team && typeof team === 'object' ? team : null;
  }

  // =========================================================================
  // LOAD ASSIGN TASKS VIEW (REAL)
  // =========================================================================
  private async loadTaskAssignmentView(): Promise<void> {
    try {
      if ( !this.teamCode ) {
        throw new Error( 'Team code is missing, cannot load task assignment view.' );
      }

      const res = await this.teamService.getAllTasksForTeam( this.teamCode );
      if ( !res?.success ) {
        throw new Error( res?.message ?? 'Failed to fetch task assignment data!' );
      }

      // Expecting tasks somewhere in res.data
      const tasksRaw = this.apiService.extractArrayFromOther( res.data, 'tasks' );

      // Flatten if API returns nested arrays
      const tasks: any[] = Array.isArray( tasksRaw )
        ? tasksRaw.flat().filter( Boolean )
        : [];

      this.totalTasksCount = tasks.length;
      this.completedTasksCount = tasks.filter( ( t: any ) =>
        String( t?.status ?? '' ).trim().toLowerCase() === 'completed'
      ).length;

    } catch ( error ) {
      console.error( '[Error:] [TeamView] Failed to load task assignment view.\n', error );

      const message: string =
        ( error instanceof HttpErrorResponse )
          ? ( error.error?.message ?? 'Request failed!' )
          : ( ( error instanceof Error ) ? error.message : 'Unexpected error occured!' );

      this.notificationBar.notification( 'error', message );

      // keep charts/kpis consistent
      this.totalTasksCount = 0;
      this.completedTasksCount = 0;
    }
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
      { key: 'perf', label: 'Performance', type: 'kpiSpark', width: '260px' },
    ];
  }

  // =========================================================================
  // TABLE DATA (REAL TEAM MEMBERS)
  // =========================================================================
  private buildMemberRows(): void {
    if ( !this.team ) {
      throw new Error( 'Team data is not loaded.' );
    }

    const team: TeamManagementDto = this.team;

    if ( !team ) {
      this.memberRows = [];
      this.roleCounts = { lead: 0, member: 0, supervisor: 0, observer: 0, captain: 0 };
      return;
    }

    // Members array can be missing/null depending on backend
    const members: any[] = Array.isArray( team?.members ) ? team.members : [];

    // role donut includes captain + members
    const allPeople: any[] = [
      ...( team?.captain ? [ team.captain ] : [] ),
      ...members
    ];

    this.roleCounts = this.computeRoleCounts( allPeople );

    // table shows members only
    this.memberRows = members.map( ( m ) => this.mapMemberToRow( m ) );
  }

  private mapMemberToRow( m: TeamMemberDto ): TeamMemberRow {
    const avatar: string = String( m.user?.image ?? '' ).trim();
    const safeName: string = String( m?.user?.name ?? '' ).trim();
    const safeUsername: string = String( m?.user?.username ?? m?.username ?? '' ).trim();
    const safeEmail: string = String( m?.user?.email ?? '' ).trim();

    const role: string = String( m?.roleInTeam ?? 'member' ).trim().toLowerCase();

    const joinedAt: string | null = this.tryIso( m?.joinedAt );
    const tenureDays: number | null = joinedAt ? this.daysFrom( joinedAt ) : null;

    const teamsCount: number = Array.isArray( m?.teams ) ? m.teams.length : 0;

    const perf = this.computeMemberPerfProxy( role, tenureDays, teamsCount );

    return {
      avatarText: avatar,
      name: safeName,
      username: safeUsername,
      email: safeEmail,
      roleInTeam: role,
      joinedAt,
      tenureDays,
      teamsCount,
      perf,
    };
  }

  // =========================================================================
  // KPI CARDS (REAL + DERIVED)
  // =========================================================================
  private buildKpis(): void {
    const team: any = this.team as any;

    if ( !team ) {
      this.kpiCards = [];
      return;
    }

    const memberTotal: number = Number( team?.memberTotal ?? this.memberRows.length ?? 0 );

    // Updated recency -> engagement proxy
    const updatedAtIso: string | null = this.tryIso( team?.updatedAt );
    const updatedDaysAgo: number | null = updatedAtIso ? this.daysFrom( updatedAtIso ) : null;

    // Avg tenure & avg teams
    const avgTenureDays: number =
      this.avg( this.memberRows.map( x => x.tenureDays ).filter( ( x ): x is number => typeof x === 'number' ) );

    const avgTeams: number = this.avg( this.memberRows.map( x => x.teamsCount ) );

    // Leadership coverage = (lead + supervisor + captain) / total
    const leadershipCount: number = ( this.roleCounts.lead + this.roleCounts.supervisor + this.roleCounts.captain );
    const leadershipCoverage: number = memberTotal > 0 ? ( leadershipCount / memberTotal ) * 100 : 0;

    // Stability (tenure helps, many parallel teams hurts)
    const stabilityScore: number = this.clamp(
      ( avgTenureDays / 180 ) * 60 + ( 100 - this.clamp( avgTeams * 18, 0, 100 ) ) * 0.40,
      0,
      100
    );

    // Engagement (more recently updated => higher)
    const engagementScore: number = updatedDaysAgo === null
      ? 50
      : this.clamp( 100 - ( updatedDaysAgo * 4.2 ), 0, 100 );

    // Capacity: tune thresholds for your org
    const capacityScore: number = this.capacityScore( memberTotal, 5, 12 );

    // Leadership: aim 10–30% of people in leadership
    const leadershipScore: number = this.bandScore( leadershipCoverage, 10, 30 );

    // Composite
    const healthScore: number = this.clamp(
      stabilityScore * 0.35 +
      engagementScore * 0.25 +
      leadershipScore * 0.20 +
      capacityScore * 0.20,
      0,
      100
    );

    // Task completion (real from BE)
    const completionRate: number =
      this.totalTasksCount > 0 ? ( this.completedTasksCount / this.totalTasksCount ) * 100 : 0;

    this.kpiCards = [
      {
        key: 'health',
        title: 'Team Health',
        value: `${ Math.round( healthScore ) }/100`,
        hint: 'Composite (stability + engagement + leadership + capacity)',
        tone: this.scoreTone( healthScore ),
      },
      {
        key: 'tasks',
        title: 'Task Completion',
        value: this.totalTasksCount > 0 ? `${ completionRate.toFixed( 0 ) }%` : '-',
        hint: `${ this.completedTasksCount }/${ this.totalTasksCount } completed`,
        tone: this.scoreTone( completionRate ),
      },
      {
        key: 'stability',
        title: 'Stability',
        value: `${ Math.round( stabilityScore ) }/100`,
        hint: `Avg tenure ${ Math.round( avgTenureDays ) }d • Avg teams ${ avgTeams.toFixed( 1 ) }`,
        tone: this.scoreTone( stabilityScore ),
      },
      {
        key: 'engagement',
        title: 'Engagement',
        value: `${ Math.round( engagementScore ) }/100`,
        hint: updatedDaysAgo === null ? 'No updatedAt available' : `Updated ${ updatedDaysAgo } days ago`,
        tone: this.scoreTone( engagementScore ),
      },
    ];
  }

  // =========================================================================
  // CHARTS (ChartService)
  // =========================================================================
  private buildCharts(): void {
    const team: any = this.team as any;

    if ( !team ) {
      this.roleChart = null;
      this.taskChart = null;
      this.tenureChart = null;
      this.healthGauge = null;
      this.engagementGauge = null;
      return;
    }

    // -----------------------------
    // 1) Role distribution donut
    // -----------------------------
    const roleEntries: PieEntry[] = [
      { label: 'Captain', value: this.roleCounts.captain },
      { label: 'Lead', value: this.roleCounts.lead },
      { label: 'Supervisor', value: this.roleCounts.supervisor },
      { label: 'Member', value: this.roleCounts.member },
      { label: 'Observer', value: this.roleCounts.observer },
    ].filter( e => e.value > 0 );

    this.roleChart = this.chartService.buildDonut(
      'Role Distribution',
      roleEntries,
      0.45,
      {
        height: 260,
        legend: { position: 'right' },
      }
    );

    // -----------------------------
    // 2) Tenure buckets (column)
    // -----------------------------
    const buckets = this.buildTenureBuckets( this.memberRows );
    const categories: string[] = Object.keys( buckets );

    const series: SeriesEntry[] = [
      {
        name: 'Members',
        values: categories.map( k => buckets[ k ] ?? 0 ),
        type: 'bars',
      }
    ];

    this.tenureChart = this.chartService.buildColumn(
      'Tenure Buckets',
      categories,
      series,
      {
        height: 260,
        legend: { position: 'none' },
        hAxis: { title: 'Tenure' },
        vAxis: { title: 'Members', minValue: 0 },
      }
    );

    // -----------------------------
    // 3) Gauges (health + engagement)
    // -----------------------------
    const healthCard = this.kpiCards.find( x => x.key === 'health' );
    const engagementCard = this.kpiCards.find( x => x.key === 'engagement' );

    const healthValue = this.extractScoreFromCard( healthCard?.value );
    const engagementValue = this.extractScoreFromCard( engagementCard?.value );

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
    // 4) Task assignment donut (real counts)
    // -----------------------------
    const completed = this.completedTasksCount;
    const pending = Math.max( 0, this.totalTasksCount - completed );

    const taskEntries: PieEntry[] = [
      { label: 'Completed', value: completed },
      { label: 'Pending', value: pending },
    ].filter( e => e.value > 0 );

    this.taskChart = this.chartService.buildDonut(
      'Task Assignment',
      taskEntries,
      0.50,
      {
        height: 260,
        legend: { position: 'right' },
      }
    );
  }

  // =========================================================================
  // ROLE COUNTS (REAL)
  // =========================================================================
  private computeRoleCounts( allPeople: any[] ): { lead: number; member: number; supervisor: number; observer: number; captain: number; } {
    const out = { lead: 0, member: 0, supervisor: 0, observer: 0, captain: 0 };

    for ( const p of allPeople ) {
      const r = String( p?.roleInTeam ?? '' ).trim().toLowerCase();

      // IMPORTANT:
      // - captain must increment captain (not lead)
      // - everything else mapped normally
      if ( r === 'captain' ) out.captain += 1;
      else if ( r === 'lead' ) out.lead += 1;
      else if ( r === 'supervisor' ) out.supervisor += 1;
      else if ( r === 'observer' ) out.observer += 1;
      else out.member += 1;
    }

    return out;
  }

  // =========================================================================
  // MEMBER PERFORMANCE PROXY (DETERMINISTIC, uses REAL fields)
  // =========================================================================
  private computeMemberPerfProxy( role: string, tenureDays: number | null, teamsCount: number ): KpiSparkCell {
    const roleBoost =
      role === 'lead' ? 10 :
        role === 'supervisor' ? 8 :
          role === 'captain' ? 12 :
            role === 'observer' ? -6 : 0;

    const tenureScore = tenureDays === null ? 45 : this.clamp( ( tenureDays / 180 ) * 100, 0, 100 );

    const loadPenalty = this.clamp( teamsCount * 12, 0, 40 );

    const base = this.clamp( ( tenureScore * 0.65 ) + ( 60 - loadPenalty ) * 0.35 + roleBoost, 0, 100 );

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
    return Math.max( 0, Math.floor( diff / ( 1000 * 60 * 60 * 24 ) ) );
  }

  private initials( name: string ): string {
    const parts = name.split( ' ' ).map( x => x.trim() ).filter( Boolean );
    const a = parts[ 0 ]?.[ 0 ] ?? 'U';
    const b = parts.length > 1 ? ( parts[ parts.length - 1 ]?.[ 0 ] ?? '' ) : '';
    return ( a + b ).toUpperCase();
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
