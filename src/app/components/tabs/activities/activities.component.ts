import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  Inject,
  Input,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { User } from '../../../services/APIs/apis.service';
import { AuthService } from '../../../services/auth/auth.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';

import { LoggedDataComponent } from '../components/logged-data/logged-data.component';
import { UserCreatinonManagementComponent } from '../components/user-creatinon-management/user-creatinon-management.component';

@Component( {
  selector: 'app-activities',
  standalone: true,
  imports: [
    CommonModule,
    LoggedDataComponent,
    UserCreatinonManagementComponent,
  ],
  templateUrl: './activities.component.html',
  styleUrl: './activities.component.scss',
} )
export class ActivitiesComponent implements OnInit, OnDestroy {
  // ─────────────────────────────────────────────
  // Child components (optional, only if you need
  // to call methods on them directly)
  // ─────────────────────────────────────────────
  @ViewChild( LoggedDataComponent, { static: true } )
  loggedData!: LoggedDataComponent;

  @ViewChild( UserCreatinonManagementComponent, { static: true } )
  userCreationManagement!: UserCreatinonManagementComponent;

  // ─────────────────────────────────────────────
  // Input: user (wrapped in getter/setter)
  // ─────────────────────────────────────────────
  private _user: User | null = null;

  @Input( { required: true } )
  set user( value: User | null ) {
    this._user = value;
    this.assignUser( this._user );
    // if you ever need to manually tell children:
    // if (this.loggedData) this.loggedData.user = this._user;
    // if (this.userCreationManagement) this.userCreationManagement.user = this._user;
  }

  get user(): User | null {
    return this._user;
  }

  // ─────────────────────────────────────────────
  // Component state
  // ─────────────────────────────────────────────
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  protected username = '';
  protected loggedUser: User | null = null;

  private modeSub: Subscription | null = null;

  // ─────────────────────────────────────────────
  // DI
  // ─────────────────────────────────────────────
  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly authService: AuthService
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    this.loggedUser = this.authService.getLoggedUser;
  }

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    // Only subscribe to mode$ in browser
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }

    // No need to touch this.user here:
    // the @Input setter will be called when parent passes user.
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ─────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────
  private assignUser( user: User | null ): void {
    try {
      if ( !user ) {
        // When user is cleared, also clear local state
        this.username = '';
        return;
      }

      this.username = user.username;
      // anything else you want to derive from user goes here
    } catch ( error ) {
      console.error( '[Activities] assignUser error:', error );
      this.username = '';
    }
  }
}
