import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { BonusCycle, type BonusCycleStatus } from '../aggregates/bonus-cycle.aggregate.js';
import { ActivateBonusCycleHandler } from './activate-bonus-cycle.handler.js';
import { StartCalculationBonusCycleHandler } from './start-calculation-bonus-cycle.handler.js';
import { StartReviewBonusCycleHandler } from './start-review-bonus-cycle.handler.js';
import { ApproveBonusCycleHandler } from './approve-bonus-cycle.handler.js';
import { MarkPaidBonusCycleHandler } from './mark-paid-bonus-cycle.handler.js';
import { CloseBonusCycleHandler } from './close-bonus-cycle.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const cycleId = new Uuid('00000000-0000-0000-0000-000000000030');
const actorId = new Uuid('00000000-0000-0000-0000-000000000031');

function buildCycle(status: BonusCycleStatus): BonusCycle {
  return new BonusCycle({
    id: cycleId,
    tenantId,
    cycleName: 'FY26 Annual Bonus',
    cycleYear: 2026,
    eligibilityDate: new Date('2026-01-01'),
    paymentDate: new Date('2026-03-15'),
    totalPoolAmount: 5_000_000,
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
    aggregateType: 'BonusCycle',
    aggregateId: cycleId,
    idempotencyKey: `${commandName}-test`,
    correlationId: Uuid.generate(),
    reason: 'test',
    payload: { cycleId },
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

describe('ActivateBonusCycleHandler', () => {
  it('activates a DRAFT cycle', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const cycle = buildCycle('DRAFT');
    findById.mockResolvedValue(cycle);
    const handler = new ActivateBonusCycleHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('ActivateBonusCycle'));

    expect(result).toMatchObject({ success: true, newState: 'ACTIVE', eventsEmitted: expect.arrayContaining(['BonusCycleActivated']) });
    expect(save).toHaveBeenCalledWith(cycle);
  });

  it('rejects activating a non-DRAFT cycle', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildCycle('ACTIVE'));
    const handler = new ActivateBonusCycleHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('ActivateBonusCycle'))).rejects.toThrow(/Cannot activate BonusCycle from state ACTIVE/);
  });
});

describe('StartCalculationBonusCycleHandler', () => {
  it('moves an ACTIVE cycle into CALCULATION', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const cycle = buildCycle('ACTIVE');
    findById.mockResolvedValue(cycle);
    const handler = new StartCalculationBonusCycleHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('StartCalculationBonusCycle'));

    expect(result).toMatchObject({ success: true, newState: 'CALCULATION', eventsEmitted: expect.arrayContaining(['BonusCycleCalculated']) });
    expect(save).toHaveBeenCalledWith(cycle);
  });

  it('rejects starting calculation from DRAFT', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildCycle('DRAFT'));
    const handler = new StartCalculationBonusCycleHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('StartCalculationBonusCycle'))).rejects.toThrow(/Cannot start calculation for BonusCycle from state DRAFT/);
  });
});

describe('StartReviewBonusCycleHandler', () => {
  it('moves a CALCULATION cycle into REVIEW', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const cycle = buildCycle('CALCULATION');
    findById.mockResolvedValue(cycle);
    const handler = new StartReviewBonusCycleHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('StartReviewBonusCycle'));

    expect(result).toMatchObject({ success: true, newState: 'REVIEW', eventsEmitted: expect.arrayContaining(['BonusCycleReviewed']) });
    expect(save).toHaveBeenCalledWith(cycle);
  });

  it('rejects starting review from ACTIVE', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildCycle('ACTIVE'));
    const handler = new StartReviewBonusCycleHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('StartReviewBonusCycle'))).rejects.toThrow(/Cannot start review for BonusCycle from state ACTIVE/);
  });
});

describe('ApproveBonusCycleHandler', () => {
  it('approves a REVIEW cycle', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const cycle = buildCycle('REVIEW');
    findById.mockResolvedValue(cycle);
    const handler = new ApproveBonusCycleHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('ApproveBonusCycle'));

    expect(result).toMatchObject({ success: true, newState: 'APPROVED', eventsEmitted: expect.arrayContaining(['BonusCycleApproved']) });
    expect(save).toHaveBeenCalledWith(cycle);
  });

  it('rejects approving a CALCULATION cycle', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildCycle('CALCULATION'));
    const handler = new ApproveBonusCycleHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('ApproveBonusCycle'))).rejects.toThrow(/Cannot approve BonusCycle from state CALCULATION/);
  });
});

describe('MarkPaidBonusCycleHandler', () => {
  it('marks an APPROVED cycle as PAID', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const cycle = buildCycle('APPROVED');
    findById.mockResolvedValue(cycle);
    const handler = new MarkPaidBonusCycleHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('MarkPaidBonusCycle'));

    expect(result).toMatchObject({ success: true, newState: 'PAID', eventsEmitted: expect.arrayContaining(['BonusCyclePaid']) });
    expect(save).toHaveBeenCalledWith(cycle);
  });

  it('rejects marking a REVIEW cycle as paid', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildCycle('REVIEW'));
    const handler = new MarkPaidBonusCycleHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('MarkPaidBonusCycle'))).rejects.toThrow(/Cannot mark BonusCycle as paid from state REVIEW/);
  });
});

describe('CloseBonusCycleHandler', () => {
  it('closes a PAID cycle and emits BonusCycleClosed', async () => {
    const { repo, publisher, fsm, findById, save } = deps();
    const cycle = buildCycle('PAID');
    findById.mockResolvedValue(cycle);
    const handler = new CloseBonusCycleHandler(repo as never, publisher as never, fsm as never);

    const result = await handler.handle(buildCommand('CloseBonusCycle'));

    expect(result).toMatchObject({ success: true, newState: 'CLOSED', eventsEmitted: expect.arrayContaining(['BonusCycleClosed']) });
    expect(save).toHaveBeenCalledWith(cycle);
  });

  it('rejects closing an APPROVED (not yet paid) cycle', async () => {
    const { repo, publisher, fsm, findById } = deps();
    findById.mockResolvedValue(buildCycle('APPROVED'));
    const handler = new CloseBonusCycleHandler(repo as never, publisher as never, fsm as never);

    await expect(handler.handle(buildCommand('CloseBonusCycle'))).rejects.toThrow(/Cannot close BonusCycle from state APPROVED/);
  });
});
