import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { EmployeePayrollController } from './employee-payroll.controller.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('00000000-0000-0000-0000-000000000020');
const cycleId = new Uuid('00000000-0000-0000-0000-000000000030');

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

function worker(status = 'ACTIVE') {
  return {
    id: workerId,
    tenantId,
    employeeNumber: 'EMP-100',
    firstName: 'Regular',
    lastName: 'Employee',
    email: { toString: () => 'employee@example.com' },
    status,
  };
}

function cycle() {
  return {
    id: cycleId,
    tenantId,
    cycleName: 'May 2026 Payroll',
    payPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
    payPeriodEnd: new Date('2026-05-31T00:00:00.000Z'),
    payDate: new Date('2026-06-05T00:00:00.000Z'),
    status: 'CLOSED',
  };
}

function publishedArtifact() {
  return {
    id: 'payslip-artifact-1',
    tenantId: tenantId.value,
    payrollCycleId: cycleId.value,
    workerId: workerId.value,
    employeeId: 'EMP-100',
    artifactFormat: 'HTML',
    status: 'PUBLISHED',
    grossPay: 12000,
    netPay: 9700,
    currency: 'EGP',
    contentHash: 'f'.repeat(64),
    htmlContent: '<html><body>Published payslip</body></html>',
    dataClassification: 'HIGH_SENSITIVITY',
    publishedBy: 'payroll-admin',
    publishedAt: new Date('2026-06-02T10:00:00.000Z'),
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    updatedAt: new Date('2026-06-02T10:00:00.000Z'),
  };
}

function controller() {
  const workerRepo = {
    findByIdForTenant: vi.fn().mockResolvedValue(worker()),
    findByEmailForTenant: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(undefined),
    findByEmail: vi.fn().mockResolvedValue(undefined),
  };
  const personalDataRepo = {
    findByWorker: vi.fn().mockResolvedValue([]),
  };
  const payrollCycleRepo = {
    findByTenant: vi.fn().mockResolvedValue([cycle()]),
  };
  const resultLineRepo = {
    findByWorker: vi.fn().mockResolvedValue([]),
  };
  const payrollCalculation = {
    buildPayslipsFromResultLines: vi.fn().mockReturnValue([]),
  };
  const payslipArtifactRepo = {
    findByCycleAndWorker: vi.fn().mockResolvedValue(undefined),
  };
  const auditLedger = {
    writeAuditOnAccess: vi.fn().mockResolvedValue(undefined),
  };

  return {
    workerRepo,
    personalDataRepo,
    payrollCycleRepo,
    resultLineRepo,
    payrollCalculation,
    payslipArtifactRepo,
    auditLedger,
    instance: new (EmployeePayrollController as any)(
      workerRepo,
      personalDataRepo,
      payrollCycleRepo,
      resultLineRepo,
      payrollCalculation,
      payslipArtifactRepo,
      auditLedger,
    ) as EmployeePayrollController,
  };
}

describe('EmployeePayrollController payslip ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires a tenant-scoped authenticated self worker before returning payslips', async () => {
    const { instance, workerRepo } = controller();

    await instance.getOwnPayslips(request());

    expect(workerRepo.findByIdForTenant).toHaveBeenCalledWith(workerId, tenantId);
    expect(workerRepo.findById).not.toHaveBeenCalled();
    expect(workerRepo.findByEmail).not.toHaveBeenCalled();
  });

  it('rejects inactive linked workers before resolving payroll data', async () => {
    const { instance, workerRepo, payrollCycleRepo, resultLineRepo } = controller();
    workerRepo.findByIdForTenant.mockResolvedValue(worker('TERMINATED'));

    await expect(instance.getOwnPayslips(request())).rejects.toBeInstanceOf(ForbiddenException);

    expect(payrollCycleRepo.findByTenant).not.toHaveBeenCalled();
    expect(resultLineRepo.findByWorker).not.toHaveBeenCalled();
  });

  it('returns published payslip artifacts without rebuilding locked result lines', async () => {
    const { instance, payslipArtifactRepo, resultLineRepo, payrollCalculation, auditLedger } = controller();
    payslipArtifactRepo.findByCycleAndWorker.mockResolvedValue(publishedArtifact());

    const payslips = await instance.getOwnPayslips(request());

    expect(payslips).toEqual([
      expect.objectContaining({
        id: 'payslip-artifact-1',
        workerId: workerId.value,
        employeeId: 'EMP-100',
        payPeriodStart: '2026-05-01',
        payPeriodEnd: '2026-05-31',
        payDate: '2026-06-05',
        grossPay: 12000,
        netPay: 9700,
        currency: 'EGP',
        contentHash: 'f'.repeat(64),
        artifactStatus: 'PUBLISHED',
      }),
    ]);
    expect(resultLineRepo.findByWorker).not.toHaveBeenCalled();
    expect(payrollCalculation.buildPayslipsFromResultLines).not.toHaveBeenCalled();
    expect(auditLedger.writeAuditOnAccess).toHaveBeenCalledWith(
      request().actor,
      tenantId,
      'Payslip',
      workerId,
      expect.arrayContaining(['grossPay', 'netPay', 'payPeriodStart', 'payPeriodEnd']),
      'Employee payslip self-service view',
    );
  });
});
