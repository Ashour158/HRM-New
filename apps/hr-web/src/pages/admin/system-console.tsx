import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BellRing,
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  DatabaseZap,
  FileText,
  FolderOpen,
  GitBranch,
  KeyRound,
  Landmark,
  Layers3,
  LifeBuoy,
  LockKeyhole,
  Network,
  Plane,
  PlugZap,
  Radar,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Timer,
  Trophy,
  Umbrella,
  UserCog,
  UserRoundPlus,
  Users,
  Wrench,
  Workflow,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { commercialModules, moduleOperationsPath, type CommercialModule } from '@/lib/commercial-modules';
import { useAuth } from '@/hooks/use-auth';
import { useApiQuery } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { BusinessPageHeader } from '@/components/common/business-page';
import type { HcmSetupConfig } from '@/types';

type ConsoleStatus = 'live' | 'partial' | 'not-configured' | 'attention';

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

interface LivenessStatus {
  status: 'alive';
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
    exhaustedOutboxEvents: number;
    inboxInProgressEvents: number;
    inboxFailedRetryableEvents: number;
    inboxFailedNonRetryableEvents: number;
    inboxSkippedEvents: number;
    oldestQueueBacklogAt?: string;
    notifications: number;
    workflowTransitions: number;
  };
  queueHealth?: {
    outbox: {
      pendingEvents: number;
      exhaustedEvents: number;
      oldestBacklogAt?: string;
    };
    inbox: {
      inProgressEvents: number;
      failedRetryableEvents: number;
      failedNonRetryableEvents: number;
      skippedEvents: number;
      oldestBacklogAt?: string;
    };
  };
  services: Array<{
    serviceArea: string;
    commands: number;
    failedCommands: number;
    events: number;
    pendingOutboxEvents: number;
    exhaustedOutboxEvents: number;
    inboxInProgressEvents: number;
    inboxFailedRetryableEvents: number;
    inboxFailedNonRetryableEvents: number;
    inboxSkippedEvents: number;
    oldestQueueBacklogAt?: string;
    notifications: number;
    workflowTransitions: number;
    lastActivityAt?: string;
  }>;
}

