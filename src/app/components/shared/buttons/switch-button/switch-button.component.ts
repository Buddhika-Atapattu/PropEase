import {CommonModule} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'switch-button',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './switch-button.component.html',
  styleUrls: ['./switch-button.component.scss']
})
export class SwitchButton implements AfterViewInit, OnInit, OnChanges {
  @ViewChild('checkBox', {static: true})
  checkBox!: ElementRef<HTMLInputElement>;

  // hidden measurers (NOT the visual labels)
  @ViewChild('measureOn', {static: true})
  measureOnElement!: ElementRef<HTMLSpanElement>;

  @ViewChild('measureOff', {static: true})
  measureOffElement!: ElementRef<HTMLSpanElement>;

  @Input({required: true}) checked: boolean = false;
  @Input() labelOn: string = 'ON';
  @Input() labelOff: string = 'OFF';
  @Input() disabled: boolean = false;
  @Input() required: boolean = false;

  @Output() checkedChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  protected localCheck: boolean = false;
  protected switchWidth: number = 64; // initial fallback

  constructor (
    private readonly el: ElementRef<HTMLElement>,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.localCheck = !!this.checked;
    this.labelOn = this.makeUpperCase(this.labelOn.trim());
    this.labelOff = this.makeUpperCase(this.labelOff.trim());
  }

  ngAfterViewInit(): void {
    setTimeout((): void => {
      this.updateSwitchWidth();
      this.cdr.detectChanges();
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if(changes['checked'] && !changes['checked'].firstChange) {
      this.localCheck = !!changes['checked'].currentValue;
      if(this.checkBox?.nativeElement) {
        this.checkBox.nativeElement.checked = this.localCheck;
      }
      this.cdr.markForCheck();
    }

    if(changes['labelOn'] || changes['labelOff']) {
      if(!changes['labelOn']?.firstChange || !changes['labelOff']?.firstChange) {
        setTimeout((): void => {
          this.updateSwitchWidth();
          this.cdr.detectChanges();
        }, 0);
      }
    }
  }

  onToggle(): void {
    try {
      if(this.disabled) {
        return;
      }

      const nextChecked: boolean = this.checkBox.nativeElement.checked;

      this.localCheck = nextChecked;
      this.checked = nextChecked;

      this.checkedChange.emit(nextChecked);
      this.cdr.markForCheck();
    } catch(err) {
      console.error(err);
      return;
    }
  }

  private updateSwitchWidth(): void {
    if(!this.measureOnElement || !this.measureOffElement) {
      return;
    }

    const onRect: DOMRect = this.measureOnElement.nativeElement.getBoundingClientRect();
    const offRect: DOMRect = this.measureOffElement.nativeElement.getBoundingClientRect();

    const maxLabelWidth: number = Math.max(onRect.width, offRect.width);

    // Thumb is 26px wide, plus about 12px breathing space (6 each side)
    const thumbWidth: number = 26;
    const spacing: number = 12;
    const minWidth: number = 64;
    const marginSet = 16;

    const computedWidth: number = Math.ceil(maxLabelWidth + thumbWidth + spacing + marginSet);

    this.switchWidth = Math.max(minWidth, computedWidth);
  }

  private makeUpperCase(str: string): string {
    return str.toUpperCase();
  }
}
