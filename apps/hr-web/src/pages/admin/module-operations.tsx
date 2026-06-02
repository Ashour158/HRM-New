import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Database,
  ExternalLink,
  GitBranch,
  LockKeyhole,
  PlayCircle,
  Route,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Workflow,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { findCommercialModule, type CommercialModule } from '@/lib/commercial-modules';

type OperationalRecord = {
  id: string;
  object: string;
  owner: string;
  workflow: string;
  status: 'Draft' | 'Active' | 'In Review' | 'Blocked' | 'Closed';
  risk: 'Low' | 'Medium' | 'High';
  lastEvent: string;
  source?: string;
  nativeSource?: string | null;
  nativeId?: string | null;
  nativeRoute?: string | null;
};

type WorkflowItem = {
  id: string;
  workflow: string;
  owner: string;
  state: 'Queued' | 'In Progress' | 'Needs Approval' | 'Ready';
  sla: string;
  lastEvent: string;
};

type OperationRecordApi = {
  id: string;
  objectType: string;
  ownerRole: string;
  workflowName: string;
  status: OperationalRecord['status'];
  risk: OperationalRecord['risk'];
  lastEvent: string;
  source?: string;
  nativeSource?: string | null;
  nativeId?: string | null;
  nativeRoute?: string | null;
  payload?: unknown;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
};

type OperationWorkflowApi = {
  id: string;
  workflowName: string;
  ownerRole: string;
  state: WorkflowItem['state'];
  slaTarget: string;
  lastEvent: string;
  payload?: unknown;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
};

type OperationWorkspaceApi = {
  moduleId: string;
  records: OperationRecordApi[];
  workflows: OperationWorkflowApi[];
};

type CreateRecordVariables = {
  action: string;
  objectType?: string;
  ownerRole?: string;
  workflowName?: string;
  status?: OperationalRecord['status'];
  risk?: OperationalRecord['risk'];
  lastEvent?: string;
  payload?: unknown;
};

type UpdateRecordVariables = {
  record: OperationalRecord;
  status?: OperationalRecord['status'];
  lastEvent?: string;
};

type UpdateWorkflowVariables = {
  workflow: WorkflowItem;
  state?: WorkflowItem['state'];
  lastEvent?: string;
};

type DomainProfile = {
  cockpitTitle: string;
  cockpitSummary: string;
  primaryAction: string;
  secondaryAction: string;
  adminActions: string[];
  eventTriggers: string[];
  integrationPoints: string[];
  sensitiveControls: string[];
  employeePath?: string;
};

const defaultEventTriggers = [
  'Status transition created',
  'Approval decision recorded',
  'Evidence packet attached',
  'SLA threshold reached',
  'Downstream handoff queued',
];

const defaultIntegrationPoints = [
  'Employee master data',
  'Organization and manager hierarchy',
  'Policy action service',
  'Audit trail and event bus',
  'Notification engine',
];

