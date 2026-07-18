import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WithdrawCandidateHandler } from './withdraw-candidate.handler.js';
import type { CandidateRepository } from '../repositories/candidate.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { Candidate } from '../aggregates/candidate.aggregate.js';

describe('WithdrawCandidateHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000002');
  const candidateId = new Uuid('00000000-0000-0000-0000-000000000003');
  const recruiterId = new Uuid('00000000-0000-0000-0000-000000000004');

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

  function newCandidate(): Candidate {
    return Candidate.create(
      {
        id: candidateId,
        tenantId,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        requisitionId,
      },
      Uuid.generate(),
    );
  }

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'WithdrawCandidate',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: recruiterId,
        roles: ['RECRUITER'],
        permissions: ['CANDIDATE_WITHDRAW'],
        mfaAuthenticated: true,
      },
      aggregateType: 'Candidate',
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { applicationId: candidateId },
      metadata: { requestHash: 'hash', clientType: 'RECRUITER' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('withdraws a NEW candidate', async () => {
    vi.mocked(candidateRepo.findById).mockResolvedValue(newCandidate());

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('WITHDRAWN');
    expect(candidateRepo.save).toHaveBeenCalled();
    expect(eventPublisher.publishUncommitted).toHaveBeenCalled();
    expect(result.eventsEmitted).toEqual(['CandidateWithdrew']);
  });

  it('rejects when the candidate cannot be found', async () => {
    vi.mocked(candidateRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Candidate not found');
    expect(candidateRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the candidate is in a terminal state', async () => {
    const candidate = newCandidate();
    candidate.reject(Uuid.generate());
    vi.mocked(candidateRepo.findById).mockResolvedValue(candidate);

    await expect(handler.handle(command())).rejects.toThrow(
      'Cannot withdraw candidate in terminal state',
    );
    expect(candidateRepo.save).not.toHaveBeenCalled();
  });
});
