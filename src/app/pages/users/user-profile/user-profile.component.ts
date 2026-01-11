// ──────────────────────────────────────────────────────────────────────────────
// Angular core / common
// ──────────────────────────────────────────────────────────────────────────────
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';

// ──────────────────────────────────────────────────────────────────────────────
// Material
// ──────────────────────────────────────────────────────────────────────────────
import { MatTabsModule } from '@angular/material/tabs';

// ──────────────────────────────────────────────────────────────────────────────
// RxJS
// ──────────────────────────────────────────────────────────────────────────────
import { Subscription } from 'rxjs';

// ──────────────────────────────────────────────────────────────────────────────
// App components
// ──────────────────────────────────────────────────────────────────────────────
import {
  NotificationDialogComponent,
} from '../../../components/dialogs/notificationBar/notificationBar.component';
import { SkeletonLoaderComponent } from '../../../components/shared/skeleton-loader/skeleton-loader.component';
import { AccessabilitiesComponent } from '../../../components/tabs/accessabilities/accessabilities.component';
import { ActivitiesComponent } from '../../../components/tabs/activities/activities.component';
import { DocumentsComponent } from '../../../components/tabs/documents/documents.component';
import { UserInformationsComponent } from '../../../components/tabs/user-informations/user-informations.component';

// ──────────────────────────────────────────────────────────────────────────────
// Services & types
// ──────────────────────────────────────────────────────────────────────────────
import { APIsService, User } from '../../../services/APIs/apis.service';
import { AuthService } from '../../../services/auth/auth.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────
@Component( {
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    SkeletonLoaderComponent,
    UserInformationsComponent,
    AccessabilitiesComponent,
    DocumentsComponent,
    ActivitiesComponent,
    MatTabsModule,
    NotificationDialogComponent,
    MatTooltipModule,
  ],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
} )
export class UserProfileComponent implements OnInit, OnDestroy {
  // ──────────────────────────────────────────────────────────────────────────
  // ViewChild
  // ──────────────────────────────────────────────────────────────────────────
  @ViewChild( NotificationDialogComponent )
  notification!: NotificationDialogComponent;

  // ──────────────────────────────────────────────────────────────────────────
  // Theme / platform
  // ──────────────────────────────────────────────────────────────────────────
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  // ──────────────────────────────────────────────────────────────────────────
  // User / token
  // ──────────────────────────────────────────────────────────────────────────
  private token: string = '';
  private user: User | null = null;
  protected LOGGED_USER: User | null = null;
  protected isUserCanEdit: boolean = false;
  protected isLoading: boolean = true;

  // ──────────────────────────────────────────────────────────────────────────
  // Images
  // ──────────────────────────────────────────────────────────────────────────
  protected readonly definedMaleDummyImageURL: string =
    'Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL: string =
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

  protected definedUserImage: string = '';

  // ──────────────────────────────────────────────────────────────────────────
  // Panel state (mobile / side-panel)
  // ──────────────────────────────────────────────────────────────────────────
  protected isInfoPanelOpen: boolean = true;
  protected isAccessibilityPanelOpen: boolean = false;
  protected isDocumentsPanelOpen: boolean = false;
  protected isActivitiesPanelOpen: boolean = false;

  protected isListPanelOpen: boolean = false;

