import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface SavedViewRecord {
  id: string;
  tenantId: string;
  userId: string;
  listKey: string;
  name: string;
  filters: Record<string, unknown>;
  columns: string[];
  isDefault: boolean;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveViewPayload {
  listKey: string;
  name: string;
  filters: Record<string, unknown>;
  columns: string[];
  isDefault?: boolean;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
}

export function useSavedViews(listKey?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['saved-views', listKey] as const;
  const enabled = Boolean(listKey);

  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<SavedViewRecord[]>>(`/saved-views/${encodeURIComponent(listKey ?? '')}`);
      const payload = response.data.data;
      return Array.isArray(payload) ? payload : [];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: SaveViewPayload) => {
      const response = await apiClient.post<ApiEnvelope<SavedViewRecord>>('/saved-views', payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<SaveViewPayload> & { id: string }) => {
      const response = await apiClient.patch<ApiEnvelope<SavedViewRecord>>(`/saved-views/${id}`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiEnvelope<{ deleted: true }>>(`/saved-views/${id}`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    views: query.data ?? [],
    isLoading: query.isLoading,
    createView: create.mutateAsync,
    updateView: update.mutateAsync,
    deleteView: remove.mutateAsync,
    isSaving: create.isPending || update.isPending || remove.isPending,
  };
}
