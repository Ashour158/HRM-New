import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileDiff,
  FileText,
  GitBranch,
  HeartPulse,
  Landmark,
  ListChecks,
  LockKeyhole,
  PlayCircle,
  Radar,
  RotateCcw,
  Save,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Umbrella,
  Users,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState } from '@/components/common/error-state';
import { BusinessPageHeader } from '@/components/common/business-page';
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

type DomainPolicySimulation = {
  ruleCodes: string[];
  scopeDimensions: string[];
  workflowImpacts: Array<{ ruleCode: string; action: string; risk: PolicyImpactRisk }>;
  revalidationQueues: string[];
};

type PolicySimulationResult = {
  impactedEmployees: number;
  impactedWorkerIds: string[];
  impactedRecords: {
    workers: Array<{
      workerId: string;
      displayName?: string;
      employeeNumber?: string;
      managerWorkerId?: string;
      departmentId?: string;
      legalEntityId?: string;
      countryCode?: string;
      beforeDecision: string;
      afterDecision: string;
      risk: PolicyImpactRisk;
    }>;
    leaveRequests: PolicyImpactRecord[];
    attendanceDays: PolicyImpactRecord[];
    payrollCycles: PolicyImpactRecord[];
    complianceAcknowledgements: PolicyImpactRecord[];
    accessGrants: PolicyImpactRecord[];
  };
  notificationPreview: {
    recipients: Array<{
      audience: string;
      workerId?: string;
      role?: string;
      title: string;
      body: string;
      channel: string;
      privacyLevel: string;
    }>;
    truncated: boolean;
    totalRecipients: number;
  };
  riskSummary: {
    safe: number;
    warning: number;
    blocked: number;
    retroactiveAdjustmentRequired: number;
  };
  pendingRecords: {
    pendingLeaveRequests: number;
    openAttendanceDays: number;
    openPayrollCycles: number;
    pendingComplianceAcknowledgements: number;
  };
  oldDataRule: string;
  newDataRule: string;
  retroactiveRule: string;
  payrollComponentSimulation?: {
    componentCodes: string[];
    calculationInputs: Array<{
      componentCode: string;
      ledgerRuleCode?: string;
      source?: string;
      base?: string;
      method?: string;
      amount?: number;
      ratePercent?: number;
      monthlyCap?: number;
      minimumNetPay?: number;
    }>;
    glPostingPreview: Array<{
      componentCode: string;
      payslipLineType?: string;
      glAccount?: string;
      missingPosting: boolean;
    }>;
    retroAdjustments: Array<{
      componentCode: string;
      behavior?: string;
      action: string;
    }>;
    estimatedGrossDelta: number;
    estimatedTaxableDelta: number;
    estimatedInsurableDelta: number;
    estimatedEmployeeDeductionDelta: number;
    estimatedEmployerCostDelta: number;
    estimatedNetPayDelta: number;
    blockedPayrollCycleIds: string[];
  };
  leavePolicySimulation?: DomainPolicySimulation & {
    accrualRuleCodes: string[];
    approvalWorkflows: string[];
    payrollImpactCodes: string[];
  };
  attendancePolicySimulation?: DomainPolicySimulation & {
    geofenceRuleCodes: string[];
    ledgerRuleCodes: string[];
    payrollBridgeCodes: string[];
  };
  accessPolicySimulation?: DomainPolicySimulation & {
    actionOverrideIds: string[];
    fieldOverrideIds: string[];
    sodRuleCodes: string[];
  };
  compliancePolicySimulation?: DomainPolicySimulation & {
    acknowledgementRules: string[];
    retentionClasses: string[];
    legalHoldRules: string[];
  };
  benefitsPolicySimulation?: DomainPolicySimulation & {
    payrollBridgeCodes: string[];
    enrollmentWindows: Array<{ ruleCode: string; waitingPeriodDays: number }>;
    carrierExportRules: string[];
  };
  warnings: string[];
  engineName: string;
  engineVersion: string;
};

type PolicyImpactRisk = 'SAFE' | 'WARNING' | 'BLOCKED' | 'RETROACTIVE_ADJUSTMENT_REQUIRED';

type PolicyImpactRecord = {
  recordId: string;
  workerId?: string;
  status?: string;
  beforeDecision: string;
  afterDecision: string;
  risk: PolicyImpactRisk;
};

type PolicyTemplate = {
  area: PolicyArea;
  code: string;
  title: string;
  description: string;
  draftConfig: Record<string, unknown>;
  recommendedScope: PolicyScope;
};

type PolicyRevisionDiff = {
  area: PolicyArea;
  leftRevisionId: string;
  rightRevisionId: string;
  changes: Array<{
    key: string;
    label: string;
    before: unknown;
    after: unknown;
    changeType: 'ADDED' | 'REMOVED' | 'CHANGED';
    risk: PolicyImpactRisk;
  }>;
};

type PolicyImportDryRun = {
  valid: boolean;
  revisions: Array<{
    title: string;
    area: PolicyArea;
    action: string;
    validation: PolicyValidationResult;
  }>;
  errors: string[];
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
  { area: 'EMPLOYEE_SETUP', label: 'Service Rules', icon: SlidersHorizontal, link: '/admin/system-console/settings' },
  { area: 'LEAVE', label: 'Leave Rules', icon: Umbrella, link: '/admin/leave' },
  { area: 'ATTENDANCE', label: 'Attendance Rules', icon: Radar, link: '/admin/attendance' },
  { area: 'PAYROLL', label: 'Payroll Rules', icon: Scale, link: '/admin/payroll' },
  { area: 'ACCESS_GOVERNANCE', label: 'Access Rules', icon: LockKeyhole },
  { area: 'COUNTRY_POLICY', label: 'Country Rules', icon: Landmark, link: '/admin/country-policy' },
  { area: 'COMPLIANCE', label: 'Compliance Rules', icon: ClipboardCheck, link: '/admin/compliance' },
  { area: 'BENEFITS', label: 'Benefits Rules', icon: HeartPulse, link: '/admin/modules/benefits/operations' },
  { area: 'GLOBAL_HR', label: 'Global HR Rules', icon: Landmark, link: '/admin/modules/global-hr/operations' },
  { area: 'DEI_ANALYTICS', label: 'DEI Rules', icon: Users, link: '/admin/modules/dei-analytics/operations' },
  { area: 'ENGAGEMENT', label: 'Engagement Rules', icon: BellRing, link: '/admin/modules/engagement/operations' },
];

const areaTabValues: Record<PolicyArea, string> = {
  EMPLOYEE_SETUP: 'service',
  LEAVE: 'leave',
  ATTENDANCE: 'attendance',
  PAYROLL: 'payroll',
  ACCESS_GOVERNANCE: 'access',
  COUNTRY_POLICY: 'country',
  COMPLIANCE: 'compliance',
  BENEFITS: 'benefits',
  GLOBAL_HR: 'global-hr',
  DEI_ANALYTICS: 'dei',
  ENGAGEMENT: 'engagement',
};

const tabAreas = Object.fromEntries(Object.entries(areaTabValues).map(([area, tab]) => [tab, area])) as Record<string, PolicyArea>;

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

function riskTone(risk: PolicyImpactRisk | string | undefined) {
  if (risk === 'BLOCKED') return 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/30';
  if (risk === 'WARNING' || risk === 'RETROACTIVE_ADJUSTMENT_REQUIRED') return 'bg-[#f59e0b]/10 text-[#92400e] border-[#f59e0b]/30';
  return 'bg-[#059669]/10 text-[#047857] border-[#059669]/30';
}

function displayValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function areaMeta(area: PolicyArea) {
  return policyAreas.find((item) => item.area === area) ?? policyAreas[0];
}

