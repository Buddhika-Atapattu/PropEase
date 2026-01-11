// Path: src/app/components/tabs/documents/documents.component.ts

import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';

import {
  APIsService,
  User,
} from '../../../services/APIs/apis.service';
import { AuthService } from '../../../services/auth/auth.service';
import { DownloadService } from '../../../services/downloadService/download.service';

import { PaginationUtil } from '../../../source/utility/pagination.utils';
import type {
  UploadedFile,
  UserDocumentEntity,
} from '../../../types/api-message.types';

import {
  NotificationDialogComponent,
} from '../../dialogs/notificationBar/notificationBar.component';
import { ProgressBarComponent } from '../../dialogs/progress-bar/progress-bar.component';
import {
  CustomTableComponent,
  TableButton,
  TableButtonActionConfig,
  TableColumn,
  TableExtension,
} from '../../shared/custom-table/custom-table.component';
import { Dropdown } from '../../shared/dropdown/dropdown';

/** Row shape for custom table */
interface TableData {
  icon: string;              // mime/type or extension → mapped to icon in table
  fileType: string;          // human-readable type (mime/type or extension)
  fileName: string;
  uploaded: Date;
  downloadButton: TableButton;
  fullFile: UploadedFile;    // keep original file object for download
}

@Component( {
  selector: 'app-documents',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    CustomTableComponent,
    Dropdown,
    NotificationDialogComponent,
    ProgressBarComponent,
    MatTooltipModule
  ],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss',
} )
export class DocumentsComponent implements OnInit {
  // ─────────────────────────────────────────────────────────────
  // View children (notification + progress bar)
  // ─────────────────────────────────────────────────────────────

  @ViewChild( NotificationDialogComponent, { static: true } )
  notification!: NotificationDialogComponent;

  @ViewChild( ProgressBarComponent, { static: true } )
  progress!: ProgressBarComponent;

  @ViewChild( Dropdown, { static: true } ) dropDown !: Dropdown;

  // ─────────────────────────────────────────────────────────────
  // Input: user whose documents we manage
  // ─────────────────────────────────────────────────────────────

  private _user: User | null = null;
  private initialized = false; // to avoid double fetch on first render

  @Input( { required: true } )
  set user( value: User | null ) {
    this._user = value;

    // Before ngOnInit: just store, ngOnInit will do the first fetch
    if ( !this.initialized ) return;

    // After component is initialized:
    // when parent changes user (e.g., different profile),
    // reset pagination and reload documents for the new user.
    if ( this._user ) {
      this.resetPaging();
      void this.fetch();
    } else {
      // No user → clear table
      this.total = 0;
      this.data = [];
    }
  }

  get user(): User | null {
    return this._user;
  }

  // ─────────────────────────────────────────────────────────────
  // Local state: uploads + table
  // ─────────────────────────────────────────────────────────────

  /** Files selected for upload (local, not yet sent) */
  private selectedFiles: File[] = [];

  /** Table + loading state (driven by custom table bindings) */
  private _isLoading = false;
  private _index = 0;
  private _limit = 10;
  private _search = '';

  protected tableTitle = "User's files";
  protected total = 0;
  protected extension: TableExtension = 'xlsx';

  protected data: TableData[] = [];

  protected columns: TableColumn[] = [
    { key: 'icon', label: 'Icon' },
    { key: 'fileType', label: 'File Type' },
    { key: 'fileName', label: 'File Name' },
    { key: 'uploaded', label: 'Uploaded' },
    { key: 'downloadButton', label: 'Download' },
  ];

  // ─────────────────────────────────────────────────────────────
  // DI
  // ─────────────────────────────────────────────────────────────

