import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileText,
  GitBranch,
  KeyRound,
  Landmark,
  ListChecks,
  LockKeyhole,
  PlayCircle,
  Radar,
  Save,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Umbrella,
  Users,
  Workflow,
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
import {
  POLICY_CONTROL_LENSES,
  SYSTEM_POLICY_SURFACES,
  applyGuidedPolicyChange,
  getControlledApplyCommands,
  getPolicyControlLens,
  normalizePolicyDraftForRuntime,
  type GuidedPolicyChange,
  type PolicyCommand,
  type PolicyArea,
} from '@/lib/policy-center-controls';

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

type PolicyDecisionEvidence = {
  id: string;
  policyRevisionId: string;
  serviceArea: PolicyArea;
  engineName: string;
  engineVersion: string;
  scopeMatch: PolicyScope;
  decision: string;
  reason: string;
  subjectWorkerId?: string;
  sourceRecordId?: string;
  createdAt: string;
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
    throw new Error('Policy draft data is not in a supported format.');
  }
  return parsed as Record<string, unknown>;
}

function policyCommandPath(id: string, command: PolicyCommand) {
  return command === 'validate' || command === 'simulate'
    ? `/admin/policies/revisions/${id}/${command}`
    : `/admin/policies/revisions/${id}/commands/${command}`;
}

