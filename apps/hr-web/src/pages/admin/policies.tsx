import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GitBranch,
  Landmark,
  LockKeyhole,
  PlayCircle,
  Radar,
  Save,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Umbrella,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState } from '@/components/common/error-state';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';

type PolicyArea =
  | 'EMPLOYEE_SETUP'
  | 'LEAVE'
  | 'ATTENDANCE'
  | 'PAYROLL'
  | 'ACCESS_GOVERNANCE'
  | 'COUNTRY_POLICY'
  | 'COMPLIANCE';

type PolicyStatus = 'DRAFT' | 'IN_REVIEW' | 'REVIEWED' | 'APPROVED' | 'PUBLISHED' | 'APPLIED' | 'REJECTED' | 'ARCHIVED';

type PolicyScope = {
  tenantId?: string;
  countryCodes?: string[];
  legalEntityIds?: string[];
  orgUnitIds?: string[];
  departmentIds?: string[];
  locationCodes?: string[];
  employeeTypes?: string[];
  workerIds?: string[];
  effectiveFrom?: string;
  effectiveUntil?: string;
};

type PolicyValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  conflicts: Array<{ revisionId: string; reason: string }>;
  engineName: string;
  engineVersion: string;
};

type PolicySimulationResult = {
  impactedEmployees: number;
  impactedWorkerIds: string[];
  pendingRecords: {
    pendingLeaveRequests: number;
    openAttendanceDays: number;
    openPayrollCycles: number;
    pendingComplianceAcknowledgements: number;
  };
  oldDataRule: string;
  newDataRule: string;
  retroactiveRule: string;
  warnings: string[];
  engineName: string;
  engineVersion: string;
};

type PolicyRevision = {
  id: string;
  area: PolicyArea;
  title: string;
  status: PolicyStatus;
  draftConfig: Record<string, unknown>;
  baselineConfig: Record<string, unknown>;
  scope: PolicyScope;
  validationResult?: PolicyValidationResult;
  simulationResult?: PolicySimulationResult;
  createdBy?: string;
  reviewedBy?: string;
  approvedBy?: string;
  publishedBy?: string;
  appliedBy?: string;
  reviewNotes?: string;
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  publishedAt?: string;
  appliedAt?: string;
  updatedAt: string;
};

type PolicyApplicationRun = {
  id: string;
  revisionId: string;
  status: string;
  impactedEmployees: number;
  pendingRecords: PolicySimulationResult['pendingRecords'];
  appliedBy: string;
  appliedAt: string;
};

type PolicySummary = {
  totalRevisions: number;
  byStatus: Record<string, number>;
  byArea: Record<string, number>;
  recentRuns: PolicyApplicationRun[];
};

type ScopeForm = {
  countryCodes: string;
  legalEntityIds: string;
  orgUnitIds: string;
  departmentIds: string;
  locationCodes: string;
  employeeTypes: string;
  workerIds: string;
  effectiveFrom: string;
  effectiveUntil: string;
};

const policyAreas: Array<{ area: PolicyArea; label: string; icon: React.ElementType; link?: string }> = [
  { area: 'EMPLOYEE_SETUP', label: 'Service Policies', icon: SlidersHorizontal, link: '/admin/system-console/settings' },
  { area: 'LEAVE', label: 'Leave', icon: Umbrella, link: '/admin/leave' },
  { area: 'ATTENDANCE', label: 'Attendance', icon: Radar, link: '/admin/attendance' },
  { area: 'PAYROLL', label: 'Payroll', icon: Scale, link: '/admin/payroll' },
  { area: 'ACCESS_GOVERNANCE', label: 'Access Governance', icon: LockKeyhole },
  { area: 'COUNTRY_POLICY', label: 'Country Policy', icon: Landmark, link: '/admin/country-policy' },
  { area: 'COMPLIANCE', label: 'Compliance Policies', icon: ClipboardCheck, link: '/admin/compliance' },
];

