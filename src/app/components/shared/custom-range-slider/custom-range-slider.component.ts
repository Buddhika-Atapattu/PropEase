import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-custom-range-slider',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './custom-range-slider.component.html',
  styleUrl: './custom-range-slider.component.scss',
})
export class CustomRangeSliderComponent {
  @Input() min = 0;
  @Input() max = 100000000;
  @Input() step = 1000;

  @Input() value = 0;
  @Input() highValue = 100000000;

  @Output() valueChange = new EventEmitter<number>();
  @Output() highValueChange = new EventEmitter<number>();

  get rangePercentLow(): number {
    return ((this.value - this.min) / (this.max - this.min)) * 100;
  }

  get rangePercentHigh(): number {
    return ((this.highValue - this.min) / (this.max - this.min)) * 100;
  }

  protected onSliderClick(event: MouseEvent): void {
    const track = (event.target as HTMLElement).closest(
      '.slider-track'
    ) as HTMLElement;
    const trackRect = track.getBoundingClientRect();
    const percent = Math.min(
      Math.max(0, (event.clientX - trackRect.left) / trackRect.width),
      1
    );
    let clickedValue = this.min + (this.max - this.min) * percent;

    clickedValue = Math.round(clickedValue / this.step) * this.step;
    clickedValue = Math.min(Math.max(this.min, clickedValue), this.max);

    const lowDiff = Math.abs(clickedValue - this.value);
    const highDiff = Math.abs(clickedValue - this.highValue);

    if (lowDiff < highDiff) {
      this.value = Math.min(clickedValue, this.highValue - this.step);
      this.valueChange.emit(this.value);
    } else {
      this.highValue = Math.max(clickedValue, this.value + this.step);
      this.highValueChange.emit(this.highValue);
    }
  }

  protected onThumbDrag(event: MouseEvent, thumb: 'low' | 'high'): void {
    event.preventDefault();

    const track = (event.target as HTMLElement).closest(
      '.slider-track'
    ) as HTMLElement;
    const trackRect = track.getBoundingClientRect();

    const moveHandler = (moveEvent: MouseEvent) => {
      const x = moveEvent.clientX - trackRect.left;
      const percent = Math.min(Math.max(0, x / trackRect.width), 1); // Clamp between 0 and 1
      const rawValue = this.min + (this.max - this.min) * percent;
      const steppedValue = Math.round(rawValue / this.step) * this.step;

      if (thumb === 'low') {
        const clamped = Math.min(
          Math.max(this.min, steppedValue),
          this.highValue - this.step
        );
        this.value = clamped;
        this.valueChange.emit(this.value);
      } else {
        const clamped = Math.max(
          Math.min(this.max, steppedValue),
          this.value + this.step
        );
        this.highValue = clamped;
        this.highValueChange.emit(this.highValue);
      }
    };

    const upHandler = () => {
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
  }
}
