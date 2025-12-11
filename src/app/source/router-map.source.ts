import {
  AccessActionKey,
  AccessModuleKey
} from './access-map.source';

export interface RouteRequirement {
  url: string;
  module: AccessModuleKey;
  action: AccessActionKey;
}

export const DEFINED_ROUTES_URLS: ReadonlyArray<RouteRequirement> = [
  // ---------- Notifications ----------
  {
    url: '/dashboard/notifications/all-notifications',
    module: 'NotificationCenter',
    action: 'view',
  },

  // ---------- User Management ----------
  {
    url: '/dashboard/users',
    module: 'UserManagement',
    action: 'view',
  },
  {
    url: '/dashboard/users/add-new-user',
    module: 'UserManagement',
    action: 'create',
  },
  {
    url: '/dashboard/users/edit-user/:username',
    module: 'UserManagement',
    action: 'update',
  },
  {
    url: '/dashboard/users/user-profile/:username',
    module: 'UserManagement',
    action: 'view',
  },

  // Access Control (admin-only by route roles, but bound here too)
  {
    url: '/dashboard/access-control',
    module: 'AccessControl',
    action: 'controlSessions',
  },

  // ---------- Property Management ----------
  {
    url: '/dashboard/properties',
    module: 'PropertyManagement',
    action: 'view',
  },
  {
    url: '/dashboard/properties/property-listing',
    module: 'PropertyManagement',
    action: 'create',
  },
  {
    url: '/dashboard/properties/property-view/:propertyID',
    module: 'PropertyManagement',
    action: 'view',
  },
  {
    url: '/dashboard/properties/property-edit/:propertyID',
    module: 'PropertyManagement',
    action: 'update',
  },

  // ---------- Tenant Management (main) ----------
  {
    url: '/dashboard/tenant/tenant-home',
    module: 'TenantManagement',
    action: 'view',
  },
  {
    url: '/dashboard/tenant/tenant-view/:tenantID',
    module: 'TenantManagement',
    action: 'view',
  },
  {
    url: '/dashboard/tenant/create-lease/:tenantID',
    module: 'TenantManagement',
    action: 'create',
  },
  {
    url: '/dashboard/tenant/view-lease/:leaseID',
    module: 'TenantManagement',
    action: 'view',
  },
  {
    url: '/dashboard/tenant/edit-lease/:leaseID',
    module: 'TenantManagement',
    action: 'update',
  },

  // ---------- Tenant Complaints (Tenant Management module) ----------
  {
    url: '/dashboard/tenant/complaints',
    module: 'TenantManagement',
    action: 'view',
  },
  {
    url: '/dashboard/tenant/complaints/create-complaint/:tenantID',
    module: 'TenantManagement',
    action: 'create',
  },
  {
    url: '/dashboard/tenant/complaints/edit-complaint/:complaintID',
    module: 'TenantManagement',
    action: 'update',
  },
  {
    url: '/dashboard/tenant/complaints/view-complaint/:complaintID',
    module: 'TenantManagement',
    action: 'view',
  },

  // ---------- Team Management ----------
  {
    url: '/dashboard/team-management/dashboard',
    module: 'TeamManagement',
    action: 'monitor', // dashboard / performance overview
  },
  {
    url: '/dashboard/team-management/create',
    module: 'TeamManagement',
    action: 'create',
  },
  {
    url: '/dashboard/team-management/edit/:teamID',
    module: 'TeamManagement',
    action: 'update',
  },
  {
    url: '/dashboard/team-management/view/:teamID',
    module: 'TeamManagement',
    action: 'view',
  },
];
