import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  AfterViewInit,
} from '@angular/core';
import { isPlatformBrowser, CommonModule, AsyncPipe } from '@angular/common';
import { WindowsRefService } from '../../../../services/windowRef.service';
import { ChangeDetectorRef } from '@angular/core';

export type msgTypes = 'success' | 'error' | 'warning' | 'info';

export interface msg {
  type: msgTypes | string;
  message: string;
}

export interface NotificationType{
  type: msgTypes | string;
  message: string;
}

@Component({
  selector: 'app-notification',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.scss',
})



export class NotificationComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('notification') notificationElement!: ElementRef<HTMLDivElement>;
  private isBrowser: boolean;
  protected status: msg['type'] = 'error';
  protected message: string = '';
  protected showNotification: boolean = false;
  protected isHovered: boolean = false;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngAfterViewInit() {}

  ngOnInit(): void {}

  ngOnDestroy(): void {}

  public async notification(status: msg['type'], message: string) {
    this.status = status;
    this.message = message;
    this.showNotification = true;

    if (this.cdr && this.isBrowser) {
      this.cdr.detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
    }
    if (!this.isHovered) {
      setTimeout(() => {
        this.showNotification = false;
        this.cdr.detectChanges();
      }, 5000);
    }
  }

  protected onMouseOver() {
    this.isHovered = true;
  }

  protected onMouseOut() {
    this.isHovered = false;
  }

  protected close() {
    this.showNotification = false;
  }
}
