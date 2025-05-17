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
import { ActivityTrackerService } from '../../../services/activityTacker/activity-tracker.service';

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
  protected isLoading: boolean = true;

  constructor(
    private windowRef: WindowsRefService,
    private authService: AuthService,
    private expandableService: ExpandableService,
    private router: Router,
    private activityTrackerService: ActivityTrackerService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.authService.getLoggedUser !== null) {
      setInterval(() => {
        this.isLoading = false;
      }, 500);
      this.user = this.authService.getLoggedUser;
    }
    if (typeof this.user?.image === 'string') {
      const imageURL = this.user.image.split('.');
      if (imageURL[1] === undefined) {
        this.user.image = '/Images/user-images/dummy-user/dummy-user.jpg';
      } else {
        this.user.image = this.user.image;
      }
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
    const role = this.authService.getLoggedUser?.role;
    if (role && this.isBrowser) {
      await this.authService.sendUserCredentialsAndGetUserData(role);
      await this.authService.afterUserLoggedInOperatios();
    }
    // await this.insertLoggedUserTracks();
  }

  protected openMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  // protected async insertLoggedUserTracks() {
  //   const date = new Date();
  //   this.activityTrackerService.userLoggedTime = date;

  //   const data = {
  //     username: this.user?.username,
  //     date: date,
  //   };
  //   await this.activityTrackerService
  //     .saveLoggedUserDataToTracking(data)
  //     .then((data) => {
  //       console.log(data);
  //     })
  //     .catch((error) => {
  //       if (error) {
  //         console.log('Error: ', error);
  //       }
  //     });
  // }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.expandSub?.unsubscribe();
  }
}
