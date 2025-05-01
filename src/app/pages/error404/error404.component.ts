import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { WindowsRefService } from '../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import {
  AuthService,
  UserCredentials,
} from '../../../services/auth/auth.service';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error404.component.html',
  styleUrl: './error404.component.scss',
})
export class Error404Component {
  public mode: boolean | null = null;
  protected isUnauthorized: boolean = false;
  isBrowser: boolean;

  constructor(
    private router: Router,
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
    if (this.router.url.split('/')[2] === 'unauthorized') {
      this.isUnauthorized = true;
    }
  }

  get userLogIn(): boolean {
    return this.authService.isUserLoggedIn();
  }

  goHome(): void {
    if (this.authService.isUserLoggedIn()) {
      this.router.navigate(['/dashboard/home']);
    } else {
      this.authService.clearCredentials();
      this.router.navigate(['/']);
    }
  }
}
