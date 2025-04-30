import { Routes } from '@angular/router';
import { AuthGuard } from '../services/guardAuth/guard-auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
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
    canActivate: [AuthGuard],
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./components/main-panel/main-panel.component').then(
            (m) => m.MainPanelComponent
          ),
      },
      {
        path: 'properties',
        loadComponent: () =>
          import(
            './components/properties/properties-main-panel/properties-main-panel.component'
          ).then((m) => m.PropertiesMainPanelComponent),
      },
      {
        path: 'user-profile',
        loadComponent: () =>
          import('./components/user-profile/user-profile.component').then(
            (m) => m.UserProfileComponent
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
    data: {
      roles: ['admin'],
    },
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/error404/error404.component').then(
        (m) => m.Error404Component
      ),
  },
];
