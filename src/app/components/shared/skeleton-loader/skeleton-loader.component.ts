import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  Input,
} from '@angular/core';
import { WindowsRefService } from '../../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-skeleton-loader',
  imports: [CommonModule],
  templateUrl: './skeleton-loader.component.html',
  styleUrl: './skeleton-loader.component.scss',
})
export class SkeletonLoaderComponent {
  protected isBrowser: boolean;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
  @Input() width: string = '100%';
  @Input() height: string = '100%';
  @Input() borderRadius: string = '100%';
  @Input() Mode: boolean | null = null;

  ngOnInit(): void {}
}
