import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { JobContext } from './scheduled-job.js';
import type { ReminderEmitter, ReminderEmitterInput } from './reminder-emitter.js';
import type { EffectiveDatingActivator, EffectiveDatingActivatorInput, EffectiveDatingCandidate } from './effective-dating-activator.js';
import {
  AccessRecertificationCampaignJob,
  BiasTestCadenceDueJob,
  BirthdayEventJob,
  BreakGlassSessionExpiryJob,
  CbaExpiryReminderJob,
  CaseSlaAgingJob,
  ComplianceDocumentExpiryAlertJob,
  ContractTermEndAlertJob,
  GrievanceSlaEscalationJob,
  ImmigrationWorkPermitExpiryJob,
  InternationalAssignmentEndJob,
  InvestigationDeadlineJob,
  KillSwitchReviewJob,
  MandatoryComplianceTaskDeadlineJob,
  PersonalDocumentExpiryAlertJob,
  PolicyAcknowledgementReminderJob,
  PolicyRevisionPublishingJob,
  ProbationPeriodEndJob,
  ScheduledPolicyActivationJob,
  StaleAccessReviewJob,
  UseCaseReassessmentDueJob,
  WorkAnniversaryEventJob,
} from './hcm-scheduled-jobs.js';

const tenantId = new Uuid('00000000-0000-4000-8000-000000020001');
const workerId = new Uuid('00000000-0000-4000-8000-000000020101');
const managerId = new Uuid('00000000-0000-4000-8000-000000020201');
const adminId = new Uuid('00000000-0000-4000-8000-000000020301');
const recordId = new Uuid('00000000-0000-4000-8000-000000020401');

