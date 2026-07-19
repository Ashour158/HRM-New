import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CompensationPlan, type CompensationPlanStatus } from '../aggregates/compensation-plan.aggregate.js';
import { SuspendCompensationPlanHandler } from './suspend-compensation-plan.handler.js';
import { CloseCompensationPlanHandler } from './close-compensation-plan.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const planId = new Uuid('00000000-0000-0000-0000-000000000020');
const actorId = new Uuid('00000000-0000-0000-0000-000000000021');

function buildPlan(status: CompensationPlanStatus): CompensationPlan {
  return new CompensationPlan({
    id: planId,
    tenantId,
    name: 'Annual Merit Cycle',
    planType: 'MERIT',
    currency: 'USD',
    status,
  });
}

function buildCommand(commandName: string): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: { actorType: 'USER', actorId, roles: ['COMPENSATION_ADMIN'], permissions: [], mfaAuthenticated: true },
    aggregateType: 'CompensationPlan',
    aggregateId: planId,
    idempotencyKey: `${commandName}-test`,
    correlationId: Uuid.generate(),
    reason: 'test',
    payload: { planId },
    metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
  };
}

function deps() {
  const findById = vi.fn();
  const save = vi.fn();
  const repo = { findById, save };
  const publisher = { publishAll: vi.fn() };
  const fsm = { getAllowedActions: vi.fn().mockReturnValue([]) };
  return { repo, publisher, fsm, findById, save };
}

describe('SuspendCompensationPlanHandler', () => {
  it('suspends an ACTIVE plan', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const plan = buildPlan('ACTIVE');
    findById.mockResolvedValue(plan);
    const handler = new SuspendCompensationPlanHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('SuspendCompensationPlan'));

    expect(result).toMatchObject({ success: true, newState: 'SUSPENDED', eventsEmitted: expect.arrayContaining(['CompensationPlanSuspended']) });
    expect(save).toHaveBeenCalledWith(plan);
  });

  it('rejects suspending a DRAFT plan', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildPlan('DRAFT'));
    const handler = new SuspendCompensationPlanHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('SuspendCompensationPlan'))).rejects.toThrow(/Cannot suspend CompensationPlan from state DRAFT/);
  });
});

describe('CloseCompensationPlanHandler', () => {
  it('closes an ACTIVE plan', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const plan = buildPlan('ACTIVE');
    findById.mockResolvedValue(plan);
    const handler = new CloseCompensationPlanHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('CloseCompensationPlan'));

    expect(result).toMatchObject({ success: true, newState: 'CLOSED', eventsEmitted: expect.arrayContaining(['CompensationPlanClosed']) });
    expect(save).toHaveBeenCalledWith(plan);
  });

  it('closes a SUSPENDED plan', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const plan = buildPlan('SUSPENDED');
    findById.mockResolvedValue(plan);
    const handler = new CloseCompensationPlanHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('CloseCompensationPlan'));

    expect(result.newState).toBe('CLOSED');
    expect(save).toHaveBeenCalledWith(plan);
  });

  it('rejects closing a DRAFT plan', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildPlan('DRAFT'));
    const handler = new CloseCompensationPlanHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('CloseCompensationPlan'))).rejects.toThrow(/Cannot close CompensationPlan from state DRAFT/);
  });
});
