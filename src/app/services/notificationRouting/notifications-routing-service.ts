// src/app/services/notificationsRouting/notification-routing-service.ts
// Purpose: Convert a Notification object into an Angular UrlTree and navigate there.
// Highlights:
// - Category-first routing model for Property, Tenant, Lease, User, etc.
// - “Destructive” items (delete/terminate/expire/…) go to a Deleted Items hub.
// - Robust metadata reading: supports flat and nested payloads with case-insensitive keys.
// - Exact case-sensitive Title index to handle special-case routing quickly.
// - User deep links may require a security token (generated via APIsService).
// - Everything is encapsulated in the class (no free functions).

import {Injectable} from '@angular/core';          // Angular DI decorator
import {Router, UrlTree} from '@angular/router';   // Router + UrlTree for navigation
import {
  Notification,                                     // App-level Notification model
  TitleCategory,                                    // Category string union
  Title,                                            // Title string union
} from '../notifications/notification-service';
import {APIsService} from '../APIs/apis.service';  // Service used to generate user tokens

// A helper type to represent IDs that may be a string, number or missing (undefined)
type IdLike = string | number | undefined;

// A structure describing how we route a specific notification Title
type TitleHandler = {
  // The category this title belongs to (User, Property, Tenant, Lease, System, …)
  category: TitleCategory;

  // Where to find ids (by nested key paths) in the notification metadata
  // Every path is an array of keys; each key is matched case-insensitively
  idPaths?: {
    property?: string[][];
    tenant?: string[][];
    lease?: string[][];
    username?: string[][];
  };

  // Optional pre-step before routing — can produce a token, for example
  pre?: (ids: {property?: IdLike; tenant?: IdLike; lease?: IdLike; username?: string}) =>
    Promise<Partial<{token: string}>> | Partial<{token: string}>;

  // Function that turns the notification + pre-processing result into a UrlTree
  toUrl: (ctx: {
    n: Notification;                                                             // the raw notification
    ids: {property?: IdLike; tenant?: IdLike; lease?: IdLike; username?: string}; // extracted IDs
    pre?: Partial<{token: string}>;                                           // output from pre()
    router: Router;                                                             // router to build UrlTree
  }) => UrlTree;
};

// Make this service injectable and available app-wide
@Injectable({providedIn: 'root'})
export class NotificationsRoutingService {

  // Inject Angular Router and the API service (used for generating user profile tokens)
  constructor (
    private readonly router: Router,
    private readonly apis: APIsService
  ) {}

  /* ──────────────────────────────────────────────────────────────────────────────
   * Canonical ID path suggestions (flat + nested + CRUD variants)
   * Each path segment is matched case-insensitively by getByPathCI()
   * These lists help us extract IDs from various metadata shapes consistently.
   * ────────────────────────────────────────────────────────────────────────────── */

  // Property ID can be found in any of these places depending on event/payload
  private readonly PROP_ID_PATHS: string[][] = [
    ['propertyID'], ['propertyId'], ['propId'], ['id'],
    ['property', 'id'], ['property', 'propertyID'], ['property', 'propertyId'],
    ['NewPropertyData', 'propertyID'], ['NewPropertyData', 'propertyId'],
    ['UpdatedPropertyData', 'propertyID'], ['UpdatedPropertyData', 'propertyId'],
    ['UpdatePropertyData', 'propertyID'], ['UpdatePropertyData', 'propertyId'],
    ['DeletedPropertyData', 'propertyID'], ['DeletedPropertyData', 'propertyId'],
    ['DeletePropertyData', 'propertyID'], ['DeletePropertyData', 'propertyId'],
  ];

  // Tenant ID lookup paths
  private readonly TENANT_ID_PATHS: string[][] = [
    ['tenantID'], ['tenantId'],
    ['tenant', 'tenantID'], ['tenant', 'tenantId'], ['tenant', 'id'],
    ['NewTenantData', 'tenantID'], ['NewTenantData', 'tenantId'],
    ['UpdatedTenantData', 'tenantID'], ['UpdatedTenantData', 'tenantId'],
    ['UpdateTenantData', 'tenantID'], ['UpdateTenantData', 'tenantId'],
    ['DeletedTenantData', 'tenantID'], ['DeletedTenantData', 'tenantId'],
    ['DeleteTenantData', 'tenantID'], ['DeleteTenantData', 'tenantId'],
  ];