function isRevisionEditable(status: PolicyStatus) {
  return ['DRAFT', 'IN_REVIEW', 'REVIEWED'].includes(status);
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
  if (area === 'BENEFITS') return { benefitsPolicyRuntime: setup.benefitsPolicyRuntime ?? {} };
  if (area === 'GLOBAL_HR') return { runtimePolicyRevisions: setup.runtimePolicyRevisions ?? [], globalHrPolicyRuntime: setup.globalHrPolicyRuntime ?? {} };
  if (area === 'DEI_ANALYTICS') return { runtimePolicyRevisions: setup.runtimePolicyRevisions ?? [], deiAnalyticsPolicyRuntime: setup.deiAnalyticsPolicyRuntime ?? {} };
  if (area === 'ENGAGEMENT') return { runtimePolicyRevisions: setup.runtimePolicyRevisions ?? [], engagementPolicyRuntime: setup.engagementPolicyRuntime ?? {} };
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

function keepExistingSelection(
  current: string,
  records: Record<string, unknown>[],
  idForRecord: (record: Record<string, unknown>) => string
) {
  const ids = records.map(idForRecord).filter(Boolean);
  return current && ids.includes(current) ? current : ids[0] ?? '';
}

function recordLabel(record: Record<string, unknown> | undefined) {
  const code = recordCode(record);
  const label = stringField(record, 'label');
  return label ? `${label} (${code})` : code;
}

function firstLedgerRecord(records: unknown, fallbackCode: string, fallbackLabel: string) {
  return asRecords(records)[0] ?? { code: fallbackCode, label: fallbackLabel, active: true, outcomes: [] };
}

function upsertFirstLedgerRecord(records: unknown, fallbackCode: string, fallbackLabel: string, changes: Record<string, unknown>) {
  const rows = asRecords(records);
  const selected = rows[0] ?? { code: fallbackCode, label: fallbackLabel, active: true, outcomes: [] };
  return rows.length > 0
    ? rows.map((row, index) => index === 0 ? { ...selected, ...changes } : row)
    : [{ ...selected, ...changes }];
}

function pendingRecordTotal(records?: PolicySimulationResult['pendingRecords']) {
  if (!records) return 0;
  return Object.values(records).reduce((total, value) => total + value, 0);
}

function ScopeInputs({ value, onChange, disabled = false }: { value: ScopeForm; onChange: (next: ScopeForm) => void; disabled?: boolean }) {
  const update = (key: keyof ScopeForm, nextValue: string) => onChange({ ...value, [key]: nextValue });
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor="policy-countries">Countries</Label>
        <Input id="policy-countries" disabled={disabled} placeholder="EG, AE" value={value.countryCodes} onChange={(event) => update('countryCodes', event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="policy-legal">Legal entities</Label>
        <Input id="policy-legal" disabled={disabled} placeholder="UUIDs or codes" value={value.legalEntityIds} onChange={(event) => update('legalEntityIds', event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="policy-units">Org units</Label>
        <Input id="policy-units" disabled={disabled} placeholder="Unit IDs" value={value.orgUnitIds} onChange={(event) => update('orgUnitIds', event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="policy-departments">Departments</Label>
        <Input id="policy-departments" disabled={disabled} placeholder="Department IDs" value={value.departmentIds} onChange={(event) => update('departmentIds', event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="policy-locations">Locations</Label>
        <Input id="policy-locations" disabled={disabled} placeholder="CAIRO_HQ" value={value.locationCodes} onChange={(event) => update('locationCodes', event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="policy-types">Employee types</Label>
        <Input id="policy-types" disabled={disabled} placeholder="FULL_TIME" value={value.employeeTypes} onChange={(event) => update('employeeTypes', event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="policy-workers">Workers</Label>
        <Input id="policy-workers" disabled={disabled} placeholder="Worker IDs" value={value.workerIds} onChange={(event) => update('workerIds', event.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="policy-from">From</Label>
          <Input id="policy-from" disabled={disabled} type="date" value={value.effectiveFrom} onChange={(event) => update('effectiveFrom', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="policy-until">Until</Label>
          <Input id="policy-until" disabled={disabled} type="date" value={value.effectiveUntil} onChange={(event) => update('effectiveUntil', event.target.value)} />
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

function ImpactRecordList({
  title,
  records,
  empty,
}: {
  title: string;
  records: Array<PolicyImpactRecord | NonNullable<PolicySimulationResult['impactedRecords']>['workers'][number]>;
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white">
      <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-[#0f172a]">{title}</div>
      <div className="max-h-56 overflow-y-auto divide-y divide-[#e2e8f0]">
        {records.slice(0, 8).map((record, index) => {
          const id = 'workerId' in record ? record.workerId : record.recordId;
          const label = 'displayName' in record && record.displayName ? record.displayName : id;
          return (
            <div key={`${id}-${index}`} className="p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#0f172a]">{label}</span>
                <Badge className={riskTone(record.risk)}>{formatEnum(record.risk)}</Badge>
              </div>
              <p className="mt-1 text-[#64748b]">{record.beforeDecision}</p>
              <p className="mt-1 text-[#475569]">{record.afterDecision}</p>
            </div>
          );
        })}
        {records.length === 0 ? <p className="p-3 text-sm text-[#94a3b8]">{empty}</p> : null}
      </div>
    </div>
  );
}

function DomainSimulationCard({
  title,
  simulation,
  highlights,
}: {
  title: string;
  simulation?: DomainPolicySimulation;
  highlights?: Array<{ label: string; value: string | number }>;
}) {
  if (!simulation) return null;
  return (
    <div className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff] p-4">
      <div className="mb-3 flex flex-col gap-1">
        <p className="font-semibold text-[#0f172a]">{title}</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        {[
          ['Rules', simulation.ruleCodes.length],
          ['Scopes', simulation.scopeDimensions.length],
          ['Approvals', simulation.workflowImpacts.length],
          ['Records', simulation.revalidationQueues.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white p-3">
            <p className="text-xs uppercase tracking-wider text-[#64748b]">{label}</p>
            <p className="text-xl font-bold text-[#0f172a]">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <div className="rounded-lg border border-[#cbd5e1] bg-white">
          <div className="border-b border-[#e2e8f0] px-3 py-2 text-sm font-semibold text-[#0f172a]">Rules</div>
          <div className="max-h-44 overflow-y-auto p-3 text-xs text-[#475569]">{simulation.ruleCodes.length > 0 ? simulation.ruleCodes.join(', ') : 'No rules detected.'}</div>
        </div>
        <div className="rounded-lg border border-[#cbd5e1] bg-white">
          <div className="border-b border-[#e2e8f0] px-3 py-2 text-sm font-semibold text-[#0f172a]">Approval Impact</div>
          <div className="max-h-44 overflow-y-auto divide-y divide-[#e2e8f0]">
            {simulation.workflowImpacts.map((impact, index) => (
              <div key={`${impact.ruleCode}-${index}`} className="p-3 text-xs text-[#475569]">
                <p className="font-semibold text-[#0f172a]">{impact.ruleCode}</p>
                <p>{impact.action}</p>
                <Badge className={riskTone(impact.risk)}>{formatEnum(impact.risk)}</Badge>
              </div>
            ))}
            {simulation.workflowImpacts.length === 0 ? <p className="p-3 text-xs text-[#64748b]">No approval changes detected.</p> : null}
          </div>
        </div>
        <div className="rounded-lg border border-[#cbd5e1] bg-white">
          <div className="border-b border-[#e2e8f0] px-3 py-2 text-sm font-semibold text-[#0f172a]">Domain Highlights</div>
          <div className="max-h-44 overflow-y-auto divide-y divide-[#e2e8f0]">
            {(highlights ?? []).map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 p-3 text-xs">
                <span className="font-semibold text-[#0f172a]">{item.label}</span>
                <span className="text-[#475569]">{item.value}</span>
              </div>
            ))}
            {(highlights ?? []).length === 0 ? <p className="p-3 text-xs text-[#64748b]">No domain-specific highlights yet.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ImpactPanel({ revision }: { revision?: PolicyRevision }) {
  const validation = revision?.validationResult;
  const simulation = revision?.simulationResult;
  const risk = simulation?.riskSummary;
  const impactedRecords = simulation?.impactedRecords;
  const notificationPreview = simulation?.notificationPreview;
  const payrollSimulation = simulation?.payrollComponentSimulation;
  const domainSimulation =
    simulation?.leavePolicySimulation ??
    simulation?.attendancePolicySimulation ??
    simulation?.accessPolicySimulation ??
    simulation?.compliancePolicySimulation ??
    simulation?.benefitsPolicySimulation;
  const domainSimulationTitle = revision?.area === 'LEAVE'
    ? 'Leave Rule Ledger Simulation'
    : revision?.area === 'ATTENDANCE'
      ? 'Attendance Rule Ledger Simulation'
      : revision?.area === 'ACCESS_GOVERNANCE'
        ? 'Access Governance Rule Simulation'
        : revision?.area === 'COMPLIANCE'
          ? 'Compliance Rule Ledger Simulation'
          : revision?.area === 'BENEFITS'
            ? 'Benefits Eligibility And Payroll Bridge Simulation'
            : 'Policy Rule Ledger Simulation';
  const domainHighlights = [
    ...(simulation?.leavePolicySimulation ? [
      { label: 'Accrual rules', value: simulation.leavePolicySimulation.accrualRuleCodes.length },
      { label: 'Approval workflows', value: simulation.leavePolicySimulation.approvalWorkflows.join(', ') || '-' },
      { label: 'Payroll impacts', value: simulation.leavePolicySimulation.payrollImpactCodes.join(', ') || '-' },
    ] : []),
    ...(simulation?.attendancePolicySimulation ? [
      { label: 'Geofence rules', value: simulation.attendancePolicySimulation.geofenceRuleCodes.length },
      { label: 'Ledger rules', value: simulation.attendancePolicySimulation.ledgerRuleCodes.length },
      { label: 'Payroll bridges', value: simulation.attendancePolicySimulation.payrollBridgeCodes.join(', ') || '-' },
    ] : []),
    ...(simulation?.accessPolicySimulation ? [
      { label: 'Action overrides', value: simulation.accessPolicySimulation.actionOverrideIds.length },
      { label: 'Field overrides', value: simulation.accessPolicySimulation.fieldOverrideIds.length },
      { label: 'SoD rules', value: simulation.accessPolicySimulation.sodRuleCodes.length },
    ] : []),
    ...(simulation?.compliancePolicySimulation ? [
      { label: 'Acknowledgement rules', value: simulation.compliancePolicySimulation.acknowledgementRules.length },
      { label: 'Retention classes', value: simulation.compliancePolicySimulation.retentionClasses.join(', ') || '-' },
      { label: 'Legal hold rules', value: simulation.compliancePolicySimulation.legalHoldRules.length },
    ] : []),
    ...(simulation?.benefitsPolicySimulation ? [
      { label: 'Payroll bridges', value: simulation.benefitsPolicySimulation.payrollBridgeCodes.join(', ') || '-' },
      { label: 'Enrollment windows', value: simulation.benefitsPolicySimulation.enrollmentWindows.map((window) => `${window.ruleCode}: ${window.waitingPeriodDays}d`).join(', ') || '-' },
      { label: 'Carrier export rules', value: simulation.benefitsPolicySimulation.carrierExportRules.length },
    ] : []),
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-[#4f46e5]" />
              Validation
            </CardTitle>
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
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[#475569]">
            <div className="text-3xl font-bold text-[#0f172a]">{simulation?.impactedEmployees ?? 0}</div>
            <p>employees in scope</p>
            <p>{pendingRecordTotal(simulation?.pendingRecords)} pending/open records flagged</p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              {[
                ['Safe', risk?.safe ?? 0, 'SAFE'],
                ['Warning', risk?.warning ?? 0, 'WARNING'],
                ['Blocked', risk?.blocked ?? 0, 'BLOCKED'],
                ['Retro', risk?.retroactiveAdjustmentRequired ?? 0, 'RETROACTIVE_ADJUSTMENT_REQUIRED'],
              ].map(([label, value, tone]) => (
                <div key={label} className={cn('rounded-lg border px-3 py-2', riskTone(tone as string))}>
                  <p className="font-mono text-[11px] uppercase tracking-wider">{label}</p>
                  <p className="text-xl font-bold">{value}</p>
                </div>
              ))}
            </div>
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
      {payrollSimulation ? (
        <div className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff] p-4">
          <div className="mb-3 flex flex-col gap-1">
            <p className="font-semibold text-[#0f172a]">Payroll Component Simulation</p>
            <p className="text-sm text-[#475569]">Exact earning/deduction component inputs, posting gaps, and retro behavior detected before apply.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wider text-[#64748b]">Gross delta</p>
              <p className="text-xl font-bold text-[#0f172a]">{payrollSimulation.estimatedGrossDelta}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wider text-[#64748b]">Deduction delta</p>
              <p className="text-xl font-bold text-[#0f172a]">{payrollSimulation.estimatedEmployeeDeductionDelta}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wider text-[#64748b]">Net delta</p>
              <p className="text-xl font-bold text-[#0f172a]">{payrollSimulation.estimatedNetPayDelta}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wider text-[#64748b]">Components</p>
              <p className="text-xl font-bold text-[#0f172a]">{payrollSimulation.componentCodes.length}</p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <div className="rounded-lg border border-[#cbd5e1] bg-white">
              <div className="border-b border-[#e2e8f0] px-3 py-2 text-sm font-semibold text-[#0f172a]">Calculation Inputs</div>
              <div className="max-h-56 overflow-y-auto divide-y divide-[#e2e8f0]">
                {payrollSimulation.calculationInputs.map((input, index) => (
                  <div key={`${input.componentCode}-${input.ledgerRuleCode ?? index}`} className="p-3 text-xs text-[#475569]">
                    <p className="font-semibold text-[#0f172a]">{input.componentCode}</p>
                    <p>{input.source} / {input.base} / {input.method}</p>
                    <p>Amount {input.amount ?? 0} · Rate {input.ratePercent ?? 0}% · Cap {input.monthlyCap ?? 0}</p>
                    {input.minimumNetPay !== undefined ? <p>Minimum net protection: {input.minimumNetPay}</p> : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[#cbd5e1] bg-white">
              <div className="border-b border-[#e2e8f0] px-3 py-2 text-sm font-semibold text-[#0f172a]">GL Posting Preview</div>
              <div className="max-h-56 overflow-y-auto divide-y divide-[#e2e8f0]">
                {payrollSimulation.glPostingPreview.map((posting, index) => (
                  <div key={`${posting.componentCode}-${posting.glAccount ?? index}`} className={cn('p-3 text-xs', posting.missingPosting ? 'text-[#b45309]' : 'text-[#475569]')}>
                    <p className="font-semibold text-[#0f172a]">{posting.componentCode}</p>
                    <p>{posting.payslipLineType ?? 'No payslip type'} · {posting.glAccount ?? 'Missing GL account'}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[#cbd5e1] bg-white">
              <div className="border-b border-[#e2e8f0] px-3 py-2 text-sm font-semibold text-[#0f172a]">Retro And Blockers</div>
              <div className="max-h-56 overflow-y-auto divide-y divide-[#e2e8f0]">
                {payrollSimulation.retroAdjustments.map((adjustment, index) => (
                  <div key={`${adjustment.componentCode}-${index}`} className="p-3 text-xs text-[#475569]">
                    <p className="font-semibold text-[#0f172a]">{adjustment.componentCode}</p>
                    <p>{formatEnum(adjustment.behavior ?? 'REVIEW')}</p>
                    <p>{adjustment.action}</p>
                  </div>
                ))}
                {payrollSimulation.blockedPayrollCycleIds.map((id) => <p key={id} className="p-3 text-xs text-[#b45309]">{id}</p>)}
                {payrollSimulation.retroAdjustments.length === 0 && payrollSimulation.blockedPayrollCycleIds.length === 0 ? <p className="p-3 text-xs text-[#64748b]">No retro adjustments or payroll blockers detected.</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <DomainSimulationCard title={domainSimulationTitle} simulation={domainSimulation} highlights={domainHighlights} />
      <div className="grid gap-4 xl:grid-cols-2">
        <ImpactRecordList title="Impacted Employees" records={impactedRecords?.workers ?? []} empty="Run simulation to see exact employees." />
        <ImpactRecordList title="Open Leave And Payroll Records" records={[...(impactedRecords?.leaveRequests ?? []), ...(impactedRecords?.payrollCycles ?? [])]} empty="No open leave or payroll records flagged." />
        <ImpactRecordList title="Attendance And Compliance Records" records={[...(impactedRecords?.attendanceDays ?? []), ...(impactedRecords?.complianceAcknowledgements ?? [])]} empty="No attendance or compliance records flagged." />
        <div className="rounded-lg border border-[#e2e8f0] bg-white">
          <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-[#0f172a]">Notification Preview</div>
          <div className="max-h-56 overflow-y-auto divide-y divide-[#e2e8f0]">
            {(notificationPreview?.recipients ?? []).slice(0, 8).map((recipient, index) => (
              <div key={`${recipient.audience}-${recipient.workerId ?? recipient.role ?? index}`} className="p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#0f172a]">{recipient.title}</span>
                  <Badge className="bg-[#eef2ff] text-[#312e81]">{recipient.audience}</Badge>
                </div>
                <p className="mt-1 text-[#475569]">{recipient.body}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">{recipient.channel} - {recipient.privacyLevel}</p>
              </div>
            ))}
            {(notificationPreview?.recipients ?? []).length === 0 ? <p className="p-3 text-sm text-[#94a3b8]">Run simulation to preview impacted users and notifications.</p> : null}
          </div>
          {notificationPreview?.truncated ? <p className="border-t border-[#e2e8f0] p-3 text-xs text-[#92400e]">Preview is truncated. Total recipients: {notificationPreview.totalRecipients}</p> : null}
        </div>
      </div>
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
                </div>
                <div className="shrink-0 text-right">
                  <Badge className={applied > 0 ? 'bg-[#4f46e5] text-white' : 'bg-[#e2e8f0] text-[#475569]'}>
                    {applied} applied
                  </Badge>
                  <p className="mt-1 text-xs font-semibold text-[#64748b]">{open} in progress</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <MiniList title="Controls" icon={SlidersHorizontal} items={lens.controls} />
              <MiniList title="Used By" icon={Users} items={lens.serviceConsumers} />
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
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-[#eef2ff] text-xs font-semibold uppercase tracking-wide text-[#475569]">
              <tr>
                <th className="p-3">Module</th>
                <th className="p-3">Governing Area</th>
                <th className="p-3">Policy Control</th>
                <th className="p-3 text-center">Status</th>
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
                    <td className="p-3 text-center">
                      <Badge className={applied ? 'bg-[#4f46e5] text-white' : 'bg-[#e2e8f0] text-[#475569]'}>
                        {applied ? 'Active' : 'Not active'}
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
            <SlidersHorizontal className="h-5 w-5 text-[#4f46e5]" />
            {lens.label} Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <MiniList title="Business Controls" icon={SlidersHorizontal} items={lens.controls} />
          <MiniList title="Used By" icon={Users} items={lens.serviceConsumers} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Decisions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {latestEvidence.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-[#0f172a]">{item.decision}</span>
                <span className="font-mono text-[11px] text-[#94a3b8]">{displayDate(item.createdAt)}</span>
              </div>
              <p className="mt-2 text-[#64748b]">{item.reason}</p>
            </div>
          ))}
          {latestEvidence.length === 0 ? <p className="text-sm text-[#94a3b8]">No policy decisions have been recorded for this revision yet.</p> : null}
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
      `${earnings.length} earning rules`,
      `${deductions.length} deduction rules`,
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
  } else if (area === 'COMPLIANCE') {
    const runtime = asRecord(snapshot.compliancePolicyRuntime);
    facts.push(['Policy family', stringField(runtime, 'policyFamily', 'Not set')], ['Retention', stringField(runtime, 'retentionClass', 'Not set')]);
    facts.push(['Acknowledgement due', `${numberField(runtime, 'acknowledgementDueDays', 0)} days`]);
    highlights.push(`${booleanField(runtime, 'acknowledgementRequired', true) ? 'Employee acknowledgement required' : 'No employee acknowledgement required'}`);
  } else if (area === 'BENEFITS') {
    const runtime = asRecord(snapshot.benefitsPolicyRuntime);
    const eligibility = asRecords(runtime.eligibilityRules);
    const enrollment = asRecords(runtime.enrollmentWindowRules);
    const contributions = asRecords(runtime.contributionRules);
    const carriers = asRecords(runtime.carrierExportRules);
    facts.push(['Eligibility rules', eligibility.length], ['Enrollment windows', enrollment.length]);
    facts.push(['Contribution rules', contributions.length], ['Carrier exports', carriers.length]);
    highlights.push(
      ...eligibility.slice(0, 3).map((item) => `${recordLabel(item)} eligibility`),
      ...enrollment.slice(0, 3).map((item) => `${recordLabel(item)} enrollment window`),
      ...contributions.slice(0, 2).map((item) => `${recordLabel(item)} payroll bridge`),
      ...carriers.slice(0, 2).map((item) => `${recordLabel(item)} carrier export`),
    );
  } else if (area === 'GLOBAL_HR') {
    const runtime = asRecord(snapshot.globalHrPolicyRuntime);
    const applied = asRecords(snapshot.runtimePolicyRevisions).filter((item) => stringField(item, 'area') === 'GLOBAL_HR');
    facts.push(['Applied policies', applied.length], ['Work authorization rules', asRecords(runtime.workAuthorizationRules).length]);
    facts.push(['Works council rules', asRecords(runtime.worksCouncilRules).length]);
    highlights.push(
      'Work authorization commands require Global HR policy evidence',
      'Works council and statutory leave changes are policy controlled',
      ...applied.slice(0, 2).map((item) => `${stringField(item, 'revisionId')} applied`),
    );
  } else if (area === 'DEI_ANALYTICS') {
    const runtime = asRecord(snapshot.deiAnalyticsPolicyRuntime);
    const applied = asRecords(snapshot.runtimePolicyRevisions).filter((item) => stringField(item, 'area') === 'DEI_ANALYTICS');
    facts.push(['Applied policies', applied.length], ['Suppression rules', asRecords(runtime.suppressionRules).length]);
    facts.push(['Pay equity rules', asRecords(runtime.payEquityReviewRules).length]);
    highlights.push(
      'DEI and pay equity commands require applied policy evidence',
      'Suppression and remediation are tracked as governed decisions',
      ...applied.slice(0, 2).map((item) => `${stringField(item, 'revisionId')} applied`),
    );
  } else if (area === 'ENGAGEMENT') {
    const runtime = asRecord(snapshot.engagementPolicyRuntime);
    const applied = asRecords(snapshot.runtimePolicyRevisions).filter((item) => stringField(item, 'area') === 'ENGAGEMENT');
    facts.push(['Applied policies', applied.length], ['Survey rules', asRecords(runtime.surveyPublicationRules).length]);
    facts.push(['Recognition rules', asRecords(runtime.recognitionApprovalRules).length]);
    highlights.push(
      'Survey publication and recognition awards require applied policy evidence',
      'Response privacy and notification rules are governed',
      ...applied.slice(0, 2).map((item) => `${stringField(item, 'revisionId')} applied`),
    );
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
        {highlights.length === 0 ? <p className="text-sm text-[#94a3b8]">No active rules yet.</p> : null}
      </div>
    </div>
  );
}

function BusinessControlBody({
  editable,
  className,
  children,
}: {
  editable: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset disabled={!editable} className={cn('p-6 pt-0', className, !editable && 'opacity-70')}>
      {children}
    </fieldset>
  );
}

function RevisionLockedNotice({ status }: { status: PolicyStatus }) {
  if (isRevisionEditable(status)) return null;
  return (
    <div className="rounded-lg border border-[#f59e0b]/30 bg-[#fffbeb] p-3 text-sm leading-6 text-[#78350f]">
      This revision is {formatEnum(status)} and is locked for audit integrity. Create a change draft from it, edit the draft, then run Controlled Apply.
    </div>
  );
}

function PolicyBusinessControls({
  revision,
  editorJson,
  setEditorJson,
  setEditorError,
  editable,
}: {
  revision: PolicyRevision;
  editorJson: string;
  setEditorJson: (value: string) => void;
  setEditorError: (value: string) => void;
  editable: boolean;
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
    if (!editable) {
      setEditorError('This revision is locked. Create a change draft before editing policy controls.');
      return;
    }
    if (parsed.error || !parsed.draft) {
      setEditorError(parsed.error ?? 'Policy draft data is not in a supported format.');
      return;
    }
    setEditorError('');
    setEditorJson(safeJson(applyGuidedPolicyChange(revision.area, parsed.draft, change)));
  };

  React.useEffect(() => {
    if (revision.area === 'LEAVE') {
      const policies = asRecords(draft.leavePolicies);
      setSelectedLeaveCode((current) => keepExistingSelection(current, policies, recordCode));
    }
    if (revision.area === 'EMPLOYEE_SETUP') {
      const fieldRules = asRecords(draft.fieldRules);
      const documentRequirements = asRecords(draft.documentRequirements);
      setSelectedFieldKey((current) => keepExistingSelection(current, fieldRules, (record) => stringField(record, 'fieldKey')));
      setSelectedDocumentCode((current) => keepExistingSelection(current, documentRequirements, recordCode));
    }
    if (revision.area === 'PAYROLL') {
      const statutoryPayrollPacks = asRecords(draft.statutoryPayrollPacks);
      const earningPolicies = asRecords(draft.earningPolicies);
      const deductionPolicies = asRecords(draft.deductionPolicies);
      const payrollBlockingRules = asRecords(draft.payrollBlockingRules);
      setSelectedPayrollPack((current) => keepExistingSelection(current, statutoryPayrollPacks, recordCode));
      setSelectedEarningPolicy((current) => keepExistingSelection(current, earningPolicies, recordCode));
      setSelectedDeductionPolicy((current) => keepExistingSelection(current, deductionPolicies, recordCode));
      setSelectedPayrollBlocker((current) => keepExistingSelection(current, payrollBlockingRules, recordCode));
    }
    if (revision.area === 'ACCESS_GOVERNANCE') {
      const governance = asRecord(draft.policyGovernance);
      const allowedActionOverrides = asRecords(governance.allowedActionOverrides);
      const fieldAccessOverrides = asRecords(governance.fieldAccessOverrides);
      setSelectedActionOverride((current) => keepExistingSelection(current, allowedActionOverrides, (record) => stringField(record, 'id')));
      setSelectedFieldOverride((current) => keepExistingSelection(current, fieldAccessOverrides, (record) => stringField(record, 'id')));
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
          <CardDescription>This draft contains invalid stored policy data. Create a fresh revision from current active settings or contact a system administrator.</CardDescription>
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
    const accrualRule = firstLedgerRecord(selected?.accrualRules, 'MONTHLY_ACCRUAL', 'Monthly accrual');
    const carryoverRule = firstLedgerRecord(selected?.carryoverRules, 'CARRYOVER_EXPIRY', 'Carryover expiry');
    const blackoutRule = firstLedgerRecord(selected?.blackoutRules, 'BLACKOUT_WINDOW', 'Blackout window');
    const documentRule = firstLedgerRecord(selected?.documentRules, 'DOCUMENT_THRESHOLD', 'Document threshold');
    const updateLeaveLedger = (key: string, fallbackCode: string, fallbackLabel: string, changes: Record<string, unknown>) => (
      update({ [key]: upsertFirstLedgerRecord(selected?.[key], fallbackCode, fallbackLabel, changes) })
    );
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Leave Business Controls</CardTitle>
        </CardHeader>
        <BusinessControlBody editable={editable} className="grid gap-3 lg:grid-cols-4">
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
          <div className="lg:col-span-4 grid gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 md:grid-cols-4">
            <GuidedInput label="Accrual rule code" value={recordCode(accrualRule) || 'MONTHLY_ACCRUAL'} onChange={(value) => updateLeaveLedger('accrualRules', 'MONTHLY_ACCRUAL', 'Monthly accrual', { code: value })} />
            <GuidedInput label="Accrual days/month" type="number" value={numberField(accrualRule, 'accrualDaysPerMonth', 1.75)} onChange={(value) => updateLeaveLedger('accrualRules', 'MONTHLY_ACCRUAL', 'Monthly accrual', { accrualDaysPerMonth: optionalNumber(value), retroBehavior: 'REVALIDATE_PENDING' })} />
            <GuidedInput label="Carryover max days" type="number" value={numberField(carryoverRule, 'carryoverMaxDays', 5)} onChange={(value) => updateLeaveLedger('carryoverRules', 'CARRYOVER_EXPIRY', 'Carryover expiry', { carryoverMaxDays: optionalNumber(value), retroBehavior: 'FUTURE_ONLY' })} />
            <GuidedInput label="Carryover expiry months" type="number" value={numberField(carryoverRule, 'expiresAfterMonths', 3)} onChange={(value) => updateLeaveLedger('carryoverRules', 'CARRYOVER_EXPIRY', 'Carryover expiry', { expiresAfterMonths: optionalNumber(value) })} />
            <GuidedInput label="Blackout dates CSV" value={stringArrayField(blackoutRule, 'dates').join(', ')} onChange={(value) => updateLeaveLedger('blackoutRules', 'BLACKOUT_WINDOW', 'Blackout window', { dates: splitCsv(value), retroBehavior: 'BLOCK_RETROACTIVE' })} />
            <GuidedInput label="Document rule code" value={recordCode(documentRule) || 'DOCUMENT_THRESHOLD'} onChange={(value) => updateLeaveLedger('documentRules', 'DOCUMENT_THRESHOLD', 'Document threshold', { code: value })} />
            <GuidedInput label="Document after days" type="number" value={numberField(documentRule, 'thresholdDays', numberField(selected, 'requiresDocumentAfter'))} onChange={(value) => updateLeaveLedger('documentRules', 'DOCUMENT_THRESHOLD', 'Document threshold', { thresholdDays: optionalNumber(value), retroBehavior: 'REVALIDATE_PENDING' })} />
            <GuidedInput label="Retro behavior" value={stringField(accrualRule, 'retroBehavior', 'REVALIDATE_PENDING')} onChange={(value) => updateLeaveLedger('accrualRules', 'MONTHLY_ACCRUAL', 'Monthly accrual', { retroBehavior: value })} />
          </div>
        </BusinessControlBody>
      </Card>
    );
  }

  if (revision.area === 'ATTENDANCE') {
    const attendance = asRecord(draft.attendancePolicy);
    const hasLegacyRadiusOnly = typeof attendance.geofenceRadiusMeters === 'number' && typeof attendance.allowedRadiusMeters !== 'number';
    const update = (changes: Record<string, unknown>) => commit({ type: 'ATTENDANCE_RULE', changes });
    const geofenceLedger = firstLedgerRecord(attendance.ruleLedger, 'MOBILE_GEOFENCE_REQUIRED', 'Mobile geofence required');
    const scheduleRule = firstLedgerRecord(attendance.scheduleRules, 'STANDARD_SCHEDULE', 'Standard schedule rule');
    const exceptionRule = firstLedgerRecord(attendance.exceptionRules, 'MISSED_PUNCH_EXCEPTION', 'Missed punch exception');
    const correctionRule = firstLedgerRecord(attendance.correctionRules, 'MANAGER_CORRECTION_APPROVAL', 'Manager correction approval');
    const coverageRule = firstLedgerRecord(attendance.rosterCoverageRules, 'MINIMUM_COVERAGE', 'Minimum roster coverage');
    const payrollBridgeRule = firstLedgerRecord(attendance.payrollBridgeRules, 'LATE_TO_PAYROLL', 'Late minutes payroll bridge');
    const updateAttendanceLedger = (key: string, fallbackCode: string, fallbackLabel: string, changes: Record<string, unknown>) => (
      update({ [key]: upsertFirstLedgerRecord(attendance[key], fallbackCode, fallbackLabel, changes) })
    );
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Attendance Business Controls</CardTitle>
        </CardHeader>
        <BusinessControlBody editable={editable} className="grid gap-3 lg:grid-cols-4">
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
                Update Field
              </Button>
            </div>
          ) : null}
          <div className="lg:col-span-4 grid gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 md:grid-cols-4">
            <GuidedInput label="Geofence ledger code" value={recordCode(geofenceLedger) || 'MOBILE_GEOFENCE_REQUIRED'} onChange={(value) => updateAttendanceLedger('ruleLedger', 'MOBILE_GEOFENCE_REQUIRED', 'Mobile geofence required', { code: value })} />
            <GuidedInput label="Device trust action" value={stringField(geofenceLedger, 'deviceTrustAction', 'BLOCK_LOW_TRUST')} onChange={(value) => updateAttendanceLedger('ruleLedger', 'MOBILE_GEOFENCE_REQUIRED', 'Mobile geofence required', { deviceTrustAction: value, retroBehavior: 'REVALIDATE_PENDING' })} />
            <GuidedInput label="Schedule rule code" value={recordCode(scheduleRule) || 'STANDARD_SCHEDULE'} onChange={(value) => updateAttendanceLedger('scheduleRules', 'STANDARD_SCHEDULE', 'Standard schedule rule', { code: value })} />
            <GuidedInput label="Fatigue max hours" type="number" value={numberField(scheduleRule, 'maxHoursPerDay', 12)} onChange={(value) => updateAttendanceLedger('scheduleRules', 'STANDARD_SCHEDULE', 'Standard schedule rule', { maxHoursPerDay: optionalNumber(value), retroBehavior: 'REVALIDATE_PENDING' })} />
            <GuidedInput label="Exception rule code" value={recordCode(exceptionRule) || 'MISSED_PUNCH_EXCEPTION'} onChange={(value) => updateAttendanceLedger('exceptionRules', 'MISSED_PUNCH_EXCEPTION', 'Missed punch exception', { code: value })} />
            <GuidedInput label="Correction workflow" value={stringField(correctionRule, 'approvalWorkflow', 'MANAGER_THEN_HR')} onChange={(value) => updateAttendanceLedger('correctionRules', 'MANAGER_CORRECTION_APPROVAL', 'Manager correction approval', { approvalWorkflow: value, retroBehavior: 'REVALIDATE_PENDING' })} />
            <GuidedInput label="Minimum coverage" type="number" value={numberField(coverageRule, 'minimumPeople', 2)} onChange={(value) => updateAttendanceLedger('rosterCoverageRules', 'MINIMUM_COVERAGE', 'Minimum roster coverage', { minimumPeople: optionalNumber(value), retroBehavior: 'FUTURE_ONLY' })} />
            <GuidedInput label="Payroll bridge deduction" value={stringField(payrollBridgeRule, 'deductionCode', 'LATE_DEDUCTION_LEDGER')} onChange={(value) => updateAttendanceLedger('payrollBridgeRules', 'LATE_TO_PAYROLL', 'Late minutes payroll bridge', { deductionCode: value, retroBehavior: 'ADJUSTMENT_QUEUE' })} />
          </div>
        </BusinessControlBody>
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
    const earningType = stringField(earning, 'type', 'FIXED_AMOUNT');
    const deductionType = stringField(deduction, 'type', 'PER_MINUTE');
    const earningLedger = asRecord(earning?.logicLedger);
    const deductionLedger = asRecord(deduction?.logicLedger);
    const earningPosting = asRecord(earningLedger.posting);
    const deductionPosting = asRecord(deductionLedger.posting);
    const earningScope = asRecord(earning?.scope);
    const deductionScope = asRecord(deduction?.scope);
    const logicSources = ['ATTENDANCE_LEDGER', 'LEAVE_LEDGER', 'PAYROLL_LEDGER', 'BENEFITS_LEDGER', 'LOAN_LEDGER', 'MANUAL_INPUT'];
    const logicBases = ['FIXED_AMOUNT', 'BASE_GROSS', 'GROSS_SALARY', 'TAXABLE_BASE', 'NET_BEFORE_DEDUCTION', 'HOURLY_RATE', 'ATTENDANCE_LATE_MINUTES', 'ATTENDANCE_UNDERTIME_MINUTES', 'ATTENDANCE_OVERTIME_MINUTES', 'ATTENDANCE_OVERTIME_HOURS', 'ATTENDANCE_ABSENCE_DAYS', 'ATTENDANCE_PAYABLE_MINUTES', 'ATTENDANCE_WORKED_MINUTES', 'ATTENDANCE_GEOFENCE_VIOLATIONS'];
    const logicMethods = ['FIXED_AMOUNT', 'PERCENT_OF_BASE', 'PER_UNIT', 'BRACKET'];
    const retroBehaviors = ['FUTURE_ONLY', 'REVALIDATE_PENDING', 'ADJUSTMENT_QUEUE', 'RECALCULATE_OPEN_PERIODS', 'BLOCK_RETROACTIVE'];
    const updateEarningLedger = (changes: Record<string, unknown>) => updateEarning({
      type: 'LOGIC_LEDGER',
      logicLedger: {
        code: stringField(earningLedger, 'code', `${earningCode}_LEDGER`),
        source: stringField(earningLedger, 'source', 'ATTENDANCE_LEDGER'),
        base: stringField(earningLedger, 'base', 'ATTENDANCE_OVERTIME_HOURS'),
        method: stringField(earningLedger, 'method', 'PER_UNIT'),
        ...earningLedger,
        ...changes,
      },
    });
    const updateDeductionLedger = (changes: Record<string, unknown>) => updateDeduction({
      type: 'LOGIC_LEDGER',
      logicLedger: {
        code: stringField(deductionLedger, 'code', `${deductionCode}_LEDGER`),
        source: stringField(deductionLedger, 'source', 'ATTENDANCE_LEDGER'),
        base: stringField(deductionLedger, 'base', 'ATTENDANCE_LATE_MINUTES'),
        method: stringField(deductionLedger, 'method', 'PER_UNIT'),
        ...deductionLedger,
        ...changes,
      },
    });
    const updateEarningPosting = (changes: Record<string, unknown>) => updateEarningLedger({ posting: { ...earningPosting, ...changes } });
    const updateDeductionPosting = (changes: Record<string, unknown>) => updateDeductionLedger({ posting: { ...deductionPosting, ...changes } });
    const updateEarningScope = (changes: Record<string, unknown>) => updateEarning({ scope: { ...earningScope, ...changes } });
    const updateDeductionScope = (changes: Record<string, unknown>) => updateDeduction({ scope: { ...deductionScope, ...changes } });
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payroll Business Controls</CardTitle>
          <CardDescription>Calculation, statutory packs, earnings, deductions, close blockers, GL posting, and bank file readiness consumed by payroll preview and close.</CardDescription>
        </CardHeader>
        <BusinessControlBody editable={editable} className="space-y-5">
          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <div className="mb-3 flex flex-col gap-1">
              <p className="font-semibold text-[#0f172a]">Default Calculation Policy</p>
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
                <p className="font-semibold text-[#0f172a]">Earning Rules</p>
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
                  <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={earningType} onChange={(event) => updateEarning({ type: event.target.value })}>
                    {['FIXED_AMOUNT', 'PER_MINUTE', 'PERCENT_OF_BASE', 'LOGIC_LEDGER'].map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                  </select>
                </div>
                {earningType !== 'LOGIC_LEDGER' && (earningType === 'PERCENT_OF_BASE'
                  ? <GuidedInput label="Rate %" type="number" value={numberField(earning, 'ratePercent')} onChange={(value) => updateEarning({ ratePercent: optionalNumber(value) })} />
                  : <GuidedInput label="Amount" type="number" value={numberField(earning, 'amount')} onChange={(value) => updateEarning({ amount: optionalNumber(value) })} />)}
                <GuidedInput label="Attendance event" value={stringField(earning, 'attendanceEvent')} onChange={(value) => updateEarning({ attendanceEvent: value })} />
                <GuidedToggle label="Active" checked={booleanField(earning, 'active', true)} onChange={(checked) => updateEarning({ active: checked })} />
                <GuidedToggle label="Taxable" checked={booleanField(earning, 'taxable', true)} onChange={(checked) => updateEarning({ taxable: checked })} />
                <GuidedToggle label="Insurable" checked={booleanField(earning, 'insurable', true)} onChange={(checked) => updateEarning({ insurable: checked })} />
                <GuidedToggle label="Recurring" checked={booleanField(earning, 'recurring', true)} onChange={(checked) => updateEarning({ recurring: checked })} />
                <div className="md:col-span-2 rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-3">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-[#0f172a]">Logic Ledger</p>
                    <p className="text-xs text-[#475569]">Use this for scoped calculations driven by attendance, leave, benefits, loans, or manual adjustments.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <GuidedInput label="Ledger rule code" value={stringField(earningLedger, 'code', `${earningCode}_LEDGER`)} onChange={(value) => updateEarningLedger({ code: value })} />
                    <div className="space-y-1.5">
                      <Label>Ledger source</Label>
                      <select className="h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm" value={stringField(earningLedger, 'source', 'ATTENDANCE_LEDGER')} onChange={(event) => updateEarningLedger({ source: event.target.value })}>
                        {logicSources.map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Calculation base</Label>
                      <select className="h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm" value={stringField(earningLedger, 'base', 'ATTENDANCE_OVERTIME_HOURS')} onChange={(event) => updateEarningLedger({ base: event.target.value })}>
                        {logicBases.map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Method</Label>
                      <select className="h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm" value={stringField(earningLedger, 'method', 'PER_UNIT')} onChange={(event) => updateEarningLedger({ method: event.target.value })}>
                        {logicMethods.map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                      </select>
                    </div>
                    <GuidedInput label="Amount per unit" type="number" value={numberField(earningLedger, 'amount')} onChange={(value) => updateEarningLedger({ amount: optionalNumber(value) })} />
                    <GuidedInput label="Rate %" type="number" value={numberField(earningLedger, 'ratePercent')} onChange={(value) => updateEarningLedger({ ratePercent: optionalNumber(value) })} />
                    <GuidedInput label="Monthly cap" type="number" value={numberField(earningLedger, 'monthlyCap')} onChange={(value) => updateEarningLedger({ monthlyCap: optionalNumber(value) })} />
                    <GuidedInput label="GL account" value={stringField(earningPosting, 'glAccount')} onChange={(value) => updateEarningPosting({ glAccount: value })} />
                    <GuidedInput label="Payslip line type" value={stringField(earningPosting, 'payslipLineType', 'EARNING')} onChange={(value) => updateEarningPosting({ payslipLineType: value })} />
                    <div className="space-y-1.5">
                      <Label>Retro behavior</Label>
                      <select className="h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm" value={stringField(earningLedger, 'retroBehavior', 'FUTURE_ONLY')} onChange={(event) => updateEarningLedger({ retroBehavior: event.target.value })}>
                        {retroBehaviors.map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                      </select>
                    </div>
                    <GuidedInput label="Entity scope" value={stringArrayField(earningScope, 'legalEntityIds').join(', ')} onChange={(value) => updateEarningScope({ legalEntityIds: splitCsv(value) })} />
                    <GuidedInput label="Country scope" value={stringArrayField(earningScope, 'countryCodes').join(', ')} onChange={(value) => updateEarningScope({ countryCodes: splitCsv(value) })} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
              <div className="mb-3 flex flex-col gap-1">
                <p className="font-semibold text-[#0f172a]">Deduction Rules</p>
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
                  <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={deductionType} onChange={(event) => updateDeduction({ type: event.target.value })}>
                    {['FIXED_AMOUNT', 'PER_MINUTE', 'PERCENT_OF_GROSS', 'LOGIC_LEDGER'].map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                  </select>
                </div>
                {deductionType !== 'LOGIC_LEDGER' && (deductionType === 'PERCENT_OF_GROSS'
                  ? <GuidedInput label="Rate %" type="number" value={numberField(deduction, 'ratePercent')} onChange={(value) => updateDeduction({ ratePercent: optionalNumber(value) })} />
                  : <GuidedInput label="Amount" type="number" value={numberField(deduction, 'amount')} onChange={(value) => updateDeduction({ amount: optionalNumber(value) })} />)}
                <GuidedInput label="Attendance event" value={stringField(deduction, 'attendanceEvent')} onChange={(value) => updateDeduction({ attendanceEvent: value })} />
                <div className="space-y-1.5">
                  <Label>Timing</Label>
                  <select className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm" value={stringField(deduction, 'timing', 'POST_TAX')} onChange={(event) => updateDeduction({ timing: event.target.value })}>
                    {['PRE_TAX', 'POST_TAX'].map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                  </select>
                </div>
                <GuidedToggle label="Active" checked={booleanField(deduction, 'active', true)} onChange={(checked) => updateDeduction({ active: checked })} />
                <div className="md:col-span-2 rounded-lg border border-[#fee2e2] bg-[#fff7ed] p-3">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-[#0f172a]">Deduction Logic Ledger</p>
                    <p className="text-xs text-[#475569]">Control late, absence, geofence, loan, statutory, and custom deductions with caps, minimum-net protection, GL posting, and retro behavior.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <GuidedInput label="Ledger rule code" value={stringField(deductionLedger, 'code', `${deductionCode}_LEDGER`)} onChange={(value) => updateDeductionLedger({ code: value })} />
                    <div className="space-y-1.5">
                      <Label>Ledger source</Label>
                      <select className="h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm" value={stringField(deductionLedger, 'source', 'ATTENDANCE_LEDGER')} onChange={(event) => updateDeductionLedger({ source: event.target.value })}>
                        {logicSources.map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Calculation base</Label>
                      <select className="h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm" value={stringField(deductionLedger, 'base', 'ATTENDANCE_LATE_MINUTES')} onChange={(event) => updateDeductionLedger({ base: event.target.value })}>
                        {logicBases.map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Method</Label>
                      <select className="h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm" value={stringField(deductionLedger, 'method', 'PER_UNIT')} onChange={(event) => updateDeductionLedger({ method: event.target.value })}>
                        {logicMethods.map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                      </select>
                    </div>
                    <GuidedInput label="Amount per unit" type="number" value={numberField(deductionLedger, 'amount')} onChange={(value) => updateDeductionLedger({ amount: optionalNumber(value) })} />
                    <GuidedInput label="Rate %" type="number" value={numberField(deductionLedger, 'ratePercent')} onChange={(value) => updateDeductionLedger({ ratePercent: optionalNumber(value) })} />
                    <GuidedInput label="Monthly cap" type="number" value={numberField(deductionLedger, 'monthlyCap')} onChange={(value) => updateDeductionLedger({ monthlyCap: optionalNumber(value) })} />
                    <GuidedInput label="Minimum net pay" type="number" value={numberField(deductionLedger, 'minimumNetPay')} onChange={(value) => updateDeductionLedger({ minimumNetPay: optionalNumber(value) })} />
                    <GuidedInput label="GL account" value={stringField(deductionPosting, 'glAccount')} onChange={(value) => updateDeductionPosting({ glAccount: value })} />
                    <GuidedInput label="Payslip line type" value={stringField(deductionPosting, 'payslipLineType', 'DEDUCTION')} onChange={(value) => updateDeductionPosting({ payslipLineType: value })} />
                    <div className="space-y-1.5">
                      <Label>Retro behavior</Label>
                      <select className="h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm" value={stringField(deductionLedger, 'retroBehavior', 'ADJUSTMENT_QUEUE')} onChange={(event) => updateDeductionLedger({ retroBehavior: event.target.value })}>
                        {retroBehaviors.map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}
                      </select>
                    </div>
                    <GuidedInput label="Entity scope" value={stringArrayField(deductionScope, 'legalEntityIds').join(', ')} onChange={(value) => updateDeductionScope({ legalEntityIds: splitCsv(value) })} />
                    <GuidedInput label="Country scope" value={stringArrayField(deductionScope, 'countryCodes').join(', ')} onChange={(value) => updateDeductionScope({ countryCodes: splitCsv(value) })} />
                    <GuidedInput label="Department scope" value={stringArrayField(deductionScope, 'departmentIds').join(', ')} onChange={(value) => updateDeductionScope({ departmentIds: splitCsv(value) })} />
                    <GuidedInput label="Worker scope" value={stringArrayField(deductionScope, 'workerIds').join(', ')} onChange={(value) => updateDeductionScope({ workerIds: splitCsv(value) })} />
                  </div>
                </div>
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
        </BusinessControlBody>
      </Card>
    );
  }

  if (revision.area === 'ACCESS_GOVERNANCE') {
    const governance = asRecord(draft.policyGovernance);
    const actionOverrides = asRecords(governance.allowedActionOverrides);
    const fieldOverrides = asRecords(governance.fieldAccessOverrides);
    const actionOverride = actionOverrides.find((item) => stringField(item, 'id') === selectedActionOverride) ?? actionOverrides[0];
    const fieldOverride = fieldOverrides.find((item) => stringField(item, 'id') === selectedFieldOverride) ?? fieldOverrides[0];
    const actionLedger = firstLedgerRecord(governance.actionRuleLedgers, 'SELF_SERVICE_ACTIONS', 'Self-service action governance');
    const sodRule = firstLedgerRecord(governance.sodRules, 'NO_CREATE_AND_APPROVE_POLICY', 'Separate maker and checker');
    const serviceAccountRule = firstLedgerRecord(governance.serviceAccountRules, 'SERVICE_ACCOUNT_SCOPE_REVIEW', 'Service account scope review');
    const certificationRule = firstLedgerRecord(governance.certificationRules, 'QUARTERLY_ACCESS_CERTIFICATION', 'Quarterly access certification');
    const actionId = selectedActionOverride || stringField(actionOverride, 'id') || 'leave-submit-blackout';
    const fieldId = selectedFieldOverride || stringField(fieldOverride, 'id') || 'salary-mask-employee';
    const updateGovernanceLedger = (key: string, fallbackCode: string, fallbackLabel: string, changes: Record<string, unknown>) => commit({
      type: 'ACCESS_GOVERNANCE_RUNTIME',
      changes: {
        [key]: upsertFirstLedgerRecord(governance[key], fallbackCode, fallbackLabel, changes),
      },
    });
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
        <BusinessControlBody editable={editable} className="grid gap-6 xl:grid-cols-2">
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
          <div className="grid gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 md:grid-cols-2 xl:col-span-2 xl:grid-cols-4">
            <GuidedInput label="Action ledger code" value={recordCode(actionLedger) || 'SELF_SERVICE_ACTIONS'} onChange={(value) => updateGovernanceLedger('actionRuleLedgers', 'SELF_SERVICE_ACTIONS', 'Self-service action governance', { code: value })} />
            <GuidedInput label="Command action" value={stringField(actionLedger, 'commandAction', 'ALLOW_SCOPED_SELF_SERVICE')} onChange={(value) => updateGovernanceLedger('actionRuleLedgers', 'SELF_SERVICE_ACTIONS', 'Self-service action governance', { commandAction: value, retroBehavior: 'FUTURE_ONLY' })} />
            <GuidedInput label="SoD rule code" value={recordCode(sodRule) || 'NO_CREATE_AND_APPROVE_POLICY'} onChange={(value) => updateGovernanceLedger('sodRules', 'NO_CREATE_AND_APPROVE_POLICY', 'Separate maker and checker', { code: value })} />
            <GuidedInput label="SoD decision" value={stringField(sodRule, 'decision', 'BLOCK')} onChange={(value) => updateGovernanceLedger('sodRules', 'NO_CREATE_AND_APPROVE_POLICY', 'Separate maker and checker', { decision: value, retroBehavior: 'REVALIDATE_PENDING' })} />
            <GuidedInput label="Service account max days" type="number" value={numberField(serviceAccountRule, 'credentialMaxAgeDays', 90)} onChange={(value) => updateGovernanceLedger('serviceAccountRules', 'SERVICE_ACCOUNT_SCOPE_REVIEW', 'Service account scope review', { credentialMaxAgeDays: optionalNumber(value), retroBehavior: 'REVALIDATE_PENDING' })} />
            <GuidedInput label="Credential scope review" value={stringField(serviceAccountRule, 'scopeReviewFrequency', 'QUARTERLY')} onChange={(value) => updateGovernanceLedger('serviceAccountRules', 'SERVICE_ACCOUNT_SCOPE_REVIEW', 'Service account scope review', { scopeReviewFrequency: value })} />
            <GuidedInput label="Certification frequency" value={stringField(certificationRule, 'frequency', 'QUARTERLY')} onChange={(value) => updateGovernanceLedger('certificationRules', 'QUARTERLY_ACCESS_CERTIFICATION', 'Quarterly access certification', { frequency: value })} />
            <GuidedInput label="Escalation days" type="number" value={numberField(certificationRule, 'escalateAfterDays', 7)} onChange={(value) => updateGovernanceLedger('certificationRules', 'QUARTERLY_ACCESS_CERTIFICATION', 'Quarterly access certification', { escalateAfterDays: optionalNumber(value) })} />
          </div>
        </BusinessControlBody>
      </Card>
    );
  }

  if (revision.area === 'BENEFITS') {
    const runtime = asRecord(draft.benefitsPolicyRuntime);
    const updateRuntime = (changes: Record<string, unknown>) => commit({ type: 'BENEFITS_RUNTIME', changes });
    const updateRule = (key: string, fallbackCode: string, fallbackLabel: string, changes: Record<string, unknown>) => {
      const rows = asRecords(runtime[key]);
      const selected = rows[0] ?? { code: fallbackCode, label: fallbackLabel, active: true, outcomes: [] };
      const next = rows.length > 0
        ? rows.map((row, index) => index === 0 ? { ...selected, ...changes } : row)
        : [{ ...selected, ...changes }];
      updateRuntime({ [key]: next });
    };
    const firstRule = (key: string, fallbackCode: string, fallbackLabel: string) => (
      asRecords(runtime[key])[0] ?? { code: fallbackCode, label: fallbackLabel, active: true, outcomes: [] }
    );
    const eligibility = firstRule('eligibilityRules', 'MEDICAL_FULL_TIME', 'Medical plan full-time eligibility');
    const enrollment = firstRule('enrollmentWindowRules', 'NEW_HIRE_30_DAYS', 'New hire enrollment window');
    const lifeEvent = firstRule('lifeEventRules', 'LIFE_EVENT_31_DAYS', 'Life event change window');
    const dependent = firstRule('dependentRules', 'DEPENDENT_EVIDENCE_REQUIRED', 'Dependent evidence requirement');
    const contribution = firstRule('contributionRules', 'MEDICAL_CONTRIBUTION_SPLIT', 'Medical contribution split');
    const carrierExport = firstRule('carrierExportRules', 'CARRIER_EXPORT_APPROVED_ONLY', 'Carrier export approved enrollments');
    const evidence = firstRule('evidenceRules', 'BENEFITS_EVIDENCE_REQUIRED', 'Benefits evidence rule');
    const contributionLedger = asRecord(contribution.logicLedger);
    const enrollmentLedger = asRecord(enrollment.logicLedger);
    const lifeEventLedger = asRecord(lifeEvent.logicLedger);
    const updateEligibility = (changes: Record<string, unknown>) => updateRule('eligibilityRules', 'MEDICAL_FULL_TIME', 'Medical plan full-time eligibility', changes);
    const updateEnrollment = (changes: Record<string, unknown>) => updateRule('enrollmentWindowRules', 'NEW_HIRE_30_DAYS', 'New hire enrollment window', changes);
    const updateLifeEvent = (changes: Record<string, unknown>) => updateRule('lifeEventRules', 'LIFE_EVENT_31_DAYS', 'Life event change window', changes);
    const updateDependent = (changes: Record<string, unknown>) => updateRule('dependentRules', 'DEPENDENT_EVIDENCE_REQUIRED', 'Dependent evidence requirement', changes);
    const updateContribution = (changes: Record<string, unknown>) => updateRule('contributionRules', 'MEDICAL_CONTRIBUTION_SPLIT', 'Medical contribution split', changes);
    const updateCarrierExport = (changes: Record<string, unknown>) => updateRule('carrierExportRules', 'CARRIER_EXPORT_APPROVED_ONLY', 'Carrier export approved enrollments', changes);
    const updateEvidence = (changes: Record<string, unknown>) => updateRule('evidenceRules', 'BENEFITS_EVIDENCE_REQUIRED', 'Benefits evidence rule', changes);
    const updateContributionLedger = (changes: Record<string, unknown>) => updateContribution({
      logicLedger: {
        code: stringField(contributionLedger, 'code', 'MEDICAL_CONTRIBUTION_LEDGER'),
        source: stringField(contributionLedger, 'source', 'BENEFITS_LEDGER'),
        condition: stringField(contributionLedger, 'condition', 'APPROVED_ENROLLMENT'),
        outcome: stringField(contributionLedger, 'outcome', 'CREATE_PAYROLL_BRIDGE'),
        ...contributionLedger,
        ...changes,
      },
    });
    const updateEnrollmentLedger = (changes: Record<string, unknown>) => updateEnrollment({
      logicLedger: {
        code: stringField(enrollmentLedger, 'code', 'NEW_HIRE_WAITING_PERIOD_LEDGER'),
        source: stringField(enrollmentLedger, 'source', 'BENEFITS_LEDGER'),
        condition: stringField(enrollmentLedger, 'condition', 'NEW_HIRE'),
        outcome: stringField(enrollmentLedger, 'outcome', 'ALLOW_ENROLLMENT'),
        ...enrollmentLedger,
        ...changes,
      },
    });
    const updateLifeEventLedger = (changes: Record<string, unknown>) => updateLifeEvent({
      logicLedger: {
        code: stringField(lifeEventLedger, 'code', 'LIFE_EVENT_WINDOW_LEDGER'),
        source: stringField(lifeEventLedger, 'source', 'BENEFITS_LEDGER'),
        condition: stringField(lifeEventLedger, 'condition', 'QUALIFYING_LIFE_EVENT'),
        outcome: stringField(lifeEventLedger, 'outcome', 'ALLOW_COVERAGE_CHANGE'),
        ...lifeEventLedger,
        ...changes,
      },
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Benefits Policy Controls</CardTitle>
          <CardDescription>Eligibility, enrollment windows, life events, dependent evidence, carrier export, contribution split, and payroll deduction bridge.</CardDescription>
        </CardHeader>
        <BusinessControlBody editable={editable} className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
              <div className="mb-3 flex flex-col gap-1">
                <p className="font-semibold text-[#0f172a]">Eligibility And Enrollment Window</p>
                <p className="text-sm text-[#475569]">Controls who can enroll, waiting periods, enrollment close dates, and revalidation behavior.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <GuidedInput label="Eligibility rule code" value={recordCode(eligibility) || 'MEDICAL_FULL_TIME'} onChange={(value) => updateEligibility({ code: value })} />
                <GuidedInput label="Eligibility label" value={stringField(eligibility, 'label', 'Medical plan full-time eligibility')} onChange={(value) => updateEligibility({ label: value })} />
                <GuidedInput label="Employee types CSV" value={stringArrayField(eligibility, 'employeeTypes').join(', ')} onChange={(value) => updateEligibility({ employeeTypes: splitCsv(value) })} />
                <GuidedInput label="Plan codes CSV" value={stringArrayField(eligibility, 'planCodes').join(', ')} onChange={(value) => updateEligibility({ planCodes: splitCsv(value) })} />
                <GuidedInput label="Waiting period days" type="number" value={numberField(enrollmentLedger, 'waitingPeriodDays', numberField(enrollment, 'waitingPeriodDays', 30))} onChange={(value) => updateEnrollmentLedger({ waitingPeriodDays: optionalNumber(value) })} />
                <GuidedInput label="Enrollment window days" type="number" value={numberField(enrollment, 'enrollmentWindowDays', 30)} onChange={(value) => updateEnrollment({ enrollmentWindowDays: optionalNumber(value) })} />
                <GuidedToggle label="Eligibility active" checked={booleanField(eligibility, 'active', true)} onChange={(checked) => updateEligibility({ active: checked })} />
                <GuidedToggle label="Enrollment active" checked={booleanField(enrollment, 'active', true)} onChange={(checked) => updateEnrollment({ active: checked })} />
              </div>
            </div>

            <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
              <div className="mb-3 flex flex-col gap-1">
                <p className="font-semibold text-[#0f172a]">Life Events And Dependents</p>
                <p className="text-sm text-[#475569]">Controls qualifying life events, dependent eligibility, evidence requirements, and approval routing.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <GuidedInput label="Life event code" value={recordCode(lifeEvent) || 'LIFE_EVENT_31_DAYS'} onChange={(value) => updateLifeEvent({ code: value })} />
                <GuidedInput label="Life event window days" type="number" value={numberField(lifeEventLedger, 'windowDays', numberField(lifeEvent, 'windowDays', 31))} onChange={(value) => updateLifeEventLedger({ windowDays: optionalNumber(value) })} />
                <GuidedInput label="Allowed event types CSV" value={stringArrayField(lifeEvent, 'eventTypes').join(', ')} onChange={(value) => updateLifeEvent({ eventTypes: splitCsv(value) })} />
                <GuidedInput label="Dependent relationship CSV" value={stringArrayField(dependent, 'relationshipTypes').join(', ')} onChange={(value) => updateDependent({ relationshipTypes: splitCsv(value) })} />
                <GuidedInput label="Evidence codes CSV" value={stringArrayField(evidence, 'documentCodes').join(', ')} onChange={(value) => updateEvidence({ documentCodes: splitCsv(value) })} />
                <GuidedInput label="Approval workflow" value={stringField(lifeEvent, 'approvalWorkflow', 'BENEFITS_ADMIN')} onChange={(value) => updateLifeEvent({ approvalWorkflow: value })} />
                <GuidedToggle label="Dependent evidence required" checked={booleanField(dependent, 'evidenceRequired', true)} onChange={(checked) => updateDependent({ evidenceRequired: checked })} />
                <GuidedToggle label="Life event active" checked={booleanField(lifeEvent, 'active', true)} onChange={(checked) => updateLifeEvent({ active: checked })} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <div className="mb-3 flex flex-col gap-1">
                <p className="font-semibold text-[#0f172a]">Contribution And Payroll Bridge</p>
                <p className="text-sm text-[#475569]">Creates payroll deductions only from approved benefits enrollment and contribution rules.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <GuidedInput label="Contribution rule code" value={recordCode(contribution) || 'MEDICAL_CONTRIBUTION_SPLIT'} onChange={(value) => updateContribution({ code: value })} />
                <GuidedInput label="Employee contribution %" type="number" value={numberField(contributionLedger, 'employeeContributionPercent', 20)} onChange={(value) => updateContributionLedger({ employeeContributionPercent: optionalNumber(value) })} />
                <GuidedInput label="Employer contribution %" type="number" value={numberField(contributionLedger, 'employerContributionPercent', 80)} onChange={(value) => updateContributionLedger({ employerContributionPercent: optionalNumber(value) })} />
                <GuidedInput label="Payroll deduction code" value={stringField(contributionLedger, 'payrollDeductionCode', 'MEDICAL_EMPLOYEE_SHARE')} onChange={(value) => updateContributionLedger({ payrollDeductionCode: value })} />
                <GuidedInput label="Cost center source" value={stringField(contributionLedger, 'costCenterSource', 'WORKER_ASSIGNMENT')} onChange={(value) => updateContributionLedger({ costCenterSource: value })} />
                <GuidedInput label="Retro behavior" value={stringField(contribution, 'retroBehavior', 'ADJUSTMENT_QUEUE')} onChange={(value) => updateContribution({ retroBehavior: value })} />
                <GuidedToggle label="Contribution active" checked={booleanField(contribution, 'active', true)} onChange={(checked) => updateContribution({ active: checked })} />
              </div>
            </div>

            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <div className="mb-3 flex flex-col gap-1">
                <p className="font-semibold text-[#0f172a]">Carrier Export And Evidence</p>
                <p className="text-sm text-[#475569]">Controls carrier file eligibility, reconciliation, privacy level, and export evidence.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <GuidedInput label="Carrier export code" value={recordCode(carrierExport) || 'CARRIER_EXPORT_APPROVED_ONLY'} onChange={(value) => updateCarrierExport({ code: value })} />
                <GuidedInput label="Carrier ID" value={stringField(carrierExport, 'carrierId', 'DEFAULT_CARRIER')} onChange={(value) => updateCarrierExport({ carrierId: value })} />
                <GuidedInput label="File format" value={stringField(carrierExport, 'fileFormat', 'CSV')} onChange={(value) => updateCarrierExport({ fileFormat: value })} />
                <GuidedInput label="Privacy level" value={stringField(carrierExport, 'privacyLevel', 'CONFIDENTIAL')} onChange={(value) => updateCarrierExport({ privacyLevel: value })} />
                <GuidedInput label="Reconcile within days" type="number" value={numberField(carrierExport, 'reconcileWithinDays', 3)} onChange={(value) => updateCarrierExport({ reconcileWithinDays: optionalNumber(value) })} />
                <GuidedInput label="Evidence retention class" value={stringField(evidence, 'retentionClass', 'BENEFITS_EVIDENCE')} onChange={(value) => updateEvidence({ retentionClass: value })} />
                <GuidedToggle label="Carrier export active" checked={booleanField(carrierExport, 'active', true)} onChange={(checked) => updateCarrierExport({ active: checked })} />
                <GuidedToggle label="Evidence active" checked={booleanField(evidence, 'active', true)} onChange={(checked) => updateEvidence({ active: checked })} />
              </div>
            </div>
          </div>
        </BusinessControlBody>
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
        </CardHeader>
        <BusinessControlBody editable={editable} className="grid gap-6 xl:grid-cols-2">
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
        </BusinessControlBody>
      </Card>
    );
  }

  if (revision.area === 'COUNTRY_POLICY') {
    const runtime = asRecord(draft.countryPolicyRuntime);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Country Rules</CardTitle>
        </CardHeader>
        <BusinessControlBody editable={editable} className="grid gap-3 lg:grid-cols-4">
          <GuidedInput label="Country code" value={stringField(runtime, 'countryCode', 'EG')} onChange={(value) => commit({ type: 'COUNTRY_RUNTIME', changes: { countryCode: value } })} />
          <GuidedInput label="Pack version" value={stringField(runtime, 'packVersion', '2026.1')} onChange={(value) => commit({ type: 'COUNTRY_RUNTIME', changes: { packVersion: value } })} />
          <GuidedInput label="Effective from" type="date" value={stringField(runtime, 'effectiveFrom')} onChange={(value) => commit({ type: 'COUNTRY_RUNTIME', changes: { effectiveFrom: value } })} />
          <GuidedToggle label="Blocks payroll if stale" checked={booleanField(runtime, 'blocksPayrollIfStale', true)} onChange={(checked) => commit({ type: 'COUNTRY_RUNTIME', changes: { blocksPayrollIfStale: checked } })} />
        </BusinessControlBody>
      </Card>
    );
  }

  if (revision.area === 'GLOBAL_HR' || revision.area === 'DEI_ANALYTICS' || revision.area === 'ENGAGEMENT') {
    const runtimeKey = revision.area === 'GLOBAL_HR'
      ? 'globalHrPolicyRuntime'
      : revision.area === 'DEI_ANALYTICS'
        ? 'deiAnalyticsPolicyRuntime'
        : 'engagementPolicyRuntime';
    const runtime = asRecord(draft[runtimeKey]);
    const lens = getPolicyControlLens(revision.area);
    const primaryKey = revision.area === 'GLOBAL_HR'
      ? 'workAuthorizationRules'
      : revision.area === 'DEI_ANALYTICS'
        ? 'suppressionRules'
        : 'surveyPublicationRules';
    const secondaryKey = revision.area === 'GLOBAL_HR'
      ? 'worksCouncilRules'
      : revision.area === 'DEI_ANALYTICS'
        ? 'payEquityReviewRules'
        : 'recognitionApprovalRules';
    const primaryFallback = revision.area === 'GLOBAL_HR'
      ? ['WORK_AUTH_ACTIVE_REQUIRED', 'Active work authorization required']
      : revision.area === 'DEI_ANALYTICS'
        ? ['SMALL_SEGMENT_SUPPRESSION', 'Small segment suppression']
        : ['SURVEY_PUBLICATION_APPROVAL', 'Survey publication approval'];
    const secondaryFallback = revision.area === 'GLOBAL_HR'
      ? ['WORKS_COUNCIL_REVIEW', 'Works council review']
      : revision.area === 'DEI_ANALYTICS'
        ? ['PAY_EQUITY_REVIEW_REQUIRED', 'Pay equity review required']
        : ['RECOGNITION_APPROVAL_REQUIRED', 'Recognition approval required'];
    const primaryRule = firstLedgerRecord(runtime[primaryKey], primaryFallback[0], primaryFallback[1]);
    const secondaryRule = firstLedgerRecord(runtime[secondaryKey], secondaryFallback[0], secondaryFallback[1]);
    const updateDomainRule = (key: string, fallbackCode: string, fallbackLabel: string, changes: Record<string, unknown>) => commit({
      type: 'DOMAIN_POLICY_RUNTIME',
      key: runtimeKey,
      changes: {
        [key]: upsertFirstLedgerRecord(runtime[key], fallbackCode, fallbackLabel, changes),
      },
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{lens.label}</CardTitle>
        </CardHeader>
        <BusinessControlBody editable={editable} className="grid gap-3 lg:grid-cols-4">
          <GuidedInput label="Primary rule code" value={recordCode(primaryRule) || primaryFallback[0]} onChange={(value) => updateDomainRule(primaryKey, primaryFallback[0], primaryFallback[1], { code: value })} />
          <GuidedInput label="Primary rule label" value={stringField(primaryRule, 'label', primaryFallback[1])} onChange={(value) => updateDomainRule(primaryKey, primaryFallback[0], primaryFallback[1], { label: value })} />
          <GuidedInput label="Primary decision" value={stringField(primaryRule, 'decision', revision.area === 'DEI_ANALYTICS' ? 'BLOCK_SMALL_SEGMENT' : 'REQUIRE_APPROVAL')} onChange={(value) => updateDomainRule(primaryKey, primaryFallback[0], primaryFallback[1], { decision: value })} />
          <GuidedInput label="Primary retro behavior" value={stringField(primaryRule, 'retroBehavior', 'REVALIDATE_PENDING')} onChange={(value) => updateDomainRule(primaryKey, primaryFallback[0], primaryFallback[1], { retroBehavior: value })} />
          <GuidedInput label="Secondary rule code" value={recordCode(secondaryRule) || secondaryFallback[0]} onChange={(value) => updateDomainRule(secondaryKey, secondaryFallback[0], secondaryFallback[1], { code: value })} />
          <GuidedInput label="Secondary rule label" value={stringField(secondaryRule, 'label', secondaryFallback[1])} onChange={(value) => updateDomainRule(secondaryKey, secondaryFallback[0], secondaryFallback[1], { label: value })} />
          <GuidedInput label="Secondary decision" value={stringField(secondaryRule, 'decision', 'REQUIRE_APPROVAL')} onChange={(value) => updateDomainRule(secondaryKey, secondaryFallback[0], secondaryFallback[1], { decision: value })} />
          <GuidedToggle label="Secondary rule active" checked={booleanField(secondaryRule, 'active', true)} onChange={(checked) => updateDomainRule(secondaryKey, secondaryFallback[0], secondaryFallback[1], { active: checked })} />
        </BusinessControlBody>
      </Card>
    );
  }

  const complianceRuntime = asRecord(draft.compliancePolicyRuntime);
  const acknowledgementRule = firstLedgerRecord(complianceRuntime.acknowledgementRules, 'EMPLOYEE_ACK_REQUIRED', 'Employee acknowledgement required');
  const escalationRule = firstLedgerRecord(complianceRuntime.escalationRules, 'OVERDUE_ACK_ESCALATION', 'Overdue acknowledgement escalation');
  const retentionRule = firstLedgerRecord(complianceRuntime.retentionRules, 'RETENTION_CLASS_RULE', 'Retention class rule');
  const legalHoldRule = firstLedgerRecord(complianceRuntime.legalHoldRules, 'LEGAL_HOLD_PROTECTS_EXPORT', 'Legal hold export protection');
  const evidenceExportRule = firstLedgerRecord(complianceRuntime.evidenceExportRules, 'EVIDENCE_EXPORT_PACK', 'Evidence export pack');
  const updateComplianceRule = (key: string, fallbackCode: string, fallbackLabel: string, changes: Record<string, unknown>) => commit({
    type: 'COMPLIANCE_RUNTIME',
    changes: {
      [key]: upsertFirstLedgerRecord(complianceRuntime[key], fallbackCode, fallbackLabel, changes),
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Compliance Rules</CardTitle>
      </CardHeader>
      <BusinessControlBody editable={editable} className="grid gap-3 lg:grid-cols-4">
        <GuidedInput label="Policy family" value={stringField(complianceRuntime, 'policyFamily', 'CODE_OF_CONDUCT')} onChange={(value) => commit({ type: 'COMPLIANCE_RUNTIME', changes: { policyFamily: value } })} />
        <GuidedInput label="Retention class" value={stringField(complianceRuntime, 'retentionClass', 'EXTENDED')} onChange={(value) => commit({ type: 'COMPLIANCE_RUNTIME', changes: { retentionClass: value } })} />
        <GuidedInput label="Acknowledgement due days" type="number" value={numberField(complianceRuntime, 'acknowledgementDueDays', 7)} onChange={(value) => commit({ type: 'COMPLIANCE_RUNTIME', changes: { acknowledgementDueDays: optionalNumber(value) } })} />
        <GuidedToggle label="Employee acknowledgement required" checked={booleanField(complianceRuntime, 'acknowledgementRequired', true)} onChange={(checked) => commit({ type: 'COMPLIANCE_RUNTIME', changes: { acknowledgementRequired: checked } })} />
        <div className="lg:col-span-4 grid gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 md:grid-cols-4">
          <GuidedInput label="Acknowledgement rule" value={recordCode(acknowledgementRule) || 'EMPLOYEE_ACK_REQUIRED'} onChange={(value) => updateComplianceRule('acknowledgementRules', 'EMPLOYEE_ACK_REQUIRED', 'Employee acknowledgement required', { code: value })} />
          <GuidedInput label="Audience" value={stringField(acknowledgementRule, 'audience', 'ALL_EMPLOYEES')} onChange={(value) => updateComplianceRule('acknowledgementRules', 'EMPLOYEE_ACK_REQUIRED', 'Employee acknowledgement required', { audience: value, retroBehavior: 'REVALIDATE_PENDING' })} />
          <GuidedInput label="Escalate after days" type="number" value={numberField(escalationRule, 'escalateAfterDays', 7)} onChange={(value) => updateComplianceRule('escalationRules', 'OVERDUE_ACK_ESCALATION', 'Overdue acknowledgement escalation', { escalateAfterDays: optionalNumber(value), retroBehavior: 'REVALIDATE_PENDING' })} />
          <GuidedInput label="Escalation target" value={stringField(escalationRule, 'targetRole', 'MANAGER')} onChange={(value) => updateComplianceRule('escalationRules', 'OVERDUE_ACK_ESCALATION', 'Overdue acknowledgement escalation', { targetRole: value })} />
          <GuidedInput label="Retention rule" value={recordCode(retentionRule) || 'RETENTION_CLASS_RULE'} onChange={(value) => updateComplianceRule('retentionRules', 'RETENTION_CLASS_RULE', 'Retention class rule', { code: value })} />
          <GuidedInput label="Retention years" type="number" value={numberField(retentionRule, 'retentionYears', 7)} onChange={(value) => updateComplianceRule('retentionRules', 'RETENTION_CLASS_RULE', 'Retention class rule', { retentionYears: optionalNumber(value), retroBehavior: 'FUTURE_ONLY' })} />
          <GuidedInput label="Legal hold decision" value={stringField(legalHoldRule, 'decision', 'BLOCK_DELETE')} onChange={(value) => updateComplianceRule('legalHoldRules', 'LEGAL_HOLD_PROTECTS_EXPORT', 'Legal hold export protection', { decision: value, retroBehavior: 'BLOCK_RETROACTIVE' })} />
          <GuidedInput label="Evidence export format" value={stringField(evidenceExportRule, 'format', 'ZIP_WITH_MANIFEST')} onChange={(value) => updateComplianceRule('evidenceExportRules', 'EVIDENCE_EXPORT_PACK', 'Evidence export pack', { format: value })} />
        </div>
      </BusinessControlBody>
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
            <CardDescription>{revisions.length} policy versions</CardDescription>
          </div>
          <Button type="button" onClick={() => onCreateDraft(area)}>Create Draft</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <MiniList title="Controls" icon={SlidersHorizontal} items={lens.controls} />
            <MiniList title="Used By" icon={Users} items={lens.serviceConsumers} />
            <MiniList title="Notifications" icon={BellRing} items={lens.notificationEvents} />
          </div>
          <RevisionList revisions={revisions} selectedId={selectedId} onSelect={onSelect} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Rules Summary</CardTitle>
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
  const [activeTab, setActiveTab] = React.useState('overview');
  const [selectedId, setSelectedId] = React.useState<string>('');
  const [newArea, setNewArea] = React.useState<PolicyArea>('LEAVE');
  const [newTitle, setNewTitle] = React.useState('Leave policy revision');
  const [newScope, setNewScope] = React.useState<ScopeForm>(emptyScopeForm);
  const [editorJson, setEditorJson] = React.useState('{}');
  const [editorTitle, setEditorTitle] = React.useState('');
  const [editorScope, setEditorScope] = React.useState<ScopeForm>(emptyScopeForm);
  const [editorError, setEditorError] = React.useState('');
  const [importDryRun, setImportDryRun] = React.useState<PolicyImportDryRun | undefined>();

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
  const templatesQuery = useQuery({
    queryKey: ['admin-policy-templates'],
    queryFn: async () => unwrap<PolicyTemplate[]>(await apiClient.get('/admin/policies/templates')),
  });

  const revisions = revisionsQuery.data ?? [];
  const summary = summaryQuery.data;
  const byArea = React.useMemo(() => {
    return policyAreas.reduce<Record<PolicyArea, PolicyRevision[]>>((groups, item) => {
      groups[item.area] = revisions.filter((revision) => revision.area === item.area);
      return groups;
    }, {} as Record<PolicyArea, PolicyRevision[]>);
  }, [revisions]);
  const activeArea = tabAreas[activeTab];
  const selectedRevision = revisions.find((revision) => revision.id === selectedId);
  const selectedIsInActiveArea = !activeArea || selectedRevision?.area === activeArea;
  const visibleSelectedRevision = selectedIsInActiveArea ? selectedRevision : undefined;
  const selectedIsEditable = visibleSelectedRevision ? isRevisionEditable(visibleSelectedRevision.status) : false;
  const comparisonTarget = visibleSelectedRevision
    ? revisions.find((revision) => revision.area === visibleSelectedRevision.area && revision.id !== visibleSelectedRevision.id)
    : undefined;
  const diffQuery = useQuery({
    queryKey: ['admin-policy-diff', comparisonTarget?.id, visibleSelectedRevision?.id],
    enabled: Boolean(comparisonTarget && visibleSelectedRevision),
    queryFn: async () => unwrap<PolicyRevisionDiff>(await apiClient.get(`/admin/policies/revisions/${comparisonTarget?.id}/compare/${visibleSelectedRevision?.id}`)),
  });

  React.useEffect(() => {
    if (!activeArea) {
      if (!selectedId && revisions[0]?.id) setSelectedId(revisions[0].id);
      return;
    }
    const current = revisions.find((revision) => revision.id === selectedId);
    if (current?.area === activeArea) return;
    setSelectedId(byArea[activeArea]?.[0]?.id ?? '');
  }, [activeArea, byArea, revisions, selectedId]);

  React.useEffect(() => {
    if (!visibleSelectedRevision) {
      setEditorTitle('');
      setEditorJson('{}');
      setEditorScope(emptyScopeForm);
      setEditorError('');
      return;
    }
    setEditorTitle(visibleSelectedRevision.title);
    setEditorJson(safeJson(visibleSelectedRevision.draftConfig));
    setEditorScope(scopeToForm(visibleSelectedRevision.scope));
    setEditorError('');
  }, [visibleSelectedRevision?.id, visibleSelectedRevision?.updatedAt]);

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
      setActiveTab(areaTabValues[revision.area]);
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

  const createRollbackDraft = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => (
      unwrap<PolicyRevision>(await apiClient.post(`/admin/policies/revisions/${id}/commands/create-rollback`, { reason }))
    ),
    onSuccess: (revision) => {
      setActiveTab(areaTabValues[revision.area]);
      setSelectedId(revision.id);
      invalidatePolicies();
      addNotification({ title: 'Rollback draft created', message: 'Review, publish, and apply the draft before it affects the system.', type: 'success', read: false });
    },
    onError: (mutationError) => notifyError(mutationError, 'Unable to create rollback draft.'),
  });

  const exportRevision = useMutation({
    mutationFn: async (id: string) => unwrap<Record<string, unknown>>(await apiClient.get(`/admin/policies/revisions/${id}/export`)),
    onSuccess: async (bundle) => {
      const text = JSON.stringify(bundle, null, 2);
      const canCopy = typeof navigator.clipboard?.writeText === 'function';
      if (canCopy) {
        await navigator.clipboard.writeText(text);
      }
      addNotification({ title: 'Policy bundle exported', message: canCopy ? 'Export bundle copied to clipboard.' : 'Export bundle generated.', type: 'success', read: false });
    },
    onError: (mutationError) => notifyError(mutationError, 'Unable to export policy revision.'),
  });

  const dryRunImport = useMutation({
    mutationFn: async (revision: PolicyRevision) => unwrap<PolicyImportDryRun>(await apiClient.post('/admin/policies/import/dry-run', {
      revisions: [{
        area: revision.area,
        title: `Import check: ${revision.title}`,
        draftConfig: revision.draftConfig,
        scope: revision.scope,
      }],
    })),
    onSuccess: (result) => {
      setImportDryRun(result);
      addNotification({ title: 'Import dry-run complete', message: result.valid ? 'Bundle can be imported safely.' : 'Bundle has validation or conflict issues.', type: result.valid ? 'success' : 'warning', read: false });
    },
    onError: (mutationError) => notifyError(mutationError, 'Unable to dry-run policy import.'),
  });

  const controlledApply = useMutation({
    mutationFn: async () => {
      if (!visibleSelectedRevision) throw new Error('Select a policy revision first.');
      const commands = getControlledApplyCommands(visibleSelectedRevision.status);
      if (commands.length === 0) throw new Error('This policy revision is already applied or cannot be applied.');

      let currentRevision = visibleSelectedRevision;
      if (isRevisionEditable(visibleSelectedRevision.status)) {
        currentRevision = unwrap<PolicyRevision>(await apiClient.patch(`/admin/policies/revisions/${visibleSelectedRevision.id}`, {
          title: editorTitle,
          scope: formToScope(editorScope),
          draftConfig: normalizePolicyDraftForRuntime(visibleSelectedRevision.area, parseJson(editorJson)),
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
      addNotification({ title: 'Policy applied', message: 'The policy is now active for the selected scope.', type: 'success', read: false });
    },
    onError: (mutationError) => notifyError(mutationError, 'Unable to complete controlled policy apply.'),
  });

  const createDraftForArea = (area: PolicyArea) => {
    const meta = areaMeta(area);
    setActiveTab(areaTabValues[area]);
    setNewArea(area);
    setNewTitle(`${meta.label} revision`);
    createRevision.mutate({
      area,
      title: `${meta.label} revision`,
      scope: formToScope(newScope),
      draftConfig: currentAreaConfig(area, setupQuery.data),
    });
  };

  const createChangeDraftFromSelected = () => {
    if (!visibleSelectedRevision) return;
    setActiveTab(areaTabValues[visibleSelectedRevision.area]);
    createRevision.mutate({
      area: visibleSelectedRevision.area,
      title: `Change: ${visibleSelectedRevision.title}`,
      scope: visibleSelectedRevision.scope,
      draftConfig: {
        ...visibleSelectedRevision.draftConfig,
        policyReplacement: {
          replacesRevisionId: visibleSelectedRevision.id,
          replacesStatus: visibleSelectedRevision.status,
        },
      },
    });
  };

  const createDraftFromTemplate = (template: PolicyTemplate) => {
    setActiveTab(areaTabValues[template.area]);
    createRevision.mutate({
      area: template.area,
      title: template.title,
      scope: {
        ...template.recommendedScope,
        effectiveFrom: new Date().toISOString().slice(0, 10),
      },
      draftConfig: template.draftConfig,
    });
  };

  const saveSelected = () => {
    if (!visibleSelectedRevision) return;
    if (!isRevisionEditable(visibleSelectedRevision.status)) {
      setEditorError('This revision is locked. Create a change draft before saving policy changes.');
      return;
    }
    try {
      setEditorError('');
      updateRevision.mutate({
        id: visibleSelectedRevision.id,
        title: editorTitle,
        scope: formToScope(editorScope),
        draftConfig: normalizePolicyDraftForRuntime(visibleSelectedRevision.area, parseJson(editorJson)),
      });
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Invalid policy draft data.');
    }
  };

  return (
    <div className="min-h-screen fusion-bg p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <BusinessPageHeader
          eyebrow="Governance"
          icon={ShieldCheck}
          title="Policy Center"
          subtitle="Create, review, publish, and apply the rules that control HR services."
          actions={(
            <>
              <Button asChild variant="outline">
                <Link to="/admin/system-console/settings">Setup</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/admin/compliance">Compliance</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/admin/country-policy">Country Rules</Link>
              </Button>
            </>
          )}
        />

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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex max-w-full flex-wrap justify-start gap-1 overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="service">Service Rules</TabsTrigger>
            <TabsTrigger value="leave">Leave Rules</TabsTrigger>
            <TabsTrigger value="attendance">Attendance Rules</TabsTrigger>
            <TabsTrigger value="payroll">Payroll Rules</TabsTrigger>
            <TabsTrigger value="access">Access Rules</TabsTrigger>
            <TabsTrigger value="country">Country Rules</TabsTrigger>
            <TabsTrigger value="compliance">Compliance Rules</TabsTrigger>
            <TabsTrigger value="benefits">Benefits Rules</TabsTrigger>
            <TabsTrigger value="impact">Impact</TabsTrigger>
            <TabsTrigger value="audit">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1fr_28rem]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-[#4f46e5]" />
                    Policy Lifecycle
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ['Draft', 'Prepare rule changes before they affect employees.'],
                    ['Review', 'Send changes to the right reviewers before approval.'],
                    ['Approve', 'Confirm ownership, scope, and risk.'],
                    ['Publish', 'Make the approved revision ready for use.'],
                    ['Apply', 'Activate the revision for live service decisions.'],
                    ['Notify', 'Inform impacted HR teams, managers, and employees.'],
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
                  <FileText className="h-5 w-5 text-[#4f46e5]" />
                  Enterprise Policy Templates
                </CardTitle>
                <CardDescription>Start from ready-to-use business templates.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(templatesQuery.data ?? []).map((template) => (
                  <div key={template.code} className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0f172a]">{template.title}</p>
                        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">{formatEnum(template.area)}</p>
                      </div>
                      <Badge className="bg-[#eef2ff] text-[#312e81]">{template.code}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#475569]">{template.description}</p>
                    <Button className="mt-4 w-full" variant="outline" type="button" onClick={() => createDraftFromTemplate(template)} disabled={createRevision.isPending}>
                      Create Draft
                    </Button>
                  </div>
                ))}
                {(templatesQuery.data ?? []).length === 0 ? <p className="text-sm text-[#94a3b8]">Policy templates are loading.</p> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-[#4f46e5]" />
                  Policy Coverage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PolicyControlMatrix revisions={revisions} />
              </CardContent>
            </Card>
            <WholeSystemPolicyCoverage revisions={revisions} />
          </TabsContent>

          <TabsContent value="service">
            <AreaWorkspace area="EMPLOYEE_SETUP" revisions={byArea.EMPLOYEE_SETUP ?? []} setup={setupQuery.data} selectedId={visibleSelectedRevision?.area === 'EMPLOYEE_SETUP' ? visibleSelectedRevision.id : undefined} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="leave">
            <AreaWorkspace area="LEAVE" revisions={byArea.LEAVE ?? []} setup={setupQuery.data} selectedId={visibleSelectedRevision?.area === 'LEAVE' ? visibleSelectedRevision.id : undefined} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="attendance">
            <AreaWorkspace area="ATTENDANCE" revisions={byArea.ATTENDANCE ?? []} setup={setupQuery.data} selectedId={visibleSelectedRevision?.area === 'ATTENDANCE' ? visibleSelectedRevision.id : undefined} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="payroll">
            <AreaWorkspace area="PAYROLL" revisions={byArea.PAYROLL ?? []} setup={setupQuery.data} selectedId={visibleSelectedRevision?.area === 'PAYROLL' ? visibleSelectedRevision.id : undefined} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="access">
            <AreaWorkspace area="ACCESS_GOVERNANCE" revisions={byArea.ACCESS_GOVERNANCE ?? []} setup={setupQuery.data} selectedId={visibleSelectedRevision?.area === 'ACCESS_GOVERNANCE' ? visibleSelectedRevision.id : undefined} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="country">
            <AreaWorkspace area="COUNTRY_POLICY" revisions={byArea.COUNTRY_POLICY ?? []} setup={setupQuery.data} selectedId={visibleSelectedRevision?.area === 'COUNTRY_POLICY' ? visibleSelectedRevision.id : undefined} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="compliance">
            <AreaWorkspace area="COMPLIANCE" revisions={byArea.COMPLIANCE ?? []} setup={setupQuery.data} selectedId={visibleSelectedRevision?.area === 'COMPLIANCE' ? visibleSelectedRevision.id : undefined} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="benefits">
            <AreaWorkspace area="BENEFITS" revisions={byArea.BENEFITS ?? []} setup={setupQuery.data} selectedId={visibleSelectedRevision?.area === 'BENEFITS' ? visibleSelectedRevision.id : undefined} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="global-hr">
            <AreaWorkspace area="GLOBAL_HR" revisions={byArea.GLOBAL_HR ?? []} setup={setupQuery.data} selectedId={visibleSelectedRevision?.area === 'GLOBAL_HR' ? visibleSelectedRevision.id : undefined} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="dei">
            <AreaWorkspace area="DEI_ANALYTICS" revisions={byArea.DEI_ANALYTICS ?? []} setup={setupQuery.data} selectedId={visibleSelectedRevision?.area === 'DEI_ANALYTICS' ? visibleSelectedRevision.id : undefined} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>
          <TabsContent value="engagement">
            <AreaWorkspace area="ENGAGEMENT" revisions={byArea.ENGAGEMENT ?? []} setup={setupQuery.data} selectedId={visibleSelectedRevision?.area === 'ENGAGEMENT' ? visibleSelectedRevision.id : undefined} onSelect={(revision) => setSelectedId(revision.id)} onCreateDraft={createDraftForArea} />
          </TabsContent>

          <TabsContent value="impact" className="space-y-4">
            <ImpactPanel revision={visibleSelectedRevision} />
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
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  {lifecycleOrder.map((status) => {
                    const key = `${status.toLowerCase().replace(/_/g, '')}At` as keyof PolicyRevision;
                    const value = visibleSelectedRevision?.[key];
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
                    <p className="font-semibold text-[#0f172a]">Decision History</p>
                    <p className="mt-2">Each applied rule records the decision, reason, affected record, and responsible actor.</p>
                  </div>
                  {(evidenceQuery.data ?? [])
                    .filter((item) => !visibleSelectedRevision || item.policyRevisionId === visibleSelectedRevision.id)
                    .slice(0, 6)
                    .map((item) => (
                      <div key={item.id} className="fusion-glass rounded-2xl p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-[#0f172a]">{item.decision}</span>
                          <span className="font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">{item.serviceArea}</span>
                        </div>
                        <p className="mt-2 text-[#64748b]">{item.reason}</p>
                      </div>
                    ))}
                  {((evidenceQuery.data ?? []).filter((item) => !visibleSelectedRevision || item.policyRevisionId === visibleSelectedRevision.id).length === 0) ? (
                    <p className="text-sm text-[#94a3b8]">No policy decisions have been recorded for the selected revision yet.</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {visibleSelectedRevision ? (
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Save className="h-5 w-5 text-[#4f46e5]" />
                  Revision Editor
                </CardTitle>
                <CardDescription>{formatEnum(visibleSelectedRevision.area)}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {!selectedIsEditable ? (
                  <Button type="button" variant="outline" onClick={createChangeDraftFromSelected} disabled={createRevision.isPending}>
                    Create Change Draft
                  </Button>
                ) : null}
                <span className={cn('inline-flex rounded-full border px-3 py-1 text-sm font-semibold', statusTone(visibleSelectedRevision.status))}>
                  {formatEnum(visibleSelectedRevision.status)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_12rem]">
                <div className="space-y-1.5">
                  <Label htmlFor="revision-title">Title</Label>
                  <Input id="revision-title" disabled={!selectedIsEditable} value={editorTitle} onChange={(event) => setEditorTitle(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Area</Label>
                  <div className="flex h-10 items-center rounded-lg border border-[#e2e8f0] bg-[#eef2ff] px-3 text-sm font-semibold text-[#0f172a]">
                    {formatEnum(visibleSelectedRevision.area)}
                  </div>
                </div>
              </div>
              <ScopeInputs value={editorScope} onChange={setEditorScope} disabled={!selectedIsEditable} />
              <RevisionLockedNotice status={visibleSelectedRevision.status} />
              <PolicyRuntimeLens revision={visibleSelectedRevision} evidence={evidenceQuery.data ?? []} />
              <PolicyBusinessControls
                revision={visibleSelectedRevision}
                editorJson={editorJson}
                setEditorJson={setEditorJson}
                setEditorError={setEditorError}
                editable={selectedIsEditable}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                  <FileDiff className="h-5 w-5 text-[#4f46e5]" />
                  Enterprise Change Controls
                </CardTitle>
                  <CardDescription>Compare, export, test import, and create rollback drafts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Button type="button" variant="outline" onClick={() => exportRevision.mutate(visibleSelectedRevision.id)} disabled={exportRevision.isPending}>
                      <Download className="mr-2 h-4 w-4" />
                      Export Bundle
                    </Button>
                    <Button type="button" variant="outline" onClick={() => dryRunImport.mutate(visibleSelectedRevision)} disabled={dryRunImport.isPending}>
                      <FileText className="mr-2 h-4 w-4" />
                      Import Dry-Run
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!['PUBLISHED', 'APPLIED', 'ARCHIVED'].includes(visibleSelectedRevision.status) || createRollbackDraft.isPending}
                      onClick={() => {
                        const reason = window.prompt('Rollback reason');
                        if (reason?.trim()) createRollbackDraft.mutate({ id: visibleSelectedRevision.id, reason: reason.trim() });
                      }}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Create Rollback Draft
                    </Button>
                    <Button type="button" variant="outline" disabled={!comparisonTarget} onClick={() => diffQuery.refetch()}>
                      <FileDiff className="mr-2 h-4 w-4" />
                      Refresh Compare
                    </Button>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
                      <p className="font-semibold text-[#0f172a]">Semantic Version Comparison</p>
                      <p className="mt-1 text-sm text-[#64748b]">
                        {comparisonTarget ? `Comparing against ${comparisonTarget.title}` : 'Create or select another revision in this area to compare changes.'}
                      </p>
                      <div className="mt-3 max-h-56 overflow-y-auto space-y-2">
                        {(diffQuery.data?.changes ?? []).slice(0, 8).map((change) => (
                          <div key={change.key} className="rounded-lg border border-[#e2e8f0] bg-white p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[#0f172a]">{change.label}</span>
                              <Badge className={riskTone(change.risk)}>{formatEnum(change.risk)}</Badge>
                            </div>
                            <p className="mt-1 text-[#64748b]">{displayValue(change.before)} {'->'} {displayValue(change.after)}</p>
                          </div>
                        ))}
                        {comparisonTarget && (diffQuery.data?.changes ?? []).length === 0 ? <p className="text-sm text-[#94a3b8]">No business-level differences found.</p> : null}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
                      <p className="font-semibold text-[#0f172a]">Import Validation Dry-Run</p>
                      <p className="mt-1 text-sm text-[#64748b]">Dry-run validates schema and active-scope conflicts before any revision is created.</p>
                      <div className="mt-3 space-y-2">
                        {importDryRun ? (
                          <>
                            <Badge className={importDryRun.valid ? 'bg-[#059669] text-white' : 'bg-[#e11d48] text-white'}>
                              {importDryRun.valid ? 'Import Safe' : 'Import Blocked'}
                            </Badge>
                            {importDryRun.revisions.map((item) => (
                              <div key={`${item.area}-${item.title}`} className="rounded-lg border border-[#e2e8f0] bg-white p-3 text-sm">
                                <p className="font-semibold text-[#0f172a]">{item.title}</p>
                                <p className="text-[#64748b]">{formatEnum(item.area)} - {item.validation.valid ? 'Valid' : 'Blocked'}</p>
                                {item.validation.errors.slice(0, 3).map((error) => <p key={error} className="mt-1 text-[#e11d48]">{error}</p>)}
                              </div>
                            ))}
                          </>
                        ) : <p className="text-sm text-[#94a3b8]">Run an import dry-run from the selected revision.</p>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CheckCircle2 className="h-5 w-5 text-[#4f46e5]" />
                      Controlled Apply
                    </CardTitle>
                  <CardDescription>Runs the required review, approval, publish, and apply steps.</CardDescription>
                  </div>
                  <Button
                    type="button"
                    disabled={controlledApply.isPending || getControlledApplyCommands(visibleSelectedRevision.status).length === 0}
                    onClick={() => controlledApply.mutate()}
                  >
                    {controlledApply.isPending ? 'Applying...' : 'Run Controlled Apply'}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {getControlledApplyCommands(visibleSelectedRevision.status).map((command) => (
                      <span key={command} className="rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-3 py-1 text-xs font-semibold text-[#312e81]">
                        {formatEnum(command)}
                      </span>
                    ))}
                    {getControlledApplyCommands(visibleSelectedRevision.status).length === 0 ? (
                      <span className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1 text-xs font-semibold text-[#64748b]">
                        No apply action available from {formatEnum(visibleSelectedRevision.status)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-[#475569]">
                    The wizard follows the same approval path as the manual buttons and records the change history.
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
                <Button type="button" onClick={saveSelected} disabled={updateRevision.isPending || !selectedIsEditable}>Save</Button>
                <Button type="button" variant="outline" onClick={() => commandRevision.mutate({ id: visibleSelectedRevision.id, command: 'validate' })}>Validate</Button>
                <Button type="button" variant="outline" onClick={() => commandRevision.mutate({ id: visibleSelectedRevision.id, command: 'simulate' })}>Simulate</Button>
                <Button type="button" variant="outline" onClick={() => commandRevision.mutate({ id: visibleSelectedRevision.id, command: 'submit-review' })} disabled={visibleSelectedRevision.status !== 'DRAFT'}>Submit Review</Button>
                <Button type="button" variant="outline" onClick={() => commandRevision.mutate({ id: visibleSelectedRevision.id, command: 'mark-reviewed' })} disabled={visibleSelectedRevision.status !== 'IN_REVIEW'}>Mark Reviewed</Button>
                <Button type="button" variant="outline" onClick={() => commandRevision.mutate({ id: visibleSelectedRevision.id, command: 'approve' })} disabled={visibleSelectedRevision.status !== 'REVIEWED'}>Approve</Button>
                <Button type="button" variant="outline" onClick={() => commandRevision.mutate({ id: visibleSelectedRevision.id, command: 'publish' })} disabled={visibleSelectedRevision.status !== 'APPROVED'}>Publish</Button>
                <Button type="button" onClick={() => commandRevision.mutate({ id: visibleSelectedRevision.id, command: 'apply' })} disabled={visibleSelectedRevision.status !== 'PUBLISHED'}>
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
