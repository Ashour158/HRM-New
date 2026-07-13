export type SetupOption = {
  code: string;
  label: string;
  active: boolean;
};

export type GenderOption = SetupOption & {
  value: string;
};

export type WorkLocationOption = SetupOption & {
  countryCode: string;
  countryName: string;
  flag: string;
  city: string;
  currency: string;
  timezone?: string;
  addressLine1?: string;
  addressLine2?: string;
  latitude?: number;
  longitude?: number;
};

export type CityOption = SetupOption & {
  countryCode: string;
  flag: string;
  currency: string;
  timezone?: string;
};

export type EmployeeIdPolicy = {
  mode: 'MANUAL_ONLY' | 'AUTO' | 'MANUAL_WITH_APP_ADMIN';
  prefix?: string;
  nextNumber?: number;
};

export type DocumentRequirement = SetupOption & {
  required: boolean;
  allowMultiple: boolean;
  acceptedMimeTypes: string[];
};

export type FieldRuleType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT';

export type FieldRule = {
  fieldKey: string;
  label: string;
  section: string;
  required: boolean;
  active: boolean;
  /**
   * Input type used to render/validate a genuinely custom field (any fieldKey
   * that is not one of the fixed, built-in fields listed in
   * KNOWN_FIELD_RULE_KEYS). Defaults to 'TEXT' when omitted. Ignored for
   * built-in fields, which always render their dedicated real input.
   */
  fieldType?: FieldRuleType;
  /** Selectable values when fieldType is 'SELECT'. */
  options?: string[];
};

/**
 * fieldKeys that already map to a real, dedicated input and payload property
 * across the worker create/update/profile surfaces. Any FieldRule whose
 * fieldKey is NOT in this set is a genuinely admin-defined custom field and
 * must be read from/written to the dynamic custom-field-value store
 * (PersonalDataRecord dataCategory 'CUSTOM') instead of a fixed property.
 */
export const KNOWN_FIELD_RULE_KEYS: ReadonlySet<string> = new Set([
  'firstName',
  'lastName',
  'personalEmail',
  'workEmail',
  'phoneNumber',
  'workPhoneNumber',
  'department',
  'jobTitle',
  'workAuthorization',
  'taxProfile',
  'bankAccount',
  'dependents',
  'beneficiaries',
  'assets',
  'skills',
  'consents',
  'employmentContract',
]);

export function isCustomFieldRuleKey(fieldKey: string): boolean {
  return !KNOWN_FIELD_RULE_KEYS.has(fieldKey);
}

export type LeaveDurationUnit = 'DAYS' | 'HOURS';

export type LeavePayrollImpact = 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'PERMISSION' | 'NO_PAYROLL_IMPACT';

export type LeaveApprovalWorkflow = 'MANAGER' | 'MANAGER_THEN_HR' | 'HR_ONLY' | 'AUTO_APPROVE';

export type LeavePeriodLimitWindow = 'CALENDAR_WEEK' | 'CALENDAR_MONTH' | 'ROLLING_DAYS';

export type LeavePeriodLimitStatus = 'PENDING_APPROVAL' | 'APPROVED';

export type PolicyRuleCondition = {
  field?: string;
  operator?: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'EXISTS';
  value?: unknown;
};

export type PolicyRuleOutcome = {
  action:
    | 'ALLOW'
    | 'BLOCK'
    | 'REQUIRE_APPROVAL'
    | 'REQUIRE_DOCUMENT'
    | 'CREATE_REVALIDATION'
    | 'CREATE_NOTIFICATION'
    | 'CREATE_PAYROLL_BRIDGE'
    | 'CREATE_ACKNOWLEDGEMENT'
    | 'MASK_FIELD'
    | 'REQUIRE_STEP_UP'
    | 'CREATE_CARRIER_EXPORT';
  value?: unknown;
  reason?: string;
};

