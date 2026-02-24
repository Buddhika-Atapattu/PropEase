// Path: src/app/app.routes.ts
// =============================================================================
// PropEase — App Routes (Single Source of Truth for UI Navigation)
// =============================================================================
//
// ✅ Future-proof Notification Navigation (ActionKey → Route)
// -----------------------------------------------------------------------------
// Backend emits: NotificationTarget.actionKey + NotificationTarget.params
// Frontend resolves: actionKey -> best matching route (deterministic)
//
// This file provides the routing metadata needed for that resolver.
//
// -----------------------------------------------------------------------------
// RULES (STRICT — your rule applied)
// -----------------------------------------------------------------------------
// 1) ONLY “VIEW / LIST / DASHBOARD / NOTIFICATION CENTER” routes declare actionKeys.
//    - This prevents notifications navigating users into EDIT/CREATE flows.
// 2) actionKeyPriority is used to resolve duplicates safely.
//    - Higher wins. Use this ladder:
//        100 = best landing VIEW page (entity view)
//         70 = dashboard page (module overview)
//         40 = list page (collections)
//         10 = notifications center fallback
// 3) requiredParams MUST match route param names EXACTLY.
//    - Example route: 'view-lease/:leaseID' -> params must include { leaseID: '...' }
// 4) These metadata fields are ONLY used by your NotificationRouteMapService.
//    - Angular Router ignores them, so they won’t break routing.
// =============================================================================

import { Routes } from '@angular/router';
import { AuthGuard } from './services/guardAuth/guard-auth.guard';

