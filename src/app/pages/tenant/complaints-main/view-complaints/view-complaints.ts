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
  TenantService,
  type ComplaintAudience,
  type ComplaintClient,
  type ComplaintCommentClient,
  type ComplaintsCategory,
  type ComplaintStatus,
  type PendingAttachmentClient
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

// Material UI imports
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';


type IncomingComplaintRef = {
  tenantID?: string;
  code?: string;
  byUserId?: string;
  byName?: string;
  image?: string;
  audience?: ComplaintAudience;
};

@Component( {
  selector: 'app-view-complaints',
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
    // Components
    NotificationDialogComponent,
    ProgressBarComponent,
    StageIndicatorComponent,
    TextEditorComponent,
    Dropdown,
    Textarea,
    CommentsListComponent,
  ],
  templateUrl: './view-complaints.html',
  styleUrl: './view-complaints.scss'
} )
export class ViewComplaints implements OnInit, AfterViewInit, OnDestroy {

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
  protected readonly DEFINED_AUDIENCES: string[] = [ 'admin', 'all', 'agent', 'developer', 'manager', 'operator', 'owner', 'system', 'tenant', 'user' ];
  protected complaint!: ComplaintClient;
  protected adminComment !: ComplaintCommentClient[ 'message' ];
  protected comment !: ComplaintCommentClient[ 'message' ];
  private pendingAttachments !: PendingAttachmentClient[];
  private userID!: ComplaintCommentClient[ 'byUserId' ];
  private userFullName!: ComplaintCommentClient[ 'byName' ];
  private userImage !: ComplaintCommentClient[ 'image' ];
  protected audience: ComplaintCommentClient[ 'audience' ] = 'all';


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
    if ( this.loggedUser ) {
      this.userID = this.loggedUser.username.trim();
      this.userFullName = this.loggedUser.name.trim();
      this.userImage = String( this.loggedUser.image ).trim();
    }

