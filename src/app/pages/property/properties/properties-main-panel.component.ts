import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import {
  MatIconModule,
  MatIconRegistry,
} from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import {
  ActivatedRoute,
  Router,
} from '@angular/router';
import {
  Subscription,
} from 'rxjs';

import {
  NotificationDialogComponent,
} from '../../../components/dialogs/notification/notificationBar.component';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import {
  PropertyFilterDialogComponent,
} from '../../../components/dialogs/property-filter-dialog/property-filter-dialog.component';
import { PropertyViewCardComponent } from '../../../components/property-view-card/property-view-card.component';
import { LayoutSwitchBtn } from '../../../components/shared/buttons/layout-switch-btn/layout-switch-btn';
import { ConfirmationComponent } from '../../../components/shared/confirmation/confirmation.component';
import {
  APIsService,
  User,
} from '../../../services/APIs/apis.service';
import { AuthService } from '../../../services/auth/auth.service';
import {
  BackEndPropertyData,
  PropertyService,
} from '../../../services/property/property.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { PaginationUtil } from '../../../source/utility/pagination.utils';

// ─────────────────────────────────────────────────────────────
// Local interfaces
// ─────────────────────────────────────────────────────────────

interface FilterDialogData {
  minPrice: number;
  maxPrice: number;
  beds: string;
  bathrooms: string;
  amenities: string[];
  type: string;
  status: string;
}

@Component( {
  selector: 'app-properties-main-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,

    // Material / shared
    MatIconModule,
    NotificationDialogComponent,
    ProgressBarComponent,
    PropertyViewCardComponent,
    LayoutSwitchBtn,
  ],
  templateUrl: './properties-main-panel.component.html',
  styleUrl: './properties-main-panel.component.scss',
} )
export class PropertiesMainPanelComponent implements OnInit, OnDestroy {
  @ViewChild( ProgressBarComponent )
  progress!: ProgressBarComponent;

  @ViewChild( NotificationDialogComponent )
  notification!: NotificationDialogComponent;

  @ViewChild( 'searchInput', { static: true } )
  searchInput!: ElementRef<HTMLInputElement>;

  // ─────────────────────────────────────────────────────────────
  // Environment / global state
  // ─────────────────────────────────────────────────────────────

  protected mode: boolean | null = null;
  protected readonly isBrowser: boolean;

  private modeSub: Subscription | null = null;
  private windowWidthSub: Subscription | null = null;
  private routeSub: Subscription | null = null;

  protected LOGGED_USER: User | null = null;
  protected loading: boolean = false;
  protected viewMode: boolean = false;

  // ─────────────────────────────────────────────────────────────
  // Search / filter
  // ─────────────────────────────────────────────────────────────

  protected search: string = '';
  private currentSearchTerm: string = '';
  private currentFilter: FilterDialogData | null = null;

  // ─────────────────────────────────────────────────────────────
  // Data (current page)
  // ─────────────────────────────────────────────────────────────

  protected properties: BackEndPropertyData[] = [];

  // ─────────────────────────────────────────────────────────────
  // Backend pagination
  // ─────────────────────────────────────────────────────────────

  protected itemsPerPage: number = 12; // page size
  protected totalItems: number = 0;    // total count from backend
  protected pageCount: number = 0;     // total pages
  protected index: number = 0;         // current page index (0-based)

  // Page-number window for UI (0-based indices)
  protected start: number = 0; // first page index shown
  protected end: number = 0;   // last page index shown

