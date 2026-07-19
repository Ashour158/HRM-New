import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { PositionControlController } from './position-control.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const positionId = '00000000-0000-0000-0000-000000000400';
const departmentId = '00000000-0000-0000-0000-000000000401';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['POSITION_ADMIN'],
    permissions: ['POSITION_WRITE', 'POSITION_READ'],
    email: 'position.admin@example.com',
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
  const positionRepo = { findById: vi.fn(), findAll: vi.fn(), findVacant: vi.fn() };
  const headcountRepo = { findById: vi.fn(), findAll: vi.fn(), findPendingApproval: vi.fn() };
  const budgetRepo = { findById: vi.fn(), findAll: vi.fn(), findByDepartmentAndYear: vi.fn() };
  const fsmFramework = { getAllowedActionsFromState: vi.fn(() => ['Activate']) };
  const controller = new PositionControlController(
    commandBus as unknown as CommandBus,
    positionRepo as never,
    headcountRepo as never,
    budgetRepo as never,
    fsmFramework as never,
  );

  return { controller, commandBus, positionRepo, budgetRepo, fsmFramework };
}

describe('PositionControlController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates, activates, reads, and exposes FSM actions for positions', async () => {
    const { controller, commandBus, positionRepo, fsmFramework } = buildController();
    const persistedPosition = {
      id: new Uuid(positionId),
      tenantId: new Uuid(tenantId),
      positionCode: 'RN-001',
      title: 'Registered Nurse',
      status: 'DRAFT',
      departmentId: new Uuid(departmentId),
      legalEntityId: undefined,
      jobFamily: 'Clinical',
      jobLevel: 'L2',
      employmentType: 'FULL_TIME',
      filledByWorkerId: undefined,
      headcountRequestId: undefined,
      version: 1,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
    positionRepo.findById.mockResolvedValue(persistedPosition);

    await controller.createPosition({
      positionCode: 'RN-001',
      title: 'Registered Nurse',
      departmentId,
      jobFamily: 'Clinical',
      jobLevel: 'L2',
      employmentType: 'FULL_TIME',
    }, request());
    await controller.activatePosition(positionId, request());
    await expect(controller.getPosition(positionId, request())).resolves.toMatchObject({
      id: positionId,
      positionCode: 'RN-001',
      status: 'DRAFT',
      departmentId,
    });
    await expect(controller.getAllowedActions(positionId, request())).resolves.toEqual({
      positionId,
      currentState: 'DRAFT',
      allowedActions: ['Activate'],
    });

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'CreatePosition',
      aggregateType: 'position',
      payload: expect.objectContaining({ positionCode: 'RN-001', title: 'Registered Nurse' }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'ActivatePosition',
      aggregateType: 'position',
      aggregateId: new Uuid(positionId),
      expectedState: 'DRAFT',
      payload: { positionId },
    }));
    expect(positionRepo.findById).toHaveBeenCalledWith(new Uuid(positionId));
    expect(fsmFramework.getAllowedActionsFromState).toHaveBeenCalledWith('DRAFT', 'position');
  });
});
