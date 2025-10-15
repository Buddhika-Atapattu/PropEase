import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import {WindowsRefService} from '../../services/windowRef/windowRef.service';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {filter, Subscription} from 'rxjs';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';
import {APIsService, MSG_DATA_TYPE, UsersType} from '../../services/APIs/apis.service';
import {MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer} from '@angular/platform-browser';
import {SkeletonLoaderComponent} from '../../components/shared/skeleton-loader/skeleton-loader.component';
import {CryptoService} from '../../services/cryptoService/crypto.service';
import {AuthService, BaseUser} from '../../services/auth/auth.service';
import {PropertyFilterDialogComponent} from '../../components/dialogs/property-filter-dialog/property-filter-dialog.component';
import {MatDialog} from '@angular/material/dialog';
import {ConfirmationComponent} from '../../components/dialogs/confirmation/confirmation.component';
import {NotificationComponent} from '../../components/dialogs/notification/notification.component';
import {HttpErrorResponse, HttpHeaderResponse} from '@angular/common/http';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    SkeletonLoaderComponent,
    NotificationComponent,
    FormsModule
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit, OnDestroy {
  @ViewChild(NotificationComponent) notification!: NotificationComponent;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected loading: boolean = true;

  private routeSub: Subscription | null = null;
  private routerSub: Subscription | null = null;
  protected LOGGED_USER: BaseUser | null = null;
  protected LOGGED_USER_ACCESS_MODULE: string[] = [];
  protected LOGGED_USER_ACCESS_ACTIONS: string[] = [];
  protected isColView: boolean = false;
  protected isListView: boolean = true;

  private users: UsersType[] = [];
  private readonly limit: number = 12;
  protected dispalyingUsers: UsersType[] = [];
  protected displayPaginationNumberArray: number[] = [];
  protected search: string = '';
  protected isNoData: boolean = false;
  protected currentPageIndex: number = 0;



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

  constructor (
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
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.usersDataInit());

    this.routeSub = this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
    await this.usersDataInit();
    Promise.resolve();
  }

  private iconMaker() {
    const iconMap = [
      {name: 'view', path: '/Images/Icons/view.svg'},
      {name: 'edit', path: '/Images/Icons/pencil-square.svg'},
      {name: 'delete', path: '/Images/Icons/delete.svg'},
      {name: 'add-new-user', path: '/Images/Icons/add-new-user.svg'},
      {name: 'search', path: '/Images/Icons/search.svg'},
      {name: 'filter', path: '/Images/Icons/filter.svg'},
      {name: 'list', path: '/Images/Icons/list.svg'},
      {name: 'lineColumns', path: '/Images/Icons/line-columns.svg'},
    ];

    for(let icon of iconMap) {
      this.matIconRegistry.addSvgIcon(
        icon.name.toString(),
        this.domSanitizer.bypassSecurityTrustResourceUrl(icon.path.toString())
      );
    }
  }

  //<============================================================ USERS ORGANIZATION AND PAGINATION ============================================================>
  //<============================================================ INITIAL DATA LOADING ============================================================>
  protected async usersDataInit() {
    try {
      this.loading = true;
      this.resetData();
      const users = await this.APIsService.getAllUsers();
      if(!users) throw new Error("Users not found!");
      const usersWithoutLoggedUser = users.filter(
        (user) => user.username !== this.LOGGED_USER?.username
      );
      this.users = usersWithoutLoggedUser;
      this.makePagination(usersWithoutLoggedUser, 0)
    }
    catch(error) {
      console.log(error);
      if(error instanceof HttpErrorResponse) {
        if(error.status >= 400 && error.status <= 500) {
          this.notification.notification("error", error.error.message);
        }
        else {
          this.notification.notification("error", "Something went wrong");
        }
      }
    }
    finally {
      setTimeout(() => {
        this.loading = false;
      }, 500);
    }
  }
  //<============================================================ END INITIAL DATA LOADING ============================================================>


  //<============================================================ USER SEARCH ============================================================>
  protected async searchUsers(input: string) {
    try {
      this.loading = true;
      const safeInput = input.trim().toLowerCase();
      if(!safeInput) {
        this.usersDataInit();
        return;
      }
      if(!this.users) throw new Error("Users not found!");
      const usersWithoutLoggedUser = this.users.filter(
        (user) => user.username !== this.LOGGED_USER?.username
      );
      const filteredUsers = usersWithoutLoggedUser.filter((user) =>
        user.name.toLowerCase().includes(safeInput.toLowerCase()) ||
        user.username.toLowerCase().includes(safeInput.toLowerCase()) ||
        user.email.toLowerCase().includes(safeInput.toLowerCase())
      )
      this.makePagination(filteredUsers, 0)
    }
    catch(error) {
      console.log(error);
      if(error instanceof HttpErrorResponse) {
        if(error.status >= 400 && error.status <= 500) {
          this.notification.notification("error", error.error.message);
        }
        else {
          this.notification.notification("error", "Something went wrong");
        }
      }
    }
    finally {
      setTimeout(() => {
        this.loading = false;
      }, 500);
    }
  }
  //<============================================================ END USER SEARCH ============================================================>

  //<============================================================ PAGE INDEX OPERATION ============================================================>
  protected async changePage(number: number): Promise<void> {
    try {
      this.loading = true;

      if(!this.users) throw new Error("Users not found!");

      const usersWithoutLoggedUser = this.users.filter(
        user => user.username !== this.LOGGED_USER?.username
      );

      const safeIndex = number - 1;
      console.log(safeIndex)

      this.makePagination(usersWithoutLoggedUser, safeIndex)

    } catch(error) {
      console.log(error);
      if(error instanceof HttpErrorResponse) {
        if(error.status >= 400 && error.status <= 500) {
          this.notification.notification("error", error.error.message);
        } else {
          this.notification.notification("error", "Something went wrong");
        }
      }
    } finally {
      setTimeout(() => {
        this.loading = false;
      }, 500);
    }
  }
  //<============================================================ END PAGE INDEX OPERATION ============================================================>

  //<============================================================ PAGE INDEX THREE PAGES BACKWORD ============================================================>
  protected async previousPage(): Promise<void> {
    if(this.currentPageIndex > 0) {
      this.currentPageIndex = Math.max(0, this.currentPageIndex - 3);
      this.makePagination(this.users.filter(u => u.username !== this.LOGGED_USER?.username), this.currentPageIndex);
    }
  }
  //<============================================================ END PAGE INDEX THREE PAGES BACKWORD ============================================================>

  //<============================================================ PAGE INDEX THREE PAGES FORWARD ============================================================>
  protected async nextPage(): Promise<void> {
    const usersWithoutLoggedUser = this.users.filter(u => u.username !== this.LOGGED_USER?.username);
    const totalPages = Math.ceil(usersWithoutLoggedUser.length / this.limit);

    if(this.currentPageIndex < totalPages - 1) {
      this.currentPageIndex = Math.min(totalPages - 1, this.currentPageIndex + 3);
      this.makePagination(usersWithoutLoggedUser, this.currentPageIndex);
    }
  }
  //<============================================================ END PAGE INDEX THREE PAGES FORWARD ============================================================>


  //<============================================================ RESET USERS VALUES ============================================================>
  private resetData() {
    this.displayPaginationNumberArray = [];
    this.users = [];
    this.dispalyingUsers = [];
    this.isNoData = false;
  }
  //<============================================================ END RESET USERS VALUES ============================================================>

  //<============================================================ MAKE PAGINATION ============================================================>
  private makePagination(dataArray: UsersType[], index: number): void {
    const totalDataCount = dataArray.length;
    const totalPageCount = Math.ceil(totalDataCount / this.limit);

    this.currentPageIndex = index;

    this.isNoData = totalDataCount === 0;

    // Calculate actual data slice range
    const startIndex = index * this.limit;
    const endIndex = startIndex + this.limit;

    // Slice data for current page
    this.dispalyingUsers = dataArray.slice(startIndex, endIndex);

    // Create pagination page number array (1-based)
    this.displayPaginationNumberArray = this.makeNumberArray(index, totalPageCount);
  }
  //<============================================================ END MAKE PAGINATION ============================================================>

  //<============================================================ PREPAIRE PAGINATION NUMBER ARRAY ============================================================>
  private makeNumberArray(currentPage: number, totalPages: number): number[] {
    const current = currentPage + 1; // Convert to 1-based
    const start = Math.max(1, current - 2);
    const end = Math.min(totalPages, current + 2);

    return Array.from({length: end - start + 1}, (_, i) => i + start);
  }
  //<============================================================ END PREPAIRE PAGINATION NUMBER ARRAY ============================================================>

  //<============================================================ END USERS ORGANIZATION AND PAGINATION ============================================================>



  protected isThisLoggedUserProfile(username: string): boolean {
    return this.LOGGED_USER?.username === username;
  }



  // Logged user actions

  //Create user
  protected createUserAvailable(): boolean {
    if(!this.LOGGED_USER) return false;
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
    if(!this.LOGGED_USER) return false;
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
    if(!this.LOGGED_USER) return false;
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
    if(!this.LOGGED_USER) return false;
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
    if(style === 'grid') {
      this.isColView = true;
      this.isListView = false;
    } else {
      this.isListView = true;
      this.isColView = false;
    }
  }

  protected detectUserImage(image: string, gender: string): string {
    if(typeof image === 'string') {
      const imageArray: string[] = image ? image.split('/') : [];
      if(imageArray.length > 0) {
        if(
          this.definedImageExtentionArray.includes(
            imageArray[imageArray.length - 1].split('.')[1]
          )
        ) {
          this.definedImage = image;
        } else {
          if(gender.toLowerCase() === 'male') {
            this.definedImage = this.definedMaleDummyImageURL;
          } else if(gender.toLowerCase() === 'female') {
            this.definedImage = this.definedWomanDummyImageURL;
          } else {
            this.definedImage = this.definedMaleDummyImageURL;
          }
        }
      }
    }
    return this.definedImage;
  }

  protected addUser() {
    this.router.navigate(['/dashboard/add-new-user']);
  }

  protected async viewUser(data: string) {
    if(this.isBrowser && data !== '') {
      const username = await this.APIsService.generateToken(data);
      this.router.navigate(['/dashboard/view-user-profile', username.token]);
    }
  }

  protected async editUser(data: string) {
    if(this.isBrowser && data !== '') {
      const username = await this.APIsService.generateToken(data);
      this.router.navigate(['/dashboard/edit-user', username.token]);
    }
  }

  protected deleteUser(username: string, name: string) {
    try {
      if(!username) throw new Error('Username cannot be empty!');
      if(!name) throw new Error('Name cannot be empty!');
      const dialogRef = this.dialog.open(ConfirmationComponent, {
        width: 'auto',
        height: 'auto',
        data: {
          title: `Delete ${name}`,
          message: `Are you sure you want to delete ${name}?`,
          isConfirm: true,
        },
      });

      dialogRef.afterClosed().subscribe(async (result) => {
        try {
          if(!result?.isConfirm) return;
          if(!this.LOGGED_USER) throw new Error("User must logged into the system");
          await this.APIsService.deleteUserByUsername(username, this.LOGGED_USER?.username)
            .then((res) => {
              this.notification.notification(res.status, res.message);
              this.usersDataInit();
            })
            .catch((err: HttpErrorResponse) => {
              this.notification.notification(err.error.error, err.error.message);
            })
        }
        catch(err) {
          this.notification.notification('error', err as string);
        }
      });
    }
    catch(error) {
      this.notification.notification('error', error as string);
    }



  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }
}