const categoryProfiles: Record<CommercialModule['category'], DomainProfile> = {
  'Core HR': {
    cockpitTitle: 'People operations cockpit',
    cockpitSummary: 'Control the core workforce records, hierarchy dependencies, and lifecycle transitions other HR modules rely on.',
    primaryAction: 'Create governed record',
    secondaryAction: 'Review lifecycle exceptions',
    adminActions: ['Validate source-of-truth record', 'Check manager routing', 'Review position impact'],
    eventTriggers: ['Master data changed', 'Manager chain recalculated', 'Lifecycle status changed', 'Position budget touched'],
    integrationPoints: ['Employee core', 'Organization', 'Position control', 'Payroll eligibility', 'Self-service profile'],
    sensitiveControls: ['Field-level visibility', 'Manager-scope enforcement', 'Lifecycle state machine', 'Audit evidence'],
  },
  Workforce: {
    cockpitTitle: 'Workforce execution cockpit',
    cockpitSummary: 'Manage coverage, scheduling, attendance evidence, exceptions, and payroll handoff from one operational command surface.',
    primaryAction: 'Publish workforce action',
    secondaryAction: 'Resolve coverage risk',
    adminActions: ['Check staffing rule', 'Review exception evidence', 'Queue payroll handoff'],
    eventTriggers: ['Schedule published', 'Coverage gap opened', 'Attendance exception created', 'Payroll cutoff reached'],
    integrationPoints: ['Time attendance', 'Leave management', 'Workforce management', 'Payroll input builder', 'Notifications'],
    sensitiveControls: ['Geolocation policy', 'Fatigue rules', 'Manager approval', 'Payroll close blocker'],
  },
  'Payroll & Reward': {
    cockpitTitle: 'Reward operations cockpit',
    cockpitSummary: 'Coordinate compensation, benefits, and payroll-impacting decisions with protected access and downstream finance controls.',
    primaryAction: 'Start reward workflow',
    secondaryAction: 'Review payroll impact',
    adminActions: ['Validate eligibility', 'Check budget owner', 'Queue payroll deduction or earning'],
    eventTriggers: ['Reward plan changed', 'Eligibility recalculated', 'Employee election submitted', 'Payroll deduction queued'],
    integrationPoints: ['Payroll', 'Benefits', 'Employee core', 'Finance approval', 'Audit trail'],
    sensitiveControls: ['Salary privacy', 'Benefits evidence controls', 'Segregation of duties', 'Payroll handoff audit'],
    employeePath: '/employee/benefits',
  },
  Talent: {
    cockpitTitle: 'Talent operations cockpit',
    cockpitSummary: 'Move people through hiring, onboarding, development, performance, learning, and succession workflows with clear ownership.',
    primaryAction: 'Launch talent workflow',
    secondaryAction: 'Review talent pipeline',
    adminActions: ['Assign owner group', 'Check readiness milestone', 'Trigger manager notification'],
    eventTriggers: ['Candidate converted', 'Learning assigned', 'Goal checkpoint missed', 'Talent pool updated'],
    integrationPoints: ['Recruiting', 'Onboarding', 'Performance', 'Learning', 'Skills profile'],
    sensitiveControls: ['Talent privacy category', 'Anonymous thresholds', 'Manager scope', 'Bias review evidence'],
  },
  Compliance: {
    cockpitTitle: 'Governance and risk cockpit',
    cockpitSummary: 'Run restricted HR compliance, legal, AI, labor, and country workflows with evidence, thresholds, and approvals visible.',
    primaryAction: 'Open governed case',
    secondaryAction: 'Review risk controls',
    adminActions: ['Classify risk', 'Attach evidence', 'Route legal review'],
    eventTriggers: ['Case opened', 'Evidence reviewed', 'Legal hold updated', 'Risk tier changed'],
    integrationPoints: ['Compliance', 'Country policy', 'Audit trail', 'Access control', 'Notification engine'],
    sensitiveControls: ['Restricted case access', 'Suppression thresholds', 'Legal privilege', 'Human oversight'],
  },
  Operations: {
    cockpitTitle: 'HR operations cockpit',
    cockpitSummary: 'Manage service delivery, reporting, contractors, wellbeing, and shared operational work with SLA and case visibility.',
    primaryAction: 'Open operations item',
    secondaryAction: 'Review SLA queue',
    adminActions: ['Assign service owner', 'Check SLA target', 'Link knowledge or report output'],
    eventTriggers: ['Case opened', 'Task assigned', 'Report completed', 'SLA breach warning'],
    integrationPoints: ['HR service delivery', 'Reporting', 'Employee core', 'Knowledge base', 'Notification engine'],
    sensitiveControls: ['Case visibility', 'Health privacy', 'Contractor classification', 'Scheduled export permissions'],
    employeePath: '/employee/services',
  },
};

