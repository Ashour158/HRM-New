import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { VariableCompPlan, type VariableCompPlanStatus } from '../aggregates/variable-comp-plan.aggregate.js';
import { ActivateVariableCompPlanHandler } from './activate-variable-comp-plan.handler.js';
import { CloseVariableCompPlanHandler } from './close-variable-comp-plan.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const planId = new Uuid('00000000-0000-0000-0000-000000000060');
const actorId = new Uuid('00000000-0000-0000-0000-000000000061');

function buildPlan(status: VariableCompPlanStatus): VariableCompPlan {
  return new VariableCompPlan({
    id: planId,
    tenantId,
    name: 'Sales Commission Plan',
    planType: 'COMMISSION',
    targetPercentage: 15,
    maxPercentage: 30,
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
    aggregateType: 'VariableCompPlan',
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

describe('ActivateVariableCompPlanHandler', () => {
  it('activates a DRAFT plan', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const plan = buildPlan('DRAFT');
    findById.mockResolvedValue(plan);
    const handler = new ActivateVariableCompPlanHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('ActivateVariableCompPlan'));

    expect(result).toMatchObject({ success: true, newState: 'ACTIVE', eventsEmitted: expect.arrayContaining(['VariableCompPlanActivated']) });
    expect(save).toHaveBeenCalledWith(plan);
  });

  it('rejects activating an already ACTIVE plan', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildPlan('ACTIVE'));
    const handler = new ActivateVariableCompPlanHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('ActivateVariableCompPlan'))).rejects.toThrow(/Cannot activate VariableCompPlan from state ACTIVE/);
  });
});

describe('CloseVariableCompPlanHandler', () => {
  it('closes an ACTIVE plan', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const plan = buildPlan('ACTIVE');
    findById.mockResolvedValue(plan);
    const handler = new CloseVariableCompPlanHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('CloseVariableCompPlan'));

    expect(result).toMatchObject({ success: true, newState: 'CLOSED', eventsEmitted: expect.arrayContaining(['VariableCompPlanClosed']) });
    expect(save).toHaveBeenCalledWith(plan);
  });

  it('rejects closing a DRAFT plan', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildPlan('DRAFT'));
    const handler = new CloseVariableCompPlanHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('CloseVariableCompPlan'))).rejects.toThrow(/Cannot close VariableCompPlan from state DRAFT/);
  });
});
