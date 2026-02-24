// Path: src/app/components/tabs/components/logged-data/logged-data.component.ts
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Inject,
  Input,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { GoogleChartsModule } from 'angular-google-charts';
import * as FileSaver from 'file-saver';
import * as XLSX from 'xlsx';

import { ActivityTrackerService } from '../../../../services/activityTacker/activity-tracker.service';
import { APIsService, User } from '../../../../services/APIs/apis.service';
import { PaginationUtil } from '../../../../source/utility/pagination.utils';

import {
  NotificationDialogComponent
} from '../../../dialogs/notificationBar/notificationBar.component';
import { SkeletonLoaderComponent } from '../../../shared/skeleton-loader/skeleton-loader.component';

import {
  CustomTableComponent,
  TableColumn,
  TableDateRange,
  TableExtension
} from '../../../shared/custom-table/custom-table.component';

import {
  ChartBuild,
  ChartService,
  PieEntry
} from '../../../../services/chartService/chart-service';

import {
  type DateRange,
  type PaginationMeta as PaginationType
} from '../../../../types/api-message.types';

interface TableData {
  ipAddress: string;
  date: string | Date;
  session?: string;
}

interface AllUsersLogin {
  username: string;
  loginCount: number;
}

interface UserLogEntry {
  username: string;
  ip: string;
  date: Date;
  session?: string;
}

interface UserTrackingData {
  username: string;
  totalCount: number;
  data: UserLogEntry[];
}

@Component( {
  selector: 'app-logged-data',
  standalone: true,
  imports: [
    CommonModule,
    NotificationDialogComponent,
    GoogleChartsModule,
    CustomTableComponent,
    SkeletonLoaderComponent
  ],
  templateUrl: './logged-data.component.html',
  styleUrl: './logged-data.component.scss',
} )
export class LoggedDataComponent implements OnInit, AfterViewInit {
  @ViewChild( NotificationDialogComponent, { static: true } )
  notification!: NotificationDialogComponent;

  private _user: User | null = null;

  @Input( { required: true } )
  set user( value: User | null ) {
    this._user = value;

    // When a new user comes in, reset pagination and reload data
    if ( this._user ) {
      this._index = 0;         // optional: reset to first page
      this._search = '';       // optional: clear search
      void this.dataInit( this._index, this._limit, this._search );
    }
  }

  get user(): User | null {
    return this._user;
  }

  protected isBrowser: boolean;

  private loggedUserTracking!: UserTrackingData;
  protected chart!: ChartBuild;

  // ─────────────────────────────────────────────────────────
  // Logged user table + pie chart state
  // ─────────────────────────────────────────────────────────
  private _isLoading: boolean = false;
  private _index: number = 0;
  private _limit: number = 10;
  private _search: string = '';
  private _dateRange: TableDateRange | null = null;

  protected total: number = 0;
  protected data: TableData[] = [];
  protected tableTitle: string = 'User login data table';

  protected columns: TableColumn[] = [
    { key: 'ipAddress', label: 'IP Address' },
    { key: 'date', label: 'Date' },
    { key: 'session', label: 'Session' }
  ];

  protected extension: TableExtension = 'xlsx';

  // For pie chart (and optional UI text)
  protected tableAllUsersLogingTimes: number = 0;
  protected tableUserLoggedTimes: number = 0;

  constructor (
    @Inject( PLATFORM_ID ) private platformId: Object,
    private readonly activityTrackerService: ActivityTrackerService,
    private readonly apiService: APIsService,
    private readonly chartService: ChartService,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
  }

