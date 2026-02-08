// ─────────────────────────────────────────────────────────────────────────────
// Path: src/app/pages/tenant-management/complaints/edit/edit-complaints.ts
// Reconstructed to match CommentsListComponent contract (parent owns API/state).
// ─────────────────────────────────────────────────────────────────────────────

import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Subscription } from 'rxjs';

// Services & types
import { AuthService } from '../../../../services/auth/auth.service';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUS,
  TenantService,
  type ComplaintClient,
  type ComplaintPriority,
  type ComplaintsCategory,
  type ComplaintStatus,
  type UpdateComplaintBasicPayload
} from '../../../../services/tenant/tenant.service';

import { WindowsRefService } from '../../../../services/windowRef/windowRef.service';

// Components
import { NotificationDialogComponent } from '../../../../components/dialogs/notificationBar/notificationBar.component';
import { ProgressBarComponent } from '../../../../components/dialogs/progress-bar/progress-bar.component';
import {
  CommentsListComponent,
} from '../../../../components/shared/comments/comments-list.component';
import { TextEditorComponent } from '../../../../components/shared/textEditor/text-editor';

// Material
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

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

    // App components
    NotificationDialogComponent,
    ProgressBarComponent,
    CommentsListComponent,
    TextEditorComponent,
  ],
  templateUrl: './edit-complaints.html',
  styleUrl: './edit-complaints.scss',
})
export class EditComplaints implements OnInit, AfterViewInit, OnDestroy {
  // ─────────────────────────────────────────────
  // View refs
  // ─────────────────────────────────────────────
  @ViewChild(NotificationDialogComponent)
  protected notification!: NotificationDialogComponent;

  @ViewChild(ProgressBarComponent)
  protected progressBar!: ProgressBarComponent;

  @ViewChild( 'editForm' )
  protected editForm!: NgForm;

  // ─────────────────────────────────────────────
  // Platform / mode
  // ─────────────────────────────────────────────
  protected readonly isBrowser: boolean;
  protected mode: boolean | null = null;
  private modeSub: Subscription | null = null;

  // ─────────────────────────────────────────────
  // Screen state
  // ─────────────────────────────────────────────
  protected isLoading: boolean = true;
  protected isSaving: boolean = false;
  protected isCommentLoading: boolean = false;
  protected complaint: ComplaintClient | null = null;

  // ─────────────────────────────────────────────
  // Static lists
  // ─────────────────────────────────────────────
  protected readonly DEFINED_CATEGORIES: readonly ComplaintsCategory[] = COMPLAINT_CATEGORIES;
  protected readonly DEFINED_STATUS: readonly ComplaintStatus[] = COMPLAINT_STATUS;
  protected readonly DEFINED_PRIORITIES: readonly ComplaintPriority[] = COMPLAINT_PRIORITIES;

  // ─────────────────────────────────────────────
  // Complaint identifiers
  // ─────────────────────────────────────────────
  private complaintId: string = '';
  protected code: string = '';

  // ─────────────────────────────────────────────
  // Complaint (basic editable)
  // ─────────────────────────────────────────────
  protected title: string = '';
  protected description: string = '';
  protected category!: ComplaintsCategory;
  protected priority!: ComplaintPriority;

  // non-editable for this screen (but displayed)
  protected status!: ComplaintStatus;
  protected tenantName?: string;
  protected propertyName?: string;
  protected leaseId?: string;
  protected updatedAtIso: string = '';

  // Snapshot for cancel/reset
  private originalComplaint: ComplaintClient | null = null;

  // ─────────────────────────────────────────────
  // Comments state (parent owns API)
  // ─────────────────────────────────────────────
  protected loggedInUserId?: string;

