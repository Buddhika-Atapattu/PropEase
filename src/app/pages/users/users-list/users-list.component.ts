import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  type ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { NotificationDialogComponent } from '../../../components/dialogs/notification/notificationBar.component';
import { LayoutSwitchBtn } from '../../../components/shared/buttons/layout-switch-btn/layout-switch-btn';
import { ConfirmationComponent } from '../../../components/shared/confirmation/confirmation.component';
import { UserViewCardComponent } from '../../../components/user-view-card/user-view-card.component';
import { APIsService, type User } from '../../../services/APIs/apis.service';
import { AuthService } from '../../../services/auth/auth.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { PaginationUtil } from '../../../source/utility/pagination.utils';

/**
 * UsersListComponent
 * -----------------------------------------------------------------------------
 * - Displays users in row/column layouts (desktop) + separate mobile layout.
 * - Backend-driven pagination with variable page size by screen width.
 * - Live search by name/email/username.
 * - Role-based actions (view, edit, delete, create).
 * - Uses NotificationDialogComponent for toast-style notifications.
 */
@Component( {
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    NotificationDialogComponent,
    FormsModule,
    UserViewCardComponent,
    LayoutSwitchBtn,
    MatTooltipModule,
  ],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss',
} )
export class UsersListComponent implements OnInit, OnDestroy {
  /* --------------------------------------------------------------------------
   * VIEW CHILDREN
   * ------------------------------------------------------------------------ */

  /** Notification bridge component (used like a toast service). */
  @ViewChild( NotificationDialogComponent )
  protected notification!: NotificationDialogComponent;

  /** Search input reference (for search button click). */
  @ViewChild( 'searchInput', { static: true } )
  protected searchInput!: ElementRef<HTMLInputElement>;

  /* --------------------------------------------------------------------------
   * GLOBAL / ENVIRONMENT STATE
   * ------------------------------------------------------------------------ */

  /** Theme mode (light/dark) pushed by WindowsRefService. */
  protected mode: boolean | null = null;

  /** True when running in browser (SSR-safe check). */
  protected isBrowser: boolean;

  /** Subscriptions to clean up. */
  private modeSub: Subscription | null = null;
  private windowWidthSub: Subscription | null = null;

  /** Global loading flag for cards & skeletons. */
  protected loading: boolean = true;

  /** Logged-in user (used for permission checks). */
  protected LOGGED_USER: User | null = null;

  /** Current view layout: false = row list, true = column grid. */
  protected viewMode: boolean = false;

  /* --------------------------------------------------------------------------
   * DATA + SEARCH STATE
   * ------------------------------------------------------------------------ */

  /** Users currently rendered for this page. */
  protected users: User[] = [];

  /** ngModel bound search string (for input field). */
  protected search: string = '';

  /** Normalised search string used for backend calls. */
  private currentSearchTerm: string = '';

  /* --------------------------------------------------------------------------
   * PAGINATION STATE (backend-driven)
   * ------------------------------------------------------------------------ */

  /** Items per page - dynamic based on window width. */
  protected itemsPerPage: number = 12;

  /** Total items from backend. */
  protected totalItems: number = 0;

  /** Total pages (derived from totalItems / itemsPerPage). */
  protected pageCount: number = 0;

  /** Current page index (0-based). */
  protected index: number = 0;

  /** First page index shown in pager (0-based). */
  protected start: number = 0;

  /** Last page index shown in pager (0-based). */
  protected end: number = 0;

  /* --------------------------------------------------------------------------
   * USER IMAGE FALLBACKS
   * ------------------------------------------------------------------------ */

  protected readonly definedMaleDummyImageURL: string =
    'Images/user-images/dummy-user/dummy-user.jpg';

  protected readonly definedWomanDummyImageURL: string =
    'Images/user-images/dummy-user/dummy_woman.jpg';

  /** The effective image URL that will be used for a given user. */
  protected definedImage: string =
    'Images/user-images/dummy-user/dummy-user.jpg';

