import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateOfferHandler } from './create-offer.handler.js';
import { Candidate } from '../aggregates/candidate.aggregate.js';
import type { OfferRepository } from '../repositories/offer.repository.js';
import type { CandidateRepository } from '../repositories/candidate.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('CreateOfferHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const offerId = new Uuid('00000000-0000-0000-0000-000000000604');
  const candidateId = new Uuid('00000000-0000-0000-0000-000000000303');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000101');

  function candidateInState(status: Candidate['status']): Candidate {
    return Candidate.rehydrate({
      id: candidateId,
      tenantId,
      firstName: 'Yara',
      lastName: 'Hassan',
      email: 'yara@example.com',
      status,
      requisitionId,
      aggregateVersion: 3,
    });
  }

  const offerRepo = {
    save: vi.fn(),
  } as unknown as OfferRepository;

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

  const handler = new CreateOfferHandler(offerRepo, candidateRepo, fsm, eventPublisher);

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'CreateOffer',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: Uuid.generate(),
        roles: ['RECRUITER'],
        permissions: ['*'],
        mfaAuthenticated: true,
      },
      aggregateType: 'Offer',
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: {
        offerId,
        applicationId: candidateId,
        proposedSalary: 150000,
        currency: 'USD',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
      },
      metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the offer and moves the candidate to OFFER_PENDING in the same command', async () => {
    // This is the fix for the dead offer-to-hire path: without this
    // candidate transition, AcceptOffer's later `candidate.hire()` call
    // (which requires OFFER_PENDING) would always throw ConflictError
    // because the candidate would still be stuck in INTERVIEWING.
    vi.mocked(candidateRepo.findById).mockResolvedValue(candidateInState('INTERVIEWING'));

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(offerRepo.save).toHaveBeenCalledTimes(1);
    expect(candidateRepo.save).toHaveBeenCalledTimes(1);

    const savedCandidate = vi.mocked(candidateRepo.save).mock.calls[0][0] as Candidate;
    expect(savedCandidate.status).toBe('OFFER_PENDING');
    expect(result.eventsEmitted).toEqual(['OfferCreated', 'CandidateOfferPending']);
  });

  it('rejects offer creation when the candidate is not INTERVIEWING', async () => {
    vi.mocked(candidateRepo.findById).mockResolvedValue(candidateInState('SCREENING'));

    await expect(handler.handle(command())).rejects.toThrow(
      'Candidate must be in INTERVIEWING state to create an offer',
    );
    expect(offerRepo.save).not.toHaveBeenCalled();
    expect(candidateRepo.save).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the candidate does not exist', async () => {
    vi.mocked(candidateRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Candidate not found');
  });
});
