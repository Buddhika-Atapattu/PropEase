import {Component, Input, Output, ElementRef, HostListener, EventEmitter, AfterViewInit, OnInit, ViewChild, isDevMode, ChangeDetectorRef, OnChanges, SimpleChanges} from '@angular/core';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {NotificationDialogComponent} from '../../../dialogs/notification/notification.component';

@Component({
  selector: 'switch-button',
  standalone: true,
  imports: [CommonModule, FormsModule, NotificationDialogComponent],
  templateUrl: './switch-button.component.html',
  styleUrls: ['./switch-button.component.scss'],

})
export class SwitchButton implements AfterViewInit, OnInit, OnChanges {
  @ViewChild(NotificationDialogComponent) NotificationDialogComponent!: NotificationDialogComponent;
  @ViewChild('checkBox', {static: true}) checkBox!: ElementRef<HTMLInputElement>
  @Input({required: true}) checked: boolean = false;
  @Input() labelOn: string = 'ON';
  @Input() labelOff: string = 'OFF';
  @Input() disabled: boolean = false;
  @Output() checkedChange = new EventEmitter<boolean>();

  private _labelOn: string = 'ON';
  private _labelOff: string = 'OFF';
  protected localCheck!: boolean;

  constructor (private el: ElementRef, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    // Initialization logic here
    this.localCheck = this.checked;
  }

  ngAfterViewInit() {
    // try {
    //   if(this.labelOn.length > 3) {
    //     throw new Error('Label "ON" should be less than or equal to 3 characters');
    //   }
    //   if(this.labelOff.length > 3) {
    //     throw new Error('Label "OFF" should be less than or equal to 3 characters');
    //   }
    // }
    // catch(error) {
    //   console.error(error);
    //   this.NotificationDialogComponent.notification("warning", error as string)
    // }
  }

  onToggle(): void {
    try {
      if(this.disabled) return;
      this.checkedChange.emit(this.checkBox.nativeElement.checked);
    }
    catch(err) {
      console.error(err);
      return;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if(changes['checked']) {

    }
  }

  // @Input()
  // set labelOn(value: string) {
  //   if(isDevMode() && value.length > 3) {
  //     console.warn(`[SwitchButton] 'labelOn' should not exceed 3 characters.`);
  //   }
  //   const upperCaseValue = this.makeUpperCase(value);
  //   this._labelOn = upperCaseValue.length > 3 ? upperCaseValue.slice(0, 3) : upperCaseValue;
  // }
  // get labelOn() {
  //   return this._labelOn;
  // }

  // @Input()
  // set labelOff(value: string) {
  //   if(isDevMode() && value.length > 3) {
  //     console.warn(`[SwitchButton] 'labelOff' should not exceed 3 characters.`);
  //   }
  //   const upperCaseValue = this.makeUpperCase(value);
  //   this._labelOff = upperCaseValue.length > 3 ? upperCaseValue.slice(0, 3) : upperCaseValue;
  // }
  // get labelOff() {
  //   return this._labelOff;
  // }

  private makeUpperCase(str: string): string {
    return str.toUpperCase();
  }

}
