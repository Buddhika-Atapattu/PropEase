import {
  AfterViewInit,
  Component,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { ProgressBarComponent } from '../../../dialogs/progress-bar/progress-bar.component';
import { NotificationComponent } from '../../../dialogs/notification/notification.component';
import { BaseUser } from '../../../../../services/auth/auth.service';
import { WindowsRefService } from '../../../../../services/windowRef.service';
import { ActivityTrackerService } from '../../../../../services/activityTacker/activity-tracker.service';

import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { Sort, MatSortModule, MatSort } from '@angular/material/sort';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SkeletonLoaderComponent } from '../../../shared/skeleton-loader/skeleton-loader.component';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';

interface Data {
  URL: string;
  download: string;
  extension: string;
  mimeType: string;
  originalName: string;
  path: string;
  size: number;
  storedName: string;
  uploader: string;
  uploadDate: Date;
  username: string;
}

@Component({
  selector: 'app-user-file-management',
  imports: [
    CommonModule,
    MatIconModule,
    SkeletonLoaderComponent,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatAutocompleteModule,
    FormsModule,
    ReactiveFormsModule,
    NotificationComponent,
    ProgressBarComponent,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatMomentDateModule,
    MatSelectModule,
    MatDividerModule,
    MatDialogModule,
    MatDatepickerModule,
    MatTooltipModule,
  ],
  templateUrl: './user-file-management.component.html',
  styleUrl: './user-file-management.component.scss',
})
export class UserFileManagementComponent
  implements OnInit, OnChanges, AfterViewInit, OnDestroy
{
  @ViewChild(ProgressBarComponent, { static: true })
  progress!: ProgressBarComponent;
  @ViewChild(NotificationComponent, { static: true })
  notification!: NotificationComponent;

  @Input() user: BaseUser | null = null;
  @Input() loggedUser: BaseUser | null = null;
  @Input() mode: boolean | null = null;

  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected isActive: boolean = false;
  protected isLoading: boolean = true;
  protected username: string = '';

  //Table variables
  protected dataSource = new MatTableDataSource<Data>();

  // Core pagination variables
  protected start: number = 0; // API offset (e.g., start=10 for page 2 with limit=10)
  protected currentPage: number = 1; // Current visible page number
  protected limit: number = 10; // Items per page
  protected totalRecords: number = 0; // Total number of records from backend
  protected pageStart: number = 1; // Calculated visible start of page button range
  protected pageEnd: number = 1; // Calculated visible end of page button range
  protected startDate: Date | null = null;
  protected endDate: Date | null = null;
  protected isPaginationDisabled: boolean = false;

  protected isTableEmpty: boolean = false;
  protected displayedColumns: string[] = [
    'Original Name',
    'Uploader',
    'UploadDate',
    'Username',
    'Download',
  ];

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private activityTrackerService: ActivityTrackerService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.registerCustomIcons();
  }

  async ngOnInit(): Promise<void> {
    this.apiCall(this.start, this.limit);
  }

  ngOnChanges(): void {}

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {}

  public async refresh(username: string): Promise<void> {
    this.username = username;
    this.currentPage = 1;
    const offset = 0;
    await this.apiCall(offset, this.limit);
  }

  private registerCustomIcons(): void {
    const iconMap = {
      document: 'documents.svg',
      fileExcel: 'fileExcel.svg',
      search: 'search.svg',
      reset: 'reset.svg',
      download: 'download.svg',
      eye: 'eye',
      upload: 'upload.svg',
      pdf: 'file-types/pdf.svg',
      txt: 'file-types/txt.svg',
      xml: 'file-types/xml.svg',
      excel: 'file-types/excel.svg',
      word: 'file-types/word.svg',
      powerpoint: 'file-types/powerpoint.svg',
      zip: 'file-types/zip.svg',
      file: 'file-types/file-empty.svg',
      jpeg: 'file-types/jpeg.svg',
      png: 'file-types/png.svg',
      webp: 'file-types/webp.svg',
      gif: 'file-types/gif.svg',
      jpg: 'file-types/jpg.svg',
      ico: 'file-types/ico.svg',
      svg: 'file-types/svg.svg',
      image: 'file-types/image.svg',
    };

    for (const [name, path] of Object.entries(iconMap)) {
      this.matIconRegistry.addSvgIcon(
        name,
        this.domSanitizer.bypassSecurityTrustResourceUrl(
          `/Images/Icons/${path}`
        )
      );
    }
  }

  protected chooceIcon(type: string): string {
    switch (type) {
      case 'doc':
        return 'word';
      case 'docx':
        return 'word';
      case 'dot':
        return 'word';
      case 'dotx':
        return 'word';
      case 'rtf':
        return 'word';
      case 'odt':
        return 'word';
      case 'txt':
        return 'txt';
      case 'xml':
        return 'xml';
      case 'xls':
        return 'excel';
      case 'xlsx':
        return 'excel';
      case 'xlsm':
        return 'excel';
      case 'xlt':
        return 'excel';
      case 'xltx':
        return 'excel';
      case 'ods':
        return 'excel';
      case 'csv':
        return 'excel';
      case 'tsv':
        return 'excel';
      case 'ppt':
        return 'powerpoint';
      case 'pptx':
        return 'powerpoint';
      case 'pptm':
        return 'powerpoint';
      case 'pot':
        return 'powerpoint';
      case 'potx':
        return 'powerpoint';
      case 'odp':
        return 'powerpoint';
      case 'pdf':
        return 'pdf';
      case 'zip':
        return 'zip';
      case 'png':
        return 'image';
      case 'jpeg':
        return 'image';
      case 'webp':
        return 'image';
      case 'gif':
        return 'image';
      case 'jpg':
        return 'image';
      case 'ico':
        return 'image';
      case 'svg':
        return 'image';
      default:
        return 'file';
    }
  }

  private async apiCall(
    start: number,
    limit: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<void> {
    try {
      this.isLoading = true;
      await this.activityTrackerService
        .getUserFileActivity(
          this.user?.username as string,
          start,
          limit,
          startDate,
          endDate
        )
        .then((data) => {
          this.totalRecords = data.data.totalCount;
          this.isPaginationDisabled = this.totalRecords < this.limit;

          this.dataSource = new MatTableDataSource<Data>(
            data.data.data as Data[]
          );

          this.isTableEmpty = this.dataSource.data.length === 0;
          this.isLoading = false;
          // this.paginate();
        })
        .catch((error) => {
          if (error) {
            this.isTableEmpty = true;
            this.isLoading = true;
            throw new Error(error);
          }
        });
    } catch (error) {
      if (error) {
        this.isLoading = true;
        console.error('API ERROR: ', error);
      }
    }
  }

  protected generateColData(data: string, element: any) {
    switch (data) {
      case 'No':
        return element.rowNumber;

      case 'Original Name':
        return element.originalName;

      case 'Uploader':
        return element.uploader;

      case 'UploadDate':
        return this.formatDate(element.uploadDate);

      case 'Username':
        return element.username;

      default:
        return '';
    }
  }

  protected sortData(sort: Sort): void {
    const data = this.dataSource.data.slice();
    const isAsc = sort.direction === 'asc';

    if (!sort.active || sort.direction === '') {
      this.dataSource.data = data;
      return;
    }

    // Mapping displayed columns to actual Data interface keys
    const columnFieldMap: { [key: string]: keyof Data } = {
      'Original Name': 'originalName',
      Uploader: 'uploader',
      UploadDate: 'uploadDate',
      Username: 'username',
      // 'Download' intentionally excluded
    };

    const field = columnFieldMap[sort.active];

    if (field) {
      this.dataSource.data = data.sort((a, b) =>
        this.compare(a[field], b[field], isAsc)
      );
    }
  }

  private compare(a: any, b: any, isAsc: boolean): number {
    if (a == null && b != null) return isAsc ? -1 : 1;
    if (a != null && b == null) return isAsc ? 1 : -1;
    if (a == null && b == null) return 0;

    if (typeof a === 'string' && typeof b === 'string') {
      return a.localeCompare(b) * (isAsc ? 1 : -1);
    }

    return (a < b ? -1 : a > b ? 1 : 0) * (isAsc ? 1 : -1);
  }

  // Called when user triggers a search (e.g., clicks "Search" button)
  protected async search(): Promise<void> {
    this.currentPage = 1; // Reset to first page
    const offset = (this.currentPage - 1) * this.limit;

    if (this.startDate && this.endDate) {
      // Call API with current filters
      await this.apiCall(offset, this.limit, this.startDate, this.endDate);
    }
  }

  // Called when user clicks "Reset" to clear filters and reload default data
  protected async reset(): Promise<void> {
    this.startDate = null;
    this.endDate = null;
    this.currentPage = 1;
    const offset = 0;

    await this.apiCall(offset, this.limit);
  }

  //<=========== Pagination ===========>
  // Called when user clicks a specific page number
  protected async setCurrentPage(index: number): Promise<void> {
    // index is based on visible range, so we normalize it
    this.currentPage = this.getActualStart() + index;

    // Calculate offset and call paginated API
    const offset = (this.currentPage - 1) * this.limit;
    await this.paginate(offset, this.limit);
  }

  // Calculates the total number of pages
  protected totalPages(): number {
    return Math.ceil(this.totalRecords / this.limit);
  }

  // Calculate visible start page number (e.g., currentPage = 5 → show from 3)
  protected getActualStart(): number {
    return Math.max(1, this.currentPage - 2);
  }

  // Calculate visible end page number (e.g., currentPage = 5 → show to 7)
  protected getActualEnd(): number {
    return Math.min(this.totalPages(), this.currentPage + 2);
  }

  // Jump back by 2 pages
  protected async goTwoPagesBack(): Promise<void> {
    if (this.currentPage > 1) {
      this.currentPage = Math.max(1, this.currentPage - 2);
      const offset = (this.currentPage - 1) * this.limit;
      await this.paginate(offset, this.limit);
    }
  }

  // Jump forward by 2 pages
  protected async goTwoPagesForward(): Promise<void> {
    const totalPages = this.totalPages();
    if (this.currentPage < totalPages) {
      this.currentPage = Math.min(totalPages, this.currentPage + 2);
      const offset = (this.currentPage - 1) * this.limit;
      await this.paginate(offset, this.limit);
    }
  }

  // Pagination trigger wrapper that calls your API
  protected async paginate(start: number, limit: number): Promise<void> {
    this.start = start; // store offset
    await this.apiCall(
      start,
      limit,
      this.startDate || undefined,
      this.endDate || undefined
    );
  }

  protected formatDate(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
    return d.toLocaleString('en-US', options);
  }

  protected download(url: string) {
    window.open(url, '_blank');
  }

  protected exportToExcel(): void {
    // Convert dataSource (MatTableDataSource) to a plain array
    const exportData = this.dataSource.data.map((row) => ({
      'Original Name': row.originalName,
      'Stored Name': row.storedName,
      'Mime Type': row.mimeType,
      Size: row.size,
      Extension: row.extension,
      Path: row.path,
      URL: row.URL,
      Download: row.download,
      Uploader: row.uploader,
      'Upload Date': new Date(row.uploadDate).toLocaleString(),
      Username: row.username,
    }));

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
    const workbook: XLSX.WorkBook = {
      Sheets: { 'User Files': worksheet },
      SheetNames: ['User Files'],
    };

    const excelBuffer: any = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const blobData: Blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    FileSaver.saveAs(
      blobData,
      `User_File_Export_${new Date().toISOString()}.xlsx`
    );
  }
}
