// Path: src/app/components/shared/paginator/paginator.component.ts

import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormControl,
  FormGroup,
} from '@angular/forms';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PaginationUtil } from '../../../source/utility/pagination.utils';

import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  ConnectedPosition,
  OverlayModule,
} from '@angular/cdk/overlay';
import { Subscription } from 'rxjs';

/* ========================================================================
   SUPPORTED EXTENSIONS (FOR FILE EXPORT ICONS / TYPE)
   ====================================================================== */
export type Extension =
  | 'doc'
  | 'docx'
  | 'dot'
  | 'dotx'
  | 'rtf'
  | 'odt'
  | 'txt'
  | 'xml'
  | 'xls'
  | 'xlsx'
  | 'xlsm'
  | 'xlt'
  | 'xltx'
  | 'ods'
  | 'csv'
  | 'tsv'
  | 'ppt'
  | 'pptx'
  | 'pptm'
  | 'pot'
  | 'potx'
  | 'odp'
  | 'pdf'
  | 'zip'
  | 'png'
  | 'jpeg'
  | 'webp'
  | 'gif'
  | 'jpg'
  | 'ico'
  | 'svg'
  | 'file';

/* ========================================================================
   DATE RANGE TYPES
   ====================================================================== */

export interface DateRange {
  start: string | Date | null;
  end: string | Date | null;
}

interface DateRangeForm {
  start: FormControl<Date | string | null>;
  end: FormControl<Date | string | null>;
}

/* ========================================================================
   COMPONENT
   ====================================================================== */

