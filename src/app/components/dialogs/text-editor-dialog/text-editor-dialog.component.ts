//  Path: src/app/components/dialogs/text-editor-dialog/text-editor-dialog.component
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/** Data passed from table to dialog */
export interface TextEditorDialogData {
  title: string;
  label: string;
  value: string;
  maxLength?: number;
}

/** Result returned from dialog to table */
export interface TextEditorDialogResult {
  value: string;
}

@Component( {
  selector: 'app-text-editor-dialog',
  standalone: true,
  templateUrl: './text-editor-dialog.component.html',
  styleUrls: [ './text-editor-dialog.component.scss' ],
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
} )
export class TextEditorDialogComponent {

  public value: string;

  public constructor (
    @Inject( MAT_DIALOG_DATA )
    public readonly data: TextEditorDialogData,
    private readonly dialogRef: MatDialogRef<
      TextEditorDialogComponent,
      TextEditorDialogResult
    >,
  ) {
    this.value = data.value || '';
  }

  public onCancel(): void {
    this.dialogRef.close();
  }

  public onSave(): void {
    const trimmed: string = this.value.trim();
    const result: TextEditorDialogResult = { value: trimmed };
    this.dialogRef.close( result );
  }
}
