// Path: src/app/pages/team-management/edit/edit.component.ts
// ============================================================================
// Team Management - EditComponent (standalone)
// ----------------------------------------------------------------------------
// Responsibilities
//  - Load existing team by route param (teamID) and populate the form
//  - Provide 2 “source” tables:
//      1) pick members
//      2) pick captain
//  - Provide 2 “selected” tables:
//      1) selected members (editable: role/reason/joinedAt)
//      2) selected captain (editable: role/reason/joinedAt)
//  - Build an update payload + send multipart/form-data (team JSON + optional logo)
//
// Design notes
//  - The “setter triggers fetch” pattern is used for pagination/search fields.
//  - To prevent reload loops, do NOT bind custom-table [(isReload)] to *loading* flags.
//  - Always assign new array references (avoid push/splice) for stable change detection.
// ============================================================================

import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { NotificationDialogComponent } from '../../../components/dialogs/notificationBar/notificationBar.component';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import { Dropdown } from '../../../components/shared/dropdown/dropdown';
import {
  CustomTableComponent,
  TableButton,
  TableButtonActionConfig,
  TableCellEdit,
  TableColumn,
} from '../../../components/shared/custom-table/custom-table.component';
import { TextEditorComponent } from '../../../components/shared/textEditor/text-editor';

import {
  DEFAULT_ROLES_IN_TEAM,
  DEFAULT_TEAM_DOMAINS,
  RoleInTeam,
  TeamDomain,
  TeamManagementDto,
  TeamMemberDto,
  type UserWithTeams,
} from '../../../services/teamManagementService/team-management.types';
import { TeamManagementService } from '../../../services/teamManagementService/team-management.service';
import { APIsService } from '../../../services/APIs/apis.service';
import { DownloadService } from '../../../services/downloadService/download.service';
import { TextService } from '../../../services/text/text.service';
import { PaginationUtil } from '../../../source/utility/pagination.utils';

// ============================================================================
// Local view models (table rows)
// ----------------------------------------------------------------------------
// These are *UI rows* used by CustomTableComponent.
// They intentionally contain extra fields (buttons, formatted strings, etc.)
// ============================================================================

interface AllUserTable {
  id: string;
  userimage: string;
  name: string;
  reasonTeam: string;
  allTeams: TeamMemberDto[ 'teams' ] | string;
  addButton: TableButton;
  user: UserWithTeams;
}

interface MemberTable {
  // Stable identity for selected tables (rowIdKey="id")
  id: string;

  userimage: string;
  name: string;
  reasonTeam: string;
  allTeams: TeamMemberDto[ 'teams' ] | string;

  // Editable fields (what we submit back)
  roleInTeam: TeamMemberDto[ 'roleInTeam' ] | null;
  reason: TeamMemberDto[ 'reason' ] | '';
  joinedAt: TeamMemberDto[ 'joinedAt' ] | null;

  removeButton: TableButton;
  user: UserWithTeams; // original DTO (contains id/username/etc.)
}

@Component( {
  selector: 'app-team-management-edit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,

    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatFormFieldModule,

    Dropdown,
    NotificationDialogComponent,
    ProgressBarComponent,
    CustomTableComponent,
    TextEditorComponent,
  ],
  templateUrl: './edit.component.html',
  styleUrl: './edit.component.scss',
} )
export class EditComponent implements OnInit, AfterViewInit, OnDestroy {
  // =========================================================================
  // ViewChild dialogs (used for UI feedback)
  // =========================================================================
  @ViewChild( NotificationDialogComponent, { static: true } )
  public notificationDialog!: NotificationDialogComponent;

  @ViewChild( ProgressBarComponent, { static: true } )
  public progressbarDialog!: ProgressBarComponent;

  // =========================================================================
  // Form model
  // =========================================================================
  protected readonly defaultDomains: ReadonlyArray<TeamDomain> = DEFAULT_TEAM_DOMAINS;

  /** New logo to upload OR existing URL (string) OR null. */
  private teamLogo: File | string | null = null;

  /** Persisted team identifier from backend (required for update). */
  private teamCode: string | null = null;

  protected teamName: TeamManagementDto[ 'teamName' ] = '';
  protected teamNameExist = false;

