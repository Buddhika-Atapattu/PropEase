// Path: src/components/user-info-panel/user-info-panel.component.ts
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { APIsService, User } from '../../services/APIs/apis.service';
import {
  AuthService
} from '../../services/auth/auth.service';
import { CryptoService } from '../../services/cryptoService/crypto.service';
import { WindowsRefService } from '../../services/windowRef/windowRef.service';

@Component( {
  selector: 'app-user-info-panel',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './user-info-panel.component.html',
  styleUrl: './user-info-panel.component.scss',
} )
export class UserInfoPanelComponent implements OnInit, OnDestroy {
  @Output() closePanel = new EventEmitter<boolean>();
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected user: User | null = null;

  constructor (
    private windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private platformId: Object,
    protected authService: AuthService,
    protected router: Router,
    private elementRef: ElementRef,
    private crypto: CryptoService,
    private apiService: APIsService
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    if ( this.authService.getLoggedUser !== null ) {
      this.user = this.authService.getLoggedUser;
    }
  }

  ngOnInit(): void {
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  @HostListener( 'document:click', [ '$event' ] )
  onDocumentClick( event: Event ): void {
    const clickedInside = this.elementRef.nativeElement.contains( event.target );
    if ( !clickedInside ) {
      this.close( false );
    }
  }

  protected logout(): void {
    this.authService.clearCredentials();
    document.cookie = 'username=; Max-Age=0; path=/';
    document.cookie = 'password=; Max-Age=0; path=/';
    localStorage.clear();
    this.router.navigate( [ '/login' ] );
  }

  protected async open(): Promise<void> {
    try {
      if ( !this.user ) {
        throw new Error( 'Invalid user!' );
      }
      const username = this.user.username;
      const res = await this.apiService.generateToken( username );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Faild to generate token' );
      }

      const token = this.apiService.extractTokenFromMsg( res );

      if ( !token ) {
        throw new Error( 'Invalid token!' );
      }

      await this.router.navigate( [ '/dashboard/users/user-profile', token ] );
      return;
    }
    catch ( error ) {
      console.error( error );
    }
  }

  protected close( closed: boolean ): void {
    this.closePanel.emit( closed );
  }
}
