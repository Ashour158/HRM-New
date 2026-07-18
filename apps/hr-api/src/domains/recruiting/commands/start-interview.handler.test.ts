import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StartInterviewHandler } from './start-interview.handler.js';
import type { InterviewPlanRepository } from '../repositories/interview-plan.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { InterviewPlan } from '../aggregates/interview-plan.aggregate.js';

describe('StartInterviewHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000002');
  const candidateId = new Uuid('00000000-0000-0000-0000-000000000003');
  const interviewId = new Uuid('00000000-0000-0000-0000-000000000004');
  const interviewerId = new Uuid('00000000-0000-0000-0000-000000000005');

  const interviewPlanRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as InterviewPlanRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => ['CompleteInterview']),
  } as unknown as FsmFramework;

  const eventPublisher = {
    publishUncommitted: vi.fn(),
  } as unknown as RecruitingEventsPublisher;

  const handler = new StartInterviewHandler(interviewPlanRepo, fsm, eventPublisher);

  function scheduledPlan(): InterviewPlan {
    const plan = InterviewPlan.create(
      {
        id: interviewId,
        tenantId,
        candidateId,
        requisitionId,
        interviewers: [interviewerId],
      },
      Uuid.generate(),
    );
    plan.schedule(new Date('2026-08-01T10:00:00Z'), 'VIDEO', Uuid.generate());
    return plan;
  }

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'StartInterview',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: interviewerId,
        roles: ['INTERVIEWER'],
        permissions: ['INTERVIEW_START'],
        mfaAuthenticated: true,
      },
      aggregateType: 'InterviewPlan',
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { interviewId },
      metadata: { requestHash: 'hash', clientType: 'INTERVIEWER' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts a SCHEDULED interview', async () => {
    vi.mocked(interviewPlanRepo.findById).mockResolvedValue(scheduledPlan());

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('IN_PROGRESS');
    expect(interviewPlanRepo.save).toHaveBeenCalled();
    expect(eventPublisher.publishUncommitted).toHaveBeenCalled();
    expect(result.eventsEmitted).toEqual(['InterviewPlanStarted']);
  });

  it('rejects when the interview plan cannot be found', async () => {
    vi.mocked(interviewPlanRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Interview plan not found');
    expect(interviewPlanRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the interview plan is not in SCHEDULED state', async () => {
    const plan = InterviewPlan.create(
      {
        id: interviewId,
        tenantId,
        candidateId,
        requisitionId,
        interviewers: [interviewerId],
      },
      Uuid.generate(),
    );
    vi.mocked(interviewPlanRepo.findById).mockResolvedValue(plan);

    await expect(handler.handle(command())).rejects.toThrow(
      'Interview can only be started from SCHEDULED state',
    );
    expect(interviewPlanRepo.save).not.toHaveBeenCalled();
  });
});
