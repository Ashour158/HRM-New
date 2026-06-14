import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { HrServiceDeliveryController } from './hr-service-delivery.controller.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('00000000-0000-0000-0000-000000000012');
const otherWorkerId = new Uuid('00000000-0000-0000-0000-000000000013');
const caseId = new Uuid('00000000-0000-4000-8000-000000000999');
const taskId = new Uuid('00000000-0000-4000-8000-000000000998');
const catalogItemId = new Uuid('00000000-0000-4000-8000-000000000997');
const knowledgeArticleId = new Uuid('00000000-0000-4000-8000-000000000996');

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
  const hrCaseTaskRepo = {
    findById: vi.fn().mockResolvedValue({
      id: taskId,
      tenantId,
      caseId,
      title: 'Upload supporting document',
      assignedTo: otherWorkerId,
      status: 'PENDING',
      aggregateVersion: 1,
    }),
  };
  const hrKnowledgeArticleRepo = {
    findById: vi.fn().mockResolvedValue({
      id: knowledgeArticleId,
      tenantId,
      title: 'Payroll FAQ',
      content: 'Confidential HR operations draft.',
      category: 'PAYROLL',
      status: 'DRAFT',
      aggregateVersion: 1,
    }),
  };
  const hrServiceCatalogItemRepo = {
    findActive: vi.fn().mockResolvedValue([]),
    findByTenant: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue({
      id: catalogItemId,
      tenantId,
      serviceCode: 'PAYROLL_QUESTION',
      serviceName: 'Payroll question',
      description: 'Ask payroll a question',
      category: 'PAYROLL',
      slaHours: 24,
      fulfillmentProcess: 'Payroll team review',
      status: 'SUSPENDED',
      aggregateVersion: 1,
    }),
  };
  const hrCaseSlaInstanceRepo = {
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
      (overrides.hrCaseTaskRepo ?? hrCaseTaskRepo) as never,
      (overrides.hrKnowledgeArticleRepo ?? hrKnowledgeArticleRepo) as never,
      (overrides.hrServiceCatalogItemRepo ?? hrServiceCatalogItemRepo) as never,
      (overrides.hrCaseSlaInstanceRepo ?? hrCaseSlaInstanceRepo) as never,
    ),
    hrCaseTaskRepo,
    hrKnowledgeArticleRepo,
    hrServiceCatalogItemRepo,
    hrCaseSlaInstanceRepo,
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

  it('lists the tenant HR service case queue for service admins only inside the request tenant', async () => {
    const { instance, serviceCaseRepo } = controller();
    const adminReq = {
      ...request(),
      actor: {
        actorType: 'USER',
        actorId: workerId,
        roles: ['HR_ADMIN'],
        permissions: [],
        mfaAuthenticated: true,
        email: 'hr.admin@example.com',
      },
    } as unknown as Request;

    await instance.listHrServiceCasesForTenant(tenantId.value, adminReq);

    expect(serviceCaseRepo.findByTenant).toHaveBeenCalledWith(tenantId);
    await expect(instance.listHrServiceCasesForTenant(otherWorkerId.value, adminReq)).rejects.toThrow('Tenant mismatch');
    await expect(instance.listHrServiceCasesForTenant(tenantId.value, request())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects employee attempts to mutate HR service catalog items', async () => {
    const { instance, commandBus } = controller();

    await expect(instance.createHrServiceCatalogItem({
      serviceCode: 'PAYROLL_QUESTION',
      serviceName: 'Payroll question',
      description: 'Ask payroll a question',
      category: 'PAYROLL',
      slaHours: 24,
      fulfillmentProcess: 'Payroll team review',
    }, request())).rejects.toBeInstanceOf(ForbiddenException);

    await expect(instance.activateHrServiceCatalogItem(catalogItemId.value, request())).rejects.toBeInstanceOf(ForbiddenException);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('rejects employee attempts to create HR case tasks', async () => {
    const { instance, commandBus } = controller();

    await expect(instance.createHrCaseTask({
      caseId: caseId.value,
      title: 'Verify payroll evidence',
      assignedTo: workerId.value,
    }, request())).rejects.toBeInstanceOf(ForbiddenException);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('rejects employee attempts to mutate tasks assigned to another worker', async () => {
    const { instance, commandBus } = controller();

    await expect(instance.startHrCaseTask(taskId.value, request())).rejects.toBeInstanceOf(ForbiddenException);
    await expect(instance.completeHrCaseTask(taskId.value, request())).rejects.toBeInstanceOf(ForbiddenException);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('rejects employee attempts to mutate HR knowledge articles', async () => {
    const { instance, commandBus } = controller();

    await expect(instance.createHrKnowledgeArticle({
      title: 'Payroll FAQ',
      content: 'Confidential HR operations draft.',
      category: 'PAYROLL',
    }, request())).rejects.toBeInstanceOf(ForbiddenException);

    await expect(instance.publishHrKnowledgeArticle(knowledgeArticleId.value, request())).rejects.toBeInstanceOf(ForbiddenException);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
