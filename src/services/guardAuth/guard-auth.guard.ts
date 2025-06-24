import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import {
  CanActivate,
  CanActivateChild,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import {
  AuthService,
  LoggedUserType,
  ROLE_ACCESS_MAP,
} from '../auth/auth.service';
import { isPlatformBrowser } from '@angular/common';
import { WindowsRefService } from '../windowRef.service';
import { CryptoService } from '../cryptoService/crypto.service';

interface roleAccess {
  module: string;
  action: string;
  URL: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate, CanActivateChild {
  private isBrowser: boolean;
  private userAccess: ROLE_ACCESS_MAP | null = null;

  private ROLES: string[] = [
    'admin',
    'agent',
    'tenant',
    'operator',
    'developer',
    'user',
  ];

  private definedURLs: roleAccess[] = [
    // User Management
    {
      module: 'User Management',
      action: 'view',
      URL: '/dashboard/view-user-profile/*',
    },
    {
      module: 'User Management',
      action: 'create',
      URL: '/dashboard/add-new-user',
    },
    {
      module: 'User Management',
      action: 'update',
      URL: '/dashboard/edit-user/*',
    },
    // Property Management
    {
      module: 'Property Management',
      action: 'view',
      URL: '/dashboard/property-view/*',
    },
    {
      module: 'Property Management',
      action: 'create',
      URL: '/dashboard/property-listing',
    },
    {
      module: 'Property Management',
      action: 'update',
      URL: '/dashboard/property-edit/*',
    },
  ];

  constructor(
    private windowRef: WindowsRefService,
    private authService: AuthService,
    private router: Router,
    private cryptoService: CryptoService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const isLoggedIn = this.authService.isUserLoggedIn;
    const loggedUser = this.authService.getLoggedUser;

    if (!isLoggedIn || !loggedUser) {
      this.router.navigateByUrl('/login');
      return false;
    }

    const userRole = loggedUser.role;
    const routeRoles = route.data?.['roles'] as string[] | undefined;

    this.userAccess = loggedUser.access;

    // Role not allowed at all
    if (!this.ROLES.includes(userRole)) {
      this.router.navigateByUrl('/login');
      return false;
    }

    // Check route-level role permission
    if (routeRoles && !routeRoles.includes(userRole)) {
      this.router.navigateByUrl('/dashboard/unauthorized');
      return false;
    }

    // Check fine-grained permission if route is defined
    const currentUrl = state.url;
    if (this.isUrlInDefinedList(currentUrl)) {
      if (!this.isUserAuthorizedForRoute(currentUrl)) {
        this.router.navigateByUrl('/dashboard/unauthorized');
        return false;
      }
    }

    return true;
  }

  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    return this.canActivate(childRoute, state);
  }

  private isUrlInDefinedList(url: string): boolean {
    return this.definedURLs.some((entry) =>
      this.convertAngularRouteToRegex(entry.URL).test(url)
    );
  }

  private isUserAuthorizedForRoute(currentUrl: string): boolean {
    if (!this.userAccess) return false;

    for (const def of this.definedURLs) {
      const pattern = this.convertAngularRouteToRegex(def.URL);
      if (pattern.test(currentUrl)) {
        return this.userAccess.permissions.some(
          (perm) =>
            perm.module === def.module && perm.actions.includes(def.action)
        );
      }
    }

    return false;
  }

  private convertAngularRouteToRegex(url: string): RegExp {
    // Replace wildcard (*) with regex and handle dynamic segments (like :id)
    const regexString =
      '^' +
      url
        .replace(/:[^\/]+/g, '[^/]+') // replace :param with match-any
        .replace(/\*/g, '[^/]+') +
      '$'; // replace * wildcard
    return new RegExp(regexString);
  }
}
