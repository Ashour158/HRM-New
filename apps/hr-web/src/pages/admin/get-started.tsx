import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Building2, CheckCircle2, CircleDashed, PlugZap, Settings2, ShieldCheck, UserPlus, WalletCards } from 'lucide-react';
import { useTenant } from '@/hooks/use-tenant';
import { useApiQuery } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BusinessMetric, BusinessPageHeader } from '@/components/common/business-page';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { cn } from '@/lib/utils';
import type { HcmSetupConfig, Worker } from '@/types';

type StepState = 'complete' | 'incomplete' | 'info';

interface ReadinessDomain {
  code: string;
  label: string;
  status: 'READY' | 'WARNING' | 'BLOCKED' | 'NOT_CONFIGURED';
  actionPath?: string;
}

interface ReadinessSnapshot {
  overallScore?: number;
  domains?: ReadinessDomain[];
}

interface OrganizationSummary {
  legalEntities?: unknown[];
  orgUnits?: unknown[];
  managerRelationships?: unknown[];
}

interface PolicySummary {
  leavePolicies?: number;
  payrollPacks?: number;
  earningPolicies?: number;
  deductionPolicies?: number;
}

interface IntegrationReadiness {
  adapters?: Array<{ ready?: boolean }>;
}

interface SsoProvider {
  id?: string;
  displayName?: string;
}

