// ─────────────────────────────────────────────────────────────────────────────
// Angular core & common
// ─────────────────────────────────────────────────────────────────────────────
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Renderer2,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

// ─────────────────────────────────────────────────────────────────────────────
// HTTP & RxJS
// ─────────────────────────────────────────────────────────────────────────────
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';

// ─────────────────────────────────────────────────────────────────────────────
// Services & types
// ─────────────────────────────────────────────────────────────────────────────
import { APIsService, type User } from '../../../../services/APIs/apis.service';
import { AuthService } from '../../../../services/auth/auth.service';
import { PropertyService } from '../../../../services/property/property.service';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUS,
  TenantService,
  type ComplaintAudience,
  type ComplaintClient,
  type ComplaintCommentClient,
  type ComplaintsCategory,
  type ComplaintPriority,
  type ComplaintStatus,
  type ComplaintTimelineEventClient,
  type PendingAttachmentClient,
} from '../../../../services/tenant/tenant.service';
import { WindowsRefService } from '../../../../services/windowRef/windowRef.service';

// ─────────────────────────────────────────────────────────────────────────────
// Standalone components
// ─────────────────────────────────────────────────────────────────────────────
import { NotificationDialogComponent } from '../../../../components/dialogs/notification/notificationBar.component';
import { ProgressBarComponent } from '../../../../components/dialogs/progress-bar/progress-bar.component';
import { CommentsListComponent } from '../../../../components/shared/comments/comments-list.component';
import { Dropdown } from '../../../../components/shared/dropdown/dropdown';
import { StageIndicatorComponent, type StagePoint } from '../../../../components/shared/stageIndicator/stage-indicator.component';
import { Textarea } from '../../../../components/shared/textarea/textarea.component';
import { TextEditorComponent } from '../../../../components/shared/textEditor/text-editor';
import {
  CustomTableComponent,
  type TableButton,
  type TableButtonActionConfig,
  type TableColumn,
} from '../../../../components/shared/custom-table/custom-table.component';
import { ConfirmationComponent } from '../../../../components/shared/confirmation/confirmation.component';

// ─────────────────────────────────────────────────────────────────────────────
// Angular Material
// ─────────────────────────────────────────────────────────────────────────────
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PaginationUtil } from '../../../../source/utility/pagination.utils';

// ─────────────────────────────────────────────────────────────────────────────
// Local interfaces
// ─────────────────────────────────────────────────────────────────────────────
interface TeamMemberTableData {
  image: string;
  name: string;
  role: string;
  viewButton: TableButton;
  addButton?: TableButton;
  removeButton?: TableButton;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-edit-complaints',
  standalone: true,
  imports: [
    // Angular
    CommonModule,
    FormsModule,

    // Material
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIcon,

    // Project components
    NotificationDialogComponent,
    ProgressBarComponent,
    StageIndicatorComponent,
    TextEditorComponent,
    Dropdown,
    Textarea,
    CommentsListComponent,
    CustomTableComponent,
  ],
  templateUrl: './edit-complaints.html',
  styleUrl: './edit-complaints.scss',
})
export class EditComplaints implements OnInit, AfterViewInit, OnDestroy {
  // ─────────────────────────────────────────────
  // ViewChild references
  // ─────────────────────────────────────────────
  @ViewChild(NotificationDialogComponent)
  protected notification!: NotificationDialogComponent;

  @ViewChild(ProgressBarComponent)
  protected progressBar!: ProgressBarComponent;

  // ─────────────────────────────────────────────
  // View / environment state
  // ─────────────────────────────────────────────
  protected mode: boolean | null = null;
  protected readonly isBrowser: boolean;

  private modeSub: Subscription | null = null;
  private loggedUser: User | null = null;

  // ─────────────────────────────────────────────
  // Complaint static data & enums
  // ─────────────────────────────────────────────
  protected readonly NO_COMPLAINT_DATA: string =
    'Images/System-images/noComplaints.png';

  protected readonly DEFINED_CATEGORIES: readonly ComplaintsCategory[] =
    COMPLAINT_CATEGORIES;

  protected readonly DEFINED_STATUS: readonly ComplaintStatus[] =
    COMPLAINT_STATUS;

  protected readonly COMPLAINT_PRIORITIES: readonly ComplaintPriority[] =
    COMPLAINT_PRIORITIES;

  protected readonly DEFINED_AUDIENCES: ComplaintAudience[] = [
    'admin',
    'all',
    'agent',
    'developer',
    'manager',
    'operator',
    'owner',
    'system',
    'tenant',
    'user',
  ];

