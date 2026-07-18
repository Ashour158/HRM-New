import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExpireOfferHandler } from './expire-offer.handler.js';
import type { OfferRepository } from '../repositories/offer.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { Offer } from '../aggregates/offer.aggregate.js';

describe('ExpireOfferHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000002');
  const candidateId = new Uuid('00000000-0000-0000-0000-000000000003');
  const offerId = new Uuid('00000000-0000-0000-0000-000000000004');
  const proposedById = new Uuid('00000000-0000-0000-0000-000000000005');
  const approvedById = new Uuid('00000000-0000-0000-0000-000000000006');

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

  const handler = new ExpireOfferHandler(offerRepo, fsm, eventPublisher);

  function sentOffer(): Offer {
    const offer = Offer.create(
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
    offer.submitForApproval(proposedById, Uuid.generate());
    offer.approve(approvedById, Uuid.generate());
    offer.send(Uuid.generate());
    return offer;
  }

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'ExpireOffer',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'SYSTEM',
        actorId: Uuid.generate(),
        roles: ['SYSTEM'],
        permissions: ['*'],
        mfaAuthenticated: true,
      },
      aggregateType: 'Offer',
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { offerId },
      metadata: { requestHash: 'hash', clientType: 'SYSTEM' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expires a SENT offer', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(sentOffer());

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('EXPIRED');
    expect(offerRepo.save).toHaveBeenCalled();
    expect(eventPublisher.publishUncommitted).toHaveBeenCalled();
    expect(result.eventsEmitted).toEqual(['OfferExpired']);
  });

  it('rejects when the offer cannot be found', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Offer not found');
    expect(offerRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the offer is not in SENT state', async () => {
    const offer = Offer.create(
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
    vi.mocked(offerRepo.findById).mockResolvedValue(offer);

    await expect(handler.handle(command())).rejects.toThrow(
      'Offer can only expire from SENT state',
    );
    expect(offerRepo.save).not.toHaveBeenCalled();
  });
});
