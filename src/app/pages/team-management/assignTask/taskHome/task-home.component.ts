// Path: src/app/pages/team-management/assignTask/taskHome/task-home.component.ts
// ============================================================================
// AssignTaskComponent (Normalized + Teaching Comments)
// ----------------------------------------------------------------------------
// ✅ CustomTable: Complaints, Members, Tasks
// ✅ Select members by table buttons (Select/Remove)
// ✅ Captain ALWAYS selected (cannot be removed)
// ✅ Max 5 assignees total (including captain)
// ✅ Template-driven form (ngForm)
// ✅ ALL date inputs use Material Datepicker (touchUi ok) => bind Date | null
// ✅ KPI range uses Date objects (Material Datepicker) + in-memory filtering
//
// IMPORTANT NOTE (Google Charts 3D):
// - Google PieChart supports either:
//     A) Donut mode: pieHole (2D only)
//     B) 3D mode: is3D (NO pieHole)
// - You asked for “3D charts”, so KPI status/priority are implemented as 3D Pie
//   (not donut). If you want donut back, set is3D:false and restore pieHole.
// ============================================================================

import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { ChartType, GoogleChartsModule, type Column, type Row } from 'angular-google-charts';
import { Subject, timer } from 'rxjs';
import { exhaustMap, takeUntil } from 'rxjs/operators';

import {
  DEFAULT_TASK_PRIORITIES,
  DEFAULT_TASK_STATUS,
  type AssignedTaskDto,
  type TaskPriority,
  type TaskStatus,
  type TeamManagementDto,
  type TeamMemberDto,
} from '../../../../services/teamManagementService/team-management.types';
import { TeamManagementService } from '../../../../services/teamManagementService/team-management.service';

import { TenantService, type ComplaintClient } from '../../../../services/tenant/tenant.service';

import { NotificationDialogComponent } from '../../../../components/dialogs/notificationBar/notificationBar.component';
import { ProgressBarComponent } from '../../../../components/dialogs/progress-bar/progress-bar.component';

import {
  CustomTableComponent,
  type TableButton,
  type TableButtonActionConfig,
  type TableColumn,
} from '../../../../components/shared/custom-table/custom-table.component';

import { PaginationUtil } from '../../../../source/utility/pagination.utils';

import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { TextEditorComponent } from '../../../../components/shared/textEditor/text-editor';
import { Textarea } from '../../../../components/shared/textarea/textarea.component';

// ─────────────────────────────────────────────────────────────────────────────
// Local view models (CustomTable rows)
// ─────────────────────────────────────────────────────────────────────────────
type ComplaintRow = Readonly<{
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  createdAt?: string;
  customerName?: string;
  propertyRef?: string;

  viewButton: TableButton;
  addButton: TableButton;

  _raw: ComplaintClient;
}>;

type MemberTableRow = Readonly<{
  image: string | null;
  id: string;

  name: string;
  username: string;

  roleinteam: string;
  role: string;
  email: string;

  assignedTaskCount: number;

  isCaptain: boolean;
  isSelected: boolean;

  addButton: TableButton;
  removeButton: TableButton;
}>;

type TaskRow = Readonly<{
  id: string;
  name: string;
  status: string;
  priority: string;
  assignedCount: number;
  plannedStartAt?: string;
  plannedEndAt?: string;
  completedAt?: string;
  confirmation: string;

  viewButton: TableButton;
  editButton: TableButton;
}>;

type ChartBuild = Readonly<{
  type: ChartType;
  columns: Column[];
  data: Row[];
  options: Record<string, unknown>;
}>;

type SelectedChip = Readonly<{
  id: string;
  name: string;
  isCaptain: boolean;
}>;

// Strong tuple (prevents (string|number)[][] typing problems)
type Pair = readonly [ string, number ];

