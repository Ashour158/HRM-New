import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import type { HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { WorksCouncilConsultation } from '../aggregates/works-council-consultation.aggregate.js';
import {
  InitiateWorksCouncilConsultationHandler,
  StartWorksCouncilProgressHandler,
  CompleteWorksCouncilConsultationHandler,
  BlockWorksCouncilActionHandler,
} from './works-council-consultation-lifecycle.handlers.js';
import type { WorksCouncilConsultationRepository } from '../repositories/works-council-consultation.repository.js';
import type { GlobalHrEventsPublisher } from '../events/global-hr-events.publisher.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000010');
const consultationId = new Uuid('00000000-0000-0000-0000-000000000032');
const legalEntityId = new Uuid('00000000-0000-0000-0000-000000000100');

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId,
    roles: ['HR_ADMIN', 'GLOBAL_HR_ADMIN'],
    permissions: ['GLOBAL_HR_WRITE'],
    email: 'global.hr@example.com',
    mfaAuthenticated: true,
  };
}

function envelope<T>(commandName: string, payload: T, effectiveDate?: Date): HrCommandEnvelope<T> {
  return {
    commandId: Uuid.generate(),
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: actor(),
    aggregateType: 'WorksCouncilConsultation',
    aggregateId: consultationId,
    expectedState: undefined,
    expectedVersion: undefined,
    effectiveDate,
    idempotencyKey: `${commandName}-${Date.now()}`,
    correlationId: Uuid.generate(),
    reason: 'spec',
    payload,
    metadata: { clientType: 'HR_ADMIN' },
  };
}

function fsm() {
  return {
    getAllowedActionsFromState: vi.fn(() => ['StartWorksCouncilProgress', 'BlockWorksCouncilAction']),
  } as unknown as FsmFramework;
}

function publisher() {
  return { publishUncommitted: vi.fn(async () => undefined) } as unknown as GlobalHrEventsPublisher;
}

function consultationInState(
  status: WorksCouncilConsultation['status'],
  overrides: Partial<{ createdAt: Date }> = {},
): WorksCouncilConsultation {
  return new WorksCouncilConsultation({
    id: consultationId,
    tenantId,
    countryCode: 'DE',
    legalEntityId,
    actionType: 'RESTRUCTURING',
    consultationType: 'INFORMATION_AND_CONSULTATION',
    status,
    aggregateVersion: 1,
    createdAt: overrides.createdAt,
  });
}

