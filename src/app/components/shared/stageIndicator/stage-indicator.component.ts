// Path: src/app/components/shared/stageIndicator/stage-indicator.component.ts
import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  Inject, Input, OnDestroy, PLATFORM_ID, ViewChild
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
  @Input({required: true}) stages: StagePoint[] = [];
  @Input({required: true}) currentValue!: number;
  @Input() min?: number;
  @Input() max?: number;
  @Input() compact = false;
  @Input() wrap = true;
  @Input() minPointWidthPx = 120;
  @Input() showDisabled = true;

  public rows: StageRow[] = [];
  public progressPercent = 0;

  private sorted: StagePoint[] = [];
  private ro?: ResizeObserver;
  private readonly inBrowser: boolean;

  protected readonly Math = Math;

  @ViewChild('container', {static: true}) private containerRef!: ElementRef<HTMLElement>;

  constructor (@Inject(PLATFORM_ID) platformId: Object) {
    this.inBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    this.prepareData();
    this.layoutRows();
    if(this.inBrowser) {
      this.ro = new ResizeObserver(() => this.layoutRows());
      this.ro.observe(this.containerRef.nativeElement);
    }
  }
  ngOnDestroy(): void {if(this.ro) this.ro.disconnect();}

  // ── Template helpers ─────────────────────────────────────────────

  /** Return fill % that reaches the CENTER of the current marker on this row. */
  public rowFillPercent(row: StageRow): number {
    const N = row.items.length;
    if(N === 0) return 0;

    const rowMinVal = row.items[0].value;
    const rowMaxVal = row.items[N - 1].value;

    // Current is before this row → no fill
    if(this.currentValue < rowMinVal) return 0;

    // Current is after this row → full fill
    if(this.currentValue > rowMaxVal) return 100;

    // Current is ON this row → fill to the center of the matching marker
    let idx = row.items.findIndex(it => it.value === this.currentValue);

    if(idx === -1) {
      // If current is between two values, snap to the previous marker
      idx = 0;
      for(let i = 0; i < N; i++) {
        if(row.items[i].value <= this.currentValue) idx = i;
        else break;
      }
    }

    // Map index -> center percentage
    const pct = ((idx + 0.5) / N) * 100;
    return Math.max(0, Math.min(100, +pct.toFixed(3)));
  }


  /** Past (strictly before current) */
  public isReached(stage: StagePoint): boolean {return stage.value < this.currentValue;}
  /** Current equals this value */
  public isCurrent(stage: StagePoint): boolean {return stage.value === this.currentValue;}

  public trackRow = (_: number, row: StageRow) => `${row.startIndex}-${row.endIndex}`;
  public trackItem = (_: number, item: StagePoint) => item.key;

  protected isDisabled(value: unknown): boolean {
    if(typeof value === 'boolean') return value;
    return false;
  }

  // ── Internals ────────────────────────────────────────────────────
  private prepareData(): void {
    this.sorted = [...this.stages].sort((a, b) => a.value - b.value);
    this.progressPercent = this.computeProgressPercent(this.currentValue);
  }
  private computeProgressPercent(current: number): number {
    const min = this.getMin(), max = this.getMax();
    if(max <= min) return 0;
    const c = Math.min(Math.max(current, min), max);
    return ((c - min) / (max - min)) * 100;
  }
  private getMin(): number {return typeof this.min === 'number' ? this.min : (this.sorted[0]?.value ?? 0);}
  private getMax(): number {return typeof this.max === 'number' ? this.max : (this.sorted.at(-1)?.value ?? 1);}

  private layoutRows(): void {
    if(!this.wrap || !this.inBrowser) {
      this.rows = [{startIndex: 0, endIndex: this.sorted.length - 1, items: this.sorted}];
      return;
    }
    const width = this.containerRef.nativeElement.clientWidth || 0;
    const perRow = this.computeItemsPerRow(width, this.minPointWidthPx, this.sorted.length);
    const out: StageRow[] = [];
    for(let i = 0; i < this.sorted.length; i += perRow) {
      const slice = this.sorted.slice(i, i + perRow);
      out.push({startIndex: i, endIndex: Math.min(i + perRow - 1, this.sorted.length - 1), items: slice});
    }
    this.rows = out;
  }

  private computeItemsPerRow(w: number, minW: number, total: number): number {
    if(w <= 0 || total <= 0) return total;
    const est = Math.max(1, Math.floor(w / Math.max(80, minW)));
    let even = est === 1 ? 1 : est % 2 === 0 ? est : est - 1;
    return Math.max(1, Math.min(even, total));
  }
}