const domainOverrides: Partial<Record<string, Partial<DomainProfile>>> = {
  'service-delivery': {
    primaryAction: 'Create service catalog item',
    secondaryAction: 'Open agent queue',
    adminActions: ['Triage new case', 'Assign HR service agent', 'Link knowledge article', 'Escalate SLA breach'],
    eventTriggers: ['Service case opened', 'Case task assigned', 'Knowledge article used', 'SLA breach warning'],
    integrationPoints: ['Employee self-service', 'Case tasks', 'Knowledge articles', 'SLA timers', 'Notifications'],
  },
  benefits: {
    primaryAction: 'Create benefits program',
    secondaryAction: 'Review enrollment event',
    adminActions: ['Validate employee eligibility', 'Review dependent evidence', 'Queue payroll deduction', 'Reconcile carrier file'],
    eventTriggers: ['Life event submitted', 'Enrollment approved', 'Carrier exception found', 'Payroll deduction queued'],
    integrationPoints: ['Employee benefits portal', 'Payroll deductions', 'Dependent records', 'Carrier reconciliation', 'Audit trail'],
  },
  recruiting: {
    primaryAction: 'Create requisition',
    secondaryAction: 'Review hiring pipeline',
    adminActions: ['Approve requisition', 'Schedule interview plan', 'Send offer for approval', 'Trigger onboarding handoff'],
    eventTriggers: ['Requisition approved', 'Candidate advanced', 'Offer accepted', 'Onboarding plan requested'],
    integrationPoints: ['Position control', 'Onboarding', 'Employee core', 'Hiring manager approvals', 'Notifications'],
  },
  compensation: {
    primaryAction: 'Start compensation cycle',
    secondaryAction: 'Review merit worksheet',
    adminActions: ['Load merit budget', 'Check band exception', 'Route comp approval', 'Publish reward statement'],
    eventTriggers: ['Pay change proposed', 'Band exception created', 'Approval completed', 'Payroll input queued'],
    integrationPoints: ['Payroll', 'Performance', 'Position budget', 'Finance approval', 'Pay equity analytics'],
  },
  'employee-relations': {
    primaryAction: 'Open restricted ER case',
    secondaryAction: 'Review investigation queue',
    adminActions: ['Classify complaint', 'Assign investigator', 'Attach interview evidence', 'Prepare resolution letter'],
    eventTriggers: ['ER case opened', 'Investigation started', 'Evidence reviewed', 'Disciplinary action routed'],
    integrationPoints: ['Compliance', 'Legal hold', 'Employee file', 'Manager approvals', 'Audit trail'],
  },
  reporting: {
    primaryAction: 'Create report definition',
    secondaryAction: 'Review execution queue',
    adminActions: ['Validate field access', 'Run report', 'Schedule delivery', 'Export audit packet'],
    eventTriggers: ['Report execution queued', 'Report completed', 'Schedule failed', 'Calculated field changed'],
    integrationPoints: ['Field access policy', 'Audit trail', 'Scheduled exports', 'Dashboard library', 'Notification engine'],
  },
  'hr-ai-governance': {
    primaryAction: 'Register AI use case',
    secondaryAction: 'Review model risk',
    adminActions: ['Classify AI risk', 'Attach bias test', 'Assign human owner', 'Activate kill switch'],
    eventTriggers: ['AI use case registered', 'Bias test completed', 'Oversight approved', 'Kill switch activated'],
    integrationPoints: ['Policy action service', 'Audit trail', 'Legal review', 'Model run registry', 'Notification engine'],
  },
  'workforce-management': {
    primaryAction: 'Create schedule plan',
    secondaryAction: 'Resolve staffing gap',
    adminActions: ['Publish roster', 'Open shift bid', 'Approve swap request', 'Check fatigue risk'],
    eventTriggers: ['Schedule published', 'Open shift posted', 'Swap requested', 'Coverage gap escalated'],
    integrationPoints: ['Attendance', 'Leave calendar', 'Payroll overtime', 'Skills and licenses', 'Notifications'],
  },
};

function mergeProfile(module: CommercialModule): DomainProfile {
  return { ...categoryProfiles[module.category], ...domainOverrides[module.id] };
}

function apiData<T>(payload: unknown): T {
  const response = payload as { data?: T; success?: boolean };
  if (response.success === true && response.data !== undefined) return response.data;
  return payload as T;
}

function unwrap<T>(response: { data: unknown }) {
  return apiData<T>(response.data);
}

