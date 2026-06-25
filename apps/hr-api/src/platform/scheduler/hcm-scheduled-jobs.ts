import { Inject, Injectable, Optional } from '@nestjs/common';
import { createSystemKyselyInstance } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { HcmSetupService } from '../../domains/hcm-setup/hcm-setup.service.js';
import type { HcmSetupConfig, LeavePolicy, PolicyRuleLedger } from '../../domains/hcm-setup/hcm-setup.types.js';
import type { JobContext, JobOutcome, ScheduledJob } from './scheduled-job.js';
import { ReminderEmitter } from './reminder-emitter.js';
import type { ReminderEscalationTier } from './reminder-emitter.js';
import { EffectiveDatingActivator } from './effective-dating-activator.js';
import type { EffectiveDatingCandidate } from './effective-dating-activator.js';
import { parseOffsetString } from './scheduler-time.js';
import { PersonalDataRetentionJob } from './personal-data-retention-job.js';

export interface AccrualBalanceJobRecord {
  id: Uuid;
  workerId: Uuid;
  leaveType: string;
  balanceHours: number;
  accruedHours: number;
  usedHours: number;
  status: string;
  aggregateVersion?: number;
}

export interface CarryoverBalanceJobRecord {
  id: Uuid;
  workerId: Uuid;
  leaveType: string;
  status: string;
  aggregateVersion?: number;
}

export interface LeaveBalanceAlertRecord {
  balanceId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  leaveType: string;
  reason: 'EXPIRING_SOON' | 'NEGATIVE_BALANCE';
  dueDate: Date;
  balanceHours?: number;
}

export interface LeaveApprovalSlaRecord {
  requestId: Uuid;
  workerId: Uuid;
  approverWorkerId: Uuid;
  approverManagerWorkerId?: Uuid;
  submittedAt: Date;
  dueDate: Date;
  daysOverdue: number;
}

export interface ReturnToWorkRecord {
  leaveCaseId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  expectedReturnDate: Date;
}

