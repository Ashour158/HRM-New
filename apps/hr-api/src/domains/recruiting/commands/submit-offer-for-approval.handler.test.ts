import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SubmitOfferForApprovalHandler } from './submit-offer-for-approval.handler.js';
import type { OfferRepository } from '../repositories/offer.repository.js';
import { Offer } from '../aggregates/offer.aggregate.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('SubmitOfferForApprovalHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const offerId = new Uuid('550e8400-e29b-41d4-a716-446655440001');
  const actorId = new Uuid('550e8400-e29b-41d4-a716-446655440099');

  const offerRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as OfferRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => ['ApproveOffer']),
  } as unknown as FsmFramework;

  const handler = new SubmitOfferForApprovalHandler(offerRepo, fsm, new RecruitingEventsPublisher());

  function draftOffer(): Offer {
    return Offer.create(
      {
        id: offerId,
        tenantId,
        candidateId: Uuid.generate(),
        requisitionId: Uuid.generate(),
        proposedSalary: 100000,
        currency: 'USD',
        startDate: new Date('2026-08-01'),
      },
      Uuid.generate(),
    );
  }

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'SubmitOfferForApproval',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId,
        roles: ['RECRUITER'],
        permissions: ['OFFER_UPDATE'],
        mfaAuthenticated: true,
      },
      aggregateType: 'Offer',
      aggregateId: offerId,
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { offerId },
      metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions a DRAFT offer to PENDING_APPROVAL and records the proposer', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(draftOffer());

    const result = await handler.handle(command());

    expect(result.newState).toBe('PENDING_APPROVAL');
    expect(result.eventsEmitted).toEqual(['OfferSubmitted']);
    const saved = vi.mocked(offerRepo.save).mock.calls[0][0];
    expect(saved.status).toBe('PENDING_APPROVAL');
    expect(saved.proposedBy?.value).toBe(actorId.value);
  });

  it('throws NotFoundException when the offer does not exist', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Offer not found');
    expect(offerRepo.save).not.toHaveBeenCalled();
  });

  it('rejects submitting an offer that is not in DRAFT state', async () => {
    const offer = draftOffer();
    offer.submitForApproval(Uuid.generate(), Uuid.generate());
    vi.mocked(offerRepo.findById).mockResolvedValue(offer);

    await expect(handler.handle(command())).rejects.toThrow('Offer can only be submitted from DRAFT state');
  });
});
