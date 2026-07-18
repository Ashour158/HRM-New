import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AcceptOfferHandler } from './accept-offer.handler.js';
import { Offer } from '../aggregates/offer.aggregate.js';
import { Candidate } from '../aggregates/candidate.aggregate.js';
import { JobRequisition } from '../aggregates/job-requisition.aggregate.js';
import type { OfferRepository } from '../repositories/offer.repository.js';
import type { CandidateRepository } from '../repositories/candidate.repository.js';
import type { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { isOfferAcceptedEvent, createPrivacyForEvent } from '@hcm/event-schemas';
import { Uuid } from '@hcm/shared-kernel';

describe('AcceptOfferHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const offerId = new Uuid('00000000-0000-0000-0000-000000000605');
  const candidateId = new Uuid('00000000-0000-0000-0000-000000000304');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000103');
  const positionId = new Uuid('00000000-0000-0000-0000-000000000203');
  const actorId = new Uuid('00000000-0000-0000-0000-000000000701');

  function offerInState(status: Offer['status']): Offer {
    return Offer.rehydrate({
      id: offerId,
      tenantId,
      candidateId,
      requisitionId,
      proposedSalary: 175000,
      currency: 'USD',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      status,
      aggregateVersion: 4,
    });
  }

  function candidateInState(status: Candidate['status']): Candidate {
    return Candidate.rehydrate({
      id: candidateId,
      tenantId,
      firstName: 'Mona',
      lastName: 'Hassan',
      email: 'mona@example.com',
      status,
      requisitionId,
      aggregateVersion: 4,
    });
  }

  function requisitionInState(status: JobRequisition['status']): JobRequisition {
    return JobRequisition.rehydrate({
      id: requisitionId,
      tenantId,
      requisitionNumber: 'REQ-003',
      positionId,
      title: 'Staff Engineer',
      status,
      aggregateVersion: 5,
    });
  }

  const offerRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as OfferRepository;

  const candidateRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as CandidateRepository;

  const requisitionRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as JobRequisitionRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => []),
  } as unknown as FsmFramework;

  const eventPublisher = {
    publishUncommitted: vi.fn(),
  } as unknown as RecruitingEventsPublisher;

  const handler = new AcceptOfferHandler(offerRepo, candidateRepo, requisitionRepo, fsm, eventPublisher);

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'AcceptOffer',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId,
        roles: ['RECRUITER'],
        permissions: ['*'],
        mfaAuthenticated: true,
      },
      aggregateType: 'Offer',
      aggregateId: offerId,
      expectedState: 'SENT',
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { offerId, acceptedAt: new Date('2026-08-15T00:00:00.000Z') },
      metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts the offer, hires the candidate, and fills the requisition', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(offerInState('SENT'));
    vi.mocked(candidateRepo.findById).mockResolvedValue(candidateInState('OFFER_PENDING'));
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisitionInState('OPEN'));

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('ACCEPTED');

    const savedOffer = vi.mocked(offerRepo.save).mock.calls[0][0] as Offer;
    expect(savedOffer.status).toBe('ACCEPTED');

    const savedCandidate = vi.mocked(candidateRepo.save).mock.calls[0][0] as Candidate;
    expect(savedCandidate.status).toBe('HIRED');

    const savedRequisition = vi.mocked(requisitionRepo.save).mock.calls[0][0] as JobRequisition;
    expect(savedRequisition.status).toBe('FILLED');

    expect(result.eventsEmitted).toEqual(['OfferAccepted', 'CandidateHired', 'JobRequisitionFilled']);
  });

  it('fails to hire the candidate if it was never moved to OFFER_PENDING (proves the CreateOffer fix is load-bearing)', async () => {
    // Before the CreateOffer fix, candidates never left INTERVIEWING, so
    // this call to candidate.hire() would always throw here.
    vi.mocked(offerRepo.findById).mockResolvedValue(offerInState('SENT'));
    vi.mocked(candidateRepo.findById).mockResolvedValue(candidateInState('INTERVIEWING'));
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisitionInState('OPEN'));

    await expect(handler.handle(command())).rejects.toThrow(
      'Candidate can only be hired from OFFER_PENDING state',
    );
  });

  it('rejects acceptance when the offer is not SENT', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(offerInState('APPROVED'));

    await expect(handler.handle(command())).rejects.toThrow('Offer must be in SENT state to be accepted');
    expect(offerRepo.save).not.toHaveBeenCalled();
  });

  it('produces a CommandResult.data shape that satisfies the offer-to-hire saga event guard', async () => {
    // This is the critical wiring check: CommandBus.stepWriteOutbox reuses
    // this handler's `result.data` as the `payload` for every event in
    // `eventsEmitted` (including OfferAccepted). The saga only reacts via
    // `isOfferAcceptedEvent`, which requires `offerId` + `acceptedBy` as
    // UUID strings. Before this fix, `data` only had `offerId` + `status`,
    // so the guard rejected the event and the saga never fired even
    // though an OfferAccepted row was written to the outbox.
    vi.mocked(offerRepo.findById).mockResolvedValue(offerInState('SENT'));
    vi.mocked(candidateRepo.findById).mockResolvedValue(candidateInState('OFFER_PENDING'));
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisitionInState('OPEN'));

    const result = await handler.handle(command());

    const outboxEvent: HrEventEnvelope<unknown> = {
      eventId: Uuid.generate(),
      eventName: 'OfferAccepted',
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: 'Offer',
      aggregateId: result.aggregateId,
      payload: result.data,
      metadata: {
        correlationId: result.correlationId,
        causationId: result.commandId,
        requestHash: 'hash',
        clientType: 'HR_ADMIN',
      },
      privacy: createPrivacyForEvent('NONE', undefined, 'PROFILE'),
      occurredAt: new Date(),
      version: result.newVersion,
    };

    expect(isOfferAcceptedEvent(outboxEvent)).toBe(true);
  });
});
