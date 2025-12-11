// Path: src/app/components/shared/date-time-picker/date-time-picker.component.ts

import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerToggle } from '@angular/material/datepicker';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';

@Component( {
  selector: 'ape-date-time-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatIconModule,
    MatSelectModule,
    MatOptionModule,
    MatDatepickerToggle,
  ],
  templateUrl: './date-time-picker.component.html',
  styleUrls: [ './date-time-picker.component.scss' ],
} )
export class DateTimePickerComponent implements OnChanges {
  // ───────────────────────────────────────────────────────────────────────────
  // Inputs / Outputs
  // ───────────────────────────────────────────────────────────────────────────

  /** Label for the main mat-form-field (date). */
  @Input( { required: true } ) public label: string = '';

  /** Placeholder for date input. */
  @Input() public placeholder: string = '';

  /** Bound value (Date). */
  @Input( { required: true } ) public value: Date | null = null;

  /** Min and max allowed DateTime. */
  @Input( { required: true } ) public min: Date | null = null;
  @Input( { required: true } ) public max: Date | null = null;

  /** Disable seconds to keep UI compact. (Hook if you want later) */
  @Input() public showSeconds: boolean = false;

  /** Disable entire control. */
  @Input() public disabled: boolean = false;

  @Input( { required: true } ) public required: boolean = false;

  /** Emits combined Date when user changes date or time. */
  @Output() public readonly valueChange: EventEmitter<Date | null> =
    new EventEmitter<Date | null>();

  // ───────────────────────────────────────────────────────────────────────────
  // Internal state
  // ───────────────────────────────────────────────────────────────────────────

  public selectedDate: Date | null = null;
  public selectedHour: number | null = null;
  public selectedMinute: number | null = null;

  public readonly hours: number[] = [];
  public readonly minutes: number[] = [];

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  public constructor () {
    // Build hour & minute lists once
    for ( let h: number = 0; h < 24; h++ ) {
      this.hours.push( h );
    }

    for ( let m: number = 0; m < 60; m += 5 ) {
      // step of 5 minutes for nicer UI; change if you want 1-minute steps
      this.minutes.push( m );
    }

    this.syncFromValue();
  }

  public ngOnChanges( changes: SimpleChanges ): void {
    if ( changes[ 'value' ] && !changes[ 'value' ].firstChange ) {
      this.syncFromValue();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public handlers
  // ───────────────────────────────────────────────────────────────────────────

  /** Date picker change handler. */
  public onDateChange( event: MatDatepickerInputEvent<Date> ): void {
    this.selectedDate = event.value ?? null;
    this.emitCombined();
  }

  /** Hour dropdown change handler. */
  public onHourChange( hour: number | null ): void {
    this.selectedHour = hour;
    this.emitCombined();
  }

  /** Minute dropdown change handler. */
  public onMinuteChange( minute: number | null ): void {
    this.selectedMinute = minute;
    this.emitCombined();
  }

  public toDateOrNull(
    raw: string | Date | null | undefined,
  ): Date | null {
    if ( raw instanceof Date ) {
      return raw;
    }

    if ( typeof raw === 'string' ) {
      const trimmed: string = raw.trim();
      if ( !trimmed ) {
        return null;
      }

      const parsed: Date = new Date( trimmed );
      if ( Number.isNaN( parsed.getTime() ) ) {
        return null;
      }

      return parsed;
    }

    return null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Sync internal date + hour + minute from @Input() value.
   */
  private syncFromValue(): void {
    if ( !this.value ) {
      this.selectedDate = null;
      this.selectedHour = null;
      this.selectedMinute = null;
      return;
    }

    const base: Date = new Date( this.value );
    this.selectedDate = base;
    this.selectedHour = base.getHours();
    this.selectedMinute = base.getMinutes() - ( base.getMinutes() % 5 ); // align to step
  }

  /**
   * Combine selectedDate + selectedHour + selectedMinute,
   * clamp to min/max if needed, and emit.
   */
  private emitCombined(): void {
    // If date is missing, we consider the whole datetime null.
    if ( !this.selectedDate ) {
      this.valueChange.emit( null );
      return;
    }

    const year: number = this.selectedDate.getFullYear();
    const month: number = this.selectedDate.getMonth();
    const day: number = this.selectedDate.getDate();
    const hour: number = this.selectedHour ?? 0;
    const minute: number = this.selectedMinute ?? 0;

    let result: Date = new Date( year, month, day, hour, minute, 0, 0 );

    // Min / Max clamp
    if ( this.min && result < this.min ) {
      result = new Date( this.min );
    }

    if ( this.max && result > this.max ) {
      result = new Date( this.max );
    }

    this.valueChange.emit( result );
  }
}