  protected teamDomain: TeamDomain | null = null;
  protected description: TeamManagementDto[ 'description' ] = '';
  protected teamLogoPreview: string[] = [];

  // =========================================================================
  // Members source table (all users -> add to selected members)
  // -------------------------------------------------------------------------
  // Uses “setter triggers fetch” pattern.
  // Do NOT bind isReload to isLoading (causes loops).
  // =========================================================================
  private _index = 0;
  private _limit = 5;
  private _search = '';
  private _isLoading = false;

  protected tableTitle = 'Select Team Members';
  protected totalDataCount = 0;
  protected tableData: AllUserTable[] = [];

  protected tableColumns: TableColumn[] = [
    { key: 'userimage', label: 'Image' },
    { key: 'name', label: 'Name' },
    { key: 'reasonTeam', label: 'Reason Team' },
    { key: 'allTeams', label: 'Teams' },
    { key: 'addButton', label: 'Add' },
  ];

  get index(): number { return this._index; }
  set index( v: number ) {
    this._index = v;
    void this.loadAllUsersWithTeams( this._index, this._limit, this._search );
  }

  get limit(): number { return this._limit; }
  set limit( v: number ) {
    this._limit = v;
    void this.loadAllUsersWithTeams( this._index, this._limit, this._search );
  }

  get search(): string { return this._search; }
  set search( v: string ) {
    this._search = String( v ?? '' ).trim();
    void this.loadAllUsersWithTeams( this._index, this._limit, this._search );
  }

  get isLoading(): boolean { return this._isLoading; }
  set isLoading( v: boolean ) {
    // NOTE:
    // Keeping setter for backwards compatibility, but this should NOT be used
    // as a “reload trigger”. Only treat it as view state.
    this._isLoading = !!v;
    if ( this._isLoading ) {
      void this.loadAllUsersWithTeams( this._index, this._limit, this._search );
    }
  }

  // =========================================================================
  // Captain source table (all users -> pick 1 captain)
  // =========================================================================
  private _captainIndex = 0;
  private _captainLimit = 5;
  private _captainSearch = '';
  private _captainIsLoading = false;

  protected captainTableTitle = 'Select Team Captain';
  protected captainTotalDataCount = 0;
  protected captainTableData: AllUserTable[] = [];

  protected captainTableColumns: TableColumn[] = [
    { key: 'userimage', label: 'Image' },
    { key: 'name', label: 'Name' },
    { key: 'reasonTeam', label: 'Reason Team' },
    { key: 'allTeams', label: 'Teams' },
    { key: 'addButton', label: 'Add' },
  ];

  get captainIndex(): number { return this._captainIndex; }
  set captainIndex( v: number ) {
    this._captainIndex = v;
    void this.loadAllUsersToSelectCaptain( this._captainIndex, this._captainLimit, this._captainSearch );
  }

  get captainLimit(): number { return this._captainLimit; }
  set captainLimit( v: number ) {
    this._captainLimit = v;
    void this.loadAllUsersToSelectCaptain( this._captainIndex, this._captainLimit, this._captainSearch );
  }

  get captainSearch(): string { return this._captainSearch; }
  set captainSearch( v: string ) {
    this._captainSearch = String( v ?? '' ).trim();
    void this.loadAllUsersToSelectCaptain( this._captainIndex, this._captainLimit, this._captainSearch );
  }

  get captainIsLoading(): boolean { return this._captainIsLoading; }
  set captainIsLoading( v: boolean ) {
    this._captainIsLoading = !!v;
    if ( this._captainIsLoading ) {
      void this.loadAllUsersToSelectCaptain( this._captainIndex, this._captainLimit, this._captainSearch );
    }
  }

  // =========================================================================
  // Selected tables
  // =========================================================================
  protected memberTableData: MemberTable[] = [];
  protected memberTableColumn: TableColumn[] = [];
  protected memberTableTitle = 'Selected Members';

  protected captainSelectTableData: MemberTable[] = [];
  protected captainSelectTableColumn: TableColumn[] = [];
  protected captainSelectTableTitle = 'Selected Captain';

