import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { JobContext } from './scheduled-job.js';
import type { ReminderEmitter, ReminderEmitterInput } from './reminder-emitter.js';
import type { EffectiveDatingActivator, EffectiveDatingActivatorInput, EffectiveDatingCandidate } from './effective-dating-activator.js';
import {
  CandidateAgingInStageJob,
  CertificationExpiryReminderJob,
  CompReviewCycleOpenJob,
  EngagementSurveyWindowJob,
  Feedback360NudgeJob,
  GoalCheckinCadenceJob,
  InterviewReminderJob,
  LearningAssignmentDueReminderJob,
  MandatoryTrainingDeadlineJob,
  OnboardingCheckpointJob,
  OnboardingTaskDueJob,
  OfferExpiryReminderJob,
  OverdueReviewEscalationJob,
  PayEquityPeriodicRecomputeJob,
  PerformanceReviewCycleDueReminderJob,
  PreStartReminderJob,
  ProbationReviewDueJob,
  RecognitionProgramPeriodCloseJob,
  SkillProfileRefreshNudgeJob,
  StaleRequisitionAlertJob,
  SuccessionPlanReviewCadenceJob,
} from './hcm-scheduled-jobs.js';

const tenantId = new Uuid('00000000-0000-4000-8000-000000010001');
const workerId = new Uuid('00000000-0000-4000-8000-000000010101');
const managerId = new Uuid('00000000-0000-4000-8000-000000010201');
const adminId = new Uuid('00000000-0000-4000-8000-000000010301');
const recordId = new Uuid('00000000-0000-4000-8000-000000010401');

function makeContext(now = new Date('2026-06-14T08:00:00.000Z')) {
  const commands: Array<Parameters<JobContext['runCommand']>[0]> = [];
  const ctx: JobContext = {
    tenantId,
    timezone: 'Africa/Cairo',
    periodKey: 'test-period',
    now,
    actor: {
      actorId: new Uuid('00000000-0000-4000-8000-000000019999'),
      actorType: 'SERVICE_ACCOUNT',
      roles: ['SYSTEM'],
      permissions: ['SCHEDULER_RUN'],
    },
    jobName: 'test-job',
    runCommand: vi.fn(async (input) => {
      commands.push(input);
      return { success: true };
    }),
  };
  return { ctx, commands };
}

function reminderEmitter() {
  const emitted: ReminderEmitterInput[] = [];
  return {
    emitted,
    emitter: {
      emit: vi.fn(async (input: ReminderEmitterInput) => {
        emitted.push(input);
        return { status: 'PUBLISHED' as const, dispatchKey: `${input.reminderType}:${input.subject.subjectId.value}` };
      }),
    } as unknown as ReminderEmitter,
  };
}

function effectiveActivator() {
  const specs: Array<ReturnType<EffectiveDatingActivatorInput<EffectiveDatingCandidate>['buildCommand']>> = [];
  const inputs: Array<EffectiveDatingActivatorInput<EffectiveDatingCandidate>> = [];
  return {
    specs,
    inputs,
    activator: {
      activateDue: vi.fn(async (input: EffectiveDatingActivatorInput<EffectiveDatingCandidate>) => {
        inputs.push(input);
        const rows = await input.queryDueRows({ tenantId: input.tenantId, today: input.today });
        for (const row of rows) specs.push(input.buildCommand(row));
        return { processed: rows.length, skipped: 0, failed: 0, errors: [] };
      }),
    } as unknown as EffectiveDatingActivator,
  };
}

