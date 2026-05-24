/**
 * @file RBAC Evaluation Engine
 * @description Pure-function role-based access control evaluator.
 */

import { getRoleDefinition, getAllRoles, type RoleCode } from './roles.js';

/**
 * Core RBAC engine for permission evaluation.
 */
export class RbacEngine {
  /**
   * Check whether any of the actor's roles grants the required permission.
   */
  hasPermission(actorRoles: string[], requiredPermission: string): boolean {
    const effective = this.getEffectivePermissions(actorRoles);
    return effective.includes(requiredPermission);
  }

  /**
   * Check whether the actor has at least one of the required permissions.
   */
  hasAnyPermission(actorRoles: string[], requiredPermissions: string[]): boolean {
    const effective = this.getEffectivePermissions(actorRoles);
    return requiredPermissions.some((p) => effective.includes(p));
  }

  /**
   * Check whether the actor has all of the required permissions.
   */
  hasAllPermissions(actorRoles: string[], requiredPermissions: string[]): boolean {
    const effective = this.getEffectivePermissions(actorRoles);
    return requiredPermissions.every((p) => effective.includes(p));
  }

  /**
   * Compute the flattened set of effective permissions from a list of role codes.
   */
  getEffectivePermissions(actorRoles: string[]): string[] {
    const set = new Set<string>();
    for (const role of actorRoles) {
      try {
        const def = getRoleDefinition(role as RoleCode);
        for (const perm of def.defaultPermissions) {
          set.add(perm);
        }
      } catch {
        // Unknown role — skip
      }
    }
    return Array.from(set);
  }

  /**
   * Find all roles that grant a specific permission.
   */
  getRolesForPermission(permission: string): string[] {
    return getAllRoles()
      .filter((role) => role.defaultPermissions.includes(permission))
      .map((role) => role.code);
  }
}
