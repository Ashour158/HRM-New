import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
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
    { findActive: async () => [], search: async () => [], findByStatusForTenant: async () => [], searchForTenant: async () => [] } as never,
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

  it('includes readiness blockers in monthly preview when rows are missing compensation', async () => {
    const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440300');
    const payrollGovernance = {
      evaluateCloseToPayReadiness: vi.fn(() => ({
        canClose: false,
        blockingIssueCount: 1,
        warningIssueCount: 0,
        issues: [{
          code: 'MISSING_PAYROLL_COMPENSATION',
          condition: 'MISSING_PAYROLL_COMPENSATION',
          severity: 'ERROR',
          blocking: true,
          employeeId: 'EMP-READY-001',
          workerId: workerId.value,
          message: 'Employee EMP-READY-001 has no positive gross payroll compensation.',
        }],
      })),
    };
    const payrollCalculation = {
      buildMonthlyCycle: vi.fn(() => ({
        id: '2026-06',
        name: 'June 2026 Payroll',
        year: 2026,
        month: 6,
        calendarDays: 30,
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        payDate: '2026-06-30',
        employeeCount: 1,
        totalGross: 0,
        totalTax: 0,
        totalEmployeeInsurance: 0,
        totalEmployerInsurance: 0,
        totalPolicyDeductions: 0,
        totalNet: 0,
        currency: 'EGP',
        rows: [{
          workerId: workerId.value,
          employeeId: 'EMP-READY-001',
          name: 'Missing Compensation',
          email: 'missing.comp@example.com',
          grossSalary: 0,
          netSalary: 0,
          currency: 'EGP',
          explainability: [],
        }],
      })),
      buildBankTransferRows: vi.fn(() => []),
      maskRowForActor: (row: unknown) => row,
    };
    const controller = new PayrollController(
      {} as never,
      { getSetup: async () => ({ locations: [], payrollBlockingRules: [] }) } as never,
      {
        findActive: async () => [],
        search: async () => [],
        findByStatusForTenant: async () => [{
          id: workerId,
          employeeNumber: 'EMP-READY-001',
          firstName: 'Missing',
          lastName: 'Compensation',
          email: { toString: () => 'missing.comp@example.com' },
          employmentType: 'FULL_TIME',
        }],
        searchForTenant: async () => [],
      } as never,
      { findByWorker: async () => [] } as never,
      { findByWorker: async () => [] } as never,
      { findByWorker: async () => [] } as never,
      { calculateDay: vi.fn(), summarizeMonth: vi.fn(() => ({ payableMinutes: 0 })) } as never,
      payrollCalculation as never,
      payrollGovernance as never,
      { findByTenant: async () => [] } as never,
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
    const req = {
      tenantId: '00000000-0000-0000-0000-000000000001',
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440100'),
        roles: ['PAYROLL_ADMIN'],
        permissions: ['PAYROLL_MANAGE'],
        mfaAuthenticated: true,
      },
    } as never;

    await expect(controller.monthlyCyclePreview('2026', '6', undefined, req)).resolves.toMatchObject({
      readiness: {
        canClose: false,
        blockingIssueCount: expect.any(Number),
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'MISSING_PAYROLL_COMPENSATION' }),
        ]),
      },
    });
  });

  it('passes tenant and organization scope fields into monthly payroll calculation', async () => {
    const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440301');
    const departmentId = new Uuid('550e8400-e29b-41d4-a716-446655440302');
    const legalEntityId = new Uuid('550e8400-e29b-41d4-a716-446655440303');
    const payrollCalculation = {
      buildMonthlyCycle: vi.fn(({ employees }) => ({
        id: '2026-06',
        name: 'June 2026 Payroll',
        year: 2026,
        month: 6,
        calendarDays: 30,
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        payDate: '2026-06-30',
        employeeCount: employees.length,
        totalGross: 0,
        totalTax: 0,
        totalEmployeeInsurance: 0,
        totalEmployerInsurance: 0,
        totalPolicyDeductions: 0,
        totalNet: 0,
        currency: 'EGP',
        rows: employees.map((employee: Record<string, unknown>) => ({
          ...employee,
          baseGrossSalary: employee.grossSalary,
          earningAmount: 0,
          taxableEarningAmount: 0,
          nonTaxableEarningAmount: 0,
          taxAmount: 0,
          employeeInsuranceAmount: 0,
          employerInsuranceAmount: 0,
          policyDeductionAmount: 0,
          netSalary: employee.grossSalary,
          explainability: [],
        })),
      })),
      buildBankTransferRows: vi.fn(() => []),
      maskRowForActor: (row: unknown) => row,
      summarizeLockedAttendanceSnapshots: vi.fn(() => ({ payableMinutes: 0 })),
    };
    const controller = new PayrollController(
      {} as never,
      {
        getSetup: async () => ({
          locations: [{ code: 'CAIRO_HQ', countryCode: 'EG', currency: 'EGP' }],
          attendancePolicy: {},
          payrollBlockingRules: [],
        }),
      } as never,
      {
        findActive: async () => [],
        search: async () => [],
        findByStatusForTenant: async () => [{
          id: workerId,
          tenantId: new Uuid('00000000-0000-0000-0000-000000000001'),
          employeeNumber: 'EMP-SCOPE-001',
          firstName: 'Scoped',
          lastName: 'Worker',
          email: { toString: () => 'scoped.worker@example.com' },
          employmentType: 'FULL_TIME',
          departmentId,
          legalEntityId,
        }],
        searchForTenant: async () => [],
      } as never,
      {
        findByWorker: async () => [
          {
            dataCategory: 'CONTACT',
            payload: {
              departmentName: 'Finance',
              orgUnitId: 'org-unit-finance',
              workLocation: { code: 'CAIRO_HQ' },
            },
          },
          {
            dataCategory: 'COMPENSATION',
            payload: { grossSalaryAmount: 10000, salaryCurrency: 'EGP' },
          },
          {
            dataCategory: 'BASIC',
            payload: { workEmail: 'scoped.worker@example.com' },
          },
        ],
      } as never,
      { findByWorker: async () => [] } as never,
      { findByWorker: async () => [] } as never,
      { calculateDay: vi.fn(), summarizeMonth: vi.fn(() => ({ payableMinutes: 0 })) } as never,
      payrollCalculation as never,
      { evaluateCloseToPayReadiness: vi.fn(() => ({ canClose: true, blockingIssueCount: 0, warningIssueCount: 0, issues: [] })) } as never,
      { findByTenant: async () => [] } as never,
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
    const req = {
      tenantId: '00000000-0000-0000-0000-000000000001',
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440100'),
        roles: ['PAYROLL_ADMIN'],
        permissions: ['PAYROLL_MANAGE'],
        mfaAuthenticated: true,
      },
    } as never;

    await controller.monthlyCyclePreview('2026', '6', undefined, req);

    expect(payrollCalculation.buildMonthlyCycle).toHaveBeenCalledWith(expect.objectContaining({
      employees: [expect.objectContaining({
        tenantId: '00000000-0000-0000-0000-000000000001',
        departmentId: departmentId.value,
        legalEntityId: legalEntityId.value,
        orgUnitId: 'org-unit-finance',
        countryCode: 'EG',
      })],
    }));
  });
});
