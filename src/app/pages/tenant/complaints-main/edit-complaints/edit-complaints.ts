import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Renderer2,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

// Service and types imports
import { APIsService, type User } from '../../../../services/APIs/apis.service';
import { AuthService } from '../../../../services/auth/auth.service';
import {
  PropertyService
} from '../../../../services/property/property.service';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUS,
  COMPLAINT_PRIORITIES,
  TenantService,
  type ComplaintAudience,
  type ComplaintClient,
  type ComplaintCommentClient,
  type ComplaintsCategory,
  type ComplaintStatus,
  type ComplaintTimelineEventClient,
  type PendingAttachmentClient,
  type ComplaintPriority
} from '../../../../services/tenant/tenant.service';
import { WindowsRefService } from '../../../../services/windowRef/windowRef.service';

// Component imports
import { NotificationDialogComponent } from '../../../../components/dialogs/notification/notificationBar.component';
import { ProgressBarComponent } from '../../../../components/dialogs/progress-bar/progress-bar.component';
import { CommentsListComponent } from '../../../../components/shared/comments/comments-list.component';
import { Dropdown } from '../../../../components/shared/dropdown/dropdown';
import { StageIndicatorComponent, type StagePoint } from '../../../../components/shared/stageIndicator/stage-indicator.component';
import { Textarea } from '../../../../components/shared/textarea/textarea.component';
import { TextEditorComponent } from '../../../../components/shared/textEditor/text-editor';
import {
  TableButtonActionConfig,
  TableButton,
  TableColumn,
  CustomTableComponent,
} from '../../../../components/shared/custom-table/custom-table.component';

// Material UI imports
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { HttpErrorResponse } from '@angular/common/http';


interface TeamMemberTableData {
  image: string;
  name: string;
  role: string;
  viewButton: TableButton,
  addButton: TableButton;
}