  private _currentStatusPoint!: number;
  private _status!: ComplaintClient['status'];

  // ─────────────────────────────────────────────
  // Complaint main data (editing state)
  // ─────────────────────────────────────────────
  protected code!: ComplaintClient['code'];
  private tenantId!: ComplaintClient['tenantId'];
  private tenantUsername!: ComplaintClient['tenantName'];
  private propertyId!: ComplaintClient['propertyId'];
  private propertyName!: ComplaintClient['propertyName'];
  private leaseId!: ComplaintClient['leaseId'];

  protected title!: ComplaintClient['title'];
  protected description!: ComplaintClient['description'];
  protected category!: ComplaintClient['category'];
  protected priority!: ComplaintClient['priority'];
  protected assigneeId!: ComplaintClient['assigneeId'];
  protected assigneeName!: ComplaintClient['assigneeName'];
  protected audience!: ComplaintAudience;

  protected pendingAttachments: PendingAttachmentClient[] = [];
  protected comment: ComplaintCommentClient['message'] = '';

  // store original complaint for reset / cancel
  private originalComplaint: ComplaintClient | null = null;

  // timeline fields for updates (not fully wired yet)
  protected timeline!: ComplaintTimelineEventClient;
  private readonly updatedAt: ComplaintClient['updatedAt'] =
    new Date().toISOString();
  private readonly timelineAt: ComplaintTimelineEventClient['at'] =
    new Date().toISOString();
  private fromStatus!: ComplaintTimelineEventClient['fromStatus'];
  private toStatus!: ComplaintTimelineEventClient['toStatus'];
  private byUserId!: ComplaintTimelineEventClient['byUserId'];
  protected note!: ComplaintTimelineEventClient['note'];

  // ─────────────────────────────────────────────
  // Team assignment meta
  // ─────────────────────────────────────────────
  protected teamName!: string;
  private teamMembers!: string[];

  // ─────────────────────────────────────────────
  // Team member table: ADD
  // ─────────────────────────────────────────────
  private _teamAddIsReloading: boolean = false;
  private _teamAddLimit: number = 10;
  private _teamAddSearch: string = '';
  private _teamAddIndex: number = 0;

  protected teamAddDataCount: number = 0;
  protected teamAddData: TeamMemberTableData[] = [];

