// Path: src/app/app.routes.ts
import { Routes } from '@angular/router';
import { AuthGuard } from './services/guardAuth/guard-auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
    data: { title: 'HOME' },
  },
  {
    path: 'login',
    data: { title: 'LOGIN' },
    loadComponent: () =>
      import( './pages/login/login.component' ).then( m => m.LoginComponent ),
  },
  {
    path: 'mobile-upload/:token',
    data: { title: 'UPLOADS' },
    loadComponent: () =>
      import( './pages/mobile-support-file-upload/mobile-support-file-upload' )
        .then( m => m.MobileSupportFileUpload ),
  },

  // ─────────────────────────────────────────────
  // DASHBOARD (main app shell)
  // ─────────────────────────────────────────────
  {
    path: 'dashboard',
    data: { title: 'DASHBOARD' },
    loadComponent: () =>
      import( './pages/dashboard/dashboard.component' ).then( m => m.DashboardComponent ),
    canActivate: [ AuthGuard ],
    canActivateChild: [ AuthGuard ],
    children: [
      // /dashboard → /dashboard/home
      { path: '', pathMatch: 'full', redirectTo: 'home' },

      // HOME
      {
        path: 'home',
        data: { title: 'HOME' }, // Breadcrumb: DASHBOARD > HOME
        loadComponent: () =>
          import( './pages/main/main.component' ).then( m => m.MainComponent ),
      },

      // PROPERTIES (main branch) PropertyComponent
      {
        path: 'properties',
        data: { title: 'PROPERTIES' }, // Breadcrumb: DASHBOARD > PROPERTIES
        loadComponent: () =>
          import( './pages/property/property.component' )
            .then( m => m.PropertyComponent ),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'list' },
          {
            path: 'list',
            data: { title: 'PROPERTY LIST' },
            loadComponent: () =>
              import( './pages/property/properties/properties-main-panel.component' )
                .then( m => m.PropertiesMainPanelComponent ),
          },
          {
            path: 'property-listing',
            data: { title: 'PROPERTY LISTING' }, // DASHBOARD > PROPERTIES > PROPERTY LISTING
            loadComponent: () =>
              import( './pages/property/property-listing/property-listing.component' )
                .then( m => m.PropertyListingComponent ),
          },
          {
            path: 'property-view/:propertyID',
            data: { title: 'VIEW PROPERTY' }, // DASHBOARD > PROPERTIES > VIEW PROPERTY
            loadComponent: () =>
              import( './pages/property/view/view.component' ).then( m => m.ViewComponent ),
          },
          {
            path: 'property-edit/:propertyID',
            data: { title: 'UPDATE PROPERTY' }, // DASHBOARD > PROPERTIES > UPDATE PROPERTY
            loadComponent: () =>
              import( './pages/property/edit-property-listing/edit-property-listing.component' )
                .then( m => m.EditPropertyListingComponent ),
          },
        ],
      },

      // USERS (main branch)
      {
        path: 'users',
        data: { title: 'USERS' }, // Breadcrumb: DASHBOARD > USERS
        loadComponent: () =>
          import( './pages/users/users.component' ).then( m => m.UsersComponent ),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'list' },

          {
            path: 'list',
            data: { title: 'USER LIST' }, // DASHBOARD > USERS > USER LIST (optional)
            loadComponent: () =>
              import( './pages/users/users-list/users-list.component' )
                .then( m => m.UsersListComponent ),
          },
          {
            path: 'add-new-user',
            data: { title: 'ADD USER' }, // DASHBOARD > USERS > ADD USER
            loadComponent: () =>
              import( './pages/users/add-new-user/add-new-user.component' )
                .then( m => m.AddNewUserComponent ),
          },
          {
            path: 'edit-user/:token',
            data: { title: 'EDIT USER' }, // DASHBOARD > USERS > EDIT USER
            loadComponent: () =>
              import( './pages/users/edit-user/edit-user.component' ).then( m => m.EditUserComponent ),
          },
          {
            path: 'user-profile/:token',
            data: { title: 'VIEW USER' }, // DASHBOARD > USERS > VIEW USER
            loadComponent: () =>
              import( './pages/users/user-profile/user-profile.component' )
                .then( m => m.UserProfileComponent ),
          },
        ],
      },

      // TENANT (main branch) — "tenant stay same"
      {
        path: 'tenant',
        data: { title: 'TENANT' }, // Breadcrumb: DASHBOARD > TENANT
        loadComponent: () =>
          import( './pages/tenant/tenant/tenant.component' ).then( m => m.TenantComponent ),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

          {
            path: 'dashboard',
            data: { title: 'TENANT DASHBOARD' }, // DASHBOARD > TENANT > TENANT DASHBOARD
            loadComponent: () =>
              import( './pages/tenant/home/home.component' ).then( m => m.HomeComponent ),
          },
          {
            path: 'payments-list',
            data: { title: 'PAYMENT LIST' }, // DASHBOARD > TENANT > PAYMENT LIST
            loadComponent: () =>
              import( './pages/tenant/payments/list/list.component' ).then( m => m.ListComponent ),
          },
          {
            path: 'payments-upload-proof',
            data: { title: 'PAYMENT PROOF UPLOAD' }, // fixed label
            loadComponent: () =>
              import( './pages/tenant/payments/upload-proof/upload-proof.component' )
                .then( m => m.UploadProofComponent ),
          },
          {
            path: 'tenant-lease/:leaseID',
            data: { title: 'TENANT LEASE' },
            loadComponent: () =>
              import( './pages/tenant/tenant-edit/tenant-edit.component' ).then( m => m.TenantEditComponent ),
          },
          {
            path: 'create-lease/:tenantID',
            data: { title: 'CREATE LEASE' },
            loadComponent: () =>
              import( './pages/tenant/add-new-lease/add-new-lease' ).then( m => m.AddNewLease ),
          },
          {
            path: 'view-lease/:leaseID',
            data: { title: 'VIEW LEASE' },
            loadComponent: () =>
              import( './pages/tenant/view-lease-agreement/view-lease-agreement' )
                .then( m => m.ViewLeaseAgreement ),
          },
          {
            path: 'tenant-view/:tenantID',
            data: { title: 'VIEW TENANT' },
            loadComponent: () =>
              import( './pages/tenant/tenant-view/tenant-view.component' ).then( m => m.TenantViewComponent ),
          },
          {
            path: 'complaints',
            data: { title: 'COMPLAINTS' },
            loadComponent: () =>
              import( './pages/tenant/complaints-main/complaint-main.component' )
                .then( m => m.ComplaintMainomponent ),
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

              {
                path: 'dashboard',
                data: { title: 'COMPLAINT DASHBOARD' },
                loadComponent: () =>
                  import( './pages/tenant/complaints-main/complaints/complaints' )
                    .then( m => m.ComplaintsHome ),
              },
              {
                path: 'create-complaint/:tenantID',
                data: { title: 'CREATE COMPLAINT' },
                loadComponent: () =>
                  import( './pages/tenant/complaints-main/create-complaints/create-complaints' )
                    .then( m => m.CreateComplaints ),
              },
              {
                path: 'edit-complaint/:complaintID',
                data: { title: 'UPDATE COMPLAINT' },
                loadComponent: () =>
                  import( './pages/tenant/complaints-main/edit-complaints/edit-complaints' )
                    .then( m => m.EditComplaints ),
              },
              {
                path: 'view-complaint/:complaintID',
                data: { title: 'VIEW COMPLAINT' },
                loadComponent: () =>
                  import( './pages/tenant/complaints-main/view-complaints/view-complaints' )
                    .then( m => m.ViewComplaints ),
              },
            ],
          },
        ],
      },

      // NOTIFICATIONS (main branch; componentless parent)
      {
        path: 'notifications',
        data: { title: 'NOTIFICATIONS' }, // Breadcrumb: DASHBOARD > NOTIFICATIONS
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'all-notifications' },

          {
            path: 'all-notifications',
            data: { title: 'ALL NOTIFICATIONS' }, // DASHBOARD > NOTIFICATIONS > ALL NOTIFICATIONS
            loadComponent: () =>
              import( './pages/notifications/notifications-main-page/notifications-main-page' )
                .then( m => m.NotificationsMainPage ),
          },
          {
            path: 'deleted-items', // requested path
            data: { title: 'DELETE ITEM' }, // Breadcrumb: DASHBOARD > NOTIFICATIONS > DELETE ITEM
            loadComponent: () =>
              import( './pages/notifications/deleted-item-notifications/deleted-item-notifications' )
                .then( m => m.DeletedItemNotificationsPage ),
          },
        ],
      },

      // Access control
      {
        path: 'access-control',
        data: { title: 'ACCESS CONTROL' },
        loadComponent: () =>
          import( './pages/access-control/access-control.component' ).then( m => m.AccessControlComponent ),
      },

      // Unknown child under /dashboard
      {
        path: '**',
        data: { title: 'NOT FOUND' },
        loadComponent: () =>
          import( './pages/error404/error404.component' ).then( m => m.Error404Component ),
      },
    ],
  },

  // Global catch-all
  {
    path: '**',
    loadComponent: () =>
      import( './pages/error404/error404.component' ).then( m => m.Error404Component ),
  },
];
