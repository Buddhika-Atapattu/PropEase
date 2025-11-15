import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import {CommonModule, isPlatformBrowser} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {MatDialogRef} from '@angular/material/dialog';

/**
 * CloseBtn
 * - Fixed-position close button that tracks an Angular Material dialog panel.
 * - Sits OUTSIDE the dialog top-right by default.
 * - If dialog is essentially full-screen (near viewport edges), it moves INSIDE the top-right.
 */
@Component({
  selector: 'close-btn',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './close-btn.html',
  styleUrls: ['./close-btn.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloseBtnComponent implements OnInit, AfterViewInit, OnDestroy {
  /**
   * Optional: provide MatDialogRef to auto-close on click.
   * If not provided, we only emit (closed) and (valueChange).
   */
  @Input() matDialogRef?: MatDialogRef<unknown>;

  /**
   * Pixel offset used when positioning OUTSIDE the top-right corner.
   * e.g., 12 means the button’s outer edge sits ~12px outside.
   */
  @Input() offset: number = 12;

  /**
   * If the dialog is within this many pixels of each viewport edge,
   * we consider it "full-screen" and place the button INSIDE.
   */
  @Input() fullscreenThreshold: number = 16;

  /**
   * Back-compat with your original API (two-way binding if you want to)
   * Not required for functionality; left here if you hook it elsewhere.
   */
  @Input() value: boolean = false;
  @Output() valueChange = new EventEmitter<boolean>();

  /** Fire-and-forget close event for parent handlers */
  @Output() closed = new EventEmitter<void>();

  @ViewChild('closeBtn', {static: true}) private closeButton!: ElementRef<HTMLButtonElement>;

  // ——— Internal state ———
  private isBrowser: boolean;
  private dialogPanelEl: HTMLElement | null = null;
  private resizeObs?: ResizeObserver;
  private rafId = 0;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // -------------------------------------
  // Lifecycle
  // -------------------------------------
  ngOnInit(): void {
    // No-op: we rely on AfterViewInit when DOM is available
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) { return; }

    // 1) Locate the nearest Material dialog panel (.mat-mdc-dialog-panel)
    this.dialogPanelEl = this.findNearestDialogPanel();

    // 2) Start reacting to size/viewport changes
    this.attachObservers();

    // 3) Initial position
    this.queueLayout();
  }

  ngOnDestroy(): void {
    if (this.resizeObs) {
      this.resizeObs.disconnect();
      this.resizeObs = undefined;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    // Avoid dangling references
    this.dialogPanelEl = null;
  }

  // -------------------------------------
  // Public actions
  // -------------------------------------
  onClick(): void {
    try {
      // Emit both for flexibility
      this.value = true;
      this.valueChange.emit(this.value);
      this.closed.emit();

      // Auto-close the dialog if provided
      if (this.matDialogRef) {
        this.matDialogRef.close();
      }
    } catch (err) {
      // Failsafe: never block UI
      console.error('CloseBtn: click error', err);
    }
  }

  // -------------------------------------
  // Layout + Positioning
  // -------------------------------------
  private attachObservers(): void {
    // Observe dialog size changes
    if (this.dialogPanelEl && 'ResizeObserver' in window) {
      this.resizeObs = new ResizeObserver(() => this.queueLayout());
      this.resizeObs.observe(this.dialogPanelEl);
    }

    // Recalculate on viewport changes
    window.addEventListener('resize', this.queueLayout, {passive: true});
    window.addEventListener('scroll', this.queueLayout, {passive: true});
  }

  /** RAF-throttled layout request to avoid excessive sync measures */
  private queueLayout = (): void => {
    if (this.rafId) { return; }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.layout();
    });
  };

  /** Core positioning logic: decide inside vs outside, then set fixed top/left */
  private layout(): void {
    if (!this.dialogPanelEl || !this.isBrowser) { return; }

    const btnEl = this.closeButton?.nativeElement;
    if (!btnEl) { return; }

    // Measure dialog and button
    const rect = this.dialogPanelEl.getBoundingClientRect();

    const btnW = btnEl.offsetWidth || 40;
    const btnH = btnEl.offsetHeight || 40;

    // Fullscreen heuristic: dialog is within a threshold of each viewport edge
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nearLeft = rect.left <= this.fullscreenThreshold;
    const nearTop = rect.top <= this.fullscreenThreshold;
    const nearRight = (vw - (rect.left + rect.width)) <= this.fullscreenThreshold;
    const nearBottom = (vh - (rect.top + rect.height)) <= this.fullscreenThreshold;

    const isFullscreenish = nearLeft && nearTop && nearRight && nearBottom;

    // Compute desired coordinates (viewport-fixed)
    let top: number;
    let left: number;

    if (isFullscreenish) {
      // Place INSIDE: small inset from the dialog’s top-right corner
      const inset = Math.max(8, Math.min(16, this.fullscreenThreshold));
      top = Math.max(0, rect.top + inset);
      left = Math.min(vw - btnW, rect.right - inset - btnW);

      btnEl.classList.add('close-button--inside');
    } else {
      // Place OUTSIDE: hover just outside top-right with a pleasant offset
      const o = Math.max(4, this.offset);
      top = Math.max(0, rect.top - (btnH * 0.35) - o);
      left = Math.min(vw - btnW, rect.right + o - btnW * 0.65);

      btnEl.classList.remove('close-button--inside');
    }

    // Clamp to viewport to avoid losing the button when dialogs are at edges
    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    top = clamp(top, 4, vh - btnH - 4);
    left = clamp(left, 4, vw - btnW - 4);

    // Apply fixed coords
    btnEl.style.top = `${top}px`;
    btnEl.style.left = `${left}px`;
  }

  // -------------------------------------
  // Discovery helpers
  // -------------------------------------
  /**
   * Finds the nearest .mat-mdc-dialog-panel rendered by Angular Material.
   * We search the document because this component lives in an overlay layer.
   */
  private findNearestDialogPanel(): HTMLElement | null {
    try {
      // Most common single dialog: last opened panel is usually the topmost
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('.mat-mdc-dialog-panel'));
      if (candidates.length > 0) {
        return candidates[candidates.length - 1];
      }
    } catch (e) {
      console.warn('CloseBtn: unable to locate dialog panel', e);
    }
    return null;
  }
}
