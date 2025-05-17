import {
  Component,
  Inject,
  Input,
  PLATFORM_ID,
  OnInit,
  OnChanges,
  SimpleChanges,
  ViewChild,
  AfterViewInit,
  ElementRef,
  OnDestroy,
} from '@angular/core';
import {
  APIsService,
  BaseUser,
  UDER_DOC_TYPES,
} from '../../../../services/APIs/apis.service';
import { WindowsRefService } from '../../../../services/windowRef.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CryptoService } from '../../../../services/cryptoService/crypto.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { SkeletonLoaderComponent } from '../../shared/skeleton-loader/skeleton-loader.component';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import {
  msgTypes,
  NotificationComponent,
} from '../../dialogs/notification/notification.component';
import { ProgressBarComponent } from '../../dialogs/progress-bar/progress-bar.component';
import { AuthService } from '../../../../services/auth/auth.service';

interface selectedFiles {
  name: string;
  size: number;
  icon: string;
  file: File | null;
}

@Component({
  selector: 'app-documents',
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
  ],
  standalone: true,
  providers: [],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss',
})
export class DocumentsComponent
  implements OnInit, OnChanges, AfterViewInit, OnDestroy
{
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild(NotificationComponent, { static: true })
  notification!: NotificationComponent;
  @ViewChild(ProgressBarComponent, { static: true })
  progress!: ProgressBarComponent;
  @Input() user: BaseUser | null = null;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected isActive: boolean = false;
  protected isLoading: boolean = true;
  protected file: FileList | File | null = null;
  protected isSizeBig: boolean = false;
  protected isNoData: boolean = false;
  protected isFileSelected: boolean = false;
  protected selectedFiles: selectedFiles[] = [];
  protected username: string = '';
  protected documents: UDER_DOC_TYPES[] = [];
  protected isDragOver: boolean = false;
  protected isNotType: boolean = false;
  private readonly allowedTypes = [
    // Word Documents
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
    'application/rtf',

    // Excel Documents
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    'text/csv',
    'text/tab-separated-values',

    // PowerPoint Documents
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.template',

    // OpenDocument Formats
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',

    // PDF
    'application/pdf',

    // Plain Text
    'text/plain',

    // Common Image Types
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/jpg',
    'image/ico',
    'image/svg+xml',
  ];

  constructor(
    private APIs: APIsService,
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private activatedRouter: ActivatedRoute,
    private crypto: CryptoService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private authService: AuthService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.registerCustomIcons();
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
      window.addEventListener('dragover', this.preventDefault, {
        passive: false,
      });
      window.addEventListener('drop', this.preventDefault, { passive: false });
    }
    await this.callTheAPI();
  }

  protected async callTheAPI() {
    if (this.user) {
      await this.APIs.getUserDocuments(this.user?.username)
        .then((data) => {
          if (data) {
            this.documents = data.data as UDER_DOC_TYPES[];
          }
        })
        .catch((error) => {
          if (error) {
            this.isNoData = true;
          }
        });
      if (this.documents.length > 0) {
        this.isNoData = false;
      } else {
        this.isNoData = true;
      }
      this.isActive = this.user?.isActive;
      setTimeout(() => {
        this.isLoading = false;
      }, 500);
    } else {
      console.error('User not found!');
    }
  }

  ngAfterViewInit(): void {
    // this.notification.notification('', '');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && this.user) {
      this.username = this.user.username;
    }
  }

  //<================== Icons ==================>
  private registerCustomIcons(): void {
    const iconMap = {
      document: 'documents.svg',
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
  //<================== End Icons ==================>

  //<================== File Input Button Trigger ==================>
  protected triggerFileInput() {
    document.querySelector<HTMLInputElement>('#fileInput')?.click();
  }
  //<================== End File Input Button Trigger ==================>

  //<================== File Copy and paste ==================>
  protected handlePaste(event: ClipboardEvent): void {
    event.preventDefault();

    const items = event.clipboardData?.items;
    if (!items) return;

    const validFiles: File[] = [];

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && this.allowedTypes.includes(file.type)) {
          validFiles.push(file);
        }
      }
    }

    if (validFiles.length > 0) {
      this.processPastedFiles(validFiles);
    }
  }

  protected processPastedFiles(files: File[]): void {
    const dataTransfer = new DataTransfer();
    for (const file of files) {
      dataTransfer.items.add(file);
    }

    const input = this.fileInput.nativeElement as HTMLInputElement;
    input.files = dataTransfer.files;

    // Reuse existing file selection handler
    this.onFileSelected({ target: input } as unknown as Event);
  }
  //<================== End File Copy and paste ==================>

  //<================== File Drag and Drop ==================>
  protected onDragOver(event: DragEvent): void {
    event.preventDefault(); // Crucial to allow drop
    this.isDragOver = true;
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      // Filter allowed types and collect valid files
      const validFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files.item(i);
        if (file && this.allowedTypes.includes(file.type)) {
          validFiles.push(file);
        } else {
          this.isNotType = true;
        }
      }

      if (validFiles.length > 0) {
        this.processDroppedFiles(validFiles);
      }
    }
  }

  // Accepts an array of Files, not FileList
  protected processDroppedFiles(files: File[]): void {
    const dataTransfer = new DataTransfer();
    for (const file of files) {
      dataTransfer.items.add(file);
    }

    const input = this.fileInput.nativeElement as HTMLInputElement;

    // Replace input files with the new DataTransfer file list
    input.files = dataTransfer.files;

    // Trigger your upload handler
    this.onFileSelected({ target: input } as unknown as Event);
  }

  private preventDefault(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }
  //<================== End File Drag and Drop ==================>

  //<================== Choose icon ==================>
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
  //<================== End Choose icon ==================>

  //<================== File input ==================>
  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    let fileSize: number = 0;
    if (input.files && input.files.length > 0) {
      this.file = input.files;
      this.isFileSelected = true;

      for (let i = 0; i < this.file.length; i++) {
        const file = this.file[i];
        const data: selectedFiles = {
          name: file.name,
          size: file.size / (1024 * 1024),
          icon: this.chooceIcon(file.name.split('.').pop() || ''),
          file: file,
        };

        this.selectedFiles.push(data);
        fileSize += file.size;
      }

      if (fileSize !== 0 && this.notification) {
        if (fileSize > 10 * 1024 * 1024) {
          this.notification.notification(
            'error' as msgTypes,
            'File sizes should less than 10MB'
          );
        }
      } else {
        console.error('Notification not found');
      }
    } else {
      this.file = null;
    }
  }
  //<================== End File input ==================>

  //<================== File Delete Item from array of files ==================>
  protected deleteFile(index: number) {
    this.selectedFiles.splice(index, 1);
    if (this.selectedFiles.length === 0) this.isFileSelected = false;
  }
  //<================== End File Delete Item from array of files ==================>

  //<================== Download the documents ==================>
  protected async downloadFile(downloadURL: string) {
    if (this.isBrowser) {
      window.open(downloadURL, '_blank');
      URL.revokeObjectURL(downloadURL);
    }
  }
  //<================== End Download the documents ==================>

  //<================== Insert the documents ==================>
  protected async insertDocumnets() {
    if (this.selectedFiles.length === 0 && this.notification) {
      this.notification?.notification('error', 'No files selected to upload.');
      return;
    } else {
      if (this.user) {
        if (!this.progress) console.error('Progress bar not found!');
        const formData = new FormData();
        this.progress.start();
        formData.append('username', this.user?.username);
        formData.append(
          'uploader',
          this.authService.getLoggedUser?.username ||
            'Error By taking logged user'
        );
        for (let item of this.selectedFiles) {
          formData.append('files', item.file as File);
        }
        await this.APIs.uploadDocuments(formData, this.user?.username)
          .then((data) => {
            if (data && this.notification) {
              this.notification.notification(data.status, data.message);
            } else {
              this.notification.notification(
                'error',
                'Error: file upload failed!'
              );
            }
          })
          .catch((error) => {
            if (error) {
              this.notification.notification('error', error.message);
              this.progress.error();
            }
          })
          .finally(() => {
            this.progress.complete();
            this.selectedFiles = [];
            this.isFileSelected = false;
          });
        await this.callTheAPI();
      } else {
        console.error('User not found!');
      }
    }
  }
  //<================== End Insert the documents ==================>

  ngOnDestroy(): void {
    if (this.isBrowser) {
      window.removeEventListener('dragover', this.preventDefault);
      window.removeEventListener('drop', this.preventDefault);
    }

    this.modeSub?.unsubscribe();
  }
}
