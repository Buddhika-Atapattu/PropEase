import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnDestroy,
  AfterViewInit,
  SimpleChanges,
  OnChanges,
  PLATFORM_ID,
  ViewChild,
  Inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import { MatButtonModule } from '@angular/material/button';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import { APIsService, UsersType } from '../../../services/APIs/apis.service';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';

export interface FileExportButtonTypeByExtension {
  type:
  | 'doc'
  | 'docx'
  | 'dot'
  | 'dotx'
  | 'rtf'
  | 'odt'
  | 'txt'
  | 'xml'
  | 'xls'
  | 'xlsx'
  | 'xlsm'
  | 'xlt'
  | 'xltx'
  | 'ods'
  | 'csv'
  | 'tsv'
  | 'ppt'
  | 'pptx'
  | 'pptm'
  | 'pot'
  | 'potx'
  | 'odp'
  | 'pdf'
  | 'zip'
  | 'png'
  | 'jpeg'
  | 'webp'
  | 'gif'
  | 'jpg'
  | 'ico'
  | 'svg'
  | 'file';
}

@Component({
  selector: 'app-paginator',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    FormsModule,
    CommonModule,
    MatAutocompleteModule,
    MatIconModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatPaginatorModule,
    MatMomentDateModule,
    MatSelectModule,
    MatDividerModule,
    MatDialogModule,
    MatDatepickerModule,
    MatTooltipModule,
  ],
  templateUrl: './paginator.component.html',
  styleUrl: './paginator.component.scss',
})
export class PaginatorComponent
  implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  @Input() pageCount: number = 0;
  @Input() pageIndex: number = 0;
  @Input() pageSize: number = 0;
  @Input() totalDataCount: number = 0;
  @Input() tableType: string = '';
  @Input() pageSizeOptions: number[] = [];
  @Input() search: string = '';
  @Input() isPaginationEnabled: boolean = false;
  @Input() isReload: boolean = false;
  @Input()
  fileExportButtonTypeByExtension: FileExportButtonTypeByExtension | null =
    null;

  @Output() pageCountChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();
  @Output() pageIndexChange = new EventEmitter<number>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() isReloadChange = new EventEmitter<boolean>();
  @Output() fileExport = new EventEmitter<FileExportButtonTypeByExtension>();

  protected name: string = '';
  protected isRefreshFinished: boolean = false;
  protected isBrowser: boolean;

  // protected pageSizeOptions: number[] = [];
  protected selectedPageSize: number = 0;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private crypto: CryptoService,
    private router: Router,
    private APIsService: APIsService,
    private route: ActivatedRoute
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.registerCustomIcons();
  }

  ngOnInit() {
  }

  ngAfterViewInit(): void { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pageSizeOptions'] && this.pageSizeOptions?.length > 0) {
      const newPageSize = this.pageSizeOptions[0];
      const shouldResetPageIndex = this.selectedPageSize !== newPageSize;

      this.selectedPageSize = newPageSize;

      if (shouldResetPageIndex && this.pageIndex !== 0) {
        this.pageIndex = 0;
        this.pageIndexChange.emit(this.pageIndex);
      }
    }

    if (changes['pageSize']) {
      const newSize = changes['pageSize'].currentValue || 0;
      if (this.pageSize !== newSize) {
        this.pageSize = newSize;
      }
    }
  }

  ngOnDestroy(): void { }

  private registerCustomIcons(): void {
    const iconMap = {
      document: 'documents.svg',
      fileExcel: 'fileExcel.svg',
      search: 'search.svg',
      reset: 'reset.svg',
      download: 'download.svg',
      userID: 'userID.svg',
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

  protected onPageSizeChanged(newSize: number) {
    this.isPaginationEnabled = newSize < this.totalDataCount;
    this.pageSize = newSize;
    this.pageSizeChange.emit(this.pageSize);
    this.pageCount = Math.ceil(this.totalDataCount / newSize);
    this.pageCountChange.emit(this.pageCount);
    this.pageIndex = 0;
    this.pageIndexChange.emit(this.pageIndex);
  }

  protected onTenantNameChanged(input: string) {
    this.search = input;
    this.searchChange.emit(this.search);
  }

  private paginationChecker(type: string): number {
    switch (type) {
      case 'doubleBackword':
        return -this.pageSize * 2;
      case 'backward':
        return -1;
      case 'forward':
        return 1;
      case 'doubleForward':
        return this.pageSize * 2;
      default:
        return 0;
    }
  }

  protected onPageIndexChanged(type: string): void {
    const delta = this.paginationChecker(type);
    let newIndex = this.pageIndex + delta;

    // Clamp the value within [0, pageCount - 1]
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= this.pageCount) newIndex = this.pageCount - 1;

    if (newIndex !== this.pageIndex) {
      this.pageIndex = newIndex;
      this.pageIndexChange.emit(this.pageIndex);
    }
  }

  protected onFileExport(data: FileExportButtonTypeByExtension) {
    this.fileExport.emit(data);
  }

  protected refreshPage() {
    this.isReload = true;
    this.isRefreshFinished = true;
    this.isReloadChange.emit(this.isReload);
    setTimeout(() => {
      this.isRefreshFinished = false;
    }, 500);
  }
}
