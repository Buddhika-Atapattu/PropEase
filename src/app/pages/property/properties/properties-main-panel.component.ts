import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  AfterViewInit

} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { NotificationDialogComponent } from '../../../components/dialogs/notification/notificationBar.component';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import { PropertyFilterDialogComponent } from '../../../components/dialogs/property-filter-dialog/property-filter-dialog.component';
import { PropertyViewCardComponent } from '../../../components/property-view-card/property-view-card.component';
import { User, APIsService } from '../../../services/APIs/apis.service';
import { AuthService } from '../../../services/auth/auth.service';
import {
  BackEndPropertyData,
  PropertyService
} from '../../../services/property/property.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { ConfirmationComponent } from '../../../components/shared/confirmation/confirmation.component';
import { LayoutSwitchBtn } from '../../../components/shared/buttons/layout-switch-btn/layout-switch-btn';

interface FilterDialogData {
  minPrice: number;
  maxPrice: number;
  beds: string;
  bathrooms: string;
  amenities: string[];
  type: string;
  status: string;
}

interface ApiDataTypeForProperties {
  properties: BackEndPropertyData[];
  count: number;
}

@Component( {
  selector: 'app-properties-main-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    NotificationDialogComponent,
    ProgressBarComponent,
    PropertyViewCardComponent,
    FormsModule,
    LayoutSwitchBtn
  ],
  templateUrl: './properties-main-panel.component.html',
  styleUrl: './properties-main-panel.component.scss',
} )
export class PropertiesMainPanelComponent implements OnInit, OnDestroy {
  @ViewChild( ProgressBarComponent ) progress!: ProgressBarComponent;
  @ViewChild( NotificationDialogComponent ) notification!: NotificationDialogComponent;
  @ViewChild( 'searchInput', { static: true } )
  searchInput!: ElementRef<HTMLInputElement>;

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  protected LOGGED_USER: User | null = null;
  protected loading: boolean = false;
  protected viewMode: boolean = false;

  // Search / filter
  protected search: string = '';
  private currentSearchTerm: string = '';
  private currentFilter: FilterDialogData | null = null;

  // Data (only current page from backend)
  protected properties: BackEndPropertyData[] = [];

  // PAGINATION (backend-driven)
  protected itemsPerPage: number = 12; // page size
  protected totalItems: number = 0;    // total count (from backend)
  protected pageCount: number = 0;     // total pages
  protected index: number = 0;         // current page index (0-based)

  // Page-number window for UI (0-based indices)
  protected start: number = 0; // first page index shown in pager
  protected end: number = 0;   // last page index shown in pager

