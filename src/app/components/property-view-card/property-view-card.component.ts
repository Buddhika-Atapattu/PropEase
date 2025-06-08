import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  Input,
  AfterViewInit,
  ViewChild,
  Output,
  EventEmitter,
  ChangeDetectorRef,
} from '@angular/core';
import { WindowsRefService } from '../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { filter, Subscription } from 'rxjs';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { APIsService, UsersType } from '../../../services/APIs/apis.service';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { SkeletonLoaderComponent } from '../../components/shared/skeleton-loader/skeleton-loader.component';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import { AuthService, BaseUser } from '../../../services/auth/auth.service';
import { PropertyFilterDialogComponent } from '../../components/dialogs/property-filter-dialog/property-filter-dialog.component';
import { BackEndPropertyData, Property } from '../../../services/property/property.service';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationComponent } from '../../components/dialogs/confirmation/confirmation.component';
import { PropertyService } from '../../../services/property/property.service';
import { NotificationComponent } from '../dialogs/notification/notification.component';

@Component({
  selector: 'app-property-view-card',
  imports: [
    CommonModule,
    MatIconModule,
    SkeletonLoaderComponent,
    NotificationComponent,
  ],
  templateUrl: './property-view-card.component.html',
  styleUrl: './property-view-card.component.scss',
})
export class PropertyViewCardComponent implements OnInit, AfterViewInit {
  @Output() propertyDeleted = new EventEmitter<boolean>();
  @ViewChild(NotificationComponent) notification!: NotificationComponent;
  @Input() property: BackEndPropertyData | null = null;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  protected LOGGED_USER: BaseUser | null = null;
  private modeSub: Subscription | null = null;
  protected loading: boolean = true;
  private routeSub: Subscription | null = null;
  private routerSub: Subscription | null = null;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private APIsService: APIsService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private crypto: CryptoService,
    private dialog: MatDialog,
    private propertService: PropertyService,
    private cdr: ChangeDetectorRef
  ) {
    this.LOGGED_USER = this.authService.getLoggedUser;
    this.isBrowser = isPlatformBrowser(this.platformId);
    setInterval(() => {
      this.loading = false;
    }, 500);
    this.iconMaker();
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }

    this.routeSub = this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
  }

  ngAfterViewInit() {
    // Logic to execute after the view has been initialized
  }

  private iconMaker() {
    const iconMap = [
      { name: 'view', path: '/Images/Icons/view.svg' },
      { name: 'edit', path: '/Images/Icons/pencil-square.svg' },
      { name: 'delete', path: '/Images/Icons/delete.svg' },
      { name: 'add-new-user', path: '/Images/Icons/add-new-user.svg' },
      { name: 'search', path: '/Images/Icons/search.svg' },
      { name: 'filter', path: '/Images/Icons/filter.svg' },
    ];

    for (let icon of iconMap) {
      this.matIconRegistry.addSvgIcon(
        icon.name.toString(),
        this.domSanitizer.bypassSecurityTrustResourceUrl(icon.path.toString())
      );
    }
  }

  protected gotoTheProperty(propertyID: string) {
    if (this.isBrowser) {
      this.router.navigate(['/dashboard/property-view', propertyID]);
    }
  }

  protected gotoThePropertyEdit(propertyID: string) {
    if (this.isBrowser) {
      this.router.navigate(['/dashboard/property-edit', propertyID]);
    }
  }

  protected deleteProperty(id: string) {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      data: {
        title: 'Delete Property',
        message: 'Are you sure you want to delete this property?',
        confirmText: true,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result?.confirmText === true) {
        try {
          const respond = await this.propertService.deleteProperty(id);
          this.notification.notification(respond.status, respond.message);
          this.propertyDeleted.emit(true);
        } catch (error: any) {
          this.notification.notification('error', error.message);
        }
      }
      else{
        this.propertyDeleted.emit(false);
      }
    });
  }

  ngOnDestroy() {
    if (this.modeSub) {
      this.modeSub.unsubscribe();
    }
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }
}