interface DeadLetterSummary {
  generatedAt: string;
  inbox: {
    failedRetryable: number;
    failedNonRetryable: number;
    inProgress: number;
    skipped: number;
    success: number;
    totalNonSuccess: number;
  };
  outbox: {
    pending: number;
    exhausted: number;
    operatorSkipped: number;
    published: number;
    totalUnresolved: number;
  };
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

interface AdminPanelTool {
  label: string;
  description: string;
  group: 'Foundation' | 'Workforce Operations' | 'Reward And Talent' | 'Governance And Insights' | 'Custom Services';
  path?: string;
  icon: React.ElementType;
  tone: string;
  status?: 'live' | 'not-configured';
}

interface GuidedAdminJourney {
  title: string;
  description: string;
  path: string;
  actionLabel: string;
  status: ConsoleStatus;
  statusLabel: string;
  icon: React.ElementType;
  signals: string[];
}

type PendingAdminWorkGroup = 'Setup And People' | 'Policy And Payroll' | 'Operational Health';

interface PendingAdminWorkItem {
  title: string;
  helper: string;
  count: number;
  status: ConsoleStatus;
  statusLabel: string;
  path: string;
  actionLabel: string;
  icon: React.ElementType;
  group: PendingAdminWorkGroup;
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
  if (status === 'live') return 'border-[#8b5cf6]/30 bg-[#8b5cf6]/10 text-[#4f46e5]';
  if (status === 'partial') return 'border-[#6366f1]/30 bg-[#6366f1]/10 text-[#6366f1]';
  if (status === 'attention') return 'border-[#f59e0b]/30 bg-[#fde68a]/60 text-[#78350f]';
  return 'border-[#e11d48]/30 bg-[#e11d48]/10 text-[#e11d48]';
}

function groupStatus(items: PendingAdminWorkItem[]): ConsoleStatus {
  if (items.some((item) => item.status === 'attention')) return 'attention';
  if (items.some((item) => item.status === 'partial')) return 'partial';
  if (items.some((item) => item.status === 'not-configured')) return 'not-configured';
  return 'live';
}

function StatusBadge({ status, label }: { status: ConsoleStatus; label: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(status)}`}>
      {label}
    </span>
  );
}

function moduleMaturityLabel(module: CommercialModule) {
  if (module.maturity === 'native-ui') return 'Admin workspace';
  if (module.maturity === 'workbench') return 'Operations';
  return 'Setup needed';
}

function moduleStatus(module: CommercialModule): ConsoleStatus {
  if (module.maturity === 'native-ui') return 'live';
  if (module.maturity === 'workbench') return 'partial';
  return 'not-configured';
}

function ControlCard({ control }: { control: ConsoleControl }) {
  const Icon = control.icon;
  return (
    <Card className="relative h-full overflow-hidden">
      <div className="absolute left-0 top-0 h-1 w-full bg-[#4f46e5]" />
      <CardHeader className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eef2ff] text-[#4f46e5]">
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
            <div key={item} className="flex items-start gap-2 text-sm leading-6 text-[#475569]">
              {control.status === 'not-configured' ? (
                <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-[#e11d48]" />
              ) : (
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#4f46e5]" />
              )}
              <span>{item}</span>
            </div>
          ))}
        </div>
        {control.link ? (
          <Button asChild className="mt-auto w-full" variant={control.status === 'not-configured' ? 'outline' : 'default'}>
            <Link to={control.link}>
              {control.linkLabel ?? 'Open'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : control.status !== 'not-configured' ? (
          <div className="mt-auto rounded-lg border border-[#e2e8f0] bg-[#f6f7fb] p-3 text-sm font-semibold text-[#475569]">
            Available in this console.
          </div>
        ) : (
          <div className="mt-auto rounded-lg border border-[#e2e8f0] bg-[#f6f7fb] p-3 text-sm font-semibold text-[#475569]">
            Configure this service before operating it.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminPanelTile({ tool }: { tool: AdminPanelTool }) {
  const Icon = tool.icon;
  const content = (
    <div className="group relative flex h-full min-h-[132px] flex-col fusion-glass rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:border-[#8b5cf6]/60 hover:shadow-[0_10px_24px_rgba(31,49,86,0.08)]">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eef2ff]">
          <Icon className={`h-5 w-5 ${tool.tone}`} strokeWidth={1.9} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold leading-5 text-[#0f172a]">{tool.label}</p>
          <p className="mt-1 text-sm leading-5 text-[#475569]">{tool.description}</p>
        </div>
        {tool.status === 'not-configured' ? (
          <span className="absolute right-3 top-3 rounded-full border border-[#f59e0b]/40 bg-[#fde68a] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#78350f]">
            Setup
          </span>
        ) : null}
      </div>
      <div className="mt-auto flex items-center justify-between pt-4 text-xs font-semibold uppercase tracking-wide text-[#4f46e5]">
        <span>{tool.path ? 'Open area' : 'Not configured'}</span>
        {tool.path ? <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /> : null}
      </div>
    </div>
  );

  if (!tool.path) {
    return (
      <div aria-label={`${tool.label} is not configured`} className="cursor-not-allowed opacity-80" title="Not configured">
        {content}
      </div>
    );
  }

  return (
    <Link to={tool.path} className="focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30">
      {content}
    </Link>
  );
}

function GuidedJourneyCard({ journey }: { journey: GuidedAdminJourney }) {
  const Icon = journey.icon;

  return (
    <Link to={journey.path} className="group focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30">
      <div className="flex h-full min-h-[240px] flex-col fusion-glass rounded-2xl p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-[#8b5cf6]/60 group-hover:shadow-[0_10px_24px_rgba(31,49,86,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eef2ff] text-[#4f46e5]">
            <Icon className="h-5 w-5" />
          </div>
          <StatusBadge status={journey.status} label={journey.statusLabel} />
        </div>
        <h4 className="mt-4 font-semibold text-[#0f172a]">{journey.title}</h4>
        <p className="mt-2 text-sm leading-5 text-[#475569]">{journey.description}</p>
        <div className="mt-4 flex-1 space-y-2">
          {journey.signals.map((signal) => (
            <div key={signal} className="flex items-start gap-2 text-xs leading-5 text-[#475569]">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4f46e5]" />
              <span>{signal}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[#e2e8f0] pt-3 text-xs font-semibold uppercase tracking-wide text-[#4f46e5]">
          <span>{journey.actionLabel}</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

export function AdminSystemConsole() {
  const { user } = useAuth();
  const [adminToolQuery, setAdminToolQuery] = React.useState('');
  const mapsConfigured = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
  const authBypassEnabled = import.meta.env.DEV && import.meta.env.VITE_AUTH_BYPASS === 'true';

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
    ['platform-notifications', 'admin'],
    '/notifications/hr-operations',
    { retry: false },
  );
  const healthQuery = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => unwrapApiData<HealthStatus>(await apiClient.get('/health')),
    retry: false,
  });
  const livenessQuery = useQuery({
    queryKey: ['system-liveness'],
    queryFn: async () => unwrapApiData<LivenessStatus>(await apiClient.get('/health/live')),
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
  const deadLetterQuery = useQuery({
    queryKey: ['dead-letter-summary', 'system-console'],
    queryFn: async () => unwrapApiData<DeadLetterSummary>(await apiClient.get('/admin/dead-letter/summary')),
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
  };
  const activeJobTitles = setupQuery.data?.jobTitles?.filter((item) => item.active).length ?? 0;
  const activeDocumentRequirements = setupQuery.data?.documentRequirements?.filter((item) => item.active).length ?? 0;
  const activeRequiredFieldRules = setupQuery.data?.fieldRules?.filter((item) => item.active && item.required).length ?? 0;
  const activeLeavePolicies = setupQuery.data?.leavePolicies?.filter((item) => item.active).length ?? 0;
  const requestableLeavePolicies = setupQuery.data?.leavePolicies?.filter((item) => item.active && item.requestableByEmployee).length ?? 0;
  const holidayCalendarCount = setupQuery.data?.attendancePolicy?.holidayCalendars?.length
    ?? setupQuery.data?.attendancePolicy?.holidays?.length
    ?? 0;
  const statutoryPayrollPackCount = setupQuery.data?.statutoryPayrollPacks?.filter((item) => item.active).length ?? 0;
  const payrollBlockingRuleCount = setupQuery.data?.payrollBlockingRules?.filter((item) => item.active && item.blocking).length ?? 0;
  const payrollPolicy = setupQuery.data?.payrollCalculationPolicy;
  const payrollRatesConfigured = typeof payrollPolicy?.taxRatePercent === 'number'
    && typeof payrollPolicy?.employeeInsuranceRatePercent === 'number';
  const attendancePolicyReady = setupQuery.isSuccess
    && Boolean(setupQuery.data?.attendancePolicy)
    && activeLeavePolicies > 0;
  const employeeAssignmentReady = setupQuery.isSuccess
    && activeSetupCounts.departments > 0
    && activeSetupCounts.locations > 0
    && activeRequiredFieldRules > 0;
  const payrollSetupReady = setupQuery.isSuccess
    && payrollRatesConfigured
    && statutoryPayrollPackCount > 0;
  const readinessDown = readinessQuery.data?.checks?.filter((check) => check.status === 'down').length ?? 0;
  const integrationAdapterNames = Array.isArray(integrationQuery.data?.adapters)
    ? integrationQuery.data.adapters
      .map((adapter) => typeof adapter === 'object' && adapter !== null && 'adapterName' in adapter
        ? String((adapter as { adapterName?: unknown }).adapterName ?? '')
        : String(adapter ?? ''))
      .filter(Boolean)
    : integrationQuery.data?.adapters && typeof integrationQuery.data.adapters === 'object'
      ? Object.keys(integrationQuery.data.adapters)
      : [];
  const integrationAdapterCount = Array.isArray(integrationQuery.data?.adapters)
    ? integrationQuery.data.adapters.length
    : integrationQuery.data?.adapters && typeof integrationQuery.data.adapters === 'object'
      ? Object.keys(integrationQuery.data.adapters).length
      : 0;
  const mailAdapterConfigured = integrationAdapterNames.some((name) => /mail|email|smtp|notification/i.test(name));
  const setupGapLabels = [
    setupQuery.isSuccess && activeSetupCounts.departments === 0 ? 'no active departments' : null,
    setupQuery.isSuccess && activeSetupCounts.locations === 0 ? 'no active locations' : null,
    setupQuery.isSuccess && activeRequiredFieldRules === 0 ? 'no required employee fields' : null,
    setupQuery.isError ? 'setup unavailable' : null,
  ].filter(Boolean) as string[];
  const integrationGapLabels = [
    integrationQuery.isError ? 'connection status unavailable' : null,
    integrationQuery.isSuccess && integrationAdapterCount === 0 ? 'no connections registered' : null,
    integrationQuery.isSuccess && !mailAdapterConfigured ? 'email delivery connection missing' : null,
    mapsConfigured ? null : 'attendance map key missing',
  ].filter(Boolean) as string[];
  const usageTotals = serviceUsageQuery.data?.totals;
  const usageQueueHealth = serviceUsageQuery.data?.queueHealth;
  const pendingPolicyActions = ['IN_REVIEW', 'REVIEWED', 'APPROVED', 'PUBLISHED'].reduce(
    (total, status) => total + (policyQuery.data?.byStatus?.[status] ?? 0),
    0,
  );
  const unappliedPolicyRevisions = Math.max(
    (policyQuery.data?.totalRevisions ?? 0) - (policyQuery.data?.byStatus?.APPLIED ?? 0),
    0,
  );
  const unresolvedDeadLetters = (deadLetterQuery.data?.inbox?.failedNonRetryable ?? 0)
    + (deadLetterQuery.data?.outbox?.exhausted ?? 0);
  const queueBacklog = (usageQueueHealth?.outbox.pendingEvents ?? usageTotals?.pendingOutboxEvents ?? 0)
    + (usageQueueHealth?.inbox.failedRetryableEvents ?? usageTotals?.inboxFailedRetryableEvents ?? 0)
    + (usageQueueHealth?.inbox.inProgressEvents ?? usageTotals?.inboxInProgressEvents ?? 0);
  const adminDisplayName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || 'System Administrator';
  const primaryRole = user?.roles?.[0]?.name?.replace(/_/g, ' ') ?? 'Administrator';
  const adminPanelTools: AdminPanelTool[] = [
    { label: 'Access Governance', description: 'Users, roles, service accounts, access reviews, sensitive-field access, and duty conflicts.', group: 'Foundation', path: '/admin/system-console/access-governance', icon: UserCog, tone: 'text-[#f59e0b]' },
    { label: 'Single Sign-On', description: 'Tenant OIDC and SAML identity providers, JIT provisioning, role mapping, and encrypted secrets.', group: 'Foundation', path: '/admin/system-console/sso', icon: KeyRound, tone: 'text-[#6366f1]' },
    { label: 'Company Setup', description: 'Departments, locations, employee IDs, required fields, documents, and policy defaults.', group: 'Foundation', path: '/admin/system-console/settings', icon: Settings, tone: 'text-[#f59e0b]' },
    { label: 'Organization Structure', description: 'Legal entities, org units, departments, managers, and reporting lines.', group: 'Foundation', path: '/admin/organization', icon: Building2, tone: 'text-[#818cf8]' },
    { label: 'Employee Master Data', description: 'Employee records, digital files, employment lifecycle, and worker status.', group: 'Foundation', path: '/admin/employees', icon: Landmark, tone: 'text-[#4f46e5]' },
    { label: 'Employee Data Rules', description: 'Required employee fields, sensitive data visibility, and protected worker information.', group: 'Foundation', path: '/admin/system-console/settings', icon: DatabaseZap, tone: 'text-[#6366f1]' },
    { label: 'Documents And Files', description: 'Required documents, expiry rules, evidence, and digital file controls.', group: 'Foundation', path: '/admin/system-console/settings', icon: FolderOpen, tone: 'text-[#818cf8]' },
    { label: 'Leave Management', description: 'Entitlements, balances, requests, approvals, holidays, and payroll impact.', group: 'Workforce Operations', path: '/admin/leave', icon: Umbrella, tone: 'text-[#818cf8]' },
    { label: 'Attendance And Time', description: 'Check-in rules, workplace evidence, exceptions, daily ledgers, and payroll handoff.', group: 'Workforce Operations', path: '/admin/attendance', icon: CalendarCheck, tone: 'text-[#f59e0b]' },
    { label: 'Shift Scheduling', description: 'Roster planning, coverage gaps, shift bids, swaps, and fatigue controls.', group: 'Workforce Operations', path: '/admin/modules/workforce-management/operations', icon: Timer, tone: 'text-[#f59e0b]' },
    { label: 'HR Service Delivery', description: 'Cases, tasks, service catalog, SLA rules, and employee support queues.', group: 'Workforce Operations', path: '/admin/modules/service-delivery/operations', icon: ClipboardCheck, tone: 'text-[#f59e0b]' },
    { label: 'Travel And Expenses', description: 'Travel requests, expenses, approvals, and reimbursements.', group: 'Workforce Operations', icon: Plane, tone: 'text-[#818cf8]', status: 'not-configured' },
    { label: 'Payroll Control', description: 'Cycles, statutory packs, blockers, payroll inputs, payslips, and GL handoff.', group: 'Reward And Talent', path: '/admin/payroll', icon: FileText, tone: 'text-[#f59e0b]' },
    { label: 'Compensation', description: 'Bands, pay changes, bonus cycles, equity, and total reward operations.', group: 'Reward And Talent', path: '/admin/modules/compensation/operations', icon: BadgeDollarSign, tone: 'text-[#8b5cf6]' },
    { label: 'Benefits Administration', description: 'Programs, enrollment, life events, carrier reconciliation, and deductions.', group: 'Reward And Talent', path: '/admin/modules/benefits/operations', icon: Umbrella, tone: 'text-[#818cf8]' },
    { label: 'Performance Management', description: 'Review cycles, goals, feedback, calibration, action plans, and KPIs.', group: 'Reward And Talent', path: '/admin/performance', icon: Trophy, tone: 'text-[#f59e0b]' },
    { label: 'Learning Management', description: 'Courses, assignments, certifications, content packages, and renewals.', group: 'Reward And Talent', path: '/admin/modules/learning/operations', icon: BookOpen, tone: 'text-[#6366f1]' },
    { label: 'Onboarding', description: 'Preboarding, joining checklists, provisioning, 30/60/90 plans, and probation.', group: 'Reward And Talent', path: '/admin/onboarding', icon: UserRoundPlus, tone: 'text-[#f59e0b]' },
    { label: 'Employee Engagement', description: 'Surveys, recognition programs, engagement signals, and response controls.', group: 'Reward And Talent', path: '/admin/modules/engagement/operations', icon: Radar, tone: 'text-[#8b5cf6]' },
    { label: 'Policy Center', description: 'Scoped policies, lifecycle approval, simulation, application, and evidence.', group: 'Governance And Insights', path: '/admin/system-console/policies', icon: ShieldCheck, tone: 'text-[#8a4fff]' },
    { label: 'Approval Paths', description: 'Configure command approvals, delegated reviewers, SLA timers, and escalation routes.', group: 'Governance And Insights', path: '/admin/system-console/approvals', icon: GitBranch, tone: 'text-[#6366f1]' },
    { label: 'Compliance Center', description: 'Policies, acknowledgements, legal holds, statutory reporting, and evidence.', group: 'Governance And Insights', path: '/admin/compliance', icon: ShieldCheck, tone: 'text-[#4f46e5]' },
    { label: 'Country Policy', description: 'Country packs, validations, simulations, approvals, publish, and rollback.', group: 'Governance And Insights', path: '/admin/country-policy', icon: Landmark, tone: 'text-[#6366f1]' },
    { label: 'Employee Relations', description: 'Cases, investigations, disciplinary actions, accommodations, and closure.', group: 'Governance And Insights', path: '/admin/modules/employee-relations/operations', icon: Briefcase, tone: 'text-[#8b5cf6]' },
    { label: 'Reporting And Analytics', description: 'Workforce, reward, talent, service, and governance reporting.', group: 'Governance And Insights', path: '/admin/reports', icon: FileText, tone: 'text-[#818cf8]' },
    { label: 'AI Governance', description: 'AI use cases, model runs, bias tests, risk controls, and human oversight.', group: 'Governance And Insights', path: '/admin/modules/hr-ai-governance/operations', icon: Bot, tone: 'text-[#4f46e5]' },
    { label: 'Marketplace', description: 'Extension marketplace and install governance for future add-on services.', group: 'Governance And Insights', icon: Store, tone: 'text-[#6366f1]', status: 'not-configured' },
    { label: 'Production Readiness', description: 'Go-live gate across setup, policies, modules, integrations, queues, audit, and release controls.', group: 'Governance And Insights', path: '/admin/system-console/readiness', icon: Code2, tone: 'text-[#f59e0b]' },
    { label: 'System Operations', description: 'Recovery queues, integrations, activity reporting, and data safeguards.', group: 'Governance And Insights', path: '/admin/system-console#system-operations', icon: Code2, tone: 'text-[#f59e0b]' },
    { label: 'Failed Work Queue', description: 'Review failed background work, decide recovery actions, and export operator evidence.', group: 'Governance And Insights', path: '/admin/system-console/dead-letter-events', icon: AlertTriangle, tone: 'text-[#e11d48]' },
    { label: 'Automation', description: 'Manage scheduled jobs, tenant run windows, manual runs, and last-run health.', group: 'Governance And Insights', path: '/admin/system-console/automation', icon: Timer, tone: 'text-[#6366f1]' },
    { label: 'Audit Trail', description: 'Search, filter, export, and inspect tenant audit evidence.', group: 'Governance And Insights', path: '/admin/system-console/audit', icon: Radar, tone: 'text-[#4f46e5]' },
    { label: 'Service Event Map', description: 'Review service event names, ownership, versioning, and consuming teams.', group: 'Governance And Insights', path: '/admin/system-console/event-contracts', icon: GitBranch, tone: 'text-[#6366f1]' },
  ];
  const filteredAdminPanelTools = adminPanelTools.filter((tool) => (
    tool.label.toLowerCase().includes(adminToolQuery.trim().toLowerCase())
  ));
  const adminPanelGroups: AdminPanelTool['group'][] = [
    'Foundation',
    'Workforce Operations',
    'Reward And Talent',
    'Governance And Insights',
  ];
  const guidedJourneys: GuidedAdminJourney[] = [
    {
      title: 'Organization Setup',
      description: 'Confirm company structure before hiring, transfers, approvals, and reporting depend on it.',
      path: '/admin/organization',
      actionLabel: 'Open Organization',
      status: setupQuery.isSuccess && activeSetupCounts.departments > 0 && activeSetupCounts.locations > 0 ? 'live' : setupQuery.isSuccess ? 'attention' : 'partial',
      statusLabel: setupQuery.isSuccess && activeSetupCounts.departments > 0 && activeSetupCounts.locations > 0 ? 'Ready' : setupQuery.isSuccess ? 'Needs setup' : 'Loading',
      icon: Building2,
      signals: [
        `${activeSetupCounts.departments} active departments`,
        `${activeSetupCounts.locations} active work locations`,
        `${activeJobTitles} job titles available`,
      ],
    },
    {
      title: 'Employee Assignment',
      description: 'Prepare the data rules administrators need when creating or assigning employees.',
      path: '/admin/employees/new',
      actionLabel: 'Create Employee',
      status: employeeAssignmentReady ? 'live' : setupQuery.isSuccess ? 'attention' : 'partial',
      statusLabel: employeeAssignmentReady ? 'Ready' : setupQuery.isSuccess ? 'Check setup' : 'Loading',
      icon: UserRoundPlus,
      signals: [
        `${activeRequiredFieldRules} required employee fields`,
        `${activeDocumentRequirements} hiring document slots`,
        setupQuery.data?.employeeIdPolicy?.mode === 'AUTO' ? 'Employee IDs auto-generate' : 'Employee ID entry is controlled',
      ],
    },
    {
      title: 'Leave And Attendance Policies',
      description: 'Set leave types, holiday calendars, workday rules, and attendance checks before payroll closes.',
      path: '/admin/system-console/settings',
      actionLabel: 'Configure Time Rules',
      status: attendancePolicyReady ? 'live' : setupQuery.isSuccess ? 'attention' : 'partial',
      statusLabel: attendancePolicyReady ? 'Ready' : setupQuery.isSuccess ? 'Needs setup' : 'Loading',
      icon: CalendarCheck,
      signals: [
        `${activeLeavePolicies} active leave policies`,
        `${requestableLeavePolicies} employee-requestable leave types`,
        `${holidayCalendarCount} holiday calendar entries`,
      ],
    },
    {
      title: 'Payroll Statutory Setup',
      description: 'Review country payroll packs, tax and insurance rates, and payroll blockers before running pay.',
      path: '/admin/payroll',
      actionLabel: 'Open Payroll Controls',
      status: payrollSetupReady ? 'live' : setupQuery.isSuccess ? 'attention' : 'partial',
      statusLabel: payrollSetupReady ? 'Ready' : setupQuery.isSuccess ? 'Needs setup' : 'Loading',
      icon: BadgeDollarSign,
      signals: [
        `${statutoryPayrollPackCount} active statutory packs`,
        payrollRatesConfigured ? 'Tax and insurance rates are present' : 'Tax or insurance rates need review',
        `${payrollBlockingRuleCount} payroll blocking rules active`,
      ],
    },
    {
      title: 'Access Review',
      description: 'Review administrator roles, service accounts, sensitive field access, and high-risk permissions.',
      path: '/admin/system-console/access-governance',
      actionLabel: 'Review Access',
      status: 'live',
      statusLabel: 'Available',
      icon: UserCog,
      signals: [
        'Role and permission reviews live in one area',
        'Service accounts can be checked before integrations run',
        'Sensitive employee fields have governed access paths',
      ],
    },
    {
      title: 'Integrations',
      description: 'Check external connections that affect notifications, attendance maps, imports, and exports.',
      path: '/admin/system-console/integrations',
      actionLabel: 'Verify Connections',
      status: integrationGapLabels.length > 0 ? 'attention' : integrationQuery.isSuccess ? 'live' : 'partial',
      statusLabel: integrationGapLabels.length > 0 ? 'Configure' : integrationQuery.isSuccess ? 'Ready' : 'Loading',
      icon: PlugZap,
      signals: [
        `${integrationAdapterCount} connections registered`,
        mailAdapterConfigured ? 'Email delivery connection present' : 'Email delivery needs review',
        mapsConfigured ? 'Attendance maps configured' : 'Attendance maps need a key',
      ],
    },
    {
      title: 'Queues, Audit, And Health',
      description: 'Watch readiness, recover failed work, review notifications, and confirm recent audit evidence.',
      path: '/admin/system-console/readiness',
      actionLabel: 'Open Health',
      status: readinessDown > 0 || queueBacklog > 0 || unresolvedDeadLetters > 0 ? 'attention' : readinessQuery.isSuccess ? 'live' : 'partial',
      statusLabel: readinessDown > 0 || queueBacklog > 0 || unresolvedDeadLetters > 0 ? 'Watch' : readinessQuery.isSuccess ? 'Ready' : 'Loading',
      icon: Activity,
      signals: [
        `${readinessDown} readiness blockers`,
        `${queueBacklog + unresolvedDeadLetters} queue items need review`,
        `${auditQuery.data?.length ?? 0} recent audit records visible`,
      ],
    },
  ];

  const controls = React.useMemo<ConsoleControl[]>(() => [
    {
      title: 'Health And Readiness',
      description: 'Readiness checks for the HR workspace, database, recovery queues, and connected services.',
      status: readinessQuery.data?.status === 'ready' ? 'live' : readinessQuery.isSuccess ? 'attention' : 'partial',
      statusLabel: readinessQuery.data?.status === 'ready' ? 'Ready' : readinessQuery.isSuccess ? 'Not ready' : 'Checking',
      icon: Activity,
      evidence: [
        `Workspace health: ${healthQuery.data?.status ?? 'not loaded'}${healthQuery.data?.version ? ` / v${healthQuery.data.version}` : ''}`,
        `Availability check: ${livenessQuery.data?.status ?? 'not loaded'}`,
        `${readinessQuery.data?.checks?.length ?? 0} readiness checks, ${readinessDown} down`,
        'Tracks readiness before administrators make high-risk changes',
      ],
    },
    {
      title: 'Identity, Roles, And Access',
      description: 'Sign-in rules, roles, service accounts, access reviews, sensitive-field access, and duty conflicts.',
      status: 'live',
      statusLabel: 'Admin managed',
      icon: KeyRound,
      link: '/admin/system-console/access-governance',
      linkLabel: 'Open Access Governance',
      evidence: [
        'Admin-only routes are protected by role checks',
        'Roles, permissions, and user-role grants are managed here',
        'Service-account identities and access-review campaigns/items are persisted and editable',
        'High-risk actions can require reason capture or extra review',
      ],
    },
    {
      title: 'Approvals And Triggers',
      description: 'Approval states and follow-up actions are visible in the module workspaces that own them.',
      status: 'partial',
      statusLabel: 'Module owned',
      icon: Workflow,
      evidence: [
        'Module workspaces show approval status next to business records',
        'Operational actions keep review state and actor evidence',
        'A central automation designer is not configured yet',
      ],
    },
    {
      title: 'Notifications And Recovery Queue',
      description: 'HR operations notifications, failed work review, recovery decisions, and activity reporting.',
      status: notificationsQuery.isSuccess && deadLetterQuery.isSuccess ? 'live' : notificationsQuery.isSuccess ? 'partial' : 'attention',
      statusLabel: notificationsQuery.isSuccess && deadLetterQuery.isSuccess ? 'Ready' : notificationsQuery.isSuccess ? 'Partial' : 'Needs attention',
      icon: BellRing,
      link: '/admin/system-console/dead-letter-events',
      linkLabel: 'Open Failed Work Queue',
      evidence: [
        'HR operations notifications are visible',
        'Retryable failed work can be recovered',
        'Operators can inspect, retry, skip, and export recovery evidence',
        `${unreadNotifications} unread HR operations notifications in the admin inbox`,
        `${usageQueueHealth?.outbox.pendingEvents ?? usageTotals?.pendingOutboxEvents ?? 0} pending queue items and ${usageQueueHealth?.outbox.exhaustedEvents ?? usageTotals?.exhaustedOutboxEvents ?? 0} exhausted items`,
        `${usageQueueHealth?.inbox.failedRetryableEvents ?? usageTotals?.inboxFailedRetryableEvents ?? 0} retryable recovery items and ${usageQueueHealth?.inbox.failedNonRetryableEvents ?? usageTotals?.inboxFailedNonRetryableEvents ?? 0} non-retryable recovery items`,
        `${deadLetterQuery.data?.inbox?.failedNonRetryable ?? 0} non-retryable items and ${deadLetterQuery.data?.outbox?.exhausted ?? 0} exhausted delivery items`,
      ],
    },
    {
      title: 'Integrations',
      description: 'External providers, connection health, ownership, and safe connection checks.',
      status: integrationQuery.isSuccess ? 'partial' : 'attention',
      statusLabel: integrationQuery.isSuccess ? 'Configured' : 'Needs attention',
      icon: PlugZap,
      link: '/admin/system-console/integrations',
      linkLabel: 'Open Integration Controls',
      evidence: [
        `HR service connection: ${apiBaseUrl ? 'configured' : 'not configured'}`,
        `${integrationAdapterCount} external connections registered`,
        `Attendance map key: ${mapsConfigured ? 'configured' : 'not configured'}`,
      ],
    },
    {
      title: 'Activity Reporting',
      description: 'Cross-module activity by actions, notifications, approvals, and queue health.',
      status: serviceUsageQuery.isSuccess ? 'live' : 'attention',
      statusLabel: serviceUsageQuery.isSuccess ? 'Ready' : 'Needs attention',
      icon: FileText,
      link: '/admin/reports',
      linkLabel: 'Open Reporting',
      evidence: [
        `${usageTotals?.commands ?? 0} actions and ${usageTotals?.failedCommands ?? 0} failed actions`,
        `${usageTotals?.events ?? 0} service events, ${usageTotals?.notifications ?? 0} notifications, ${usageTotals?.workflowTransitions ?? 0} approval changes`,
        `${usageTotals?.oldestQueueBacklogAt ? `Oldest queue backlog at ${new Date(usageTotals.oldestQueueBacklogAt).toLocaleString()}` : 'No queue backlog timestamp reported'}`,
        'Reporting workspace summarizes operational activity and exceptions',
      ],
    },
    {
      title: 'Audit And Evidence',
      description: 'Immutable audit trail is queryable by admins and auditors with full search/export from the admin panel.',
      status: auditQuery.isSuccess ? 'live' : 'attention',
      statusLabel: auditQuery.isSuccess ? 'Ready' : 'Needs attention',
      icon: Radar,
      link: '/admin/system-console/audit',
      linkLabel: 'Open Audit Trail',
      evidence: [
        'Recent tenant audit entries are available to authorized roles',
        `${auditQuery.data?.length ?? 0} recent audit records available to this actor`,
        'Dedicated admin audit page supports filters, search, and CSV export',
      ],
    },
    {
      title: 'Service Event Map',
      description: 'Service event names, ownership, versioning, and consuming teams are visible to operators.',
      status: 'live',
      statusLabel: 'Registry UI',
      icon: GitBranch,
      link: '/admin/system-console/event-contracts',
      linkLabel: 'Open Service Event Map',
      evidence: [
        'Shows event names used across HR service areas',
        'Highlights ownership, versioning, and consuming teams',
        'Helps operators review service-event changes before rollout',
      ],
    },
    {
      title: 'System Reset And Data Operations',
      description: 'High-risk data changes require approval, backup, audit history, and environment restrictions.',
      status: 'not-configured',
      statusLabel: 'Not exposed',
      icon: DatabaseZap,
      evidence: [
        'Initial data can be loaded, but self-service reset is not configured',
        'A real reset must create backup, audit, approval, and environment guardrails',
        'Until that exists, this console deliberately does not render a reset button',
      ],
    },
  ], [
    apiBaseUrl,
    auditQuery.data?.length,
    auditQuery.isSuccess,
    healthQuery.data?.status,
    healthQuery.data?.version,
    integrationAdapterCount,
    integrationQuery.isSuccess,
    livenessQuery.data?.status,
    mapsConfigured,
    notificationsQuery.isSuccess,
    readinessDown,
    readinessQuery.data?.checks?.length,
    readinessQuery.data?.status,
    readinessQuery.isSuccess,
    serviceUsageQuery.isSuccess,
    deadLetterQuery.data?.inbox?.failedNonRetryable,
    deadLetterQuery.data?.outbox?.exhausted,
    deadLetterQuery.isSuccess,
    unreadNotifications,
    usageTotals?.commands,
    usageTotals?.events,
    usageTotals?.failedCommands,
    usageTotals?.exhaustedOutboxEvents,
    usageTotals?.inboxFailedNonRetryableEvents,
    usageTotals?.inboxFailedRetryableEvents,
    usageTotals?.notifications,
    usageTotals?.oldestQueueBacklogAt,
    usageTotals?.pendingOutboxEvents,
    usageTotals?.workflowTransitions,
    usageQueueHealth?.inbox.failedNonRetryableEvents,
    usageQueueHealth?.inbox.failedRetryableEvents,
    usageQueueHealth?.outbox.exhaustedEvents,
    usageQueueHealth?.outbox.pendingEvents,
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
      helper: readinessQuery.isSuccess ? `${readinessDown} readiness checks down` : 'Health not loaded',
      icon: Network,
      status: readinessQuery.data?.status === 'ready' ? 'live' as ConsoleStatus : 'attention' as ConsoleStatus,
    },
    {
      label: 'Headcount',
      value: formatNumber(dashboardQuery.data?.headcount),
      helper: 'Current workforce',
      icon: Users,
      status: dashboardQuery.isSuccess ? 'live' : 'attention',
    },
    {
      label: 'Admin Areas',
      value: commercialModules.length.toString(),
      helper: `${nativeModules} full admin, ${workbenchModules} operations, ${apiReadyModules} setup needed`,
      icon: Layers3,
      status: 'live' as ConsoleStatus,
    },
    {
      label: 'Policy Revisions',
      value: formatNumber(policyQuery.data?.totalRevisions),
      helper: `${policyQuery.data?.byStatus?.APPLIED ?? 0} active`,
      icon: ShieldCheck,
      status: policyQuery.isSuccess ? 'live' : 'attention',
    },
    {
      label: 'Activity Signals',
      value: formatNumber((usageTotals?.commands ?? 0) + (usageTotals?.events ?? 0) + (usageTotals?.notifications ?? 0) + (usageTotals?.workflowTransitions ?? 0)),
      helper: 'Actions, notifications, and approvals',
      icon: BellRing,
      status: serviceUsageQuery.isSuccess ? 'live' : 'attention',
    },
  ];

  const pendingAdminWork: PendingAdminWorkItem[] = [
    {
      title: 'Policy Review And Apply Queue',
      helper: pendingPolicyActions > 0
        ? `${pendingPolicyActions} policy revisions need review, approval, publish, or apply. ${unappliedPolicyRevisions} revisions are not active yet.`
        : 'No policy review or apply action is waiting for this tenant.',
      count: pendingPolicyActions,
      status: pendingPolicyActions > 0 ? 'attention' : 'live',
      statusLabel: pendingPolicyActions > 0 ? 'Action' : 'Clear',
      path: '/admin/system-console/policies',
      actionLabel: 'Open Policy Center',
      icon: ShieldCheck,
      group: 'Policy And Payroll',
    },
    {
      title: 'Failed Work Decisions',
      helper: unresolvedDeadLetters > 0
        ? `${unresolvedDeadLetters} failed work items need an operator decision.`
        : 'No failed work items need an operator decision.',
      count: unresolvedDeadLetters,
      status: unresolvedDeadLetters > 0 ? 'attention' : deadLetterQuery.isSuccess ? 'live' : 'partial',
      statusLabel: unresolvedDeadLetters > 0 ? 'Inspect' : deadLetterQuery.isSuccess ? 'Clear' : 'Loading',
      path: '/admin/system-console/dead-letter-events',
      actionLabel: 'Open Failed Work',
      icon: AlertTriangle,
      group: 'Operational Health',
    },
    {
      title: 'Recovery Queue Health',
      helper: queueBacklog > 0
        ? `${queueBacklog} pending, retryable, or in-progress queue items need monitoring.`
        : 'Recovery queue backlog is clear in activity reporting.',
      count: queueBacklog,
      status: queueBacklog > 0 ? 'attention' : serviceUsageQuery.isSuccess ? 'live' : 'partial',
      statusLabel: queueBacklog > 0 ? 'Watch' : serviceUsageQuery.isSuccess ? 'Clear' : 'Loading',
      path: '/admin/system-console#system-operations',
      actionLabel: 'Review Operations',
      icon: Workflow,
      group: 'Operational Health',
    },
    {
      title: 'Setup And Data Quality',
      helper: setupGapLabels.length > 0
        ? setupGapLabels.join(', ')
        : 'Departments, locations, and required employee fields are configured.',
      count: setupGapLabels.length,
      status: setupGapLabels.length > 0 ? 'attention' : setupQuery.isSuccess ? 'live' : 'partial',
      statusLabel: setupGapLabels.length > 0 ? 'Fix setup' : setupQuery.isSuccess ? 'Ready' : 'Loading',
      path: '/admin/system-console/settings',
      actionLabel: 'Open Settings',
      icon: DatabaseZap,
      group: 'Setup And People',
    },
    {
      title: 'Integration Readiness',
      helper: integrationGapLabels.length > 0
        ? integrationGapLabels.join(', ')
        : `${integrationAdapterCount} connections registered, email delivery available, and attendance maps configured.`,
      count: integrationGapLabels.length,
      status: integrationGapLabels.length > 0 ? 'attention' : integrationQuery.isSuccess ? 'live' : 'partial',
      statusLabel: integrationGapLabels.length > 0 ? 'Configure' : integrationQuery.isSuccess ? 'Ready' : 'Loading',
      path: '/admin/system-console/integrations',
      actionLabel: 'Open Integrations',
      icon: PlugZap,
      group: 'Operational Health',
    },
    {
      title: 'Unread Admin Notifications',
      helper: unreadNotifications > 0
        ? `${unreadNotifications} HR operations notifications are unread.`
        : 'No unread HR operations notifications for this actor.',
      count: unreadNotifications,
      status: unreadNotifications > 0 ? 'attention' : notificationsQuery.isSuccess ? 'live' : 'partial',
      statusLabel: unreadNotifications > 0 ? 'Review' : notificationsQuery.isSuccess ? 'Clear' : 'Loading',
      path: '/admin/system-console#admin-notifications',
      actionLabel: 'View Inbox',
      icon: BellRing,
      group: 'Operational Health',
    },
    {
      title: 'Readiness Blockers',
      helper: readinessDown > 0
        ? `${readinessDown} readiness checks are down.`
        : 'Readiness checks are passing.',
      count: readinessDown,
      status: readinessDown > 0 ? 'attention' : readinessQuery.isSuccess ? 'live' : 'partial',
      statusLabel: readinessDown > 0 ? 'Blocked' : readinessQuery.isSuccess ? 'Ready' : 'Loading',
      path: '/admin/system-console#system-operations',
      actionLabel: 'Open Health',
      icon: Network,
      group: 'Operational Health',
    },
  ];
  const pendingWorkGroups = ([
    {
      title: 'Setup And People',
      helper: 'Data required before admins create employees, assign teams, or enforce required fields.',
      icon: Building2,
    },
    {
      title: 'Policy And Payroll',
      helper: 'Reviews that affect leave, attendance, payroll, and live policy behavior.',
      icon: ShieldCheck,
    },
    {
      title: 'Operational Health',
      helper: 'Readiness, recovery queues, integrations, notifications, and audit follow-up.',
      icon: Activity,
    },
  ] satisfies Array<{ title: PendingAdminWorkGroup; helper: string; icon: React.ElementType }>).map((group) => {
    const items = pendingAdminWork.filter((item) => item.group === group.title);
    return {
      ...group,
      items,
      status: groupStatus(items),
    };
  });
  const priorityAdminWork = pendingAdminWork
    .filter((item) => item.status === 'attention' && item.count > 0)
    .slice(0, 3);

  return (
    <div className="min-h-screen fusion-bg">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <BusinessPageHeader
          eyebrow="Platform Administration"
          icon={Network}
          title="Admin Command Center"
          subtitle="Start the right admin journey, review pending work, and check operational health from one governed landing page."
        />

        <section className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
          <Card className="overflow-hidden border-[#e2e8f0] bg-white">
            <CardContent className="p-0">
              <div className="border-b border-[#e2e8f0] bg-[#0f172a] px-5 py-5 text-white">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#a5b4fc]">System Console</p>
                    <h3 className="mt-2 font-headline text-2xl font-bold">Enterprise HR Command Center</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#eef2ff]">
                      Move through setup, employee assignment, policies, payroll, access, integrations, and health checks
                      without hunting across the admin area.
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/20 bg-white/10 p-3 text-sm">
                    <p className="font-semibold">{adminDisplayName}</p>
                    <p className="mt-1 text-[#eef2ff]">{primaryRole}</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-0 divide-y divide-[#e2e8f0] md:grid-cols-4 md:divide-x md:divide-y-0">
                {[
                  { label: 'Employees', value: formatNumber(dashboardQuery.data?.headcount), helper: 'active workforce signal' },
                  { label: 'Setup Readiness', value: `${activeSetupCounts.departments}/${activeSetupCounts.locations}`, helper: 'departments / locations' },
                  { label: 'Policy Work', value: formatNumber(policyQuery.data?.totalRevisions), helper: 'policy revisions' },
                  { label: 'Health', value: readinessQuery.data?.status === 'ready' ? 'Ready' : 'Watch', helper: `${readinessDown} readiness blockers` },
                ].map((item) => (
                  <div key={item.label} className="p-4">
                    <p className="font-mono text-xs uppercase tracking-wider text-[#94a3b8]">{item.label}</p>
                    <p className="mt-2 text-2xl font-bold text-[#0f172a]">{item.value}</p>
                    <p className="mt-1 text-sm text-[#475569]">{item.helper}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#e2e8f0] bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Recommended Next Moves</CardTitle>
              <CardDescription>Highest-priority work from setup, policies, queues, integrations, and health.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-[#475569]">
              {priorityAdminWork.length > 0 ? (
                priorityAdminWork.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.title}
                      to={item.path}
                      className="group flex items-start justify-between gap-3 rounded-lg border border-[#f59e0b]/30 bg-[#fffbeb] p-3 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/20"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#f59e0b]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0f172a]">{item.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#475569]">{item.helper}</p>
                        </div>
                      </div>
                      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-[#4f46e5] transition-transform group-hover:translate-x-1" />
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-lg border border-[#8b5cf6]/20 bg-[#f5f3ff] p-4">
                  <p className="font-semibold text-[#0f172a]">No urgent admin work is waiting.</p>
                  <p className="mt-1 text-sm leading-6 text-[#475569]">Use the guided work paths below to review setup, policies, access, integrations, and health.</p>
                </div>
              )}
              <Button asChild className="w-full" variant="outline">
                <Link to="/admin/system-console#guided-work-paths">
                  View Guided Work Paths
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
          <Card className="relative overflow-hidden border-[#e2e8f0] bg-white">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#f59e0b]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Radar className="h-5 w-5 text-[#f59e0b]" />
                Pending Admin Work
              </CardTitle>
              <CardDescription>
                Setup, policy, payroll, integration, queue, and health items grouped by administrator concern.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0 xl:grid-cols-3">
              {pendingWorkGroups.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <div key={group.title} className="rounded-2xl border border-[#e2e8f0] bg-[#f6f7fb] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-[#4f46e5]">
                          <GroupIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#0f172a]">{group.title}</p>
                          <p className="mt-1 text-sm leading-5 text-[#475569]">{group.helper}</p>
                        </div>
                      </div>
                      <StatusBadge status={group.status} label={group.status === 'live' ? 'Clear' : group.status === 'attention' ? 'Watch' : 'Loading'} />
                    </div>
                    <div className="mt-4 space-y-3">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.title}
                            to={item.path}
                            className="group block rounded-xl border border-[#e2e8f0] bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-[#f59e0b]/50 hover:shadow-[0_10px_24px_rgba(31,49,86,0.08)] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/20"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-3">
                                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fff7ed] text-[#f59e0b]">
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-[#0f172a]">{item.title}</p>
                                  <p className="mt-1 text-sm leading-5 text-[#475569]">{item.helper}</p>
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="font-headline text-2xl font-bold text-[#0f172a]">{item.count}</p>
                                <StatusBadge status={item.status} label={item.statusLabel} />
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t border-[#e2e8f0] pt-2 text-xs font-semibold uppercase tracking-wide text-[#4f46e5]">
                              <span>{item.actionLabel}</span>
                              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-[#e2e8f0] bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Enterprise Gates</CardTitle>
              <CardDescription>High-risk controls that must stay true before calling the system enterprise-grade.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-[#475569]">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e2e8f0] bg-[#f6f7fb] p-3">
                <span>Setup and control surfaces live in Admin Panel</span>
                <StatusBadge status="live" label="Grouped" />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e2e8f0] bg-[#f6f7fb] p-3">
                <span>Policy lifecycle has governed approvals and apply controls</span>
                <StatusBadge status={policyQuery.isSuccess ? 'live' : 'attention'} label={policyQuery.isSuccess ? 'Live' : 'Check'} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e2e8f0] bg-[#f6f7fb] p-3">
                <span>Queues and failures have inspect/retry/skip/export actions</span>
                <StatusBadge status={deadLetterQuery.isSuccess ? 'live' : 'attention'} label={deadLetterQuery.isSuccess ? 'Live' : 'Check'} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e2e8f0] bg-[#f6f7fb] p-3">
                <span>Usage reporting includes actions, notifications, and approvals</span>
                <StatusBadge status={serviceUsageQuery.isSuccess ? 'live' : 'attention'} label={serviceUsageQuery.isSuccess ? 'Live' : 'Check'} />
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="guided-work-paths" className="space-y-4 scroll-mt-28">
          <div>
            <h3 className="font-headline text-xl font-bold text-[#0f172a]">Guided Work Paths</h3>
            <p className="mt-1 text-sm text-[#475569]">
              Choose the journey that matches the change you need to make. Each path shows the setup signals that matter
              before an administrator commits a high-impact change.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {guidedJourneys.map((journey) => (
              <GuidedJourneyCard key={journey.title} journey={journey} />
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-headline text-xl font-bold text-[#0f172a]">Administration Areas</h3>
              <p className="mt-1 text-sm text-[#475569]">Grouped by how HR administrators actually manage the platform.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  aria-label="Search admin services"
                  className="h-9 w-64 rounded-lg border border-[#e2e8f0] bg-white pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/10"
                  onChange={(event) => setAdminToolQuery(event.target.value)}
                  placeholder="Search services"
                  type="search"
                  value={adminToolQuery}
                />
              </div>
              <Button asChild aria-label="Open general settings" size="icon" variant="outline">
                <Link to="/admin/system-console/settings">
                  <Wrench className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="space-y-5">
            {adminPanelGroups.map((group) => {
              const groupTools = filteredAdminPanelTools.filter((tool) => tool.group === group);
              if (groupTools.length === 0) return null;
              return (
                <Card key={group} className="border-[#e2e8f0] bg-[#f6f7fb]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{group}</CardTitle>
                    <CardDescription>
                      {group === 'Foundation' ? 'Core tenant, organization, identity, employee data, and setup controls.' : null}
                      {group === 'Workforce Operations' ? 'Daily workforce execution, service cases, schedules, attendance, and leave.' : null}
                      {group === 'Reward And Talent' ? 'Payroll, rewards, benefits, performance, learning, onboarding, and engagement.' : null}
                      {group === 'Governance And Insights' ? 'Policies, compliance, country controls, reporting, AI governance, and system operations.' : null}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {groupTools.map((tool) => (
                      <AdminPanelTile key={tool.label} tool={tool} />
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {filteredAdminPanelTools.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#e2e8f0] bg-white p-5 text-sm text-[#475569]">
              No services match this search.
            </div>
          ) : null}
        </section>

        <section className="space-y-5">
          <h3 className="font-headline text-xl font-bold text-[#0f172a]">Custom Services</h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <AdminPanelTile
              tool={{
                label: 'Add Service',
                description: 'Configure a custom HR service catalog item, routing rule, SLA, or request workflow.',
                group: 'Custom Services',
                path: '/admin/modules/service-delivery/operations',
                icon: LifeBuoy,
                tone: 'text-[#4f46e5]',
              }}
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {topMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.label} className="relative overflow-hidden">
                <div className="absolute left-0 top-0 h-1 w-full bg-[#8b5cf6]" />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wider text-[#475569]">{metric.label}</p>
                      <p className="mt-2 font-headline text-4xl font-bold text-[#0f172a]">
                        {dashboardQuery.isLoading && metric.label === 'Headcount' ? '-' : metric.value}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#475569]">{metric.helper}</p>
                    </div>
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eef2ff] text-[#4f46e5]">
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

        <section id="system-operations" className="grid gap-4 scroll-mt-28 xl:grid-cols-[1fr_24rem]">
          <Card className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#4f46e5]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <SlidersHorizontal className="h-5 w-5 text-[#4f46e5]" />
                System Operations
              </CardTitle>
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
                  <LockKeyhole className="h-5 w-5 text-[#4f46e5]" />
                  System Guardrails
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-[#475569]">
                <div className="rounded-lg border border-[#e2e8f0] bg-[#f6f7fb] p-3">
                  <p className="font-semibold text-[#0f172a]">Sign-in mode</p>
                  <p>{authBypassEnabled ? 'Local sign-in shortcut is enabled for this build.' : 'Standard sign-in is enforced for this build.'}</p>
                </div>
                <div className="rounded-lg border border-[#e2e8f0] bg-[#f6f7fb] p-3">
                  <p className="font-semibold text-[#0f172a]">Live policy changes</p>
                  <p>Only applied policy revisions change live service behavior.</p>
                </div>
                <div className="rounded-lg border border-[#e2e8f0] bg-[#f6f7fb] p-3">
                  <p className="font-semibold text-[#0f172a]">Historical data</p>
                  <p>Locked historical records are not silently rewritten by policy changes.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <RefreshCcw className="h-5 w-5 text-[#f59e0b]" />
                  Data Operations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-[#475569]">
                <p className="rounded-lg border border-[#f59e0b]/30 bg-[#fde68a]/40 p-3 text-[#78350f]">
                  System reset is intentionally not clickable until a real reset process exists with backup, approval,
                  audit evidence, and environment restrictions.
                </p>
                <Button asChild className="w-full" variant="outline">
                  <Link to="/admin/system-console/settings">Manage Setup Data</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="admin-notifications" className="grid gap-4 scroll-mt-28 xl:grid-cols-[1fr_1fr]">
          <Card className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#6366f1]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <BellRing className="h-5 w-5 text-[#6366f1]" />
                Recent Notifications
              </CardTitle>
              <CardDescription>Recent HR operations messages for this administrator.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {notificationsQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : notificationsQuery.isError ? (
                <ErrorState error={notificationsQuery.error} onRetry={() => notificationsQuery.refetch()} />
              ) : (notificationsQuery.data ?? []).length > 0 ? (
                (notificationsQuery.data ?? []).slice(0, 5).map((notification) => (
                  <div key={notification.id} className="fusion-glass rounded-2xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[#0f172a]">{notification.title}</p>
                      {!notification.readAt ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#4f46e5]" /> : null}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[#475569]">{notification.body}</p>
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">
                      {notification.category} / {formatDate(notification.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="fusion-glass rounded-2xl p-4 text-sm text-[#475569]">
                  No HR operations notifications are available for this actor.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#f59e0b]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <GitBranch className="h-5 w-5 text-[#f59e0b]" />
                Recent Audit Evidence
              </CardTitle>
              <CardDescription>Recent tenant audit trail if the current role has audit scope.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {auditQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : auditQuery.isError ? (
                <ErrorState error={auditQuery.error} onRetry={() => auditQuery.refetch()} />
              ) : (auditQuery.data ?? []).length > 0 ? (
                (auditQuery.data ?? []).slice(0, 5).map((record) => (
                  <div key={record.id} className="fusion-glass rounded-2xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[#0f172a]">{record.action}</p>
                      <p className="text-xs text-[#94a3b8]">{formatDate(record.timestamp)}</p>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[#475569]">
                      {record.resourceType} {record.resourceId ? `/${record.resourceId}` : ''}
                    </p>
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">
                      {record.actorName || 'system'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="fusion-glass rounded-2xl p-4 text-sm text-[#475569]">
                  No audit records are available, or this role cannot access audit history.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <Card className="relative overflow-hidden">
          <div className="absolute left-0 top-0 h-1 w-full bg-[#8b5cf6]" />
          <CardHeader className="p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Layers3 className="h-5 w-5 text-[#4f46e5]" />
                  Module Areas
                </CardTitle>
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
                  <div className="flex h-full min-h-[150px] flex-col fusion-glass rounded-2xl p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-[#8b5cf6]/70 group-hover:bg-[#f6f7fb]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0f172a]">{module.label}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">{module.category}</p>
                      </div>
                      <StatusBadge status={status} label={moduleMaturityLabel(module)} />
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#475569]">{module.summary}</p>
                    <div className="mt-auto flex items-center justify-between pt-3 text-sm font-semibold text-[#4f46e5]">
                      <span>{module.maturity === 'native-ui' ? 'Open native admin' : 'Open operations workspace'}</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
