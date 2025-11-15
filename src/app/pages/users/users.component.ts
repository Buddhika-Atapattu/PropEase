import {CommonModule, isPlatformBrowser} from '@angular/common';
import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';


@Component({
  selector: 'app-users',
  imports: [CommonModule, RouterModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit, OnDestroy {



  constructor (
    @Inject(PLATFORM_ID) private platformId: Object,
    private route: ActivatedRoute,
    private router: Router
  ) {

  }

  async ngOnInit(): Promise<void> {

  }

  ngOnDestroy(): void {
  }
}
