import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  GitBranch,
  LockKeyhole,
  PlayCircle,
  Route,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Users,
  Workflow,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { StatTile } from '@/components/ui/stat-tile';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';
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
  payload?: unknown;
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

type GovernanceControl = {
  id: string;
  name: string;
  type: string;
  owner: string;
  status: 'Draft' | 'In Review' | 'Approved' | 'Applied';
  lastEvent: string;
};

type OperationControlApi = {
  id: string;
  controlName: string;
  controlType: string;
  ownerRole: string;
  status: GovernanceControl['status'];
  lastEvent: string;
  payload?: unknown;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
};

type ModuleDepthCapabilityApi = {
  code: 'records' | 'workflows' | 'nativeWiring' | 'ownership' | 'riskControls' | 'governanceControls';
  label: string;
  status: 'Ready' | 'Needs Work' | 'Blocked';
  evidence: string;
};

type ModuleDepthApi = {
  score: number;
  status: 'Ready' | 'Needs Work' | 'Blocked';
  capabilities: ModuleDepthCapabilityApi[];
  blockers: string[];
  nextActions: string[];
};

type OperationWorkspaceApi = {
  moduleId: string;
  records: OperationRecordApi[];
  workflows: OperationWorkflowApi[];
  controls?: OperationControlApi[];
  moduleDepth?: ModuleDepthApi;
};

type OperationImportRow = {
  objectType?: string;
  ownerRole?: string;
  workflowName?: string;
  status?: OperationalRecord['status'];
  risk?: OperationalRecord['risk'];
  lastEvent?: string;
  payload?: unknown;
};

type OperationImportPreview = {
  accepted: boolean;
  rowCount: number;
  errors: Array<{ row: number; field: string; message: string }>;
  events?: string[];
};

type OperationImportApplyResult = OperationImportPreview & {
  createdCount: number;
  created: OperationRecordApi[];
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
  operationAction?: NativeRecordAction;
  lastEvent?: string;
};

type UpdateWorkflowVariables = {
  workflow: WorkflowItem;
  state?: WorkflowItem['state'];
  lastEvent?: string;
};

type UpdateControlVariables = {
  control: GovernanceControl;
  ownerRole: string;
};

type AdvanceControlVariables = {
  control: GovernanceControl;
};

type NativeRecordAction = 'advance' | 'approve' | 'process' | 'make-effective' | 'terminate' | 'reject';

type RecordAction = {
  label: string;
  status: OperationalRecord['status'];
  lastEvent: string;
  title: string;
  operationAction?: NativeRecordAction;
  variant?: 'default' | 'outline';
  className?: string;
  Icon: React.ComponentType<{ className?: string }>;
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsvTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    const next = text.charAt(index + 1);

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      row.push(cell);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      cell = '';
      if (char === '\r' && next === '\n') index += 1;
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);
  return rows;
}