  constructor (
    private windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private platformId: Object,
    private route: ActivatedRoute,
    private authService: AuthService,
    private readonly apiService: APIsService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private router: Router,
    private dialog: MatDialog,
    private propertyService: PropertyService,
  ) {
    this.LOGGED_USER = this.authService.getLoggedUser;
    this.isBrowser = isPlatformBrowser( this.platformId );

    this.route.url.subscribe( ( segments ) => {
      const path = segments.map( ( s ) => s.path ).join( '/' );
      // path available if needed
    } );

    this.iconMaker();
  }

  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );

      this.windowRef.windowWidth$.subscribe( ( val ) => {
        let newPageSize = this.itemsPerPage;

        if ( val <= 599.99 ) {
          newPageSize = 6;
        } else if ( val >= 600 && val <= 1199.98 ) {
          newPageSize = 10;
        } else if ( val >= 1200 && val <= 1999.98 ) {
          newPageSize = 12;
        } else {
          newPageSize = 20;
        }

        // Only update if actually changed
        if ( newPageSize !== this.itemsPerPage ) {
          this.itemsPerPage = newPageSize;
          // (Optional) If you want to reload when page size changes:
          void this.propertyInit( 0 );
        }
      } );
    }

    //  Load first page here – BEFORE first change detection of children
    await this.propertyInit( 0 );
  }



  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ───────────────────────────────────────────────
  // Layout / permissions
  // ───────────────────────────────────────────────

  protected changeLayout( value: boolean ): void {
    try {
      if ( typeof value !== 'boolean' ) {
        throw new Error( 'Only Boolean value can accept!' );
      }
      this.viewMode = value;
    } catch ( err ) {
      console.error( err );
    }
  }


  protected isUserCanCreateProperty(): boolean {
    return (
      this.LOGGED_USER?.access.permissions.some(
        ( permission ) =>
          permission.module === 'Property Management' &&
          permission.actions.includes( 'create property' )
      ) ?? false
    );
  }

  private iconMaker(): void {
    const iconMap = [
      { name: 'view', path: 'Images/Icons/view.svg' },
      { name: 'listing', path: 'Images/Icons/listing.svg' },
      { name: 'edit', path: 'Images/Icons/pencil-square.svg' },
      { name: 'delete', path: 'Images/Icons/delete.svg' },
      { name: 'add-new-user', path: 'Images/Icons/add-new-user.svg' },
      { name: 'search', path: 'Images/Icons/search.svg' },
      { name: 'filter', path: 'Images/Icons/filter.svg' },
      { name: 'reset', path: 'Images/Icons/reset.svg' },
      { name: 'list', path: 'Images/Icons/list.svg' },
      { name: 'lineColumns', path: 'Images/Icons/line-columns.svg' },
    ];

    for ( const icon of iconMap ) {
      this.matIconRegistry.addSvgIcon(
        icon.name.toString(),
        this.domSanitizer.bypassSecurityTrustResourceUrl( icon.path.toString() )
      );
    }
  }

  // ───────────────────────────────────────────────
  // Navigation operations
  // ───────────────────────────────────────────────

  protected async viewProperty( isAllowed: boolean, property: BackEndPropertyData ): Promise<void> {
    try {
      if ( !isAllowed ) return;
      if ( !property ) throw new Error( 'Invalid property data!' );
      const propertyId = property.id;
      if ( !propertyId ) throw new Error( 'Invalid property id!' );
      await this.router.navigate( [ '/dashboard/properties/property-view', propertyId ] );
    } catch ( err ) {
      console.error( err );
    }
  }

  protected async editProperty( isAllowed: boolean, property: BackEndPropertyData ): Promise<void> {
    try {
      if ( !isAllowed ) return;
      if ( !property ) throw new Error( 'Invalid property data!' );
      const propertyId = property.id;
      if ( !propertyId ) throw new Error( 'Invalid property id!' );
      await this.router.navigate( [ '/dashboard/properties/property-edit', propertyId ] );
    } catch ( err ) {
      console.error( err );
    }
  }

  protected async deleteProperty( isAllowed: boolean, property: BackEndPropertyData ): Promise<void> {
    try {
      if ( !isAllowed ) return;
      if ( !property ) throw new Error( 'Invalid property data!' );
      if ( !this.LOGGED_USER ) throw new Error( 'Invalid login!' );

      const propertyId = property.id;
      const title = `Delete ${ propertyId }`;
      const message = `Are you sure to delete ${ propertyId }`;

      const dialogRef = this.dialog.open( ConfirmationComponent, {
        width: '400px',
        height: 'auto',
        data: {
          isDelete: isAllowed,
          title,
          message,
        },
      } );

      dialogRef.afterClosed().subscribe( async ( val ): Promise<void> => {
        try {
          const confirm: boolean = val;
          if ( !confirm ) return;

          const username = this.LOGGED_USER?.username ?? '';
          const res = await this.propertyService.deleteProperty( propertyId, username );

          if ( res.success || res.status.toLocaleLowerCase() === 'success' ) {
            this.notification.notification( 'warning', `Property deleted ${ propertyId }` );
            // reload current page (backend will give updated count)
            await this.propertyInit( this.index );
          } else {
            this.notification.notification( 'error', 'Failed to delete property!' );
            throw new Error( '[Failed to delete property]: ' + res.message );
          }
        } catch ( error ) {
          console.error( error );
        }
      } );
    } catch ( err ) {
      console.error( err );
    }
  }

  // ───────────────────────────────────────────────
  // Filter / search
  // ───────────────────────────────────────────────

  private async getHighestPropertyPrice(): Promise<number> {
    const data = await this.propertyService.getAllProperties();
    const properties: BackEndPropertyData[] = data.data as BackEndPropertyData[];
    if ( !properties || properties.length === 0 ) return 0;
    return Math.max( ...properties.map( ( prop ) => prop.price || 0 ) );
  }

  protected async openFilter(): Promise<void> {
    const dialogRef = this.dialog.open( PropertyFilterDialogComponent, {
      width: 'auto',
      height: 'auto',
      maxWidth: '100vw',
      maxHeight: '100vh',
      minWidth: '25vw',
      minHeight: '25vh',
      autoFocus: false,
      data: {
        maxPrice: await this.getHighestPropertyPrice(),
        minPrice: 0,
      },
    } );

    dialogRef.afterClosed().subscribe( async ( result ) => {
      if ( result !== null && result !== undefined ) {
        this.currentFilter = result as FilterDialogData;
        // filter changed → go back to first page
        await this.propertyInit( 0 );
      }
    } );
  }

  protected async resetFilter(): Promise<void> {
    this.currentFilter = null;
    this.search = '';
    this.currentSearchTerm = '';
    await this.propertyInit( 0 );
  }

  protected async searchProperties( input: string ): Promise<void> {
    try {
      const raw: string = ( input ?? '' ).toString();
      const safeInput: string = raw.trim().toLowerCase();

      this.currentSearchTerm = safeInput;
      // search changed → first page
      await this.propertyInit( 0 );
    } catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'Failed to process property search!' );
    }
  }

  protected async searchBtn(): Promise<void> {
    try {
      const input = this.searchInput.nativeElement.value;
      await this.searchProperties( input );
    } catch ( err ) {
      console.error( err );
      this.notification.notification( 'error', 'Property search failed!' );
    }
  }

  // ───────────────────────────────────────────────
  // Backend pagination core
  // ───────────────────────────────────────────────
  get isPaginationOn(): boolean {
    return this.totalItems !== this.itemsPerPage;
  }
  /**
   * Main backend loader.
   * pageIndex is 0-based (0,1,2,...).
   * It converts to start/end and calls the backend pagination API.
   */
  private async propertyInit( pageIndex: number ): Promise<void> {
    try {
      this.loading = true;

      const safeIndex: number = Math.max( 0, Math.round( Number( pageIndex ) ) );
      const limit: number = Math.max( 1, this.itemsPerPage );

      const startIdx: number = safeIndex * limit;
      const endIdx: number = startIdx + limit;

      const safeFilter: string = this.currentFilter
        ? JSON.stringify( this.currentFilter )
        : '';

      const safeSearch: string = this.currentSearchTerm || '';

      const res = await this.propertyService.getPropertiesWithPaginationAndFilter(
        startIdx,
        endIdx,
        safeSearch,
        safeFilter
      );

      if ( !res || res.status !== 'success' ) {
        throw new Error( res?.message || 'Loading properties failed!' );
      }

      const payload = res.data as ApiDataTypeForProperties;
      const properties = Array.isArray( payload.properties )
        ? payload.properties
        : [];

      this.properties = properties;
      this.totalItems = payload.count ?? 0;

      this.pageCount = this.totalItems > 0
        ? Math.ceil( this.totalItems / limit )
        : 0;

      // Clamp current page index in case count shrank
      const maxIndex: number = this.pageCount > 0 ? this.pageCount - 1 : 0;
      this.index = Math.min( safeIndex, maxIndex );

      // If requested page is beyond the max (e.g. after big delete) → reload last page
      if ( safeIndex > maxIndex && this.pageCount > 0 ) {
        await this.propertyInit( maxIndex );
        return;
      }

      // Update page-number window
      if ( this.pageCount > 0 ) {
        this.updateWindow();
      } else {
        this.start = 0;
        this.end = 0;
      }
    } catch ( err ) {
      console.error( '[Failed to process property loading with pagination!]: ', err );
      this.notification.notification( 'error', 'Failed to process property loading!' );
      this.properties = [];
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

  private isNumberValue( value: unknown ): boolean {
    return (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      !isNaN( Number( value ) )
    );
  }

  /**
   * User-clicked pagination.
   * nextIndex is 0-based page index from the UI.
   */
  protected async changePage( nextIndex: number ): Promise<void> {
    try {
      if ( !this.isNumberValue( nextIndex ) ) {
        throw new Error( 'Invalid page index' );
      }

      const totalPages = Math.max( 1, this.pageCount );
      const requested = Math.round( Number( nextIndex ) );

      const target = Math.min(
        Math.max( 0, requested ),
        totalPages - 1
      );

      if ( target === this.index ) {
        return;
      }

      await this.propertyInit( target );
    } catch ( err ) {
      console.error( 'Pagination failed:', err );
    }
  }

  /**
   * Compute page-number window [start..end] based on current index.
   * Shows up to 5 pages around the current page.
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

  // ───────────────────────────────────────────────
  // Misc navigation
  // ───────────────────────────────────────────────

  protected propertyListing(): void {
    this.router.navigate( [ '/dashboard/properties/property-listing' ] );
  }
}
