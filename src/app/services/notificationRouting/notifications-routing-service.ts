// Path: src/app/services/notificationsRouting/notification-routing-service.ts
// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE
//   Convert a Notification (or a direct backend action response) into a
//   Router UrlTree, with optional navigation. This centralizes all routing
//   rules for notifications so deep links remain consistent and type-safe.
//
// WHY THIS EXISTS
//   • Our backend sends notifications with metadata: { refId, data? }.
//   • Some actions (restore/permanent_delete) reply directly with:
//       { success, message, category, refId, restored? }.
//   • Certain routes require a token (e.g., username → tokenized profile).
//
// DESIGN NOTES
//   • Exact-title routing: TITLE_INDEX maps titles → route logic.
//   • Generic fallback by category ensures sensible defaults.
//   • “Complaint” uses code first (refId / data) then falls back to id.
//   • SSR/Electron safe: no direct window/document usage.
//
// USAGE
//   const url = await notificationsRoutingService.routeForAny(notificationOrResponse);
//   this.router.navigateByUrl(url);
//
// CODING STANDARD
//   • Strong typing, no ambient anys.
//   • Guard token usage and avoid unnecessary network calls.
//   • Case-insensitive path reads for metadata.data.
// ─────────────────────────────────────────────────────────────────────────────

import {Injectable} from '@angular/core';
import {Router, UrlTree} from '@angular/router';

// Import your project DTO/types (kept external to avoid duplication)
import {
  Notification,   // Your app-level Notification DTO
  TitleCategory,  // 'User' | 'Tenant' | 'Property' | 'Lease' | 'Complaint' | ...
  Title,          // Exact title literals (e.g., 'New Complaint', 'Update User', ...)
} from '../notifications/notification-service';

import {APIsService} from '../APIs/apis.service';

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight helper types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IdLike — Values we treat as identifiers for building URLs.
 * String or number is acceptable; undefined means “not found”.
 */
type IdLike = string | number | undefined;

/**
 * BackendActionResult — Shape of direct controller responses (non-Notification).
 * Example:
 *   { success:true, message:"User restored", category:"User", refId:"PushpaLatha", restored:{_id:"..."} }
 *
 * Notes:
 *   • category can be a string fallback but we cast to TitleCategory when switching.
 *   • refId is commonly a username, property ID, complaint code, etc.
 *   • restored? may carry the newly restored entity’s _id (when applicable).
 */
export type BackendActionResult = {
  success: boolean;
  message: string;
  category: TitleCategory | string;
  refId: string;
  restored?: {_id: string};
};

/**
 * TitleHandler — Routing rule for a single exact title (e.g., 'New Complaint').
 *  - category: Which category this title belongs to (for sanity/context).
 *  - idPaths:  Paths to look up ids inside n.metadata.data (case-insensitive).
 *  - pre:      Optional pre-resolution step (e.g., minting a token).
 *  - toUrl:    The pure function to build a UrlTree from computed ids and pre.
 *
 * NOTE:
 *  We keep username population opt-in: only if a handler declares username
 *  paths will we attempt to read username and mint a token.
 */
type TitleHandler = {
  category: TitleCategory;
  idPaths?: {
    property?: string[][];
    tenant?: string[][];
    lease?: string[][];
    username?: string[][];
    complaintCode?: string[][]; // complaint code patterns
    complaintId?: string[][];   // complaint id patterns
  };
  pre?: (
    ids: {
      property?: IdLike;
      tenant?: IdLike;
      lease?: IdLike;
      username?: string;
      complaintCode?: string;
      complaintId?: IdLike;
    }
  ) => Promise<Partial<{token: string}>> | Partial<{token: string}>;
  toUrl: (ctx: {
    n: Notification;
    ids: {
      property?: IdLike;
      tenant?: IdLike;
      lease?: IdLike;
      username?: string;
      complaintCode?: string;
      complaintId?: IdLike;
    };
    pre?: Partial<{token: string}>;
    router: Router;
  }) => UrlTree;
};

