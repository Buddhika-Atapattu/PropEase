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
  selector: 'app-property.component',
  imports: [CommonModule, RouterModule],
  templateUrl: './property.component.html',
  styleUrl: './property.component.scss'
})
export class PropertyComponent implements OnInit, OnDestroy {



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
