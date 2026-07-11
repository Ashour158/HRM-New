import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StartInterviewHandler } from './start-interview.handler.js';
import type { InterviewPlanRepository } from '../repositories/interview-plan.repository.js';
import { InterviewPlan } from '../aggregates/interview-plan.aggregate.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('StartInterviewHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const interviewId = new Uuid('550e8400-e29b-41d4-a716-446655440001');

  const interviewPlanRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as InterviewPlanRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => ['CompleteInterview']),
  } as unknown as FsmFramework;

  const handler = new StartInterviewHandler(interviewPlanRepo, fsm, new RecruitingEventsPublisher());

  function scheduledPlan(): InterviewPlan {
    const plan = InterviewPlan.create(
      {
        id: interviewId,
        tenantId,
        candidateId: Uuid.generate(),
        requisitionId: Uuid.generate(),
        interviewers: [Uuid.generate()],
      },
      Uuid.generate(),
    );
    plan.schedule(new Date('2026-08-01T10:00:00.000Z'), 'VIDEO', Uuid.generate());
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
        actorId: Uuid.generate(),
        roles: ['RECRUITER'],
        permissions: ['INTERVIEW_UPDATE'],
        mfaAuthenticated: true,
      },
      aggregateType: 'InterviewPlan',
      aggregateId: interviewId,
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

  it('transitions a SCHEDULED interview plan to IN_PROGRESS and persists it', async () => {
    vi.mocked(interviewPlanRepo.findById).mockResolvedValue(scheduledPlan());

    const result = await handler.handle(command());

    expect(result.newState).toBe('IN_PROGRESS');
    expect(result.eventsEmitted).toEqual(['InterviewPlanStarted']);
    const saved = vi.mocked(interviewPlanRepo.save).mock.calls[0][0];
    expect(saved.status).toBe('IN_PROGRESS');
  });

  it('throws NotFoundException when the interview plan does not exist', async () => {
    vi.mocked(interviewPlanRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Interview plan not found');
    expect(interviewPlanRepo.save).not.toHaveBeenCalled();
  });

  it('rejects starting an interview plan that is not in SCHEDULED state', async () => {
    const plan = InterviewPlan.create(
      {
        id: interviewId,
        tenantId,
        candidateId: Uuid.generate(),
        requisitionId: Uuid.generate(),
        interviewers: [Uuid.generate()],
      },
      Uuid.generate(),
    );
    vi.mocked(interviewPlanRepo.findById).mockResolvedValue(plan);

    await expect(handler.handle(command())).rejects.toThrow(
      'Interview can only be started from SCHEDULED state',
    );
  });
});
