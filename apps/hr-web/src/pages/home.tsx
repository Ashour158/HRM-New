import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock3, Sparkles } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { MeInbox, MeInboxAction, MeInboxSection, MeInboxSeverity } from '@/lib/me-inbox';
import { useApiQuery } from '@/hooks/use-api';
import { useUIStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { BusinessPageHeader } from '@/components/common/business-page';

const severityClasses: Record<MeInboxSeverity, string> = {
  INFO: 'border-sky-200 bg-sky-50 text-sky-700',
  DUE: 'border-amber-200 bg-amber-50 text-amber-700',
  OVERDUE: 'border-rose-200 bg-rose-50 text-rose-700',
  AT_RISK: 'border-orange-200 bg-orange-50 text-orange-700',
};

export function HomePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);
  const { data, isLoading, isError, error, refetch } = useApiQuery<MeInbox>(
    ['me-inbox'],
    '/me/inbox',
    { staleTime: 30_000 },
  );
  const sections = React.useMemo(() => data?.sections ?? [], [data?.sections]);
  const totalItems = React.useMemo(() => sections.reduce((sum, section) => sum + section.count, 0), [sections]);

  const commandMutation = useMutation({
    mutationFn: async (action: MeInboxAction) => {
      const response = await apiClient.post(action.commandPath, action.body ?? {});
      return response.data;
    },
    onSuccess: () => {
      addNotification({
        title: t('home.actionCompleted'),
        message: t('home.actionCompletedMessage'),
        type: 'success',
        read: false,
      });
      void queryClient.invalidateQueries({ queryKey: ['me-inbox'] });
    },
    onError: () => {
      addNotification({
        title: t('home.actionFailed'),
        message: t('home.actionFailedMessage'),
        type: 'error',
        read: false,
      });
    },
  });

  if (isError) {
    return (
      <div className="space-y-6">
        <BusinessPageHeader title={t('home.title')} subtitle={t('home.subtitle')} icon={Sparkles} />
        <ErrorState title={t('home.errorTitle')} error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BusinessPageHeader
        title={t('home.title')}
        subtitle={t('home.subtitle')}
        icon={Sparkles}
        actions={(
          <Badge className="rounded-full bg-white/70 px-3 py-1 text-slate-700">
            {t('home.itemCount', { count: totalItems })}
          </Badge>
        )}
      />

      {isLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Card key={index} className="min-h-48 animate-pulse border border-white/60 bg-white/50" />
          ))}
        </div>
      ) : totalItems === 0 ? (
        <EmptyState icon={CheckCircle2} title={t('home.emptyTitle')} description={t('home.emptyDescription')} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {sections.map((section) => (
            <InboxSection
              key={section.key}
              section={section}
              executeAction={(action) => commandMutation.mutate(action)}
              actionPending={commandMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InboxSection({
  section,
  executeAction,
  actionPending,
}: {
  section: MeInboxSection;
  executeAction: (action: MeInboxAction) => void;
  actionPending: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Card className="border border-white/60 bg-white/60">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <h2 className="font-headline text-lg font-semibold text-card-foreground">{section.title}</h2>
        <Badge variant="outline" className="rounded-full bg-white/60">{section.count}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {section.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/70 bg-white/40 p-4 text-sm text-slate-500">
            {t('home.sectionEmpty')}
          </p>
        ) : section.items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={severityClasses[item.severity]}>
                    {severityLabel(item.severity, t)}
                  </Badge>
                  {item.dueAt ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {new Date(item.dueAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
                <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                {item.subtitle ? <p className="text-sm text-slate-600">{item.subtitle}</p> : null}
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-xl bg-white/80">
                <Link to={item.deepLink}>{t('home.open')}</Link>
              </Button>
            </div>
            {item.actions?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.actions.map((action) => (
                  <Button
                    key={`${item.id}:${action.commandPath}`}
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    disabled={actionPending}
                    aria-label={`${action.label} ${item.title}`}
                    onClick={() => executeAction(action)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function severityLabel(severity: MeInboxSeverity, t: ReturnType<typeof useTranslation>['t']) {
  if (severity === 'OVERDUE') return t('home.severity.overdue');
  if (severity === 'DUE') return t('home.severity.due');
  if (severity === 'AT_RISK') return t('home.severity.atRisk');
  return t('home.severity.info');
}