  // =========================================================================
  // Constructor (DI)
  // =========================================================================
  public constructor (
    private readonly teamService: TeamManagementService,
    private readonly router: Router,
    private readonly textService: TextService,
    private readonly apiService: APIsService,
    private readonly cdf: ChangeDetectorRef,
    private readonly: DownloadService,
    private readonly activeRouter: ActivatedRoute,
  ) {}

  // =========================================================================
  // Lifecycle
  // =========================================================================
  public async ngOnInit(): Promise<void> {
    // Build editable column configs (no ViewChild dependency).
    this.buildTeamMemberTableColumns();
    this.buildTeamCaptainTableColumns();

    // Load team from route param.
    this.activeRouter.params.subscribe( async ( params ): Promise<void> => {
      try {
        const teamCode: string = String( params[ 'teamID' ] ?? '' ).trim();
        if ( !teamCode ) throw new Error( 'Invalid team Id' );
        await this.loadteamDataInit( teamCode );
      } catch ( error ) {
        console.error( '[Error:] [TeamEdit] route params init failed.\n', error );
      }
    } );

    // Initial source table loads.
    await this.loadAllUsersWithTeams( this.index, this.limit, this.search );
    await this.loadAllUsersToSelectCaptain( this.captainIndex, this.captainLimit, this.captainSearch );
  }

  public ngAfterViewInit(): void {}
  public ngOnDestroy(): void {}

  // =========================================================================
  // Team load + assignment
  // =========================================================================
  private async loadteamDataInit( teamCode: string ): Promise<void> {
    try {
      if ( !teamCode ) throw new Error( 'Team id is invalid!' );

      const res = await this.teamService.getTeamById( teamCode );

      if ( !res.success ) throw new Error( res.message ?? 'Failed to fetch team data!' );
      if ( !res.data?.system?.team ) throw new Error( 'Invalid team data!' );

      const teamData: TeamManagementDto = res.data.system.team;

      // Fill form inputs
      this.assignValues( teamData );

      // Build selected tables from backend snapshot
      this.memberTableData = this.buildMemberTableFromTeam( teamData );
      this.captainSelectTableData = this.buildCaptainMemberTableFromTeam( teamData );

      this.cdf.detectChanges();
    } catch ( error ) {
      console.error( '[Error:] [TeamEdit] loadteamDataInit failed.\n', error );

      const message =
        error instanceof HttpErrorResponse ? ( error.error?.message ?? error.message )
          : error instanceof Error ? error.message
            : 'Unexpected error occurred!';

      this.notificationDialog.notification( 'error', message );
    }
  }

  private assignValues( data: TeamManagementDto ): void {
    if ( !data ) throw new Error( 'Invalid team data!' );

    this.teamCode = data.teamCode ?? null;
    this.teamName = data.teamName ?? '';
    this.teamDomain = data.domain ?? null;
    this.description = data.description ?? '';

    // Backend logo is commonly shaped { url: string }, but keep it defensive.
    const logoUrl: string =
      typeof ( data as any )?.teamLogo?.url === 'string'
        ? String( ( data as any ).teamLogo.url ).trim()
        : '';

    this.teamLogoPreview = logoUrl ? [ logoUrl ] : [];
  }

  /**
   * Builds selected members table excluding the captain.
   * Keeps a stable row id so inline editing doesn't "jump".
   */
  private buildMemberTableFromTeam( data: TeamManagementDto ): MemberTable[] {
    const members: TeamManagementDto[ 'members' ] = data.members;
    if ( !Array.isArray( members ) ) return [];

    const out: MemberTable[] = [];

    for ( const m of members ) {
      const stableId: string = String( m?.id ?? m?.user?.username ?? '' ).trim();
      if ( !stableId ) {
        console.warn( '[Warning:] [TeamEdit] skipping member with no stable id.\n', m );
        continue;
      }

      // Exclude captain from members table to avoid duplication in UI.
      if ( m.roleInTeam?.toLowerCase() === 'captain' ) continue;

      if ( !m.user ) {
        console.warn( '[Warning:] [TeamEdit] skipping member with no stable id.\n', m );
        continue;
      }

      out.push( {
        id: stableId,

        userimage: typeof m?.user?.image === 'string' ? m.user.image : '',
        name: typeof m?.user?.name === 'string' ? m.user.name : '',
        reasonTeam: typeof m?.teamReason === 'string' ? m.teamReason : ( data.teamName || 'No Team' ),
        allTeams: Array.isArray( m?.teams ) ? m.teams : 'No registered teams',

        roleInTeam: ( m?.roleInTeam ?? 'member' ) as any,
        reason: ( m?.reason ?? '' ) as any,
        joinedAt: ( m?.joinedAt ?? null ) as any,

        removeButton: { icon: 'remove_circle', action: 'remove', label: 'Remove' },
        user: m.user,
      } );
    }

    return out;
  }

