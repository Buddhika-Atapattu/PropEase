import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { WindowsRefService } from '../../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  AuthService,
  LoggedUserType,
} from '../../../../services/auth/auth.service';
import { APIsService, UsersType } from '../../../../services/APIs/apis.service';

@Component({
  selector: 'app-tenant',
  imports: [CommonModule, RouterModule],
  templateUrl: './tenant.component.html',
  styleUrl: './tenant.component.scss',
})
export class TenantComponent implements OnInit, OnDestroy {
  protected isLoading: boolean = false;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected loggedUser: LoggedUserType | null = null;
  protected users: UsersType[] | null = [];


  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private apiService: APIsService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });

    this.loggedUser = this.authService.getLoggedUser;
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
    await this.getAllUsers();
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  private async getAllUsers() {
    this.isLoading = true;
    await this.apiService
      .getAllUsers()
      .then((res: UsersType[] | null) => {
        
      })
      .catch((err) => {
        console.log(err);
        this.isLoading = false;
      });
  }
}
