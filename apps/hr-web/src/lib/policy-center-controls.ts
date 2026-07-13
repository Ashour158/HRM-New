export type PolicyArea =
  | 'EMPLOYEE_SETUP'
  | 'LEAVE'
  | 'ATTENDANCE'
  | 'PAYROLL'
  | 'ACCESS_GOVERNANCE'
  | 'COUNTRY_POLICY'
  | 'COMPLIANCE'
  | 'BENEFITS'
  | 'GLOBAL_HR'
  | 'DEI_ANALYTICS'
  | 'ENGAGEMENT';

export type PolicyStatus = 'DRAFT' | 'IN_REVIEW' | 'REVIEWED' | 'APPROVED' | 'PUBLISHED' | 'APPLIED' | 'REJECTED' | 'ARCHIVED';

export type PolicyCommand = 'validate' | 'simulate' | 'submit-review' | 'mark-reviewed' | 'approve' | 'publish' | 'apply';

export type PolicyControlLens = {
  area: PolicyArea;
  label: string;
  brain: string;
  description: string;
  engines: string[];
  controls: string[];
  runtimeKeys: string[];
  serviceConsumers: string[];
  evidenceFields: string[];
  notificationEvents: string[];
};

export type SystemPolicySurface = {
  module: string;
  policyArea: PolicyArea;
  governedBy: string;
  commandEnforcement: string[];
  notificationEvents: string[];
  runtimeEvidence: string[];
};

export type GuidedPolicyChange =
  | { type: 'EMPLOYEE_FIELD_RULE'; fieldKey: string; changes: Record<string, unknown> }
  | { type: 'DOCUMENT_REQUIREMENT'; code: string; changes: Record<string, unknown> }
  | { type: 'LEAVE_RULE'; code: string; changes: Record<string, unknown> }
  | { type: 'ATTENDANCE_RULE'; changes: Record<string, unknown> }
  | { type: 'PAYROLL_CALCULATION'; changes: Record<string, unknown> }
  | { type: 'PAYROLL_STATUTORY_PACK'; code: string; changes: Record<string, unknown> }
  | { type: 'PAYROLL_SALARY_COMPOSITION'; code: string; changes: Record<string, unknown> }
  | { type: 'PAYROLL_EARNING_POLICY'; code: string; changes: Record<string, unknown> }
  | { type: 'PAYROLL_DEDUCTION_POLICY'; code: string; changes: Record<string, unknown> }
  | { type: 'PAYROLL_BLOCKER'; code: string; changes: Record<string, unknown> }
  | { type: 'ACCESS_GOVERNANCE_RUNTIME'; changes: Record<string, unknown> }
  | { type: 'ACCESS_ACTION_OVERRIDE'; override: Record<string, unknown> & { id: string } }
  | { type: 'FIELD_ACCESS_OVERRIDE'; override: Record<string, unknown> & { id: string } }
  | { type: 'COUNTRY_RUNTIME'; changes: Record<string, unknown> }
  | { type: 'COMPLIANCE_RUNTIME'; changes: Record<string, unknown> }
  | { type: 'BENEFITS_RUNTIME'; changes: Record<string, unknown> }
  | {
      type: 'DOMAIN_POLICY_RUNTIME';
      key: 'globalHrPolicyRuntime' | 'deiAnalyticsPolicyRuntime' | 'engagementPolicyRuntime';
      changes: Record<string, unknown>;
    };

