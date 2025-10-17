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
import {WindowsRefService} from '../../../../services/windowRef/windowRef.service';
import {ActivatedRoute, Router} from '@angular/router';
import {CryptoService} from '../../../../services/cryptoService/crypto.service';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {Subscription} from 'rxjs';
import {MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer} from '@angular/platform-browser';
import {SkeletonLoaderComponent} from '../../../shared/skeleton-loader/skeleton-loader.component';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatButtonModule} from '@angular/material/button';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {
  msgTypes,
  NotificationDialogComponent,
} from '../../../dialogs/notification/notification.component';
import {ProgressBarComponent} from '../../../dialogs/progress-bar/progress-bar.component';
import {
  ActivityTrackerService,
  MSG,
} from '../../../../services/activityTacker/activity-tracker.service';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatPaginatorModule} from '@angular/material/paginator';
import {Sort, MatSortModule, MatSort} from '@angular/material/sort';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {
  MatMomentDateModule,
  MomentDateAdapter,
} from '@angular/material-moment-adapter';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
} from '@angular/material/core';
import {MatSelectModule} from '@angular/material/select';
import {MatDividerModule} from '@angular/material/divider';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatDialogModule} from '@angular/material/dialog';
import {MatTooltipModule} from '@angular/material/tooltip';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import {GoogleChartsModule, ChartType} from 'angular-google-charts';

interface allUsersLoginCounts {
  id: string;
  username: string;
  loginCount: number;
}

interface userTrackingLoggedData {
  ip: string;
  date: string;
  username?: string;
}

interface userTrackingData {
  totalCount: number;
  data: userTrackingLoggedData[];
  username: string;
  id: string;
}

interface AllData {
  allUsersLoginCounts: allUsersLoginCounts[];
  totalLoginCount: number;
  userTrackingData: userTrackingData;
}

//Main logged user data type
interface UserLoggedData {
  status: string;
  message: string;
  data: AllData;
}

//All user API
interface DataWithUsernameLoginCount {
  username: string;
  loginCount: number;
}
interface AllUserCount {
  status: string;
  totalCount: number;
  users: DataWithUsernameLoginCount[];
}

//PieChart

export interface GoogleChartOptions {
  // Global styling
  title?: string;
  backgroundColor?: string | ChartFill;
  fontName?: string;
  fontSize?: number;
  colors?: string[];

  // Chart area
  chartArea?: {
    left?: number | string;
    top?: number | string;
    width?: number | string;
    height?: number | string;
  };

  // Legend styling
  legend?: {
    position?: 'top' | 'bottom' | 'left' | 'right' | 'none';
    alignment?: 'start' | 'center' | 'end';
    textStyle?: {
      color?: string;
      fontName?: string;
      fontSize?: number;
      bold?: boolean;
      italic?: boolean;
    };
  };

  // Axis styling (for bar/line/column charts)
  hAxis?: AxisOptions;
  vAxis?: AxisOptions;

  // Tooltips
  tooltip?: {
    isHtml?: boolean;
    showColorCode?: boolean;
    trigger?: 'focus' | 'selection' | 'none';
    textStyle?: {
      color?: string;
      fontName?: string;
      fontSize?: number;
      bold?: boolean;
      italic?: boolean;
    };
  };

  // Pie chart specific
  is3D?: boolean;
  pieHole?: number; // for donut chart
  pieSliceText?: 'percentage' | 'value' | 'label' | 'none';
  slices?: {
    [index: number]: {
      color?: string;
      offset?: number;
      textStyle?: {
        color?: string;
      };
    };
  };

  // Line/Area chart specific
  curveType?: 'none' | 'function';
  pointSize?: number;
  lineWidth?: number;

  // Bar chart specific
  bar?: {
    groupWidth?: string;
  };

  // Misc
  animation?: {
    startup?: boolean;
    duration?: number;
    easing?: 'linear' | 'in' | 'out' | 'inAndOut';
  };
  enableInteractivity?: boolean;
  reverseCategories?: boolean;
  series?: any;
}

export interface AxisOptions {
  title?: string;
  minValue?: number;
  maxValue?: number;
  format?: string;
  gridlines?: {
    color?: string;
    count?: number;
  };
  textStyle?: {
    color?: string;
    fontSize?: number;
    fontName?: string;
    bold?: boolean;
    italic?: boolean;
  };
}

export interface ChartFill {
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
}

export interface GoogleChartConfig {
  title?: string;
  type: ChartType;
  data: any[][];
  columns?: string[];
  options?: GoogleChartOptions;
  width?: number | string;
  height?: number | string;
}