  /**
   * Builds selected captain table (should be 0 or 1 row).
   */
  private buildCaptainMemberTableFromTeam( data: TeamManagementDto ): MemberTable[] {
    const members: TeamManagementDto[ 'members' ] = data.members;
    if ( !Array.isArray( members ) ) return [];

    const out: MemberTable[] = [];

    for ( const m of members ) {
      const stableId: string = String( m?.id ?? m?.user?.username ?? '' ).trim();
      if ( !stableId ) {
        console.warn( '[Warning:] [TeamEdit] skipping member with no stable id.\n', m );
        continue;
      }

      if ( !m.user ) {
        console.warn( '[Warning:] [TeamEdit] skipping member with no stable id.\n', m );
        continue;
      }

      if ( m.roleInTeam?.toLowerCase() !== 'captain' ) continue;

      out.push( {
        id: stableId,

        userimage: typeof m?.user?.image === 'string' ? m.user.image : '',
        name: typeof m?.user?.name === 'string' ? m.user.name : '',
        reasonTeam: typeof m?.teamReason === 'string' ? m.teamReason : ( data.teamName || 'No Team' ),
        allTeams: Array.isArray( m?.teams ) ? m.teams : 'No registered teams',

        roleInTeam: ( m?.roleInTeam ?? 'captain' ) as any,
        reason: ( m?.reason ?? '' ) as any,
        joinedAt: ( m?.joinedAt ?? null ) as any,

        removeButton: { icon: 'remove_circle', action: 'remove', label: 'Remove' },
        user: m.user,
      } );
    }

    return out;
  }

  // =========================================================================
  // Logo upload / display helpers
  // =========================================================================
  protected whileLogoUpload( files: File[] ): void {
    try {
      if ( !Array.isArray( files ) || files.length === 0 ) {
        this.teamLogo = null;
        return;
      }

      if ( files.length > 1 ) throw new Error( 'Only one logo is accepted!' );
      this.teamLogo = files[ 0 ] ?? null;
    } catch ( error ) {
      console.warn( '[Warning:] [TeamEdit] logo rejected.\n', error );
    }
  }

  protected sanitiseDefaultValues( text: string ): string {
    try {
      const t = String( text ?? '' ).trim();
      if ( !t ) throw new Error( 'Invalid value in text!' );
      return this.textService.keyToLabel( t );
    } catch ( error ) {
      console.error( '[Error:] [TeamEdit] keyToLabel failed.\n', error );
      return '';
    }
  }

  /**
   * Checks whether the typed name belongs to another team.
   * NOTE: This assumes backend returns a team when the name exists.
   */
  protected async validateTeamName( text: string ): Promise<boolean> {
    const safe = String( text ?? '' ).trim().toLowerCase();
    if ( !safe ) {
      this.teamNameExist = false;
      return false;
    }

    const res = await this.teamService.getTeamByName( safe );

    // If found and it's not the same team, it's a conflict.
    if (
      res.success &&
      res.data?.system?.team &&
      res.data.system.team.teamName !== this.teamName
    ) {
      this.notificationDialog.notification( 'error', 'Team name already exist!' );
      this.teamNameExist = true;
      return true;
    }

    this.teamNameExist = false;
    return false;
  }

  // =========================================================================
  // Column builders (no ViewChild usage)
  // =========================================================================
  private buildSelectOptionsFromArray<T extends string | number>(
    data: readonly T[],
  ): Array<{ label: string; value: T; }> {
    return ( Array.isArray( data ) ? data : [] ).map( ( item ) => ( {
      label: this.textService.keyToLabel( String( item ) ),
      value: item,
    } ) );
  }

