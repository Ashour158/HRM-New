import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { OffboardingInitiationSaga, OFFBOARDING_SYSTEM_ACTOR_ID } from './offboarding-initiation.saga.js';
import { OffboardingTemplateService } from '../services/offboarding-template.service.js';
import { OffboardingPlan } from '../aggregates/offboarding-plan.aggregate.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const eventId = new Uuid('00000000-0000-0000-0000-000000000002');
const workerId = new Uuid('00000000-0000-0000-0000-000000000003');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000004');
const terminatedBy = new Uuid('00000000-0000-0000-0000-000000000005');

function workerTerminatedEvent(payload: Record<string, unknown>, overrides: Partial<HrEventEnvelope<unknown>> = {}): HrEventEnvelope<unknown> {
  return {
    eventId,
    eventName: 'WorkerTerminated',
    eventSchemaVersion: 1,
    tenantId,
    aggregateType: 'WorkerProfile',
    aggregateId: workerId,
    payload,
    metadata: {
      correlationId,
      requestHash: 'test-request',
      clientType: 'SYSTEM',
    },
    privacy: {
      privacyLevel: 'INTERNAL',
      dataClasses: [],
      retentionClass: 'OPERATIONAL',
      crossBorderRestricted: false,
    },
    occurredAt: new Date('2026-07-13T00:00:00.000Z'),
    version: 1,
    ...overrides,
  } as unknown as HrEventEnvelope<unknown>;
}

function buildSaga() {
  const commandBus = { execute: vi.fn(async () => ({ success: true, data: {} })) };
  const planRepo = { findByWorker: vi.fn().mockResolvedValue(undefined) };
  const templates = new OffboardingTemplateService();
  const saga = new OffboardingInitiationSaga(
    { subscribe: vi.fn() } as never,
    { consume: vi.fn(), registerReplayHandler: vi.fn() } as never,
    commandBus as never,
    planRepo as never,
    templates,
  );
  const handle = (event: HrEventEnvelope<unknown>) =>
    (saga as unknown as { handle(event: HrEventEnvelope<unknown>): Promise<void> }).handle(event);
  return { commandBus, planRepo, handle };
}

describe('OffboardingInitiationSaga', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores events that are not WorkerTerminated', async () => {
    const { commandBus, handle } = buildSaga();

    await handle(workerTerminatedEvent({}, { eventName: 'WorkerActivated' }));

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('auto-creates an offboarding plan with the standard template for a resignation', async () => {
    const { commandBus, planRepo, handle } = buildSaga();

    await handle(workerTerminatedEvent({
      workerId: workerId.value,
      terminatedBy: terminatedBy.value,
      effectiveDate: '2026-08-01T00:00:00.000Z',
      reason: 'Employee resignation - relocating',
    }));

    expect(planRepo.findByWorker).toHaveBeenCalledWith(workerId);

    const commandNames = commandBus.execute.mock.calls.map((call) => call[0].commandName);
    expect(commandNames[0]).toBe('CreateOffboardingPlan');
    expect(commandNames[commandNames.length - 1]).toBe('StartOffboarding');
    expect(commandNames.filter((name) => name === 'CreateOffboardingTask').length).toBeGreaterThan(5);

    const createPlanCommand = commandBus.execute.mock.calls[0][0];
    expect(createPlanCommand.payload).toMatchObject({
      workerId,
      initiatedBy: terminatedBy,
      reasonCategory: 'RESIGNATION',
      reasonNotes: 'Employee resignation - relocating',
    });
    expect(createPlanCommand.actor).toMatchObject({ actorType: 'SYSTEM', actorId: OFFBOARDING_SYSTEM_ACTOR_ID });
  });

  it('picks the expedited template and categorizes layoffs correctly', async () => {
    const { commandBus, handle } = buildSaga();

    await handle(workerTerminatedEvent({
      reason: 'Position eliminated due to redundancy',
    }));

    const createPlanCommand = commandBus.execute.mock.calls[0][0];
    expect(createPlanCommand.payload).toMatchObject({ reasonCategory: 'LAYOFF_REDUNDANCY' });
    // Expedited template dispatches at least one CreateOffboardingTask for access revocation.
    const taskPayloads = commandBus.execute.mock.calls
      .filter((call) => call[0].commandName === 'CreateOffboardingTask')
      .map((call) => call[0].payload);
    expect(taskPayloads.some((payload: { category: string }) => payload.category === 'ACCESS_REVOCATION_CONFIRMATION')).toBe(true);
  });

  it('falls back to the system actor and event data when the payload is minimal', async () => {
    const { commandBus, handle } = buildSaga();

    await handle(workerTerminatedEvent({}));

    const createPlanCommand = commandBus.execute.mock.calls[0][0];
    expect(createPlanCommand.payload.workerId).toEqual(workerId);
    expect(createPlanCommand.payload.initiatedBy).toEqual(OFFBOARDING_SYSTEM_ACTOR_ID);
    expect(createPlanCommand.payload.reasonCategory).toBe('OTHER');
    expect(createPlanCommand.payload.lastWorkingDay).toEqual(new Date('2026-07-13T00:00:00.000Z'));
  });

  it('does not create a duplicate plan when an active plan already exists for the worker', async () => {
    const { commandBus, planRepo, handle } = buildSaga();
    planRepo.findByWorker.mockResolvedValue(OffboardingPlan.restore({
      id: Uuid.generate(),
      tenantId,
      workerId,
      lastWorkingDay: new Date('2026-08-01'),
      initiatedBy: terminatedBy,
      status: 'ACTIVE',
    }));

    await handle(workerTerminatedEvent({ reason: 'Employee resignation' }));

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('creates a new plan when the existing plan for the worker was cancelled', async () => {
    const { commandBus, planRepo, handle } = buildSaga();
    planRepo.findByWorker.mockResolvedValue(OffboardingPlan.restore({
      id: Uuid.generate(),
      tenantId,
      workerId,
      lastWorkingDay: new Date('2026-08-01'),
      initiatedBy: terminatedBy,
      status: 'CANCELLED',
    }));

    await handle(workerTerminatedEvent({ reason: 'Employee resignation' }));

    expect(commandBus.execute).toHaveBeenCalled();
  });
});
