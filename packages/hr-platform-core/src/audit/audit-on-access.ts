/**
 * Audit-on-access interceptor and decorator for sensitive HR data queries.
 *
 * This module is framework-agnostic at the core and can be wired into
 * NestJS (or any other framework) via thin adapters.
 */

import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import type { AuditLedgerService } from './audit-ledger.js';

/**
 * Symbol used to attach resource type information to handlers.
 */
export const AUDIT_ON_ACCESS_KEY = Symbol('AUDIT_ON_ACCESS');

/**
 * Marks a handler or method as accessing sensitive HR data that must
 * produce an audit-on-access record.
 *
 * @param resourceType - The aggregate or entity type being queried.
 * @returns A decorator function.
 */
export function AuditOnAccess(resourceType: string) {
  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (descriptor.value as any)[AUDIT_ON_ACCESS_KEY] = resourceType;
    return descriptor;
  };
}

/**
 * Retrieves the resource type marked by `@AuditOnAccess` on a handler.
 * @param handler - The function to inspect.
 * @returns The resource type or undefined.
 */
export function getAuditOnAccessResourceType(
  handler: (...args: unknown[]) => unknown
): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (handler as any)[AUDIT_ON_ACCESS_KEY] as string | undefined;
}

/**
 * Context required to perform audit-on-access logging.
 */
export interface AuditOnAccessContext {
  actor: HrActor;
  resourceId: Uuid;
  fieldsAccessed: string[];
  reason: string;
}

/**
 * Framework-agnostic audit-on-access interceptor.
 *
 * Implementations should call `intercept` after the query succeeds,
 * passing the appropriate {@link AuditOnAccessContext}.
 */
export class AuditOnAccessInterceptor {
  /**
   * @param auditService - The audit ledger service.
   */
  constructor(private readonly auditService: AuditLedgerService) {}

  /**
   * Determines whether the handler should trigger audit-on-access.
   * @param handler - The handler function being invoked.
   * @returns True if the handler accesses sensitive data.
   */
  shouldAudit(handler: (...args: unknown[]) => unknown): boolean {
    return getAuditOnAccessResourceType(handler) !== undefined;
  }

  /**
   * Writes the audit-on-access record.
   * @param handler - The handler that was invoked.
   * @param context - Details of the access.
   */
  async intercept(
    handler: (...args: unknown[]) => unknown,
    context: AuditOnAccessContext
  ): Promise<void> {
    const resourceType = getAuditOnAccessResourceType(handler);
    if (!resourceType) {
      return;
    }

    await this.auditService.writeAuditOnAccess(
      context.actor,
      resourceType,
      context.resourceId,
      context.fieldsAccessed,
      context.reason
    );
  }
}