describe('domain scheduled jobs', () => {
  it('review-cycle-due-reminder reminds cycle participants before cycle end', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new PerformanceReviewCycleDueReminderJob({
      findReviewCyclesDueForReminder: vi.fn(async () => [{
        cycleId: recordId,
        cycleName: 'Midyear review',
        dueDate: new Date('2026-06-20T00:00:00.000Z'),
        audienceWorkerIds: [workerId, managerId],
      }]),
    }, emitter);

    await expect(job.runForTenant(ctx)).resolves.toMatchObject({ itemsProcessed: 1 });
    expect(emitted[0]).toMatchObject({ reminderType: 'PERFORMANCE_REVIEW_CYCLE_DUE', audienceWorkerIds: [workerId, managerId] });
  });

  it('goal-checkin-cadence reminds goal owners to update active goals', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new GoalCheckinCadenceJob({
      findGoalCheckinsDue: vi.fn(async () => [{ goalId: recordId, workerId, managerWorkerId: managerId, dueDate: ctx.now, title: 'Grow sales' }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'GOAL_CHECKIN_DUE', audienceWorkerIds: [workerId], managerAudienceWorkerIds: [managerId] });
  });

  it('overdue-review-escalation escalates reviews past due date', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new OverdueReviewEscalationJob({
      findOverduePerformanceReviews: vi.fn(async () => [{
        reviewId: recordId,
        workerId,
        reviewerWorkerId: managerId,
        reviewerManagerWorkerId: adminId,
        dueDate: new Date('2026-06-10T00:00:00.000Z'),
        daysOverdue: 4,
      }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'PERFORMANCE_REVIEW_OVERDUE', escalationTier: { code: 'T_PLUS_4', escalateToManager: true } });
  });

  it('probation-review-due reminds managers from hr-core probation dates', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new ProbationReviewDueJob({
      findProbationReviewsDue: vi.fn(async () => [{ relationshipId: recordId, workerId, managerWorkerId: managerId, probationEndDate: ctx.now }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'PROBATION_REVIEW_DUE', audienceWorkerIds: [managerId] });
  });

  it('survey-window-activate-close uses effective dating for survey activation and close', async () => {
    const { ctx } = makeContext();
    const { activator, specs, inputs } = effectiveActivator();
    const job = new EngagementSurveyWindowJob({
      findSurveysToActivate: vi.fn(async () => [{ id: recordId, aggregateType: 'EngagementSurvey', status: 'PUBLISHED', effectiveFrom: ctx.now, aggregateVersion: 2 }]),
      findSurveysToClose: vi.fn(async () => [{ id: new Uuid('00000000-0000-4000-8000-000000010402'), aggregateType: 'EngagementSurvey', status: 'ACTIVE', effectiveFrom: ctx.now, aggregateVersion: 3 }]),
    }, activator);

    await expect(job.runForTenant(ctx)).resolves.toMatchObject({ itemsProcessed: 2 });
    expect(inputs).toHaveLength(2);
    expect(specs.map((spec) => spec.commandName)).toEqual(['ActivateEngagementSurvey', 'CloseEngagementSurvey']);
  });

  it('feedback-360-nudge reminds outstanding raters and escalates near close', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new Feedback360NudgeJob({
      findFeedback360RaterNudges: vi.fn(async () => [{
        responseId: recordId,
        cycleId: new Uuid('00000000-0000-4000-8000-000000010403'),
        revieweeId: workerId,
        raterWorkerId: managerId,
        managerWorkerId: adminId,
        dueDate: new Date('2026-06-15T00:00:00.000Z'),
        daysUntilClose: 1,
      }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'FEEDBACK_360_RATER_NUDGE', audienceWorkerIds: [managerId], managerAudienceWorkerIds: [adminId] });
  });

  it('recognition-program-period-close closes due programs through effective dating', async () => {
    const { ctx } = makeContext();
    const { activator, specs } = effectiveActivator();
    const job = new RecognitionProgramPeriodCloseJob({
      findRecognitionProgramsToClose: vi.fn(async () => [{ id: recordId, aggregateType: 'RecognitionProgram', status: 'ACTIVE', effectiveFrom: ctx.now }]),
    }, activator);

    await job.runForTenant(ctx);
    expect(specs[0]).toMatchObject({ commandName: 'CloseRecognitionProgram', aggregateType: 'RecognitionProgram', aggregateId: recordId });
  });

  it('assignment-due-reminder reminds learners and escalates overdue assignments', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new LearningAssignmentDueReminderJob({
      findLearningAssignmentsDue: vi.fn(async () => [{ assignmentId: recordId, workerId, managerWorkerId: managerId, courseTitle: 'Security', dueDate: ctx.now, daysOverdue: 2 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'LEARNING_ASSIGNMENT_DUE', escalationTier: { code: 'T_PLUS_2', escalateToManager: true } });
  });

  it('certification-expiry-reminder emits T-60/T-30/T-7 reminders', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new CertificationExpiryReminderJob({
      findCertificationsExpiring: vi.fn(async () => [{ certificationId: recordId, workerId, managerWorkerId: managerId, certificationName: 'BLS', expiryDate: new Date('2026-06-21T00:00:00.000Z'), daysUntilExpiry: 7 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'CERTIFICATION_EXPIRY', escalationTier: { code: 'T_MINUS_7' } });
  });

  it('mandatory-training-deadline reminds workers before mandatory deadlines', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new MandatoryTrainingDeadlineJob({
      findMandatoryTrainingDeadlines: vi.fn(async () => [{ assignmentId: recordId, workerId, courseTitle: 'Compliance', dueDate: ctx.now }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'MANDATORY_TRAINING_DEADLINE', audienceWorkerIds: [workerId] });
  });

  it('stale-requisition-alert alerts recruiters for old open requisitions', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new StaleRequisitionAlertJob({
      findStaleRequisitions: vi.fn(async () => [{ requisitionId: recordId, recruiterWorkerId: adminId, hiringManagerWorkerId: managerId, title: 'Nurse', daysOpen: 45, dueDate: ctx.now }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'STALE_REQUISITION_ALERT', audienceWorkerIds: [adminId], managerAudienceWorkerIds: [managerId] });
  });

  it('candidate-aging-in-stage alerts recruiters when candidates stall', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new CandidateAgingInStageJob({
      findCandidatesAgingInStage: vi.fn(async () => [{ candidateId: recordId, recruiterWorkerId: adminId, requisitionId: new Uuid('00000000-0000-4000-8000-000000010404'), stage: 'INTERVIEWING', daysInStage: 12, dueDate: ctx.now }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'CANDIDATE_AGING_IN_STAGE', audienceWorkerIds: [adminId] });
  });

  it('interview-reminder reminds interviewers and candidate owners', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new InterviewReminderJob({
      findInterviewsDueForReminder: vi.fn(async () => [{ interviewId: recordId, candidateId: new Uuid('00000000-0000-4000-8000-000000010405'), interviewerWorkerIds: [workerId, managerId], scheduledAt: ctx.now }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'INTERVIEW_REMINDER', audienceWorkerIds: [workerId, managerId] });
  });

  it('offer-expiry-reminder reminds offer owners before offer expiry', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new OfferExpiryReminderJob({
      findOffersExpiring: vi.fn(async () => [{ offerId: recordId, candidateId: new Uuid('00000000-0000-4000-8000-000000010406'), ownerWorkerIds: [adminId], expiryDate: ctx.now, daysUntilExpiry: 1 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'OFFER_EXPIRY_REMINDER', audienceWorkerIds: [adminId] });
  });

  it('pre-start-reminders alerts new hires and onboarding owners before start date', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new PreStartReminderJob({
      findPreStartReminders: vi.fn(async () => [{ onboardingPlanId: recordId, workerId, managerWorkerId: managerId, startDate: ctx.now }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'ONBOARDING_PRE_START', audienceWorkerIds: [workerId], managerAudienceWorkerIds: [managerId] });
  });

  it('onboarding-task-due escalates due and stalled onboarding tasks', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new OnboardingTaskDueJob({
      findOnboardingTasksDue: vi.fn(async () => [{ taskId: recordId, planId: new Uuid('00000000-0000-4000-8000-000000010407'), assigneeWorkerId: workerId, managerWorkerId: managerId, dueDate: ctx.now, daysOverdue: 3, stalled: true }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'ONBOARDING_TASK_DUE', escalationTier: { code: 'T_PLUS_3', escalateToManager: true } });
  });

  it('day-30-60-90-checkpoints reminds managers for onboarding checkpoints', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new OnboardingCheckpointJob({
      findOnboardingCheckpointsDue: vi.fn(async () => [{ onboardingPlanId: recordId, workerId, managerWorkerId: managerId, milestoneDay: 60, dueDate: ctx.now }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'ONBOARDING_CHECKPOINT_DUE', audienceWorkerIds: [managerId] });
  });

  it('succession-plan-review-cadence reminds owners for succession plan review', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new SuccessionPlanReviewCadenceJob({
      findSuccessionPlanReviewsDue: vi.fn(async () => [{ successionPlanId: recordId, ownerWorkerIds: [adminId], positionId: new Uuid('00000000-0000-4000-8000-000000010408'), dueDate: ctx.now }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'SUCCESSION_PLAN_REVIEW_DUE', audienceWorkerIds: [adminId] });
  });

  it('skill-profile-refresh-nudge reminds workers to refresh skills', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new SkillProfileRefreshNudgeJob({
      findSkillProfilesForRefresh: vi.fn(async () => [{ skillProfileId: recordId, workerId, managerWorkerId: managerId, dueDate: ctx.now, daysSinceUpdate: 180 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'SKILL_PROFILE_REFRESH', audienceWorkerIds: [workerId] });
  });

  it('comp-review-cycle-open creates due compensation review cycles through existing bonus cycle command', async () => {
    const { ctx, commands } = makeContext();
    const job = new CompReviewCycleOpenJob({
      findCompReviewCyclesToOpen: vi.fn(async () => [{ cycleName: '2026 annual compensation', cycleYear: 2026, eligibilityDate: ctx.now, paymentDate: new Date('2026-07-01T00:00:00.000Z'), currency: 'EGP' }]),
    });

    await job.runForTenant(ctx);
    expect(commands[0]).toMatchObject({ commandName: 'CreateBonusCycle', aggregateType: 'BonusCycle', payload: { cycleName: '2026 annual compensation' } });
  });

  it('pay-equity-periodic-recompute reminds compensation admins when no recompute command is present', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new PayEquityPeriodicRecomputeJob({
      findPayEquityReviewsDue: vi.fn(async () => [{ reviewId: recordId, ownerWorkerIds: [adminId], reviewPeriod: '2026-Q2', dueDate: ctx.now }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'PAY_EQUITY_RECOMPUTE_DUE', audienceWorkerIds: [adminId] });
  });
});
