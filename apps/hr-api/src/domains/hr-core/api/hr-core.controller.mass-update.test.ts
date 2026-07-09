import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { HrCoreController } from './hr-core.controller.js';

function adminReq(): Request {
  return {
    tenantId: '00000000-0000-0000-0000-000000000001',
    actor: {
      actorType: 'USER',
      actorId: new Uuid('00000000-0000-0000-0000-000000000010'),
      roles: ['HR_ADMIN'],
      permissions: ['WORKER_CREATE'],
      mfaAuthenticated: true,
    },
  } as unknown as Request;
}

function buildController() {
  const commandBus = { execute: vi.fn().mockResolvedValue({
    success: true,
    data: { workerId: '11111111-1111-1111-1111-111111111111', status: 'DRAFT' },
    aggregateId: new Uuid('11111111-1111-1111-1111-111111111111'),
  }) };
  const workerRepo = {
    findByEmployeeNumberForTenant: vi.fn().mockResolvedValue(undefined),
    findByEmailForTenant: vi.fn().mockResolvedValue(undefined),
    findByEmployeeNumbersForTenant: vi.fn(async (employeeNumbers: string[]) => {
      const map = new Map();
      for (const employeeNumber of employeeNumbers) {
        const worker = await workerRepo.findByEmployeeNumberForTenant(employeeNumber);
        if (worker) map.set(employeeNumber, worker);
      }
      return map;
    }),
    findByEmailsForTenant: vi.fn(async (emails: string[]) => {
      const map = new Map();
      for (const email of emails) {
        const worker = await workerRepo.findByEmailForTenant(email);
        if (worker) map.set(email, worker);
      }
      return map;
    }),
  };
  const controller = new HrCoreController(
    commandBus as never,
    workerRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { getAllowedActionsFromState: vi.fn(() => []) } as never,
  );
  return { controller, commandBus, workerRepo };
}

describe('HrCoreController employee migration', () => {
  const legalEntityId = '22222222-2222-4222-8222-222222222222';
  const departmentId = '33333333-3333-4333-8333-333333333333';
  const managerId = '44444444-4444-4444-8444-444444444444';

  it('previews missing employee IDs as creatable when required fields are present', async () => {
    const { controller } = buildController();

    const result = await controller.employeeMassUpdatePreview({
      rows: [{
        employeeId: 'EMP-900',
        firstName: 'Nour',
        lastName: 'Saleh',
        workEmail: 'nour.saleh@example.com',
        jobTitle: 'PAYROLL_SPECIALIST',
        grossSalary: 15000,
        currency: 'EGP',
      }],
    }, adminReq());

    expect(result).toEqual(expect.objectContaining({
      accepted: true,
      rowCount: 1,
      createCount: 1,
      updateCount: 0,
    }));
  });

  it('applies new employee migration rows through CreateWorker commands', async () => {
    const { controller, commandBus } = buildController();

    const result = await controller.employeeMassUpdateApply({
      rows: [{
        employeeId: 'EMP-901',
        firstName: 'Omar',
        lastName: 'Fathy',
        workEmail: 'omar.fathy@example.com',
        department: 'FINANCE',
        jobTitle: 'PAYROLL_SPECIALIST',
        workLocationCode: 'CAIRO_HQ',
        grossSalary: 18000,
        currency: 'EGP',
      }],
    }, adminReq());

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateWorker',
      aggregateType: 'WorkerProfile',
      payload: expect.objectContaining({
        employeeNumber: 'EMP-901',
        firstName: 'Omar',
        lastName: 'Fathy',
        workEmail: 'omar.fathy@example.com',
        departmentName: 'FINANCE',
        jobTitle: 'PAYROLL_SPECIALIST',
        grossSalaryAmount: 18000,
        salaryCurrency: 'EGP',
        workLocation: { code: 'CAIRO_HQ' },
      }),
    }));
    expect(result.applied).toEqual([expect.objectContaining({
      employeeId: 'EMP-901',
      workerId: '11111111-1111-1111-1111-111111111111',
      action: 'CREATE',
    })]);
  });

  it('creates employees with organization assignment fields for hierarchy migration', async () => {
    const { controller, commandBus, workerRepo } = buildController();
    workerRepo.findByEmployeeNumberForTenant.mockImplementation(async (employeeNumber: string) => {
      if (employeeNumber === 'MGR-001') return { id: new Uuid(managerId), employeeNumber: 'MGR-001' };
      return undefined;
    });

    await controller.employeeMassUpdateApply({
      rows: [{
        employeeId: 'EMP-902',
        firstName: 'Yara',
        lastName: 'Maher',
        workEmail: 'yara.maher@example.com',
        legalEntityId,
        departmentId,
        managerEmployeeId: 'MGR-001',
        jobTitle: 'HR_GENERALIST',
      }],
    }, adminReq());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateWorker',
      payload: expect.objectContaining({
        employeeNumber: 'EMP-902',
        legalEntityId,
        departmentId,
        managerId,
      }),
    }));
  });

  it('updates employees with organization assignment fields for hierarchy migration', async () => {
    const { controller, commandBus, workerRepo } = buildController();
    const workerId = '55555555-5555-4555-8555-555555555555';
    workerRepo.findByEmployeeNumberForTenant.mockImplementation(async (employeeNumber: string) => {
      if (employeeNumber === 'EMP-100') return {
        id: new Uuid(workerId),
        employeeNumber: 'EMP-100',
        status: 'ACTIVE',
        aggregateVersion: 7,
      };
      if (employeeNumber === 'MGR-001') return { id: new Uuid(managerId), employeeNumber: 'MGR-001' };
      return undefined;
    });

    const result = await controller.employeeMassUpdateApply({
      rows: [{
        employeeId: 'EMP-100',
        legalEntityId,
        departmentId,
        managerEmployeeId: 'MGR-001',
      }],
    }, adminReq());

    expect(result.accepted).toBe(true);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'ApplyWorkerMassUpdate',
      payload: expect.objectContaining({
        workerId: new Uuid(workerId),
        organizationAssignment: {
          legalEntityId,
          departmentId,
          managerId,
        },
        updatedFields: expect.arrayContaining(['legalEntityId', 'departmentId', 'managerEmployeeId']),
      }),
    }));
  });
});
