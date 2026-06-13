import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { JobContext } from './scheduled-job.js';
import type { ReminderEmitter, ReminderEmitterInput } from './reminder-emitter.js';
import type { EffectiveDatingActivator, EffectiveDatingActivatorInput, EffectiveDatingCandidate } from './effective-dating-activator.js';
import {
  BenefitsLifeEventDeadlineReminderJob,
  BenefitsOpenEnrollmentCloseJob,
  BenefitsOpenEnrollmentWindowJob,
  ContingentAssignmentExpiryJob,
  ContingentTenureThresholdJob,
  CoverageGapAlertJob,
  PeriodicHeadcountSnapshotJob,
  PeriodicMetricSnapshotJob,
  PositionVacancyAgingJob,
  RateCardReviewDueJob,
  ReferralFollowUpReminderJob,
  ScheduledPositionActivationJob,
  ScheduledReorgActivationJob,
  ScheduledReportGenerationJob,
  SchedulePublishReminderJob,
  SowEndDateReminderJob,
  SpendingAccountUseItOrLoseItJob,
  WellnessProgramEnrollmentWindowJob,
} from './hcm-scheduled-jobs.js';

const tenantId = new Uuid('00000000-0000-4000-8000-000000030001');
const workerId = new Uuid('00000000-0000-4000-8000-000000030101');
const managerId = new Uuid('00000000-0000-4000-8000-000000030201');
const adminId = new Uuid('00000000-0000-4000-8000-000000030301');
const recordId = new Uuid('00000000-0000-4000-8000-000000030401');