  public constructor (
    private readonly apiService: APIsService,
    private readonly authService: AuthService,
    private readonly downloadService: DownloadService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  public async ngOnInit(): Promise<void> {
    this.initialized = true;

    // If user was already bound before OnInit, load documents once.
    if ( this.user ) {
      await this.fetch();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Getters / setters (bound to <app-custom-table>)
  // ─────────────────────────────────────────────────────────────

  get isLoading(): boolean {
    return this._isLoading;
  }

  set isLoading( value: boolean ) {
    this._isLoading = value;
    // Table can toggle this to request a reload
    if ( value ) {
      void this.fetch();
    }
  }

  get index(): number {
    return this._index;
  }
  set index( value: number ) {
    this._index = value;
    void this.fetch();
  }

  get limit(): number {
    return this._limit;
  }
  set limit( value: number ) {
    this._limit = value;
    void this.fetch();
  }

  get search(): string {
    return this._search;
  }
  set search( value: string ) {
    this._search = value.trim();
    void this.fetch();
  }

  /** Helper to reset pagination/search when user changes */
  private resetPaging(): void {
    this._index = 0;
    this._search = '';
  }

  /** Called by table’s `fetchData` output or by setters above */
  protected async fetch(): Promise<void> {
    // If there is no user yet, do nothing – retry logic in table will handle later.
    if ( !this.user ) return;
    await this.dataInit( this._index, this._limit, this._search );
  }

  // ─────────────────────────────────────────────────────────────
  // Data init (load + paginate + search)
  // ─────────────────────────────────────────────────────────────

  private async dataInit(
    index: number,
    limit: number,
    search?: string,
  ): Promise<void> {
    try {
      this._isLoading = true;
      this.data = [];

      if ( !this.user ) {
        throw new Error( 'Invalid user data!' );
      }

      const username = this.user.username.trim();
      const res = await this.apiService.getUserDocuments( username );

      if ( !res.success || res.status !== 'success' ) {
        this.notification.notification( 'error', 'Failed to fetch user document data!' );
        throw new Error( 'Failed to fetch user document data!' );
      }


      const documentEntity: UserDocumentEntity | null =
        res.data?.system?.fileUpload ?? null;

      if ( !documentEntity ) {
        this.total = 0;
        this.data = [];
        this.notification.notification( 'warning', 'No document data found for user.' );
        return;
      }

      const files: UploadedFile[] = this.sortFilesByUploadDate( documentEntity.files, true ) ?? [];

      if ( !Array.isArray( files ) || files.length === 0 ) {
        // No files → keep table empty but not an error
        this.total = 0;
        this.data = [];
        return;
      }

      // Total count (for paginator, before filtering)
      const total = files.length;
      this.total = total;

      // Safe pagination boundaries
      const safeIndex = PaginationUtil.safeIndex( index, total );
      const safeLimit = PaginationUtil.safeLimit( limit, total );
      const safeStart = safeIndex * safeLimit;
      const safeEnd = safeStart + safeLimit;

      const safeSearch = search ? search.trim().toLowerCase() : undefined;

      let filteredFiles: UploadedFile[] = files;

      // Apply search on originalName / storedName
      if ( safeSearch ) {
        filteredFiles = files.filter( ( item: UploadedFile ) => {
          const original = ( item.originalName ?? '' ).toLowerCase();
          const stored = ( item.storedName ?? '' ).toLowerCase();
          return original.includes( safeSearch ) || stored.includes( safeSearch );
        } );
      }

      // Recompute total for filtered results
      const effectiveTotal = filteredFiles.length;
      this.total = effectiveTotal;

      const pagedFiles = filteredFiles.slice( safeStart, safeEnd );

      this.data = pagedFiles.map( ( file: UploadedFile ) =>
        this.buildTableRowFromFile( file ),
      );
    } catch ( error ) {
      console.error( '[DocumentsComponent] Error in dataInit:', error );
    } finally {
      this._isLoading = false;
    }
  }

  /**
 * Organize UploadedFile[] by uploadDate.
 * @param files - array of UploadedFile
 * @param newestFirst - true = newest first, false = oldest first
 */
  private sortFilesByUploadDate(
    files: UploadedFile[],
    newestFirst: boolean = true
  ): UploadedFile[] {

    // 1. Convert to safe comparable timestamps
    const withSafeDates = files.map( f => {
      const ts = f.uploadDate ? new Date( f.uploadDate ).getTime() : 0;
      return { ...f, __ts: ts };
    } );

    // 2. Sort
    withSafeDates.sort( ( a, b ) => {
      return newestFirst
        ? b.__ts - a.__ts  // Newest first
        : a.__ts - b.__ts; // Oldest first
    } );

    // 3. Cleanup and return final
    return withSafeDates.map( ( { __ts, ...rest } ) => rest );
  }

  /** Build a single row for the table from an UploadedFile */
  private buildTableRowFromFile( file: UploadedFile ): TableData {
    const uploadedDate = file.uploadDate ? new Date( file.uploadDate ) : new Date();

    const downloadButton: TableButton = {
      icon: 'download',
      action: 'download',
      label: 'Download',
    };

    return {
      icon: file.mimeType ?? file.extension ?? 'file',
      fileType: file.mimeType ?? file.extension ?? 'unknown',
      fileName: file.originalName ?? file.storedName ?? 'unknown',
      uploaded: uploadedDate,
      downloadButton,
      fullFile: file,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Table button centre
  // ─────────────────────────────────────────────────────────────

  protected async buttonCentra(
    value: TableButtonActionConfig,
  ): Promise<void> {
    try {
      if ( !value.action || !value.data ) {
        throw new Error( 'Invalid table button payload!' );
      }

      const action: TableButtonActionConfig[ 'action' ] = value.action;
      const row: TableData = value.data as TableData;

      switch ( action ) {
        case 'download': {
          const fullFile = row.fullFile;
          const url = fullFile.URL;
          const name = fullFile.originalName ?? fullFile.storedName;

          if ( !url || !name ) {
            this.notification.notification( 'warning', 'Unsupported file download!' );
            throw new Error( 'Unsupported file download!' );
          }

          await this.downloadService.downloadFromUrl( url, name );
          break;
        }

        default:
          // For future actions (view, delete, etc.)
          return;
      }
    } catch ( error ) {
      console.error( '[DocumentsComponent] buttonCentra error:', error );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // File selection (upload)
  // ─────────────────────────────────────────────────────────────

  protected filesAdded( files: File[] ): void {
    if ( !Array.isArray( files ) || files.length === 0 ) {
      return;
    }
    this.selectedFiles.push( ...files );
  }

  // ─────────────────────────────────────────────────────────────
  // Submit upload
  // ─────────────────────────────────────────────────────────────

  protected async submit(): Promise<void> {
    try {
      if ( this.selectedFiles.length === 0 ) {
        this.notification.notification( 'warning', 'No files selected to upload.' );
        throw new Error( 'Empty array of files!' );
      }

      if ( !this.user ) {
        throw new Error( 'Invalid user!' );
      }

      if ( !this.authService.getLoggedUser ) {
        this.authService.clearCredentials();
        throw new Error( 'Invalid login!' );
      }

      const uploaderUsername = this.authService.getLoggedUser.username;
      const targetUsername = this.user.username;

      const formData = new FormData();

      this.progress.start();

      formData.append( 'username', targetUsername );
      formData.append( 'uploader', uploaderUsername );

      for ( const file of this.selectedFiles ) {
        formData.append( 'files', file, file.name );
      }

      const res = await this.apiService.uploadDocuments( formData, targetUsername );

      if ( !res.success || res.status !== 'success' ) {
        this.notification.notification(
          'error',
          'Failed to upload selected documents.',
        );
        throw new Error( 'Failed to upload selected documents' );
      }

      this.notification.notification(
        'success',
        'Successfully uploaded documents.',
      );

      // Reload list after successful upload
      this.selectedFiles = [];
      await this.fetch();
    } catch ( error ) {
      console.error( '[DocumentsComponent] submit error:', error );
      this.progress.stop();
    } finally {
      this.progress.complete();
      this.selectedFiles = [];
      this.dropDown.clear();
      await this.fetch();
    }
  }
}