  // Lease ID lookup paths
  private readonly LEASE_ID_PATHS: string[][] = [
    ['leaseID'], ['leaseId'],
    ['lease', 'leaseID'], ['lease', 'leaseId'], ['lease', 'id'],
    ['NewLeaseData', 'leaseID'], ['NewLeaseData', 'leaseId'],
    ['UpdatedLeaseData', 'leaseID'], ['UpdatedLeaseData', 'leaseId'],
    ['UpdateLeaseData', 'leaseID'], ['UpdateLeaseData', 'leaseId'],
    ['DeletedLeaseData', 'leaseID'], ['DeletedLeaseData', 'leaseId'],
    ['DeleteLeaseData', 'leaseID'], ['DeleteLeaseData', 'leaseId'],
  ];

  // Username lookup paths.
  // NOTE: backend moved from UpdatedUserData → user, so we support both.
  private readonly USERNAME_PATHS: string[][] = [
    ['username'], ['user'], ['owner'],           // flat fallbacks (string-only for 'username' & 'owner'; 'user' can be object)
    ['user', 'username'],                        // nested under 'user' object
    ['NewUserData', 'username'],                 // historical payload shapes
    ['UpdatedUserData', 'username'], ['UpdateUserData', 'username'],
    ['DeletedUserData', 'username'], ['DeleteUserData', 'username'],
  ];

