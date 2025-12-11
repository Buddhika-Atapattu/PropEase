// Path: src/app/pages/team-management/create/create.component.ts

// ──────────────────────────────────────────────────────────────────────────────
// Angular & Common
// ──────────────────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────────────────
// Angular Material
// ──────────────────────────────────────────────────────────────────────────────
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';

// ──────────────────────────────────────────────────────────────────────────────
// System components
// ──────────────────────────────────────────────────────────────────────────────
import { NotificationDialogComponent } from '../../../components/dialogs/notification/notificationBar.component';
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

// ──────────────────────────────────────────────────────────────────────────────
// Services & utilities
// ──────────────────────────────────────────────────────────────────────────────
import {
  AllUserWithTeams,
  DEFAULT_ROLES_IN_TEAM,
  DEFAULT_TEAM_DOMAINS,
  RoleInTeam,
  TeamDomain,
  TeamManagement,
  TeamManagementService,
  TeamMember,
} from '../../../services/teamManagementService/team-management.service';
import { TextService } from '../../../services/text/text.service';
import { APIsService } from '../../../services/APIs/apis.service';
import { PaginationUtil } from '../../../source/utility/pagination.utils';

// ──────────────────────────────────────────────────────────────────────────────
// Local table row shapes (frontend-only view models)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Row model for "All users" table (select members / captain).
 */
interface AllUserTable {
  userimage: string;
  name: string;
  reasonTeam: string;
  allTeam: AllUserWithTeams[ 'teams' ] | string;
  addButton: TableButton;
  user: AllUserWithTeams;
}

/**
 * Row model for "Selected members" & "Selected captain" tables.
 * - Stores additional editable fields: roleInTeam, reason, joinedAt.
 */
interface MemberTable {
  userimage: string;
  name: string;
  reasonTeam: string;
  allTeam: AllUserWithTeams[ 'teams' ] | string;
  roleInTeam: TeamMember[ 'roleInTeam' ] | null;
  reason: TeamMember[ 'reason' ] | '';
  joinedAt: TeamMember[ 'joinedAt' ] | null;
  removeButton: TableButton;
  user: AllUserWithTeams;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

@Component( {
  selector: 'app-team-management-create',
  standalone: true,
  imports: [
    // Angular core
    CommonModule,
    FormsModule,

    // Angular Material UI
    MatInputModule,
    MatSelectModule,
    MatIconModule,

    // System components
    Dropdown,
    NotificationDialogComponent,
    ProgressBarComponent,
    CustomTableComponent,
    TextEditorComponent,
  ],
  templateUrl: './create.component.html',
  styleUrl: './create.component.scss',
} )
export class CreateComponent implements OnInit, AfterViewInit, OnDestroy {
  // ────────────────────────────────────────────────────────────
  // ViewChild references (child components)
  // ────────────────────────────────────────────────────────────

  /** Dialog bar for success/error/warning notifications. */
  @ViewChild( NotificationDialogComponent, { static: true } )
  public notificationDialog!: NotificationDialogComponent;

  /** Progress bar dialog for long-running operations. */
  @ViewChild( ProgressBarComponent, { static: true } )
  public progressbarDialog!: ProgressBarComponent;

  /** Shared custom table helper (used for option generation). */
  @ViewChild( CustomTableComponent, { static: true } )
  public customTableComponent!: CustomTableComponent;

  // ────────────────────────────────────────────────────────────
  // Helper constants
  // ────────────────────────────────────────────────────────────

  /** Available team domains (from backend source). */
  protected readonly defaultDomains: ReadonlyArray<TeamDomain> =
    DEFAULT_TEAM_DOMAINS;

  // ────────────────────────────────────────────────────────────
  // Form state (team creation)
  // ────────────────────────────────────────────────────────────

  /** Uploaded team logo file. */
  private teamLog!: File;

  /** Team name (required). */
  protected teamName!: TeamManagement[ 'teamName' ];

  protected teamNameExist: boolean = false;

  /** Team domain (required). */
  protected teamDomain!: TeamDomain;

  /** Members payload (will be derived from tables on submit). */
  private teamMembers!: TeamManagement[ 'members' ];

