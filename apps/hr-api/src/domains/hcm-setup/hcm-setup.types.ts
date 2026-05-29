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
  addressLine1?: string;
  addressLine2?: string;
  latitude?: number;
  longitude?: number;
};

export type CityOption = SetupOption & {
  countryCode: string;
  flag: string;
  currency: string;
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

export type FieldRule = {
  fieldKey: string;
  label: string;
  section: string;
  required: boolean;
  active: boolean;
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
};

export type DeductionPolicy = SetupOption & {
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
};

export type EarningPolicy = SetupOption & {
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
};

export type PayrollBlockingCondition =
  | 'ATTENDANCE_BLOCKER'
  | 'DUPLICATE_PAYROLL_CYCLE'
  | 'MISSING_BANK_ACCOUNT'
  | 'MISSING_PAYROLL_COMPENSATION'
  | 'ZERO_OR_NEGATIVE_NET_PAY'
  | 'MISSING_TAX_IDENTIFIER'
  | 'MISSING_POLICY_ASSIGNMENT'
  | 'NET_BELOW_MINIMUM';

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

export type HcmSetupUpdate = Partial<HcmSetupConfig>;
