import { Component, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { NetworkService } from '../../services/network/network.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-check-internet-status',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './check-internet-status.component.html',
  styleUrl: './check-internet-status.component.scss',
})
export class CheckInternetStatusComponent implements OnInit {
  protected isOnline: boolean = true;
  protected showOnlineMessage: boolean = false;
  private isBrowser: boolean;

  constructor(
    private networkService: NetworkService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async ngOnInit() {
    if (this.isBrowser) {
      this.networkService.hasChecked$.subscribe((status: boolean) => {
        this.isOnline = status;

        if (status) {
          // Online: Show message briefly
          this.showOnlineMessage = true;
          setTimeout(() => {
            this.showOnlineMessage = false;
          }, 5000);
        } else {
          // Offline: Keep showing message
          this.showOnlineMessage = true;
        }
      });
    }
  }
}
