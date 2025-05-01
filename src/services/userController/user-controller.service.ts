import { Injectable } from '@angular/core';
import { Router, NavigationStart, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class UrlControllerService {
  private readonly ROLE_ACCESS: Record<string, string[]> = {
    admin: ['**'], // all access
    agent: ['/login', '/dashboard/home'],
    tenant: ['/login', '/dashboard/home'],
    operator: ['/login', '/dashboard/home', '/dashboard/user-profile'],
    developer: ['/login', '/dashboard/home'],
    user: ['/login', '/dashboard/home'],
  };

  constructor(private router: Router, private authService: AuthService) {
    this.observeNavigation();
  }

  private observeNavigation() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationStart))
      .subscribe((event) => {
        const nav = event as NavigationStart;
        const url = nav.url;

        const user = this.authService.getLoggedUser;

        if (!user || !user.role?.role) {
          if (url !== '/login') {
            this.router.navigateByUrl('/login');
          }
          return;
        }

        const allowedPaths = this.ROLE_ACCESS[user.role.role] || [];

        const isAuthorized = allowedPaths.some(
          (path) => path === '**' || url.startsWith(path)
        );

        if (!isAuthorized) {
          if (url !== '/dashboard/unauthorized') {
            this.router.navigateByUrl('/dashboard/unauthorized');
          }
        }
      });
  }
}
