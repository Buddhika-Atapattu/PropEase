// /src/pages/notifications/delete-item-notifications/deleted-item-notifications.ts

import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  AfterViewInit,
  Pipe,
  PipeTransform,
  ViewChild,
} from '@angular/core';

import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import {
  NotificationService,
  Notification,
  Severity,
  UserRole,
  PermanentDeletePayload,
  BackendBasicResponse, // <-- we’ll use this for a quick FE guard on permanent delete
  TitleCategory
} from '../../../services/notifications/notification-service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import { NotificationDialogComponent } from '../../../components/dialogs/notification/notificationBar.component';
import {
  RestoreNotificationPayload
} from '../../../types/notification.types'; // If you keep these types in service, adjust import path
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationComponent } from '../../../components/shared/confirmation/confirmation.component';
import { BackendActionResult, NotificationsRoutingService } from '../../../services/notificationRouting/notifications-routing-service';


/* ─────────────────────────────────────────────────────────────────────────────
 * Pipe: MetaRender
 * Renders short, readable strings for metadata values in the grid
 *  - Strings: returned as-is
 *  - Objects/arrays: JSON.stringify capped at ~80 chars for compact display
 * ───────────────────────────────────────────────────────────────────────────── */
@Pipe( { name: 'metaRender', standalone: true } )
export class MetaRenderPipe implements PipeTransform {
  transform( v: any ): string {
    if ( v == null ) return '';
    if ( typeof v === 'string' ) return v;
    try {
      const s = JSON.stringify( v );
      return s.length > 80 ? s.slice( 0, 77 ) + '…' : s;
    } catch {
      return String( v );
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Deleted Item Review Page
 *  - Grabs the selected notification via query param (?selected=<id>)
 *  - Shows metadata and actions:
 *      • Restore (soft-undelete / reinsert)
 *      • Permanent Delete (hard delete) — ADMIN ONLY
 *  - Uses your NotificationService REST methods + existing dialog components
 * ───────────────────────────────────────────────────────────────────────────── */
@Component( {
  selector: 'app-deleted-item-notifications',
  standalone: true,
  imports: [ CommonModule, MetaRenderPipe, MatIconModule, ProgressBarComponent, NotificationDialogComponent ],
  templateUrl: './deleted-item-notifications.html',
  styleUrl: './deleted-item-notifications.scss',
} )
export class DeletedItemNotificationsPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild( ProgressBarComponent ) progress!: ProgressBarComponent;
  @ViewChild( NotificationDialogComponent ) notificationDialogComponent!: NotificationDialogComponent;

  /** Theme mode (from WindowRefService); gate rendering until known. */
  protected mode: boolean | null = null;
  protected isBrowser: boolean;

  /** Page state */
  protected loading = true;
  protected error: string | null = null;

  /** Current notification (selected via ?selected=) */
  protected notification: Notification | null = null;

  /** Flattened metadata grid for quick scanning */
  protected primaryMeta: Array<{ key: string; value: any; }> = [];

  /** UI toggles */
  protected showRaw = false;
  protected confirm: 'restore' | 'delete' | null = null;

  private modeSub: Subscription | null = null;
  private qpSub: Subscription | null = null;

  /** Fallback image */
  protected readonly dummyUserImg = 'Images/user-images/dummy-user/dummy-user.jpg';

  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly notif: NotificationService,
    private readonly http: HttpClient,
    private readonly dialog: MatDialog,
    private readonly notificationsRouting: NotificationsRoutingService,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
  }

  /* ─────────────────────────── Lifecycle ─────────────────────────── */

  ngOnInit(): void {
    // 1) Watch theme/“mode” like in other pages
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => ( this.mode = val ) );
    }

    // 2) Read ?selected=… and resolve the notification from in-memory cache or by pulling a fresh page
    this.qpSub = this.route.queryParamMap.subscribe( async ( params ) => {
      const id = params.get( 'selected' );
      if ( !id ) {
        this.loading = false;
        this.error = 'No deleted item selected.';
        return;
      }
      await this.resolveNotification( id );
    } );

