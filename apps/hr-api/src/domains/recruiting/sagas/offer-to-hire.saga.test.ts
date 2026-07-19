import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { getCurrentTenantId } from '@hcm/platform-core';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { OfferToHireSaga } from './offer-to-hire.saga.js';
import { uuidV5 } from './deterministic-uuid.js';

/** Mirrors the private `I9_CASE_ID_NAMESPACE` constant in `offer-to-hire.saga.ts`. */
const I9_CASE_ID_NAMESPACE = '9b1c9e2a-2f7a-5e3b-8f5a-6c2b7e4a1d90';

const tenantId = Uuid.generate();
const offerId = Uuid.generate();
const candidateId = Uuid.generate();
const requisitionId = Uuid.generate();
const positionId = Uuid.generate();

function offerAcceptedEvent(): HrEventEnvelope<{ offerId: Uuid; acceptedBy: Uuid }> {
  // onOfferAccepted only reads tenantId, payload.offerId and
  // metadata.correlationId - the rest of the envelope is irrelevant to the
  // saga's own logic (it is not passed through isOfferAcceptedEvent's zod
  // gate here since we invoke the saga's handler directly).
  return {
    tenantId,
    payload: { offerId, acceptedBy: Uuid.generate() },
    metadata: { correlationId: Uuid.generate() },
  } as unknown as HrEventEnvelope<{ offerId: Uuid; acceptedBy: Uuid }>;
}

function buildSaga(commandBus: { execute: ReturnType<typeof vi.fn> }) {
  const eventBus = { subscribe: vi.fn() };
  const offerRepo = {
    findById: vi.fn(async () => ({
      id: offerId,
      candidateId,
      requisitionId,
      startDate: new Date('2026-08-01T00:00:00.000Z'),
    })),
  };
  const candidateRepo = {
    findById: vi.fn(async () => ({
      firstName: 'Jordan',
      lastName: 'Rivera',
      email: 'jordan.rivera@example.com',
    })),
  };
  const requisitionRepo = {
    findById: vi.fn(async () => ({ positionId })),
  };

  const saga = new OfferToHireSaga(
    eventBus as never,
    commandBus as never,
    offerRepo as never,
    candidateRepo as never,
    requisitionRepo as never,
  );
  return saga as unknown as {
    onOfferAccepted(event: HrEventEnvelope<{ offerId: Uuid; acceptedBy: Uuid }>): Promise<void>;
  };
}

describe('OfferToHireSaga', () => {
  it('dispatches every command inside the accepted offer tenant context and derives a deterministic CreateI9Case id from the worker id', async () => {
    const capturedCommands: Array<{ commandName: string; payload: unknown }> = [];
    const observedTenantsDuringDispatch: Array<string | undefined> = [];
    const commandBus = {
      execute: vi.fn(async (command: { commandName: string; payload: unknown }) => {
        observedTenantsDuringDispatch.push(getCurrentTenantId()?.value);
        capturedCommands.push({ commandName: command.commandName, payload: command.payload });
        return { success: true };
      }),
    };

    const saga = buildSaga(commandBus);
    await saga.onOfferAccepted(offerAcceptedEvent());

    // Every command dispatched by the saga must run inside the accepted
    // offer's own tenant context so tenant-scoped repositories (e.g.
    // I9CaseRepository, which now sources tenant_id from AsyncLocalStorage)
    // don't reject the write.
    expect(observedTenantsDuringDispatch.length).toBeGreaterThan(0);
    expect(observedTenantsDuringDispatch.every((observed) => observed === tenantId.value)).toBe(true);

    const createWorkerCommand = capturedCommands.find((c) => c.commandName === 'CreateWorker');
    const createI9CaseCommand = capturedCommands.find((c) => c.commandName === 'CreateI9Case');
    expect(createWorkerCommand).toBeDefined();
    expect(createI9CaseCommand).toBeDefined();

    const workerId = (createWorkerCommand!.payload as { workerId: Uuid }).workerId;
    const i9CaseId = (createI9CaseCommand!.payload as { i9CaseId: Uuid }).i9CaseId;
    expect(i9CaseId.value).toBe(uuidV5(workerId.value, I9_CASE_ID_NAMESPACE));
  });

  it('derives the same CreateI9Case id for a retried step targeting the same worker id (uuidV5 determinism)', () => {
    const workerId = Uuid.generate().value;
    const first = uuidV5(workerId, I9_CASE_ID_NAMESPACE);
    const second = uuidV5(workerId, I9_CASE_ID_NAMESPACE);
    expect(first).toBe(second);
    expect(Uuid.isValid(first)).toBe(true);

    const otherWorkerId = Uuid.generate().value;
    expect(uuidV5(otherWorkerId, I9_CASE_ID_NAMESPACE)).not.toBe(first);
  });
});
