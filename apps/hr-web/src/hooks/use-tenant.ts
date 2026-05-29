import { useCallback, useMemo, useState } from 'react';
import type { Tenant, TenantConfig } from '@/types';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_TENANT: Tenant = {
  id: DEFAULT_TENANT_ID,
  name: 'Default Tenant',
  config: {
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    timezone: 'UTC',
    features: [],
  },
};

/**
 * Fetches the list of available tenants.
 * @returns Query result for tenants list
 */
function useTenantsQuery() {
  return {
    data: [DEFAULT_TENANT],
    isLoading: false,
  };
}

/**
 * Tenant context hook providing tenant state and selection.
 * @returns Tenant state, config, and selection methods
 */
export function useTenant() {
  const [tenantId, setTenantIdState] = useState(() => localStorage.getItem('tenant_id') || DEFAULT_TENANT_ID);

  const { data: tenants = [], isLoading } = useTenantsQuery();

  const tenant = useMemo(() => {
    return tenants.find((t) => t.id === tenantId) || null;
  }, [tenants, tenantId]);

  const tenantConfig: TenantConfig = useMemo(() => {
    return (
      tenant?.config || {
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        timezone: 'UTC',
        features: [],
      }
    );
  }, [tenant]);

  /**
   * Sets the active tenant ID.
   */
  const setTenantId = useCallback((id: string) => {
    localStorage.setItem('tenant_id', id);
    setTenantIdState(id);
  }, []);

  return {
    tenantId,
    tenantName: tenant?.name || 'Default Tenant',
    tenantConfig,
    tenants,
    isLoading,
    setTenantId,
  };
}
