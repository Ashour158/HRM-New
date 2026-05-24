import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { FieldAccessResult } from '@/types';

/**
 * Hook to fetch field-level access decisions from backend policy engine.
 * @param fieldPath - Dot-notation path to the field (e.g., "worker.personal.ssn")
 * @param resourceType - Type of resource being accessed
 * @param resourceId - ID of the specific resource
 * @returns Field access result including value, decision, and masking rule
 */
export function useFieldAccess(
  fieldPath: string,
  resourceType: string,
  resourceId?: string
) {
  return useQuery<FieldAccessResult>({
    queryKey: ['field-access', resourceType, resourceId, fieldPath],
    queryFn: async () => {
      const response = await apiClient.get<FieldAccessResult>('/policy/field-access', {
        params: {
          fieldPath,
          resourceType,
          resourceId,
        },
      });
      return response.data;
    },
    enabled: !!resourceId && !!fieldPath,
    staleTime: 2 * 60 * 1000,
  });
}