export interface LeaveSchedulerRepositoryPort {
  findActiveAccrualBalances(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<AccrualBalanceJobRecord[]>;
  findCarryoverBalances(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<CarryoverBalanceJobRecord[]>;
  findBalanceAlerts(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<LeaveBalanceAlertRecord[]>;
  findApprovalSlaBreaches(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<LeaveApprovalSlaRecord[]>;
  findUpcomingReturnToWorkCases(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<ReturnToWorkRecord[]>;
}

export interface AttendanceFinalizationTarget {
  workplaceCode?: string;
  workerCount: number;
}

export interface TimesheetSubmissionRecord {
  timesheetId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  periodEnd: Date;
}

export interface TimesheetApprovalSlaRecord {
  timesheetId: Uuid;
  workerId: Uuid;
  approverWorkerId: Uuid;
  approverManagerWorkerId?: Uuid;
  submittedAt: Date;
  dueDate: Date;
  daysOverdue: number;
}

export interface AttendanceAnomalyRecord {
  anomalyId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  anomalyType: string;
  workDate: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface AttendanceSchedulerRepositoryPort {
  findFinalizationTargets(input: { tenantId: Uuid; targetDate: string; now: Date; setup: HcmSetupConfig }): Promise<AttendanceFinalizationTarget[]>;
  findUnsubmittedTimesheets(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<TimesheetSubmissionRecord[]>;
  findTimesheetApprovalSlaBreaches(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<TimesheetApprovalSlaRecord[]>;
  findAttendanceAnomalies(input: { tenantId: Uuid; targetDate: string; now: Date; setup: HcmSetupConfig }): Promise<AttendanceAnomalyRecord[]>;
}

export interface PayrollCycleOpenRecord {
  cycleName: string;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  payDate?: Date;
}

export interface PayrollCutoffReminderRecord {
  payrollCycleId: Uuid;
  payrollAdminWorkerIds: Uuid[];
  cycleName: string;
  cutoffDate: Date;
  inputsNotFinalized: number;
  daysUntilCutoff: number;
}

export interface PayrollReadinessIssueRecord {
  payrollCycleId: Uuid;
  workerId: Uuid;
  payrollAdminWorkerIds: Uuid[];
  issueType: string;
  dueDate: Date;
}

export interface PayrollSchedulerRepositoryPort {
  findCyclesToOpen(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<PayrollCycleOpenRecord[]>;
  findCutoffReminderItems(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<PayrollCutoffReminderRecord[]>;
  findReadinessIssues(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<PayrollReadinessIssueRecord[]>;
}

export interface ReviewCycleDueRecord {
  cycleId: Uuid;
  cycleName: string;
  dueDate: Date;
  audienceWorkerIds: Uuid[];
}

export interface GoalCheckinRecord {
  goalId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  title: string;
  dueDate: Date;
}

export interface OverduePerformanceReviewRecord {
  reviewId: Uuid;
  workerId: Uuid;
  reviewerWorkerId: Uuid;
  reviewerManagerWorkerId?: Uuid;
  dueDate: Date;
  daysOverdue: number;
}

export interface ProbationReviewDueRecord {
  relationshipId: Uuid;
  workerId: Uuid;
  managerWorkerId: Uuid;
  probationEndDate: Date;
}

export interface PerformanceSchedulerRepositoryPort {
  findReviewCyclesDueForReminder(input: { tenantId: Uuid; now: Date }): Promise<ReviewCycleDueRecord[]>;
  findGoalCheckinsDue(input: { tenantId: Uuid; now: Date }): Promise<GoalCheckinRecord[]>;
  findOverduePerformanceReviews(input: { tenantId: Uuid; now: Date }): Promise<OverduePerformanceReviewRecord[]>;
  findProbationReviewsDue(input: { tenantId: Uuid; now: Date }): Promise<ProbationReviewDueRecord[]>;
}

export interface Feedback360NudgeRecord {
  responseId: Uuid;
  cycleId: Uuid;
  revieweeId: Uuid;
  raterWorkerId: Uuid;
  managerWorkerId?: Uuid;
  dueDate: Date;
  daysUntilClose: number;
}

export interface EngagementSchedulerRepositoryPort {
  findSurveysToActivate(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]>;
  findSurveysToClose(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]>;
  findFeedback360RaterNudges(input: { tenantId: Uuid; now: Date }): Promise<Feedback360NudgeRecord[]>;
  findRecognitionProgramsToClose(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]>;
}

export interface LearningAssignmentDueRecord {
  assignmentId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  courseTitle: string;
  dueDate: Date;
  daysOverdue?: number;
}

export interface CertificationExpiryRecord {
  certificationId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  certificationName: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}

export interface LearningSchedulerRepositoryPort {
  findLearningAssignmentsDue(input: { tenantId: Uuid; now: Date }): Promise<LearningAssignmentDueRecord[]>;
  findCertificationsExpiring(input: { tenantId: Uuid; now: Date }): Promise<CertificationExpiryRecord[]>;
  findMandatoryTrainingDeadlines(input: { tenantId: Uuid; now: Date }): Promise<LearningAssignmentDueRecord[]>;
}

export interface StaleRequisitionRecord {
  requisitionId: Uuid;
  recruiterWorkerId: Uuid;
  hiringManagerWorkerId?: Uuid;
  title: string;
  daysOpen: number;
  dueDate: Date;
}

export interface CandidateAgingRecord {
  candidateId: Uuid;
  requisitionId: Uuid;
  recruiterWorkerId: Uuid;
  stage: string;
  daysInStage: number;
  dueDate: Date;
}

export interface InterviewReminderRecord {
  interviewId: Uuid;
  candidateId: Uuid;
  interviewerWorkerIds: Uuid[];
  scheduledAt: Date;
}

export interface OfferExpiryRecord {
  offerId: Uuid;
  candidateId: Uuid;
  ownerWorkerIds: Uuid[];
  expiryDate: Date;
  daysUntilExpiry: number;
}

export interface RecruitingSchedulerRepositoryPort {
  findStaleRequisitions(input: { tenantId: Uuid; now: Date }): Promise<StaleRequisitionRecord[]>;
  findCandidatesAgingInStage(input: { tenantId: Uuid; now: Date }): Promise<CandidateAgingRecord[]>;
  findInterviewsDueForReminder(input: { tenantId: Uuid; now: Date }): Promise<InterviewReminderRecord[]>;
  findOffersExpiring(input: { tenantId: Uuid; now: Date }): Promise<OfferExpiryRecord[]>;
}

export interface PreStartReminderRecord {
  onboardingPlanId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  startDate: Date;
}

export interface OnboardingTaskDueRecord {
  taskId: Uuid;
  planId: Uuid;
  assigneeWorkerId: Uuid;
  managerWorkerId?: Uuid;
  dueDate: Date;
  daysOverdue: number;
  stalled?: boolean;
}

export interface OnboardingCheckpointRecord {
  onboardingPlanId: Uuid;
  workerId: Uuid;
  managerWorkerId: Uuid;
  milestoneDay: 30 | 60 | 90;
  dueDate: Date;
}

export interface OnboardingSchedulerRepositoryPort {
  findPreStartReminders(input: { tenantId: Uuid; now: Date }): Promise<PreStartReminderRecord[]>;
  findOnboardingTasksDue(input: { tenantId: Uuid; now: Date }): Promise<OnboardingTaskDueRecord[]>;
  findOnboardingCheckpointsDue(input: { tenantId: Uuid; now: Date }): Promise<OnboardingCheckpointRecord[]>;
}

export interface SuccessionPlanReviewRecord {
  successionPlanId: Uuid;
  positionId: Uuid;
  ownerWorkerIds: Uuid[];
  dueDate: Date;
}

export interface SkillProfileRefreshRecord {
  skillProfileId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  dueDate: Date;
  daysSinceUpdate: number;
}

export interface SkillsTalentSchedulerRepositoryPort {
  findSuccessionPlanReviewsDue(input: { tenantId: Uuid; now: Date }): Promise<SuccessionPlanReviewRecord[]>;
  findSkillProfilesForRefresh(input: { tenantId: Uuid; now: Date }): Promise<SkillProfileRefreshRecord[]>;
}

export interface CompReviewCycleOpenRecord {
  cycleName: string;
  cycleYear: number;
  eligibilityDate: Date;
  paymentDate: Date;
  currency: string;
}

export interface PayEquityReviewDueRecord {
  reviewId: Uuid;
  ownerWorkerIds: Uuid[];
  reviewPeriod: string;
  dueDate: Date;
}

export interface CompensationSchedulerRepositoryPort {
  findCompReviewCyclesToOpen(input: { tenantId: Uuid; now: Date }): Promise<CompReviewCycleOpenRecord[]>;
  findPayEquityReviewsDue(input: { tenantId: Uuid; now: Date }): Promise<PayEquityReviewDueRecord[]>;
}

export interface PolicyAcknowledgementReminderRecord {
  acknowledgementId: Uuid;
  policyDocumentId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  dueDate: Date;
  daysOverdue: number;
}

export interface MandatoryComplianceTaskRecord {
  taskId: Uuid;
  ownerWorkerId: Uuid;
  dueDate: Date;
  taskType: string;
  daysOverdue: number;
}

export interface ComplianceDocumentExpiryRecord {
  documentId: Uuid;
  workerId?: Uuid;
  managerWorkerId?: Uuid;
  ownerWorkerIds?: Uuid[];
  documentType: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}

export interface ComplianceSchedulerRepositoryPort {
  findPolicyAcknowledgementReminders(input: { tenantId: Uuid; now: Date }): Promise<PolicyAcknowledgementReminderRecord[]>;
  findMandatoryComplianceTasksDue(input: { tenantId: Uuid; now: Date }): Promise<MandatoryComplianceTaskRecord[]>;
  findComplianceDocumentsExpiring(input: { tenantId: Uuid; now: Date }): Promise<ComplianceDocumentExpiryRecord[]>;
}

export interface ProbationPeriodEndRecord {
  relationshipId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  probationEndDate: Date;
  canAutoComplete: boolean;
}

export interface ContractTermEndRecord {
  contractId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  endDate: Date;
  daysUntilEnd: number;
}

export interface WorkAnniversaryRecord {
  workerId: Uuid;
  managerWorkerId?: Uuid;
  anniversaryDate: Date;
  yearsOfService: number;
}

export interface BirthdayRecord {
  workerId: Uuid;
  managerWorkerId?: Uuid;
  birthdayDate: Date;
}

export interface PersonalDocumentExpiryRecord {
  documentId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  documentType: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}

export interface HrCoreSchedulerRepositoryPort {
  findProbationPeriodsEnding(input: { tenantId: Uuid; now: Date }): Promise<ProbationPeriodEndRecord[]>;
  findContractTermsEnding(input: { tenantId: Uuid; now: Date }): Promise<ContractTermEndRecord[]>;
  findWorkAnniversaries(input: { tenantId: Uuid; now: Date }): Promise<WorkAnniversaryRecord[]>;
  findBirthdays(input: { tenantId: Uuid; now: Date }): Promise<BirthdayRecord[]>;
  findPersonalDocumentsExpiring(input: { tenantId: Uuid; now: Date }): Promise<PersonalDocumentExpiryRecord[]>;
}

export interface WorkPermitExpiryRecord {
  workAuthorizationCaseId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  authorizationType: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}

export interface InternationalAssignmentEndRecord {
  assignmentId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  endDate: Date;
  daysUntilEnd: number;
}

export interface GlobalHrSchedulerRepositoryPort {
  findWorkPermitsExpiring(input: { tenantId: Uuid; now: Date }): Promise<WorkPermitExpiryRecord[]>;
  findInternationalAssignmentsEnding(input: { tenantId: Uuid; now: Date }): Promise<InternationalAssignmentEndRecord[]>;
}

export interface AccessRecertificationCampaignRecord {
  campaignName: string;
  scope: Record<string, unknown>;
  dueAt: Date;
}

export interface StaleAccessReviewRecord {
  campaignId: Uuid;
  ownerWorkerIds: Uuid[];
  dueDate: Date;
  daysOverdue: number;
  pendingItemCount: number;
}

export interface BreakGlassSessionExpiryRecord {
  sessionId: Uuid;
  ownerWorkerId: Uuid;
  expiresAt: Date;
  minutesUntilExpiry: number;
}

export interface AccessGovernanceSchedulerRepositoryPort {
  findAccessRecertificationCampaignsDue(input: { tenantId: Uuid; now: Date }): Promise<AccessRecertificationCampaignRecord[]>;
  findStaleAccessReviews(input: { tenantId: Uuid; now: Date }): Promise<StaleAccessReviewRecord[]>;
  findBreakGlassSessionsExpiring(input: { tenantId: Uuid; now: Date }): Promise<BreakGlassSessionExpiryRecord[]>;
}

export interface AiGovernanceReminderRecord {
  useCaseId: Uuid;
  ownerWorkerIds: Uuid[];
  useCaseName: string;
  riskClass: string;
  dueDate: Date;
}

export interface KillSwitchReviewRecord {
  killSwitchId: Uuid;
  useCaseId: Uuid;
  ownerWorkerIds: Uuid[];
  dueDate: Date;
  daysOpen: number;
}

export interface HrAiGovernanceSchedulerRepositoryPort {
  findBiasTestsDue(input: { tenantId: Uuid; now: Date }): Promise<AiGovernanceReminderRecord[]>;
  findUseCaseReassessmentsDue(input: { tenantId: Uuid; now: Date }): Promise<AiGovernanceReminderRecord[]>;
  findKillSwitchReviewsDue(input: { tenantId: Uuid; now: Date }): Promise<KillSwitchReviewRecord[]>;
}

export interface PolicySchedulerRepositoryPort {
  findPoliciesToApply(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]>;
  findPolicyRevisionsToPublish(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]>;
}

export interface CbaExpiryRecord {
  unionRecognitionId: Uuid;
  ownerWorkerIds: Uuid[];
  unionName: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}

export interface GrievanceSlaRecord {
  grievanceId: Uuid;
  workerId: Uuid;
  ownerWorkerIds: Uuid[];
  dueDate: Date;
  daysOverdue: number;
}

export interface UnionLaborSchedulerRepositoryPort {
  findCbaExpiries(input: { tenantId: Uuid; now: Date }): Promise<CbaExpiryRecord[]>;
  findGrievanceSlaBreaches(input: { tenantId: Uuid; now: Date }): Promise<GrievanceSlaRecord[]>;
}

export interface CaseSlaAgingRecord {
  caseId: Uuid;
  caseAggregateType: 'EmployeeRelationsCase' | 'HrServiceCase';
  ownerWorkerIds: Uuid[];
  workerId?: Uuid;
  dueDate: Date;
  daysOverdue: number;
}

export interface InvestigationDeadlineRecord {
  investigationId: Uuid;
  ownerWorkerIds: Uuid[];
  dueDate: Date;
  daysOverdue: number;
}

export interface CaseSchedulerRepositoryPort {
  findCaseSlaAging(input: { tenantId: Uuid; now: Date }): Promise<CaseSlaAgingRecord[]>;
  findInvestigationDeadlines(input: { tenantId: Uuid; now: Date }): Promise<InvestigationDeadlineRecord[]>;
}

export interface ScheduledReorgCandidate extends EffectiveDatingCandidate {
  payload?: Record<string, unknown>;
}

export interface BenefitsLifeEventDeadlineRecord {
  lifeEventId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  eventType: string;
  dueDate: Date;
  daysOverdue: number;
}

export interface SpendingAccountExpiryRecord {
  spendingAccountId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  accountType: string;
  availableAmount: number;
  currency: string;
  planYearEnd: Date;
  daysUntilExpiry: number;
}

export interface BenefitsWindowSchedulerRepositoryPort {
  findBenefitsProgramsToOpen(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]>;
  findBenefitsProgramsToClose(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]>;
  findLifeEventDeadlines(input: { tenantId: Uuid; now: Date }): Promise<BenefitsLifeEventDeadlineRecord[]>;
  findSpendingAccountsUseItOrLoseIt(input: { tenantId: Uuid; now: Date }): Promise<SpendingAccountExpiryRecord[]>;
}

export interface AgingVacantPositionRecord {
  positionId: Uuid;
  ownerWorkerIds: Uuid[];
  title: string;
  vacancyDate: Date;
  daysVacant: number;
}

export interface HeadcountSnapshotRecord {
  reportDefinitionId: Uuid;
  snapshotType: string;
  periodKey: string;
  ownerWorkerIds: Uuid[];
}

export interface PositionOrganizationSchedulerRepositoryPort {
  findAgingVacantPositions(input: { tenantId: Uuid; now: Date }): Promise<AgingVacantPositionRecord[]>;
  findPositionsToActivate(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]>;
  findOrgUnitsToRestructure(input: { tenantId: Uuid; today: Date }): Promise<ScheduledReorgCandidate[]>;
  findHeadcountSnapshotsDue(input: { tenantId: Uuid; now: Date; periodKey: string }): Promise<HeadcountSnapshotRecord[]>;
}

export interface SchedulePublishRecord {
  shiftScheduleId: Uuid;
  ownerWorkerIds: Uuid[];
  shiftDate: Date;
  daysUntilShift: number;
}

export interface CoverageGapAlertRecord {
  coverageGapId: Uuid;
  departmentId: Uuid;
  shiftDate: Date;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface WorkforceSchedulerRepositoryPort {
  findSchedulesNeedingPublish(input: { tenantId: Uuid; now: Date }): Promise<SchedulePublishRecord[]>;
  findCoverageGapsForAlert(input: { tenantId: Uuid; now: Date }): Promise<CoverageGapAlertRecord[]>;
}

export interface SowEndDateRecord {
  sowEngagementId: Uuid;
  ownerWorkerIds: Uuid[];
  projectName: string;
  endDate: Date;
  daysUntilEnd: number;
}

export interface ContingentAssignmentExpiryRecord {
  assignmentId: Uuid;
  workerId: Uuid;
  ownerWorkerIds: Uuid[];
  endDate: Date;
  daysUntilEnd: number;
}

export interface ContingentTenureThresholdRecord {
  assignmentId: Uuid;
  workerId: Uuid;
  ownerWorkerIds: Uuid[];
  tenureDays: number;
  thresholdDays: number;
}

export interface RateCardReviewRecord {
  rateCardId: Uuid;
  ownerWorkerIds: Uuid[];
  vendorId: string;
  effectiveUntil: Date;
  daysUntilReview: number;
}

export interface ContingentSchedulerRepositoryPort {
  findSowEndDates(input: { tenantId: Uuid; now: Date }): Promise<SowEndDateRecord[]>;
  findContingentAssignmentsExpiring(input: { tenantId: Uuid; now: Date }): Promise<ContingentAssignmentExpiryRecord[]>;
  findContingentTenureThresholds(input: { tenantId: Uuid; now: Date }): Promise<ContingentTenureThresholdRecord[]>;
  findRateCardsForReview(input: { tenantId: Uuid; now: Date }): Promise<RateCardReviewRecord[]>;
}

export interface ReferralFollowUpRecord {
  referralId: Uuid;
  workerId: Uuid;
  ownerWorkerIds: Uuid[];
  followUpDate: Date;
  daysOverdue: number;
}

export interface WellbeingSchedulerRepositoryPort {
  findReferralFollowUps(input: { tenantId: Uuid; now: Date }): Promise<ReferralFollowUpRecord[]>;
  findWellnessProgramsToActivate(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]>;
}

export interface ScheduledReportRunRecord {
  reportScheduleId: Uuid;
  reportDefinitionId: Uuid;
  ownerWorkerIds: Uuid[];
  recipients: string[];
  nextRunAt: Date;
  parameters?: Record<string, unknown>;
}

export interface MetricSnapshotRecord {
  reportDefinitionId: Uuid;
  metricDomain: string;
  periodKey: string;
  ownerWorkerIds: Uuid[];
}

export interface ReportingSchedulerRepositoryPort {
  findReportSchedulesDue(input: { tenantId: Uuid; now: Date }): Promise<ScheduledReportRunRecord[]>;
  findMetricSnapshotsDue(input: { tenantId: Uuid; now: Date; periodKey: string }): Promise<MetricSnapshotRecord[]>;
}

@Injectable()
export class HcmSchedulerReadRepository implements LeaveSchedulerRepositoryPort, AttendanceSchedulerRepositoryPort, PayrollSchedulerRepositoryPort {
  private readonly db = createSystemKyselyInstance();

  async findActiveAccrualBalances(input: { tenantId: Uuid }): Promise<AccrualBalanceJobRecord[]> {
    const rows = await this.db
      .selectFrom('absence_accrual_balances')
      .select(['id', 'worker_id', 'leave_type', 'balance_hours', 'accrued_hours', 'used_hours', 'status', 'aggregate_version'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'ACTIVE')
      .execute();
    return rows.map((row) => ({
      id: new Uuid(row.id),
      workerId: new Uuid(row.worker_id),
      leaveType: row.leave_type,
      balanceHours: Number(row.balance_hours),
      accruedHours: Number(row.accrued_hours),
      usedHours: Number(row.used_hours),
      status: row.status,
      aggregateVersion: row.aggregate_version,
    }));
  }

  async findCarryoverBalances(input: { tenantId: Uuid }): Promise<CarryoverBalanceJobRecord[]> {
    const rows = await this.db
      .selectFrom('absence_accrual_balances')
      .select(['id', 'worker_id', 'leave_type', 'status', 'aggregate_version'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'ACTIVE')
      .execute();
    return rows.map((row) => ({
      id: new Uuid(row.id),
      workerId: new Uuid(row.worker_id),
      leaveType: row.leave_type,
      status: row.status,
      aggregateVersion: row.aggregate_version,
    }));
  }

  async findBalanceAlerts(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<LeaveBalanceAlertRecord[]> {
    const soon = addDays(input.now, numberSetting(input.setup, 'leaveBalanceExpiryAlertDays', 30));
    const rows = await this.db
      .selectFrom('absence_accrual_balances as balance')
      .leftJoin('workers as worker', 'worker.id', 'balance.worker_id')
      .select([
        'balance.id as balance_id',
        'balance.worker_id',
        'balance.leave_type',
        'balance.balance_hours',
        'balance.effective_date',
        'worker.manager_id',
      ])
      .where('balance.tenant_id', '=', input.tenantId.value)
      .where('balance.status', '=', 'ACTIVE')
      .where((eb) => eb.or([
        eb('balance.balance_hours', '<', 0),
        eb('balance.effective_date', '<=', soon),
      ]))
      .execute();
    return rows.map((row) => ({
      balanceId: new Uuid(row.balance_id),
      workerId: new Uuid(row.worker_id),
      managerWorkerId: row.manager_id ? new Uuid(row.manager_id) : undefined,
      leaveType: row.leave_type,
      reason: Number(row.balance_hours) < 0 ? 'NEGATIVE_BALANCE' : 'EXPIRING_SOON',
      dueDate: row.effective_date,
      balanceHours: Number(row.balance_hours),
    }));
  }

  async findApprovalSlaBreaches(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<LeaveApprovalSlaRecord[]> {
    const slaDays = numberSetting(input.setup, 'leaveApprovalSlaDays', 2);
    const dueBefore = addDays(input.now, -slaDays);
    const rows = await this.db
      .selectFrom('absence_requests as request')
      .innerJoin('workers as worker', 'worker.id', 'request.worker_id')
      .leftJoin('workers as manager', 'manager.id', 'worker.manager_id')
      .select([
        'request.id as request_id',
        'request.worker_id',
        'request.submitted_at',
        'worker.manager_id as approver_worker_id',
        'manager.manager_id as approver_manager_worker_id',
      ])
      .where('request.tenant_id', '=', input.tenantId.value)
      .where('request.status', '=', 'PENDING_APPROVAL')
      .where('request.submitted_at', '<=', dueBefore)
      .where('worker.manager_id', 'is not', null)
      .execute();
    return rows.flatMap((row) => {
      if (!row.submitted_at || !row.approver_worker_id) return [];
      const dueDate = addDays(row.submitted_at, slaDays);
      return [{
        requestId: new Uuid(row.request_id),
        workerId: new Uuid(row.worker_id),
        approverWorkerId: new Uuid(row.approver_worker_id),
        approverManagerWorkerId: row.approver_manager_worker_id ? new Uuid(row.approver_manager_worker_id) : undefined,
        submittedAt: row.submitted_at,
        dueDate,
        daysOverdue: daysBetween(dueDate, input.now),
      }];
    });
  }

  async findUpcomingReturnToWorkCases(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<ReturnToWorkRecord[]> {
    const horizon = addDays(input.now, numberSetting(input.setup, 'returnToWorkReminderDays', 3));
    const rows = await this.db
      .selectFrom('leave_cases as leave_case')
      .leftJoin('workers as worker', 'worker.id', 'leave_case.worker_id')
      .select(['leave_case.id', 'leave_case.worker_id', 'leave_case.expected_return_date', 'worker.manager_id'])
      .where('leave_case.tenant_id', '=', input.tenantId.value)
      .where('leave_case.status', 'in', ['ACTIVE', 'RETURN_TO_WORK'])
      .where('leave_case.expected_return_date', 'is not', null)
      .where('leave_case.expected_return_date', '<=', horizon)
      .where('leave_case.expected_return_date', '>=', startOfLocalDay(input.now))
      .execute();
    return rows.flatMap((row) => row.expected_return_date ? [{
      leaveCaseId: new Uuid(row.id),
      workerId: new Uuid(row.worker_id),
      managerWorkerId: row.manager_id ? new Uuid(row.manager_id) : undefined,
      expectedReturnDate: row.expected_return_date,
    }] : []);
  }

  async findFinalizationTargets(input: { tenantId: Uuid; targetDate: string }): Promise<AttendanceFinalizationTarget[]> {
    const existingRows = await this.db
      .selectFrom('attendance_daily_ledgers')
      .select(['worker_id'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('work_date', '=', dbDate(input.targetDate))
      .where('locked', '=', true)
      .execute();
    if (existingRows.length > 0) return [];
    const activeWorkers = await this.db
      .selectFrom('workers')
      .select(({ fn }) => [fn.countAll<string>().as('worker_count')])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst();
    const workerCount = Number(activeWorkers?.worker_count ?? 0);
    return workerCount > 0 ? [{ workerCount }] : [];
  }

  async findUnsubmittedTimesheets(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<TimesheetSubmissionRecord[]> {
    const cutoffDays = numberSetting(input.setup, 'timesheetSubmissionReminderDays', 1);
    const dueBefore = addDays(input.now, cutoffDays);
    const rows = await this.db
      .selectFrom('timesheets as timesheet')
      .leftJoin('workers as worker', 'worker.id', 'timesheet.worker_id')
      .select(['timesheet.id', 'timesheet.worker_id', 'timesheet.period_end', 'worker.manager_id'])
      .where('timesheet.tenant_id', '=', input.tenantId.value)
      .where('timesheet.status', 'in', ['DRAFT', 'CORRECTED'])
      .where('timesheet.period_end', '<=', dueBefore)
      .execute();
    return rows.map((row) => ({
      timesheetId: new Uuid(row.id),
      workerId: new Uuid(row.worker_id),
      managerWorkerId: row.manager_id ? new Uuid(row.manager_id) : undefined,
      periodEnd: row.period_end,
    }));
  }

  async findTimesheetApprovalSlaBreaches(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<TimesheetApprovalSlaRecord[]> {
    const slaDays = numberSetting(input.setup, 'timesheetApprovalSlaDays', 2);
    const dueBefore = addDays(input.now, -slaDays);
    const rows = await this.db
      .selectFrom('timesheets as timesheet')
      .innerJoin('workers as worker', 'worker.id', 'timesheet.worker_id')
      .leftJoin('workers as manager', 'manager.id', 'worker.manager_id')
      .select([
        'timesheet.id',
        'timesheet.worker_id',
        'timesheet.submitted_at',
        'worker.manager_id as approver_worker_id',
        'manager.manager_id as approver_manager_worker_id',
      ])
      .where('timesheet.tenant_id', '=', input.tenantId.value)
      .where('timesheet.status', '=', 'SUBMITTED')
      .where('timesheet.submitted_at', '<=', dueBefore)
      .where('worker.manager_id', 'is not', null)
      .execute();
    return rows.flatMap((row) => {
      if (!row.submitted_at || !row.approver_worker_id) return [];
      const dueDate = addDays(row.submitted_at, slaDays);
      return [{
        timesheetId: new Uuid(row.id),
        workerId: new Uuid(row.worker_id),
        approverWorkerId: new Uuid(row.approver_worker_id),
        approverManagerWorkerId: row.approver_manager_worker_id ? new Uuid(row.approver_manager_worker_id) : undefined,
        submittedAt: row.submitted_at,
        dueDate,
        daysOverdue: daysBetween(dueDate, input.now),
      }];
    });
  }

  async findAttendanceAnomalies(input: { tenantId: Uuid; targetDate: string; setup: HcmSetupConfig }): Promise<AttendanceAnomalyRecord[]> {
    const rows = await this.db
      .selectFrom('attendance_daily_ledgers as ledger')
      .leftJoin('workers as worker', 'worker.id', 'ledger.worker_id')
      .select([
        'ledger.id',
        'ledger.worker_id',
        'ledger.status',
        'ledger.overtime_minutes',
        'ledger.exception_count',
        'worker.manager_id',
      ])
      .where('ledger.tenant_id', '=', input.tenantId.value)
      .where('ledger.work_date', '=', dbDate(input.targetDate))
      .where((eb) => eb.or([
        eb('ledger.status', 'in', ['MISSING_PUNCH', 'ABSENT']),
        eb('ledger.overtime_minutes', '>=', numberSetting(input.setup, 'attendanceAnomalyOvertimeMinutes', 180)),
        eb('ledger.exception_count', '>', 0),
      ]))
      .execute();
    return rows.map((row) => ({
      anomalyId: new Uuid(row.id),
      workerId: new Uuid(row.worker_id),
      managerWorkerId: row.manager_id ? new Uuid(row.manager_id) : undefined,
      anomalyType: row.status === 'MISSING_PUNCH' || row.status === 'ABSENT' ? row.status : 'OVERTIME_OR_EXCEPTION',
      workDate: input.targetDate,
      severity: Number(row.exception_count) > 0 ? 'CRITICAL' : 'WARNING',
    }));
  }

  async findCyclesToOpen(input: { tenantId: Uuid; now: Date }): Promise<PayrollCycleOpenRecord[]> {
    const month = monthPeriodKey(input.now);
    const periodStart = new Date(`${month}-01T00:00:00.000Z`);
    const periodEnd = endOfMonth(periodStart);
    const existing = await this.db
      .selectFrom('payroll_cycles')
      .select(['id'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('pay_period_start', '=', periodStart)
      .where('pay_period_end', '=', periodEnd)
      .executeTakeFirst();
    if (existing) return [];
    return [{
      cycleName: `${month} payroll`,
      payPeriodStart: periodStart,
      payPeriodEnd: periodEnd,
      payDate: addDays(periodEnd, 1),
    }];
  }

  async findCutoffReminderItems(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<PayrollCutoffReminderRecord[]> {
    const adminIds = await this.findPayrollAdminWorkerIds(input.tenantId);
    if (adminIds.length === 0) return [];
    const rows = await this.db
      .selectFrom('payroll_cycles as cycle')
      .leftJoin('payroll_inputs as input', 'input.payroll_cycle_id', 'cycle.id')
      .select(({ fn }) => [
        'cycle.id',
        'cycle.cycle_name',
        'cycle.pay_period_end',
        fn.count<string>('input.id').filterWhere('input.status', '!=', 'APPROVED').as('inputs_not_finalized'),
      ])
      .where('cycle.tenant_id', '=', input.tenantId.value)
      .where('cycle.status', 'in', ['INPUT_COLLECTION', 'VALIDATION'])
      .groupBy(['cycle.id', 'cycle.cycle_name', 'cycle.pay_period_end'])
      .execute();
    return rows.flatMap((row) => {
      const cutoffDate = addDays(row.pay_period_end, -numberSetting(input.setup, 'payrollCutoffDaysBeforePeriodEnd', 3));
      const daysUntilCutoff = daysBetween(input.now, cutoffDate);
      if (![3, 1, 0].includes(daysUntilCutoff)) return [];
      return [{
        payrollCycleId: new Uuid(row.id),
        payrollAdminWorkerIds: adminIds,
        cycleName: row.cycle_name,
        cutoffDate,
        inputsNotFinalized: Number(row.inputs_not_finalized ?? 0),
        daysUntilCutoff,
      }];
    });
  }

  async findReadinessIssues(input: { tenantId: Uuid; now: Date }): Promise<PayrollReadinessIssueRecord[]> {
    const adminIds = await this.findPayrollAdminWorkerIds(input.tenantId);
    if (adminIds.length === 0) return [];
    const cycle = await this.db
      .selectFrom('payroll_cycles')
      .select(['id', 'pay_period_end'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['INPUT_COLLECTION', 'VALIDATION', 'CALCULATION'])
      .orderBy('pay_period_end', 'asc')
      .executeTakeFirst();
    if (!cycle) return [];
    const workers = await this.db
      .selectFrom('workers')
      .select(['id'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'ACTIVE')
      .limit(200)
      .execute();
    const issues: PayrollReadinessIssueRecord[] = [];
    for (const worker of workers) {
      const records = await this.db
        .selectFrom('personal_data_records')
        .select(['id', 'payload'])
        .where('tenant_id', '=', input.tenantId.value)
        .where('worker_id', '=', worker.id)
        .where('data_category', 'in', ['BASIC', 'PAYROLL'])
        .execute();
      const hasBank = records.some((record) => objectHasKey(record.payload, 'bankAccount'));
      const hasTax = records.some((record) => objectHasKey(record.payload, 'taxProfile'));
      if (!hasBank || !hasTax) {
        issues.push({
          payrollCycleId: new Uuid(cycle.id),
          workerId: new Uuid(worker.id),
          payrollAdminWorkerIds: adminIds,
          issueType: !hasBank ? 'MISSING_BANK_INFO' : 'MISSING_TAX_PROFILE',
          dueDate: cycle.pay_period_end,
        });
      }
    }
    return issues;
  }

  private async findPayrollAdminWorkerIds(tenantId: Uuid): Promise<Uuid[]> {
    const rows = await this.db
      .selectFrom('workers')
      .select(['id'])
      .where('tenant_id', '=', tenantId.value)
      .where('status', '=', 'ACTIVE')
      .where('job_title', 'ilike', '%payroll%')
      .limit(20)
      .execute();
    return rows.map((row) => new Uuid(row.id));
  }
}

@Injectable()
export class HcmDomainSchedulerReadRepository implements
  PerformanceSchedulerRepositoryPort,
  EngagementSchedulerRepositoryPort,
  LearningSchedulerRepositoryPort,
  RecruitingSchedulerRepositoryPort,
  OnboardingSchedulerRepositoryPort,
  SkillsTalentSchedulerRepositoryPort,
  CompensationSchedulerRepositoryPort {
  private readonly db = createSystemKyselyInstance();

  async findReviewCyclesDueForReminder(input: { tenantId: Uuid; now: Date }): Promise<ReviewCycleDueRecord[]> {
    const horizon = addDays(input.now, 7);
    const cycles = await this.db
      .selectFrom('performance_review_cycles')
      .select(['id', 'name', 'end_date'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['ACTIVE', 'IN_PROGRESS', 'CALIBRATION', 'REVIEW'])
      .where('end_date', '>=', startOfLocalDay(input.now))
      .where('end_date', '<=', horizon)
      .execute();
    const records: ReviewCycleDueRecord[] = [];
    for (const cycle of cycles) {
      const reviews = await this.db
        .selectFrom('performance_reviews')
        .select(['worker_id', 'manager_id'])
        .where('tenant_id', '=', input.tenantId.value)
        .where('review_cycle_id', '=', stringValue(cycle.id))
        .execute();
      const audience = uniqueUuidValues(reviews.flatMap((row) => [row.worker_id, row.manager_id]));
      if (audience.length === 0) continue;
      records.push({
        cycleId: uuidValue(cycle.id),
        cycleName: stringValue(cycle.name, 'Performance review'),
        dueDate: dateValue(cycle.end_date, input.now),
        audienceWorkerIds: audience,
      });
    }
    return records;
  }

  async findGoalCheckinsDue(input: { tenantId: Uuid; now: Date }): Promise<GoalCheckinRecord[]> {
    const staleBefore = addDays(input.now, -14);
    const rows = await this.db
      .selectFrom('goals as goal')
      .leftJoin('workers as worker', 'worker.id', 'goal.worker_id')
      .select(['goal.id', 'goal.worker_id', 'goal.title', 'goal.due_date', 'goal.updated_at', 'worker.manager_id'])
      .where('goal.tenant_id', '=', input.tenantId.value)
      .where('goal.status', 'in', ['ACTIVE', 'IN_PROGRESS'])
      .where((eb) => eb.or([
        eb('goal.due_date', '<=', addDays(input.now, 7)),
        eb('goal.updated_at', '<=', staleBefore),
      ]))
      .execute();
    return rows.map((row) => ({
      goalId: uuidValue(row.id),
      workerId: uuidValue(row.worker_id),
      managerWorkerId: optionalUuid(row.manager_id),
      title: stringValue(row.title, 'Goal'),
      dueDate: dateValue(row.due_date, input.now),
    }));
  }

  async findOverduePerformanceReviews(input: { tenantId: Uuid; now: Date }): Promise<OverduePerformanceReviewRecord[]> {
    const cycles = await this.db
      .selectFrom('performance_review_cycles')
      .select(['id', 'end_date'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['IN_PROGRESS', 'CALIBRATION', 'REVIEW'])
      .where('end_date', '<', startOfLocalDay(input.now))
      .execute();
    const records: OverduePerformanceReviewRecord[] = [];
    for (const cycle of cycles) {
      const reviews = await this.db
        .selectFrom('performance_reviews as review')
        .leftJoin('workers as manager', 'manager.id', 'review.manager_id')
        .select(['review.id', 'review.worker_id', 'review.manager_id', 'manager.manager_id as reviewer_manager_id'])
        .where('review.tenant_id', '=', input.tenantId.value)
        .where('review.review_cycle_id', '=', stringValue(cycle.id))
        .where('review.status', 'not in', ['FINALIZED', 'ACKNOWLEDGED', 'CLOSED'])
        .execute();
      for (const review of reviews) {
        records.push({
          reviewId: uuidValue(review.id),
          workerId: uuidValue(review.worker_id),
          reviewerWorkerId: uuidValue(review.manager_id),
          reviewerManagerWorkerId: optionalUuid(review.reviewer_manager_id),
          dueDate: dateValue(cycle.end_date, input.now),
          daysOverdue: Math.max(0, daysBetween(dateValue(cycle.end_date, input.now), input.now)),
        });
      }
    }
    return records;
  }

  async findProbationReviewsDue(input: { tenantId: Uuid; now: Date }): Promise<ProbationReviewDueRecord[]> {
    const horizon = addDays(input.now, 7);
    const rows = await this.db
      .selectFrom('employment_relationships as relationship')
      .innerJoin('workers as worker', 'worker.id', 'relationship.worker_id')
      .select(['relationship.id', 'relationship.worker_id', 'relationship.probation_end_date', 'worker.manager_id'])
      .where('relationship.tenant_id', '=', input.tenantId.value)
      .where('relationship.state', 'in', ['ACTIVE', 'PROBATION'])
      .where('relationship.probation_end_date', 'is not', null)
      .where('relationship.probation_end_date', '<=', horizon)
      .where('worker.manager_id', 'is not', null)
      .execute();
    return rows.flatMap((row) => row.manager_id ? [{
      relationshipId: uuidValue(row.id),
      workerId: uuidValue(row.worker_id),
      managerWorkerId: uuidValue(row.manager_id),
      probationEndDate: dateValue(row.probation_end_date, input.now),
    }] : []);
  }

  async findSurveysToActivate(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]> {
    const rows = await this.db
      .selectFrom('engagement_surveys')
      .select(['id', 'status', 'start_date', 'aggregate_version'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'PUBLISHED')
      .where('start_date', '<=', endOfDayUtc(input.today))
      .execute();
    return rows.map((row) => ({
      id: uuidValue(row.id),
      aggregateType: 'EngagementSurvey',
      status: stringValue(row.status, 'PUBLISHED'),
      effectiveFrom: dateValue(row.start_date, input.today),
      aggregateVersion: numberValue(row.aggregate_version),
    }));
  }

  async findSurveysToClose(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]> {
    const rows = await this.db
      .selectFrom('engagement_surveys')
      .select(['id', 'status', 'end_date', 'aggregate_version'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'ACTIVE')
      .where('end_date', '<=', endOfDayUtc(input.today))
      .execute();
    return rows.map((row) => ({
      id: uuidValue(row.id),
      aggregateType: 'EngagementSurvey',
      status: stringValue(row.status, 'ACTIVE'),
      effectiveFrom: dateValue(row.end_date, input.today),
      aggregateVersion: numberValue(row.aggregate_version),
    }));
  }

  async findFeedback360RaterNudges(input: { tenantId: Uuid; now: Date }): Promise<Feedback360NudgeRecord[]> {
    const rows = await this.db
      .selectFrom('performance_feedback_360_responses as response')
      .innerJoin('performance_feedback_360_cycles as cycle', 'cycle.id', 'response.cycle_id')
      .leftJoin('workers as reviewer', 'reviewer.id', 'response.reviewer_id')
      .select(['response.id', 'response.cycle_id', 'response.reviewee_id', 'response.reviewer_id', 'cycle.end_date', 'reviewer.manager_id'])
      .where('response.tenant_id', '=', input.tenantId.value)
      .where('response.status', 'in', ['PENDING', 'IN_PROGRESS'])
      .where('cycle.status', 'in', ['ACTIVE', 'IN_PROGRESS'])
      .where('cycle.end_date', '<=', addDays(input.now, 3))
      .execute();
    return rows.map((row) => ({
      responseId: uuidValue(row.id),
      cycleId: uuidValue(row.cycle_id),
      revieweeId: uuidValue(row.reviewee_id),
      raterWorkerId: uuidValue(row.reviewer_id),
      managerWorkerId: optionalUuid(row.manager_id),
      dueDate: dateValue(row.end_date, input.now),
      daysUntilClose: Math.max(0, daysBetween(input.now, dateValue(row.end_date, input.now))),
    }));
  }

  async findRecognitionProgramsToClose(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]> {
    const rows = await this.db
      .selectFrom('recognition_programs')
      .select(['id', 'status', 'updated_at', 'aggregate_version'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'ACTIVE')
      .where('updated_at', '<=', addDays(input.today, -365))
      .execute();
    return rows.map((row) => ({
      id: uuidValue(row.id),
      aggregateType: 'RecognitionProgram',
      status: stringValue(row.status, 'ACTIVE'),
      effectiveFrom: dateValue(row.updated_at, input.today),
      aggregateVersion: numberValue(row.aggregate_version),
    }));
  }

  async findLearningAssignmentsDue(input: { tenantId: Uuid; now: Date }): Promise<LearningAssignmentDueRecord[]> {
    return this.learningAssignments(input, ['ASSIGNED', 'IN_PROGRESS'], addDays(input.now, 7), false);
  }

  async findMandatoryTrainingDeadlines(input: { tenantId: Uuid; now: Date }): Promise<LearningAssignmentDueRecord[]> {
    return this.learningAssignments(input, ['ASSIGNED', 'IN_PROGRESS'], addDays(input.now, 14), true);
  }

  async findCertificationsExpiring(input: { tenantId: Uuid; now: Date }): Promise<CertificationExpiryRecord[]> {
    const rows = await this.db
      .selectFrom('certifications as certification')
      .leftJoin('workers as worker', 'worker.id', 'certification.worker_id')
      .select(['certification.id', 'certification.worker_id', 'certification.certification_name', 'certification.expiry_date', 'worker.manager_id'])
      .where('certification.tenant_id', '=', input.tenantId.value)
      .where('certification.status', '=', 'ACTIVE')
      .where('certification.expiry_date', 'is not', null)
      .where('certification.expiry_date', '<=', addDays(input.now, 60))
      .execute();
    return rows.flatMap((row) => {
      const expiryDate = dateValue(row.expiry_date, input.now);
      const daysUntilExpiry = daysBetween(input.now, expiryDate);
      if (![60, 30, 7].includes(daysUntilExpiry) && daysUntilExpiry > 0) return [];
      return [{
        certificationId: uuidValue(row.id),
        workerId: uuidValue(row.worker_id),
        managerWorkerId: optionalUuid(row.manager_id),
        certificationName: stringValue(row.certification_name, 'Certification'),
        expiryDate,
        daysUntilExpiry,
      }];
    });
  }

  async findStaleRequisitions(input: { tenantId: Uuid; now: Date }): Promise<StaleRequisitionRecord[]> {
    const rows = await this.db
      .selectFrom('hr_recruiting.job_requisitions')
      .select(['id', 'title', 'recruiter_id', 'hiring_manager_id', 'published_at', 'created_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['PUBLISHED', 'OPEN'])
      .where('created_at', '<=', addDays(input.now, -30))
      .execute();
    return rows.flatMap((row) => {
      const recruiter = optionalUuid(row.recruiter_id);
      if (!recruiter) return [];
      const openedAt = dateValue(row.published_at ?? row.created_at, input.now);
      return [{
        requisitionId: uuidValue(row.id),
        recruiterWorkerId: recruiter,
        hiringManagerWorkerId: optionalUuid(row.hiring_manager_id),
        title: stringValue(row.title, 'Requisition'),
        daysOpen: Math.max(0, daysBetween(openedAt, input.now)),
        dueDate: input.now,
      }];
    });
  }

  async findCandidatesAgingInStage(input: { tenantId: Uuid; now: Date }): Promise<CandidateAgingRecord[]> {
    const rows = await this.db
      .selectFrom('hr_recruiting.candidates as candidate')
      .leftJoin('hr_recruiting.job_requisitions as requisition', 'requisition.id', 'candidate.requisition_id')
      .select(['candidate.id', 'candidate.requisition_id', 'candidate.status', 'candidate.updated_at', 'requisition.recruiter_id'])
      .where('candidate.tenant_id', '=', input.tenantId.value)
      .where('candidate.status', 'in', ['NEW', 'SCREENING', 'INTERVIEWING', 'OFFER_PENDING'])
      .where('candidate.updated_at', '<=', addDays(input.now, -7))
      .execute();
    return rows.flatMap((row) => {
      const recruiter = optionalUuid(row.recruiter_id);
      if (!recruiter) return [];
      return [{
        candidateId: uuidValue(row.id),
        requisitionId: uuidValue(row.requisition_id),
        recruiterWorkerId: recruiter,
        stage: stringValue(row.status, 'UNKNOWN'),
        daysInStage: Math.max(0, daysBetween(dateValue(row.updated_at, input.now), input.now)),
        dueDate: input.now,
      }];
    });
  }

  async findInterviewsDueForReminder(input: { tenantId: Uuid; now: Date }): Promise<InterviewReminderRecord[]> {
    const rows = await this.db
      .selectFrom('hr_recruiting.interview_plans')
      .select(['id', 'candidate_id', 'interviewers', 'scheduled_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'SCHEDULED')
      .where('scheduled_at', '>=', input.now)
      .where('scheduled_at', '<=', addDays(input.now, 1))
      .execute();
    return rows.map((row) => ({
      interviewId: uuidValue(row.id),
      candidateId: uuidValue(row.candidate_id),
      interviewerWorkerIds: uuidArray(row.interviewers),
      scheduledAt: dateValue(row.scheduled_at, input.now),
    })).filter((row) => row.interviewerWorkerIds.length > 0);
  }

  async findOffersExpiring(input: { tenantId: Uuid; now: Date }): Promise<OfferExpiryRecord[]> {
    const rows = await this.db
      .selectFrom('hr_recruiting.offers as offer')
      .leftJoin('hr_recruiting.job_requisitions as requisition', 'requisition.id', 'offer.requisition_id')
      .select(['offer.id', 'offer.candidate_id', 'offer.start_date', 'offer.proposed_by', 'requisition.recruiter_id'])
      .where('offer.tenant_id', '=', input.tenantId.value)
      .where('offer.status', '=', 'SENT')
      .where('offer.start_date', '<=', addDays(input.now, 7))
      .execute();
    return rows.map((row) => {
      const expiryDate = dateValue(row.start_date, input.now);
      return {
        offerId: uuidValue(row.id),
        candidateId: uuidValue(row.candidate_id),
        ownerWorkerIds: uniqueUuidValues([row.proposed_by, row.recruiter_id]),
        expiryDate,
        daysUntilExpiry: Math.max(0, daysBetween(input.now, expiryDate)),
      };
    }).filter((row) => row.ownerWorkerIds.length > 0);
  }

  async findPreStartReminders(input: { tenantId: Uuid; now: Date }): Promise<PreStartReminderRecord[]> {
    const rows = await this.db
      .selectFrom('hr_onboarding.onboarding_plans as plan')
      .leftJoin('workers as worker', 'worker.id', 'plan.worker_id')
      .select(['plan.id', 'plan.worker_id', 'plan.start_date', 'worker.manager_id'])
      .where('plan.tenant_id', '=', input.tenantId.value)
      .where('plan.status', 'in', ['DRAFT', 'SCHEDULED'])
      .where('plan.start_date', '>=', input.now)
      .where('plan.start_date', '<=', addDays(input.now, 7))
      .execute();
    return rows.map((row) => ({
      onboardingPlanId: uuidValue(row.id),
      workerId: uuidValue(row.worker_id),
      managerWorkerId: optionalUuid(row.manager_id),
      startDate: dateValue(row.start_date, input.now),
    }));
  }

  async findOnboardingTasksDue(input: { tenantId: Uuid; now: Date }): Promise<OnboardingTaskDueRecord[]> {
    const rows = await this.db
      .selectFrom('hr_onboarding.onboarding_tasks as task')
      .innerJoin('hr_onboarding.onboarding_plans as plan', 'plan.id', 'task.onboarding_plan_id')
      .leftJoin('workers as worker', 'worker.id', 'plan.worker_id')
      .select(['task.id', 'task.onboarding_plan_id', 'task.assigned_to', 'task.due_date', 'task.status', 'task.updated_at', 'worker.manager_id'])
      .where('task.tenant_id', '=', input.tenantId.value)
      .where('task.status', 'in', ['PENDING', 'IN_PROGRESS', 'OVERDUE'])
      .where('task.due_date', '<=', addDays(input.now, 3))
      .execute();
    return rows.flatMap((row) => {
      const assignee = optionalUuid(row.assigned_to);
      if (!assignee) return [];
      const dueDate = dateValue(row.due_date, input.now);
      return [{
        taskId: uuidValue(row.id),
        planId: uuidValue(row.onboarding_plan_id),
        assigneeWorkerId: assignee,
        managerWorkerId: optionalUuid(row.manager_id),
        dueDate,
        daysOverdue: Math.max(0, daysBetween(dueDate, input.now)),
        stalled: dateValue(row.updated_at, input.now).getTime() <= addDays(input.now, -7).getTime(),
      }];
    });
  }

  async findOnboardingCheckpointsDue(input: { tenantId: Uuid; now: Date }): Promise<OnboardingCheckpointRecord[]> {
    const rows = await this.db
      .selectFrom('hr_onboarding.onboarding_plans as plan')
      .leftJoin('workers as worker', 'worker.id', 'plan.worker_id')
      .select(['plan.id', 'plan.worker_id', 'plan.start_date', 'worker.manager_id'])
      .where('plan.tenant_id', '=', input.tenantId.value)
      .where('plan.status', 'in', ['IN_PROGRESS', 'COMPLETED'])
      .where('worker.manager_id', 'is not', null)
      .execute();
    const todayKey = input.now.toISOString().slice(0, 10);
    return rows.flatMap((row) => {
      const startDate = dateValue(row.start_date, input.now);
      return ([30, 60, 90] as const).flatMap((milestoneDay) => {
        const dueDate = addDays(startDate, milestoneDay);
        return dueDate.toISOString().slice(0, 10) === todayKey && row.manager_id ? [{
          onboardingPlanId: uuidValue(row.id),
          workerId: uuidValue(row.worker_id),
          managerWorkerId: uuidValue(row.manager_id),
          milestoneDay,
          dueDate,
        }] : [];
      });
    });
  }

  async findSuccessionPlanReviewsDue(input: { tenantId: Uuid; now: Date }): Promise<SuccessionPlanReviewRecord[]> {
    const rows = await this.db
      .selectFrom('succession_plans')
      .select(['id', 'position_id', 'updated_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['ACTIVE', 'READY', 'DRAFT'])
      .where('updated_at', '<=', addDays(input.now, -90))
      .execute();
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    return rows.flatMap((row) => owners.length > 0 ? [{
      successionPlanId: uuidValue(row.id),
      positionId: uuidValue(row.position_id),
      ownerWorkerIds: owners,
      dueDate: input.now,
    }] : []);
  }

  async findSkillProfilesForRefresh(input: { tenantId: Uuid; now: Date }): Promise<SkillProfileRefreshRecord[]> {
    const rows = await this.db
      .selectFrom('skill_profiles as profile')
      .leftJoin('workers as worker', 'worker.id', 'profile.worker_id')
      .select(['profile.id', 'profile.worker_id', 'profile.updated_at', 'worker.manager_id'])
      .where('profile.tenant_id', '=', input.tenantId.value)
      .where('profile.status', 'in', ['ACTIVE', 'VALIDATED', 'DRAFT'])
      .where('profile.updated_at', '<=', addDays(input.now, -180))
      .execute();
    return rows.map((row) => ({
      skillProfileId: uuidValue(row.id),
      workerId: uuidValue(row.worker_id),
      managerWorkerId: optionalUuid(row.manager_id),
      dueDate: input.now,
      daysSinceUpdate: Math.max(0, daysBetween(dateValue(row.updated_at, input.now), input.now)),
    }));
  }

  async findCompReviewCyclesToOpen(input: { tenantId: Uuid; now: Date }): Promise<CompReviewCycleOpenRecord[]> {
    const cycleYear = input.now.getUTCFullYear();
    const existing = await this.db
      .selectFrom('bonus_cycles')
      .select(['id'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('cycle_year', '=', cycleYear)
      .executeTakeFirst();
    if (existing || input.now.getUTCMonth() !== 0 || input.now.getUTCDate() !== 1) return [];
    return [{
      cycleName: `${cycleYear} annual compensation`,
      cycleYear,
      eligibilityDate: input.now,
      paymentDate: addDays(input.now, 90),
      currency: 'EGP',
    }];
  }

  async findPayEquityReviewsDue(input: { tenantId: Uuid; now: Date }): Promise<PayEquityReviewDueRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const rows = await this.db
      .selectFrom('hr_dei_analytics.pay_equity_reviews')
      .select(['id', 'review_period', 'updated_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['DRAFT', 'IN_PROGRESS', 'OPEN'])
      .where('updated_at', '<=', addDays(input.now, -90))
      .execute();
    return rows.map((row) => ({
      reviewId: uuidValue(row.id),
      ownerWorkerIds: owners,
      reviewPeriod: stringValue(row.review_period, 'current period'),
      dueDate: input.now,
    }));
  }

  private async learningAssignments(input: { tenantId: Uuid; now: Date }, statuses: string[], horizon: Date, mandatoryOnly: boolean): Promise<LearningAssignmentDueRecord[]> {
    const rows = await this.db
      .selectFrom('learning_assignments as assignment')
      .innerJoin('learning_courses as course', 'course.id', 'assignment.course_id')
      .leftJoin('workers as worker', 'worker.id', 'assignment.worker_id')
      .select(['assignment.id', 'assignment.worker_id', 'assignment.due_date', 'course.title', 'course.certification_eligible', 'worker.manager_id'])
      .where('assignment.tenant_id', '=', input.tenantId.value)
      .where('assignment.status', 'in', statuses)
      .where('assignment.due_date', '<=', horizon)
      .$if(mandatoryOnly, (qb) => qb.where('course.certification_eligible', '=', true))
      .execute();
    return rows.map((row) => {
      const dueDate = dateValue(row.due_date, input.now);
      return {
        assignmentId: uuidValue(row.id),
        workerId: uuidValue(row.worker_id),
        managerWorkerId: optionalUuid(row.manager_id),
        courseTitle: stringValue(row.title, 'Learning assignment'),
        dueDate,
        daysOverdue: Math.max(0, daysBetween(dueDate, input.now)),
      };
    });
  }

  private async findHrAdminWorkerIds(tenantId: Uuid): Promise<Uuid[]> {
    const rows = await this.db
      .selectFrom('workers')
      .select(['id'])
      .where('tenant_id', '=', tenantId.value)
      .where('status', '=', 'ACTIVE')
      .where((eb) => eb.or([
        eb('job_title', 'ilike', '%hr%'),
        eb('job_title', 'ilike', '%people%'),
      ]))
      .limit(20)
      .execute();
    return rows.map((row) => uuidValue(row.id));
  }
}

@Injectable()
export class HcmGovernanceSchedulerReadRepository implements
  ComplianceSchedulerRepositoryPort,
  HrCoreSchedulerRepositoryPort,
  GlobalHrSchedulerRepositoryPort,
  AccessGovernanceSchedulerRepositoryPort,
  HrAiGovernanceSchedulerRepositoryPort,
  PolicySchedulerRepositoryPort,
  UnionLaborSchedulerRepositoryPort,
  CaseSchedulerRepositoryPort,
  BenefitsWindowSchedulerRepositoryPort,
  PositionOrganizationSchedulerRepositoryPort,
  WorkforceSchedulerRepositoryPort,
  ContingentSchedulerRepositoryPort,
  WellbeingSchedulerRepositoryPort,
  ReportingSchedulerRepositoryPort {
  private readonly db = createSystemKyselyInstance();

  async findPolicyAcknowledgementReminders(input: { tenantId: Uuid; now: Date }): Promise<PolicyAcknowledgementReminderRecord[]> {
    const rows = await this.db
      .selectFrom('hr_compliance.policy_acknowledgements as acknowledgement')
      .leftJoin('workers as worker', 'worker.id', 'acknowledgement.worker_id')
      .select(['acknowledgement.id', 'acknowledgement.policy_document_id', 'acknowledgement.worker_id', 'acknowledgement.due_date', 'worker.manager_id'])
      .where('acknowledgement.tenant_id', '=', input.tenantId.value)
      .where('acknowledgement.status', 'in', ['PENDING', 'OVERDUE', 'ASSIGNED'])
      .where('acknowledgement.due_date', 'is not', null)
      .where('acknowledgement.due_date', '<=', addDays(input.now, 7))
      .execute();
    return rows.map((row) => {
      const dueDate = dateValue(row.due_date, input.now);
      return {
        acknowledgementId: uuidValue(row.id),
        policyDocumentId: uuidValue(row.policy_document_id),
        workerId: uuidValue(row.worker_id),
        managerWorkerId: optionalUuid(row.manager_id),
        dueDate,
        daysOverdue: Math.max(0, daysBetween(dueDate, input.now)),
      };
    });
  }

  async findMandatoryComplianceTasksDue(input: { tenantId: Uuid; now: Date }): Promise<MandatoryComplianceTaskRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const rows = await this.db
      .selectFrom('hr_compliance.statutory_reports')
      .select(['id', 'report_type', 'reporting_period', 'created_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['DRAFT', 'PENDING', 'READY'])
      .where('submitted_at', 'is', null)
      .where('created_at', '<=', addDays(input.now, -7))
      .execute();
    return rows.map((row, index) => {
      const dueDate = addDays(dateValue(row.created_at, input.now), 7);
      return {
        taskId: uuidValue(row.id),
        ownerWorkerId: owners[index % owners.length],
        dueDate,
        taskType: stringValue(row.report_type, 'STATUTORY_REPORT'),
        daysOverdue: Math.max(0, daysBetween(dueDate, input.now)),
      };
    });
  }

  async findComplianceDocumentsExpiring(input: { tenantId: Uuid; now: Date }): Promise<ComplianceDocumentExpiryRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    const rows = await this.db
      .selectFrom('hr_compliance.policy_documents')
      .select(['id', 'document_type', 'effective_until'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['PUBLISHED', 'ACTIVE'])
      .where('effective_until', 'is not', null)
      .where('effective_until', '<=', addDays(input.now, 60))
      .execute();
    return rows.flatMap((row) => {
      const expiryDate = dateValue(row.effective_until, input.now);
      const daysUntilExpiry = daysBetween(input.now, expiryDate);
      if (![90, 60, 30, 14, 7, 0].includes(daysUntilExpiry) && daysUntilExpiry > 0) return [];
      return [{
        documentId: uuidValue(row.id),
        ownerWorkerIds: owners,
        documentType: stringValue(row.document_type, 'POLICY_DOCUMENT'),
        expiryDate,
        daysUntilExpiry,
      }];
    });
  }

  async findProbationPeriodsEnding(input: { tenantId: Uuid; now: Date }): Promise<ProbationPeriodEndRecord[]> {
    const rows = await this.db
      .selectFrom('employment_relationships as relationship')
      .leftJoin('workers as worker', 'worker.id', 'relationship.worker_id')
      .select(['relationship.id', 'relationship.worker_id', 'relationship.probation_end_date', 'worker.manager_id'])
      .where('relationship.tenant_id', '=', input.tenantId.value)
      .where('relationship.state', 'in', ['PROBATION', 'ACTIVE'])
      .where('relationship.probation_end_date', 'is not', null)
      .where('relationship.probation_end_date', '<=', endOfDayUtc(input.now))
      .execute();
    return rows.map((row) => ({
      relationshipId: uuidValue(row.id),
      workerId: uuidValue(row.worker_id),
      managerWorkerId: optionalUuid(row.manager_id),
      probationEndDate: dateValue(row.probation_end_date, input.now),
      canAutoComplete: Boolean(row.manager_id),
    }));
  }

  async findContractTermsEnding(input: { tenantId: Uuid; now: Date }): Promise<ContractTermEndRecord[]> {
    const rows = await this.db
      .selectFrom('employment_contracts as contract')
      .leftJoin('workers as worker', 'worker.id', 'contract.worker_id')
      .select(['contract.id', 'contract.worker_id', 'contract.end_date', 'worker.manager_id'])
      .where('contract.tenant_id', '=', input.tenantId.value)
      .where('contract.state', 'in', ['ACTIVE', 'SIGNED', 'EXECUTED'])
      .where('contract.end_date', 'is not', null)
      .where('contract.end_date', '<=', addDays(input.now, 60))
      .execute();
    return rows.flatMap((row) => {
      const endDate = dateValue(row.end_date, input.now);
      const daysUntilEnd = daysBetween(input.now, endDate);
      if (![60, 30, 14, 7, 0].includes(daysUntilEnd) && daysUntilEnd > 0) return [];
      return [{
        contractId: uuidValue(row.id),
        workerId: uuidValue(row.worker_id),
        managerWorkerId: optionalUuid(row.manager_id),
        endDate,
        daysUntilEnd,
      }];
    });
  }

  async findWorkAnniversaries(input: { tenantId: Uuid; now: Date }): Promise<WorkAnniversaryRecord[]> {
    const rows = await this.db
      .selectFrom('workers')
      .select(['id', 'manager_id', 'hire_date'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'ACTIVE')
      .execute();
    return rows.flatMap((row) => {
      const hireDate = dateValue(row.hire_date, input.now);
      if (!sameMonthDay(hireDate, input.now)) return [];
      const yearsOfService = Math.max(1, input.now.getUTCFullYear() - hireDate.getUTCFullYear());
      return [{
        workerId: uuidValue(row.id),
        managerWorkerId: optionalUuid(row.manager_id),
        anniversaryDate: input.now,
        yearsOfService,
      }];
    });
  }

  async findBirthdays(input: { tenantId: Uuid; now: Date }): Promise<BirthdayRecord[]> {
    const rows = await this.db
      .selectFrom('personal_data_records as record')
      .leftJoin('workers as worker', 'worker.id', 'record.worker_id')
      .select(['record.worker_id', 'record.payload', 'worker.manager_id'])
      .where('record.tenant_id', '=', input.tenantId.value)
      .where('record.data_category', 'in', ['BASIC', 'PERSONAL', 'IDENTITY'])
      .where('record.state', 'in', ['ACTIVE', 'VERIFIED', 'DRAFT'])
      .execute();
    return rows.flatMap((row) => {
      const birthday = dateFromRecord(row.payload, ['dateOfBirth', 'birthDate', 'birthday', 'dob']);
      if (!birthday || !sameMonthDay(birthday, input.now)) return [];
      return [{
        workerId: uuidValue(row.worker_id),
        managerWorkerId: optionalUuid(row.manager_id),
        birthdayDate: input.now,
      }];
    });
  }

  async findPersonalDocumentsExpiring(input: { tenantId: Uuid; now: Date }): Promise<PersonalDocumentExpiryRecord[]> {
    const rows = await this.db
      .selectFrom('personal_data_records as record')
      .leftJoin('workers as worker', 'worker.id', 'record.worker_id')
      .select(['record.id', 'record.worker_id', 'record.data_category', 'record.payload', 'worker.manager_id'])
      .where('record.tenant_id', '=', input.tenantId.value)
      .where('record.data_category', 'in', ['DOCUMENT', 'IDENTITY', 'IMMIGRATION', 'PERSONAL_DOCUMENT'])
      .where('record.state', 'in', ['ACTIVE', 'VERIFIED', 'DRAFT'])
      .execute();
    return rows.flatMap((row) => {
      const expiryDate = dateFromRecord(row.payload, ['expiryDate', 'expiresAt', 'validUntil', 'visaExpiryDate', 'idExpiryDate']);
      if (!expiryDate) return [];
      const daysUntilExpiry = daysBetween(input.now, expiryDate);
      if (![90, 60, 30, 14, 7, 0].includes(daysUntilExpiry) && daysUntilExpiry > 0) return [];
      return [{
        documentId: uuidValue(row.id),
        workerId: uuidValue(row.worker_id),
        managerWorkerId: optionalUuid(row.manager_id),
        documentType: stringValue(recordValue(row.payload, 'documentType'), stringValue(row.data_category, 'DOCUMENT')),
        expiryDate,
        daysUntilExpiry,
      }];
    });
  }

  async findWorkPermitsExpiring(input: { tenantId: Uuid; now: Date }): Promise<WorkPermitExpiryRecord[]> {
    const rows = await this.db
      .selectFrom('hr_global_hr.work_authorization_cases as authorization')
      .leftJoin('workers as worker', 'worker.id', 'authorization.worker_id')
      .select(['authorization.id', 'authorization.worker_id', 'authorization.authorization_type', 'authorization.valid_until', 'worker.manager_id'])
      .where('authorization.tenant_id', '=', input.tenantId.value)
      .where('authorization.status', 'in', ['ACTIVE', 'APPROVED', 'VALID'])
      .where('authorization.valid_until', 'is not', null)
      .where('authorization.valid_until', '<=', addDays(input.now, 90))
      .execute();
    return rows.flatMap((row) => {
      const expiryDate = dateValue(row.valid_until, input.now);
      const daysUntilExpiry = daysBetween(input.now, expiryDate);
      if (![90, 60, 30, 14, 7, 0].includes(daysUntilExpiry) && daysUntilExpiry > 0) return [];
      return [{
        workAuthorizationCaseId: uuidValue(row.id),
        workerId: uuidValue(row.worker_id),
        managerWorkerId: optionalUuid(row.manager_id),
        authorizationType: stringValue(row.authorization_type, 'WORK_PERMIT'),
        expiryDate,
        daysUntilExpiry,
      }];
    });
  }

  async findInternationalAssignmentsEnding(input: { tenantId: Uuid; now: Date }): Promise<InternationalAssignmentEndRecord[]> {
    const rows = await this.db
      .selectFrom('job_assignments')
      .select(['id', 'worker_id', 'manager_id', 'end_date'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('assignment_type', 'in', ['INTERNATIONAL', 'EXPATRIATE', 'SECONDMENT'])
      .where('state', 'in', ['ACTIVE', 'APPROVED'])
      .where('end_date', 'is not', null)
      .where('end_date', '<=', addDays(input.now, 30))
      .execute();
    return rows.map((row) => {
      const endDate = dateValue(row.end_date, input.now);
      return {
        assignmentId: uuidValue(row.id),
        workerId: uuidValue(row.worker_id),
        managerWorkerId: optionalUuid(row.manager_id),
        endDate,
        daysUntilEnd: Math.max(0, daysBetween(input.now, endDate)),
      };
    });
  }

  async findAccessRecertificationCampaignsDue(input: { tenantId: Uuid; now: Date }): Promise<AccessRecertificationCampaignRecord[]> {
    const parts = localDateParts(input.now, 'UTC');
    if (![1, 4, 7, 10].includes(parts.month) || parts.day !== 1) return [];
    const code = `${parts.year}-Q${Math.floor((parts.month - 1) / 3) + 1}`;
    const existing = await this.db
      .selectFrom('access_review_campaigns')
      .select(['id'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('code', '=', `ACCESS-RECERT-${code}`)
      .executeTakeFirst();
    if (existing) return [];
    return [{
      campaignName: `Access recertification ${code}`,
      scope: { tenantId: input.tenantId.value, cadence: 'QUARTERLY' },
      dueAt: addDays(input.now, 21),
    }];
  }

  async findStaleAccessReviews(input: { tenantId: Uuid; now: Date }): Promise<StaleAccessReviewRecord[]> {
    const campaigns = await this.db
      .selectFrom('access_review_campaigns')
      .select(['id', 'due_at', 'created_by'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['LAUNCHED', 'IN_PROGRESS', 'OPEN'])
      .where('due_at', '<', input.now)
      .execute();
    const records: StaleAccessReviewRecord[] = [];
    for (const campaign of campaigns) {
      const pending = await this.db
        .selectFrom('access_review_items')
        .select(['id'])
        .where('tenant_id', '=', input.tenantId.value)
        .where('campaign_id', '=', campaign.id)
        .where('decision', 'in', ['PENDING', 'UNDECIDED'])
        .execute();
      const owners = uniqueUuidValues([campaign.created_by, ...(await this.findHrAdminWorkerIds(input.tenantId)).map((id) => id.value)]);
      if (owners.length === 0) continue;
      const dueDate = dateValue(campaign.due_at, input.now);
      records.push({
        campaignId: uuidValue(campaign.id),
        ownerWorkerIds: owners,
        dueDate,
        daysOverdue: Math.max(0, daysBetween(dueDate, input.now)),
        pendingItemCount: pending.length,
      });
    }
    return records;
  }

  async findBreakGlassSessionsExpiring(input: { tenantId: Uuid; now: Date }): Promise<BreakGlassSessionExpiryRecord[]> {
    const rows = await this.db
      .selectFrom('service_account_credentials as credential')
      .innerJoin('service_accounts as account', 'account.id', 'credential.service_account_id')
      .select(['credential.id', 'credential.expires_at', 'account.owner_worker_id', 'account.scopes'])
      .where('credential.tenant_id', '=', input.tenantId.value)
      .where('credential.status', '=', 'ACTIVE')
      .where('credential.expires_at', 'is not', null)
      .where('credential.expires_at', '<=', addDays(input.now, 1))
      .execute();
    return rows.flatMap((row) => {
      const owner = optionalUuid(row.owner_worker_id);
      if (!owner || !looksLikeBreakGlassScope(row.scopes)) return [];
      const expiresAt = dateValue(row.expires_at, input.now);
      return [{
        sessionId: uuidValue(row.id),
        ownerWorkerId: owner,
        expiresAt,
        minutesUntilExpiry: Math.max(0, Math.floor((expiresAt.getTime() - input.now.getTime()) / 60_000)),
      }];
    });
  }

  async findBiasTestsDue(input: { tenantId: Uuid; now: Date }): Promise<AiGovernanceReminderRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const useCases = await this.db
      .selectFrom('hr_ai.hr_ai_use_cases')
      .select(['id', 'use_case_name', 'risk_classification', 'created_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['ACTIVE', 'APPROVED'])
      .execute();
    const records: AiGovernanceReminderRecord[] = [];
    for (const useCase of useCases) {
      const latest = await this.db
        .selectFrom('hr_ai.hr_ai_bias_tests')
        .select(['executed_at', 'created_at'])
        .where('tenant_id', '=', input.tenantId.value)
        .where('use_case_id', '=', useCase.id)
        .orderBy('executed_at', 'desc')
        .limit(1)
        .executeTakeFirst();
      const baseline = dateValue(latest?.executed_at ?? latest?.created_at ?? useCase.created_at, input.now);
      const dueDate = addDays(baseline, aiCadenceDays(useCase.risk_classification));
      if (dueDate.getTime() <= input.now.getTime()) {
        records.push({
          useCaseId: uuidValue(useCase.id),
          ownerWorkerIds: owners,
          useCaseName: stringValue(useCase.use_case_name, 'AI use case'),
          riskClass: stringValue(useCase.risk_classification, 'MEDIUM'),
          dueDate,
        });
      }
    }
    return records;
  }

  async findUseCaseReassessmentsDue(input: { tenantId: Uuid; now: Date }): Promise<AiGovernanceReminderRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const rows = await this.db
      .selectFrom('hr_ai.hr_ai_use_cases')
      .select(['id', 'use_case_name', 'risk_classification', 'updated_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['ACTIVE', 'APPROVED'])
      .execute();
    return rows.flatMap((row) => {
      const dueDate = addDays(dateValue(row.updated_at, input.now), aiReassessmentDays(row.risk_classification));
      if (dueDate.getTime() > input.now.getTime()) return [];
      return [{
        useCaseId: uuidValue(row.id),
        ownerWorkerIds: owners,
        useCaseName: stringValue(row.use_case_name, 'AI use case'),
        riskClass: stringValue(row.risk_classification, 'MEDIUM'),
        dueDate,
      }];
    });
  }

  async findKillSwitchReviewsDue(input: { tenantId: Uuid; now: Date }): Promise<KillSwitchReviewRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const rows = await this.db
      .selectFrom('hr_ai.hr_ai_kill_switches')
      .select(['id', 'use_case_id', 'triggered_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['TRIGGERED', 'ACTIVE', 'OPEN'])
      .where('triggered_at', 'is not', null)
      .where('triggered_at', '<=', addDays(input.now, -3))
      .execute();
    return rows.map((row) => {
      const triggeredAt = dateValue(row.triggered_at, input.now);
      return {
        killSwitchId: uuidValue(row.id),
        useCaseId: uuidValue(row.use_case_id),
        ownerWorkerIds: owners,
        dueDate: addDays(triggeredAt, 3),
        daysOpen: Math.max(0, daysBetween(triggeredAt, input.now)),
      };
    });
  }

  async findPoliciesToApply(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]> {
    const rows = await this.db
      .selectFrom('admin_policy_revisions as revision')
      .leftJoin('admin_policy_revision_scopes as scope', 'scope.revision_id', 'revision.id')
      .select(['revision.id', 'revision.status', 'revision.aggregate_version', 'scope.effective_from'])
      .where('revision.tenant_id', '=', input.tenantId.value)
      .where('revision.status', '=', 'PUBLISHED')
      .where((eb) => eb.or([
        eb('scope.effective_from', 'is', null),
        eb('scope.effective_from', '<=', endOfDayUtc(input.today)),
      ]))
      .execute();
    return rows.map((row) => ({
      id: uuidValue(row.id),
      aggregateType: 'AdminPolicyRevision',
      status: stringValue(row.status, 'PUBLISHED'),
      effectiveFrom: dateValue(row.effective_from, input.today),
      aggregateVersion: numberValue(row.aggregate_version),
    }));
  }

  async findPolicyRevisionsToPublish(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]> {
    const rows = await this.db
      .selectFrom('admin_policy_revisions as revision')
      .leftJoin('admin_policy_revision_scopes as scope', 'scope.revision_id', 'revision.id')
      .select(['revision.id', 'revision.status', 'revision.aggregate_version', 'scope.effective_from'])
      .where('revision.tenant_id', '=', input.tenantId.value)
      .where('revision.status', '=', 'APPROVED')
      .where((eb) => eb.or([
        eb('scope.effective_from', 'is', null),
        eb('scope.effective_from', '<=', endOfDayUtc(input.today)),
      ]))
      .execute();
    return rows.map((row) => ({
      id: uuidValue(row.id),
      aggregateType: 'AdminPolicyRevision',
      status: stringValue(row.status, 'APPROVED'),
      effectiveFrom: dateValue(row.effective_from, input.today),
      aggregateVersion: numberValue(row.aggregate_version),
    }));
  }

  async findCbaExpiries(input: { tenantId: Uuid; now: Date }): Promise<CbaExpiryRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const rows = await this.db
      .selectFrom('union_recognitions')
      .select(['id', 'union_name', 'expiration_date'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['ACTIVE', 'RECOGNIZED'])
      .where('expiration_date', 'is not', null)
      .where('expiration_date', '<=', addDays(input.now, 90))
      .execute();
    return rows.flatMap((row) => {
      const expiryDate = dateValue(row.expiration_date, input.now);
      const daysUntilExpiry = daysBetween(input.now, expiryDate);
      if (![90, 60, 30, 14, 7, 0].includes(daysUntilExpiry) && daysUntilExpiry > 0) return [];
      return [{
        unionRecognitionId: uuidValue(row.id),
        ownerWorkerIds: owners,
        unionName: stringValue(row.union_name, 'Union'),
        expiryDate,
        daysUntilExpiry,
      }];
    });
  }

  async findGrievanceSlaBreaches(input: { tenantId: Uuid; now: Date }): Promise<GrievanceSlaRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const rows = await this.db
      .selectFrom('grievances')
      .select(['id', 'worker_id', 'created_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['OPEN', 'FILED', 'UNDER_REVIEW', 'INVESTIGATING'])
      .where('created_at', '<=', addDays(input.now, -7))
      .execute();
    return rows.map((row) => {
      const dueDate = addDays(dateValue(row.created_at, input.now), 7);
      return {
        grievanceId: uuidValue(row.id),
        workerId: uuidValue(row.worker_id),
        ownerWorkerIds: owners,
        dueDate,
        daysOverdue: Math.max(0, daysBetween(dueDate, input.now)),
      };
    });
  }

  async findCaseSlaAging(input: { tenantId: Uuid; now: Date }): Promise<CaseSlaAgingRecord[]> {
    const serviceCases = await this.db
      .selectFrom('hr_service_cases')
      .select(['id', 'requester_worker_id', 'assigned_to', 'sla_deadline'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'not in', ['RESOLVED', 'CLOSED', 'CANCELLED'])
      .where('sla_deadline', 'is not', null)
      .where('sla_deadline', '<=', addDays(input.now, 3))
      .execute();
    const erCases = await this.db
      .selectFrom('employee_relations_cases')
      .select(['id', 'subject_worker_id', 'assigned_to', 'manager_id', 'opened_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'not in', ['RESOLVED', 'CLOSED', 'CANCELLED'])
      .where('opened_at', '<=', addDays(input.now, -7))
      .execute();
    return [
      ...serviceCases.map((row): CaseSlaAgingRecord => {
        const dueDate = dateValue(row.sla_deadline, input.now);
        return {
          caseId: uuidValue(row.id),
          caseAggregateType: 'HrServiceCase',
          ownerWorkerIds: uniqueUuidValues([row.assigned_to, row.requester_worker_id]),
          workerId: optionalUuid(row.requester_worker_id),
          dueDate,
          daysOverdue: Math.max(0, daysBetween(dueDate, input.now)),
        };
      }),
      ...erCases.map((row): CaseSlaAgingRecord => {
        const dueDate = addDays(dateValue(row.opened_at, input.now), 7);
        return {
          caseId: uuidValue(row.id),
          caseAggregateType: 'EmployeeRelationsCase',
          ownerWorkerIds: uniqueUuidValues([row.assigned_to, row.manager_id]),
          workerId: optionalUuid(row.subject_worker_id),
          dueDate,
          daysOverdue: Math.max(0, daysBetween(dueDate, input.now)),
        };
      }).filter((row) => row.ownerWorkerIds.length > 0),
    ];
  }

  async findInvestigationDeadlines(input: { tenantId: Uuid; now: Date }): Promise<InvestigationDeadlineRecord[]> {
    const rows = await this.db
      .selectFrom('er_investigations')
      .select(['id', 'investigator_id', 'created_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['OPEN', 'IN_PROGRESS', 'UNDER_REVIEW'])
      .where('created_at', '<=', addDays(input.now, -14))
      .execute();
    return rows.map((row) => {
      const dueDate = addDays(dateValue(row.created_at, input.now), 14);
      return {
        investigationId: uuidValue(row.id),
        ownerWorkerIds: uuidArray(row.investigator_id),
        dueDate,
        daysOverdue: Math.max(0, daysBetween(dueDate, input.now)),
      };
    }).filter((row) => row.ownerWorkerIds.length > 0);
  }

  async findBenefitsProgramsToOpen(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]> {
    const rows = await this.db
      .selectFrom('benefits_programs')
      .select(['id', 'status', 'effective_from', 'aggregate_version'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'DRAFT')
      .where('effective_from', 'is not', null)
      .where('effective_from', '<=', endOfDayUtc(input.today))
      .execute();
    return rows.map((row) => ({
      id: uuidValue(row.id),
      aggregateType: 'BenefitsProgram',
      status: stringValue(row.status, 'DRAFT'),
      effectiveFrom: dateValue(row.effective_from, input.today),
      aggregateVersion: numberValue(row.aggregate_version),
    }));
  }

  async findBenefitsProgramsToClose(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]> {
    const rows = await this.db
      .selectFrom('benefits_programs')
      .select(['id', 'status', 'effective_until', 'aggregate_version'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['ACTIVE', 'SUSPENDED'])
      .where('effective_until', 'is not', null)
      .where('effective_until', '<=', endOfDayUtc(input.today))
      .execute();
    return rows.map((row) => ({
      id: uuidValue(row.id),
      aggregateType: 'BenefitsProgram',
      status: stringValue(row.status, 'ACTIVE'),
      effectiveFrom: dateValue(row.effective_until, input.today),
      aggregateVersion: numberValue(row.aggregate_version),
    }));
  }

  async findLifeEventDeadlines(input: { tenantId: Uuid; now: Date }): Promise<BenefitsLifeEventDeadlineRecord[]> {
    const rows = await this.db
      .selectFrom('benefits_life_events as event')
      .leftJoin('workers as worker', 'worker.id', 'event.worker_id')
      .select(['event.id', 'event.worker_id', 'event.event_type', 'event.event_date', 'worker.manager_id'])
      .where('event.tenant_id', '=', input.tenantId.value)
      .where('event.status', 'in', ['RECORDED', 'PENDING_PROCESSING'])
      .where('event.event_date', '<=', addDays(input.now, -23))
      .execute();
    return rows.map((row) => {
      const dueDate = addDays(dateValue(row.event_date, input.now), 30);
      return {
        lifeEventId: uuidValue(row.id),
        workerId: uuidValue(row.worker_id),
        managerWorkerId: optionalUuid(row.manager_id),
        eventType: stringValue(row.event_type, 'LIFE_EVENT'),
        dueDate,
        daysOverdue: Math.max(0, daysBetween(dueDate, input.now)),
      };
    });
  }

  async findSpendingAccountsUseItOrLoseIt(input: { tenantId: Uuid; now: Date }): Promise<SpendingAccountExpiryRecord[]> {
    const rows = await this.db
      .selectFrom('spending_accounts as account')
      .leftJoin('workers as worker', 'worker.id', 'account.worker_id')
      .select(['account.id', 'account.worker_id', 'account.account_type', 'account.available_amount', 'account.currency', 'worker.manager_id'])
      .where('account.tenant_id', '=', input.tenantId.value)
      .where('account.status', '=', 'ACTIVE')
      .where('account.available_amount', '>', 0)
      .execute();
    const yearEnd = endOfYear(input.now);
    return rows.flatMap((row) => {
      const daysUntilExpiry = daysBetween(input.now, yearEnd);
      if (![60, 30, 7, 0].includes(daysUntilExpiry) && daysUntilExpiry > 0) return [];
      return [{
        spendingAccountId: uuidValue(row.id),
        workerId: uuidValue(row.worker_id),
        managerWorkerId: optionalUuid(row.manager_id),
        accountType: stringValue(row.account_type, 'SPENDING_ACCOUNT'),
        availableAmount: numberValue(row.available_amount),
        currency: stringValue(row.currency, 'USD'),
        planYearEnd: yearEnd,
        daysUntilExpiry,
      }];
    });
  }

  async findAgingVacantPositions(input: { tenantId: Uuid; now: Date }): Promise<AgingVacantPositionRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const rows = await this.db
      .selectFrom('hr_position.positions')
      .select(['id', 'title', 'created_at', 'updated_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('filled_by_worker_id', 'is', null)
      .where('status', 'in', ['ACTIVE', 'VACANT'])
      .where('updated_at', '<=', addDays(input.now, -30))
      .execute();
    return rows.map((row) => {
      const vacancyDate = dateValue(row.updated_at ?? row.created_at, input.now);
      return {
        positionId: uuidValue(row.id),
        ownerWorkerIds: owners,
        title: stringValue(row.title, 'Position'),
        vacancyDate,
        daysVacant: Math.max(0, daysBetween(vacancyDate, input.now)),
      };
    });
  }

  async findPositionsToActivate(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]> {
    const rows = await this.db
      .selectFrom('hr_position.positions')
      .select(['id', 'status', 'created_at', 'aggregate_version'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'DRAFT')
      .where('created_at', '<=', endOfDayUtc(input.today))
      .execute();
    return rows.map((row) => ({
      id: uuidValue(row.id),
      aggregateType: 'Position',
      status: stringValue(row.status, 'DRAFT'),
      effectiveFrom: dateValue(row.created_at, input.today),
      aggregateVersion: numberValue(row.aggregate_version),
    }));
  }

  async findOrgUnitsToRestructure(input: { tenantId: Uuid; today: Date }): Promise<ScheduledReorgCandidate[]> {
    const rows = await this.db
      .selectFrom('hr_org.org_units')
      .select(['id', 'status', 'parent_id', 'updated_at', 'aggregate_version'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'SCHEDULED')
      .where('updated_at', '<=', endOfDayUtc(input.today))
      .execute();
    return rows.map((row) => ({
      id: uuidValue(row.id),
      aggregateType: 'OrgUnit',
      status: stringValue(row.status, 'SCHEDULED'),
      effectiveFrom: dateValue(row.updated_at, input.today),
      aggregateVersion: numberValue(row.aggregate_version),
      payload: { parentId: row.parent_id },
    }));
  }

  async findHeadcountSnapshotsDue(input: { tenantId: Uuid; periodKey: string }): Promise<HeadcountSnapshotRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const rows = await this.db
      .selectFrom('hr_reporting.report_definitions')
      .select(['id', 'report_type'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'PUBLISHED')
      .where('report_type', 'in', ['HEADCOUNT_SNAPSHOT', 'WORKFORCE_SNAPSHOT'])
      .execute();
    return rows.map((row) => ({
      reportDefinitionId: uuidValue(row.id),
      snapshotType: stringValue(row.report_type, 'HEADCOUNT'),
      periodKey: input.periodKey,
      ownerWorkerIds: owners,
    }));
  }

  async findSchedulesNeedingPublish(input: { tenantId: Uuid; now: Date }): Promise<SchedulePublishRecord[]> {
    const rows = await this.db
      .selectFrom('shift_schedules as schedule')
      .leftJoin('workers as worker', 'worker.id', 'schedule.worker_id')
      .select(['schedule.id', 'schedule.shift_date', 'worker.manager_id'])
      .where('schedule.tenant_id', '=', input.tenantId.value)
      .where('schedule.status', '=', 'DRAFT')
      .where('schedule.shift_date', '<=', addDays(input.now, 7))
      .execute();
    return rows.flatMap((row) => {
      const owners = uuidArray(row.manager_id);
      if (owners.length === 0) return [];
      const shiftDate = dateValue(row.shift_date, input.now);
      return [{
        shiftScheduleId: uuidValue(row.id),
        ownerWorkerIds: owners,
        shiftDate,
        daysUntilShift: Math.max(0, daysBetween(input.now, shiftDate)),
      }];
    });
  }

  async findCoverageGapsForAlert(input: { tenantId: Uuid; now: Date }): Promise<CoverageGapAlertRecord[]> {
    const rows = await this.db
      .selectFrom('coverage_gaps')
      .select(['id', 'department_id', 'shift_date', 'unfilled_positions'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'DETECTED')
      .where('shift_date', '<=', addDays(input.now, 1))
      .execute();
    return rows.map((row) => ({
      coverageGapId: uuidValue(row.id),
      departmentId: uuidValue(row.department_id),
      shiftDate: dateValue(row.shift_date, input.now),
      severity: numberValue(row.unfilled_positions) > 2 ? 'CRITICAL' : 'WARNING',
    }));
  }

  async findSowEndDates(input: { tenantId: Uuid; now: Date }): Promise<SowEndDateRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const rows = await this.db
      .selectFrom('sow_engagements')
      .select(['id', 'project_name', 'end_date'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['ACTIVE', 'IN_PROGRESS'])
      .where('end_date', '<=', addDays(input.now, 60))
      .execute();
    return rows.flatMap((row) => {
      const endDate = dateValue(row.end_date, input.now);
      const daysUntilEnd = daysBetween(input.now, endDate);
      if (![60, 30, 14, 7, 0].includes(daysUntilEnd) && daysUntilEnd > 0) return [];
      return [{
        sowEngagementId: uuidValue(row.id),
        ownerWorkerIds: owners,
        projectName: stringValue(row.project_name, 'SOW engagement'),
        endDate,
        daysUntilEnd,
      }];
    });
  }

  async findContingentAssignmentsExpiring(input: { tenantId: Uuid; now: Date }): Promise<ContingentAssignmentExpiryRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const rows = await this.db
      .selectFrom('contingent_worker_assignments')
      .select(['id', 'worker_id', 'end_date'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['ACTIVE', 'APPROVED'])
      .where('end_date', '<=', addDays(input.now, 30))
      .execute();
    return rows.map((row) => {
      const endDate = dateValue(row.end_date, input.now);
      return {
        assignmentId: uuidValue(row.id),
        workerId: uuidValue(row.worker_id),
        ownerWorkerIds: owners,
        endDate,
        daysUntilEnd: Math.max(0, daysBetween(input.now, endDate)),
      };
    });
  }

  async findContingentTenureThresholds(input: { tenantId: Uuid; now: Date }): Promise<ContingentTenureThresholdRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const thresholdDays = 330;
    const rows = await this.db
      .selectFrom('contingent_worker_assignments')
      .select(['id', 'worker_id', 'start_date'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['ACTIVE', 'APPROVED'])
      .where('start_date', '<=', addDays(input.now, -thresholdDays))
      .execute();
    return rows.map((row) => ({
      assignmentId: uuidValue(row.id),
      workerId: uuidValue(row.worker_id),
      ownerWorkerIds: owners,
      tenureDays: Math.max(0, daysBetween(dateValue(row.start_date, input.now), input.now)),
      thresholdDays,
    }));
  }

  async findRateCardsForReview(input: { tenantId: Uuid; now: Date }): Promise<RateCardReviewRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const rows = await this.db
      .selectFrom('contractor_rate_cards')
      .select(['id', 'vendor_id', 'effective_until'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'ACTIVE')
      .where('effective_until', 'is not', null)
      .where('effective_until', '<=', addDays(input.now, 30))
      .execute();
    return rows.flatMap((row) => {
      const effectiveUntil = dateValue(row.effective_until, input.now);
      const daysUntilReview = daysBetween(input.now, effectiveUntil);
      if (![30, 14, 7, 0].includes(daysUntilReview) && daysUntilReview > 0) return [];
      return [{
        rateCardId: uuidValue(row.id),
        ownerWorkerIds: owners,
        vendorId: stringValue(row.vendor_id, 'vendor'),
        effectiveUntil,
        daysUntilReview,
      }];
    });
  }

  async findReferralFollowUps(input: { tenantId: Uuid; now: Date }): Promise<ReferralFollowUpRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const rows = await this.db
      .selectFrom('eap_referrals')
      .select(['id', 'worker_id', 'scheduled_date', 'created_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['SCHEDULED', 'STARTED', 'IN_PROGRESS', 'REQUESTED'])
      .where((eb) => eb.or([
        eb('scheduled_date', '<=', addDays(input.now, 3)),
        eb('created_at', '<=', addDays(input.now, -7)),
      ]))
      .execute();
    return rows.map((row) => {
      const followUpDate = dateValue(row.scheduled_date ?? addDays(dateValue(row.created_at, input.now), 7), input.now);
      return {
        referralId: uuidValue(row.id),
        workerId: uuidValue(row.worker_id),
        ownerWorkerIds: owners,
        followUpDate,
        daysOverdue: Math.max(0, daysBetween(followUpDate, input.now)),
      };
    });
  }

  async findWellnessProgramsToActivate(input: { tenantId: Uuid; today: Date }): Promise<EffectiveDatingCandidate[]> {
    const rows = await this.db
      .selectFrom('wellness_programs')
      .select(['id', 'status', 'start_date', 'aggregate_version'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'DRAFT')
      .where('start_date', 'is not', null)
      .where('start_date', '<=', endOfDayUtc(input.today))
      .execute();
    return rows.map((row) => ({
      id: uuidValue(row.id),
      aggregateType: 'WellnessProgram',
      status: stringValue(row.status, 'DRAFT'),
      effectiveFrom: dateValue(row.start_date, input.today),
      aggregateVersion: numberValue(row.aggregate_version),
    }));
  }

  async findReportSchedulesDue(input: { tenantId: Uuid; now: Date }): Promise<ScheduledReportRunRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const rows = await this.db
      .selectFrom('hr_reporting.report_schedules')
      .select(['id', 'report_definition_id', 'recipients', 'next_run_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'ACTIVE')
      .where('next_run_at', 'is not', null)
      .where('next_run_at', '<=', input.now)
      .execute();
    return rows.map((row) => ({
      reportScheduleId: uuidValue(row.id),
      reportDefinitionId: uuidValue(row.report_definition_id),
      ownerWorkerIds: owners,
      recipients: stringArray(row.recipients),
      nextRunAt: dateValue(row.next_run_at, input.now),
      parameters: { scheduledRunAt: dateValue(row.next_run_at, input.now).toISOString() },
    }));
  }

  async findMetricSnapshotsDue(input: { tenantId: Uuid; periodKey: string }): Promise<MetricSnapshotRecord[]> {
    const owners = await this.findHrAdminWorkerIds(input.tenantId);
    if (owners.length === 0) return [];
    const rows = await this.db
      .selectFrom('hr_reporting.report_definitions')
      .select(['id', 'report_type'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'PUBLISHED')
      .where('report_type', 'in', ['METRIC_SNAPSHOT', 'DEI_SNAPSHOT', 'ATTRITION_SNAPSHOT'])
      .execute();
    return rows.map((row) => ({
      reportDefinitionId: uuidValue(row.id),
      metricDomain: stringValue(row.report_type, 'METRIC'),
      periodKey: input.periodKey,
      ownerWorkerIds: owners,
    }));
  }

  private async findHrAdminWorkerIds(tenantId: Uuid): Promise<Uuid[]> {
    const rows = await this.db
      .selectFrom('workers')
      .select(['id'])
      .where('tenant_id', '=', tenantId.value)
      .where('status', '=', 'ACTIVE')
      .where((eb) => eb.or([
        eb('job_title', 'ilike', '%hr%'),
        eb('job_title', 'ilike', '%people%'),
        eb('job_title', 'ilike', '%admin%'),
        eb('job_title', 'ilike', '%compliance%'),
      ]))
      .limit(20)
      .execute();
    return rows.map((row) => uuidValue(row.id));
  }
}

@Injectable()
export class LeaveAccrualRunJob implements ScheduledJob {
  readonly name = 'leave-accrual-run';
  readonly cron = '0 2 * * *';
  readonly permissions = ['LEAVE_BALANCE_UPDATE'];
  readonly periodKey = monthPeriodKey;

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<LeaveSchedulerRepositoryPort, 'findActiveAccrualBalances'> = new HcmSchedulerReadRepository(),
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    if (localDay(ctx.now, ctx.timezone) !== numberSetting(setup, 'leaveAccrualDay', 1)) {
      return { itemsProcessed: 0 };
    }
    const balances = await this.repository.findActiveAccrualBalances({ tenantId: ctx.tenantId, now: ctx.now, setup });
    let itemsProcessed = 0;
    for (const balance of balances) {
      const policy = findLeavePolicy(setup, balance.leaveType);
      if (!policy) continue;
      const accrualHours = monthlyAccrualHours(policy, setup);
      if (accrualHours <= 0) continue;
      await ctx.runCommand({
        commandName: 'UpdateAbsenceAccrualBalance',
        aggregateType: 'AbsenceAccrualBalance',
        aggregateId: balance.id,
        subjectWorkerId: balance.workerId,
        payload: {
          balanceId: balance.id,
          balanceHours: round2(balance.balanceHours + accrualHours),
          accruedHours: round2(balance.accruedHours + accrualHours),
        },
        permissions: this.permissions,
        reason: this.name,
      });
      itemsProcessed += 1;
    }
    return { itemsProcessed };
  }
}

@Injectable()
export class LeaveCarryoverRunJob implements ScheduledJob {
  readonly name = 'leave-carryover-run';
  readonly cron = '0 3 31 12 *';
  readonly permissions = ['LEAVE_BALANCE_UPDATE'];
  readonly periodKey = yearPeriodKey;

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<LeaveSchedulerRepositoryPort, 'findCarryoverBalances'> = new HcmSchedulerReadRepository(),
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const balances = await this.repository.findCarryoverBalances({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const balance of balances) {
      await ctx.runCommand({
        commandName: 'CarryOverAbsenceAccrualBalance',
        aggregateType: 'AbsenceAccrualBalance',
        aggregateId: balance.id,
        subjectWorkerId: balance.workerId,
        payload: { balanceId: balance.id },
        permissions: this.permissions,
        reason: this.name,
      });
    }
    return { itemsProcessed: balances.length };
  }
}

@Injectable()
export class LeaveBalanceExpiryAlertJob implements ScheduledJob {
  readonly name = 'leave-balance-expiry-alert';
  readonly cron = '0 9 * * 1';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<LeaveSchedulerRepositoryPort, 'findBalanceAlerts'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const alerts = await this.repository.findBalanceAlerts({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const alert of alerts) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [alert.workerId],
        managerAudienceWorkerIds: optionalUuidArray(alert.managerWorkerId),
        reminderType: 'LEAVE_BALANCE_ALERT',
        subject: { aggregateType: 'AbsenceAccrualBalance', subjectId: alert.balanceId, subjectWorkerId: alert.workerId },
        dueDate: alert.dueDate,
        payload: {
          reason: alert.reason,
          leaveType: alert.leaveType,
          balanceHours: alert.balanceHours,
          title: alert.reason === 'NEGATIVE_BALANCE' ? 'Leave balance needs attention' : 'Leave balance expiry approaching',
        },
        escalationTier: alert.reason === 'NEGATIVE_BALANCE' ? escalationTier(0, true) : escalationTier(-7),
        now: ctx.now,
      });
    }
    return { itemsProcessed: alerts.length };
  }
}

@Injectable()
export class LeaveApprovalSlaJob implements ScheduledJob {
  readonly name = 'leave-approval-sla';
  readonly cron = '0 8 * * *';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<LeaveSchedulerRepositoryPort, 'findApprovalSlaBreaches'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const breaches = await this.repository.findApprovalSlaBreaches({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const breach of breaches) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [breach.approverWorkerId],
        managerAudienceWorkerIds: optionalUuidArray(breach.approverManagerWorkerId),
        reminderType: 'LEAVE_APPROVAL_SLA',
        subject: { aggregateType: 'AbsenceRequest', subjectId: breach.requestId, subjectWorkerId: breach.workerId },
        dueDate: breach.dueDate,
        payload: { workerId: breach.workerId.value, submittedAt: breach.submittedAt.toISOString(), daysOverdue: breach.daysOverdue },
        escalationTier: escalationTier(breach.daysOverdue, breach.daysOverdue > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: breaches.length };
  }
}

@Injectable()
export class ReturnToWorkReminderJob implements ScheduledJob {
  readonly name = 'return-to-work-reminder';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<LeaveSchedulerRepositoryPort, 'findUpcomingReturnToWorkCases'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const cases = await this.repository.findUpcomingReturnToWorkCases({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const leaveCase of cases) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [leaveCase.workerId],
        managerAudienceWorkerIds: optionalUuidArray(leaveCase.managerWorkerId),
        reminderType: 'RETURN_TO_WORK_REMINDER',
        subject: { aggregateType: 'LeaveCase', subjectId: leaveCase.leaveCaseId, subjectWorkerId: leaveCase.workerId },
        dueDate: leaveCase.expectedReturnDate,
        payload: { expectedReturnDate: leaveCase.expectedReturnDate.toISOString() },
        escalationTier: escalationTier(-1),
        now: ctx.now,
      });
    }
    return { itemsProcessed: cases.length };
  }
}

@Injectable()
export class AttendanceDailyFinalizationJob implements ScheduledJob {
  readonly name = 'attendance-daily-finalization';
  readonly cron = '0 20 * * *';
  readonly permissions = ['ATTENDANCE_LEDGER_FINALIZE'];
  readonly periodKey = (now: Date, timezone: string): string => previousLocalDateKey(now, timezone);

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<AttendanceSchedulerRepositoryPort, 'findFinalizationTargets'> = new HcmSchedulerReadRepository(),
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const targetDate = previousLocalDateKey(ctx.now, ctx.timezone);
    const targets = await this.repository.findFinalizationTargets({ tenantId: ctx.tenantId, targetDate, now: ctx.now, setup });
    for (const target of targets) {
      await ctx.runCommand({
        commandName: 'FinalizeAttendanceDailyLedger',
        aggregateType: 'AttendanceDailyLedger',
        payload: { date: targetDate, workplaceCode: target.workplaceCode },
        permissions: this.permissions,
        reason: this.name,
      });
    }
    return { itemsProcessed: targets.length };
  }
}

@Injectable()
export class TimesheetSubmissionReminderJob implements ScheduledJob {
  readonly name = 'timesheet-submission-reminder';
  readonly cron = '0 10 * * *';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<AttendanceSchedulerRepositoryPort, 'findUnsubmittedTimesheets'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const rows = await this.repository.findUnsubmittedTimesheets({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'TIMESHEET_SUBMISSION_REMINDER',
        subject: { aggregateType: 'Timesheet', subjectId: row.timesheetId, subjectWorkerId: row.workerId },
        dueDate: row.periodEnd,
        payload: { periodEnd: row.periodEnd.toISOString() },
        escalationTier: escalationTier(-1),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class TimesheetApprovalSlaJob implements ScheduledJob {
  readonly name = 'timesheet-approval-sla';
  readonly cron = '0 8 * * *';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<AttendanceSchedulerRepositoryPort, 'findTimesheetApprovalSlaBreaches'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const rows = await this.repository.findTimesheetApprovalSlaBreaches({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.approverWorkerId],
        managerAudienceWorkerIds: optionalUuidArray(row.approverManagerWorkerId),
        reminderType: 'TIMESHEET_APPROVAL_SLA',
        subject: { aggregateType: 'Timesheet', subjectId: row.timesheetId, subjectWorkerId: row.workerId },
        dueDate: row.dueDate,
        payload: { workerId: row.workerId.value, submittedAt: row.submittedAt.toISOString(), daysOverdue: row.daysOverdue },
        escalationTier: escalationTier(row.daysOverdue, row.daysOverdue > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class AttendanceAnomalyAlertJob implements ScheduledJob {
  readonly name = 'attendance-anomaly-alert';
  readonly cron = '0 7 * * *';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<AttendanceSchedulerRepositoryPort, 'findAttendanceAnomalies'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const targetDate = previousLocalDateKey(ctx.now, ctx.timezone);
    const rows = await this.repository.findAttendanceAnomalies({ tenantId: ctx.tenantId, targetDate, now: ctx.now, setup });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'ATTENDANCE_ANOMALY_ALERT',
        subject: { aggregateType: 'AttendanceDailyLedger', subjectId: row.anomalyId, subjectWorkerId: row.workerId },
        dueDate: new Date(`${row.workDate}T00:00:00.000Z`),
        payload: { anomalyType: row.anomalyType, workDate: row.workDate, severity: row.severity },
        escalationTier: row.severity === 'CRITICAL' ? escalationTier(0, true) : escalationTier(0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class PayrollCycleOpenJob implements ScheduledJob {
  readonly name = 'payroll-cycle-open';
  readonly cron = '0 6 * * *';
  readonly permissions = ['PAYROLL_CYCLE_CREATE'];
  readonly periodKey = monthPeriodKey;

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<PayrollSchedulerRepositoryPort, 'findCyclesToOpen'> = new HcmSchedulerReadRepository(),
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const cycles = await this.repository.findCyclesToOpen({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const cycle of cycles) {
      await ctx.runCommand({
        commandName: 'CreatePayrollCycle',
        aggregateType: 'PayrollCycle',
        payload: {
          cycleName: cycle.cycleName,
          payPeriodStart: cycle.payPeriodStart,
          payPeriodEnd: cycle.payPeriodEnd,
          payDate: cycle.payDate,
        },
        permissions: this.permissions,
        reason: this.name,
      });
    }
    return { itemsProcessed: cycles.length };
  }
}

@Injectable()
export class PayrollCutoffReminderJob implements ScheduledJob {
  readonly name = 'payroll-cutoff-reminder';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<PayrollSchedulerRepositoryPort, 'findCutoffReminderItems'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const rows = await this.repository.findCutoffReminderItems({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.payrollAdminWorkerIds,
        reminderType: 'PAYROLL_CUTOFF_REMINDER',
        subject: { aggregateType: 'PayrollCycle', subjectId: row.payrollCycleId },
        dueDate: row.cutoffDate,
        payload: { cycleName: row.cycleName, inputsNotFinalized: row.inputsNotFinalized, daysUntilCutoff: row.daysUntilCutoff },
        escalationTier: escalationTier(-Math.max(0, row.daysUntilCutoff)),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class PayrollReadinessCheckJob implements ScheduledJob {
  readonly name = 'payroll-readiness-check';
  readonly cron = '0 11 * * *';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<PayrollSchedulerRepositoryPort, 'findReadinessIssues'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const issues = await this.repository.findReadinessIssues({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const issue of issues) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: issue.payrollAdminWorkerIds,
        reminderType: 'PAYROLL_READINESS_CHECK',
        subject: { aggregateType: 'PayrollCycle', subjectId: issue.payrollCycleId, subjectWorkerId: issue.workerId },
        dueDate: issue.dueDate,
        payload: { workerId: issue.workerId.value, issueType: issue.issueType },
        escalationTier: escalationTier(0, true),
        now: ctx.now,
      });
    }
    return { itemsProcessed: issues.length };
  }
}

@Injectable()
export class PerformanceReviewCycleDueReminderJob implements ScheduledJob {
  readonly name = 'review-cycle-due-reminder';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<PerformanceSchedulerRepositoryPort, 'findReviewCyclesDueForReminder'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const cycles = await this.repository.findReviewCyclesDueForReminder({ tenantId: ctx.tenantId, now: ctx.now });
    for (const cycle of cycles) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: cycle.audienceWorkerIds,
        reminderType: 'PERFORMANCE_REVIEW_CYCLE_DUE',
        subject: { aggregateType: 'PerformanceReviewCycle', subjectId: cycle.cycleId },
        dueDate: cycle.dueDate,
        payload: { cycleName: cycle.cycleName },
        escalationTier: escalationTier(-Math.max(0, daysBetween(ctx.now, cycle.dueDate))),
        now: ctx.now,
      });
    }
    return { itemsProcessed: cycles.length };
  }
}

@Injectable()
export class GoalCheckinCadenceJob implements ScheduledJob {
  readonly name = 'goal-checkin-cadence';
  readonly cron = '0 10 * * 1';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<PerformanceSchedulerRepositoryPort, 'findGoalCheckinsDue'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const goals = await this.repository.findGoalCheckinsDue({ tenantId: ctx.tenantId, now: ctx.now });
    for (const goal of goals) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [goal.workerId],
        managerAudienceWorkerIds: optionalUuidArray(goal.managerWorkerId),
        reminderType: 'GOAL_CHECKIN_DUE',
        subject: { aggregateType: 'Goal', subjectId: goal.goalId, subjectWorkerId: goal.workerId },
        dueDate: goal.dueDate,
        payload: { title: goal.title },
        escalationTier: escalationTier(Math.max(0, daysBetween(goal.dueDate, ctx.now)), Boolean(goal.managerWorkerId && goal.dueDate.getTime() < ctx.now.getTime())),
        now: ctx.now,
      });
    }
    return { itemsProcessed: goals.length };
  }
}

@Injectable()
export class OverdueReviewEscalationJob implements ScheduledJob {
  readonly name = 'overdue-review-escalation';
  readonly cron = '0 8 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<PerformanceSchedulerRepositoryPort, 'findOverduePerformanceReviews'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const reviews = await this.repository.findOverduePerformanceReviews({ tenantId: ctx.tenantId, now: ctx.now });
    for (const review of reviews) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [review.reviewerWorkerId],
        managerAudienceWorkerIds: optionalUuidArray(review.reviewerManagerWorkerId),
        reminderType: 'PERFORMANCE_REVIEW_OVERDUE',
        subject: { aggregateType: 'PerformanceReview', subjectId: review.reviewId, subjectWorkerId: review.workerId },
        dueDate: review.dueDate,
        payload: { workerId: review.workerId.value, daysOverdue: review.daysOverdue },
        escalationTier: escalationTier(review.daysOverdue, review.daysOverdue > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: reviews.length };
  }
}

@Injectable()
export class ProbationReviewDueJob implements ScheduledJob {
  readonly name = 'probation-review-due';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<PerformanceSchedulerRepositoryPort, 'findProbationReviewsDue'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findProbationReviewsDue({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.managerWorkerId],
        reminderType: 'PROBATION_REVIEW_DUE',
        subject: { aggregateType: 'EmploymentRelationship', subjectId: row.relationshipId, subjectWorkerId: row.workerId },
        dueDate: row.probationEndDate,
        payload: { workerId: row.workerId.value, probationEndDate: row.probationEndDate.toISOString() },
        escalationTier: escalationTier(-Math.max(0, daysBetween(ctx.now, row.probationEndDate))),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class EngagementSurveyWindowJob implements ScheduledJob {
  readonly name = 'survey-window-activate-close';
  readonly cron = '0 6 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<EngagementSchedulerRepositoryPort, 'findSurveysToActivate' | 'findSurveysToClose'> = new HcmDomainSchedulerReadRepository(),
    private readonly activator: EffectiveDatingActivator,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const activate = await this.activator.activateDue({
      tenantId: ctx.tenantId,
      jobName: `${this.name}:activate`,
      today: ctx.now,
      dueStatuses: ['PUBLISHED'],
      queryDueRows: ({ tenantId, today }) => this.repository.findSurveysToActivate({ tenantId, today }),
      buildCommand: (row) => ({
        commandName: 'ActivateEngagementSurvey',
        aggregateType: 'EngagementSurvey',
        aggregateId: row.id,
        expectedState: row.status,
        expectedVersion: row.aggregateVersion,
        payload: { surveyId: row.id.value },
        permissions: ['ENGAGEMENT_SURVEY_ACTIVATE'],
        reason: this.name,
      }),
    });
    const close = await this.activator.activateDue({
      tenantId: ctx.tenantId,
      jobName: `${this.name}:close`,
      today: ctx.now,
      dueStatuses: ['ACTIVE'],
      queryDueRows: ({ tenantId, today }) => this.repository.findSurveysToClose({ tenantId, today }),
      buildCommand: (row) => ({
        commandName: 'CloseEngagementSurvey',
        aggregateType: 'EngagementSurvey',
        aggregateId: row.id,
        expectedState: row.status,
        expectedVersion: row.aggregateVersion,
        payload: { surveyId: row.id.value },
        permissions: ['ENGAGEMENT_SURVEY_CLOSE'],
        reason: this.name,
      }),
    });
    return {
      itemsProcessed: activate.processed + close.processed,
      errors: [...activate.errors, ...close.errors],
    };
  }
}

@Injectable()
export class Feedback360NudgeJob implements ScheduledJob {
  readonly name = 'feedback-360-nudge';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<EngagementSchedulerRepositoryPort, 'findFeedback360RaterNudges'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findFeedback360RaterNudges({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.raterWorkerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'FEEDBACK_360_RATER_NUDGE',
        subject: { aggregateType: 'Feedback360Response', subjectId: row.responseId, subjectWorkerId: row.raterWorkerId },
        dueDate: row.dueDate,
        payload: { cycleId: row.cycleId.value, revieweeId: row.revieweeId.value, daysUntilClose: row.daysUntilClose },
        escalationTier: escalationTier(-row.daysUntilClose, Boolean(row.managerWorkerId && row.daysUntilClose <= 1)),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class RecognitionProgramPeriodCloseJob implements ScheduledJob {
  readonly name = 'recognition-program-period-close';
  readonly cron = '0 4 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<EngagementSchedulerRepositoryPort, 'findRecognitionProgramsToClose'> = new HcmDomainSchedulerReadRepository(),
    private readonly activator: EffectiveDatingActivator,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const result = await this.activator.activateDue({
      tenantId: ctx.tenantId,
      jobName: this.name,
      today: ctx.now,
      dueStatuses: ['ACTIVE'],
      queryDueRows: ({ tenantId, today }) => this.repository.findRecognitionProgramsToClose({ tenantId, today }),
      buildCommand: (row) => ({
        commandName: 'CloseRecognitionProgram',
        aggregateType: 'RecognitionProgram',
        aggregateId: row.id,
        expectedState: row.status,
        expectedVersion: row.aggregateVersion,
        payload: { recognitionProgramId: row.id.value },
        permissions: ['RECOGNITION_PROGRAM_CLOSE'],
        reason: this.name,
      }),
    });
    return { itemsProcessed: result.processed, errors: result.errors };
  }
}

@Injectable()
export class LearningAssignmentDueReminderJob implements ScheduledJob {
  readonly name = 'assignment-due-reminder';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<LearningSchedulerRepositoryPort, 'findLearningAssignmentsDue'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findLearningAssignmentsDue({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      const overdueDays = row.daysOverdue ?? Math.max(0, daysBetween(row.dueDate, ctx.now));
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'LEARNING_ASSIGNMENT_DUE',
        subject: { aggregateType: 'LearningAssignment', subjectId: row.assignmentId, subjectWorkerId: row.workerId },
        dueDate: row.dueDate,
        payload: { courseTitle: row.courseTitle, daysOverdue: overdueDays },
        escalationTier: escalationTier(overdueDays, overdueDays > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class CertificationExpiryReminderJob implements ScheduledJob {
  readonly name = 'certification-expiry-reminder';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<LearningSchedulerRepositoryPort, 'findCertificationsExpiring'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findCertificationsExpiring({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'CERTIFICATION_EXPIRY',
        subject: { aggregateType: 'Certification', subjectId: row.certificationId, subjectWorkerId: row.workerId },
        dueDate: row.expiryDate,
        payload: { certificationName: row.certificationName, daysUntilExpiry: row.daysUntilExpiry },
        escalationTier: escalationTier(-Math.max(0, row.daysUntilExpiry), row.daysUntilExpiry <= 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class MandatoryTrainingDeadlineJob implements ScheduledJob {
  readonly name = 'mandatory-training-deadline';
  readonly cron = '0 10 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<LearningSchedulerRepositoryPort, 'findMandatoryTrainingDeadlines'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findMandatoryTrainingDeadlines({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      const overdueDays = row.daysOverdue ?? Math.max(0, daysBetween(row.dueDate, ctx.now));
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'MANDATORY_TRAINING_DEADLINE',
        subject: { aggregateType: 'LearningAssignment', subjectId: row.assignmentId, subjectWorkerId: row.workerId },
        dueDate: row.dueDate,
        payload: { courseTitle: row.courseTitle, daysOverdue: overdueDays },
        escalationTier: escalationTier(overdueDays, overdueDays > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class StaleRequisitionAlertJob implements ScheduledJob {
  readonly name = 'stale-requisition-alert';
  readonly cron = '0 9 * * 1';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<RecruitingSchedulerRepositoryPort, 'findStaleRequisitions'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findStaleRequisitions({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.recruiterWorkerId],
        managerAudienceWorkerIds: optionalUuidArray(row.hiringManagerWorkerId),
        reminderType: 'STALE_REQUISITION_ALERT',
        subject: { aggregateType: 'JobRequisition', subjectId: row.requisitionId },
        dueDate: row.dueDate,
        payload: { title: row.title, daysOpen: row.daysOpen },
        escalationTier: escalationTier(row.daysOpen - 30, Boolean(row.hiringManagerWorkerId && row.daysOpen >= 45)),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class CandidateAgingInStageJob implements ScheduledJob {
  readonly name = 'candidate-aging-in-stage';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<RecruitingSchedulerRepositoryPort, 'findCandidatesAgingInStage'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findCandidatesAgingInStage({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.recruiterWorkerId],
        reminderType: 'CANDIDATE_AGING_IN_STAGE',
        subject: { aggregateType: 'Candidate', subjectId: row.candidateId },
        dueDate: row.dueDate,
        payload: { requisitionId: row.requisitionId.value, stage: row.stage, daysInStage: row.daysInStage },
        escalationTier: escalationTier(row.daysInStage - 7, row.daysInStage >= 14),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class InterviewReminderJob implements ScheduledJob {
  readonly name = 'interview-reminder';
  readonly cron = '0 8 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<RecruitingSchedulerRepositoryPort, 'findInterviewsDueForReminder'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findInterviewsDueForReminder({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.interviewerWorkerIds,
        reminderType: 'INTERVIEW_REMINDER',
        subject: { aggregateType: 'InterviewPlan', subjectId: row.interviewId },
        dueDate: row.scheduledAt,
        payload: { candidateId: row.candidateId.value, scheduledAt: row.scheduledAt.toISOString() },
        escalationTier: escalationTier(-1),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class OfferExpiryReminderJob implements ScheduledJob {
  readonly name = 'offer-expiry-reminder';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<RecruitingSchedulerRepositoryPort, 'findOffersExpiring'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findOffersExpiring({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'OFFER_EXPIRY_REMINDER',
        subject: { aggregateType: 'Offer', subjectId: row.offerId },
        dueDate: row.expiryDate,
        payload: { candidateId: row.candidateId.value, daysUntilExpiry: row.daysUntilExpiry },
        escalationTier: escalationTier(-row.daysUntilExpiry, row.daysUntilExpiry <= 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class PreStartReminderJob implements ScheduledJob {
  readonly name = 'pre-start-reminders';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<OnboardingSchedulerRepositoryPort, 'findPreStartReminders'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findPreStartReminders({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'ONBOARDING_PRE_START',
        subject: { aggregateType: 'OnboardingPlan', subjectId: row.onboardingPlanId, subjectWorkerId: row.workerId },
        dueDate: row.startDate,
        payload: { startDate: row.startDate.toISOString() },
        escalationTier: escalationTier(-Math.max(0, daysBetween(ctx.now, row.startDate))),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class OnboardingTaskDueJob implements ScheduledJob {
  readonly name = 'onboarding-task-due';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<OnboardingSchedulerRepositoryPort, 'findOnboardingTasksDue'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findOnboardingTasksDue({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      const overdueDays = row.daysOverdue ?? Math.max(0, daysBetween(row.dueDate, ctx.now));
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.assigneeWorkerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'ONBOARDING_TASK_DUE',
        subject: { aggregateType: 'OnboardingTask', subjectId: row.taskId, subjectWorkerId: row.assigneeWorkerId },
        dueDate: row.dueDate,
        payload: { planId: row.planId.value, stalled: row.stalled, daysOverdue: overdueDays },
        escalationTier: escalationTier(overdueDays, row.stalled || overdueDays > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class OnboardingCheckpointJob implements ScheduledJob {
  readonly name = 'day-30-60-90-checkpoints';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<OnboardingSchedulerRepositoryPort, 'findOnboardingCheckpointsDue'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findOnboardingCheckpointsDue({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.managerWorkerId],
        reminderType: 'ONBOARDING_CHECKPOINT_DUE',
        subject: { aggregateType: 'OnboardingPlan', subjectId: row.onboardingPlanId, subjectWorkerId: row.workerId },
        dueDate: row.dueDate,
        payload: { workerId: row.workerId.value, milestoneDay: row.milestoneDay },
        escalationTier: escalationTier(0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class SuccessionPlanReviewCadenceJob implements ScheduledJob {
  readonly name = 'succession-plan-review-cadence';
  readonly cron = '0 9 * * 1';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<SkillsTalentSchedulerRepositoryPort, 'findSuccessionPlanReviewsDue'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findSuccessionPlanReviewsDue({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'SUCCESSION_PLAN_REVIEW_DUE',
        subject: { aggregateType: 'SuccessionPlan', subjectId: row.successionPlanId },
        dueDate: row.dueDate,
        payload: { positionId: row.positionId.value },
        escalationTier: escalationTier(0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class SkillProfileRefreshNudgeJob implements ScheduledJob {
  readonly name = 'skill-profile-refresh-nudge';
  readonly cron = '0 10 1 * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<SkillsTalentSchedulerRepositoryPort, 'findSkillProfilesForRefresh'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findSkillProfilesForRefresh({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'SKILL_PROFILE_REFRESH',
        subject: { aggregateType: 'SkillProfile', subjectId: row.skillProfileId, subjectWorkerId: row.workerId },
        dueDate: row.dueDate,
        payload: { daysSinceUpdate: row.daysSinceUpdate },
        escalationTier: escalationTier(row.daysSinceUpdate - 180, Boolean(row.managerWorkerId && row.daysSinceUpdate >= 210)),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class CompReviewCycleOpenJob implements ScheduledJob {
  readonly name = 'comp-review-cycle-open';
  readonly cron = '0 6 1 1 *';
  readonly permissions = ['COMPENSATION_CYCLE_CREATE'];
  readonly periodKey = yearPeriodKey;

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<CompensationSchedulerRepositoryPort, 'findCompReviewCyclesToOpen'> = new HcmDomainSchedulerReadRepository(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const cycles = await this.repository.findCompReviewCyclesToOpen({ tenantId: ctx.tenantId, now: ctx.now });
    for (const cycle of cycles) {
      await ctx.runCommand({
        commandName: 'CreateBonusCycle',
        aggregateType: 'BonusCycle',
        payload: {
          cycleName: cycle.cycleName,
          cycleYear: cycle.cycleYear,
          eligibilityDate: cycle.eligibilityDate,
          paymentDate: cycle.paymentDate,
          totalPoolAmount: 0,
          currency: cycle.currency,
        },
        permissions: this.permissions,
        reason: this.name,
      });
    }
    return { itemsProcessed: cycles.length };
  }
}

@Injectable()
export class PayEquityPeriodicRecomputeJob implements ScheduledJob {
  readonly name = 'pay-equity-periodic-recompute';
  readonly cron = '0 7 1 * *';

  constructor(
    @Optional() @Inject(HcmDomainSchedulerReadRepository) private readonly repository: Pick<CompensationSchedulerRepositoryPort, 'findPayEquityReviewsDue'> = new HcmDomainSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findPayEquityReviewsDue({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'PAY_EQUITY_RECOMPUTE_DUE',
        subject: { aggregateType: 'PayEquityReview', subjectId: row.reviewId },
        dueDate: row.dueDate,
        payload: { reviewPeriod: row.reviewPeriod },
        escalationTier: escalationTier(0, true),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class PolicyAcknowledgementReminderJob implements ScheduledJob {
  readonly name = 'policy-acknowledgement-reminder';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<ComplianceSchedulerRepositoryPort, 'findPolicyAcknowledgementReminders'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findPolicyAcknowledgementReminders({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'POLICY_ACKNOWLEDGEMENT_DUE',
        subject: { aggregateType: 'PolicyAcknowledgement', subjectId: row.acknowledgementId, subjectWorkerId: row.workerId },
        dueDate: row.dueDate,
        payload: { policyDocumentId: row.policyDocumentId.value, daysOverdue: row.daysOverdue },
        escalationTier: escalationTier(row.daysOverdue, row.daysOverdue > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class MandatoryComplianceTaskDeadlineJob implements ScheduledJob {
  readonly name = 'mandatory-compliance-task-deadline';
  readonly cron = '0 10 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<ComplianceSchedulerRepositoryPort, 'findMandatoryComplianceTasksDue'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findMandatoryComplianceTasksDue({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.ownerWorkerId],
        reminderType: 'MANDATORY_COMPLIANCE_TASK_DEADLINE',
        subject: { aggregateType: 'ComplianceTask', subjectId: row.taskId },
        dueDate: row.dueDate,
        payload: { taskType: row.taskType, daysOverdue: row.daysOverdue },
        escalationTier: escalationTier(row.daysOverdue, row.daysOverdue > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class ComplianceDocumentExpiryAlertJob implements ScheduledJob {
  readonly name = 'document-expiry-alert';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<ComplianceSchedulerRepositoryPort, 'findComplianceDocumentsExpiring'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findComplianceDocumentsExpiring({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.workerId ? [row.workerId] : (row.ownerWorkerIds ?? []),
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'COMPLIANCE_DOCUMENT_EXPIRY',
        subject: { aggregateType: 'PolicyDocument', subjectId: row.documentId, subjectWorkerId: row.workerId },
        dueDate: row.expiryDate,
        payload: { documentType: row.documentType, daysUntilExpiry: row.daysUntilExpiry },
        escalationTier: escalationTier(-Math.max(0, row.daysUntilExpiry), row.daysUntilExpiry <= 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class ProbationPeriodEndJob implements ScheduledJob {
  readonly name = 'probation-period-end';
  readonly cron = '0 8 * * *';
  readonly permissions = ['EMPLOYMENT_RELATIONSHIP_UPDATE'];

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<HrCoreSchedulerRepositoryPort, 'findProbationPeriodsEnding'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findProbationPeriodsEnding({ tenantId: ctx.tenantId, now: ctx.now });
    let itemsProcessed = 0;
    for (const row of rows) {
      if (row.canAutoComplete) {
        await ctx.runCommand({
          commandName: 'CompleteProbationEmploymentRelationship',
          aggregateType: 'EmploymentRelationship',
          aggregateId: row.relationshipId,
          subjectWorkerId: row.workerId,
          payload: { relationshipId: row.relationshipId.value, workerId: row.workerId.value },
          permissions: this.permissions,
          reason: this.name,
        });
      } else {
        await this.reminderEmitter.emit({
          tenantId: ctx.tenantId,
          audienceWorkerIds: optionalUuidArray(row.managerWorkerId),
          reminderType: 'PROBATION_PERIOD_END',
          subject: { aggregateType: 'EmploymentRelationship', subjectId: row.relationshipId, subjectWorkerId: row.workerId },
          dueDate: row.probationEndDate,
          payload: { workerId: row.workerId.value },
          escalationTier: escalationTier(0, true),
          now: ctx.now,
        });
      }
      itemsProcessed += 1;
    }
    return { itemsProcessed };
  }
}

@Injectable()
export class ContractTermEndAlertJob implements ScheduledJob {
  readonly name = 'contract-term-end-alert';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<HrCoreSchedulerRepositoryPort, 'findContractTermsEnding'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findContractTermsEnding({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'CONTRACT_TERM_END',
        subject: { aggregateType: 'EmploymentContract', subjectId: row.contractId, subjectWorkerId: row.workerId },
        dueDate: row.endDate,
        payload: { daysUntilEnd: row.daysUntilEnd },
        escalationTier: escalationTier(-Math.max(0, row.daysUntilEnd), row.daysUntilEnd <= 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class WorkAnniversaryEventJob implements ScheduledJob {
  readonly name = 'work-anniversary';
  readonly cron = '0 8 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<HrCoreSchedulerRepositoryPort, 'findWorkAnniversaries'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findWorkAnniversaries({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'WORK_ANNIVERSARY',
        subject: { aggregateType: 'Worker', subjectId: row.workerId, subjectWorkerId: row.workerId },
        dueDate: row.anniversaryDate,
        payload: { yearsOfService: row.yearsOfService },
        escalationTier: escalationTier(0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class BirthdayEventJob implements ScheduledJob {
  readonly name = 'birthday-events';
  readonly cron = '0 8 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<HrCoreSchedulerRepositoryPort, 'findBirthdays'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findBirthdays({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'EMPLOYEE_BIRTHDAY',
        subject: { aggregateType: 'Worker', subjectId: row.workerId, subjectWorkerId: row.workerId },
        dueDate: row.birthdayDate,
        payload: {},
        escalationTier: escalationTier(0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class PersonalDocumentExpiryAlertJob implements ScheduledJob {
  readonly name = 'personal-document-expiry';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<HrCoreSchedulerRepositoryPort, 'findPersonalDocumentsExpiring'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findPersonalDocumentsExpiring({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'PERSONAL_DOCUMENT_EXPIRY',
        subject: { aggregateType: 'PersonalDataRecord', subjectId: row.documentId, subjectWorkerId: row.workerId },
        dueDate: row.expiryDate,
        payload: { documentType: row.documentType, daysUntilExpiry: row.daysUntilExpiry },
        escalationTier: escalationTier(-Math.max(0, row.daysUntilExpiry), row.daysUntilExpiry <= 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class ImmigrationWorkPermitExpiryJob implements ScheduledJob {
  readonly name = 'immigration-work-permit-expiry';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<GlobalHrSchedulerRepositoryPort, 'findWorkPermitsExpiring'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findWorkPermitsExpiring({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'IMMIGRATION_WORK_PERMIT_EXPIRY',
        subject: { aggregateType: 'WorkAuthorizationCase', subjectId: row.workAuthorizationCaseId, subjectWorkerId: row.workerId },
        dueDate: row.expiryDate,
        payload: { authorizationType: row.authorizationType, daysUntilExpiry: row.daysUntilExpiry },
        escalationTier: escalationTier(-Math.max(0, row.daysUntilExpiry), row.daysUntilExpiry <= 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class InternationalAssignmentEndJob implements ScheduledJob {
  readonly name = 'international-assignment-end';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<GlobalHrSchedulerRepositoryPort, 'findInternationalAssignmentsEnding'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findInternationalAssignmentsEnding({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'INTERNATIONAL_ASSIGNMENT_END',
        subject: { aggregateType: 'JobAssignment', subjectId: row.assignmentId, subjectWorkerId: row.workerId },
        dueDate: row.endDate,
        payload: { daysUntilEnd: row.daysUntilEnd },
        escalationTier: escalationTier(-Math.max(0, row.daysUntilEnd), row.daysUntilEnd <= 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class AccessRecertificationCampaignJob implements ScheduledJob {
  readonly name = 'access-recertification-campaign';
  readonly cron = '0 6 1 * *';
  readonly permissions = ['ACCESS_REVIEW_MANAGE'];
  readonly periodKey = monthPeriodKey;

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<AccessGovernanceSchedulerRepositoryPort, 'findAccessRecertificationCampaignsDue'> = new HcmGovernanceSchedulerReadRepository(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findAccessRecertificationCampaignsDue({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await ctx.runCommand({
        commandName: 'CreateAccessReviewCampaign',
        aggregateType: 'AccessReviewCampaign',
        payload: {
          dto: {
            code: `ACCESS-RECERT-${monthPeriodKey(ctx.now)}`,
            name: row.campaignName,
            scope: row.scope,
            reviewerRole: 'MANAGER',
            dueAt: row.dueAt.toISOString(),
          },
        },
        permissions: this.permissions,
        reason: this.name,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class StaleAccessReviewJob implements ScheduledJob {
  readonly name = 'stale-access-review';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<AccessGovernanceSchedulerRepositoryPort, 'findStaleAccessReviews'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findStaleAccessReviews({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'STALE_ACCESS_REVIEW',
        subject: { aggregateType: 'AccessReviewCampaign', subjectId: row.campaignId },
        dueDate: row.dueDate,
        payload: { daysOverdue: row.daysOverdue, pendingItemCount: row.pendingItemCount },
        escalationTier: escalationTier(row.daysOverdue, row.daysOverdue > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class BreakGlassSessionExpiryJob implements ScheduledJob {
  readonly name = 'break-glass-session-expiry';
  readonly cron = '*/15 * * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<AccessGovernanceSchedulerRepositoryPort, 'findBreakGlassSessionsExpiring'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findBreakGlassSessionsExpiring({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.ownerWorkerId],
        reminderType: 'BREAK_GLASS_SESSION_EXPIRY',
        subject: { aggregateType: 'BreakGlassSession', subjectId: row.sessionId, subjectWorkerId: row.ownerWorkerId },
        dueDate: row.expiresAt,
        payload: { minutesUntilExpiry: row.minutesUntilExpiry },
        escalationTier: escalationTier(0, true),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class BiasTestCadenceDueJob implements ScheduledJob {
  readonly name = 'bias-test-cadence-due';
  readonly cron = '0 8 * * 1';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<HrAiGovernanceSchedulerRepositoryPort, 'findBiasTestsDue'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findBiasTestsDue({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'AI_BIAS_TEST_CADENCE_DUE',
        subject: { aggregateType: 'HrAiUseCase', subjectId: row.useCaseId },
        dueDate: row.dueDate,
        payload: { useCaseName: row.useCaseName, riskClass: row.riskClass },
        escalationTier: escalationTier(0, row.riskClass.toUpperCase() === 'HIGH'),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class UseCaseReassessmentDueJob implements ScheduledJob {
  readonly name = 'use-case-reassessment-due';
  readonly cron = '0 8 * * 1';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<HrAiGovernanceSchedulerRepositoryPort, 'findUseCaseReassessmentsDue'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findUseCaseReassessmentsDue({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'AI_USE_CASE_REASSESSMENT_DUE',
        subject: { aggregateType: 'HrAiUseCase', subjectId: row.useCaseId },
        dueDate: row.dueDate,
        payload: { useCaseName: row.useCaseName, riskClass: row.riskClass },
        escalationTier: escalationTier(0, row.riskClass.toUpperCase() === 'HIGH'),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class KillSwitchReviewJob implements ScheduledJob {
  readonly name = 'kill-switch-review';
  readonly cron = '0 8 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<HrAiGovernanceSchedulerRepositoryPort, 'findKillSwitchReviewsDue'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findKillSwitchReviewsDue({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'AI_KILL_SWITCH_REVIEW',
        subject: { aggregateType: 'HrAiKillSwitch', subjectId: row.killSwitchId },
        dueDate: row.dueDate,
        payload: { useCaseId: row.useCaseId.value, daysOpen: row.daysOpen },
        escalationTier: escalationTier(row.daysOpen, true),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class ScheduledPolicyActivationJob implements ScheduledJob {
  readonly name = 'scheduled-policy-activation';
  readonly cron = '0 5 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<PolicySchedulerRepositoryPort, 'findPoliciesToApply'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly activator: EffectiveDatingActivator,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const result = await this.activator.activateDue({
      tenantId: ctx.tenantId,
      jobName: this.name,
      today: ctx.now,
      dueStatuses: ['PUBLISHED'],
      queryDueRows: ({ tenantId, today }) => this.repository.findPoliciesToApply({ tenantId, today }),
      buildCommand: (row) => ({
        commandName: 'ApplyPolicyRevision',
        aggregateType: row.aggregateType,
        aggregateId: row.id,
        expectedState: row.status,
        expectedVersion: row.aggregateVersion,
        payload: { id: row.id.value, input: { source: this.name } },
        permissions: ['POLICY_APPLY'],
        reason: this.name,
      }),
    });
    return { itemsProcessed: result.processed, errors: result.errors };
  }
}

@Injectable()
export class PolicyRevisionPublishingJob implements ScheduledJob {
  readonly name = 'revision-publishing';
  readonly cron = '0 4 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<PolicySchedulerRepositoryPort, 'findPolicyRevisionsToPublish'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly activator: EffectiveDatingActivator,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const result = await this.activator.activateDue({
      tenantId: ctx.tenantId,
      jobName: this.name,
      today: ctx.now,
      dueStatuses: ['APPROVED'],
      queryDueRows: ({ tenantId, today }) => this.repository.findPolicyRevisionsToPublish({ tenantId, today }),
      buildCommand: (row) => ({
        commandName: 'PublishPolicyRevision',
        aggregateType: row.aggregateType,
        aggregateId: row.id,
        expectedState: row.status,
        expectedVersion: row.aggregateVersion,
        payload: { id: row.id.value },
        permissions: ['POLICY_PUBLISH'],
        reason: this.name,
      }),
    });
    return { itemsProcessed: result.processed, errors: result.errors };
  }
}

@Injectable()
export class CbaExpiryReminderJob implements ScheduledJob {
  readonly name = 'CBA-expiry-reminder';
  readonly cron = '0 9 * * 1';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<UnionLaborSchedulerRepositoryPort, 'findCbaExpiries'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findCbaExpiries({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'CBA_EXPIRY_REMINDER',
        subject: { aggregateType: 'UnionRecognition', subjectId: row.unionRecognitionId },
        dueDate: row.expiryDate,
        payload: { unionName: row.unionName, daysUntilExpiry: row.daysUntilExpiry },
        escalationTier: escalationTier(-Math.max(0, row.daysUntilExpiry), row.daysUntilExpiry <= 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class GrievanceSlaEscalationJob implements ScheduledJob {
  readonly name = 'grievance-SLA-escalation';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<UnionLaborSchedulerRepositoryPort, 'findGrievanceSlaBreaches'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findGrievanceSlaBreaches({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'GRIEVANCE_SLA_ESCALATION',
        subject: { aggregateType: 'Grievance', subjectId: row.grievanceId, subjectWorkerId: row.workerId },
        dueDate: row.dueDate,
        payload: { workerId: row.workerId.value, daysOverdue: row.daysOverdue },
        escalationTier: escalationTier(row.daysOverdue, row.daysOverdue > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class CaseSlaAgingJob implements ScheduledJob {
  readonly name = 'case-SLA-aging';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<CaseSchedulerRepositoryPort, 'findCaseSlaAging'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findCaseSlaAging({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'CASE_SLA_AGING',
        subject: { aggregateType: row.caseAggregateType, subjectId: row.caseId, subjectWorkerId: row.workerId },
        dueDate: row.dueDate,
        payload: { daysOverdue: row.daysOverdue },
        escalationTier: escalationTier(row.daysOverdue, row.daysOverdue > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class InvestigationDeadlineJob implements ScheduledJob {
  readonly name = 'investigation-deadline';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<CaseSchedulerRepositoryPort, 'findInvestigationDeadlines'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findInvestigationDeadlines({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'INVESTIGATION_DEADLINE',
        subject: { aggregateType: 'ErInvestigation', subjectId: row.investigationId },
        dueDate: row.dueDate,
        payload: { daysOverdue: row.daysOverdue },
        escalationTier: escalationTier(row.daysOverdue, row.daysOverdue > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class BenefitsOpenEnrollmentWindowJob implements ScheduledJob {
  readonly name = 'open-enrollment-window-open';
  readonly cron = '0 5 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<BenefitsWindowSchedulerRepositoryPort, 'findBenefitsProgramsToOpen'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly activator: EffectiveDatingActivator,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const result = await this.activator.activateDue({
      tenantId: ctx.tenantId,
      jobName: this.name,
      today: ctx.now,
      dueStatuses: ['DRAFT'],
      queryDueRows: ({ tenantId, today }) => this.repository.findBenefitsProgramsToOpen({ tenantId, today }),
      buildCommand: (row) => ({
        commandName: 'ActivateBenefitsProgram',
        aggregateType: row.aggregateType,
        aggregateId: row.id,
        expectedState: row.status,
        expectedVersion: row.aggregateVersion,
        payload: { benefitsProgramId: row.id.value },
        permissions: ['BENEFITS_PROGRAM_MANAGE'],
        reason: this.name,
      }),
    });
    return { itemsProcessed: result.processed, errors: result.errors };
  }
}

@Injectable()
export class BenefitsOpenEnrollmentCloseJob implements ScheduledJob {
  readonly name = 'open-enrollment-window-close';
  readonly cron = '0 5 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<BenefitsWindowSchedulerRepositoryPort, 'findBenefitsProgramsToClose'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly activator: EffectiveDatingActivator,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const result = await this.activator.activateDue({
      tenantId: ctx.tenantId,
      jobName: this.name,
      today: ctx.now,
      dueStatuses: ['ACTIVE', 'SUSPENDED'],
      queryDueRows: ({ tenantId, today }) => this.repository.findBenefitsProgramsToClose({ tenantId, today }),
      buildCommand: (row) => ({
        commandName: 'CloseBenefitsProgram',
        aggregateType: row.aggregateType,
        aggregateId: row.id,
        expectedState: row.status,
        expectedVersion: row.aggregateVersion,
        payload: { benefitsProgramId: row.id.value },
        permissions: ['BENEFITS_PROGRAM_MANAGE'],
        reason: this.name,
      }),
    });
    return { itemsProcessed: result.processed, errors: result.errors };
  }
}

@Injectable()
export class BenefitsLifeEventDeadlineReminderJob implements ScheduledJob {
  readonly name = 'life-event-deadline-reminder';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<BenefitsWindowSchedulerRepositoryPort, 'findLifeEventDeadlines'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findLifeEventDeadlines({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'BENEFITS_LIFE_EVENT_DEADLINE',
        subject: { aggregateType: 'BenefitsLifeEvent', subjectId: row.lifeEventId, subjectWorkerId: row.workerId },
        dueDate: row.dueDate,
        payload: { eventType: row.eventType, daysOverdue: row.daysOverdue },
        escalationTier: escalationTier(row.daysOverdue, row.daysOverdue > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class SpendingAccountUseItOrLoseItJob implements ScheduledJob {
  readonly name = 'spending-account-use-it-or-lose-it';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<BenefitsWindowSchedulerRepositoryPort, 'findSpendingAccountsUseItOrLoseIt'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findSpendingAccountsUseItOrLoseIt({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'SPENDING_ACCOUNT_USE_IT_OR_LOSE_IT',
        subject: { aggregateType: 'SpendingAccount', subjectId: row.spendingAccountId, subjectWorkerId: row.workerId },
        dueDate: row.planYearEnd,
        payload: { accountType: row.accountType, availableAmount: row.availableAmount, currency: row.currency, daysUntilExpiry: row.daysUntilExpiry },
        escalationTier: escalationTier(-Math.max(0, row.daysUntilExpiry), row.daysUntilExpiry <= 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class PositionVacancyAgingJob implements ScheduledJob {
  readonly name = 'position-vacancy-aging';
  readonly cron = '0 9 * * 1';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<PositionOrganizationSchedulerRepositoryPort, 'findAgingVacantPositions'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findAgingVacantPositions({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'POSITION_VACANCY_AGING',
        subject: { aggregateType: 'Position', subjectId: row.positionId },
        dueDate: row.vacancyDate,
        payload: { title: row.title, daysVacant: row.daysVacant },
        escalationTier: escalationTier(row.daysVacant - 30, row.daysVacant >= 45),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class ScheduledPositionActivationJob implements ScheduledJob {
  readonly name = 'scheduled-position-effective-date-activation';
  readonly cron = '0 5 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<PositionOrganizationSchedulerRepositoryPort, 'findPositionsToActivate'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly activator: EffectiveDatingActivator,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const result = await this.activator.activateDue({
      tenantId: ctx.tenantId,
      jobName: this.name,
      today: ctx.now,
      dueStatuses: ['DRAFT'],
      queryDueRows: ({ tenantId, today }) => this.repository.findPositionsToActivate({ tenantId, today }),
      buildCommand: (row) => ({
        commandName: 'ActivatePosition',
        aggregateType: row.aggregateType,
        aggregateId: row.id,
        expectedState: row.status,
        expectedVersion: row.aggregateVersion,
        payload: { positionId: row.id },
        permissions: ['POSITION_MANAGE'],
        reason: this.name,
      }),
    });
    return { itemsProcessed: result.processed, errors: result.errors };
  }
}

@Injectable()
export class ScheduledReorgActivationJob implements ScheduledJob {
  readonly name = 'scheduled-reorg-effective-date-activation';
  readonly cron = '0 5 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<PositionOrganizationSchedulerRepositoryPort, 'findOrgUnitsToRestructure'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly activator: EffectiveDatingActivator,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const result = await this.activator.activateDue<ScheduledReorgCandidate>({
      tenantId: ctx.tenantId,
      jobName: this.name,
      today: ctx.now,
      dueStatuses: ['SCHEDULED'],
      queryDueRows: ({ tenantId, today }) => this.repository.findOrgUnitsToRestructure({ tenantId, today }),
      buildCommand: (row) => ({
        commandName: 'RestructureOrgUnit',
        aggregateType: row.aggregateType,
        aggregateId: row.id,
        expectedState: row.status,
        expectedVersion: row.aggregateVersion,
        payload: { orgUnitId: row.id.value, ...(row.payload ?? {}) },
        permissions: ['ORG_STRUCTURE_MANAGE'],
        reason: this.name,
      }),
    });
    return { itemsProcessed: result.processed, errors: result.errors };
  }
}

@Injectable()
export class PeriodicHeadcountSnapshotJob implements ScheduledJob {
  readonly name = 'periodic-headcount-snapshot';
  readonly cron = '0 2 1 * *';
  readonly periodKey = monthPeriodKey;

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<PositionOrganizationSchedulerRepositoryPort, 'findHeadcountSnapshotsDue'> = new HcmGovernanceSchedulerReadRepository(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findHeadcountSnapshotsDue({ tenantId: ctx.tenantId, now: ctx.now, periodKey: ctx.periodKey });
    for (const row of rows) {
      await ctx.runCommand({
        commandName: 'RunReportDefinition',
        aggregateType: 'ReportDefinition',
        aggregateId: row.reportDefinitionId,
        payload: { reportDefinitionId: row.reportDefinitionId.value, parameters: { snapshotPeriodKey: row.periodKey, snapshotType: row.snapshotType } },
        permissions: ['REPORT_RUN'],
        reason: this.name,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class SchedulePublishReminderJob implements ScheduledJob {
  readonly name = 'schedule-publish-reminder';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<WorkforceSchedulerRepositoryPort, 'findSchedulesNeedingPublish'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findSchedulesNeedingPublish({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'SCHEDULE_PUBLISH_REMINDER',
        subject: { aggregateType: 'ShiftSchedule', subjectId: row.shiftScheduleId },
        dueDate: row.shiftDate,
        payload: { daysUntilShift: row.daysUntilShift },
        escalationTier: escalationTier(-Math.max(0, row.daysUntilShift), row.daysUntilShift <= 1),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class CoverageGapAlertJob implements ScheduledJob {
  readonly name = 'coverage-gap-alert';
  readonly cron = '0 7 * * *';
  readonly permissions = ['WORKFORCE_COVERAGE_MANAGE'];

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<WorkforceSchedulerRepositoryPort, 'findCoverageGapsForAlert'> = new HcmGovernanceSchedulerReadRepository(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findCoverageGapsForAlert({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await ctx.runCommand({
        commandName: 'NotifyCoverageGap',
        aggregateType: 'CoverageGap',
        aggregateId: row.coverageGapId,
        payload: { coverageGapId: row.coverageGapId },
        permissions: this.permissions,
        reason: this.name,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class SowEndDateReminderJob implements ScheduledJob {
  readonly name = 'sow-end-date-reminder';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<ContingentSchedulerRepositoryPort, 'findSowEndDates'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findSowEndDates({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'SOW_END_DATE_REMINDER',
        subject: { aggregateType: 'SowEngagement', subjectId: row.sowEngagementId },
        dueDate: row.endDate,
        payload: { projectName: row.projectName, daysUntilEnd: row.daysUntilEnd },
        escalationTier: escalationTier(-Math.max(0, row.daysUntilEnd), row.daysUntilEnd <= 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class ContingentAssignmentExpiryJob implements ScheduledJob {
  readonly name = 'assignment-expiry';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<ContingentSchedulerRepositoryPort, 'findContingentAssignmentsExpiring'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findContingentAssignmentsExpiring({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'CONTINGENT_ASSIGNMENT_EXPIRY',
        subject: { aggregateType: 'ContingentWorkerAssignment', subjectId: row.assignmentId, subjectWorkerId: row.workerId },
        dueDate: row.endDate,
        payload: { daysUntilEnd: row.daysUntilEnd },
        escalationTier: escalationTier(-Math.max(0, row.daysUntilEnd), row.daysUntilEnd <= 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class ContingentTenureThresholdJob implements ScheduledJob {
  readonly name = 'co-employment-tenure-threshold-alert';
  readonly cron = '0 9 * * 1';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<ContingentSchedulerRepositoryPort, 'findContingentTenureThresholds'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findContingentTenureThresholds({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        managerAudienceWorkerIds: [row.workerId],
        reminderType: 'CONTINGENT_TENURE_THRESHOLD',
        subject: { aggregateType: 'ContingentWorkerAssignment', subjectId: row.assignmentId, subjectWorkerId: row.workerId },
        dueDate: ctx.now,
        payload: { tenureDays: row.tenureDays, thresholdDays: row.thresholdDays },
        escalationTier: escalationTier(row.tenureDays - row.thresholdDays, true),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class RateCardReviewDueJob implements ScheduledJob {
  readonly name = 'rate-card-review-due';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<ContingentSchedulerRepositoryPort, 'findRateCardsForReview'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findRateCardsForReview({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'RATE_CARD_REVIEW_DUE',
        subject: { aggregateType: 'ContractorRateCard', subjectId: row.rateCardId },
        dueDate: row.effectiveUntil,
        payload: { vendorId: row.vendorId, daysUntilReview: row.daysUntilReview },
        escalationTier: escalationTier(-Math.max(0, row.daysUntilReview), row.daysUntilReview <= 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class ReferralFollowUpReminderJob implements ScheduledJob {
  readonly name = 'referral-follow-up-reminder';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<WellbeingSchedulerRepositoryPort, 'findReferralFollowUps'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findReferralFollowUps({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        managerAudienceWorkerIds: [row.workerId],
        reminderType: 'EAP_REFERRAL_FOLLOW_UP',
        subject: { aggregateType: 'EapReferral', subjectId: row.referralId, subjectWorkerId: row.workerId },
        dueDate: row.followUpDate,
        payload: { daysOverdue: row.daysOverdue },
        escalationTier: escalationTier(row.daysOverdue, row.daysOverdue > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class WellnessProgramEnrollmentWindowJob implements ScheduledJob {
  readonly name = 'wellness-program-enrollment-window';
  readonly cron = '0 5 * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<WellbeingSchedulerRepositoryPort, 'findWellnessProgramsToActivate'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly activator: EffectiveDatingActivator,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const result = await this.activator.activateDue({
      tenantId: ctx.tenantId,
      jobName: this.name,
      today: ctx.now,
      dueStatuses: ['DRAFT'],
      queryDueRows: ({ tenantId, today }) => this.repository.findWellnessProgramsToActivate({ tenantId, today }),
      buildCommand: (row) => ({
        commandName: 'ActivateWellnessProgram',
        aggregateType: row.aggregateType,
        aggregateId: row.id,
        expectedState: row.status,
        expectedVersion: row.aggregateVersion,
        payload: { wellnessProgramId: row.id },
        permissions: ['WELLBEING_PROGRAM_MANAGE'],
        reason: this.name,
      }),
    });
    return { itemsProcessed: result.processed, errors: result.errors };
  }
}

@Injectable()
export class ScheduledReportGenerationJob implements ScheduledJob {
  readonly name = 'scheduled-report-generation';
  readonly cron = '*/15 * * * *';

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<ReportingSchedulerRepositoryPort, 'findReportSchedulesDue'> = new HcmGovernanceSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findReportSchedulesDue({ tenantId: ctx.tenantId, now: ctx.now });
    for (const row of rows) {
      await ctx.runCommand({
        commandName: 'RunReportDefinition',
        aggregateType: 'ReportDefinition',
        aggregateId: row.reportDefinitionId,
        payload: { reportDefinitionId: row.reportDefinitionId.value, parameters: row.parameters ?? {} },
        permissions: ['REPORT_RUN'],
        reason: this.name,
      });
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.ownerWorkerIds,
        reminderType: 'SCHEDULED_REPORT_DELIVERY',
        subject: { aggregateType: 'ReportSchedule', subjectId: row.reportScheduleId },
        dueDate: row.nextRunAt,
        payload: { reportDefinitionId: row.reportDefinitionId.value, recipients: row.recipients },
        escalationTier: escalationTier(0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class PeriodicMetricSnapshotJob implements ScheduledJob {
  readonly name = 'periodic-metric-snapshot';
  readonly cron = '0 3 1 * *';
  readonly periodKey = monthPeriodKey;

  constructor(
    @Optional() @Inject(HcmGovernanceSchedulerReadRepository) private readonly repository: Pick<ReportingSchedulerRepositoryPort, 'findMetricSnapshotsDue'> = new HcmGovernanceSchedulerReadRepository(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const rows = await this.repository.findMetricSnapshotsDue({ tenantId: ctx.tenantId, now: ctx.now, periodKey: ctx.periodKey });
    for (const row of rows) {
      await ctx.runCommand({
        commandName: 'RunReportDefinition',
        aggregateType: 'ReportDefinition',
        aggregateId: row.reportDefinitionId,
        payload: { reportDefinitionId: row.reportDefinitionId.value, parameters: { snapshotPeriodKey: row.periodKey, metricDomain: row.metricDomain } },
        permissions: ['REPORT_RUN'],
        reason: this.name,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

export const HCM_SCHEDULED_JOB_PROVIDERS = [
  LeaveAccrualRunJob,
  LeaveCarryoverRunJob,
  LeaveBalanceExpiryAlertJob,
  LeaveApprovalSlaJob,
  ReturnToWorkReminderJob,
  AttendanceDailyFinalizationJob,
  TimesheetSubmissionReminderJob,
  TimesheetApprovalSlaJob,
  AttendanceAnomalyAlertJob,
  PayrollCycleOpenJob,
  PayrollCutoffReminderJob,
  PayrollReadinessCheckJob,
  PerformanceReviewCycleDueReminderJob,
  GoalCheckinCadenceJob,
  OverdueReviewEscalationJob,
  ProbationReviewDueJob,
  EngagementSurveyWindowJob,
  Feedback360NudgeJob,
  RecognitionProgramPeriodCloseJob,
  LearningAssignmentDueReminderJob,
  CertificationExpiryReminderJob,
  MandatoryTrainingDeadlineJob,
  StaleRequisitionAlertJob,
  CandidateAgingInStageJob,
  InterviewReminderJob,
  OfferExpiryReminderJob,
  PreStartReminderJob,
  OnboardingTaskDueJob,
  OnboardingCheckpointJob,
  SuccessionPlanReviewCadenceJob,
  SkillProfileRefreshNudgeJob,
  CompReviewCycleOpenJob,
  PayEquityPeriodicRecomputeJob,
  PolicyAcknowledgementReminderJob,
  MandatoryComplianceTaskDeadlineJob,
  ComplianceDocumentExpiryAlertJob,
  ProbationPeriodEndJob,
  ContractTermEndAlertJob,
  WorkAnniversaryEventJob,
  BirthdayEventJob,
  PersonalDocumentExpiryAlertJob,
  ImmigrationWorkPermitExpiryJob,
  InternationalAssignmentEndJob,
  AccessRecertificationCampaignJob,
  StaleAccessReviewJob,
  BreakGlassSessionExpiryJob,
  BiasTestCadenceDueJob,
  UseCaseReassessmentDueJob,
  KillSwitchReviewJob,
  ScheduledPolicyActivationJob,
  PolicyRevisionPublishingJob,
  CbaExpiryReminderJob,
  GrievanceSlaEscalationJob,
  CaseSlaAgingJob,
  InvestigationDeadlineJob,
  BenefitsOpenEnrollmentWindowJob,
  BenefitsOpenEnrollmentCloseJob,
  BenefitsLifeEventDeadlineReminderJob,
  SpendingAccountUseItOrLoseItJob,
  PositionVacancyAgingJob,
  ScheduledPositionActivationJob,
  ScheduledReorgActivationJob,
  PeriodicHeadcountSnapshotJob,
  SchedulePublishReminderJob,
  CoverageGapAlertJob,
  SowEndDateReminderJob,
  ContingentAssignmentExpiryJob,
  ContingentTenureThresholdJob,
  RateCardReviewDueJob,
  ReferralFollowUpReminderJob,
  WellnessProgramEnrollmentWindowJob,
  ScheduledReportGenerationJob,
  PeriodicMetricSnapshotJob,
  PersonalDataRetentionJob,
];

export function monthPeriodKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

export function yearPeriodKey(now: Date): string {
  return now.toISOString().slice(0, 4);
}

function previousLocalDateKey(now: Date, timezone: string): string {
  const parts = localDateParts(now, timezone);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function localDay(now: Date, timezone: string): number {
  return localDateParts(now, timezone).day;
}

function localDateParts(now: Date, timezone: string): { year: number; month: number; day: number } {
  // Offset-style timezones (e.g. "UTC+03:00") are not valid IANA zones and make Intl
  // throw; route them through offset math instead.
  const offsetMinutes = parseOffsetString(timezone);
  if (offsetMinutes !== undefined) {
    const adjusted = new Date(now.getTime() + offsetMinutes * 60_000);
    return {
      year: adjusted.getUTCFullYear(),
      month: adjusted.getUTCMonth() + 1,
      day: adjusted.getUTCDate(),
    };
  }
  const values = new Map(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now).map((part) => [part.type, part.value]));
  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
  };
}

function monthlyAccrualHours(policy: LeavePolicy, setup: HcmSetupConfig): number {
  const ledgerHours = policy.accrualRules?.filter((rule) => rule.active !== false)
    .map((rule) => numericOutcome(rule, ['monthlyHours', 'hoursPerMonth', 'amount']))
    .find((value) => value !== undefined);
  if (ledgerHours !== undefined) return ledgerHours;
  const ledgerDays = policy.accrualRules?.filter((rule) => rule.active !== false)
    .map((rule) => numericOutcome(rule, ['monthlyDays', 'daysPerMonth']))
    .find((value) => value !== undefined);
  if (ledgerDays !== undefined) return ledgerDays * standardDayHours(setup);
  const annualEntitlement = policy.annualEntitlement ?? 0;
  return policy.unit === 'HOURS'
    ? annualEntitlement / 12
    : (annualEntitlement * standardDayHours(setup)) / 12;
}

function numericOutcome(rule: PolicyRuleLedger, keys: string[]): number | undefined {
  for (const outcome of rule.outcomes ?? []) {
    const value = outcome.value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (isRecord(value)) {
      for (const key of keys) {
        const candidate = value[key];
        if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
      }
    }
  }
  return undefined;
}

function standardDayHours(setup: HcmSetupConfig): number {
  return (setup.attendancePolicy?.standardDailyMinutes ?? 480) / 60;
}

function findLeavePolicy(setup: HcmSetupConfig, leaveType: string): LeavePolicy | undefined {
  return setup.leavePolicies.find((policy) => policy.active && policy.code === leaveType);
}

function escalationTier(offsetDays: number, escalateToManager = false): ReminderEscalationTier {
  const prefix = offsetDays < 0 ? 'T_MINUS' : offsetDays > 0 ? 'T_PLUS' : 'T';
  const code = offsetDays === 0 ? 'T_ZERO' : `${prefix}_${Math.abs(offsetDays)}`;
  return {
    code,
    label: offsetDays === 0 ? 'Due now' : `${Math.abs(offsetDays)} day${Math.abs(offsetDays) === 1 ? '' : 's'} ${offsetDays < 0 ? 'before due' : 'overdue'}`,
    level: Math.max(0, offsetDays),
    escalateToManager,
  };
}

function uuidValue(value: unknown): Uuid {
  if (value instanceof Uuid) return value;
  return new Uuid(String(value));
}

function optionalUuid(value: unknown): Uuid | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return uuidValue(value);
}

function uuidArray(value: unknown): Uuid[] {
  if (Array.isArray(value)) return value.flatMap((item) => optionalUuid(item) ? [uuidValue(item)] : []);
  return optionalUuid(value) ? [uuidValue(value)] : [];
}

function uniqueUuidValues(values: unknown[]): Uuid[] {
  const byValue = new Map<string, Uuid>();
  for (const value of values) {
    const id = optionalUuid(value);
    if (id) byValue.set(id.value, id);
  }
  return Array.from(byValue.values());
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function dateValue(value: unknown, fallback: Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function optionalUuidArray(value: Uuid | undefined): Uuid[] {
  return value ? [value] : [];
}

function numberSetting(setup: HcmSetupConfig, key: string, fallback: number): number {
  const value = recordValue(setup.policyGovernance, key)
    ?? recordValue(setup.attendancePolicy, key)
    ?? recordValue(setup.payrollCalculationPolicy, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function recordValue(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }
  if (typeof value === 'string' && value.length > 0) {
    return [value];
  }
  const recipients = recordValue(value, 'recipients');
  if (Array.isArray(recipients)) {
    return recipients.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }
  return [];
}

function objectHasKey(value: unknown, key: string): boolean {
  return isRecord(value) && isRecord(value[key]);
}

function dateFromRecord(value: unknown, keys: string[]): Date | undefined {
  if (!isRecord(value)) return undefined;
  for (const key of keys) {
    const candidate = value[key];
    const date = candidate === undefined || candidate === null ? undefined : dateValue(candidate, new Date(Number.NaN));
    if (date && Number.isFinite(date.getTime())) return date;
  }
  return undefined;
}

function sameMonthDay(left: Date, right: Date): boolean {
  return left.getUTCMonth() === right.getUTCMonth() && left.getUTCDate() === right.getUTCDate();
}

function looksLikeBreakGlassScope(value: unknown): boolean {
  if (typeof value === 'string') return /break[-_\s]?glass|privileged/i.test(value);
  if (Array.isArray(value)) return value.some((item) => looksLikeBreakGlassScope(item));
  if (isRecord(value)) return Object.entries(value).some(([key, item]) => /break[-_\s]?glass|privileged/i.test(key) || looksLikeBreakGlassScope(item));
  return false;
}

function aiCadenceDays(riskClass: unknown): number {
  const risk = stringValue(riskClass, 'MEDIUM').toUpperCase();
  if (risk === 'HIGH' || risk === 'CRITICAL') return 30;
  if (risk === 'LOW') return 180;
  return 90;
}

function aiReassessmentDays(riskClass: unknown): number {
  const risk = stringValue(riskClass, 'MEDIUM').toUpperCase();
  if (risk === 'HIGH' || risk === 'CRITICAL') return 90;
  if (risk === 'LOW') return 365;
  return 180;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date): number {
  return Math.floor((startOfLocalDay(end).getTime() - startOfLocalDay(start).getTime()) / 86_400_000);
}

function startOfLocalDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function dbDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function endOfYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 11, 31));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