  /** Team description (rich text editor). */
  protected description!: TeamManagement[ 'description' ];

  /** Team captain payload (derived from captain table). */
  private teamCaptain!: TeamManagement[ 'captain' ];

  // ────────────────────────────────────────────────────────────
  // "All users" table state (select members)
  // ────────────────────────────────────────────────────────────

  private _index: number = 0;
  private _limit: number = 5;
  private _search: string = '';
  private _isLoading: boolean = false;

  protected tableTitle: string = 'Select Team Members';
  protected totalDataCount: number = 0;
  protected tableData: AllUserTable[] = [];

  /** Columns for "All users" table. */
  protected tableColumns: TableColumn[] = [
    { key: 'userimage', label: 'Image' },
    { key: 'name', label: 'Name' },
    { key: 'reasonTeam', label: 'Reason Team' },
    { key: 'allTeam', label: 'Teams' },
    { key: 'addButton', label: 'Add' },
  ];

  /** Current page index (0-based) for member source table. */
  get index(): number {
    return this._index;
  }
  set index( value: number ) {
    this._index = value;
    void this.loadAllUsersWithTeam( this._index, this._limit, this._search );
  }

  /** Page size for member source table. */
  get limit(): number {
    return this._limit;
  }
  set limit( value: number ) {
    this._limit = value;
    void this.loadAllUsersWithTeam( this._index, this._limit, this._search );
  }

  /** Search keyword for member source table. */
  get search(): string {
    return this._search;
  }
  set search( value: string ) {
    this._search = value;
    void this.loadAllUsersWithTeam( this._index, this._limit, this._search );
  }

  /** Loading flag used by custom-table's [(isReload)]. */
  get isLoading(): boolean {
    return this._isLoading;
  }
  set isLoading( value: boolean ) {
    this._isLoading = value;
    if ( this._isLoading ) {
      void this.loadAllUsersWithTeam( this._index, this._limit, this._search );
    }
  }

  // ────────────────────────────────────────────────────────────
  // "All users" table state (select captain)
  // ────────────────────────────────────────────────────────────

  private _captainIndex: number = 0;
  private _captainLimit: number = 5;
  private _captainSearch: string = '';
  private _captainIsLoading: boolean = false;

  protected captainTableTitle: string = 'Select Team Captain';
  protected captainTotalDataCount: number = 0;
  protected captainTableData: AllUserTable[] = [];

  /** Columns for "Select captain" source table. */
  protected captainTableColumns: TableColumn[] = [
    { key: 'userimage', label: 'Image' },
    { key: 'name', label: 'Name' },
    { key: 'reasonTeam', label: 'Reason Team' },
    { key: 'allTeam', label: 'Teams' },
    { key: 'addButton', label: 'Add' },
  ];

  get captainIndex(): number {
    return this._captainIndex;
  }
  set captainIndex( value: number ) {
    this._captainIndex = value;
    void this.loadAllUsersToSelectCaptain(
      this._captainIndex,
      this._captainLimit,
      this._captainSearch,
    );
  }

  get captainLimit(): number {
    return this._captainLimit;
  }
  set captainLimit( value: number ) {
    this._captainLimit = value;
    void this.loadAllUsersToSelectCaptain(
      this._captainIndex,
      this._captainLimit,
      this._captainSearch,
    );
  }

  get captainSearch(): string {
    return this._captainSearch;
  }
  set captainSearch( value: string ) {
    this._captainSearch = value;
    void this.loadAllUsersToSelectCaptain(
      this._captainIndex,
      this._captainLimit,
      this._captainSearch,
    );
  }

  get captainIsLoading(): boolean {
    return this._captainIsLoading;
  }
  set captainIsLoading( value: boolean ) {
    this._captainIsLoading = value;
    if ( this._captainIsLoading ) {
      void this.loadAllUsersToSelectCaptain(
        this._captainIndex,
        this._captainLimit,
        this._captainSearch,
      );
    }
  }

  // ────────────────────────────────────────────────────────────
  // Selected members & captain table state
  // ────────────────────────────────────────────────────────────

  /** Selected members table rows. */
  protected memberTableData: MemberTable[] = [];

