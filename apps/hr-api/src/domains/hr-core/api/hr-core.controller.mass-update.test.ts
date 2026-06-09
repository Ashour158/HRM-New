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
});