  protected readonly teamAddTableTitle: string = 'Add team members';
  protected readonly teamAddTableColumns: TableColumn[] = [
    { key: 'userimage', label: 'Image' },
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'viewButton', label: 'View' },
    { key: 'addButton', label: 'Add' },
  ];

  get teamAddIsReloading(): boolean {
    return this._teamAddIsReloading;
  }
  set teamAddIsReloading(value: boolean) {
    this._teamAddIsReloading = value;
  }

  get teamAddLimit(): number {
    return this._teamAddLimit;
  }
  set teamAddLimit(value: number) {
    this._teamAddLimit = value;
  }

  get teamAddSearch(): string {
    return this._teamAddSearch;
  }
  set teamAddSearch(value: string) {
    this._teamAddSearch = value.trim();
  }

  get teamAddIndex(): number {
    return this._teamAddIndex;
  }
  set teamAddIndex(value: number) {
    this._teamAddIndex = value;
  }

  // ─────────────────────────────────────────────
  // Team member table: REMOVE
  // ─────────────────────────────────────────────
  private _teamRemoveIsReloading: boolean = false;
  private _teamRemoveLimit: number = 10;
  private _teamRemoveIndex: number = 0;
  private _teamRemoveSearch: string = '';

  protected teamRemoveDataCount: number = 0;
  protected teamRemoveData: TeamMemberTableData[] = [];

  protected readonly teamRemoveTableTitle: string = 'Team members';
  protected readonly teamRemoveTableColumns: TableColumn[] = [
    { key: 'userimage', label: 'Image' },
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'viewButton', label: 'View' },
    { key: 'removeButton', label: 'Remove' },
  ];

  get teamRemoveIsReloading(): boolean {
    return this._teamRemoveIsReloading;
  }
  set teamRemoveIsReloading(value: boolean) {
    this._teamRemoveIsReloading = value;
  }

  get teamRemoveLimit(): number {
    return this._teamRemoveLimit;
  }
  set teamRemoveLimit(value: number) {
    this._teamRemoveLimit = value;
  }

  get teamRemoveSearch(): string {
    return this._teamRemoveSearch;
  }
  set teamRemoveSearch(value: string) {
    this._teamRemoveSearch = value.trim();
  }

  get teamRemoveIndex(): number {
    return this._teamRemoveIndex;
  }
  set teamRemoveIndex(value: number) {
    this._teamRemoveIndex = value;
  }

  // ─────────────────────────────────────────────
  // Constructor & DI
  // ─────────────────────────────────────────────
  constructor(
    private readonly windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private readonly platformId: Object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly renderer: Renderer2,
    private readonly APIsService: APIsService,
    private readonly propertyService: PropertyService,
    private readonly dialog: MatDialog,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.loggedUser = this.authService.getLoggedUser;

    // Reserved for future route-based logic
    this.route.url.subscribe(() => { /* reserved for future */ });

    // Load complaint from route param
    this.route.params.subscribe(async (params): Promise<void> => {
      try {
        const complaintID: string | undefined = params['complaintID'];
        if (!complaintID) {
          throw new Error('Complaint ID is missing!');
        }

        await this.loadComplaintById(complaintID);
      } catch (error) {
        console.error(error);
        if (this.notification) {
          this.notification.notification('error', 'Failed to get complaint');
        }
      }
    });
  }

  // ─────────────────────────────────────────────
  // Lifecycle hooks
  // ─────────────────────────────────────────────
  public async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  public ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    // Reserved for any DOM-bound logic (dropzones, listeners, etc.)
  }

  public ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ─────────────────────────────────────────────
  // Role / user helpers
  // ─────────────────────────────────────────────
  get isAdminTenant(): boolean {
    const isAdminLike: boolean = this.adminLike;
    const isTenantAdmin: boolean =
      this.tenantId === this.loggedUser?.username; // adjust if needed: username vs ID
    return isAdminLike && isTenantAdmin;
  }

  get adminLike(): boolean {
    try {
      if (!this.loggedUser) {
        throw new Error('Logged user is invalid!');
      }
      const roles: string[] = ['admin', 'manager', 'operator', 'developer'];
      const userRole: User['role'] = this.loggedUser.role;
      return roles.includes(userRole);
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // Status & stage indicator
  // ─────────────────────────────────────────────
  protected get status(): ComplaintClient['status'] {
    return this._status;
  }

  protected set status(value: ComplaintClient['status']) {
    this._status = value;
    this.handleStatusChange();
  }

  /**
   * Converts the static complaint status list into stage points
   * usable by <app-stage-indicator>.
   */
  get STATUS_STAGE(): StagePoint[] {
    if (this.DEFINED_STATUS.length <= 1) {
      return this.DEFINED_STATUS.map((status) => ({
        key: status,
        label: this.statusToLabel(status),
        value: 0,
      } satisfies StagePoint));
    }

    return this.DEFINED_STATUS.map((status, index) => {
      return {
        key: status,
        label: this.statusToLabel(status),
        value: (index * 100) / (this.DEFINED_STATUS.length - 1), // evenly spaced 0–100
      } satisfies StagePoint;
    });
  }

  get STATUS_CURRENT_VALUE(): number {
    return this._currentStatusPoint;
  }

  set STATUS_CURRENT_VALUE(value: number) {
    this._currentStatusPoint = value;
  }

  private handleStatusChange(): void {
    const currentStatus = this.status as ComplaintStatus | undefined;

    const index: number = currentStatus
      ? this.DEFINED_STATUS.indexOf(currentStatus)
      : -1;

    if (index < 0) {
      this.STATUS_CURRENT_VALUE = 0;
      return;
    }

    const lastIndex: number = this.DEFINED_STATUS.length - 1;
    this.STATUS_CURRENT_VALUE = (index * 100) / lastIndex;
  }

  private statusToLabel(status: ComplaintStatus): string {
    switch (status) {
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

  // ─────────────────────────────────────────────
  // Complaint loading & initialisation
  // ─────────────────────────────────────────────
  private async loadComplaintById(complaintId: string): Promise<void> {
    const res = await this.tenantService.getComplaintById(complaintId);

    if (res.status !== 'success') {
      throw new Error('Failed to get complaint!');
    }

    const complaint: ComplaintClient | undefined = res.data?.system?.complaint;
    if (!complaint) {
      throw new Error('Invalid complaint data!');
    }

    await this.dataInit(complaint);
    this.saveInitialComplaintSnapshot(complaint);
  }

  private async dataInit(complaint: ComplaintClient): Promise<void> {
    try {
      if (!complaint) {
        throw new Error('Invalid complaint!');
      }

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
      // this.audience = complaint.audience; // when available

      this.fromStatus = complaint.status;
      this.assigneeId = complaint.assigneeId;
      this.assigneeName = complaint.assigneeName;

      // comment / attachments / etc. can be hydrated here when the API supports it

      return;
    } catch (err) {
      console.error(err);
      this.notification.notification('error', 'Assigning data failed!');
    }
  }

  /**
   * Keep a snapshot of the original complaint so that "Cancel"
   * can restore the initial state.
   */
  private saveInitialComplaintSnapshot(complaint: ComplaintClient): void {
    this.originalComplaint = complaint;
  }

  // ─────────────────────────────────────────────
  // Team table operations (skeletons / TODO)
  // ─────────────────────────────────────────────
  private async handlePageIndexing(): Promise<void> {
    // TODO: implement pagination logic once API is final
  }

  protected async handelFetchingOnTeamAdd(): Promise<void> {
    // TODO: call loadTeamAddData with current index/limit/search
  }

  protected async teamAddActionButtonCenter(
    value: TableButtonActionConfig,
  ): Promise<void> {
    // TODO: handle "view" / "add" actions here
  }

  private async loadTeamAddData(
    index: number,
    limit: number,
    search?: string,
  ): Promise<void> {
    try {
      const countRes = await this.APIsService.getAllUserCount();
      if (countRes.status !== 'success') {
        throw new Error('Failed to fetch all user count!');
      }

      const total: number | undefined = countRes.data?.pagination?.total;

      if(!total || Number.isNaN(total) || !Number.isInteger(total) || !Number.isFinite(total)){
        throw new Error('Invalid total number of users');
      }

      const safeIndex: number = PaginationUtil.safeIndex(index, total);
      const safeLimit: number = PaginationUtil.safeLimit(limit, total);
      const safeSearch: string | undefined = search ? search.trim() : undefined;


    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        this.notification.notification('error', error.message);
      } else if (error instanceof HttpErrorResponse) {
        this.notification.notification('error', error.message);
      } else {
        this.notification.notification(
          'error',
          'Unexpected error while fetching users!',
        );
      }
    }
  }

  protected async handelFetchingOnTeamRemove(): Promise<void> {
    // TODO: implement fetching logic for "assigned team" table
  }

  protected async teamRemoveActionButtonCenter(
    value: TableButtonActionConfig,
  ): Promise<void> {
    // TODO: handle "view" / "remove" actions here
  }

  private onTeamMemberRemove(): void {
    try {
      const dialogRef = this.dialog.open(ConfirmationComponent, {
        data: {
          title: 'Remove team member',
          body: 'Are you sure you want to remove this team member?',
        },
      });

      dialogRef.afterClosed().subscribe(async (confirmed): Promise<void> => {
        try {
          if (!confirmed) return;

          // TODO: call API to remove team member & refresh tables
        } catch (err) {
          console.error(err);
        }
      });
    } catch (error) {
      console.error(error);
    }
  }

  // ─────────────────────────────────────────────
  // Comment & attachments
  // ─────────────────────────────────────────────
  protected getCommentFileUploads(files: File[]): void {
    try {
      if (!Array.isArray(files)) {
        throw new Error('Invalid file selection!');
      }

      // TODO: map to PendingAttachmentClient[] and assign to pendingAttachments
      // this.pendingAttachments = ...
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        this.notification.notification('error', error.message);
      } else {
        this.notification.notification('error', 'Unexpected error occurred!');
      }
    }
  }

  protected resetCommentForm(): void {
    this.comment = '';
    this.pendingAttachments = [];
    // if you have a form reference, also reset it there
  }

  // ─────────────────────────────────────────────
  // Form actions (main & comments)
  // ─────────────────────────────────────────────
  protected async onCancel(): Promise<void> {
    try {
      if (!this.originalComplaint) {
        throw new Error('No initial complaint snapshot found!');
      }

      await this.dataInit(this.originalComplaint);
    } catch (error) {
      console.error(error);
    }
  }

  protected async submit(): Promise<void> {
    try {
      // TODO: build payload from editable fields and call update API
      // Use this.updatedAt, timeline, etc. if needed
    } catch (err) {
      console.error(err);
    }
  }

  protected async commentSubmit(): Promise<void> {
    try {
      // TODO: call API to add comment + attachments, then refresh comments list
      this.resetCommentForm();
    } catch (err) {
      console.error(err);
    }
  }
}
