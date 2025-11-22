import {AfterViewInit, Component, type ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, type SimpleChanges, ViewChild} from '@angular/core';

@Component({
  selector: 'app-custom-input.component',
  imports: [],
  templateUrl: './custom-input.component.html',
  styleUrl: './custom-input.component.scss',
})
export class CustomInputComponent implements OnInit, OnChanges, AfterViewInit {
  @ViewChild('input', {static: true}) input !: ElementRef<HTMLInputElement>;
  @Input({required: true}) value!: string | number;
  @Input({required: true}) type!: string;
  @Input({required: true}) name !: string;
  @Input() id !: string;
  @Input() placeholder !: string;
  @Output() valueChange: EventEmitter<string | number> = new EventEmitter<string | number>()

  constructor () {

  }

  ngOnInit(): void {

  }
  ngAfterViewInit(): void {

  }
  ngOnChanges(changes: SimpleChanges): void {

  }
}
