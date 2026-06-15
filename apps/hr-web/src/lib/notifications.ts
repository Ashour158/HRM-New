import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface PlatformNotification {
  id: string;
  title: string;
  body: string;
  category: string;
  readAt?: string;
  createdAt: string;
  relatedAggregateType?: string;
  relatedAggregateId?: string;
}

interface ApiEnvelope<T> {
  data?: T;
}

export const NOTIFICATIONS_KEY = ['platform-notifications', 'me'] as const;

async function fetchMyNotifications(): Promise<PlatformNotification[]> {
  const res = await apiClient.get<ApiEnvelope<PlatformNotification[]>>('/notifications/me');
  return res.data?.data ?? [];
}

export function useMyNotifications() {
  return useQuery({ queryKey: NOTIFICATIONS_KEY, queryFn: fetchMyNotifications, refetchInterval: 60_000 });
}
