//src/types/notification.types.ts
// Keep this class-based by wrapping into a namespace-like class if you prefer.
// But Angular projects typically keep interfaces. If you must keep class-only,
// you can wrap them in a static class as readonly types or use abstract classes.

export interface RestoreNotificationPayload {
  _id?: string;
  category: string;                // 'tenant' | 'property' | ...
  refId?: string;                  // The real domain _id you want to restore
  snapshot?: Record<string, any>;  // Domain snapshot (Tenant/User/Property/Lease), NOT the notification
  metadata?: Record<string, any>;  // e.g. { filePath: 'tenants/123.json' }
}

export interface BackendRestoreResponse {
  success: boolean;
  message: string;
  data?: {
    category: string;
    refId?: string;
    restored?: any;
  };
}

// Your existing Notification model likely looks like this shape
export interface Notification {
  _id: string;
  category: string;              // 'Tenant' | 'Property' | 'User' | 'Lease' (or lowercases)
  type?: string;                 // often a subtype/verb, NOT an id!
  targetId?: string;             // <-- ensure you have this (domain document id)
  metadata?: Record<string, any>;
  // snapshot-like info if you embedded the domain object at delete time:
  domainSnapshot?: Record<string, any>; // optional: the actual entity JSON
}
