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
  private ROLE_ACCESS: RoleAccess[] = [
    { role: 'admin', access: true, URLs: ['**'] },
    { role: 'agent', access: true, URLs: ['/dashboard/home'] },
    { role: 'tenant', access: true, URLs: ['/dashboard/home'] },
    {
      role: 'operator',
      access: true,
      URLs: ['/dashboard/home', '/dashboard/user-profile'],
    },
    { role: 'developer', access: true, URLs: ['/dashboard'] },
    { role: 'user', access: true, URLs: ['/dashboard/home'] },
  ];

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
    const userRole = loggedUser.role.role;

    if (!this.ROLES.includes(userRole)) {
      this.router.navigateByUrl('/login');
      return false;
    }

    const accessEntry = this.ROLE_ACCESS.find((r) => r.role === userRole);
    if (!accessEntry || !accessEntry.access) {
      this.router.navigateByUrl('/unauthorized');
      return false;
    }
    if (accessEntry.URLs.includes('**')) {
      return true;
    }
    const isAllowed = accessEntry.URLs.some((path) =>
      currentPath.startsWith(path)
    );
    if (!isAllowed) {
      this.router.navigateByUrl('/unauthorized');
      return false;
    }
    return true;
  }
}