@Component( {
  selector: 'app-paginator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatAutocompleteModule,
    MatIconModule,
    MatButtonModule,
    MatPaginatorModule,
    MatMomentDateModule,
    MatDividerModule,
    MatDialogModule,
    MatDatepickerModule,
    MatTooltipModule,
    OverlayModule,
  ],
  templateUrl: './paginator.component.html',
  styleUrls: [ './paginator.component.scss' ],
} )
export class PaginatorComponent
  implements OnInit, OnDestroy, AfterViewInit, OnChanges {

  /* --------------------------------------------------------------------
     INPUTS — DATA FROM PARENT
     ----------------------------------------------------------------- */

  @Input( { required: true } ) index: number = 0;
  @Input( { required: true } ) limit: number = 0;
  @Input( { required: true } ) totalDataCount: number = 0;

  @Input() tableType: string = '';
  @Input() search: string = '';
  @Input( { required: true } ) pagination: boolean = false;
  @Input() isReload: boolean = false;
  @Input() extension!: Extension;

  /** Show / hide date range UI */
  @Input() isDateRageActive: boolean = false;

  /** Optional current range from parent */
  @Input() initialRange: DateRange | null = null;

  /* --------------------------------------------------------------------
     OUTPUTS
     ----------------------------------------------------------------- */

  @Output() limitChange: EventEmitter<number> = new EventEmitter<number>();
  @Output() indexChange: EventEmitter<number> = new EventEmitter<number>();
  @Output() searchChange: EventEmitter<string> = new EventEmitter<string>();
  @Output() isReloadChange: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() fileExport: EventEmitter<Extension> = new EventEmitter<Extension>();

  /** Emit whenever date range changes (normalised to Date objects) */
  @Output() dateRangeChange: EventEmitter<DateRange | null> = new EventEmitter<DateRange | null>();
  @Output() rangeChange: EventEmitter<DateRange | null> = new EventEmitter<DateRange | null>();

  /* --------------------------------------------------------------------
     VIEW CHILDREN
     ----------------------------------------------------------------- */

  /** Page size overlay instance */
  @ViewChild( 'pageOptionOverlay' )
  private pageOptionOverlay?: CdkConnectedOverlay;

  /** Origin element for page size overlay */
  @ViewChild( 'pageOptionOrigin' )
  protected pageOptionOrigin?: CdkOverlayOrigin;

  /** Page size input (if needed later) */
  @ViewChild( 'pageSizeInput' )
  protected pageSizeInput?: ElementRef<HTMLInputElement>;

  /* --------------------------------------------------------------------
     LOCAL STATE
     ----------------------------------------------------------------- */

  private static readonly ONE_DAY_MS: number = 24 * 60 * 60 * 1000;

  /** Browser flag (for SSR safety). */
  protected readonly isBrowser: boolean;

  /** Reactive form backing the date-range component. */
  protected dateRangeForm!: FormGroup<DateRangeForm>;
  private dateRangeSub?: Subscription;
  protected dateRangeSwap: boolean = false;
  protected dateRangeToggleEnable: boolean = false;

  /** Generated page-size options. */
  protected limitOptions: number[] = [];
  private lastTotalForOptions: number = 0;

  protected name: string = '';
  protected isRefreshFinished: boolean = false;

  /** Controls whether the page-size overlay is open. */
  protected isPageOptionOpen: boolean = false;

  /** Overlay positions for page-size flyout. */
  protected readonly overlayPositions: ConnectedPosition[] = [
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top',
      offsetY: 4,
    },
    {
      originX: 'start',
      originY: 'top',
      overlayX: 'start',
      overlayY: 'bottom',
      offsetY: -4,
    },
  ];

  /** Width used for [cdkConnectedOverlayWidth]. */
  protected pageSizeOverlayWidth: number = 0;

  /* --------------------------------------------------------------------
     CONSTRUCTOR
     ----------------------------------------------------------------- */

  constructor (
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly fb: FormBuilder,
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );

  }

  /* --------------------------------------------------------------------
     LIFECYCLE
     ----------------------------------------------------------------- */

  ngOnInit(): void {
    this.initDateRangeForm();
    this.generatePageOptions();
    this.dateRangeToggleEnable = this.isDateRageActive;
  }

  ngAfterViewInit(): void {
    this.updateOverlayWidth();
  }

  ngOnChanges( changes: SimpleChanges ): void {
    if ( changes[ 'totalDataCount' ] ) {
      const currentTotal: number = Number( changes[ 'totalDataCount' ].currentValue ?? 0 );
      const previousTotal: number = Number( changes[ 'totalDataCount' ].previousValue ?? -1 );

      if ( currentTotal !== previousTotal ) {
        this.generatePageOptions();
      }
    }

    if ( changes[ 'pageSize' ] ) {
      const newSize: number = Number( changes[ 'pageSize' ].currentValue ?? 0 );
      if ( !Number.isNaN( newSize ) && this.limit !== newSize ) {
        this.limit = newSize;
      }
    }
  }

  ngOnDestroy(): void {
    if ( this.dateRangeSub ) {
      this.dateRangeSub.unsubscribe();
    }
  }

  /* --------------------------------------------------------------------
     INIT DATE RANGE FORM
     ----------------------------------------------------------------- */

  private initDateRangeForm(): void {
    const today: Date = new Date();

    // Helper to normalise incoming value
    const initialStart: Date =
      this.asDate( this.initialRange?.start ) ?? today;

    const initialEnd: Date =
      this.asDate( this.initialRange?.end ) ??
      new Date( initialStart.getTime() + PaginatorComponent.ONE_DAY_MS );

    this.dateRangeForm = this.fb.group<DateRangeForm>( {
      start: new FormControl<Date | string | null>( initialStart ),
      end: new FormControl<Date | string | null>( initialEnd ),
    } );

    this.dateRangeSub = this.dateRangeForm.valueChanges.subscribe( () => {
      this.handleDateRangeChanged();
    } );
  }

  /* --------------------------------------------------------------------
     DATE HELPERS
     ----------------------------------------------------------------- */

  /**
   * Safely convert string | Date | null into Date | null.
   */
  private asDate( value: string | Date | null | undefined ): Date | null {
    if ( !value ) {
      return null;
    }
    if ( value instanceof Date ) {
      return value;
    }
    const parsed: Date = new Date( value );
    return Number.isNaN( parsed.getTime() ) ? null : parsed;
  }

  /** Called whenever the internal range form changes. */
  private handleDateRangeChanged(): void {
    this.fixEndDateIfNeeded();
    this.emitNormalisedRange();
  }

  /** Ensure end is always at least 1 day after start. */
  private fixEndDateIfNeeded(): void {
    const start: Date | null = this.asDate( this.dateRangeForm.controls.start.value );
    const end: Date | null = this.asDate( this.dateRangeForm.controls.end.value );

    if ( !start || !end ) {
      return;
    }

    const minEnd: Date = new Date( start.getTime() + PaginatorComponent.ONE_DAY_MS );

    if ( end.getTime() < minEnd.getTime() ) {
      this.dateRangeForm.controls.end.setValue( minEnd, { emitEvent: false } );
    }
  }

  /** Emit a normalised DateRange object to parent. */
  private emitNormalisedRange(): void {
    const start: Date | null = this.asDate( this.dateRangeForm.controls.start.value );
    const end: Date | null = this.asDate( this.dateRangeForm.controls.end.value );

    if ( !start || !end ) {
      return;
    }

    const payload: DateRange = {
      start,
      end,
    };

    // Keep both outputs for backwards-compat
    this.dateRangeChange.emit( payload );
    this.rangeChange.emit( payload );
  }

  protected clearRange(): void {
    this.dateRangeForm.reset();
  }

  /* --------------------------------------------------------------------
     INTERNAL: UPDATE OVERLAY WIDTH
     ----------------------------------------------------------------- */

  protected updateOverlayWidth(): void {
    if ( !this.isBrowser ) {
      return;
    }

    setTimeout( (): void => {
      const originElement: HTMLElement | null =
        this.pageOptionOrigin?.elementRef?.nativeElement ?? null;

      if ( !originElement ) {
        return;
      }

      const rect: DOMRect = originElement.getBoundingClientRect();
      const styles: CSSStyleDeclaration = window.getComputedStyle( originElement );

      const paddingLeft: number = parseFloat( styles.paddingLeft || '0' );
      const paddingRight: number = parseFloat( styles.paddingRight || '0' );
      const borderLeft: number = parseFloat( styles.borderLeftWidth || '0' );
      const borderRight: number = parseFloat( styles.borderRightWidth || '0' );

      // Inner usable width. You can switch to innerWidth if you prefer.
      const innerWidth: number =
        rect.width - paddingLeft - paddingRight - borderLeft - borderRight;

      this.pageSizeOverlayWidth = rect.width > 0 ? rect.width : innerWidth;
    } );
  }

  /* --------------------------------------------------------------------
     ICON HANDLER
     ----------------------------------------------------------------- */

  protected chooseIcon( type: string ): string {
    const ext: string = type?.toLowerCase?.() ?? '';

    switch ( ext ) {
      case 'doc':
      case 'docx':
      case 'dot':
      case 'dotx':
      case 'rtf':
      case 'odt':
        return 'description';

      case 'txt':
        return 'text_snippet';

      case 'xml':
        return 'code';

      case 'xls':
      case 'xlsx':
      case 'xlsm':
      case 'xlt':
      case 'xltx':
      case 'ods':
        return 'table';

      case 'csv':
      case 'tsv':
        return 'table_chart';

      case 'ppt':
      case 'pptx':
      case 'pptm':
      case 'pot':
      case 'potx':
      case 'odp':
        return 'slideshow';

      case 'pdf':
        return 'picture_as_pdf';

      case 'zip':
        return 'archive';

      case 'png':
      case 'jpeg':
      case 'jpg':
      case 'webp':
      case 'gif':
      case 'svg':
      case 'ico':
        return 'image';

      default:
        return 'insert_drive_file';
    }
  }

  /* --------------------------------------------------------------------
     SEARCH HANDLER
     ----------------------------------------------------------------- */

  protected onSearchClick(): void {
    if ( !this.isBrowser ) {
      return;
    }

    const raw: string = ( this.search ?? '' ).toString();
    const safeInput: string = raw.trim();

    this.search = safeInput;
    this.searchChange.emit( safeInput );
  }

  /* --------------------------------------------------------------------
     PAGE OPTION OVERLAY HANDLERS
     ----------------------------------------------------------------- */

  protected openPageOption(): void {
    this.updateOverlayWidth();
    this.isPageOptionOpen = true;
  }

  protected closePageOption(): void {
    this.isPageOptionOpen = false;
  }

  /* --------------------------------------------------------------------
     PAGE SIZE / INDEX HANDLERS
     ----------------------------------------------------------------- */
  protected onLimitInputChange(): void {
    this.onLimitChanged( this.limit );
  }
  protected onLimitChanged( input: number ): void {
    const size: number = Number( input );

    if (
      Number.isNaN( size ) ||
      !Number.isFinite( size ) ||
      !Number.isInteger( size )
    ) {
      return;
    }

    const safeSize: number = PaginationUtil.safeLimit( size, this.totalDataCount );

    this.limit = safeSize;
    this.limitChange.emit( this.limit );

    this.index = 0;
    this.indexChange.emit( this.index );

    this.closePageOption();
  }

  protected onPageIndexChanged( input: number ): void {
    let index: number = Number( input );

    if (
      Number.isNaN( index ) ||
      !Number.isFinite( index ) ||
      !Number.isInteger( index )
    ) {
      return;
    }

    if ( index < 0 ) {
      index = 0;
    }

    const safeIndex: number = PaginationUtil.safeIndex( index, this.totalDataCount );

    this.index = safeIndex;
    this.indexChange.emit( this.index );
  }

  /* --------------------------------------------------------------------
     FILE EXPORT HANDLER
     ----------------------------------------------------------------- */

  protected onFileExport( data: Extension ): void {
    this.fileExport.emit( data );
  }

  /* --------------------------------------------------------------------
     REFRESH HANDLER
     ----------------------------------------------------------------- */

  protected refreshPage(): void {
    this.isReload = true;
    this.search = '';
    this.initialRange = null;
    this.index = 0;
    this.limit = this.limitOptions[ 0 ];
    this.isReloadChange.emit( this.isReload );
    this.searchChange.emit( this.search );
    this.dateRangeChange.emit( null );
    this.indexChange.emit( 0 );
    this.initDateRangeForm();
    this.limitChange.emit( this.limit );

    setTimeout( (): void => {
      this.isReload = false;
      this.isReloadChange.emit( this.isReload );
    }, 0 );
  }

  /* --------------------------------------------------------------------
     PAGE OPTION GENERATOR
     ----------------------------------------------------------------- */

  protected generatePageOptions(): void {
    try {
      const total: number = Number( this.totalDataCount );

      if ( total === this.lastTotalForOptions ) {
        return;
      }

      this.lastTotalForOptions = total;
      this.limitOptions = [];

      if (
        Number.isNaN( total ) ||
        !Number.isFinite( total ) ||
        !Number.isInteger( total ) ||
        total <= 0
      ) {
        this.limitOptions = [ 5, 10, 25 ];
        if ( !this.limit || this.limit <= 0 ) {
          this.limit = this.limitOptions[ 0 ];
        }
        return;
      }

      let divider: number;

      if ( total > 0 && total <= 10 ) {
        divider = 2;
      } else if ( total > 10 && total <= 100 ) {
        divider = 10;
      } else if ( total > 100 && total <= 1000 ) {
        divider = 100;
      } else {
        divider = 1000;
      }

      const options: number[] = [];

      for ( let i: number = divider; i <= total; i += divider ) {
        options.push( i );
      }

      if ( options.length === 0 ) {
        options.push( total );
      }

      this.limitOptions = [ ...options ];

      if (
        !this.limit ||
        this.limit <= 0 ||
        !this.limitOptions.includes( this.limit )
      ) {
        this.limit = this.limitOptions[ 0 ];
      }
    } catch ( error ) {
      console.error( 'Failed to generate page size options:', error );

      this.limitOptions = [ 5, 10, 25 ];
      if ( !this.limit || this.limit <= 0 ) {
        this.limit = this.limitOptions[ 0 ];
      }
    }
  }

  protected toggleInputState() {
    this.dateRangeToggleEnable = !this.dateRangeToggleEnable;
  }
}
