import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ChangeDetectionStrategy,
  inject,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { AuthService, BaseUser } from '../../../services/auth/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { PropertyFilterDialogComponent } from '../../../components/dialogs/property-filter-dialog/property-filter-dialog.component';
import {
  PropertyService,
  Property,
  PropertyFilter,
  BackEndPropertyData,
} from '../../../services/property/property.service';
import { ProgressBarComponent } from '../../../components/dialogs/progress-bar/progress-bar.component';
import { NotificationComponent } from '../../../components/dialogs/notification/notification.component';
import { PropertyViewCardComponent } from '../../../components/property-view-card/property-view-card.component';
interface filterDialogData {
  minPrice: number;
  maxPrice: number;
  beds: string;
  bathrooms: string;
  amenities: string[];
  type: string;
  status: string;
}
import { FormsModule } from '@angular/forms';

interface apiDataTypeForProperties {
  properties: Property[];
  count: number;
}

@Component({
  selector: 'app-properties-main-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    NotificationComponent,
    ProgressBarComponent,
    PropertyViewCardComponent,
    FormsModule
  ],
  templateUrl: './properties-main-panel.component.html',
  styleUrl: './properties-main-panel.component.scss',
})
export class PropertiesMainPanelComponent implements OnInit, OnDestroy {
  @ViewChild(ProgressBarComponent) progress!: ProgressBarComponent;
  @ViewChild(NotificationComponent) notification!: NotificationComponent;
  @ViewChild('searchInput', { static: true })
  searchInput!: ElementRef<HTMLInputElement>;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected LOGGED_USER: BaseUser | null = null;
  protected pageCount: number = 0;

  protected search: string = '';
  protected isLoading: boolean = true;
  private routeSub: Subscription | null = null;
  private routerSub: Subscription | null = null;
  private filterDialogRefData: filterDialogData | string = '';
  protected properties: BackEndPropertyData[] = [];
  protected currentPage: number = 1;

  //PAGINATION VARIABLES
  protected readonly itemsPerPage: number = 12; // Number of items per page
  protected pageSize: number = 10; // Default page size
  protected pageStartIndex: number = 0; // Start index for the current page
  protected pageEndIndex: number = 0; // End index for the current page
  protected totalItems: number = 0; // Total number of items
  protected totalPages: number = 0; // Total number of pages
  protected currentPageNumber: number = 1; // Current page number
  protected noProperties: boolean = false;

  protected isColView: boolean = false;
  protected isListView: boolean = true;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private authService: AuthService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private router: Router,
    private dialog: MatDialog,
    private propertyService: PropertyService
  ) {
    this.LOGGED_USER = this.authService.getLoggedUser;
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
    this.iconMaker();
    this.callTheSearchAPI();
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

  protected isUserCanCreateProperty(): boolean {
    return (
      this.LOGGED_USER?.access.permissions.some(
        (permission) =>
          permission.module === 'Property Management' &&
          permission.actions.includes('create')
      ) ?? false
    );
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
      { name: 'reset', path: '/Images/Icons/reset.svg' },
      { name: 'list', path: '/Images/Icons/list.svg' },
      { name: 'lineColumns', path: '/Images/Icons/line-columns.svg' },
    ];

    for (let icon of iconMap) {
      this.matIconRegistry.addSvgIcon(
        icon.name.toString(),
        this.domSanitizer.bypassSecurityTrustResourceUrl(icon.path.toString())
      );
    }
  }

  // View style
  protected convertTheViewStyle(style: string) {
    if (style === 'grid') {
      this.isColView = true;
      this.isListView = false;
    } else {
      this.isListView = true;
      this.isColView = false;
    }
  }

  // Navigates to the property listing page
  protected propertyListing() {
    this.router.navigate(['/dashboard/property-listing']);
  }

  private async getHighestPropertyPrice(): Promise<number> {
    // properties: Property[]
    const data = await this.propertyService.getAllProperties();
    const properties: Property[] = data.data as Property[];
    if (!properties || properties.length === 0) return 0;
    return Math.max(...properties.map(prop => prop.price || 0));
  }

  // Opens the property filter dialog and handles the result
  protected async openFilter() {
    const dialogRef = this.dialog.open(PropertyFilterDialogComponent, {
      width: 'auto',
      height: 'auto',
      maxWidth: '100vw',
      maxHeight: '100vh',
      minWidth: '25vw',
      minHeight: '25vh',
      autoFocus: false,
      data: {
        maxPrice: await this.getHighestPropertyPrice(),
        minPrice: 0,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result !== null && result !== undefined) {
        this.filterDialogRefData = result;
        this.callTheSearchAPI();
      }
    });
  }

  // Resets the filter dialog data and clears the search input
  protected async resetFilter() {
    this.filterDialogRefData = '';
    this.search = '';
    await this.callTheSearchAPI();
  }

  // Handles the property search input event, updates the search string, and triggers the API call
  protected async searchProperties(input: string) {
    this.search = input.trim();
    await this.callTheSearchAPI();
  }

  // Derected property delete and refresh the list
  protected onPropertyDeleted(event: boolean): void {
    if (event) {
      this.callTheSearchAPI(); // Refresh the list
    }
  }

  //Calls the property service to fetch properties with pagination, search, and filter options
  protected async callTheSearchAPI() {
    try {
      this.isLoading = true;
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
      // Prepare the search value and filter data
      const searchValue = this.search.trim().toLowerCase();
      const filterData = JSON.stringify(
        this.filterDialogRefData as filterDialogData
      );
      // Calculate the start and end indices for pagination
      const startPage = (this.currentPage - 1) * this.itemsPerPage;
      const endPage = startPage + this.itemsPerPage;

      // Call the property service to get properties with pagination and filter
      await this.propertyService
        .getPropertiesWithPaginationAndFilter(
          startPage,
          endPage,
          searchValue,
          filterData
        )
        .then((response) => {
          if (response.status === 'success') {
            this.properties = response.data.properties;
            this.totalItems = response.data.count;
            this.pageCount = Math.ceil(this.totalItems / this.itemsPerPage);

          } else {

            console.error('Error fetching properties:', response.message);
            throw new Error(response.message);
          }
        });
    } catch (error: Error | any) {
      if (error) {
        this.notification.notification(
          'error',
          'Failed to fetch properties. Please try again later.'
        );
        console.error('Error in callTheSearchAPI:', error);
      }
    }
    finally {
      this.noProperties = this.properties.length === 0;
      setTimeout(() => {
        this.isLoading = false;
      }, 1000);
    }
  }

  protected changePage(index: number) {
    this.currentPage = index + 1;

    this.callTheSearchAPI();
  }

  protected async previousPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      await this.callTheSearchAPI();
    }
  }

  protected async nextPage() {
    if (this.currentPage < this.pageCount) {
      this.currentPage++;
      await this.callTheSearchAPI();
    }
  }
}
