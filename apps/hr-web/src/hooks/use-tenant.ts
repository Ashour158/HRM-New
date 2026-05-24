import { useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import type { Tenant, TenantConfig } from '@/types';

/**
 * Fetches the list of available tenants.
 * @returns Query result for tenants list
 */
function useTenantsQuery() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Tenant[] }>('/tenants');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Tenant context hook providing tenant state and selection.
 * @returns Tenant state, config, and selection methods
 */
export function useTenant() {
  const tenantId = localStorage.getItem('tenant_id') || '';

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
    window.location.reload();
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