  /** Allowed image file extensions for validation. */
  protected readonly definedImageExtensionArray: string[] = [
    'jpg',
    'webp',
    'jpeg',
    'png',
    'ico',
    'gif',
  ];

  /* --------------------------------------------------------------------------
   * CONSTRUCTOR
   * ------------------------------------------------------------------------ */

  constructor (
    private windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private platformId: Object,
    private authService: AuthService,
    private router: Router,
    private APIsService: APIsService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private dialog: MatDialog,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    // Cache logged user once for permission checks.
    this.LOGGED_USER = this.authService.getLoggedUser;

    // Register SVG icons needed by this feature / child components.
    this.registerIcons();
  }

  /* --------------------------------------------------------------------------
   * LIFECYCLE
   * ------------------------------------------------------------------------ */

  public async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      // Theme mode subscription.
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );

      // Adapt itemsPerPage based on window width.
      this.windowWidthSub = this.windowRef.windowWidth$.subscribe( ( width ) => {
        let newPageSize: number = this.itemsPerPage;

        if ( width <= 599.99 ) {
          newPageSize = 6;
        } else if ( width >= 600 && width <= 1199.98 ) {
          newPageSize = 10;
        } else if ( width >= 1200 && width <= 1999.98 ) {
          newPageSize = 12;
        } else {
          newPageSize = 20;
        }

        // Only reload if page size actually changed.
        if ( newPageSize !== this.itemsPerPage ) {
          this.itemsPerPage = newPageSize;
          void this.userInit( 0 );
        }
      } );
    }

    // Initial load (page 0).
    await this.userInit( 0 );
  }

  public ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.windowWidthSub?.unsubscribe();
  }

  /* --------------------------------------------------------------------------
   * ICON REGISTRATION
   * ------------------------------------------------------------------------ */

  /**
   * Register SVG icons used in this feature (and child components) once.
   */
  private registerIcons(): void {
    const iconMap = [
      { name: 'view', path: 'Images/Icons/view.svg' },
      { name: 'edit', path: 'Images/Icons/pencil-square.svg' },
      { name: 'delete', path: 'Images/Icons/delete.svg' },
      { name: 'add-new-user', path: 'Images/Icons/add-new-user.svg' },
      { name: 'search', path: 'Images/Icons/search.svg' },
      { name: 'filter', path: 'Images/Icons/filter.svg' },
      { name: 'list', path: 'Images/Icons/list.svg' },
      { name: 'lineColumns', path: 'Images/Icons/line-columns.svg' },
    ];

    iconMap.forEach( ( icon ) => {
      this.matIconRegistry.addSvgIcon(
        icon.name,
        this.domSanitizer.bypassSecurityTrustResourceUrl( icon.path ),
      );
    } );
  }

  /* --------------------------------------------------------------------------
   * LAYOUT / VIEW MODE
   * ------------------------------------------------------------------------ */

  /**
   * Handle layout switch (Row / Column) from <app-layout-switch-btn>.
   */
  protected changeLayout( value: boolean ): void {
    try {
      if ( typeof value !== 'boolean' ) {
        throw new Error( 'Only boolean values are allowed for layout toggle.' );
      }
      this.viewMode = value;
    } catch ( err ) {
      console.error( err );
    }
  }

  /**
   * Helper to quickly check if a given username is the logged user.
   */
  protected isThisLoggedUserProfile( username: string ): boolean {
    return this.LOGGED_USER?.username === username;
  }

  /* --------------------------------------------------------------------------
   * PERMISSIONS (role-based access control)
   * ------------------------------------------------------------------------ */

  /**
   * Check if logged user can create new users.
   */
  protected createUserAvailable(): boolean {
    if ( !this.LOGGED_USER ) return false;

    return (
      this.LOGGED_USER.access?.permissions?.some(
        ( permission ) =>
          permission.module === 'User Management' &&
          permission.actions.includes( 'create user' ),
      ) ?? false
    );
  }

  /**
   * Check if logged user can view users.
   */
  protected viewUserAvailable(): boolean {
    if ( !this.LOGGED_USER ) return false;

    return (
      this.LOGGED_USER.access?.permissions?.some(
        ( permission ) =>
          permission.module === 'User Management' &&
          permission.actions.includes( 'view users' ),
      ) ?? false
    );
  }

  /**
   * Check if logged user can update users.
   */
  protected updateUserAvailable(): boolean {
    if ( !this.LOGGED_USER ) return false;

    return (
      this.LOGGED_USER.access?.permissions?.some(
        ( permission ) =>
          permission.module === 'User Management' &&
          permission.actions.includes( 'update user' ),
      ) ?? false
    );
  }

  /**
   * Check if logged user can delete users.
   */
  protected deleteUserAvailable(): boolean {
    if ( !this.LOGGED_USER ) return false;

    return (
      this.LOGGED_USER.access?.permissions?.some(
        ( permission ) =>
          permission.module === 'User Management' &&
          permission.actions.includes( 'delete user' ),
      ) ?? false
    );
  }

  /* --------------------------------------------------------------------------
   * USER IMAGE HANDLING
   * ------------------------------------------------------------------------ */

  /**
   * Decide which image URL to show for a user:
   *  - If a valid extension is found → use the provided image.
   *  - Else → use gender-specific dummy image.
   */
  protected detectUserImage( image: string, gender: string ): string {
    if ( typeof image === 'string' ) {
      const imageArray: string[] = image ? image.split( '/' ) : [];

      if ( imageArray.length > 0 ) {
        const filename: string = imageArray[ imageArray.length - 1 ] ?? '';
        const parts = filename.split( '.' );
        const extension: string = ( parts[ parts.length - 1 ] ?? '' ).toLowerCase();

        // Only accept known extensions
        if ( this.definedImageExtensionArray.includes( extension ) ) {
          this.definedImage = image;
        } else {
          this.definedImage = this.getGenderFallbackImage( gender );
        }
      } else {
        this.definedImage = this.getGenderFallbackImage( gender );
      }
    } else {
      this.definedImage = this.getGenderFallbackImage( gender );
    }

    return this.definedImage;
  }

  /**
   * Helper to pick a dummy image based on gender string.
   */
  private getGenderFallbackImage( gender: string ): string {
    const lowerGender = ( gender ?? '' ).toLowerCase();

    if ( lowerGender === 'female' ) {
      return this.definedWomanDummyImageURL;
    }

    // Default to male dummy when in doubt.
    return this.definedMaleDummyImageURL;
  }

  /* --------------------------------------------------------------------------
   * NAVIGATION: CREATE / VIEW / EDIT / DELETE
   * ------------------------------------------------------------------------ */

  /**
   * Navigate to the Add User form.
   */
  protected addUser(): void {
    if ( !this.createUserAvailable() ) {
      this.notification.notification(
        'error',
        'You do not have permission to create users.',
      );
      return;
    }

    this.router.navigate( [ '/dashboard/users/add-new-user' ] );
  }

  /**
   * Navigate to view user profile (token-based).
   */
  protected async viewUser( isView: boolean, user: User ): Promise<void> {
    try {
      if ( !isView || !this.viewUserAvailable() ) {
        throw new Error( 'Permission denied to view user.' );
      }

      if ( !user || !user.username ) {
        throw new Error( 'Invalid user / username.' );
      }

      const res = await this.APIsService.generateToken( user.username );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to fetch user token!' );
      }

      const token = this.APIsService.extractTokenFromMsg( res );

      if ( !token ) {
        throw new Error( 'Invalid token returned from server.' );
      }

      this.router.navigate( [ '/dashboard/users/user-profile', token ] );
    } catch ( err ) {
      console.error( err );
      this.notification.notification(
        'error',
        'Unable to open user profile.',
      );
    }
  }

  /**
   * Navigate to edit user form (token-based).
   */
  protected async editUser( isEdit: boolean, user: User ): Promise<void> {
    try {
      if ( !isEdit || !this.updateUserAvailable() ) {
        throw new Error( 'Permission denied to edit user.' );
      }

      if ( !user || !user.username ) {
        throw new Error( 'Invalid user / username.' );
      }

      const res = await this.APIsService.generateToken( user.username );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to fetch user token!' );
      }

      const token = this.APIsService.extractTokenFromMsg( res );

      if ( !token ) {
        throw new Error( 'Invalid token returned from server.' );
      }

      this.router.navigate( [ '/dashboard/users/edit-user', token ] );
    } catch ( err ) {
      console.error( err );
      this.notification.notification(
        'error',
        'Unable to open edit user screen.',
      );
    }
  }

  /**
   * Open confirmation dialog and delete user if confirmed.
   */
  protected deleteUser( isDelete: boolean, user: User ): void {
    try {
      if ( !isDelete ) return;

      const username = user.username;
      const name = user.name;

      if ( !username ) throw new Error( 'Username cannot be empty.' );
      if ( !name ) throw new Error( 'Name cannot be empty.' );

      const dialogRef = this.dialog.open( ConfirmationComponent, {
        width: '400px',
        height: 'auto',
        data: {
          title: `Delete ${ name }`,
          message: `Are you sure you want to delete ${ name }?`,
        },
      } );

      dialogRef.afterClosed().subscribe( async ( result ) => {
        try {
          if ( !result ) return;
          if ( !this.LOGGED_USER ) {
            throw new Error( 'User must be logged into the system.' );
          }

          await this.APIsService.deleteUserByUsername(
            username,
            this.LOGGED_USER.username,
          )
            .then( ( res ) => {
              this.notification.notification( res.status, res.message );
              // Optional: reload current page
              void this.userInit( this.index );
            } )
            .catch( ( err: HttpErrorResponse ) => {
              this.notification.notification(
                err.error?.error ?? 'error',
                err.error?.message ?? 'Delete failed.',
              );
            } );
        } catch ( err ) {
          this.notification.notification( 'error', String( err ) );
        }
      } );
    } catch ( error ) {
      this.notification.notification( 'error', String( error ) );
    }
  }

  /* --------------------------------------------------------------------------
   * SEARCH
   * ------------------------------------------------------------------------ */

  /**
   * Live search handler (ngModelChange).
   * Always resets to page 0 on new search.
   */
  protected async searchUsers( input: string ): Promise<void> {
    try {
      const raw: string = ( input ?? '' ).toString();
      const safeInput: string = raw.trim().toLowerCase();

      this.currentSearchTerm = safeInput;

      // Reset to first page for a new search term.
      await this.userInit( 0 );
    } catch ( err ) {
      console.error( err );
      this.notification.notification(
        'error',
        'Failed to process user search.',
      );
    }
  }

  /**
   * Search button handler (uses current input element value).
   */
  protected async searchBtn(): Promise<void> {
    try {
      const input = this.searchInput.nativeElement.value;
      await this.searchUsers( input );
    } catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'User search failed.' );
    }
  }

  /* --------------------------------------------------------------------------
   * PAGINATION – CORE
   * ------------------------------------------------------------------------ */

  /**
   * Whether pagination controls should be shown.
   */
  get isPaginationOn(): boolean {
    // If items <= pageSize, only one page → hide controls
    return this.totalItems > this.itemsPerPage;
  }

  /**
   * Validate that a value can be treated as a number.
   */
  private isNumberValue( value: unknown ): boolean {
    return (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      !isNaN( Number( value ) )
    );
  }

  /**
   * Main backend loader.
   * - Takes a 0-based page index.
   * - Computes start/end for the backend.
   * - Normalises search string and updates pagination state.
   */
  private async userInit( index: number ): Promise<void> {
    try {
      this.loading = true;

      const totalRes = await this.APIsService.getAllUserCount();

      if ( totalRes.status !== 'success' ) {
        throw new Error( 'Failed to fetch total amount of all users!' );
      }

      const totalRaw = totalRes.data?.pagination?.total;

      if ( !this.isNumberValue( totalRaw ) ) {
        throw new Error( 'Invalid total amount of all users!' );
      }

      const total: number = Number( totalRaw );

      const safeIndex: number = PaginationUtil.safeIndex( index, total );
      const limit: number = PaginationUtil.safeLimit( this.itemsPerPage, total );

      const startIdx: number = safeIndex * limit;
      const endIdx: number = startIdx + limit;
      const safeSearch: string = this.currentSearchTerm.trim();

      const res = await this.APIsService.getAllUsersWithPagination(
        startIdx,
        endIdx,
        safeSearch,
      );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( res?.message || 'Loading users failed.' );
      }

      const payload = res.data?.system?.users;

      if ( !Array.isArray( payload ) ) {
        throw new Error( 'Invalid array of users!' );
      }

      this.users = payload;

      this.totalItems = total;
      this.pageCount =
        this.totalItems > 0 ? Math.ceil( this.totalItems / limit ) : 0;

      // Clamp current page index in case count shrank.
      const maxIndex: number = this.pageCount > 0 ? this.pageCount - 1 : 0;
      this.index = Math.min( safeIndex, maxIndex );

      // If requested page is beyond max (e.g. after bulk delete) → reload last page.
      if ( safeIndex > maxIndex && this.pageCount > 0 ) {
        await this.userInit( maxIndex );
        return;
      }

      // Update page-number window.
      if ( this.pageCount > 0 ) {
        this.updateWindow();
      } else {
        this.start = 0;
        this.end = 0;
      }
    } catch ( err ) {
      console.error( '[Failed to process user loading with pagination!]: ', err );
      this.notification.notification(
        'error',
        'Failed to process user loading.',
      );
      this.users = [];
      this.totalItems = 0;
      this.pageCount = 0;
      this.index = 0;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Visible page numbers (0-based internally, +1 in template).
   */
  get pageRange(): number[] {
    if ( this.pageCount <= 0 ) {
      return [];
    }

    const totalPages = Math.max( 1, this.pageCount );
    const s = Math.max( 0, Math.min( this.start, totalPages - 1 ) );
    const e = Math.max( s, Math.min( this.end, totalPages - 1 ) );

    return Array.from( { length: e - s + 1 }, ( _, i ) => s + i );
  }

  /**
   * User-clicked pagination handler.
   * nextIndex is the 0-based page index requested from the UI.
   */
  protected async changePage( nextIndex: number ): Promise<void> {
    try {
      if ( !this.isNumberValue( nextIndex ) ) {
        throw new Error( 'Invalid page index.' );
      }

      const totalPages = Math.max( 1, this.pageCount );
      const requested = Math.round( Number( nextIndex ) );

      // Clamp into valid range.
      const target = Math.min( Math.max( 0, requested ), totalPages - 1 );

      if ( target === this.index ) {
        // Already on that page → no-op.
        return;
      }

      await this.userInit( target );
    } catch ( err ) {
      console.error( 'Pagination failed:', err );
    }
  }

  /**
   * Compute page-number window [start..end] around current index.
   * Shows up to 5 pages (2 on each side where possible).
   */
  private updateWindow(): void {
    const totalPages = Math.max( 1, this.pageCount );

    let current = this.index;
    if ( current < 0 ) current = 0;
    if ( current > totalPages - 1 ) current = totalPages - 1;
    this.index = current;

    if ( totalPages <= 5 ) {
      this.start = 0;
      this.end = totalPages - 1;
      return;
    }

    let start = current - 2;
    let end = current + 2;

    if ( start < 0 ) {
      start = 0;
      end = 4;
    }

    if ( end > totalPages - 1 ) {
      end = totalPages - 1;
      start = totalPages - 5;
    }

    this.start = start;
    this.end = end;
  }
}
