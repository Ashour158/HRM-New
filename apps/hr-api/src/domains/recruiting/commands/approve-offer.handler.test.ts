import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApproveOfferHandler } from './approve-offer.handler.js';
import type { OfferRepository } from '../repositories/offer.repository.js';
import type { OfferCompensationGateService } from '../services/offer-compensation-gate.service.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { Offer } from '../aggregates/offer.aggregate.js';
import type { OfferCompensationResult } from '@hcm/policy-engines';

describe('ApproveOfferHandler compensation re-verification gate', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000002');
  const candidateId = new Uuid('00000000-0000-0000-0000-000000000003');
  const offerId = new Uuid('00000000-0000-0000-0000-000000000004');
  const proposedById = new Uuid('00000000-0000-0000-0000-000000000005');
  const approverId = new Uuid('00000000-0000-0000-0000-000000000006');

  const offerRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as OfferRepository;

  const compensationGate = {
    evaluate: vi.fn(),
  } as unknown as OfferCompensationGateService;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => ['SendOffer']),
  } as unknown as FsmFramework;

  const eventPublisher = {
    publishUncommitted: vi.fn(),
  } as unknown as RecruitingEventsPublisher;

  const handler = new ApproveOfferHandler(offerRepo, compensationGate, fsm, eventPublisher);

  function pendingOffer(proposedSalary = 100_000, currency = 'USD'): Offer {
    const offer = Offer.create(
      {
        id: offerId,
        tenantId,
        candidateId,
        requisitionId,
        proposedSalary,
        currency,
        startDate: new Date('2026-08-01'),
      },
      Uuid.generate(),
    );
    offer.submitForApproval(proposedById, Uuid.generate());
    return offer;
  }

  function approvedDecision(): OfferCompensationResult {
    return { decisionCode: 'APPROVED', compaRatio: 1, rangePenetration: 0.5, violations: [] };
  }

  function conditionalDecision(): OfferCompensationResult {
    return {
      decisionCode: 'CONDITIONAL',
      compaRatio: 1.5,
      rangePenetration: 1.75,
      violations: [{ code: 'ABOVE_BAND_MAXIMUM', severity: 'WARNING', message: 'exceeds band maximum' }],
    };
  }

  function rejectedDecision(): OfferCompensationResult {
    return {
      decisionCode: 'REJECTED',
      violations: [{ code: 'INVALID_BAND', severity: 'BLOCKING', message: 'band is missing or non-monotonic' }],
    };
  }

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'ApproveOffer',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: approverId,
        roles: ['HIRING_MANAGER'],
        permissions: ['OFFER_APPROVE'],
        mfaAuthenticated: true,
      },
      aggregateType: 'Offer',
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { offerId },
      metadata: { requestHash: 'hash', clientType: 'HIRING_MANAGER' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-verifies the compensation gate against the offer’s current salary before approving', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(pendingOffer());
    vi.mocked(compensationGate.evaluate).mockResolvedValue(approvedDecision());

    const result = await handler.handle(command());

    expect(compensationGate.evaluate).toHaveBeenCalledWith(requisitionId, 100_000, 'USD');
    expect(result.newState).toBe('APPROVED');
    expect(offerRepo.save).toHaveBeenCalled();
    expect((result.data as Record<string, unknown>).compensationDecision).toEqual(approvedDecision());
  });

  it('still approves a CONDITIONAL (out-of-band) offer -- the SoD-gated human approval here is the escalation step', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(pendingOffer(150_000));
    vi.mocked(compensationGate.evaluate).mockResolvedValue(conditionalDecision());

    const result = await handler.handle(command());

    expect(result.newState).toBe('APPROVED');
    expect(offerRepo.save).toHaveBeenCalled();
    expect((result.data as Record<string, unknown>).compensationDecision).toEqual(conditionalDecision());
  });

  it('blocks approval when the re-verified decision is REJECTED (e.g. the band changed between creation and approval)', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(pendingOffer());
    vi.mocked(compensationGate.evaluate).mockResolvedValue(rejectedDecision());

    await expect(handler.handle(command())).rejects.toThrow('Cannot approve offer');

    expect(offerRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the offer cannot be found', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Offer not found');
    expect(compensationGate.evaluate).not.toHaveBeenCalled();
  });
});
