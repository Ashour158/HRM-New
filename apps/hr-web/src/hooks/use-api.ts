import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryKey,
} from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { AxiosError } from 'axios';
import type { ApiResponse } from '@/types';

/**
 * Wrapper for TanStack Query useQuery with automatic error handling.
 * @param queryKey - Query key for caching
 * @param url - API endpoint URL
 * @param options - Additional query options
 * @returns Query result
 */
export function useApiQuery<T>(
  queryKey: QueryKey,
  url: string,
  options?: Omit<UseQueryOptions<T, AxiosError, T>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T, AxiosError>({
    queryKey,
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<T>>(url);
      return response.data.data;
    },
    ...options,
  });
}

/**
 * Wrapper for TanStack Query useMutation with automatic cache invalidation.
 * @param url - API endpoint URL
 * @param method - HTTP method
 * @param invalidateKeys - Query keys to invalidate on success
 * @param options - Additional mutation options
 * @returns Mutation result
 */
export function useApiMutation<TData, TVariables = unknown>(
  url: string | ((variables: TVariables) => string),
  method: 'post' | 'put' | 'patch' | 'delete' = 'post',
  invalidateKeys?: QueryKey[],
  options?: Omit<UseMutationOptions<TData, AxiosError, TVariables>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  const { onSuccess: callerOnSuccess, ...restOptions } = options ?? {};

  return useMutation<TData, AxiosError, TVariables>({
    mutationFn: async (variables: TVariables) => {
      const resolvedUrl = typeof url === 'function' ? url(variables) : url;
      const response = await apiClient[method]<ApiResponse<TData>>(resolvedUrl, variables);
      return response.data.data;
    },
    onSuccess: (...args: Parameters<NonNullable<typeof callerOnSuccess>>) => {
      if (invalidateKeys) {
        invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      }
      callerOnSuccess?.(...args);
    },
    ...restOptions,
  });
}

/**
 * Creates an optimistic update mutation.
 * @param url - API endpoint URL
 * @param method - HTTP method
 * @param queryKey - Query key for the data being updated
 * @param options - Additional mutation options
 * @returns Mutation result with optimistic update
 */
export function useOptimisticMutation<TData, TVariables = unknown>(
  url: string,
  method: 'post' | 'put' | 'patch' | 'delete' = 'post',
  queryKey?: QueryKey,
  options?: Omit<UseMutationOptions<TData, AxiosError, TVariables>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<TData, AxiosError, TVariables>({
    mutationFn: async (variables: TVariables) => {
      const response = await apiClient[method]<ApiResponse<TData>>(url, variables);
      return response.data.data;
    },
    onMutate: async (_variables: TVariables) => {
      if (!queryKey) return undefined;
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<TData>(queryKey);
      // Optimistically update can be customized per use case
      return { previousData };
    },
    onError: (_err, _variables, context) => {
      const ctx = context as { previousData?: TData } | undefined;
      if (queryKey && ctx?.previousData) {
        queryClient.setQueryData(queryKey, ctx.previousData);
      }
    },
    onSettled: () => {
      if (queryKey) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
    ...options,
  });
}
