import {
  Component,
  Inject,
  Input,
  PLATFORM_ID,
  OnInit,
  OnChanges,
  SimpleChanges,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { AuthService, BaseUser } from '../../../../services/auth/auth.service';
import { WindowsRefService } from '../../../../services/windowRef.service';

import { LoggedDataComponent } from '../components/logged-data/logged-data.component';
import { UserFileManagementComponent } from '../components/user-file-management/user-file-management.component';
import { UserCreatinonManagementComponent } from '../components/user-creatinon-management/user-creatinon-management.component';

@Component({
  selector: 'app-activities',
  standalone: true,
  imports: [
    CommonModule,
    LoggedDataComponent,
    UserFileManagementComponent,
    UserCreatinonManagementComponent,
  ],
  templateUrl: './activities.component.html',
  styleUrl: './activities.component.scss',
})
export class ActivitiesComponent implements OnInit, OnChanges, AfterViewInit {
  @ViewChild(LoggedDataComponent, { static: true })
  loggedData!: LoggedDataComponent;

  @ViewChild(UserFileManagementComponent, { static: true })
  userFileManagement!: UserFileManagementComponent;

  @ViewChild(UserCreatinonManagementComponent, { static: true })
  userCreationManagement!: UserCreatinonManagementComponent;

  @Input() user: BaseUser | null = null;

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  protected username: string = '';
  protected loggedUser: BaseUser | null = null;

  private modeSub: Subscription | null = null;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.loggedUser = this.authService.getLoggedUser;
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }

    // Initial username setup if available early
    if (this.user) {
      this.username = this.user.username;
    }
  }

  ngAfterViewInit(): void {
    // Ensure refresh is called after view is initialized (for ViewChild access)
    if (this.user) {
      setTimeout(() => {
        this.refresh(this.user!.username);
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && this.user) {
      this.refresh(this.user.username);
    }
  }

  // 🔁 Called when parent changes user or manually needs refresh
  public refresh(username: string): void {
    this.username = username;

    if (this.loggedData) {
      this.loggedData.refresh(this.username);
    }
    if (this.userFileManagement) {
      this.userFileManagement.refresh(this.username);
    }
    if (this.userCreationManagement) {
      this.userCreationManagement.refresh(this.username);
    }
  }
}
