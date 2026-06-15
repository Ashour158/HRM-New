import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { CompensationController } from './compensation.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const planId = '00000000-0000-0000-0000-000000000100';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['COMPENSATION_ADMIN'],
    permissions: ['COMPENSATION_WRITE', 'COMPENSATION_READ'],
    email: 'comp.admin@example.com',
    mfaAuthenticated: true,
  };
}

function request(): Request {
  return {
    tenantId,
    actor: actor(),
    headers: {},
  } as unknown as Request;
}

function buildController() {
  const commandBus = { execute: vi.fn(async () => ({ success: true })) };
  const planRepo = { findById: vi.fn(), findByTenant: vi.fn() };
  const bandRepo = { findById: vi.fn(), findByTenant: vi.fn() };
  const changeRepo = { findById: vi.fn(), findByWorker: vi.fn() };
  const bonusCycleRepo = { findById: vi.fn(), findByTenant: vi.fn() };
  const equityGrantRepo = { findById: vi.fn(), findByWorker: vi.fn() };
  const variableCompPlanRepo = { findById: vi.fn(), findByTenant: vi.fn() };
  const payScaleRepo = { findById: vi.fn(), findByTenant: vi.fn() };
  const totalCompStatementRepo = { findById: vi.fn(), findByWorker: vi.fn() };
  const planFsm = { getAllowedActions: vi.fn(() => ['Activate']) };
  const fsm = { getAllowedActions: vi.fn(() => []) };

  const controller = new CompensationController(
    commandBus as unknown as CommandBus,
    planRepo as never,
    bandRepo as never,
    changeRepo as never,
    bonusCycleRepo as never,
    equityGrantRepo as never,
    variableCompPlanRepo as never,
    payScaleRepo as never,
    totalCompStatementRepo as never,
    planFsm as never,
    fsm as never,
    fsm as never,
    fsm as never,
    fsm as never,
    fsm as never,
    fsm as never,
    fsm as never,
  );

  return { controller, commandBus, planRepo, planFsm };
}

describe('CompensationController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates, activates, reads, and exposes FSM actions for compensation plans', async () => {
    const { controller, commandBus, planRepo, planFsm } = buildController();
    const persistedPlan = {
      id: new Uuid(planId),
      tenantId: new Uuid(tenantId),
      name: 'Executive Compensation',
      status: 'DRAFT',
      aggregateVersion: 3,
    };
    planRepo.findById.mockResolvedValue(persistedPlan);

    await controller.createPlan({
      planId,
      name: 'Executive Compensation',
      planType: 'SALARY_REVIEW',
      currency: 'USD',
      effectiveFrom: new Date('2026-01-01'),
    }, request());
    await controller.activatePlan(planId, request());
    await expect(controller.getPlan(planId, request())).resolves.toBe(persistedPlan);
    await expect(controller.getPlanAllowedActions(planId, request())).resolves.toEqual({ allowedActions: ['Activate'] });

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'CreateCompensationPlan',
      aggregateType: 'CompensationPlan',
      payload: expect.objectContaining({
        planId: new Uuid(planId),
        name: 'Executive Compensation',
        planType: 'SALARY_REVIEW',
      }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'ActivateCompensationPlan',
      aggregateType: 'CompensationPlan',
      aggregateId: new Uuid(planId),
      payload: { planId: new Uuid(planId) },
    }));
    expect(planRepo.findById).toHaveBeenCalledWith(new Uuid(planId));
    expect(planFsm.getAllowedActions).toHaveBeenCalledWith('DRAFT');
  });
});
