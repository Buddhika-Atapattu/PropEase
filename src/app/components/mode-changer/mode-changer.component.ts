import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, NgIf } from '@angular/common';
import { WindowsRefService } from '../../services/windowRef/windowRef.service';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-mode-changer',
  standalone: true,
  imports: [MatIconModule, MatDividerModule, MatButtonModule, NgIf],
  templateUrl: './mode-changer.component.html',
  styleUrl: './mode-changer.component.scss',
})
export class ModeChangerComponent implements OnInit, OnDestroy {
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
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
      });
    }
  }

  toggleMode(): void {
    if (this.isBrowser) {
      this.windowRef.toggleDarkMode();
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }
}