export type PolicyRetroBehavior =
  | 'FUTURE_ONLY'
  | 'REVALIDATE_PENDING'
  | 'ADJUSTMENT_QUEUE'
  | 'RECALCULATE_OPEN_PERIODS'
  | 'BLOCK_RETROACTIVE';

export type PolicyRuleLedger = SetupOption & {
  scope?: HcmPolicyScope;
  conditions?: PolicyRuleCondition[];
  outcomes: PolicyRuleOutcome[];
  priority?: number;
  effectiveFrom?: string;
  effectiveUntil?: string;
  retroBehavior?: PolicyRetroBehavior;
  notificationTemplate?: string;
};

export type ApprovalStepState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELEGATED' | 'ESCALATED' | 'EXPIRED';

export type ApprovalWorkflowStepRule = SetupOption & {
  order: number;
  mode: 'SEQUENTIAL' | 'PARALLEL';
  approverType: 'ROLE' | 'WORKER';
  approverRole?: string;
  approverWorkerId?: string;
  slaHours?: number;
  escalationTiers?: Array<SetupOption & {
    afterHours: number;
    approverRole?: string;
    approverWorkerId?: string;
  }>;
};

export type ApprovalWorkflowRule = SetupOption & {
  commandName: string;
  aggregateType?: string;
  minAmount?: number;
  minDurationDays?: number;
  slaHours?: number;
  steps: ApprovalWorkflowStepRule[];
};

export type LeavePolicy = SetupOption & {
  unit: LeaveDurationUnit;
  paid: boolean;
  deductFromBalance: boolean;
  requestableByEmployee: boolean;
  systemManaged?: boolean;
  payrollImpact: LeavePayrollImpact;
  approvalWorkflow: LeaveApprovalWorkflow;
  annualEntitlement?: number;
  maxPerRequest?: number;
  allowHalfDay?: boolean;
  requiresDocumentAfter?: number;
  minNoticeDays?: number;
  employeeTypes?: string[];
  departmentCodes?: string[];
  locationCodes?: string[];
  workerIds?: string[];
  effectiveFrom?: string;
  effectiveUntil?: string;
  scope?: HcmPolicyScope;
  accrualRules?: PolicyRuleLedger[];
  carryoverRules?: PolicyRuleLedger[];
  blackoutRules?: PolicyRuleLedger[];
  approvalRules?: PolicyRuleLedger[];
  documentRules?: PolicyRuleLedger[];
  encashmentRules?: PolicyRuleLedger[];
  periodLimits?: Array<SetupOption & {
    window: LeavePeriodLimitWindow;
    maxAmount?: number;
    maxRequests?: number;
    rollingDays?: number;
    includeStatuses?: LeavePeriodLimitStatus[];
    appliesToUnits?: LeaveDurationUnit[];
    appliesToPayrollImpacts?: LeavePayrollImpact[];
  }>;
};

export type PayrollCalculationPolicy = {
  taxMode?: 'FLAT_PERCENT' | 'PROGRESSIVE_BRACKETS';
  taxRatePercent: number;
  taxBrackets?: Array<{
    code: string;
    label?: string;
    thresholdFrom: number;
    thresholdTo?: number;
    ratePercent: number;
  }>;
  employeeInsuranceRatePercent: number;
  employeeInsuranceCap?: number;
  employerInsuranceRatePercent?: number;
  employerInsuranceCap?: number;
};

export type PayrollGlAccountMapping = {
  salaryExpenseAccount?: string;
  employerInsuranceExpenseAccount?: string;
  taxPayableAccount?: string;
  insurancePayableAccount?: string;
  deductionPayableAccount?: string;
  bankClearingAccount?: string;
};

export type SalaryCompositionValueType =
  | 'PERCENT_OF_GROSS'
  | 'FIXED_AMOUNT'
  | 'REMAINDER_OF_GROSS';

export type SalaryCompositionComponentType =
  | 'BASIC'
  | 'ALLOWANCE'
  | 'BENEFIT';