    this.authHeaders();
  }

  ngAfterViewInit(): void {
    // No-op: Keep for symmetry; we already show a progress bar during async actions.
    if ( this.notification ) {
      console.log( this.notification );
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.qpSub?.unsubscribe();
  }

  /* ─────────────────────────── UI helpers ─────────────────────────── */

  /** Severity → chip class mapping (visual hint only). */
  protected severityClass( s?: Severity ) {
    switch ( s ) {
      case 'success':
        return 'bg-success-subtle text-success';
      case 'warning':
        return 'bg-warning-subtle text-warning';
      case 'error':
        return 'bg-danger-subtle text-danger';
      default:
        return 'bg-info-subtle text-info';
    }
  }

  protected toggleRaw() { this.showRaw = !this.showRaw; }
  protected askRestore( n: Notification ) {
    const dialog = this.dialog.open( ConfirmationComponent, {
      width: '400px',
      height: 'auto',
      data: {
        title: 'Confirm Restore',
        message: 'Do you wish to restore these data!'
      }
    } );

    dialog.afterClosed().subscribe( async ( val ) => {
      if ( val ) {
        this.confirm = 'restore';
        await this.restore( n );
      }
      else {
        this.confirm = null;
      }
    } );
  }
  protected askPermanentDelete( n: Notification ) {
    const dialog = this.dialog.open( ConfirmationComponent, {
      width: '400px',
      height: 'auto',
      data: {
        title: 'Permanent Delete',
        message: 'Do you wish to permanent delete these data!'
      }
    } );

    dialog.afterClosed().subscribe( async ( val ) => {
      if ( val ) {
        this.confirm = 'delete';
        await this.permanentDelete( n );
      }
      else {
        this.confirm = null;
      }
    } );
  }
  // protected cancelConfirm() {this.confirm = null;}

  /** Navigate back to the notifications list view. */
  protected backToList() {
    this.router.navigate( [ '/dashboard/notifications/all-notifications' ] );
  }

  /* ─────────────────────────── Actions ─────────────────────────── */

  /**
   * Restore the deleted domain record referenced by this notification.
   * BACKEND EXPECTS: { category, refId? OR snapshot? OR metadata.filePath? }
   * BEST PRACTICE:
   *  - Prefer refId (fastest, if soft-deleted).
   *  - If fully removed, send a snapshot (domain JSON) or metadata.filePath.
   */
  protected async restore( notification: Notification ) {
    try {
      this.loading = true;
      this.progress.start();

      const category = notification.category;
      const refId = this.discoverRefId( notification );
      const snapshot = this.discoverSnapshot( notification );

      // Carefully rebuild metadata in the new shape
      const incomingData = ( notification.metadata?.data ?? {} ) as Record<string, any>;
      const meta =
        refId || snapshot || Object.keys( incomingData ).length
          ? {
            refId: ( notification.metadata?.refId || refId || '' ).trim(),
            ...( Object.keys( incomingData ).length ? { data: incomingData } : {} ),
          }
          : undefined;

      const payload: RestoreNotificationPayload = {
        _id: notification._id,
        category,
        ...( refId ? { refId } : {} ),
        ...( snapshot ? { snapshot } : {} ),
        ...( meta ? { metadata: meta } : {} ),
      };

      const res = await this.notif.restoreDeleteJson( payload );
      console.log( res );
      if ( res?.success ) {
        this.notificationDialogComponent.notification( 'success', res.message || 'Item restored.' );
        await this.notificationsRouting.routeForAny( res as BackendActionResult );
        return;
      } else {
        this.notificationDialogComponent.notification( 'error', res?.message || 'Failed to restore the item!' );
      }
    } catch ( error ) {
      console.error( error );
      this.notificationDialogComponent.notification( 'error', 'Failed to restore the item!' );
    } finally {
      this.progress.complete();
      this.loading = false;
      this.confirm = null;
      setTimeout( () => {
        this.backToList();
      }, 1000 );
    }
  }


  /**
   * Permanently delete the domain record referenced by this notification.
   * ADMIN ONLY (server-enforced). We also add a small FE guard:
   *  - If we can read the current role and it is not 'admin', we show an error without calling the server.
   */
  protected async permanentDelete( notification: Notification ) {
    try {
      this.loading = true;
      this.progress.start();

      const refId = this.discoverRefId( notification );
      if ( !refId ) {
        this.notificationDialogComponent.notification( 'error', 'Cannot determine item id to delete.' );
        return;
      }

      const data = {
        reason: 'User requested permanent deletion from Deleted Items page',
        via: 'UI',
        ...( notification.metadata?.data ?? {} ),
      };

      const payload: PermanentDeletePayload = {
        category: notification.category,
        refId, // top-level required by backend
        // We keep metadata as a bag, but respect the new shape inside:
        metadata: {
          refId,
          data,
        },
      };

      const currentRole = this.getCurrentUserRole(); // cosmetic FE guard
      const res: BackendBasicResponse = await this.notif.permanentDeleteJson( payload, currentRole );

      console.log( res );
      if ( res?.success ) {
        this.notificationDialogComponent.notification( 'success', res.message || 'Item permanently deleted.' );
        return;
      } else {
        this.notificationDialogComponent.notification( 'error', res?.message || 'Failed to permanently delete the item!' );
      }
    } catch ( e: any ) {
      console.error( e );
      this.notificationDialogComponent.notification( 'error', e?.message || 'Failed to permanently delete the item!' );
    } finally {
      this.progress.complete();
      this.loading = false;
      this.confirm = null;
      setTimeout( () => {
        this.backToList();
      }, 1000 );
    }
  }


  /* ───────────────────────── internals ───────────────────────── */

  /**
   * Resolve the selected notification from cache, or fetch a page and try again.
   */
  private async resolveNotification( id: string ) {
    this.loading = true;
    this.error = null;

    // 1) Try cache
    const cached = await firstValueFrom( this.notif.itemById$( id ) );
    if ( cached ) {
      this.setNotification( cached );
      this.loading = false;
      return;
    }

    // 2) Fallback: fetch a page and try again
    try {
      await this.notif.load( { page: 0, limit: 50 } );
      const after = await firstValueFrom( this.notif.itemById$( id ) );
      if ( after ) {
        this.setNotification( after );
        this.loading = false;
        return;
      }
      this.error = 'Selected item not found in recent list.';
    } catch ( e: any ) {
      this.error = e?.message || 'Failed to load deleted item.';
    } finally {
      this.loading = false;
    }
  }

  /** Keep one place to normalize + extract a clean metadata grid */
  private setNotification( n: Notification ) {
    this.notification = n;
    this.primaryMeta = this.extractPrimaryMeta( n );
  }

  /**
   * Try to discover a *domain* id from the notification/metadata.
   * - We DO NOT use `notification.type` (that’s usually an action verb, not an id).
   * - Look through common keys set at delete time (tenantId, propertyId, userId, leaseId).
   * - Prefer `notification['targetId']` if your delete logic stored it.
   */
  /** Resolve the domain refId (usually username or natural key). */
  private discoverRefId( n: Notification ): string | undefined {
    // 1) New canonical place
    if ( typeof n.metadata?.refId === 'string' && n.metadata.refId.trim() ) {
      return n.metadata.refId.trim();
    }

    // 2) Common fallbacks inside metadata.data
    const data = ( n.metadata?.data ?? {} ) as Record<string, any>;
    const dataKeys = [
      'refId', 'id', '_id',
      'username', 'tenantUsername', 'owner',
      'propertyId', 'propertyID', 'propId',
      'tenantId', 'tenantID',
      'userId', 'userID',
      'leaseId', 'leaseID',
      'entityId', 'documentId',
    ];
    for ( const k of dataKeys ) {
      const v = data[ k ];
      if ( typeof v === 'string' && v.trim() ) return v.trim();
    }

    // 3) Legacy/grab-bag fallbacks (top level object fields if any were mirrored)
    const nAny = n as any;
    const legacyKeys = [ 'refId', 'id', '_id', 'username', 'tenantUsername', 'propertyId', 'leaseId', 'userId' ];
    for ( const k of legacyKeys ) {
      const v = nAny?.[ k ];
      if ( typeof v === 'string' && v.trim() ) return v.trim();
    }

    return undefined;
  }


  /**
   * Extract a domain snapshot if available (NOT the notification wrapper).
   * Where could it be?
   * - `metadata.snapshot`
   * - `metadata.domainSnapshot`
   * - If you purposely embedded it under a known key at delete time (adapt here).
   */
  /** Extract a domain snapshot if you embedded one inside metadata.data. */
  private discoverSnapshot( n: Notification ): Record<string, any> | undefined {
    const data = ( n.metadata?.data ?? {} ) as Record<string, unknown>;

    // Preferred keys
    const snap = data[ 'snapshot' ];
    if ( snap && typeof snap === 'object' && !Array.isArray( snap ) ) {
      return snap as Record<string, any>;
    }

    const domainSnap = data[ 'domainSnapshot' ];
    if ( domainSnap && typeof domainSnap === 'object' && !Array.isArray( domainSnap ) ) {
      return domainSnap as Record<string, any>;
    }

    // You can add category-specific embeddings here:
    // if (n.category === 'Tenant' && data['tenant'] && typeof data['tenant'] === 'object') {
    //   return data['tenant'] as Record<string, any>;
    // }

    return undefined;
  }



  /**
   * Build a compact, friendly metadata grid for the UI.
   * - Pulls common keys first, then adds a few extra fields (up to 8) for context.
   */
  private extractPrimaryMeta( n: Notification ) {
    const meta = ( n.metadata ?? {} ) as Record<string, any>;
    const candidates = [
      'propertyID', 'propertyId', 'propId',
      'tenantID', 'tenantId',
      'leaseID', 'leaseId',
      'userID', 'userId',
      'username', 'user', 'owner',
      'title', 'status', 'state', 'reason', 'by', 'byUser', 'byRole',
      'filePath', 'path', 'targetId',
    ];

    const rows: Array<{ key: string; value: any; }> = [];
    for ( const key of candidates ) {
      const v = meta[ key ];
      if ( v !== undefined && v !== null && ( typeof v !== 'string' || v.trim() !== '' ) ) {
        rows.push( { key, value: v } );
      }
    }

    // Add a few extras for context (avoid overwhelming the UI)
    const extras = Object.keys( meta )
      .filter( ( k ) => !candidates.includes( k ) )
      .slice( 0, 8 );
    for ( const k of extras ) rows.push( { key: k, value: meta[ k ] } );

    return rows;
  }

  /** Build Authorization header if you keep tokens in localStorage (used by any local HttpClient calls). */
  private authHeaders(): HttpHeaders {
    let token: string | null = null;
    try {
      token = localStorage.getItem( 'sessionToken' );
    } catch {}
    return token ? new HttpHeaders( { Authorization: `Bearer ${ token }` } ) : new HttpHeaders();
  }

  /** Choose a sensible display image from metadata, fall back to dummy. */
  protected getUserImage( n: Notification ): string {
    const data = n?.metadata?.data ?? {};
    const image = typeof data[ 'image' ] === 'string' ? data[ 'image' ].trim() : '';
    return image || this.filterImagesBasedCategory( n.category );
  }

  // Filter dummy images base category
  private filterImagesBasedCategory( category: TitleCategory ) {
    switch ( category ) {
      case 'User':
        return 'Images/System-images/utilitiesImages/person.jpg';
        break;
      case 'Agent':
        return 'Images/System-images/utilitiesImages/agent.jpg';
        break;
      case 'Tenant':
        return 'Images/System-images/utilitiesImages/tenant.jpg';
        break;
      case 'Property':
        return 'Images/System-images/utilitiesImages/property.jpg';
        break;
      case 'Lease':
        return 'Images/System-images/utilitiesImages/document.jpg';
        break;
      default:
        return this.dummyUserImg;
    }
  }

  /** If the main image fails to load, swap to dummy to avoid a broken icon. */
  protected setFallback( ev: Event ): void {
    const img = ev.target as HTMLImageElement | null;
    if ( img && img.src !== this.dummyUserImg ) {
      img.src = this.dummyUserImg;
    }
  }

  /**
 * Extract a readable name from notification metadata.
 * - Works for both User and Tenant categories.
 * - Prefers actual name, falls back to username, then to refId.
 * - Safely navigates the new NotificationMetadata shape.
 */
  protected getUserName( meta: Record<string, any> | undefined ): string {
    // Step 1: Extract `data` block from metadata
    const data = meta?.[ 'data' ] ?? {};

    // Step 2: Try common nested objects (User, Tenant, UpdatedUserData, UpdatedTenantData)
    const updated = data[ 'UpdatedUserData' ] || data[ 'UpdatedTenantData' ];
    const user = data[ 'user' ] || data[ 'tenant' ] || data[ 'owner' ];

    // Step 3: Extract name / username fields (most common ones first)
    const name1 = updated?.[ 'name' ];
    const name2 = user?.[ 'name' ];
    const username1 = updated?.[ 'username' ];
    const username2 = user?.[ 'username' ];

    // Step 4: Some systems store flat-level data (directly under `data`)
    const flatName = data[ 'name' ] || data[ 'tenantName' ];
    const flatUsername = data[ 'username' ] || data[ 'tenantUsername' ];

    // Step 5: Fallback to metadata root-level refId (always exists in NotificationMetadata)
    const refId: string | undefined =
      typeof meta?.[ 'refId' ] === 'string' ? meta[ 'refId' ] : undefined;

    // Step 6: Choose best available name, in priority order
    const chosen =
      ( typeof name1 === 'string' && name1.trim() ) ? name1 :
        ( typeof name2 === 'string' && name2.trim() ) ? name2 :
          ( typeof flatName === 'string' && flatName.trim() ) ? flatName :
            ( typeof username1 === 'string' && username1.trim() ) ? username1 :
              ( typeof username2 === 'string' && username2.trim() ) ? username2 :
                ( typeof flatUsername === 'string' && flatUsername.trim() ) ? flatUsername :
                  refId;

    // Step 7: Always return a string
    return chosen || 'Unknown User';
  }
  /**
   * Read the current user role (for a friendly FE guard on permanent delete).
   * - In many apps, role comes from an AuthService/JWT; adapt as needed.
   * - The server still enforces RBAC; this is just helpful UX.
   */
  private getCurrentUserRole(): UserRole | undefined {
    try {
      const roleRaw = localStorage.getItem( 'role' );
      if ( typeof roleRaw === 'string' && roleRaw.trim() ) {
        const val = roleRaw.trim().toLowerCase();
        // normalize to UserRole
        switch ( val ) {
          case 'admin': return 'admin';
          case 'agent': return 'agent';
          case 'tenant': return 'tenant';
          case 'owner': return 'owner';
          case 'operator': return 'operator';
          case 'manager': return 'manager';
          case 'developer': return 'developer';
          case 'user': return 'user';
        }
      }
    } catch {}
    return undefined;
  }

  // Filter property images if category is property
}
