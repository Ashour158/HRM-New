import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RejectCandidateHandler } from './reject-candidate.handler.js';
import { Candidate } from '../aggregates/candidate.aggregate.js';
import type { CandidateRepository } from '../repositories/candidate.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('RejectCandidateHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const candidateId = new Uuid('00000000-0000-0000-0000-000000000301');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000101');

  function candidateInState(status: Candidate['status']): Candidate {
    return Candidate.rehydrate({
      id: candidateId,
      tenantId,
      firstName: 'Amina',
      lastName: 'Hassan',
      email: 'amina@example.com',
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

  const handler = new RejectCandidateHandler(candidateRepo, fsm, eventPublisher);

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'RejectCandidate',
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
      payload: { applicationId: candidateId, reason: 'Not a fit' },
      metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['NEW', 'SCREENING', 'INTERVIEWING', 'OFFER_PENDING'] as const)(
    'rejects a candidate from %s',
    async (fromStatus) => {
      vi.mocked(candidateRepo.findById).mockResolvedValue(candidateInState(fromStatus));

      const result = await handler.handle(command());

      expect(result.success).toBe(true);
      expect(result.newState).toBe('REJECTED');
      const saved = vi.mocked(candidateRepo.save).mock.calls[0][0] as Candidate;
      expect(saved.status).toBe('REJECTED');
      expect(result.eventsEmitted).toEqual(['CandidateRejected']);
    },
  );

  it.each(['HIRED', 'WITHDRAWN'] as const)(
    'rejects the transition when the candidate is already terminal in a different state (%s)',
    async (fromStatus) => {
      vi.mocked(candidateRepo.findById).mockResolvedValue(candidateInState(fromStatus));

      await expect(handler.handle(command())).rejects.toThrow('Cannot reject candidate in terminal state');
      expect(candidateRepo.save).not.toHaveBeenCalled();
    },
  );

  it('is idempotent when the candidate is already REJECTED (retried command)', async () => {
    vi.mocked(candidateRepo.findById).mockResolvedValue(candidateInState('REJECTED'));

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('REJECTED');
    expect(result.eventsEmitted).toEqual([]);
    expect(candidateRepo.save).not.toHaveBeenCalled();
    expect(eventPublisher.publishUncommitted).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the candidate does not exist', async () => {
    vi.mocked(candidateRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Candidate not found');
  });
});