  // ─────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────

  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService,
    private readonly apiService: APIsService,
    private readonly matIconRegistry: MatIconRegistry,
    private readonly domSanitizer: DomSanitizer,
    private readonly router: Router,
    private readonly dialog: MatDialog,
    private readonly propertyService: PropertyService,
  ) {
    this.LOGGED_USER = this.authService.getLoggedUser;
    this.isBrowser = isPlatformBrowser( this.platformId );

    // Route subscription (kept in case you want to use `path` later)
    this.routeSub = this.route.url.subscribe( ( segments ) => {
      const path = segments.map( ( s ) => s.path ).join( '/' );
      // path available if needed
    } );

    this.registerIcons();
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      // Theme mode subscription
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );

      // Responsive page size
      this.windowWidthSub = this.windowRef.windowWidth$.subscribe( ( width ) => {
        const newPageSize = this.calculatePageSize( width );

        if ( newPageSize !== this.itemsPerPage ) {
          this.itemsPerPage = newPageSize;
          // Reload from first page when page size changes
          void this.propertyInit( 0 );
        }
      } );
    }

    // Initial load
    await this.propertyInit( 0 );
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.windowWidthSub?.unsubscribe();
    this.routeSub?.unsubscribe();
  }

  // ─────────────────────────────────────────────────────────────
  // Layout / permissions
  // ─────────────────────────────────────────────────────────────

  protected changeLayout( value: boolean ): void {
    // LayoutSwitchBtn already sends a boolean; just coerce for safety
    this.viewMode = !!value;
  }

  // ─────────────────────────────────────────────────────────────
  // Icon registration
  // ─────────────────────────────────────────────────────────────

  private registerIcons(): void {
    const iconMap: { name: string; path: string; }[] = [
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
        icon.name,
        this.domSanitizer.bypassSecurityTrustResourceUrl( icon.path ),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Navigation operations
  // ─────────────────────────────────────────────────────────────

  protected async viewProperty(
    isAllowed: boolean,
    property: BackEndPropertyData,
  ): Promise<void> {
    try {
      if ( !isAllowed ) return;
      const propertyId = property?.id;
      if ( !propertyId ) throw new Error( 'Invalid property id!' );
      await this.router.navigate( [ '/dashboard/properties/property-view', propertyId ] );
    } catch ( err ) {
      console.error( '[viewProperty]:', err );
    }
  }

  protected async editProperty(
    isAllowed: boolean,
    property: BackEndPropertyData,
  ): Promise<void> {
    try {
      if ( !isAllowed ) return;
      const propertyId = property?.id;
      if ( !propertyId ) throw new Error( 'Invalid property id!' );
      await this.router.navigate( [ '/dashboard/properties/property-edit', propertyId ] );
    } catch ( err ) {
      console.error( '[editProperty]:', err );
    }
  }

  protected async deleteProperty(
    isAllowed: boolean,
    property: BackEndPropertyData,
  ): Promise<void> {
    try {
      if ( !isAllowed ) return;
      if ( !property ) throw new Error( 'Invalid property data!' );
      if ( !this.LOGGED_USER ) throw new Error( 'User is not logged in!' );

      const propertyId = property.id;
      if ( !propertyId ) throw new Error( 'Invalid property id!' );

      const title = `Delete ${ propertyId }`;
      const message = `Are you sure you want to delete ${ propertyId }?`;

      const dialogRef = this.dialog.open( ConfirmationComponent, {
        width: '400px',
        height: 'auto',
        data: {
          isDelete: true,
          title,
          message,
        },
      } );

      dialogRef.afterClosed().subscribe( async ( confirmed: boolean ) => {
        if ( !confirmed ) return;

        try {
          const username = this.LOGGED_USER?.username ?? '';
          const res = await this.propertyService.deleteProperty( propertyId, username );

          if ( res.success || res.status.toLocaleLowerCase() === 'success' ) {
            this.notification.notification( 'warning', `Property deleted: ${ propertyId }` );
            // Reload current page (backend returns updated count)
            await this.propertyInit( this.index );
          } else {
            this.notification.notification( 'error', 'Failed to delete property!' );
            throw new Error( '[Failed to delete property]: ' + ( res.message ?? 'Unknown' ) );
          }
        } catch ( error ) {
          console.error( '[deleteProperty > afterClosed]:', error );
        }
      } );
    } catch ( err ) {
      console.error( '[deleteProperty]:', err );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Filter / search
  // ─────────────────────────────────────────────────────────────

  private async getHighestPropertyPrice(): Promise<number> {
    try {
      const data = await this.propertyService.getAllProperties();
      const properties = data.data as BackEndPropertyData[] | undefined;

      if ( !Array.isArray( properties ) || properties.length === 0 ) {
        return 0;
      }

      return Math.max( ...properties.map( ( prop ) => prop.price || 0 ) );
    } catch ( err ) {
      console.error( '[getHighestPropertyPrice]:', err );
      this.notification.notification( 'error', 'Failed to load max property price!' );
      return 0;
    }
  }

  protected async openFilter(): Promise<void> {
    try {
      const maxPrice = await this.getHighestPropertyPrice();

      const dialogRef = this.dialog.open( PropertyFilterDialogComponent, {
        width: 'auto',
        height: 'auto',
        maxWidth: '100vw',
        maxHeight: '100vh',
        minWidth: '25vw',
        minHeight: '25vh',
        autoFocus: false,
        data: {
          maxPrice,
          minPrice: 0,
        },
      } );

      dialogRef.afterClosed().subscribe( async ( result: FilterDialogData | null | undefined ) => {
        if ( result === null || result === undefined ) {
          return;
        }

        this.currentFilter = result;
        // Filter changed → go back to first page
        await this.propertyInit( 0 );
      } );
    } catch ( err ) {
      console.error( '[openFilter]:', err );
      this.notification.notification( 'error', 'Failed to open filter dialog!' );
    }
  }

  protected async resetFilter(): Promise<void> {
    this.currentFilter = null;
    this.search = '';
    this.currentSearchTerm = '';
    await this.propertyInit( 0 );
  }

  protected async searchProperties( input: string ): Promise<void> {
    try {
      const raw = ( input ?? '' ).toString();
      const safeInput = raw.trim().toLowerCase();

      this.currentSearchTerm = safeInput;
      // Search changed → first page
      await this.propertyInit( 0 );
    } catch ( err ) {
      console.error( '[searchProperties]:', err );
      this.notification.notification( 'error', 'Failed to process property search!' );
    }
  }

  protected async searchBtn(): Promise<void> {
    try {
      const input = this.searchInput.nativeElement.value;
      await this.searchProperties( input );
    } catch ( err ) {
      console.error( '[searchBtn]:', err );
      this.notification.notification( 'error', 'Property search failed!' );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Backend pagination core
  // ─────────────────────────────────────────────────────────────

  get isPaginationOn(): boolean {
    return this.totalItems > this.itemsPerPage;
  }

  /**
   * Calculate itemsPerPage based on viewport width.
   */
  private calculatePageSize( width: number ): number {
    if ( width <= 599.99 ) return 6;
    if ( width >= 600 && width <= 1199.98 ) return 10;
    if ( width >= 1200 && width <= 1999.98 ) return 12;
    return 20;
  }

  /**
   * Main backend loader.
   * pageIndex is 0-based (0,1,2,...).
   */
  private async propertyInit( index: number ): Promise<void> {
    try {
      this.loading = true;

      // 1) Fetch total count
      const total = await this.fetchTotalPropertyCount();
      this.totalItems = total;

      // 2) Compute safe index & bounds
      const limit = PaginationUtil.safeLimit( this.itemsPerPage, total );
      const safeIndex = PaginationUtil.safeIndex( index, total );
      const { startIdx, endIdx } = this.computeBounds( safeIndex, limit );

      // 3) Build filter/search payload
      const safeFilter = this.currentFilter
        ? JSON.stringify( this.currentFilter )
        : '';
      const safeSearch = this.currentSearchTerm || '';

      // 4) Fetch page from backend
      const properties = await this.fetchPropertyPage(
        startIdx,
        endIdx,
        safeSearch,
        safeFilter,
      );

      // 5) Apply to component state
      this.properties = properties;

      this.pageCount = total > 0
        ? Math.ceil( total / limit )
        : 0;

      const maxIndex = this.pageCount > 0 ? this.pageCount - 1 : 0;
      this.index = Math.min( safeIndex, maxIndex );

      // If requested page > maxIndex (e.g. after mass delete), reload last page
      if ( safeIndex > maxIndex && this.pageCount > 0 ) {
        await this.propertyInit( maxIndex );
        return;
      }

      // 6) Update page number window
      if ( this.pageCount > 0 ) {
        this.updateWindow();
      } else {
        this.start = 0;
        this.end = 0;
      }
    } catch ( err ) {
      console.error( '[propertyInit]: Failed to load properties with pagination:', err );
      this.notification.notification( 'error', 'Failed to load properties!' );
      this.properties = [];
      this.totalItems = 0;
      this.pageCount = 0;
      this.index = 0;
      this.start = 0;
      this.end = 0;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Fetch total property count from backend and validate.
   */
  private async fetchTotalPropertyCount(): Promise<number> {
    const totalRes = await this.propertyService.getAllPropertiesCount();

    if ( !totalRes.success || totalRes.status !== 'success' ) {
      throw new Error( 'Failed to fetch total number of properties' );
    }

    const total: number | undefined = totalRes.data?.pagination?.total;

    if (
      !total ||
      Number.isNaN( total ) ||
      !Number.isFinite( total ) ||
      !Number.isInteger( total )
    ) {
      throw new Error( 'Invalid property total number!' );
    }

    return total;
  }

  /**
   * Compute start/end indices for backend pagination.
   */
  private computeBounds( pageIndex: number, limit: number ): { startIdx: number; endIdx: number; } {
    const startIdx = pageIndex * limit;
    const endIdx = startIdx + limit;
    return { startIdx, endIdx };
  }

  /**
   * Fetch paginated properties from backend with search + filter.
   */
  private async fetchPropertyPage(
    startIdx: number,
    endIdx: number,
    search: string,
    filter: string,
  ): Promise<BackEndPropertyData[]> {
    const res = await this.propertyService.getPropertiesWithPaginationAndFilter(
      startIdx,
      endIdx,
      search,
      filter,
    );

    if ( !res.success || res.status !== 'success' ) {
      throw new Error( res?.message || 'Loading properties failed!' );
    }

    const properties = res.data?.system?.properties;
    if ( !Array.isArray( properties ) ) {
      throw new Error( 'Invalid array of property data!' );
    }

    return properties;
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
        totalPages - 1,
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

  // ─────────────────────────────────────────────────────────────
  // Misc navigation
  // ─────────────────────────────────────────────────────────────

  protected propertyListing(): void {
    void this.router.navigate( [ '/dashboard/properties/property-listing' ] );
  }
}
