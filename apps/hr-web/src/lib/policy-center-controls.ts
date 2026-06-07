export type PolicyArea =
  | 'EMPLOYEE_SETUP'
  | 'LEAVE'
  | 'ATTENDANCE'
  | 'PAYROLL'
  | 'ACCESS_GOVERNANCE'
  | 'COUNTRY_POLICY'
  | 'COMPLIANCE'
  | 'BENEFITS';

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
  | { type: 'PAYROLL_EARNING_POLICY'; code: string; changes: Record<string, unknown> }
  | { type: 'PAYROLL_DEDUCTION_POLICY'; code: string; changes: Record<string, unknown> }
  | { type: 'PAYROLL_BLOCKER'; code: string; changes: Record<string, unknown> }
  | { type: 'ACCESS_GOVERNANCE_RUNTIME'; changes: Record<string, unknown> }
  | { type: 'ACCESS_ACTION_OVERRIDE'; override: Record<string, unknown> & { id: string } }
  | { type: 'FIELD_ACCESS_OVERRIDE'; override: Record<string, unknown> & { id: string } }
  | { type: 'COUNTRY_RUNTIME'; changes: Record<string, unknown> }
  | { type: 'COMPLIANCE_RUNTIME'; changes: Record<string, unknown> }
  | { type: 'BENEFITS_RUNTIME'; changes: Record<string, unknown> };

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
    controls: ['Tax mode/rates', 'Insurance rates/caps', 'Scoped earning logic ledgers', 'Scoped deduction logic ledgers', 'Minimum-net protection', 'Close blockers', 'GL accounts and bank file formats'],
    runtimeKeys: ['payrollCalculationPolicy', 'statutoryPayrollPacks', 'earningPolicies', 'deductionPolicies', 'payrollBlockingRules'],
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
    governedBy: 'Statutory packs, scoped earning/deduction logic ledgers, tax, insurance, close blockers, GL and bank policies',
    commandEnforcement: ['PreviewPayrollCycle', 'CalculatePayrollResultLine', 'ApplyPayrollLogicLedger', 'ClosePayrollCycle', 'GeneratePayslip'],
    notificationEvents: ['PayrollPolicyChanged', 'PayrollCycleRevalidationRequired'],
    runtimeEvidence: ['payrollCalculationPolicy', 'statutoryPayrollPacks', 'earningPolicies.logicLedger', 'deductionPolicies.logicLedger', 'payrollBlockingRules'],
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

  return current;
}