export const routes: Routes = [
  // ───────────────────────────────────────────────────────────────────────────
  // Public routes
  // ───────────────────────────────────────────────────────────────────────────
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
    data: {
      title: 'UPLOADS',
      // This is not a main notification landing, but kept as optional mapping.
      actionKeys: [ 'system:update.available' ],
      actionKeyPriority: 40,
      requiredParams: [ 'token' ],
    },
    loadComponent: () =>
      import( './pages/mobile-support-file-upload/mobile-support-file-upload' ).then(
        m => m.MobileSupportFileUpload
      ),
  },
  {
    path: 'mfa/verification',
    data: {
      title: 'MFA VERIFICATION',
      actionKeys: [ 'user:mfa.enabled', 'user:mfa.disabled' ],
      actionKeyPriority: 70,
    },
    loadComponent: () =>
      import( './pages/mfa-verification/mfa-verification.component' ).then(
        m => m.MfaVerificationComponent
      ),
  },

  // ───────────────────────────────────────────────────────────────────────────
  // DASHBOARD (secured shell)
  // ───────────────────────────────────────────────────────────────────────────
  {
    path: 'dashboard',
    data: { title: 'DASHBOARD' },
    loadComponent: () =>
      import( './pages/dashboard/dashboard.component' ).then( m => m.DashboardComponent ),
    canActivate: [ AuthGuard ],
    canActivateChild: [ AuthGuard ],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },

      // ───────────────────────────────────────────────────────────────────────
      // HOME (safe landing for system-level notifications)
      // ───────────────────────────────────────────────────────────────────────
      {
        path: 'home',
        data: {
          title: 'HOME',
          actionKeys: [
            'system:maintenance.scheduled',
            'system:update.available',
            'system:security.alert',
            'system:backup.completed',
          ],
          actionKeyPriority: 70,
        },
        loadComponent: () =>
          import( './pages/main/main.component' ).then( m => m.MainComponent ),
      },

      // ───────────────────────────────────────────────────────────────────────
      // PROPERTIES
      // Notifications should land on LIST or VIEW only.
      // ───────────────────────────────────────────────────────────────────────
      {
        path: 'properties',
        data: { title: 'PROPERTIES' },
        loadComponent: () =>
          import( './pages/property/property.component' ).then( m => m.PropertyComponent ),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'list' },

          // LIST (collection landing)
          {
            path: 'list',
            data: {
              title: 'PROPERTY LIST',
              actionKeys: [
                'property:listing.created', // can safely land on list after create
                'property:listing.deleted',
              ],
              actionKeyPriority: 40,
            },
            loadComponent: () =>
              import( './pages/property/properties/properties-main-panel.component' ).then(
                m => m.PropertiesMainPanelComponent
              ),
          },

          // CREATE (no actionKeys by rule)
          {
            path: 'property-listing',
            data: { title: 'PROPERTY LISTING' },
            loadComponent: () =>
              import( './pages/property/property-listing/property-listing.component' ).then(
                m => m.PropertyListingComponent
              ),
          },

          // VIEW (best landing)
          {
            path: 'property-view/:propertyID',
            data: {
              title: 'VIEW PROPERTY',
              actionKeys: [
                'property:listing.updated',
                'property:inspection.scheduled',
                'property:inspection.completed',
                'property:maintenance.reported',
                'property:maintenance.resolved',
              ],
              actionKeyPriority: 100,
              requiredParams: [ 'propertyID' ],
            },
            loadComponent: () =>
              import( './pages/property/view/view.component' ).then( m => m.ViewComponent ),
          },

          // EDIT (no actionKeys by rule)
          {
            path: 'property-edit/:propertyID',
            data: {
              title: 'UPDATE PROPERTY',
              requiredParams: [ 'propertyID' ],
            },
            loadComponent: () =>
              import( './pages/property/edit-property-listing/edit-property-listing.component' ).then(
                m => m.EditPropertyListingComponent
              ),
          },
        ],
      },

      // ───────────────────────────────────────────────────────────────────────
      // USERS
      // Notifications should land on LIST or PROFILE (VIEW) only.
      // ───────────────────────────────────────────────────────────────────────
      {
        path: 'users',
        data: { title: 'USERS' },
        loadComponent: () =>
          import( './pages/users/users.component' ).then( m => m.UsersComponent ),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'list' },

          // LIST (collection landing)
          {
            path: 'list',
            data: {
              title: 'USER LIST',
              actionKeys: [
                'user:account.created', // safe landing after create
                'user:account.deleted',
              ],
              actionKeyPriority: 40,
            },
            loadComponent: () =>
              import( './pages/users/users-list/users-list.component' ).then(
                m => m.UsersListComponent
              ),
          },

          // CREATE (no actionKeys by rule)
          {
            path: 'add-new-user',
            data: { title: 'ADD USER' },
            loadComponent: () =>
              import( './pages/users/add-new-user/add-new-user.component' ).then(
                m => m.AddNewUserComponent
              ),
          },

          // EDIT (no actionKeys by rule)
          {
            path: 'edit-user/:token',
            data: {
              title: 'EDIT USER',
              requiredParams: [ 'token' ],
            },
            loadComponent: () =>
              import( './pages/users/edit-user/edit-user.component' ).then(
                m => m.EditUserComponent
              ),
          },

          // PROFILE / VIEW (best landing)
          {
            path: 'user-profile/:token',
            data: {
              title: 'VIEW USER',
              actionKeys: [
                'user:account.updated',
                'user:account.activated',
                'user:account.deactivated',
                'user:account.locked',
                'user:account.unlocked',
                'user:account.password.reset',
                'user:account.password.changed',
                'user:account.role.changed',
                'user:profile.updated',
                'user:login.success',
                'user:login.failed',
              ],
              actionKeyPriority: 100,
              requiredParams: [ "username" ],
            },
            loadComponent: () =>
              import( './pages/users/user-profile/user-profile.component' ).then(
                m => m.UserProfileComponent
              ),
          },
        ],
      },

      // ───────────────────────────────────────────────────────────────────────
      // TENANT
      // Notifications should land on dashboard/view pages only.
      // ───────────────────────────────────────────────────────────────────────
      {
        path: 'tenant',
        data: { title: 'TENANT' },
        loadComponent: () =>
          import( './pages/tenant/tenant.component' ).then( m => m.TenantComponent ),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

          // DASHBOARD (module landing)
          {
            path: 'dashboard',
            data: {
              title: 'TENANT DASHBOARD',
              actionKeys: [
                'tenant:account.created',
                'tenant:account.updated',
                'tenant:account.deleted',
                'tenant:rent.overdue',
              ],
              actionKeyPriority: 70,
            },
            loadComponent: () =>
              import( './pages/tenant/home/home.component' ).then( m => m.HomeComponent ),
          },

          // EDIT (no actionKeys by rule)
          {
            path: 'edit-lease/:leaseID',
            data: {
              title: 'LEASE EDIT',
              requiredParams: [ 'leaseID' ],
            },
            loadComponent: () =>
              import( './pages/tenant/edit-lease/edit-lease.component' ).then(
                m => m.LeaseEditComponent
              ),
          },

          // CREATE (no actionKeys by rule)
          {
            path: 'create-lease/:tenantID',
            data: {
              title: 'CREATE LEASE',
              requiredParams: [ 'tenantID' ],
            },
            loadComponent: () =>
              import( './pages/tenant/add-new-lease/add-new-lease' ).then( m => m.AddNewLease ),
          },

          // LEASE VIEW (best landing for lease events)
          {
            path: 'view-lease/:leaseID',
            data: {
              title: 'VIEW LEASE',
              actionKeys: [
                'lease:agreement.created',
                'lease:agreement.viewed',
                'lease:agreement.downloaded',
                'lease:agreement.renewed',
                'lease:agreement.terminated',
                'lease:signature.completed',
              ],
              actionKeyPriority: 100,
              requiredParams: [ 'leaseID' ],
            },
            loadComponent: () =>
              import( './pages/tenant/view-lease-agreement/view-lease-agreement' ).then(
                m => m.ViewLeaseAgreement
              ),
          },

          // TENANT VIEW (best landing for tenant events)
          {
            path: 'tenant-view/:tenantID',
            data: {
              title: 'VIEW TENANT',
              actionKeys: [ 'tenant:account.created', 'tenant:account.updated' ],
              actionKeyPriority: 100,
              requiredParams: [ 'tenantID' ],
            },
            loadComponent: () =>
              import( './pages/tenant/tenant-view/tenant-view.component' ).then(
                m => m.TenantViewComponent
              ),
          },

          // COMPLAINTS shell
          {
            path: 'complaints',
            data: { title: 'COMPLAINTS' },
            loadComponent: () =>
              import( './pages/tenant/complaints-main/complaint-main.component' ).then(
                m => m.ComplaintMainomponent
              ),
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

              // Complaints dashboard (module landing)
              {
                path: 'dashboard',
                data: {
                  title: 'COMPLAINT DASHBOARD',
                  actionKeys: [ 'tenant:complaint.created', 'tenant:complaint.resolved' ],
                  actionKeyPriority: 70,
                },
                loadComponent: () =>
                  import( './pages/tenant/complaints-main/complaints/complaints' ).then(
                    m => m.ComplaintsHome
                  ),
              },

              // CREATE (no actionKeys by rule)
              {
                path: 'create-complaint/:tenantID',
                data: {
                  title: 'CREATE COMPLAINT',
                  requiredParams: [ 'tenantID' ],
                },
                loadComponent: () =>
                  import( './pages/tenant/complaints-main/create-complaints/create-complaints' ).then(
                    m => m.CreateComplaints
                  ),
              },

              // EDIT (no actionKeys by rule)
              {
                path: 'edit-complaint/:complaintID',
                data: {
                  title: 'UPDATE COMPLAINT',
                  requiredParams: [ 'complaintID' ],
                },
                loadComponent: () =>
                  import( './pages/tenant/complaints-main/edit-complaints/edit-complaints' ).then(
                    m => m.EditComplaints
                  ),
              },

              // VIEW (best landing)
              {
                path: 'view-complaint/:complaintID',
                data: {
                  title: 'VIEW COMPLAINT',
                  actionKeys: [ 'tenant:complaint.created', 'tenant:complaint.resolved' ],
                  actionKeyPriority: 100,
                  requiredParams: [ 'complaintID' ],
                },
                loadComponent: () =>
                  import( './pages/tenant/complaints-main/view-complaints/view-complaints' ).then(
                    m => m.ViewComplaints
                  ),
              },
            ],
          },
        ],
      },

      // ───────────────────────────────────────────────────────────────────────
      // TEAM MANAGEMENT
      // ───────────────────────────────────────────────────────────────────────


      // ───────────────────────────────────────────────────────────────────────
      // NOTIFICATIONS CENTER (universal safe landing + fallback)
      // ───────────────────────────────────────────────────────────────────────
      {
        path: 'notifications',
        data: { title: 'NOTIFICATIONS' },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'all-notifications' },

          // Main inbox
          {
            path: 'all-notifications',
            data: {
              title: 'ALL NOTIFICATIONS',
              actionKeys: [
                'notification:delivered',
                'notification:failed',
                'notification:archived',

                // Comment events can safely land here if you haven't built a direct view path yet
                'comment:added',
                'comment:edited',
                'comment:deleted',
                'comment:mentioned',

                // Also accept system events here as a safe fallback
                'system:maintenance.scheduled',
                'system:update.available',
                'system:security.alert',
                'system:backup.completed',
              ],
              actionKeyPriority: 10,
            },
            loadComponent: () =>
              import( './pages/notifications/notifications-main-page' ).then(
                m => m.NotificationsMainPage
              ),
          },


        ],
      },

      // ───────────────────────────────────────────────────────────────────────
      // Access control
      // ───────────────────────────────────────────────────────────────────────
      {
        path: 'access-control',
        data: { title: 'ACCESS CONTROL' },
        loadComponent: () =>
          import( './pages/access-control/access-control.component' ).then(
            m => m.AccessControlComponent
          ),
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
