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
  selector: 'app-complaint-main',
  imports: [CommonModule, RouterModule],
  templateUrl: './complaint-main.component.html',
  styleUrl: './complaint-main.component.scss',
})
export class ComplaintMainomponent implements OnInit, OnDestroy {

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