  /**
   * Selected members table column definitions (editable).
   */
  private buildTeamMemberTableColumns(): void {
    this.memberTableColumn = [
      { key: 'userimage', label: 'Image' },
      { key: 'name', label: 'Name' },
      { key: 'reasonTeam', label: 'Reason Team' },
      { key: 'allTeams', label: 'All Teams' },
      {
        key: 'roleInTeam',
        label: 'Role in team',
        edit: {
          kind: 'inlineSelect',
          placeholder: 'Select role',
          options: this.buildSelectOptionsFromArray<RoleInTeam>( DEFAULT_ROLES_IN_TEAM ),
          required: true,
        },
      },
      {
        key: 'reason',
        label: 'Reason',
        edit: {
          kind: 'inlineText',
          maxLength: 60,
          placeholder: 'Reason to join',
          required: true,
        },
      },
      {
        key: 'joinedAt',
        label: 'Joined At',
        edit: {
          kind: 'inlineDate',
          placeholder: 'Pick date',
          required: true,
        },
      },
      { key: 'removeButton', label: 'Remove' },
    ];
  }

  /**
   * Selected captain table uses the same edit columns.
   */
  private buildTeamCaptainTableColumns(): void {
    this.captainSelectTableColumn = [ ...this.memberTableColumn ];
  }

  // =========================================================================
  // Fetch hooks (used if you keep (fetchData)="reFetchData('...') in the HTML)
  // =========================================================================
  protected async reFetchData( source: 'members' | 'captain' ): Promise<void> {
    try {
      if ( source === 'members' ) {
        await this.loadAllUsersWithTeams( this.index, this.limit, this.search );
        return;
      }

      await this.loadAllUsersToSelectCaptain( this.captainIndex, this.captainLimit, this.captainSearch );
    } catch ( error ) {
      console.error( '[Error:] [TeamEdit] reFetchData failed.\n', error );
    }
  }

  // =========================================================================
  // Load users (members source table)
  // =========================================================================
  private async loadAllUsersWithTeams( index: number, limit: number, search?: string ): Promise<void> {
    try {
      this._isLoading = true;

      // 1) Read total count (0 is valid)
      const totalRes = await this.apiService.getAllUserCount();
      if ( !totalRes.success || totalRes.status !== 'success' ) {
        throw new Error( 'Failed to load total number of users!' );
      }

      const rawTotal = Number( totalRes.data?.pagination?.total ?? 0 );
      if ( !Number.isFinite( rawTotal ) || !Number.isInteger( rawTotal ) || rawTotal < 0 ) {
        throw new Error( 'Invalid total number of users!' );
      }

      this.totalDataCount = rawTotal;

      // 2) Clamp paging inputs to safe values
      const safeLimit = PaginationUtil.safeLimit( limit, rawTotal );
      const totalPages = Math.max( 1, Math.ceil( rawTotal / safeLimit ) );
      const safeIndex = PaginationUtil.safeIndex( index, totalPages );
      const safeSearch = String( search ?? '' ).trim() || undefined;

      // 3) Load users enriched with teams
      const res = await this.teamService.getAllUsersWithTeams( safeIndex, safeLimit, safeSearch );
      if ( !res.success || res.status !== 'success' ) {
        throw new Error( res.message ?? 'Failed to fetch all users!' );
      }

      const users: UserWithTeams[] =
        ( res.data as any )?.other?.users ??
        ( res.data as any )?.users ??
        [];

      // 4) Map to UI rows (allow empty list)
      const rows = ( Array.isArray( users ) ? users : [] )
        .map( ( u ) => this.buildMemberTableRow( u ) )
        .filter( ( r ): r is AllUserTable => r !== null );

      this.tableData = [ ...rows ];
    } catch ( error ) {
      console.error( '[Error:] [TeamEdit] loadAllUsersWithTeams failed.\n', error );

      const msg =
        error instanceof HttpErrorResponse ? ( error.error?.message ?? error.message )
          : error instanceof Error ? error.message
            : 'Unexpected error occurred while loading user data!';

      this.notificationDialog.notification( 'error', msg );
    } finally {
      this._isLoading = false;
    }
  }

