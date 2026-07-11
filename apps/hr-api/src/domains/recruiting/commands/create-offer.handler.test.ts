import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateOfferHandler } from './create-offer.handler.js';
import type { OfferRepository } from '../repositories/offer.repository.js';
import type { CandidateRepository } from '../repositories/candidate.repository.js';
import { Candidate } from '../aggregates/candidate.aggregate.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('CreateOfferHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const offerId = new Uuid('550e8400-e29b-41d4-a716-446655440001');
  const candidateId = new Uuid('550e8400-e29b-41d4-a716-446655440002');

  const offerRepo = {
    save: vi.fn(),
  } as unknown as OfferRepository;

  const candidateRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as CandidateRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => ['SubmitOfferForApproval']),
  } as unknown as FsmFramework;

  const handler = new CreateOfferHandler(offerRepo, candidateRepo, fsm, new RecruitingEventsPublisher());

  function interviewingCandidate(): Candidate {
    const candidate = Candidate.create(
      {
        id: candidateId,
        tenantId,
        firstName: 'Amina',
        lastName: 'Hassan',
        email: 'amina.hassan@example.com',
        requisitionId: Uuid.generate(),
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
      commandName: 'CreateOffer',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: Uuid.generate(),
        roles: ['RECRUITER'],
        permissions: ['OFFER_CREATE'],
        mfaAuthenticated: true,
      },
      aggregateType: 'Offer',
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: {
        offerId,
        applicationId: candidateId,
        proposedSalary: 100000,
        currency: 'USD',
        startDate: new Date('2026-08-01'),
      },
      metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moves the candidate to OFFER_PENDING and creates a DRAFT offer', async () => {
    vi.mocked(candidateRepo.findById).mockResolvedValue(interviewingCandidate());

    const result = await handler.handle(command());

    expect(result.eventsEmitted).toEqual(['CandidateOfferPending', 'OfferCreated']);
    const savedCandidate = vi.mocked(candidateRepo.save).mock.calls[0][0];
    expect(savedCandidate.status).toBe('OFFER_PENDING');
    const savedOffer = vi.mocked(offerRepo.save).mock.calls[0][0];
    expect(savedOffer.status).toBe('DRAFT');
    expect(savedOffer.candidateId.value).toBe(candidateId.value);
  });

  it('throws NotFoundException when the candidate does not exist', async () => {
    vi.mocked(candidateRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Candidate not found');
    expect(offerRepo.save).not.toHaveBeenCalled();
  });

  it('rejects creating an offer when the candidate is not INTERVIEWING', async () => {
    const candidate = Candidate.create(
      {
        id: candidateId,
        tenantId,
        firstName: 'Amina',
        lastName: 'Hassan',
        email: 'amina.hassan@example.com',
        requisitionId: Uuid.generate(),
      },
      Uuid.generate(),
    );
    vi.mocked(candidateRepo.findById).mockResolvedValue(candidate);

    await expect(handler.handle(command())).rejects.toThrow(
      'Candidate must be in INTERVIEWING state to create an offer',
    );
    expect(candidateRepo.save).not.toHaveBeenCalled();
    expect(offerRepo.save).not.toHaveBeenCalled();
  });
});