export const POLICY_CONTROL_LENSES = {
  EMPLOYEE_SETUP: {
    area: 'EMPLOYEE_SETUP',
    label: 'Core HR Data Governance',
    brain: 'EmployeeSetupPolicyBrain',
    description: 'Controls employee identity, required fields, document requirements, locations, departments, and ID generation.',
    engines: ['EmployeeProfileValidationEngine', 'DocumentRequirementEngine', 'DataGovernanceEngine', 'EmployeeIdPolicyEngine'],
    controls: ['Employee ID mode', 'Required profile fields', 'Protected data sections', 'Document requirements', 'Departments and job title catalogs'],
    runtimeKeys: ['employeeIdPolicy', 'fieldRules', 'documentRequirements', 'departments', 'jobTitles', 'locations'],
    serviceConsumers: ['Admin employee creation', 'Employee profile updates', 'Digital employee file', 'Onboarding document evidence'],
    evidenceFields: ['policyRevisionId', 'fieldKey', 'documentCode', 'decision', 'reason'],
    notificationEvents: ['PolicyRevisionApplied', 'EmployeeRequiredFieldChanged', 'DocumentRequirementChanged'],
  },
  LEAVE: {
    area: 'LEAVE',
    label: 'Leave Management',
    brain: 'LeavePolicyBrain',
    description: 'Controls leave eligibility, balances, notice windows, approval workflow, documents, payroll impact, and employee self-service visibility.',
    engines: ['LeavePolicyService', 'LeaveBalanceEngine', 'LeaveApprovalWorkflow', 'LeavePayrollImpactEngine'],
    controls: ['Entitlement', 'Maximum per request', 'Minimum notice', 'Approval workflow', 'Payroll impact', 'Document threshold'],
    runtimeKeys: ['leavePolicies'],
    serviceConsumers: ['Employee leave request', 'Manager leave approval', 'Attendance absence ledger', 'Payroll absence input', 'Leave balance cards'],
    evidenceFields: ['policyRevisionId', 'leaveType', 'scopeMatch', 'approvalWorkflow', 'payrollImpact', 'decision'],
    notificationEvents: ['PolicyRevisionApplied', 'LeavePolicyChanged', 'LeaveRequestRevalidated'],
  },
  ATTENDANCE: {
    area: 'ATTENDANCE',
    label: 'Time, Attendance, And Scheduling',
    brain: 'AttendancePolicyBrain',
    description: 'Controls check-in/out evidence, geofence, device trust, shifts, flexible hours, exceptions, and payroll blockers.',
    engines: ['AttendancePolicyResolutionService', 'GeofenceValidationEngine', 'DeviceTrustEngine', 'AttendanceLedgerEngine'],
    controls: ['Geofence requirement', 'Allowed radius', 'Clock trust score', 'Late grace', 'Overtime threshold', 'Payroll blocking rules'],
    runtimeKeys: ['attendancePolicy'],
    serviceConsumers: ['Employee check-in/out', 'Attendance daily ledger', 'Correction approval', 'Payroll attendance deductions', 'Coverage dashboard'],
    evidenceFields: ['policyRevisionId', 'geofenceProfile', 'clockTrustScore', 'locationEvidence', 'decision', 'reason'],
    notificationEvents: ['PolicyRevisionApplied', 'AttendancePolicyChanged', 'AttendanceExceptionRevalidated'],
  },
  PAYROLL: {
    area: 'PAYROLL',
    label: 'Payroll And Reward',
    brain: 'PayrollPolicyBrain',
    description: 'Controls statutory packs, tax, insurance, scoped earning/deduction logic ledgers, blockers, GL preview, and bank file readiness.',
    engines: ['PayrollStatutoryPolicyService', 'PayrollCalculationEngine', 'PayrollLogicLedgerEngine', 'PayrollBlockingEngine', 'PayrollCloseWorkflow'],
    controls: ['Salary composition', 'Tax mode/rates', 'Insurance rates/caps', 'Scoped earning logic ledgers', 'Scoped deduction logic ledgers', 'Minimum-net protection', 'Close blockers', 'GL accounts and bank file formats'],
    runtimeKeys: ['payrollCalculationPolicy', 'statutoryPayrollPacks', 'salaryCompositionPlans', 'earningPolicies', 'deductionPolicies', 'payrollBlockingRules'],
    serviceConsumers: ['Payroll preview', 'Payroll close', 'Payslip generation', 'GL posting preview', 'Bank batch preview'],
    evidenceFields: ['policyRevisionId', 'statutoryPackCode', 'ledgerRuleCode', 'scopeMatch', 'calculationBase', 'glAccount', 'decision', 'reason'],
    notificationEvents: ['PolicyRevisionApplied', 'PayrollPolicyChanged', 'PayrollCycleRevalidationRequired'],
  },
  ACCESS_GOVERNANCE: {
    area: 'ACCESS_GOVERNANCE',
    label: 'Access Governance',
    brain: 'AccessPolicyBrain',
    description: 'Controls allowed actions, field access, masking, break-glass, service accounts, and privileged workflow surfaces.',
    engines: ['AllowedActionPolicyEngine', 'FieldAccessPolicyEngine', 'CommandAuthorizationEngine', 'AccessReviewWorkflow'],
    controls: ['Allowed action overrides', 'Field visibility/masking', 'Role scope', 'Step-up requirements', 'Break-glass restrictions'],
    runtimeKeys: ['policyGovernance'],
    serviceConsumers: ['Admin command execution', 'Employee self-service actions', 'Manager approvals', 'API allowed-actions endpoint', 'Access review campaigns'],
    evidenceFields: ['policyRevisionId', 'aggregateType', 'action', 'fieldPath', 'roles', 'decision'],
    notificationEvents: ['PolicyRevisionApplied', 'AccessPolicyChanged', 'AccessReviewRequired'],
  },
  COUNTRY_POLICY: {
    area: 'COUNTRY_POLICY',
    label: 'Country Policy',
    brain: 'CountryPolicyBrain',
    description: 'Controls statutory country packs, localization, validation, impact simulation, approval, and publish flow.',
    engines: ['CountryPolicyValidationEngine', 'CountryPolicyImpactEngine', 'CountryPolicyPublicationSaga'],
    controls: ['Country code', 'Statutory effective dates', 'Localization rules', 'Payroll statutory references', 'Publication workflow'],
    runtimeKeys: ['countryPolicyRuntime'],
    serviceConsumers: ['Country policy validation', 'Global HR rule sets', 'Payroll statutory checks', 'Compliance reporting'],
    evidenceFields: ['policyRevisionId', 'countryCode', 'packVersion', 'simulationRunId', 'decision'],
    notificationEvents: ['PolicyRevisionApplied', 'CountryPolicyChanged', 'CountryPolicyImpactDetected'],
  },
  COMPLIANCE: {
    area: 'COMPLIANCE',
    label: 'Compliance Policies',
    brain: 'CompliancePolicyBrain',
    description: 'Controls policy documents, acknowledgements, legal holds, retention, statutory reports, and employee notifications.',
    engines: ['CompliancePolicyDocumentWorkflow', 'AcknowledgementWorkflow', 'LegalHoldEngine', 'StatutoryReportWorkflow'],
    controls: ['Acknowledgement required', 'Audience scope', 'Legal hold rules', 'Retention class', 'Statutory report controls'],
    runtimeKeys: ['compliancePolicyRuntime'],
    serviceConsumers: ['Compliance documents', 'Employee acknowledgement center', 'Legal holds', 'Statutory reports', 'Audit export'],
    evidenceFields: ['policyRevisionId', 'documentId', 'acknowledgementId', 'legalHoldId', 'decision'],
    notificationEvents: ['PolicyRevisionApplied', 'ComplianceAcknowledgementRequired', 'LegalHoldChanged'],
  },
  BENEFITS: {
    area: 'BENEFITS',
    label: 'Benefits Rules',
    brain: 'BenefitsPolicyBrain',
    description: 'Controls eligibility, enrollment windows, life events, dependents, evidence, carrier exports, contributions, and payroll deduction bridges.',
    engines: ['BenefitsPolicyResolutionService', 'BenefitsEligibilityEngine', 'BenefitsLifeEventWorkflow', 'BenefitsPayrollBridgeEngine', 'CarrierExportGovernanceEngine'],
    controls: ['Eligibility ledgers', 'Enrollment windows', 'Life event approval', 'Dependent evidence', 'Contribution split', 'Carrier exports', 'Payroll deduction bridge'],
    runtimeKeys: ['benefitsPolicyRuntime'],
    serviceConsumers: ['Employee benefits enrollment', 'Life event approval', 'Dependent evidence review', 'Carrier reconciliation', 'Payroll contribution sync'],
    evidenceFields: ['policyRevisionId', 'benefitsRuleCode', 'scopeMatch', 'workerId', 'enrollmentId', 'decision', 'reason'],
    notificationEvents: ['PolicyRevisionApplied', 'BenefitsPolicyChanged', 'BenefitsEnrollmentRevalidated', 'BenefitsEvidenceRequired'],
  },
  GLOBAL_HR: {
    area: 'GLOBAL_HR',
    label: 'Global HR Rules',
    brain: 'GlobalHrPolicyBrain',
    description: 'Controls work authorization, statutory leave types, works council consultations, country rule sets, and cross-country compliance handoffs.',
    engines: ['GlobalHrPolicyResolver', 'WorkAuthorizationEngine', 'WorksCouncilWorkflowEngine', 'StatutoryLeaveBridgeEngine'],
    controls: ['Country rule sets', 'Work authorization lifecycle', 'Works council triggers', 'Statutory leave bridges', 'Cross-country escalation'],
    runtimeKeys: ['runtimePolicyRevisions', 'countryPolicyRuntime'],
    serviceConsumers: ['Work authorization cases', 'Country rule set maintenance', 'Works council consultations', 'Statutory leave type setup'],
    evidenceFields: ['policyRevisionId', 'countryCode', 'workerId', 'authorizationCaseId', 'decision', 'reason'],
    notificationEvents: ['PolicyRevisionApplied', 'WorkAuthorizationPolicyChanged', 'WorksCouncilRuleChanged'],
  },
  DEI_ANALYTICS: {
    area: 'DEI_ANALYTICS',
    label: 'DEI Analytics Rules',
    brain: 'DeiAnalyticsPolicyBrain',
    description: 'Controls DEI report publication, pay gap calculations, pay equity reviews, suppression thresholds, and remediation workflows.',
    engines: ['DeiReportPolicyResolver', 'PayGapSuppressionEngine', 'PayEquityWorkflowEngine', 'AttritionAnalyticsPrivacyEngine'],
    controls: ['Suppression thresholds', 'Pay gap calculations', 'Review workflow', 'Remediation triggers', 'Publication approval'],
    runtimeKeys: ['runtimePolicyRevisions'],
    serviceConsumers: ['DEI reports', 'Pay gap reports', 'Pay equity reviews', 'Attrition segment reports'],
    evidenceFields: ['policyRevisionId', 'reportId', 'segmentKey', 'suppressionDecision', 'decision', 'reason'],
    notificationEvents: ['PolicyRevisionApplied', 'DeiReportPolicyChanged', 'PayEquityReviewPolicyChanged'],
  },
  ENGAGEMENT: {
    area: 'ENGAGEMENT',
    label: 'Engagement Rules',
    brain: 'EngagementPolicyBrain',
    description: 'Controls survey publication, anonymous response handling, recognition approvals, feedback cycles, and employee engagement notifications.',
    engines: ['EngagementSurveyPolicyResolver', 'AnonymousResponsePrivacyEngine', 'RecognitionWorkflowEngine', 'FeedbackCyclePolicyEngine'],
    controls: ['Survey lifecycle', 'Anonymity and privacy', 'Recognition approval', 'Feedback cycle governance', 'Notification rules'],
    runtimeKeys: ['runtimePolicyRevisions'],
    serviceConsumers: ['Engagement surveys', 'Survey responses', 'Recognition programs', 'Recognition awards', 'Feedback 360 cycles'],
    evidenceFields: ['policyRevisionId', 'surveyId', 'recognitionId', 'privacyDecision', 'decision', 'reason'],
    notificationEvents: ['PolicyRevisionApplied', 'EngagementSurveyPolicyChanged', 'RecognitionPolicyChanged'],
  },
} satisfies Record<PolicyArea, PolicyControlLens>;

