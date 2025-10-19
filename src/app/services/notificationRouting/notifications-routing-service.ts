// Path: src/app/services/notificationsRouting/notification-routing-service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Purpose
//   Convert either a Notification OR a direct backend action response into an
//   Angular UrlTree and (optionally) navigate there.
//
// Why this file changed
//   - Backend "metadata" is now { refId: string; data?: Record<string, any> }.
//   - Some flows (restore/permanent_delete) respond directly from controllers
//     with: { success, message, category, refId, restored? }.
//   - Users & Tenants should be navigated by tokenized username.
//
// Usage
//   const url = await notificationsRoutingService.routeForAny(notificationOrResponse);
//   router.navigateByUrl(url);
//
// Notes
//   - "Notification" is your app DTO (from your notification service).
//   - "BackendActionResult" below is a local type for controller responses.
//   - We carefully conditionally read fields to remain strict-mode friendly.
// ─────────────────────────────────────────────────────────────────────────────

import {Injectable} from '@angular/core';
import {Router, UrlTree} from '@angular/router';

import {
  Notification,        // your app-level Notification DTO
  TitleCategory,       // 'User' | 'Tenant' | 'Property' | 'Lease' | ...
  Title,               // exact title literals you use
} from '../notifications/notification-service';

import {APIsService} from '../APIs/apis.service';

