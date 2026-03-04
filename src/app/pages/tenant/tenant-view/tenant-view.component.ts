import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import * as FileSaver from 'file-saver';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';

// Shared / dialog components
import { NotificationDialogComponent } from '../../../components/dialogs/notificationBar/notificationBar.component';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';

// Custom table
import {
  CustomTableComponent,
  FileExport,
  SwitchButtonType,
  TableButton,
  TableButtonActionConfig,
  TableColumn,
} from '../../../components/shared/custom-table/custom-table.component';

// Skeleton loader
import { SkeletonLoaderComponent } from '../../../components/shared/skeleton-loader/skeleton-loader.component';

// Services
import { APIsService, User } from '../../../services/APIs/apis.service';
import { AuthService } from '../../../services/auth/auth.service';
import {
  BackEndPropertyData,
  PropertyService,
} from '../../../services/property/property.service';
import {
  Lease,
  LeaseWithProperty, // likely used in template
  TenantService
} from '../../../services/tenant/tenant.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';

// Types
import type { DateRange } from '../../../components/shared/paginator/paginator.component';

import { PaginationUtil } from '../../../source/utility/pagination.util';

/**
 * Data shape passed to the custom table for leases.
 * Keep this in sync with table columns and CustomTableComponent expectations.
 */
interface LeaseTableDataType {
  image: string;
  leaseid: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  status: string;
  monthlyRent: string;
  remainingDays: number;
  notify: boolean;
  viewButton: TableButton;
  downloadButton: TableButton;
  switch: SwitchButtonType;
}

@Component( {
  selector: 'app-tenant-view',
  standalone: true,
  imports: [
    CommonModule,
    SkeletonLoaderComponent,
    CustomTableComponent,
    NotificationDialogComponent,
    ProgressBarComponent,
  ],
  templateUrl: './tenant-view.component.html',
  styleUrl: './tenant-view.component.scss',
} )
export class TenantViewComponent implements OnInit, AfterViewInit, OnDestroy {

  // ─────────────────────────────────────────────────────────────────────────────
  // ViewChild references
  // ─────────────────────────────────────────────────────────────────────────────

  @ViewChild( NotificationDialogComponent )
  protected notificationDialog!: NotificationDialogComponent;

  @ViewChild( ProgressBarComponent )
  protected progressBarComponent!: ProgressBarComponent;

  // ─────────────────────────────────────────────────────────────────────────────
  // General state
  // ─────────────────────────────────────────────────────────────────────────────

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  protected modeSub: Subscription | null = null;

  private tenantID: string = '';
  protected tenant: User | null = null;
  protected loggedUser: User | null = null;

  protected leases: Lease[] = [];
  protected leaseLength: number = 0; // kept if used in template
  protected tableVisible: boolean = false;

  protected isLoading: boolean = true;
  private readonly today: Date = new Date();

  // ─────────────────────────────────────────────────────────────────────────────
  // Tenant images / dummy images
  // ─────────────────────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────────────────────
  // Lease table – state / bindings
  // ─────────────────────────────────────────────────────────────────────────────

  private _leaseTableIsReloading: boolean = false;
  private _leaseTablePageSize: number = 2;
  private _leaseTablePageIndex: number = 0;
  private _leaseTabletSearch: string = '';
  private _leaseTableDateRang!: DateRange;

  protected leaseTableTotalCount: number = 0;
  protected leaseTableTitle: string = 'Lease';

  protected leaseTableFileExportExtension: FileExport[ 'extention' ] = 'xlsx';
  protected leaseTableData: LeaseTableDataType[] = [];

  /**
   * Columns mapping for CustomTableComponent.
   * Keys must match LeaseTableDataType or adapter used in the table.
   */
  protected leaseTableColumns: TableColumn[] = [
    { label: 'Image', key: 'propertyimage' },
    { label: 'Lease ID', key: 'leaseid' },
    { label: 'Date Range', key: 'daterange' },
    { label: 'Lease Status', key: 'status' },
    { label: 'Monthly Rent', key: 'monthlyRent' },
    { label: 'Remaining Days', key: 'remainingDays' },
    { label: 'View', key: 'viewButton' },
    { label: 'Download', key: 'downloadButton' },
    { label: 'Active', key: 'switch' },
  ];

