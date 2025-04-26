import { Routes } from '@angular/router';
import { guardAuth } from '../services/guardAuth/guard-auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
    canActivate: [guardAuth],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./components/main-panel/main-panel.component').then(
            (m) => m.MainPanelComponent
          ),
      },
      {
        path: 'properties',
        loadComponent: () =>
          import('./components/properties/properties-main-panel/properties-main-panel.component').then(
            (m) => m.PropertiesMainPanelComponent
          ),
      },
      {
        path: '**',
        loadComponent: () =>
          import('./pages/error404/error404.component').then(
            (m) => m.Error404Component
          ),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/error404/error404.component').then(
        (m) => m.Error404Component
      ),
  },
];