export type SalaryCompositionComponent = SetupOption & {
  componentType: SalaryCompositionComponentType;
  valueType: SalaryCompositionValueType;
  amount?: number;
  ratePercent?: number;
  taxable?: boolean;
  insurable?: boolean;
  includedInGross?: boolean;
  displayOnPayslip?: boolean;
  priority?: number;
  payslipLineType?: string;
  glAccount?: string;
};

export type SalaryCompositionPlan = SetupOption & {
  countryCode?: string;
  currency?: string;
  employeeTypes?: string[];
  departmentCodes?: string[];
  locationCodes?: string[];
  workerIds?: string[];
  effectiveFrom?: string;
  effectiveUntil?: string;
  scope?: HcmPolicyScope;
  components: SalaryCompositionComponent[];
};

export type PayrollBankFileFormat = 'CSV' | 'CBE_EGYPT_CSV' | 'SEPA_XML' | 'NACHA';

export type StatutoryPayrollPack = SetupOption & {
  countryCode: string;
  locationCodes?: string[];
  employeeTypes?: string[];
  currency?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  calculationPolicy: PayrollCalculationPolicy;
  glAccountMapping?: PayrollGlAccountMapping;
  bankFileFormats?: PayrollBankFileFormat[];
};

export type AttendanceHolidayRule = {
  date: string;
  name: string;
  countryCode?: string;
  locationCodes?: string[];
  paid?: boolean;
};

export type AttendanceShiftRotationRule = SetupOption & {
  anchorDate: string;
  cycleDays: number;
  workDayOffsets: number[];
  dailyMinutes?: number;
  startTime?: string;
  endTime?: string;
  departmentCodes?: string[];
  locationCodes?: string[];
  workerIds?: string[];
};

export type AttendanceGeofenceProfile = SetupOption & {
  locationCode: string;
  radiusMeters: number;
  highAccuracyRequiredMeters?: number;
  requireGeolocation?: boolean;
  blockOutsideGeofence?: boolean;
};

export type AttendanceDeviceTrustLevel = 'BLOCKED' | 'STANDARD' | 'TRUSTED' | 'UNTRUSTED';

export type AttendanceDeviceTrustRule = SetupOption & {
  deviceIdPattern: string;
  trustLevel: AttendanceDeviceTrustLevel;
  requiresApproval?: boolean;
};

export type AttendanceFlexibleHoursRule = SetupOption & {
  flexibleWindowStart?: string;
  flexibleWindowEnd?: string;
  coreStartTime?: string;
  coreEndTime?: string;
  minimumPayableDayMinutes?: number;
  departmentCodes?: string[];
  locationCodes?: string[];
  workerIds?: string[];
};

export type AttendancePolicy = {
  standardDailyMinutes: number;
  flexibleHoursEnabled: boolean;
  flexibleWindowStart?: string;
  flexibleWindowEnd?: string;
  coreStartTime?: string;
  coreEndTime?: string;
  standardStartTime?: string;
  standardEndTime?: string;
  lateGraceMinutes: number;
  overtimeAfterMinutes: number;
  geofenceEnabled: boolean;
  allowedRadiusMeters?: number;
  timezone?: string;
  timezoneOffsetMinutes?: number;
  workDays?: number[];
  holidays?: Array<{ date: string; name: string }>;
  roundingIncrementMinutes?: number;
  unpaidBreakMinutes?: number;
  missingCheckoutBlocksPayroll?: boolean;
  duplicatePunchBlocksPayroll?: boolean;
  lowTrustPunchBlocksPayroll?: boolean;
  minClockTrustScore?: number;
  minimumPayableDayMinutes?: number;
  shiftRotations?: AttendanceShiftRotationRule[];
  geofenceProfiles?: AttendanceGeofenceProfile[];
  deviceTrustRules?: AttendanceDeviceTrustRule[];
  flexibleHoursRules?: AttendanceFlexibleHoursRule[];
  holidayCalendars?: AttendanceHolidayRule[];
  ruleLedger?: PolicyRuleLedger[];
  scheduleRules?: PolicyRuleLedger[];
  exceptionRules?: PolicyRuleLedger[];
  correctionRules?: PolicyRuleLedger[];
  rosterCoverageRules?: PolicyRuleLedger[];
  payrollBridgeRules?: PolicyRuleLedger[];
};

