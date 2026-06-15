import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { NOTIFICATIONS_KEY, useMyNotifications } from '@/lib/notifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export function NotificationCenter() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const { data: notifications = [] } = useMyNotifications();
  const unread = notifications.filter((n) => !n.readAt).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });

  const markRead = useMutation({
    mutationFn: (id: string) => apiClient.post(`/notifications/${id}/commands/read`, {}),
    onSuccess: invalidate,
  });
  const markAllRead = useMutation({
    mutationFn: () => apiClient.post('/notifications/commands/read-all', {}),
    onSuccess: invalidate,
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t('notifications.openLabel', { count: unread })}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell aria-hidden="true" className="h-5 w-5" />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent className="flex w-full max-w-md flex-col gap-0 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <SheetTitle className="text-base">{t('notifications.title')}</SheetTitle>
          <Button
            variant="ghost"
            size="sm"
            disabled={unread === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck aria-hidden="true" className="mr-1 h-4 w-4" />
            {t('notifications.markAllRead')}
          </Button>
        </div>
        <ul className="flex-1 divide-y divide-border overflow-auto" aria-label={t('notifications.listLabel')}>
          {notifications.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">{t('notifications.empty')}</li>
          ) : null}
          {notifications.map((n) => (
            <li key={n.id} className={cn('px-4 py-3', !n.readAt && 'bg-accent/40')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {!n.readAt ? <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                    <span className="truncate">{n.title}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">{n.category}</Badge>
                  {!n.readAt ? (
                    <Button variant="ghost" size="sm" disabled={markRead.isPending} onClick={() => markRead.mutate(n.id)}>
                      {t('notifications.markRead')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-4 py-3">
          <SheetClose asChild>
            <Link to="/notifications" className="text-sm font-medium text-primary hover:underline">
              {t('notifications.viewAll')}
            </Link>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