// ─────────────────────────────────────────────────────────────────────────────
// Backend action response (from /restore or /permanent-delete endpoints).
// Example:
//   { success:true, message:"User restored", category:"User", refId:"PushpaLatha", restored:{_id:"..."} }
// ─────────────────────────────────────────────────────────────────────────────
export type BackendActionResult = {
  success: boolean;
  message: string;
  category: TitleCategory | string;
  refId: string;
  restored?: {_id: string};   // present on restore
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper types
// ─────────────────────────────────────────────────────────────────────────────
type IdLike = string | number | undefined;

type TitleHandler = {
  category: TitleCategory;
  // All id paths are resolved inside n.metadata.data (case-insensitive)
  idPaths?: {
    property?: string[][];
    tenant?: string[][];
    lease?: string[][];
    username?: string[][];
  };
  pre?: (
    ids: {property?: IdLike; tenant?: IdLike; lease?: IdLike; username?: string}
  ) => Promise<Partial<{token: string}>> | Partial<{token: string}>;
  toUrl: (ctx: {
    n: Notification;
    ids: {property?: IdLike; tenant?: IdLike; lease?: IdLike; username?: string};
    pre?: Partial<{token: string}>;
    router: Router;
  }) => UrlTree;
};

@Injectable({providedIn: 'root'})
export class NotificationsRoutingService {
  constructor (
    private readonly router: Router,
    private readonly apis: APIsService,  // used to mint profile tokens
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // WHERE WE LOOK FOR IDS (inside n.metadata.data). Keys are case-insensitive.
  // ───────────────────────────────────────────────────────────────────────────

  private readonly PROP_ID_PATHS: string[][] = [
    ['propertyID'], ['propertyId'], ['propId'], ['id'],
    ['property', 'id'], ['property', 'propertyID'], ['property', 'propertyId'],
    ['NewPropertyData', 'propertyID'], ['NewPropertyData', 'propertyId'],
    ['UpdatedPropertyData', 'propertyID'], ['UpdatedPropertyData', 'propertyId'],
    ['UpdatePropertyData', 'propertyID'], ['UpdatePropertyData', 'propertyId'],
    ['DeletedPropertyData', 'propertyID'], ['DeletedPropertyData', 'propertyId'],
    ['DeletePropertyData', 'propertyID'], ['DeletePropertyData', 'propertyId'],
  ];

  private readonly TENANT_ID_PATHS: string[][] = [
    ['tenantID'], ['tenantId'], ['id'],
    ['tenant', 'tenantID'], ['tenant', 'tenantId'], ['tenant', 'id'],
    ['NewTenantData', 'tenantID'], ['NewTenantData', 'tenantId'],
    ['UpdatedTenantData', 'tenantID'], ['UpdatedTenantData', 'tenantId'],
    ['UpdateTenantData', 'tenantID'], ['UpdateTenantData', 'tenantId'],
    ['DeletedTenantData', 'tenantID'], ['DeletedTenantData', 'tenantId'],
    ['DeleteTenantData', 'tenantID'], ['DeleteTenantData', 'tenantId'],
  ];

  private readonly LEASE_ID_PATHS: string[][] = [
    ['leaseID'], ['leaseId'], ['id'],
    ['lease', 'leaseID'], ['lease', 'leaseId'], ['lease', 'id'],
    ['NewLeaseData', 'leaseID'], ['NewLeaseData', 'leaseId'],
    ['UpdatedLeaseData', 'leaseID'], ['UpdatedLeaseData', 'leaseId'],
    ['UpdateLeaseData', 'leaseID'], ['UpdateLeaseData', 'leaseId'],
    ['DeletedLeaseData', 'leaseID'], ['DeletedLeaseData', 'leaseId'],
    ['DeleteLeaseData', 'leaseID'], ['DeleteLeaseData', 'leaseId'],
  ];

  // Username detection (users & tenants). If not found in data, fallback to metadata.refId.
  private readonly USERNAME_PATHS: string[][] = [
    ['username'], ['owner'],
    ['user', 'username'],
    ['tenant', 'username'],
    ['UpdatedUserData', 'username'],
    ['UpdateUserData', 'username'],
    ['NewUserData', 'username'],
    ['DeletedUserData', 'username'],
    ['DeleteUserData', 'username'],
    ['UpdatedTenantData', 'username'],
    ['UpdateTenantData', 'username'],
    ['NewTenantData', 'username'],
    ['DeletedTenantData', 'username'],
    ['DeleteTenantData', 'username'],
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // Exact-title handlers (fast path for common titles)
  // NOTE: Delete handlers now include { selected: n._id } in query params.
  // ───────────────────────────────────────────────────────────────────────────
  private readonly TITLE_INDEX: Record<string, TitleHandler> = {
    // USER
    'New User': {
      category: 'User',
      idPaths: {username: this.USERNAME_PATHS},
      toUrl: ({ids, pre, router}) => {
        if(ids.username && pre?.token) {
          return router.createUrlTree(['/dashboard/view-user-profile', pre.token]);
        }
        return router.createUrlTree(['/dashboard/users']);
      },
    },
    'Update User': {
      category: 'User',
      idPaths: {username: this.USERNAME_PATHS},
      toUrl: ({ids, pre, router}) => {
        if(ids.username && pre?.token) {
          return router.createUrlTree(['/dashboard/view-user-profile', pre.token]);
        }
        return router.createUrlTree(['/dashboard/users']);
      },
    },
    'Delete User': {
      category: 'User',
      toUrl: ({n, router}) =>
        router.createUrlTree(
          ['/dashboard/deleted-items'],
          {queryParams: {selected: n._id, category: 'User', type: 'delete'}}
        ),
    },

    // PROPERTY
    'New Property': {
      category: 'Property',
      idPaths: {property: this.PROP_ID_PATHS},
      toUrl: ({ids, router}) =>
        ids.property
          ? router.createUrlTree(['/dashboard/property-view', String(ids.property)])
          : router.createUrlTree(['/dashboard/property-listing']),
    },
    'Update Property': {
      category: 'Property',
      idPaths: {property: this.PROP_ID_PATHS},
      toUrl: ({ids, router}) =>
        ids.property
          ? router.createUrlTree(['/dashboard/property-view', String(ids.property)])
          : router.createUrlTree(['/dashboard/property-listing']),
    },
    'Delete Property': {
      category: 'Property',
      toUrl: ({n, router}) =>
        router.createUrlTree(
          ['/dashboard/deleted-items'],
          {queryParams: {selected: n._id, category: 'Property', type: 'delete'}}
        ),
    },

    // TENANT
    'New Tenant': {
      category: 'Tenant',
      idPaths: {tenant: this.TENANT_ID_PATHS, username: this.USERNAME_PATHS},
      toUrl: ({ids, pre, router}) => {
        if(ids.username && pre?.token) {
          return router.createUrlTree(['/dashboard/tenant/tenant-view', pre.token]);
        }
        return ids.tenant
          ? router.createUrlTree(['/dashboard/tenant/tenant-view', String(ids.tenant)])
          : router.createUrlTree(['/dashboard/tenant/tenant-home']);
      },
    },
    'Update Tenant': {
      category: 'Tenant',
      idPaths: {tenant: this.TENANT_ID_PATHS, username: this.USERNAME_PATHS},
      toUrl: ({ids, pre, router}) => {
        if(ids.username && pre?.token) {
          return router.createUrlTree(['/dashboard/tenant/tenant-view', pre.token]);
        }
        return ids.tenant
          ? router.createUrlTree(['/dashboard/tenant/tenant-view', String(ids.tenant)])
          : router.createUrlTree(['/dashboard/tenant/tenant-home']);
      },
    },
    'Delete Tenant': {
      category: 'Tenant',
      toUrl: ({n, router}) =>
        router.createUrlTree(
          ['/dashboard/deleted-items'],
          {queryParams: {selected: n._id, category: 'Tenant', type: 'delete'}}
        ),
    },

    // LEASE
    'New Lease': {
      category: 'Lease',
      idPaths: {lease: this.LEASE_ID_PATHS},
      toUrl: ({ids, router}) =>
        ids.lease
          ? router.createUrlTree(['/dashboard/tenant/view-lease', String(ids.lease)])
          : router.createUrlTree(['/dashboard/tenant/payments-list']),
    },
    'Update Lease': {
      category: 'Lease',
      idPaths: {lease: this.LEASE_ID_PATHS},
      toUrl: ({ids, router}) =>
        ids.lease
          ? router.createUrlTree(['/dashboard/tenant/view-lease', String(ids.lease)])
          : router.createUrlTree(['/dashboard/tenant/payments-list']),
    },
    'Delete Lease': {
      category: 'Lease',
      toUrl: ({n, router}) =>
        router.createUrlTree(
          ['/dashboard/deleted-items'],
          {queryParams: {selected: n._id, category: 'Lease', type: 'delete'}}
        ),
    },

    // SYSTEM / BROADCAST
    'System Update': {
      category: 'System',
      toUrl: ({router}) => router.createUrlTree(['/dashboard/all-notifications']),
    },
    'Broadcast Announcement': {
      category: 'System',
      toUrl: ({router}) => router.createUrlTree(['/dashboard/all-notifications']),
    },
  };

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Route for either a Notification or a backend action response.
   * We detect which one it is and route accordingly.
   */
  public async routeForAny(input: Notification | BackendActionResult): Promise<UrlTree> {
    const isBackend = this.isBackendResponse(input);
    return isBackend
      ? this.routeForBackend(input as BackendActionResult)
      : this.routeForNotification(input as Notification);
  }

  /** Convenience: compute + navigate. */
  public async navigateToAny(input: Notification | BackendActionResult): Promise<boolean> {
    try {
      const url = await this.routeForAny(input);
      return this.router.navigateByUrl(url);
    } catch(err) {
      console.error('[notif-route] navigateToAny failed:', err);
      return this.router.navigateByUrl(this.router.createUrlTree(['/dashboard/all-notifications']));
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Notification routing
  // ───────────────────────────────────────────────────────────────────────────

  public async routeFor(n: Notification): Promise<UrlTree> {
    return this.routeForNotification(n);
  }

  private async routeForNotification(n: Notification): Promise<UrlTree> {
    // 1) Prefer new interface fields
    const refId = typeof n?.metadata?.refId === 'string' ? n.metadata.refId.trim() : '';
    const data: Record<string, any> =
      n?.metadata?.data && typeof n.metadata.data === 'object' ? n.metadata.data : {};

    // 2) Try exact-title fast path
    const exact = await this.routeByExactTitle(n, refId, data);
    if(exact) return exact;

    // 3) Destructive? send to Deleted Items hub with a selected id
    if(this.isDeleteOrDestructive(n)) {
      return this.router.createUrlTree(
        ['/dashboard/deleted-items'],
        {
          queryParams: {
            selected: n._id,
            category: n.category || undefined,
            type: n.type || undefined,
          }
        }
      );
    }

    // 4) Generic by category
    switch(n.category) {
      case 'Property': {
        const propId: IdLike = refId || this.firstPresent(data, this.PROP_ID_PATHS);
        return propId
          ? this.router.createUrlTree(['/dashboard/property-view', String(propId)])
          : this.router.createUrlTree(['/dashboard/property-listing'], {queryParams: {selected: n._id}});
      }

      case 'Tenant': {
        const tenantUsername = this.resolveUsername(data, refId);
        if(tenantUsername) {
          const token = await this.safeUserToken(tenantUsername);
          if(token) return this.router.createUrlTree(['/dashboard/tenant/tenant-view', token]);
        }
        const tenantId: IdLike = this.firstPresent(data, this.TENANT_ID_PATHS);
        return tenantId
          ? this.router.createUrlTree(['/dashboard/tenant/tenant-view', String(tenantId)])
          : this.router.createUrlTree(['/dashboard/tenant/tenant-home'], {queryParams: {selected: n._id}});
      }

      case 'User': {
        const username = this.resolveUsername(data, refId);
        if(username) {
          const token = await this.safeUserToken(username);
          if(token) return this.router.createUrlTree(['/dashboard/view-user-profile', token]);
        }
        return this.router.createUrlTree(['/dashboard/users'], {queryParams: {selected: n._id}});
      }

      case 'Lease': {
        const leaseId: IdLike = refId || this.firstPresent(data, this.LEASE_ID_PATHS);
        return leaseId
          ? this.router.createUrlTree(['/dashboard/tenant/view-lease', String(leaseId)])
          : this.router.createUrlTree(['/dashboard/tenant/payments-list'], {queryParams: {selected: n._id}});
      }

      // Others → All Notifications inbox
      case 'System':
      case 'Payment':
      case 'Registration':
      case 'Team':
      case 'Developer':
      case 'Agent':
      case 'Maintenance':
      case 'Complaint':
        return this.router.createUrlTree(['/dashboard/all-notifications'], {queryParams: {selected: n._id}});
    }

    // 5) Fallback
    return this.router.createUrlTree(['/dashboard/all-notifications'], {queryParams: {selected: n._id}});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Backend action response routing (restore / permanent_delete)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Route for the direct controller response:
   *   { success, message, category, refId, restored? }
   * Logic:
   *   - User/Tenant: tokenized route using refId as username
   *   - Property/Lease: use restored._id (if present) or refId (if that's the id)
   *   - Others: inbox/overview
   */
  private async routeForBackend(res: BackendActionResult): Promise<UrlTree> {
    const category = String(res.category || '').trim() as TitleCategory;

    switch(category) {
      case 'User': {
        const username = res.refId?.trim();
        if(username) {
          const token = await this.safeUserToken(username);
          if(token) return this.router.createUrlTree(['/dashboard/view-user-profile', token]);
        }
        return this.router.createUrlTree(['/dashboard/users']);
      }

      case 'Tenant': {
        const username = res.refId?.trim();
        if(username) {
          const token = await this.safeUserToken(username);
          if(token) return this.router.createUrlTree(['/dashboard/tenant/tenant-view', token]);
        }
        if(username) return this.router.createUrlTree(['/dashboard/tenant/tenant-view', username]);
        return this.router.createUrlTree(['/dashboard/tenant/tenant-home']);
      }

      case 'Property': {
        const id = res.restored?._id || res.refId;
        return id
          ? this.router.createUrlTree(['/dashboard/property-view', String(id)])
          : this.router.createUrlTree(['/dashboard/property-listing']);
      }

      case 'Lease': {
        const id = res.restored?._id || res.refId;
        return id
          ? this.router.createUrlTree(['/dashboard/tenant/view-lease', String(id)])
          : this.router.createUrlTree(['/dashboard/tenant/payments-list']);
      }

      // Other categories — send to an overview page or inbox
      case 'System':
      case 'Payment':
      case 'Registration':
      case 'Team':
      case 'Developer':
      case 'Agent':
      case 'Maintenance':
      case 'Complaint':
        return this.router.createUrlTree(['/dashboard/all-notifications']);
    }

    // Fallback
    return this.router.createUrlTree(['/dashboard/all-notifications']);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Recognize backend action responses more strictly:
   * - must have 'success' and 'category'
   * - must NOT have 'title' (real Notification has title)
   * - must NOT have '_id' (real Notification has _id)
   */
  private isBackendResponse(x: any): x is BackendActionResult {
    return !!(
      x &&
      typeof x === 'object' &&
      'success' in x &&
      'category' in x &&
      !('title' in x) &&
      !('_id' in x)
    );
  }

  /** Exact-title routing with tokenization where needed. */
  private async routeByExactTitle(
    n: Notification,
    refId: string,
    data: Record<string, any>,
  ): Promise<UrlTree | undefined> {
    const handler = this.TITLE_INDEX[n.title as Title];
    if(!handler) return undefined;

    const ids = {
      property: handler.idPaths?.property ? this.firstPresent(data, handler.idPaths.property) : undefined,
      tenant: handler.idPaths?.tenant ? this.firstPresent(data, handler.idPaths.tenant) : undefined,
      lease: handler.idPaths?.lease ? this.firstPresent(data, handler.idPaths.lease) : undefined,
      username: handler.idPaths?.username
        ? (this.firstPresentStringFromPaths(data, handler.idPaths.username) || (refId || undefined))
        : (refId || undefined),
    } as {property?: IdLike; tenant?: IdLike; lease?: IdLike; username?: string};

    let pre: Partial<{token: string}> | undefined = undefined;
    if(handler.pre) pre = await Promise.resolve(handler.pre(ids));

    if(!pre?.token && ids.username) {
      const token = await this.safeUserToken(String(ids.username));
      if(token) pre = {...(pre || {}), token};
    }

    return handler.toUrl({n, ids, pre, router: this.router});
  }

  /**
   * Classify deletes/terminations/archives as “destructive” so we send users to the
   * Deleted Items hub. Note that "restore" is **NOT** destructive.
   */
  private isDeleteOrDestructive(n: Notification): boolean {
    const t = (n.type || '').toLowerCase();
    const title = (n.title || '').toLowerCase();
    const destructive = new Set([
      'delete', 'permanent_delete', 'terminate', 'expire', 'unpublish', 'archive', 'remove', 'deactivate'
    ]);
    return (
      destructive.has(t) ||
      title.includes('delete') ||
      title.includes('deleted') ||
      title.includes('terminated') ||
      title.includes('expired') ||
      title.includes('archiv') ||
      title.includes('removed') ||
      title.includes('deactivated')
    );
  }

  /** Case-insensitive nested read. */
  private getByPathCI(obj: any, path: string[]): any {
    if(!obj || !path?.length) return undefined;
    let cur: any = obj;
    for(const seg of path) {
      if(cur == null) return undefined;
      const key = Object.keys(cur).find(k => k.toLowerCase() === seg.toLowerCase());
      if(!key) return undefined;
      cur = (cur as any)[key];
    }
    return cur;
  }

  /** First present (non-empty) value for any nested path. */
  private firstPresent(obj: Record<string, any>, paths: string[][]): any {
    for(const p of paths) {
      const v = this.getByPathCI(obj, p);
      if(v !== undefined && v !== null && (typeof v !== 'string' || v.trim() !== '')) return v;
      if(typeof v === 'string' && v.trim() !== '') return v;
    }
    return undefined;
  }

  /** First present non-empty STRING for any nested path. */
  private firstPresentStringFromPaths(obj: Record<string, any>, paths: string[][]): string | undefined {
    for(const p of paths) {
      const v = this.getByPathCI(obj, p);
      if(typeof v === 'string') {
        const s = v.trim();
        if(s) return s;
      }
    }
    return undefined;
  }

  /** Resolve username (from metadata.data paths first, then fallback to refId). */
  private resolveUsername(data: Record<string, any>, refId?: string): string | undefined {
    const fromData = this.firstPresentStringFromPaths(data, this.USERNAME_PATHS);
    if(fromData && fromData.trim()) return fromData.trim();
    if(refId && refId.trim()) return refId.trim();
    return undefined;
  }

  /** Generate a secure profile token for username; return null on failure. */
  private async safeUserToken(username: string): Promise<string | null> {
    try {
      const resp = await this.apis.generateToken(username);
      const token = (resp as any)?.token ?? resp;
      return typeof token === 'string' && token.trim() ? token : null;
    } catch(err) {
      console.warn('[notif-route] token generation failed for', username, err);
      return null;
    }
  }
}
