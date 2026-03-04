// Path: src/app/components/tabs/components/user-creation-management/user-creation-management.component.ts

import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit
} from '@angular/core';
import { Router } from '@angular/router';

import * as FileSaver from 'file-saver';
import * as XLSX from 'xlsx';

import { ActivityTrackerService } from '../../../../services/activityTacker/activity-tracker.service';
import { APIsService, User } from '../../../../services/APIs/apis.service';
import { PaginationUtil } from '../../../../source/utility/pagination.util';

import {
  CustomTableComponent,
  TableButton,
  TableColumn,
  TableExtension,
  type TableButtonActionConfig
} from '../../../shared/custom-table/custom-table.component';



// ───────────────────────────────────────────────────────────────
// Local Table Row Type
// ───────────────────────────────────────────────────────────────
interface Data {
  userimage: string;
  name: string;
  username: string;
  gender: string;
  email: string;
  phoneNumber: string;
  role: string;
  isactive: boolean;
  createdAt: Date;
  updatedAt: Date;
  viewButton: TableButton;
}


@Component( {
  selector: 'app-user-creatinon-management',
  standalone: true,
  imports: [
    CommonModule,
    CustomTableComponent
  ],
  templateUrl: './user-creatinon-management.component.html',
  styleUrl: './user-creatinon-management.component.scss',
} )
export class UserCreatinonManagementComponent
  implements OnInit, OnChanges, AfterViewInit, OnDestroy {

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

  // ───────────────────────────────────────────────────────────────
  // Table + Pagination State
  // ───────────────────────────────────────────────────────────────
  private _isLoading = false;
  private _index = 0;
  private _limit = 10;
  private _search = '';

  protected tableTitle = 'Users';
  protected extension: TableExtension = 'xlsx';
  protected total = 0;

  protected data: Data[] = [];

  protected columns: TableColumn[] = [
    { key: 'userimage', label: 'Image' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phoneNumber', label: 'Contact' },
    { key: 'role', label: 'Role' },
    { key: 'isactive', label: 'Status' },
    { key: 'createdAt', label: 'Created At' },
    { key: 'updatedAt', label: 'Updated At' },
    { key: 'viewButton', label: 'View' },
  ];


  constructor (
    private readonly activityTrackerService: ActivityTrackerService,
    private readonly router: Router,
    private readonly apiService: APIsService,
  ) {}


  // ───────────────────────────────────────────────────────────────
  // Lifecycle Hooks
  // ───────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {}

  ngOnChanges(): void {}

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {}


  // ───────────────────────────────────────────────────────────────
  // GETTERS / SETTERS → Auto-trigger dataInit()
  // ───────────────────────────────────────────────────────────────

  get isLoading(): boolean {
    return this._isLoading;
  }
  set isLoading( value: boolean ) {
    this._isLoading = value;
    if ( this._isLoading ) {
      void this.dataInit( this._index, this._limit, this._search );
    }
  }

  get index(): number {
    return this._index;
  }
  set index( value: number ) {
    this._index = value;
    void this.dataInit( this._index, this._limit, this._search );
  }

  get limit(): number {
    return this._limit;
  }
  set limit( value: number ) {
    this._limit = value;
    void this.dataInit( this._index, this._limit, this._search );
  }

  get search(): string {
    return this._search;
  }
  set search( value: string ) {
    this._search = value.trim();
    void this.dataInit( this._index, this._limit, this._search );
  }

  protected async fetch(): Promise<void> {
    if ( Array.isArray( this.data ) && this.data.length > 0 ) {
      return;
    }
    setTimeout( () => ( void this.dataInit( this._index, this._limit, this._search ) ), 0 );
  }


  // ───────────────────────────────────────────────────────────────
  // DATA LOADING
  // ───────────────────────────────────────────────────────────────

  private async dataInit(
    index: number,
    limit: number,
    search?: string,
  ): Promise<void> {
    try {
      this._isLoading = true;
      this.data = [];

      // Guard: User required
      if ( !this.user ) {
        throw new Error( 'Invalid user data!' );
      }

      const username = this.user.username.trim();

      // ───────────────────────────────────────────
      // 1) Get total count metadata
      // ───────────────────────────────────────────
      const totalRes = await this.activityTrackerService.getTotalOfCreatedUsersBasedOnCreator( username );

      if ( !totalRes.success || totalRes.status !== 'success' ) {
        throw new Error( 'Failed to fetch total count of created users!' );
      }

      const total: number | undefined = totalRes.data?.pagination?.total;

      if ( !total || !Number.isFinite( total ) || !Number.isInteger( total ) || Number.isNaN( total ) ) {
        throw new Error( 'Invalid total number!' );
      }

      this.total = total;

      // Safe pagination values
      const safeIndex = PaginationUtil.safeIndex( index, total );
      const safeLimit = PaginationUtil.safeLimit( limit, total );
      const safeSearch = search?.trim() || undefined;


      // ───────────────────────────────────────────
      // 2) Fetch paged results
      // ───────────────────────────────────────────
      const trackingRes = await this.activityTrackerService.getCreatedUsersBasedOnCreator(
        username,
        safeIndex,
        safeLimit,
        safeSearch
      );



      if ( !trackingRes.success || !trackingRes.data ) {
        throw new Error( 'Failed to fetch user tracking data!' );
      }

      const users = trackingRes.data.system?.users;
      if ( !Array.isArray( users ) ) {
        throw new Error( 'Invalid users array!' );
      }

      // ───────────────────────────────────────────
      // 3) Convert to table row model
      // ───────────────────────────────────────────

      const tableData: Data[] = [];

      users.map( ( user ) => {

        const phoneNumber = `${ user.phoneNumber?.code.code }-${ user.phoneNumber?.number }`;

        const data: Data = {
          userimage: user.image as string,
          username: user.username,
          name: user.name,
          email: user.email,
          phoneNumber,
          gender: user.gender,
          role: user.role,
          isactive: user.isActive,
          createdAt: new Date( user.createdAt ),
          updatedAt: new Date( user.updatedAt ),
          viewButton: {
            icon: 'visibility',
            action: 'view',
            label: 'View'
          }
        };

        tableData.push( data );
      } );

      if ( !Array.isArray( tableData ) || tableData.length === 0 ) {
        throw new Error( 'Failed to create user array!' );
      }

      this.data = [ ...tableData ];


    } catch ( error ) {
      console.error( 'Error retrieving created users:', error );
    } finally {
      setTimeout( () => {
        this._isLoading = false;
      }, 500 );
    }
  }


  // ───────────────────────────────────────────────────────────────
  // EXPORT TO EXCEL
  // ───────────────────────────────────────────────────────────────

  protected exportToExcel(): void {
    const exportData = this.data.map( ( row ) => ( {
      Name: row.name,
      Email: row.email,
      Gender: row.gender,
      Image: row.userimage,
      'Phone Number': row.phoneNumber,
      Role: row.role,
      'Is Active': row.isactive ? 'Active' : 'Deactive',
      'Created At': row.createdAt.toLocaleString(),
      'Updated At': row.updatedAt.toLocaleString(),
    } ) );

    const worksheet = XLSX.utils.json_to_sheet( exportData );
    const workbook: XLSX.WorkBook = {
      Sheets: { 'User Files': worksheet },
      SheetNames: [ 'User Files' ],
    };

    const excelBuffer = XLSX.write( workbook, {
      bookType: 'xlsx',
      type: 'array',
    } );

    const blobData = new Blob( [ excelBuffer ], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } );

    FileSaver.saveAs(
      blobData,
      `User_Creation_Export_${ new Date().toISOString() }.xlsx`
    );
  }

  // ───────────────────────────────────────────────────────────────
  // VIEW USER
  // ───────────────────────────────────────────────────────────────
  protected async buttonCentra( value: TableButtonActionConfig ): Promise<void> {
    try {
      if ( !value.action || !value.data ) {
        throw new Error( 'Invalid value!' );
      }
      const action: TableButtonActionConfig[ 'action' ] = value.action;
      const data: Data = value.data;
      const username = data.username;

      switch ( action ) {
        case 'view':
          const tokenRes = await this.apiService.generateToken( username );
          if ( !tokenRes.success ) {
            throw new Error( 'Faild to make token!' );
          }
          const token: string | null = this.apiService.extractTokenFromMsg( tokenRes );

          if ( !token ) {
            throw new Error( 'Invalid token!' );
          }

          await this.router.navigate( [ '/dashboard/users/user-profile', token ] );

          return;
          break;
        default:
          return;
      }

    }
    catch ( error ) {
      console.error( error );
    }
  }
}
