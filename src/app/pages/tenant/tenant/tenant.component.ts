import {CommonModule, isPlatformBrowser} from '@angular/common';
import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';
import {Subscription} from 'rxjs';
import {User} from '../../../services/APIs/apis.service';
import {
  AuthService,
} from '../../../services/auth/auth.service';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';

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
  protected loggedUser: User | null = null;
  protected users: User[] | null = [];


  constructor (
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });

    this.loggedUser = this.authService.getLoggedUser;
  }

  async ngOnInit(): Promise<void> {
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }
}
