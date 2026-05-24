/**
 * Canonical topic registry for the HR/HCM event nervous system.
 *
 * Topic naming convention: `hr.{boundedContext}.v{major}`
 * Consumer group naming convention: `{domain}-{purpose}-consumer-v{major}`
 */

/** HR Core bounded-context topic. */
export const HR_CORE = 'hr.core.v1';

/** Recruiting bounded-context topic. */
export const HR_RECRUITING = 'hr.recruiting.v1';

/** Compensation bounded-context topic. */
export const HR_COMPENSATION = 'hr.compensation.v1';

/** Time & attendance bounded-context topic. */
export const HR_TIME = 'hr.time.v1';

/** Absence & leave bounded-context topic. */
export const HR_ABSENCE = 'hr.absence.v1';

/** Payroll bounded-context topic. */
export const HR_PAYROLL = 'hr.payroll.v1';

/** Benefits bounded-context topic. */
export const HR_BENEFITS = 'hr.benefits.v1';

/** Learning bounded-context topic. */
export const HR_LEARNING = 'hr.learning.v1';

/** Global / shared bounded-context topic. */
export const HR_GLOBAL = 'hr.global.v1';

/** Contingent workforce bounded-context topic. */
export const HR_CONTINGENT = 'hr.contingent.v1';

/** Analytics bounded-context topic. */
export const HR_ANALYTICS = 'hr.analytics.v1';

/** Mobile bounded-context topic. */
export const HR_MOBILE = 'hr.mobile.v1';

/** Wellbeing bounded-context topic. */
export const HR_WELLBEING = 'hr.wellbeing.v1';

/** Canonical list of all 13 HR topics. */
export const AllHrTopics = [
  HR_CORE,
  HR_RECRUITING,
  HR_COMPENSATION,
  HR_TIME,
  HR_ABSENCE,
  HR_PAYROLL,
  HR_BENEFITS,
  HR_LEARNING,
  HR_GLOBAL,
  HR_CONTINGENT,
  HR_ANALYTICS,
  HR_MOBILE,
  HR_WELLBEING,
] as const;

/** Mapping from aggregate type (camelCase) to canonical topic. */
export const TopicRegistry: Record<string, string> = {
  worker: HR_CORE,
  jobAssignment: HR_CORE,
  employmentContract: HR_CORE,
  personalData: HR_CORE,
  legalEntity: HR_GLOBAL,
  orgUnit: HR_GLOBAL,
  manager: HR_GLOBAL,
  position: HR_CORE,
  headcountRequest: HR_CORE,
  jobRequisition: HR_RECRUITING,
  candidateApplication: HR_RECRUITING,
  candidate: HR_RECRUITING,
  offer: HR_RECRUITING,
  payrollCycle: HR_PAYROLL,
  payrollInput: HR_PAYROLL,
  payrollCalculation: HR_PAYROLL,
  payslip: HR_PAYROLL,
  benefitsEnrollment: HR_BENEFITS,
  dependent: HR_BENEFITS,
  lifeEvent: HR_BENEFITS,
  absenceRequest: HR_ABSENCE,
  leaveCase: HR_ABSENCE,
  leaveEntitlement: HR_ABSENCE,
  timesheet: HR_TIME,
  timeClockEvent: HR_TIME,
  attendanceException: HR_TIME,
  overtime: HR_TIME,
  performanceReviewCycle: HR_CORE,
  performanceReview: HR_CORE,
  goal: HR_CORE,
  calibrationSession: HR_CORE,
  policyDocument: HR_GLOBAL,
  policyAcknowledgement: HR_GLOBAL,
  legalHold: HR_GLOBAL,
  statutoryReport: HR_GLOBAL,
  countryPolicyPack: HR_GLOBAL,
};

/**
 * Resolve the canonical topic for a given aggregate type.
 * Falls back to {@link HR_CORE} when the aggregate is unknown.
 */
export function getTopicForAggregate(aggregateType: string): string {
  return TopicRegistry[aggregateType] ?? HR_CORE;
}

/**
 * Build a consumer group name following the platform convention.
 *
 * @param domain   – bounded context / domain (e.g. `payroll`)
 * @param purpose  – functional purpose (e.g. `payslip-delivery`)
 * @param version  – major schema version
 */
export function getConsumerGroupName(domain: string, purpose: string, version: number): string {
  return `${domain}-${purpose}-consumer-v${version}`;
}