describe('WorksCouncilConsultation lifecycle command handlers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('InitiateWorksCouncilConsultation', () => {
    it('moves REQUIRED -> INITIATED, records the deadline, and emits the event', async () => {
      const consultation = consultationInState('REQUIRED');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const eventsPublisher = publisher();
      const handler = new InitiateWorksCouncilConsultationHandler(repo, fsm(), eventsPublisher);
      const deadlineDate = new Date('2026-09-01T00:00:00.000Z');

      const result = await handler.handle(envelope('InitiateWorksCouncilConsultation', { consultationId, deadlineDate }));

      expect(result.success).toBe(true);
      expect(result.newState).toBe('INITIATED');
      expect(result.eventsEmitted).toContain('WorksCouncilConsultationInitiated');
      expect(consultation.deadlineDate).toEqual(deadlineDate);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'INITIATED' }));
      expect(eventsPublisher.publishUncommitted).toHaveBeenCalledWith(
        expect.objectContaining({ id: consultationId }),
        tenantId,
        expect.anything(),
      );
    });

    it('rejects initiating a consultation that is not REQUIRED (and not already INITIATED)', async () => {
      const consultation = consultationInState('IN_PROGRESS');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const eventsPublisher = publisher();
      const handler = new InitiateWorksCouncilConsultationHandler(repo, fsm(), eventsPublisher);

      await expect(
        handler.handle(envelope('InitiateWorksCouncilConsultation', { consultationId, deadlineDate: new Date() })),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(eventsPublisher.publishUncommitted).not.toHaveBeenCalled();
    });

    it('derives the deadline from command.effectiveDate, not the wall clock, when no explicit deadline is given', async () => {
      const consultation = consultationInState('REQUIRED');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const handler = new InitiateWorksCouncilConsultationHandler(repo, fsm(), publisher());
      const effectiveDate = new Date('2026-03-01T00:00:00.000Z');

      await handler.handle(envelope('InitiateWorksCouncilConsultation', { consultationId }, effectiveDate));

      expect(consultation.deadlineDate).toEqual(new Date('2026-03-31T00:00:00.000Z'));
    });

    it('falls back to the consultation createdAt (still deterministic, not the wall clock) when neither a deadline nor command.effectiveDate is given', async () => {
      const createdAt = new Date('2026-01-15T00:00:00.000Z');
      const consultation = consultationInState('REQUIRED', { createdAt });
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const handler = new InitiateWorksCouncilConsultationHandler(repo, fsm(), publisher());

      await handler.handle(envelope('InitiateWorksCouncilConsultation', { consultationId }));

      expect(consultation.deadlineDate).toEqual(new Date('2026-02-14T00:00:00.000Z'));
    });

    it('is idempotent: retrying against an already-INITIATED consultation returns success without re-invoking the transition', async () => {
      const consultation = consultationInState('INITIATED');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const eventsPublisher = publisher();
      const handler = new InitiateWorksCouncilConsultationHandler(repo, fsm(), eventsPublisher);

      const result = await handler.handle(
        envelope('InitiateWorksCouncilConsultation', { consultationId, deadlineDate: new Date() }),
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe('INITIATED');
      expect(repo.save).not.toHaveBeenCalled();
      expect(eventsPublisher.publishUncommitted).not.toHaveBeenCalled();
    });
  });

  describe('StartWorksCouncilProgress', () => {
    it('moves INITIATED -> IN_PROGRESS and emits WorksCouncilConsultationProgressStarted', async () => {
      const consultation = consultationInState('INITIATED');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const eventsPublisher = publisher();
      const handler = new StartWorksCouncilProgressHandler(repo, fsm(), eventsPublisher);

      const result = await handler.handle(envelope('StartWorksCouncilProgress', { consultationId }));

      expect(result.success).toBe(true);
      expect(result.newState).toBe('IN_PROGRESS');
      expect(result.eventsEmitted).toContain('WorksCouncilConsultationProgressStarted');
      expect(eventsPublisher.publishUncommitted).toHaveBeenCalledWith(
        expect.objectContaining({ id: consultationId }),
        tenantId,
        expect.anything(),
      );
    });

    it('rejects starting progress on a REQUIRED consultation (must be initiated first)', async () => {
      const consultation = consultationInState('REQUIRED');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const eventsPublisher = publisher();
      const handler = new StartWorksCouncilProgressHandler(repo, fsm(), eventsPublisher);

      await expect(handler.handle(envelope('StartWorksCouncilProgress', { consultationId }))).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(eventsPublisher.publishUncommitted).not.toHaveBeenCalled();
    });

    it('is idempotent: retrying against an already-IN_PROGRESS consultation returns success without re-invoking the transition', async () => {
      const consultation = consultationInState('IN_PROGRESS');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const eventsPublisher = publisher();
      const handler = new StartWorksCouncilProgressHandler(repo, fsm(), eventsPublisher);

      const result = await handler.handle(envelope('StartWorksCouncilProgress', { consultationId }));

      expect(result.success).toBe(true);
      expect(result.newState).toBe('IN_PROGRESS');
      expect(repo.save).not.toHaveBeenCalled();
      expect(eventsPublisher.publishUncommitted).not.toHaveBeenCalled();
    });
  });

  describe('CompleteWorksCouncilConsultation', () => {
    it('moves IN_PROGRESS -> COMPLETED, clears blockingUntil, and emits the event', async () => {
      const consultation = consultationInState('IN_PROGRESS');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const eventsPublisher = publisher();
      const handler = new CompleteWorksCouncilConsultationHandler(repo, fsm(), eventsPublisher);

      const result = await handler.handle(envelope('CompleteWorksCouncilConsultation', { consultationId }));

      expect(result.success).toBe(true);
      expect(result.newState).toBe('COMPLETED');
      expect(result.eventsEmitted).toContain('WorksCouncilConsultationCompleted');
      expect(consultation.isBlocking()).toBe(false);
      expect(eventsPublisher.publishUncommitted).toHaveBeenCalledWith(
        expect.objectContaining({ id: consultationId }),
        tenantId,
        expect.anything(),
      );
    });

    it('rejects completing a consultation that has not started progress', async () => {
      const consultation = consultationInState('INITIATED');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const eventsPublisher = publisher();
      const handler = new CompleteWorksCouncilConsultationHandler(repo, fsm(), eventsPublisher);

      await expect(
        handler.handle(envelope('CompleteWorksCouncilConsultation', { consultationId })),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(eventsPublisher.publishUncommitted).not.toHaveBeenCalled();
    });

    it('is idempotent: retrying against an already-COMPLETED consultation returns success without re-invoking the transition', async () => {
      const consultation = consultationInState('COMPLETED');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const eventsPublisher = publisher();
      const handler = new CompleteWorksCouncilConsultationHandler(repo, fsm(), eventsPublisher);

      const result = await handler.handle(envelope('CompleteWorksCouncilConsultation', { consultationId }));

      expect(result.success).toBe(true);
      expect(result.newState).toBe('COMPLETED');
      expect(repo.save).not.toHaveBeenCalled();
      expect(eventsPublisher.publishUncommitted).not.toHaveBeenCalled();
    });
  });

  describe('BlockWorksCouncilAction', () => {
    it('moves IN_PROGRESS -> BLOCKED and emits WorksCouncilActionBlocked', async () => {
      const consultation = consultationInState('IN_PROGRESS');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const eventsPublisher = publisher();
      const handler = new BlockWorksCouncilActionHandler(repo, fsm(), eventsPublisher);
      const blockingUntil = new Date('2026-12-01T00:00:00.000Z');

      const result = await handler.handle(envelope('BlockWorksCouncilAction', { consultationId, blockingUntil }));

      expect(result.success).toBe(true);
      expect(result.newState).toBe('BLOCKED');
      expect(result.eventsEmitted).toContain('WorksCouncilActionBlocked');
      expect(consultation.blockingUntil).toEqual(blockingUntil);
      expect(eventsPublisher.publishUncommitted).toHaveBeenCalledWith(
        expect.objectContaining({ id: consultationId }),
        tenantId,
        expect.anything(),
      );
    });

    it('rejects blocking a consultation that is still REQUIRED (not yet initiated)', async () => {
      const consultation = consultationInState('REQUIRED');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const eventsPublisher = publisher();
      const handler = new BlockWorksCouncilActionHandler(repo, fsm(), eventsPublisher);

      await expect(handler.handle(envelope('BlockWorksCouncilAction', { consultationId }))).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(eventsPublisher.publishUncommitted).not.toHaveBeenCalled();
    });

    it('is idempotent: retrying against an already-BLOCKED consultation returns success without re-invoking the transition', async () => {
      const consultation = consultationInState('BLOCKED');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const eventsPublisher = publisher();
      const handler = new BlockWorksCouncilActionHandler(repo, fsm(), eventsPublisher);

      const result = await handler.handle(envelope('BlockWorksCouncilAction', { consultationId }));

      expect(result.success).toBe(true);
      expect(result.newState).toBe('BLOCKED');
      expect(repo.save).not.toHaveBeenCalled();
      expect(eventsPublisher.publishUncommitted).not.toHaveBeenCalled();
    });
  });
});
