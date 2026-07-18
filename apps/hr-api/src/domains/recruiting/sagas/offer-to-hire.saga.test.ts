import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { OfferToHireSaga } from './offer-to-hire.saga.js';
import { Offer } from '../aggregates/offer.aggregate.js';
import { Candidate } from '../aggregates/candidate.aggregate.js';
import { JobRequisition } from '../aggregates/job-requisition.aggregate.js';
import type { OfferRepository } from '../repositories/offer.repository.js';
import type { CandidateRepository } from '../repositories/candidate.repository.js';
import type { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { EventBus, EventHandler } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { Uuid } from '@hcm/shared-kernel';

describe('OfferToHireSaga', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const offerId = new Uuid('00000000-0000-0000-0000-000000000605');
  const candidateId = new Uuid('00000000-0000-0000-0000-000000000304');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000103');
  const positionId = new Uuid('00000000-0000-0000-0000-000000000203');

  function offer(): Offer {
    return Offer.rehydrate({
      id: offerId,
      tenantId,
      candidateId,
      requisitionId,
      proposedSalary: 175000,
      currency: 'USD',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      status: 'ACCEPTED',
      aggregateVersion: 5,
    });
  }

  function candidateInState(id: Uuid, status: Candidate['status']): Candidate {
    return Candidate.rehydrate({
      id,
      tenantId,
      firstName: 'Mona',
      lastName: 'Hassan',
      email: `${id.value}@example.com`,
      status,
      requisitionId,
      aggregateVersion: 4,
    });
  }

  function requisition(): JobRequisition {
    return JobRequisition.rehydrate({
      id: requisitionId,
      tenantId,
      requisitionNumber: 'REQ-003',
      positionId,
      title: 'Staff Engineer',
      status: 'FILLED',
      aggregateVersion: 6,
    });
  }

  let capturedHandler: EventHandler | undefined;

  const eventBus = {
    subscribe: vi.fn((_topic: string, _group: string, handler: EventHandler) => {
      capturedHandler = handler;
    }),
  } as unknown as EventBus;

  const commandBus = {
    execute: vi.fn().mockResolvedValue({ success: true, data: {} }),
  } as unknown as CommandBus;

  const offerRepo = {
    findById: vi.fn(),
  } as unknown as OfferRepository;

  const candidateRepo = {
    findById: vi.fn(),
    findByRequisition: vi.fn(),
  } as unknown as CandidateRepository;

  const requisitionRepo = {
    findById: vi.fn(),
  } as unknown as JobRequisitionRepository;

  let saga: OfferToHireSaga;

  function offerAcceptedEvent(): HrEventEnvelope<{ offerId: string; acceptedBy: string }> {
    return {
      eventId: Uuid.generate(),
      eventName: 'OfferAccepted',
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: 'Offer',
      aggregateId: offerId,
      // Plain UUID strings -- matches what AcceptOfferHandler's
      // CommandResult.data (and OfferAcceptedPayloadSchema) actually carry,
      // not `Uuid` instances.
      payload: { offerId: offerId.value, acceptedBy: Uuid.generate().value },
      metadata: {
        correlationId: Uuid.generate(),
        requestHash: 'hash',
        clientType: 'HR_ADMIN',
      },
      privacy: createPrivacyForEvent('NONE', undefined, 'PROFILE'),
      occurredAt: new Date(),
      version: 5,
    };
  }

  function jobRequisitionFilledEvent(): HrEventEnvelope<{ requisitionId: string; offerId: string }> {
    return {
      eventId: Uuid.generate(),
      eventName: 'JobRequisitionFilled',
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: 'JobRequisition',
      aggregateId: requisitionId,
      // Plain UUID strings -- see the note in offerAcceptedEvent() above.
      payload: { requisitionId: requisitionId.value, offerId: offerId.value },
      metadata: {
        correlationId: Uuid.generate(),
        requestHash: 'hash',
        clientType: 'HR_ADMIN',
      },
      privacy: createPrivacyForEvent('NONE', undefined, 'PROFILE'),
      occurredAt: new Date(),
      version: 6,
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    capturedHandler = undefined;
    vi.mocked(commandBus.execute).mockResolvedValue({ success: true, data: {} } as never);
    saga = new OfferToHireSaga(eventBus, commandBus, offerRepo, candidateRepo, requisitionRepo);
    saga.onModuleInit();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('subscribes to the hr.recruiting.v1 topic', () => {
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'hr.recruiting.v1',
      'offer-to-hire-saga',
      expect.objectContaining({ consumerGroup: 'offer-to-hire-saga' }),
    );
    expect(capturedHandler).toBeDefined();
  });

  it('drives the full offer-to-hire pipeline when OfferAccepted fires', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(offer());
    vi.mocked(candidateRepo.findById).mockResolvedValue(candidateInState(candidateId, 'HIRED'));
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisition());

    await capturedHandler!.handle(offerAcceptedEvent());

    const dispatchedCommandNames = vi
      .mocked(commandBus.execute)
      .mock.calls.map(([cmd]) => (cmd as { commandName: string }).commandName);

    expect(dispatchedCommandNames).toEqual([
      'CreateWorker',
      'CreateEmploymentRelationship',
      'CreateJobAssignment',
      'FillPosition',
      'CreateOnboardingPlan',
    ]);
  });

  it('does not run the pipeline for events that are not OfferAccepted or JobRequisitionFilled', async () => {
    const unrelated: HrEventEnvelope<unknown> = {
      ...offerAcceptedEvent(),
      eventName: 'OfferSent',
    };

    await capturedHandler!.handle(unrelated);

    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(offerRepo.findById).not.toHaveBeenCalled();
  });

  it('moves the saga to manual review (without throwing) when a pipeline step fails', async () => {
    vi.mocked(offerRepo.findById).mockResolvedValue(offer());
    vi.mocked(candidateRepo.findById).mockResolvedValue(candidateInState(candidateId, 'HIRED'));
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisition());
    vi.mocked(commandBus.execute).mockResolvedValueOnce({
      success: false,
      errorMessage: 'downstream failure',
    } as never);

    await expect(capturedHandler!.handle(offerAcceptedEvent())).resolves.toBeUndefined();
    // Only the first step (CreateWorker) should have been attempted.
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
  });

  it('bulk-rejects other still-active candidates when JobRequisitionFilled fires', async () => {
    const hiredCandidate = candidateInState(candidateId, 'HIRED');
    const stillInterviewing = candidateInState(
      new Uuid('00000000-0000-0000-0000-000000000305'),
      'INTERVIEWING',
    );
    const stillScreening = candidateInState(
      new Uuid('00000000-0000-0000-0000-000000000306'),
      'SCREENING',
    );
    const alreadyWithdrawn = candidateInState(
      new Uuid('00000000-0000-0000-0000-000000000307'),
      'WITHDRAWN',
    );
    vi.mocked(candidateRepo.findByRequisition).mockResolvedValue([
      hiredCandidate,
      stillInterviewing,
      stillScreening,
      alreadyWithdrawn,
    ]);

    await capturedHandler!.handle(jobRequisitionFilledEvent());

    expect(candidateRepo.findByRequisition).toHaveBeenCalledWith(requisitionId);

    const rejectCalls = vi
      .mocked(commandBus.execute)
      .mock.calls.filter(([cmd]) => (cmd as { commandName: string }).commandName === 'RejectCandidate');

    // Only the two non-terminal candidates should be rejected — the hired
    // and already-withdrawn candidates must be left alone.
    expect(rejectCalls).toHaveLength(2);
    const rejectedCandidateIds = rejectCalls.map(
      ([cmd]) => (cmd as { payload: { candidateId: Uuid } }).payload.candidateId.value,
    );
    expect(rejectedCandidateIds).toEqual(
      expect.arrayContaining([stillInterviewing.id.value, stillScreening.id.value]),
    );
    expect(rejectedCandidateIds).not.toContain(hiredCandidate.id.value);
    expect(rejectedCandidateIds).not.toContain(alreadyWithdrawn.id.value);
  });

  it('isolates bulk-reject failures per candidate instead of aborting the batch', async () => {
    const first = candidateInState(new Uuid('00000000-0000-0000-0000-000000000308'), 'NEW');
    const second = candidateInState(new Uuid('00000000-0000-0000-0000-000000000309'), 'NEW');
    vi.mocked(candidateRepo.findByRequisition).mockResolvedValue([first, second]);
    vi.mocked(commandBus.execute)
      .mockResolvedValueOnce({ success: false, errorMessage: 'concurrent update' } as never)
      .mockResolvedValueOnce({ success: true, data: {} } as never);

    await expect(capturedHandler!.handle(jobRequisitionFilledEvent())).resolves.toBeUndefined();

    expect(commandBus.execute).toHaveBeenCalledTimes(2);
  });

  it('does nothing when every candidate in the pipeline is already terminal', async () => {
    vi.mocked(candidateRepo.findByRequisition).mockResolvedValue([
      candidateInState(candidateId, 'HIRED'),
    ]);

    await capturedHandler!.handle(jobRequisitionFilledEvent());

    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
