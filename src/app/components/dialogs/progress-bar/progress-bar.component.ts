import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

@Component({
  selector: "app-progress-bar",
  imports: [ CommonModule, MatIconModule ],
  standalone: true,
  templateUrl: "./progress-bar.component.html",
  styleUrl: "./progress-bar.component.scss",
})
export class ProgressBarComponent implements OnDestroy {
  /**
   * NOTE:
   * Keep @Input for compatibility, but treat it as "initial visibility".
   * If parent binds [show]="something", parent can override your internal close.
   * Best usage with ViewChild: DO NOT bind [show] from parent; call start()/complete().
   */
  @Input() public show = false;

  @Output() public closed = new EventEmitter<void>();

  public progressValue = 0;

  protected isError = false;
  protected isSuccess = false;
  protected isWarning = false;

  private intervalId: ReturnType<typeof setInterval> | null = null;

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  public ngOnDestroy(): void {
    this.clearTimer();
  }

  // ===========================================================================
  // Public API (called from parent via ViewChild)
  // ===========================================================================
  public start(): void {
    // Reset state for a clean run
    this.clearTimer();
    this.resetFlags();

    this.show = true;
    this.progressValue = 0;

    // Simulated progress to 90% until complete()/error()/stop()
    this.intervalId = setInterval( () => {
      if (this.progressValue < 90) {
        this.progressValue += 2;
      }
    }, 100 );
  }

  public complete(): void {
    this.clearTimer();
    this.resetFlags();

    this.progressValue = 100;
    this.isSuccess = true;

    // Smooth close
    setTimeout( () => {
      this.show = false;
      this.closed.emit();
      this.resetFlags();
    }, 450 );
  }

  public stop(): void {
    this.clearTimer();
    this.resetFlags();

  // Keep current value, mark warning
    this.isWarning = true;

    setTimeout( () => {
      this.show = false;
      this.closed.emit();
      this.resetFlags();
    }, 450 );
  }

  public error(): void {
    this.clearTimer();
    this.resetFlags();

  // Keep current value, mark error
    this.isError = true;

    setTimeout( () => {
      this.show = false;
      this.closed.emit();
      this.resetFlags();
    }, 650 );
  }

  public reset(): void {
    this.clearTimer();
    this.resetFlags();

    this.progressValue = 0;
    this.show = false;
    this.closed.emit();
  }

  public close(): void {
    // Close button uses this
    this.reset();
  }

  // ===========================================================================
  // Internal helpers (class-based only)
  // ===========================================================================
  private clearTimer(): void {
    if ( this.intervalId ) {
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
