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

/** Onboarding bounded-context topic. */
export const HR_ONBOARDING = 'hr.onboarding.v1';

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

/** Canonical list of all HR topics. */
export const AllHrTopics = [
  HR_CORE,
  HR_RECRUITING,
  HR_ONBOARDING,
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
  Worker: HR_CORE,
  jobAssignment: HR_CORE,
  JobAssignment: HR_CORE,
  employmentContract: HR_CORE,
  EmploymentContract: HR_CORE,
  personalData: HR_CORE,
  PersonalData: HR_CORE,
  legalEntity: HR_GLOBAL,
  LegalEntity: HR_GLOBAL,
  orgUnit: HR_GLOBAL,
  OrgUnit: HR_GLOBAL,
  manager: HR_GLOBAL,
  Manager: HR_GLOBAL,
  position: HR_CORE,
  Position: HR_CORE,
  headcountRequest: HR_CORE,
  HeadcountRequest: HR_CORE,
  jobRequisition: HR_RECRUITING,
  JobRequisition: HR_RECRUITING,
  candidateApplication: HR_RECRUITING,
  CandidateApplication: HR_RECRUITING,
  candidate: HR_RECRUITING,
  Candidate: HR_RECRUITING,
  offer: HR_RECRUITING,
  Offer: HR_RECRUITING,
  onboardingPlan: HR_ONBOARDING,
  OnboardingPlan: HR_ONBOARDING,
  onboardingTask: HR_ONBOARDING,
  OnboardingTask: HR_ONBOARDING,
  compensationPlan: HR_COMPENSATION,
  CompensationPlan: HR_COMPENSATION,
  salaryStructure: HR_COMPENSATION,
  SalaryStructure: HR_COMPENSATION,
  compensationReview: HR_COMPENSATION,
  CompensationReview: HR_COMPENSATION,
  compensationChange: HR_COMPENSATION,
  CompensationChange: HR_COMPENSATION,
  bonusCycle: HR_COMPENSATION,
  BonusCycle: HR_COMPENSATION,
  equityGrant: HR_COMPENSATION,
  EquityGrant: HR_COMPENSATION,
  payScale: HR_COMPENSATION,
  PayScale: HR_COMPENSATION,
  variableCompPlan: HR_COMPENSATION,
  VariableCompPlan: HR_COMPENSATION,
  totalCompensationStatement: HR_COMPENSATION,
  TotalCompensationStatement: HR_COMPENSATION,
  payrollCycle: HR_PAYROLL,
  PayrollCycle: HR_PAYROLL,
  payrollInput: HR_PAYROLL,
  PayrollInput: HR_PAYROLL,
  payrollCalculation: HR_PAYROLL,
  PayrollCalculation: HR_PAYROLL,
  payrollCalculationRun: HR_PAYROLL,
  PayrollCalculationRun: HR_PAYROLL,
  payrollResultLine: HR_PAYROLL,
  PayrollResultLine: HR_PAYROLL,
  payslip: HR_PAYROLL,
  Payslip: HR_PAYROLL,
  benefitsProgram: HR_BENEFITS,
  BenefitsProgram: HR_BENEFITS,
  benefitsEnrollment: HR_BENEFITS,
  BenefitsEnrollment: HR_BENEFITS,
  dependent: HR_BENEFITS,
  Dependent: HR_BENEFITS,
  lifeEvent: HR_BENEFITS,
  LifeEvent: HR_BENEFITS,
  spendingAccount: HR_BENEFITS,
  SpendingAccount: HR_BENEFITS,
  carrierReconciliationRun: HR_BENEFITS,
  CarrierReconciliationRun: HR_BENEFITS,
  learningCourse: HR_LEARNING,
  LearningCourse: HR_LEARNING,
  learningAssignment: HR_LEARNING,
  LearningAssignment: HR_LEARNING,
  certification: HR_LEARNING,
  Certification: HR_LEARNING,
  learningContentPackage: HR_LEARNING,
  LearningContentPackage: HR_LEARNING,
  absenceRequest: HR_ABSENCE,
  AbsenceRequest: HR_ABSENCE,
  absenceAccrualBalance: HR_ABSENCE,
  AbsenceAccrualBalance: HR_ABSENCE,
  leaveCase: HR_ABSENCE,
  LeaveCase: HR_ABSENCE,
  leaveEntitlement: HR_ABSENCE,
  LeaveEntitlement: HR_ABSENCE,
  timesheet: HR_TIME,
  Timesheet: HR_TIME,
  timeClockEvent: HR_TIME,
  TimeClockEvent: HR_TIME,
  attendanceException: HR_TIME,
  AttendanceException: HR_TIME,
  overtime: HR_TIME,
  Overtime: HR_TIME,
  shiftSchedule: HR_TIME,
  ShiftSchedule: HR_TIME,
  shiftSwapRequest: HR_TIME,
  ShiftSwapRequest: HR_TIME,
  openShift: HR_TIME,
  OpenShift: HR_TIME,
  performanceReviewCycle: HR_CORE,
  PerformanceReviewCycle: HR_CORE,
  performanceReview: HR_CORE,
  PerformanceReview: HR_CORE,
  performanceImprovementPlan: HR_CORE,
  PerformanceImprovementPlan: HR_CORE,
  feedback360Cycle: HR_CORE,
  Feedback360Cycle: HR_CORE,
  goal: HR_CORE,
  Goal: HR_CORE,
  objective: HR_CORE,
  Objective: HR_CORE,
  calibrationSession: HR_CORE,
  CalibrationSession: HR_CORE,
  policyDocument: HR_GLOBAL,
  PolicyDocument: HR_GLOBAL,
  policyAcknowledgement: HR_GLOBAL,
  PolicyAcknowledgement: HR_GLOBAL,
  legalHold: HR_GLOBAL,
  LegalHold: HR_GLOBAL,
  statutoryReport: HR_GLOBAL,
  StatutoryReport: HR_GLOBAL,
  workAuthorizationCase: HR_GLOBAL,
  WorkAuthorizationCase: HR_GLOBAL,
  worksCouncilConsultation: HR_GLOBAL,
  WorksCouncilConsultation: HR_GLOBAL,
  countryRuleSet: HR_GLOBAL,
  CountryRuleSet: HR_GLOBAL,
  countryPolicyPack: HR_GLOBAL,
  CountryPolicyPack: HR_GLOBAL,
  reportDefinition: HR_ANALYTICS,
  ReportDefinition: HR_ANALYTICS,
  reportExecution: HR_ANALYTICS,
  ReportExecution: HR_ANALYTICS,
  reportSchedule: HR_ANALYTICS,
  ReportSchedule: HR_ANALYTICS,
  payGapReport: HR_ANALYTICS,
  PayGapReport: HR_ANALYTICS,
  payEquityReview: HR_ANALYTICS,
  PayEquityReview: HR_ANALYTICS,
  hrAiUseCase: HR_ANALYTICS,
  HrAiUseCase: HR_ANALYTICS,
  calculatedField: HR_ANALYTICS,
  CalculatedField: HR_ANALYTICS,
  serviceUsageMetric: HR_ANALYTICS,
  ServiceUsageMetric: HR_ANALYTICS,
  serviceUsageSummary: HR_ANALYTICS,
  ServiceUsageSummary: HR_ANALYTICS,
  contingentWorkerAssignment: HR_CONTINGENT,
  ContingentWorkerAssignment: HR_CONTINGENT,
  sowEngagement: HR_CONTINGENT,
  SowEngagement: HR_CONTINGENT,
  contractorRateCard: HR_CONTINGENT,
  ContractorRateCard: HR_CONTINGENT,
  misclassificationAssessment: HR_CONTINGENT,
  MisclassificationAssessment: HR_CONTINGENT,
  wellbeingCase: HR_WELLBEING,
  WellbeingCase: HR_WELLBEING,
  eapReferral: HR_WELLBEING,
  EapReferral: HR_WELLBEING,
  wellnessProgram: HR_WELLBEING,
  WellnessProgram: HR_WELLBEING,
  mentalHealthCase: HR_WELLBEING,
  MentalHealthCase: HR_WELLBEING,
  unionRecognition: HR_GLOBAL,
  UnionRecognition: HR_GLOBAL,
  grievance: HR_GLOBAL,
  Grievance: HR_GLOBAL,
  collectiveBargainingSession: HR_GLOBAL,
  CollectiveBargainingSession: HR_GLOBAL,
};