  // ─────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    await this.dataInit( this._index, this._limit, this._search, this._dateRange );
  }

  ngAfterViewInit(): void {
    // nothing for now – kept for future use
  }

  // ─────────────────────────────────────────────────────────
  // Getters / Setters used by <app-custom-table>
  // ─────────────────────────────────────────────────────────

  get isLoading(): boolean {
    return this._isLoading;
  }
  set isLoading( value: boolean ) {
    this._isLoading = value;
    if ( this._isLoading ) {
      void this.dataInit( this._index, this._limit, this._search, this._dateRange );
    }
  }

  get index(): number {
    return this._index;
  }
  set index( value: number ) {
    this._index = value;
    void this.dataInit( this._index, this._limit, this._search, this._dateRange );
  }

  get limit(): number {
    return this._limit;
  }
  set limit( value: number ) {
    this._limit = value;
    void this.dataInit( this._index, this._limit, this._search, this._dateRange );
  }

  get search(): string {
    return this._search;
  }
  set search( value: string ) {
    this._search = value.trim();
    void this.dataInit( this._index, this._limit, this._search, this._dateRange );
  }

  get dateRange(): TableDateRange | null {
    return this._dateRange;
  }
  set dateRange( value: TableDateRange | null ) {
    this._dateRange = value;
    void this.dataInit( this._index, this._limit, this._search, this._dateRange );
  }

  // ─────────────────────────────────────────────────────────
  // Re-fetching
  // ─────────────────────────────────────────────────────────
  protected fetch() {
    if ( Array.isArray( this.data ) && this.data.length > 0 ) {
      return;
    }
    setTimeout( async () => ( void this.dataInit( this._index, this._limit, this._search, this._dateRange ) ), 0 );
  }
  // ─────────────────────────────────────────────────────────
  // Core loader
  // ─────────────────────────────────────────────────────────
  private async dataInit(
    index: number,
    limit: number,
    search?: string,
    dateRange?: TableDateRange | null
  ): Promise<void> {
    try {
      this._isLoading = true;
      this.data = [];

      if ( !this.user ) {
        throw new Error( 'Invalid user data!' );
      }

      const username = this.user.username.trim();

      // 1) Get total count for pagination
      const totalRes = await this.activityTrackerService.getTotalTrackingCount( username );

      if ( !totalRes?.success || !totalRes.data ) {
        throw new Error( 'Failed to fetch total count of login data under username!' );
      }

      const pagination: PaginationType | undefined = totalRes.data.pagination;

      if ( !pagination || pagination.total == null ) {
        throw new Error( 'Failed to fetch pagination!' );
      }

      if (
        Number.isNaN( pagination.total ) ||
        !Number.isFinite( pagination.total ) ||
        !Number.isInteger( pagination.total )
      ) {
        throw new Error( 'Invalid total number!' );
      }

      const total = pagination.total;
      this.total = total;

      const safeIndex = PaginationUtil.safeIndex( index, total );
      const safeLimit = PaginationUtil.safeLimit( limit, total );

      // Build DateRange only if we actually have a range
      let safeDateRange: DateRange | undefined;
      if ( dateRange?.start || dateRange?.end ) {
        safeDateRange = {
          start: typeof dateRange.start === 'string' ? dateRange.start : ( dateRange.start instanceof Date ? dateRange.start.toISOString() : new Date().toISOString() ),
          end: typeof dateRange.end === 'string' ? dateRange.end : ( dateRange.end instanceof Date ? dateRange.end.toISOString() : new Date().toISOString() ),
        };
      }

      const safeSearch = search?.trim() || undefined;

      // 2) Fetch tracking data
      const trackingRes = await this.activityTrackerService.getLoggedUserTracking(
        safeIndex,
        safeLimit,
        username,
        safeDateRange,
        safeSearch
      );


      if ( !trackingRes.success || !trackingRes.data || trackingRes.status !== 'success' ) {
        throw new Error( 'Failed to fetch user tracking!' );
      }


      const userTrackingData: UserTrackingData | null =
        this.apiService.extractObjectFromOther<{
          username: string;
          totalCount: number;
          data: UserLogEntry[];
        }>( trackingRes.data, 'userTrackingData' );

      const allUsersLogin: AllUsersLogin[] | null =
        this.apiService.extractArrayFromOther<{
          username: string;
          loginCount: number;
        }>( trackingRes.data, 'allUsersLogin' );


      const totalLoginCount: number | null =
        this.apiService.extractNumberFromOther( trackingRes.data, 'totalLoginCount' );

      if ( !userTrackingData ) {
        throw new Error( 'Invalid user tracking data!' );
      }

      if ( !totalLoginCount ||
        Number.isNaN( totalLoginCount ) ||
        !Number.isFinite( totalLoginCount ||
          !Number.isInteger( totalLoginCount )
        ) ) {
        throw new Error( 'Invalid all users total login count' );
      }

      if ( !allUsersLogin ||
        !Array.isArray( allUsersLogin ) ||
        allUsersLogin.length === 0 ) {
        throw new Error( 'Invalid all user tracking data!' );
      }


      // 3) Map to table data
      this.data = userTrackingData.data.map( ( item: UserLogEntry ): TableData => ( {
        ipAddress: item.ip,
        date: new Date( item.date ),
        session: item.session ?? ''
      } ) );


      this.loggedUserTracking = userTrackingData;

      // 4) Build chart
      this.generateChart( allUsersLogin, totalLoginCount );
    } catch ( error ) {
      console.error( 'Error retrieving login tracking data:', error );
      // optionally show notification via this.notification
    } finally {
      setTimeout( () => {
        this._isLoading = false;
      }, 500 );
    }
  }

  // ─────────────────────────────────────────────────────────
  // Export
  // ─────────────────────────────────────────────────────────
  protected exportToExcel(): void {
    if ( !this.loggedUserTracking?.data ) {
      return;
    }

    const exportData = this.loggedUserTracking.data.map( ( row ) => ( {
      Username: row.username,
      'IP Address': row.ip,
      Date: row.date,
      Session: row.session ?? ''
    } ) );

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet( exportData );
    const workbook: XLSX.WorkBook = {
      Sheets: { 'User Login Data': worksheet },
      SheetNames: [ 'User Login Data' ],
    };

    const excelBuffer: ArrayBuffer = XLSX.write( workbook, {
      bookType: 'xlsx',
      type: 'array',
    } );

    const blobData: Blob = new Blob( [ excelBuffer ], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } );

    FileSaver.saveAs(
      blobData,
      `User_Login_Data_Export_${ new Date().toISOString() }.xlsx`
    );
  }

  // ─────────────────────────────────────────────────────────
  // Chart builder
  // ─────────────────────────────────────────────────────────
  private generateChart( data: AllUsersLogin[], total: number ): void {
    try {
      if ( !this.user ) {
        throw new Error( 'Invalid user data!' );
      }

      if ( !Array.isArray( data ) || data.length === 0 ) {
        throw new Error( 'Invalid array of data' );
      }

      if ( total <= 0 ) {
        throw new Error( 'Total login count must be greater than zero' );
      }

      const username = this.user.username.trim();

      const myLogin: AllUsersLogin | undefined =
        data.find( ( item ) => item.username === username );

      const otherLogins: AllUsersLogin[] =
        data.filter( ( item ) => item.username !== username );

      if ( !myLogin ) {
        throw new Error( 'No login entries found for the current user' );
      }

      const allLogingCountWithoutMe: number =
        otherLogins.reduce( ( sum, item ) => sum + item.loginCount, 0 );

      const myCount: number = myLogin.loginCount;

      const allOtherPercentage: number =
        ( allLogingCountWithoutMe / total ) * 100;

      const myPercentage: number =
        ( myCount / total ) * 100;

      // update exposed counters for template (if you use them)
      this.tableAllUsersLogingTimes = allLogingCountWithoutMe;
      this.tableUserLoggedTimes = myCount;

      const chartData: PieEntry[] = [
        { label: 'All Users', value: allOtherPercentage },
        { label: 'Me', value: myPercentage },
      ];

      this.chart = this.chartService.buildPie3D(
        'User login compared to others',
        chartData,
        {
          legend: { position: 'right' },
          pieSliceText: 'percentage',
          width: 420,
          height: 280,
          tooltip: { isHtml: true },
        },
      );
    } catch ( error ) {
      console.error( 'Error generating chart:', error );
    }
  }
}
