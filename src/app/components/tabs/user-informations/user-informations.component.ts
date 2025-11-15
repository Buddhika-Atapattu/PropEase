import {CommonModule, isPlatformBrowser} from '@angular/common';
import {
  Component,
  Inject,
  Input,
  OnChanges,
  OnInit,
  PLATFORM_ID,
  SimpleChanges,
  AfterViewInit
} from '@angular/core';
import {MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {APIsService, User} from '../../../services/APIs/apis.service';
import {CryptoService} from '../../../services/cryptoService/crypto.service';
import {WindowsRefService} from '../../../services/windowRef/windowRef.service';
import {SkeletonLoaderComponent} from '../../shared/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-user-informations',
  imports: [CommonModule, MatIconModule, SkeletonLoaderComponent],
  standalone: true,
  templateUrl: './user-informations.component.html',
  styleUrl: './user-informations.component.scss',
})
export class UserInformationsComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() user!: User;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected isActive: boolean = false;
  protected isLoading: boolean = true;
  protected safeBio!: SafeHtml;

  constructor (
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
        'Images/Icons/correct.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'inactive',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        'Images/Icons/wrong.svg'
      )
    );
  }
  ngOnInit(): void {

    this.safeBio = this.domSanitizer.bypassSecurityTrustHtml(this.user?.bio || '');

    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
    this.isActive = this.user?.isActive || false;
    setTimeout(() => {
      this.isLoading = false;
    }, 500);
  }

  ngAfterViewInit(): void {
    try {
      if(!this.user) throw new Error('Invalid user!')
    }
    catch(err) {
      console.error(err);
      return;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if(changes['user'] && this.user) {
    }
  }
}
