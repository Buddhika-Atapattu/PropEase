import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { WindowsRefService } from '../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-list-main-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './list-main-panel.component.html',
  styleUrl: './list-main-panel.component.scss',
})
export class ListMainPanelComponent implements OnInit, OnDestroy {
  mode: boolean | null = null;
  isBrowser: boolean;
  private modeSub: Subscription | null = null;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
        console.log('MainPanel detected mode:', this.mode);
      });
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  
}