  public constructor (
    @Inject(PLATFORM_ID) private readonly platformId: Object,
    private readonly windowRef: WindowsRefService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    const u = this.authService.getLoggedUser;
    // Your system often uses username as identity. If your backend uses Mongo _id, change here.
    this.loggedInUserId = u?.username ? String( u.username ).trim() : undefined;

    this.route.params.subscribe(async (params): Promise<void> => {
      try {
        const id = String( params[ 'complaintID' ] ?? '' ).trim();
        if ( !id ) {
          throw new Error('Complaint ID is missing!');
        }
        this.complaintId = id;
        await this.loadComplaint();
      } catch ( e ) {
        console.error( '[Error:] Edit complaint route init failed\n', e );
        this.isLoading = false;
        this.notification?.notification( 'error', 'Failed to load complaint' );
      }
    });
  }

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────
  public async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe( ( v ) => ( this.mode = v ) );
    }
  }

  public ngAfterViewInit(): void {
    // Reserved for DOM-only logic (SSR safe)
  }

  public ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ─────────────────────────────────────────────
  // Lock rule
  // ─────────────────────────────────────────────
  protected get isEditLocked(): boolean {
    // EXACT requirement: when status is in_progress => disable edit fields
    return this.status === 'in_progress';
  }

  // ─────────────────────────────────────────────
  // Load complaint + hydrate UI
  // ─────────────────────────────────────────────
  private async loadComplaint(): Promise<void> {
    this.isLoading = true;
    this.progressBar.start();

    const res = await this.tenantService.getComplaintById( this.complaintId );
    if ( res.status !== 'success' ) {
      this.isLoading = false;
      throw new Error( res.message || 'Failed to get complaint' );
    }

    const complaint: ComplaintClient | undefined = res.data?.system?.complaint;
    if ( !complaint ) {
      this.isLoading = false;
      throw new Error( 'Invalid complaint data' );
    }

    this.complaint = complaint;
    this.applyComplaintToForm( complaint );
    this.saveSnapshot( complaint );


    this.isLoading = false;
    this.progressBar.complete();
  }

  private applyComplaintToForm( complaint: ComplaintClient ): void {
    // Basic editable
    this.title = String( complaint.title ?? '' );
    this.description = String( complaint.description ?? '' );
    this.category = complaint.category;
    this.priority = complaint.priority;

    // Read-only display
    this.status = complaint.status;
    this.code = complaint.code;
    this.tenantName = complaint.tenantName;
    this.propertyName = complaint.propertyName;
    this.leaseId = complaint.leaseId;
    this.updatedAtIso = complaint.updatedAt;
  }

  private saveSnapshot( complaint: ComplaintClient ): void {
    // Safe deep clone snapshot for reset
    this.originalComplaint = JSON.parse( JSON.stringify( complaint ) ) as ComplaintClient;
  }


  protected async submit(): Promise<void> {
    try {
      if ( this.isEditLocked ) {
        this.notification?.notification( 'warning', 'Complaint is In Progress — basic editing is locked' );
        return;
      }

      const safeTitle = String( this.title ?? '' ).trim();
      const safeDesc = String( this.description ?? '' ).trim();

      if ( !safeTitle ) {
        this.notification?.notification( 'error', 'Title is required' );
        return;
      }
      if ( !safeDesc ) {
        this.notification?.notification( 'error', 'Description is required' );
        return;
      }

      const payload: UpdateComplaintBasicPayload = {
        title: safeTitle,
        description: safeDesc,
        category: this.category,
        priority: this.priority,
      };

      this.isSaving = true;
      this.progressBar.start();

      const resp = await this.tenantService.updateComplaintBasic( this.complaintId, payload );
      if ( resp.status !== 'success' ) {
        this.isSaving = false;
        this.progressBar.complete();
        this.notification?.notification( 'error', resp.message || 'Update failed' );
        return;
      }

      // Refresh from server so UI matches persisted state
      await this.loadComplaint();

      this.isSaving = false;
      this.progressBar.complete();
      this.notification?.notification( 'success', 'Complaint updated successfully' );
    } catch ( e ) {
      console.error( '[Error:] Submit failed\n', e );
      this.isSaving = false;
      this.progressBar.stop();
      this.notification?.notification( 'error', 'Unexpected error while updating complaint' );
    }
  }


  protected onCancel(): void {
    if ( !this.complaint ) {
      return;
    }
    // Basic editable
    this.title = this.complaint.title;
    this.description = this.complaint.description;
    this.category = this.complaint.category;
    this.priority = this.complaint.priority;

    // Read-only display
    this.status = this.complaint.status;
    this.code = this.complaint.code;
    this.tenantName = this.complaint.tenantName;
    this.propertyName = this.complaint.propertyName;
    this.leaseId = this.complaint.leaseId;
    this.updatedAtIso = this.complaint.updatedAt;
  }
  // ─────────────────────────────────────────────
  // CommentsList events (parent owns API)
  // ─────────────────────────────────────────────
  protected async onCommentsRefreshRequested(): Promise<void> {
    try {
      this.isCommentLoading = true;
      await this.loadComplaint(); // refresh comment list from complaint payload
      this.isCommentLoading = false;
    } catch ( e ) {
      console.error( '[Error:] Comments refresh failed\n', e );
      this.isCommentLoading = false;
      this.notification?.notification( 'error', 'Failed to refresh comments' );
    }
  }

  protected async onCommentsLoadMoreRequested(): Promise<void> {
    // Your backend API for comments paging isn’t shown.
    // For now: no-op, but keep event to match the component contract.
    this.notification?.notification( 'info', 'Load more is not wired to backend yet' );
  }

  protected async onCommentsBackendSearchRequested( _query: string ): Promise<void> {
    // Only enable if you add an endpoint like:
    // GET /complaints/:id/comments?search=...
    this.notification?.notification( 'info', 'Backend search is not enabled for comments yet' );
  }

}