export type PayrollPolicyLogicLedgerSource =
  | 'ATTENDANCE_LEDGER'
  | 'LEAVE_LEDGER'
  | 'PAYROLL_LEDGER'
  | 'BENEFITS_LEDGER'
  | 'LOAN_LEDGER'
  | 'MANUAL_INPUT';

export type PayrollPolicyLogicLedgerBase =
  | 'FIXED_AMOUNT'
  | 'BASE_GROSS'
  | 'GROSS_SALARY'
  | 'TAXABLE_BASE'
  | 'NET_BEFORE_DEDUCTION'
  | 'HOURLY_RATE'
  | 'ATTENDANCE_LATE_MINUTES'
  | 'ATTENDANCE_UNDERTIME_MINUTES'
  | 'ATTENDANCE_OVERTIME_MINUTES'
  | 'ATTENDANCE_OVERTIME_HOURS'
  | 'ATTENDANCE_ABSENCE_DAYS'
  | 'ATTENDANCE_PAYABLE_MINUTES'
  | 'ATTENDANCE_WORKED_MINUTES'
  | 'ATTENDANCE_GEOFENCE_VIOLATIONS';

export type PayrollPolicyLogicLedgerMethod =
  | 'FIXED_AMOUNT'
  | 'PERCENT_OF_BASE'
  | 'PER_UNIT'
  | 'BRACKET';

export type PayrollPolicyRetroBehavior =
  PolicyRetroBehavior;

export type PayrollPolicyLogicLedgerBracket = {
  code: string;
  label?: string;
  thresholdFrom: number;
  thresholdTo?: number;
  amount?: number;
  ratePercent?: number;
};

export type PayrollPolicyLogicLedgerPosting = {
  payslipLineType?: string;
  glAccount?: string;
  costCenterAccount?: string;
  liabilityAccount?: string;
  employerCost?: boolean;
};

export type PayrollPolicyLogicLedgerRule = {
  code: string;
  label?: string;
  active?: boolean;
  priority?: number;
  source: PayrollPolicyLogicLedgerSource;
  base: PayrollPolicyLogicLedgerBase;
  method: PayrollPolicyLogicLedgerMethod;
  amount?: number;
  ratePercent?: number;
  multiplier?: number;
  brackets?: PayrollPolicyLogicLedgerBracket[];
  monthlyCap?: number;
  perEventCap?: number;
  floorAmount?: number;
  minimumNetPay?: number;
  posting?: PayrollPolicyLogicLedgerPosting;
  retroBehavior?: PayrollPolicyRetroBehavior;
};

export type DeductionPolicy = SetupOption & {
  type: 'FIXED_AMOUNT' | 'PERCENT_OF_GROSS' | 'PER_MINUTE' | 'LOGIC_LEDGER';
  amount?: number;
  ratePercent?: number;
  attendanceEvent?: 'ABSENCE' | 'GEOFENCE_VIOLATION' | 'LATE' | 'OVERTIME' | 'UNDERTIME';
  taxable?: boolean;
  timing?: 'PRE_TAX' | 'POST_TAX';
  priority?: number;
  maxAmount?: number;
  appliesToEmployeeTypes?: string[];
  employeeIds?: string[];
  departmentCodes?: string[];
  locationCodes?: string[];
  workerIds?: string[];
  effectiveFrom?: string;
  effectiveUntil?: string;
  scope?: HcmPolicyScope;
  logicLedger?: PayrollPolicyLogicLedgerRule;
  calculationLedger?: PayrollPolicyLogicLedgerRule[];
  glPosting?: PayrollPolicyLogicLedgerPosting;
  retroBehavior?: PayrollPolicyRetroBehavior;
};

