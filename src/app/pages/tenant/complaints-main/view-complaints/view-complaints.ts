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
import { PropertyService } from '../../../../services/property/property.service';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUS,
  TenantService,
  type ComplaintAudience,
  type ComplaintClient,
  type ComplaintsCategory,
  type ComplaintStatus
} from '../../../../services/tenant/tenant.service';
import { WindowsRefService } from '../../../../services/windowRef/windowRef.service';

// Component imports
import { NotificationDialogComponent } from '../../../../components/dialogs/notificationBar/notificationBar.component';
import { ProgressBarComponent } from '../../../../components/dialogs/progress-bar/progress-bar.component';
import {
  CommentsListComponent,
} from '../../../../components/shared/comments/comments-list.component';
import { StageIndicatorComponent, type StagePoint } from '../../../../components/shared/stageIndicator/stage-indicator.component';

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

  protected loggedUser!: User | null;

  // ─────────────────────────────────────────────
  // Complaint
  // ─────────────────────────────────────────────
  protected readonly NO_COMPLAINT_DATA: string = 'Images/System-images/noComplaints.png';
  protected readonly DEFINED_CATEGORIES: readonly ComplaintsCategory[] = COMPLAINT_CATEGORIES;
  protected readonly DEFINED_STATUS: readonly ComplaintStatus[] = COMPLAINT_STATUS;
  protected readonly DEFINED_AUDIENCES: string[] = [
    'admin', 'all', 'agent', 'developer', 'manager', 'operator', 'owner', 'system', 'tenant', 'user'
  ];

  protected complaint!: ComplaintClient;


  public constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private platformId: Object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly renderer: Renderer2,
    private readonly apiService: APIsService,
    private readonly propertyService: PropertyService,
    private readonly dialog: MatDialog,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    this.loggedUser = this.authService.getLoggedUser;

    this.route.params.subscribe( async ( item ): Promise<void> => {
      try {
        const complaintID = item[ 'complaintID' ];
        const res = await this.tenantService.getComplaintById( complaintID );

        if ( res.status !== 'success' ) throw new Error( 'Failed to get complaint!' );
        const complaint: ComplaintClient | undefined = res.data?.system?.complaint;

        if ( !complaint ) throw new Error( 'Invalid complaint data!' );
        this.complaint = complaint;

        return;

      } catch ( error ) {
        console.error( '[Error:][ViewComplaints:loadComplaint]\n', error );
        this.notification.notification( 'error', 'Failed to get complaint' );
        return;
      }
    } );
  }

  public async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( val => { this.mode = val; } );
    }
  }

  public ngAfterViewInit(): void {
    if ( !this.isBrowser ) return;
  }

  public ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ─────────────────────────────────────────────
  // Stage indicator helpers
  // ─────────────────────────────────────────────

  public get STATUS_STAGE(): StagePoint[] {
    return this.DEFINED_STATUS.map( ( status, index ) => {
      return {
        key: status,
        label: this.statusToLabel( status ),
        value: index * 100 / ( this.DEFINED_STATUS.length - 1 ),
      } satisfies StagePoint;
    } );
  }

  public get STATUS_CURRENT_VALUE(): number {
    const currentStatus = this.complaint?.status as ComplaintStatus | undefined;
    const index = currentStatus ? this.DEFINED_STATUS.indexOf( currentStatus ) : -1;
    if ( index < 0 ) return 0;

    const lastIndex = this.DEFINED_STATUS.length - 1;
    return ( index * 100 ) / lastIndex;
  }

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

  public get adminAccess(): boolean {
    try {
      if ( !this.loggedUser ) throw new Error( 'Logged user is invalid!' );
      const roles: string[] = [ 'admin', 'manager', 'operator', 'developer' ];
      const userRole: User[ 'role' ] = this.loggedUser.role;
      return roles.includes( userRole );
    } catch ( err ) {
      console.error( '[Error:][adminAccess]\n', err );
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────

  protected async gotComplaintDashboard(): Promise<void> {
    try {
      await this.router.navigate( [ '/dashboard/tenant/complaints' ] );
      return;
    } catch ( err ) {
      console.error( '[Error:][gotComplaintDashboard]\n', err );
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
    } catch ( err ) {
      console.error( '[Error:][createComplaint]\n', err );
      this.notification.notification( 'error', 'Route to complaints failed!' );
      return;
    }
  }

  protected async viewProperty(): Promise<void> {
    try {
      if ( !this.complaint ) throw new Error( 'Failed to load complaint data!' );
      if ( !this.complaint.propertyId ) throw new Error( 'Failed to process property ID!' );
      this.router.navigate( [ '/dashboard/properties/property-view', this.complaint.propertyId ] );
      return;
    } catch ( err ) {
      console.error( '[Error:][viewProperty]\n', err );
      this.notification.notification( 'warning', 'Failed to view property!' );
      return;
    }
  }

  protected async viewLease(): Promise<void> {
    try {
      if ( !this.complaint ) throw new Error( 'Failed to load complaint data!' );
      if ( !this.complaint.leaseId ) throw new Error( 'Failed to process lease ID!' );
      this.router.navigate( [ '/dashboard/tenant/view-lease', this.complaint.leaseId ] );
      return;
    } catch ( err ) {
      console.error( '[Error:][viewLease]\n', err );
      this.notification.notification( 'warning', 'Failed to view lease!' );
      return;
    }
  }

  protected async editComplaint(): Promise<void> {
    try {
      if ( !this.complaint ) throw new Error( 'Failed to load complaint data!' );
      if ( !this.complaint.code ) throw new Error( 'Failed to process complaint ID!' );
      this.router.navigate( [ '/dashboard/tenant/complaints/edit-complaint', this.complaint.code ] );
      return;
    } catch ( err ) {
      console.error( '[Error:][editComplaint]\n', err );
      this.notification.notification( 'warning', 'Failed to edit complaint!' );
      return;
    }
  }



  private normalizeLimit( value: number ): number {
    const n = Number( value );
    if ( !Number.isFinite( n ) ) return 6;
    if ( n < 1 ) return 1;
    if ( n > 50 ) return 50;
    return Math.floor( n );
  }
}
