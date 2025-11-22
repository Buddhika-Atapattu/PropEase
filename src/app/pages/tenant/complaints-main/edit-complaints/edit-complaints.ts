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
import { APIsService, type User, type MSG } from '../../../../services/APIs/apis.service';
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
// import {
//   ButtonDataType,
//   ButtonType,
//   CustomTableColumnType,
//   CustomTableComponent,
// } from '../../../../components/shared/custom-table/custom-table.component';

// Material UI imports
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';


interface TeamMemberTableData {
  image: string;
  name: string;
  role: string;
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
    // CustomTableComponent,
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
  // Columns for team member tables
  // ─────────────────────────────────────────────
  // protected tableColumns: CustomTableColumnType[] = [
  //   {key: 'userimage', label: 'Image'},
  //   {key: 'name', label: 'Name'},
  //   {key: 'role', label: 'Role'},
  //   {key: 'actions', label: 'View'},
  //   {key: 'operation', label: 'Add'},
  // ]
  protected isReloading: boolean = false;
  // ─────────────────────────────────────────────
  // Team member table data for add
  // ─────────────────────────────────────────────
  protected addPageSize: number = 10;
  protected addCurrentSearchTerm!: string;
  protected addPageSizeOptions: number[] = [ 5, 10, 25, 50 ];
  private _addPageIndex: number = 0;
  private _oldIndex!: number;
  protected addPageCount: number = 0;
  private _addSearch: string = '';
  protected addTotalDataCount: number = 0;
  protected addData: TeamMemberTableData[] = [];

  // ─────────────────────────────────────────────
  // Team member table data for remove
  // ─────────────────────────────────────────────
  private _removePageSize: number = 10;
  private _removePageSizeOptions: number[] = [ 5, 10, 25, 50 ];
  private _removePageIndex: number = 0;
  private _removePageCount: number = 0;
  private _removeSearch: string = '';
  private _removeTotalDataCount: number = 0;
  private _removeAllData: TeamMemberTableData[] = [];
  private _removeFilteredData: TeamMemberTableData[] = [];



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
        const res: MSG = await this.tenantService.getComplaintById( comaplaintID );
        if ( res.status !== 'success' ) throw new Error( 'Faild to get complaint!' );
        await this.dataInit( res.data );
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
      await this.addUserInit( 0 );

      return;
    }
    catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'Assingin data falied!' );
      return;
    }
  }

  get adminAccess(): boolean {
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
   * Make team for the complaint table getter and setter for add
   */
  // addPageIndex
  protected get addPageIndex(): number {
    return this._addPageIndex;
  }
  protected set addPageIndex( value: number ) {
    this._addPageIndex = value;

    // this.addUserInit(value)
  }

  // addSearch
  protected get addSearch(): string {
    return this._addSearch;
  }
  protected set addSearch( value: string ) {
    this.searchUsers( value );
  }

  // addActionButtonFunction


  /**
   * Make team table all helper operations
   */

  private async handlePageIndexing(): Promise<void> {

  }

  /* --------------------------------------------------------------------------
  * SEARCH
  * ------------------------------------------------------------------------ */

  /**
   * Live search handler (ngModelChange).
   * Always resets to page 0 on new search.
   */
  protected async searchUsers( input: string ): Promise<void> {
    try {
      const raw: string = ( input ?? '' ).toString();
      const safeInput: string = raw.trim().toLowerCase();

      this._addSearch = safeInput;

      // Reset to first page for a new search term.
      await this.addUserInit( 0 );
    } catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'Failed to process user search.' );
    }
  }

  /**
    * Main backend loader.
    * - Takes a 0-based page index.
    * - Computes start/end for the backend.
    * - Normalises search string and updates pagination state.
    */
  private async addUserInit( pageIndex: number ): Promise<void> {
    try {
      this.isReloading = true;

      const safeIndex: number = Math.max( 0, Math.round( Number( pageIndex ) ) );
      const limit: number = Math.max( 1, this.addPageSize );

      const startIdx: number = safeIndex * limit;
      const endIdx: number = startIdx + limit;
      const safeSearch: string = this._addSearch.trim();

      const res = await this.APIsService.getAllUsersWithPagination(
        startIdx,
        endIdx,
        safeSearch
      );

      console.log( res );
      if ( !res || res.status !== 'success' ) {
        throw new Error( res?.message || 'Loading users failed.' );
      }

      const payload = res.data;
      if ( Array.isArray( payload ) ) {
        res.data.forEach( ( user: User ) => {
          this.addData.push( {
            image: user.image as string,
            name: user.name,
            role: user.role,
          } );
        } );
      }


      this.addTotalDataCount = res.count ?? 0;

      this.addPageCount =
        this.addPageSize > 0 ? Math.ceil( this.addPageSize / limit ) : 0;

      // Clamp current page index in case count shrank.
      const maxIndex: number = this.addPageCount > 0 ? this.addPageCount - 1 : 0;

      this.addPageIndex = Math.min( safeIndex, maxIndex );

      // If requested page is beyond max (e.g. after bulk delete) → reload last page.
      if ( safeIndex > maxIndex && this.addPageCount > 0 ) {
        await this.addUserInit( maxIndex );
        return;
      }
    } catch ( err ) {
      console.error( '[Failed to process user loading with pagination!]: ', err );
      this.notification.notification( 'error', 'Failed to process user loading.' );
      this.addData = [];
      this.addTotalDataCount = 0;
      this.addPageCount = 0;
      this.addPageIndex = 0;
    } finally {
      this.isReloading = false;
    }
  }


  protected async submit(): Promise<void> {

  }

}
