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
        data: {
          roles: ['admin', 'agent', 'tenant', 'operator', 'developer', 'user'],
        },
      },
      {
        path: 'properties',
        loadComponent: () =>
          import(
            './components/properties/properties-main-panel/properties-main-panel.component'
          ).then((m) => m.PropertiesMainPanelComponent),
        data: { roles: ['admin'] },
      },
      {
        path: 'user-profile',
        loadComponent: () =>
          import('./pages/user-profile/user-profile.component').then(
            (m) => m.UserProfileComponent
          ),
        data: {
          roles: ['admin', 'agent', 'tenant', 'operator', 'developer', 'user'],
        },
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/users/users.component').then((m) => m.UsersComponent),
        data: {
          roles: ['admin', 'operator'],
        },
      },
      {
        path: 'access-control',
        loadComponent: () =>
          import('./pages/access-control/access-control.component').then(
            (m) => m.AccessControlComponent
          ),
        data: {
          roles: ['admin'],
        },
      },
      {
        path: 'add-new-user',
        loadComponent: () =>
          import('./pages/add-new-user/add-new-user.component').then(
            (m) => m.AddNewUserComponent
          ),
        data: {
          roles: ['admin'],
        },
      },
      {
        path: 'view-user-profile/:username',
        loadComponent: () =>
          import('./pages/view-user-profile/view-user-profile.component').then(
            (m) => m.ViewUserProfileComponent
          ),
        data: {
          roles: ['admin'],
        },
      },
      {
        path: 'unauthorized',
        loadComponent: () =>
          import('./pages/error404/error404.component').then(
            (m) => m.Error404Component
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