@Component( {
  selector: 'app-assign-task',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,

    GoogleChartsModule,

    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,

    NotificationDialogComponent,
    ProgressBarComponent,
    CustomTableComponent,
    TextEditorComponent,
    Textarea,
  ],
  templateUrl: './task-home.component.html',
  styleUrl: './task-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class TaskHomeComponent implements OnInit, OnDestroy {

  // =========================================================================
  // 01) CHILD COMPONENTS
  // =========================================================================
  @ViewChild( NotificationDialogComponent, { static: true } )
  protected notificationBar!: NotificationDialogComponent;

  @ViewChild( ProgressBarComponent, { static: true } )
  protected progressBar!: ProgressBarComponent;

  // =========================================================================
  // 02) SSR + DESTROY
  // =========================================================================
  private readonly isBrowser: boolean;
  private readonly destroy$ = new Subject<void>();

  // =========================================================================
  // 03) ROUTE / DATA
  // =========================================================================
  protected teamID: string | null = null;
  private routeLoadSeq = 0; // “latest route load wins” protection

  protected team: TeamManagementDto | null = null;
  protected members: TeamMemberDto[] = [];
  protected tasks: AssignedTaskDto[] = [];

  protected isLoading = false;
  protected isSubmitting = false;

  // =========================================================================
  // 04) POLLING
  // =========================================================================
  protected readonly pollSeconds = 10;
  private pollActive = false;

  // =========================================================================
  // 05) MEMBER SELECTION RULES
  // =========================================================================
  protected readonly maxAssignees = 5;

  private captainMemberId: string | null = null;

  // Selected set is the source-of-truth; chips are derived from it
  protected selectedMemberKeys = new Set<string>();
  protected selectedMemberChips: SelectedChip[] = [];

  // =========================================================================
  // 06) FORM (TEMPLATE-DRIVEN)
  // =========================================================================
  protected readonly statusList: ReadonlyArray<TaskStatus> = DEFAULT_TASK_STATUS;
  protected readonly priorityList: ReadonlyArray<TaskPriority> = DEFAULT_TASK_PRIORITIES;

  protected isComplaintAutofill = false;
  protected lockedComplaintCode: string | null = null;

  protected taskName: AssignedTaskDto[ 'name' ] = '';
  protected taskDescription: AssignedTaskDto[ 'description' ] = '';

  protected taskStatus: TaskStatus = 'pending' as TaskStatus;
  protected taskPriority: TaskPriority = 'medium' as TaskPriority;

  protected taskAssignedCaptain: AssignedTaskDto[ 'assignedTaskCaptain' ] | null = null;
  protected taskNotes: string = '';

  // Material Datepicker => Date | null
  protected taskPlannedStartAtLocal: Date | null = null;
  protected taskPlannedEndAtLocal: Date | null = null;

  protected confirmBy: 'supervisor' | 'customer' = 'supervisor';

  protected taskDescriptionTouched = false;

  private assignComplaint: ComplaintClient | null = null;

  // =========================================================================
  // 07) KPI RANGE (Material Datepicker => Date | null)
  // =========================================================================
  protected kpiFromDateObj: Date | null = null;
  protected kpiToDateObj: Date | null = null;

  // ✅ 3D Pie (not donut) per user requirement
  protected kpiStatusDonut: ChartBuild | null = null;
  protected kpiPriorityDonut: ChartBuild | null = null;
  protected kpiCompletionBar: ChartBuild | null = null;

  // =========================================================================
  // 08) CUSTOM TABLE: COMPLAINTS
  // =========================================================================
  protected complaintTableTitle = 'New Complaints';
  protected complaintTableColumns: TableColumn[] = [];
  protected complaintTableData: ComplaintRow[] = [];
  protected complaintTableTotalCount = 0;

  protected complaintTableIsReloading = false;
  protected complaintTableIndex = 0;   // page index
  protected complaintPageSize = 10;

  // =========================================================================
  // 09) CUSTOM TABLE: MEMBERS
  // =========================================================================
  protected memberTableTitle: string = 'Team Members';
  protected memberTableColumns: TableColumn[] = [];
  protected memberTableData: MemberTableRow[] = [];
  protected memberTableTotalCount = 0;

  protected memberTableIsReloading = false;
  protected memberTableIndex = 0;     // page index
  protected memberPageSize = 10;

  // =========================================================================
  // 10) CUSTOM TABLE: ALL TASKS
  // =========================================================================
  protected teamAllTaskTableTitle = 'All Team Tasks';
  protected teamAllTaskTableColumns: TableColumn[] = [];
  protected teamAllTaskTableData: TaskRow[] = [];
  protected teamTaskTableTotalCount = 0;

  protected teamAllTaskIsReloading = false;
  protected teamAllTaskTableIndex = 0; // page index
  protected teamAllTaskPageSize = 10;

  // =========================================================================
  // 11) CONSTRUCTOR
  // =========================================================================
  public constructor (
    private readonly teamService: TeamManagementService,
    private readonly tenantService: TenantService,
    private readonly activeRouter: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    @Inject( PLATFORM_ID ) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
  }

  // =========================================================================
  // 12) LIFECYCLE
  // =========================================================================
  public async ngOnInit(): Promise<void> {
    this.buildComplaintColumns();
    this.buildMemberColumns();
    this.buildTaskColumns();

    // Preload complaints list (independent of route)
    await this.newComplaintDataInit( 0, this.complaintPageSize );

    // Route changes => reload team/task/member context
    const parent = this.activeRouter.parent;
    if ( !parent ) {
      console.error( '[Error:] [AssignTask] Parent route missing.\n' );
      return;
    }

    parent.paramMap
      .pipe( takeUntil( this.destroy$ ) )
      .subscribe( () => void this.onRouteChanged() );

  }

  public ngOnDestroy(): void {
    this.stopPolling();

    this.destroy$.next();
    this.destroy$.complete();
  }

  // =========================================================================
  // 13) ROUTE LOADER
  // =========================================================================
  private async onRouteChanged(): Promise<void> {
    const seq = ++this.routeLoadSeq;

    try {
      // ✅ teamId is on PARENT route: /assign-task/:teamId
      const teamId: string =
        String( this.activeRouter.parent?.snapshot.paramMap.get( 'teamId' ) ?? '' ).trim();

      if ( !teamId ) {
        throw new Error( 'Team ID is missing in route param.' );
      }

      this.teamID = teamId;

      this.isLoading = true;
      this.cdr.markForCheck();

      await this.loadTeamAndTasks( teamId, seq );

      this.applyCaptainAlwaysSelected();

      await this.memberTableDataInit( this.memberTableIndex, this.memberPageSize );
      await this.teamTaskDataInit( this.teamAllTaskTableIndex, this.teamAllTaskPageSize );

      this.rebuildKpis();
      this.startPolling();
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [AssignTask] Route init failed.\n', error );

      const msg = error instanceof Error ? error.message : 'Unexpected error occurred!';
      this.notificationBar.notification( 'error', msg );

      this.resetAllState();
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }


  private resetAllState(): void {
    this.teamID = null;

    this.team = null;
    this.members = [];
    this.tasks = [];

    this.captainMemberId = null;

    this.selectedMemberKeys.clear();
    this.selectedMemberChips = [];

    this.memberTableData = [];
    this.memberTableTotalCount = 0;

    this.teamAllTaskTableData = [];
    this.teamTaskTableTotalCount = 0;

    this.kpiStatusDonut = null;
    this.kpiPriorityDonut = null;
    this.kpiCompletionBar = null;

    this.stopPolling();

    this.cdr.markForCheck();
  }

  // =========================================================================
  // 14) CAPTAIN ALWAYS SELECTED
  // =========================================================================
  private applyCaptainAlwaysSelected(): void {
    const captainId = this.resolveCaptainMemberId( this.team );
    this.captainMemberId = captainId;

    // Reset selection to only captain first
    this.selectedMemberKeys.clear();
    if ( captainId ) this.selectedMemberKeys.add( captainId );

    // Show captain name in the form (optional)
    this.taskAssignedCaptain = this.resolveCaptainDisplayName( this.team );

    this.rebuildSelectedChips();
    this.cdr.markForCheck();
  }

  private resolveCaptainMemberId( team: TeamManagementDto | null ): string | null {
    const anyTeam: any = team as any;

    const idCandidates: unknown[] = [
      anyTeam?.captain?.id,
      anyTeam?.captain?._id,
      anyTeam?.captain?.user?.id,
      anyTeam?.captain?.user?._id,
    ];

    for ( const c of idCandidates ) {
      const id = String( c ?? '' ).trim();
      if ( id ) return id;
    }

    // Fallback: first member (not ideal, but prevents “no captain selected” UX)
    const firstMemberId =
      Array.isArray( anyTeam?.members ) && anyTeam.members.length > 0
        ? String( anyTeam.members[ 0 ]?.id ?? anyTeam.members[ 0 ]?._id ?? '' ).trim()
        : '';

    return firstMemberId || null;
  }

  private resolveCaptainDisplayName( team: TeamManagementDto | null ): string | null {
    const anyTeam: any = team as any;

    const nameCandidates: unknown[] = [
      anyTeam?.captain?.user?.name,
      anyTeam?.captain?.name,
      anyTeam?.captain?.username,
      anyTeam?.captain?.user?.username,
    ];

    for ( const c of nameCandidates ) {
      const name = String( c ?? '' ).trim();
      if ( name ) return name;
    }

    return null;
  }

  // =========================================================================
  // 15) MEMBER SELECTION
  // =========================================================================
  protected clearSelectedMembers(): void {
    this.selectedMemberKeys.clear();

    if ( this.captainMemberId ) {
      this.selectedMemberKeys.add( this.captainMemberId );
    }

    this.rebuildSelectedChips();

    void this.memberTableDataInit( this.memberTableIndex, this.memberPageSize );

    this.cdr.markForCheck();
  }

  protected removeSelectedMember( memberId: string ): void {
    const id = String( memberId ?? '' ).trim();
    if ( !id ) return;

    if ( this.captainMemberId && id === this.captainMemberId ) {
      this.notificationBar.notification( 'warning', 'Captain is always selected and cannot be removed.' );
      return;
    }

    this.selectedMemberKeys.delete( id );

    this.rebuildSelectedChips();
    void this.memberTableDataInit( this.memberTableIndex, this.memberPageSize );

    this.cdr.markForCheck();
  }

  private canSelectMoreMembers(): boolean {
    return this.selectedMemberKeys.size < this.maxAssignees;
  }

  private rebuildSelectedChips(): void {
    const idToName = this.buildMemberNameMap();
    const ids = Array.from( this.selectedMemberKeys.values() );

    this.selectedMemberChips = ids.map( ( id ) => {
      const name = idToName.get( id ) ?? id;

      return {
        id,
        name,
        isCaptain: !!this.captainMemberId && id === this.captainMemberId,
      };
    } );

    // Captain first; rest alphabetical
    this.selectedMemberChips.sort( ( a, b ) => {
      if ( a.isCaptain && !b.isCaptain ) return -1;
      if ( !a.isCaptain && b.isCaptain ) return 1;
      return a.name.localeCompare( b.name );
    } );
  }

  private buildMemberNameMap(): Map<string, string> {
    const map = new Map<string, string>();

    for ( const m of this.members ) {
      const id = String( ( m as any )?.id ?? ( m as any )?._id ?? '' ).trim();
      if ( !id ) continue;

      const name = String( ( m as any )?.user?.name ?? ( m as any )?.user?.username ?? '' ).trim();
      map.set( id, name || id );
    }

    return map;
  }

  // =========================================================================
  // 16) FORM HELPERS
  // =========================================================================
  protected isDescriptionValid(): boolean {
    const t = String( this.taskDescription ?? '' ).trim();
    return t.length >= 5;
  }

  protected clearAndUnlockTaskForm(): void {
    this.isComplaintAutofill = false;
    this.lockedComplaintCode = null;

    this.taskName = '';
    this.taskDescription = '';
    this.taskDescriptionTouched = false;

    this.taskStatus = 'pending' as TaskStatus;
    this.taskPriority = 'medium' as TaskPriority;

    this.taskNotes = '';

    this.taskPlannedStartAtLocal = null;
    this.taskPlannedEndAtLocal = null;

    this.confirmBy = 'supervisor';

    this.clearSelectedMembers();

    this.notificationBar.notification( 'info', 'Form cleared. Manual mode enabled.' );
    this.cdr.markForCheck();
  }

  // =========================================================================
  // 17) SUBMIT
  // =========================================================================
  protected async submitAssignTask( form: NgForm ): Promise<void> {
    try {
      if ( !this.teamID ) throw new Error( 'Missing Team ID.' );

      this.taskDescriptionTouched = true;

      if ( !form.valid || !this.isDescriptionValid() ) {
        this.notificationBar.notification( 'warning', 'Please fill required fields correctly.' );
        this.cdr.markForCheck();
        return;
      }

      const assignedMembers = Array.from( this.selectedMemberKeys.values() );

      if ( assignedMembers.length === 0 ) {
        this.notificationBar.notification( 'warning', 'Select at least one member.' );
        this.cdr.markForCheck();
        return;
      }

      if ( assignedMembers.length > this.maxAssignees ) {
        this.notificationBar.notification(
          'warning',
          `You can assign maximum ${ this.maxAssignees } members at a time.`
        );
        this.cdr.markForCheck();
        return;
      }

      this.isSubmitting = true;
      this.cdr.markForCheck();

      // Datepicker gives Date; backend expects ISO string
      const plannedStartAt = this.taskPlannedStartAtLocal ? this.taskPlannedStartAtLocal.toISOString() : null;
      const plannedEndAt = this.taskPlannedEndAtLocal ? this.taskPlannedEndAtLocal.toISOString() : null;
      const createdAt: string = new Date().toISOString();
      const updatedAt: string | null = null;

      const payload: AssignedTaskDto = {
        id: '',
        name: String( this.taskName ?? '' ).trim(),
        description: String( this.taskDescription ?? '' ).trim(),

        status: this.taskStatus,
        priority: this.taskPriority,

        plannedStartAt: plannedStartAt ?? undefined,
        plannedEndAt: plannedEndAt ?? undefined,

        assignedMembers,

        assignedTaskCaptain: this.emptyToUndef( this.taskAssignedCaptain ) ?? undefined,
        notes: this.emptyToUndef( this.taskNotes ) ?? undefined,
        compliantId: this.assignComplaint?.code ?? '',
        createdAt,
        updatedAt,
      };

      console.log(payload)

      const body = {
        task: payload,
        completionConfirmation: {
          required: true,
          requiredBy: this.confirmBy,
        },
      };

      const res = await this.teamService.assignTask( this.teamID, body );
      if ( !res?.success ) throw new Error( res?.message ?? 'Assign task failed.' );

      this.notificationBar.notification( 'success', 'Task assigned successfully.' );

      // Refresh dataset (routeLoadSeq keeps newest route state)
      await this.loadTeamAndTasks( this.teamID, this.routeLoadSeq );
      this.applyCaptainAlwaysSelected();

      await this.teamTaskDataInit( this.teamAllTaskTableIndex, this.teamAllTaskPageSize );
      await this.memberTableDataInit( this.memberTableIndex, this.memberPageSize );

      this.clearAndUnlockTaskForm();
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [AssignTask] submitAssignTask failed.\n', error );

      const msg = error instanceof Error ? error.message : 'Unexpected error occurred!';
      this.notificationBar.notification( 'error', msg );
    } finally {
      this.isSubmitting = false;
      this.assignComplaint = null;
      this.cdr.markForCheck();
    }
  }

  // =========================================================================
  // 18) COMPLAINT TABLE ACTIONS
  // =========================================================================
  protected onComplaintTableButtonOperation( ev: TableButtonActionConfig ): void {
    try {
      const action = String( ev?.action ?? '' ).trim();
      const row = ev?.data as ComplaintRow | null;

      if ( action === 'view' ) {
        const complaintId = String( row?.code ?? '' ).trim();
        if ( !complaintId ) return;

        void this.router.navigate( [ '/dashboard/tenant/complaints/view-complaint', complaintId ] );
        return;
      }

      if ( action === 'add' ) {
        if ( !row?._raw ) return;
        this.loadComplaintIntoTaskForm( row );
        return;
      }
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [AssignTask] onComplaintTableButtonOperation failed.\n', error );
    }
  }

  private loadComplaintIntoTaskForm( row: ComplaintRow ): void {
    try {
      const title = row.title || `Handle complaint ${ row.code }`;

      const descParts: string[] = [];
      descParts.push( `Complaint: ${ row.code }` );
      if ( row.customerName ) descParts.push( `Customer: ${ row.customerName }` );
      if ( row.propertyRef ) descParts.push( `Property: ${ row.propertyRef }` );

      const rawDesc = String( ( row._raw as any )?.description ?? '' ).trim();
      if ( rawDesc ) descParts.push( `Details: ${ rawDesc }` );

      this.taskName = `Complaint • ${ title }`;
      this.taskDescription = descParts.join( '\n' );
      this.taskDescriptionTouched = true;

      this.taskStatus = 'pending' as TaskStatus;
      this.taskPriority = ( row.priority as TaskPriority ) || ( 'medium' as TaskPriority );
      this.confirmBy = 'customer';

      this.isComplaintAutofill = true;
      this.lockedComplaintCode = row.code;

      this.assignComplaint = row._raw;

      this.notificationBar.notification( 'success', 'Complaint loaded. Auto-filled fields are locked.' );
      this.cdr.markForCheck();
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [AssignTask] loadComplaintIntoTaskForm failed.\n', error );
      this.notificationBar.notification( 'error', 'Failed to prepare task from complaint.' );
    }
  }

  // =========================================================================
  // 19) MEMBER TABLE ACTIONS
  // =========================================================================
  protected onMemberTableButtonOperation( ev: TableButtonActionConfig ): void {
    try {
      const action = String( ev?.action ?? '' ).trim();
      const row = ev?.data as MemberTableRow | null;

      const id = String( row?.id ?? '' ).trim();
      if ( !id ) return;

      if ( action === 'remove' ) {
        if ( this.captainMemberId && id === this.captainMemberId ) {
          this.notificationBar.notification( 'warning', 'Captain cannot be removed.' );
          return;
        }

        this.selectedMemberKeys.delete( id );
        this.rebuildSelectedChips();

        void this.memberTableDataInit( this.memberTableIndex, this.memberPageSize );
        this.cdr.markForCheck();
        return;
      }

      if ( action === 'add' ) {
        if ( this.selectedMemberKeys.has( id ) ) return;

        if ( !this.canSelectMoreMembers() ) {
          this.notificationBar.notification(
            'warning',
            `You can select maximum ${ this.maxAssignees } members (including captain).`
          );
          return;
        }

        this.selectedMemberKeys.add( id );
        this.rebuildSelectedChips();

        void this.memberTableDataInit( this.memberTableIndex, this.memberPageSize );
        this.cdr.markForCheck();
        return;
      }
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [AssignTask] onMemberTableButtonOperation failed.\n', error );
    }
  }

  // =========================================================================
  // 20) TASK TABLE ACTIONS
  // =========================================================================
  protected onTeamTaskTableButtonOperation( ev: TableButtonActionConfig ): void {
    try {
      const action: string = String( ev?.action ?? '' ).trim().toLowerCase();
      const row: TaskRow | null = ( ev?.data as TaskRow ) ?? null;

      const taskId: string = String( row?.id ?? '' ).trim();
      if ( !taskId ) return;

      // ✅ Get teamId/teamCode from your already-loaded team object
      const teamId = String( this.teamID ?? '' ).trim(); // // adjust if your field is teamId
      if ( !teamId ) {
        console.warn( '[Warning:] [AssignTask] Missing teamId/teamCode for navigation.\n' );
        return;
      }

      if ( action === 'view' ) {
        // ✅ /dashboard/team-management/assign-task/:teamId/view/:taskId
        void this.router.navigate( [
          '/dashboard',
          'team-management',
          'assign-task',
          teamId,
          'view',
          taskId,
        ] );
        return;
      }

      if ( action === 'edit' ) {
        // ✅ If you later add edit route as child: assign-task/:teamId/edit/:taskId
        void this.router.navigate( [
          '/dashboard',
          'team-management',
          'assign-task',
          teamId,
          'edit',
          taskId,
        ] );
        return;
      }
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [AssignTask] onTeamTaskTableButtonOperation failed.\n', error );
    }
  }


  // =========================================================================
  // 21) LOAD TEAM + TASKS
  // =========================================================================
  private async loadTeamAndTasks( teamId: string, seq: number ): Promise<void> {
    const [ teamRes, taskRes ] = await Promise.all( [
      this.teamService.getTeamById( teamId ),
      this.teamService.getAllTasksForTeam( teamId ),
    ] );

    // “latest route load wins”
    if ( seq !== this.routeLoadSeq ) return;

    if ( !teamRes?.success ) throw new Error( teamRes?.message ?? 'Failed to load team.' );
    if ( !taskRes?.success ) throw new Error( taskRes?.message ?? 'Failed to load tasks.' );

    const team = this.extractTeamFromResponse( teamRes );
    if ( !team ) throw new Error( 'Team payload not found in response.' );

    this.team = team;

    this.members = Array.isArray( ( team as any )?.members ) ? ( team as any ).members : [];
    this.tasks = this.extractTasksFromResponse( taskRes );

    this.rebuildKpis();
    this.cdr.markForCheck();
  }

  // =========================================================================
  // 22) POLLING (NO OVERLAP)
  // Teaching note:
  //  - timer emits at interval
  //  - exhaustMap ensures next tick is ignored until current REST call finishes
  // =========================================================================
  private startPolling(): void {
    this.stopPolling();

    if ( !this.isBrowser ) return;
    if ( !this.teamID ) return;

    this.pollActive = true;

    timer( this.pollSeconds * 1000, this.pollSeconds * 1000 )
      .pipe(
        takeUntil( this.destroy$ ),
        exhaustMap( async () => {
          if ( !this.pollActive ) return null;
          if ( !this.teamID ) return null;

          try {
            const res = await this.teamService.getAllTasksForTeam( this.teamID );
            if ( !res?.success ) return null;

            return this.extractTasksFromResponse( res );
          } catch {
            return null;
          }
        } )
      )
      .subscribe( ( newTasks ) => {
        if ( !newTasks ) return;

        this.tasks = newTasks;

        this.rebuildKpis();

        void this.teamTaskDataInit( this.teamAllTaskTableIndex, this.teamAllTaskPageSize );
        void this.memberTableDataInit( this.memberTableIndex, this.memberPageSize );

        this.cdr.markForCheck();
      } );
  }

  private stopPolling(): void {
    this.pollActive = false;
  }

  // =========================================================================
  // 23) KPI RANGE HANDLERS
  // =========================================================================
  protected resetKpiRange(): void {
    this.kpiFromDateObj = null;
    this.kpiToDateObj = null;

    this.rebuildKpis();
    this.cdr.markForCheck();
  }

  protected onKpiRangeChanged(): void {
    this.rebuildKpis();
    this.cdr.markForCheck();
  }

  // =========================================================================
  // 24) COMPLAINTS TABLE DATA (server paging)
  // Teaching note:
  //  - You must calculate pages from totalCount, then clamp index/limit.
  // =========================================================================
  private async newComplaintDataInit( index: number, limit: number ): Promise<void> {
    try {
      this.complaintTableIsReloading = true;
      this.cdr.markForCheck();

      const status = 'new';

      const totalRes = await this.tenantService.getComplaintCountByStatus( status );
      if ( !totalRes?.success ) throw new Error( totalRes?.message ?? 'Failed to count new complaints.' );

      const total = Number( totalRes?.data?.pagination?.total ?? 0 );
      this.complaintTableTotalCount = Number.isFinite( total ) ? Math.max( 0, total ) : 0;

      const safeLimit = PaginationUtil.safeLimit( limit, this.complaintTableTotalCount );
      const totalPages = Math.max( 1, Math.ceil( this.complaintTableTotalCount / safeLimit ) );
      const safeIndex = PaginationUtil.safeIndex( index, totalPages );

      const res = await this.tenantService.getAllComplaintByStatus( status, safeIndex, safeLimit );
      if ( !res?.success ) throw new Error( res?.message ?? 'Failed to load complaints.' );

      const complaints: ComplaintClient[] | undefined = res.data?.system?.complaints;

      this.complaintTableData = Array.isArray( complaints )
        ? complaints.map( ( c ) => this.makeComplaintRow( c ) )
        : [];

      this.cdr.markForCheck();
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [AssignTask] newComplaintDataInit failed.\n', error );

      this.complaintTableData = [];
      this.cdr.markForCheck();
    } finally {
      this.complaintTableIsReloading = false;
      this.cdr.markForCheck();
    }
  }

  private makeComplaintRow( c: ComplaintClient ): ComplaintRow {
    const id = c?._id ? String( c._id ).trim() : String( ( c as any )?.code ?? '-' ).trim();
    const code = c?.code ? String( c.code ).trim() : id;

    const title = c?.title ? String( c.title ).trim() : 'Complaint';
    const status = this.norm( ( c as any )?.status ) || 'new';
    const priority = this.norm( ( c as any )?.priority ) || 'medium';

    const createdAt = ( c as any )?.createdAt ? this.tryIso( ( c as any )?.createdAt ) ?? undefined : undefined;

    const customerName = ( c as any )?.tenantName ? String( ( c as any ).tenantName ).trim() : '-';

    const propertyRef =
      ( c as any )?.propertyName
        ? String( ( c as any ).propertyName ).trim()
        : ( c as any )?.propertyId
          ? String( ( c as any ).propertyId ).trim()
          : '-';

    return {
      id,
      code,
      title,
      status,
      priority,
      createdAt,
      customerName,
      propertyRef,

      viewButton: { icon: 'visibility', action: 'view', label: 'View' },
      addButton: { icon: 'add_circle', action: 'add', label: 'Assign Task' },

      _raw: c,
    };
  }

  // =========================================================================
  // 25) MEMBERS TABLE DATA (in-memory paging)
  // =========================================================================
  private async memberTableDataInit( index: number, limit: number ): Promise<void> {
    try {
      const allMembers = this.members;
      const allTasks = this.tasks;

      const total = allMembers.length;
      this.memberTableTotalCount = total;

      const safeLimit = PaginationUtil.safeLimit( limit, total );
      const totalPages = Math.max( 1, Math.ceil( total / safeLimit ) );
      const safeIndex = PaginationUtil.safeIndex( index, totalPages );

      const start = safeIndex * safeLimit;
      const end = start + safeLimit;

      const page = allMembers.slice( start, end );

      this.memberTableData = page.map( ( m ) => {
        const memberId = String( ( m as any )?.id ?? ( m as any )?._id ?? '' ).trim();

        const assignedTaskCount =
          allTasks.filter( ( t ) =>
            Array.isArray( ( t as any )?.assignedMembers )
              ? ( t as any ).assignedMembers.includes( memberId )
              : false
          ).length;

        const isCaptain = !!this.captainMemberId && memberId === this.captainMemberId;
        const isSelected = this.selectedMemberKeys.has( memberId );

        const addButton: TableButton = { label: 'Select', icon: 'add_circle', action: 'add' };
        const removeButton: TableButton = { label: 'Remove', icon: 'remove_circle', action: 'remove' };

        return {
          image: ( m as any )?.user?.image ?? null,
          id: memberId,

          name: String( ( m as any )?.user?.name ?? '' ).trim(),
          username: String( ( m as any )?.user?.username ?? '' ).trim(),

          roleinteam: String( ( m as any )?.roleInTeam ?? '' ).trim(),
          role: String( ( m as any )?.user?.role ?? '' ).trim(),
          email: String( ( m as any )?.user?.email ?? '' ).trim(),

          assignedTaskCount,

          isCaptain,
          isSelected,

          addButton,
          removeButton,
        } as MemberTableRow;
      } );

      this.rebuildSelectedChips();

      this.cdr.markForCheck();
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [AssignTask] memberTableDataInit failed.\n', error );

      this.memberTableData = [];
      this.memberTableTotalCount = 0;

      this.cdr.markForCheck();
    }
  }

  // =========================================================================
  // 26) TASKS TABLE DATA (in-memory paging)
  // =========================================================================
  private async teamTaskDataInit( index: number, limit: number ): Promise<void> {
    try {
      const all = this.tasks;

      const total = all.length;
      this.teamTaskTableTotalCount = total;

      const safeLimit = PaginationUtil.safeLimit( limit, total );
      const totalPages = Math.max( 1, Math.ceil( total / safeLimit ) );
      const safeIndex = PaginationUtil.safeIndex( index, totalPages );

      const start = safeIndex * safeLimit;
      const end = Math.min( start + safeLimit, total );

      this.teamAllTaskTableData = all.slice( start, end ).map( ( t ) => this.mapTaskRow( t ) );

      this.cdr.markForCheck();
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error( '[Error:] [AssignTask] teamTaskDataInit failed.\n', error );

      this.teamAllTaskTableData = [];
      this.teamTaskTableTotalCount = 0;

      this.cdr.markForCheck();
    }
  }

  private mapTaskRow( t: AssignedTaskDto ): TaskRow {
    const anyT: any = t as any;

    const id: string = String( anyT?.id ?? anyT?._id ?? '' ).trim();
    const name: string = String( anyT?.name ?? '' ).trim();
    const status: string = this.norm( anyT?.status ) || '-';
    const priority: string = this.norm( anyT?.priority ) || '-';

    const members: unknown[] = Array.isArray( anyT?.assignedMembers ) ? anyT.assignedMembers : [];

    const plannedStartAt = this.tryIso( anyT?.plannedStartAt ) ?? undefined;
    const plannedEndAt = this.tryIso( anyT?.plannedEndAt ) ?? undefined;
    const completedAt = this.tryIso( anyT?.completedAt ) ?? undefined;

    const confirmation = this.resolveConfirmation( anyT );

    return {
      id,
      name,
      status,
      priority,

      assignedCount: members.length,

      plannedStartAt,
      plannedEndAt,
      completedAt,

      confirmation,

      viewButton: { action: 'view', icon: 'visibility', label: 'View' },
      editButton: { action: 'edit', icon: 'edit', label: 'Edit' },
    };
  }

  private resolveConfirmation( t: any ): string {
    const status = this.norm( t?.status );

    if ( status !== 'completed' && status !== 'completed_pending_confirmation' ) {
      return '-';
    }

    const conf = this.norm( t?.completionConfirmation?.status );

    if ( !conf ) return 'pending';
    if ( conf === 'confirmed' ) return 'confirmed';
    if ( conf === 'rejected' ) return 'rejected';
    if ( conf === 'not_required' ) return 'not_required';

    return 'pending';
  }

  // =========================================================================
  // 27) KPI BUILDER (3D Pie + bar)
  // =========================================================================
  private rebuildKpis(): void {
    if ( !Array.isArray( this.tasks ) || this.tasks.length === 0 ) {
      this.kpiStatusDonut = null;
      this.kpiPriorityDonut = null;
      this.kpiCompletionBar = null;
      return;
    }

    // 1) Status breakdown (3D Pie)
    {
      const map = this.countBy( this.tasks, ( x ) => this.norm( ( x as any )?.status ) || 'unknown' );
      this.kpiStatusDonut = this.buildPie3D( 'Status', this.toPairs( map ), 260 );
    }

    // 2) Priority breakdown (3D Pie)
    {
      const map = this.countBy( this.tasks, ( x ) => this.norm( ( x as any )?.priority ) || 'unknown' );
      this.kpiPriorityDonut = this.buildPie3D( 'Priority', this.toPairs( map ), 260 );
    }

    // 3) Completion bar (in KPI range)
    {
      const range = this.resolveKpiRangeMs();
      const tasks = this.filterTasksByRange( this.tasks, range.fromMs, range.toMs );

      const total = tasks.length;

      const completed = tasks.filter( ( x ) => {
        const s = this.norm( ( x as any )?.status );
        return s === 'completed' || s === 'completed_pending_confirmation';
      } ).length;

      const pending = Math.max( 0, total - completed );
      const pct = total > 0 ? Math.round( ( completed / total ) * 100 ) : 0;

      this.kpiCompletionBar = this.buildBar(
        'Completion Rate',
        [
          this.pair( `Completed (${ pct }%)`, completed ),
          this.pair( 'Not Completed', pending ),
        ],
        280
      );
    }
  }

  private resolveKpiRangeMs(): { fromMs: number | null; toMs: number | null; } {
    const fromMs =
      this.kpiFromDateObj instanceof Date
        ? this.safeMs( this.kpiFromDateObj.getTime() )
        : null;

    // include full "to" day until 23:59:59.999
    const toMs =
      this.kpiToDateObj instanceof Date
        ? this.safeMs( this.kpiToDateObj.getTime() + 24 * 60 * 60 * 1000 - 1 )
        : null;

    return { fromMs, toMs };
  }

  private safeMs( ms: number ): number | null {
    return Number.isFinite( ms ) && !Number.isNaN( ms ) ? ms : null;
  }

  private filterTasksByRange(
    tasks: AssignedTaskDto[],
    fromMs: number | null,
    toMs: number | null
  ): AssignedTaskDto[] {
    if ( fromMs === null && toMs === null ) return tasks;

    return tasks.filter( ( t ) => {
      // “best available date” for KPI slice:
      // completedAt > plannedStartAt > plannedEndAt
      const iso =
        this.tryIso( ( t as any )?.completedAt ) ??
        this.tryIso( ( t as any )?.plannedStartAt ) ??
        this.tryIso( ( t as any )?.plannedEndAt );

      if ( !iso ) return false;

      const ms = Date.parse( iso );
      if ( Number.isNaN( ms ) ) return false;

      if ( fromMs !== null && ms < fromMs ) return false;
      if ( toMs !== null && ms > toMs ) return false;

      return true;
    } );
  }

  // ✅ 3D Pie chart builder (replaces donut)
  private buildPie3D( title: string, rows: readonly Pair[], height: number ): ChartBuild {
    const data: Row[] = rows
      .filter( ( r ) => r[ 1 ] > 0 )
      .map( ( r ) => [ r[ 0 ], r[ 1 ] ] as unknown as Row );

    return {
      type: ChartType.PieChart,
      columns: [ 'Label', 'Count' ] as unknown as Column[],
      data,
      options: {
        title,
        height,
        is3D: true,
        legend: { position: 'right' },
        backgroundColor: 'transparent',
        chartArea: { left: 16, top: 24, right: 16, bottom: 16, width: '88%', height: '78%' },
        tooltip: { isHtml: true, trigger: 'focus', showColorCode: true },
        pieSliceText: 'percentage',
      },
    };
  }

  private buildBar( title: string, rows: readonly Pair[], height: number ): ChartBuild {
    const data: Row[] = rows
      .filter( ( r ) => r[ 1 ] >= 0 )
      .map( ( r ) => [ r[ 0 ], r[ 1 ] ] as unknown as Row );

    return {
      type: ChartType.BarChart,
      columns: [ 'Label', 'Count' ] as unknown as Column[],
      data,
      options: {
        title,
        height,
        legend: { position: 'none' },
        backgroundColor: 'transparent',
        chartArea: { left: 90, top: 30, right: 16, bottom: 30, width: '80%', height: '75%' },
        hAxis: { minValue: 0 },
        tooltip: { isHtml: true, trigger: 'focus', showColorCode: true },
      },
    };
  }

  // =========================================================================
  // 28) TABLE COLUMNS
  // =========================================================================
  private buildComplaintColumns(): void {
    this.complaintTableColumns = [
      { key: 'code', label: 'Code' },
      { key: 'title', label: 'Title' },
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'createdAt', label: 'Created At' },
      { key: 'customerName', label: 'Customer' },
      { key: 'propertyRef', label: 'Property' },
      { key: 'viewButton', label: 'View' },
      { key: 'addButton', label: 'Assign Task' },
    ];
  }

  private buildMemberColumns(): void {
    this.memberTableColumns = [
      { key: 'image', label: 'Avatar' },
      { key: 'name', label: 'Name' },
      { key: 'username', label: 'Username' },
      { key: 'roleinteam', label: 'Role in team' },
      { key: 'role', label: 'Role' },
      { key: 'email', label: 'Email' },
      { key: 'assignedTaskCount', label: 'Assigned Tasks' },
      { key: 'addButton', label: 'Select' },
      { key: 'removeButton', label: 'Remove' },
    ];
  }

  private buildTaskColumns(): void {
    this.teamAllTaskTableColumns = [
      { key: 'name', label: 'Task' },
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'assignedCount', label: 'Assigned' },
      { key: 'plannedStartAt', label: 'Start' },
      { key: 'plannedEndAt', label: 'End' },
      { key: 'completedAt', label: 'Completed' },
      { key: 'confirmation', label: 'Confirmation' },
      { key: 'viewButton', label: 'View' },
      { key: 'editButton', label: 'Edit' },
    ];
  }

  // =========================================================================
  // 29) RESPONSE EXTRACTORS
  // =========================================================================
  private extractTeamFromResponse( res: any ): TeamManagementDto | null {
    const t1 = res?.data?.system?.team;
    const t2 = res?.data?.team;
    const t3 = res?.data?.system?.team?.team;
    const t4 = res?.data?.data?.team;

    const team = ( t1 ?? t2 ?? t3 ?? t4 ?? null ) as TeamManagementDto | null;
    return team && typeof team === 'object' ? team : null;
  }

  private extractTasksFromResponse( res: any ): AssignedTaskDto[] {
    const d = res?.data;

    const a1 = d?.tasks;
    const a2 = d?.other?.tasks;
    const a3 = d?.system?.tasks;
    const a4 = d?.data?.tasks;

    const arr = ( a1 ?? a2 ?? a3 ?? a4 ?? [] ) as unknown;
    if ( !Array.isArray( arr ) ) return [];

    return ( arr as unknown[] ).flat().filter( Boolean ) as AssignedTaskDto[];
  }

  // =========================================================================
  // 30) HELPERS
  // =========================================================================
  private norm( v: unknown ): string {
    return String( v ?? '' ).trim().toLowerCase();
  }

  private tryIso( raw: unknown ): string | null {
    if ( raw instanceof Date ) {
      const ms = raw.getTime();
      return Number.isNaN( ms ) ? null : raw.toISOString();
    }

    if ( typeof raw !== 'string' ) return null;

    const t = raw.trim();
    if ( !t ) return null;

    const ms = Date.parse( t );
    return Number.isNaN( ms ) ? null : t;
  }

  private emptyToUndef<T>( v: T ): T | undefined {
    const s = String( v ?? '' ).trim();
    return s ? v : undefined;
  }

  private countBy<T>( items: T[], keyFn: ( x: T ) => string ): Record<string, number> {
    const out: Record<string, number> = {};

    for ( const it of items ) {
      const k = keyFn( it ) || 'unknown';
      out[ k ] = ( out[ k ] ?? 0 ) + 1;
    }

    return out;
  }

  private toPairs( map: Record<string, number> ): Pair[] {
    return Object.entries( map )
      .map( ( [ k, v ] ) => this.pair( k, Number( v ?? 0 ) ) )
      .sort( ( a, b ) => b[ 1 ] - a[ 1 ] ); // nice ordering in pie legend
  }

  private pair( label: string, value: number ): Pair {
    return [ String( label ?? '' ).trim() || 'Unknown', Number.isFinite( value ) ? value : 0 ] as const;
  }
}

