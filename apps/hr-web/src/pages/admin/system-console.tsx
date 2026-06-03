import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  Building2,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  FileText,
  GitBranch,
  KeyRound,
  Landmark,
  Layers3,
  LifeBuoy,
  LockKeyhole,
  Network,
  PlugZap,
  Radar,
  RefreshCcw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Umbrella,
  Users,
  Workflow,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { commercialModules, moduleOperationsPath, type CommercialModule } from '@/lib/commercial-modules';
import { useApiQuery } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { HcmSetupConfig } from '@/types';

type ConsoleStatus = 'live' | 'partial' | 'backend-required' | 'attention';

interface AdminDashboardData {
  headcount: number;
  turnover: number;
  openPositions: number;
  newHiresThisMonth: number;
  terminationsThisMonth: number;
  recentActivity: Array<{
    id: string;
    description: string;
    timestamp: string;
    type: string;
  }>;
  alerts: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
}

interface PolicyApplicationRun {
  id: string;
  revisionId: string;
  status: string;
  impactedEmployees: number;
  appliedBy: string;
  appliedAt: string;
}

interface PolicySummary {
  totalRevisions: number;
  byStatus: Record<string, number>;
  byArea: Record<string, number>;
  recentRuns: PolicyApplicationRun[];
}

interface PlatformNotification {
  id: string;
  title: string;
  body: string;
  category: string;
  readAt?: string;
  createdAt: string;
}

interface AuditRecord {
  id: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
}

interface HealthStatus {
  status: 'ok' | 'error';
  version: string;
  timestamp: string;
}

interface ReadinessStatus {
  status: 'ready' | 'not_ready';
  checks: Array<{
    name: string;
    status: 'up' | 'down';
    details?: string;
  }>;
  timestamp: string;
}

interface IntegrationStatus {
  adapters?: unknown[] | Record<string, unknown>;
}

interface ServiceUsageSummary {
  generatedAt: string;
  totals: {
    commands: number;
    failedCommands: number;
    events: number;
    pendingOutboxEvents: number;
    notifications: number;
    workflowTransitions: number;
  };
  services: Array<{
    serviceArea: string;
    commands: number;
    failedCommands: number;
    events: number;
    pendingOutboxEvents: number;
    notifications: number;
    workflowTransitions: number;
    lastActivityAt?: string;
  }>;
}

interface ConsoleControl {
  title: string;
  description: string;
  status: ConsoleStatus;
  statusLabel: string;
  icon: React.ElementType;
  link?: string;
  linkLabel?: string;
  evidence: string[];
}

function unwrapApiData<T>(payload: unknown): T {
  const maybeResponse = payload as { data?: unknown };
  const body = maybeResponse && typeof maybeResponse === 'object' && 'data' in maybeResponse
    ? maybeResponse.data
    : payload;
  const envelope = body as { data?: T; success?: boolean };
  if (envelope && typeof envelope === 'object' && envelope.success === true && 'data' in envelope) {
    return envelope.data as T;
  }
  return body as T;
}

