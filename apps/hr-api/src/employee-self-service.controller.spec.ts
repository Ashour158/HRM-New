import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { EmployeeSelfServiceController } from './employee-self-service.controller.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('00000000-0000-0000-0000-000000000123');
const programId = new Uuid('00000000-0000-0000-0000-000000000321');

function request(): Request {
  return {
    tenantId: tenantId.value,
    actor: {
      actorType: 'USER',
      actorId: { value: '00000000-0000-0000-0000-000000000010' },
      roles: ['EMPLOYEE'],
      permissions: [],
      mfaAuthenticated: true,
      email: 'employee@example.com',
    },
  } as unknown as Request;
}

describe('EmployeeSelfServiceController', () => {
  it('returns the authenticated worker profile from HR records', async () => {
    const workerRepo = {
      findByIdForTenant: vi.fn().mockResolvedValue(undefined),
      findByEmailForTenant: vi.fn().mockResolvedValue({
        id: workerId,
        tenantId,
        employeeNumber: 'EMP-100',
        firstName: 'Regular',
        lastName: 'Employee',
        email: { toString: () => 'employee@example.com' },
        hireDate: new Date('2024-01-15T00:00:00.000Z'),
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        jobTitle: 'Product Specialist',
      }),
    };
    const personalDataRepo = {
      findByWorker: vi.fn().mockResolvedValue([
        {
          dataCategory: 'BASIC',
          payload: {
            phone: '+1 555 0100',
            dateOfBirth: '1990-03-01',
            ssn: '123-45-6789',
            address: {
              line1: '1 Market St',
              city: 'San Francisco',
              country: 'US',
            },
          },
        },
        {
          dataCategory: 'CONTACT',
          payload: {
            departmentName: 'People Operations',
            managerName: 'Line Manager',
            legalEntityName: 'Nexus USA LLC',
          },
        },
        {
          dataCategory: 'DOCUMENTS',
          payload: {
            documents: [{ id: 'doc-1', name: 'Employment Contract', type: 'PDF' }],
          },
        },
      ]),
    };
    const controller = new EmployeeSelfServiceController(
      workerRepo as never,
      personalDataRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const profile = await controller.getProfile(request());

    expect(profile).toMatchObject({
      id: workerId.value,
      employeeId: 'EMP-100',
      firstName: 'Regular',
      lastName: 'Employee',
      email: 'employee@example.com',
      phone: '+1 555 0100',
      dateOfBirth: '1990-03-01',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      department: 'People Operations',
      jobTitle: 'Product Specialist',
      manager: 'Line Manager',
      legalEntity: 'Nexus USA LLC',
    });
    expect(profile.ssn).toBe('***-**-6789');
    expect(profile.documents).toHaveLength(1);
  });

  it('rejects non-user actors before resolving a worker profile', async () => {
    const workerRepo = {
      findByIdForTenant: vi.fn(),
      findByEmailForTenant: vi.fn(),
    };
    const controller = new EmployeeSelfServiceController(
      workerRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const systemRequest = {
      ...request(),
      actor: {
        ...request().actor,
        actorType: 'SYSTEM',
        roles: ['SYSTEM_ACTOR'],
      },
    } as Request;

    await expect(controller.getProfile(systemRequest)).rejects.toBeInstanceOf(ForbiddenException);
    expect(workerRepo.findByIdForTenant).not.toHaveBeenCalled();
    expect(workerRepo.findByEmailForTenant).not.toHaveBeenCalled();
  });

  it('allows a linked HR admin to use employee self-service for their own worker profile', async () => {
    const adminWorkerId = new Uuid('00000000-0000-0000-0000-000000000010');
    const workerRepo = {
      findByIdForTenant: vi.fn().mockResolvedValue({
        id: adminWorkerId,
        tenantId,
        employeeNumber: 'EMP-HR-001',
        firstName: 'HR',
        lastName: 'Admin',
        email: { toString: () => 'hr.admin@example.com' },
        hireDate: new Date('2023-01-01T00:00:00.000Z'),
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        jobTitle: 'HR Administrator',
      }),
      findByEmailForTenant: vi.fn(),
    };
    const personalDataRepo = {
      findByWorker: vi.fn().mockResolvedValue([]),
    };
    const controller = new EmployeeSelfServiceController(
      workerRepo as never,
      personalDataRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const adminRequest = {
      ...request(),
      actor: {
        ...request().actor,
        actorId: { value: adminWorkerId.value },
        roles: ['HR_ADMIN'],
        email: 'hr.admin@example.com',
      },
    } as Request;

    const profile = await controller.getProfile(adminRequest);

    expect(profile).toMatchObject({
      id: adminWorkerId.value,
      employeeId: 'EMP-HR-001',
      firstName: 'HR',
      lastName: 'Admin',
      email: 'hr.admin@example.com',
      jobTitle: 'HR Administrator',
    });
    expect(workerRepo.findByIdForTenant).toHaveBeenCalledWith(adminWorkerId, tenantId);
    expect(workerRepo.findByEmailForTenant).not.toHaveBeenCalled();
  });

  it('uses tenant-scoped worker lookup before returning profile data', async () => {
    const workerRepo = {
      findByIdForTenant: vi.fn().mockResolvedValue(undefined),
      findByEmailForTenant: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByEmail: vi.fn(),
    };
    const personalDataRepo = {
      findByWorker: vi.fn(),
    };
    const controller = new EmployeeSelfServiceController(
      workerRepo as never,
      personalDataRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(controller.getProfile(request())).rejects.toBeInstanceOf(ForbiddenException);
    expect(workerRepo.findByIdForTenant).toHaveBeenCalledWith(
      new Uuid('00000000-0000-0000-0000-000000000010'),
      tenantId,
    );
    expect(workerRepo.findByEmailForTenant).toHaveBeenCalledWith('employee@example.com', tenantId);
    expect(workerRepo.findById).not.toHaveBeenCalled();
    expect(workerRepo.findByEmail).not.toHaveBeenCalled();
    expect(personalDataRepo.findByWorker).not.toHaveBeenCalled();
  });

  it('returns benefits enrollments, life events, dependents, and spending accounts', async () => {
    const enrollmentId = new Uuid('00000000-0000-0000-0000-000000000456');
    const lifeEventId = new Uuid('00000000-0000-0000-0000-000000000457');
    const spendingAccountId = new Uuid('00000000-0000-0000-0000-000000000458');
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
    const enrollmentRepo = {
      findByWorker: vi.fn().mockResolvedValue([
        {
          id: enrollmentId,
          workerId,
          programId,
          coverageLevel: 'EMPLOYEE_SPOUSE',
          dependents: [
            {
              dependentId: 'dep-1',
              firstName: 'Alex',
              lastName: 'Employee',
              relationship: 'SPOUSE',
              dateOfBirth: new Date('1991-05-20T00:00:00.000Z'),
            },
          ],
          effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
          status: 'EFFECTIVE',
        },
      ]),
    };
    const programRepo = {
      findById: vi.fn().mockResolvedValue({
        id: programId,
        programName: 'Gold Medical',
        programType: 'MEDICAL',
        status: 'ACTIVE',
      }),
      findActive: vi.fn().mockResolvedValue([]),
    };
    const lifeEventRepo = {
      findByWorker: vi.fn().mockResolvedValue([
        {
          id: lifeEventId,
          eventType: 'MARRIAGE',
          eventDate: new Date('2025-02-15T00:00:00.000Z'),
          description: 'Marriage certificate submitted',
          status: 'PROCESSED',
        },
      ]),
    };
    const spendingAccountRepo = {
      findByWorker: vi.fn().mockResolvedValue([
        {
          id: spendingAccountId,
          accountType: 'HSA',
          annualElection: 2400,
          usedAmount: 300,
          availableAmount: 2100,
          currency: 'USD',
          status: 'ACTIVE',
        },
      ]),
    };
    const controller = new EmployeeSelfServiceController(
      workerRepo as never,
      {} as never,
      enrollmentRepo as never,
      lifeEventRepo as never,
      spendingAccountRepo as never,
      programRepo as never,
      {} as never,
    );

    const benefits = await controller.getBenefits(request());

    expect(benefits.enrollments).toEqual([
      expect.objectContaining({
        id: enrollmentId.value,
        benefitType: 'MEDICAL',
        planName: 'Gold Medical',
        coverageLevel: 'EMPLOYEE_SPOUSE',
        effectiveDate: '2025-01-01',
        status: 'ACTIVE',
      }),
    ]);
    expect(benefits.dependents).toEqual([
      expect.objectContaining({ id: 'dep-1', relationship: 'SPOUSE' }),
    ]);
    expect(benefits.lifeEvents).toEqual([
      expect.objectContaining({
        id: lifeEventId.value,
        type: 'MARRIAGE',
        status: 'PROCESSED',
      }),
    ]);
    expect(benefits.spendingAccounts).toEqual([
      expect.objectContaining({
        id: spendingAccountId.value,
        accountType: 'HSA',
        availableAmount: 2100,
      }),
    ]);
    expect(programRepo.findActive).toHaveBeenCalledWith(tenantId);
  });

  it('rejects terminated workers before returning protected profile data', async () => {
    const workerRepo = {
      findByIdForTenant: vi.fn().mockResolvedValue(undefined),
      findByEmailForTenant: vi.fn().mockResolvedValue({
        id: workerId,
        tenantId,
        employeeNumber: 'EMP-100',
        firstName: 'Former',
        lastName: 'Employee',
        email: { toString: () => 'employee@example.com' },
        status: 'TERMINATED',
      }),
    };
    const personalDataRepo = {
      findByWorker: vi.fn().mockResolvedValue([
        {
          dataCategory: 'BASIC',
          payload: { ssn: '123-45-6789' },
        },
      ]),
    };
    const controller = new EmployeeSelfServiceController(
      workerRepo as never,
      personalDataRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(controller.getProfile(request())).rejects.toBeInstanceOf(ForbiddenException);
    expect(personalDataRepo.findByWorker).not.toHaveBeenCalled();
  });

  it('rejects inactive workers before returning benefits data', async () => {
    const workerRepo = {
      findByIdForTenant: vi.fn().mockResolvedValue(undefined),
      findByEmailForTenant: vi.fn().mockResolvedValue({
        id: workerId,
        tenantId,
        employeeNumber: 'EMP-100',
        firstName: 'Suspended',
        lastName: 'Employee',
        email: { toString: () => 'employee@example.com' },
        status: 'SUSPENDED',
      }),
    };
    const enrollmentRepo = {
      findByWorker: vi.fn().mockResolvedValue([]),
    };
    const lifeEventRepo = {
      findByWorker: vi.fn().mockResolvedValue([]),
    };
    const spendingAccountRepo = {
      findByWorker: vi.fn().mockResolvedValue([]),
    };
    const programRepo = {
      findActive: vi.fn().mockResolvedValue([]),
    };
    const controller = new EmployeeSelfServiceController(
      workerRepo as never,
      {} as never,
      enrollmentRepo as never,
      lifeEventRepo as never,
      spendingAccountRepo as never,
      programRepo as never,
      {} as never,
    );

    await expect(controller.getBenefits(request())).rejects.toBeInstanceOf(ForbiddenException);
    expect(enrollmentRepo.findByWorker).not.toHaveBeenCalled();
    expect(lifeEventRepo.findByWorker).not.toHaveBeenCalled();
    expect(spendingAccountRepo.findByWorker).not.toHaveBeenCalled();
    expect(programRepo.findActive).not.toHaveBeenCalled();
  });

  it('returns attendance setup through an employee-scoped self-service endpoint', async () => {
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
    const hcmSetupService = {
      getSetup: vi.fn().mockResolvedValue({
        locations: [{ code: 'CAIRO_HQ', label: 'Cairo HQ', active: true }],
        attendancePolicy: {
          standardDailyMinutes: 480,
          flexibleHoursEnabled: false,
          lateGraceMinutes: 10,
          overtimeAfterMinutes: 480,
          geofenceEnabled: true,
        },
      }),
    };
    const controller = new EmployeeSelfServiceController(
      workerRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      hcmSetupService as never,
    );

    const setup = await controller.getAttendanceSetup(request());

    expect(setup).toMatchObject({
      locations: [{ code: 'CAIRO_HQ', label: 'Cairo HQ', active: true }],
      attendancePolicy: { geofenceEnabled: true, standardDailyMinutes: 480 },
    });
    expect(hcmSetupService.getSetup).toHaveBeenCalledWith(tenantId);
  });
});
