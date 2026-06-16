import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Sparkles, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { MeInbox, MeInboxAction, MeInboxItem, MeInboxSeverity } from '@/lib/me-inbox';
import { useApiQuery } from '@/hooks/use-api';
import { useUIStore } from '@/stores/ui-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const severityClasses: Record<MeInboxSeverity, string> = {
  INFO: 'border-sky-200 bg-sky-50 text-sky-700',
  DUE: 'border-amber-200 bg-amber-50 text-amber-700',
  OVERDUE: 'border-rose-200 bg-rose-50 text-rose-700',
  AT_RISK: 'border-orange-200 bg-orange-50 text-orange-700',
};

const severityRank: Record<MeInboxSeverity, number> = {
  OVERDUE: 0,
  AT_RISK: 1,
  DUE: 2,
  INFO: 3,
};

interface RankedInboxItem extends MeInboxItem {
  sectionTitle: string;
}

interface NextActionsProps {
  storageKey?: string;
  className?: string;
  maxItems?: number;
}

function severityLabel(severity: MeInboxSeverity, t: ReturnType<typeof useTranslation>['t']) {
  if (severity === 'OVERDUE') return t('home.severity.overdue');
  if (severity === 'DUE') return t('home.severity.due');
  if (severity === 'AT_RISK') return t('home.severity.atRisk');
  return t('home.severity.info');
}

function toTime(value?: string): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function topInboxItems(inbox: MeInbox | undefined, maxItems: number): RankedInboxItem[] {
  return (inbox?.sections ?? [])
    .flatMap((section) => section.items.map((item) => ({ ...item, sectionTitle: section.title })))
    .sort((left, right) => {
      const severityDelta = severityRank[left.severity] - severityRank[right.severity];
      if (severityDelta !== 0) return severityDelta;
      return toTime(left.dueAt) - toTime(right.dueAt);
    })
    .slice(0, maxItems);
}

export function NextActions({ storageKey = 'next-actions', className, maxItems = 3 }: NextActionsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);
  const [dismissed, setDismissed] = React.useState(() => window.localStorage.getItem(`dismissed:${storageKey}`) === 'true');
  const { data: inbox } = useApiQuery<MeInbox>(
    ['me-inbox', 'next-actions', storageKey],
    '/me/inbox',
    { retry: false, staleTime: 30_000 },
  );
  const items = React.useMemo(() => topInboxItems(inbox, maxItems), [inbox, maxItems]);

  const commandMutation = useMutation({
    mutationFn: async (action: MeInboxAction) => {
      const response = await apiClient.post(action.commandPath, action.body ?? {});
      return response.data;
    },
    onSuccess: () => {
      addNotification({
        title: t('nextActions.completedTitle'),
        message: t('nextActions.completedMessage'),
        type: 'success',
        read: false,
      });
      void queryClient.invalidateQueries({ queryKey: ['me-inbox'] });
    },
    onError: () => {
      addNotification({
        title: t('nextActions.failedTitle'),
        message: t('nextActions.failedMessage'),
        type: 'error',
        read: false,
      });
    },
  });

  const dismiss = React.useCallback(() => {
    window.localStorage.setItem(`dismissed:${storageKey}`, 'true');
    setDismissed(true);
  }, [storageKey]);

  if (dismissed || items.length === 0) return null;

  return (
    <section className={cn('rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm', className)} aria-label={t('nextActions.ariaLabel')}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-950">{t('nextActions.title')}</h2>
              <Badge variant="outline" className="rounded-full bg-white">{t('nextActions.count', { count: items.length })}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">{t('nextActions.subtitle')}</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={dismiss} aria-label={t('nextActions.dismiss')}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {items.map((item) => {
          const primaryAction = item.actions?.[0];
          return (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={severityClasses[item.severity]}>
                  {severityLabel(item.severity, t)}
                </Badge>
                <span className="text-xs font-semibold text-slate-500">{item.sectionTitle}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-950">{item.title}</p>
              {item.subtitle ? <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.subtitle}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {primaryAction ? (
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    disabled={commandMutation.isPending}
                    onClick={() => commandMutation.mutate(primaryAction)}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {primaryAction.label}
                  </Button>
                ) : null}
                <Button asChild type="button" size="sm" variant="outline" className="rounded-xl bg-white">
                  <Link to={item.deepLink}>
                    {t('nextActions.open')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
