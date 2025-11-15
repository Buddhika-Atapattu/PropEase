// Path: src/app/services/guardAuth/guard-auth.guard.ts
// -----------------------------------------------------------------------------
// AuthGuard
// - Gate #1: Ensures the user is logged in.
// - Gate #2: Enforces route.data.roles (coarse role filter).
// - Gate #3: Enforces fine-grained permission based on the centralized
//            "module + action" rules exported by AuthService.
// - URL → Rule mapping is centralized in `definedURLs` below.
// - SSR-safe: no direct window usage; guards with isPlatformBrowser where needed.
// -----------------------------------------------------------------------------
//
// How permission is resolved:
// 1) We compute the user's "effective" AccessMap from one of:
//    - The logged user's own `access` object (if you later store it per-user), or
//    - The DEFAULT_ROLE_ACCESS[role] from AuthService (current default).
// 2) We match the current URL to a (module, action) requirement.
// 3) We check whether the effective AccessMap includes that action under that module.
//
// Notes:
// - If a URL has no entry in `definedURLs`, we allow it (route.data.roles still applies).
// - Keep `definedURLs` close to your route tree for clarity and easy maintenance.
// -----------------------------------------------------------------------------

import {isPlatformBrowser} from '@angular/common';
import {Inject, Injectable, PLATFORM_ID} from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateChild,
  Router,
  RouterStateSnapshot,
} from '@angular/router';

import {
  AuthService,
  AccessMap,
  DEFAULT_ROLE_ACCESS,
  ACCESS_OPTIONS,
  Role,
} from '../auth/auth.service';
import {User} from '../APIs/apis.service'
interface RouteRequirement {
  /** Concrete URL pattern from the router (supports :params and *). */
  url: string;
  /** Module name as defined in ACCESS_OPTIONS (must match exactly). */
  module: string;
  /** Action string as defined in ACCESS_OPTIONS[module].actions (must match). */
  action: string;
}

@Injectable({providedIn: 'root'})
export class AuthGuard implements CanActivate, CanActivateChild {
  private readonly isBrowser: boolean;

  constructor (
    private readonly authService: AuthService,
    private readonly router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /* ==================== Router Guards ==================== */

  public canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // Gate #1: require login
    const loggedUser = this.authService.getLoggedUser;
    if(!this.authService.isUserLoggedIn || !loggedUser) {
      this.router.navigateByUrl('/login');
      return false;
    }

    // Gate #2: coarse role filter from route data (if present)
    if(!this.passesRouteRoleFilter(route, loggedUser)) {
      this.router.navigateByUrl('/dashboard/unauthorized');
      return false;
    }

    // Gate #3: fine-grained permission based on module/action rules
    if(!this.passesPermissionForUrl(state.url, loggedUser)) {
      this.router.navigateByUrl('/dashboard/unauthorized');
      return false;
    }

    return true;
  }

  public canActivateChild(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // Delegate to the main guard (keeps logic in one place)
    return this.canActivate(route, state);
  }

  /* ==================== Gate #2 — Role Filter ==================== */

  /**
   * Returns true if user's role is included in route.data.roles (when provided).
   * If no roles are defined on the route, we allow and defer to permission check.
   */
  private passesRouteRoleFilter(route: ActivatedRouteSnapshot, user: User): boolean {
    const allowedRoles = (route.data?.['roles'] as Role[] | undefined) ?? undefined;
    if(!allowedRoles || allowedRoles.length === 0) return true;
    return allowedRoles.includes(user.role);
  }

  /* ==================== Gate #3 — Permission Check ==================== */

  /**
   * Matches current URL to a (module, action) requirement and verifies
   * the user's effective permission.
   */
  private passesPermissionForUrl(currentUrl: string, user: User): boolean {
    // 1) Find the first matching URL rule (if any). If none, allow by default.
    const match = this.matchRequirement(currentUrl);
    if(!match) return true;

    // 2) Derive effective AccessMap for this user.
    const access = this.computeEffectiveAccess(user.role);

    // 3) Validate module exists in catalog (defense-in-depth)
    const moduleCatalog = ACCESS_OPTIONS.find(m => m.module === match.module);
    if(!moduleCatalog) return false;

    // 4) Validate action belongs to the module catalog (helps catch typos)
    if(!moduleCatalog.actions.includes(match.action)) return false;

    // 5) Check permission in the effective AccessMap
    const allowedActions = access[match.module] ?? [];
    return allowedActions.includes(match.action);
  }

