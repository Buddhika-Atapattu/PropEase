import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { WindowsRefService } from '../services/windowRef.service';
import { Subscription } from 'rxjs';
import { ModeChangerComponent } from './components/mode-changer/mode-changer.component';
import { LoginComponent } from './pages/login/login.component';
import { AuthService, UserCredentials } from '../services/auth/auth.service';
import { Router } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { TopProgressBarComponent } from "./components/top-progress-bar/top-progress-bar.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ModeChangerComponent,
    LoginComponent,
    DashboardComponent,
    TopProgressBarComponent
],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  constructor(
    private windowRef: WindowsRefService,
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.windowRef.initTheme();
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });

      const user = this.authService.getUser();
      const isValidUser =
        user?.username === this.authService.getDefinedUser.username &&
        user?.password === this.authService.getDefinedUser.password;

      console.log('isValidUser:', isValidUser);

      if (user && isValidUser) {
        this.authService.setCredentials(user);
        this.router.navigate(['/dashboard']);
        console.log(user);
      } else {
        this.authService.clearCredentials();
        this.router.navigate(['/login']);
      }
    }
  }

  get isUserLoggedIn(): boolean {
    return this.authService.isUserLoggedIn();
  }

  get getUser(): UserCredentials | null {
    return this.authService.getUser();
  }

  protected goToTheDashboard(): void {
    if (this.isUserLoggedIn) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }
}
