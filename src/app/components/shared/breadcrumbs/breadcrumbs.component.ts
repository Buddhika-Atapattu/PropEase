import {ChangeDetectionStrategy, Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {BreadcrumbService, Crumb} from '../../../core/breadcrumbs/breadcrumb.service';

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './breadcrumbs.component.html',
  styleUrl: './breadcrumbs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbsComponent {
  constructor (public readonly svc: BreadcrumbService) {}
}