function makeContext(now = new Date('2026-06-14T08:00:00.000Z')) {
  const commands: Array<Parameters<JobContext['runCommand']>[0]> = [];
  const ctx: JobContext = {
    tenantId,
    timezone: 'Africa/Cairo',
    periodKey: 'test-period',
    now,
    actor: {
      actorId: new Uuid('00000000-0000-4000-8000-000000029999'),
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

describe('governance and lifecycle scheduled jobs', () => {
  it('policy-acknowledgement-reminder escalates overdue acknowledgements', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new PolicyAcknowledgementReminderJob({
      findPolicyAcknowledgementReminders: vi.fn(async () => [{
        acknowledgementId: recordId,
        policyDocumentId: new Uuid('00000000-0000-4000-8000-000000020402'),
        workerId,
        managerWorkerId: managerId,
        dueDate: new Date('2026-06-10T00:00:00.000Z'),
        daysOverdue: 4,
      }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'POLICY_ACKNOWLEDGEMENT_DUE', escalationTier: { code: 'T_PLUS_4', escalateToManager: true } });
  });

  it('mandatory-compliance-task-deadline reminds assigned compliance owners', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new MandatoryComplianceTaskDeadlineJob({
      findMandatoryComplianceTasksDue: vi.fn(async () => [{
        taskId: recordId,
        ownerWorkerId: adminId,
        dueDate: ctx.now,
        taskType: 'STATUTORY_REPORT',
        daysOverdue: 0,
      }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'MANDATORY_COMPLIANCE_TASK_DEADLINE', audienceWorkerIds: [adminId] });
  });

  it('document-expiry-alert emits worker and manager alerts for compliance documents', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new ComplianceDocumentExpiryAlertJob({
      findComplianceDocumentsExpiring: vi.fn(async () => [{
        documentId: recordId,
        workerId,
        managerWorkerId: managerId,
        documentType: 'LICENSE',
        expiryDate: new Date('2026-06-21T00:00:00.000Z'),
        daysUntilExpiry: 7,
      }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'COMPLIANCE_DOCUMENT_EXPIRY', escalationTier: { code: 'T_MINUS_7' } });
  });

  it('probation-period-end dispatches probation completion through command bus', async () => {
    const { ctx, commands } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new ProbationPeriodEndJob({
      findProbationPeriodsEnding: vi.fn(async () => [{
        relationshipId: recordId,
        workerId,
        managerWorkerId: managerId,
        probationEndDate: ctx.now,
        canAutoComplete: true,
      }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(commands[0]).toMatchObject({ commandName: 'CompleteProbationEmploymentRelationship', aggregateType: 'EmploymentRelationship', aggregateId: recordId });
    expect(emitted).toHaveLength(0);
  });

  it('probation-period-end emits a manager reminder when auto completion is unsafe', async () => {
    const { ctx, commands } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new ProbationPeriodEndJob({
      findProbationPeriodsEnding: vi.fn(async () => [{
        relationshipId: recordId,
        workerId,
        managerWorkerId: managerId,
        probationEndDate: ctx.now,
        canAutoComplete: false,
      }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(commands).toHaveLength(0);
    expect(emitted[0]).toMatchObject({ reminderType: 'PROBATION_PERIOD_END', audienceWorkerIds: [managerId] });
  });

  it('contract-term-end-alert reminds workers and managers before contract end', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new ContractTermEndAlertJob({
      findContractTermsEnding: vi.fn(async () => [{ contractId: recordId, workerId, managerWorkerId: managerId, endDate: ctx.now, daysUntilEnd: 30 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'CONTRACT_TERM_END', audienceWorkerIds: [workerId], managerAudienceWorkerIds: [managerId] });
  });

  it('work-anniversary emits employee milestone events', async () => {
    const { ctx } = makeContext(new Date('2026-06-14T08:00:00.000Z'));
    const { emitter, emitted } = reminderEmitter();
    const job = new WorkAnniversaryEventJob({
      findWorkAnniversaries: vi.fn(async () => [{ workerId, managerWorkerId: managerId, anniversaryDate: ctx.now, yearsOfService: 5 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'WORK_ANNIVERSARY', payload: { yearsOfService: 5 } });
  });

  it('birthday emits employee birthday events', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new BirthdayEventJob({
      findBirthdays: vi.fn(async () => [{ workerId, managerWorkerId: managerId, birthdayDate: ctx.now }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'EMPLOYEE_BIRTHDAY', audienceWorkerIds: [workerId] });
  });

  it('personal-document-expiry alerts ID and visa owners', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new PersonalDocumentExpiryAlertJob({
      findPersonalDocumentsExpiring: vi.fn(async () => [{ documentId: recordId, workerId, managerWorkerId: managerId, documentType: 'VISA', expiryDate: ctx.now, daysUntilExpiry: 30 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'PERSONAL_DOCUMENT_EXPIRY', escalationTier: { code: 'T_MINUS_30' } });
  });

  it('immigration-work-permit-expiry emits T-90/T-60/T-30 alerts', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new ImmigrationWorkPermitExpiryJob({
      findWorkPermitsExpiring: vi.fn(async () => [{ workAuthorizationCaseId: recordId, workerId, managerWorkerId: managerId, authorizationType: 'WORK_PERMIT', expiryDate: ctx.now, daysUntilExpiry: 60 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'IMMIGRATION_WORK_PERMIT_EXPIRY', escalationTier: { code: 'T_MINUS_60' } });
  });

  it('international-assignment-end alerts assignment owners near assignment end', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new InternationalAssignmentEndJob({
      findInternationalAssignmentsEnding: vi.fn(async () => [{ assignmentId: recordId, workerId, managerWorkerId: managerId, endDate: ctx.now, daysUntilEnd: 14 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'INTERNATIONAL_ASSIGNMENT_END', audienceWorkerIds: [workerId] });
  });

  it('access-recertification-campaign opens due access campaigns through command bus', async () => {
    const { ctx, commands } = makeContext();
    const job = new AccessRecertificationCampaignJob({
      findAccessRecertificationCampaignsDue: vi.fn(async () => [{ campaignName: 'Quarterly review', scope: { roles: ['HR_ADMIN'] }, dueAt: ctx.now }]),
    });

    await job.runForTenant(ctx);
    expect(commands[0]).toMatchObject({ commandName: 'CreateAccessReviewCampaign', aggregateType: 'AccessReviewCampaign' });
  });

  it('stale-access-review escalates pending review campaigns', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new StaleAccessReviewJob({
      findStaleAccessReviews: vi.fn(async () => [{ campaignId: recordId, ownerWorkerIds: [adminId], dueDate: new Date('2026-06-10T00:00:00.000Z'), daysOverdue: 4, pendingItemCount: 12 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'STALE_ACCESS_REVIEW', escalationTier: { code: 'T_PLUS_4', escalateToManager: true } });
  });

  it('break-glass-session-expiry escalates expiring privileged access sessions', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new BreakGlassSessionExpiryJob({
      findBreakGlassSessionsExpiring: vi.fn(async () => [{ sessionId: recordId, ownerWorkerId: adminId, expiresAt: ctx.now, minutesUntilExpiry: 30 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'BREAK_GLASS_SESSION_EXPIRY', audienceWorkerIds: [adminId] });
  });

  it('bias-test-cadence-due reminds AI governance owners by risk cadence', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new BiasTestCadenceDueJob({
      findBiasTestsDue: vi.fn(async () => [{ useCaseId: recordId, ownerWorkerIds: [adminId], useCaseName: 'Screening AI', riskClass: 'HIGH', dueDate: ctx.now }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'AI_BIAS_TEST_CADENCE_DUE', payload: { riskClass: 'HIGH' } });
  });

  it('use-case-reassessment-due reminds owners to reassess AI use cases', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new UseCaseReassessmentDueJob({
      findUseCaseReassessmentsDue: vi.fn(async () => [{ useCaseId: recordId, ownerWorkerIds: [adminId], useCaseName: 'Screening AI', riskClass: 'MEDIUM', dueDate: ctx.now }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'AI_USE_CASE_REASSESSMENT_DUE', audienceWorkerIds: [adminId] });
  });

  it('kill-switch-review reminds governance owners to review active kill switches', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new KillSwitchReviewJob({
      findKillSwitchReviewsDue: vi.fn(async () => [{ killSwitchId: recordId, useCaseId: new Uuid('00000000-0000-4000-8000-000000020404'), ownerWorkerIds: [adminId], dueDate: ctx.now, daysOpen: 7 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'AI_KILL_SWITCH_REVIEW', payload: { daysOpen: 7 } });
  });

  it('scheduled-policy-activation activates due policy revisions using effective dating', async () => {
    const { ctx } = makeContext();
    const { activator, specs } = effectiveActivator();
    const job = new ScheduledPolicyActivationJob({
      findPoliciesToApply: vi.fn(async () => [{ id: recordId, aggregateType: 'AdminPolicyRevision', status: 'PUBLISHED', effectiveFrom: ctx.now, aggregateVersion: 2 }]),
    }, activator);

    await job.runForTenant(ctx);
    expect(specs[0]).toMatchObject({ commandName: 'ApplyPolicyRevision', aggregateType: 'AdminPolicyRevision', aggregateId: recordId });
  });

  it('revision-publishing publishes approved policy revisions using effective dating', async () => {
    const { ctx } = makeContext();
    const { activator, specs } = effectiveActivator();
    const job = new PolicyRevisionPublishingJob({
      findPolicyRevisionsToPublish: vi.fn(async () => [{ id: recordId, aggregateType: 'AdminPolicyRevision', status: 'APPROVED', effectiveFrom: ctx.now, aggregateVersion: 2 }]),
    }, activator);

    await job.runForTenant(ctx);
    expect(specs[0]).toMatchObject({ commandName: 'PublishPolicyRevision', aggregateType: 'AdminPolicyRevision' });
  });

  it('CBA-expiry-reminder alerts labor owners before collective bargaining agreement expiry', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new CbaExpiryReminderJob({
      findCbaExpiries: vi.fn(async () => [{ unionRecognitionId: recordId, ownerWorkerIds: [adminId], unionName: 'Nurses union', expiryDate: ctx.now, daysUntilExpiry: 60 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'CBA_EXPIRY_REMINDER', escalationTier: { code: 'T_MINUS_60' } });
  });

  it('grievance-SLA-escalation escalates stale grievances', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new GrievanceSlaEscalationJob({
      findGrievanceSlaBreaches: vi.fn(async () => [{ grievanceId: recordId, workerId, ownerWorkerIds: [adminId], dueDate: new Date('2026-06-10T00:00:00.000Z'), daysOverdue: 4 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'GRIEVANCE_SLA_ESCALATION', escalationTier: { code: 'T_PLUS_4', escalateToManager: true } });
  });

  it('case-SLA-aging escalates ER and service-delivery cases', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new CaseSlaAgingJob({
      findCaseSlaAging: vi.fn(async () => [{ caseId: recordId, caseAggregateType: 'HrServiceCase', ownerWorkerIds: [adminId], workerId, dueDate: new Date('2026-06-10T00:00:00.000Z'), daysOverdue: 4 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'CASE_SLA_AGING', subject: { aggregateType: 'HrServiceCase' } });
  });

  it('investigation-deadline escalates investigations approaching deadline', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new InvestigationDeadlineJob({
      findInvestigationDeadlines: vi.fn(async () => [{ investigationId: recordId, ownerWorkerIds: [adminId], dueDate: ctx.now, daysOverdue: 0 }]),
    }, emitter);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'INVESTIGATION_DEADLINE', audienceWorkerIds: [adminId] });
  });
});
