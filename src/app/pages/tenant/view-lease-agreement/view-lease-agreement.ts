import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  AfterViewInit,
  ViewChild,
} from '@angular/core';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {Subscription} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {Lease, ScannedFileRecordJSON, TenantService, LeaseWithProperty} from '../../../services/tenant/tenant.service';
import {AuthService, BaseUser} from '../../../services/auth/auth.service';
import {PropertyService, BackEndPropertyData} from '../../../services/property/property.service';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {CryptoService} from '../../../services/cryptoService/crypto.service';
import {HttpErrorResponse} from '@angular/common/http';
import {NotificationDialogComponent} from '../../../components/dialogs/notification/notification.component';
import {ProgressBarComponent} from '../../../components/dialogs/progress-bar/progress-bar.component';
import {SkeletonLoaderComponent} from '../../../components/shared/skeleton-loader/skeleton-loader.component';
import {APIsService} from '../../../services/APIs/apis.service';
import {MatIconRegistry, MatIconModule} from '@angular/material/icon';
import {DomSanitizer} from '@angular/platform-browser';
import {FileOpener} from '../../../components/dialogs/file-opener/file-opener'
import {SafeUrlPipe} from '../../../pipes/safe-url.pipe';
import {LeaseAgreements} from '../../../components/dialogs/lease-agreements/lease-agreements';

interface ScannedFilePreview {
  icon: string;
  name: string;
  size?: number;
  type?: string;
  token?: string;
  URL?: string;
}


