// Path: src/app/services/guardAuth/guard-auth.guard.ts
// -----------------------------------------------------------------------------
// AuthGuard
// - Gate #1: Ensures the user is logged in.
// - Gate #1.5: If user has MFA enabled but not validated, force MFA verification.
// - Gate #2: Enforces route.data.roles (coarse role filter).
// - Gate #3: Enforces fine-grained permission based on the centralized
//            "module + action" rules exported by AuthService / access-map.
// - URL → Rule mapping is centralized in `DEFINED_ROUTES_URLS` below.
// - SSR-safe: no direct window usage; guards with isPlatformBrowser where needed.
// -----------------------------------------------------------------------------

import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateChild,
  Router,
  RouterStateSnapshot,
} from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { User, Role } from '../APIs/apis.service';
import {
  ACCESS_OPTIONS,
  AccessModuleKey,
  AccessActionKey,
  PermissionEntry,
} from '../../source/access-map.source';
import { RouteRequirement, DEFINED_ROUTES_URLS } from '../../source/router-map.source';

/**
 * Effective access map for a user:
 *  - key   → AccessModuleKey
 *  - value → list of allowed AccessActionKey in that module
 */
type AccessMap = Partial<Record<AccessModuleKey, AccessActionKey[]>>;

/**
 * One URL → permission requirement mapping.
 *  - `url`    → Angular route pattern (supports `:param` and `*`).
 *  - `module` → canonical module key from ACCESS_OPTIONS.module
 *  - `action` → canonical action key from ACCESS_OPTIONS[].actions[].id
 */


@Injectable( { providedIn: 'root' } )
export class AuthGuard implements CanActivate, CanActivateChild {
  private readonly isBrowser: boolean;

  constructor (
    private readonly authService: AuthService,
    private readonly router: Router,
    @Inject( PLATFORM_ID ) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
  }

  /* ==================== Router Guards ==================== */