function tryParseDraft(value: string): { draft?: Record<string, unknown>; error?: string } {
  try {
    return { draft: parseJson(value) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Policy draft data is not in a supported format.' };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function stringField(record: Record<string, unknown> | undefined, key: string, fallback = '') {
  const value = record?.[key];
  return typeof value === 'string' ? value : fallback;
}

function numberField(record: Record<string, unknown> | undefined, key: string, fallback = 0) {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanField(record: Record<string, unknown> | undefined, key: string, fallback = false) {
  const value = record?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

function stringArrayField(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function optionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function recordCode(record: Record<string, unknown> | undefined) {
  return stringField(record, 'code') || stringField(record, 'id');
}

function recordLabel(record: Record<string, unknown> | undefined) {
  const code = recordCode(record);
  const label = stringField(record, 'label');
  return label ? `${label} (${code})` : code;
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

function MiniList({ title, icon: Icon, items }: { title: string; icon: React.ElementType; items: string[] }) {
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#0f172a]">
        <Icon className="h-4 w-4 text-[#4f46e5]" />
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="rounded-full border border-[#c7d2fe] bg-white px-2 py-1 text-xs text-[#475569]">{item}</span>
        ))}
      </div>
    </div>
  );
}

function PolicyControlMatrix({ revisions }: { revisions: PolicyRevision[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {Object.values(POLICY_CONTROL_LENSES).map((lens) => {
        const applied = revisions.filter((revision) => revision.area === lens.area && revision.status === 'APPLIED').length;
        const open = revisions.filter((revision) => revision.area === lens.area && !['APPLIED', 'ARCHIVED'].includes(revision.status)).length;
        return (
          <Card key={lens.area}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{lens.label}</CardTitle>
                  <CardDescription>{lens.description}</CardDescription>
                </div>
                <div className="shrink-0 text-right">
                  <Badge className={applied > 0 ? 'bg-[#4f46e5] text-white' : 'bg-[#e2e8f0] text-[#475569]'}>
                    {applied} applied
                  </Badge>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">{open} open</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <MiniList title="Engines" icon={Workflow} items={lens.engines} />
              <MiniList title="Controls" icon={SlidersHorizontal} items={lens.controls} />
              <MiniList title="Runtime Keys" icon={Database} items={lens.runtimeKeys} />
              <MiniList title="Consumers" icon={Users} items={lens.serviceConsumers} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function WholeSystemPolicyCoverage({ revisions }: { revisions: PolicyRevision[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#4f46e5]" />
          Whole-System Policy Coverage
        </CardTitle>
        <CardDescription>Visible modules, governing policy area, command enforcement, notifications, and runtime evidence.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-[#eef2ff] font-mono text-xs uppercase tracking-wider text-[#475569]">
              <tr>
                <th className="p-3">Module</th>
                <th className="p-3">Governing Area</th>
                <th className="p-3">Policy Control</th>
                <th className="p-3">Command Enforcement</th>
                <th className="p-3">Evidence</th>
                <th className="p-3 text-center">Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {SYSTEM_POLICY_SURFACES.map((surface) => {
                const applied = revisions.some((revision) => revision.area === surface.policyArea && revision.status === 'APPLIED');
                return (
                  <tr key={surface.module} className="align-top hover:bg-[#f8fafc]">
                    <td className="p-3 font-semibold text-[#0f172a]">{surface.module}</td>
                    <td className="p-3 text-[#475569]">{formatEnum(surface.policyArea)}</td>
                    <td className="p-3 text-[#475569]">{surface.governedBy}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {surface.commandEnforcement.slice(0, 3).map((command) => (
                          <span key={command} className="rounded-full border border-[#c7d2fe] bg-white px-2 py-1 text-xs text-[#475569]">{command}</span>
                        ))}
                        {surface.commandEnforcement.length > 3 ? <span className="rounded-full bg-[#eef2ff] px-2 py-1 text-xs text-[#475569]">+{surface.commandEnforcement.length - 3}</span> : null}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {surface.runtimeEvidence.slice(0, 3).map((item) => (
                          <span key={item} className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2 py-1 text-xs text-[#64748b]">{item}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <Badge className={applied ? 'bg-[#4f46e5] text-white' : 'bg-[#e2e8f0] text-[#475569]'}>
                        {applied ? 'Runtime' : 'Not applied'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PolicyRuntimeLens({ revision, evidence }: { revision?: PolicyRevision; evidence: PolicyDecisionEvidence[] }) {
  if (!revision) return null;
  const lens = getPolicyControlLens(revision.area);
  const latestEvidence = evidence.filter((item) => item.policyRevisionId === revision.id).slice(0, 4);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Workflow className="h-5 w-5 text-[#4f46e5]" />
            {lens.brain}
          </CardTitle>
          <CardDescription>{lens.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <MiniList title="Business Controls" icon={SlidersHorizontal} items={lens.controls} />
          <MiniList title="Runtime Consumers" icon={Users} items={lens.serviceConsumers} />
          <MiniList title="Evidence Written" icon={KeyRound} items={lens.evidenceFields} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Latest Evidence</CardTitle>
          <CardDescription>Real records from policy decision evidence</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {latestEvidence.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-[#0f172a]">{item.decision}</span>
                <span className="font-mono text-[11px] text-[#94a3b8]">{displayDate(item.createdAt)}</span>
              </div>
              <p className="mt-1 text-[#475569]">{item.engineName} {item.engineVersion}</p>
              <p className="mt-2 text-[#64748b]">{item.reason}</p>
            </div>
          ))}
          {latestEvidence.length === 0 ? <p className="text-sm text-[#94a3b8]">No decision evidence has been written for this revision yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function GuidedInput({
  label,
  value,
  type = 'text',
  onChange,
}: {
  label: string;
  value: string | number;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function GuidedToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm text-[#0f172a]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function RuntimeSnapshotSummary({ area, setup }: { area: PolicyArea; setup?: Record<string, unknown> }) {
  const snapshot = currentAreaConfig(area, setup);
  const facts: Array<[string, string | number]> = [];
  const highlights: string[] = [];

  if (area === 'EMPLOYEE_SETUP') {
    const fields = asRecords(snapshot.fieldRules);
    const documents = asRecords(snapshot.documentRequirements);
    facts.push(['Profile fields', fields.length], ['Required fields', fields.filter((item) => booleanField(item, 'required')).length]);
    facts.push(['Document rules', documents.length], ['Required documents', documents.filter((item) => booleanField(item, 'required')).length]);
    highlights.push(
      ...fields.slice(0, 4).map((item) => `${stringField(item, 'label', stringField(item, 'fieldKey'))}: ${booleanField(item, 'required') ? 'required' : 'optional'}`),
      ...documents.slice(0, 3).map((item) => `${recordLabel(item)} document`),
    );
  } else if (area === 'LEAVE') {
    const policies = asRecords(snapshot.leavePolicies);
    facts.push(['Leave types', policies.length], ['Employee requestable', policies.filter((item) => booleanField(item, 'requestableByEmployee')).length]);
    facts.push(['Paid policies', policies.filter((item) => stringField(item, 'payrollImpact') === 'PAID_LEAVE' || booleanField(item, 'paid')).length]);
    highlights.push(...policies.slice(0, 5).map((item) => `${recordLabel(item)}: ${numberField(item, 'annualEntitlement')} days, ${formatEnum(stringField(item, 'approvalWorkflow', 'MANAGER'))}`));
  } else if (area === 'ATTENDANCE') {
    const policy = asRecord(snapshot.attendancePolicy);
    facts.push(['Standard start', stringField(policy, 'standardStartTime', '09:00')], ['Standard end', stringField(policy, 'standardEndTime', '17:00')]);
    facts.push(['Late grace', `${numberField(policy, 'lateGraceMinutes')} min`], ['Geofence radius', `${numberField(policy, 'allowedRadiusMeters', numberField(policy, 'geofenceRadiusMeters'))} m`]);
    highlights.push(
      `${booleanField(policy, 'geofenceEnabled') ? 'Geofence required' : 'Geofence optional'}`,
      `${numberField(policy, 'minClockTrustScore')} minimum trust score`,
      `${asRecords(policy.shiftRotations).length} shift rotations`,
      `${asRecords(policy.geofenceProfiles).length} geofence profiles`,
    );
  } else if (area === 'PAYROLL') {
    const calculation = asRecord(snapshot.payrollCalculationPolicy);
    const packs = asRecords(snapshot.statutoryPayrollPacks);
    const earnings = asRecords(snapshot.earningPolicies);
    const deductions = asRecords(snapshot.deductionPolicies);
    const blockers = asRecords(snapshot.payrollBlockingRules);
    facts.push(['Tax mode', formatEnum(stringField(calculation, 'taxMode', 'FLAT_PERCENT'))], ['Tax rate', `${numberField(calculation, 'taxRatePercent')}%`]);
    facts.push(['Statutory packs', packs.length], ['Close blockers', blockers.filter((item) => booleanField(item, 'blocking')).length]);
    highlights.push(
      ...packs.slice(0, 3).map((item) => `${recordLabel(item)}: ${stringField(item, 'countryCode', 'GLOBAL')} ${stringField(item, 'currency')}`),
      `${earnings.length} earning policies`,
      `${deductions.length} deduction policies`,
      `${blockers.length} payroll readiness rules`,
    );
  } else if (area === 'ACCESS_GOVERNANCE') {
    const governance = asRecord(snapshot.policyGovernance);
    const actions = asRecords(governance.allowedActionOverrides);
    const fields = asRecords(governance.fieldAccessOverrides);
    facts.push(['Action overrides', actions.length], ['Field access rules', fields.length]);
    highlights.push(
      ...actions.slice(0, 4).map((item) => `${stringField(item, 'aggregateType')}.${stringField(item, 'action')}: ${stringField(item, 'effect', 'ALLOW')}`),
      ...fields.slice(0, 4).map((item) => `${stringField(item, 'fieldPath')}: ${stringField(item, 'decision', 'VISIBLE')}`),
    );
  } else if (area === 'COUNTRY_POLICY') {
    const runtime = asRecord(snapshot.countryPolicyRuntime);
    facts.push(['Country', stringField(runtime, 'countryCode', 'Not set')], ['Pack version', stringField(runtime, 'packVersion', 'Not set')]);
    facts.push(['Effective from', stringField(runtime, 'effectiveFrom', 'Not set')]);
    highlights.push(`${booleanField(runtime, 'blocksPayrollIfStale', true) ? 'Blocks payroll if stale' : 'Does not block payroll when stale'}`);
  } else {
    const runtime = asRecord(snapshot.compliancePolicyRuntime);
    facts.push(['Policy family', stringField(runtime, 'policyFamily', 'Not set')], ['Retention', stringField(runtime, 'retentionClass', 'Not set')]);
    facts.push(['Acknowledgement due', `${numberField(runtime, 'acknowledgementDueDays', 0)} days`]);
    highlights.push(`${booleanField(runtime, 'acknowledgementRequired', true) ? 'Employee acknowledgement required' : 'No employee acknowledgement required'}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#64748b]">{label}</p>
            <p className="mt-1 text-lg font-semibold text-[#0f172a]">{value}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {highlights.slice(0, 8).map((item) => (
          <div key={item} className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#475569]">
            {item}
          </div>
        ))}
        {highlights.length === 0 ? <p className="text-sm text-[#94a3b8]">No applied runtime records yet.</p> : null}
      </div>
    </div>
  );
}

function PolicyBusinessControls({
  revision,
  editorJson,
  setEditorJson,
  setEditorError,
}: {
  revision: PolicyRevision;
  editorJson: string;
  setEditorJson: (value: string) => void;
  setEditorError: (value: string) => void;
}) {
  const parsed = React.useMemo(() => tryParseDraft(editorJson), [editorJson]);
  const draft = parsed.draft ?? {};
  const [selectedLeaveCode, setSelectedLeaveCode] = React.useState('');
  const [selectedFieldKey, setSelectedFieldKey] = React.useState('');
  const [selectedDocumentCode, setSelectedDocumentCode] = React.useState('');
  const [selectedPayrollPack, setSelectedPayrollPack] = React.useState('');
  const [selectedEarningPolicy, setSelectedEarningPolicy] = React.useState('');
  const [selectedDeductionPolicy, setSelectedDeductionPolicy] = React.useState('');
  const [selectedPayrollBlocker, setSelectedPayrollBlocker] = React.useState('');
  const [selectedActionOverride, setSelectedActionOverride] = React.useState('');
  const [selectedFieldOverride, setSelectedFieldOverride] = React.useState('');

  const commit = (change: GuidedPolicyChange) => {
    if (parsed.error || !parsed.draft) {
      setEditorError(parsed.error ?? 'Policy draft data is not in a supported format.');
      return;
    }
    setEditorError('');
    setEditorJson(safeJson(applyGuidedPolicyChange(revision.area, parsed.draft, change)));
  };

  React.useEffect(() => {
    if (revision.area === 'LEAVE') {
      const first = asRecords(draft.leavePolicies)[0];
      setSelectedLeaveCode((current) => current || recordCode(first));
    }
    if (revision.area === 'EMPLOYEE_SETUP') {
      setSelectedFieldKey((current) => current || stringField(asRecords(draft.fieldRules)[0], 'fieldKey'));
      setSelectedDocumentCode((current) => current || recordCode(asRecords(draft.documentRequirements)[0]));
    }
    if (revision.area === 'PAYROLL') {
      setSelectedPayrollPack((current) => current || recordCode(asRecords(draft.statutoryPayrollPacks)[0]));
      setSelectedEarningPolicy((current) => current || recordCode(asRecords(draft.earningPolicies)[0]));
      setSelectedDeductionPolicy((current) => current || recordCode(asRecords(draft.deductionPolicies)[0]));
      setSelectedPayrollBlocker((current) => current || recordCode(asRecords(draft.payrollBlockingRules)[0]));
    }
    if (revision.area === 'ACCESS_GOVERNANCE') {
      const governance = asRecord(draft.policyGovernance);
      setSelectedActionOverride((current) => current || stringField(asRecords(governance.allowedActionOverrides)[0], 'id'));
      setSelectedFieldOverride((current) => current || stringField(asRecords(governance.fieldAccessOverrides)[0], 'id'));
    }
  }, [
    revision.area,
    revision.id,
    draft.leavePolicies,
    draft.fieldRules,
    draft.documentRequirements,
    draft.statutoryPayrollPacks,
    draft.earningPolicies,
    draft.deductionPolicies,
    draft.payrollBlockingRules,
    draft.policyGovernance,
  ]);

  if (parsed.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Business Controls</CardTitle>
          <CardDescription>This draft contains invalid stored policy data. Create a fresh revision from the current runtime snapshot or contact a system administrator.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-[#e11d48]/30 bg-[#e11d48]/5 p-3 text-sm text-[#e11d48]">{parsed.error}</div>
        </CardContent>
      </Card>
    );
  }

  if (revision.area === 'LEAVE') {
    const policies = asRecords(draft.leavePolicies);
    const selected = policies.find((policy) => recordCode(policy) === selectedLeaveCode) ?? policies[0];
    const activeCode = selectedLeaveCode || recordCode(selected) || 'VACATION';
    const update = (changes: Record<string, unknown>) => commit({ type: 'LEAVE_RULE', code: activeCode, changes });
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Leave Business Controls</CardTitle>
          <CardDescription>Eligibility, balance, approval, documents, and payroll impact consumed by leave request and manager approval commands.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-4">
          <div className="space-y-1.5 lg:col-span-2">
            <Label>Leave policy</Label>
            <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={activeCode} onChange={(event) => setSelectedLeaveCode(event.target.value)}>
              {policies.map((policy) => <option key={recordCode(policy)} value={recordCode(policy)}>{recordLabel(policy)}</option>)}
              {policies.length === 0 ? <option value="VACATION">New annual leave policy</option> : null}
            </select>
          </div>
          <GuidedInput label="Annual entitlement" type="number" value={numberField(selected, 'annualEntitlement')} onChange={(value) => update({ annualEntitlement: optionalNumber(value) })} />
          <GuidedInput label="Max per request" type="number" value={numberField(selected, 'maxPerRequest')} onChange={(value) => update({ maxPerRequest: optionalNumber(value) })} />
          <GuidedInput label="Minimum notice days" type="number" value={numberField(selected, 'minNoticeDays')} onChange={(value) => update({ minNoticeDays: optionalNumber(value) })} />
          <GuidedInput label="Document after days" type="number" value={numberField(selected, 'requiresDocumentAfter')} onChange={(value) => update({ requiresDocumentAfter: optionalNumber(value) })} />
          <div className="space-y-1.5">
            <Label>Approval workflow</Label>
            <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={stringField(selected, 'approvalWorkflow', 'MANAGER')} onChange={(event) => update({ approvalWorkflow: event.target.value })}>
              {['MANAGER', 'MANAGER_THEN_HR', 'HR_ONLY', 'AUTO_APPROVE'].map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Payroll impact</Label>
            <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={stringField(selected, 'payrollImpact', 'PAID_LEAVE')} onChange={(event) => update({ payrollImpact: event.target.value })}>
              {['PAID_LEAVE', 'UNPAID_LEAVE', 'PERMISSION', 'NO_PAYROLL_IMPACT'].map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
            </select>
          </div>
          <div className="grid gap-2 lg:col-span-4 md:grid-cols-4">
            <GuidedToggle label="Active" checked={booleanField(selected, 'active', true)} onChange={(checked) => update({ active: checked })} />
            <GuidedToggle label="Employee requestable" checked={booleanField(selected, 'requestableByEmployee', true)} onChange={(checked) => update({ requestableByEmployee: checked })} />
            <GuidedToggle label="Deducts balance" checked={booleanField(selected, 'deductFromBalance', true)} onChange={(checked) => update({ deductFromBalance: checked })} />
            <GuidedToggle label="Paid" checked={booleanField(selected, 'paid', true)} onChange={(checked) => update({ paid: checked })} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (revision.area === 'ATTENDANCE') {
    const attendance = asRecord(draft.attendancePolicy);
    const hasLegacyRadiusOnly = typeof attendance.geofenceRadiusMeters === 'number' && typeof attendance.allowedRadiusMeters !== 'number';
    const update = (changes: Record<string, unknown>) => commit({ type: 'ATTENDANCE_RULE', changes });
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Attendance Business Controls</CardTitle>
          <CardDescription>Geofence, device trust, shift timing, exception blockers, and payroll ledger behavior.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-4">
          <GuidedInput label="Standard start" value={stringField(attendance, 'standardStartTime', '09:00')} onChange={(value) => update({ standardStartTime: value })} />
          <GuidedInput label="Standard end" value={stringField(attendance, 'standardEndTime', '17:00')} onChange={(value) => update({ standardEndTime: value })} />
          <GuidedInput label="Late grace minutes" type="number" value={numberField(attendance, 'lateGraceMinutes')} onChange={(value) => update({ lateGraceMinutes: optionalNumber(value) })} />
          <GuidedInput label="Overtime after minutes" type="number" value={numberField(attendance, 'overtimeAfterMinutes')} onChange={(value) => update({ overtimeAfterMinutes: optionalNumber(value) })} />
          <GuidedInput label="Allowed radius meters" type="number" value={numberField(attendance, 'allowedRadiusMeters', numberField(attendance, 'geofenceRadiusMeters'))} onChange={(value) => update({ allowedRadiusMeters: optionalNumber(value) })} />
          <GuidedInput label="Minimum trust score" type="number" value={numberField(attendance, 'minClockTrustScore')} onChange={(value) => update({ minClockTrustScore: optionalNumber(value) })} />
          <GuidedInput label="Rounding minutes" type="number" value={numberField(attendance, 'roundingIncrementMinutes')} onChange={(value) => update({ roundingIncrementMinutes: optionalNumber(value) })} />
          <GuidedInput label="Minimum payable minutes" type="number" value={numberField(attendance, 'minimumPayableDayMinutes')} onChange={(value) => update({ minimumPayableDayMinutes: optionalNumber(value) })} />
          <div className="grid gap-2 lg:col-span-4 md:grid-cols-4">
          <GuidedToggle label="Require geofence" checked={booleanField(attendance, 'geofenceEnabled')} onChange={(checked) => update({ geofenceEnabled: checked })} />
            <GuidedToggle label="Missing checkout blocks payroll" checked={booleanField(attendance, 'missingCheckoutBlocksPayroll')} onChange={(checked) => update({ missingCheckoutBlocksPayroll: checked })} />
            <GuidedToggle label="Duplicate punch blocks payroll" checked={booleanField(attendance, 'duplicatePunchBlocksPayroll')} onChange={(checked) => update({ duplicatePunchBlocksPayroll: checked })} />
            <GuidedToggle label="Low-trust punch blocks payroll" checked={booleanField(attendance, 'lowTrustPunchBlocksPayroll')} onChange={(checked) => update({ lowTrustPunchBlocksPayroll: checked })} />
          </div>
          {hasLegacyRadiusOnly ? (
            <div className="lg:col-span-4 rounded-lg border border-[#f59e0b]/30 bg-[#fef3c7]/50 p-3 text-sm text-[#78350f]">
              This draft uses the legacy geofence radius field.{' '}
              <Button type="button" variant="outline" className="ml-2 h-8" onClick={() => update({ allowedRadiusMeters: numberField(attendance, 'geofenceRadiusMeters') })}>
                Normalize For Runtime Engines
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (revision.area === 'PAYROLL') {
    const calculation = asRecord(draft.payrollCalculationPolicy);
    const packs = asRecords(draft.statutoryPayrollPacks);
    const earnings = asRecords(draft.earningPolicies);
    const deductions = asRecords(draft.deductionPolicies);
    const blockers = asRecords(draft.payrollBlockingRules);
    const pack = packs.find((item) => recordCode(item) === selectedPayrollPack) ?? packs[0];
    const earning = earnings.find((item) => recordCode(item) === selectedEarningPolicy) ?? earnings[0];
    const deduction = deductions.find((item) => recordCode(item) === selectedDeductionPolicy) ?? deductions[0];
    const blocker = blockers.find((item) => recordCode(item) === selectedPayrollBlocker) ?? blockers[0];
    const packCode = selectedPayrollPack || recordCode(pack) || 'DEFAULT_STATUTORY_PACK';
    const earningCode = selectedEarningPolicy || recordCode(earning) || 'TRANSPORT_ALLOWANCE';
    const deductionCode = selectedDeductionPolicy || recordCode(deduction) || 'LATE_PER_MINUTE';
    const blockerCode = selectedPayrollBlocker || recordCode(blocker) || 'ATTENDANCE_BLOCKER';
    const packCalculation = asRecord(pack?.calculationPolicy);
    const glMapping = asRecord(pack?.glAccountMapping);
    const updateCalculation = (changes: Record<string, unknown>) => commit({ type: 'PAYROLL_CALCULATION', changes });
    const updatePack = (changes: Record<string, unknown>) => commit({ type: 'PAYROLL_STATUTORY_PACK', code: packCode, changes });
    const updatePackCalculation = (changes: Record<string, unknown>) => updatePack({ calculationPolicy: { ...packCalculation, ...changes } });
    const updatePackGl = (changes: Record<string, unknown>) => updatePack({ glAccountMapping: { ...glMapping, ...changes } });
    const updateEarning = (changes: Record<string, unknown>) => commit({ type: 'PAYROLL_EARNING_POLICY', code: earningCode, changes });
    const updateDeduction = (changes: Record<string, unknown>) => commit({ type: 'PAYROLL_DEDUCTION_POLICY', code: deductionCode, changes });
    const updateBlocker = (changes: Record<string, unknown>) => commit({ type: 'PAYROLL_BLOCKER', code: blockerCode, changes });
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payroll Business Controls</CardTitle>
          <CardDescription>Calculation, statutory packs, earnings, deductions, close blockers, GL posting, and bank file readiness consumed by payroll preview and close.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <div className="mb-3 flex flex-col gap-1">
              <p className="font-semibold text-[#0f172a]">Default Calculation Policy</p>
              <p className="text-sm text-[#475569]">Fallback tax and insurance rules used when no more specific statutory pack applies.</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Tax mode</Label>
                <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={stringField(calculation, 'taxMode', 'FLAT_PERCENT')} onChange={(event) => updateCalculation({ taxMode: event.target.value })}>
                  {['FLAT_PERCENT', 'PROGRESSIVE_BRACKETS'].map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                </select>
              </div>
              <GuidedInput label="Flat tax rate %" type="number" value={numberField(calculation, 'taxRatePercent')} onChange={(value) => updateCalculation({ taxRatePercent: optionalNumber(value) })} />
              <GuidedInput label="Employee insurance %" type="number" value={numberField(calculation, 'employeeInsuranceRatePercent')} onChange={(value) => updateCalculation({ employeeInsuranceRatePercent: optionalNumber(value) })} />
              <GuidedInput label="Employer insurance %" type="number" value={numberField(calculation, 'employerInsuranceRatePercent')} onChange={(value) => updateCalculation({ employerInsuranceRatePercent: optionalNumber(value) })} />
            </div>
          </div>

          <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
            <div className="mb-3 flex flex-col gap-1">
              <p className="font-semibold text-[#0f172a]">Statutory Pack, GL, And Bank Output</p>
              <p className="text-sm text-[#475569]">Country/location payroll pack used by payroll statutory checks, GL posting preview, and bank payment batch generation.</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="space-y-1.5 lg:col-span-2">
                <Label>Statutory pack</Label>
                <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={packCode} onChange={(event) => setSelectedPayrollPack(event.target.value)}>
                  {packs.map((item) => <option key={recordCode(item)} value={recordCode(item)}>{recordLabel(item)}</option>)}
                  {packs.length === 0 ? <option value="DEFAULT_STATUTORY_PACK">New statutory pack</option> : null}
                </select>
              </div>
              <GuidedInput label="Pack label" value={stringField(pack, 'label', 'Default statutory payroll pack')} onChange={(value) => updatePack({ label: value })} />
              <GuidedInput label="Country code" value={stringField(pack, 'countryCode', 'EG')} onChange={(value) => updatePack({ countryCode: value })} />
              <GuidedInput label="Currency" value={stringField(pack, 'currency', 'EGP')} onChange={(value) => updatePack({ currency: value })} />
              <GuidedInput label="Effective from" type="date" value={stringField(pack, 'effectiveFrom')} onChange={(value) => updatePack({ effectiveFrom: value })} />
              <GuidedInput label="Location codes" value={stringArrayField(pack, 'locationCodes').join(', ')} onChange={(value) => updatePack({ locationCodes: splitCsv(value) })} />
              <GuidedInput label="Employee types" value={stringArrayField(pack, 'employeeTypes').join(', ')} onChange={(value) => updatePack({ employeeTypes: splitCsv(value) })} />
              <div className="lg:col-span-4"><GuidedToggle label="Pack active" checked={booleanField(pack, 'active', true)} onChange={(checked) => updatePack({ active: checked })} /></div>

              <div className="lg:col-span-4 grid gap-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 md:grid-cols-4">
                <GuidedInput label="Pack tax rate %" type="number" value={numberField(packCalculation, 'taxRatePercent')} onChange={(value) => updatePackCalculation({ taxRatePercent: optionalNumber(value) })} />
                <GuidedInput label="Pack employee insurance %" type="number" value={numberField(packCalculation, 'employeeInsuranceRatePercent')} onChange={(value) => updatePackCalculation({ employeeInsuranceRatePercent: optionalNumber(value) })} />
                <GuidedInput label="Employee insurance cap" type="number" value={numberField(packCalculation, 'employeeInsuranceCap')} onChange={(value) => updatePackCalculation({ employeeInsuranceCap: optionalNumber(value) })} />
                <GuidedInput label="Employer insurance cap" type="number" value={numberField(packCalculation, 'employerInsuranceCap')} onChange={(value) => updatePackCalculation({ employerInsuranceCap: optionalNumber(value) })} />
              </div>

              <div className="lg:col-span-4 grid gap-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 md:grid-cols-3">
                <GuidedInput label="Salary expense GL" value={stringField(glMapping, 'salaryExpenseAccount', '6000')} onChange={(value) => updatePackGl({ salaryExpenseAccount: value })} />
                <GuidedInput label="Tax payable GL" value={stringField(glMapping, 'taxPayableAccount', '2100')} onChange={(value) => updatePackGl({ taxPayableAccount: value })} />
                <GuidedInput label="Insurance payable GL" value={stringField(glMapping, 'insurancePayableAccount', '2110')} onChange={(value) => updatePackGl({ insurancePayableAccount: value })} />
                <GuidedInput label="Deduction payable GL" value={stringField(glMapping, 'deductionPayableAccount', '2200')} onChange={(value) => updatePackGl({ deductionPayableAccount: value })} />
                <GuidedInput label="Bank clearing GL" value={stringField(glMapping, 'bankClearingAccount', '1000')} onChange={(value) => updatePackGl({ bankClearingAccount: value })} />
                <GuidedInput label="Bank file formats" value={stringArrayField(pack, 'bankFileFormats').join(', ')} onChange={(value) => updatePack({ bankFileFormats: splitCsv(value) })} />
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
              <div className="mb-3 flex flex-col gap-1">
                <p className="font-semibold text-[#0f172a]">Earning Policies</p>
                <p className="text-sm text-[#475569]">Allowances and attendance-driven earnings consumed by payroll result-line calculation.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Earning policy</Label>
                  <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={earningCode} onChange={(event) => setSelectedEarningPolicy(event.target.value)}>
                    {earnings.map((item) => <option key={recordCode(item)} value={recordCode(item)}>{recordLabel(item)}</option>)}
                    {earnings.length === 0 ? <option value="TRANSPORT_ALLOWANCE">New earning policy</option> : null}
                  </select>
                </div>
                <GuidedInput label="Label" value={stringField(earning, 'label', 'Transport allowance')} onChange={(value) => updateEarning({ label: value })} />
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={stringField(earning, 'type', 'FIXED_AMOUNT')} onChange={(event) => updateEarning({ type: event.target.value })}>
                    {['FIXED_AMOUNT', 'PER_MINUTE', 'PERCENT_OF_BASE'].map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                  </select>
                </div>
                <GuidedInput label="Amount / rate" type="number" value={numberField(earning, 'amount')} onChange={(value) => updateEarning({ amount: optionalNumber(value) })} />
                <GuidedInput label="Attendance event" value={stringField(earning, 'attendanceEvent')} onChange={(value) => updateEarning({ attendanceEvent: value })} />
                <GuidedToggle label="Active" checked={booleanField(earning, 'active', true)} onChange={(checked) => updateEarning({ active: checked })} />
                <GuidedToggle label="Taxable" checked={booleanField(earning, 'taxable', true)} onChange={(checked) => updateEarning({ taxable: checked })} />
                <GuidedToggle label="Insurable" checked={booleanField(earning, 'insurable', true)} onChange={(checked) => updateEarning({ insurable: checked })} />
                <GuidedToggle label="Recurring" checked={booleanField(earning, 'recurring', true)} onChange={(checked) => updateEarning({ recurring: checked })} />
              </div>
            </div>

            <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
              <div className="mb-3 flex flex-col gap-1">
                <p className="font-semibold text-[#0f172a]">Deduction Policies</p>
                <p className="text-sm text-[#475569]">Late, undertime, statutory, and custom deductions consumed by payroll result-line calculation.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Deduction policy</Label>
                  <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={deductionCode} onChange={(event) => setSelectedDeductionPolicy(event.target.value)}>
                    {deductions.map((item) => <option key={recordCode(item)} value={recordCode(item)}>{recordLabel(item)}</option>)}
                    {deductions.length === 0 ? <option value="LATE_PER_MINUTE">New deduction policy</option> : null}
                  </select>
                </div>
                <GuidedInput label="Label" value={stringField(deduction, 'label', 'Late arrival deduction')} onChange={(value) => updateDeduction({ label: value })} />
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={stringField(deduction, 'type', 'PER_MINUTE')} onChange={(event) => updateDeduction({ type: event.target.value })}>
                    {['FIXED_AMOUNT', 'PER_MINUTE', 'PERCENT_OF_BASE'].map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                  </select>
                </div>
                <GuidedInput label="Amount / rate" type="number" value={numberField(deduction, 'amount')} onChange={(value) => updateDeduction({ amount: optionalNumber(value) })} />
                <GuidedInput label="Attendance event" value={stringField(deduction, 'attendanceEvent')} onChange={(value) => updateDeduction({ attendanceEvent: value })} />
                <div className="space-y-1.5">
                  <Label>Timing</Label>
                  <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={stringField(deduction, 'timing', 'POST_TAX')} onChange={(event) => updateDeduction({ timing: event.target.value })}>
                    {['PRE_TAX', 'POST_TAX'].map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                  </select>
                </div>
                <GuidedToggle label="Active" checked={booleanField(deduction, 'active', true)} onChange={(checked) => updateDeduction({ active: checked })} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <div className="mb-3 flex flex-col gap-1">
              <p className="font-semibold text-[#0f172a]">Payroll Close Blockers</p>
              <p className="text-sm text-[#475569]">Rules that block or warn before payroll close, payslip generation, GL posting, and bank batch approval.</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="space-y-1.5 lg:col-span-2">
                <Label>Close blocker</Label>
                <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={blockerCode} onChange={(event) => setSelectedPayrollBlocker(event.target.value)}>
                  {blockers.map((item) => <option key={recordCode(item)} value={recordCode(item)}>{recordLabel(item)}</option>)}
                  {blockers.length === 0 ? <option value="ATTENDANCE_BLOCKER">New attendance blocker</option> : null}
                </select>
              </div>
              <GuidedInput label="Label" value={stringField(blocker, 'label', 'Unresolved attendance blocker')} onChange={(value) => updateBlocker({ label: value })} />
              <GuidedInput label="Condition" value={stringField(blocker, 'condition', blockerCode)} onChange={(value) => updateBlocker({ condition: value })} />
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={stringField(blocker, 'severity', 'ERROR')} onChange={(event) => updateBlocker({ severity: event.target.value })}>
                  {['ERROR', 'WARNING'].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <GuidedToggle label="Active" checked={booleanField(blocker, 'active', true)} onChange={(checked) => updateBlocker({ active: checked })} />
              <GuidedToggle label="Blocks payroll close" checked={booleanField(blocker, 'blocking', true)} onChange={(checked) => updateBlocker({ blocking: checked })} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (revision.area === 'ACCESS_GOVERNANCE') {
    const governance = asRecord(draft.policyGovernance);
    const actionOverrides = asRecords(governance.allowedActionOverrides);
    const fieldOverrides = asRecords(governance.fieldAccessOverrides);
    const actionOverride = actionOverrides.find((item) => stringField(item, 'id') === selectedActionOverride) ?? actionOverrides[0];
    const fieldOverride = fieldOverrides.find((item) => stringField(item, 'id') === selectedFieldOverride) ?? fieldOverrides[0];
    const actionId = selectedActionOverride || stringField(actionOverride, 'id') || 'leave-submit-blackout';
    const fieldId = selectedFieldOverride || stringField(fieldOverride, 'id') || 'salary-mask-employee';
    const updateAction = (changes: Record<string, unknown>) => commit({
      type: 'ACCESS_ACTION_OVERRIDE',
      override: {
        id: actionId,
        active: booleanField(actionOverride, 'active', true),
        aggregateType: stringField(actionOverride, 'aggregateType', 'LeaveRequest'),
        action: stringField(actionOverride, 'action', 'SUBMIT'),
        effect: stringField(actionOverride, 'effect', 'ALLOW'),
        ...changes,
      },
    });
    const updateField = (changes: Record<string, unknown>) => commit({
      type: 'FIELD_ACCESS_OVERRIDE',
      override: {
        id: fieldId,
        active: booleanField(fieldOverride, 'active', true),
        resourceType: stringField(fieldOverride, 'resourceType', 'Worker'),
        fieldPath: stringField(fieldOverride, 'fieldPath', 'payroll.salary'),
        decision: stringField(fieldOverride, 'decision', 'MASKED'),
        ...changes,
      },
    });
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Access Governance Controls</CardTitle>
          <CardDescription>Allowed actions and field access consumed by command authorization and `/policy/allowed-actions`.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 xl:grid-cols-2">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Allowed action override</Label>
              <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={actionId} onChange={(event) => setSelectedActionOverride(event.target.value)}>
                {actionOverrides.map((item) => <option key={stringField(item, 'id')} value={stringField(item, 'id')}>{stringField(item, 'id')}</option>)}
                {actionOverrides.length === 0 ? <option value="leave-submit-blackout">New leave submit override</option> : null}
              </select>
            </div>
            <GuidedInput label="Aggregate" value={stringField(actionOverride, 'aggregateType', 'LeaveRequest')} onChange={(value) => updateAction({ aggregateType: value })} />
            <GuidedInput label="Action" value={stringField(actionOverride, 'action', 'SUBMIT')} onChange={(value) => updateAction({ action: value })} />
            <div className="space-y-1.5">
              <Label>Effect</Label>
              <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={stringField(actionOverride, 'effect', 'ALLOW')} onChange={(event) => updateAction({ effect: event.target.value })}>
                {['ALLOW', 'HIDE'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <GuidedInput label="Roles CSV" value={Array.isArray(actionOverride?.roles) ? actionOverride.roles.join(', ') : ''} onChange={(value) => updateAction({ roles: splitCsv(value) })} />
            <div className="md:col-span-2"><GuidedToggle label="Override active" checked={booleanField(actionOverride, 'active', true)} onChange={(checked) => updateAction({ active: checked })} /></div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Field access override</Label>
              <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={fieldId} onChange={(event) => setSelectedFieldOverride(event.target.value)}>
                {fieldOverrides.map((item) => <option key={stringField(item, 'id')} value={stringField(item, 'id')}>{stringField(item, 'id')}</option>)}
                {fieldOverrides.length === 0 ? <option value="salary-mask-employee">New salary mask override</option> : null}
              </select>
            </div>
            <GuidedInput label="Resource" value={stringField(fieldOverride, 'resourceType', 'Worker')} onChange={(value) => updateField({ resourceType: value })} />
            <GuidedInput label="Field path" value={stringField(fieldOverride, 'fieldPath', 'payroll.salary')} onChange={(value) => updateField({ fieldPath: value })} />
            <div className="space-y-1.5">
              <Label>Decision</Label>
              <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={stringField(fieldOverride, 'decision', 'MASKED')} onChange={(event) => updateField({ decision: event.target.value })}>
                {['VISIBLE', 'MASKED', 'HIDDEN', 'REQUIRES_STEP_UP', 'REQUIRES_BREAK_GLASS', 'DENIED'].map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
              </select>
            </div>
            <GuidedInput label="Roles CSV" value={Array.isArray(fieldOverride?.roles) ? fieldOverride.roles.join(', ') : ''} onChange={(value) => updateField({ roles: splitCsv(value) })} />
            <div className="md:col-span-2"><GuidedToggle label="Field override active" checked={booleanField(fieldOverride, 'active', true)} onChange={(checked) => updateField({ active: checked })} /></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (revision.area === 'EMPLOYEE_SETUP') {
    const fields = asRecords(draft.fieldRules);
    const documents = asRecords(draft.documentRequirements);
    const field = fields.find((item) => stringField(item, 'fieldKey') === selectedFieldKey) ?? fields[0];
    const document = documents.find((item) => recordCode(item) === selectedDocumentCode) ?? documents[0];
    const fieldKey = selectedFieldKey || stringField(field, 'fieldKey') || 'workEmail';
    const documentCode = selectedDocumentCode || recordCode(document) || 'EMPLOYMENT_CONTRACT';
    const updateField = (changes: Record<string, unknown>) => commit({ type: 'EMPLOYEE_FIELD_RULE', fieldKey, changes });
    const updateDocument = (changes: Record<string, unknown>) => commit({ type: 'DOCUMENT_REQUIREMENT', code: documentCode, changes });
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Employee Setup And Data Governance Controls</CardTitle>
          <CardDescription>Required fields and document evidence consumed by employee creation, onboarding, and digital employee file workflows.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 xl:grid-cols-2">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Profile field</Label>
              <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={fieldKey} onChange={(event) => setSelectedFieldKey(event.target.value)}>
                {fields.map((item) => <option key={stringField(item, 'fieldKey')} value={stringField(item, 'fieldKey')}>{stringField(item, 'label')} ({stringField(item, 'section')})</option>)}
                {fields.length === 0 ? <option value="workEmail">Work Email</option> : null}
              </select>
            </div>
            <GuidedInput label="Label" value={stringField(field, 'label', 'Work Email')} onChange={(value) => updateField({ label: value })} />
            <GuidedInput label="Section" value={stringField(field, 'section', 'Identity')} onChange={(value) => updateField({ section: value })} />
            <GuidedToggle label="Required" checked={booleanField(field, 'required', true)} onChange={(checked) => updateField({ required: checked })} />
            <GuidedToggle label="Active" checked={booleanField(field, 'active', true)} onChange={(checked) => updateField({ active: checked })} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Document requirement</Label>
              <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={documentCode} onChange={(event) => setSelectedDocumentCode(event.target.value)}>
                {documents.map((item) => <option key={recordCode(item)} value={recordCode(item)}>{recordLabel(item)}</option>)}
                {documents.length === 0 ? <option value="EMPLOYMENT_CONTRACT">Employment contract</option> : null}
              </select>
            </div>
            <GuidedInput label="Label" value={stringField(document, 'label', 'Employment contract')} onChange={(value) => updateDocument({ label: value })} />
            <GuidedInput label="Accepted MIME CSV" value={Array.isArray(document?.acceptedMimeTypes) ? document.acceptedMimeTypes.join(', ') : 'application/pdf'} onChange={(value) => updateDocument({ acceptedMimeTypes: splitCsv(value) })} />
            <GuidedToggle label="Required" checked={booleanField(document, 'required', true)} onChange={(checked) => updateDocument({ required: checked })} />
            <GuidedToggle label="Allow multiple" checked={booleanField(document, 'allowMultiple')} onChange={(checked) => updateDocument({ allowMultiple: checked })} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (revision.area === 'COUNTRY_POLICY') {
    const runtime = asRecord(draft.countryPolicyRuntime);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Country Policy Runtime Controls</CardTitle>
          <CardDescription>Country statutory metadata consumed by country validation, simulation, payroll statutory checks, and compliance reporting.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-4">
          <GuidedInput label="Country code" value={stringField(runtime, 'countryCode', 'EG')} onChange={(value) => commit({ type: 'COUNTRY_RUNTIME', changes: { countryCode: value } })} />
          <GuidedInput label="Pack version" value={stringField(runtime, 'packVersion', '2026.1')} onChange={(value) => commit({ type: 'COUNTRY_RUNTIME', changes: { packVersion: value } })} />
          <GuidedInput label="Effective from" type="date" value={stringField(runtime, 'effectiveFrom')} onChange={(value) => commit({ type: 'COUNTRY_RUNTIME', changes: { effectiveFrom: value } })} />
          <GuidedToggle label="Blocks payroll if stale" checked={booleanField(runtime, 'blocksPayrollIfStale', true)} onChange={(checked) => commit({ type: 'COUNTRY_RUNTIME', changes: { blocksPayrollIfStale: checked } })} />
        </CardContent>
      </Card>
    );
  }

  const complianceRuntime = asRecord(draft.compliancePolicyRuntime);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Compliance Runtime Controls</CardTitle>
        <CardDescription>Policy documents, acknowledgements, legal holds, retention, and statutory reporting behavior.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-4">
        <GuidedInput label="Policy family" value={stringField(complianceRuntime, 'policyFamily', 'CODE_OF_CONDUCT')} onChange={(value) => commit({ type: 'COMPLIANCE_RUNTIME', changes: { policyFamily: value } })} />
        <GuidedInput label="Retention class" value={stringField(complianceRuntime, 'retentionClass', 'EXTENDED')} onChange={(value) => commit({ type: 'COMPLIANCE_RUNTIME', changes: { retentionClass: value } })} />
        <GuidedInput label="Acknowledgement due days" type="number" value={numberField(complianceRuntime, 'acknowledgementDueDays', 7)} onChange={(value) => commit({ type: 'COMPLIANCE_RUNTIME', changes: { acknowledgementDueDays: optionalNumber(value) } })} />
        <GuidedToggle label="Employee acknowledgement required" checked={booleanField(complianceRuntime, 'acknowledgementRequired', true)} onChange={(checked) => commit({ type: 'COMPLIANCE_RUNTIME', changes: { acknowledgementRequired: checked } })} />
      </CardContent>
    </Card>
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
  const lens = getPolicyControlLens(area);
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
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <MiniList title="Controls" icon={SlidersHorizontal} items={lens.controls} />
            <MiniList title="Runtime Consumers" icon={Users} items={lens.serviceConsumers} />
            <MiniList title="Notifications" icon={BellRing} items={lens.notificationEvents} />
          </div>
          <RevisionList revisions={revisions} selectedId={selectedId} onSelect={onSelect} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Applied Runtime Summary</CardTitle>
          <CardDescription>Business records generated from applied revisions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RuntimeSnapshotSummary area={area} setup={setup} />
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
  const evidenceQuery = useQuery({
    queryKey: ['admin-policy-decision-evidence'],
    queryFn: async () => unwrap<PolicyDecisionEvidence[]>(await apiClient.get('/admin/policies/decision-evidence?limit=50')),
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
  }, [selectedRevision?.id, selectedRevision?.updatedAt]);

  const invalidatePolicies = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-policy-summary'] });
    queryClient.invalidateQueries({ queryKey: ['admin-policy-revisions'] });
    queryClient.invalidateQueries({ queryKey: ['admin-policy-hcm-setup'] });
    queryClient.invalidateQueries({ queryKey: ['admin-policy-decision-evidence'] });
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
      return unwrap<PolicyRevision | PolicyValidationResult | PolicySimulationResult>(await apiClient.post(policyCommandPath(id, command)));
    },
    onSuccess: (_result, variables) => {
      invalidatePolicies();
      addNotification({ title: 'Command executed', message: `The "${variables.command.replace(/-/g, ' ')}" command completed.`, type: 'success', read: false });
    },
    onError: (mutationError) => notifyError(mutationError, 'Unable to run the policy command.'),
  });

  const controlledApply = useMutation({
    mutationFn: async () => {
      if (!selectedRevision) throw new Error('Select a policy revision first.');
      const commands = getControlledApplyCommands(selectedRevision.status);
      if (commands.length === 0) throw new Error('This policy revision is already applied or cannot be applied.');

      let currentRevision = selectedRevision;
      if (['DRAFT', 'IN_REVIEW', 'REVIEWED'].includes(selectedRevision.status)) {
        currentRevision = unwrap<PolicyRevision>(await apiClient.patch(`/admin/policies/revisions/${selectedRevision.id}`, {
          title: editorTitle,
          scope: formToScope(editorScope),
          draftConfig: normalizePolicyDraftForRuntime(selectedRevision.area, parseJson(editorJson)),
        }));
      }

      for (const command of commands) {
        const result = unwrap<PolicyRevision | PolicyValidationResult | PolicySimulationResult>(
          await apiClient.post(policyCommandPath(currentRevision.id, command)),
        );
        if (command === 'validate' && 'valid' in result && !result.valid) {
          throw new Error(`Policy validation blocked apply: ${result.errors.join(' ')}`);
        }
        if ('status' in result) {
          currentRevision = result;
        }
      }

      return currentRevision;
    },
    onSuccess: (revision) => {
      setSelectedId(revision.id);
      invalidatePolicies();
      addNotification({ title: 'Policy applied', message: 'The controlled lifecycle completed and the runtime snapshot was updated.', type: 'success', read: false });
    },
    onError: (mutationError) => notifyError(mutationError, 'Unable to complete controlled policy apply.'),
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
        draftConfig: normalizePolicyDraftForRuntime(selectedRevision.area, parseJson(editorJson)),
      });
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Invalid policy draft data.');
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
                    Policy Brain And Lifecycle
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-[#4f46e5]" />
                  Full System Policy Control Matrix
                </CardTitle>
                <CardDescription>Every governed service area shows the engines, runtime keys, consumers, and notifications controlled from this center.</CardDescription>
              </CardHeader>
              <CardContent>
                <PolicyControlMatrix revisions={revisions} />
              </CardContent>
            </Card>
            <WholeSystemPolicyCoverage revisions={revisions} />
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
                <div className="space-y-3">
                  <div className="rounded-lg border border-[#e2e8f0] bg-[#f6f7fb] p-4 text-sm leading-6 text-[#475569]">
                    <p className="font-semibold text-[#0f172a]">Decision Evidence</p>
                    <p className="mt-2">Apply writes structured evidence with revision ID, scope match, engine name/version, decision, and reason. Lifecycle commands also emit outbox/audit events.</p>
                  </div>
                  {(evidenceQuery.data ?? [])
                    .filter((item) => !selectedRevision || item.policyRevisionId === selectedRevision.id)
                    .slice(0, 6)
                    .map((item) => (
                      <div key={item.id} className="fusion-glass rounded-2xl p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-[#0f172a]">{item.decision}</span>
                          <span className="font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">{item.serviceArea}</span>
                        </div>
                        <p className="mt-1 text-[#475569]">{item.engineName} {item.engineVersion}</p>
                        <p className="mt-2 text-[#64748b]">{item.reason}</p>
                      </div>
                    ))}
                  {((evidenceQuery.data ?? []).filter((item) => !selectedRevision || item.policyRevisionId === selectedRevision.id).length === 0) ? (
                    <p className="text-sm text-[#94a3b8]">No decision evidence for the selected revision yet.</p>
                  ) : null}
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
              <PolicyRuntimeLens revision={selectedRevision} evidence={evidenceQuery.data ?? []} />
              <PolicyBusinessControls
                revision={selectedRevision}
                editorJson={editorJson}
                setEditorJson={setEditorJson}
                setEditorError={setEditorError}
              />
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CheckCircle2 className="h-5 w-5 text-[#4f46e5]" />
                      Controlled Apply
                    </CardTitle>
                    <CardDescription>Runs save, validation, simulation, lifecycle approval, publish, and apply through the governed API path.</CardDescription>
                  </div>
                  <Button
                    type="button"
                    disabled={controlledApply.isPending || getControlledApplyCommands(selectedRevision.status).length === 0}
                    onClick={() => controlledApply.mutate()}
                  >
                    {controlledApply.isPending ? 'Applying...' : 'Run Controlled Apply'}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {getControlledApplyCommands(selectedRevision.status).map((command) => (
                      <span key={command} className="rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-3 py-1 text-xs font-semibold text-[#312e81]">
                        {formatEnum(command)}
                      </span>
                    ))}
                    {getControlledApplyCommands(selectedRevision.status).length === 0 ? (
                      <span className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1 text-xs font-semibold text-[#64748b]">
                        No apply action available from {formatEnum(selectedRevision.status)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-[#475569]">
                    The wizard does not write directly to runtime. It calls the same lifecycle endpoints as the manual buttons, so audit, outbox events, notifications, application runs, and decision evidence remain intact.
                  </p>
                </CardContent>
              </Card>
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