  /* ──────────────────────────────────────────────────────────────────────────────
   * Exact, case-sensitive Title index
   * We can quickly route by exact title without switching by category
   * and still use the same ID path extraction logic above.
   * ────────────────────────────────────────────────────────────────────────────── */
  private readonly TITLE_INDEX: Record<string, TitleHandler> = {
    // ─── USER TITLES ────────────────────────────────────────────────────────────
    // For create/update, try to deep-link into the user profile if we can mint a token.
    'New User': {
      category: 'User',                           // used for grouping / clarity
      idPaths: {username: this.USERNAME_PATHS}, // where to find the username in metadata
      toUrl: ({n, ids, pre, router}) => {       // build the UrlTree
        if(ids.username && pre?.token) {         // if token exists → deep link to profile
          return router.createUrlTree(['/dashboard/view-user-profile', pre.token]);
        }
        // fallback to the users list (select this notification)
        return router.createUrlTree(['/dashboard/users'], {queryParams: {selected: n._id}});
      },
    },
    'Update User': {
      category: 'User',
      idPaths: {username: this.USERNAME_PATHS},
      toUrl: ({n, ids, pre, router}) => {
        if(ids.username && pre?.token) {
          return router.createUrlTree(['/dashboard/view-user-profile', pre.token]);
        }
        return router.createUrlTree(['/dashboard/users'], {queryParams: {selected: n._id}});
      },
    },
    'Delete User': {
      category: 'User',
      toUrl: ({n, router}) =>
        router.createUrlTree(
          ['/dashboard/deleted-items'],                           // Deleted Items hub
          {queryParams: {selected: n._id, category: 'User', type: 'delete'}}
        ),
    },

    // ─── PROPERTY TITLES ────────────────────────────────────────────────────────
    'New Property': {
      category: 'Property',
      idPaths: {property: this.PROP_ID_PATHS},  // where to find property id
      toUrl: ({ids, router}) =>
        ids.property                               // if we have an id → go to property view
          ? router.createUrlTree(['/dashboard/property-view', String(ids.property)])
          // else → go to the listing page
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

    // ─── TENANT TITLES ─────────────────────────────────────────────────────────
    'New Tenant': {
      category: 'Tenant',
      idPaths: {tenant: this.TENANT_ID_PATHS},  // where to find tenant id
      toUrl: ({ids, router}) =>
        ids.tenant
          ? router.createUrlTree(['/dashboard/tenant/tenant-view', String(ids.tenant)])
          : router.createUrlTree(['/dashboard/tenant/tenant-home']),
    },
    'Update Tenant': {
      category: 'Tenant',
      idPaths: {tenant: this.TENANT_ID_PATHS},
      toUrl: ({ids, router}) =>
        ids.tenant
          ? router.createUrlTree(['/dashboard/tenant/tenant-view', String(ids.tenant)])
          : router.createUrlTree(['/dashboard/tenant/tenant-home']),
    },
    'Delete Tenant': {
      category: 'Tenant',
      toUrl: ({n, router}) =>
        router.createUrlTree(
          ['/dashboard/deleted-items'],
          {queryParams: {selected: n._id, category: 'Tenant', type: 'delete'}}
        ),
    },

    // ─── LEASE TITLES ──────────────────────────────────────────────────────────
    'New Lease': {
      category: 'Lease',
      idPaths: {lease: this.LEASE_ID_PATHS},    // where to find lease id
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

    // ─── SYSTEM/BROADCAST TITLES (examples) ────────────────────────────────────
    'System Update': {
      category: 'System',
      toUrl: ({n, router}) =>
        router.createUrlTree(
          ['/dashboard/all-notifications'],         // generic inbox page
          {queryParams: {selected: n._id}}      // highlight selection
        ),
    },
    'Broadcast Announcement': {
      category: 'System',
      toUrl: ({n, router}) =>
        router.createUrlTree(
          ['/dashboard/all-notifications'],
          {queryParams: {selected: n._id}}
        ),
    },
  };

  /* ──────────────────────────────────────────────────────────────────────────────
   * PUBLIC API
   * ────────────────────────────────────────────────────────────────────────────── */

  /**
   * Compute a UrlTree for a notification.
   * Note: may call APIs to build a token for User deep links (hence async).
   */
  public async routeFor(n: Notification): Promise<UrlTree> {
    const meta: Record<string, any> = n.metadata || {}; // guard if metadata is missing

    // 0) Exact title fast-path: try TITLE_INDEX first for precision/speed
    const exact = await this.routeByExactTitle(n, meta);
    if(exact) return exact;

    // 1) General extraction flow: compute common IDs from metadata (case-insensitive)
    const propId: IdLike =
      this.pick(meta, ['propertyID', 'propertyId', 'propId', 'id']) ??      // flat keys
      this.getByPathCI(meta, ['property', 'id']) ??                         // nested under property.id
      this.getByPathCI(meta, ['NewPropertyData', 'propertyID']) ??          // historical shapes
      this.getByPathCI(meta, ['property', 'propertyID']) ??
      this.getByPathCI(meta, ['UpdatedPropertyData', 'propertyID']);

    const tenantId: IdLike =
      this.pick(meta, ['tenantID', 'tenantId']) ??
      this.getByPathCI(meta, ['tenant', 'tenantID']) ??
      this.getByPathCI(meta, ['tenant', 'id']) ??
      this.getByPathCI(meta, ['UpdatedTenantData', 'tenantID']);

    const leaseId: IdLike =
      this.pick(meta, ['leaseID', 'leaseId']) ??
      this.getByPathCI(meta, ['lease', 'leaseID']) ??
      this.getByPathCI(meta, ['lease', 'id']) ??
      this.getByPathCI(meta, ['UpdatedLeaseData', 'leaseID']);

    // Robust username resolver: supports UpdatedUserData.username and user.username
    const username = this.resolveUsername(meta);

    // 2) If this item is destructive (delete/terminate/…), go to Deleted Items hub
    if(this.isDeleteOrDestructive(n)) {
      return this.router.createUrlTree(
        ['/dashboard/deleted-items'],
        {
          queryParams: {
            selected: n._id,
            category: n.category || undefined,
            type: n.type || undefined
          }
        }
      );
    }

    // 3) Category-first routing: direct to the most relevant page for each category
    switch(n.category as TitleCategory | undefined) {
      case 'Property':
        // Property view if we have a property id, else property listing page
        return (propId != null && String(propId).trim())
          ? this.router.createUrlTree(['/dashboard/property-view', String(propId)])
          : this.router.createUrlTree(['/dashboard/property-listing'], {queryParams: {selected: n._id}});

      case 'Tenant':
        // Tenant view if we have a tenant id, else tenant landing page
        return (tenantId != null && String(tenantId).trim())
          ? this.router.createUrlTree(['/dashboard/tenant/tenant-view', String(tenantId)])
          : this.router.createUrlTree(['/dashboard/tenant/tenant-home'], {queryParams: {selected: n._id}});

      case 'Lease':
        // Lease view if we have a lease id, else payments list
        return (leaseId != null && String(leaseId).trim())
          ? this.router.createUrlTree(['/dashboard/tenant/view-lease', String(leaseId)])
          : this.router.createUrlTree(['/dashboard/tenant/payments-list'], {queryParams: {selected: n._id}});

      case 'User': {
        // For users: try deep-linking to the profile by minting a token
        if(username) {
          const token = await this.safeUserToken(username);
          if(token) return this.router.createUrlTree(['/dashboard/view-user-profile', token]);
        }
        // Fallback to users list
        return this.router.createUrlTree(['/dashboard/users'], {queryParams: {selected: username ?? n._id}});
      }

      // Other categories: keep user in notifications index (selected)
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

    // 4) Title-based fallbacks (in case category was wrong/missing)
    if(/property/i.test(n.title) && propId != null && String(propId).trim()) {
      return this.router.createUrlTree(['/dashboard/property-view', String(propId)]);
    }
    if(/tenant/i.test(n.title) && tenantId != null && String(tenantId).trim()) {
      return this.router.createUrlTree(['/dashboard/tenant/tenant-view', String(tenantId)]);
    }
    if(/lease/i.test(n.title) && leaseId != null && String(leaseId).trim()) {
      return this.router.createUrlTree(['/dashboard/tenant/view-lease', String(leaseId)]);
    }
    if(/user/i.test(n.title) && username) {
      const token = await this.safeUserToken(username);
      if(token) return this.router.createUrlTree(['/dashboard/view-user-profile', token]);
      return this.router.createUrlTree(['/dashboard/users'], {queryParams: {selected: username}});
    }

    // 5) Final fallback: the notifications index
    return this.router.createUrlTree(['/dashboard/all-notifications'], {queryParams: {selected: n._id}});
  }

  /**
   * Convenience method: compute UrlTree and actually navigate there.
   * Use this in your click handlers.
   */
  public async navigateTo(n: Notification): Promise<boolean> {
    try {
      const url = await this.routeFor(n);        // compute destination
      return this.router.navigateByUrl(url);     // navigate
    } catch(err) {
      // Safety net: go to notifications index if routing fails
      console.error('[notif-route] navigateTo failed:', err);
      return this.router.navigateByUrl(
        this.router.createUrlTree(['/dashboard/all-notifications'], {queryParams: {selected: n._id}})
      );
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────────
   * PRIVATE HELPERS
   * ────────────────────────────────────────────────────────────────────────────── */

  /**
   * Route by exact title using TITLE_INDEX.
   * Also handles token generation automatically if username exists and pre() didn't produce one.
   */
  private async routeByExactTitle(n: Notification, meta: Record<string, any>): Promise<UrlTree | undefined> {
    const handler = this.TITLE_INDEX[n.title as Title];  // find exact, case-sensitive title match
    if(!handler) return undefined;                      // bail if not found

    // Attempt to extract ids according to the handler’s idPaths
    const ids = {
      property: handler.idPaths?.property ? this.firstPresent(meta, handler.idPaths.property) : undefined,
      tenant: handler.idPaths?.tenant ? this.firstPresent(meta, handler.idPaths.tenant) : undefined,
      lease: handler.idPaths?.lease ? this.firstPresent(meta, handler.idPaths.lease) : undefined,
      username: handler.idPaths?.username
        ? this.firstPresentStringFromPaths(meta, handler.idPaths.username)
        : undefined,
    } as {property?: IdLike; tenant?: IdLike; lease?: IdLike; username?: string};

    // Run an optional pre-step, which can return a token etc.
    let pre: Partial<{token: string}> | undefined = undefined;
    if(handler.pre) pre = await Promise.resolve(handler.pre(ids));

    // If no token from pre(), yet we have a username → try to mint it here
    if(!pre?.token && ids.username) {
      const token = await this.safeUserToken(String(ids.username));
      if(token) pre = {...(pre || {}), token};
    }

    // Finally, build the UrlTree using the handler logic
    return handler.toUrl({n, ids, pre, router: this.router});
  }

  /**
   * A conservative “destructive” classifier that looks at notification.type and title text.
   * If an item is destructive (delete/terminate/expire/archive/etc.), we route to Deleted Items hub.
   */
  private isDeleteOrDestructive(n: Notification): boolean {
    const t = (n.type || '').toLowerCase();         // normalize type
    const title = (n.title || '').toLowerCase();    // normalize title
    const destructive = new Set([                   // words that indicate destructive behavior
      'delete', 'terminate', 'expire', 'unpublish', 'archive', 'remove', 'deactivate', 'restore'
    ]);
    return (
      destructive.has(t) ||                         // exact match with type
      title.includes('delete') ||                   // or title contains a destructive word
      title.includes('deleted') ||
      title.includes('terminated') ||
      title.includes('expired') ||
      title.includes('archiv') ||                   // covers archive/archived
      title.includes('removed') ||
      title.includes('deactivated')
    );
  }

  /**
   * Case-insensitive nested read:
   * Traverse an object by keys in `path`, matching each segment ignoring case.
   * Returns undefined if any segment is missing.
   */
  private getByPathCI(obj: any, path: string[]): any {
    if(!obj || !path?.length) return undefined;    // guard invalid inputs
    let cur: any = obj;                             // start at the root
    for(const seg of path) {                       // walk each path segment
      if(cur == null) return undefined;            // stop if branch is null/undefined
      const key = Object.keys(cur).find(            // find the actual key that matches this segment case-insensitively
        (k) => k.toLowerCase() === seg.toLowerCase()
      );
      if(!key) return undefined;                   // missing segment
      cur = cur[key as keyof typeof cur];           // descend to the child
    }
    return cur;                                     // success → value
  }

  /**
   * Return the first present, non-empty value among candidate nested paths.
   * Non-empty string or any non-nullish value qualifies.
   */
  private firstPresent(obj: Record<string, any>, paths: string[][]): any {
    for(const p of paths) {                        // test each candidate path in order
      const v = this.getByPathCI(obj, p);          // read the value
      // accept any non-nullish value; empty string rejected
      if(v !== undefined && v !== null && (typeof v !== 'string' || v.trim() !== '')) return v;
      if(typeof v === 'string' && v.trim() !== '') return v;
    }
    return undefined;                               // none matched
  }

  /**
   * Return the first present, non-empty **string** among candidate nested paths.
   */
  private firstPresentStringFromPaths(obj: Record<string, any>, paths: string[][]): string | undefined {
    for(const p of paths) {
      const v = this.getByPathCI(obj, p);
      if(typeof v === 'string') {
        const s = v.trim();
        if(s) return s;                            // first non-empty string wins
      }
    }
    return undefined;
  }

  /**
   * Pick the first present value among a set of **flat** keys.
   * Index-signature safe: we use bracket access (obj['key']).
   */
  private pick(obj: Record<string, any>, keys: string[]) {
    for(const k of keys) {
      const v = obj?.[k];                           // safe bracket access for index signature
      if(v !== undefined && v !== null) {          // accept non-nullish
        if(typeof v === 'string') {                // if string → must be non-empty
          const s = v.trim?.() ?? '';
          if(s) return s;
        } else {
          return v;                                 // non-string → return as-is
        }
      }
    }
    return undefined;
  }

  /**
   * Robust username extractor:
   * - tries common nested paths first (UpdatedUserData.username, user.username, …)
   * - then checks flat keys: username/owner/user if sent as string
   * - returns the first non-empty string found
   */
  private resolveUsername(meta: Record<string, any>): string | undefined {
    const candidates: Array<string | undefined> = [
      // preferred nested forms (case-insensitive)
      this.firstPresentStringFromPaths(meta, [
        ['UpdatedUserData', 'username'],
        ['UpdateUserData', 'username'],
        ['NewUserData', 'username'],
        ['DeletedUserData', 'username'],
        ['DeleteUserData', 'username'],
        ['user', 'username'],             // current backend emits `metadata.user.username`
      ]),
      // flat string keys (index-signature safe)
      typeof meta?.['username'] === 'string' ? meta['username'] : undefined,
      typeof meta?.['owner'] === 'string' ? meta['owner'] : undefined,
      typeof meta?.['user'] === 'string' ? meta['user'] : undefined, // in case 'user' is a string
    ];

    // return first non-empty string
    for(const v of candidates) {
      if(typeof v === 'string') {
        const s = v.trim();
        if(s) return s;
      }
    }
    return undefined;                                // no usable username found
  }

  /**
   * Generate a secure user profile token using the APIsService.
   * Returns null if the token couldn’t be obtained.
   */
  private async safeUserToken(username: string): Promise<string | null> {
    try {
      const resp = await this.apis.generateToken(username);  // call backend to mint a token
      const token = (resp as any)?.token ?? resp;            // support either {token} or raw string
      return (typeof token === 'string' && token.trim()) ? token : null;
    } catch(err) {
      console.warn('[notif-route] token generation failed for', username, err);
      return null;                                           // swallow errors and degrade gracefully
    }
  }
}
