import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  Input,
} from '@angular/core';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-skeleton-loader',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './skeleton-loader.component.html',
  styleUrl: './skeleton-loader.component.scss',
})
export class SkeletonLoaderComponent {
  protected isBrowser: boolean;

  constructor (
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
  @Input({required: true}) width: string = '100%';
  @Input({required: true}) height: string = '100%';
  @Input({required: false}) borderRadius: string = '0.25rem';
  @Input({required: false}) Mode: boolean | null = null;
  @Input({required: false}) key!: number;

  ngAfterViewInit() {

  }

  ngOnInit(): void {}
}