  // =========================================================================
  // Load users (captain source table)
  // =========================================================================
  private async loadAllUsersToSelectCaptain( index: number, limit: number, search?: string ): Promise<void> {
    try {
      this._captainIsLoading = true;

      const totalRes = await this.apiService.getAllUserCount();
      if ( !totalRes.success || totalRes.status !== 'success' ) {
        throw new Error( 'Failed to load total number of users!' );
      }

      const rawTotal = Number( totalRes.data?.pagination?.total ?? 0 );
      if ( !Number.isFinite( rawTotal ) || !Number.isInteger( rawTotal ) || rawTotal < 0 ) {
        throw new Error( 'Invalid total number of users!' );
      }

      this.captainTotalDataCount = rawTotal;

      const safeLimit = PaginationUtil.safeLimit( limit, rawTotal );
      const totalPages = Math.max( 1, Math.ceil( rawTotal / safeLimit ) );
      const safeIndex = PaginationUtil.safeIndex( index, totalPages );
      const safeSearch = String( search ?? '' ).trim() || undefined;

      const res = await this.teamService.getAllUsersWithTeams( safeIndex, safeLimit, safeSearch );
      if ( !res.success || res.status !== 'success' ) {
        throw new Error( res.message ?? 'Failed to fetch all users!' );
      }

      const users: UserWithTeams[] =
        ( res.data as any )?.other?.users ??
        ( res.data as any )?.users ??
        [];

      const rows = ( Array.isArray( users ) ? users : [] )
        .map( ( u ) => this.buildMemberTableRow( u ) )
        .filter( ( r ): r is AllUserTable => r !== null );

      this.captainTableData = [ ...rows ];
    } catch ( error ) {
      console.error( '[Error:] [TeamEdit] loadAllUsersToSelectCaptain failed.\n', error );

      const msg =
        error instanceof HttpErrorResponse ? ( error.error?.message ?? error.message )
          : error instanceof Error ? error.message
            : 'Unexpected error occurred while loading user data!';

      this.notificationDialog.notification( 'error', msg );
    } finally {
      this._captainIsLoading = false;
    }
  }

  // =========================================================================
  // Row builders
  // =========================================================================
  protected buildMemberTableRow( member: UserWithTeams ): AllUserTable | null {
    try {
      if ( !member ) throw new Error( 'Invalid user!' );


      const name = String( member.name ?? member.username ?? '' ).trim();
      if ( !name ) throw new Error( 'Invalid name!' );

      const username = member.username;
      if ( !username ) {
        throw new Error( 'Invalid row id generated!' );
      }

      if ( !member ) {
        throw new Error( 'Invalid user data!' );
      }

      const img =
        typeof ( member as any ).image === 'string'
          ? String( ( member as any ).image ).trim()
          : '';

      const teams = Array.isArray( member.teams ) ? member.teams : [];

      return {
        id: username,
        userimage: img,
        name,
        reasonTeam: String( ( member as any ).teamName ?? 'No team' ),
        allTeams: teams.length > 0 ? teams : 'No registered teams',
        addButton: { icon: 'add_circle', action: 'add', label: 'Add' },
        user: member,
      };
    } catch ( e ) {
      console.warn( '[Warning:] [TeamEdit] skipping invalid user row.\n', e );
      return null;
    }
  }

  private buildMemberRow( source: AllUserTable, roleOverride?: RoleInTeam ): MemberTable {
    const defaultRole: RoleInTeam | null = roleOverride ?? ( DEFAULT_ROLES_IN_TEAM[ 1 ] ?? null );

    return {
      // NOTE: For stability, keep this aligned with rowIdKey in selected tables.
      id: source.user.username,

      userimage: source.userimage,
      name: source.name,
      reasonTeam: this.teamName || source.reasonTeam || 'No Team',
      allTeams: Array.isArray( source.allTeams ) && source.allTeams.length > 0 ? source.allTeams : 'No registered teams',

      roleInTeam: defaultRole,
      reason: '' as MemberTable[ 'reason' ],
      joinedAt: null,

      removeButton: { icon: 'remove_circle', action: 'remove', label: 'Remove' },
      user: source.user,
    };
  }

