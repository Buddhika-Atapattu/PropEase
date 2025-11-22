// At the top of the file if still needed
/// <reference path="../../../../../types/typings.d.ts" />

import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild, ChangeDetectorRef,
  AfterViewInit, OnChanges,
  SimpleChanges
} from '@angular/core';
import { Router } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MatMomentDateModule
} from '@angular/material-moment-adapter';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import {
  MAT_DIALOG_DATA, MatDialogRef, MatDialogModule
} from '@angular/material/dialog';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { Subscription } from 'rxjs';
import { NotificationDialogComponent } from '../notification/notificationBar.component';
import { ScanService } from '../../../services/scan/scan.service';
import { CloseBtnComponent } from '../../shared/buttons/close-btn/close-btn';

@Component( {
  selector: 'app-file-viewer',
  imports: [
    CommonModule,
    NotificationDialogComponent,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatMomentDateModule,
    MatSelectModule,
    MatDividerModule,
    MatDialogModule,
    MatProgressBarModule,
    CloseBtnComponent
  ],
  templateUrl: './file-viewer.html',
  styleUrl: './file-viewer.scss',
} )
export class FileViewer implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  @ViewChild( NotificationDialogComponent, { static: true } )
  notification!: NotificationDialogComponent;

  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;

  protected isLoading: boolean = true;

  protected fileURL: string = '';
  private token: string = '';


  constructor (
    private windowRef: WindowsRefService,
    @Inject( PLATFORM_ID ) private platformId: Object,
    @Inject( MAT_DIALOG_DATA )
    public data: any = {},
    public dialogRef: MatDialogRef<FileViewer>,
    private cdr: ChangeDetectorRef,
    private scanService: ScanService,
    private router: Router,
    private crypto: CryptoService
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
    if ( this.isBrowser ) {
      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }
  }

  ngOnInit(): void {
    this.fileURL = this.data.document;
    this.token = this.data.token;
    this.cdr.detectChanges();
  }


  ngAfterViewInit(): void {}
  ngOnChanges( changes: SimpleChanges ): void {}
  ngOnDestroy(): void {}

  protected pannelClose() {
    this.dialogRef.close( {
      token: this.token,
    } );
  }
}
