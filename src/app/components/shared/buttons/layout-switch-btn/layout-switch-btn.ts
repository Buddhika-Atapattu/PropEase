// Path: src/app/components/shared/buttons/layout-switch-btn/layout-switch-btn.ts
import {Component, EventEmitter, HostListener, Input, Output, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';

@Component({
  selector: 'app-layout-switch-btn',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './layout-switch-btn.html',
  styleUrls: ['./layout-switch-btn.scss'],
})
export class LayoutSwitchBtn implements OnInit {
  /** false = Row view, true = Column view */
  @Input({required: true}) value: boolean = false;

  /** Labels only for visuals */
  @Input() rowLabel: string = 'Row View';
  @Input() colLabel: string = 'Column View';

  /** Disable all interactions */
  @Input() disabled: boolean = false;

  /** Emit the boolean to parent */
  @Output() valueChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  ngOnInit(): void {
    // console.log(this.value);
  }
  /** Toggle current value */
  onToggle(): void {
    if(this.disabled) return;
    this.value = !this.value;
    this.valueChange.emit(this.value);
  }

  /** Explicit set (when clicking a specific side) */
  setRow(): void {
    if(this.disabled || this.value === false) return;
    this.value = false;
    this.valueChange.emit(false);
  }
  setCol(): void {
    if(this.disabled || this.value === true) return;
    this.value = true;
    this.valueChange.emit(true);
  }

  /** Keyboard a11y */
  @HostListener('keydown.enter', ['$event'])
  @HostListener('keydown.space', ['$event'])
  onKey(ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.onToggle();
  }
}
