import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { AuthService, NewUser, LoggedUserType } from '../auth/auth.service';
import { isPlatformBrowser } from '@angular/common';
import { WindowsRefService } from '../windowRef.service';
import { CryptoService } from '../cryptoService/crypto.service';

interface RoleAccess {
  role: 'admin' | 'agent' | 'tenant' | 'operator' | 'developer' | 'user';
  access: boolean;
  URLs: string[];
}

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private isBrowser: boolean;
  private user: LoggedUserType | null = null;

  private ROLES: string[] = [
    'admin',
    'agent',
    'tenant',
    'operator',
    'developer',
    'user',
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
    let isLoggedIn = this.authService.isUserLoggedIn;
    let loggedUser = this.authService.getLoggedUser;

    if (!isLoggedIn || !loggedUser) {
      this.router.navigateByUrl('/login');
      return false;
    }

    const currentPath = state.url;
    const userRole = loggedUser.role;

    if (!this.ROLES.includes(userRole)) {
      this.router.navigateByUrl('/login');
      return false;
    }

    return true;
  }
}