function mutationErrorMessage(error: unknown): string {
  const responseData = (error as { response?: { data?: unknown } }).response?.data;
  if (typeof responseData === 'object' && responseData !== null) {
    const message = (responseData as { message?: unknown; error?: unknown }).message
      ?? (responseData as { message?: unknown; error?: unknown }).error;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Request failed';
}

function mapRecord(record: OperationRecordApi): OperationalRecord {
  return {
    id: record.id,
    object: record.objectType,
    owner: record.ownerRole,
    workflow: record.workflowName,
    status: record.status,
    risk: record.risk,
    lastEvent: record.lastEvent,
    source: record.source,
    nativeSource: record.nativeSource,
    nativeId: record.nativeId,
    nativeRoute: record.nativeRoute,
  };
}

function mapWorkflow(workflow: OperationWorkflowApi): WorkflowItem {
  return {
    id: workflow.id,
    workflow: workflow.workflowName,
    owner: workflow.ownerRole,
    state: workflow.state,
    sla: workflow.slaTarget,
    lastEvent: workflow.lastEvent,
  };
}

function statusTone(status: OperationalRecord['status'] | WorkflowItem['state']) {
  if (status === 'Blocked' || status === 'Needs Approval') return 'border-[#ba1a1a]/25 bg-[#ffdad6] text-[#93000a]';
  if (status === 'Ready' || status === 'Active' || status === 'Closed') return 'border-[#10b981]/25 bg-[#10b981]/10 text-[#006c49]';
  if (status === 'In Review' || status === 'In Progress') return 'border-[#4648d4]/25 bg-[#4648d4]/10 text-[#4648d4]';
  return 'border-[#e29100]/30 bg-[#ffddb8]/70 text-[#653e00]';
}

function riskTone(risk: OperationalRecord['risk']) {
  if (risk === 'High') return 'border-[#ba1a1a]/25 bg-[#ffdad6] text-[#93000a]';
  if (risk === 'Medium') return 'border-[#e29100]/30 bg-[#ffddb8]/70 text-[#653e00]';
  return 'border-[#10b981]/25 bg-[#10b981]/10 text-[#006c49]';
}

function canAdvanceRecordInOperations(record: OperationalRecord): boolean {
  if (record.source !== 'native') return true;
  return record.nativeSource === 'compensation_plans' && record.status === 'Draft';
}

function nextRecordStatus(record: OperationalRecord): OperationalRecord['status'] {
  if (record.source === 'native' && record.nativeSource === 'compensation_plans' && record.status === 'Draft') {
    return 'Active';
  }
  const status = record.status;
  if (status === 'Draft') return 'In Review';
  if (status === 'In Review') return 'Active';
  if (status === 'Blocked') return 'In Review';
  if (status === 'Active') return 'Closed';
  return 'Active';
}

function MetricCard({ label, value, detail, icon: Icon }: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="lumina-accent-strip" />
      <CardContent className="flex min-h-[132px] items-center gap-4 p-5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#10b981]/10 text-[#006c49]">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="lumina-label">{label}</p>
          <p className="mt-1 font-headline text-3xl font-bold text-[#0b1c30]">{value}</p>
          <p className="mt-1 text-sm leading-5 text-[#3c4a42]">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-md border border-[#bbcabf]/70 bg-[#eff4ff] px-2 py-1 text-xs font-medium text-[#3c4a42]">
          {item}
        </span>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#bbcabf] bg-[#eff4ff]/60 p-8 text-center text-sm text-[#3c4a42]">
      {label}
    </div>
  );
}

export function AdminModuleOperations() {
  const { moduleId } = useParams();
  const module = findCommercialModule(moduleId);
  const queryClient = useQueryClient();
  const [recordStatus, setRecordStatus] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [activityLog, setActivityLog] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (module) {
      setActivityLog([]);
      setRecordStatus('all');
      setSearch('');
    }
  }, [module]);

  const workspaceQuery = useQuery({
    queryKey: ['admin-module-operations', module?.id],
    enabled: Boolean(module),
    queryFn: async () => unwrap<OperationWorkspaceApi>(await apiClient.get(`/admin/module-operations/${module?.id}`)),
  });

  const records = React.useMemo(
    () => (workspaceQuery.data?.records ?? []).map((record) => mapRecord(record)),
    [workspaceQuery.data?.records],
  );
  const queue = React.useMemo(
    () => (workspaceQuery.data?.workflows ?? []).map((workflow) => mapWorkflow(workflow)),
    [workspaceQuery.data?.workflows],
  );
  const profile = React.useMemo(() => (module ? mergeProfile(module) : null), [module]);

  const pushActivity = (message: string) => {
    const timestamp = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date());
    setActivityLog((current) => [`${timestamp} - ${message}`, ...current].slice(0, 5));
  };

  const createRecord = useMutation({
    mutationFn: async (variables: CreateRecordVariables) => {
      if (!module) throw new Error('Module is required');
      const objectType = variables.objectType ?? module.dataObjects[records.length % Math.max(module.dataObjects.length, 1)] ?? 'Operational item';
      const workflowName = variables.workflowName ?? module.keyWorkflows[records.length % Math.max(module.keyWorkflows.length, 1)] ?? variables.action;
      const ownerRole = variables.ownerRole ?? module.personas[records.length % Math.max(module.personas.length, 1)] ?? 'HR Admin';
      return unwrap<OperationRecordApi>(await apiClient.post(`/admin/module-operations/${module.id}/records`, {
        objectType,
        ownerRole,
        workflowName,
        status: variables.status ?? 'In Review',
        risk: variables.risk ?? 'Medium',
        lastEvent: variables.lastEvent ?? `${variables.action} requested`,
        payload: {
          source: 'admin-module-operations',
          action: variables.action,
          category: module.category,
          backendRoot: module.backendRoot,
          ...(typeof variables.payload === 'object' && variables.payload !== null ? variables.payload : {}),
        },
      }));
    },
    onSuccess: (_record, variables) => {
      if (module) {
        queryClient.invalidateQueries({ queryKey: ['admin-module-operations', module.id] });
      }
      pushActivity(`${variables.action} persisted`);
    },
    onError: (error, variables) => {
      pushActivity(`${variables.action} failed: ${mutationErrorMessage(error)}`);
    },
  });

  const updateRecord = useMutation({
    mutationFn: async (variables: UpdateRecordVariables) => {
      if (!module) throw new Error('Module is required');
      return unwrap<OperationRecordApi>(await apiClient.patch(`/admin/module-operations/${module.id}/records/${variables.record.id}`, {
        status: variables.status ?? nextRecordStatus(variables.record),
        lastEvent: variables.lastEvent ?? `${variables.record.object} status advanced`,
      }));
    },
    onSuccess: (_record, variables) => {
      if (module) {
        queryClient.invalidateQueries({ queryKey: ['admin-module-operations', module.id] });
      }
      pushActivity(`${variables.record.object} updated`);
    },
    onError: (error, variables) => {
      pushActivity(`${variables.record.object} update failed: ${mutationErrorMessage(error)}`);
    },
  });

  const syncWorkflows = useMutation({
    mutationFn: async () => {
      if (!module) throw new Error('Module is required');
      const slaTargets = ['2h', '4h', '1d', '3d'];
      return Promise.all(module.keyWorkflows.map(async (workflowName, index) => (
        unwrap<OperationWorkflowApi>(await apiClient.post(`/admin/module-operations/${module.id}/workflows`, {
          workflowName,
          ownerRole: module.personas[(index + 1) % Math.max(module.personas.length, 1)] ?? 'HR Admin',
          state: 'Queued',
          slaTarget: slaTargets[index % slaTargets.length],
          lastEvent: 'Workflow blueprint synced',
          payload: {
            source: 'admin-module-operations',
            category: module.category,
            backendRoot: module.backendRoot,
          },
        }))
      )));
    },
    onSuccess: () => {
      if (module) {
        queryClient.invalidateQueries({ queryKey: ['admin-module-operations', module.id] });
      }
      pushActivity('Workflow blueprint synced');
    },
    onError: (error) => {
      pushActivity(`Workflow sync failed: ${mutationErrorMessage(error)}`);
    },
  });

  const updateWorkflow = useMutation({
    mutationFn: async (variables: UpdateWorkflowVariables) => {
      if (!module) throw new Error('Module is required');
      const nextState = variables.state ?? (variables.workflow.state === 'Ready' ? 'Queued' : 'Ready');
      return unwrap<OperationWorkflowApi>(await apiClient.patch(`/admin/module-operations/${module.id}/workflows/${variables.workflow.id}`, {
        state: nextState,
        lastEvent: variables.lastEvent ?? `${variables.workflow.workflow} advanced`,
      }));
    },
    onSuccess: (_workflow, variables) => {
      if (module) {
        queryClient.invalidateQueries({ queryKey: ['admin-module-operations', module.id] });
      }
      pushActivity(`${variables.workflow.workflow} updated`);
    },
    onError: (error, variables) => {
      pushActivity(`${variables.workflow.workflow} update failed: ${mutationErrorMessage(error)}`);
    },
  });

  if (!module || !profile) {
    return <Navigate to="/admin/modules" replace />;
  }

  const filteredRecords = records.filter((record) => {
    const matchesStatus = recordStatus === 'all' || record.status === recordStatus;
    const matchesSearch = [record.id, record.object, record.owner, record.workflow, record.lastEvent, record.source, record.nativeSource, record.nativeId, record.nativeRoute]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const blockedCount = records.filter((record) => record.status === 'Blocked').length;
  const eventTriggers = domainOverrides[module.id]?.eventTriggers ?? profile.eventTriggers ?? defaultEventTriggers;
  const integrationPoints = domainOverrides[module.id]?.integrationPoints ?? profile.integrationPoints ?? defaultIntegrationPoints;
  const sensitiveControls = profile.sensitiveControls.length > 0 ? profile.sensitiveControls : module.governance;

  const advanceFirstQueueItem = () => {
    const [firstWorkflow] = queue;
    if (!firstWorkflow) {
      syncWorkflows.mutate();
      return;
    }
    updateWorkflow.mutate({ workflow: firstWorkflow });
  };

  return (
    <div className="min-h-full bg-[#f8f9ff]">
      <div className="lumina-canvas space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/modules">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to module catalog
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            {profile.employeePath ? (
              <Button asChild variant="outline" size="sm">
                <Link to={profile.employeePath}>Open Employee Experience</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/modules/${module.id}`}>Open Module Workbench</Link>
            </Button>
          </div>
        </div>

        <section className="lumina-panel overflow-hidden">
          <div className="grid gap-5 border-b border-[#bbcabf] bg-[#006c49] p-6 text-white lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-white/40 bg-white/10 font-mono text-xs uppercase tracking-wider text-white">
                  {module.category}
                </Badge>
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#6ffbbe]">
                  {module.backendRoot}
                </span>
              </div>
              <h2 className="mt-3 font-headline text-3xl font-bold">{module.label} Operations</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/85">{profile.cockpitSummary}</p>
            </div>
            <div className="flex flex-col gap-2 lg:items-end lg:justify-end">
              <Button
                className="bg-white text-[#006c49] hover:bg-[#eff4ff]"
                disabled={createRecord.isPending}
                onClick={() => createRecord.mutate({ action: profile.primaryAction, lastEvent: `${profile.primaryAction} staged` })}
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                {profile.primaryAction}
              </Button>
              <Button
                variant="outline"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                disabled={syncWorkflows.isPending || updateWorkflow.isPending}
                onClick={advanceFirstQueueItem}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                {queue.length > 0 ? profile.secondaryAction : 'Sync Workflows'}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 bg-white p-5 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Live Records" value={records.length} detail="Persisted operational records in this workspace" icon={Database} />
            <MetricCard label="Live Workflows" value={queue.length} detail="Persisted business flows with visible ownership" icon={Workflow} />
            <MetricCard label="Blocked Items" value={blockedCount} detail="Records needing policy or manager action" icon={ShieldCheck} />
            <MetricCard label="Event Hooks" value={eventTriggers.length} detail="Notification and audit triggers represented" icon={BellRing} />
          </div>
        </section>

        <Tabs defaultValue="command" className="space-y-4">
          <TabsList className="flex w-full justify-start overflow-x-auto">
            <TabsTrigger value="command">Command Center</TabsTrigger>
            <TabsTrigger value="records">Records</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="governance">Governance</TabsTrigger>
            <TabsTrigger value="wiring">Wiring</TabsTrigger>
          </TabsList>

          <TabsContent value="command" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
              <Card>
                <CardHeader>
                  <CardTitle>{profile.cockpitTitle}</CardTitle>
                  <CardDescription>Module actions are grouped around the same records, workflows, controls, and events used by the backend domain.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {profile.adminActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="rounded-lg border border-[#bbcabf] bg-white p-4 text-left transition-colors hover:border-[#006c49]/50 hover:bg-[#eff4ff]"
                      disabled={createRecord.isPending}
                      onClick={() => createRecord.mutate({
                        action,
                        workflowName: action,
                        lastEvent: `${action} queued`,
                        payload: { commandSource: 'command-center' },
                      })}
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#006c49]" />
                        <div>
                          <p className="font-semibold text-[#0b1c30]">{action}</p>
                          <p className="mt-1 text-sm leading-5 text-[#3c4a42]">Creates an auditable operational checkpoint for {module.label.toLowerCase()}.</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Activity Feed</CardTitle>
                  <CardDescription>Visible proof that the workspace actions are writing through the backend API.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activityLog.length > 0 ? (
                    activityLog.map((item) => (
                      <div key={item} className="rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-3 text-sm text-[#3c4a42]">
                        {item}
                      </div>
                    ))
                  ) : (
                    <EmptyState label="No actions staged yet. Use a command action to create an audit-visible checkpoint." />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="records" className="space-y-4">
            <Card>
              <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
                <div>
                  <CardTitle>Operational Records</CardTitle>
                  <CardDescription>Persisted module objects, owners, workflow state, and latest business event.</CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6c7a71]" />
                    <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" />
                  </div>
                  <Select value={recordStatus} onValueChange={setRecordStatus}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="In Review">In Review</SelectItem>
                      <SelectItem value="Blocked">Blocked</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Record</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Last Event</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => {
                      const canAdvance = canAdvanceRecordInOperations(record);
                      return (
                        <TableRow key={record.id}>
                          <TableCell>
                            <p className="font-mono text-xs font-semibold text-[#006c49]">{record.id}</p>
                            <p className="font-semibold text-[#0b1c30]">{record.object}</p>
                            {record.source || record.nativeSource ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {record.source ? (
                                  <Badge variant="outline" className="border-[#bbcabf] bg-[#eff4ff] text-[10px] uppercase tracking-wider text-[#3c4a42]">
                                    {record.source}
                                  </Badge>
                                ) : null}
                                {record.nativeSource ? (
                                  <Badge variant="outline" className="border-[#10b981]/25 bg-[#10b981]/10 text-[10px] uppercase tracking-wider text-[#006c49]">
                                    {record.nativeSource}
                                  </Badge>
                                ) : null}
                              </div>
                            ) : null}
                            {record.nativeId ? <p className="mt-1 font-mono text-[11px] text-[#6c7a71]">Native: {record.nativeId}</p> : null}
                          </TableCell>
                          <TableCell>{record.owner}</TableCell>
                          <TableCell className="max-w-[320px] text-[#3c4a42]">{record.workflow}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('border', statusTone(record.status))}>{record.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('border', riskTone(record.risk))}>{record.risk}</Badge>
                          </TableCell>
                          <TableCell className="text-[#3c4a42]">{record.lastEvent}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateRecord.isPending || !canAdvance}
                              title={canAdvance ? 'Advance through operations command mapping' : 'Edit this native record in its native module workspace'}
                              onClick={() => updateRecord.mutate({ record })}
                            >
                              {canAdvance ? 'Advance' : 'Native Only'}
                            </Button>
                            {record.nativeRoute ? (
                              <Button asChild size="sm" variant="ghost" className="ml-2">
                                <Link to={record.nativeRoute}>
                                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                  Native
                                </Link>
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {workspaceQuery.isLoading ? <EmptyState label="Loading persisted operation records..." /> : null}
                {!workspaceQuery.isLoading && filteredRecords.length === 0 ? (
                  <div className="space-y-3">
                    <EmptyState label="No persisted operation records yet. Create an operation from the command center to store the first live record." />
                    <Button
                      type="button"
                      disabled={createRecord.isPending}
                      onClick={() => createRecord.mutate({ action: profile.primaryAction, lastEvent: `${profile.primaryAction} staged` })}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Create First Record
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflows" className="grid gap-4 xl:grid-cols-[1fr_24rem]">
            <Card>
              <CardHeader>
                <CardTitle>Workflow Queue</CardTitle>
                <CardDescription>Every commercial workflow has an owner, state, SLA marker, and visible next action.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {queue.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-lg border border-[#bbcabf]/70 bg-white p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                    <div>
                      <p className="font-semibold text-[#0b1c30]">{item.workflow}</p>
                      <p className="mt-1 text-sm text-[#3c4a42]">Owner: {item.owner}</p>
                      <p className="mt-1 text-xs text-[#6c7a71]">{item.lastEvent}</p>
                    </div>
                    <Badge variant="outline" className={cn('w-fit border', statusTone(item.state))}>{item.state}</Badge>
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#3c4a42]">SLA {item.sla}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateWorkflow.isPending}
                      onClick={() => updateWorkflow.mutate({ workflow: item })}
                    >
                      Advance
                    </Button>
                  </div>
                ))}
                {workspaceQuery.isLoading ? <EmptyState label="Loading persisted workflow queue..." /> : null}
                {!workspaceQuery.isLoading && queue.length === 0 ? (
                  <div className="space-y-3">
                    <EmptyState label="No persisted workflows yet. Sync this module blueprint to create live workflow rows." />
                    <Button type="button" disabled={syncWorkflows.isPending} onClick={() => syncWorkflows.mutate()}>
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      Sync Workflow Blueprint
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Event Triggers</CardTitle>
                <CardDescription>The notification system can subscribe to these domain moments.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {eventTriggers.map((eventName) => (
                  <div key={eventName} className="flex gap-3 rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-3">
                    <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-[#006c49]" />
                    <span className="text-sm font-medium text-[#0b1c30]">{eventName}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="governance" className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Policy Controls</CardTitle>
                <CardDescription>Controls that keep this module connected to security, approvals, audit, and business rules.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {[...new Set([...module.governance, ...sensitiveControls])].map((control) => (
                  <div key={control} className="rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-4">
                    <LockKeyhole className="mb-3 h-5 w-5 text-[#006c49]" />
                    <p className="font-semibold text-[#0b1c30]">{control}</p>
                    <p className="mt-1 text-sm leading-5 text-[#3c4a42]">Linked to access control, allowed actions, and audit evidence for this domain.</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Personas</CardTitle>
                <CardDescription>Users represented in this operational workflow.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ChipList items={module.personas} />
                <div className="rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-4">
                  <Users className="mb-3 h-5 w-5 text-[#006c49]" />
                  <p className="text-sm leading-6 text-[#3c4a42]">
                    The page intentionally groups actions by persona so HR admin, manager, employee, legal, finance, and specialist work does not feel like separate systems.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wiring" className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Integration Map</CardTitle>
                <CardDescription>Backend and platform connections this module should keep synchronized.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {integrationPoints.map((point, index) => (
                  <div key={point} className="flex items-center gap-3 rounded-lg border border-[#bbcabf]/70 bg-white p-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#10b981]/10 font-mono text-xs font-semibold text-[#006c49]">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium text-[#0b1c30]">{point}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Route and Service Contract</CardTitle>
                <CardDescription>The page is tied to a known backend root and the shared module registry.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-4">
                  <p className="lumina-label">Backend Root</p>
                  <p className="mt-2 font-mono text-sm font-semibold text-[#0b1c30]">{module.backendRoot}</p>
                </div>
                <div className="rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-4">
                  <p className="lumina-label">Admin Route</p>
                  <p className="mt-2 font-mono text-sm font-semibold text-[#0b1c30]">/admin/modules/{module.id}/operations</p>
                </div>
                <div className="rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Route className="h-4 w-4 text-[#006c49]" />
                    <p className="font-semibold text-[#0b1c30]">Business objects</p>
                  </div>
                  <ChipList items={module.dataObjects} />
                </div>
                <div className="rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-[#006c49]" />
                    <p className="font-semibold text-[#0b1c30]">Nervous system events</p>
                  </div>
                  <ChipList items={eventTriggers} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
