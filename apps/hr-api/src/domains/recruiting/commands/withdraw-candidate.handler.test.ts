import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WithdrawCandidateHandler } from './withdraw-candidate.handler.js';
import { Candidate } from '../aggregates/candidate.aggregate.js';
import type { CandidateRepository } from '../repositories/candidate.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('WithdrawCandidateHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const candidateId = new Uuid('00000000-0000-0000-0000-000000000302');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000101');

  function candidateInState(status: Candidate['status']): Candidate {
    return Candidate.rehydrate({
      id: candidateId,
      tenantId,
      firstName: 'Omar',
      lastName: 'Hassan',
      email: 'omar@example.com',
      status,
      requisitionId,
      aggregateVersion: 2,
    });
  }

  const candidateRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as CandidateRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => []),
  } as unknown as FsmFramework;

  const eventPublisher = {
    publishUncommitted: vi.fn(),
  } as unknown as RecruitingEventsPublisher;

  const handler = new WithdrawCandidateHandler(candidateRepo, fsm, eventPublisher);

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'WithdrawCandidate',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: Uuid.generate(),
        roles: ['RECRUITER'],
        permissions: ['*'],
        mfaAuthenticated: true,
      },
      aggregateType: 'Candidate',
      aggregateId: candidateId,
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { candidateId, reason: 'Accepted another offer' },
      metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('withdraws a candidate from a non-terminal state', async () => {
    vi.mocked(candidateRepo.findById).mockResolvedValue(candidateInState('INTERVIEWING'));

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('WITHDRAWN');
    const saved = vi.mocked(candidateRepo.save).mock.calls[0][0] as Candidate;
    expect(saved.status).toBe('WITHDRAWN');
    expect(result.eventsEmitted).toEqual(['CandidateWithdrew']);
  });

  it('rejects the transition when the candidate is already terminal', async () => {
    vi.mocked(candidateRepo.findById).mockResolvedValue(candidateInState('HIRED'));

    await expect(handler.handle(command())).rejects.toThrow('Cannot withdraw candidate in terminal state');
    expect(candidateRepo.save).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the candidate does not exist', async () => {
    vi.mocked(candidateRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Candidate not found');
  });
});
