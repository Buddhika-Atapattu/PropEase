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
  @ViewChild('notification') notificationElement!: ElementRef<HTMLDivElement>;
  private isBrowser: boolean;
  protected status: msg['type'] = 'error';
  protected message: string = '';
  protected showNotification: boolean = false;
  protected isHovered: boolean = false;

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

    if (this.isBrowser) {
      this.notificationElement.nativeElement.addEventListener(
        'mouseover',
        () => {
          this.notificationElement.nativeElement.style.cursor = 'pointer';
          this.isHovered = true;
        }
      );
      this.notificationElement.nativeElement.addEventListener(
        'mouseout',
        () => {
          this.isHovered = false;
        }
      );
    }
    if (!this.isHovered) {
      setTimeout(() => {
        this.showNotification = false;
      }, 5000);
    }
  }

  protected close() {
    this.showNotification = false;
  }
}
