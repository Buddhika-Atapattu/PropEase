import { Component, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component( {
  selector: 'app-preloader',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './preloader.component.html',
  styleUrl: './preloader.component.scss',
} )
export class PreloaderComponent implements OnDestroy {
  @Input() show = false;

  protected progressValue = 0;
  protected isError = false;
  protected isSuccess = false;
  protected isWarning = false;

  // keep interval handler so parent doesn’t have to
  private intervalId: number | null = null;

  /** Start simulated loading */
  start(): void {
    this.resetFlags();
    this.show = true;
    this.progressValue = 0;

    if ( this.intervalId !== null ) {
      clearInterval( this.intervalId );
      this.intervalId = null;
    }

    // Simulate loading up to ~90%
    this.intervalId = window.setInterval( () => {
      if ( this.progressValue < 90 ) {
        this.progressValue += 2;
      }
    }, 100 );
  }

  /** Mark as complete and hide after a short delay */
  complete(): void {
    this.clearInterval();
    this.progressValue = 100;
    this.isSuccess = true;

    setTimeout( () => {
      this.show = false;
      this.resetFlags();
    }, 800 );
  }

  /** Soft stop (warning) */
  stop(): void {
    this.clearInterval();
    this.isWarning = true;

    setTimeout( () => {
      this.show = false;
      this.resetFlags();
    }, 800 );
  }

  /** Error state */
  error(): void {
    this.clearInterval();
    this.isError = true;

    setTimeout( () => {
      this.show = false;
      this.resetFlags();
    }, 1200 );
  }

  /** Hard reset (if ever needed) */
  reset(): void {
    this.clearInterval();
    this.progressValue = 0;
    this.show = false;
    this.resetFlags();
  }

  ngOnDestroy(): void {
    this.clearInterval();
  }

  // ─────────────────────────── private helpers ───────────────────────────

  private clearInterval(): void {
    if ( this.intervalId !== null ) {
      clearInterval( this.intervalId );
      this.intervalId = null;
    }
  }

  private resetFlags(): void {
    this.isError = false;
    this.isSuccess = false;
    this.isWarning = false;
  }
}