export const SYSTEM_POLICY_SURFACES: SystemPolicySurface[] = [
  {
    module: 'Employee Master Data',
    policyArea: 'EMPLOYEE_SETUP',
    governedBy: 'Required field, document, employee ID, and data governance policies',
    commandEnforcement: ['CreateWorker', 'ActivateWorker', 'UpdateWorkerProfile', 'UploadWorkerDocument'],
    notificationEvents: ['PolicyRevisionApplied', 'EmployeeRequiredFieldChanged'],
    runtimeEvidence: ['fieldRules', 'documentRequirements', 'employeeIdPolicy'],
  },
  {
    module: 'Organization Structure',
    policyArea: 'EMPLOYEE_SETUP',
    governedBy: 'Departments, locations, job titles, assignment required-field policies, and access governance',
    commandEnforcement: ['CreateLegalEntity', 'CreateOrgUnit', 'AssignWorkerOrganization', 'AssignManager'],
    notificationEvents: ['PolicyRevisionApplied', 'OrganizationSetupChanged'],
    runtimeEvidence: ['departments', 'locations', 'fieldRules'],
  },
  {
    module: 'Leave Management',
    policyArea: 'LEAVE',
    governedBy: 'Leave entitlement, notice, documents, balance, approval, and payroll-impact policy',
    commandEnforcement: ['SubmitLeaveRequest', 'ApproveLeaveRequest', 'RejectLeaveRequest', 'RevalidatePendingLeave'],
    notificationEvents: ['LeavePolicyChanged', 'LeaveRequestRevalidated'],
    runtimeEvidence: ['leavePolicies', 'admin_policy_decision_evidence'],
  },
  {
    module: 'Attendance And Scheduling',
    policyArea: 'ATTENDANCE',
    governedBy: 'Geofence, device trust, shifts, flexible hours, exception, ledger, and payroll-blocker policies',
    commandEnforcement: ['RecordTimeClockEvent', 'ApproveAttendanceCorrection', 'CloseAttendancePeriod', 'BuildAttendanceLedger'],
    notificationEvents: ['AttendancePolicyChanged', 'AttendanceExceptionRevalidated'],
    runtimeEvidence: ['attendancePolicy', 'geofenceProfiles', 'deviceTrustRules'],
  },
  {
    module: 'Payroll',
    policyArea: 'PAYROLL',
    governedBy: 'Salary composition, statutory packs, scoped earning/deduction logic ledgers, tax, insurance, close blockers, GL and bank policies',
    commandEnforcement: ['PreviewPayrollCycle', 'CalculatePayrollResultLine', 'ApplyPayrollLogicLedger', 'ClosePayrollCycle', 'GeneratePayslip'],
    notificationEvents: ['PayrollPolicyChanged', 'PayrollCycleRevalidationRequired'],
    runtimeEvidence: ['payrollCalculationPolicy', 'statutoryPayrollPacks', 'salaryCompositionPlans', 'earningPolicies.logicLedger', 'deductionPolicies.logicLedger', 'payrollBlockingRules'],
  },
  {
    module: 'Benefits',
    policyArea: 'BENEFITS',
    governedBy: 'Eligibility, enrollment windows, life events, dependents, contributions, carrier export, evidence, and payroll bridge policies',
    commandEnforcement: ['SubmitBenefitsEnrollment', 'ChangeBenefitsCoverage', 'ApproveBenefitsLifeEvent', 'ReconcileCarrierFile', 'SyncPayrollContribution'],
    notificationEvents: ['BenefitsPolicyChanged', 'BenefitsEnrollmentRevalidated', 'BenefitsEvidenceRequired'],
    runtimeEvidence: ['benefitsPolicyRuntime', 'admin_policy_decision_evidence', 'notification_inbox'],
  },
  {
    module: 'Global HR',
    policyArea: 'GLOBAL_HR',
    governedBy: 'Country rule sets, work authorization, statutory leave, works council, and cross-country compliance policies',
    commandEnforcement: ['CreateCountryRuleSet', 'CreateWorkAuthorizationCase', 'CreateWorksCouncilConsultation', 'CreateStatutoryLeaveType'],
    notificationEvents: ['WorkAuthorizationPolicyChanged', 'WorksCouncilRuleChanged', 'PolicyRevisionApplied'],
    runtimeEvidence: ['runtimePolicyRevisions', 'countryPolicyRuntime', 'admin_policy_decision_evidence'],
  },
  {
    module: 'DEI Analytics',
    policyArea: 'DEI_ANALYTICS',
    governedBy: 'DEI reporting, pay gap calculation, pay equity review, suppression threshold, remediation, and publication policies',
    commandEnforcement: ['GenerateDeiReport', 'ReviewDeiReport', 'PublishPayGapReport', 'StartPayEquityRemediation'],
    notificationEvents: ['DeiReportPolicyChanged', 'PayEquityReviewPolicyChanged', 'PolicyRevisionApplied'],
    runtimeEvidence: ['runtimePolicyRevisions', 'admin_policy_decision_evidence', 'service_usage_reporting'],
  },
  {
    module: 'Engagement',
    policyArea: 'ENGAGEMENT',
    governedBy: 'Survey lifecycle, response privacy, recognition approval, feedback cycle, and employee communication policies',
    commandEnforcement: ['PublishEngagementSurvey', 'SubmitSurveyResponse', 'ApproveRecognitionRecord', 'AwardRecognitionRecord'],
    notificationEvents: ['EngagementSurveyPolicyChanged', 'RecognitionPolicyChanged', 'PolicyRevisionApplied'],
    runtimeEvidence: ['runtimePolicyRevisions', 'admin_policy_decision_evidence', 'notification_inbox'],
  },
  {
    module: 'Onboarding',
    policyArea: 'EMPLOYEE_SETUP',
    governedBy: 'Joining field rules, document requirements, compliance acknowledgements, and access policy',
    commandEnforcement: ['CreateOnboardingPlan', 'CompleteOnboardingTask', 'UploadJoiningDocument', 'ProvisionAccess'],
    notificationEvents: ['DocumentRequirementChanged', 'ComplianceAcknowledgementRequired'],
    runtimeEvidence: ['documentRequirements', 'fieldRules', 'compliancePolicyRuntime'],
  },
  {
    module: 'Performance',
    policyArea: 'ACCESS_GOVERNANCE',
    governedBy: 'Allowed actions, field access, review visibility, manager scope, and compliance policies',
    commandEnforcement: ['CreatePerformanceCycle', 'SubmitGoal', 'ApproveReview', 'CalibrateRating'],
    notificationEvents: ['AccessPolicyChanged', 'PerformanceWorkflowPolicyChanged'],
    runtimeEvidence: ['policyGovernance', 'fieldAccessOverrides'],
  },
  {
    module: 'Services And Cases',
    policyArea: 'ACCESS_GOVERNANCE',
    governedBy: 'Allowed self-service actions, service categories, field access, assignment, and SLA policy',
    commandEnforcement: ['CreateServiceRequest', 'AssignServiceCase', 'ResolveServiceCase', 'EscalateServiceCase'],
    notificationEvents: ['AccessPolicyChanged', 'ServicePolicyChanged'],
    runtimeEvidence: ['allowedActionOverrides', 'fieldAccessOverrides'],
  },
  {
    module: 'Notifications And Outbox',
    policyArea: 'COMPLIANCE',
    governedBy: 'Notification audience, privacy, acknowledgement, legal hold, and delivery governance',
    commandEnforcement: ['PublishOutboxEvent', 'ProjectNotification', 'ReplayDeadLetter', 'EscalateOverdueAcknowledgement'],
    notificationEvents: ['PolicyRevisionApplied', 'ComplianceAcknowledgementRequired'],
    runtimeEvidence: ['compliancePolicyRuntime', 'outbox_events', 'notification_inbox'],
  },
  {
    module: 'Reporting',
    policyArea: 'ACCESS_GOVERNANCE',
    governedBy: 'Report access, field masking, service usage evidence, audit, and data export policy',
    commandEnforcement: ['CreateReportDefinition', 'RunReport', 'ExportReport', 'ReadServiceUsage'],
    notificationEvents: ['AccessPolicyChanged', 'ReportGovernanceChanged'],
    runtimeEvidence: ['fieldAccessOverrides', 'platform_service_usage', 'audit_ledger'],
  },
  {
    module: 'Integrations And Service Accounts',
    policyArea: 'ACCESS_GOVERNANCE',
    governedBy: 'Service account ownership, credential lifecycle, access review, integration action, and field policies',
    commandEnforcement: ['IssueServiceCredential', 'RotateServiceCredential', 'RevokeServiceCredential', 'RunAccessReview'],
    notificationEvents: ['AccessPolicyChanged', 'AccessReviewRequired'],
    runtimeEvidence: ['allowedActionOverrides', 'serviceAccounts', 'accessReviewCampaigns'],
  },
  {
    module: 'Country Policy',
    policyArea: 'COUNTRY_POLICY',
    governedBy: 'Country statutory packs, localization, impact simulation, approval, and publication policy',
    commandEnforcement: ['UploadCountryPolicyPack', 'ValidateCountryPolicyPack', 'SimulateCountryPolicyImpact', 'PublishCountryPolicyPack'],
    notificationEvents: ['CountryPolicyChanged', 'CountryPolicyImpactDetected'],
    runtimeEvidence: ['countryPolicyRuntime', 'countryPolicyPackVersion'],
  },
  {
    module: 'Compliance',
    policyArea: 'COMPLIANCE',
    governedBy: 'Policy documents, acknowledgements, legal holds, retention, and statutory-report policies',
    commandEnforcement: ['PublishPolicyDocument', 'RequirePolicyAcknowledgement', 'PlaceLegalHold', 'SubmitStatutoryReport'],
    notificationEvents: ['ComplianceAcknowledgementRequired', 'LegalHoldChanged'],
    runtimeEvidence: ['compliancePolicyRuntime', 'policyAcknowledgements', 'legalHolds'],
  },
];

