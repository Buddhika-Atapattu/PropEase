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
import { isPlatformBrowser, CommonModule, AsyncPipe } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
  MatDialogModule,
} from '@angular/material/dialog';
import { WindowsRefService } from '../../../../services/windowRef.service';
import { Subscription } from 'rxjs';

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

  protected isDelete: boolean = false;
  protected title: string = '';
  protected message: string = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any = {},
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private dialogRef: MatDialogRef<ConfirmationComponent>
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }

    this.isDelete = this.data.confirmText;
    this.title = this.data.title;
    this.message = this.data.message;
  }

  protected cancel(){
    this.isDelete = false;
    const data = {
      confirmText: this.isDelete
    }
    this.dialogRef.close(data)
  }

  protected confirm(){
    this.isDelete = true;
    const data = {
      confirmText: this.isDelete
    }
    this.dialogRef.close(data)
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {}
}