@Component({
  selector: 'app-logged-data',
  standalone: true,
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
    NotificationDialogComponent,
    ProgressBarComponent,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatMomentDateModule,
    MatSelectModule,
    MatDividerModule,
    MatDialogModule,
    MatDatepickerModule,
    MatTooltipModule,
    GoogleChartsModule,
  ],
  templateUrl: './logged-data.component.html',
  styleUrl: './logged-data.component.scss',
})
export class LoggedDataComponent {
  @ViewChild(NotificationDialogComponent, {static: true})
  notification!: NotificationDialogComponent;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(ProgressBarComponent, {static: true})
  progress!: ProgressBarComponent;

  @Input() user: BaseUser | null = null;
  @Input() loggedUser: BaseUser | null = null;
  @Input() mode: boolean | null = null;

  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected isActive: boolean = false;
  protected isLoading: boolean = true;
  protected username: string = '';

  //<========= Logged user table and pie chart variables =========>
  protected isTableEmpty: boolean = false;
  protected userLoggedData: UserLoggedData | null = null;
  protected displayedColumns: string[] = ['IP Address', 'Date'];
  protected dataSource = new MatTableDataSource<userTrackingLoggedData>();
  protected userLoggedTimes: number = 0;
  protected userLoggedCurrentPage: number = 1;
  protected startDate: Date | null = null;
  protected endDate: Date | null = null;
  protected isPaginationOpen: boolean = false;

  //Pie chart according to the table

  protected tableAllUsersLogingTimes: number = 0;
  protected tableUserLoggedTimes: number = 0;

  protected tablePieChart: GoogleChartConfig | null = null;

  constructor (
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private activityTrackerService: ActivityTrackerService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if(this.isBrowser) {
      google.charts.load('current', {packages: ['corechart']});
      google.charts.setOnLoadCallback(() => {});
    }
    this.iconMaker();
  }

  async ngOnInit(): Promise<void> {
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }

    if(this.startDate && this.endDate) {
      await this.getLoggedUserLoginTracking(1, this.startDate, this.endDate);
    } else {
      await this.getLoggedUserLoginTracking(1);
    }
    if(this.user) {
      this.username = this.user.username;
    }
  }

  ngAfterViewInit(): void {}

  private iconMaker() {
    const icons = [
      {name: 'search', path: '/Images/Icons/search.svg'},
      {name: 'reset', path: '/Images/Icons/reset.svg'},
    ];

    for(let icon of icons) {
      this.matIconRegistry.addSvgIcon(
        icon.name,
        this.domSanitizer.bypassSecurityTrustResourceUrl(icon.path)
      );
    }
  }

  public async refresh(username: string): Promise<void> {
    this.username = username;

    if(this.user) {
      this.user.username = username;
    }

    this.userLoggedCurrentPage = 1;
    this.startDate = null;
    this.endDate = null;
    await this.getLoggedUserLoginTracking(1);
  }

  protected getCurrentPage() {
    return this.userLoggedCurrentPage;
  }

  protected totalPages(): number {
    if(this.userLoggedTimes !== 0) return Math.ceil(this.userLoggedTimes / 10);
    else return 0;
  }

  protected getActualStart(): number {
    const actualStart = Math.ceil(this.userLoggedCurrentPage - 3);
    if(actualStart < 0) return 1;
    else return actualStart;
  }

  protected getActualEnd(): number {
    const actualEnd = Math.ceil(this.userLoggedCurrentPage + 3);
    if(
      actualEnd > this.userLoggedCurrentPage &&
      actualEnd <= this.totalPages()
    )
      return actualEnd;
    else return this.totalPages();
  }

  protected async goToThePage(number: number): Promise<void> {
    this.userLoggedCurrentPage = number;
    if(this.startDate && this.endDate) {
      await this.getLoggedUserLoginTracking(
        number,
        this.startDate,
        this.endDate
      );
    } else {
      await this.getLoggedUserLoginTracking(number);
    }
  }

  protected async goThreePagesBack() {
    if(this.userLoggedCurrentPage - 3 > 0) {
      this.userLoggedCurrentPage = Math.ceil(this.userLoggedCurrentPage - 3);
      if(this.startDate && this.endDate) {
        await this.getLoggedUserLoginTracking(
          this.userLoggedCurrentPage,
          this.startDate,
          this.endDate
        );
      } else {
        await this.getLoggedUserLoginTracking(this.userLoggedCurrentPage);
      }
    } else {
      this.userLoggedCurrentPage = 1;
      if(this.startDate && this.endDate) {
        await this.getLoggedUserLoginTracking(1, this.startDate, this.endDate);
      } else {
        await this.getLoggedUserLoginTracking(1);
      }
    }
  }

  protected async goThreePagesForward() {
    if(this.userLoggedCurrentPage + 3 < this.totalPages()) {
      this.userLoggedCurrentPage = Math.ceil(this.userLoggedCurrentPage + 3);
      if(this.startDate && this.endDate) {
        await this.getLoggedUserLoginTracking(
          this.userLoggedCurrentPage,
          this.startDate,
          this.endDate
        );
      } else {
        await this.getLoggedUserLoginTracking(this.userLoggedCurrentPage);
      }
    } else {
      this.userLoggedCurrentPage = this.totalPages();
      if(this.startDate && this.endDate) {
        await this.getLoggedUserLoginTracking(
          this.totalPages(),
          this.startDate,
          this.endDate
        );
      } else {
        await this.getLoggedUserLoginTracking(this.totalPages());
      }
    }
  }

  private async getLoggedUserLoginTracking(
    pageNumber: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<void> {
    if(!this.user) return;

    this.isLoading = true;

    const username = this.user.username;
    const start = (pageNumber - 1) * 10;
    const limit = 10;

    try {
      // Call service that returns UserLoggedData typed object
      const response: UserLoggedData =
        await this.activityTrackerService.getLoggedUserTracking(
          username,
          start,
          limit,
          startDate,
          endDate
        );

      if(
        response &&
        response.status === 'success' &&
        response.data &&
        response.data.userTrackingData
      ) {
        this.tableAllUsersLogingTimes = response.data.totalLoginCount;
        this.isPaginationOpen = this.tableAllUsersLogingTimes > 10;
        this.tableUserLoggedTimes = response.data.userTrackingData.totalCount;
        const chartUserPercentage =
          (this.tableUserLoggedTimes / this.tableAllUsersLogingTimes) * 100;
        const otherPercentage = 100 - chartUserPercentage;

        this.drawChart(chartUserPercentage, otherPercentage);
        this.userLoggedData = response;
        const trackingData = response.data.userTrackingData;

        this.userLoggedTimes = trackingData.totalCount;

        this.dataSource = new MatTableDataSource<userTrackingLoggedData>(
          trackingData.data
        );
        this.dataSource.sort = this.sort;

        this.isTableEmpty = trackingData.data.length === 0;
      } else {
        this.isTableEmpty = true;
      }
    } catch(error) {
      console.error('Error retrieving login tracking data:', error);
      this.isTableEmpty = true;
    } finally {
      this.isLoading = false;
    }
  }

  private drawChart(
    chartUserPercentage: number,
    otherPercentage: number
  ): void {
    this.tablePieChart = <GoogleChartConfig> {
      title: 'User Login Activity',
      type: ChartType.PieChart,
      columns: ['Username', 'Login Count'],
      data: [
        [this.username, chartUserPercentage],
        ['Other Users', otherPercentage],
      ],
      options: {
        is3D: true,
        pieSliceText: 'percentage',
        backgroundColor: '#00000000',
        fontName: 'Roboto',
        fontSize: 14,
        legend: {
          position: 'right',
          textStyle: {color: '#333', fontSize: 12},
        },
        chartArea: {
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
        },
        slices: {
          0: {color: '#ff00dd'},
          1: {color: '#22ff00'},
        },
        tooltip: {
          textStyle: {color: '#000'},
          showColorCode: true,
        },
      },
      // width: 500,
      // height: 500,
    };
  }

  protected sortData(sort: Sort): void {
    const data = this.userLoggedData?.data.userTrackingData.data.slice() ?? [];
    if(!sort.active || sort.direction === '') {
      this.dataSource = new MatTableDataSource<userTrackingLoggedData>(data);
      this.dataSource.sort = this.sort;
      return;
    }

    const sortedData = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch(sort.active) {
        case 'ip':
          return this.compare(a.ip, b.ip, isAsc);
        case 'date':
          return this.compare(new Date(a.date), new Date(b.date), isAsc);
        default:
          return 0;
      }
    });
    this.dataSource = new MatTableDataSource<userTrackingLoggedData>(
      sortedData
    );
    this.dataSource.sort = this.sort;
  }

  private compare(a: any, b: any, isAsc: boolean): number {
    return (a < b ? -1 : a > b ? 1 : 0) * (isAsc ? 1 : -1);
  }

  protected async search() {
    if(this.startDate && this.endDate) {
      await this.getLoggedUserLoginTracking(1, this.startDate, this.endDate);
    } else {
      await this.getLoggedUserLoginTracking(1);
    }
  }

  protected async reset() {
    this.startDate = null;
    this.endDate = null;
    await this.getLoggedUserLoginTracking(1);
  }

  protected exportToExcel() {
    const exportData = this.userLoggedData?.data.userTrackingData.data.map(
      (row) => ({
        Username: row.username,
        'IP Address': row.ip,
        Date: row.date,
      })
    );

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(
      exportData ?? []
    );
    const workbook: XLSX.WorkBook = {
      Sheets: {'User Login Data': worksheet},
      SheetNames: ['User Login Data'],
    };

    const excelBuffer: any = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const blobData: Blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    FileSaver.saveAs(
      blobData,
      `User_Login_Data_Export_${new Date().toISOString()}.xlsx`
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if(changes['user'] && this.user) {
      this.username = this.user.username;
    }
  }
}
