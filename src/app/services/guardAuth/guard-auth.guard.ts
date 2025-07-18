import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateChild,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService, ROLE_ACCESS_MAP } from '../auth/auth.service';
import { CryptoService } from '../cryptoService/crypto.service';
import { WindowsRefService } from '../windowRef/windowRef.service';

interface RoleAccessEntry {
  module: string;
  action: string;
  URL: string;
}

@Injectable( {
  providedIn: 'root',
} )
export class AuthGuard implements CanActivate, CanActivateChild {
  private isBrowser: boolean;
  private userAccess: ROLE_ACCESS_MAP | null = null;

  constructor (
    private windowRef: WindowsRefService,
    private authService: AuthService,
    private router: Router,
    private cryptoService: CryptoService,
    @Inject( PLATFORM_ID ) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
  }

  canActivate( route: ActivatedRouteSnapshot, state: RouterStateSnapshot ): boolean {
    const isLoggedIn = this.authService.isUserLoggedIn;
    const loggedUser = this.authService.getLoggedUser;

    if ( !isLoggedIn || !loggedUser ) {
      this.router.navigateByUrl( '/login' );
      return false;
    }

    const userRole = loggedUser.role;
    const routeRoles = route.data?.[ 'roles' ] as string[] | undefined;
    this.userAccess = loggedUser.access;

    // Check if role is valid
    if ( !this.isValidRole( userRole ) ) {
      this.router.navigateByUrl( '/login' );
      return false;
    }

    // Role is not allowed for the route
    if ( routeRoles && !routeRoles.includes( userRole ) ) {
      this.router.navigateByUrl( '/dashboard/unauthorized' );
      return false;
    }

    // Fine-grained permission check
    const currentUrl = state.url;
    if ( !this.hasAccessToRoute( currentUrl ) ) {
      this.router.navigateByUrl( '/dashboard/unauthorized' );
      return false;
    }

    return true;
  }

  canActivateChild( childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot ): boolean {
    return this.canActivate( childRoute, state );
  }

  private isValidRole( role: string ): boolean {
    return [
      'admin',
      'agent',
      'tenant',
      'operator',
      'developer',
      'user',
    ].includes( role );
  }

  private hasAccessToRoute( currentUrl: string ): boolean {
    if ( !this.userAccess || !this.userAccess.permissions ) return true; // allow if not mapped

    for ( const { module, action, URL } of this.definedURLs ) {
      const regex = this.routeToRegex( URL );
      if ( regex.test( currentUrl ) ) {
        const permissionExists = this.userAccess.permissions.some(
          ( perm ) => perm.module === module && perm.actions.includes( action )
        );
        return permissionExists;
      }
    }

    return true; // allow if not defined
  }

  private routeToRegex( route: string ): RegExp {
    const escaped = route.replace( /:[^/]+/g, '[^/]+' ).replace( /\*/g, '[^/]+' );
    return new RegExp( `^${ escaped }$` );
  }

  // Centralized route-permission mapping
  private definedURLs: RoleAccessEntry[] = [
    // User management
    { module: 'User Management', action: 'view', URL: '/dashboard/view-user-profile/*' },
    { module: 'User Management', action: 'create', URL: '/dashboard/add-new-user' },
    { module: 'User Management', action: 'update', URL: '/dashboard/edit-user/*' },
    // Property management
    { module: 'Property Management', action: 'view', URL: '/dashboard/property-view/*' },
    { module: 'Property Management', action: 'create', URL: '/dashboard/property-listing' },
    { module: 'Property Management', action: 'update', URL: '/dashboard/property-edit/*' },
    // Tenant management
    { module: 'Tenant Management', action: 'view tenant profile', URL: '/dashboard/tenant/tenant-view/*' },
    { module: 'Tenant Management', action: 'create lease', URL: '/dashboard/tenant/create-lease' },
    { module: 'Tenant Management', action: 'view lease', URL: '/dashboard/tenant/view-lease/*' },
    { module: 'Tenant Management', action: 'edit tenant details', URL: '/dashboard/tenant/update-lease/*' },

    // Add more from ACCESS_OPTIONS as needed
  ];
}
