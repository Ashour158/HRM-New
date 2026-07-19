import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateOfferHandler } from './create-offer.handler.js';
import type { OfferRepository } from '../repositories/offer.repository.js';
import type { CandidateRepository } from '../repositories/candidate.repository.js';
import type { OfferCompensationGateService } from '../services/offer-compensation-gate.service.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { Candidate } from '../aggregates/candidate.aggregate.js';
import type { OfferCompensationResult } from '@hcm/policy-engines';

describe('CreateOfferHandler compensation gate wiring', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000002');
  const candidateId = new Uuid('00000000-0000-0000-0000-000000000003');
  const offerId = new Uuid('00000000-0000-0000-0000-000000000004');

  const offerRepo = {
    save: vi.fn(),
  } as unknown as OfferRepository;

  const candidateRepo = {
    findById: vi.fn(),
  } as unknown as CandidateRepository;

  const compensationGate = {
    evaluate: vi.fn(),
  } as unknown as OfferCompensationGateService;

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => ['SubmitForApproval']),
  } as unknown as FsmFramework;

  const eventPublisher = {
    publishUncommitted: vi.fn(),
  } as unknown as RecruitingEventsPublisher;

  const handler = new CreateOfferHandler(offerRepo, candidateRepo, compensationGate, fsm, eventPublisher);

  function interviewingCandidate(): Candidate {
    const candidate = Candidate.create(
      {
        id: candidateId,
        tenantId,
        firstName: 'Amina',
        lastName: 'Hassan',
        email: 'amina.hassan@example.com',
        requisitionId,
      },
      Uuid.generate(),
    );
    candidate.screen(Uuid.generate());
    candidate.scheduleInterview(Uuid.generate());
    return candidate;
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
      violations: [{ code: 'CURRENCY_MISMATCH', severity: 'BLOCKING', message: 'currency does not match band currency' }],
    };
  }

  function command(overrides: Record<string, unknown> = {}): HrCommandEnvelope<unknown> {
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
        proposedSalary: 100_000,
        currency: 'USD',
        startDate: new Date('2026-08-01'),
        ...overrides,
      },
      metadata: { requestHash: 'hash', clientType: 'RECRUITER' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(candidateRepo.findById).mockResolvedValue(interviewingCandidate());
  });

  it('creates the offer and returns the APPROVED decision for an in-band salary', async () => {
    vi.mocked(compensationGate.evaluate).mockResolvedValue(approvedDecision());

    const result = await handler.handle(command());

    expect(compensationGate.evaluate).toHaveBeenCalledWith(requisitionId, 100_000, 'USD');
    expect(offerRepo.save).toHaveBeenCalled();
    expect((result.data as Record<string, unknown>).compensationDecision).toEqual(approvedDecision());
    expect(result.newState).toBe('DRAFT');
  });

  it('still creates the offer for an out-of-band (CONDITIONAL) salary -- escalation via the existing SoD-gated approval step, not a hard block', async () => {
    vi.mocked(compensationGate.evaluate).mockResolvedValue(conditionalDecision());

    const result = await handler.handle(command({ proposedSalary: 150_000 }));

    expect(offerRepo.save).toHaveBeenCalled();
    expect((result.data as Record<string, unknown>).compensationDecision).toEqual(conditionalDecision());
  });

  it('fails closed and does not create the offer when the engine rejects the compensation (BLOCKING violation)', async () => {
    vi.mocked(compensationGate.evaluate).mockResolvedValue(rejectedDecision());

    await expect(handler.handle(command())).rejects.toThrow('Offer compensation rejected');

    expect(offerRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the candidate is not in INTERVIEWING state', async () => {
    const candidate = Candidate.create(
      {
        id: candidateId,
        tenantId,
        firstName: 'Amina',
        lastName: 'Hassan',
        email: 'amina.hassan@example.com',
        requisitionId,
      },
      Uuid.generate(),
    );
    vi.mocked(candidateRepo.findById).mockResolvedValue(candidate);

    await expect(handler.handle(command())).rejects.toThrow('Candidate must be in INTERVIEWING state');
    expect(compensationGate.evaluate).not.toHaveBeenCalled();
    expect(offerRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the candidate cannot be found', async () => {
    vi.mocked(candidateRepo.findById).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Candidate not found');
    expect(compensationGate.evaluate).not.toHaveBeenCalled();
  });
});
