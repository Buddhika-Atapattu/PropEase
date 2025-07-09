import {
  Component,
  Inject,
  Input,
  PLATFORM_ID,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { APIsService, BaseUser } from '../../../services/APIs/apis.service';
import { WindowsRefService } from '../../../services/windowRef/windowRef.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CryptoService } from '../../../services/cryptoService/crypto.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { SkeletonLoaderComponent } from '../../shared/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-accessabilities',
  standalone: true,
  imports: [CommonModule, MatIconModule, SkeletonLoaderComponent],
  templateUrl: './accessabilities.component.html',
  styleUrl: './accessabilities.component.scss',
})
export class AccessabilitiesComponent implements OnInit, OnChanges {
  @Input() user: BaseUser | null = null;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected isActive: boolean = false;
  protected isLoading: boolean = true;
  protected accessabilities: BaseUser['access'] | null = null;

  constructor(
    private APIs: APIsService,
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private activatedRouter: ActivatedRoute,
    private crypto: CryptoService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.matIconRegistry.addSvgIcon(
      'active',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/correct.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'inactive',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/wrong.svg'
      )
    );
  }
  ngOnInit(): void {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
    this.isActive = this.user?.isActive || false;
    setTimeout(() => {
      this.isLoading = false;
    }, 500);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && this.user) {
      this.accessabilities = this.user.access;

    }
  }
}
