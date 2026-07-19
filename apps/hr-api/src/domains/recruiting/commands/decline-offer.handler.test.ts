import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DeclineOfferHandler } from './decline-offer.handler.js';
import { Offer } from '../aggregates/offer.aggregate.js';
import type { OfferRepository } from '../repositories/offer.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('DeclineOfferHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const offerId = new Uuid('00000000-0000-0000-0000-000000000601');
  const candidateId = new Uuid('00000000-0000-0000-0000-000000000301');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000101');

  function offerInState(status: Offer['status']): Offer {
    return Offer.rehydrate({
      id: offerId,
      tenantId,
      candidateId,
      requisitionId,
      proposedSalary: 150000,
      currency: 'USD',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      status,
      aggregateVersion: 3,
    });
  }

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

  const handler = new DeclineOfferHandler(offerRepo, fsm, eventPublisher);

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'DeclineOffer',
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
      aggregateId: offerId,
      expectedState: 'SENT',
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { offerId, reason: 'Chose a competing offer' },
      metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions a SENT offer to DECLINED', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(offerInState('SENT'));

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('DECLINED');
    const saved = vi.mocked(offerRepo.save).mock.calls[0][0] as Offer;
    expect(saved.status).toBe('DECLINED');
    expect(result.eventsEmitted).toEqual(['OfferDeclined']);
  });

  it('rejects the transition when the offer is not SENT', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(offerInState('APPROVED'));

    await expect(handler.handle(command())).rejects.toThrow('Offer can only be declined from SENT state');
    expect(offerRepo.save).not.toHaveBeenCalled();
  });

  it('is idempotent when the offer is already DECLINED (retried command)', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(offerInState('DECLINED'));

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(result.newState).toBe('DECLINED');
    expect(result.eventsEmitted).toEqual([]);
    expect(offerRepo.save).not.toHaveBeenCalled();
    expect(eventPublisher.publishUncommitted).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the offer does not exist', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Offer not found');
  });
});
