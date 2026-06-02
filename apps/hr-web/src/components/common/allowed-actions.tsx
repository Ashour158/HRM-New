
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AllowedAction } from '@/types';

interface AllowedActionsProps {
  aggregateType: string;
  aggregateId?: string;
  state?: string;
  context?: Record<string, unknown>;
  onAction?: (action: AllowedAction) => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

/**
 * Fetches allowed actions from backend for an aggregate and renders action buttons.
 * The UI never infers allowed actions — always defers to backend policy.
 */
export function AllowedActions({
  aggregateType,
  aggregateId,
  state,
  context,
  onAction,
  variant = 'default',
  size = 'sm',
  className,
}: AllowedActionsProps) {
  const { data: actions, isLoading } = useQuery({
    queryKey: ['allowed-actions', aggregateType, aggregateId, state, context],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: AllowedAction[] }>('/policy/allowed-actions', {
        params: {
          aggregateType,
          aggregateId,
          state,
          ...context,
        },
      });
      return response.data.data;
    },
    enabled: !!aggregateType,
    staleTime: 1 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
      </div>
    );
  }

  if (!actions || actions.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ''}`}>
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={variant}
          size={size}
          onClick={() => onAction?.(action)}
          aria-label={action.label}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
