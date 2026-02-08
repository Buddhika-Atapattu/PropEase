import {
  Component,
  Inject,
  Input,
  PLATFORM_ID,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';

import { APIsService, User } from '../../../services/APIs/apis.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import { SkeletonLoaderComponent } from '../../shared/skeleton-loader/skeleton-loader.component';
import { MatTooltipModule } from '@angular/material/tooltip';

// add these imports from your access map source
import type { AccessActionKey, AccessModuleKey } from '../../../source/access-map.source';
import { ACCESS_OPTIONS } from '../../../source/access-map.source';

@Component( {
  selector: 'app-accessabilities',
  standalone: true,
  imports: [ CommonModule, MatIconModule, MatTooltipModule, SkeletonLoaderComponent ],
  templateUrl: './accessabilities.component.html',
  styleUrl: './accessabilities.component.scss',
} )
export class AccessabilitiesComponent implements OnInit, OnDestroy {
  // ─────────────────────────────────────────────
  // Input: user (wrapped in getter/setter)
  // ─────────────────────────────────────────────
  private _user: User | null = null;

  @Input( { required: true } )
  set user( value: User | null ) {
    this._user = value;

    // When a new user comes in, update access + active state
    if ( this._user ) {
      this.isActive = !!this._user.isActive;
      this.assignAccess( this._user );
      this.isLoading = false; // data is ready for template
    } else {
      this.isActive = false;
      this.accessabilities = null;
      this.isLoading = true;
    }
  }

  get user(): User | null {
    return this._user;
  }

  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  protected isActive = false;
  protected isLoading = true;
  protected accessabilities: User[ 'access' ] | null = null;

  // ─────────────────────────────────────────────
  // Access Map Lookups (UI meta by key)
  // ─────────────────────────────────────────────

  protected readonly moduleMetaByKey: Record<string, ( typeof ACCESS_OPTIONS )[ number ]> =
    Object.fromEntries( ACCESS_OPTIONS.map( m => [ m.module, m ] ) );

  protected getModuleMeta( moduleKey: string ) {
    return this.moduleMetaByKey[ moduleKey ] ?? null;
  }

  protected getActionMeta( moduleKey: string, actionId: string ) {
    const mod = this.getModuleMeta( moduleKey );
    if ( !mod ) return null;
    return ( mod.actions as readonly any[] ).find( a => a.id === actionId ) ?? null;
  }
  // ─────────────────────────────────────────────
  // DI
  // (some of these are not used *here* but may be
  // needed later – kept for now)
  // ─────────────────────────────────────────────
  constructor (
    private readonly APIs: APIsService,
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly router: Router,
    private readonly activatedRouter: ActivatedRoute,
    private readonly crypto: CryptoService,
    private readonly matIconRegistry: MatIconRegistry,
    private readonly domSanitizer: DomSanitizer
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    // Register custom SVG icons once in constructor
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

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────
  ngOnInit(): void {
    // Listen to mode changes only on browser
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }
    // Do NOT use this.user here; the @Input setter will handle it
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ─────────────────────────────────────────────
  // Access assignment
  // ─────────────────────────────────────────────
  private assignAccess( user: User ): void {
    try {
      if ( !user ) {
        throw new Error( 'Invalid user!' );
      }
      this.accessabilities = user.access ?? null;
    } catch ( error ) {
      console.error( '[Accessabilities] assignAccess error:', error );
      this.accessabilities = null;
    }
  }
}
