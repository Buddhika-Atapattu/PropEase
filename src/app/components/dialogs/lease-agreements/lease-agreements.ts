import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ChangeDetectorRef,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { LeaseWithProperty, TenantService } from '../../../services/tenant/tenant.service';
import { User } from '../../../services/APIs/apis.service';
import { NotificationDialogComponent } from '../notification/notificationBar.component';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { SkeletonLoaderComponent } from '../../../components/shared/skeleton-loader/skeleton-loader.component';
import { SafeUrlPipe } from '../../../pipes/safe-url.pipe';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';
import { CloseBtnComponent } from '../../shared/buttons/close-btn/close-btn';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';

// SkeletonLoaderComponent, SafeUrlPipe
@Component( {
  selector: 'app-lease-agreements',
  standalone: true,
  imports: [ CommonModule, NotificationDialogComponent, MatProgressSpinnerModule, NgxExtendedPdfViewerModule, CloseBtnComponent, PreloaderComponent ],
  templateUrl: './lease-agreements.html',
  styleUrl: './lease-agreements.scss'
} )
export class LeaseAgreements implements OnInit, OnDestroy {
  @ViewChild( PreloaderComponent, { static: true } ) preloaderComponent!: PreloaderComponent;
  @ViewChild( NotificationDialogComponent ) NotificationDialogComponent!: NotificationDialogComponent;
  protected lease: LeaseWithProperty | null = null;
  protected tenant: User | null = null;
  protected isLoading: boolean = false;
  protected isBrowser: boolean;
  protected PDFURL: SafeResourceUrl | null = null;
  protected pdfBlob: string = '';
  protected isError: boolean = false;

  constructor (
    private tenantService: TenantService,
    @Inject( PLATFORM_ID ) private platformId: Object,
    @Inject( MAT_DIALOG_DATA ) public data: any = {},
    public dialogRef: MatDialogRef<LeaseAgreements>,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private router: Router,
    private authService: AuthService
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
  }

  async ngOnInit(): Promise<void> {
    try {
      if ( this.data ) {
        this.lease = this.data.lease as LeaseWithProperty;
        this.tenant = this.data.tenant as User;
        await this.loadPDF();
      } else {
        this.lease = null;
        this.tenant = null;
        throw new Error( 'No data found of tenant or lease!' );
      }
    } catch ( error ) {
      console.error( error );
      this.isLoading = false;
      this.dialogRef.close();
    }
  }

  ngOnDestroy(): void {
    if ( this.PDFURL ) {
      this.PDFURL = null;
    }
  }

  private async loadPDF(): Promise<void> {
    try {
      this.isLoading = true;
      this.preloaderComponent.start();
      if ( !this.lease ) throw new Error( 'No lease found!' );
      const leaseID = this.lease.leaseID;
      if ( !leaseID ) throw new Error( 'No lease ID found!' );
      if ( this.authService.getLoggedUser === null ) throw new Error( 'User not authenticated' );
      const blob = await this.tenantService.downloadLeaseAgreement( leaseID, 'view', this.authService.getLoggedUser.username );
      const isPDF = blob.type === 'application/pdf' && blob.size > 1000;
      if ( !isPDF ) {
        const text = await blob.text();
        throw new Error( `Expected PDF blob, got text: ${ text }` );
      }
      const objectUrl = URL.createObjectURL( blob );
      this.pdfBlob = objectUrl;
      this.PDFURL = this.sanitizer.bypassSecurityTrustResourceUrl( objectUrl );

      if ( !this.pdfBlob || !this.PDFURL ) throw new Error( 'Failed to create PDF URL.' );

      if ( this.pdfBlob && this.PDFURL ) this.preloaderComponent.complete();

    } catch ( error ) {
      console.error( 'Failed to load PDF:', error );
      this.preloaderComponent.error();
      this.isError = true;
      this.PDFURL = null;
    } finally {
      this.isLoading = false;
      this.isError = false;
      this.cdr.detectChanges();
    }
  }

  protected onEditLease(): void {
    this.pannelClose();
    this.router.navigate( [ '/dashboard/tenant/edit-lease', this.lease?.leaseID ] );
  }

  protected pannelClose() {
    if ( this.PDFURL ) {
      this.PDFURL = null;
    }
    this.dialogRef.close();
  }
}
