import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  EventEmitter,
  Output,
} from '@angular/core';
import { ListMainPanelComponent } from '../../components/list-main-panel/list-main-panel.component';
import { MainPanelComponent } from '../../components/main-panel/main-panel.component';
import { ModeChangerComponent } from '../../components/mode-changer/mode-changer.component';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { TopProgressBarComponent } from '../../components/top-progress-bar/top-progress-bar.component';
import { UserInfoPanelComponent } from '../../components/user-info-panel/user-info-panel.component';
import { WindowsRefService } from '../../../services/windowRef.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ListMainPanelComponent,
    MainPanelComponent,
    ModeChangerComponent,
    TopProgressBarComponent,
    UserInfoPanelComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  protected menuOpen: boolean = false;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    private router: Router
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
        console.log('MainPanel detected mode:', this.mode);
      });
    }
  }

  protected openMenu() {
    this.menuOpen = !this.menuOpen;
  }
}
