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
import {
  ActivityTrackerService,
  MSG,
} from '../../../../services/activityTacker/activity-tracker.service';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { Sort, MatSortModule, MatSort } from '@angular/material/sort';

//

interface LoggedData {
  ip_address: string;
  date: Date;
}

interface UserLoggedData {
  username: string;
  totalCount: number;
  data: LoggedData[];
}

@Component({
  selector: 'app-activities',
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
  ],
  templateUrl: './activities.component.html',
  standalone: true,
  styleUrl: './activities.component.scss',
})
export class ActivitiesComponent implements OnInit, OnChanges, AfterViewInit {
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
  protected isNoData: boolean = false;
  protected username: string = '';
  protected userLoggedData: UserLoggedData | null = null;
  protected displayedColumns: string[] = ['IP Address', 'Date'];
  protected dataSource = new MatTableDataSource<LoggedData>();
  @ViewChild(MatSort) sort!: MatSort;
  protected userLoggedTimes: number = 0;
  protected userLoggedCurrentPage: number = 1;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private router: Router,
    private activatedRouter: ActivatedRoute,
    private crypto: CryptoService,
    private APIs: APIsService,
    private activityTrackerService: ActivityTrackerService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.matIconRegistry.addSvgIcon(
      'document',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/documents.svg'
      )
    );
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
    console.log(this.userLoggedCurrentPage);
    await this.getLoggedUserLoginTracking(1);
  }

  protected getCurrentPage() {
    return this.userLoggedCurrentPage;
  }

  protected totalPages(): number {
    if (this.userLoggedTimes !== 0) return Math.ceil(this.userLoggedTimes / 10);
    else return 0;
  }

  protected getActualStart(): number {
    const actualStart = Math.ceil(this.userLoggedCurrentPage - 3);
    if (actualStart < 0) return 1;
    else return actualStart;
  }

  protected getActualEnd(): number {
    const actualEnd = Math.ceil(this.userLoggedCurrentPage + 3);
    if (
      actualEnd > this.userLoggedCurrentPage &&
      actualEnd <= this.totalPages()
    )
      return actualEnd;
    else return this.totalPages();
  }

  protected async goToThePage(number: number): Promise<void> {
    this.userLoggedCurrentPage = number;
    await this.getLoggedUserLoginTracking(number);
  }

  protected async goThreePagesBack() {
    if (this.userLoggedCurrentPage - 3 > 0) {
      this.userLoggedCurrentPage = Math.ceil(this.userLoggedCurrentPage - 3);
      await this.getLoggedUserLoginTracking(this.userLoggedCurrentPage);
    } else {
      this.userLoggedCurrentPage = 1;
      await this.getLoggedUserLoginTracking(1);
    }
  }

  protected async goThreePagesForward() {
    if (this.userLoggedCurrentPage + 3 < this.totalPages()) {
      this.userLoggedCurrentPage = Math.ceil(this.userLoggedCurrentPage + 3);
      await this.getLoggedUserLoginTracking(this.userLoggedCurrentPage);
    } else {
      this.userLoggedCurrentPage = this.totalPages();
      await this.getLoggedUserLoginTracking(this.totalPages());
    }
  }

  private async getLoggedUserLoginTracking(pageNumber: number): Promise<void> {
    if (this.user) {
      this.isLoading = true;
      const username = this.user.username;
      const start = (pageNumber - 1) * 10;
      await this.activityTrackerService
        .getLoggedUserTracking(username, start, 10)
        .then((item) => {
          if (item) {
            // console.log(item);
            this.userLoggedTimes = item.data.totalCount;
            this.userLoggedData = item.data as UserLoggedData;
            this.dataSource = new MatTableDataSource<LoggedData>(
              this.userLoggedData.data
            );
            this.dataSource.sort = this.sort;
            setTimeout(() => {
              this.isLoading = false;
            }, 500);
            if (this.userLoggedData) {
              this.isNoData = true;
            } else {
              this.isNoData = false;
            }
          }
        })
        .catch((error) => {
          if (error) {
            console.error(error);
          }
        });
    }
  }

  protected sortData(sort: Sort): void {
    const data = this.userLoggedData?.data.slice() ?? [];
    if (!sort.active || sort.direction === '') {
      this.dataSource = new MatTableDataSource<LoggedData>(data);
      this.dataSource.sort = this.sort;
      return;
    }

    const sortedData = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'ip_address':
          return this.compare(a.ip_address, b.ip_address, isAsc);
        case 'date':
          return this.compare(new Date(a.date), new Date(b.date), isAsc);
        default:
          return 0;
      }
    });
    this.dataSource = new MatTableDataSource<LoggedData>(sortedData);
    this.dataSource.sort = this.sort;
  }

  private compare(a: any, b: any, isAsc: boolean): number {
    return (a < b ? -1 : a > b ? 1 : 0) * (isAsc ? 1 : -1);
  }

  ngAfterViewInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && this.user) {
      this.username = this.user.username;
    }
  }
}
