import {Routes} from '@angular/router';
import {AuthGuard} from './services/guardAuth/guard-auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'mobile-upload/:token',
    loadComponent: () =>
      import('./pages/mobile-support-file-upload/mobile-support-file-upload').then((m) => m.MobileSupportFileUpload),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/main/main.component').then((m) => m.MainComponent),
        data: {
          roles: ['admin', 'agent', 'tenant', 'operator', 'developer', 'user'],
        },
      },
      {
        path: 'properties',
        loadComponent: () =>
          import('./pages/property/properties/properties-main-panel.component').then(
            (m) => m.PropertiesMainPanelComponent
          ),
        data: {roles: ['admin']},
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
        path: 'edit-user/:username',
        loadComponent: () =>
          import('./pages/edit-user/edit-user.component').then(
            (m) => m.EditUserComponent
          ),
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
        path: 'property-listing',
        loadComponent: () =>
          import(
            './pages/property/property-listing/property-listing.component'
          ).then((m) => m.PropertyListingComponent),
        data: {
          roles: ['admin'],
        },
      },
      {
        path: 'property-view/:propertyID',
        loadComponent: () =>
          import('./pages/property/view/view.component').then(
            (m) => m.ViewComponent
          ),
        data: {
          roles: ['admin'],
        },
      },
      {
        path: 'property-edit/:propertyID',
        loadComponent: () =>
          import(
            './pages/property/edit-property-listing/edit-property-listing.component'
          ).then((m) => m.EditPropertyListingComponent),
        data: {
          roles: ['admin'],
        },
      },
      {
        path: 'tenant',
        loadComponent: () =>
          import('./pages/tenant/tenant/tenant.component').then(
            (m) => m.TenantComponent
          ),
        data: {
          roles: ['admin'],
        },
        children: [
          {
            path: 'tenant-home',
            loadComponent: () =>
              import('./pages/tenant/home/home.component').then(
                (m) => m.HomeComponent
              ),
            data: {
              roles: ['admin'],
            },
          },
          {
            path: 'payments-list',
            loadComponent: () =>
              import('./pages/tenant/payments/list/list.component').then(
                (m) => m.ListComponent
              ),
            data: {
              roles: ['admin'],
            },
          },
          {
            path: 'payments-upload-proof',
            loadComponent: () =>
              import(
                './pages/tenant/payments/upload-proof/upload-proof.component'
              ).then((m) => m.UploadProofComponent),
            data: {
              roles: ['admin'],
            },
          },
          {
            path: 'complaints-create',
            loadComponent: () =>
              import('./pages/tenant/complaints/create/create.component').then(
                (m) => m.CreateComponent
              ),
            data: {
              roles: ['admin'],
            },
          },
          {
            path: 'complaints-status-view',
            loadComponent: () =>
              import(
                './pages/tenant/complaints/status-view/status-view.component'
              ).then((m) => m.StatusViewComponent),
            data: {
              roles: ['admin'],
            },
          },
          {
            path: 'documents',
            loadComponent: () =>
              import('./pages/tenant/documents/documents.component').then(
                (m) => m.DocumentsComponent
              ),
            data: {
              roles: ['admin'],
            },
          },
          {
            path: 'notifications',
            loadComponent: () =>
              import(
                './pages/tenant/notifications/notifications.component'
              ).then((m) => m.NotificationsComponent),
            data: {
              roles: ['admin'],
            },
          },
          {
            path: 'activity-log',
            loadComponent: () =>
              import('./pages/tenant/activity-log/activity-log.component').then(
                (m) => m.ActivityLogComponent
              ),
            data: {
              roles: ['admin'],
            },
          },
          {
            path: 'tenant-lease/:leaseID',
            loadComponent: () =>
              import('./pages/tenant/tenant-edit/tenant-edit.component').then(
                (m) => m.TenantEditComponent
              ),
            data: {
              roles: ['admin'],
            },
          },
          {
            path: 'create-lease/:tenantID',
            loadComponent: () =>
              import('./pages/tenant/add-new-lease/add-new-lease').then(
                (m) => m.AddNewLease
              ),
            data: {
              roles: ['admin'],
            },
          },
          {
            path: 'view-lease/:leaseID',
            loadComponent: () =>
              import('./pages/tenant/view-lease-agreement/view-lease-agreement').then(
                (m) => m.ViewLeaseAgreement
              ),
            data: {
              roles: ['admin'],
            },
          },
          {
            path: 'tenant-view/:tenantID',
            loadComponent: () =>
              import('./pages/tenant/tenant-view/tenant-view.component').then(
                (m) => m.TenantViewComponent
              ),
            data: {
              roles: ['admin'],
            },
          },
        ],
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
