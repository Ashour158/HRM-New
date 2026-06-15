import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { BusinessPageHeader } from '@/components/common/business-page';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useMyNotifications } from '@/components/ui/notification-center';

type Filter = 'all' | 'unread';
const NOTIFICATIONS_KEY = ['platform-notifications', 'me'] as const;

export function NotificationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = React.useState<Filter>('all');
  const { data: notifications = [], isLoading } = useMyNotifications();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });

  const markRead = useMutation({
    mutationFn: (id: string) => apiClient.post(`/notifications/${id}/commands/read`, {}),
    onSuccess: invalidate,
  });
  const markAllRead = useMutation({
    mutationFn: () => apiClient.post('/notifications/commands/read-all', {}),
    onSuccess: invalidate,
  });

  const unread = notifications.filter((n) => !n.readAt).length;
  const visible = filter === 'unread' ? notifications.filter((n) => !n.readAt) : notifications;

  return (
    <div className="space-y-4">
      <BusinessPageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        actions={
          <Button variant="outline" size="sm" disabled={unread === 0 || markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            <CheckCheck aria-hidden="true" className="mr-1 h-4 w-4" />
            {t('notifications.markAllRead')}
          </Button>
        }
      />
      <div role="tablist" aria-label={t('notifications.filterLabel')} className="flex gap-2">
        {(['all', 'unread'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium',
              filter === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent',
            )}
          >
            {value === 'all' ? t('notifications.tabAll') : t('notifications.tabUnread', { count: unread })}
          </button>
        ))}
      </div>
      {isLoading ? null : visible.length === 0 ? (
        <EmptyState title={t('notifications.empty')} description={t('notifications.emptyDescription')} />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {visible.map((n) => (
              <div key={n.id} className={cn('flex items-start justify-between gap-3 px-4 py-3', !n.readAt && 'bg-accent/40')}>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {!n.readAt ? <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                    <span>{n.title}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{n.category}</Badge>
                  {!n.readAt ? (
                    <Button variant="ghost" size="sm" disabled={markRead.isPending} onClick={() => markRead.mutate(n.id)}>
                      {t('notifications.markRead')}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default NotificationsPage;