    this.route.params.subscribe( async ( item ): Promise<void> => {
      try {
        const comaplaintID = item[ 'complaintID' ];
        const res: MSG = await this.tenantService.getComplaintById( comaplaintID );
        if ( res.status !== 'success' ) throw new Error( 'Faild to get complaint!' );
        this.complaint = res.data;
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
    // 01. Safely extract current complaint status
    const currentStatus = this.complaint?.status as ComplaintStatus | undefined;

    // 02. Find its index in the defined status array
    const index = currentStatus
      ? this.DEFINED_STATUS.indexOf( currentStatus )
      : -1;

    // 03. Defensive guard: unknown status → return 0
    if ( index < 0 ) return 0;

    // 04. Calculate proportional position (0 → 100)
    const lastIndex = this.DEFINED_STATUS.length - 1;
    return ( index * 100 ) / lastIndex;
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

  /*
  *
  * File Uploads
  *
  */
  protected onQueueChanged( files: File[] ): void { this.pendingAttachments = files.map( f => ( { source: 'dragdrop', file: f } ) ); }

  // Page indicators
  protected async gotComplaintDashboard(): Promise<void> {
    try {
      await this.router.navigate( [ '/dashboard/tenant/complaints' ] );
      return;
    }
    catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'Route to complaints failed!' );
      return;
    }
  }

  protected async createComplaint(): Promise<void> {
    try {
      if ( !this.loggedUser ) throw new Error( 'Logged user invalid!' );
      if ( !this.complaint ) throw new Error( 'Generate complaint failed!' );
      await this.router.navigate( [ '/dashboard/tenant/complaints/create-complaint', this.complaint.code ] );
      return;
    }
    catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'Route to complaints failed!' );
      return;
    }
  }

  protected async viewProperty(): Promise<void> {
    try {
      if ( !this.complaint ) throw new Error( 'Failed to load complaint data!' );
      if ( !this.complaint.propertyId ) throw new Error( 'Failed to process property ID!' );
      this.router.navigate( [ '/dashboard/properties/property-view', this.complaint.propertyId ] );
    }
    catch ( err ) {
      console.error( err );
      this.notification.notification( 'warning', 'Failed to view property!' );
      return;
    }
  }

  protected async viewLease(): Promise<void> {
    try {
      if ( !this.complaint ) throw new Error( 'Failed to load complaint data!' );
      if ( !this.complaint.leaseId ) throw new Error( 'Failed to process lease ID!' );
      this.router.navigate( [ '/dashboard/tenant/view-lease', this.complaint.leaseId ] );
    }
    catch ( err ) {
      console.error( err );
      this.notification.notification( 'warning', 'Failed to view lease!' );
      return;
    }
  }

  protected async editComplaint(): Promise<void> {
    try {
      if ( !this.complaint ) throw new Error( 'Failed to load complaint data!' );
      if ( !this.complaint.code ) throw new Error( 'Failed to process complaint ID!' );
      this.router.navigate( [ '/dashboard/tenant/complaints/edit-complaint', this.complaint.code ] );
    }
    catch ( err ) {
      console.error( err );
      this.notification.notification( 'warning', 'Failed to view lease!' );
      return;
    }
  }



  //__________________________________________________________________________
  // Submit Comment
  //__________________________________________________________________________

  protected async commentPost(): Promise<void> {
    // Guard SSR/Electron if needed; keep your existing project pattern
    // if (!isPlatformBrowser(this.platformId)) { return; }

    try {
      // 1) Compute the comment text (admin vs normal)
      const commentText = ( this.adminComment?.trim() || this.comment?.trim() || '' ).trim();

      // 2) Front-end validations (user-friendly + consistent with backend)
      if ( !commentText ) {
        this.notification.notification( 'error', 'Comment cannot be empty!' );
        throw new Error( 'Comment cannot be empty!' );
      }
      if ( !this.userID ) throw new Error( 'User ID is invalid!' );
      if ( !this.userFullName ) throw new Error( 'User name is invalid!' );
      if ( !this.userImage ) throw new Error( 'User image is invalid!' );
      if ( !this.audience ) throw new Error( 'Invalid audience!' );

      const normalizedAudience = this.audience.toLowerCase() as ComplaintAudience;
      const allowed: ComplaintAudience[] = [
        'admin', 'all', 'agent', 'tenant', 'owner', 'operator', 'manager', 'developer', 'user', 'system'
      ];
      if ( !allowed.includes( normalizedAudience ) ) {
        this.notification.notification( 'error', 'Unsupported audience selected.' );
        throw new Error( 'Unsupported audience selected.' );
      }

      // Extract complaint identifiers from current context
      // NOTE: backend expects tenantID + code inside "complaint" JSON
      const tenantID = ( this.complaint?.tenantId || '' ).toString().trim();
      const code = ( this.complaint?.code || '' ).toString().trim();
      if ( !tenantID ) throw new Error( 'Complaint tenantID is missing!' );
      if ( !code ) throw new Error( 'Complaint ID (code) is missing!' );

      // 3) Build complaint ref payload exactly as backend expects
      const complaintRef: IncomingComplaintRef = {
        tenantID,
        code,
        byUserId: this.userID.trim(),
        byName: this.userFullName.trim(),
        image: this.userImage.trim(),
        audience: normalizedAudience,
      };

      // 4) Build multipart form data
      const fd = new FormData();

      // The backend parses ALL of these from the single `complaint` JSON string.
      fd.append( 'complaint', JSON.stringify( complaintRef ) );

      // Attachments
      const files = Array.isArray( this.pendingAttachments ) ? this.pendingAttachments : [];
      const validFiles = files
        .map( ( x: any ) => x?.file as File )
        .filter( ( f: File ) => !!f );

      // Count MUST equal actual number of appended files
      fd.append( 'attachmentCount', String( validFiles.length ) );
      for ( const f of validFiles ) {
        fd.append( 'attachments', f, f.name );
      }

      // The plain text comment body
      fd.append( 'comment', commentText );

      // 5) UX: start progress
      this.progressBar.start();

      // 6) Call API
      const res: MSG = await this.tenantService.postComment( fd );


      // 7) Handle response schema aligned with backend: { success: boolean, status: 'success' | 'warning' | 'error', data?: { code, comment } }
      if ( res.status !== "success" ) {
        this.notification.notification( 'error', res?.message || 'Comment post failed!' );
        throw new Error( res?.message || 'Comment post failed!' );
      }

      // 8) Optionally update local UI (append new comment returned by backend)
      const created = res.data?.comment;
      if ( created ) {
        console.log( created );
        // example: push to your local comments list if available
        // (ensure your local model matches ComplaintCommentClient)
        this.complaint = this.complaint || {};
        this.complaint.comments = Array.isArray( this.complaint.comments ) ? this.complaint.comments : [];
        this.complaint.comments.push( created );
      }

      // 9) Clear composer state (optional)
      this.comment = '';
      this.adminComment = '';
      this.pendingAttachments = []; // or your local wrapper reset

      // 10) Notify success
      this.notification.notification( 'success', 'Comment posted successfully.' );
    }
    catch ( error ) {
      console.error( '[commentPost] failed:', error );
      this.notification.notification( 'error', ( error as Error )?.message || 'Failed to post comment.' );
      this.progressBar.stop();
      return;
    }
    finally {
      this.progressBar.complete();
      return;
    }
  }
}
