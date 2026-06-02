import { describe, expect, it } from 'vitest';
import {
  AllHrTopics,
  HR_ABSENCE,
  HR_BENEFITS,
  HR_COMPENSATION,
  HR_CORE,
  HR_GLOBAL,
  HR_CONTINGENT,
  HR_LEARNING,
  HR_ONBOARDING,
  HR_PAYROLL,
  HR_WELLBEING,
  getTopicForEvent,
} from './topic-registry.js';

describe('getTopicForEvent', () => {
  it('includes every canonical bounded-context topic in the all-topics subscription list', () => {
    expect(AllHrTopics).toContain(HR_ONBOARDING);
    expect(new Set(AllHrTopics).size).toBe(AllHrTopics.length);
  });

  it.each([
    ['absenceRequest', 'AbsenceRequestApproved', HR_ABSENCE],
    ['AbsenceRequest', 'AbsenceRequestApproved', HR_ABSENCE],
    ['BenefitsProgram', 'BenefitsProgramCreated', HR_BENEFITS],
    ['benefitsEnrollment', 'BenefitsEnrollmentFinalized', HR_BENEFITS],
    ['CompensationChange', 'CompensationChangeApproved', HR_COMPENSATION],
    ['compensationChange', 'CompensationChangeApproved', HR_COMPENSATION],
    ['BonusCycle', 'BonusCycleApproved', HR_COMPENSATION],
    ['bonusCycle', 'BonusCycleApproved', HR_COMPENSATION],
    ['EquityGrant', 'EquityGrantIssued', HR_COMPENSATION],
    ['equityGrant', 'EquityGrantIssued', HR_COMPENSATION],
    ['PayScale', 'PayScaleActivated', HR_COMPENSATION],
    ['payScale', 'PayScaleActivated', HR_COMPENSATION],
    ['VariableCompPlan', 'VariableCompPlanActivated', HR_COMPENSATION],
    ['variableCompPlan', 'VariableCompPlanActivated', HR_COMPENSATION],
    ['TotalCompensationStatement', 'TotalCompStatementGenerated', HR_COMPENSATION],
    ['totalCompensationStatement', 'TotalCompStatementGenerated', HR_COMPENSATION],
    ['CarrierReconciliationRun', 'CarrierReconciliationCompleted', HR_BENEFITS],
    ['carrierReconciliationRun', 'CarrierReconciliationCompleted', HR_BENEFITS],
    ['AbsenceAccrualBalance', 'AccrualBalanceCreated', HR_ABSENCE],
    ['absenceAccrualBalance', 'AccrualBalanceCreated', HR_ABSENCE],
    ['LearningAssignment', 'LearningAssignmentAssigned', HR_LEARNING],
    ['OnboardingPlan', 'OnboardingPlanStarted', HR_ONBOARDING],
    ['OnboardingTask', 'OnboardingTaskEvidenceRecorded', HR_ONBOARDING],
    ['learningCourse', 'LearningCoursePublished', HR_LEARNING],
    ['LearningContentPackage', 'ContentPackagePublished', HR_LEARNING],
    ['MentalHealthCase', 'MentalHealthCaseOpened', HR_WELLBEING],
    ['EapReferral', 'EapReferralCreated', HR_WELLBEING],
    ['WellnessProgram', 'WellnessProgramActivated', HR_WELLBEING],
    ['ContractorRateCard', 'RateCardActivated', HR_CONTINGENT],
    ['MisclassificationAssessment', 'MisclassificationFlagged', HR_CONTINGENT],
    ['UnionRecognition', 'UnionRecognitionActive', HR_GLOBAL],
    ['payrollCycle', 'PayrollCycleOpened', HR_PAYROLL],
    ['PayrollCalculationRun', 'PayrollCalculationRunStarted', HR_PAYROLL],
    ['performanceReviewCycle', 'PerformanceReviewCycleCreated', HR_CORE],
    ['countryPolicyPack', 'CountryPolicyPackPublished', HR_GLOBAL],
    ['worker', 'WorkerProfileCreated', HR_CORE],
  ])('routes %s / %s to %s', (aggregateType, eventName, expectedTopic) => {
    expect(getTopicForEvent({ aggregateType, eventName })).toBe(expectedTopic);
  });

  it('falls back to event name when aggregate type is absent or unknown', () => {
    expect(getTopicForEvent({ aggregateType: 'unknownAggregate', eventName: 'BenefitsEnrollmentOpened' })).toBe(
      HR_BENEFITS,
    );
    expect(getTopicForEvent({ aggregateType: 'unknownAggregate', eventName: 'CompensationChangeApproved' })).toBe(
      HR_COMPENSATION,
    );
    expect(getTopicForEvent({ eventName: 'TotalCompStatementGenerated' })).toBe(HR_COMPENSATION);
    expect(getTopicForEvent({ eventName: 'CarrierReconciliationCompleted' })).toBe(HR_BENEFITS);
    expect(getTopicForEvent({ eventName: 'AccrualBalanceCreated' })).toBe(HR_ABSENCE);
    expect(getTopicForEvent({ eventName: 'LearningAssignmentAssigned' })).toBe(HR_LEARNING);
    expect(getTopicForEvent({ eventName: 'MentalHealthCaseOpened' })).toBe(HR_WELLBEING);
    expect(getTopicForEvent({ eventName: 'RateCardCreated' })).toBe(HR_CONTINGENT);
    expect(getTopicForEvent({ eventName: 'PayrollInputSubmitted' })).toBe(HR_PAYROLL);
  });
});