  // ──────────────────────────────────────────────────────────────────────────
  // Constructor
  // ──────────────────────────────────────────────────────────────────────────
  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly router: Router,
    private readonly activatedRouter: ActivatedRoute,
    private readonly APIs: APIsService,
    private readonly authService: AuthService,
  ) {
    this.LOGGED_USER = this.authService.getLoggedUser;
    this.isBrowser = isPlatformBrowser( this.platformId );

    // react to URL (mainly for side effects if needed later)
    this.activatedRouter.url.subscribe( () => {
      // reserved for future use
    } );

    // react to params (token change)
    this.activatedRouter.params.subscribe( async ( param ) => {
      this.token = param[ 'token' ];

      // reset tab states on token change
      this.isInfoPanelOpen = true;
      this.isAccessibilityPanelOpen = false;
      this.isDocumentsPanelOpen = false;
      this.isActivitiesPanelOpen = false;

      await this.loadData();
    } );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Getter for template
  // ──────────────────────────────────────────────────────────────────────────
  get userData(): User | null {
    return this.user;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Shared error notifier
  // ──────────────────────────────────────────────────────────────────────────
  private notifyError( message: string ): void {
    console.error( message );
    this.notification?.notification( 'error', message );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Image detection for user avatar
  // ──────────────────────────────────────────────────────────────────────────
  protected detectUserImage( user: User ): string {
    try {
      if ( !user ) {
        throw new Error( 'Invalid user token' );
      }

      const img = user.image;

      if ( typeof img === 'string' && img.trim().length > 0 ) {
        const segments = img.split( '/' );
        const lastSegment = segments[ segments.length - 1 ] ?? '';
        const parts = lastSegment.split( '.' );
        const ext = parts[ parts.length - 1 ]?.toLowerCase() ?? '';

        if ( this.definedImageExtentionArray.includes( ext ) ) {
          return img;
        }

        // invalid or unsupported extension; fall back by gender
        if ( user.gender === 'male' ) {
          return this.definedMaleDummyImageURL;
        }
        return this.definedWomanDummyImageURL;
      }

      // no valid image string → fallback
      return this.definedMaleDummyImageURL;
    } catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'Loading user image failed!' );
      return this.definedMaleDummyImageURL;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Load user data by token
  // ──────────────────────────────────────────────────────────────────────────
  private async loadData(): Promise<void> {
    try {
      this.isLoading = true;

      if ( !this.token ) {
        throw new Error( 'Invalid user token' );
      }

      const res = await this.APIs.getUserByToken( this.token );

      const fetchedUser: User | null = res.data?.system?.user ?? null;
      if ( !fetchedUser ) {
        throw new Error( 'Invalid user!' );
      }

      this.user = fetchedUser;

      // can current logged user edit this profile?
      this.isUserCanEdit =
        this.user.username === this.LOGGED_USER?.username;
    } catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'Loading user data failed!' );
      setTimeout( () => {
        this.router.navigate( [ '/dashboard/unauthorized' ] );
      }, 500 );
      return;
    } finally {
      setTimeout( () => {
        this.isLoading = false;
      }, 500 );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Layout / list panel
  // ──────────────────────────────────────────────────────────────────────────
  protected toggleListPanel(): void {
    this.isListPanelOpen = !this.isListPanelOpen;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Navigation helpers
  // ──────────────────────────────────────────────────────────────────────────
  protected goToUsers(): void {
    this.router
      .navigateByUrl( '/', { skipLocationChange: true } )
      .then( () => this.router.navigate( [ '/dashboard/users' ] ) )
      .catch( ( err ) => console.error( 'Navigation error (users):', err ) );
  }

  protected async goToUser(): Promise<void> {
    try {
      if ( !this.user ) {
        throw new Error( 'Invalid user data!' );
      }

      const username = this.user.username;
      const res = await this.APIs.generateToken( username );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to fetch token!' );
      }

      const token: string | null = this.APIs.extractTokenFromMsg( res );
      if ( !token ) {
        throw new Error( 'Invalid token!' );
      }

      await this.router.navigate( [
        '/dashboard/users/user-profile',
        token,
      ] );
    } catch ( error ) {
      console.error( error );
      this.notification.notification(
        'error',
        'Unable to navigate to user profile.',
      );
    }
  }

  protected async editUser(): Promise<void> {
    try {
      if ( !this.user ) {
        throw new Error( 'Invalid user data!' );
      }

      const username = this.user.username;
      const res = await this.APIs.generateToken( username );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to fetch token!' );
      }

      const token: string | null = this.APIs.extractTokenFromMsg( res );
      if ( !token ) {
        throw new Error( 'Invalid token!' );
      }

      await this.router.navigate( [ '/dashboard/users/edit-user', token ] );
    } catch ( error ) {
      console.error( error );
      this.notification.notification(
        'error',
        'Unable to navigate to edit user.',
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tab / section switching
  // ──────────────────────────────────────────────────────────────────────────
  protected goToInfomation(): void {
    this.isInfoPanelOpen = true;
    this.isAccessibilityPanelOpen = false;
    this.isDocumentsPanelOpen = false;
    this.isActivitiesPanelOpen = false;
    this.isListPanelOpen = false;
  }

  protected goToAccessibility(): void {
    this.isInfoPanelOpen = false;
    this.isAccessibilityPanelOpen = true;
    this.isDocumentsPanelOpen = false;
    this.isActivitiesPanelOpen = false;
    this.isListPanelOpen = false;
  }

  protected goToDocuments(): void {
    this.isInfoPanelOpen = false;
    this.isAccessibilityPanelOpen = false;
    this.isDocumentsPanelOpen = true;
    this.isActivitiesPanelOpen = false;
    this.isListPanelOpen = false;
  }

  protected goToActivities(): void {
    this.isInfoPanelOpen = false;
    this.isAccessibilityPanelOpen = false;
    this.isDocumentsPanelOpen = false;
    this.isActivitiesPanelOpen = true;
    this.isListPanelOpen = false;
  }
}
