import type { HcmSetupConfig, HcmSetupUpdate } from '../hcm-setup/hcm-setup.types.js';

export const POLICY_AREAS = [
  'EMPLOYEE_SETUP',
  'LEAVE',
  'ATTENDANCE',
  'PAYROLL',
  'ACCESS_GOVERNANCE',
  'COUNTRY_POLICY',
  'COMPLIANCE',
] as const;

export type PolicyArea = typeof POLICY_AREAS[number];

export type PolicyRevisionStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'REVIEWED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'APPLIED'
  | 'REJECTED'
  | 'ARCHIVED';

export interface PolicyScope {
  tenantId: string;
  countryCodes?: string[];
  legalEntityIds?: string[];
  orgUnitIds?: string[];
  departmentIds?: string[];
  locationCodes?: string[];
  employeeTypes?: string[];
  workerIds?: string[];
  effectiveFrom?: string;
  effectiveUntil?: string;
}

export interface PolicyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  conflicts: Array<{
    revisionId: string;
    reason: string;
  }>;
  engineName: 'PolicyValidationEngine';
  engineVersion: string;
}

export interface PolicyImpactSimulationResult {
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
  engineName: 'PolicyImpactSimulationEngine';
  engineVersion: string;
}

export interface PolicyApplicationRunRecord {
  id: string;
  tenantId: string;
  revisionId: string;
  status: 'APPLIED' | 'FAILED';
  impactedEmployees: number;
  pendingRecords: PolicyImpactSimulationResult['pendingRecords'];
  appliedBy: string;
  appliedAt: string;
  runtimeSnapshot: HcmSetupUpdate;
}

export interface PolicyImpactResultRecord {
  id: string;
  tenantId: string;
  revisionId: string;
  simulationResult: PolicyImpactSimulationResult;
  createdBy: string;
  createdAt: string;
}

export interface PolicyDecisionEvidenceRecord {
  id: string;
  tenantId: string;
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
}

export interface PolicyRevisionRecord {
  id: string;
  tenantId: string;
  area: PolicyArea;
  title: string;
  status: PolicyRevisionStatus;
  baselineConfig: Partial<HcmSetupConfig> | Record<string, unknown>;
  draftConfig: Partial<HcmSetupConfig> | Record<string, unknown>;
  scope: PolicyScope;
  validationResult?: PolicyValidationResult;
  simulationResult?: PolicyImpactSimulationResult;
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
  createdAt: string;
  updatedAt: string;
  aggregateVersion: number;
}

export interface PolicyCenterSummary {
  totalRevisions: number;
  byStatus: Record<string, number>;
  byArea: Record<string, number>;
  recentRuns: PolicyApplicationRunRecord[];
}

export interface PolicyActor {
  actorId: string;
  actorName?: string;
}

export interface CreatePolicyRevisionInput {
  area: PolicyArea;
  title: string;
  draftConfig?: Partial<HcmSetupConfig> | Record<string, unknown>;
  scope?: Partial<PolicyScope>;
}

export interface UpdatePolicyRevisionInput {
  title?: string;
  draftConfig?: Partial<HcmSetupConfig> | Record<string, unknown>;
  scope?: Partial<PolicyScope>;
  reviewNotes?: string;
}

export interface PolicyCenterRepositoryPort {
  createRevision(record: PolicyRevisionRecord): Promise<PolicyRevisionRecord>;
  updateRevision(id: string, update: Partial<PolicyRevisionRecord>): Promise<PolicyRevisionRecord>;
  findRevisionById(tenantId: string, id: string): Promise<PolicyRevisionRecord | undefined>;
  listRevisions(tenantId: string, area?: PolicyArea): Promise<PolicyRevisionRecord[]>;
  listActiveRevisionsByArea(tenantId: string, area: PolicyArea): Promise<PolicyRevisionRecord[]>;
  summarizePolicyCenter(tenantId: string): Promise<PolicyCenterSummary>;
  countImpactedWorkers(tenantId: string, scope: PolicyScope): Promise<{ count: number; workerIds: string[] }>;
  countPendingDomainRecords(tenantId: string, area: PolicyArea, scope: PolicyScope): Promise<PolicyImpactSimulationResult['pendingRecords']>;
  createApplicationRun(record: PolicyApplicationRunRecord): Promise<PolicyApplicationRunRecord>;
  createImpactResult(record: PolicyImpactResultRecord): Promise<PolicyImpactResultRecord>;
  createDecisionEvidence(record: PolicyDecisionEvidenceRecord): Promise<PolicyDecisionEvidenceRecord>;
}
