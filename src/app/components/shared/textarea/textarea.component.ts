// Path: src/app/components/shared/textarea/textarea.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';

type ResizeMode = 'vertical' | 'horizontal' | 'both' | 'none';

@Component({
  selector: 'app-textarea',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './textarea.component.html',
  styleUrls: ['./textarea.component.scss'],
})
export class Textarea implements OnInit, OnDestroy, AfterViewInit {
  @Input() id: string = 'pe-textarea';
  @Input() name: string = 'pe-textarea';
  @Input() disabled: boolean = false;

  @Input() label: string = 'Comment';
  @Input() placeholder: string = 'Type your comment…';
  @Input() hint: string = '';
  @Input() required: boolean = false;
  @Input() invalid: boolean = false;

  @Input() autoGrow: boolean = true;
  @Input() rows: number = 4;
  @Input() resize: 'vertical' | 'horizontal' | 'both' | 'none' = 'vertical';

  @Input() showCounter: boolean = true;
  @Input() maxLength: number | null = 2000;

  @Input() text: string = '';
  @Output() textChange = new EventEmitter<string>();

  @ViewChild('ta', {static: true}) private taRef!: ElementRef<HTMLTextAreaElement>;

  ngOnInit(): void {}
  ngAfterViewInit(): void {this.adjustHeight();}
  ngOnDestroy(): void {}

  public onInput(value: string): void {
    if(this.maxLength != null && value.length > this.maxLength) {
      value = value.slice(0, this.maxLength);
    }
    this.text = value;
    this.textChange.emit(this.text);
    this.adjustHeight();
  }

  private adjustHeight(): void {
    if(!this.autoGrow || !this.taRef?.nativeElement) return;
    const el = this.taRef.nativeElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 480) + 'px';
  }

  /** Safe current length for templates */
  public get currentLength(): number {
    return (this.text ?? '').length;
  }

  /** Returns a number for limit math; Infinity when no limit */
  public get limitNumber(): number {
    return this.maxLength ?? Number.POSITIVE_INFINITY;
  }

  /** Whether we are near the limit (>= 90%) */
  public get isNearLimit(): boolean {
    if(this.maxLength == null) return false;
    return this.currentLength >= this.maxLength * 0.9;
  }

  /** aria-describedby helper */
  public describedBy(): string {
    const parts: string[] = [];
    if(this.hint) parts.push(this.id + '-hint');
    if(this.showCounter && this.maxLength != null) parts.push(this.id + '-counter');
    return parts.join(' ');
  }
}
