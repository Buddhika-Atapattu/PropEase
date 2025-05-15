import { Component, Input } from '@angular/core';
import { isPlatformBrowser, CommonModule, AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-progress-bar',
  imports: [CommonModule],
  templateUrl: './progress-bar.component.html',
  styleUrl: './progress-bar.component.scss',
})
export class ProgressBarComponent {
  @Input() show = false;
  progressValue = 0;
  protected isError: boolean = false;
  protected isSuccess: boolean = false;
  protected isWarning: boolean = false;

  start() {
    this.show = true;
    this.progressValue = 0;

    const interval = setInterval(() => {
      if (this.progressValue < 90) {
        this.progressValue += 2; // Simulated progress
      }
    }, 100);

    return () => clearInterval(interval); // return a function to stop it
  }

  complete() {
    this.progressValue = 100;
    this.isSuccess = true;
    setTimeout(() => (this.show = false), 1000); // smooth close
  }

  stop() {
    this.progressValue = this.progressValue;
    this.isWarning = true;
    setTimeout(() => (this.show = false), 1000); // smooth close
  }

  error() {
    this.progressValue = this.progressValue;
    this.isError = true;
    setTimeout(() => (this.show = false), 1000); // smooth close
  }

  reset() {
    this.progressValue = 0;
    this.show = false;
  }
}