@Component({
  selector: 'app-view-lease-agreement',
  standalone: true,
  imports: [CommonModule, NotificationDialogComponent, ProgressBarComponent, SkeletonLoaderComponent, MatDialogModule, MatIconModule, SafeUrlPipe],
  templateUrl: './view-lease-agreement.html',
  styleUrl: './view-lease-agreement.scss'
})
export class ViewLeaseAgreement implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(NotificationDialogComponent) NotificationDialogComponent!: NotificationDialogComponent;
  @ViewChild(ProgressBarComponent) progressBarComponent !: ProgressBarComponent;

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected loggedUser: BaseUser | null = null;

  //Lease details
  private leaseID: string = '';
  protected lease: Lease | null = null;
  protected selectedProperty: BackEndPropertyData | null = null;
  private propertyID: string = '';
  protected isLoading: boolean = false;
  protected tenant: BaseUser | null = null;
  private tenantUsername: string = '';
  protected scannedDocuments: ScannedFileRecordJSON[] = [];
  protected scannedFilePreview: ScannedFilePreview[] = [];

  protected readonly definedMaleDummyImageURL =
    '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL =
    '/Images/user-images/dummy-user/dummy_woman.jpg';
  protected definedImage: string =
    '/Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedImageExtentionArray: string[] = [
    'jpg',
    'webp',
    'jpeg',
    'png',
    'ico',
    'gif',
  ];



  constructor (
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private router: Router,
    private tenantService: TenantService,
    private authService: AuthService,
    private propertyService: PropertyService,
    private dialog: MatDialog,
    private cryptoService: CryptoService,
    private apiService: APIsService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.loggedUser = this.authService.getLoggedUser;

    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });

    this.route.params.subscribe(async (params) => {
      this.leaseID = params['leaseID'];
      await this.loadLeaseAgreement();
      await this.loadSelectedProperty();
      await this.loadTenant();
    });
    this.registerCustomIcons();
  }

  ngOnInit(): void {
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  //<============================================== LOAD LEASE AGREEMENT DATA ==============================================>
  private async loadLeaseAgreement(): Promise<void> {
    try {
      this.isLoading = true;
      if(!this.leaseID) throw new Error('No lease ID found!');


      const response = await this.tenantService.getLeaseAgreementByLeaseID(this.leaseID);

      if(response.status !== 'success') throw new Error('Lease cloud not find!');

      this.lease = response.data as Lease;

      if(!this.lease) throw new Error('No lease found!');

      type ScannedDoc = ScannedFileRecordJSON;

      const raw = this.lease?.tenantInformation?.scannedDocuments ?? [];

      // Ensure we end up with ScannedDoc[]
      this.scannedDocuments = raw.reduce<ScannedDoc[]>((acc, entry) => {
        if(Array.isArray(entry)) {
          acc.push(...(entry as ScannedDoc[]));
        } else if(entry) {
          acc.push(entry as ScannedDoc);
        }
        return acc;
      }, []);

      if(this.scannedDocuments.length === 0) throw new Error('No scanned documents found!');

      this.scannedDocuments.forEach((item) => {
        item.files.forEach((doc) => {
          const name = doc.file.filename;
          const type = doc.file.mimetype;
          const size = doc.file.size;
          const token = doc.token ?? '';
          const URL = doc.file.URL;
          const icon = this.chooceFileIcon(name.split('.').pop() ?? '');
          this.scannedFilePreview.push({
            icon,
            name,
            size,
            type,
            token,
            URL
          })
        })
      })

      this.propertyID = this.lease.propertyID ?? '';

      if(!this.propertyID) throw new Error('No property ID found!');

      this.tenantUsername = this.lease.tenantInformation.tenantUsername;

      if(!this.tenantUsername) throw new Error('No tenant username found!');

    }
    catch(error) {
      console.error(error);
      if(error instanceof HttpErrorResponse) this.NotificationDialogComponent.notification('error', error.message);
      else if(typeof error === 'string') this.NotificationDialogComponent.notification('error', error);
      else if(error instanceof Error) this.NotificationDialogComponent.notification('error', error.message);
      else this.NotificationDialogComponent.notification('error', 'Failed to load lease agreement.');
    }
    finally {
      setTimeout(() => {
        this.isLoading = false;
      }, 500);
    }
  }
  //<============================================== END LOAD LEASE AGREEMENT DATA ==============================================>

  //<============================================== LOAD SELECTED PROPERTY DATA ==============================================>
  private async loadSelectedProperty(): Promise<void> {
    try {
      if(!this.propertyID) throw new Error('No property ID found!');

      const response = await this.propertyService.getPropertyById(this.propertyID);

      if(response.status !== 'success') throw new Error('Property cloud not find!');

      this.selectedProperty = response.data as BackEndPropertyData;

      if(!this.selectedProperty) throw new Error('No property found!')
    }
    catch(error) {
      console.error(error);
      if(error instanceof HttpErrorResponse) this.NotificationDialogComponent.notification('error', error.message);
      else if(typeof error === 'string') this.NotificationDialogComponent.notification('error', error);
      else if(error instanceof Error) this.NotificationDialogComponent.notification('error', error.message);
      else this.NotificationDialogComponent.notification('error', 'Failed to load property data.');
    }
  }
  //<============================================== END LOAD SELECTED PROPERTY DATA ==============================================>

  //<============================================== LOAD TENANT DATA ==============================================>
  private async loadTenant(): Promise<void> {
    try {
      if(!this.tenantUsername) throw new Error('No tenant username found!');

      const response = await this.apiService.getUserByUsername(this.tenantUsername)

      if(response.status !== 'true') throw new Error('Tenant cloud not find!');

      this.tenant = response.user as BaseUser;

      if(!this.tenant) throw new Error('No tenant found!')
    }
    catch(error) {
      console.error(error);
      if(error instanceof HttpErrorResponse) this.NotificationDialogComponent.notification('error', error.message);
      else if(typeof error === 'string') this.NotificationDialogComponent.notification('error', error);
      else if(error instanceof Error) this.NotificationDialogComponent.notification('error', error.message);
      else this.NotificationDialogComponent.notification('error', 'Failed to load tenant data.');
    }
  }
  //<============================================== END LOAD TENANT DATA ==============================================>

  //<============================================== PAGE INDICATORS ==============================================>
  protected goToTenantsDashboard() {
    this.router.navigateByUrl('/', {skipLocationChange: true}).then(() => {
      this.router.navigate(['/dashboard/tenant/tenant-home/']);
    });
  }

  protected async goToTenant() {
    try {
      if(!this.tenant) {
        throw new Error('No tenant information available.');
      }

      const tenant = await this.apiService.generateToken(this.tenant.username);

      if(!tenant || !tenant.token) {
        throw new Error('Failed to generate tenant token.');
      }

      await this.router.navigateByUrl('/', {skipLocationChange: true});
      await this.router.navigate(['/dashboard/tenant/tenant-view/', tenant.token]);

    } catch(error) {
      console.error(error);
      if(error instanceof HttpErrorResponse) this.NotificationDialogComponent.notification('error', error.message);
      else if(typeof error === 'string') this.NotificationDialogComponent.notification('error', error);
      else if(error instanceof Error) this.NotificationDialogComponent.notification('error', error.message);
      else this.NotificationDialogComponent.notification('error', 'Unable to load tenant view.');
    }
  }

  protected goLease() {
    this.router.navigate(['/dashboard/tenant/view-lease', this.leaseID]);
  }
  //<============================================== END PAGE INDICATORS ==============================================>


  //<========================================================================= LOAD TENANT IMAGE DATA ========================================================================>
  protected generateTenantImage(image: string, gender: string): string {
    try {
      const imageArray: string[] = image ? image.split('/') : [];

      if(Array.isArray(imageArray) && imageArray.length > 0) {
        const lastSegment = imageArray[imageArray.length - 1];
        const extension = lastSegment.split('.').pop()?.toLowerCase();

        if(extension && this.definedImageExtentionArray.includes(extension)) {
          this.definedImage = image;
        } else {
          this.definedImage = gender.toLowerCase() === 'male'
            ? this.definedMaleDummyImageURL
            : this.definedWomanDummyImageURL;
        }
      } else {
        // Handle case where image is empty or malformed
        this.definedImage = gender.toLowerCase() === 'male'
          ? this.definedMaleDummyImageURL
          : this.definedWomanDummyImageURL;
      }

      return this.definedImage;

    } catch(error) {
      console.error('Error generating tenant image:', error);
      return gender.toLowerCase() === 'male'
        ? this.definedMaleDummyImageURL
        : this.definedWomanDummyImageURL;
    }
  }
  //<========================================================================= END LOAD TENANT IMAGE DATA ========================================================================>

  //<========================================================================= OPEN SCANNED DOCUMENT ========================================================================>
  protected viewScannedDocument(document: ScannedFilePreview) {
    try {
      const dialogRef = this.dialog.open(FileOpener, {
        width: '100%',
        height: '100%',
        minWidth: '25vw',
        minHeight: '25vh',
        maxWidth: '75vw',
        maxHeight: '75vh',
        data: document
      });

      dialogRef.afterClosed().subscribe(result => {
        console.log(`Dialog result: ${result}`);
      })

    }
    catch(error) {
      console.log(error)
    }
  }
  //<========================================================================= END OPEN SCANNED DOCUMENT ========================================================================>


  //<=========================== ICON REGISTER ===========================>
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
      viewImages: 'view-images.svg',
      maid: 'maid.svg',
    };

    for(const [name, path] of Object.entries(iconMap)) {
      this.matIconRegistry.addSvgIcon(
        name,
        this.domSanitizer.bypassSecurityTrustResourceUrl(
          `/Images/Icons/${path}`
        )
      );
    }
  }

  protected amenityIconMaker(amenity: string): string {
    return this.propertyService.investigateTheAmenityIcon(amenity);
  }
  //<=========================== END ICON REGISTER ===========================>

  //<=========================== FILE ICON CHOOSER ===========================>
  protected chooceFileIcon(type: string): string {
    switch(type) {
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
  //<=========================== END FILE ICON CHOOSER ===========================>

  //<=========================== MAKE THE STRING COMBINE WHEN THOSE STRING MIGHT UNDEFINED ===========================>
  protected makeStringCombineWhenItMightUndefined(valueOne: string | undefined, valueTwo: string | undefined) {
    try {
      if(valueOne === undefined && valueTwo === undefined) return '';
      else if(valueOne === undefined) return valueTwo ?? '';
      else if(valueTwo === undefined) return valueOne ?? '';
      else return valueOne + ' ' + valueTwo;
    }
    catch(error) {
      console.error(error);
      return '';
    }
  }

  //<=========================== END MAKE THE STRING COMBINE WHEN THOSE STRING MIGHT UNDEFINED ===========================>

  //<=========================== VISIT THE SELECTED PROPERTY ===========================>
  protected viewPropertyDetails() {
    try {
      const propertyID = this.selectedProperty?.id ?? '';

      if(!propertyID) throw new Error('No property ID found!');

      this.router.navigate(['/dashboard/property-view', propertyID]);
    }
    catch(error) {
      console.error(error)
      if(error instanceof HttpErrorResponse) this.NotificationDialogComponent.notification('error', error.message);
      else if(typeof error === 'string') this.NotificationDialogComponent.notification('error', error);
      else if(error instanceof Error) this.NotificationDialogComponent.notification('error', error.message);
      else this.NotificationDialogComponent.notification('error', 'Unable to view property details.');
    }
  }
  //<=========================== END VISIT THE SELECTED PROPERTY ===========================>

  //<=========================== EDIT LEASE AGREEMENT ===========================>
  protected onEditLease(): void {
    this.router.navigate(['/dashboard/tenant/tenant-lease', this.lease?.leaseID]);
  }
  //<=========================== END EDIT LEASE AGREEMENT ===========================>
  //<=========================== VIEW LEASE AGREEMENT ===========================>
  protected async viewLeaseAgreement(): Promise<void> {
    try {

      const leaseID = this.lease?.leaseID;
      if(!leaseID) throw new Error('No lease ID found!');

      const tenant = this.tenant;
      if(!tenant) throw new Error('Tenant not found!');

      if(!this.selectedProperty) throw new Error('No property found!');

      if(!this.lease) throw new Error('No lease found!')

      const LeaseWithProperty: LeaseWithProperty = {
        ...this.lease,
        property: this.selectedProperty,
      };

      const dialogRef = this.dialog.open(LeaseAgreements, {
        width: '100%',
        height: '100%',
        maxWidth: '90vw',
        maxHeight: '90vh',
        panelClass: 'fullscreen-dialog',
        data: {
          lease: LeaseWithProperty,
          tenant: tenant,
        },
      });

      dialogRef.afterClosed().subscribe(() => {

      });

    } catch(error) {
      console.error('Error opening lease agreement:', error);
      this.NotificationDialogComponent.notification('error', error as string);
    }
  }
  //<=========================== END VIEW LEASE AGREEMENT ===========================>

}
