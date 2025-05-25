import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { WindowsRefService } from '../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { filter, Subscription } from 'rxjs';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { APIsService, UsersType } from '../../../services/APIs/apis.service';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { SkeletonLoaderComponent } from '../../components/shared/skeleton-loader/skeleton-loader.component';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import { AuthService, BaseUser } from '../../../services/auth/auth.service';
import { PropertyFilterDialogComponent } from '../../components/dialogs/property-filter-dialog/property-filter-dialog.component';

@Component({
  selector: 'app-users',
  imports: [CommonModule, MatIconModule, SkeletonLoaderComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit, OnDestroy {
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected users: UsersType[] = [];
  protected pageCount: number = 0;
  protected currentPage: number = 0;
  protected search: string = '';
  protected loading: boolean = true;
  private routeSub: Subscription | null = null;
  private routerSub: Subscription | null = null;
  protected LOGGED_USER: BaseUser | null = null;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private APIsService: APIsService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private crypto: CryptoService
  ) {
    this.LOGGED_USER = this.authService.getLoggedUser;
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.iconMaker();
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.init());

    this.routeSub = this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
    await this.init();
    Promise.resolve();
  }

  protected async init() {
    const usersArray = await this.APIsService.getAllUsersWithPagination(
      0,
      10,
      this.search
    )
      .then((data) => {
        this.loading = true;
        return data;
      })
      .finally(() => {
        setInterval(() => {
          this.loading = false;
        }, 500);
      });
    if (usersArray) {
      this.users = usersArray.data;
      this.pageCount = Math.round(usersArray.count / 10) + 1;
    }
  }

  private iconMaker() {
    const iconMap = [
      { name: 'view', path: '/Images/Icons/view.svg' },
      { name: 'edit', path: '/Images/Icons/pencil-square.svg' },
      { name: 'delete', path: '/Images/Icons/delete.svg' },
      { name: 'add-new-user', path: '/Images/Icons/add-new-user.svg' },
      { name: 'search', path: '/Images/Icons/search.svg' },
      { name: 'filter', path: '/Images/Icons/filter.svg' },
    ];

    for (let icon of iconMap) {
      this.matIconRegistry.addSvgIcon(
        icon.name.toString(),
        this.domSanitizer.bypassSecurityTrustResourceUrl(icon.path.toString())
      );
    }
  }

  protected async searchUsers(event: Event) {
    this.search = (event.target as HTMLInputElement).value;
    const usersArray = await this.APIsService.getAllUsersWithPagination(
      0,
      10,
      this.search
    )
      .then((data) => {
        this.loading = true;
        return data;
      })
      .finally(() => {
        setInterval(() => {
          this.loading = false;
        }, 500);
      });
    if (usersArray) {
      this.users = usersArray.data;
      this.pageCount = Math.round(usersArray.count / 10) + 1;
      this.currentPage = 0;
    }
  }

  protected async changePage(number: number) {
    const usersArray = await this.APIsService.getAllUsersWithPagination(
      number,
      10,
      this.search
    )
      .then((data) => {
        this.loading = true;
        return data;
      })
      .finally(() => {
        setTimeout(() => {
          this.loading = false;
        }, 500);
      });
    if (usersArray) {
      this.users = usersArray.data;
      this.pageCount = Math.round(usersArray.count / 10) + 1;
      this.currentPage = number;
    }
  }

  protected async previousPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      await this.changePage(this.currentPage);
    }
  }

  protected async nextPage() {
    if (this.currentPage < this.pageCount - 1) {
      this.currentPage++;
      await this.changePage(this.currentPage);
    }
  }

  protected addUser() {
    this.router.navigate(['/dashboard/add-new-user']);
  }

  protected async viewUser(data: string) {
    if (this.isBrowser) {
      if (data !== '' && this.crypto) {
        const username = await this.APIsService.generateToken(data);
        this.router.navigate(['/dashboard/view-user-profile', username.token]);
      }
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }
}