  /**
   * Compute effective AccessMap either from server-provided per-user access
   * (if you start storing it in `loggedUser.access`) or from DEFAULT_ROLE_ACCESS.
   */
  private computeEffectiveAccess(role: Role): AccessMap {
    // If you later persist per-user overrides in loggedUser.access, resolve them here.
    // For now we use DEFAULT_ROLE_ACCESS as the single source of truth.
    const fromDefaults = DEFAULT_ROLE_ACCESS[role] ?? {};
    return fromDefaults;
  }

  /**
   * Try to match the current URL to one of our route requirements.
   * Supports `:params` and `*` wildcards.
   */
  private matchRequirement(currentUrl: string): RouteRequirement | null {
    for(const req of this.definedURLs) {
      const regex = this.routeToRegex(req.url);
      if(regex.test(currentUrl)) return req;
    }
    return null;
  }

  /**
   * Convert a route pattern into a regex:
   * - `:param` → `[^/]+`
   * - `*`      → `[^/]+`
   * - Anchored from start to end to avoid partial matches.
   */
  private routeToRegex(routePattern: string): RegExp {
    const escaped = routePattern
      .replace(/:[^/]+/g, '[^/]+') // replace :params
      .replace(/\*/g, '[^/]+');    // replace wildcards
    return new RegExp(`^${escaped}$`);
  }

  /* ==================== URL → Rule Mapping ==================== */
  /**
   * Centralized list mapping URL patterns to (module, action) requirements.
   * IMPORTANT:
   * - Module and action must exactly match entries in ACCESS_OPTIONS.
   * - Keep this list in sync with app.routes.ts to ensure accurate protection.
   */
  private readonly definedURLs: ReadonlyArray<RouteRequirement> = [
    // ---------- Home / General ----------
    // (No strict module/action needed for /dashboard/home — roles on the route already handle it)

    // ---------- Notifications ----------
    {url: '/dashboard/notifications/all-notifications', module: 'Communication & Notification', action: 'view message logs'},

    // ---------- User Management ----------
    {url: '/dashboard/users', module: 'User Management', action: 'view users'},
    {url: '/dashboard/users/add-new-user', module: 'User Management', action: 'create user'},
    {url: '/dashboard/users/edit-user/:username', module: 'User Management', action: 'update user'},
    {url: '/dashboard/users/user-profile/:username', module: 'User Management', action: 'view users'},

    // Optional: access-control is admin-only by route roles, but bind to rule too:
    {url: '/dashboard/access-control', module: 'Access Control', action: 'control sessions'},

    // ---------- Property Management ----------
    {url: '/dashboard/properties', module: 'Property Management', action: 'view properties'},
    {url: '/dashboard/properties/property-listing', module: 'Property Management', action: 'create property'},
    {url: '/dashboard/properties/property-view/:propertyID', module: 'Property Management', action: 'view properties'},
    {url: '/dashboard/properties/property-edit/:propertyID', module: 'Property Management', action: 'update property'},

    // ---------- Tenant Management (main) ----------
    {url: '/dashboard/tenant/tenant-home', module: 'Tenant Management', action: 'view tenant profile'},
    {url: '/dashboard/tenant/tenant-view/:tenantID', module: 'Tenant Management', action: 'view tenant profile'},
    {url: '/dashboard/tenant/create-lease/:tenantID', module: 'Tenant Management', action: 'create lease'},
    {url: '/dashboard/tenant/view-lease/:leaseID', module: 'Tenant Management', action: 'view lease'},
    {url: '/dashboard/tenant/tenant-lease/:leaseID', module: 'Tenant Management', action: 'update lease'},

    // ---------- Tenant Complaints ----------
    {url: '/dashboard/tenant/complaints', module: 'Tenant Management', action: 'view complaint'},
    {url: '/dashboard/tenant/complaints/create-complaint/:tenantID', module: 'Tenant Management', action: 'create complaint'},
    {url: '/dashboard/tenant/complaints/edit-complaint/:complaintID', module: 'Tenant Management', action: 'update complaint'},
    {url: '/dashboard/tenant/complaints/view-complaint/:complaintID', module: 'Tenant Management', action: 'view complaint'},

    // ---------- Maintenance (if/when you add top-level pages) ----------
    // Example (uncomment/add when pages exist):
    // { url: '/dashboard/maintenance/requests',            module: 'Maintenance Requests', action: 'view requests' },
    // { url: '/dashboard/maintenance/requests/create',     module: 'Maintenance Requests', action: 'create request' },
    // { url: '/dashboard/maintenance/requests/edit/:id',   module: 'Maintenance Requests', action: 'update request status' },

    // ---------- Team Management (if/when you add pages) ----------
    // { url: '/dashboard/teams',                           module: 'Team Management',       action: 'view teams' },
    // { url: '/dashboard/teams/assign/:ticketId',          module: 'Team Management',       action: 'assign team to maintenance ticket' },
  ];
}
