import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StartInterviewHandler } from './start-interview.handler.js';
import { CompleteInterviewHandler } from './complete-interview.handler.js';
import { InterviewPlan } from '../aggregates/interview-plan.aggregate.js';
import type { InterviewPlanRepository } from '../repositories/interview-plan.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('StartInterviewHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const interviewId = new Uuid('00000000-0000-0000-0000-000000000401');
  const candidateId = new Uuid('00000000-0000-0000-0000-000000000301');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000101');
  const interviewerId = new Uuid('00000000-0000-0000-0000-000000000501');

  function planInState(status: InterviewPlan['status']): InterviewPlan {
    return InterviewPlan.rehydrate({
      id: interviewId,
      tenantId,
      candidateId,
      requisitionId,
      interviewers: [interviewerId],
      status,
      aggregateVersion: 1,
    });
  }

  const interviewPlanRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as InterviewPlanRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => ['CompleteInterview', 'CancelInterview']),
  } as unknown as FsmFramework;

  const eventPublisher = {
    publishUncommitted: vi.fn(),
  } as unknown as RecruitingEventsPublisher;

  const handler = new StartInterviewHandler(interviewPlanRepo, fsm, eventPublisher);

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'StartInterview',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: Uuid.generate(),
        roles: ['INTERVIEWER'],
        permissions: ['*'],
        mfaAuthenticated: true,
      },
      aggregateType: 'InterviewPlan',
      aggregateId: interviewId,
      expectedState: 'SCHEDULED',
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { interviewId },
      metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions a SCHEDULED interview plan to IN_PROGRESS', async () => {
    vi.mocked(interviewPlanRepo.findById).mockResolvedValue(planInState('SCHEDULED'));

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('IN_PROGRESS');
    const saved = vi.mocked(interviewPlanRepo.save).mock.calls[0][0] as InterviewPlan;
    expect(saved.status).toBe('IN_PROGRESS');
    expect(result.eventsEmitted).toEqual(['InterviewPlanStarted']);
  });

  it('rejects the transition when the plan is not SCHEDULED', async () => {
    vi.mocked(interviewPlanRepo.findById).mockResolvedValue(planInState('DRAFT'));

    await expect(handler.handle(command())).rejects.toThrow(
      'Interview can only be started from SCHEDULED state',
    );
    expect(interviewPlanRepo.save).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the interview plan does not exist', async () => {
    vi.mocked(interviewPlanRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Interview plan not found');
  });

  it('unblocks CompleteInterview, which previously could never succeed without StartInterview', async () => {
    // Before this change, nothing transitioned an InterviewPlan into
    // IN_PROGRESS, so CompleteInterview (which requires IN_PROGRESS) was
    // dead code. This proves the dependency chain now works end-to-end.
    vi.mocked(interviewPlanRepo.findById).mockResolvedValue(planInState('SCHEDULED'));
    const startResult = await handler.handle(command());
    expect(startResult.newState).toBe('IN_PROGRESS');

    const startedPlan = vi.mocked(interviewPlanRepo.save).mock.calls[0][0] as InterviewPlan;

    const completeInterviewPlanRepo = {
      findById: vi.fn().mockResolvedValue(startedPlan),
      save: vi.fn(),
    } as unknown as InterviewPlanRepository;
    const completeHandler = new CompleteInterviewHandler(completeInterviewPlanRepo, fsm, eventPublisher);

    const completeResult = await completeHandler.handle({
      ...command(),
      commandName: 'CompleteInterview',
      expectedState: 'IN_PROGRESS',
      payload: { interviewId },
    });

    expect(completeResult.success).toBe(true);
    expect(completeResult.newState).toBe('COMPLETED');
  });
});
