import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { HrServiceDeliveryController } from './hr-service-delivery.controller.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('00000000-0000-0000-0000-000000000012');
const caseId = new Uuid('00000000-0000-4000-8000-000000000999');

function request(): Request {
  return {
    tenantId: tenantId.value,
    actor: {
      actorType: 'USER',
      actorId: workerId,
      roles: ['EMPLOYEE'],
      permissions: [],
      mfaAuthenticated: true,
      email: 'employee@example.com',
    },
  } as unknown as Request;
}

function commandResult() {
  return {
    success: true,
    data: {
      hrServiceCaseId: caseId.value,
      caseNumber: 'HR-20260602-ABC12345',
      caseType: 'HR_LETTER',
      priority: 'MEDIUM',
      status: 'OPEN',
    },
    commandId: Uuid.generate(),
    correlationId: Uuid.generate(),
    aggregateId: caseId,
    newState: 'OPEN',
    newVersion: 0,
    allowedNextActions: [],
    eventsEmitted: ['HrServiceCaseOpened'],
    auditRecordId: Uuid.generate(),
  };
}

function controller(overrides: Record<string, unknown> = {}) {
  const workerRepo = {
    findByIdForTenant: vi.fn().mockResolvedValue(undefined),
    findByEmailForTenant: vi.fn().mockResolvedValue({
      id: workerId,
      tenantId,
      employeeNumber: 'EMP-100',
      firstName: 'Regular',
      lastName: 'Employee',
      email: { toString: () => 'employee@example.com' },
      status: 'ACTIVE',
    }),
  };
  const serviceCaseRepo = {
    findByRequester: vi.fn().mockResolvedValue([]),
    findByTenant: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
  };
  const commandBus = {
    execute: vi.fn().mockResolvedValue(commandResult()),
  };

  return {
    commandBus,
    workerRepo,
    serviceCaseRepo,
    instance: new HrServiceDeliveryController(
      (overrides.commandBus ?? commandBus) as never,
      (overrides.workerRepo ?? workerRepo) as never,
      (overrides.serviceCaseRepo ?? serviceCaseRepo) as never,
      {} as never,
      {} as never,
      { findActive: vi.fn().mockResolvedValue([]), findByTenant: vi.fn().mockResolvedValue([]), findById: vi.fn() } as never,
      {} as never,
    ),
  };
}

describe('HrServiceDeliveryController employee services', () => {
  it('opens an employee service case through the command bus with the linked worker as requester', async () => {
    const { instance, commandBus } = controller();

    const result = await instance.openHrServiceCase({
      caseType: 'HR_LETTER',
      priority: 'MEDIUM',
      description: 'I need an employment letter for the bank.',
    }, request());

    expect(result.success).toBe(true);
    const command = commandBus.execute.mock.calls[0][0];
    expect(command.actor).toMatchObject({ roles: ['EMPLOYEE'], email: 'employee@example.com' });
    expect(command.subjectWorkerId.value).toBe(workerId.value);
    expect(command.payload).toMatchObject({
      requesterWorkerId: workerId.value,
      caseType: 'HR_LETTER',
      priority: 'MEDIUM',
      description: 'I need an employment letter for the bank.',
    });
    expect(command.payload.caseNumber).toMatch(/^HR-\d{8}-[A-F0-9]{8}$/);
  });

  it('lists only the authenticated employee service cases for employee users', async () => {
    const { instance, serviceCaseRepo } = controller();

    await instance.listMyHrServiceCases(request());

    expect(serviceCaseRepo.findByRequester).toHaveBeenCalledWith(tenantId, workerId);
    expect(serviceCaseRepo.findByTenant).not.toHaveBeenCalled();
  });
});
