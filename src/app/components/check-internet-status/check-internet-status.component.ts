import { Component, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { NetworkService } from '../../../services/network/network.service';

@Component({
  selector: 'app-check-internet-status',
  standalone: true,
  imports: [CommonModule],
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
    if (this.isBrowser) {
      // Show message when going online
      this.showOnlineMessage = true;

      // Hide it after 1 second
      setTimeout(() => {
        this.showOnlineMessage = false;
      }, 1000);
    }
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.networkService.isOnline$.subscribe((status) => {
        this.isOnline = status;
      });
    }
  }
}
