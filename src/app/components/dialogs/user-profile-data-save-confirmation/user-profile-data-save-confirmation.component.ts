import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
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
import { isPlatformBrowser, CommonModule, AsyncPipe } from '@angular/common';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-user-profile-data-save-confirmation',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './user-profile-data-save-confirmation.component.html',
  styleUrl: './user-profile-data-save-confirmation.component.scss',
})
export class UserProfileDataSaveConfirmationComponent {
  protected isBrowser: boolean;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(MAT_DIALOG_DATA)
    public data: any,
    public dialogRef: MatDialogRef<UserProfileDataSaveConfirmationComponent>
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
  protected onCancel() {
    this.dialogRef.close(false);
  }
  protected onConfirm() {
    this.dialogRef.close(true);
  }
}
