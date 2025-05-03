import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { ListMainPanelComponent } from '../../components/list-main-panel/list-main-panel.component';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TopProgressBarComponent } from '../../components/top-progress-bar/top-progress-bar.component';
import { ModeChangerComponent } from '../../components/mode-changer/mode-changer.component';
import { UserInfoPanelComponent } from '../../components/user-info-panel/user-info-panel.component';
import { WindowsRefService } from '../../../services/windowRef.service';
import { ExpandableService } from '../../../services/expandable/expandable.service';
import {
  AuthService,
  NewUser,
  LoggedUserType,
} from '../../../services/auth/auth.service';
import { Subscription } from 'rxjs';
import { SkeletonLoaderComponent } from '../../components/shared/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ListMainPanelComponent,
    RouterModule,
    ModeChangerComponent,
    TopProgressBarComponent,
    UserInfoPanelComponent,
    SkeletonLoaderComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  protected menuOpen: boolean = false;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  protected isExpanded: boolean = true;
  private modeSub: Subscription | null = null;
  private expandSub: Subscription | null = null;
  protected user: LoggedUserType | null = null;

  constructor(
    private windowRef: WindowsRefService,
    private authService: AuthService,
    private expandableService: ExpandableService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.authService.getLoggedUser !== null) {
      this.user = this.authService.getLoggedUser;
    }
  }

  async ngOnInit() {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });

      this.expandSub = this.expandableService.isExpanded$.subscribe(
        (expanded) => {
          this.isExpanded = expanded;
        }
      );
    }
    const role = this.authService.getLoggedUser?.role.role;
    if (role && this.isBrowser) {
      await this.authService.sendUserCredentialsAndGetUserData(role);
      await this.authService.afterUserLoggedInOperatios();
    }
  }

  protected openMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.expandSub?.unsubscribe();
  }
}
