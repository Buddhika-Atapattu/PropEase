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
import { ActivatedRoute } from '@angular/router';
import { APIsService, UsersType } from '../../../services/APIs/apis.service';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { SkeletonLoaderComponent } from "../../components/shared/skeleton-loader/skeleton-loader.component";

@Component({
  selector: 'app-users',
  imports: [CommonModule, MatIconModule, SkeletonLoaderComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit, OnDestroy {
  protected mode: boolean | null = null;
  protected isBrowser: boolean;
  private modeSub: Subscription | null = null;
  protected users: UsersType[] = [];
  protected pageCount: number = 0;
  protected currentPage: number = 0;
  protected search: string = '';

  constructor(
    private windowRef: WindowsRefService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private APIsService: APIsService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
    });
    this.matIconRegistry.addSvgIcon(
      'view',
      this.domSanitizer.bypassSecurityTrustResourceUrl('/Images/Icons/view.svg')
    );
    this.matIconRegistry.addSvgIcon(
      'edit',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/pencil-square.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'delete',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/Images/Icons/delete.svg'
      )
    );
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.modeSub = this.windowRef.mode$.subscribe((val) => {
        this.mode = val;
      });
    }
    const usersArray = await this.APIsService.getAllUsersWithPagination(
      0,
      10,
      this.search
    );
    if (usersArray) {
      this.users = usersArray.data;
      this.pageCount = Math.round(usersArray.count / 10) + 1;
    }
    console.log(Math.round(usersArray.count / 10) + 1);
    Promise.resolve();
  }

  protected async searchUsers(event: Event) {
    this.search = (event.target as HTMLInputElement).value;
    const usersArray = await this.APIsService.getAllUsersWithPagination(
      0,
      10,
      this.search
    );
    console.log(usersArray);
    if (usersArray) {
      this.users = usersArray.data;
      this.pageCount = Math.round(usersArray.count / 10) + 1;
      this.currentPage = 0;
    }
  }

  protected async changePage(number: number) {
    const usersArray = await this.APIsService.getAllUsersWithPagination(
      number,
      10,
      this.search
    );
    if (usersArray) {
      this.users = usersArray.data;
      this.pageCount = Math.round(usersArray.count / 10) + 1;
      this.currentPage = number;
    }
  }

  protected async previousPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      await this.changePage(this.currentPage);
    }
  }

  protected async nextPage() {
    if (this.currentPage < this.pageCount - 1) {
      this.currentPage++;
      await this.changePage(this.currentPage);
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }
}
