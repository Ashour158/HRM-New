import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { PayrollController } from './payroll.controller.js';

function buildController(overrides: { payrollCycleRepo?: unknown } = {}) {
  const payrollCalculation = {
    buildMonthlyCycle: () => ({
      id: '2026-05',
      name: 'May 2026 Payroll',
      year: 2026,
      month: 5,
      calendarDays: 31,
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      payDate: '2026-05-31',
      employeeCount: 0,
      totalGross: 0,
      totalTax: 0,
      totalEmployeeInsurance: 0,
      totalEmployerInsurance: 0,
      totalPolicyDeductions: 0,
      totalNet: 0,
      currency: 'EGP',
      rows: [],
    }),
    maskRowForActor: (row: unknown) => row,
  };

  return new PayrollController(
    {} as never,
    { getSetup: async () => ({ locations: [] }) } as never,
    { findActive: async () => [], search: async () => [] } as never,
    { findByWorker: async () => [] } as never,
    {} as never,
    {} as never,
    {} as never,
    payrollCalculation as never,
    {} as never,
    (overrides.payrollCycleRepo ?? {}) as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('PayrollController salary governance', () => {
  it('blocks monthly payroll preview for non-payroll actors', async () => {
    const controller = buildController();
    const req = {
      tenantId: '00000000-0000-0000-0000-000000000001',
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440100'),
        roles: ['EMPLOYEE'],
        permissions: ['WORKER_READ'],
        mfaAuthenticated: true,
      },
    } as never;

    await expect(controller.monthlyCyclePreview('2026', '5', undefined, req)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks payroll cycle detail reads for non-payroll actors', async () => {
    const controller = buildController({
      payrollCycleRepo: {
        findById: async () => ({ id: new Uuid('550e8400-e29b-41d4-a716-446655440200') }),
      },
    });
    const req = {
      tenantId: '00000000-0000-0000-0000-000000000001',
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440100'),
        roles: ['EMPLOYEE'],
        permissions: ['WORKER_READ'],
        mfaAuthenticated: true,
      },
    } as never;

    await expect((controller.getPayrollCycle as any)('550e8400-e29b-41d4-a716-446655440200', req)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
