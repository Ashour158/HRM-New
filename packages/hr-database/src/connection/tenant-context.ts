import { AsyncLocalStorage } from 'async_hooks';
import type { Uuid } from '@hcm/shared-kernel';

interface TenantContextStore {
  tenantId: Uuid;
}

const tenantContext = new AsyncLocalStorage<TenantContextStore>();

export async function runWithTenant<T>(tenantId: Uuid, fn: () => Promise<T>): Promise<T> {
  return tenantContext.run({ tenantId }, fn);
}

export function getCurrentTenantId(): Uuid | undefined {
  return tenantContext.getStore()?.tenantId;
}
