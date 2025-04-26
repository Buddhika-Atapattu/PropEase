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
import { AuthService, UserCredentials } from '../services/auth/auth.service';

import { ModeChangerComponent } from './components/mode-changer/mode-changer.component';
import { TopProgressBarComponent } from './components/top-progress-bar/top-progress-bar.component';
import { RouterModule } from '@angular/router';

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
  title = 'PropEase';
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  private navEndSub: Subscription | null = null;

  constructor(
    private windowRef: WindowsRefService,
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdRef: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.windowRef.initTheme();

      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });

      // Wait for the router to fully resolve the path
      this.navEndSub = this.router.events
        .pipe(filter((e) => e instanceof NavigationEnd))
        .subscribe((event: any) => {
          const path = event.url;
          const user = this.authService.getUser();
          const isValidUser =
            user?.username === this.authService.getDefinedUser.username &&
            user?.password === this.authService.getDefinedUser.password;

          console.log('NavigationEnd -> Path:', path);
          console.log('User Valid:', isValidUser);

          // const safePaths = ['/', '/login'];

          // if (safePaths.includes(path)) {
          //   if (user && isValidUser) {
          //     this.authService.setCredentials(user);
          //     this.router.navigate(['/dashboard']);
          //   } else {
          //     this.authService.clearCredentials();
          //     this.router.navigate(['/login']);
          //   }
          // }

          // if (user && isValidUser) {
          //   this.authService.setCredentials(user);
          //   this.router.navigate(['/dashboard']);
          // } else {
          //   this.authService.clearCredentials();
          //   this.router.navigate(['/login']);
          // }

          // If it's a valid path like `/dashboard`, `/properties`, do nothing
          // If it's an invalid path like `/abcxyz`, Angular will now properly load 404
        });
    }
  }

  ngAfterViewInit() {
    this.cdRef.detectChanges();
  }

  get isUserLoggedIn(): boolean {
    return this.authService.isUserLoggedIn();
  }

  get getUser(): UserCredentials | null {
    return this.authService.getUser();
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.navEndSub?.unsubscribe();
  }
}