function parseOperationsCsv(text: string): OperationImportRow[] {
  const [headers = [], ...rows] = parseCsvTable(text);
  const normalizedHeaders = headers.map((item) => item.trim());
  if (normalizedHeaders.length === 0) return [];
  return rows.map((values) => normalizedHeaders.reduce<OperationImportRow>((row, header, index) => {
    const value = values[index]?.trim();
    if (!value) return row;
    if (header === 'payload') {
      try {
        return { ...row, payload: JSON.parse(value) as unknown };
      } catch {
        return { ...row, payload: value };
      }
    }
    return { ...row, [header]: value };
  }, {}));
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
    payload: record.payload,
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

function mapControl(control: OperationControlApi): GovernanceControl {
  return {
    id: control.id,
    name: control.controlName,
    type: control.controlType,
    owner: control.ownerRole,
    status: control.status,
    lastEvent: control.lastEvent,
  };
}

function statusTone(status: OperationalRecord['status'] | WorkflowItem['state']) {
  if (status === 'Blocked' || status === 'Needs Approval') return 'border-destructive/25 bg-destructive/10 text-destructive-foreground';
  if (status === 'Ready' || status === 'Active' || status === 'Closed') return 'border-secondary/25 bg-secondary/10 text-primary';
  if (status === 'In Review' || status === 'In Progress') return 'border-primary/25 bg-primary/10 text-primary';
  return 'border-warning/30 bg-warning/70 text-warning-foreground';
}

function riskTone(risk: OperationalRecord['risk']) {
  if (risk === 'High') return 'border-destructive/25 bg-destructive/10 text-destructive-foreground';
  if (risk === 'Medium') return 'border-warning/30 bg-warning/70 text-warning-foreground';
  return 'border-secondary/25 bg-secondary/10 text-primary';
}

function controlTone(status: GovernanceControl['status']) {
  if (status === 'Applied') return 'border-secondary/25 bg-secondary/10 text-primary';
  if (status === 'Approved') return 'border-primary/25 bg-primary/10 text-primary';
  if (status === 'In Review') return 'border-warning/30 bg-warning/70 text-warning-foreground';
  return 'border-border bg-white text-muted-foreground';
}

function nextControlAction(control: GovernanceControl): { label: string; command: string } | undefined {
  if (control.status === 'Draft') return { label: 'Submit Review', command: 'submit-review' };
  if (control.status === 'In Review') return { label: 'Approve', command: 'approve' };
  if (control.status === 'Approved') return { label: 'Apply', command: 'apply' };
  return undefined;
}

function readinessTone(status: ModuleDepthApi['status'] | ModuleDepthCapabilityApi['status']) {
  if (status === 'Blocked') return 'border-destructive/25 bg-destructive/10 text-destructive-foreground';
  if (status === 'Needs Work') return 'border-warning/30 bg-warning/70 text-warning-foreground';
  return 'border-secondary/25 bg-secondary/10 text-primary';
}

function nextRecordStatus(record: OperationalRecord): OperationalRecord['status'] {
  if (record.source === 'native' && record.nativeSource === 'compensation_plans' && record.status === 'Draft') {
    return 'Active';
  }
  if (record.source === 'native' && record.nativeSource === 'benefits_enrollments') {
    if (record.status === 'In Review') return 'Active';
    if (record.status === 'Active') return 'Closed';
  }
  if (record.source === 'native' && record.nativeSource === 'benefits_life_events' && (record.status === 'In Review' || record.status === 'Active')) {
    return 'Closed';
  }
  const status = record.status;
  if (status === 'Draft') return 'In Review';
  if (status === 'In Review') return 'Active';
  if (status === 'Blocked') return 'In Review';
  if (status === 'Active') return 'Closed';
  return 'Active';
}

function nativeStatusValue(record: OperationalRecord): string | undefined {
  if (!record.payload || typeof record.payload !== 'object' || Array.isArray(record.payload)) return undefined;
  const status = (record.payload as { nativeStatus?: unknown }).nativeStatus;
  return typeof status === 'string' ? status.toUpperCase() : undefined;
}

function recordActionsForOperations(record: OperationalRecord): RecordAction[] {
  if (record.source === 'native') {
    if (record.nativeSource === 'compensation_plans' && record.status === 'Draft') {
      return [{
        label: 'Advance',
        status: 'Active',
        lastEvent: `${record.object} status advanced`,
        title: 'Advance through operations command mapping',
        Icon: CheckCircle2,
      }];
    }

    if (record.nativeSource === 'benefits_enrollments') {
      const nativeStatus = nativeStatusValue(record);
      if (record.status === 'In Review') {
        return [
          {
            label: 'Approve',
            status: 'Active',
            operationAction: 'approve',
            lastEvent: `${record.object} approved`,
            title: 'Approve benefits enrollment',
            Icon: CheckCircle2,
          },
          {
            label: 'Reject',
            status: 'Blocked',
            operationAction: 'reject',
            lastEvent: `${record.object} rejected`,
            title: 'Reject benefits enrollment',
            variant: 'outline',
            className: 'border-destructive bg-destructive/10 text-destructive hover:bg-destructive/10 hover:text-destructive-foreground',
            Icon: XCircle,
          },
        ];
      }
      if (record.status === 'Active' && nativeStatus === 'APPROVED') {
        return [{
          label: 'Make Effective',
          status: 'Active',
          operationAction: 'make-effective',
          lastEvent: `${record.object} made effective`,
          title: 'Make effective benefits enrollment',
          Icon: CheckCircle2,
        }];
      }
      if (record.status === 'Active') {
        return [{
          label: 'Terminate',
          status: 'Closed',
          operationAction: 'terminate',
          lastEvent: `${record.object} terminated`,
          title: 'Terminate benefits enrollment',
          Icon: CheckCircle2,
        }];
      }
      return [];
    }

    if (record.nativeSource === 'benefits_life_events' && (record.status === 'In Review' || record.status === 'Active')) {
      return [
        {
          label: 'Process',
          status: 'Closed',
          operationAction: 'process',
          lastEvent: `${record.object} processed`,
          title: 'Process benefits life event',
          Icon: CheckCircle2,
        },
        {
          label: 'Reject',
          status: 'Blocked',
          operationAction: 'reject',
          lastEvent: `${record.object} rejected`,
          title: 'Reject benefits life event',
          variant: 'outline',
          className: 'border-destructive bg-destructive/10 text-destructive hover:bg-destructive/10 hover:text-destructive-foreground',
          Icon: XCircle,
        },
      ];
    }

    return [];
  }

  return [{
    label: 'Advance',
    status: nextRecordStatus(record),
    lastEvent: `${record.object} status advanced`,
    title: 'Advance through operations status flow',
    Icon: CheckCircle2,
  }];
}

function ChipList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-md border border-border/70 bg-accent px-2 py-1 text-xs font-medium text-muted-foreground">
          {item}
        </span>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="fusion-glass rounded-2xl border-dashed p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function AdminModuleOperations() {
  const { moduleId } = useParams();
  const module = findCommercialModule(moduleId);
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const [recordStatus, setRecordStatus] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [activityLog, setActivityLog] = React.useState<string[]>([]);
  const [importRows, setImportRows] = React.useState<OperationImportRow[]>([]);
  const [importPreview, setImportPreview] = React.useState<OperationImportPreview | null>(null);
  const [importApplyResult, setImportApplyResult] = React.useState<OperationImportApplyResult | null>(null);
  const [showRecordDiagnostics, setShowRecordDiagnostics] = React.useState(false);

  React.useEffect(() => {
    if (module) {
      setActivityLog([]);
      setRecordStatus('all');
      setSearch('');
      setImportRows([]);
      setImportPreview(null);
      setImportApplyResult(null);
      setShowRecordDiagnostics(false);
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
  const governanceControls = React.useMemo(
    () => (workspaceQuery.data?.controls ?? []).map((control) => mapControl(control)),
    [workspaceQuery.data?.controls],
  );
  const moduleDepth = workspaceQuery.data?.moduleDepth;
  const profile = React.useMemo(() => (module ? mergeProfile(module) : null), [module]);
  const controlBlueprints = React.useMemo(() => {
    if (!module || !profile) return [];
    const names = Array.from(new Set([...module.governance, ...profile.sensitiveControls]));
    return names.map((name) => ({
      name,
      type: name.toLowerCase().includes('approval') ? 'Approval control' : 'Policy control',
    }));
  }, [module, profile]);

  const pushActivity = (message: string) => {
    const timestamp = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date());
    setActivityLog((current) => [`${timestamp} - ${message}`, ...current].slice(0, 5));
  };

  const downloadModuleCsv = async (path: string, filename: string) => {
    try {
      const response = await apiClient.get(path, { responseType: 'blob' });
      downloadBlob(response.data as Blob, filename);
    } catch (error) {
      addNotification({ title: 'Download failed', message: mutationErrorMessage(error), type: 'error', read: false });
    }
  };

  const handleImportUpload = async (file: File | undefined) => {
    if (!file) return;
    const rows = parseOperationsCsv(await file.text());
    setImportRows(rows);
    setImportApplyResult(null);
    importPreviewMutation.mutate(rows);
  };

  const applyImportedRecords = () => {
    if (!importPreview?.accepted || importRows.length === 0) return;
    importApplyMutation.mutate(importRows);
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
      addNotification({ title: 'Operation created', message: `${variables.action} persisted to the workspace.`, type: 'success', read: false });
    },
    onError: (error, variables) => {
      pushActivity(`${variables.action} failed: ${mutationErrorMessage(error)}`);
      addNotification({ title: 'Something went wrong', message: `${variables.action} failed: ${mutationErrorMessage(error)}`, type: 'error', read: false });
    },
  });

  const importPreviewMutation = useMutation({
    mutationFn: async (rows: OperationImportRow[]) => {
      if (!module) throw new Error('Module is required');
      return unwrap<OperationImportPreview>(await apiClient.post(`/admin/module-operations/${module.id}/records/import-preview`, { rows }));
    },
    onSuccess: (result) => {
      setImportPreview(result);
      setImportApplyResult(null);
      addNotification({
        title: result.accepted ? 'Import file validated' : 'Import needs correction',
        message: result.accepted ? `${result.rowCount} records are ready to apply.` : `${result.errors.length} issue(s) need correction.`,
        type: result.accepted ? 'success' : 'warning',
        read: false,
      });
    },
    onError: (error) => {
      addNotification({ title: 'Import validation failed', message: mutationErrorMessage(error), type: 'error', read: false });
    },
  });

  const importApplyMutation = useMutation({
    mutationFn: async (rows: OperationImportRow[]) => {
      if (!module) throw new Error('Module is required');
      return unwrap<OperationImportApplyResult>(await apiClient.post(`/admin/module-operations/${module.id}/records/import-apply`, { rows }));
    },
    onSuccess: (result) => {
      setImportApplyResult(result);
      setImportPreview({ accepted: result.accepted, rowCount: result.rowCount, errors: result.errors, events: result.events });
      if (module) {
        queryClient.invalidateQueries({ queryKey: ['admin-module-operations', module.id] });
      }
      pushActivity(result.accepted ? `${result.createdCount} records imported` : 'Import apply rejected');
      addNotification({
        title: result.accepted ? 'Imported records applied' : 'Import not applied',
        message: result.accepted ? `${result.createdCount} operational records created.` : `${result.errors.length} issue(s) need correction.`,
        type: result.accepted ? 'success' : 'warning',
        read: false,
      });
    },
    onError: (error) => {
      addNotification({ title: 'Import apply failed', message: mutationErrorMessage(error), type: 'error', read: false });
    },
  });

  const updateRecord = useMutation({
    mutationFn: async (variables: UpdateRecordVariables) => {
      if (!module) throw new Error('Module is required');
      const payload: {
        status: OperationalRecord['status'];
        lastEvent: string;
        operationAction?: NativeRecordAction;
      } = {
        status: variables.status ?? nextRecordStatus(variables.record),
        lastEvent: variables.lastEvent ?? `${variables.record.object} status advanced`,
      };
      if (variables.operationAction) {
        payload.operationAction = variables.operationAction;
      }
      return unwrap<OperationRecordApi>(await apiClient.patch(`/admin/module-operations/${module.id}/records/${variables.record.id}`, payload));
    },
    onSuccess: (_record, variables) => {
      if (module) {
        queryClient.invalidateQueries({ queryKey: ['admin-module-operations', module.id] });
      }
      pushActivity(`${variables.record.object} updated`);
      addNotification({ title: 'Record updated', message: `${variables.record.object} status updated.`, type: 'success', read: false });
    },
    onError: (error, variables) => {
      pushActivity(`${variables.record.object} update failed: ${mutationErrorMessage(error)}`);
      addNotification({ title: 'Something went wrong', message: `${variables.record.object} update failed: ${mutationErrorMessage(error)}`, type: 'error', read: false });
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
      addNotification({ title: 'Workflows synced', message: 'Workflow blueprint synced to the workspace.', type: 'success', read: false });
    },
    onError: (error) => {
      pushActivity(`Workflow sync failed: ${mutationErrorMessage(error)}`);
      addNotification({ title: 'Something went wrong', message: `Workflow sync failed: ${mutationErrorMessage(error)}`, type: 'error', read: false });
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
      addNotification({ title: 'Workflow advanced', message: `${variables.workflow.workflow} state updated.`, type: 'success', read: false });
    },
    onError: (error, variables) => {
      pushActivity(`${variables.workflow.workflow} update failed: ${mutationErrorMessage(error)}`);
      addNotification({ title: 'Something went wrong', message: `${variables.workflow.workflow} update failed: ${mutationErrorMessage(error)}`, type: 'error', read: false });
    },
  });

  const syncControls = useMutation({
    mutationFn: async () => {
      if (!module) throw new Error('Module is required');
      const existingNames = new Set(governanceControls.map((control) => control.name));
      const missingControls = controlBlueprints.filter((control) => !existingNames.has(control.name));
      return Promise.all(missingControls.map(async (control) => (
        unwrap<OperationControlApi>(await apiClient.post(`/admin/module-operations/${module.id}/controls`, {
          controlName: control.name,
          controlType: control.type,
          ownerRole: module.personas[0] ?? 'HR Admin',
          lastEvent: 'Control drafted',
          payload: {
            source: 'admin-module-operations',
            category: module.category,
            backendRoot: module.backendRoot,
          },
        }))
      )));
    },
    onSuccess: (created) => {
      if (module) {
        queryClient.invalidateQueries({ queryKey: ['admin-module-operations', module.id] });
      }
      pushActivity(created.length > 0 ? `${created.length} governance controls synced` : 'Governance controls already synced');
      addNotification({
        title: 'Governance controls synced',
        message: created.length > 0 ? `${created.length} controls created for this module.` : 'All expected controls already exist.',
        type: 'success',
        read: false,
      });
    },
    onError: (error) => {
      pushActivity(`Governance control sync failed: ${mutationErrorMessage(error)}`);
      addNotification({ title: 'Something went wrong', message: `Governance control sync failed: ${mutationErrorMessage(error)}`, type: 'error', read: false });
    },
  });

  const updateControlOwner = useMutation({
    mutationFn: async (variables: UpdateControlVariables) => {
      if (!module) throw new Error('Module is required');
      return unwrap<OperationControlApi>(await apiClient.patch(`/admin/module-operations/${module.id}/controls/${variables.control.id}`, {
        ownerRole: variables.ownerRole,
        lastEvent: 'Control owner updated',
      }));
    },
    onSuccess: (_control, variables) => {
      if (module) {
        queryClient.invalidateQueries({ queryKey: ['admin-module-operations', module.id] });
      }
      pushActivity(`${variables.control.name} owner updated`);
      addNotification({ title: 'Control updated', message: `${variables.control.name} owner changed.`, type: 'success', read: false });
    },
    onError: (error, variables) => {
      pushActivity(`${variables.control.name} owner update failed: ${mutationErrorMessage(error)}`);
      addNotification({ title: 'Something went wrong', message: `${variables.control.name} update failed: ${mutationErrorMessage(error)}`, type: 'error', read: false });
    },
  });

  const advanceControl = useMutation({
    mutationFn: async (variables: AdvanceControlVariables) => {
      if (!module) throw new Error('Module is required');
      const action = nextControlAction(variables.control);
      if (!action) return undefined;
      return unwrap<OperationControlApi>(await apiClient.post(`/admin/module-operations/${module.id}/controls/${variables.control.id}/commands/${action.command}`, {}));
    },
    onSuccess: (_control, variables) => {
      if (module) {
        queryClient.invalidateQueries({ queryKey: ['admin-module-operations', module.id] });
      }
      const action = nextControlAction(variables.control);
      pushActivity(`${variables.control.name} ${action?.label.toLowerCase() ?? 'updated'}`);
      addNotification({ title: 'Control advanced', message: `${variables.control.name} moved to the next lifecycle step.`, type: 'success', read: false });
    },
    onError: (error, variables) => {
      pushActivity(`${variables.control.name} lifecycle update failed: ${mutationErrorMessage(error)}`);
      addNotification({ title: 'Something went wrong', message: `${variables.control.name} lifecycle update failed: ${mutationErrorMessage(error)}`, type: 'error', read: false });
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

  const advanceFirstQueueItem = () => {
    const [firstWorkflow] = queue;
    if (!firstWorkflow) {
      syncWorkflows.mutate();
      return;
    }
    updateWorkflow.mutate({ workflow: firstWorkflow });
  };

  return (
    <div className="min-h-full">
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

        <section className="fusion-glass rounded-[2rem] overflow-hidden">
          <div className="grid gap-5 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500 p-6 text-white lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-white/40 bg-white/10 font-mono text-xs uppercase tracking-wider text-white">
                  {module.category}
                </Badge>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Operations workspace
                </span>
              </div>
              <h2 className="mt-3 font-headline text-3xl font-bold">{module.label} Operations</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/85">{profile.cockpitSummary}</p>
            </div>
            <div className="flex flex-col gap-2 lg:items-end lg:justify-end">
              <Button
                className="bg-white text-primary hover:bg-accent"
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

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={Database}
              iconPosition="leading"
              variant="card"
              topAccent
              label="Live Records"
              value={records.length}
              helperText="Persisted operational records in this workspace"
              className="fusion-glass fusion-hover"
              contentClassName="min-h-[132px] p-5"
              iconBoxClassName="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary/10 text-primary"
              labelClassName="lumina-label"
              valueClassName="font-headline text-3xl font-bold text-foreground"
              helperClassName="mt-1 text-sm leading-5 text-muted-foreground"
            />
            <StatTile
              icon={Workflow}
              iconPosition="leading"
              variant="card"
              topAccent
              label="Live Workflows"
              value={queue.length}
              helperText="Persisted business flows with visible ownership"
              className="fusion-glass fusion-hover"
              contentClassName="min-h-[132px] p-5"
              iconBoxClassName="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary/10 text-primary"
              labelClassName="lumina-label"
              valueClassName="font-headline text-3xl font-bold text-foreground"
              helperClassName="mt-1 text-sm leading-5 text-muted-foreground"
            />
            <StatTile
              icon={ShieldCheck}
              iconPosition="leading"
              variant="card"
              topAccent
              label="Blocked Items"
              value={blockedCount}
              helperText="Records needing policy or manager action"
              className="fusion-glass fusion-hover"
              contentClassName="min-h-[132px] p-5"
              iconBoxClassName="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary/10 text-primary"
              labelClassName="lumina-label"
              valueClassName="font-headline text-3xl font-bold text-foreground"
              helperClassName="mt-1 text-sm leading-5 text-muted-foreground"
            />
            <StatTile
              icon={BellRing}
              iconPosition="leading"
              variant="card"
              topAccent
              label="Event Hooks"
              value={eventTriggers.length}
              helperText="Notification and audit triggers represented"
              className="fusion-glass fusion-hover"
              contentClassName="min-h-[132px] p-5"
              iconBoxClassName="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary/10 text-primary"
              labelClassName="lumina-label"
              valueClassName="font-headline text-3xl font-bold text-foreground"
              helperClassName="mt-1 text-sm leading-5 text-muted-foreground"
            />
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
              <Card className="border-transparent fusion-glass rounded-2xl">
                <CardHeader>
                  <CardTitle>{profile.cockpitTitle}</CardTitle>
                  <CardDescription>Module actions are grouped around the same records, workflows, controls, and events used by the backend domain.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {profile.adminActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="fusion-glass rounded-2xl p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent"
                      disabled={createRecord.isPending}
                      onClick={() => createRecord.mutate({
                        action,
                        workflowName: action,
                        lastEvent: `${action} queued`,
                        payload: { commandSource: 'command-center' },
                      })}
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <div>
                          <p className="font-semibold text-foreground">{action}</p>
                          <p className="mt-1 text-sm leading-5 text-muted-foreground">Creates an auditable operational checkpoint for {module.label.toLowerCase()}.</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-transparent fusion-glass rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-xl">Activity Feed</CardTitle>
                  <CardDescription>Visible proof that the workspace actions are writing through the backend API.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activityLog.length > 0 ? (
                    activityLog.map((item) => (
                      <div key={item} className="rounded-lg border border-border/70 bg-accent p-3 text-sm text-muted-foreground">
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
            <Card className="border-transparent fusion-glass rounded-[2rem]">
              <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
                <div>
                  <CardTitle>Operational Records</CardTitle>
                  <CardDescription>Persisted module objects, owners, workflow state, and latest business event.</CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" aria-label="Search operational records" />
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadModuleCsv(`/admin/module-operations/${module.id}/records/export.csv`, `${module.id}-records.csv`)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadModuleCsv(`/admin/module-operations/${module.id}/records/import-template.csv`, `${module.id}-import-template.csv`)}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Template
                  </Button>
                  <label className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload CSV
                    <Input className="hidden" type="file" accept=".csv,text/csv" aria-label="Upload module operation CSV" onChange={(event) => handleImportUpload(event.target.files?.[0])} />
                  </label>
                </div>
              </CardHeader>
              <CardContent>
                {workspaceQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : workspaceQuery.isError ? (
                  <ErrorState error={workspaceQuery.error} onRetry={() => workspaceQuery.refetch()} />
                ) : (
                <>
                {importPreview ? (
                  <div className="mb-4 rounded-2xl border border-border bg-white/70 p-4 text-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <Badge variant="outline" className={cn('border', importPreview.accepted ? 'border-secondary/25 bg-secondary/10 text-primary' : 'border-destructive/25 bg-destructive/10 text-destructive-foreground')}>
                        {importApplyResult?.accepted
                          ? `${importApplyResult.createdCount} records applied`
                          : importPreview.accepted
                            ? `${importPreview.rowCount} records validated`
                            : `${importPreview.errors.length} validation issues`}
                      </Badge>
                      {importPreview.accepted && !importApplyResult?.accepted ? (
                        <Button size="sm" onClick={applyImportedRecords} disabled={importApplyMutation.isPending || importRows.length === 0}>
                          {importApplyMutation.isPending ? 'Applying...' : 'Apply Imported Records'}
                        </Button>
                      ) : null}
                    </div>
                    {importPreview.errors.length > 0 ? (
                      <div className="mt-3 space-y-1 text-destructive-foreground">
                        {importPreview.errors.slice(0, 6).map((error) => (
                          <p key={`${error.row}-${error.field}-${error.message}`}>Row {error.row}: {error.field} - {error.message}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="overflow-x-auto">
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
                      const actions = recordActionsForOperations(record);
                      return (
                        <TableRow key={record.id}>
                          <TableCell>
                            <p className="font-semibold text-foreground">{record.object}</p>
                            {record.source || record.nativeSource ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {record.source ? (
                                  <Badge variant="outline" className="border-border bg-accent text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Source managed
                                  </Badge>
                                ) : null}
                                {record.nativeSource ? (
                                  <Badge variant="outline" className="border-secondary/25 bg-secondary/10 text-[10px] uppercase tracking-wider text-primary">
                                    Linked workspace
                                  </Badge>
                                ) : null}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>{record.owner}</TableCell>
                          <TableCell className="max-w-[320px] text-muted-foreground">{record.workflow}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('border', statusTone(record.status))}>{record.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('border', riskTone(record.risk))}>{record.risk}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{record.lastEvent}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {actions.length > 0 ? actions.map((action) => (
                                <Button
                                  key={`${record.id}-${action.label}`}
                                  size="sm"
                                  variant={action.variant ?? 'outline'}
                                  className={action.className}
                                  disabled={updateRecord.isPending}
                                  title={action.title}
                                  onClick={() => updateRecord.mutate({
                                    record,
                                    status: action.status,
                                    operationAction: action.operationAction,
                                    lastEvent: action.lastEvent,
                                  })}
                                >
                                  <action.Icon className="mr-1 h-3.5 w-3.5" />
                                  {action.label}
                                </Button>
                              )) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled
                                  title="Edit this native record in its native module workspace"
                                >
                                  Source Workspace
                                </Button>
                              )}
                              {record.nativeRoute ? (
                                <Button asChild size="sm" variant="ghost">
                                  <Link to={record.nativeRoute}>
                                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                    Source
                                  </Link>
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
                {filteredRecords.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-border bg-white/70 p-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRecordDiagnostics((current) => !current)}
                    >
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      Advanced Diagnostics
                    </Button>
                    {showRecordDiagnostics ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {filteredRecords.map((record) => (
                          <div key={`${record.id}-diagnostics`} className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
                            <p className="font-semibold text-foreground">{record.object}</p>
                            <p className="mt-2 font-mono">Record ID: <span>{record.id}</span></p>
                            {record.nativeId ? <p className="font-mono">Native ID: <span>{record.nativeId}</span></p> : null}
                            {record.nativeSource ? <p className="font-mono">Native source: {record.nativeSource}</p> : null}
                            {record.nativeRoute ? <p className="font-mono">Native route: {record.nativeRoute}</p> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {filteredRecords.length === 0 ? (
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
                </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflows" className="grid gap-4 xl:grid-cols-[1fr_24rem]">
            <Card className="border-transparent fusion-glass rounded-2xl">
              <CardHeader>
                <CardTitle>Workflow Queue</CardTitle>
                <CardDescription>Every commercial workflow has an owner, state, SLA marker, and visible next action.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {workspaceQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : workspaceQuery.isError ? (
                  <ErrorState error={workspaceQuery.error} onRetry={() => workspaceQuery.refetch()} />
                ) : (
                <>
                {queue.map((item) => (
                  <div key={item.id} className="grid gap-3 fusion-glass rounded-2xl p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                    <div>
                      <p className="font-semibold text-foreground">{item.workflow}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Owner: {item.owner}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.lastEvent}</p>
                    </div>
                    <Badge variant="outline" className={cn('w-fit border', statusTone(item.state))}>{item.state}</Badge>
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">SLA {item.sla}</span>
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
                {queue.length === 0 ? (
                  <div className="space-y-3">
                    <EmptyState label="No persisted workflows yet. Sync this module blueprint to create live workflow rows." />
                    <Button type="button" disabled={syncWorkflows.isPending} onClick={() => syncWorkflows.mutate()}>
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      Sync Workflow Blueprint
                    </Button>
                  </div>
                ) : null}
                </>
                )}
              </CardContent>
            </Card>

            <Card className="border-transparent fusion-glass rounded-2xl">
              <CardHeader>
                <CardTitle className="text-xl">Event Triggers</CardTitle>
                <CardDescription>The notification system can subscribe to these domain moments.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {eventTriggers.map((eventName) => (
                  <div key={eventName} className="flex gap-3 rounded-lg border border-border/70 bg-accent p-3">
                    <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm font-medium text-foreground">{eventName}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="governance" className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2 border-transparent fusion-glass rounded-2xl">
              <CardHeader className="gap-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
                <div>
                  <CardTitle>Governance Controls</CardTitle>
                  <CardDescription>Create, assign, approve, and apply the controls protecting this module.</CardDescription>
                </div>
                <Button type="button" disabled={syncControls.isPending} onClick={() => syncControls.mutate()}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Sync Controls
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {governanceControls.length === 0 ? (
                  <EmptyState label="No governance controls are active for this module yet. Sync controls to start the review and apply flow." />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {governanceControls.map((control) => {
                      const action = nextControlAction(control);
                      return (
                        <div key={control.id} className="rounded-lg border border-border/70 bg-accent p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <LockKeyhole className="mb-3 h-5 w-5 text-primary" />
                              <p className="font-semibold text-foreground">{control.name}</p>
                              <p className="mt-1 text-sm leading-5 text-muted-foreground">{control.type}</p>
                            </div>
                            <Badge variant="outline" className={cn('border', controlTone(control.status))}>
                              {control.status}
                            </Badge>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Owner</p>
                              <Select
                                value={control.owner}
                                onValueChange={(ownerRole) => updateControlOwner.mutate({ control, ownerRole })}
                                disabled={updateControlOwner.isPending || control.status === 'Applied'}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Owner" />
                                </SelectTrigger>
                                <SelectContent>
                                  {module.personas.map((persona) => (
                                    <SelectItem key={persona} value={persona}>{persona}</SelectItem>
                                  ))}
                                  <SelectItem value="HR Admin">HR Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              size="sm"
                              variant={action?.command === 'apply' ? 'default' : 'outline'}
                              disabled={!action || advanceControl.isPending}
                              onClick={() => advanceControl.mutate({ control })}
                            >
                              {action?.label ?? 'Applied'}
                            </Button>
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">{control.lastEvent}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-transparent fusion-glass rounded-2xl">
              <CardHeader>
                <CardTitle className="text-xl">Personas</CardTitle>
                <CardDescription>Users represented in this operational workflow.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ChipList items={module.personas} />
                <div className="rounded-lg border border-border/70 bg-accent p-4">
                  <Users className="mb-3 h-5 w-5 text-primary" />
                  <p className="text-sm leading-6 text-muted-foreground">
                    The page intentionally groups actions by persona so HR admin, manager, employee, legal, finance, and specialist work does not feel like separate systems.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wiring" className="grid gap-4 xl:grid-cols-2">
            <Card className="xl:col-span-2 border-transparent fusion-glass rounded-2xl">
              <CardHeader className="gap-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
                <div>
                  <CardTitle>Module Readiness</CardTitle>
                  <CardDescription>Records, workflows, ownership, native links, and open risks from the live operations workspace.</CardDescription>
                </div>
                {moduleDepth ? (
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={cn('border px-3 py-1', readinessTone(moduleDepth.status))}>
                      {moduleDepth.status}
                    </Badge>
                    <div className="text-right">
                      <p className="lumina-label">Readiness</p>
                      <p className="font-headline text-2xl font-bold text-foreground">{moduleDepth.score}%</p>
                    </div>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {workspaceQuery.isLoading ? (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : moduleDepth ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      {moduleDepth.capabilities.map((capability) => (
                        <div key={capability.code} className="rounded-lg border border-border/70 bg-white/70 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-foreground">{capability.label}</p>
                            <Badge variant="outline" className={cn('border', readinessTone(capability.status))}>
                              {capability.status}
                            </Badge>
                          </div>
                          <p className="mt-3 text-sm leading-5 text-muted-foreground">{capability.evidence}</p>
                        </div>
                      ))}
                    </div>
                    {moduleDepth.blockers.length > 0 || moduleDepth.nextActions.length > 0 ? (
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-lg border border-border/70 bg-accent p-4">
                          <p className="font-semibold text-foreground">Blockers</p>
                          {moduleDepth.blockers.length > 0 ? (
                            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                              {moduleDepth.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                            </ul>
                          ) : (
                            <p className="mt-3 text-sm text-muted-foreground">No hard blockers are open.</p>
                          )}
                        </div>
                        <div className="rounded-lg border border-border/70 bg-accent p-4">
                          <p className="font-semibold text-foreground">Next Actions</p>
                          {moduleDepth.nextActions.length > 0 ? (
                            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                              {moduleDepth.nextActions.map((action) => <li key={action}>{action}</li>)}
                            </ul>
                          ) : (
                            <p className="mt-3 text-sm text-muted-foreground">This module is ready for the next workflow smoke.</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <EmptyState label="Module readiness has not been returned yet. Refresh the workspace after syncing records or workflows." />
                )}
              </CardContent>
            </Card>

            <Card className="border-transparent fusion-glass rounded-2xl">
              <CardHeader>
                <CardTitle>Integration Map</CardTitle>
                <CardDescription>Backend and platform connections this module should keep synchronized.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {integrationPoints.map((point, index) => (
                  <div key={point} className="flex items-center gap-3 fusion-glass rounded-2xl p-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary/10 font-mono text-xs font-semibold text-primary">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium text-foreground">{point}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-transparent fusion-glass rounded-2xl">
              <CardHeader>
                <CardTitle>Business Object Map</CardTitle>
                <CardDescription>Objects and events this module keeps synchronized across the HR operating model.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border/70 bg-accent p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Route className="h-4 w-4 text-primary" />
                    <p className="font-semibold text-foreground">Business objects</p>
                  </div>
                  <ChipList items={module.dataObjects} />
                </div>
                <div className="rounded-lg border border-border/70 bg-accent p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-primary" />
                    <p className="font-semibold text-foreground">Nervous system events</p>
                  </div>
                  <ChipList items={eventTriggers} />
                </div>
                <details className="rounded-lg border border-border/70 bg-white/70 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">Advanced Diagnostics</summary>
                  <div className="mt-3 space-y-3 text-sm">
                    <div>
                      <p className="lumina-label">Backend Root</p>
                      <p className="mt-1 font-mono font-semibold text-foreground">{module.backendRoot}</p>
                    </div>
                    <div>
                      <p className="lumina-label">Admin Route</p>
                      <p className="mt-1 font-mono font-semibold text-foreground">/admin/modules/{module.id}/operations</p>
                    </div>
                  </div>
                </details>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