interface StepDefinition {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  state: StepState;
  evidence: string;
  icon: React.ElementType;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function workerCount(value: Worker[] | { items?: Worker[]; total?: number } | undefined): number {
  if (Array.isArray(value)) return value.length;
  return value?.total ?? value?.items?.length ?? 0;
}

function domainStatus(readiness: ReadinessSnapshot | undefined, code: string): ReadinessDomain | undefined {
  return readiness?.domains?.find((domain) => domain.code.toLowerCase() === code.toLowerCase());
}

function stateFromBoolean(value: boolean): StepState {
  return value ? 'complete' : 'incomplete';
}

function stepTone(state: StepState) {
  if (state === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (state === 'incomplete') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function StepBadge({ state }: { state: StepState }) {
  const { t } = useTranslation();
  const label = state === 'complete'
    ? t('adminGetStarted.status.complete')
    : state === 'incomplete'
      ? t('adminGetStarted.status.incomplete')
      : t('adminGetStarted.status.info');
  return <Badge variant="outline" className={cn('rounded-full', stepTone(state))}>{label}</Badge>;
}

function StepIcon({ state, icon: Icon }: { state: StepState; icon: React.ElementType }) {
  if (state === 'complete') return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (state === 'incomplete') return <Icon className="h-5 w-5 text-amber-600" />;
  return <CircleDashed className="h-5 w-5 text-slate-500" />;
}

export function AdminGetStarted() {
  const { t } = useTranslation();
  const { tenantId } = useTenant();
  const readinessQuery = useApiQuery<ReadinessSnapshot>(
    ['admin-get-started-readiness'],
    '/admin/system-console/readiness',
    { retry: false },
  );
  const setupQuery = useApiQuery<HcmSetupConfig>(
    ['admin-get-started-hcm-setup'],
    '/admin/hcm-setup',
    { retry: false },
  );
  const organizationQuery = useApiQuery<OrganizationSummary>(
    ['admin-get-started-organization-summary'],
    '/hr/organization/summary',
    { retry: false },
  );
  const workersQuery = useApiQuery<Worker[] | { items?: Worker[]; total?: number }>(
    ['admin-get-started-workers'],
    '/hr/core/workers?pageSize=1',
    { retry: false },
  );
  const policyQuery = useApiQuery<PolicySummary>(
    ['admin-get-started-policy-summary'],
    '/admin/policies/summary',
    { retry: false },
  );
  const integrationQuery = useApiQuery<IntegrationReadiness>(
    ['admin-get-started-integrations'],
    '/hr/integrations/readiness',
    { retry: false },
  );
  const ssoQuery = useApiQuery<SsoProvider[]>(
    ['admin-get-started-sso', tenantId],
    `/auth/providers?tenantId=${encodeURIComponent(tenantId)}`,
    { retry: false, enabled: Boolean(tenantId) },
  );

  const loading = readinessQuery.isLoading || setupQuery.isLoading || organizationQuery.isLoading || workersQuery.isLoading || policyQuery.isLoading || integrationQuery.isLoading || ssoQuery.isLoading;
  const error = readinessQuery.error ?? setupQuery.error ?? organizationQuery.error ?? workersQuery.error ?? policyQuery.error ?? integrationQuery.error ?? ssoQuery.error;
  const isError = readinessQuery.isError || setupQuery.isError || organizationQuery.isError || workersQuery.isError || policyQuery.isError || integrationQuery.isError || ssoQuery.isError;

  const org = organizationQuery.data;
  const setup = setupQuery.data;
  const policies = policyQuery.data;
  const integrations = integrationQuery.data;
  const ssoProviders = ssoQuery.data ?? [];
  const peopleCount = workerCount(workersQuery.data);
  const legalEntityCount = asArray(org?.legalEntities).length;
  const orgUnitCount = asArray(org?.orgUnits).length;
  const managerCount = asArray(org?.managerRelationships).length;
  const departmentCount = setup?.departments?.filter((item) => item.active).length ?? 0;
  const locationCount = setup?.locations?.filter((item) => item.active).length ?? 0;
  const payrollPackCount = setup?.statutoryPayrollPacks?.filter((item) => item.active).length ?? policies?.payrollPacks ?? 0;
  const policyCount = (policies?.leavePolicies ?? 0) + (policies?.payrollPacks ?? 0) + (policies?.earningPolicies ?? 0) + (policies?.deductionPolicies ?? 0);
  const readyIntegrations = integrations?.adapters?.filter((adapter) => adapter.ready).length ?? 0;
  const totalIntegrations = integrations?.adapters?.length ?? 0;
  const readinessScore = readinessQuery.data?.overallScore ?? 0;

  const steps = React.useMemo<StepDefinition[]>(() => {
    const readiness = readinessQuery.data;
    const ssoDomain = domainStatus(readiness, 'Auth');
    return [
      {
        id: 'org',
        title: t('adminGetStarted.steps.org.title'),
        description: t('adminGetStarted.steps.org.description'),
        href: '/admin/organization',
        actionLabel: t('adminGetStarted.steps.org.action'),
        state: stateFromBoolean(legalEntityCount > 0 && orgUnitCount > 0),
        evidence: t('adminGetStarted.steps.org.evidence', { legalEntityCount, orgUnitCount }),
        icon: Building2,
      },
      {
        id: 'employees',
        title: t('adminGetStarted.steps.employees.title'),
        description: t('adminGetStarted.steps.employees.description'),
        href: peopleCount > 0 ? '/admin/employees' : '/admin/employees/new',
        actionLabel: peopleCount > 0 ? t('adminGetStarted.steps.employees.reviewAction') : t('adminGetStarted.steps.employees.action'),
        state: stateFromBoolean(peopleCount > 0),
        evidence: t('adminGetStarted.steps.employees.evidence', { peopleCount, managerCount }),
        icon: UserPlus,
      },
      {
        id: 'setup',
        title: t('adminGetStarted.steps.setup.title'),
        description: t('adminGetStarted.steps.setup.description'),
        href: '/admin/system-console/settings',
        actionLabel: t('adminGetStarted.steps.setup.action'),
        state: stateFromBoolean(departmentCount > 0 && locationCount > 0),
        evidence: t('adminGetStarted.steps.setup.evidence', { departmentCount, locationCount }),
        icon: Settings2,
      },
      {
        id: 'policies',
        title: t('adminGetStarted.steps.policies.title'),
        description: t('adminGetStarted.steps.policies.description'),
        href: '/admin/system-console/policies',
        actionLabel: t('adminGetStarted.steps.policies.action'),
        state: stateFromBoolean(policyCount > 0),
        evidence: t('adminGetStarted.steps.policies.evidence', { policyCount }),
        icon: ShieldCheck,
      },
      {
        id: 'payroll',
        title: t('adminGetStarted.steps.payroll.title'),
        description: t('adminGetStarted.steps.payroll.description'),
        href: '/admin/payroll',
        actionLabel: t('adminGetStarted.steps.payroll.action'),
        state: stateFromBoolean(payrollPackCount > 0),
        evidence: t('adminGetStarted.steps.payroll.evidence', { payrollPackCount }),
        icon: WalletCards,
      },
      {
        id: 'integrations',
        title: t('adminGetStarted.steps.integrations.title'),
        description: t('adminGetStarted.steps.integrations.description'),
        href: '/admin/system-console/integrations',
        actionLabel: t('adminGetStarted.steps.integrations.action'),
        state: totalIntegrations > 0 ? stateFromBoolean(readyIntegrations > 0) : 'info',
        evidence: t('adminGetStarted.steps.integrations.evidence', { readyIntegrations, totalIntegrations }),
        icon: PlugZap,
      },
      {
        id: 'sso',
        title: t('adminGetStarted.steps.sso.title'),
        description: t('adminGetStarted.steps.sso.description'),
        href: '/admin/system-console/sso',
        actionLabel: t('adminGetStarted.steps.sso.action'),
        state: ssoProviders.length > 0 || ssoDomain?.status === 'READY' ? 'complete' : 'info',
        evidence: t('adminGetStarted.steps.sso.evidence', { providerCount: ssoProviders.length }),
        icon: ShieldCheck,
      },
    ];
  }, [
    departmentCount,
    legalEntityCount,
    locationCount,
    managerCount,
    orgUnitCount,
    payrollPackCount,
    peopleCount,
    policyCount,
    readinessQuery.data,
    readyIntegrations,
    ssoProviders.length,
    t,
    totalIntegrations,
  ]);

  const completedCount = steps.filter((step) => step.state === 'complete').length;
  const actionableCount = steps.filter((step) => step.state === 'incomplete').length;
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return <ErrorState title={t('adminGetStarted.errorTitle')} error={error} />;
  }

  if (steps.length === 0) {
    return <EmptyState title={t('adminGetStarted.emptyTitle')} description={t('adminGetStarted.emptyDescription')} />;
  }

  return (
    <div className="space-y-6">
      <BusinessPageHeader
        eyebrow={t('adminGetStarted.eyebrow')}
        title={t('adminGetStarted.title')}
        subtitle={t('adminGetStarted.subtitle')}
        icon={CircleDashed}
      />

      <Card className="border-white/60 bg-white/70">
        <CardContent className="grid gap-6 p-5 lg:grid-cols-[1fr_18rem]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-indigo-50 text-indigo-700">{t('adminGetStarted.progressLabel', { progress })}</Badge>
              <Badge variant="outline" className="rounded-full bg-white">{t('adminGetStarted.readinessScore', { readinessScore })}</Badge>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-sm text-slate-600">{t('adminGetStarted.progressDescription')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BusinessMetric label={t('adminGetStarted.metrics.complete')} value={completedCount} tone="success" />
            <BusinessMetric label={t('adminGetStarted.metrics.pending')} value={actionableCount} tone={actionableCount > 0 ? 'warning' : 'default'} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <Card key={step.id} className="border-white/60 bg-white/75">
            <CardHeader className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50">
                    <StepIcon state={step.state} icon={step.icon} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('adminGetStarted.stepNumber', { number: index + 1 })}</p>
                    <CardTitle className="mt-1 text-lg">{step.title}</CardTitle>
                  </div>
                </div>
                <StepBadge state={step.state} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              <p className="text-sm leading-6 text-slate-600">{step.description}</p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                {step.evidence}
              </div>
              <Button asChild variant={step.state === 'complete' ? 'outline' : 'default'} className="rounded-xl">
                <Link to={step.href}>
                  {step.actionLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
