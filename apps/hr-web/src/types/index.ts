/**
 * Shared frontend types for the HR/HCM platform.
 */

/** Application user representing the authenticated identity. */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  roles: Role[];
  permissions: Permission[];
  tenantId: string;
}

/** Role assigned to a user. */
export interface Role {
  id: string;
  name: string;
  description?: string;
}

/** Permission granted to a user. */
export interface Permission {
  id: string;
  resource: string;
  action: string;
}

/** Tenant/organization context. */
export interface Tenant {
  id: string;
  name: string;
  logoUrl?: string;
  config: TenantConfig;
}

/** Tenant-specific configuration. */
export interface TenantConfig {
  currency: string;
  dateFormat: string;
  timezone: string;
  features: string[];
}

/** Worker/employee record. */
export interface Worker {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  hireDate: string;
  status: string;
  departmentId?: string;
  departmentName?: string;
  jobTitle?: string;
  managerId?: string;
  managerName?: string;
  legalEntityId?: string;
  legalEntityName?: string;
}

export interface EmployeeProfileData {
  worker: Worker;
  basic: {
    dateOfBirth?: string;
    gender?: string;
    personalEmail?: string;
    workEmail?: string;
    phoneNumber?: string;
    workPhoneNumber?: string;
    photoUrl?: string;
    photoAttachment?: {
      fileName?: string;
      mimeType?: string;
      size?: number;
      dataUrl?: string;
    };
  };
  contact: {
    address?: Record<string, string>;
    workLocation?: Record<string, string>;
    socialLinks?: Record<string, string>;
    departmentName?: string;
    dottedLineManagerId?: string;
    hrbpId?: string;
    mentorId?: string;
    colleagueIds?: string[];
  };
  emergencyContact: {
    emergencyContact?: Record<string, string>;
    emergencyContacts?: Array<Record<string, string>>;
  };
  background: {
    education?: Array<Record<string, string>>;
    experience?: Array<Record<string, string>>;
    certifications?: Array<Record<string, string>>;
  };
  compensation: {
    salaryAmount?: number;
    grossSalaryAmount?: number;
    taxAmount?: number;
    insuranceAmount?: number;
    netSalaryAmount?: number;
    medicalInsuranceAmount?: number;
    otherBenefitsAmount?: number;
    salaryCurrency?: string;
    salaryBasis?: string;
    payFrequency?: string;
    benefitsPackage?: Record<string, string | number | boolean | undefined>;
  };
  documents: {
    documents?: Array<Record<string, string | number | undefined>>;
    employmentContract?: Record<string, string | number | boolean | undefined>;
  };
  workAuthorization?: {
    workAuthorization?: Record<string, string | number | boolean | undefined>;
  };
  tax?: {
    taxProfile?: Record<string, string | number | boolean | undefined>;
  };
  banking?: {
    bankAccount?: Record<string, string | number | boolean | undefined>;
  };
  dependents?: {
    dependents?: Array<Record<string, string | number | boolean | undefined>>;
    beneficiaries?: Array<Record<string, string | number | boolean | undefined>>;
  };
  assetAccess?: {
    assets?: Array<Record<string, string | number | boolean | undefined>>;
    accessBadges?: Array<Record<string, string | number | boolean | undefined>>;
  };
  skills?: {
    skills?: Array<Record<string, string | number | boolean | undefined>>;
    licenses?: Array<Record<string, string | number | boolean | undefined>>;
    careerPreferences?: Record<string, string | number | boolean | undefined>;
  };
  consents?: {
    consents?: Array<Record<string, string | number | boolean | undefined>>;
    privacyNotices?: Array<Record<string, string | number | boolean | undefined>>;
    retentionHolds?: Array<Record<string, string | number | boolean | undefined>>;
  };
  governance: {
    dataClassification: string;
    personalDataRecords: Array<{
      id: string;
      dataCategory: string;
      dataClassification: string;
      consentStatus: string;
      state: string;
    }>;
  };
}

export interface SetupOption {
  code: string;
  label: string;
  active: boolean;
}

export interface GenderOption extends SetupOption {
  value: string;
}

export interface WorkLocationOption extends SetupOption {
  countryCode: string;
  countryName: string;
  flag: string;
  city: string;
  currency: string;
  addressLine1?: string;
  addressLine2?: string;
  latitude?: number;
  longitude?: number;
}

export interface CityOption extends SetupOption {
  countryCode: string;
  flag: string;
  currency: string;
}

export interface EmployeeIdPolicy {
  mode: 'MANUAL_ONLY' | 'AUTO' | 'MANUAL_WITH_APP_ADMIN';
  prefix?: string;
  nextNumber?: number;
}

export interface DocumentRequirement extends SetupOption {
  required: boolean;
  allowMultiple: boolean;
  acceptedMimeTypes: string[];
}

export interface FieldRule {
  fieldKey: string;
  label: string;
  section: string;
  required: boolean;
  active: boolean;
}

export interface PayrollCalculationPolicy {
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
}

export interface PayrollGlAccountMapping {
  salaryExpenseAccount?: string;
  employerInsuranceExpenseAccount?: string;
  taxPayableAccount?: string;
  insurancePayableAccount?: string;
  deductionPayableAccount?: string;
  bankClearingAccount?: string;
}

export type PayrollBankFileFormat = 'CSV' | 'CBE_EGYPT_CSV' | 'SEPA_XML' | 'NACHA';

