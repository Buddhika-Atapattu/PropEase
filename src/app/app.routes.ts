import { Routes } from '@angular/router';
import { guardAuth } from '../services/guardAuth/guard-auth.guard';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
    canActivate: [guardAuth],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
