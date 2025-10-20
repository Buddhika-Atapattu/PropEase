import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  AfterViewInit,
  ElementRef,
  ViewChild,
  Renderer2
} from '@angular/core';
import {WindowsRefService} from '../../../../services/windowRef/windowRef.service';
import {isPlatformBrowser, CommonModule} from '@angular/common';
import {Subscription} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {AuthService, LoggedUserType, PermissionEntry} from '../../../../services/auth/auth.service';
import {NotificationDialogComponent} from '../../../../components/dialogs/notification/notification.component';
import {TenantService} from '../../../../services/tenant/tenant.service';

@Component({
  selector: 'app-complaints',
  imports: [CommonModule, NotificationDialogComponent],
  templateUrl: './complaints.html',
  styleUrl: './complaints.scss'
})
export class ComplaintsHome implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(NotificationDialogComponent) notification!: NotificationDialogComponent;
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  private loggedUser!: LoggedUserType | null;
  protected isTenant: boolean = false;
  protected isLoggedUserHasPermission: boolean = false;

  constructor (
    private readonly windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly renderer: Renderer2
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
    this.loggedUser = this.authService.getLoggedUser;

  }

  async ngOnInit(): Promise<void> {
    if(this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }

    this.isTenant = await this.checkWhetherIsLoggedUserIsTenant();
  }

  ngAfterViewInit(): void {}

  private async checkWhetherIsLoggedUserIsTenant(): Promise<boolean> {
    if(!this.loggedUser) return false;
    const username = this.loggedUser.username;
    const res = await this.tenantService.getTenantByUsername(username.trim());
    console.log(res);
    if(res.status === 'success' && res.data) {
      return true;
    }
    else {
      return false;
    }
  }

  private checkWhetherLoggedUserHasPermission(): boolean {
    if(!this.loggedUser) return false;
    const access: PermissionEntry[] = this.loggedUser.access.permissions;
    if(!access) return false;

    for(let i = 0; i < access.length; i++) {
      if(access[i].module === 'Tenant Management' &&
        (access[i].actions.includes('view')
          || access[i].actions.includes('view complaint')
          || access[i].actions.includes('create complaint')
          || access[i].actions.includes('edit complaint')
          || access[i].actions.includes('delete complaint')
          || access[i].actions.includes('view lease')
          || access[i].actions.includes('create lease')
          || access[i].actions.includes('terminate lease')
          || access[i].actions.includes('activate lease')
          || access[i].actions.includes('renew lease')
          || access[i].actions.includes('extend lease')
          || access[i].actions.includes('assign to a unit/property')
          || access[i].actions.includes('view lease history')
          || access[i].actions.includes('send notification')
          || access[i].actions.includes('send email')
          || access[i].actions.includes('send SMS')
          || access[i].actions.includes('record manual payment')
          || access[i].actions.includes('view payment history')
          || access[i].actions.includes('upload payment proof')
          || access[i].actions.includes('upload lease documents')
          || access[i].actions.includes('view lease documents'))
      ) {
        return true;
        break;
      }
    }
    return false;
  }


  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }
}