  /** Columns for "Selected members" table. */
  protected memberTableColumn: TableColumn[] = [];

  protected memberTableTitle: string = 'Selected Members';

  /** Selected captain table rows (max 1). */
  protected captainSelectTableData: MemberTable[] = [];

  /** Columns for "Selected captain" table. */
  protected captainSelectTableColumn: TableColumn[] = [];

  protected captainSelectTableTitle: string = 'Selected Captain';

  // ────────────────────────────────────────────────────────────
  // Constructor & DI
  // ────────────────────────────────────────────────────────────

  public constructor (
    private readonly teamService: TeamManagementService,
    private readonly router: Router,
    private readonly activeRouter: ActivatedRoute,
    private readonly textService: TextService,
    private readonly apiService: APIsService,
    private readonly cdf: ChangeDetectorRef,
  ) {}

  // ────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ────────────────────────────────────────────────────────────

  public async ngOnInit(): Promise<void> {
    try {
      // Build column definitions for editable tables
      this.buildTeamMemberTableColumns();
      this.buildTeamCaptainTableColumns();
    } catch ( error ) {
      console.warn( error );
    }
  }

  public ngAfterViewInit(): void {
    // Reserved for post-view initialisation if needed
  }

  public ngOnDestroy(): void {
    // Reserved for cleanup (subscriptions, etc.)
  }

  // ────────────────────────────────────────────────────────────
  // Logo upload handler
  // ────────────────────────────────────────────────────────────

