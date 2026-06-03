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

interface AdminPanelTool {
  label: string;
  description: string;
  group: 'Foundation' | 'Workforce Operations' | 'Reward And Talent' | 'Governance And Insights' | 'Custom Services';
  path?: string;
  icon: React.ElementType;
  tone: string;
  status?: 'live' | 'backend-required';
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
        ) : control.status !== 'backend-required' ? (
          <div className="mt-auto rounded-lg border border-[#bbcabf] bg-[#f8f9ff] p-3 text-sm font-semibold text-[#3c4a42]">
            Observed directly in this console.
          </div>
        ) : (
          <div className="mt-auto rounded-lg border border-[#bbcabf] bg-[#f8f9ff] p-3 text-sm font-semibold text-[#3c4a42]">
            Backend endpoint required before this can be safely operated.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminPanelTile({ tool }: { tool: AdminPanelTool }) {
  const Icon = tool.icon;
  const content = (
    <div className="group relative flex h-full min-h-[132px] flex-col rounded-lg border border-[#d5dfec] bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#10b981]/60 hover:shadow-[0_10px_24px_rgba(31,49,86,0.08)]">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eff4ff]">
          <Icon className={`h-5 w-5 ${tool.tone}`} strokeWidth={1.9} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold leading-5 text-[#0b1c30]">{tool.label}</p>
          <p className="mt-1 text-sm leading-5 text-[#3c4a42]">{tool.description}</p>
        </div>
        {tool.status === 'backend-required' ? (
          <span className="absolute right-3 top-3 rounded-full border border-[#e29100]/40 bg-[#ffddb8] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#523200]">
            Backend
          </span>
        ) : null}
      </div>
      <div className="mt-auto flex items-center justify-between pt-4 text-xs font-semibold uppercase tracking-wide text-[#006c49]">
        <span>{tool.path ? 'Open admin area' : 'Needs admin API'}</span>
        {tool.path ? <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /> : null}
      </div>
    </div>
  );

  if (!tool.path) {
    return (
      <div aria-label={`${tool.label} requires backend support`} className="cursor-not-allowed opacity-80" title="Backend/admin API required">
        {content}
      </div>
    );
  }

  return (
    <Link to={tool.path} className="focus:outline-none focus:ring-2 focus:ring-[#006c49]/30">
      {content}
    </Link>
  );
}

export function AdminSystemConsole() {
  const { user } = useAuth();
  const [adminToolQuery, setAdminToolQuery] = React.useState('');
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
  const readinessDown = readinessQuery.data?.checks.filter((check) => check.status === 'down').length ?? 0;
  const integrationAdapterCount = Array.isArray(integrationQuery.data?.adapters)
    ? integrationQuery.data.adapters.length
    : integrationQuery.data?.adapters && typeof integrationQuery.data.adapters === 'object'
      ? Object.keys(integrationQuery.data.adapters).length
      : 0;
  const usageTotals = serviceUsageQuery.data?.totals;
  const adminDisplayName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || 'System Administrator';
  const primaryRole = user?.roles?.[0]?.name?.replace(/_/g, ' ') ?? 'Administrator';
  const adminPanelTools: AdminPanelTool[] = [
    { label: 'Access Governance', description: 'Users, roles, permissions, service accounts, access reviews, ABAC, field-access, and SoD.', group: 'Foundation', path: '/admin/access-governance', icon: UserCog, tone: 'text-[#ff9800]' },
    { label: 'Tenant Setup', description: 'Departments, locations, ID rules, custom fields, and document setup.', group: 'Foundation', path: '/admin/settings', icon: Settings, tone: 'text-[#ff9800]' },
    { label: 'Organization Structure', description: 'Legal entities, org units, departments, managers, and reporting lines.', group: 'Foundation', path: '/admin/organization', icon: Building2, tone: 'text-[#2aa9de]' },
    { label: 'Employee Master Data', description: 'Employee records, digital files, employment lifecycle, and worker status.', group: 'Foundation', path: '/admin/employees', icon: Landmark, tone: 'text-[#006c49]' },
    { label: 'Data Governance', description: 'Required fields, sensitive fields, masking rules, protected worker data, and runtime field decisions.', group: 'Foundation', path: '/admin/settings', icon: DatabaseZap, tone: 'text-[#4648d4]' },
    { label: 'Documents And Files', description: 'Required documents, expiry rules, evidence, and digital file controls.', group: 'Foundation', path: '/admin/settings', icon: FolderOpen, tone: 'text-[#2aa9de]' },
    { label: 'Leave Management', description: 'Entitlements, balances, requests, approvals, holidays, and payroll impact.', group: 'Workforce Operations', path: '/admin/leave', icon: Umbrella, tone: 'text-[#2aa9de]' },
    { label: 'Attendance And Time', description: 'Check-in policies, geolocation evidence, exceptions, ledgers, and exports.', group: 'Workforce Operations', path: '/admin/attendance', icon: CalendarCheck, tone: 'text-[#ff7043]' },
    { label: 'Shift Scheduling', description: 'Roster planning, coverage gaps, shift bids, swaps, and fatigue controls.', group: 'Workforce Operations', path: '/admin/modules/workforce-management/operations', icon: Timer, tone: 'text-[#ff9800]' },
    { label: 'HR Service Delivery', description: 'Cases, tasks, service catalog, SLA rules, and employee support queues.', group: 'Workforce Operations', path: '/admin/modules/service-delivery/operations', icon: ClipboardCheck, tone: 'text-[#ff7043]' },
    { label: 'Travel And Expenses', description: 'Travel requests, expenses, approvals, and reimbursement integrations.', group: 'Workforce Operations', icon: Plane, tone: 'text-[#2aa9de]', status: 'backend-required' },
    { label: 'Payroll Control', description: 'Cycles, statutory packs, blockers, payroll inputs, payslips, and GL handoff.', group: 'Reward And Talent', path: '/admin/payroll', icon: FileText, tone: 'text-[#ff9800]' },
    { label: 'Compensation', description: 'Bands, pay changes, bonus cycles, equity, and total reward operations.', group: 'Reward And Talent', path: '/admin/modules/compensation/operations', icon: BadgeDollarSign, tone: 'text-[#dc3f92]' },
    { label: 'Benefits Administration', description: 'Programs, enrollment, life events, carrier reconciliation, and deductions.', group: 'Reward And Talent', path: '/admin/modules/benefits/operations', icon: Umbrella, tone: 'text-[#2aa9de]' },
    { label: 'Performance Management', description: 'Review cycles, goals, feedback, calibration, action plans, and KPIs.', group: 'Reward And Talent', path: '/admin/performance', icon: Trophy, tone: 'text-[#8bb42a]' },
    { label: 'Learning Management', description: 'Courses, assignments, certifications, content packages, and renewals.', group: 'Reward And Talent', path: '/admin/modules/learning/operations', icon: BookOpen, tone: 'text-[#5e84ff]' },
    { label: 'Onboarding', description: 'Preboarding, joining checklists, provisioning, 30/60/90 plans, and probation.', group: 'Reward And Talent', path: '/admin/onboarding', icon: UserRoundPlus, tone: 'text-[#ff9800]' },
    { label: 'Employee Engagement', description: 'Surveys, recognition programs, engagement signals, and response controls.', group: 'Reward And Talent', path: '/admin/modules/engagement/operations', icon: Radar, tone: 'text-[#dc3f92]' },
    { label: 'Policy Center', description: 'Scoped policies, lifecycle approval, simulation, application, and evidence.', group: 'Governance And Insights', path: '/admin/policies', icon: ShieldCheck, tone: 'text-[#8a4fff]' },
    { label: 'Compliance Center', description: 'Policies, acknowledgements, legal holds, statutory reporting, and evidence.', group: 'Governance And Insights', path: '/admin/compliance', icon: ShieldCheck, tone: 'text-[#006c49]' },
    { label: 'Country Policy', description: 'Country packs, validations, simulations, approvals, publish, and rollback.', group: 'Governance And Insights', path: '/admin/country-policy', icon: Landmark, tone: 'text-[#4648d4]' },
    { label: 'Employee Relations', description: 'Cases, investigations, disciplinary actions, accommodations, and closure.', group: 'Governance And Insights', path: '/admin/modules/employee-relations/operations', icon: Briefcase, tone: 'text-[#dc3f92]' },
    { label: 'Reporting And Analytics', description: 'Report builder operations, scheduled reports, usage, and calculated fields.', group: 'Governance And Insights', path: '/admin/modules/reporting/operations', icon: FileText, tone: 'text-[#2aa9de]' },
    { label: 'AI Governance', description: 'AI use cases, model runs, bias tests, risk controls, and human oversight.', group: 'Governance And Insights', path: '/admin/modules/hr-ai-governance/operations', icon: Bot, tone: 'text-[#2f6fc2]' },
    { label: 'Marketplace', description: 'Extension marketplace and install governance for future add-on services.', group: 'Governance And Insights', icon: Store, tone: 'text-[#5e84ff]', status: 'backend-required' },
    { label: 'Development Controls', description: 'Runtime health, workflow controls, integrations, outbox, and data operations.', group: 'Governance And Insights', path: '/admin/system-console#development-controls', icon: Code2, tone: 'text-[#ff7043]' },
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
  const adminJourneySteps = [
    {
      step: '01',
      title: 'Set Tenant Foundation',
      description: 'Company setup, IDs, departments, locations, documents, required fields, and sensitive data rules.',
      path: '/admin/settings',
      status: setupQuery.isSuccess ? 'live' : 'attention',
      label: setupQuery.isSuccess ? 'Ready' : 'Check setup API',
      icon: Settings,
    },
    {
      step: '02',
      title: 'Build Organization',
      description: 'Create legal entities, org units, departments, manager relationships, and workforce planning scenarios.',
      path: '/admin/organization',
      status: 'live',
      label: 'Operational',
      icon: Building2,
    },
    {
      step: '03',
      title: 'Create Employees',
      description: 'Create worker records, assign employment details, lifecycle status, department, and manager ownership.',
      path: '/admin/employees/new',
      status: 'live',
      label: 'Operational',
      icon: UserRoundPlus,
    },
    {
      step: '04',
      title: 'Govern Policies',
      description: 'Create, scope, validate, simulate, approve, publish, and apply policies into live runtime behavior.',
      path: '/admin/policies',
      status: policyQuery.isSuccess ? 'live' : 'attention',
      label: policyQuery.isSuccess ? 'Policy API live' : 'Check policy API',
      icon: ShieldCheck,
    },
    {
      step: '05',
      title: 'Verify Runtime',
      description: 'Monitor health, events, notifications, service usage, audit evidence, integrations, and workflow wiring.',
      path: '/admin/system-console#development-controls',
      status: readinessQuery.data?.status === 'ready' ? 'live' : readinessQuery.isSuccess ? 'attention' : 'partial',
      label: readinessQuery.data?.status === 'ready' ? 'Ready' : 'Watch',
      icon: Activity,
    },
  ] satisfies Array<{
    step: string;
    title: string;
    description: string;
    path: string;
    status: ConsoleStatus;
    label: string;
    icon: React.ElementType;
  }>;

  const controls = React.useMemo<ConsoleControl[]>(() => [
    {
      title: 'Health And Readiness',
      description: 'Platform liveness/readiness checks for API, database, Redis, and Kafka when configured.',
      status: readinessQuery.data?.status === 'ready' ? 'live' : readinessQuery.isSuccess ? 'attention' : 'partial',
      statusLabel: readinessQuery.data?.status === 'ready' ? 'Ready' : readinessQuery.isSuccess ? 'Not ready' : 'Endpoint check',
      icon: Activity,
      evidence: [
        `API health: ${healthQuery.data?.status ?? 'not loaded'}${healthQuery.data?.version ? ` / v${healthQuery.data.version}` : ''}`,
        `Liveness: ${livenessQuery.data?.status ?? 'not loaded'}`,
        `${readinessQuery.data?.checks.length ?? 0} readiness checks, ${readinessDown} down`,
        'Uses /health, /health/ready, and /health/live backend endpoints',
      ],
    },
    {
      title: 'Identity, Roles, And Access',
      description: 'Authentication, RBAC, service accounts, access reviews, ABAC, field policy, and SoD are managed from Access Governance.',
      status: 'live',
      statusLabel: 'Admin managed',
      icon: KeyRound,
      link: '/admin/access-governance',
      linkLabel: 'Open Access Governance',
      evidence: [
        'Auth guard and admin role gates protect admin routes',
        'Native APIs manage roles, permissions, role-permission joins, and user-role grants',
        'Service-account identities and access-review campaigns/items are persisted and editable',
        'Policy overrides are evaluated in the command bus before domain handlers run',
      ],
    },
    {
      title: 'Workflow And Trigger Control',
      description: 'Domain commands and workflows exist, while a cross-module workflow designer/control plane is not yet exposed.',
      status: 'partial',
      statusLabel: 'Domain-backed',
      icon: Workflow,
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
      evidence: [
        'Uses /notifications/hr-operations for admin notification visibility',
        `${unreadNotifications} unread HR operations notifications in the current inbox`,
        `${usageTotals?.pendingOutboxEvents ?? 0} pending outbox events reported by service usage summary`,
      ],
    },
    {
      title: 'Integrations',
      description: 'System development control for external adapters, health checks, metrics, and safe manual integration probes.',
      status: integrationQuery.isSuccess ? 'partial' : 'attention',
      statusLabel: integrationQuery.isSuccess ? 'Status API' : 'Needs attention',
      icon: PlugZap,
      link: '/admin/system-console/integrations',
      linkLabel: 'Open Integration Controls',
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
            <h2 className="mt-3 font-headline text-4xl font-bold text-[#0b1c30]">Administrator Settings</h2>
            <p className="mt-2 max-w-3xl text-lg leading-8 text-[#3c4a42]">
              One administration panel for system management: setup, policies, organization, services, compliance,
              payroll, workforce, reporting, and controlled platform operations.
            </p>
          </div>
          <div className="rounded-lg border border-[#d5dfec] bg-white px-4 py-3 text-sm leading-6 text-[#3c4a42]">
            Setup and control starts here. Sidebar tabs stay for using the system as an employee, manager, or HR operator.
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
          <Card className="overflow-hidden border-[#d5dfec] bg-white">
            <CardContent className="p-0">
              <div className="border-b border-[#d5dfec] bg-[#0b1c30] px-5 py-5 text-white">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-wider text-[#6ffbbe]">Admin Panel Home</p>
                    <h3 className="mt-2 font-headline text-2xl font-bold">Enterprise HR Administration Center</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#eaf1ff]">
                      Manage business configuration, policies, workforce services, compliance, reporting, and operational
                      modules from one governed control surface.
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/20 bg-white/10 p-3 text-sm">
                    <p className="font-semibold">{adminDisplayName}</p>
                    <p className="mt-1 text-[#eaf1ff]">{primaryRole}</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-0 divide-y divide-[#d5dfec] md:grid-cols-4 md:divide-x md:divide-y-0">
                {[
                  { label: 'Employees', value: formatNumber(dashboardQuery.data?.headcount), helper: 'active workforce signal' },
                  { label: 'Setup Data', value: `${activeSetupCounts.departments}/${activeSetupCounts.locations}`, helper: 'departments / locations' },
                  { label: 'Policies', value: formatNumber(policyQuery.data?.totalRevisions), helper: 'versioned revisions' },
                  { label: 'Runtime', value: readinessQuery.data?.status === 'ready' ? 'Ready' : 'Watch', helper: `${readinessDown} readiness blockers` },
                ].map((item) => (
                  <div key={item.label} className="p-4">
                    <p className="font-mono text-xs uppercase tracking-wider text-[#6c7a71]">{item.label}</p>
                    <p className="mt-2 text-2xl font-bold text-[#0b1c30]">{item.value}</p>
                    <p className="mt-1 text-sm text-[#3c4a42]">{item.helper}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#d5dfec] bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Admin Scope</CardTitle>
              <CardDescription>What this panel controls today.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-[#3c4a42]">
              <div className="flex items-center justify-between rounded-lg border border-[#d5dfec] bg-[#f8f9ff] p-3">
                <span>Business administration</span>
                <StatusBadge status="live" label="Grouped" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#d5dfec] bg-[#f8f9ff] p-3">
                <span>Policies and setup</span>
                <StatusBadge status={policyQuery.isSuccess && setupQuery.isSuccess ? 'live' : 'attention'} label="Panel only" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#d5dfec] bg-[#f8f9ff] p-3">
                <span>Development controls</span>
                <StatusBadge status="partial" label="Separated" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#d5dfec] bg-[#f8f9ff] p-3">
                <span>Admin APIs still needed</span>
                <StatusBadge status="attention" label="Visible" />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="font-headline text-xl font-bold text-[#0b1c30]">Administrator Journey</h3>
            <p className="mt-1 text-sm text-[#3c4a42]">
              Follow this path to make changes that affect the whole system: setup first, structure second, people third,
              policies fourth, runtime verification last.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-5">
            {adminJourneySteps.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.step} to={item.path} className="group focus:outline-none focus:ring-2 focus:ring-[#006c49]/30">
                  <div className="flex h-full min-h-[190px] flex-col rounded-lg border border-[#d5dfec] bg-white p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-[#10b981]/60 group-hover:shadow-[0_10px_24px_rgba(31,49,86,0.08)]">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#6c7a71]">{item.step}</span>
                      <StatusBadge status={item.status} label={item.label} />
                    </div>
                    <div className="mt-4 grid h-11 w-11 place-items-center rounded-lg bg-[#eff4ff] text-[#006c49]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h4 className="mt-4 font-semibold text-[#0b1c30]">{item.title}</h4>
                    <p className="mt-2 flex-1 text-sm leading-5 text-[#3c4a42]">{item.description}</p>
                    <div className="mt-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#006c49]">
                      <span>Open step</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-headline text-xl font-bold text-[#0b1c30]">Administration Areas</h3>
              <p className="mt-1 text-sm text-[#3c4a42]">Grouped by how HR administrators actually manage the platform.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6c7a71]" />
                <input
                  aria-label="Search admin services"
                  className="h-9 w-64 rounded-lg border border-[#d5dfec] bg-white pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-[#6c7a71] focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10"
                  onChange={(event) => setAdminToolQuery(event.target.value)}
                  placeholder="Search services"
                  type="search"
                  value={adminToolQuery}
                />
              </div>
              <Button asChild aria-label="Open general settings" size="icon" variant="outline">
                <Link to="/admin/settings">
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
                <Card key={group} className="border-[#d5dfec] bg-[#f8fbff]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{group}</CardTitle>
                    <CardDescription>
                      {group === 'Foundation' ? 'Core tenant, organization, identity, employee data, and setup controls.' : null}
                      {group === 'Workforce Operations' ? 'Daily workforce execution, service cases, schedules, attendance, and leave.' : null}
                      {group === 'Reward And Talent' ? 'Payroll, rewards, benefits, performance, learning, onboarding, and engagement.' : null}
                      {group === 'Governance And Insights' ? 'Policies, compliance, country controls, reporting, AI governance, and system development controls.' : null}
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
            <div className="rounded-lg border border-dashed border-[#bbcabf] bg-white p-5 text-sm text-[#3c4a42]">
              No services match this search.
            </div>
          ) : null}
        </section>

        <section className="space-y-5">
          <h3 className="font-headline text-xl font-bold text-[#0b1c30]">Custom Services</h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <AdminPanelTile
              tool={{
                label: 'Add Service',
                description: 'Configure a custom HR service catalog item, routing rule, SLA, or request workflow.',
                group: 'Custom Services',
                path: '/admin/modules/service-delivery/operations',
                icon: LifeBuoy,
                tone: 'text-[#0077ff]',
              }}
            />
          </div>
        </section>

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

        <section id="development-controls" className="grid gap-4 scroll-mt-28 xl:grid-cols-[1fr_24rem]">
          <Card className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#006c49]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <SlidersHorizontal className="h-5 w-5 text-[#006c49]" />
                Development Controls
              </CardTitle>
              <CardDescription>
                Runtime and development-control tools stay here. Business administration lives in the Admin Panel above.
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

      </div>
    </div>
  );
}
