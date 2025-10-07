import {
  Component,
  Inject,
  PLATFORM_ID,
  OnInit,
  AfterViewInit,
  ChangeDetectorRef,
} from '@angular/core';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {NetworkService} from '../../services/network/network.service';
import {MatIconModule} from '@angular/material/icon';

@Component({
  selector: 'app-check-internet-status',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './check-internet-status.component.html',
  styleUrl: './check-internet-status.component.scss',
})
export class CheckInternetStatusComponent implements OnInit, AfterViewInit {
  protected isOnline: boolean = true; // default: true for SSR
  protected showOnlineMessage: boolean = false;
  private isBrowser: boolean;

  constructor (
    private networkService: NetworkService,
    private cdRef: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    // Render a predictable initial DOM structure for SSR
    this.isOnline = true;
    this.showOnlineMessage = false;
  }

  ngAfterViewInit(): void {
    if(!this.isBrowser) return;

    this.networkService.hasChecked$.subscribe((status: boolean) => {
      this.isOnline = status;
      this.showOnlineMessage = true;
      this.cdRef.detectChanges();

      if(status) {
        setTimeout(() => {
          this.showOnlineMessage = false;
          this.cdRef.detectChanges();
        }, 5000);
      }
    });
  }
}
