import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { WindowsRefService } from '../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { AuthService, BaseUser } from '../../../services/auth/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { PropertyFilterDialogComponent } from '../../components/dialogs/property-filter-dialog/property-filter-dialog.component';

interface filterDialogData {
  minPrice: number;
  maxPrice: number;
  beds: string;
  bathrooms: string;
  amenities: string[];
  type: string;
  status: string;
}

@Component({
  selector: 'app-properties-main-panel',
  imports: [CommonModule, MatIconModule],
  templateUrl: './properties-main-panel.component.html',
  styleUrl: './properties-main-panel.component.scss',
})
export class PropertiesMainPanelComponent implements OnInit, OnDestroy {
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected LOGGED_USER: BaseUser | null = null;
  protected pageCount: number = 0;
  protected currentPage: number = 0;
  protected search: string = '';
  protected loading: boolean = true;
  private routeSub: Subscription | null = null;
  private routerSub: Subscription | null = null;
  private filterDialogRefData: filterDialogData | string = '';

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private authService: AuthService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private router: Router,
    private dialog: MatDialog
  ) {
    this.LOGGED_USER = this.authService.getLoggedUser;
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
    this.iconMaker();
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  private iconMaker() {
    const iconMap = [
      { name: 'view', path: '/Images/Icons/view.svg' },
      { name: 'listing', path: '/Images/Icons/listing.svg' },
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

  protected async searchUsers(event: Event) {
    this.search = (event.target as HTMLInputElement).value;
  }

  protected propertyListing() {
    this.router.navigate(['/dashboard/property-listing']);
  }

  protected openFilter() {
    const dialogRef = this.dialog.open(PropertyFilterDialogComponent, {
      width: '100%',
      height: 'auto',
      autoFocus: false,
      data: {},
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result !== null && result !== undefined) {
        this.filterDialogRefData = result;
        console.log('Filter dialog closed with result:', result);
        // Handle any additional logic after the filter dialog is closed
      }
    });
  }
}