export interface EventTopicInput {
  aggregateType?: string | null;
  eventName: string;
  metadata?: { topic?: string | null } | null;
}

export const EventNameTopicPrefixes: ReadonlyArray<readonly [string, string]> = [
  ['CountryPolicyPack', HR_GLOBAL],
  ['ServiceUsageMetric', HR_ANALYTICS],
  ['ServiceUsageSummary', HR_ANALYTICS],
  ['CalculatedField', HR_ANALYTICS],
  ['TotalCompensationStatement', HR_COMPENSATION],
  ['TotalCompStatement', HR_COMPENSATION],
  ['CompensationChange', HR_COMPENSATION],
  ['CompensationPlan', HR_COMPENSATION],
  ['CompensationReview', HR_COMPENSATION],
  ['SalaryStructure', HR_COMPENSATION],
  ['VariableCompPlan', HR_COMPENSATION],
  ['BonusCycle', HR_COMPENSATION],
  ['EquityGrant', HR_COMPENSATION],
  ['PayScale', HR_COMPENSATION],
  ['PayrollCalculation', HR_PAYROLL],
  ['PayrollCycle', HR_PAYROLL],
  ['PayrollInput', HR_PAYROLL],
  ['Payslip', HR_PAYROLL],
  ['BenefitsEnrollment', HR_BENEFITS],
  ['Dependent', HR_BENEFITS],
  ['LifeEvent', HR_BENEFITS],
  ['CarrierReconciliation', HR_BENEFITS],
  ['LearningCourse', HR_LEARNING],
  ['LearningAssignment', HR_LEARNING],
  ['Certification', HR_LEARNING],
  ['ContentPackage', HR_LEARNING],
  ['AbsenceAccrualBalance', HR_ABSENCE],
  ['AccrualBalance', HR_ABSENCE],
  ['AbsenceRequest', HR_ABSENCE],
  ['LeaveEntitlement', HR_ABSENCE],
  ['LeaveCase', HR_ABSENCE],
  ['PerformanceReviewCycle', HR_CORE],
  ['PerformanceReview', HR_CORE],
  ['CalibrationSession', HR_CORE],
  ['Goal', HR_CORE],
  ['Worker', HR_CORE],
  ['JobAssignment', HR_CORE],
  ['EmploymentContract', HR_CORE],
  ['PersonalData', HR_CORE],
  ['Timesheet', HR_TIME],
  ['TimeClockEvent', HR_TIME],
  ['AttendanceException', HR_TIME],
  ['Overtime', HR_TIME],
  ['CandidateApplication', HR_RECRUITING],
  ['Candidate', HR_RECRUITING],
  ['JobRequisition', HR_RECRUITING],
  ['Offer', HR_RECRUITING],
  ['ContingentAssignment', HR_CONTINGENT],
  ['SowEngagement', HR_CONTINGENT],
  ['RateCard', HR_CONTINGENT],
  ['Misclassification', HR_CONTINGENT],
  ['EapReferral', HR_WELLBEING],
  ['WellnessProgram', HR_WELLBEING],
  ['MentalHealthCase', HR_WELLBEING],
  ['PolicyDocument', HR_GLOBAL],
  ['PolicyAcknowledgement', HR_GLOBAL],
  ['LegalHold', HR_GLOBAL],
  ['StatutoryReport', HR_GLOBAL],
  ['LegalEntity', HR_GLOBAL],
  ['OrgUnit', HR_GLOBAL],
  ['Manager', HR_GLOBAL],
  ['UnionRecognition', HR_GLOBAL],
  ['Grievance', HR_GLOBAL],
  ['CollectiveBargainingSession', HR_GLOBAL],
  ['Position', HR_CORE],
  ['HeadcountRequest', HR_CORE],
];