  // =========================================================================
  // Button actions (source tables + selected tables)
  // =========================================================================
  protected actionButtonsOperation( value: TableButtonActionConfig ): void {
    try {
      if ( !value ) throw new Error( 'Invalid button data!' );

      const action = String( value.action ?? '' ).toLowerCase();
      if ( action !== 'add' ) return;

      const row = value.data as AllUserTable;

      // Prevent duplicates in selected members
      const exists = this.memberTableData.some( ( m ) => m.user.username === row.user.username );
      if ( exists ) {
        this.notificationDialog.notification( 'warning', 'User already exists in the team!' );
        return;
      }

      // Business rule: limit team count (domain-specific; keep consistent with backend rule)
      const teamsCount = Array.isArray( row.user.teams ) ? row.user.teams.length : 0;
      if ( teamsCount > 5 ) {
        this.notificationDialog.notification( 'error', 'User cannot be added due to exceeding max team count!' );
        return;
      }

      this.memberTableData = [ ...this.memberTableData, this.buildMemberRow( row ) ];
      this.cdf.detectChanges();
    } catch ( e ) {
      console.error( '[Error:] [TeamEdit] add member failed.\n', e );
    }
  }

  protected memberActionButtonsOperation( value: TableButtonActionConfig ): void {
    try {
      if ( !value?.data ) throw new Error( 'Invalid table button action payload.' );
      if ( String( value.action ?? '' ).toLowerCase() !== 'remove' ) return;

      const row = value.data as MemberTable;

      this.memberTableData = this.memberTableData.filter( ( m ) => m.user.username !== row.user.username );
      this.notificationDialog.notification( 'success', 'Member removed successfully!' );
    } catch ( e ) {
      console.error( '[Error:] [TeamEdit] remove member failed.\n', e );
    } finally {
      this.cdf.detectChanges();
    }
  }

  protected captainActionButtonOperationOnSelection( value: TableButtonActionConfig ): void {
    try {
      if ( !value?.data ) throw new Error( 'Invalid captain button action payload.' );

      const action = String( value.action ?? '' ).toLowerCase();
      if ( action !== 'add' ) return;

      const row = value.data as AllUserTable;

      if ( this.captainSelectTableData.length >= 1 ) {
        this.notificationDialog.notification( 'warning', 'Only one captain can be selected for a team.' );
        return;
      }

      const already = this.captainSelectTableData.some( ( c ) => c.user.username === row.user.username );
      if ( already ) {
        this.notificationDialog.notification( 'warning', 'This user is already selected as captain.' );
        return;
      }

      const captainRole =
        ( DEFAULT_ROLES_IN_TEAM.find( ( r ) => String( r ).toLowerCase() === 'captain' ) as RoleInTeam | undefined ) ??
        DEFAULT_ROLES_IN_TEAM[ 0 ];

      this.captainSelectTableData = [ this.buildMemberRow( row, captainRole ) ];
      this.cdf.detectChanges();
    } catch ( e ) {
      console.error( '[Error:] [TeamEdit] captain select failed.\n', e );
    }
  }

  protected captainActionButtonOperationAfterSelected( value: TableButtonActionConfig ): void {
    try {
      if ( !value?.data ) throw new Error( 'Invalid captain selected table payload.' );
      if ( String( value.action ?? '' ).toLowerCase() !== 'remove' ) return;

      this.captainSelectTableData = [];
      this.notificationDialog.notification( 'success', 'Captain removed successfully!' );
    } catch ( e ) {
      console.error( '[Error:] [TeamEdit] captain remove failed.\n', e );
    } finally {
      this.cdf.detectChanges();
    }
  }

  // =========================================================================
  // Cell edit handlers (updates selected rows in-place)
  // =========================================================================
  protected onMemberCellEdit( edit: TableCellEdit ): void {
    const row = this.memberTableData[ edit.rowIndex ];
    if ( !row ) return;

    switch ( edit.columnKey ) {
      case 'roleInTeam': row.roleInTeam = edit.value as RoleInTeam; return;
      case 'reason': row.reason = String( edit.value ?? '' ) as any; return;
      case 'joinedAt': row.joinedAt = this.normalizeDateTimeValue( edit.value ) as any; return;
      default: ( row as any )[ edit.columnKey ] = edit.value; return;
    }
  }