export interface StatutoryPayrollPack extends SetupOption {
  countryCode: string;
  locationCodes?: string[];
  employeeTypes?: string[];
  currency?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  calculationPolicy: PayrollCalculationPolicy;
  glAccountMapping?: PayrollGlAccountMapping;
  bankFileFormats?: PayrollBankFileFormat[];
}

export interface AttendanceHolidayRule {
  date: string;
  name: string;
  countryCode?: string;
  locationCodes?: string[];
  paid?: boolean;
}

export interface AttendanceShiftRotationRule extends SetupOption {
  anchorDate: string;
  cycleDays: number;
  workDayOffsets: number[];
  dailyMinutes?: number;
  startTime?: string;
  endTime?: string;
  departmentCodes?: string[];
  locationCodes?: string[];
  workerIds?: string[];
}

export interface AttendanceGeofenceProfile extends SetupOption {
  locationCode: string;
  radiusMeters: number;
  highAccuracyRequiredMeters?: number;
  requireGeolocation?: boolean;
  blockOutsideGeofence?: boolean;
}

export interface AttendanceDeviceTrustRule extends SetupOption {
  deviceIdPattern: string;
  trustLevel: 'BLOCKED' | 'STANDARD' | 'TRUSTED' | 'UNTRUSTED';
  requiresApproval?: boolean;
}

export interface AttendanceFlexibleHoursRule extends SetupOption {
  flexibleWindowStart?: string;
  flexibleWindowEnd?: string;
  coreStartTime?: string;
  coreEndTime?: string;
  minimumPayableDayMinutes?: number;
  departmentCodes?: string[];
  locationCodes?: string[];
  workerIds?: string[];
}

export interface AttendancePolicy {
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
}

export interface DeductionPolicy extends SetupOption {
  type: 'FIXED_AMOUNT' | 'PERCENT_OF_GROSS' | 'PER_MINUTE';
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
}

export interface EarningPolicy extends SetupOption {
  type: 'FIXED_AMOUNT' | 'PERCENT_OF_BASE' | 'PER_MINUTE';
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
}

export type PayrollBlockingCondition =
  | 'ATTENDANCE_BLOCKER'
  | 'DUPLICATE_PAYROLL_CYCLE'
  | 'MISSING_BANK_ACCOUNT'
  | 'MISSING_PAYROLL_COMPENSATION'
  | 'ZERO_OR_NEGATIVE_NET_PAY'
  | 'MISSING_TAX_IDENTIFIER'
  | 'MISSING_POLICY_ASSIGNMENT'
  | 'NET_BELOW_MINIMUM';

export interface PayrollBlockingRule extends SetupOption {
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
}

export interface HcmSetupConfig {
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
  payrollCalculationPolicy: PayrollCalculationPolicy;
  statutoryPayrollPacks: StatutoryPayrollPack[];
  attendancePolicy: AttendancePolicy;
  earningPolicies: EarningPolicy[];
  deductionPolicies: DeductionPolicy[];
  payrollBlockingRules: PayrollBlockingRule[];
}

export interface EmployeeDuplicateCheckResult {
  canCreate: boolean;
  exactMatches: Array<{
    field: string;
    value: string;
    workerId?: string;
    employeeId?: string;
  }>;
  warnings: Array<{
    reason: string;
    workerId: string;
    employeeId: string;
    name: string;
  }>;
}

/** Standard API response wrapper. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  correlationId: string;
}

/** Paginated response wrapper. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Filter options for list queries. */
export interface FilterOptions {
  search?: string;
  status?: string;
  departmentId?: string;
  legalEntityId?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: string | undefined;
}

/** Field access decision from backend policy engine. */
export type FieldDecision = 'VISIBLE' | 'MASKED' | 'HIDDEN' | 'REQUIRES_STEP_UP';

/** Field access response. */
export interface FieldAccessResult {
  value: unknown;
  decision: FieldDecision;
  maskingRule?: string;
  reason?: string;
}

/** Allowed action returned by backend. */
export interface AllowedAction {
  id: string;
  label: string;
  action: string;
  requiresReason?: boolean;
}

/** Audit log entry. */
export interface AuditEntry {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/** Payslip record. */
export interface Payslip {
  id: string;
  workerId: string;
  employeeId?: string;
  employeeName?: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  grossPay: number;
  netPay: number;
  deductions: number;
  taxes: number;
  currency: string;
  pdfUrl?: string;
  lines?: Array<{
    id: string;
    lineType: string;
    description: string;
    amount: number;
    currency: string;
    explanation?: string;
    status?: string;
  }>;
}

/** Absence/time-off request. */
export interface AbsenceRequest {
  id: string;
  workerId: string;
  employeeId?: string;
  employeeName?: string;
  type: string;
  absenceType?: string;
  startDate: string;
  endDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  workflowStatus?: string;
  reason?: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

/** Benefit enrollment. */
export interface BenefitEnrollment {
  id: string;
  workerId: string;
  benefitType: string;
  planName: string;
  coverageLevel: string;
  effectiveDate: string;
  status: 'ACTIVE' | 'PENDING' | 'TERMINATED';
}

/** Notification item. */
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  link?: string;
}

/** Country policy pack. */
export interface CountryPolicyPack {
  id: string;
  countryCode: string;
  version: string;
  name: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  validationResult?: ValidationResult;
}

/** Validation result for policy packs. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Org unit/department. */
export interface OrgUnit {
  id: string;
  name: string;
  type: 'LEGAL_ENTITY' | 'DEPARTMENT' | 'DIVISION' | 'TEAM';
  parentId?: string;
  managerId?: string;
  managerName?: string;
  headcount: number;
}
