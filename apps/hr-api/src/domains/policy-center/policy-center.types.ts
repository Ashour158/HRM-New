import type { HcmSetupConfig, HcmSetupUpdate } from '../hcm-setup/hcm-setup.types.js';

export const POLICY_AREAS = [
  'EMPLOYEE_SETUP',
  'LEAVE',
  'ATTENDANCE',
  'PAYROLL',
  'ACCESS_GOVERNANCE',
  'COUNTRY_POLICY',
  'COMPLIANCE',
  'BENEFITS',
  'GLOBAL_HR',
  'DEI_ANALYTICS',
  'ENGAGEMENT',
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

export type PolicyImpactRisk = 'SAFE' | 'WARNING' | 'BLOCKED' | 'RETROACTIVE_ADJUSTMENT_REQUIRED';

export interface PolicyScope {
  tenantId: string;
  countryCodes?: string[];
  legalEntityIds?: string[];
  orgUnitIds?: string[];
  departmentIds?: string[];
  locationCodes?: string[];
  branchCodes?: string[];
  jobCodes?: string[];
  gradeCodes?: string[];
  managerWorkerIds?: string[];
  employeeTypes?: string[];
  workerIds?: string[];
  effectiveFrom?: string;
  effectiveUntil?: string;
}

export interface PolicyImpactedWorkerRecord {
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
}

export interface PolicyImpactedDomainRecord {
  recordId: string;
  workerId?: string;
  status?: string;
  beforeDecision: string;
  afterDecision: string;
  risk: PolicyImpactRisk;
}

export interface PolicyImpactRecords {
  workers: PolicyImpactedWorkerRecord[];
  leaveRequests: PolicyImpactedDomainRecord[];
  attendanceDays: PolicyImpactedDomainRecord[];
  payrollCycles: PolicyImpactedDomainRecord[];
  complianceAcknowledgements: PolicyImpactedDomainRecord[];
  accessGrants: PolicyImpactedDomainRecord[];
  benefitsEnrollments: PolicyImpactedDomainRecord[];
  benefitsLifeEvents: PolicyImpactedDomainRecord[];
}

export interface PayrollComponentPolicySimulation {
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
}

export interface DomainPolicySimulation {
  ruleCodes: string[];
  scopeDimensions: string[];
  workflowImpacts: Array<{
    ruleCode: string;
    action: string;
    risk: PolicyImpactRisk;
  }>;
  revalidationQueues: string[];
}

export interface LeavePolicySimulation extends DomainPolicySimulation {
  accrualRuleCodes: string[];
  approvalWorkflows: string[];
  payrollImpactCodes: string[];
}

export interface AttendancePolicySimulation extends DomainPolicySimulation {
  geofenceRuleCodes: string[];
  ledgerRuleCodes: string[];
  payrollBridgeCodes: string[];
}

export interface AccessPolicySimulation extends DomainPolicySimulation {
  actionOverrideIds: string[];
  fieldOverrideIds: string[];
  sodRuleCodes: string[];
}

export interface CompliancePolicySimulation extends DomainPolicySimulation {
  acknowledgementRules: string[];
  retentionClasses: string[];
  legalHoldRules: string[];
}

export interface BenefitsPolicySimulation extends DomainPolicySimulation {
  payrollBridgeCodes: string[];
  enrollmentWindows: Array<{
    ruleCode: string;
    waitingPeriodDays: number;
  }>;
  carrierExportRules: string[];
}

export interface GlobalHrPolicySimulation extends DomainPolicySimulation {
  workAuthorizationRuleCodes: string[];
  worksCouncilRuleCodes: string[];
  statutoryLeaveBridgeCodes: string[];
}

export interface DeiAnalyticsPolicySimulation extends DomainPolicySimulation {
  suppressionRuleCodes: string[];
  payEquityReviewRuleCodes: string[];
  remediationRuleCodes: string[];
}

export interface EngagementPolicySimulation extends DomainPolicySimulation {
  surveyPublicationRuleCodes: string[];
  responsePrivacyRuleCodes: string[];
  recognitionApprovalRuleCodes: string[];
}

export interface PolicyNotificationPreviewRecipient {
  audience: 'HR_OPERATIONS' | 'EMPLOYEE' | 'MANAGER' | 'POLICY_REVIEWER' | 'SERVICE_OWNER';
  workerId?: string;
  role?: string;
  title: string;
  body: string;
  channel: 'IN_APP';
  privacyLevel: 'LOW' | 'CONFIDENTIAL' | 'RESTRICTED';
}

export interface PolicyNotificationPreview {
  recipients: PolicyNotificationPreviewRecipient[];
  truncated: boolean;
  totalRecipients: number;
}

export interface PolicyRiskSummary {
  safe: number;
  warning: number;
  blocked: number;
  retroactiveAdjustmentRequired: number;
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
  impactedRecords: PolicyImpactRecords;
  notificationPreview: PolicyNotificationPreview;
  riskSummary: PolicyRiskSummary;
  pendingRecords: {
    pendingLeaveRequests: number;
    openAttendanceDays: number;
    openPayrollCycles: number;
    pendingComplianceAcknowledgements: number;
    pendingBenefitsEnrollments: number;
    pendingBenefitsLifeEvents: number;
  };
  oldDataRule: string;
  newDataRule: string;
  retroactiveRule: string;
  payrollComponentSimulation?: PayrollComponentPolicySimulation;
  leavePolicySimulation?: LeavePolicySimulation;
  attendancePolicySimulation?: AttendancePolicySimulation;
  accessPolicySimulation?: AccessPolicySimulation;
  compliancePolicySimulation?: CompliancePolicySimulation;
  benefitsPolicySimulation?: BenefitsPolicySimulation;
  globalHrPolicySimulation?: GlobalHrPolicySimulation;
  deiAnalyticsPolicySimulation?: DeiAnalyticsPolicySimulation;
  engagementPolicySimulation?: EngagementPolicySimulation;
  warnings: string[];
  engineName: 'PolicyImpactSimulationEngine';
  engineVersion: string;
}

export interface PolicyRevisionDiffChange {
  key: string;
  label: string;
  before: unknown;
  after: unknown;
  changeType: 'ADDED' | 'REMOVED' | 'CHANGED';
  risk: PolicyImpactRisk;
}

export interface PolicyRevisionDiffResult {
  area: PolicyArea;
  leftRevisionId: string;
  rightRevisionId: string;
  changes: PolicyRevisionDiffChange[];
}

export interface PolicyTemplateRecord {
  area: PolicyArea;
  code: string;
  title: string;
  description: string;
  draftConfig: Partial<HcmSetupConfig> | Record<string, unknown>;
  recommendedScope: Partial<PolicyScope>;
}

export interface PolicyExportBundle {
  exportedAt: string;
  exportedBy: string;
  revisions: Array<Pick<PolicyRevisionRecord, 'area' | 'title' | 'draftConfig' | 'scope' | 'validationResult' | 'simulationResult'>>;
}

export interface PolicyImportRevisionInput {
  area: PolicyArea;
  title: string;
  draftConfig?: Partial<HcmSetupConfig> | Record<string, unknown>;
  scope?: Partial<PolicyScope>;
}

export interface PolicyImportDryRunInput {
  revisions: PolicyImportRevisionInput[];
}

export interface PolicyImportDryRunResult {
  valid: boolean;
  revisions: Array<{
    title: string;
    area: PolicyArea;
    action: 'CREATE_DRAFT';
    validation: PolicyValidationResult;
  }>;
  errors: string[];
}

export interface PolicyRollbackInput {
  reason: string;
}

export interface PolicyApplyInput {
  confirmedHighRisk?: boolean;
  emergencyOverride?: {
    reason: string;
    expiresAt: string;
    postReviewRequired?: boolean;
  };
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
  listImpactRecords(tenantId: string, area: PolicyArea, scope: PolicyScope): Promise<PolicyImpactRecords>;
  createApplicationRun(record: PolicyApplicationRunRecord): Promise<PolicyApplicationRunRecord>;
  createImpactResult(record: PolicyImpactResultRecord): Promise<PolicyImpactResultRecord>;
  createDecisionEvidence(record: PolicyDecisionEvidenceRecord): Promise<PolicyDecisionEvidenceRecord>;
  listDecisionEvidence(tenantId: string, limit?: number): Promise<PolicyDecisionEvidenceRecord[]>;
}
