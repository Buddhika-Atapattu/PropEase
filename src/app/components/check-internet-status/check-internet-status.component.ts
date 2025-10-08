import {
  Component,
  Inject,
  PLATFORM_ID,
  OnInit,
  AfterViewInit,
  DestroyRef,
} from '@angular/core';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NetworkService} from '../../services/network/network.service';
import {MatIconModule} from '@angular/material/icon';

@Component({
  selector: 'app-check-internet-status',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  // ⬇️ This tells Angular to skip hydrating this component on the client.
  host: {ngSkipHydration: ''},
  templateUrl: './check-internet-status.component.html',
  styleUrl: './check-internet-status.component.scss',
})
export class CheckInternetStatusComponent implements OnInit, AfterViewInit {
  protected isOnline = true;          // Stable SSR default
  protected showOnlineMessage = false; // Stable SSR default
  private readonly isBrowser: boolean;

  constructor (
    private networkService: NetworkService,
    private destroyRef: DestroyRef,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // Keep SSR and initial client DOM identical
    this.isOnline = true;
    this.showOnlineMessage = false;
  }

  ngAfterViewInit(): void {
    if(!this.isBrowser) return;

    this.networkService.hasChecked$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status: boolean) => {
        this.isOnline = status;
        this.showOnlineMessage = true;

        if(status) {
          setTimeout(() => {
            this.showOnlineMessage = false;
          }, 5000);
        }
      });
  }
}
