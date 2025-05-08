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
import { isPlatformBrowser, CommonModule, AsyncPipe } from '@angular/common';
import { WindowsRefService } from '../../../../services/windowRef.service';
import { Subscription } from 'rxjs';

export type msgTypes = 'success' | 'error' | 'warning' | 'info';

export interface msg {
  type: msgTypes | string;
  message: string;
}

@Component({
  selector: 'app-notification',
  imports: [CommonModule],
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.scss',
})
export class NotificationComponent {
  private isBrowser: boolean;
  protected status: msg['type'] = 'error';
  protected message: string = '';
  protected showNotification: boolean = false;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  public async notification(status: msg['type'], message: string) {
    this.status = status;
    this.message = message;
    this.showNotification = true;
    console.log('status: ', status, 'message: ', message);
    setTimeout(() => {
      this.showNotification = false;
    }, 5000);
  }

  protected close() {
    this.showNotification = false;
  }
}
