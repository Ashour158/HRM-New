import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CompensationChange } from '../aggregates/compensation-change.aggregate.js';
import { MakeEffectiveCompensationChangeHandler } from './make-effective-compensation-change.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('00000000-0000-0000-0000-000000000002');
const changeId = new Uuid('00000000-0000-0000-0000-000000000003');
const actorId = new Uuid('00000000-0000-0000-0000-000000000004');

function buildChange(status: 'APPROVED' | 'DRAFT' | 'EFFECTIVE'): CompensationChange {
  return new CompensationChange({
    id: changeId,
    tenantId,
    workerId,
    changeType: 'MERIT_INCREASE',
    newAmount: 100000,
    currency: 'USD',
    effectiveDate: new Date('2026-01-01'),
    status,
  });
}

function buildCommand(): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName: 'MakeEffectiveCompensationChange',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['COMPENSATION_ADMIN'],
      permissions: [],
      mfaAuthenticated: true,
    },
    aggregateType: 'CompensationChange',
    aggregateId: changeId,
    idempotencyKey: 'make-effective-compensation-change-test',
    correlationId: Uuid.generate(),
    reason: 'test',
    payload: { changeId },
    metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
  };
}

function buildHandler() {
  const findById = vi.fn();
  const save = vi.fn();
  const repo = { findById, save };
  const publisher = { publishAll: vi.fn() };
  const fsm = { getAllowedActions: vi.fn().mockReturnValue([]) };
  const handler = new MakeEffectiveCompensationChangeHandler(repo as never, publisher as never, fsm as never);
  return { handler, findById, save };
}

describe('MakeEffectiveCompensationChangeHandler', () => {
  it('transitions an APPROVED change to EFFECTIVE and emits CompensationChangeEffective', async () => {
    const { handler, findById, save } = buildHandler();
    const record = buildChange('APPROVED');
    findById.mockResolvedValue(record);

    const result = await handler.handle(buildCommand());

    expect(result).toMatchObject({
      success: true,
      data: { changeId: changeId.value, status: 'EFFECTIVE' },
      newState: 'EFFECTIVE',
      eventsEmitted: expect.arrayContaining(['CompensationChangeEffective']),
    });
    expect(save).toHaveBeenCalledWith(record);
    expect(record.status).toBe('EFFECTIVE');
  });

  it('rejects the transition when the change is not APPROVED', async () => {
    const { handler, findById } = buildHandler();
    findById.mockResolvedValue(buildChange('DRAFT'));

    await expect(handler.handle(buildCommand())).rejects.toThrow(/Cannot make CompensationChange effective from state DRAFT/);
  });

  it('throws when the change does not exist', async () => {
    const { handler, findById } = buildHandler();
    findById.mockResolvedValue(undefined);

    await expect(handler.handle(buildCommand())).rejects.toThrow('CompensationChange not found');
  });
});
