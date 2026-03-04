import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

type ProgressState = "idle" | "running" | "success" | "warning" | "error";

@Component({
  selector: "app-progress-bar",
  imports: [ CommonModule, MatIconModule ],
  standalone: true,
  templateUrl: "./progress-bar.component.html",
  styleUrls: [ "./progress-bar.component.scss" ], // ✅ FIX: styleUrls (array)
})
export class ProgressBarComponent implements OnDestroy {

  @Input() public show = false;
  @Output() public closed = new EventEmitter<void>();

  public progressValue = 0;

  private state: ProgressState = "idle";

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private closeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // ---------------------------------------------------------------------------
  // Derived flags (Template-safe)
  // ---------------------------------------------------------------------------
  public get isError(): boolean {
    return this.state === "error";
  }

  public get isSuccess(): boolean {
    return this.state === "success";
  }

  public get isWarning(): boolean {
    return this.state === "warning";
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  public start(): void {
    this.clearTimers();
    this.state = "running";

    this.show = true;
    this.progressValue = 0;

    this.intervalId = setInterval( () => {
      if (this.progressValue < 90) {
        this.progressValue += 2;
      }
    }, 100 );
  }

  public complete(): void {
    this.finish( "success", 450 );
  }

  public stop(): void {
    this.finish( "warning", 450 );
  }

  public error(): void {
    this.finish( "error", 650 );
  }

  public reset(): void {
    this.clearTimers();
    this.state = "idle";
    this.progressValue = 0;
    this.show = false;
    this.closed.emit();
  }

  public close(): void {
    this.reset();
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------
  private finish( kind: ProgressState, delay: number ): void {
    this.clearTimers();

    this.progressValue = 100;
    this.state = kind;

    this.closeTimeoutId = setTimeout( () => {
      this.show = false;
      this.state = "idle";
      this.closed.emit();
      this.closeTimeoutId = null;
    }, delay );
  }

  private clearTimers(): void {
    if ( this.intervalId !== null ) {
      clearInterval( this.intervalId );
      this.intervalId = null;
    }
    if ( this.closeTimeoutId !== null ) {
      clearTimeout( this.closeTimeoutId );
      this.closeTimeoutId = null;
    }
  }

  public ngOnDestroy(): void {
    this.clearTimers();
  }
}