function makeContext(now = new Date('2026-06-14T08:00:00.000Z')) {
  const commands: Array<Parameters<JobContext['runCommand']>[0]> = [];
  const ctx: JobContext = {
    tenantId,
    timezone: 'Africa/Cairo',
    periodKey: '2026-06',
    now,
    actor: {
      actorId: new Uuid('00000000-0000-4000-8000-000000039999'),
      actorType: 'SERVICE_ACCOUNT',
      roles: ['SYSTEM'],
      permissions: ['SCHEDULER_RUN'],
    },
    jobName: 'test-job',
    runCommand: vi.fn(async (input) => {
      commands.push(input);
      return { success: true, data: { reportExecutionId: recordId.value } };
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
  return {
    specs,
    activator: {
      activateDue: vi.fn(async (input: EffectiveDatingActivatorInput<EffectiveDatingCandidate>) => {
        const rows = await input.queryDueRows({ tenantId: input.tenantId, today: input.today });
        for (const row of rows) specs.push(input.buildCommand(row));
        return { processed: rows.length, skipped: 0, failed: 0, errors: [] };
      }),
    } as unknown as EffectiveDatingActivator,
  };
}

describe('workforce, benefits, reporting scheduled jobs', () => {
  it('open-enrollment-window activates due benefits programs using effective dating', async () => {
    const { ctx } = makeContext();
    const { activator, specs } = effectiveActivator();
    const job = new BenefitsOpenEnrollmentWindowJob({
      findBenefitsProgramsToOpen: vi.fn(async () => [{ id: recordId, aggregateType: 'BenefitsProgram', status: 'DRAFT', effectiveFrom: ctx.now, aggregateVersion: 1 }]),
    }, activator);

    await job.runForTenant(ctx);
    expect(specs[0]).toMatchObject({ commandName: 'ActivateBenefitsProgram', aggregateType: 'BenefitsProgram', aggregateId: recordId });
  });

  it('open-enrollment-window close closes ended benefits programs using effective dating', async () => {
    const { ctx } = makeContext();
    const { activator, specs } = effectiveActivator();
    const job = new BenefitsOpenEnrollmentCloseJob({
      findBenefitsProgramsToClose: vi.fn(async () => [{ id: recordId, aggregateType: 'BenefitsProgram', status: 'ACTIVE', effectiveFrom: ctx.now, aggregateVersion: 2 }]),
    }, activator);

    await job.runForTenant(ctx);
    expect(specs[0]).toMatchObject({ commandName: 'CloseBenefitsProgram', aggregateType: 'BenefitsProgram', aggregateId: recordId });
  });

  it('life-event-deadline-reminder reminds workers and managers before processing deadline', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new BenefitsLifeEventDeadlineReminderJob({
      findLifeEventDeadlines: vi.fn(async () => [{ lifeEventId: recordId, workerId, managerWorkerId: managerId, eventType: 'BIRTH', dueDate: ctx.now, daysOverdue: 0 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'BENEFITS_LIFE_EVENT_DEADLINE', audienceWorkerIds: [workerId], managerAudienceWorkerIds: [managerId] });
  });

  it('spending-account-use-it-or-lose-it sends T-60/T-30 balance reminders', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new SpendingAccountUseItOrLoseItJob({
      findSpendingAccountsUseItOrLoseIt: vi.fn(async () => [{ spendingAccountId: recordId, workerId, managerWorkerId: managerId, accountType: 'FSA', availableAmount: 700, currency: 'USD', planYearEnd: ctx.now, daysUntilExpiry: 60 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'SPENDING_ACCOUNT_USE_IT_OR_LOSE_IT', escalationTier: { code: 'T_MINUS_60' } });
  });

  it('position-vacancy-aging alerts owners for stale vacancies', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new PositionVacancyAgingJob({
      findAgingVacantPositions: vi.fn(async () => [{ positionId: recordId, ownerWorkerIds: [adminId], title: 'RN', vacancyDate: new Date('2026-05-01T00:00:00.000Z'), daysVacant: 44 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'POSITION_VACANCY_AGING', payload: { daysVacant: 44 } });
  });

  it('scheduled position activation activates draft positions by effective date', async () => {
    const { ctx } = makeContext();
    const { activator, specs } = effectiveActivator();
    const job = new ScheduledPositionActivationJob({
      findPositionsToActivate: vi.fn(async () => [{ id: recordId, aggregateType: 'Position', status: 'DRAFT', effectiveFrom: ctx.now, aggregateVersion: 1 }]),
    }, activator);

    await job.runForTenant(ctx);
    expect(specs[0]).toMatchObject({ commandName: 'ActivatePosition', aggregateType: 'Position', aggregateId: recordId });
  });

  it('scheduled reorg activation applies due org unit restructure commands', async () => {
    const { ctx } = makeContext();
    const { activator, specs } = effectiveActivator();
    const parentId = new Uuid('00000000-0000-4000-8000-000000030402');
    const job = new ScheduledReorgActivationJob({
      findOrgUnitsToRestructure: vi.fn(async () => [{ id: recordId, aggregateType: 'OrgUnit', status: 'SCHEDULED', effectiveFrom: ctx.now, aggregateVersion: 3, payload: { parentId: parentId.value } }]),
    }, activator);

    await job.runForTenant(ctx);
    expect(specs[0]).toMatchObject({ commandName: 'RestructureOrgUnit', aggregateType: 'OrgUnit', aggregateId: recordId, payload: { orgUnitId: recordId.value, parentId: parentId.value } });
  });

  it('periodic-headcount-snapshot dispatches append-only report snapshot once per period', async () => {
    const { ctx, commands } = makeContext();
    const job = new PeriodicHeadcountSnapshotJob({
      findHeadcountSnapshotsDue: vi.fn(async () => [{ reportDefinitionId: recordId, snapshotType: 'HEADCOUNT', periodKey: ctx.periodKey, ownerWorkerIds: [adminId] }]),
    });

    await job.runForTenant(ctx);
    expect(job.periodKey?.(ctx.now, ctx.timezone)).toBe('2026-06');
    expect(commands[0]).toMatchObject({ commandName: 'RunReportDefinition', aggregateType: 'ReportDefinition', aggregateId: recordId, payload: { reportDefinitionId: recordId.value, parameters: { snapshotPeriodKey: ctx.periodKey, snapshotType: 'HEADCOUNT' } } });
  });

  it('schedule-publish-reminder reminds managers to publish draft schedules', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new SchedulePublishReminderJob({
      findSchedulesNeedingPublish: vi.fn(async () => [{ shiftScheduleId: recordId, ownerWorkerIds: [managerId], shiftDate: ctx.now, daysUntilShift: 3 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'SCHEDULE_PUBLISH_REMINDER', audienceWorkerIds: [managerId] });
  });

  it('coverage-gap-alert notifies open coverage gaps through command bus', async () => {
    const { ctx, commands } = makeContext();
    const job = new CoverageGapAlertJob({
      findCoverageGapsForAlert: vi.fn(async () => [{ coverageGapId: recordId, departmentId: new Uuid('00000000-0000-4000-8000-000000030403'), shiftDate: ctx.now, severity: 'CRITICAL' }]),
    });

    await job.runForTenant(ctx);
    expect(commands[0]).toMatchObject({ commandName: 'NotifyCoverageGap', aggregateType: 'CoverageGap', aggregateId: recordId });
  });

  it('sow-end-date-reminder alerts contingent workforce owners', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new SowEndDateReminderJob({
      findSowEndDates: vi.fn(async () => [{ sowEngagementId: recordId, ownerWorkerIds: [adminId], projectName: 'ERP rollout', endDate: ctx.now, daysUntilEnd: 30 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'SOW_END_DATE_REMINDER', escalationTier: { code: 'T_MINUS_30' } });
  });

  it('assignment-expiry alerts worker and owner before contingent assignment end', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new ContingentAssignmentExpiryJob({
      findContingentAssignmentsExpiring: vi.fn(async () => [{ assignmentId: recordId, workerId, ownerWorkerIds: [adminId], endDate: ctx.now, daysUntilEnd: 14 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'CONTINGENT_ASSIGNMENT_EXPIRY', audienceWorkerIds: [workerId], managerAudienceWorkerIds: [adminId] });
  });

  it('co-employment tenure threshold alerts owners when contingent tenure is high', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new ContingentTenureThresholdJob({
      findContingentTenureThresholds: vi.fn(async () => [{ assignmentId: recordId, workerId, ownerWorkerIds: [adminId], tenureDays: 365, thresholdDays: 330 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'CONTINGENT_TENURE_THRESHOLD', payload: { tenureDays: 365, thresholdDays: 330 } });
  });

  it('rate-card-review-due reminds owners before rate card expiry', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new RateCardReviewDueJob({
      findRateCardsForReview: vi.fn(async () => [{ rateCardId: recordId, ownerWorkerIds: [adminId], vendorId: 'vendor-1', effectiveUntil: ctx.now, daysUntilReview: 30 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'RATE_CARD_REVIEW_DUE', escalationTier: { code: 'T_MINUS_30' } });
  });

  it('referral-follow-up-reminder reminds EAP owners to follow up', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new ReferralFollowUpReminderJob({
      findReferralFollowUps: vi.fn(async () => [{ referralId: recordId, workerId, ownerWorkerIds: [adminId], followUpDate: ctx.now, daysOverdue: 0 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'EAP_REFERRAL_FOLLOW_UP', audienceWorkerIds: [adminId] });
  });

  it('wellness-program-enrollment-window activates due wellness programs', async () => {
    const { ctx } = makeContext();
    const { activator, specs } = effectiveActivator();
    const job = new WellnessProgramEnrollmentWindowJob({
      findWellnessProgramsToActivate: vi.fn(async () => [{ id: recordId, aggregateType: 'WellnessProgram', status: 'DRAFT', effectiveFrom: ctx.now, aggregateVersion: 1 }]),
    }, activator);

    await job.runForTenant(ctx);
    expect(specs[0]).toMatchObject({ commandName: 'ActivateWellnessProgram', aggregateType: 'WellnessProgram', aggregateId: recordId });
  });

  it('scheduled-report-generation dispatches report commands and delivery reminders', async () => {
    const { ctx, commands } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new ScheduledReportGenerationJob({
      findReportSchedulesDue: vi.fn(async () => [{ reportScheduleId: new Uuid('00000000-0000-4000-8000-000000030404'), reportDefinitionId: recordId, ownerWorkerIds: [adminId], recipients: ['hr@example.com'], nextRunAt: ctx.now, parameters: { departmentId: 'clinical' } }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(commands[0]).toMatchObject({ commandName: 'RunReportDefinition', aggregateType: 'ReportDefinition', aggregateId: recordId });
    expect(emitted[0]).toMatchObject({ reminderType: 'SCHEDULED_REPORT_DELIVERY', audienceWorkerIds: [adminId] });
  });

  it('periodic-metric-snapshot dispatches idempotent metric snapshot report runs', async () => {
    const { ctx, commands } = makeContext();
    const job = new PeriodicMetricSnapshotJob({
      findMetricSnapshotsDue: vi.fn(async () => [{ reportDefinitionId: recordId, metricDomain: 'DEI', periodKey: ctx.periodKey, ownerWorkerIds: [adminId] }]),
    });

    await job.runForTenant(ctx);
    expect(job.periodKey?.(ctx.now, ctx.timezone)).toBe('2026-06');
    expect(commands[0]).toMatchObject({ commandName: 'RunReportDefinition', payload: { reportDefinitionId: recordId.value, parameters: { snapshotPeriodKey: ctx.periodKey, metricDomain: 'DEI' } } });
  });

  it('periodic-metric-snapshot is a no-op when repository detects existing period snapshot', async () => {
    const { ctx, commands } = makeContext();
    const job = new PeriodicMetricSnapshotJob({
      findMetricSnapshotsDue: vi.fn(async () => []),
    });

    await expect(job.runForTenant(ctx)).resolves.toEqual({ itemsProcessed: 0 });
    expect(commands).toHaveLength(0);
  });
});
