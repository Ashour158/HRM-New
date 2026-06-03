import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { ManagerTeamController } from './manager-team.controller.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const otherTenantId = new Uuid('00000000-0000-0000-0000-000000000999');
const managerId = new Uuid('00000000-0000-0000-0000-000000000010');
const directReportId = new Uuid('00000000-0000-0000-0000-000000000011');
const peerId = new Uuid('00000000-0000-0000-0000-000000000012');

function request(roles = ['EMPLOYEE', 'MANAGER']): Request {
  return {
    tenantId: tenantId.value,
    actor: {
      actorType: 'USER',
      actorId: managerId,
      roles,
      permissions: [],
      mfaAuthenticated: true,
      email: 'manager@example.com',
    },
  } as unknown as Request;
}

function worker(overrides: Record<string, unknown> = {}) {
  return {
    id: directReportId,
    tenantId,
    employeeNumber: 'EMP-100',
    firstName: 'Mona',
    lastName: 'Saleh',
    email: { toString: () => 'mona.saleh@example.com' },
    hireDate: new Date('2024-01-15T00:00:00.000Z'),
    status: 'ACTIVE',
    jobTitle: 'Product Specialist',
    managerId,
    departmentId: new Uuid('00000000-0000-0000-0000-000000000101'),
    legalEntityId: new Uuid('00000000-0000-0000-0000-000000000201'),
    ...overrides,
  };
}

function makeController(options?: {
  workerRepo?: Record<string, ReturnType<typeof vi.fn>>;
  personalDataRepo?: Record<string, ReturnType<typeof vi.fn>>;
}) {
  const manager = worker({
    id: managerId,
    employeeNumber: 'MGR-100',
    firstName: 'Line',
    lastName: 'Manager',
    email: { toString: () => 'manager@example.com' },
    managerId: undefined,
  });
  const workerRepo = options?.workerRepo ?? {
    findByIdForTenant: vi.fn(async () => manager),
    findByEmailForTenant: vi.fn(async () => manager),
    findByManagerForTenant: vi.fn(async () => [worker()]),
    findByManager: vi.fn(),
    findById: vi.fn(),
  };
  const personalDataRepo = options?.personalDataRepo ?? {
    findByWorkerForTenant: vi.fn(async () => [
      {
        dataCategory: 'CONTACT',
        payload: {
          departmentName: 'Product',
          legalEntityName: 'Nexus USA LLC',
          managerName: 'Line Manager',
        },
      },
      {
        dataCategory: 'COMPENSATION',
        payload: {
          compensationBand: 'P3',
        },
      },
    ]),
  };
  return {
    controller: new ManagerTeamController(workerRepo as never, personalDataRepo as never),
    workerRepo,
    personalDataRepo,
  };
}

describe('ManagerTeamController', () => {
  it('returns only tenant-scoped direct reports for a manager and selected member detail', async () => {
    const crossTenantReport = worker({
      id: peerId,
      tenantId: otherTenantId,
      employeeNumber: 'EMP-999',
      firstName: 'Other',
      lastName: 'Tenant',
      email: { toString: () => 'other.tenant@example.com' },
    });
    const { controller, workerRepo, personalDataRepo } = makeController({
      workerRepo: {
        findByIdForTenant: vi.fn(async () => worker({
          id: managerId,
          employeeNumber: 'MGR-100',
          firstName: 'Line',
          lastName: 'Manager',
          email: { toString: () => 'manager@example.com' },
          managerId: undefined,
        })),
        findByEmailForTenant: vi.fn(),
        findByManagerForTenant: vi.fn(async () => [worker(), crossTenantReport]),
        findByManager: vi.fn(),
        findById: vi.fn(),
      },
    });

    const result = await controller.getTeam(request(), directReportId.value);

    expect(workerRepo.findByIdForTenant).toHaveBeenCalledWith(managerId, tenantId);
    expect(workerRepo.findByManagerForTenant).toHaveBeenCalledWith(managerId, tenantId);
    expect(workerRepo.findByManager).not.toHaveBeenCalled();
    expect(workerRepo.findById).not.toHaveBeenCalled();
    expect(personalDataRepo.findByWorkerForTenant).toHaveBeenCalledWith(directReportId, tenantId);
    expect(result.directReports).toEqual([
      expect.objectContaining({
        id: directReportId.value,
        employeeId: 'EMP-100',
        firstName: 'Mona',
        lastName: 'Saleh',
        departmentName: 'Product',
        managerName: 'Line Manager',
        legalEntityName: 'Nexus USA LLC',
      }),
    ]);
    expect(result.selectedMember).toEqual(expect.objectContaining({
      id: directReportId.value,
      compensationBand: 'P3',
      goals: [],
    }));
  });

  it('rejects employee users before resolving manager team data', async () => {
    const { controller, workerRepo, personalDataRepo } = makeController();

    await expect(controller.getTeam(request(['EMPLOYEE']))).rejects.toBeInstanceOf(ForbiddenException);

    expect(workerRepo.findByIdForTenant).not.toHaveBeenCalled();
    expect(workerRepo.findByManagerForTenant).not.toHaveBeenCalled();
    expect(personalDataRepo.findByWorkerForTenant).not.toHaveBeenCalled();
  });

  it('returns an empty direct report list for a manager without reports', async () => {
    const { controller } = makeController({
      workerRepo: {
        findByIdForTenant: vi.fn(async () => worker({
          id: managerId,
          employeeNumber: 'MGR-100',
          firstName: 'Line',
          lastName: 'Manager',
          email: { toString: () => 'manager@example.com' },
          managerId: undefined,
        })),
        findByEmailForTenant: vi.fn(),
        findByManagerForTenant: vi.fn(async () => []),
        findByManager: vi.fn(),
        findById: vi.fn(),
      },
    });

    await expect(controller.getTeam(request())).resolves.toEqual({ directReports: [] });
  });

  it('rejects selected workers outside the manager direct reports', async () => {
    const { controller, personalDataRepo } = makeController();

    await expect(controller.getTeam(request(), peerId.value)).rejects.toBeInstanceOf(ForbiddenException);

    expect(personalDataRepo.findByWorkerForTenant).not.toHaveBeenCalledWith(peerId, tenantId);
  });
});