  public canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): boolean {
    const loggedUser: User | null = this.authService.getLoggedUser;

    // Normalised current path (without query/hash)
    const urlPath =
      state.url.split( '?' )[ 0 ]?.split( '#' )[ 0 ] ?? state.url;

    // ───────────────── Gate #1: require login ─────────────────
    if ( !this.authService.isUserLoggedIn || !loggedUser ) {
      this.router.navigateByUrl( '/login' );
      return false;
    }

    // ───────────────── Gate #1.5: MFA enforcement ─────────────
    //
    // Rules:
    //   - If user has multiAuthEnabled === true
    //   - And MFA status in localStorage !== "validated"
    //   - And we are NOT already on /mfa/verification
    //   → Force redirect to /mfa/verification.
    //
    // Notes:
    //   - On SSR (isBrowser=false) we skip MFA gate to avoid accessing localStorage.
    //   - Backend should still enforce MFA for sensitive API calls; this is a
    //     front-end gate for navigation only.
    if (
      this.isBrowser &&
      loggedUser.multiAuthEnabled === true &&
      !this.isMfaVerificationRoute( urlPath )
    ) {
      if ( !this.isMfaValidated() ) {
        this.router.navigateByUrl( '/mfa/verification' );
        return false;
      }
    }

    // ───────────────── Gate #2: coarse role filter ──────────
    if ( !this.passesRouteRoleFilter( route, loggedUser ) ) {
      this.router.navigateByUrl( '/dashboard/unauthorized' );
      return false;
    }

    // ───────────────── Gate #3: fine-grained permission ─────
    if ( !this.passesPermissionForUrl( urlPath, loggedUser ) ) {
      this.router.navigateByUrl( '/dashboard/unauthorized' );
      return false;
    }

    return true;
  }

  public canActivateChild(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): boolean {
    // Delegate to the main guard (keeps logic in one place)
    return this.canActivate( route, state );
  }

  /* ==================== MFA helpers ==================== */

  /**
   * Check whether current URL is the MFA verification route.
   * We must allow navigation to this route even when MFA is not validated.
   */
  private isMfaVerificationRoute( urlPath: string ): boolean {
    const clean =
      urlPath.split( '?' )[ 0 ]?.split( '#' )[ 0 ] ?? urlPath;
    // You can extend this later if you add children under /mfa/verification/...
    return clean === '/mfa/verification';
  }

  /**
   * Returns true if MFA is already validated for this browser session.
   * Uses the same key as AuthService.STORAGE_KEYS.mfaVerify ("mfa_verify").
   *
   * Accepted "validated" state:
   *   - localStorage.mfa_verify === "validated"
   *
   * Any other value (null, "pending", "not_validated", "no_mfa", etc.)
   * is treated as NOT validated for MFA users.
   */
  private isMfaValidated(): boolean {
    if ( !this.isBrowser ) {
      // On SSR we don't enforce MFA to avoid localStorage access.
      // Real security must be enforced in the backend anyway.
      return true;
    }

    try {
      const status = localStorage.getItem( 'mfa_verify' );
      return status === 'validated';
    } catch ( err ) {
      console.warn( '[AuthGuard] Failed to read MFA status from storage:', err );
      return false;
    }
  }

  /* ==================== Gate #2 — Role Filter ==================== */

  /**
   * Returns true if user's role is included in route.data.roles (when provided).
   * If no roles are defined on the route, we allow and defer to permission check.
   */
  private passesRouteRoleFilter(
    route: ActivatedRouteSnapshot,
    user: User,
  ): boolean {
    const allowedRoles =
      ( route.data?.[ 'roles' ] as Role[] | undefined ) ?? undefined;

    if ( !allowedRoles || allowedRoles.length === 0 ) {
      return true;
    }

    return allowedRoles.includes( user.role );
  }

  /* ==================== Gate #3 — Permission Check ==================== */

  /**
   * Matches current URL to a (module, action) requirement and verifies
   * the user's effective permission.
   *
   * NOTE: this is synchronous; route guards expect boolean/UrlTree or observable,
   * not Promise<boolean>.
   */
  private passesPermissionForUrl( currentUrl: string, user: User ): boolean {
    // `currentUrl` is already a clean path (no query/hash) in canActivate,
    // but we normalize again here in case this is called from somewhere else.
    const urlPath =
      currentUrl.split( '?' )[ 0 ]?.split( '#' )[ 0 ] ?? currentUrl;

    // 1) Find the first matching URL rule (if any). If none, allow by default.
    const match = this.matchRequirement( urlPath );
    if ( !match ) {
      // If no mapping is defined for this URL, we consider it "public"
      // *within the module* and rely on Gate #1 + Gate #2 only.
      return true;
    }

    // 2) Derive effective AccessMap for this user.
    const access = this.computeEffectiveAccess( user );

    // 3) Validate module exists in catalog (defense-in-depth)
    const moduleCatalog = ACCESS_OPTIONS.find(
      ( m ) => m.module === match.module,
    );
    if ( !moduleCatalog ) {
      // Misconfigured rule or outdated mapping
      console.warn( '[AuthGuard] No module catalog for', match.module );
      return false;
    }

    // 4) Validate action belongs to the module catalog (helps catch typos)
    const hasActionInCatalog = moduleCatalog.actions.some(
      ( a ) => a.id === match.action,
    );
    if ( !hasActionInCatalog ) {
      console.warn(
        '[AuthGuard] Action not found in module catalog',
        match.action,
        'for module',
        moduleCatalog.module,
      );
      return false;
    }

    // 5) Check permission in the effective AccessMap
    const moduleKey: AccessModuleKey = moduleCatalog.module;
    const allowedActions: AccessActionKey[] = access[ moduleKey ] ?? [];

    // With strongly-typed union IDs, case-sensitive equality is correct.
    return allowedActions.includes( match.action );
  }

  /**
   * Compute effective AccessMap either from server-provided per-user access
   * (user.access.permissions) or from per-role defaults in AuthService.
   */
  private computeEffectiveAccess( user: User ): AccessMap {
    const effective: AccessMap = {};

    // 1) Prefer per-user access if present
    const perms = user.access?.permissions as PermissionEntry[] | undefined;
    if ( Array.isArray( perms ) && perms.length > 0 ) {
      for ( const p of perms ) {
        const moduleKey: AccessModuleKey = p.module;
        if ( !effective[ moduleKey ] ) {
          effective[ moduleKey ] = [];
        }

        const list = effective[ moduleKey ] as AccessActionKey[];
        for ( const action of p.actions ) {
          if ( !list.includes( action ) ) {
            list.push( action );
          }
        }
      }
      return effective;
    }

    // 2) Fallback: AuthService per-role defaults (boolean matrix)
    //    Expected shape:
    //    Record<AccessModuleKey, Record<AccessActionKey, boolean>>
    const byRoleMatrix =
      this.authService.getDefaultAccessByRole( user.role ) as Record<
        AccessModuleKey,
        Record<AccessActionKey, boolean>
      >;

    for ( const moduleKey of Object.keys( byRoleMatrix ) as AccessModuleKey[] ) {
      const flags = byRoleMatrix[ moduleKey ];
      const allowed: AccessActionKey[] = [];

      for ( const actionKey of Object.keys( flags ) as AccessActionKey[] ) {
        const isAllowed = flags[ actionKey ];
        if ( isAllowed ) {
          allowed.push( actionKey );
        }
      }

      if ( allowed.length > 0 ) {
        effective[ moduleKey ] = allowed;
      }
    }

    return effective;
  }

  /**
   * Try to match the current URL path (without query/hash) to one of our
   * route requirements. Supports `:params` and `*` wildcards.
   */
  private matchRequirement( currentPath: string ): RouteRequirement | null {
    for ( const req of DEFINED_ROUTES_URLS ) {
      const regex = this.routeToRegex( req.url );
      if ( regex.test( currentPath ) ) {
        return req;
      }
    }
    return null;
  }

  /**
   * Convert a route pattern into a regex:
   * - Normalises trailing "/" on the pattern.
   * - `:param` → `[^/]+`
   * - `*`      → `[^/]+`
   * - Anchored from start to end, with an optional trailing "/".
   */
  private routeToRegex( routePattern: string ): RegExp {
    const normalised = routePattern.replace( /\/+$/, '' ); // remove trailing slashes
    const pattern = normalised
      .replace( /:[^/]+/g, '[^/]+' ) // replace :params
      .replace( /\*/g, '[^/]+' ); // replace wildcards

    // Optional trailing '/'
    return new RegExp( `^${ pattern }\\/?$` );
  }

  /* ==================== URL → Rule Mapping ==================== */

  /**
   * Centralized list mapping URL patterns to (module, action) requirements.
   *
   * IMPORTANT:
   * - `module` and `action` correspond to ACCESS_OPTIONS entries:
   *      module  → AccessModuleKey (e.g., "UserManagement")
   *      action  → AccessActionKey  (e.g., "view", "create", "update", ...)
   */

}