@Injectable({providedIn: 'root'})
export class NotificationsRoutingService {
  /**
   * Router — Angular Router used to build UrlTree and navigate.
   * APIsService — Used to mint tokens (e.g., username → token).
   */
  constructor (
    private readonly router: Router,
    private readonly apis: APIsService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // WHERE WE LOOK FOR IDS (inside n.metadata.data). Keys are case-insensitive.
  // Each entry is a list of alternative paths; the first non-empty wins.
  // ───────────────────────────────────────────────────────────────────────────

  /** Property id paths */
  private readonly PROP_ID_PATHS: string[][] = [
    ['propertyID'], ['propertyId'], ['propId'], ['id'],
    ['property', 'id'], ['property', 'propertyID'], ['property', 'propertyId'],
    ['NewPropertyData', 'propertyID'], ['NewPropertyData', 'propertyId'],
    ['UpdatedPropertyData', 'propertyID'], ['UpdatedPropertyData', 'propertyId'],
    ['UpdatePropertyData', 'propertyID'], ['UpdatePropertyData', 'propertyId'],
    ['DeletedPropertyData', 'propertyID'], ['DeletedPropertyData', 'propertyId'],
    ['DeletePropertyData', 'propertyID'], ['DeletePropertyData', 'propertyId'],
  ];

  /** Tenant id paths */
  private readonly TENANT_ID_PATHS: string[][] = [
    ['tenantID'], ['tenantId'], ['id'],
    ['tenant', 'tenantID'], ['tenant', 'tenantId'], ['tenant', 'id'],
    ['NewTenantData', 'tenantID'], ['NewTenantData', 'tenantId'],
    ['UpdatedTenantData', 'tenantID'], ['UpdatedTenantData', 'tenantId'],
    ['UpdateTenantData', 'tenantID'], ['UpdateTenantData', 'tenantId'],
    ['DeletedTenantData', 'tenantID'], ['DeletedTenantData', 'tenantId'],
    ['DeleteTenantData', 'tenantID'], ['DeleteTenantData', 'tenantId'],
  ];

  /** Lease id paths */
  private readonly LEASE_ID_PATHS: string[][] = [
    ['leaseID'], ['leaseId'], ['id'],
    ['lease', 'leaseID'], ['lease', 'leaseId'], ['lease', 'id'],
    ['NewLeaseData', 'leaseID'], ['NewLeaseData', 'leaseId'],
    ['UpdatedLeaseData', 'leaseID'], ['UpdatedLeaseData', 'leaseId'],
    ['UpdateLeaseData', 'leaseID'], ['UpdateLeaseData', 'leaseId'],
    ['DeletedLeaseData', 'leaseID'], ['DeletedLeaseData', 'leaseId'],
    ['DeleteLeaseData', 'leaseID'], ['DeleteLeaseData', 'leaseId'],
  ];

  /**
   * Username detection (users & tenants).
   * If not found from data paths, we may fallback to refId — but ONLY when
   * a handler actually declares `username` idPaths (opt-in).
   */
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

  /** Complaint code paths (prefer code over id) */
  private readonly COMPLAINT_CODE_PATHS: string[][] = [
    ['code'], ['complaintCode'],
    ['complaint', 'code'], ['complaint', 'complaintCode'],
    ['NewComplaintData', 'code'], ['NewComplaintData', 'complaintCode'],
    ['UpdatedComplaintData', 'code'], ['UpdatedComplaintData', 'complaintCode'],
    ['UpdateComplaintData', 'code'], ['UpdateComplaintData', 'complaintCode'],
    ['DeletedComplaintData', 'code'], ['DeletedComplaintData', 'complaintCode'],
    ['DeleteComplaintData', 'code'], ['DeleteComplaintData', 'complaintCode'],
    ['snapshot', 'code'], ['snapshot', 'complaintCode'],
  ];

  /** Complaint id paths (fallback if no code) */
  private readonly COMPLAINT_ID_PATHS: string[][] = [
    ['complaintID'], ['complaintId'], ['_id'], ['id'],
    ['complaint', 'complaintID'], ['complaint', 'complaintId'], ['complaint', '_id'], ['complaint', 'id'],
    ['NewComplaintData', 'complaintID'], ['NewComplaintData', 'complaintId'], ['NewComplaintData', '_id'], ['NewComplaintData', 'id'],
    ['UpdatedComplaintData', 'complaintID'], ['UpdatedComplaintData', 'complaintId'], ['UpdatedComplaintData', '_id'], ['UpdatedComplaintData', 'id'],
    ['UpdateComplaintData', 'complaintID'], ['UpdateComplaintData', 'complaintId'], ['UpdateComplaintData', '_id'], ['UpdateComplaintData', 'id'],
    ['DeletedComplaintData', 'complaintID'], ['DeletedComplaintData', 'complaintId'], ['DeletedComplaintData', '_id'], ['DeletedComplaintData', 'id'],
    ['DeleteComplaintData', 'complaintID'], ['DeleteComplaintData', 'complaintId'], ['DeleteComplaintData', '_id'], ['DeleteComplaintData', 'id'],
    ['snapshot', '_id'], ['snapshot', 'id'],
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // Exact-title handlers (“fast path” for common titles)
  // Keep handlers tiny: resolve IDs → call router.createUrlTree(...)
  // ───────────────────────────────────────────────────────────────────────────

  private readonly TITLE_INDEX: Record<string, TitleHandler> = {
    // USER
    'New User': {
      category: 'User',
      idPaths: {username: this.USERNAME_PATHS},
      toUrl: ({ids, pre, router}) => {
        if(ids.username && pre?.token) {
          return router.createUrlTree(['/dashboard/users/user-profile', pre.token]);
        }
        return router.createUrlTree(['/dashboard/users']);
      },
    },
    'Update User': {
      category: 'User',
      idPaths: {username: this.USERNAME_PATHS},
      toUrl: ({ids, pre, router}) => {
        if(ids.username && pre?.token) {
          return router.createUrlTree(['/dashboard/users/user-profile', pre.token]);
        }
        return router.createUrlTree(['/dashboard/users']);
      },
    },
    'Delete User': {
      category: 'User',
      toUrl: ({n, router}) =>
        router.createUrlTree(['/dashboard/notifications/deleted-items'], {
          queryParams: {selected: n._id, category: 'User', type: 'delete'},
        }),
    },

    // PROPERTY
    'New Property': {
      category: 'Property',
      idPaths: {property: this.PROP_ID_PATHS},
      toUrl: ({ids, router}) =>
        ids.property
          ? router.createUrlTree(['/dashboard/properties/property-view', String(ids.property)])
          : router.createUrlTree(['/dashboard/property-listing']),
    },
    'Update Property': {
      category: 'Property',
      idPaths: {property: this.PROP_ID_PATHS},
      toUrl: ({ids, router}) =>
        ids.property
          ? router.createUrlTree(['/dashboard/properties/property-view', String(ids.property)])
          : router.createUrlTree(['/dashboard/property-listing']),
    },
    'Delete Property': {
      category: 'Property',
      toUrl: ({n, router}) =>
        router.createUrlTree(['/dashboard/notifications/deleted-items'], {
          queryParams: {selected: n._id, category: 'Property', type: 'delete'},
        }),
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
        router.createUrlTree(['/dashboard/notifications/deleted-items'], {
          queryParams: {selected: n._id, category: 'Tenant', type: 'delete'},
        }),
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
        router.createUrlTree(['/dashboard/notifications/deleted-items'], {
          queryParams: {selected: n._id, category: 'Lease', type: 'delete'},
        }),
    },

    // COMPLAINTS — prefer complaintCode, fallback complaintId
    'New Complaint': {
      category: 'Complaint',
      idPaths: {
        complaintCode: this.COMPLAINT_CODE_PATHS,
        complaintId: this.COMPLAINT_ID_PATHS,
      },
      toUrl: ({ids, router}) => {
        const code = (ids.complaintCode && String(ids.complaintCode).trim()) || '';
        const id = (ids.complaintId !== undefined && ids.complaintId !== null) ? String(ids.complaintId) : '';
        const val = code || id;
        return val
          ? router.createUrlTree(['/dashboard/tenant/complaints/view-complaint', val])
          : router.createUrlTree(['/dashboard/tenant/complaints']);
      },
    },
    'Update Complaint': {
      category: 'Complaint',
      idPaths: {
        complaintCode: this.COMPLAINT_CODE_PATHS,
        complaintId: this.COMPLAINT_ID_PATHS,
      },
      toUrl: ({ids, router}) => {
        const code = (ids.complaintCode && String(ids.complaintCode).trim()) || '';
        const id = (ids.complaintId !== undefined && ids.complaintId !== null) ? String(ids.complaintId) : '';
        const val = code || id;
        return val
          ? router.createUrlTree(['/dashboard/tenant/complaints/edit-complaint', val])
          : router.createUrlTree(['/dashboard/notifications/all-notifications']);
      },
    },
    'Delete Complaint': {
      category: 'Complaint',
      toUrl: ({n, router}) =>
        router.createUrlTree(['/dashboard/notifications/deleted-items'], {
          queryParams: {selected: n._id, category: 'Complaint', type: 'delete'},
        }),
    },

    'New Comment': {
      category: 'Complaint',
      idPaths: {
        complaintCode: this.COMPLAINT_CODE_PATHS,
        complaintId: this.COMPLAINT_ID_PATHS,
      },
      toUrl: ({ids, router}) => {
        const code = (ids.complaintCode && String(ids.complaintCode).trim()) || '';
        const id = (ids.complaintId !== undefined && ids.complaintId !== null) ? String(ids.complaintId) : '';
        const val = code || id;
        return val
          ? router.createUrlTree(['/dashboard/tenant/complaints/view-complaint', val])
          : router.createUrlTree(['/dashboard/tenant/complaints']);
      },
    },


    // SYSTEM / BROADCAST (general inbox)
    'System Update': {
      category: 'System',
      toUrl: ({router}) => router.createUrlTree(['/dashboard/notifications/all-notifications']),
    },
    'Broadcast Announcement': {
      category: 'System',
      toUrl: ({router}) => router.createUrlTree(['/dashboard/notifications/all-notifications']),
    },
  };

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC API — MAIN ENTRY POINTS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * routeForAny — build a UrlTree for either a Notification or a BackendActionResult.
   * This decides which path to use and delegates to the proper handler.
   */
  public async routeForAny(input: Notification | BackendActionResult): Promise<UrlTree> {
    const isBackend = this.isBackendResponse(input);
    return isBackend
      ? this.routeForBackend(input as BackendActionResult)
      : this.routeForNotification(input as Notification);
  }

  /**
   * navigateToAny — convenience: compute + navigate.
   * Always returns a boolean indicating navigation success.
   */
  public async navigateToAny(input: Notification | BackendActionResult): Promise<boolean> {
    try {
      const url = await this.routeForAny(input);
      return this.router.navigateByUrl(url);
    } catch(err) {
      console.error('[notif-route] navigateToAny failed:', err);
      return this.router.navigateByUrl(this.router.createUrlTree(['/dashboard/notifications/all-notifications']));
    }
  }

  /**
   * routeFor — explicit Notification routing (alias).
   */
  public async routeFor(n: Notification): Promise<UrlTree> {
    return this.routeForNotification(n);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // NOTIFICATION ROUTING
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * routeForNotification — full routing decision for a Notification.
   * Steps:
   *  1) Extract refId and data.
   *  2) Try exact-title handlers (TITLE_INDEX).
   *  3) If “destructive” → Deleted Items hub.
   *  4) Generic by category fallback.
   *  5) Final catch-all: inbox.
   */
  private async routeForNotification(n: Notification): Promise<UrlTree> {
    // 1) Normalize fields (defensive against partial payloads)
    const refId = typeof n?.metadata?.refId === 'string' ? n.metadata.refId.trim() : '';
    const data: Record<string, any> =
      n?.metadata?.data && typeof n.metadata.data === 'object' ? n.metadata.data : {};

    // 2) Exact-title fast path
    const exact = await this.routeByExactTitle(n, refId, data);
    if(exact) return exact;

    // 3) Destructive → Deleted Items hub
    if(this.isDeleteOrDestructive(n)) {
      return this.router.createUrlTree(['/dashboard/notifications/deleted-items'], {
        queryParams: {
          selected: n._id,
          category: n.category || undefined,
          type: n.type || undefined,
        },
      });
    }

    // 4) Generic fallback by category
    switch(n.category) {
      case 'Property': {
        const propId: IdLike = refId || this.firstPresent(data, this.PROP_ID_PATHS);
        return propId
          ? this.router.createUrlTree(['/dashboard/properties/property-view', String(propId)])
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
          if(token) return this.router.createUrlTree(['/dashboard/users/user-profile', token]);
        }
        return this.router.createUrlTree(['/dashboard/users'], {queryParams: {selected: n._id}});
      }

      case 'Lease': {
        const leaseId: IdLike = refId || this.firstPresent(data, this.LEASE_ID_PATHS);
        return leaseId
          ? this.router.createUrlTree(['/dashboard/tenant/view-lease', String(leaseId)])
          : this.router.createUrlTree(['/dashboard/tenant/payments-list'], {queryParams: {selected: n._id}});
      }

      case 'Complaint': {
        // Prefer code, fallback to id, then (last) refId
        const code = this.firstPresentStringFromPaths(data, this.COMPLAINT_CODE_PATHS) || (refId || '');
        const id = this.firstPresent(data, this.COMPLAINT_ID_PATHS);
        const val = (code && code.trim()) ? code.trim() : (id !== undefined ? String(id) : '');
        return val
          ? this.router.createUrlTree(['/dashboard/tenant/complaints/view-complaint', val])
          : this.router.createUrlTree(['/dashboard/tenant/complaints'], {queryParams: {selected: n._id}});
      }

      // Other categories → notifications inbox
      case 'System':
      case 'Payment':
      case 'Registration':
      case 'Team':
      case 'Developer':
      case 'Agent':
      case 'Maintenance':
        return this.router.createUrlTree(['/dashboard/notifications/all-notifications'], {queryParams: {selected: n._id}});
    }

    // 5) Fallback inbox
    return this.router.createUrlTree(['/dashboard/notifications/all-notifications'], {queryParams: {selected: n._id}});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BACKEND ACTION RESPONSE ROUTING
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * routeForBackend — routing for direct controller responses.
   * Rules:
   *  • User/Tenant: tokenized route by refId (username).
   *  • Property/Lease: use restored._id if present, else refId.
   *  • Complaint: prefer refId (code), else restored._id.
   *  • Others: inbox/overview.
   */
  private async routeForBackend(res: BackendActionResult): Promise<UrlTree> {
    const category = String(res.category || '').trim() as TitleCategory;

    switch(category) {
      case 'User': {
        const username = res.refId?.trim();
        if(username) {
          const token = await this.safeUserToken(username);
          if(token) return this.router.createUrlTree(['/dashboard/users/user-profile', token]);
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
          ? this.router.createUrlTree(['/dashboard/properties/property-view', String(id)])
          : this.router.createUrlTree(['/dashboard/property-listing']);
      }

      case 'Lease': {
        const id = res.restored?._id || res.refId;
        return id
          ? this.router.createUrlTree(['/dashboard/tenant/view-lease', String(id)])
          : this.router.createUrlTree(['/dashboard/tenant/payments-list']);
      }

      case 'Complaint': {
        const val = (res.refId && String(res.refId).trim())
          || (res.restored?._id && String(res.restored._id));
        return val
          ? this.router.createUrlTree(['/dashboard/tenant/complaints/view-complaint', val])
          : this.router.createUrlTree(['/dashboard/tenant/complaints']);
      }

      default:
        return this.router.createUrlTree(['/dashboard/notifications/all-notifications']);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * isBackendResponse — stricter recognition of controller responses.
   * Return true if it looks like a BackendActionResult (not a Notification).
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

  /**
   * routeByExactTitle — the “fast path” for hand-crafted titles.
   * Steps:
   *  1) Look up the handler by exact title.
   *  2) Build the ids object by probing only the paths that handler requested.
   *  3) Optionally run a pre-step (e.g., mint token).
   *  4) Return handler.toUrl(...).
   */
  private async routeByExactTitle(
    n: Notification,
    refId: string,
    data: Record<string, any>,
  ): Promise<UrlTree | undefined> {
    const handler = this.TITLE_INDEX[n.title as Title];
    if(!handler) return undefined;

    // Extract only what the handler asked for
    const ids = {
      property: handler.idPaths?.property ? this.firstPresent(data, handler.idPaths.property) : undefined,
      tenant: handler.idPaths?.tenant ? this.firstPresent(data, handler.idPaths.tenant) : undefined,
      lease: handler.idPaths?.lease ? this.firstPresent(data, handler.idPaths.lease) : undefined,

      // Only populate username if handler declared username paths
      username: handler.idPaths?.username
        ? (this.firstPresentStringFromPaths(data, handler.idPaths.username) || (refId || undefined))
        : undefined,

      // Complaint code (prefer) and id (fallback) if handler requested them
      complaintCode: handler.idPaths?.complaintCode
        ? (this.firstPresentStringFromPaths(data, handler.idPaths.complaintCode) || (refId || undefined))
        : undefined,

      complaintId: handler.idPaths?.complaintId
        ? this.firstPresent(data, handler.idPaths.complaintId)
        : undefined,
    } as {
      property?: IdLike;
      tenant?: IdLike;
      lease?: IdLike;
      username?: string;
      complaintCode?: string;
      complaintId?: IdLike;
    };

    // Optional pre-stage (e.g., to fetch a token)
    let pre: Partial<{token: string}> | undefined = undefined;
    if(handler.pre) pre = await Promise.resolve(handler.pre(ids));

    // Only try to mint a token when the handler actually needs a username
    if(!pre?.token && handler.idPaths?.username && ids.username) {
      const token = await this.safeUserToken(String(ids.username));
      if(token) pre = {...(pre || {}), token};
    }

    return handler.toUrl({n, ids, pre, router: this.router});
  }

  /**
   * isDeleteOrDestructive — classify destructive actions so we route to Deleted Items.
   * “restore” is NOT destructive.
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

  /**
   * getByPathCI — Case-insensitive nested read: obj['Foo']['Bar'] with ['foo','bar'].
   * Returns undefined if any segment is missing.
   */
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

  /**
   * firstPresent — Return the first non-empty value for any nested path.
   * • Empty strings are ignored.
   * • Trims strings to avoid whitespace-only false positives.
   */
  private firstPresent(obj: Record<string, any>, paths: string[][]): any {
    for(const p of paths) {
      const v = this.getByPathCI(obj, p);
      if(v === undefined || v === null) continue;
      if(typeof v === 'string') {
        const s = v.trim();
        if(s) return s;
        continue;
      }
      return v;
    }
    return undefined;
  }

  /**
   * firstPresentStringFromPaths — As above, but ensures a string is returned.
   */
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

  /**
   * resolveUsername — Extract username from metadata.data paths first, then fallback to refId.
   * Used only in generic category fallback for User/Tenant.
   */
  private resolveUsername(data: Record<string, any>, refId?: string): string | undefined {
    const fromData = this.firstPresentStringFromPaths(data, this.USERNAME_PATHS);
    if(fromData && fromData.trim()) return fromData.trim();
    if(refId && refId.trim()) return refId.trim();
    return undefined;
  }

  /**
   * safeUserToken — Generate a secure profile token for a username.
   * Returns null on failure (never throws).
   */
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