export interface EventContractRegistrySnapshot {
  topics: readonly string[];
  topicMappings: Record<string, string>;
  eventPrefixMappings: ReadonlyArray<readonly [string, string]>;
  defaults: {
    topic: string;
    eventSchemaVersion: number;
    envelopeVersion: number;
  };
  consumerGroupNaming: {
    convention: string;
    domainExample: string;
    purposeExample: string;
    versionExample: number;
    example: string;
  };
}

/**
 * Return a read-only event contract registry snapshot for governance/admin APIs.
 */
export function getEventContractRegistry(): EventContractRegistrySnapshot {
  return {
    topics: [...AllHrTopics],
    topicMappings: { ...TopicRegistry },
    eventPrefixMappings: EventNameTopicPrefixes.map(([prefix, topic]) => [prefix, topic] as const),
    defaults: {
      topic: HR_CORE,
      eventSchemaVersion: 1,
      envelopeVersion: 1,
    },
    consumerGroupNaming: {
      convention: '{domain}-{purpose}-consumer-v{major}',
      domainExample: 'payroll',
      purposeExample: 'payslip-delivery',
      versionExample: 1,
      example: getConsumerGroupName('payroll', 'payslip-delivery', 1),
    },
  };
}

/**
 * Resolve the canonical topic for a given aggregate type.
 * Falls back to {@link HR_CORE} when the aggregate is unknown.
 */
export function getTopicForAggregate(aggregateType: string): string {
  return TopicRegistry[aggregateType] ?? TopicRegistry[uncapitalize(aggregateType)] ?? HR_CORE;
}

/**
 * Resolve the canonical topic for an event envelope.
 *
 * Aggregate type is the primary route because it is stable across event
 * lifecycle verbs. Event name fallback keeps scheduled/outbox rows routable
 * even when older producers did not persist a known aggregate type.
 */
export function getTopicForEvent(event: EventTopicInput): string {
  const storedTopic = event.metadata?.topic?.trim();
  if (storedTopic) {
    return storedTopic;
  }

  const topicForAggregate = event.aggregateType
    ? TopicRegistry[event.aggregateType] ?? TopicRegistry[uncapitalize(event.aggregateType)]
    : undefined;
  if (topicForAggregate) {
    return topicForAggregate;
  }

  return EventNameTopicPrefixes.find(([prefix]) => event.eventName.startsWith(prefix))?.[1] ?? HR_CORE;
}

function uncapitalize(value: string): string {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
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
