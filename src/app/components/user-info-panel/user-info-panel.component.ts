// user-info-panel.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ElementRef,
  EventEmitter,
  Output,
  HostListener,
} from '@angular/core';
import { AuthService, NewUser,LoggedUserType } from '../../../services/auth/auth.service';
import { Router } from '@angular/router';
import { WindowsRefService } from '../../../services/windowRef.service';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import User from '../../../../../back-end/src/api/user';

@Component({
  selector: 'app-user-info-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-info-panel.component.html',
  styleUrl: './user-info-panel.component.scss',
})
export class UserInfoPanelComponent implements OnInit, OnDestroy {
  @Output() closePanel = new EventEmitter<void>();
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected user: LoggedUserType | null = null;

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    private router: Router,
    private elementRef: ElementRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.authService.getLoggedUser !== null) {
      this.user = this.authService.getLoggedUser;
    }
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.close();
    }
  }

  protected logout(): void {
    this.authService.clearCredentials();
    document.cookie = 'username=; Max-Age=0; path=/';
    document.cookie = 'password=; Max-Age=0; path=/';
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  protected open() {
    this.router.navigate(['/dashboard/user-profile']);
  }

  protected close(): void {
    this.closePanel.emit();
  }
}