  /**
   * Accept team logo from dropdown component.
   * - Ensures exactly one file is provided.
   */
  protected whileLogoUpload( files: File[] ): void {
    try {
      if ( !Array.isArray( files ) ) {
        throw new Error( 'Invalid logo array!' );
      }

      if ( files.length === 0 ) {
        throw new Error( 'Array of logo is empty!' );
      }

      if ( files.length > 1 ) {
        throw new Error( 'Only one logo is accepted!' );
      }

      const file: File = files[ 0 ];

      if ( !file ) {
        throw new Error( 'Invalid logo file!' );
      }

      this.teamLog = file;
    } catch ( error ) {
      console.warn( error );
      return;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Text / label helpers
  // ────────────────────────────────────────────────────────────

  /**
   * Convert enum-like constant to a human-readable label.
   */
  protected sanitiseDefaultValues( text: string ): string {
    try {
      if ( typeof text !== 'string' || !text.trim() ) {
        throw new Error( 'Invalid value in text!' );
      }
      return this.textService.keyToLabel( text );
    } catch ( error ) {
      console.error( error );
      return '';
    }
  }

  // ────────────────────────────────────────────────────────────
  // Validate team name / Check is the name exist
  // ────────────────────────────────────────────────────────────
  protected async validateTeamName( text: string ): Promise<boolean> {
    const safeText = text.trim().toLowerCase() ?? undefined;

    if ( !safeText ) {
      this.teamNameExist = false;
      return false;
    };

    const res = await this.teamService.getTeamByName( safeText );

    if ( res.success ) {
      this.notificationDialog.notification( 'error', 'Team name already exist!' );
      this.teamNameExist = true;
      return true;
    }

    this.teamNameExist = false;
    return false;
  }

  // ────────────────────────────────────────────────────────────
  // Column builders (member & captain selection tables)
  // ────────────────────────────────────────────────────────────

  /**
   * Build columns for "Selected members" table.
   * - Includes inlineSelect / inlineText / inlineDateTime.
   */
  private buildTeamMemberTableColumns(): void {
    this.memberTableColumn = [
      { key: 'userimage', label: 'Image' },
      { key: 'name', label: 'Name' },
      { key: 'reasonTeam', label: 'Reason Team' },
      { key: 'allTeam', label: 'All Teams' },
      {
        key: 'roleInTeam',
        label: 'Role in team',
        edit: {
          kind: 'inlineSelect',
          placeholder: 'Select role',
          options: this.customTableComponent
            .convertArrayIntoObjectPair<RoleInTeam>( DEFAULT_ROLES_IN_TEAM ),
          required: true
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
   * Build columns for "Selected captain" table.
   * - Same editable fields as member table.
   */
  private buildTeamCaptainTableColumns(): void {
    this.captainSelectTableColumn = [
      { key: 'userimage', label: 'Image' },
      { key: 'name', label: 'Name' },
      { key: 'reasonTeam', label: 'Reason Team' },
      { key: 'allTeam', label: 'All Teams' },
      {
        key: 'roleInTeam',
        label: 'Role in team',
        edit: {
          kind: 'inlineSelect',
          placeholder: 'Select role',
          options: this.customTableComponent
            .convertArrayIntoObjectPair<RoleInTeam>( DEFAULT_ROLES_IN_TEAM ),
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

  // ────────────────────────────────────────────────────────────
  // Data re-fetch helper (used by custom-table)
  // ────────────────────────────────────────────────────────────

  /**
   * Trigger re-fetch for both member source and captain source tables.
   */
  protected async reFetchData(
    source: 'members' | 'captain'
  ): Promise<void> {
    try {
      switch ( source ) {

        case 'members':
          await this.loadAllUsersWithTeam(
            this._index,
            this._limit,
            this._search
          );
          break;

        case 'captain':
          await this.loadAllUsersToSelectCaptain(
            this._captainIndex,
            this._captainLimit,
            this._captainSearch
          );
          break;
      }
    }
    catch ( error ) {
      console.error( '[reFetchData] Failed to reload table:', error );
    }
  }

  // ────────────────────────────────────────────────────────────
  // Load "all users with teams" for members
  // ────────────────────────────────────────────────────────────

  /**
   * Load paginated users for "Select Team Members" source table.
   */
  private async loadAllUsersWithTeam(
    index: number,
    limit: number,
    search?: string,
  ): Promise<void> {
    try {
      this._isLoading = true;

      // 1) Fetch total users for pagination
      const totalRes = await this.apiService.getAllUserCount();
      if ( !totalRes.success || totalRes.status !== 'success' ) {
        throw new Error( 'Failed to load total number of users!' );
      }

      const total = totalRes.data?.pagination?.total;
      if (
        !total ||
        Number.isNaN( total ) ||
        !Number.isFinite( total ) ||
        !Number.isInteger( total )
      ) {
        throw new Error( 'Invalid total number of users!' );
      }

      this.totalDataCount = total;

      // 2) Safe pagination values
      const safeIndex: number = PaginationUtil.safeIndex( index, total );
      const safeLimit: number = PaginationUtil.safeLimit( limit, total );
      const safeSearch: string | undefined = search ? search.trim() : undefined;

      // 3) Fetch users + teams
      const res = await this.teamService.getAllUsersWithTeams(
        safeIndex,
        safeLimit,
        safeSearch,
      );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to fetch all users!' );
      }

      const users = this.apiService.extractArrayFromOther<AllUserWithTeams>(
        res.data,
        'users',
      );

      if ( !Array.isArray( users ) || users.length === 0 ) {
        throw new Error( 'Invalid array of users!' );
      }

      // 4) Build table rows
      const rows: AllUserTable[] = users
        .map( ( user ) => this.buildMemberTableRow( user ) )
        .filter( ( row ): row is AllUserTable => row !== null );

      if ( !Array.isArray( rows ) || rows.length === 0 ) {
        throw new Error( 'Failed to build table rows!' );
      }

      this.tableData = [ ...rows ];
      return;
    } catch ( error ) {
      console.error( error );
      if ( error instanceof Error ) {
        this.notificationDialog.notification( 'error', error.message );
      } else if ( error instanceof HttpErrorResponse ) {
        this.notificationDialog.notification( 'error', error.message );
      } else {
        this.notificationDialog.notification(
          'error',
          'Unexpected error occurred while loading user data!',
        );
      }
    } finally {
      this._isLoading = false;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Load "all users with teams" for captain selection
  // ────────────────────────────────────────────────────────────

  /**
   * Load paginated users for "Select Team Captain" source table.
   */
  private async loadAllUsersToSelectCaptain(
    index: number,
    limit: number,
    search?: string,
  ): Promise<void> {
    try {
      this._captainIsLoading = true;

      // 1) Fetch total users
      const totalRes = await this.apiService.getAllUserCount();
      if ( !totalRes.success || totalRes.status !== 'success' ) {
        throw new Error( 'Failed to load total number of users!' );
      }

      const total = totalRes.data?.pagination?.total;
      if (
        !total ||
        Number.isNaN( total ) ||
        !Number.isFinite( total ) ||
        !Number.isInteger( total )
      ) {
        throw new Error( 'Invalid total number of users!' );
      }

      this.captainTotalDataCount = total;

      // 2) Safe pagination values
      const safeIndex: number = PaginationUtil.safeIndex( index, total );
      const safeLimit: number = PaginationUtil.safeLimit( limit, total );
      const safeSearch: string | undefined = search ? search.trim() : undefined;

      // 3) Fetch users + teams
      const res = await this.teamService.getAllUsersWithTeams(
        safeIndex,
        safeLimit,
        safeSearch,
      );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to fetch all users!' );
      }

      const users = this.apiService.extractArrayFromOther<AllUserWithTeams>(
        res.data,
        'users',
      );

      if ( !Array.isArray( users ) || users.length === 0 ) {
        throw new Error( 'Invalid array of users!' );
      }

      // 4) Build table rows
      const rows: AllUserTable[] = users
        .map( ( user ) => this.buildMemberTableRow( user ) )
        .filter( ( row ): row is AllUserTable => row !== null );

      if ( !Array.isArray( rows ) || rows.length === 0 ) {
        throw new Error( 'Failed to build table rows!' );
      }

      this.captainTableData = [ ...rows ];
      return;
    } catch ( error ) {
      console.error( error );
      if ( error instanceof Error ) {
        this.notificationDialog.notification( 'error', error.message );
      } else if ( error instanceof HttpErrorResponse ) {
        this.notificationDialog.notification( 'error', error.message );
      } else {
        this.notificationDialog.notification(
          'error',
          'Unexpected error occurred while loading user data!',
        );
      }
    } finally {
      this._captainIsLoading = false;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Row builders (AllUserTable / MemberTable)
  // ────────────────────────────────────────────────────────────

  /**
   * Map backend AllUserWithTeams → AllUserTable row.
   */
  protected buildMemberTableRow( user: AllUserWithTeams ): AllUserTable | null {
    try {
      if ( !user ) {
        throw new Error( 'Invalid user!' );
      }

      const data: AllUserTable = {
        userimage: user.image as string,
        name: user.name,
        reasonTeam: user.teamName ?? 'No team',
        allTeam: user.teams.length > 0 ? user.teams : 'No registered teams',
        addButton: { icon: 'add_circle', action: 'add', label: 'Add' },
        user,
      };

      return data;
    } catch ( error ) {
      console.error( error );
      return null;
    }
  }

  /**
   * Build MemberTable row from AllUserTable, with optional role override.
   * Used for:
   *  - adding members
   *  - selecting captain (with default "captain" role when available)
   */
  private buildMemberRow(
    source: AllUserTable,
    roleOverride?: RoleInTeam,
  ): MemberTable {
    const removeButton: TableButton = {
      ...source.addButton,
      label: 'Remove',
      action: 'remove',
      icon: 'remove_circle',
    };

    // Default role: either override (captain) or first entry in DEFAULT_ROLES_IN_TEAM
    const defaultRole: RoleInTeam | null =
      roleOverride ?? ( DEFAULT_ROLES_IN_TEAM[ 1 ] ?? null );

    const row: MemberTable = {
      userimage: source.userimage,
      name: source.name,
      reasonTeam: this.teamName ?? source.reasonTeam ?? 'No Team',
      allTeam:
        Array.isArray( source.allTeam ) && source.allTeam.length > 0
          ? source.allTeam
          : 'No registered teams',
      roleInTeam: defaultRole,
      reason: '' as MemberTable[ 'reason' ],
      joinedAt: null,
      removeButton,
      user: source.user,
    };

    return row;
  }

  // ────────────────────────────────────────────────────────────
  // Button operations – select members
  // ────────────────────────────────────────────────────────────

  /**
   * Handle button actions from "All users" member source table.
   * - Currently supports "add" → push into memberTableData.
   */
  protected actionButtonsOperation( value: TableButtonActionConfig ): void {
    try {
      if ( !value ) {
        throw new Error( 'Invalid button data!' );
      }

      const action: string = value.action;
      const row: AllUserTable = value.data;

      if ( !action || !row ) {
        throw new Error( 'Invalid user or action type!' );
      }

      if ( action.toLowerCase() === 'add' ) {
        const teamsCount = row.user.teams.length;

        // Prevent duplicates
        const userExist: MemberTable | undefined =
          this.memberTableData.find(
            ( item ): boolean => item.user.username === row.user.username,
          );

        if ( userExist ) {
          this.notificationDialog.notification(
            'warning',
            'User already exists in the team!',
          );
          return;
        }

        // Prevent over-allocation to many teams
        if ( teamsCount > 5 ) {
          this.notificationDialog.notification(
            'error',
            'User cannot be added to the team due to exceeding the maximum team count!',
          );
          return;
        }

        const buildRow = this.buildMemberRow( row );
        this.memberTableData.push( buildRow );
      }
    } catch ( error ) {
      console.error( error );
      return;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Button operations – selected members table
  // ────────────────────────────────────────────────────────────

  /**
   * Handle remove buttons from "Selected members" table.
   */
  protected memberActionButtonsOperation(
    value: TableButtonActionConfig,
  ): void {
    try {
      if ( !value || !value.data ) {
        throw new Error( 'Invalid table button action payload.' );
      }

      const row: MemberTable = value.data as MemberTable;

      if ( value.action !== 'remove' ) {
        return;
      }

      const index: number = this.memberTableData.findIndex(
        ( item: MemberTable ) => item.user.username === row.user.username,
      );

      if ( index === -1 ) {
        console.warn(
          '[memberActionButtonsOperation] Member not found in memberTableData:',
          row.user.username,
        );
        return;
      }

      this.memberTableData.splice( index, 1 );
      this.notificationDialog.notification(
        'success',
        'Member removed successfully!',
      );
    } catch ( error ) {
      console.error( error );
    } finally {
      // Ensure table picks up the splice mutation.
      this.cdf.detectChanges();
    }
  }

  // ────────────────────────────────────────────────────────────
  // Button operations – select captain from source table
  // ────────────────────────────────────────────────────────────

  /**
   * Handle "add" from captain source table.
   * - Ensures only one captain selected.
   */
  protected captainActionButtonOperationOnSelection(
    value: TableButtonActionConfig,
  ): void {
    try {
      if ( !value || !value.data ) {
        throw new Error( 'Invalid captain button action payload.' );
      }

      const action: string = value.action;
      const row: AllUserTable = value.data as AllUserTable;

      if ( action.toLowerCase() !== 'add' ) {
        return;
      }

      if ( this.captainSelectTableData.length >= 1 ) {
        this.notificationDialog.notification(
          'warning',
          'Only one captain can be selected for a team.',
        );
        return;
      }

      const alreadySelected = this.captainSelectTableData.find(
        ( item: MemberTable ) => item.user.username === row.user.username,
      );

      if ( alreadySelected ) {
        this.notificationDialog.notification(
          'warning',
          'This user is already selected as captain.',
        );
        return;
      }

      // Use "captain" role if it exists in DEFAULT_ROLES_IN_TEAM
      const captainRole =
        ( DEFAULT_ROLES_IN_TEAM.find(
          ( r: RoleInTeam ) => r.toLowerCase() === 'captain',
        ) as RoleInTeam | undefined ) ?? DEFAULT_ROLES_IN_TEAM[ 0 ];

      const captainRow: MemberTable = this.buildMemberRow( row, captainRole );
      this.captainSelectTableData = [ captainRow ];
    } catch ( error ) {
      console.error( error );
    }
  }

  // ────────────────────────────────────────────────────────────
  // Button operations – "Selected captain" table
  // ────────────────────────────────────────────────────────────

  /**
   * Handle remove button from "Selected captain" table.
   */
  protected captainActionButtonOperationAfterSelected(
    value: TableButtonActionConfig,
  ): void {
    try {
      if ( !value || !value.data ) {
        throw new Error( 'Invalid captain selected table payload.' );
      }

      const row: MemberTable = value.data as MemberTable;

      if ( value.action !== 'remove' ) {
        return;
      }

      const index: number = this.captainSelectTableData.findIndex(
        ( item: MemberTable ) => item.user.username === row.user.username,
      );

      if ( index === -1 ) {
        console.warn(
          '[captainActionButtonOperationAfterSelected] Captain not found in table:',
          row.user.username,
        );
        return;
      }

      this.captainSelectTableData.splice( index, 1 );
      this.notificationDialog.notification(
        'success',
        'Captain removed successfully!',
      );
    } catch ( error ) {
      console.error( error );
    } finally {
      this.cdf.detectChanges();
    }
  }

  // ────────────────────────────────────────────────────────────
  // Cell edit handlers – propagate inline edits back to rows
  // ────────────────────────────────────────────────────────────

  /**
   * Handle inline edits from "Selected members" table.
   */
  protected onMemberCellEdit( edit: TableCellEdit ): void {
    try {
      const row = this.memberTableData[ edit.rowIndex ];

      if ( !row ) return;

      switch ( edit.columnKey ) {
        case 'roleInTeam': {
          row.roleInTeam = edit.value as RoleInTeam;
          break;
        }

        case 'reason': {
          row.reason = String( edit.value ?? '' ) as MemberTable[ 'reason' ];
          break;
        }

        case 'joinedAt': {
          row.joinedAt = this.normalizeDateTimeValue(
            edit.value,
          ) as MemberTable[ 'joinedAt' ];
          break;
        }

        default: {
          ( row as any )[ edit.columnKey ] = edit.value;
          break;
        }
      }
    } catch ( error ) {
      console.error( '[onMemberCellEdit] error:', error );
    }
  }

  /**
   * Handle inline edits from "Selected captain" table.
   */
  protected onCaptainCellEdit( edit: TableCellEdit ): void {
    try {
      const row = this.captainSelectTableData[ edit.rowIndex ];
      if ( !row ) return;

      switch ( edit.columnKey ) {
        case 'roleInTeam': {
          row.roleInTeam = edit.value as RoleInTeam;
          break;
        }

        case 'reason': {
          row.reason = String( edit.value ?? '' ) as MemberTable[ 'reason' ];
          break;
        }

        case 'joinedAt': {
          row.joinedAt = this.normalizeDateTimeValue(
            edit.value,
          ) as MemberTable[ 'joinedAt' ];
          break;
        }

        default: {
          ( row as any )[ edit.columnKey ] = edit.value;
          break;
        }
      }
    } catch ( error ) {
      console.error( '[onCaptainCellEdit] error:', error );
    }
  }

  // ────────────────────────────────────────────────────────────
  // Date-time normalisation (string-based, fixes your TS error)
  // ────────────────────────────────────────────────────────────

  /**
   * Normalize date/time from inline editor into a string (ISO-like).
   *
   * NOTE:
   *  - TeamMember['joinedAt'] is a string-like field, so we return `string | null`
   *    to avoid "Type 'Date' is not assignable to type 'string'" errors.
   */
  private normalizeDateTimeValue( input: any ): string | null {
    if ( !input ) return null;

    // Already a Date → convert to ISO string
    if ( input instanceof Date && !isNaN( input.getTime() ) ) {
      return input.toISOString();
    }

    // String input (e.g. from <input type="datetime-local">)
    if ( typeof input === 'string' ) {
      const trimmed = input.trim();
      if ( !trimmed ) return null;

      const dt = new Date( trimmed );
      return isNaN( dt.getTime() ) ? null : dt.toISOString();
    }

    // Fallback: unsupported type → null
    return null;
  }

  // ────────────────────────────────────────────────────────────
  // Mapping MemberTable → TeamMember payload
  // ────────────────────────────────────────────────────────────

  /**
   * Map frontend MemberTable row → backend TeamMember payload.
   */
  private mapMemberRowToTeamMember( row: MemberTable ): TeamMember {
    const base: Partial<TeamMember> = {
      roleInTeam: row.roleInTeam ?? DEFAULT_ROLES_IN_TEAM[ 0 ],
      reason: row.reason || undefined,
      joinedAt: row.joinedAt ?? undefined,
    };

    // Attach user references (adjust keys based on actual TeamMember interface)
    ( base as any ).userId = ( row.user as any )._id ?? ( row.user as any ).id;
    ( base as any ).username = row.user.username;
    ( base as any ).name = row.user.name;

    console.log( base );

    return base as TeamMember;
  }

  /**
   * Build full members array for TeamManagement payload.
   */
  private buildTeamMembersPayload(): TeamMember[] {
    if ( !Array.isArray( this.memberTableData ) ) return [];
    return this.memberTableData.map( ( row: MemberTable ) =>
      this.mapMemberRowToTeamMember( row ),
    );
  }

  /**
   * Build captain payload from "Selected captain" table.
   * - Returns null if no captain was selected.
   */
  private buildTeamCaptainPayload(): TeamMember | null {
    if (
      !Array.isArray( this.captainSelectTableData ) ||
      this.captainSelectTableData.length === 0
    ) {
      return null;
    }

    const row: MemberTable = this.captainSelectTableData[ 0 ];
    return this.mapMemberRowToTeamMember( row );
  }

  // ────────────────────────────────────────────────────────────
  // Submit – build payload and call backend
  // ────────────────────────────────────────────────────────────

  /**
   * Final submit handler:
   *  - Validate required fields
   *  - Build TeamManagement payload
   *  - Attach logo (FormData)
   *  - Call TeamManagementService.createTeam(...)
   */
  protected async submit(): Promise<void> {
    try {
      this.progressbarDialog.start?.();

      // 1) Basic validations
      if ( !this.teamName || !this.teamName.trim() ) {
        throw new Error( 'Team name is required.' );
      }

      if ( this.teamNameExist ) {
        throw new Error( 'Team name already exist select different name.' );
      }

      if ( !this.teamDomain ) {
        throw new Error( 'Team domain is required.' );
      }

      if ( !Array.isArray( this.memberTableData ) || this.memberTableData.length === 0 ) {
        throw new Error( 'Please add at least one team member.' );
      }

      const captainPayload: TeamMember | null = this.buildTeamCaptainPayload();
      if ( !captainPayload ) {
        throw new Error( 'Please select a team captain.' );
      }

      // 2) Build members payload
      const membersPayload: TeamMember[] = this.buildTeamMembersPayload();

      // Ensure captain is part of members list
      const captainUserId = ( captainPayload as any ).userId;
      const captainInMembers = membersPayload.some(
        ( m: TeamMember ) => ( m as any ).userId === captainUserId,
      );
      if ( !captainInMembers ) {
        membersPayload.push( captainPayload );
      }

      // 3) Build TeamManagement payload (without DB-generated fields)
      const teamPayload: Omit<
        TeamManagement,
        '_id' | 'createdAt' | 'updatedAt'
      > = {
        teamName: this.teamName.trim(),
        domain: this.teamDomain,
        members: membersPayload,
        description: this.description ?? '',
        captain: captainPayload,
      } as any;

      // 4) Prepare FormData for logo + JSON payload
      const formData = new FormData();
      formData.append( 'team', JSON.stringify( teamPayload ) );

      if ( this.teamLog ) {
        formData.append( 'teamLogo', this.teamLog );
      }

      // 5) Call backend
      const res = await this.teamService.createTeam( formData );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( res.message || 'Failed to create team.' );
      }

      this.notificationDialog.notification(
        'success',
        'Team created successfully!',
      );

      // 6) Navigate back to list (or overview)
      setTimeout( async (): Promise<boolean> => {
        return await this.router.navigate( [ '/dashboard/team-management/dashboard' ] );
      }, 1000 );
    } catch ( error ) {
      this.progressbarDialog.stop?.();
      console.error( error );

      if ( error instanceof Error ) {
        this.notificationDialog.notification( 'error', error.message );
      } else if ( error instanceof HttpErrorResponse ) {
        this.notificationDialog.notification( 'error', error.message );
      } else {
        this.notificationDialog.notification(
          'error',
          'Failed to create team due to unexpected error!',
        );
      }
      return;
    } finally {
      this.progressbarDialog.complete?.();
    }
  }
}