export type EarningPolicy = SetupOption & {
  type: 'FIXED_AMOUNT' | 'PERCENT_OF_BASE' | 'PER_MINUTE' | 'LOGIC_LEDGER';
  amount?: number;
  ratePercent?: number;
  attendanceEvent?: 'OVERTIME' | 'ON_DUTY' | 'WORKED' | 'PAYABLE';
  taxable: boolean;
  insurable?: boolean;
  recurring?: boolean;
  priority?: number;
  maxAmount?: number;
  appliesToEmployeeTypes?: string[];
  employeeIds?: string[];
  departmentCodes?: string[];
  locationCodes?: string[];
  workerIds?: string[];
  effectiveFrom?: string;
  effectiveUntil?: string;
  scope?: HcmPolicyScope;
  logicLedger?: PayrollPolicyLogicLedgerRule;
  calculationLedger?: PayrollPolicyLogicLedgerRule[];
  glPosting?: PayrollPolicyLogicLedgerPosting;
  retroBehavior?: PayrollPolicyRetroBehavior;
};

export type PayrollBlockingCondition =
  | 'ATTENDANCE_BLOCKER'
  | 'DUPLICATE_PAYROLL_CYCLE'
  | 'MISSING_BANK_ACCOUNT'
  | 'MISSING_PAYROLL_COMPENSATION'
  | 'ZERO_OR_NEGATIVE_NET_PAY'
  | 'MISSING_TAX_IDENTIFIER'
  | 'MISSING_POLICY_ASSIGNMENT'
  | 'NET_BELOW_MINIMUM'
  | 'COUNTRY_POLICY_STALE';

export type PayrollBlockingRule = SetupOption & {
  condition: PayrollBlockingCondition;
  severity: 'ERROR' | 'WARNING';
  blocking: boolean;
  message?: string;
  workerIds?: string[];
  employeeIds?: string[];
  employeeTypes?: string[];
  departmentCodes?: string[];
  locationCodes?: string[];
  minNetSalary?: number;
};

export type HcmPolicyScope = {
  tenantId?: string;
  countryCodes?: string[];
  legalEntityIds?: string[];
  branchCodes?: string[];
  orgUnitIds?: string[];
  departmentIds?: string[];
  jobCodes?: string[];
  gradeCodes?: string[];
  locationCodes?: string[];
  employeeTypes?: string[];
  managerWorkerIds?: string[];
  workerIds?: string[];
  effectiveFrom?: string;
  effectiveUntil?: string;
};

export type AllowedActionPolicyOverride = {
  id: string;
  active: boolean;
  aggregateType: string;
  action: string;
  roles?: string[];
  effect: 'ALLOW' | 'HIDE';
  label?: string;
  requiresReason?: boolean;
  reason?: string;
  scope?: HcmPolicyScope;
};

export type FieldAccessPolicyOverride = {
  id: string;
  active: boolean;
  resourceType: string;
  fieldPath: string;
  roles?: string[];
  decision: 'VISIBLE' | 'MASKED' | 'HIDDEN' | 'REQUIRES_STEP_UP' | 'REQUIRES_BREAK_GLASS' | 'DENIED';
  maskingRule?: string;
  reason?: string;
  scope?: HcmPolicyScope;
};

export type PolicyGovernanceConfig = {
  allowedActionOverrides: AllowedActionPolicyOverride[];
  fieldAccessOverrides: FieldAccessPolicyOverride[];
  actionRuleLedgers?: PolicyRuleLedger[];
  fieldRuleLedgers?: PolicyRuleLedger[];
  roleGrantRules?: PolicyRuleLedger[];
  sodRules?: PolicyRuleLedger[];
  breakGlassRules?: PolicyRuleLedger[];
  serviceAccountRules?: PolicyRuleLedger[];
  certificationRules?: PolicyRuleLedger[];
};

