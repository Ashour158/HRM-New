import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import type { HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { StatutoryLeaveType } from '../aggregates/statutory-leave-type.aggregate.js';
import {
  UpdateStatutoryLeaveTypeHandler,
  SupersedeStatutoryLeaveTypeHandler,
} from './statutory-leave-type-lifecycle.handlers.js';
import type { StatutoryLeaveTypeRepository } from '../repositories/statutory-leave-type.repository.js';
import type { GlobalHrEventsPublisher } from '../events/global-hr-events.publisher.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000010');
const leaveTypeId = new Uuid('00000000-0000-0000-0000-000000000031');

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
    aggregateType: 'StatutoryLeaveType',
    aggregateId: leaveTypeId,
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
    getAllowedActionsFromState: vi.fn(() => ['UpdateStatutoryLeaveType', 'SupersedeStatutoryLeaveType']),
  } as unknown as FsmFramework;
}

function publisher() {
  return { publishUncommitted: vi.fn(async () => undefined) } as unknown as GlobalHrEventsPublisher;
}

function activeLeaveType(): StatutoryLeaveType {
  return new StatutoryLeaveType({
    id: leaveTypeId,
    tenantId,
    countryCode: 'FR',
    leaveTypeCode: 'ANNUAL',
    leaveTypeName: 'Congés payés',
    minimumEntitlement: 25,
    unit: 'DAYS',
    carryoverAllowed: true,
    maxCarryover: 5,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    status: 'ACTIVE',
    aggregateVersion: 1,
  });
}

function supersededLeaveType(): StatutoryLeaveType {
  return new StatutoryLeaveType({
    id: leaveTypeId,
    tenantId,
    countryCode: 'FR',
    leaveTypeCode: 'ANNUAL',
    leaveTypeName: 'Congés payés',
    minimumEntitlement: 25,
    unit: 'DAYS',
    carryoverAllowed: true,
    maxCarryover: 5,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    status: 'SUPERSEDED',
    aggregateVersion: 2,
  });
}

describe('StatutoryLeaveType lifecycle command handlers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('updates mutable fields on an ACTIVE leave type and emits StatutoryLeaveTypeUpdated', async () => {
    const leaveType = activeLeaveType();
    const repo = { findById: vi.fn(async () => leaveType), save: vi.fn() } as unknown as StatutoryLeaveTypeRepository;
    const handler = new UpdateStatutoryLeaveTypeHandler(repo, fsm(), publisher());

    const result = await handler.handle(
      envelope('UpdateStatutoryLeaveType', { leaveTypeId, minimumEntitlement: 27, maxCarryover: 7 }),
    );

    expect(result.success).toBe(true);
    expect(result.newState).toBe('ACTIVE');
    expect(result.eventsEmitted).toContain('StatutoryLeaveTypeUpdated');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ minimumEntitlement: 27, maxCarryover: 7 }),
    );
  });

  it('does not emit an event when the update payload changes nothing', async () => {
    const leaveType = activeLeaveType();
    const repo = { findById: vi.fn(async () => leaveType), save: vi.fn() } as unknown as StatutoryLeaveTypeRepository;
    const handler = new UpdateStatutoryLeaveTypeHandler(repo, fsm(), publisher());

    const result = await handler.handle(envelope('UpdateStatutoryLeaveType', { leaveTypeId }));

    expect(result.success).toBe(true);
    expect(result.eventsEmitted).not.toContain('StatutoryLeaveTypeUpdated');
  });

  it('rejects updating a SUPERSEDED leave type', async () => {
    const leaveType = supersededLeaveType();
    const repo = { findById: vi.fn(async () => leaveType), save: vi.fn() } as unknown as StatutoryLeaveTypeRepository;
    const handler = new UpdateStatutoryLeaveTypeHandler(repo, fsm(), publisher());

    await expect(
      handler.handle(envelope('UpdateStatutoryLeaveType', { leaveTypeId, minimumEntitlement: 30 })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('supersedes an ACTIVE leave type', async () => {
    const leaveType = activeLeaveType();
    const repo = { findById: vi.fn(async () => leaveType), save: vi.fn() } as unknown as StatutoryLeaveTypeRepository;
    const handler = new SupersedeStatutoryLeaveTypeHandler(repo, fsm(), publisher());

    const result = await handler.handle(envelope('SupersedeStatutoryLeaveType', { leaveTypeId }));

    expect(result.success).toBe(true);
    expect(result.newState).toBe('SUPERSEDED');
    expect(result.eventsEmitted).toContain('StatutoryLeaveTypeSuperseded');
  });

  it('rejects superseding an already-superseded leave type', async () => {
    const leaveType = supersededLeaveType();
    const repo = { findById: vi.fn(async () => leaveType), save: vi.fn() } as unknown as StatutoryLeaveTypeRepository;
    const handler = new SupersedeStatutoryLeaveTypeHandler(repo, fsm(), publisher());

    await expect(handler.handle(envelope('SupersedeStatutoryLeaveType', { leaveTypeId }))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
