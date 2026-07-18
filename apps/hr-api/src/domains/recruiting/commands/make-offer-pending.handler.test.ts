import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MakeOfferPendingHandler } from './make-offer-pending.handler.js';
import type { CandidateRepository } from '../repositories/candidate.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { Candidate } from '../aggregates/candidate.aggregate.js';

describe('MakeOfferPendingHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000002');
  const candidateId = new Uuid('00000000-0000-0000-0000-000000000003');
  const recruiterId = new Uuid('00000000-0000-0000-0000-000000000004');

  const candidateRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as CandidateRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => ['HireCandidate']),
  } as unknown as FsmFramework;

  const eventPublisher = {
    publishUncommitted: vi.fn(),
  } as unknown as RecruitingEventsPublisher;

  const handler = new MakeOfferPendingHandler(candidateRepo, fsm, eventPublisher);

  function interviewingCandidate(): Candidate {
    const candidate = Candidate.create(
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
    candidate.screen(Uuid.generate());
    candidate.scheduleInterview(Uuid.generate());
    return candidate;
  }

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'MakeOfferPending',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: recruiterId,
        roles: ['RECRUITER'],
        permissions: ['CANDIDATE_ADVANCE'],
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

  it('moves an INTERVIEWING candidate to OFFER_PENDING', async () => {
    vi.mocked(candidateRepo.findById).mockResolvedValue(interviewingCandidate());

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('OFFER_PENDING');
    expect(candidateRepo.save).toHaveBeenCalled();
    expect(eventPublisher.publishUncommitted).toHaveBeenCalled();
    expect(result.eventsEmitted).toEqual(['CandidateOfferPending']);
  });

  it('rejects when the candidate cannot be found', async () => {
    vi.mocked(candidateRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Candidate not found');
    expect(candidateRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the candidate is not in INTERVIEWING state', async () => {
    const candidate = Candidate.create(
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
    vi.mocked(candidateRepo.findById).mockResolvedValue(candidate);

    await expect(handler.handle(command())).rejects.toThrow(
      'Candidate can only move to OFFER_PENDING from INTERVIEWING state',
    );
    expect(candidateRepo.save).not.toHaveBeenCalled();
  });
});
