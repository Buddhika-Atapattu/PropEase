import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild, ChangeDetectorRef,
  AfterViewInit, OnChanges,
  SimpleChanges
} from '@angular/core';
import {Router} from '@angular/router';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatButtonModule} from '@angular/material/button';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {
  MatMomentDateModule
} from '@angular/material-moment-adapter';
import {MatSelectModule} from '@angular/material/select';
import {MatDividerModule} from '@angular/material/divider';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {CryptoService} from '../../../services/cryptoService/crypto.service';
import {
  MAT_DIALOG_DATA, MatDialogRef, MatDialogModule
} from '@angular/material/dialog';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';
import {Subscription} from 'rxjs';
import {NotificationDialogComponent} from '../notification/notification.component';
import {ScanService} from '../../../services/scan/scan.service';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {HttpClient} from '@angular/common/http';
import {NgxExtendedPdfViewerModule} from 'ngx-extended-pdf-viewer';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {UserControllerService} from '../../../services/userController/user-controller.service';

@Component({
  selector: 'app-file-opener',
  imports: [
    CommonModule,
    NotificationDialogComponent,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatMomentDateModule,
    MatSelectModule,
    MatDividerModule,
    MatDialogModule,
    MatProgressBarModule,
    NgxExtendedPdfViewerModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './file-opener.html',
  styleUrl: './file-opener.scss'
})
export class FileOpener implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  @ViewChild(NotificationDialogComponent, {static: true})
  notification!: NotificationDialogComponent;

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  protected isLoading: boolean = false;

  protected fileType: string = '';
  protected icon: string = '';
  protected name: string = '';
  protected size: number = 0;
  protected token: string = '';
  protected URL: string = '';
  protected fileExtention: string = '';
  protected pdfUrl?: SafeResourceUrl;
  protected pdfBlob: string = '';

  constructor (
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(MAT_DIALOG_DATA)
    public data: any = {},
    public dialogRef: MatDialogRef<FileOpener>,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private userControllerService: UserControllerService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }

    this.fileType = this.data.type ?? '';
    this.icon = this.data.icon ?? '';
    this.name = this.data.name ?? '';
    this.size = this.data.size ?? 0;
    this.token = this.data.token ?? '';
    this.fileExtention = this.name.split('.').pop() ?? '';
    this.URL = this.data.URL ?? '';
    this.convertAndPreviewPDF(this.URL);
  }

  async ngOnInit(): Promise<void> {

  }
  ngOnChanges(changes: SimpleChanges): void {
    if(changes['data'] && changes['data'].currentValue) {
    }
  }

  ngAfterViewInit(): void {

  }

  ngOnDestroy(): void {
    if(this.pdfBlob) {
      URL.revokeObjectURL(this.pdfBlob);
    }
  }

  private async convertAndPreviewPDF(fileUrl: string) {

    try {
      this.isLoading = true;

      const blob = await this.userControllerService.convertToPDF(fileUrl);

      const isPDF = blob.type === 'application/pdf' && blob.size > 1000;
      if(!isPDF) {
        const text = await blob.text();
        throw new Error(`Expected PDF blob, got text: ${text}`);
      }


      const objectUrl = URL.createObjectURL(blob);
      this.pdfBlob = objectUrl;
      this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
    }
    catch(error) {
      console.log(error)
    }
    finally {
      this.isLoading = false;
    }
  }



  protected pannelClose(): void {
    this.dialogRef.close({
      token: this.token,
    });
  }
}
