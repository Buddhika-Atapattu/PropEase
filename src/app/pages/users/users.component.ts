import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { WindowsRefService } from '../../services/windowRef/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { filter, Subscription } from 'rxjs';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { APIsService, UsersType } from '../../services/APIs/apis.service';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { SkeletonLoaderComponent } from '../../components/shared/skeleton-loader/skeleton-loader.component';
import { CryptoService } from '../../services/cryptoService/crypto.service';
import { AuthService, BaseUser } from '../../services/auth/auth.service';
import { PropertyFilterDialogComponent } from '../../components/dialogs/property-filter-dialog/property-filter-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationComponent } from '../../components/dialogs/confirmation/confirmation.component';
import { NotificationComponent } from '../../components/dialogs/notification/notification.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    SkeletonLoaderComponent,
    NotificationComponent,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit, OnDestroy {
  @ViewChild(NotificationComponent) notification!: NotificationComponent;
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
  protected LOGGED_USER_ACCESS_MODULE: string[] = [];
  protected LOGGED_USER_ACCESS_ACTIONS: string[] = [];
  protected isColView: boolean = false;
  protected isListView: boolean = true;

  protected readonly definedMaleDummyImageURL =
    '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL =
    '/Images/user-images/dummy-user/dummy_woman.jpg';
  protected definedImage: string =
    '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedImageExtentionArray: string[] = [
    'jpg',
    'webp',
    'jpeg',
    'png',
    'ico',
    'gif',
  ];

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private APIsService: APIsService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private crypto: CryptoService,
    private dialog: MatDialog
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
      const users = [];
      for (let user of usersArray.data) {
        if(user.username !== this.LOGGED_USER?.username){
          users.push(user);
        }
      }
      this.users = users;
      this.pageCount = Math.round((usersArray.count - 1) / 12) + 1;
    }
  }

  protected isThisLoggedUserProfile(username: string): boolean {
    return this.LOGGED_USER?.username === username;
  }

  private iconMaker() {
    const iconMap = [
      { name: 'view', path: '/Images/Icons/view.svg' },
      { name: 'edit', path: '/Images/Icons/pencil-square.svg' },
      { name: 'delete', path: '/Images/Icons/delete.svg' },
      { name: 'add-new-user', path: '/Images/Icons/add-new-user.svg' },
      { name: 'search', path: '/Images/Icons/search.svg' },
      { name: 'filter', path: '/Images/Icons/filter.svg' },
      { name: 'list', path: '/Images/Icons/list.svg' },
      { name: 'lineColumns', path: '/Images/Icons/line-columns.svg' },
    ];

    for (let icon of iconMap) {
      this.matIconRegistry.addSvgIcon(
        icon.name.toString(),
        this.domSanitizer.bypassSecurityTrustResourceUrl(icon.path.toString())
      );
    }
  }

  // Logged user actions

  //Create user
  protected createUserAvailable(): boolean {
    if (!this.LOGGED_USER) return false;
    return (
      this.LOGGED_USER?.access.permissions.some(
        (permission) =>
          permission.module === 'User Management' &&
          permission.actions.includes('create')
      ) ?? false
    );
  }

  // View user
  protected viewUserAvailable(): boolean {
    if (!this.LOGGED_USER) return false;
    return (
      this.LOGGED_USER?.access.permissions.some(
        (permission) =>
          permission.module === 'User Management' &&
          permission.actions.includes('view')
      ) ?? false
    );
  }

  // View user
  protected updateUserAvailable(): boolean {
    if (!this.LOGGED_USER) return false;
    return (
      this.LOGGED_USER?.access.permissions.some(
        (permission) =>
          permission.module === 'User Management' &&
          permission.actions.includes('update')
      ) ?? false
    );
  }

  // Delete user
  protected deleteUserAvailable(): boolean {
    if (!this.LOGGED_USER) return false;
    return (
      this.LOGGED_USER?.access.permissions.some(
        (permission) =>
          permission.module === 'User Management' &&
          permission.actions.includes('delete')
      ) ?? false
    );
  }

  // End logged user actions

  protected convertTheViewStyle(style: string) {
    if (style === 'grid') {
      this.isColView = true;
      this.isListView = false;
    } else {
      this.isListView = true;
      this.isColView = false;
    }
  }

  protected detectUserImage(image: string, gender: string): string {
    if (typeof image === 'string') {
      const imageArray: string[] = image ? image.split('/') : [];
      if (imageArray.length > 0) {
        if (
          this.definedImageExtentionArray.includes(
            imageArray[imageArray.length - 1].split('.')[1]
          )
        ) {
          this.definedImage = image;
        } else {
          if (gender.toLowerCase() === 'male') {
            this.definedImage = this.definedMaleDummyImageURL;
          } else if (gender.toLowerCase() === 'female') {
            this.definedImage = this.definedWomanDummyImageURL;
          } else {
            this.definedImage = this.definedMaleDummyImageURL;
          }
        }
      }
    }
    return this.definedImage;
  }

  protected async searchUsers(event: Event) {
    this.search = (event.target as HTMLInputElement).value;
    const usersArray = await this.APIsService.getAllUsersWithPagination(
      0,
      12,
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
    if (this.isBrowser && data !== '') {
      const username = await this.APIsService.generateToken(data);
      this.router.navigate(['/dashboard/view-user-profile', username.token]);
    }
  }

  protected async editUser(data: string) {
    if (this.isBrowser && data !== '') {
      const username = await this.APIsService.generateToken(data);
      this.router.navigate(['/dashboard/edit-user', username.token]);
    }
  }

  protected deleteUser(username: string, name: string) {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: 'auto',
      height: 'auto',
      data: {
        title: `Delete ${name}`,
        message: `Are you sure you want to delete ${name}?`,
        confirmText: true,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result?.confirmText === true) {
        await this.APIsService.deleteUserByUsername(username)
          .then((res) => {
            if (res) {
              this.notification.notification(res.status, res.message);
              setTimeout(() => {
                this.init();
              }, 500);
            }
          })
          .catch((res) => {
            if (res) {
              this.notification.notification(res.status, res.message);
            }
          });
      }
    });
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }
}