function formatNumber(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusClasses(status: ConsoleStatus) {
  if (status === 'live') return 'border-[#10b981]/30 bg-[#10b981]/10 text-[#006c49]';
  if (status === 'partial') return 'border-[#4648d4]/30 bg-[#4648d4]/10 text-[#4648d4]';
  if (status === 'attention') return 'border-[#e29100]/30 bg-[#ffddb8]/60 text-[#523200]';
  return 'border-[#ba1a1a]/30 bg-[#ba1a1a]/10 text-[#ba1a1a]';
}

function StatusBadge({ status, label }: { status: ConsoleStatus; label: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(status)}`}>
      {label}
    </span>
  );
}

function moduleMaturityLabel(module: CommercialModule) {
  if (module.maturity === 'native-ui') return 'Native admin';
  if (module.maturity === 'workbench') return 'Operations workspace';
  return 'API-ready';
}

function moduleStatus(module: CommercialModule): ConsoleStatus {
  if (module.maturity === 'native-ui') return 'live';
  if (module.maturity === 'workbench') return 'partial';
  return 'backend-required';
}

function ControlCard({ control }: { control: ConsoleControl }) {
  const Icon = control.icon;
  return (
    <Card className="relative h-full overflow-hidden">
      <div className="absolute left-0 top-0 h-1 w-full bg-[#006c49]" />
      <CardHeader className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eff4ff] text-[#006c49]">
            <Icon className="h-5 w-5" />
          </div>
          <StatusBadge status={control.status} label={control.statusLabel} />
        </div>
        <div>
          <CardTitle className="text-lg">{control.title}</CardTitle>
          <CardDescription className="mt-2 leading-6">{control.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-9rem)] flex-col gap-4 p-5 pt-0">
        <div className="space-y-2">
          {control.evidence.map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm leading-6 text-[#3c4a42]">
              {control.status === 'backend-required' ? (
                <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-[#ba1a1a]" />
              ) : (
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#006c49]" />
              )}
              <span>{item}</span>
            </div>
          ))}
        </div>
        {control.link ? (
          <Button asChild className="mt-auto w-full" variant={control.status === 'backend-required' ? 'outline' : 'default'}>
            <Link to={control.link}>
              {control.linkLabel ?? 'Open'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <div className="mt-auto rounded-lg border border-[#bbcabf] bg-[#f8f9ff] p-3 text-sm font-semibold text-[#3c4a42]">
            Backend endpoint required before this can be safely operated.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminSystemConsole() {
  const mapsConfigured = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
  const authBypassEnabled = import.meta.env.VITE_AUTH_BYPASS === 'true';

  const dashboardQuery = useApiQuery<AdminDashboardData>(['admin-dashboard', 'system-console'], '/admin/dashboard', {
    retry: false,
  });
  const setupQuery = useApiQuery<HcmSetupConfig>(['hcm-setup', 'system-console'], '/admin/hcm-setup', {
    retry: false,
  });
  const policyQuery = useApiQuery<PolicySummary>(['admin-policy-summary', 'system-console'], '/admin/policies/summary', {
    retry: false,
  });
  const notificationsQuery = useApiQuery<PlatformNotification[]>(
    ['platform-notifications', 'system-console'],
    '/notifications/hr-operations',
    { retry: false },
  );
  const healthQuery = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => unwrapApiData<HealthStatus>(await apiClient.get('/health')),
    retry: false,
  });
  const readinessQuery = useQuery({
    queryKey: ['system-readiness'],
    queryFn: async () => unwrapApiData<ReadinessStatus>(await apiClient.get('/health/ready')),
    retry: false,
  });
  const integrationQuery = useQuery({
    queryKey: ['integration-status', 'system-console'],
    queryFn: async () => unwrapApiData<IntegrationStatus>(await apiClient.get('/hr/integrations/status')),
    retry: false,
  });
  const serviceUsageQuery = useQuery({
    queryKey: ['service-usage-summary', 'system-console'],
    queryFn: async () => unwrapApiData<ServiceUsageSummary>(await apiClient.get('/reporting/service-usage/summary')),
    retry: false,
  });
  const auditQuery = useQuery({
    queryKey: ['audit-trail', 'system-console'],
    queryFn: async () => unwrapApiData<AuditRecord[]>(await apiClient.get('/audit')),
    retry: false,
  });

  const nativeModules = commercialModules.filter((module) => module.maturity === 'native-ui').length;
  const workbenchModules = commercialModules.filter((module) => module.maturity === 'workbench').length;
  const apiReadyModules = commercialModules.filter((module) => module.maturity === 'api-ready').length;
  const unreadNotifications = (notificationsQuery.data ?? []).filter((notification) => !notification.readAt).length;
  const activeSetupCounts = {
    departments: setupQuery.data?.departments?.filter((item) => item.active).length ?? 0,
    locations: setupQuery.data?.locations?.filter((item) => item.active).length ?? 0,
    leavePolicies: setupQuery.data?.leavePolicies?.filter((item) => item.active).length ?? 0,
    documents: setupQuery.data?.documentRequirements?.filter((item) => item.active).length ?? 0,
  };
  const readinessDown = readinessQuery.data?.checks.filter((check) => check.status === 'down').length ?? 0;
  const integrationAdapterCount = Array.isArray(integrationQuery.data?.adapters)
    ? integrationQuery.data.adapters.length
    : integrationQuery.data?.adapters && typeof integrationQuery.data.adapters === 'object'
      ? Object.keys(integrationQuery.data.adapters).length
      : 0;
  const usageTotals = serviceUsageQuery.data?.totals;

  const controls = React.useMemo<ConsoleControl[]>(() => [
    {
      title: 'Health And Readiness',
      description: 'Platform liveness/readiness checks for API, database, Redis, and Kafka when configured.',
      status: readinessQuery.data?.status === 'ready' ? 'live' : readinessQuery.isSuccess ? 'attention' : 'partial',
      statusLabel: readinessQuery.data?.status === 'ready' ? 'Ready' : readinessQuery.isSuccess ? 'Not ready' : 'Endpoint check',
      icon: Activity,
      link: '/admin/modules/reporting/operations',
      linkLabel: 'Open Reporting Ops',
      evidence: [
        `API health: ${healthQuery.data?.status ?? 'not loaded'}${healthQuery.data?.version ? ` / v${healthQuery.data.version}` : ''}`,
        `${readinessQuery.data?.checks.length ?? 0} readiness checks, ${readinessDown} down`,
        'Uses /health, /health/ready, and /health/live backend endpoints',
      ],
    },
    {
      title: 'Tenant, Company, And Setup',
      description: 'Low-code setup for departments, locations, IDs, field rules, leave policy defaults, and documents.',
      status: setupQuery.isSuccess ? 'live' : 'attention',
      statusLabel: setupQuery.isSuccess ? 'Live API' : 'Needs attention',
      icon: Settings,
      link: '/admin/settings',
      linkLabel: 'Open Setup',
      evidence: [
        'Uses GET/PATCH /admin/hcm-setup',
        `${activeSetupCounts.departments} active departments and ${activeSetupCounts.locations} active locations loaded`,
        'Generated runtime setup is consumed by employee, leave, attendance, and payroll screens',
      ],
    },
    {
      title: 'Policy Center',
      description: 'Scoped policy revisions, validation, simulation, lifecycle approval, publish, apply, and decision evidence.',
      status: policyQuery.isSuccess ? 'live' : 'attention',
      statusLabel: policyQuery.isSuccess ? 'Live API' : 'Needs attention',
      icon: ShieldCheck,
      link: '/admin/policies',
      linkLabel: 'Manage Policies',
      evidence: [
        'Uses /admin/policies summary, revisions, validate, simulate, and lifecycle commands',
        `${policyQuery.data?.totalRevisions ?? 0} revisions, ${policyQuery.data?.byStatus?.APPLIED ?? 0} applied`,
        'APPLIED revisions are the only state that changes live service behavior',
      ],
    },
    {
      title: 'Identity, Roles, And Access',
      description: 'Authentication and RBAC exist, but a real user/role administration console is still a missing admin surface.',
      status: 'backend-required',
      statusLabel: 'Backend/UI gap',
      icon: KeyRound,
      evidence: [
        'Auth guard and admin role gates protect admin routes',
        'Permission catalog exists in access-control packages',
        'Missing: native user, role, permission assignment, and service-account admin APIs',
      ],
    },
    {
      title: 'Workflow And Trigger Control',
      description: 'Domain commands and workflows exist, while a cross-module workflow designer/control plane is not yet exposed.',
      status: 'partial',
      statusLabel: 'Domain-backed',
      icon: Workflow,
      link: '/admin/modules/service-delivery/operations',
      linkLabel: 'Open Operations',
      evidence: [
        'Module operations API supports records and workflows per commercial module',
        'Domain command handlers emit audit and workflow states',
        'Missing: central workflow editor, trigger enable/disable, and retry controls',
      ],
    },
    {
      title: 'Notifications And Outbox',
      description: 'HR operations notifications and service-usage totals are live; outbox retry/dead-letter control still needs an admin endpoint.',
      status: notificationsQuery.isSuccess ? 'partial' : 'attention',
      statusLabel: notificationsQuery.isSuccess ? 'Partial live' : 'Needs attention',
      icon: BellRing,
      link: '/admin/modules/service-delivery/operations',
      linkLabel: 'Open Service Delivery',
      evidence: [
        'Uses /notifications/hr-operations for admin notification visibility',
        `${unreadNotifications} unread HR operations notifications in the current inbox`,
        `${usageTotals?.pendingOutboxEvents ?? 0} pending outbox events reported by service usage summary`,
      ],
    },
    {
      title: 'Integrations',
      description: 'Adapter status and manual triggers exist; runtime secret/config management still needs a governed admin API.',
      status: integrationQuery.isSuccess ? 'partial' : 'attention',
      statusLabel: integrationQuery.isSuccess ? 'Status API' : 'Needs attention',
      icon: PlugZap,
      link: '/admin/settings',
      linkLabel: 'Open Settings',
      evidence: [
        `API base URL: ${apiBaseUrl}`,
        `${integrationAdapterCount} integration adapters reported by /hr/integrations/status`,
        `Google Maps browser key: ${mapsConfigured ? 'configured' : 'not configured'}`,
      ],
    },
    {
      title: 'Service Usage Reporting',
      description: 'Cross-module usage is fed by commands, events, notifications, and workflow transitions.',
      status: serviceUsageQuery.isSuccess ? 'live' : 'attention',
      statusLabel: serviceUsageQuery.isSuccess ? 'Live API' : 'Needs attention',
      icon: FileText,
      link: '/admin/modules/reporting/operations',
      linkLabel: 'Open Reporting',
      evidence: [
        `${usageTotals?.commands ?? 0} commands and ${usageTotals?.failedCommands ?? 0} failed commands in summary`,
        `${usageTotals?.events ?? 0} events, ${usageTotals?.notifications ?? 0} notifications, ${usageTotals?.workflowTransitions ?? 0} workflow transitions`,
        'Uses GET /reporting/service-usage/summary',
      ],
    },
    {
      title: 'Audit And Evidence',
      description: 'Immutable audit trail is queryable by admins and auditors; this console surfaces recent events.',
      status: auditQuery.isSuccess ? 'partial' : 'attention',
      statusLabel: auditQuery.isSuccess ? 'Audit API' : 'Needs attention',
      icon: Radar,
      link: '/admin/compliance',
      linkLabel: 'Open Compliance',
      evidence: [
        'Uses GET /audit for recent tenant audit entries',
        `${auditQuery.data?.length ?? 0} recent audit records available to this actor`,
        'Missing: dedicated audit search/export page with saved filters',
      ],
    },
    {
      title: 'System Reset And Data Operations',
      description: 'Dangerous data operations need explicit backend workflows, confirmation, audit, backup, and environment restrictions.',
      status: 'backend-required',
      statusLabel: 'Not exposed',
      icon: DatabaseZap,
      evidence: [
        'Seed script exists for initial data, but no safe admin reset API is exposed',
        'A real reset must create backup, audit, approval, and environment guardrails',
        'Until that exists, this console deliberately does not render a reset button',
      ],
    },
  ], [
    activeSetupCounts.departments,
    activeSetupCounts.locations,
    apiBaseUrl,
    auditQuery.data?.length,
    auditQuery.isSuccess,
    healthQuery.data?.status,
    healthQuery.data?.version,
    integrationAdapterCount,
    integrationQuery.isSuccess,
    mapsConfigured,
    notificationsQuery.isSuccess,
    policyQuery.data?.byStatus?.APPLIED,
    policyQuery.data?.totalRevisions,
    policyQuery.isSuccess,
    setupQuery.isSuccess,
    readinessDown,
    readinessQuery.data?.checks.length,
    readinessQuery.data?.status,
    readinessQuery.isSuccess,
    serviceUsageQuery.isSuccess,
    unreadNotifications,
    usageTotals?.commands,
    usageTotals?.events,
    usageTotals?.failedCommands,
    usageTotals?.notifications,
    usageTotals?.pendingOutboxEvents,
    usageTotals?.workflowTransitions,
  ]);

  const topMetrics: Array<{
    label: string;
    value: string;
    helper: string;
    icon: React.ElementType;
    status: ConsoleStatus;
  }> = [
    {
      label: 'Readiness',
      value: readinessQuery.data?.status === 'ready' ? 'Ready' : readinessQuery.isSuccess ? 'Check' : '-',
      helper: readinessQuery.isSuccess ? `${readinessDown} readiness checks down` : 'API health not loaded',
      icon: Network,
      status: readinessQuery.data?.status === 'ready' ? 'live' as ConsoleStatus : 'attention' as ConsoleStatus,
    },
    {
      label: 'Headcount',
      value: formatNumber(dashboardQuery.data?.headcount),
      helper: 'From admin dashboard API',
      icon: Users,
      status: dashboardQuery.isSuccess ? 'live' : 'attention',
    },
    {
      label: 'Commercial Modules',
      value: commercialModules.length.toString(),
      helper: `${nativeModules} native, ${workbenchModules} workbench, ${apiReadyModules} API-ready`,
      icon: Layers3,
      status: 'live' as ConsoleStatus,
    },
    {
      label: 'Policy Revisions',
      value: formatNumber(policyQuery.data?.totalRevisions),
      helper: `${policyQuery.data?.byStatus?.APPLIED ?? 0} applied to runtime`,
      icon: ShieldCheck,
      status: policyQuery.isSuccess ? 'live' : 'attention',
    },
    {
      label: 'Usage Signals',
      value: formatNumber((usageTotals?.commands ?? 0) + (usageTotals?.events ?? 0) + (usageTotals?.notifications ?? 0) + (usageTotals?.workflowTransitions ?? 0)),
      helper: 'Commands, events, notifications, and workflows',
      icon: BellRing,
      status: serviceUsageQuery.isSuccess ? 'live' : 'attention',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#bbcabf] bg-white px-3 py-1 font-mono text-xs uppercase tracking-wider text-[#3c4a42]">
              <Network className="h-3.5 w-3.5 text-[#006c49]" />
              Platform Administration
            </div>
            <h2 className="mt-3 font-headline text-4xl font-bold text-[#0b1c30]">System Admin Console</h2>
            <p className="mt-2 max-w-3xl text-lg leading-8 text-[#3c4a42]">
              Central control for the HCM platform: setup, policies, modules, identity, workflows, notifications,
              integrations, audit, and controlled data operations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/admin">
                <Activity className="mr-2 h-4 w-4" />
                HR Overview
              </Link>
            </Button>
            <Button asChild>
              <Link to="/admin/policies">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Policy Center
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {topMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.label} className="relative overflow-hidden">
                <div className="absolute left-0 top-0 h-1 w-full bg-[#10b981]" />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wider text-[#3c4a42]">{metric.label}</p>
                      <p className="mt-2 font-headline text-4xl font-bold text-[#0b1c30]">
                        {dashboardQuery.isLoading && metric.label === 'Headcount' ? '-' : metric.value}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#3c4a42]">{metric.helper}</p>
                    </div>
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eff4ff] text-[#006c49]">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <StatusBadge status={metric.status} label={metric.status === 'live' ? 'Live' : 'Watch'} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
          <Card className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#006c49]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <SlidersHorizontal className="h-5 w-5 text-[#006c49]" />
                Control Surface
              </CardTitle>
              <CardDescription>
                Every tile is either wired to a real admin/API surface or marked as a backend gap that must be built before use.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0 md:grid-cols-2">
              {controls.map((control) => (
                <ControlCard key={control.title} control={control} />
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LockKeyhole className="h-5 w-5 text-[#006c49]" />
                  Runtime Guardrails
                </CardTitle>
                <CardDescription>Controls that affect platform behavior.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-[#3c4a42]">
                <div className="rounded-lg border border-[#bbcabf] bg-[#f8f9ff] p-3">
                  <p className="font-semibold text-[#0b1c30]">Auth mode</p>
                  <p>{authBypassEnabled ? 'Local auth bypass is enabled for this build.' : 'Token auth is enforced for this build.'}</p>
                </div>
                <div className="rounded-lg border border-[#bbcabf] bg-[#f8f9ff] p-3">
                  <p className="font-semibold text-[#0b1c30]">Policy application</p>
                  <p>Only APPLIED policy revisions update live runtime behavior.</p>
                </div>
                <div className="rounded-lg border border-[#bbcabf] bg-[#f8f9ff] p-3">
                  <p className="font-semibold text-[#0b1c30]">Historical data</p>
                  <p>Locked historical records are not silently rewritten by policy changes.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <RefreshCcw className="h-5 w-5 text-[#e29100]" />
                  Data Operations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-[#3c4a42]">
                <p className="rounded-lg border border-[#e29100]/30 bg-[#ffddb8]/40 p-3 text-[#523200]">
                  System reset is intentionally not clickable until a real reset workflow exists with backup, approval,
                  audit evidence, and environment restrictions.
                </p>
                <Button asChild className="w-full" variant="outline">
                  <Link to="/admin/settings">Manage Setup Data</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#4648d4]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <BellRing className="h-5 w-5 text-[#4648d4]" />
                Recent Notifications
              </CardTitle>
              <CardDescription>HR operations inbox from the platform notification center.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {notificationsQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (notificationsQuery.data ?? []).length > 0 ? (
                (notificationsQuery.data ?? []).slice(0, 5).map((notification) => (
                  <div key={notification.id} className="rounded-lg border border-[#bbcabf] bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[#0b1c30]">{notification.title}</p>
                      {!notification.readAt ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#006c49]" /> : null}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[#3c4a42]">{notification.body}</p>
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-[#6c7a71]">
                      {notification.category} / {formatDate(notification.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-[#bbcabf] bg-white p-4 text-sm text-[#3c4a42]">
                  No HR operations notifications are available for this actor.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#e29100]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <GitBranch className="h-5 w-5 text-[#e29100]" />
                Recent Audit Evidence
              </CardTitle>
              <CardDescription>Recent tenant audit trail if the current role has audit scope.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {auditQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (auditQuery.data ?? []).length > 0 ? (
                (auditQuery.data ?? []).slice(0, 5).map((record) => (
                  <div key={record.id} className="rounded-lg border border-[#bbcabf] bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[#0b1c30]">{record.action}</p>
                      <p className="text-xs text-[#6c7a71]">{formatDate(record.timestamp)}</p>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[#3c4a42]">
                      {record.resourceType} {record.resourceId ? `/${record.resourceId}` : ''}
                    </p>
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-[#6c7a71]">
                      {record.actorName || 'system'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-[#bbcabf] bg-white p-4 text-sm text-[#3c4a42]">
                  No audit records are available, or this role cannot access audit history.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <Card className="relative overflow-hidden">
          <div className="absolute left-0 top-0 h-1 w-full bg-[#10b981]" />
          <CardHeader className="p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Layers3 className="h-5 w-5 text-[#006c49]" />
                  Module Control Matrix
                </CardTitle>
                <CardDescription>
                  Native admin pages and operations workspaces reachable from one control map.
                </CardDescription>
              </div>
              <Button asChild variant="outline">
                <Link to="/admin/modules">Open Module Catalog</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 pt-0 md:grid-cols-2 xl:grid-cols-3">
            {commercialModules.map((module) => {
              const status = moduleStatus(module);
              const target = module.nativePath ?? moduleOperationsPath(module.id);
              return (
                <Link key={module.id} to={target} className="group">
                  <div className="flex h-full min-h-[150px] flex-col rounded-lg border border-[#bbcabf] bg-white p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-[#10b981]/70 group-hover:bg-[#f8fbff]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0b1c30]">{module.label}</p>
                        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-[#6c7a71]">
                          {module.category} / {module.backendRoot}
                        </p>
                      </div>
                      <StatusBadge status={status} label={moduleMaturityLabel(module)} />
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#3c4a42]">{module.summary}</p>
                    <div className="mt-auto flex items-center justify-between pt-3 text-sm font-semibold text-[#006c49]">
                      <span>{module.maturity === 'native-ui' ? 'Open native admin' : 'Open operations workspace'}</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Organization Master Data',
              value: `${activeSetupCounts.departments} departments`,
              helper: 'Departments, locations, cities, IDs',
              icon: Building2,
              path: '/admin/organization',
            },
            {
              label: 'Leave Policies',
              value: `${activeSetupCounts.leavePolicies} active`,
              helper: 'Employee-facing leave service policies',
              icon: Umbrella,
              path: '/admin/policies',
            },
            {
              label: 'Attendance Evidence',
              value: mapsConfigured ? 'Maps ready' : 'Maps missing',
              helper: 'Geolocation evidence and workplace policy',
              icon: Clock3,
              path: '/admin/attendance',
            },
            {
              label: 'Compliance Documents',
              value: `${activeSetupCounts.documents} configured`,
              helper: 'Policy acknowledgements and required documents',
              icon: FileText,
              path: '/admin/compliance',
            },
            {
              label: 'Country Policy',
              value: 'Versioned',
              helper: 'Validate, simulate, approve, publish',
              icon: Landmark,
              path: '/admin/country-policy',
            },
            {
              label: 'Service Delivery',
              value: 'Operations',
              helper: 'Cases, tasks, catalog, SLA workspace',
              icon: LifeBuoy,
              path: '/admin/modules/service-delivery/operations',
            },
            {
              label: 'Payroll Control',
              value: 'Policy linked',
              helper: 'Payroll cycles, blockers, payslip flow',
              icon: FileText,
              path: '/admin/payroll',
            },
            {
              label: 'Module Catalog',
              value: `${commercialModules.length} modules`,
              helper: 'Commercial depth and backend readiness',
              icon: Layers3,
              path: '/admin/modules',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} to={item.path}>
                <Card className="relative h-full overflow-hidden transition-all hover:-translate-y-1 hover:border-[#10b981]/60 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                  <div className="absolute left-0 top-0 h-1 w-full bg-[#10b981]" />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#10b981]/10 text-[#006c49]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#0b1c30]">{item.label}</p>
                        <p className="mt-1 text-lg font-bold text-[#0b1c30]">{item.value}</p>
                        <p className="mt-1 text-xs leading-5 text-[#3c4a42]">{item.helper}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}