export type CompliancePolicyRuntime = {
  policyFamily?: string;
  acknowledgementRequired?: boolean;
  acknowledgementDueDays?: number;
  retentionClass?: string;
  acknowledgementRules?: PolicyRuleLedger[];
  escalationRules?: PolicyRuleLedger[];
  retentionRules?: PolicyRuleLedger[];
  legalHoldRules?: PolicyRuleLedger[];
  evidenceExportRules?: PolicyRuleLedger[];
  countryPackRules?: PolicyRuleLedger[];
};

export type BenefitsPolicyRuntime = {
  eligibilityRules?: PolicyRuleLedger[];
  enrollmentWindowRules?: PolicyRuleLedger[];
  lifeEventRules?: PolicyRuleLedger[];
  dependentRules?: PolicyRuleLedger[];
  contributionRules?: PolicyRuleLedger[];
  carrierExportRules?: PolicyRuleLedger[];
  payrollBridgeRules?: PolicyRuleLedger[];
  evidenceRules?: PolicyRuleLedger[];
};

export type GlobalHrPolicyRuntime = {
  countryRuleSetRules?: PolicyRuleLedger[];
  workAuthorizationRules?: PolicyRuleLedger[];
  worksCouncilRules?: PolicyRuleLedger[];
  statutoryLeaveBridgeRules?: PolicyRuleLedger[];
};

export type DeiAnalyticsPolicyRuntime = {
  reportPublicationRules?: PolicyRuleLedger[];
  payGapRules?: PolicyRuleLedger[];
  payEquityReviewRules?: PolicyRuleLedger[];
  suppressionRules?: PolicyRuleLedger[];
  remediationRules?: PolicyRuleLedger[];
};

export type EngagementPolicyRuntime = {
  surveyPublicationRules?: PolicyRuleLedger[];
  responsePrivacyRules?: PolicyRuleLedger[];
  recognitionApprovalRules?: PolicyRuleLedger[];
  feedbackCycleRules?: PolicyRuleLedger[];
  notificationRules?: PolicyRuleLedger[];
};

export type RuntimePolicyArea =
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

export type RuntimePolicyRevisionEvidence = {
  area: RuntimePolicyArea;
  revisionId: string;
  status: 'APPLIED';
  appliedAt: string;
  scope?: HcmPolicyScope;
  engineName: string;
  engineVersion: string;
};

export interface HcmSetupConfig {
  timezone?: string;
  genderOptions: GenderOption[];
  workPhoneEnabled: boolean;
  locations: WorkLocationOption[];
  cities: CityOption[];
  departments: SetupOption[];
  jobTitles: SetupOption[];
  employeeIdPolicy: EmployeeIdPolicy;
  socialMediaFields: SetupOption[];
  documentRequirements: DocumentRequirement[];
  fieldRules: FieldRule[];
  leavePolicies: LeavePolicy[];
  payrollCalculationPolicy: PayrollCalculationPolicy;
  statutoryPayrollPacks: StatutoryPayrollPack[];
  salaryCompositionPlans: SalaryCompositionPlan[];
  attendancePolicy: AttendancePolicy;
  earningPolicies: EarningPolicy[];
  deductionPolicies: DeductionPolicy[];
  payrollBlockingRules: PayrollBlockingRule[];
  policyGovernance?: PolicyGovernanceConfig;
  countryPolicyRuntime?: Record<string, unknown>;
  compliancePolicyRuntime?: CompliancePolicyRuntime;
  benefitsPolicyRuntime?: BenefitsPolicyRuntime;
  globalHrPolicyRuntime?: GlobalHrPolicyRuntime;
  deiAnalyticsPolicyRuntime?: DeiAnalyticsPolicyRuntime;
  engagementPolicyRuntime?: EngagementPolicyRuntime;
  runtimePolicyRevisions?: RuntimePolicyRevisionEvidence[];
  approvalWorkflowRules?: ApprovalWorkflowRule[];
}

export type HcmSetupUpdate = Partial<HcmSetupConfig>;
