// auth.guard.ts
import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | Observable<boolean> | Promise<boolean> {
    const isLoggedIn = this.authService.isUserLoggedIn();
    const loggedUser = this.authService.getLoggedUser;
    const allowedRoles = route.data['roles'] as string[] | undefined;

    // Not logged in? Redirect to login
    if (!isLoggedIn || !loggedUser) {
      this.router.navigateByUrl('/login');
      return false;
    }

    // Admin has full access regardless of route roles
    if (loggedUser.role.role === 'admin') {
      return true;
    }

    // Check allowed roles if provided
    if (
      allowedRoles &&
      allowedRoles.length > 0 &&
      !allowedRoles.includes(loggedUser.role.role)
    ) {
      // this.router.navigateByUrl('/unauthorized');
      // return false;
    }

    return true;
  }
}