export function getControlledApplyCommands(status: PolicyStatus): PolicyCommand[] {
  if (status === 'DRAFT') return ['validate', 'simulate', 'submit-review', 'mark-reviewed', 'approve', 'publish', 'apply'];
  if (status === 'IN_REVIEW') return ['validate', 'simulate', 'mark-reviewed', 'approve', 'publish', 'apply'];
  if (status === 'REVIEWED') return ['validate', 'simulate', 'approve', 'publish', 'apply'];
  if (status === 'APPROVED') return ['validate', 'simulate', 'publish', 'apply'];
  if (status === 'PUBLISHED') return ['validate', 'simulate', 'apply'];
  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function upsertByKey(records: unknown, key: string, keyValue: string, changes: Record<string, unknown>): Record<string, unknown>[] {
  const rows = asRecordArray(records);
  let updated = false;
  const next = rows.map((row) => {
    if (row[key] !== keyValue) return row;
    updated = true;
    return { ...row, ...changes };
  });
  return updated ? next : [...next, { [key]: keyValue, active: true, ...changes }];
}

function upsertOverride(records: unknown, override: Record<string, unknown> & { id: string }): Record<string, unknown>[] {
  return upsertByKey(records, 'id', override.id, override);
}

export function getPolicyControlLens(area: PolicyArea): PolicyControlLens {
  return POLICY_CONTROL_LENSES[area];
}

export function normalizePolicyDraftForRuntime(area: PolicyArea, draft: Record<string, unknown>): Record<string, unknown> {
  const current = asRecord(draft);
  if (area !== 'ATTENDANCE') return current;

  const attendancePolicy = asRecord(current.attendancePolicy);
  if (typeof attendancePolicy.geofenceRadiusMeters === 'number' && typeof attendancePolicy.allowedRadiusMeters !== 'number') {
    return {
      ...current,
      attendancePolicy: {
        ...attendancePolicy,
        allowedRadiusMeters: attendancePolicy.geofenceRadiusMeters,
      },
    };
  }

  return current;
}

export function applyGuidedPolicyChange(area: PolicyArea, draft: Record<string, unknown>, change: GuidedPolicyChange): Record<string, unknown> {
  const current = asRecord(draft);

  if (area === 'EMPLOYEE_SETUP' && change.type === 'EMPLOYEE_FIELD_RULE') {
    return { ...current, fieldRules: upsertByKey(current.fieldRules, 'fieldKey', change.fieldKey, change.changes) };
  }

  if (area === 'EMPLOYEE_SETUP' && change.type === 'DOCUMENT_REQUIREMENT') {
    return { ...current, documentRequirements: upsertByKey(current.documentRequirements, 'code', change.code, change.changes) };
  }

  if (area === 'LEAVE' && change.type === 'LEAVE_RULE') {
    return { ...current, leavePolicies: upsertByKey(current.leavePolicies, 'code', change.code, change.changes) };
  }

  if (area === 'ATTENDANCE' && change.type === 'ATTENDANCE_RULE') {
    const changes = { ...change.changes };
    if (typeof changes.allowedRadiusMeters === 'number') {
      changes.geofenceRadiusMeters = changes.allowedRadiusMeters;
    } else if (typeof changes.geofenceRadiusMeters === 'number') {
      changes.allowedRadiusMeters = changes.geofenceRadiusMeters;
    }
    return { ...current, attendancePolicy: { ...asRecord(current.attendancePolicy), ...changes } };
  }

  if (area === 'PAYROLL' && change.type === 'PAYROLL_CALCULATION') {
    return { ...current, payrollCalculationPolicy: { ...asRecord(current.payrollCalculationPolicy), ...change.changes } };
  }

  if (area === 'PAYROLL' && change.type === 'PAYROLL_STATUTORY_PACK') {
    return { ...current, statutoryPayrollPacks: upsertByKey(current.statutoryPayrollPacks, 'code', change.code, change.changes) };
  }

  if (area === 'PAYROLL' && change.type === 'PAYROLL_SALARY_COMPOSITION') {
    return { ...current, salaryCompositionPlans: upsertByKey(current.salaryCompositionPlans, 'code', change.code, change.changes) };
  }

  if (area === 'PAYROLL' && change.type === 'PAYROLL_EARNING_POLICY') {
    return { ...current, earningPolicies: upsertByKey(current.earningPolicies, 'code', change.code, change.changes) };
  }

  if (area === 'PAYROLL' && change.type === 'PAYROLL_DEDUCTION_POLICY') {
    return { ...current, deductionPolicies: upsertByKey(current.deductionPolicies, 'code', change.code, change.changes) };
  }

  if (area === 'PAYROLL' && change.type === 'PAYROLL_BLOCKER') {
    return { ...current, payrollBlockingRules: upsertByKey(current.payrollBlockingRules, 'code', change.code, change.changes) };
  }

  if (area === 'ACCESS_GOVERNANCE' && change.type === 'ACCESS_ACTION_OVERRIDE') {
    const governance = asRecord(current.policyGovernance);
    return {
      ...current,
      policyGovernance: {
        ...governance,
        allowedActionOverrides: upsertOverride(governance.allowedActionOverrides, change.override),
        fieldAccessOverrides: asRecordArray(governance.fieldAccessOverrides),
      },
    };
  }

  if (area === 'ACCESS_GOVERNANCE' && change.type === 'FIELD_ACCESS_OVERRIDE') {
    const governance = asRecord(current.policyGovernance);
    return {
      ...current,
      policyGovernance: {
        ...governance,
        allowedActionOverrides: asRecordArray(governance.allowedActionOverrides),
        fieldAccessOverrides: upsertOverride(governance.fieldAccessOverrides, change.override),
      },
    };
  }

  if (area === 'ACCESS_GOVERNANCE' && change.type === 'ACCESS_GOVERNANCE_RUNTIME') {
    return {
      ...current,
      policyGovernance: {
        ...asRecord(current.policyGovernance),
        ...change.changes,
      },
    };
  }

  if (area === 'COUNTRY_POLICY' && change.type === 'COUNTRY_RUNTIME') {
    return {
      ...current,
      countryPolicyRuntime: {
        ...asRecord(current.countryPolicyRuntime),
        ...change.changes,
      },
    };
  }

  if (area === 'COMPLIANCE' && change.type === 'COMPLIANCE_RUNTIME') {
    return {
      ...current,
      compliancePolicyRuntime: {
        ...asRecord(current.compliancePolicyRuntime),
        ...change.changes,
      },
    };
  }

  if (area === 'BENEFITS' && change.type === 'BENEFITS_RUNTIME') {
    return {
      ...current,
      benefitsPolicyRuntime: {
        ...asRecord(current.benefitsPolicyRuntime),
        ...change.changes,
      },
    };
  }

  if (change.type === 'DOMAIN_POLICY_RUNTIME') {
    return {
      ...current,
      [change.key]: {
        ...asRecord(current[change.key]),
        ...change.changes,
      },
    };
  }

  return current;
}

// ---------------------------------------------------------------------------
// Generic policy rule ledger builder
//
// The admin Policy Builder screen offers a generic "Add rule" widget
// (code / condition / outcome / value) that is meant to work across policy
// areas. Each area's real simulate/validate engine in
// apps/hr-api/src/domains/policy-center/policy-center.service.ts only reads
// specific, area-scoped "rule ledger" arrays (e.g. LEAVE reads
// leavePolicies[].accrualRules, ATTENDANCE reads attendancePolicy.ruleLedger,
// etc. — see build*PolicySimulation in that file). This section maps the
// generic rule rows onto those real structured keys so a rule created in the
// UI is actually evaluated by the engine, instead of being written to an
// unread key.
//
// Areas whose real runtime shape cannot represent an arbitrary
// condition/outcome rule list (PAYROLL logic ledgers are per-component math,
// COUNTRY_POLICY is a fixed set of named parameters, EMPLOYEE_SETUP fieldRules
// is a fixed fieldKey/required/sensitivity shape) are intentionally excluded —
// see isRuleLedgerSupportedArea.
// ---------------------------------------------------------------------------

export const RULE_LEDGER_OUTCOME_ACTIONS = [
  'ALLOW',
  'BLOCK',
  'REQUIRE_APPROVAL',
  'REQUIRE_DOCUMENT',
  'REQUIRE_EVIDENCE',
  'REQUIRE_STEP_UP',
  'CREATE_REVALIDATION',
  'CREATE_NOTIFICATION',
  'CREATE_PAYROLL_BRIDGE',
  'CREATE_ACKNOWLEDGEMENT',
  'CREATE_CARRIER_EXPORT',
  'CREATE_REMEDIATION_CASE',
  'CREATE_POLICY_BRIDGE',
  'MASK_FIELD',
] as const;

export type RuleLedgerOutcomeAction = typeof RULE_LEDGER_OUTCOME_ACTIONS[number];

export const RULE_LEDGER_RETRO_BEHAVIORS = [
  'FUTURE_ONLY',
  'REVALIDATE_PENDING',
  'ADJUSTMENT_QUEUE',
  'RECALCULATE_OPEN_PERIODS',
  'BLOCK_RETROACTIVE',
] as const;

export type RuleLedgerRetroBehavior = typeof RULE_LEDGER_RETRO_BEHAVIORS[number];

export type RuleLedgerCategory = { key: string; label: string };

export type RuleLedgerAreaConfig = {
  /** How the ledger arrays nest inside draftConfig for this area. */
  nesting: 'RUNTIME_ROOT' | 'LEAVE_POLICY';
  /**
   * RUNTIME_ROOT: the single runtime object key the ledger arrays attach to
   * directly (e.g. 'attendancePolicy').
   * LEAVE_POLICY: the array-of-policies key the ledger arrays nest inside
   * per policy (always 'leavePolicies').
   */
  rootKey: string;
  /** The real ledger array keys the area's simulate/validate engine reads. */
  categories: RuleLedgerCategory[];
};

export const RULE_LEDGER_AREAS: Partial<Record<PolicyArea, RuleLedgerAreaConfig>> = {
  LEAVE: {
    nesting: 'LEAVE_POLICY',
    rootKey: 'leavePolicies',
    categories: [
      { key: 'accrualRules', label: 'Accrual' },
      { key: 'carryoverRules', label: 'Carryover' },
      { key: 'blackoutRules', label: 'Blackout window' },
      { key: 'approvalRules', label: 'Approval routing' },
      { key: 'documentRules', label: 'Document requirement' },
      { key: 'encashmentRules', label: 'Encashment' },
    ],
  },
  ATTENDANCE: {
    nesting: 'RUNTIME_ROOT',
    rootKey: 'attendancePolicy',
    categories: [
      { key: 'ruleLedger', label: 'General rule ledger' },
      { key: 'scheduleRules', label: 'Schedule' },
      { key: 'exceptionRules', label: 'Exception' },
      { key: 'correctionRules', label: 'Correction' },
      { key: 'rosterCoverageRules', label: 'Roster coverage' },
      { key: 'payrollBridgeRules', label: 'Payroll bridge' },
    ],
  },
  ACCESS_GOVERNANCE: {
    nesting: 'RUNTIME_ROOT',
    rootKey: 'policyGovernance',
    categories: [
      { key: 'actionRuleLedgers', label: 'Action governance' },
      { key: 'fieldRuleLedgers', label: 'Field governance' },
      { key: 'roleGrantRules', label: 'Role grant' },
      { key: 'sodRules', label: 'Segregation of duties' },
      { key: 'breakGlassRules', label: 'Break glass' },
      { key: 'serviceAccountRules', label: 'Service account' },
      { key: 'certificationRules', label: 'Access certification' },
    ],
  },
  COMPLIANCE: {
    nesting: 'RUNTIME_ROOT',
    rootKey: 'compliancePolicyRuntime',
    categories: [
      { key: 'acknowledgementRules', label: 'Acknowledgement' },
      { key: 'escalationRules', label: 'Escalation' },
      { key: 'retentionRules', label: 'Retention' },
      { key: 'legalHoldRules', label: 'Legal hold' },
      { key: 'evidenceExportRules', label: 'Evidence export' },
      { key: 'countryPackRules', label: 'Country pack' },
    ],
  },
  BENEFITS: {
    nesting: 'RUNTIME_ROOT',
    rootKey: 'benefitsPolicyRuntime',
    categories: [
      { key: 'eligibilityRules', label: 'Eligibility' },
      { key: 'enrollmentWindowRules', label: 'Enrollment window' },
      { key: 'lifeEventRules', label: 'Life event' },
      { key: 'dependentRules', label: 'Dependent' },
      { key: 'contributionRules', label: 'Contribution' },
      { key: 'carrierExportRules', label: 'Carrier export' },
      { key: 'payrollBridgeRules', label: 'Payroll bridge' },
      { key: 'evidenceRules', label: 'Evidence' },
    ],
  },
  GLOBAL_HR: {
    nesting: 'RUNTIME_ROOT',
    rootKey: 'globalHrPolicyRuntime',
    categories: [
      { key: 'workAuthorizationRules', label: 'Work authorization' },
      { key: 'worksCouncilRules', label: 'Works council' },
      { key: 'statutoryLeaveBridgeRules', label: 'Statutory leave bridge' },
    ],
  },
  DEI_ANALYTICS: {
    nesting: 'RUNTIME_ROOT',
    rootKey: 'deiAnalyticsPolicyRuntime',
    categories: [
      { key: 'suppressionRules', label: 'Suppression' },
      { key: 'payEquityReviewRules', label: 'Pay equity review' },
      { key: 'remediationRules', label: 'Remediation' },
    ],
  },
  ENGAGEMENT: {
    nesting: 'RUNTIME_ROOT',
    rootKey: 'engagementPolicyRuntime',
    categories: [
      { key: 'surveyPublicationRules', label: 'Survey publication' },
      { key: 'responsePrivacyRules', label: 'Response privacy' },
      { key: 'recognitionApprovalRules', label: 'Recognition approval' },
    ],
  },
};

/** Areas where the generic condition/outcome rule builder can cleanly map to a real structured key. */
export function isRuleLedgerSupportedArea(area: PolicyArea): boolean {
  return Object.prototype.hasOwnProperty.call(RULE_LEDGER_AREAS, area);
}

export function getRuleLedgerAreaConfig(area: PolicyArea): RuleLedgerAreaConfig | undefined {
  return RULE_LEDGER_AREAS[area];
}

export function getRuleLedgerCategories(area: PolicyArea): RuleLedgerCategory[] {
  return RULE_LEDGER_AREAS[area]?.categories ?? [];
}

export type GenericPolicyRule = {
  code: string;
  label: string;
  category: string;
  action: string;
  value?: string;
  reason?: string;
  retroBehavior?: RuleLedgerRetroBehavior;
  active?: boolean;
};

/** Minimal, schema-valid defaults for a leave policy shell created only to host generic ledger rules. */
const DEFAULT_LEAVE_POLICY_SHELL = {
  active: true,
  unit: 'DAYS',
  paid: true,
  deductFromBalance: true,
  requestableByEmployee: true,
  payrollImpact: 'NO_PAYROLL_IMPACT',
  approvalWorkflow: 'MANAGER',
} as const;

export const DEFAULT_GENERIC_LEAVE_POLICY_CODE = 'GENERAL';

/**
 * Appends a generic rule row into the real structured ledger key for the
 * given area, returning a new draftConfig. No-ops (returns draft unchanged)
 * for areas that are not in RULE_LEDGER_AREAS — callers must gate the UI with
 * isRuleLedgerSupportedArea so those areas never reach this function.
 */
export function appendGenericPolicyRule(
  area: PolicyArea,
  draft: Record<string, unknown>,
  rule: GenericPolicyRule,
  options?: { leavePolicyCode?: string },
): Record<string, unknown> {
  const current = asRecord(draft);
  const config = RULE_LEDGER_AREAS[area];
  if (!config) return current;

  const categoryKeys = config.categories.map((category) => category.key);
  const category = categoryKeys.includes(rule.category) ? rule.category : categoryKeys[0];
  if (!category) return current;

  const outcome: Record<string, unknown> = { action: rule.action || 'ALLOW' };
  if (rule.value !== undefined && rule.value.trim().length > 0) outcome.value = rule.value;
  if (rule.reason) outcome.reason = rule.reason;

  const ledgerEntry: Record<string, unknown> = {
    code: rule.code,
    label: rule.label || rule.code,
    active: rule.active ?? true,
    outcomes: [outcome],
  };
  if (rule.retroBehavior) ledgerEntry.retroBehavior = rule.retroBehavior;

  if (config.nesting === 'LEAVE_POLICY') {
    const leavePolicyCode = options?.leavePolicyCode?.trim() || DEFAULT_GENERIC_LEAVE_POLICY_CODE;
    const policies = asRecordArray(current[config.rootKey]);
    let matched = false;
    const nextPolicies = policies.map((policy) => {
      if (policy.code !== leavePolicyCode) return policy;
      matched = true;
      const existingLedger = Array.isArray(policy[category]) ? policy[category] as unknown[] : [];
      return { ...policy, [category]: [...existingLedger, ledgerEntry] };
    });
    if (!matched) {
      nextPolicies.push({
        code: leavePolicyCode,
        label: leavePolicyCode,
        ...DEFAULT_LEAVE_POLICY_SHELL,
        [category]: [ledgerEntry],
      });
    }
    return { ...current, [config.rootKey]: nextPolicies };
  }

  const root = asRecord(current[config.rootKey]);
  const existingLedger = Array.isArray(root[category]) ? root[category] as unknown[] : [];
  return {
    ...current,
    [config.rootKey]: {
      ...root,
      [category]: [...existingLedger, ledgerEntry],
    },
  };
}

/**
 * Folds a list of generic rule rows into a base draftConfig. Rows with a
 * blank code are skipped (nothing to key the ledger entry on). Returns the
 * base draftConfig untouched for areas the generic builder does not support.
 */
export function buildDraftConfigFromGenericRules(
  area: PolicyArea,
  baseDraftConfig: Record<string, unknown>,
  rules: GenericPolicyRule[],
  options?: { leavePolicyCode?: string },
): Record<string, unknown> {
  const base = asRecord(baseDraftConfig);
  if (!isRuleLedgerSupportedArea(area)) return base;
  return rules.reduce(
    (draft, rule) => (rule.code.trim().length > 0 ? appendGenericPolicyRule(area, draft, rule, options) : draft),
    base,
  );
}
