/**
 * Tenant context propagation via AsyncLocalStorage.
 */

import { Uuid } from '@hcm/shared-kernel';
import {
  runWithTenant as dbRunWithTenant,
  getCurrentTenantId as dbGetCurrentTenantId,
} from '@hcm/database';

export { runWithTenant, getCurrentTenantId } from '@hcm/database';

/**
 * Returns the current tenant ID or throws if none is set.
 * @returns The current tenant UUID.
 * @throws Error if called outside of a tenant context.
 */
export function requireCurrentTenantId(): Uuid {
  const tenantId = dbGetCurrentTenantId();
  if (!tenantId) {
    throw new Error('No tenant context is currently active');
  }
  return tenantId;
}

/**
 * Express / NestJS middleware that resolves the tenant and runs the
 * remainder of the request inside a tenant AsyncLocalStorage context.
 *
 * @param resolver - A {@link TenantResolver} implementation.
 */
export function TenantContextMiddleware(
  resolver: import('./tenant-resolver.js').TenantResolver
) {
  return async function tenantContextMiddleware(
    req: unknown,
    _res: unknown,
    next: (err?: unknown) => void
  ): Promise<void> {
    const result = await resolver.resolve(req);
    result.match(
      async (tenantId) => {
        await dbRunWithTenant(tenantId, async () => {
          next();
        });
      },
      async (error) => {
        next(error);
      }
    );
  };
}