  protected onCaptainCellEdit( edit: TableCellEdit ): void {
    const row = this.captainSelectTableData[ edit.rowIndex ];
    if ( !row ) return;

    switch ( edit.columnKey ) {
      case 'roleInTeam': row.roleInTeam = edit.value as RoleInTeam; return;
      case 'reason': row.reason = String( edit.value ?? '' ) as any; return;
      case 'joinedAt': row.joinedAt = this.normalizeDateTimeValue( edit.value ) as any; return;
      default: ( row as any )[ edit.columnKey ] = edit.value; return;
    }
  }

  /**
   * Normalises date-like inputs into ISO strings for backend safety.
   * Returns null when input is empty/invalid.
   */
  private normalizeDateTimeValue( input: any ): string | null {
    if ( !input ) return null;

    if ( input instanceof Date && !isNaN( input.getTime() ) ) {
      return input.toISOString();
    }

    if ( typeof input === 'string' ) {
      const trimmed = input.trim();
      if ( !trimmed ) return null;

      const dt = new Date( trimmed );
      return isNaN( dt.getTime() ) ? null : dt.toISOString();
    }

    return null;
  }

  // =========================================================================
  // DTO builders + submit
  // =========================================================================
  private mapMemberRowToDto( row: MemberTable ): TeamMemberDto {
    const id = String( ( row.user as any )?._id ?? ( row.user as any )?.id ?? '' ).trim();
    if ( !id ) throw new Error( 'Invalid user id for TeamMemberDto.' );

    const username = String( row.user.username ?? '' ).trim();
    if ( !username ) throw new Error( 'Invalid username for TeamMemberDto.' );

    return {
      id,
      username,
      roleInTeam: row.roleInTeam ?? DEFAULT_ROLES_IN_TEAM[ 0 ],
      reason: row.reason || undefined,
      joinedAt: row.joinedAt ?? undefined,
    };
  }

  private buildMembersDto(): TeamMemberDto[] {
    return this.memberTableData.map( ( r ) => this.mapMemberRowToDto( r ) );
  }

  private buildCaptainDto(): TeamMemberDto | null {
    if ( !this.captainSelectTableData.length ) return null;
    return this.mapMemberRowToDto( this.captainSelectTableData[ 0 ] );
  }

  protected async submit(): Promise<void> {
    try {
      this.progressbarDialog.start?.();

      // Basic validation
      if ( !this.teamCode ) throw new Error( 'Team id is required!' );
      if ( !this.teamName || !this.teamName.trim() ) throw new Error( 'Team name is required.' );
      if ( this.teamNameExist ) throw new Error( 'Team name already exist select different name.' );
      if ( !this.teamDomain ) throw new Error( 'Team domain is required.' );
      if ( !this.memberTableData.length ) throw new Error( 'Please add at least one team member.' );

      const captain = this.buildCaptainDto();
      if ( !captain ) throw new Error( 'Please select a team captain.' );

      const members = this.buildMembersDto();

      // Ensure captain included in members (backend expectation)
      const captainInMembers = members.some( ( m ) => m.id === captain.id );
      if ( !captainInMembers ) members.push( captain );

      // Update payload should not include server-managed fields
      const payload: Partial<TeamManagementDto> = {
        teamName: this.teamName.trim(),
        domain: this.teamDomain,
        description: this.description ?? '',
        members,
        captain,
      };

      const formData = new FormData();
      formData.append( 'team', JSON.stringify( payload ) );

      // Key name must match backend multer field name.
      if ( this.teamLogo ) formData.append( 'teamLogo', this.teamLogo );

      const res = await this.teamService.updateTeam( this.teamCode, formData );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( res.message || 'Failed to update team.' );
      }

      this.notificationDialog.notification( 'success', res.message ?? 'Team updated successfully!' );
      setTimeout( () => void this.router.navigate( [ '/dashboard/team-management/dashboard' ] ), 700 );
    } catch ( error ) {
      console.error( '[Error:] [TeamEdit] submit failed.\n', error );

      const msg =
        error instanceof HttpErrorResponse ? ( error.error?.message ?? error.message )
          : error instanceof Error ? error.message
            : 'Failed to update team due to unexpected error!';

      this.notificationDialog.notification( 'error', msg );
    } finally {
      this.progressbarDialog.complete?.();
    }
  }
}
