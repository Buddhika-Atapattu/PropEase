import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  SimpleChanges,
} from '@angular/core';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { APIsService, User } from '../../../services/APIs/apis.service';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { SkeletonLoaderComponent } from '../../shared/skeleton-loader/skeleton-loader.component';

@Component( {
  selector: 'app-user-informations',
  standalone: true,
  imports: [ CommonModule, MatIconModule, SkeletonLoaderComponent ],
  templateUrl: './user-informations.component.html',
  styleUrl: './user-informations.component.scss',
} )
export class UserInformationsComponent
  implements OnInit, OnChanges, AfterViewInit, OnDestroy {

  // ─────────────────────────────────────────────────────────────
  // Input: User
  // ─────────────────────────────────────────────────────────────

  private _user: User | null = null;
  private initialized = false; // avoid double-work before ngOnInit

  @Input( { required: true } )
  set user( value: User | null ) {
    this._user = value;

    // Before ngOnInit just store it; ngOnInit will do the first setup.
    if ( !this.initialized ) return;

    if ( this._user ) {
      this.assignUser( this._user );
    } else {
      // No user → clear state
      this.isActive = false;
      this.safeBio = this.domSanitizer.bypassSecurityTrustHtml( '' );
    }
  }

  get user(): User | null {
    return this._user;
  }

  // ─────────────────────────────────────────────────────────────
  // UI state
  // ─────────────────────────────────────────────────────────────

  protected mode: boolean | null = null;
  protected isBrowser: boolean;

  private modeSub: Subscription | null = null;

  protected isActive = false;
  protected isLoading = true;
  protected safeBio: SafeHtml;

  // ─────────────────────────────────────────────────────────────
  // DI
  // (some services not used in TS now but kept for template/future)
  // ─────────────────────────────────────────────────────────────

  constructor (
    private APIs: APIsService,
    private windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private platformId: Object,
    private router: Router,
    private activatedRouter: ActivatedRoute,
    private crypto: CryptoService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    // Default safe bio (empty)
    this.safeBio = this.domSanitizer.bypassSecurityTrustHtml( '' );

    // Register icons once
    this.matIconRegistry.addSvgIcon(
      'active',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        'Images/Icons/correct.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'inactive',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        'Images/Icons/wrong.svg'
      )
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.initialized = true;

    // Initial user (if already bound before OnInit)
    if ( this.user ) {
      this.assignUser( this.user );
    }

    // Mode subscription for light/dark handling
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }

    // Fake loading delay for skeletons
    setTimeout( () => {
      this.isLoading = false;
    }, 500 );
  }

  ngAfterViewInit(): void {
    // Simple guard: useful while developing; harmless in prod
    if ( !this.user ) {
      console.error( '[UserInformationsComponent] No user provided after view init.' );
    }
  }

  ngOnChanges( changes: SimpleChanges ): void {
    // If the input is changed **after** init, we handle it in the setter,
    // but this guard keeps behaviour robust if Angular triggers changes first.
    if ( changes[ 'user' ] && this.user && this.initialized ) {
      this.assignUser( this.user );
    }
  }

  ngOnDestroy(): void {
    if ( this.modeSub ) {
      this.modeSub.unsubscribe();
      this.modeSub = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────

  /** Central place to map a User into local UI state */
  private assignUser( user: User ): void {
    try {
      if ( !user ) {
        throw new Error( 'Invalid user!' );
      }

      this.isActive = !!user.isActive;

      // Build safe HTML for bio (allowing formatting, but still trusted)
      const rawBio = user.bio || '';
      this.safeBio = this.domSanitizer.bypassSecurityTrustHtml( rawBio );
    } catch ( error ) {
      console.error( '[UserInformationsComponent] assignUser error:', error );
      this.isActive = false;
      this.safeBio = this.domSanitizer.bypassSecurityTrustHtml( '' );
    }
  }
}
