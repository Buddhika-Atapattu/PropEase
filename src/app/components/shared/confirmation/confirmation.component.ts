import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  AfterViewInit,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import {isPlatformBrowser, CommonModule, AsyncPipe} from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-confirmation',
  imports: [],
  standalone: true,
  templateUrl: './confirmation.component.html',
  styleUrl: './confirmation.component.scss',
})
export class ConfirmationComponent implements OnInit, OnDestroy, AfterViewInit {
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  protected title: string = '';
  protected body: string = '';

  constructor (
    @Inject(MAT_DIALOG_DATA) public data: any = {},
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private dialogRef: MatDialogRef<ConfirmationComponent>
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
    this.title = this.data.title;
    this.body = this.data.message ?? this.data.body;
  }

  protected cancel() {
    this.dialogRef.close(false)
  }

  protected confirm() {
    this.dialogRef.close(true)
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {}
}
