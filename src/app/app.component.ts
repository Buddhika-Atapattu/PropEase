import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ChangeDetectorRef,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { WindowsRefService } from '../services/windowRef.service';
import { Subscription, filter } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import {
  AuthService,
  NewUser,
  LoggedUserType,
  UserCredentials,
} from '../services/auth/auth.service';

import { ModeChangerComponent } from './components/mode-changer/mode-changer.component';
import { TopProgressBarComponent } from './components/top-progress-bar/top-progress-bar.component';
import { RouterModule } from '@angular/router';
import { UrlControllerService } from '../services/userController/user-controller.service';
// import { CheckInternetStatusComponent } from "./components/check-internet-status/check-internet-status.component";
// CheckInternetStatusComponent
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ModeChangerComponent,
    TopProgressBarComponent,
    RouterModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'propease-fontend';
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  private navEndSub: Subscription | null = null;
  private lastURL: string | null = null;
  private loggedUser: LoggedUserType | null = null;
  private userLoggedIn: boolean = false;

  constructor(
    private windowRef: WindowsRefService,
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdRef: ChangeDetectorRef,
    private urlController: UrlControllerService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
    }
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.windowRef.initTheme();
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
      const isUserLoggedIn = localStorage.getItem('IS_USER_LOGGED_IN');
      if (
        (this.authService.getIsValidUser &&
          this.authService.getLoggedUser !== null &&
          this.authService.IsActiveUser) ||
        (isUserLoggedIn && isUserLoggedIn === 'true')
      ) {
        window.addEventListener('beforeunload', () => {
          localStorage.setItem('LAST_URL', this.router.url);
        });

        this.lastURL = localStorage.getItem('LAST_URL');
        if (this.lastURL) {
          this.router.navigateByUrl(this.lastURL);
        }
      }
    }
  }

  ngAfterViewInit() {
    this.cdRef.detectChanges();
  }

  get isUserLoggedIn(): boolean {
    return this.authService.isUserLoggedIn;
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.navEndSub?.unsubscribe();
  }
}