  private _leaseSwitchButton: SwitchButtonType = {
    isActive: false,
    index: 0,
    on: 'ACTIVE',
    off: 'DEACTIVE',
  };

  /**
   * Properties fetched for each lease.
   * Used when building the table and exporting data.
   */
  private selectedProperties: BackEndPropertyData[] = [];

  // ─────────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────────

  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly apiService: APIsService,
    private readonly tenantService: TenantService,
    private readonly propertyService: PropertyService,
    private readonly authService: AuthService,
    private readonly dialog: MatDialog,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

    // Optional route URL subscription (currently not used, but kept)
    this.route.url.subscribe( ( segments ) => {
      const path = segments.map( ( s ) => s.path ).join( '/' );
      // console.log('Tenant view path:', path);
    } );

    // Listen to token param, then load all dependent data
    this.route.params.subscribe( async ( params ) => {
      this.tenantID = params[ 'tenantID' ];

      await this.loadTenantData();
      await this.getLeaseAgreementsUnderUsername();
      await this.loadSelectedProperties();
      await this.organizeLeaseTableData(
        this._leaseTablePageIndex,
        this._leaseTablePageSize,
      );
    } );

    this.loggedUser = this.authService.getLoggedUser;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ─────────────────────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val: boolean | null ) => {
        this.mode = val;
      } );
    }
  }

  ngAfterViewInit(): void {
    // Component view ready – no specific logic here yet
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lease table: getters / setters
  // ─────────────────────────────────────────────────────────────────────────────

  get leaseTableIsReloading(): boolean {
    return this._leaseTableIsReloading;
  }

  set leaseTableIsReloading( value: boolean ) {
    this._leaseTableIsReloading = value;

    if ( this._leaseTableIsReloading ) {
      void this.organizeLeaseTableData(
        this._leaseTablePageIndex,
        this._leaseTablePageSize,
      );
    }
  }

  get leaseTablePageSize(): number {
    return this._leaseTablePageSize;
  }

  set leaseTablePageSize( value: number ) {
    this._leaseTablePageSize = value;
    void this.organizeLeaseTableData(
      this._leaseTablePageIndex,
      this._leaseTablePageSize,
    );
  }

  get leaseTablePageIndex(): number {
    return this._leaseTablePageIndex;
  }

  set leaseTablePageIndex( value: number ) {
    this._leaseTablePageIndex = value;
    void this.organizeLeaseTableData(
      this._leaseTablePageIndex,
      this._leaseTablePageSize,
    );
  }

  get leaseTabletSearch(): string {
    return this._leaseTabletSearch;
  }

  set leaseTabletSearch( value: string ) {
    this._leaseTabletSearch = value.trim();
    void this.leaseSearch( this._leaseTabletSearch );
  }

  get leaseTableDateRang(): DateRange {
    return this._leaseTableDateRang;
  }

  set leaseTableDateRang( value: DateRange ) {
    this._leaseTableDateRang = value;
    void this.filterBaseOnDateRange( this._leaseTableDateRang );
  }

  get leaseSwitchButton(): SwitchButtonType {
    return this._leaseSwitchButton;
  }

  set leaseSwitchButton( value: SwitchButtonType ) {
    this._leaseSwitchButton = value;
    void this.handleUpdateLeaseStatus( this._leaseSwitchButton );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Shared helpers (error notification)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Centralised error notification to avoid repeated instanceof checks.
   */
  private notifyError(
    error: unknown,
    fallbackMessage: string,
  ): void {
    console.error( error );

    if ( error instanceof HttpErrorResponse ) {
      this.notificationDialog.notification( 'error', error.message );
      return;
    }

    if ( typeof error === 'string' ) {
      this.notificationDialog.notification( 'error', error );
      return;
    }

    if ( error instanceof Error ) {
      this.notificationDialog.notification( 'error', error.message );
      return;
    }

    this.notificationDialog.notification( 'error', fallbackMessage );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lease table: export
  // ─────────────────────────────────────────────────────────────────────────────

  protected handleExportLeaseTableData(
    value: FileExport,
  ): void {
    try {
      if ( this.leases.length === 0 ) {
        throw new Error( 'No lease agreements found!' );
      }

      if ( this.selectedProperties.length === 0 ) {
        throw new Error( 'No properties found!' );
      }

      const leasesWithProperty: LeaseWithProperty[] = [];

      this.leases.forEach( ( lease: Lease ) => {
        const property = this.selectedProperties.find(
          ( p ) => p.id === lease.propertyID,
        );

        if ( !property ) {
          throw new Error( 'Property not found!' );
        }

        const leaseWithProperty: LeaseWithProperty = {
          ...lease,
          property,
        };

        leasesWithProperty.push( leaseWithProperty );
      } );

      if ( leasesWithProperty.length === 0 ) {
        throw new Error( 'No leases with property found!' );
      }

      this.exportLeasesDataAsExcel(
        leasesWithProperty,
        value.extention,
      );
    } catch ( error ) {
      this.notifyError( error, 'Failed to load tenant data.' );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lease table: switch / update status
  // ─────────────────────────────────────────────────────────────────────────────

  private async handleUpdateLeaseStatus(
    data: SwitchButtonType,
  ): Promise<void> {
    try {
      this.isLoading = true;

      if ( !data ) {
        throw new Error( 'Invalid data from table!' );
      }

      const tableData: LeaseTableDataType = data.data as LeaseTableDataType;

      if ( !tableData ) {
        throw new Error( 'No table data found!' );
      }

      const leaseId = tableData.leaseid;

      if ( !leaseId ) {
        throw new Error( 'No lease ID found!' );
      }

      const filteredLease = this.leases.find(
        ( lease ) => lease.leaseID === leaseId,
      );

      if ( !filteredLease ) {
        throw new Error( 'Lease not found in the leases array!' );
      }

      const status: Lease[ 'systemMetadata' ][ 'validationStatus' ] =
        data.isActive ? 'active' : 'inactive';

      const formdata: FormData = new FormData();
      formdata.append( 'validationStatus', status );

      const res = await this.tenantService.getLeaseAgreementByIDAndUpdateValidationStatus(
        formdata,
        leaseId,
      );

      if ( !res.success || res.status !== 'success' ) {
        throw new Error( 'Failed to process lease status update!' );
      }

      const lease: Lease | undefined = res.data?.system?.lease;

      if ( !lease ) {
        throw new Error( 'Invalid updating lease agreement data!' );
      }

      const isActive: SwitchButtonType[ 'isActive' ] =
        lease.systemMetadata.validationStatus.toLowerCase() === 'active';

      filteredLease.systemMetadata.validationStatus =
        lease.systemMetadata.validationStatus;

      tableData.switch = {
        isActive,
        index: null,
        off: 'Inactive',
        on: 'Active',
      };

      tableData.status = lease.systemMetadata.validationStatus;

      if (
        typeof data.index !== 'number' ||
        !Number.isFinite( data.index )
      ) {
        throw new Error( 'Data index is invalid' );
      }

      this.leaseTableData[ data.index ] = tableData;
    } catch ( error ) {
      this.notifyError( error, 'Failed to update lease status!' );
    } finally {
      this.isLoading = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lease table: organisation / mapping
  // ─────────────────────────────────────────────────────────────────────────────

  private async organizeLeaseTableData(
    index: number,
    size: number,
  ): Promise<void> {
    try {
      if ( !this.leases || this.leases.length === 0 ) {
        throw new Error( 'No lease agreements found!' );
      }

      if ( !this.selectedProperties || this.selectedProperties.length === 0 ) {
        await this.loadSelectedProperties();

        if ( !this.selectedProperties || this.selectedProperties.length === 0 ) {
          throw new Error( 'No properties found!' );
        }
      }

      this.isLoading = true;

      this.leaseTableTotalCount = this.leases.length;

      const safeIndex: number = PaginationUtil.safeIndex(
        index,
        this.leaseTableTotalCount,
      );
      const safeSize: number = PaginationUtil.safeLimit(
        size,
        this.leaseTableTotalCount,
      );

      this._leaseTablePageIndex = safeIndex;
      this._leaseTablePageSize = safeSize;

      const safeStart: number = safeIndex * safeSize;
      const safeEnd: number = safeStart + safeSize;

      const organisingData: Lease[] = this.leases.slice(
        safeStart,
        safeEnd,
      );

      const leaseTableRows: LeaseTableDataType[] =
        await this.buildRowsForLeases( organisingData );

      if ( leaseTableRows.length === 0 ) {
        throw new Error( 'No lease table rows could be built!' );
      }

      this.leaseTableData = [ ...leaseTableRows ];
      this.tableVisible = this.leaseTableData.length > 0;
    } catch ( error ) {
      console.error( 'Error organizing lease table data:', error );
      this.notificationDialog.notification(
        'error',
        ( error as Error ).message ?? 'Failed to organise lease table.',
      );
    } finally {
      setTimeout( () => {
        this.isLoading = false;
      }, 500 );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lease table: search (across ALL leases)
  // ─────────────────────────────────────────────────────────────────────────────

  private async leaseSearch(
    search: string,
  ): Promise<void> {
    try {
      this.leaseTableData = [];

      const safeSearch: string = search.trim().toLowerCase();
      if ( !safeSearch ) {
        await this.organizeLeaseTableData(
          this._leaseTablePageIndex,
          this._leaseTablePageSize,
        );
        return;
      }

      const matchedLeases: Lease[] = this.leases.filter( ( item: Lease ) => {
        const leaseIdMatch: boolean =
          item.leaseID.trim().toLowerCase() === safeSearch;

        const propertyIdMatch: boolean =
          !!item.propertyID &&
          item.propertyID.trim().toLowerCase() === safeSearch;

        const tenantNameMatch: boolean =
          item.tenantInformation.fullName.trim().toLowerCase() === safeSearch;

        const tenantUsernameMatch: boolean =
          item.tenantInformation.tenantUsername
            .trim()
            .toLowerCase() === safeSearch;

        return (
          leaseIdMatch ||
          propertyIdMatch ||
          tenantNameMatch ||
          tenantUsernameMatch
        );
      } );

      if ( matchedLeases.length === 0 ) {
        this.leaseTableData = [];
        return;
      }

      const leaseTableRows: LeaseTableDataType[] =
        await this.buildRowsForLeases( matchedLeases );

      if ( leaseTableRows.length === 0 ) {
        await this.organizeLeaseTableData(
          this._leaseTablePageIndex,
          this._leaseTablePageSize,
        );
        return;
      }

      this.leaseTableData = [ ...leaseTableRows ];
    } catch ( err ) {
      console.error( '[Failed in lease search]: ', err );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lease table: filter by date range (correct overlap logic)
  // ─────────────────────────────────────────────────────────────────────────────

  private async filterBaseOnDateRange(
    range: DateRange,
  ): Promise<void> {
    try {
      if ( !Array.isArray( this.leases ) || this.leases.length === 0 ) {
        throw new Error( 'Leases are empty!' );
      }

      const startDate: Date = new Date( range.start ?? '' );
      const endDate: Date = new Date( range.end ?? '' );

      if (
        Number.isNaN( startDate.getTime() ) ||
        Number.isNaN( endDate.getTime() )
      ) {
        console.warn( 'Invalid date range input' );
        this.notificationDialog.notification(
          'warning',
          'Invalid date range input',
        );
        return;
      }

      const overlappingLeases: Lease[] = this.leases.filter(
        ( item: Lease ) => {
          const leaseStart: Date = new Date(
            item.leaseAgreement.startDate,
          );
          const leaseEnd: Date = new Date(
            item.leaseAgreement.endDate,
          );

          return leaseStart <= endDate && leaseEnd >= startDate;
        },
      );

      if ( overlappingLeases.length === 0 ) {
        console.warn( 'No leases matched the date range' );
        this.leaseTableData = [];
        return;
      }

      const filteredRows: LeaseTableDataType[] =
        await this.buildRowsForLeases( overlappingLeases );

      if ( filteredRows.length === 0 ) {
        console.warn(
          'Date matches found, but row building returned empty.',
        );
        this.notificationDialog.notification(
          'warning',
          'Date matches found, but row building returned empty.',
        );
        this.leaseTableData = [];
        return;
      }

      this.leaseTableData = [ ...filteredRows ];
    } catch ( error ) {
      console.error( '[Date Range Filter Error] ', error );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lease table: shared row builder (used by list, search, date filter)
  // ─────────────────────────────────────────────────────────────────────────────

  private async buildRowsForLeases(
    leases: Lease[],
  ): Promise<LeaseTableDataType[]> {
    const tasks: Array<Promise<LeaseTableDataType | null>> = leases.map(
      ( item: Lease ) => this.organiseTableRow( item ),
    );

    const rowsWithNulls: Array<LeaseTableDataType | null> =
      await Promise.all( tasks );

    const leaseTableRows: LeaseTableDataType[] = rowsWithNulls.filter(
      ( row ): row is LeaseTableDataType => row !== null,
    );

    return leaseTableRows;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lease table: build single row for the lease table
  // ─────────────────────────────────────────────────────────────────────────────

  private async organiseTableRow(
    item: Lease,
  ): Promise<LeaseTableDataType | null> {
    try {
      if ( !item ) {
        throw new Error( 'Invalid lease!' );
      }

      if ( !item.propertyID ) {
        throw new Error( 'Invalid property ID!' );
      }

      const res = await this.propertyService.getPropertySectionById(
        item.propertyID,
        [ 'images' ],
      );

      if ( !res.success || res.status.toLowerCase() !== 'success' ) {
        throw new Error( 'Failed to fetch section of the property!' );
      }

      const values = this.apiService.extractObjectFromOther<{
        images?: BackEndPropertyData[ 'images' ];
      }>( res.data, 'values' );

      if ( !values ) {
        throw new Error( 'Invalid value container!' );
      }

      const images: BackEndPropertyData[ 'images' ] | undefined =
        values.images;

      if ( !Array.isArray( images ) || images.length === 0 ) {
        throw new Error( 'No images found for property!' );
      }

      const image: string = images[ 0 ].imageURL;
      const leaseid: string = item.leaseID;

      const dateRange = {
        start: new Date( item.leaseAgreement.startDate ),
        end: new Date( item.leaseAgreement.endDate ),
      };

      const status: Lease[ 'systemMetadata' ][ 'validationStatus' ] =
        item.systemMetadata.validationStatus;

      const startDate = this.tenantService.asDate( dateRange.start );
      const endDate = this.tenantService.asDate( dateRange.end );

      if ( !startDate || !endDate ) {
        throw new Error( 'Invalid date range!' );
      }

      const today: Date = new Date();
      today.setHours( 0, 0, 0, 0 );

      const end: Date = new Date( endDate );
      end.setHours( 0, 0, 0, 0 );

      const msDiff: number = end.getTime() - today.getTime();
      const remainingDays: number = Math.ceil(
        msDiff / ( 1000 * 60 * 60 * 24 ),
      );

      const monthlyRent: string = `${ item.leaseAgreement.currency.currency } ${ item.leaseAgreement.monthlyRent }`;
      const notify: boolean = remainingDays <= 90;

      const viewButton: TableButton = {
        action: 'view',
        icon: 'visibility',
        label: 'View',
      };

      const downloadButton: TableButton = {
        action: 'download',
        icon: 'download',
        label: 'Download',
      };

      const switchBtn: SwitchButtonType = {
        index: null,
        isActive: status.toLowerCase() === 'active',
        off: 'Inactive',
        on: 'Active',
      };

      const data: LeaseTableDataType = {
        image,
        leaseid,
        dateRange,
        status,
        monthlyRent,
        remainingDays,
        notify,
        viewButton,
        downloadButton,
        switch: switchBtn,
      };

      return data;
    } catch ( err ) {
      console.error( err );
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lease table: action buttons (view / download)
  // ─────────────────────────────────────────────────────────────────────────────

  protected async actionButtonsOperation(
    value: TableButtonActionConfig,
  ): Promise<void> {
    try {
      const action: string = value.action;
      const data: LeaseTableDataType = value.data as LeaseTableDataType;

      if ( !action || !data ) {
        throw new Error( 'Invalid action or data from table' );
      }

      const leaseID: string = data.leaseid;
      if ( !leaseID ) {
        throw new Error( 'Invalid lease ID' );
      }

      switch ( action ) {
        case 'download':
          await this.downloadLease( leaseID );
          break;

        case 'view':
          await this.router.navigate( [
            '/dashboard/tenant/view-lease',
            leaseID,
          ] );
          break;
      }
    } catch ( error ) {
      this.notifyError( error, 'Failed to process lease action.' );
    } finally {
      this.progressBarComponent.complete();
    }
  }

  private async downloadLease(
    leaseID: string,
  ): Promise<void> {
    try {
      this.progressBarComponent.start();

      if ( this.authService.getLoggedUser === null ) {
        throw new Error( 'User not logged in' );
      }

      const blob: Blob =
        await this.tenantService.downloadLeaseAgreement(
          leaseID,
          'download',
          this.authService.getLoggedUser.username,
        );

      const actualName: string = `${ leaseID }-lease-agreement.pdf`;

      const nativeWindow: Window | null = this.windowRef.nativeWindow;
      if ( !nativeWindow ) {
        throw new Error( 'Window object is not available.' );
      }

      const fileURL: string = URL.createObjectURL( blob );
      const anchor: HTMLAnchorElement =
        nativeWindow.document.createElement( 'a' );

      anchor.href = fileURL;
      anchor.download = actualName;
      anchor.style.display = 'none';

      nativeWindow.document.body.appendChild( anchor );
      anchor.click();
      nativeWindow.document.body.removeChild( anchor );

      URL.revokeObjectURL( fileURL );
    } catch ( error ) {
      this.notifyError(
        error,
        'Failed to download lease agreement PDF.',
      );
    } finally {
      this.progressBarComponent.complete();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Data loading: properties used by leases
  // ─────────────────────────────────────────────────────────────────────────────

  private async loadSelectedProperties(): Promise<void> {
    try {
      if ( this.leases.length === 0 ) {
        throw new Error( 'No lease agreements found!' );
      }

      this.isLoading = true;

      const seen: Set<string> = new Set<string>();

      for ( const lease of this.leases ) {
        const propertyID: string | undefined = lease.propertyID;

        if ( !propertyID || seen.has( propertyID ) ) {
          continue;
        }

        try {
          const res = await this.propertyService.getPropertyById(
            propertyID,
          );

          if ( res.status !== 'success' ) {
            throw new Error( res.message ?? 'Failed to fetch property data!' );
          }

          const property: BackEndPropertyData | undefined = res.data?.system?.property;

          if ( !property ) {
            throw new Error( 'Invalid property!' );
          }

          this.selectedProperties.push( property );

          seen.add( property.id );

        } catch ( error: unknown ) {
          console.warn( 'Error fetching property:', error );
          if (
            error instanceof HttpErrorResponse &&
            error.status === 404
          ) {
            this.notificationDialog.notification(
              'error',
              'No property found for this lease.',
            );
          } else {
            this.notificationDialog.notification(
              'error',
              'Failed to fetch property.',
            );
          }
        }
      }
    } catch ( error ) {
      console.error( error );
      this.notificationDialog.notification(
        'error',
        'Failed to load selected properties.',
      );
    } finally {
      setTimeout( () => {
        this.isLoading = false;
      }, 500 );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Data loading: tenant
  // ─────────────────────────────────────────────────────────────────────────────

  private async loadTenantData(): Promise<void> {
    try {
      const res = await this.apiService.getUserByToken( this.tenantID );

      if ( res.status !== 'success' || !res.success ) {
        throw new Error( 'User data is missing from response.' );
      }

      const user: User | undefined = res.data?.system?.user;

      if ( !user ) {
        throw new Error( 'Invalid tenant data!' );
      }

      this.tenant = user;
    } catch ( error ) {
      console.error( 'Error loading tenant data:', error );
      this.notificationDialog?.notification?.(
        'error',
        'Failed to load tenant data. Please try again later.',
      );
    } finally {
      setTimeout( () => {
        this.isLoading = false;
      }, 500 );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Data loading: lease agreements for tenant
  // ─────────────────────────────────────────────────────────────────────────────

  private async getLeaseAgreementsUnderUsername(): Promise<void> {
    try {
      const username: string = this.tenant?.username || '';

      if ( !username ) {
        throw new Error( 'Tenant username is missing.' );
      }

      const res =
        await this.tenantService.getAllLeaseAgreementsByUsername(
          username,
        );

      if ( res.status === 'success' ) {
        const leases: Lease[] | undefined =
          res.data?.system?.leases;

        if ( !Array.isArray( leases ) ) {
          throw new Error( 'Invalid leases data in response.' );
        }

        this.leases = [ ...leases ];
        this.leaseLength = this.leases.length;
        await this.organizeLeaseTableData(
          this._leaseTablePageIndex,
          this._leaseTablePageSize,
        );
      } else {
        console.error( 'Failed to fetch lease agreements:', res.message );
        this.leases = [];
        this.notificationDialog.notification(
          'error',
          'Failed to fetch lease agreements. Please try again later.',
        );
      }
    } catch ( error: unknown ) {
      console.error( 'Error fetching lease agreements:', error );

      if (
        error instanceof HttpErrorResponse &&
        error.status === 404
      ) {
        this.notificationDialog.notification(
          'warning',
          'No lease agreements found for this tenant.',
        );
      } else {
        this.notificationDialog.notification(
          'error',
          'An error occurred while fetching lease agreements. Please try again later.',
        );
      }

      this.leases = [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Tenant image selection
  // ─────────────────────────────────────────────────────────────────────────────

  protected generateTenantImage(
    image: string,
    gender: string,
  ): string {
    try {
      const imageArray: string[] = image ? image.split( '/' ) : [];

      if ( Array.isArray( imageArray ) && imageArray.length > 0 ) {
        const lastSegment: string = imageArray[ imageArray.length - 1 ];
        const extension: string | undefined = lastSegment
          .split( '.' )
          .pop()
          ?.toLowerCase();

        if (
          extension &&
          this.definedImageExtentionArray.includes( extension )
        ) {
          this.definedImage = image;
        } else {
          this.definedImage =
            gender.toLowerCase() === 'male'
              ? this.definedMaleDummyImageURL
              : this.definedWomanDummyImageURL;
        }
      } else {
        this.definedImage =
          gender.toLowerCase() === 'male'
            ? this.definedMaleDummyImageURL
            : this.definedWomanDummyImageURL;
      }

      return this.definedImage;
    } catch ( error ) {
      console.error( 'Error generating tenant image:', error );

      return gender.toLowerCase() === 'male'
        ? this.definedMaleDummyImageURL
        : this.definedWomanDummyImageURL;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Navigation: go to lease creation
  // ─────────────────────────────────────────────────────────────────────────────

  protected async makeTenantLease(): Promise<void> {
    try {
      const token: string = await this.generateTokenForCurrentTenant();
      await this.router.navigate( [
        '/dashboard/tenant/create-lease',
        token,
      ] );
    } catch ( error ) {
      console.error(
        'Error while trying to create tenant lease:',
        error,
      );
      this.notificationDialog.notification(
        'error',
        'Unable to create tenant lease.',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Navigation: back to tenants dashboard
  // ─────────────────────────────────────────────────────────────────────────────

  protected async goToTenants(): Promise<void> {
    try {
      await this.router.navigateByUrl( '/', { skipLocationChange: true } );
      await this.router.navigate( [
        '/dashboard/tenant/tenant-home/',
      ] );
    } catch ( error ) {
      console.error( 'Navigation to tenants page failed:', error );
      this.notificationDialog.notification(
        'error',
        'Failed to navigate to the tenants page.',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Navigation: go to tenant view (by new token)
  // ─────────────────────────────────────────────────────────────────────────────

  protected async goToTenant(): Promise<void> {
    try {
      const token: string = await this.generateTokenForCurrentTenant();

      await this.router.navigateByUrl( '/', { skipLocationChange: true } );
      await this.router.navigate( [
        '/dashboard/tenant/tenant-view/',
        token,
      ] );
    } catch ( error ) {
      console.error( 'Navigation to tenant view failed:', error );
      this.notificationDialog.notification(
        'error',
        'Unable to load tenant view.',
      );
    }
  }

  /**
   * Shared helper for makeTenantLease / goToTenant
   */
  private async generateTokenForCurrentTenant(): Promise<string> {
    if ( !this.isBrowser ) {
      throw new Error( 'Not running in browser environment.' );
    }

    if ( !this.tenant || !this.tenant.username ) {
      throw new Error( 'Tenant information is missing.' );
    }

    const tokenResult = await this.apiService.generateToken(
      this.tenant.username,
    );

    if ( !tokenResult.success || tokenResult.status !== 'success' ) {
      throw new Error( 'Failed to generate tenant token.' );
    }

    const token: string | null =
      this.apiService.extractTokenFromMsg( tokenResult );

    if ( !token ) {
      throw new Error( 'Invalid token generated!' );
    }

    return token;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Export lease data as Excel
  // ─────────────────────────────────────────────────────────────────────────────

  private exportLeasesDataAsExcel(
    leases: LeaseWithProperty[],
    fileExtension: FileExport[ 'extention' ] = 'xlsx',
  ): void {
    if ( !Array.isArray( leases ) || leases.length === 0 ) {
      console.warn( 'No lease data available for export.' );
      return;
    }

    const exportData: Record<string, unknown>[] = leases.map(
      ( lease: LeaseWithProperty ) => {
        const addr = lease.property?.address;

        return {
          leaseID: lease.leaseID,
          'Tenant name': lease.tenantInformation?.fullName ?? '',
          'Tenant email': lease.tenantInformation?.email ?? '',
          'Tenant contact': lease.tenantInformation?.phoneNumber ?? '',
          'Co-Tenant name': lease.coTenant?.fullName ?? '',
          'Co-Tenant relationship': lease.coTenant?.relationship ?? '',
          'Property title': lease.property?.title ?? '',
          'Property address':
            ( addr?.houseNumber ?? '' ) +
            ' ' +
            ( addr?.street ?? '' ) +
            ', ' +
            ( addr?.city ?? '' ) +
            ', ' +
            ( addr?.stateOrProvince ?? '' ) +
            ', ' +
            ( addr?.country ?? '' ),
          'Started date': new Date(
            lease.leaseAgreement.startDate,
          ).toISOString(),
          'End date': new Date(
            lease.leaseAgreement.endDate,
          ).toISOString(),
          'Monthly rent': lease.leaseAgreement.monthlyRent,
          'Rent currency':
            lease.leaseAgreement.currency?.currency ?? '',
          'Payment frequency':
            lease.leaseAgreement.paymentFrequency?.name ?? '',
          'Payment method':
            lease.leaseAgreement.paymentMethod?.name ?? '',
          Deposit: lease.leaseAgreement.securityDeposit?.name ?? '',
          'Rent due date':
            lease.leaseAgreement.rentDueDate?.label ?? '',
          'Notice period':
            lease.leaseAgreement.noticePeriodDays?.label ?? '',
          'Late penalties':
            lease.leaseAgreement.latePaymentPenalties
              ?.map( ( p ) => p.label )
              .join( ',\n' ) ?? '',
          'Utility responsibilities':
            lease.leaseAgreement.utilityResponsibilities
              ?.map( ( u ) => `${ u.utility }: ${ u.paidBy }` )
              .join( ',\n' ) ?? '',
          'Rules and regulations':
            lease.rulesAndRegulations
              ?.map( ( r ) => r.rule )
              .join( ';\n' ) ?? '',
          'Tenant signature URL':
            ( lease.signatures.tenantSignature as any )?.URL ??
            '',
          'Landlord signature URL':
            ( lease.signatures.landlordSignature as any )?.URL ??
            '',
          'Signed At': new Date(
            lease.signatures.signedAt,
          ).toISOString(),
          'Signed By': lease.signatures.userAgent?.name ?? '',
          'ip Address': lease.signatures.ipAddress ?? '',
          ocrStatus: lease.systemMetadata.ocrAutoFillStatus
            ? 'Yes'
            : 'No',
          validationStatus: lease.systemMetadata.validationStatus,
          leaseTemplateVersion:
            lease.systemMetadata.leaseTemplateVersion,
          lastUpdated: lease.systemMetadata.lastUpdated,
        };
      },
    );

    const worksheet = XLSX.utils.json_to_sheet( exportData );

    worksheet[ '!cols' ] = Object.keys( exportData[ 0 ] ).map(
      ( key: string ) => ( {
        wch: key.length + 10,
      } ),
    );

    const workbook: XLSX.WorkBook = {
      Sheets: { LeaseData: worksheet },
      SheetNames: [ 'LeaseData' ],
    };

    const mimeMap: Record<string, string> = {
      xlsx:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      csv: 'text/csv',
      ods: 'application/vnd.oasis.opendocument.spreadsheet',
    };

    const bookType: XLSX.BookType = fileExtension as XLSX.BookType;
    const mimeType: string =
      mimeMap[ fileExtension ] || mimeMap[ 'xlsx' ];

    const excelBuffer: ArrayBuffer = XLSX.write( workbook, {
      bookType,
      type: 'array',
    } );

    const blob: Blob = new Blob( [ excelBuffer ], { type: mimeType } );

    FileSaver.saveAs(
      blob,
      `Lease_Batch_Export_${ new Date().toISOString() }.${ fileExtension }`,
    );
  }
}
