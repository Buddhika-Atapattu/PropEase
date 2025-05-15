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
export class DocumentsComponent implements OnInit, OnChanges, AfterViewInit {
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

  constructor(
    private APIs: APIsService,
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private activatedRouter: ActivatedRoute,
    private crypto: CryptoService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.matIconRegistry.addSvgIcon(
      'document',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/documents.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'upload',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/upload.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'pdf',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/pdf.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'txt',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/txt.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'xml',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/xml.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'excel',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/excel.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'word',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/word.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'powerpoint',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/powerpoint.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'zip',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/zip.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'file',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/file-empty.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'jpeg',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/jpeg.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'png',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/png.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'webp',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/webp.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'gif',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/gif.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'jpg',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/jpg.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'ico',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/ico.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'svg',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/file-types/svg.svg'
      )
    );
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
    await this.callTheAPI();
  }

  protected async callTheAPI() {
    if (this.user) {
      await this.APIs.getUserDocuments(this.user?.username)
        .then((data) => {
          if (data) {
            this.documents = data.data as UDER_DOC_TYPES[];
            for (let item of data.data as UDER_DOC_TYPES[]) {
              // console.log(item);
            }
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

  ngAfterViewInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && this.user) {
      this.username = this.user.username;
    }
  }

  protected triggerFileInput() {
    document.querySelector<HTMLInputElement>('#fileInput')?.click();
  }

  protected getAllDocuments() {
    if (this.user) {
    } else {
      console.error('User not found!');
    }
  }

  protected chooceIcon(type: string): string {
    switch (type) {
      case 'doc':
        return 'word';
        break;
      case 'docx':
        return 'word';
        break;
      case 'dot':
        return 'word';
        break;
      case 'dotx':
        return 'word';
        break;
      case 'rtf':
        return 'word';
        break;
      case 'odt':
        return 'word';
        break;
      case 'txt':
        return 'txt';
        break;
      case 'xml':
        return 'xml';
        break;
      case 'xls':
        return 'excel';
        break;
      case 'xlsx':
        return 'excel';
        break;
      case 'xlsm':
        return 'excel';
        break;
      case 'xlt':
        return 'excel';
        break;
      case 'xltx':
        return 'excel';
        break;
      case 'ods':
        return 'excel';
        break;
      case 'csv':
        return 'excel';
        break;
      case 'tsv':
        return 'excel';
        break;
      case 'ppt':
        return 'powerpoint';
        break;
      case 'pptx':
        return 'powerpoint';
        break;
      case 'pptm':
        return 'powerpoint';
        break;
      case 'pot':
        return 'powerpoint';
        break;
      case 'potx':
        return 'powerpoint';
        break;
      case 'odp':
        return 'powerpoint';
        break;
      case 'pdf':
        return 'pdf';
        break;
      case 'zip':
        return 'zip';
        break;
      case 'png':
        return 'png';
        break;
      case 'jpeg':
        return 'jpeg';
        break;
      // case 'webp':
      //   return 'webp';
      //   break;
      case 'gif':
        return 'gif';
        break;
      case 'jpg':
        return 'jpg';
        break;
      case 'ico':
        return 'ico';
        break;
      case 'svg':
        return 'svg';
        break;
      default:
        return 'file';
    }
  }

  protected onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    let fileSize: number = 0;

    if (input.files && input.files.length > 0) {
      this.file = input.files;
      // this.selectedFile = [];
      this.isFileSelected = true;
      for (let i of this.file) {
        let data: selectedFiles = {
          name: '',
          size: 0,
          icon: '',
          file: null,
        };
        data.name = i.name;
        data.file = i;
        const type = i.name.split('.');
        data.icon = this.chooceIcon(type[type.length - 1]);
        data.size = i.size / (1024 * 1024);
        this.selectedFiles.push(data);
        fileSize += i.size;
      }
      if (fileSize !== 0 && this.notification) {
        if (fileSize / (1024 * 1024) > 10 * (1024 * 1024))
          this.notification.notification(
            'error' as msgTypes,
            'File sizes should less than 10MB'
          );
      } else {
        console.error('Notification not found');
      }
      // console.log(fileSize);
    } else {
      this.file = null;
    }
  }

  protected deleteFile(index: number) {
    // console.log('File deleted');
    this.selectedFiles.splice(index, 1);
    if (this.selectedFiles.length === 0) this.isFileSelected = false;
  }

  protected async downloadFile(downloadURL: string) {
    if (this.isBrowser) {
      window.open(downloadURL, '_blank');
      URL.revokeObjectURL(downloadURL);
    }
  }

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
}
