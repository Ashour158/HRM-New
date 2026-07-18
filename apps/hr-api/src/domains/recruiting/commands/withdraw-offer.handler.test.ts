import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WithdrawOfferHandler } from './withdraw-offer.handler.js';
import type { OfferRepository } from '../repositories/offer.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { Offer } from '../aggregates/offer.aggregate.js';

describe('WithdrawOfferHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000002');
  const candidateId = new Uuid('00000000-0000-0000-0000-000000000003');
  const offerId = new Uuid('00000000-0000-0000-0000-000000000004');
  const proposedById = new Uuid('00000000-0000-0000-0000-000000000005');

  const offerRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as OfferRepository;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => []),
  } as unknown as FsmFramework;

  const eventPublisher = {
    publishUncommitted: vi.fn(),
  } as unknown as RecruitingEventsPublisher;

  const handler = new WithdrawOfferHandler(offerRepo, fsm, eventPublisher);

  function draftOffer(): Offer {
    return Offer.create(
      {
        id: offerId,
        tenantId,
        candidateId,
        requisitionId,
        proposedSalary: 100_000,
        currency: 'USD',
        startDate: new Date('2026-08-01'),
      },
      Uuid.generate(),
    );
  }

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'WithdrawOffer',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: proposedById,
        roles: ['RECRUITER'],
        permissions: ['OFFER_WITHDRAW'],
        mfaAuthenticated: true,
      },
      aggregateType: 'Offer',
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { offerId },
      metadata: { requestHash: 'hash', clientType: 'RECRUITER' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('withdraws a DRAFT offer', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(draftOffer());

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('WITHDRAWN');
    expect(offerRepo.save).toHaveBeenCalled();
    expect(eventPublisher.publishUncommitted).toHaveBeenCalled();
    expect(result.eventsEmitted).toEqual(['OfferWithdrawn']);
  });

  it('rejects when the offer cannot be found', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Offer not found');
    expect(offerRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the offer is in a terminal state', async () => {
    const offer = draftOffer();
    offer.submitForApproval(proposedById, Uuid.generate());
    offer.approve(Uuid.generate(), Uuid.generate());
    offer.send(Uuid.generate());
    offer.accept(Uuid.generate());
    vi.mocked(offerRepo.findById).mockResolvedValue(offer);

    await expect(handler.handle(command())).rejects.toThrow(
      'Cannot withdraw offer in terminal state',
    );
    expect(offerRepo.save).not.toHaveBeenCalled();
  });
});