const emptyScopeForm: ScopeForm = {
  countryCodes: '',
  legalEntityIds: '',
  orgUnitIds: '',
  departmentIds: '',
  locationCodes: '',
  employeeTypes: '',
  workerIds: '',
  effectiveFrom: '',
  effectiveUntil: '',
};

const lifecycleOrder: PolicyStatus[] = ['DRAFT', 'IN_REVIEW', 'REVIEWED', 'APPROVED', 'PUBLISHED', 'APPLIED'];

function apiData<T>(payload: unknown): T {
  const response = payload as { data?: T; success?: boolean };
  if (response.success === true && response.data !== undefined) return response.data;
  return payload as T;
}

function unwrap<T>(response: { data: unknown }) {
  return apiData<T>(response.data);
}

function csv(values: string[] | undefined) {
  return (values ?? []).join(', ');
}

function splitCsv(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function scopeToForm(scope: PolicyScope | undefined): ScopeForm {
  return {
    countryCodes: csv(scope?.countryCodes),
    legalEntityIds: csv(scope?.legalEntityIds),
    orgUnitIds: csv(scope?.orgUnitIds),
    departmentIds: csv(scope?.departmentIds),
    locationCodes: csv(scope?.locationCodes),
    employeeTypes: csv(scope?.employeeTypes),
    workerIds: csv(scope?.workerIds),
    effectiveFrom: scope?.effectiveFrom ?? '',
    effectiveUntil: scope?.effectiveUntil ?? '',
  };
}

function formToScope(form: ScopeForm): PolicyScope {
  return {
    countryCodes: splitCsv(form.countryCodes),
    legalEntityIds: splitCsv(form.legalEntityIds),
    orgUnitIds: splitCsv(form.orgUnitIds),
    departmentIds: splitCsv(form.departmentIds),
    locationCodes: splitCsv(form.locationCodes),
    employeeTypes: splitCsv(form.employeeTypes),
    workerIds: splitCsv(form.workerIds),
    effectiveFrom: form.effectiveFrom || undefined,
    effectiveUntil: form.effectiveUntil || undefined,
  };
}

function formatEnum(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

function statusTone(status: PolicyStatus) {
  if (status === 'APPLIED') return 'bg-[#4f46e5] text-white';
  if (status === 'PUBLISHED' || status === 'APPROVED') return 'bg-[#8b5cf6]/10 text-[#4f46e5] border-[#8b5cf6]/30';
  if (status === 'REJECTED' || status === 'ARCHIVED') return 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/30';
  return 'bg-[#e0e7ff] text-[#0f172a] border-[#e2e8f0]';
}

function areaMeta(area: PolicyArea) {
  return policyAreas.find((item) => item.area === area) ?? policyAreas[0];
}

function currentAreaConfig(area: PolicyArea, setup: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!setup) return {};
  if (area === 'LEAVE') return { leavePolicies: setup.leavePolicies ?? [] };
  if (area === 'ATTENDANCE') return { attendancePolicy: setup.attendancePolicy ?? {} };
  if (area === 'PAYROLL') {
    return {
      payrollCalculationPolicy: setup.payrollCalculationPolicy ?? {},
      statutoryPayrollPacks: setup.statutoryPayrollPacks ?? [],
      earningPolicies: setup.earningPolicies ?? [],
      deductionPolicies: setup.deductionPolicies ?? [],
      payrollBlockingRules: setup.payrollBlockingRules ?? [],
    };
  }
  if (area === 'ACCESS_GOVERNANCE') return { policyGovernance: setup.policyGovernance ?? { allowedActionOverrides: [], fieldAccessOverrides: [] } };
  if (area === 'COUNTRY_POLICY') return { countryPolicyRuntime: setup.countryPolicyRuntime ?? {} };
  if (area === 'COMPLIANCE') return { compliancePolicyRuntime: setup.compliancePolicyRuntime ?? {} };
  return {
    genderOptions: setup.genderOptions ?? [],
    locations: setup.locations ?? [],
    departments: setup.departments ?? [],
    jobTitles: setup.jobTitles ?? [],
    documentRequirements: setup.documentRequirements ?? [],
    fieldRules: setup.fieldRules ?? [],
  };
}

function safeJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseJson(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Policy payload must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function pendingRecordTotal(records?: PolicySimulationResult['pendingRecords']) {
  if (!records) return 0;
  return Object.values(records).reduce((total, value) => total + value, 0);
}

function ScopeInputs({ value, onChange }: { value: ScopeForm; onChange: (next: ScopeForm) => void }) {
  const update = (key: keyof ScopeForm, nextValue: string) => onChange({ ...value, [key]: nextValue });
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor="policy-countries">Countries</Label>
        <Input id="policy-countries" placeholder="EG, AE" value={value.countryCodes} onChange={(event) => update('countryCodes', event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="policy-legal">Legal entities</Label>
        <Input id="policy-legal" placeholder="UUIDs or codes" value={value.legalEntityIds} onChange={(event) => update('legalEntityIds', event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="policy-units">Org units</Label>
        <Input id="policy-units" placeholder="Unit IDs" value={value.orgUnitIds} onChange={(event) => update('orgUnitIds', event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="policy-departments">Departments</Label>
        <Input id="policy-departments" placeholder="Department IDs" value={value.departmentIds} onChange={(event) => update('departmentIds', event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="policy-locations">Locations</Label>
        <Input id="policy-locations" placeholder="CAIRO_HQ" value={value.locationCodes} onChange={(event) => update('locationCodes', event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="policy-types">Employee types</Label>
        <Input id="policy-types" placeholder="FULL_TIME" value={value.employeeTypes} onChange={(event) => update('employeeTypes', event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="policy-workers">Workers</Label>
        <Input id="policy-workers" placeholder="Worker IDs" value={value.workerIds} onChange={(event) => update('workerIds', event.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="policy-from">From</Label>
          <Input id="policy-from" type="date" value={value.effectiveFrom} onChange={(event) => update('effectiveFrom', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="policy-until">Until</Label>
          <Input id="policy-until" type="date" value={value.effectiveUntil} onChange={(event) => update('effectiveUntil', event.target.value)} />
        </div>
      </div>
    </div>
  );
}

function RevisionList({
  revisions,
  selectedId,
  onSelect,
}: {
  revisions: PolicyRevision[];
  selectedId?: string;
  onSelect: (revision: PolicyRevision) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
      <div className="grid min-w-[760px] grid-cols-[1.2fr_0.8fr_0.8fr_1fr_1fr] border-b border-[#e2e8f0] bg-[#eef2ff] px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#475569]">
        <span>Revision</span>
        <span>Area</span>
        <span>Status</span>
        <span>Scope</span>
        <span>Updated</span>
      </div>
      <div className="max-h-[28rem] min-w-[760px] overflow-y-auto">
        {revisions.map((revision) => (
          <button
            key={revision.id}
            type="button"
            onClick={() => onSelect(revision)}
            className={cn(
              'grid w-full grid-cols-[1.2fr_0.8fr_0.8fr_1fr_1fr] items-center gap-3 border-b border-[#e2e8f0]/60 px-4 py-3 text-left text-sm transition-colors hover:bg-[#eef2ff]',
              selectedId === revision.id && 'bg-[#8b5cf6]/10',
            )}
          >
            <span>
              <span className="block font-semibold text-[#0f172a]">{revision.title}</span>
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">{revision.id.slice(0, 8)}</span>
            </span>
            <span>{formatEnum(revision.area)}</span>
            <span><span className={cn('inline-flex rounded-full border px-2 py-1 text-xs font-semibold', statusTone(revision.status))}>{formatEnum(revision.status)}</span></span>
            <span className="truncate text-[#475569]">
              {revision.scope.workerIds?.length ? `${revision.scope.workerIds.length} workers` : revision.scope.departmentIds?.length ? `${revision.scope.departmentIds.length} departments` : revision.scope.countryCodes?.length ? revision.scope.countryCodes.join(', ') : 'Tenant default'}
            </span>
            <span className="text-[#475569]">{displayDate(revision.updatedAt)}</span>
          </button>
        ))}
        {revisions.length === 0 ? <div className="p-6 text-sm text-[#94a3b8]">No policy revisions yet.</div> : null}
      </div>
    </div>
  );
}

function ImpactPanel({ revision }: { revision?: PolicyRevision }) {
  const validation = revision?.validationResult;
  const simulation = revision?.simulationResult;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-[#4f46e5]" />
            Validation
          </CardTitle>
          <CardDescription>{validation?.engineName ?? 'PolicyValidationEngine'} {validation?.engineVersion ?? ''}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Badge className={validation?.valid ? 'bg-[#4f46e5] text-white' : 'bg-[#e11d48] text-white'}>
            {validation ? (validation.valid ? 'Valid' : 'Blocked') : 'Not run'}
          </Badge>
          {(validation?.errors ?? []).map((error) => <p key={error} className="rounded-md border border-[#e11d48]/30 bg-[#e11d48]/5 p-2 text-[#e11d48]">{error}</p>)}
          {(validation?.warnings ?? []).map((warning) => <p key={warning} className="rounded-md border border-[#f59e0b]/30 bg-[#fde68a]/30 p-2 text-[#78350f]">{warning}</p>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Radar className="h-5 w-5 text-[#6366f1]" />
            Simulation
          </CardTitle>
          <CardDescription>{simulation?.engineName ?? 'PolicyImpactSimulationEngine'} {simulation?.engineVersion ?? ''}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[#475569]">
          <div className="text-3xl font-bold text-[#0f172a]">{simulation?.impactedEmployees ?? 0}</div>
          <p>employees in scope</p>
          <p>{pendingRecordTotal(simulation?.pendingRecords)} pending/open records flagged</p>
          {(simulation?.warnings ?? []).map((warning) => <p key={warning} className="rounded-md border border-[#f59e0b]/30 bg-[#fde68a]/30 p-2 text-[#78350f]">{warning}</p>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitBranch className="h-5 w-5 text-[#4f46e5]" />
            Data Impact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-[#475569]">
          <p>{simulation?.newDataRule ?? 'New transactions use the applied policy active on the transaction date.'}</p>
          <p>{simulation?.oldDataRule ?? 'Locked historical records are not silently rewritten.'}</p>
          <p>{simulation?.retroactiveRule ?? 'Retroactive effects require explicit admin action.'}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function AreaWorkspace({
  area,
  revisions,
  setup,
  selectedId,
  onSelect,
  onCreateDraft,
}: {
  area: PolicyArea;
  revisions: PolicyRevision[];
  setup?: Record<string, unknown>;
  selectedId?: string;
  onSelect: (revision: PolicyRevision) => void;
  onCreateDraft: (area: PolicyArea) => void;
}) {
  const meta = areaMeta(area);
  const Icon = meta.icon;
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Icon className="h-5 w-5 text-[#4f46e5]" />
              {meta.label}
            </CardTitle>
            <CardDescription>{revisions.length} revisions in this service area</CardDescription>
          </div>
          <Button type="button" onClick={() => onCreateDraft(area)}>Create Draft</Button>
        </CardHeader>
        <CardContent>
          <RevisionList revisions={revisions} selectedId={selectedId} onSelect={onSelect} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Runtime Snapshot</CardTitle>
          <CardDescription>Generated from applied revisions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="max-h-72 overflow-auto rounded-lg border border-[#e2e8f0] bg-[#f6f7fb] p-3 text-xs text-[#0f172a]">
            {safeJson(currentAreaConfig(area, setup))}
          </pre>
          {meta.link ? (
            <Button asChild variant="outline" className="w-full">
              <Link to={meta.link}>Open Native Screen</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminPolicies() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const [selectedId, setSelectedId] = React.useState<string>('');
  const [newArea, setNewArea] = React.useState<PolicyArea>('LEAVE');
  const [newTitle, setNewTitle] = React.useState('Leave policy revision');
  const [newScope, setNewScope] = React.useState<ScopeForm>(emptyScopeForm);
  const [editorJson, setEditorJson] = React.useState('{}');
  const [editorTitle, setEditorTitle] = React.useState('');
  const [editorScope, setEditorScope] = React.useState<ScopeForm>(emptyScopeForm);
  const [editorError, setEditorError] = React.useState('');

  const summaryQuery = useQuery({
    queryKey: ['admin-policy-summary'],
    queryFn: async () => unwrap<PolicySummary>(await apiClient.get('/admin/policies/summary')),
  });
  const revisionsQuery = useQuery({
    queryKey: ['admin-policy-revisions'],
    queryFn: async () => unwrap<PolicyRevision[]>(await apiClient.get('/admin/policies/revisions')),
  });
  const setupQuery = useQuery({
    queryKey: ['admin-policy-hcm-setup'],
    queryFn: async () => unwrap<Record<string, unknown>>(await apiClient.get('/admin/hcm-setup')),
  });

  const revisions = revisionsQuery.data ?? [];
  const summary = summaryQuery.data;
  const selectedRevision = revisions.find((revision) => revision.id === selectedId) ?? revisions[0];

  React.useEffect(() => {
    if (!selectedId && revisions[0]?.id) setSelectedId(revisions[0].id);
  }, [revisions, selectedId]);

  React.useEffect(() => {
    if (!selectedRevision) return;
    setEditorTitle(selectedRevision.title);
    setEditorJson(safeJson(selectedRevision.draftConfig));
    setEditorScope(scopeToForm(selectedRevision.scope));
    setEditorError('');
  }, [selectedRevision?.id]);

  const invalidatePolicies = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-policy-summary'] });
    queryClient.invalidateQueries({ queryKey: ['admin-policy-revisions'] });
    queryClient.invalidateQueries({ queryKey: ['admin-policy-hcm-setup'] });
  };

  const notifyError = (mutationError: unknown, fallback: string) => {
    const message = mutationError instanceof Error ? mutationError.message : fallback;
    addNotification({ title: 'Something went wrong', message, type: 'error', read: false });
  };

  const createRevision = useMutation({
    mutationFn: async (payload: { area: PolicyArea; title: string; scope: PolicyScope; draftConfig?: Record<string, unknown> }) => (
      unwrap<PolicyRevision>(await apiClient.post('/admin/policies/revisions', payload))
    ),
    onSuccess: (revision) => {
      setSelectedId(revision.id);
      invalidatePolicies();
      addNotification({ title: 'Draft created', message: 'A new policy revision draft was created.', type: 'success', read: false });
    },
    onError: (mutationError) => notifyError(mutationError, 'Unable to create the policy revision.'),
  });

  const updateRevision = useMutation({
    mutationFn: async (payload: { id: string; title: string; scope: PolicyScope; draftConfig: Record<string, unknown> }) => (
      unwrap<PolicyRevision>(await apiClient.patch(`/admin/policies/revisions/${payload.id}`, payload))
    ),
    onSuccess: () => {
      invalidatePolicies();
      addNotification({ title: 'Revision saved', message: 'The policy revision was saved.', type: 'success', read: false });
    },
    onError: (mutationError) => notifyError(mutationError, 'Unable to save the policy revision.'),
  });

  const commandRevision = useMutation({
    mutationFn: async ({ id, command }: { id: string; command: 'validate' | 'simulate' | 'submit-review' | 'mark-reviewed' | 'approve' | 'publish' | 'apply' }) => {
      const path = command === 'validate' || command === 'simulate'
        ? `/admin/policies/revisions/${id}/${command}`
        : `/admin/policies/revisions/${id}/commands/${command}`;
      return unwrap<PolicyRevision | PolicyValidationResult | PolicySimulationResult>(await apiClient.post(path));
    },
    onSuccess: (_result, variables) => {
      invalidatePolicies();
      addNotification({ title: 'Command executed', message: `The "${variables.command.replace(/-/g, ' ')}" command completed.`, type: 'success', read: false });
    },
    onError: (mutationError) => notifyError(mutationError, 'Unable to run the policy command.'),
  });

  const createDraftForArea = (area: PolicyArea) => {
    const meta = areaMeta(area);
    setNewArea(area);
    setNewTitle(`${meta.label} revision`);
    createRevision.mutate({
      area,
      title: `${meta.label} revision`,
      scope: formToScope(newScope),
      draftConfig: currentAreaConfig(area, setupQuery.data),
    });
  };

  const saveSelected = () => {
    if (!selectedRevision) return;
    try {
      setEditorError('');
      updateRevision.mutate({
        id: selectedRevision.id,
        title: editorTitle,
        scope: formToScope(editorScope),
        draftConfig: parseJson(editorJson),
      });
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Invalid policy JSON.');
    }
  };

  const byArea = React.useMemo(() => {
    return policyAreas.reduce<Record<PolicyArea, PolicyRevision[]>>((groups, item) => {
      groups[item.area] = revisions.filter((revision) => revision.area === item.area);
      return groups;
    }, {} as Record<PolicyArea, PolicyRevision[]>);
  }, [revisions]);

  return (
    <div className="min-h-screen fusion-bg p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#4f46e5] text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-headline text-3xl font-bold text-[#0f172a]">Policy Center</h2>
                <p className="text-sm text-[#475569]">Scoped policy revisions, lifecycle workflow, simulation, application, and notifications.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/system-console/settings">Setup</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/compliance">Compliance</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/country-policy">Country Policy</Link>
            </Button>
          </div>
        </div>

        {revisionsQuery.isError || summaryQuery.isError ? (
          <ErrorState
            error={revisionsQuery.error ?? summaryQuery.error}
            onRetry={() => {
              revisionsQuery.refetch();
              summaryQuery.refetch();
            }}
          />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ['Total Revisions', summary?.totalRevisions ?? revisions.length],
            ['Applied', summary?.byStatus?.APPLIED ?? 0],
            ['Published', summary?.byStatus?.PUBLISHED ?? 0],
            ['In Review', summary?.byStatus?.IN_REVIEW ?? 0],
            ['Open Runs', summary?.recentRuns?.length ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="fusion-glass rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
              <p className="font-mono text-xs uppercase tracking-wider text-[#475569]">{label}</p>
              <p className="mt-2 text-3xl font-bold text-[#0f172a]">{value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex max-w-full flex-wrap justify-start gap-1 overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="service">Service Policies</TabsTrigger>
            <TabsTrigger value="leave">Leave</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="access">Access Governance</TabsTrigger>
            <TabsTrigger value="country">Country Policy</TabsTrigger>
            <TabsTrigger value="compliance">Compliance Policies</TabsTrigger>
            <TabsTrigger value="impact">Impact & Runs</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1fr_28rem]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-[#4f46e5]" />
                    Policy Brain And Engines
                  </CardTitle>
                  <CardDescription>Live service behavior changes only after APPLIED.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ['PolicyLifecycleWorkflow', 'DRAFT -> IN_REVIEW -> REVIEWED -> APPROVED -> PUBLISHED -> APPLIED'],
                    ['PolicyScopeResolver', 'Worker, department/unit, entity, country, tenant default precedence'],
                    ['PolicyValidationEngine', 'Schema, dates, conflicts, geofence, payroll, and access checks'],
                    ['PolicyImpactSimulationEngine', 'Impacted workers, pending requests, open payroll and attendance periods'],
                    ['PolicyApplicationEngine', 'Writes approved/published revisions into the runtime setup snapshot'],
                    ['Notification Engine', 'Review, approval, publish, apply, and impact events to bell/inbox'],
                  ].map(([name, body]) => (
                    <div key={name} className="rounded-lg border border-[#e2e8f0] bg-[#f6f7fb] p-4">
                      <p className="font-semibold text-[#0f172a]">{name}</p>
                      <p className="mt-2 text-sm leading-6 text-[#475569]">{body}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-[#6366f1]" />
                    Create Revision
                  </CardTitle>
                  <CardDescription>Start from the current runtime snapshot.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-area">Area</Label>
                    <select id="new-area" className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={newArea} onChange={(event) => setNewArea(event.target.value as PolicyArea)}>
                      {policyAreas.map((item) => <option key={item.area} value={item.area}>{item.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-title">Title</Label>
                    <Input id="new-title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
                  </div>
                  <ScopeInputs value={newScope} onChange={setNewScope} />
                  <Button
                    className="w-full"
                    disabled={createRevision.isPending}
                    onClick={() => createRevision.mutate({
                      area: newArea,
                      title: newTitle,
                      scope: formToScope(newScope),
                      draftConfig: currentAreaConfig(newArea, setupQuery.data),
                    })}
                    type="button"
                  >
                    Create Draft
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="service">
            <AreaWorkspace area="EMPLOYEE_SETUP" revisions={byArea.EMPLOYEE_SETUP ?? []} setup={setupQuery.data} selectedId={selectedRevision?.id} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="leave">
            <AreaWorkspace area="LEAVE" revisions={byArea.LEAVE ?? []} setup={setupQuery.data} selectedId={selectedRevision?.id} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="attendance">
            <AreaWorkspace area="ATTENDANCE" revisions={byArea.ATTENDANCE ?? []} setup={setupQuery.data} selectedId={selectedRevision?.id} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="payroll">
            <AreaWorkspace area="PAYROLL" revisions={byArea.PAYROLL ?? []} setup={setupQuery.data} selectedId={selectedRevision?.id} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="access">
            <AreaWorkspace area="ACCESS_GOVERNANCE" revisions={byArea.ACCESS_GOVERNANCE ?? []} setup={setupQuery.data} selectedId={selectedRevision?.id} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="country">
            <AreaWorkspace area="COUNTRY_POLICY" revisions={byArea.COUNTRY_POLICY ?? []} setup={setupQuery.data} selectedId={selectedRevision?.id} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="compliance">
            <AreaWorkspace area="COMPLIANCE" revisions={byArea.COMPLIANCE ?? []} setup={setupQuery.data} selectedId={selectedRevision?.id} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>

          <TabsContent value="impact" className="space-y-4">
            <ImpactPanel revision={selectedRevision} />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PlayCircle className="h-5 w-5 text-[#4f46e5]" />
                  Application Runs
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-2">
                {(summary?.recentRuns ?? []).map((run) => (
                  <div key={run.id} className="fusion-glass rounded-2xl p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[#0f172a]">{run.status}</p>
                      <span className="text-[#475569]">{displayDate(run.appliedAt)}</span>
                    </div>
                    <p className="mt-2 text-[#475569]">{run.impactedEmployees} employees impacted</p>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">{run.revisionId}</p>
                  </div>
                ))}
                {(summary?.recentRuns ?? []).length === 0 ? <p className="text-sm text-[#94a3b8]">No application runs yet.</p> : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BellRing className="h-5 w-5 text-[#4f46e5]" />
                  Revision Audit Trail
                </CardTitle>
                <CardDescription>{selectedRevision ? selectedRevision.title : 'Select a revision'}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  {lifecycleOrder.map((status) => {
                    const key = `${status.toLowerCase().replace(/_/g, '')}At` as keyof PolicyRevision;
                    const value = selectedRevision?.[key];
                    return (
                      <div key={status} className="flex items-center justify-between fusion-glass rounded-2xl p-3 text-sm">
                        <span className="font-semibold text-[#0f172a]">{formatEnum(status)}</span>
                        <span className="text-[#475569]">{typeof value === 'string' ? displayDate(value) : '-'}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-lg border border-[#e2e8f0] bg-[#f6f7fb] p-4 text-sm leading-6 text-[#475569]">
                  <p className="font-semibold text-[#0f172a]">Decision Evidence</p>
                  <p className="mt-2">Apply creates structured evidence with revision ID, scope match, engine name/version, decision, and reason in `admin_policy_decision_evidence`.</p>
                  <p className="mt-3">Lifecycle and application events create policy notifications for HR operations and impacted employees.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {selectedRevision ? (
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Save className="h-5 w-5 text-[#4f46e5]" />
                  Revision Editor
                </CardTitle>
                <CardDescription>{formatEnum(selectedRevision.area)} - {selectedRevision.id}</CardDescription>
              </div>
              <span className={cn('inline-flex rounded-full border px-3 py-1 text-sm font-semibold', statusTone(selectedRevision.status))}>
                {formatEnum(selectedRevision.status)}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_12rem]">
                <div className="space-y-1.5">
                  <Label htmlFor="revision-title">Title</Label>
                  <Input id="revision-title" value={editorTitle} onChange={(event) => setEditorTitle(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Area</Label>
                  <div className="flex h-10 items-center rounded-lg border border-[#e2e8f0] bg-[#eef2ff] px-3 text-sm font-semibold text-[#0f172a]">
                    {formatEnum(selectedRevision.area)}
                  </div>
                </div>
              </div>
              <ScopeInputs value={editorScope} onChange={setEditorScope} />
              <div className="space-y-1.5">
                <Label htmlFor="revision-json">Policy Payload</Label>
                <textarea
                  id="revision-json"
                  className="min-h-[22rem] w-full fusion-glass rounded-2xl p-3 font-mono text-xs leading-5 text-[#0f172a] outline-none focus:ring-2 focus:ring-[#4f46e5]/20"
                  value={editorJson}
                  onChange={(event) => setEditorJson(event.target.value)}
                  spellCheck={false}
                />
              </div>
              {editorError || updateRevision.error || commandRevision.error ? (
                <div className="rounded-lg border border-[#e11d48]/30 bg-[#e11d48]/5 p-3 text-sm text-[#e11d48]">
                  <AlertTriangle className="mr-2 inline h-4 w-4" />
                  {editorError || (updateRevision.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || commandRevision.error?.message}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={saveSelected} disabled={updateRevision.isPending}>Save</Button>
                <Button type="button" variant="outline" onClick={() => commandRevision.mutate({ id: selectedRevision.id, command: 'validate' })}>Validate</Button>
                <Button type="button" variant="outline" onClick={() => commandRevision.mutate({ id: selectedRevision.id, command: 'simulate' })}>Simulate</Button>
                <Button type="button" variant="outline" onClick={() => commandRevision.mutate({ id: selectedRevision.id, command: 'submit-review' })} disabled={selectedRevision.status !== 'DRAFT'}>Submit Review</Button>
                <Button type="button" variant="outline" onClick={() => commandRevision.mutate({ id: selectedRevision.id, command: 'mark-reviewed' })} disabled={selectedRevision.status !== 'IN_REVIEW'}>Mark Reviewed</Button>
                <Button type="button" variant="outline" onClick={() => commandRevision.mutate({ id: selectedRevision.id, command: 'approve' })} disabled={selectedRevision.status !== 'REVIEWED'}>Approve</Button>
                <Button type="button" variant="outline" onClick={() => commandRevision.mutate({ id: selectedRevision.id, command: 'publish' })} disabled={selectedRevision.status !== 'APPROVED'}>Publish</Button>
                <Button type="button" onClick={() => commandRevision.mutate({ id: selectedRevision.id, command: 'apply' })} disabled={selectedRevision.status !== 'PUBLISHED'}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Apply
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
