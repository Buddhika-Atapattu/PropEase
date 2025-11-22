import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild
} from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  NotificationDialogComponent
} from '../../../components/dialogs/notification/notificationBar.component';
import { SkeletonLoaderComponent } from '../../../components/shared/skeleton-loader/skeleton-loader.component';
import { AccessabilitiesComponent } from '../../../components/tabs/accessabilities/accessabilities.component';
import { ActivitiesComponent } from '../../../components/tabs/activities/activities.component';
import { DocumentsComponent } from '../../../components/tabs/documents/documents.component';
import { UserInformationsComponent } from '../../../components/tabs/user-informations/user-informations.component';
import { APIsService, User } from '../../../services/APIs/apis.service';
import { AuthService } from '../../../services/auth/auth.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';

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
  ],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
} )
export class UserProfileComponent implements OnInit, OnDestroy {
  @ViewChild( NotificationDialogComponent ) notification!: NotificationDialogComponent;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  private token: string = '';
  private user: User | null = null;
  protected isLoading: boolean = true;
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

  protected isInfoPanelOpen: boolean = true;
  protected isAccessibilityPanelOpen: boolean = false;
  protected isDocumentsPanelOpen: boolean = false;
  protected isActivitiesPanelOpen: boolean = false;

  protected definedUserImage: string = '';
  protected LOGGED_USER: User | null = null;
  protected isUserCanEdit: boolean = false;

  protected isListPanelOpen: boolean = false;



  constructor (
    private windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private platformId: Object,
    private router: Router,
    private activatedRouter: ActivatedRoute,
    private APIs: APIsService,
    private authService: AuthService,
  ) {
    this.LOGGED_USER = this.authService.getLoggedUser;
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.activatedRouter.url.subscribe( ( segments ) => {
      const path = segments.map( ( s ) => s.path ).join( '/' );
    } );
    this.activatedRouter.params.subscribe( async ( param ) => {
      this.token = param[ 'token' ];

      this.isInfoPanelOpen = true;

      this.isAccessibilityPanelOpen = false;
      this.isDocumentsPanelOpen = false;
      this.isActivitiesPanelOpen = false;

      await this.loadData();
    } );
  }

  async ngOnInit() {
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }
  }

  get userData(): User | null {
    return this.user;
  }

  protected detectUserImage( user: User ): string {
    try {
      if ( !user ) throw new Error( 'Invalid user token' );

      if ( typeof user.image === 'string' ) {
        const imageArray: string[] = user.image
          ? user.image.split( '/' )
          : [];
        if ( imageArray.length > 0 ) {
          if (
            this.definedImageExtentionArray.includes(
              imageArray[ imageArray.length - 1 ].split( '.' )[ 1 ]
            )
          ) {
            return user.image;
          } else {
            if ( user.gender === 'male' ) {
              return this.definedMaleDummyImageURL;
            } else {
              return this.definedWomanDummyImageURL;
            }
          }
        }
        else {
          return this.definedMaleDummyImageURL;
        }
      }
      else {
        return this.definedMaleDummyImageURL;
      }
    }
    catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'Loading user image failed!' );
      return this.definedMaleDummyImageURL;;
    }

  }
  private async loadData() {
    try {
      this.isLoading = true;
      if ( !this.token ) throw new Error( 'Invalid user token' );
      const res = await this.APIs.getUserByToken( this.token );
      this.user = res.user ?? null;
      if ( !this.user ) throw new Error( 'Invalid user!' );
      this.isUserCanEdit = this.user.username === this.LOGGED_USER?.username;
    }
    catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'Loading user data failed!' );
      setTimeout( () => { this.router.navigate( [ '/dashboard/unauthorized' ] ); }, 500 );
      return;
    }
    finally {
      setTimeout( () => {
        this.isLoading = false;
      }, 500 );
    }
  }

  protected toggleListPanel() {
    this.isListPanelOpen = !this.isListPanelOpen;
  }

  protected goToUsers() {
    this.router.navigateByUrl( '/', { skipLocationChange: true } ).then( () => {
      this.router.navigate( [ '/dashboard/users' ] );
    } );
  }

  protected async goToUser() {
    if ( this.user ) {
      const username = await this.APIs.generateToken( this.user?.username );
      if ( username )
        this.router
          .navigateByUrl( '/', { skipLocationChange: true } )
          .then( () => {
            this.router.navigate( [
              '/dashboard/users/user-profile',
              username.token,
            ] );
          } );
    }
  }

  protected goToInfomation() {
    this.isInfoPanelOpen = true;
    this.isAccessibilityPanelOpen = false;
    this.isDocumentsPanelOpen = false;
    this.isActivitiesPanelOpen = false;
    this.isListPanelOpen = false;
  }
  protected goToAccessibility() {
    this.isInfoPanelOpen = false;
    this.isAccessibilityPanelOpen = true;
    this.isDocumentsPanelOpen = false;
    this.isActivitiesPanelOpen = false;
    this.isListPanelOpen = false;
  }
  protected goToDocuments() {
    this.isInfoPanelOpen = false;
    this.isAccessibilityPanelOpen = false;
    this.isDocumentsPanelOpen = true;
    this.isActivitiesPanelOpen = false;
    this.isListPanelOpen = false;
  }
  protected goToActivities() {
    this.isInfoPanelOpen = false;
    this.isAccessibilityPanelOpen = false;
    this.isDocumentsPanelOpen = false;
    this.isActivitiesPanelOpen = true;
    this.isListPanelOpen = false;
  }


  protected async editUser() {
    if ( this.isBrowser && this.LOGGED_USER ) {
      const username = await this.APIs.generateToken(
        this.LOGGED_USER?.username
      );
      this.router.navigate( [ '/dashboard/edit-user', username.token ] );
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }
}
