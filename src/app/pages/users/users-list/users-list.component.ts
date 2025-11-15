import {CommonModule, isPlatformBrowser} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  type ElementRef,
} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatDialog} from '@angular/material/dialog';
import {MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {DomSanitizer} from '@angular/platform-browser';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';
import {filter, Subscription} from 'rxjs';
import {NotificationDialogComponent} from '../../../components/dialogs/notification/notification.component';
import {LayoutSwitchBtn} from '../../../components/shared/buttons/layout-switch-btn/layout-switch-btn';
import {ConfirmationComponent} from '../../../components/shared/confirmation/confirmation.component';
import {UserViewCardComponent} from '../../../components/user-view-card/user-view-card.component';
import {APIsService, type User} from '../../../services/APIs/apis.service';
import {AuthService} from '../../../services/auth/auth.service';
import {CryptoService} from '../../../services/cryptoService/crypto.service';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    NotificationDialogComponent,
    FormsModule,
    UserViewCardComponent,
    LayoutSwitchBtn,
    MatTooltipModule
  ],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss',
})
export class UsersListComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(NotificationDialogComponent) notification!: NotificationDialogComponent;
  @ViewChild('searchInput', {static: true}) searchInput!: ElementRef<HTMLInputElement>
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected loading: boolean = true;

  private routeSub: Subscription | null = null;
  private routerSub: Subscription | null = null;
  protected LOGGED_USER: User | null = null;
  protected LOGGED_USER_ACCESS_MODULE: string[] = [];
  protected LOGGED_USER_ACCESS_ACTIONS: string[] = [];
  protected viewMode: boolean = false;

  private users: User[] = [];
  private readonly limit: number = 12;
  protected displayingUsers: User[] = [];
  protected displayPaginationNumberArray: number[] = [];
  protected search: string = '';
  protected isNoData: boolean = false;
  protected currentPageIndex: number = 0;

  // Pagination
  private itemsPerPage !: number;



  protected readonly definedMaleDummyImageURL =
    'Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL =
    'Images/user-images/dummy-user/dummy_woman.jpg';
  protected definedImage: string =
    'Images/user-images/dummy-user/dummy-user.jpg';
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

      this.windowRef.windowWidth$.subscribe((val) => {
        if(val <= 599.99) {
          this.itemsPerPage = 6;
        }
        else if(val >= 600 && val <= 1199.98) {
          this.itemsPerPage = 10;
        }
        else if(val >= 1200 && val <= 1999.98) {
          this.itemsPerPage = 12;
        }
        else {
          this.itemsPerPage = 20;
        }
      })
    }
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.usersDataInit());

    this.routeSub = this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
    await this.usersDataInit();
  }

  ngAfterViewInit(): void {

  }

  private iconMaker() {
    const iconMap = [
      {name: 'view', path: 'Images/Icons/view.svg'},
      {name: 'edit', path: 'Images/Icons/pencil-square.svg'},
      {name: 'delete', path: 'Images/Icons/delete.svg'},
      {name: 'add-new-user', path: 'Images/Icons/add-new-user.svg'},
      {name: 'search', path: 'Images/Icons/search.svg'},
      {name: 'filter', path: 'Images/Icons/filter.svg'},
      {name: 'list', path: 'Images/Icons/list.svg'},
      {name: 'lineColumns', path: 'Images/Icons/line-columns.svg'},
    ];

    for(let icon of iconMap) {
      this.matIconRegistry.addSvgIcon(
        icon.name.toString(),
        this.domSanitizer.bypassSecurityTrustResourceUrl(icon.path.toString())
      );
    }
  }

  protected changeLayout(value: boolean): void {
    try {
      if(typeof value !== 'boolean') throw new Error('Only Boolean value can accept!');
      this.viewMode = value;
    }
    catch(err) {
      console.error(err);
      return;
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
  protected async searchBtn(): Promise<void> {
    try {
      if(!this.searchInput) throw new Error('Search input invalid!');
      const text = this.searchInput.nativeElement.value;
      if(!text) throw new Error('Search text is empty');
      await this.searchUsers(text);
      return;
    }
    catch(err) {
      console.error(err);
      return;
    }
  }
  protected async searchUsers(input: string) {
    try {
      this.loading = true;
      const safeInput = input.trim().toLowerCase();
      const users = await this.APIsService.getAllUsers();
      if(!safeInput) {
        this.usersDataInit();
        return;
      }
      if(!this.users || !users) throw new Error("Users not found!");
      // const usersWithoutLoggedUser = this.users.filter(
      //   (user) => user.username !== this.LOGGED_USER?.username
      // );
      const filteredUsers = users.filter((user) =>
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
    this.displayingUsers = [];
    this.isNoData = false;
  }
  //<============================================================ END RESET USERS VALUES ============================================================>

  //<============================================================ MAKE PAGINATION ============================================================>
  private makePagination(dataArray: User[], index: number): void {
    const totalDataCount = dataArray.length;
    const totalPageCount = Math.ceil(totalDataCount / this.limit);

    this.currentPageIndex = index;

    this.isNoData = totalDataCount === 0;

    // Calculate actual data slice range
    const startIndex = index * this.limit;
    const endIndex = startIndex + this.limit;

    // Slice data for current page
    this.displayingUsers = dataArray.slice(startIndex, endIndex);

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
          permission.actions.includes('create user')
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
          permission.actions.includes('view users')
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
          permission.actions.includes('update user')
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
          permission.actions.includes('delete user')
      ) ?? false
    );
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
    this.router.navigate(['/dashboard/users/add-new-user']);
  }

  protected async viewUser(isView: boolean, user: User): Promise<void> {
    try {
      if(!isView || !this.viewUserAvailable()) throw new Error('Premission is denied!');

      if(!user) throw new Error('Invalid user!');

      const username = user.username;

      if(!username) throw new Error('Invalid username')

      const res = await this.APIsService.generateToken(username);

      if(!res.token) throw new Error('Invalid token!');

      this.router.navigate(['/dashboard/users/user-profile', res.token]);

      return;
    }
    catch(err) {
      console.error(err);
      return;
    }
  }

  protected async editUser(isEdit: boolean, user: User): Promise<void> {
    try {
      if(!isEdit || !this.updateUserAvailable()) throw new Error('Premission is denied!');

      if(!user) throw new Error('Invalid user!');
      const username = user.username;
      if(!username) throw new Error('Invalid username')

      console.log(username)

      const res = await this.APIsService.generateToken(username);

      if(!res.token) throw new Error('Invalid token!');

      this.router.navigate(['/dashboard/users/edit-user', res.token]);
    }
    catch(err) {
      console.error(err);
    }
  }

  protected deleteUser(isDelete: boolean, user: User) {
    try {
      if(!isDelete) return;
      const username = user.username;
      const name = user.name;
      if(!username) throw new Error('Username cannot be empty!');
      if(!name) throw new Error('Name cannot be empty!');
      const dialogRef = this.dialog.open(ConfirmationComponent, {
        width: '400px',
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
