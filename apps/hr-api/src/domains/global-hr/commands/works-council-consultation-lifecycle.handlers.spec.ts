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

function envelope<T>(commandName: string, payload: T): HrCommandEnvelope<T> {
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
    idempotencyKey: `${commandName}-${Date.now()}`,
    correlationId: Uuid.generate(),
    reason: 'spec',
    payload,
    metadata: { clientType: 'API' },
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

function consultationInState(status: WorksCouncilConsultation['status']): WorksCouncilConsultation {
  return new WorksCouncilConsultation({
    id: consultationId,
    tenantId,
    countryCode: 'DE',
    legalEntityId,
    actionType: 'RESTRUCTURING',
    consultationType: 'INFORMATION_AND_CONSULTATION',
    status,
    aggregateVersion: 1,
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
      const handler = new InitiateWorksCouncilConsultationHandler(repo, fsm(), publisher());
      const deadlineDate = new Date('2026-09-01T00:00:00.000Z');

      const result = await handler.handle(envelope('InitiateWorksCouncilConsultation', { consultationId, deadlineDate }));

      expect(result.success).toBe(true);
      expect(result.newState).toBe('INITIATED');
      expect(result.eventsEmitted).toContain('WorksCouncilConsultationInitiated');
      expect(consultation.deadlineDate).toEqual(deadlineDate);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'INITIATED' }));
    });

    it('rejects initiating a consultation that is not REQUIRED', async () => {
      const consultation = consultationInState('INITIATED');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const handler = new InitiateWorksCouncilConsultationHandler(repo, fsm(), publisher());

      await expect(
        handler.handle(envelope('InitiateWorksCouncilConsultation', { consultationId, deadlineDate: new Date() })),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('StartWorksCouncilProgress', () => {
    it('moves INITIATED -> IN_PROGRESS and emits WorksCouncilConsultationProgressStarted', async () => {
      const consultation = consultationInState('INITIATED');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const handler = new StartWorksCouncilProgressHandler(repo, fsm(), publisher());

      const result = await handler.handle(envelope('StartWorksCouncilProgress', { consultationId }));

      expect(result.success).toBe(true);
      expect(result.newState).toBe('IN_PROGRESS');
      expect(result.eventsEmitted).toContain('WorksCouncilConsultationProgressStarted');
    });

    it('rejects starting progress on a REQUIRED consultation (must be initiated first)', async () => {
      const consultation = consultationInState('REQUIRED');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const handler = new StartWorksCouncilProgressHandler(repo, fsm(), publisher());

      await expect(handler.handle(envelope('StartWorksCouncilProgress', { consultationId }))).rejects.toBeInstanceOf(
        ValidationError,
      );
    });
  });

  describe('CompleteWorksCouncilConsultation', () => {
    it('moves IN_PROGRESS -> COMPLETED, clears blockingUntil, and emits the event', async () => {
      const consultation = consultationInState('IN_PROGRESS');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const handler = new CompleteWorksCouncilConsultationHandler(repo, fsm(), publisher());

      const result = await handler.handle(envelope('CompleteWorksCouncilConsultation', { consultationId }));

      expect(result.success).toBe(true);
      expect(result.newState).toBe('COMPLETED');
      expect(result.eventsEmitted).toContain('WorksCouncilConsultationCompleted');
      expect(consultation.isBlocking()).toBe(false);
    });

    it('rejects completing a consultation that has not started progress', async () => {
      const consultation = consultationInState('INITIATED');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const handler = new CompleteWorksCouncilConsultationHandler(repo, fsm(), publisher());

      await expect(
        handler.handle(envelope('CompleteWorksCouncilConsultation', { consultationId })),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('BlockWorksCouncilAction', () => {
    it('moves IN_PROGRESS -> BLOCKED and emits WorksCouncilActionBlocked', async () => {
      const consultation = consultationInState('IN_PROGRESS');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const handler = new BlockWorksCouncilActionHandler(repo, fsm(), publisher());
      const blockingUntil = new Date('2026-12-01T00:00:00.000Z');

      const result = await handler.handle(envelope('BlockWorksCouncilAction', { consultationId, blockingUntil }));

      expect(result.success).toBe(true);
      expect(result.newState).toBe('BLOCKED');
      expect(result.eventsEmitted).toContain('WorksCouncilActionBlocked');
      expect(consultation.blockingUntil).toEqual(blockingUntil);
    });

    it('rejects blocking a consultation that is still REQUIRED (not yet initiated)', async () => {
      const consultation = consultationInState('REQUIRED');
      const repo = { findById: vi.fn(async () => consultation), save: vi.fn() } as unknown as WorksCouncilConsultationRepository;
      const handler = new BlockWorksCouncilActionHandler(repo, fsm(), publisher());

      await expect(handler.handle(envelope('BlockWorksCouncilAction', { consultationId }))).rejects.toBeInstanceOf(
        ValidationError,
      );
    });
  });
});