@Component( {
  selector: 'app-edit-complaints',
  imports: [
    // Angular
    CommonModule,
    FormsModule,
    // Material
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    // MatIcon,
    // Components
    NotificationDialogComponent,
    ProgressBarComponent,
    StageIndicatorComponent,
    // TextEditorComponent,
    // Dropdown,
    // Textarea,
    CommentsListComponent,
    CustomTableComponent,
  ],
  templateUrl: './edit-complaints.html',
  styleUrl: './edit-complaints.scss'
} )
export class EditComplaints implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild( NotificationDialogComponent ) notification!: NotificationDialogComponent;
  @ViewChild( ProgressBarComponent ) progressBar!: ProgressBarComponent;

  // ─────────────────────────────────────────────
  // View / env state
  // ─────────────────────────────────────────────
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  private loggedUser!: User | null;

  // ─────────────────────────────────────────────
  // Complaint
  // ─────────────────────────────────────────────
  protected readonly NO_COMPLAINT_DATA: string = 'Images/System-images/noComplaints.png';
  protected readonly DEFINED_CATEGORIES: readonly ComplaintsCategory[] = COMPLAINT_CATEGORIES;
  protected readonly DEFINED_STATUS: readonly ComplaintStatus[] = COMPLAINT_STATUS;
  protected readonly COMPLAINT_PRIORITIES: readonly ComplaintPriority[] = COMPLAINT_PRIORITIES;
  protected readonly DEFINED_AUDIENCES: string[] = [ 'admin', 'all', 'agent', 'developer', 'manager', 'operator', 'owner', 'system', 'tenant', 'user' ];
  private _currentStatusPoint !: number;
  private _status !: ComplaintClient[ 'status' ];

  // ─────────────────────────────────────────────
  // Complaint Inserting Data
  // ─────────────────────────────────────────────

  protected code !: ComplaintClient[ 'code' ];
  private tenantId !: ComplaintClient[ 'tenantId' ];
  private tenantUsername !: ComplaintClient[ 'tenantName' ];
  private propertyId !: ComplaintClient[ 'propertyId' ];
  private propertyName !: ComplaintClient[ 'propertyName' ];
  private leaseId !: ComplaintClient[ 'leaseId' ];
  protected title !: ComplaintClient[ 'title' ];
  protected description !: ComplaintClient[ 'description' ];
  protected category !: ComplaintClient[ 'category' ];
  protected priority !: ComplaintClient[ 'priority' ];
  protected assigneeId !: ComplaintClient[ 'assigneeId' ];
  protected assigneeName !: ComplaintClient[ 'assigneeName' ];
  private readonly updatedAt: ComplaintClient[ 'updatedAt' ] = new Date().toISOString();
  protected pendingAttachments!: PendingAttachmentClient[];
  protected comment !: ComplaintCommentClient[ 'message' ];
  protected timeline !: ComplaintTimelineEventClient;
  private readonly timelineAt: ComplaintTimelineEventClient[ 'at' ] = new Date().toISOString();
  private fromStatus !: ComplaintTimelineEventClient[ 'fromStatus' ];
  private toStatus !: ComplaintTimelineEventClient[ 'toStatus' ];
  private byUserId !: ComplaintTimelineEventClient[ 'byUserId' ];
  protected note !: ComplaintTimelineEventClient[ 'note' ];

  // ─────────────────────────────────────────────
  // Complaint Inserting Data
  // ─────────────────────────────────────────────
  protected teamName !: string;
  private teamMembers !: string[];


  // ─────────────────────────────────────────────
  // Team member table data for add
  // ─────────────────────────────────────────────
  private _teamAddIsReloading: boolean = false;
  private _teamAddLimit: number = 10;
  private _teamAddSearch: string = '';
  private _teamAddIndex: number = 0;
  protected teamAddDataCount: number = 0;
  protected teamAddData: TeamMemberTableData[] = [];
  protected teamAddTableTitle: string = 'Add team members';
  protected teamAddTableColumns: TableColumn[] = [
    { key: 'userimage', label: 'Image' },
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'viewButton', label: 'View' },
    { key: 'addButton', label: 'Add' },
  ];

  //01. teamAddIsReloading
  get teamAddIsReloading(): boolean {
    return this._teamAddIsReloading;
  }
  set teamAddIsReloading( value: boolean ) {
    this._teamAddIsReloading = value;
  }

  // 02. teamAddLimit
  get teamAddLimit(): number {
    return this._teamAddLimit;
  }
  set teamAddLimit( value: number ) {
    this._teamAddLimit = value;
  }

  // 03. teamAddSearch
  get teamAddSearch(): string {
    return this._teamAddSearch;
  }
  set teamAddSearch( value: string ) {
    this._teamAddSearch = value.trim();
  }

  //04. teamAddIndex
  get teamAddIndex(): number {
    return this._teamAddIndex;
  }
  set teamAddIndex( value: number ) {
    this._teamAddIndex = value;
  }

  // ─────────────────────────────────────────────
  // Team member table data for remove
  // ─────────────────────────────────────────────
  private _teamRemoveIsReloading: boolean = false;
  private _teamRemoveLimit: number = 10;
  private _teamRemoveIndex: number = 0;
  private _teamRemoveSearch: string = '';
  protected teamRemoveDataCount: number = 0;
  protected teamRemoveData: TeamMemberTableData[] = [];
  protected teamRemoveTableTitle: string = 'Team members';
  protected teamRemoveTableColumns: TableColumn[] = [
    { key: 'userimage', label: 'Image' },
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'viewButton', label: 'View' },
    { key: 'removeButton', label: 'Remove' },
  ];

  //01. teamRemoveIsReloading
  get teamRemoveIsReloading(): boolean {
    return this._teamRemoveIsReloading;
  }
  set teamRemoveIsReloading( value: boolean ) {
    this._teamRemoveIsReloading = value;
  }

  // 02. teamRemoveLimit
  get teamRemoveLimit(): number {
    return this._teamRemoveLimit;
  }
  set teamRemoveLimit( value: number ) {
    this._teamRemoveLimit = value;
  }

  // 03. teamRemoveSearch
  get teamRemoveSearch(): string {
    return this._teamRemoveSearch;
  }
  set teamRemoveSearch( value: string ) {
    this._teamRemoveSearch = value.trim();
  }

  //04. teamRemoveIndex
  get teamRemoveIndex(): number {
    return this._teamRemoveIndex;
  }
  set teamRemoveIndex( value: number ) {
    this._teamRemoveIndex = value;
  }


  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private platformId: Object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly renderer: Renderer2,
    private readonly APIsService: APIsService,
    private readonly propertyService: PropertyService,
    private readonly dialog: MatDialog,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.route.url.subscribe( () => { /* reserved for future */ } );
    this.loggedUser = this.authService.getLoggedUser;

    this.route.params.subscribe( async ( item ): Promise<void> => {
      try {
        const comaplaintID = item[ 'complaintID' ];
        const res = await this.tenantService.getComplaintById( comaplaintID );
        if ( res.status !== 'success' ) throw new Error( 'Faild to get complaint!' );
        const complaint: ComplaintClient | undefined = res.data?.system?.complaint;

        if ( !complaint ) {
          throw new Error( 'Invalid complaint data!' );
        }

        await this.dataInit( complaint );
      }
      catch ( error ) {
        console.error( error );
        this.notification.notification( 'error', 'Faild to get complaint' );
        return;
      }
    } );
  }

  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => { this.mode = val; } );
    }
  }

  ngAfterViewInit(): void {
    // Attach highly-targeted listeners to the dropzone only (safer than document-level)
    if ( !this.isBrowser ) return;

  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();

  }

  protected get status(): ComplaintClient[ 'status' ] {
    return this._status;
  }

  protected set status( value: ComplaintClient[ 'status' ] ) {
    this._status = value;
    this.handleStatusChange();
  }

  private async dataInit( complaint: ComplaintClient ): Promise<void> {
    try {
      if ( !complaint ) throw new Error( 'Invalid complaint!' );
      this.code = complaint.code;
      this.tenantId = complaint.tenantId;
      this.tenantUsername = complaint.tenantName;
      this.propertyId = complaint.propertyId;
      this.propertyName = complaint.propertyName;
      this.leaseId = complaint.leaseId;
      this.title = complaint.title;
      this.description = complaint.description;
      this.category = complaint.category;
      this.priority = complaint.priority;
      this.status = complaint.status;
      this.fromStatus = complaint.status;
      this.assigneeId = complaint.assigneeId;
      this.assigneeName = complaint.assigneeName;

      return;
    }
    catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'Assingin data falied!' );
      return;
    }
  }

  get adminLike(): boolean {
    try {
      if ( !this.loggedUser ) throw new Error( 'Logged user is invalid!' );
      const roles: string[] = [ 'admin', 'manager', 'operator', 'developer' ];
      const userRole: User[ 'role' ] = this.loggedUser.role;
      if ( roles.includes( userRole ) ) return true;
      else return false;
    }
    catch ( err ) {
      console.error( err );
      return false;
    }
  }

  /**
   * Converts the static complaint status list into stage points
   * usable by <pe-stage-indicator>.
   *
   * Each stage has:
   *  - key: internal unique ID
   *  - label: user-friendly text
   *  - value: numeric order position (used to fill the bar)
   */
  get STATUS_STAGE(): StagePoint[] {
    return this.DEFINED_STATUS.map( ( status, index ) => {
      return {
        key: status,
        label: this.statusToLabel( status ),
        value: index * 100 / ( this.DEFINED_STATUS.length - 1 ), // evenly spaced 0–100
      } satisfies StagePoint;
    } );
  }

  get STATUS_CURRENT_VALUE(): number {
    return this._currentStatusPoint;
  }

  set STATUS_CURRENT_VALUE( value: number ) {
    this._currentStatusPoint = value;
  }

  private handleStatusChange() {
    // 01. Safely extract current complaint status
    const currentStatus = this.status as ComplaintStatus | undefined;

    // 02. Find its index in the defined status array
    const index = currentStatus
      ? this.DEFINED_STATUS.indexOf( currentStatus )
      : -1;

    // 03. Defensive guard: unknown status → return 0
    if ( index < 0 ) this.STATUS_CURRENT_VALUE = 0;

    // 04. Calculate proportional position (0 → 100)
    const lastIndex = this.DEFINED_STATUS.length - 1;
    this.STATUS_CURRENT_VALUE = ( index * 100 ) / lastIndex;
  }

  /**
   * Convert backend-friendly status codes into readable labels.
   * You can later localize these strings or adjust styling.
   */
  private statusToLabel( status: ComplaintStatus ): string {
    switch ( status ) {
      case 'new': return 'New';
      case 'triaged': return 'Triaged';
      case 'in_progress': return 'In Progress';
      case 'awaiting_tenant': return 'Awaiting Tenant';
      case 'resolved': return 'Resolved';
      case 'closed': return 'Closed';
      case 'reopened': return 'Reopened';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  }



  /**
   * Make team table all helper operations
   */

  private async handlePageIndexing(): Promise<void> {

  }

  protected async handelFetchingOnTeamAdd(): Promise<void> {

  }

  protected async teamAddActionButtonCenter( value: TableButtonActionConfig ): Promise<void> {

  }

  private async loadTeamAddData( index: number, limit: number, search?: string ): Promise<void> {
    try {
      const countRes = await this.APIsService.getAllUserCount();
      if ( countRes.status !== 'success' ) {
        throw new Error( 'Failed to fetch all user count!' );
      }
      const total = countRes.data;
    }
    catch ( error ) {
      console.error( error );
      if ( error instanceof Error ) {
        this.notification.notification( 'error', error.message );
      }
      else if ( error instanceof HttpErrorResponse ) {
        this.notification.notification( 'error', error.message );
      }
      else {
        this.notification.notification( 'error', 'Unexpected error while fetching users!' );
      }
    }
  }

  protected async handelFetchingOnTeamRemove(): Promise<void> {

  }

  protected async teamRemoveActionButtonCenter( value: TableButtonActionConfig ): Promise<void> {

  }

  protected async submit(): Promise<void> {

  }

}
