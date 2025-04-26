import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { WindowsRefService } from '../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error404.component.html',
  styleUrl: './error404.component.scss',
})
export class Error404Component {
  public mode: boolean | null = null;
  isBrowser: boolean;

  constructor(
    private router: Router,
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
