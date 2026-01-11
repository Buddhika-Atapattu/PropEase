// Path: src/app/core/security/access-control.service.ts
// ============================================================================
// AccessControlService (class-based)
// ----------------------------------------------------------------------------
// Responsibilities:
//  - Keep current user's permissions in an O(1) lookup Set
//  - Provide can/canAny/canAll checks for UI + guards + action buttons
//  - Centralize permission logic (so templates stay clean)
// ============================================================================

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import type { PermissionEntry, UserWithAccess } from '../../source/access-map.source';
import type { PermPair } from './permissions.const';

@Injectable({ providedIn: 'root' })
export class AccessControlService {
  // We store permissions as string keys like: "TeamManagement.delete"
  private permissionSet: Set<string> = new Set<string>();

  // Current user (optional but useful for UI or debugging)
  private readonly user$ = new BehaviorSubject<UserWithAccess | null>(null);

  public get currentUser$(): Observable<UserWithAccess | null> {
    return this.user$.asObservable();
  }

  // ────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────

  /**
   * Call this after login / verify-user (or whenever user changes).
   * It rebuilds the permissionSet from user.accessControl[].
   */
  public setUser(user: UserWithAccess | null): void {
    this.user$.next(user);
    this.permissionSet = this.buildPermissionSet(user?.accessControl ?? []);
  }

  /**
   * Single permission check.
   * Example:
   *   access.can(PERM.TeamManagement.delete)
   */
  public can(permission: PermPair | null | undefined): boolean {
    if (!permission) return false;
    return this.permissionSet.has(this.toKey(permission));
  }

  /**
   * True if user has at least one permission from the list.
   */
  public canAny(permissions: ReadonlyArray<PermPair> | null | undefined): boolean {
    if (!Array.isArray(permissions) || permissions.length === 0) return false;

    for (const p of permissions) {
      if (this.permissionSet.has(this.toKey(p))) return true;
    }
    return false;
  }

  /**
   * True if user has all permissions from the list.
   */
  public canAll(permissions: ReadonlyArray<PermPair> | null | undefined): boolean {
    if (!Array.isArray(permissions) || permissions.length === 0) return false;

    for (const p of permissions) {
      if (!this.permissionSet.has(this.toKey(p))) return false;
    }
    return true;
  }

  /**
   * Optional: helpful for debugging UI issues.
   */
  public dumpKeys(): string[] {
    return Array.from(this.permissionSet.values()).sort();
  }

  // ────────────────────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────────────────────

  /**
   * Canonical key format: "Module.action"
   */
  private toKey(p: PermPair): string {
    const moduleKey = String(p.module ?? '').trim();
    const actionKey = String(p.action ?? '').trim();
    return `${moduleKey}.${actionKey}`;
  }

  /**
   * Build Set("Module.action") from stored user entries:
   *   { module: "TeamManagement", actions: ["view","delete"] }
   */
  private buildPermissionSet(entries: PermissionEntry[]): Set<string> {
    const set = new Set<string>();

    for (const entry of Array.isArray(entries) ? entries : []) {
      const moduleKey = String(entry?.module ?? '').trim();
      if (!moduleKey) continue;

      const actions = Array.isArray(entry.actions) ? entry.actions : [];
      for (const actionKey of actions) {
        const action = String(actionKey ?? '').trim();
        if (!action) continue;

        set.add(`${moduleKey}.${action}`);
      }
    }

    return set;
  }
}
