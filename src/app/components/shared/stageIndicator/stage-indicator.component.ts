// Path: src/app/components/shared/stageIndicator/stage-indicator.component.ts
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  Input,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import {CommonModule, isPlatformBrowser} from '@angular/common';
import {MatTooltipModule} from '@angular/material/tooltip';

export interface StagePoint {
  key: string;
  label: string;
  value: number;
  disabled?: boolean;
}

interface StageRow {
  startIndex: number;
  endIndex: number;
  items: StagePoint[];
}

@Component({
  selector: 'app-stage-indicator',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  templateUrl: './stage-indicator.component.html',
  styleUrls: ['./stage-indicator.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StageIndicatorComponent implements AfterViewInit, OnDestroy {
  @Input({required: true}) public stages: StagePoint[] = [];
  @Input({required: true}) public currentValue!: number;
  @Input() public min?: number;
  @Input() public max?: number;
  @Input() public compact = false;
  @Input() public wrap = true;
  @Input() public minPointWidthPx = 120; // kept for compatibility, no longer drives breakpoints
  @Input() public showDisabled = true;

  public rows: StageRow[] = [];
  public progressPercent = 0;

  private sorted: StagePoint[] = [];
  private ro?: ResizeObserver;
  private readonly inBrowser: boolean;

  // Expose Math to template if needed
  protected readonly Math = Math;

  /**
   * Max bubble width in px – calculated from container width / itemsPerRow.
   * Bound into template to prevent bubble overlap.
   */
  protected bubbleMaxWidthPx = 160;

  @ViewChild('container', {static: true})
  private containerRef!: ElementRef<HTMLElement>;

  constructor (@Inject(PLATFORM_ID) platformId: Object) {
    this.inBrowser = isPlatformBrowser(platformId);
  }

  public ngAfterViewInit(): void {
    this.prepareData();
    this.layoutRows();

    if(this.inBrowser) {
      this.ro = new ResizeObserver(() => this.layoutRows());
      this.ro.observe(this.containerRef.nativeElement);
    }
  }

  public ngOnDestroy(): void {
    if(this.ro) {
      this.ro.disconnect();
    }
  }

  // ── Template helpers ─────────────────────────────────────────────

  public rowFillPercent(row: StageRow): number {
    const N: number = row.items.length;
    if(N === 0) {
      return 0;
    }

    const rowMinVal: number = row.items[0].value;
    const rowMaxVal: number = row.items[N - 1].value;

    if(this.currentValue < rowMinVal) {
      return 0;
    }

    if(this.currentValue > rowMaxVal) {
      return 100;
    }

    let idx: number = row.items.findIndex(
      (it: StagePoint) => it.value === this.currentValue,
    );

    if(idx === -1) {
      idx = 0;
      for(let i = 0; i < N; i++) {
        if(row.items[i].value <= this.currentValue) {
          idx = i;
        } else {
          break;
        }
      }
    }

    const pct: number = ((idx + 0.5) / N) * 100;
    return Math.max(0, Math.min(100, +pct.toFixed(3)));
  }

  public isReached(stage: StagePoint): boolean {
    return stage.value < this.currentValue;
  }

  public isCurrent(stage: StagePoint): boolean {
    return stage.value === this.currentValue;
  }

  public trackRow(_: number, row: StageRow): string {
    return `${row.startIndex}-${row.endIndex}`;
  }

  public trackItem(_: number, item: StagePoint): string {
    return item.key;
  }

  protected isDisabled(value: unknown): boolean {
    if(typeof value === 'boolean') {
      return value;
    }
    return false;
  }

  // ── Internals ────────────────────────────────────────────────────

  private prepareData(): void {
    this.sorted = [...this.stages].sort(
      (a: StagePoint, b: StagePoint) => a.value - b.value,
    );
    this.progressPercent = this.computeProgressPercent(this.currentValue);
  }

  private computeProgressPercent(current: number): number {
    const minValue: number = this.getMin();
    const maxValue: number = this.getMax();

    if(maxValue <= minValue) {
      return 0;
    }

    const clamped: number = Math.min(Math.max(current, minValue), maxValue);
    return ((clamped - minValue) / (maxValue - minValue)) * 100;
  }

  private getMin(): number {
    if(typeof this.min === 'number') {
      return this.min;
    }
    return this.sorted[0]?.value ?? 0;
  }

  private getMax(): number {
    if(typeof this.max === 'number') {
      return this.max;
    }
    return this.sorted.at(-1)?.value ?? 1;
  }

  /**
   * Decide how to split sorted stages into visual rows.
   * Uses breakpoint rules based on container width:
   *  - >= 1300px → max 4 items per row
   *  - >= 768px  → max 3 items per row
   *  - < 768px   → max 2 items per row
   */
  private layoutRows(): void {
    if(!this.wrap || !this.inBrowser) {
      this.rows = [
        {
          startIndex: 0,
          endIndex: this.sorted.length - 1,
          items: this.sorted,
        },
      ];
      this.updateBubbleMaxWidth(
        this.containerRef.nativeElement.clientWidth || 0,
        this.sorted.length || 1,
      );
      return;
    }

    // IMPORTANT: this is *component/container* width, not window.innerWidth
    const containerWidth: number = this.containerRef.nativeElement.clientWidth || 0;

    const perRow: number = this.computeItemsPerRow(
      containerWidth,
      this.sorted.length,
    );

    const out: StageRow[] = [];

    for(let i = 0; i < this.sorted.length; i += perRow) {
      const slice: StagePoint[] = this.sorted.slice(i, i + perRow);
      out.push({
        startIndex: i,
        endIndex: Math.min(i + perRow - 1, this.sorted.length - 1),
        items: slice,
      });
    }

    this.rows = out;

    // Use this row density to limit bubble width
    this.updateBubbleMaxWidth(containerWidth, perRow);
  }

  /**
   * Decide how many items per row based on the *component* width.
   *
   * containerWidth ranges:
   *  - > 1300px → auto (based on min width), but at least 2
   *  - 1300px down to 1024px → 4 items
   *  - 1024px down to 768px  → 3 items
   *  - 768px down to 425px   → 2 items
   *  - < 425px               → still 2 logically (min), bubbles shrink
   */
  private computeItemsPerRow(containerWidth: number, total: number): number {
    // Safety: if there is only 0 or 1 stage, just return total.
    if(total <= 1) {
      return total;
    }

    let perRow: number;

    if(containerWidth > 1300) {
      // Big container → auto based on min point width
      const safeMinWidth: number = Math.max(80, this.minPointWidthPx);
      perRow = Math.floor(containerWidth / safeMinWidth);

      // clamp to [2, total]
      if(perRow < 2) {
        perRow = 2;
      }
      if(perRow > total) {
        perRow = total;
      }
    } else if(containerWidth >= 1024) {
      // 1300px down to 1024px → exactly 4 items per row (max 4)
      perRow = Math.min(4, total);
    } else if(containerWidth >= 768) {
      // 1024px down to 768px → exactly 3 items per row (max 3)
      perRow = Math.min(3, total);
    } else if(containerWidth >= 425) {
      // 768px down to 425px → exactly 2 items per row (max 2)
      perRow = Math.min(2, total);
    } else {
      // < 425px: logically still 2 per row, but visually they will compress.
      perRow = Math.min(2, total);
    }

    // Final safety: if we have 2+ stages, never go below 2 per row.
    if(total >= 2 && perRow < 2) {
      perRow = 2;
    }

    return perRow;
  }

  /**
   * Calculate max bubble width for each item so that bubbles
   * cannot overlap each other inside a row.
   *
   * Roughly: cellWidth ≈ width / perRow → bubbleMaxWidth = 80% of that,
   * and clamped into a reasonable range.
   */
  private updateBubbleMaxWidth(containerWidth: number, perRow: number): void {
    if(containerWidth <= 0 || perRow <= 0) {
      this.bubbleMaxWidthPx = 160; // safe fallback (~10rem)
      return;
    }

    const cellWidth: number = containerWidth / perRow;

    // Keep a little horizontal padding between bubbles (80% of cell).
    let bubbleWidth: number = cellWidth * 0.8;

    // Clamp into a safe range so it never explodes or becomes unreadable.
    const MIN_WIDTH: number = 96;  // 6rem
    const MAX_WIDTH: number = 220; // ~13.75rem

    if(bubbleWidth < MIN_WIDTH) {
      bubbleWidth = MIN_WIDTH;
    } else if(bubbleWidth > MAX_WIDTH) {
      bubbleWidth = MAX_WIDTH;
    }

    this.bubbleMaxWidthPx = Math.round(bubbleWidth);
  }
}
