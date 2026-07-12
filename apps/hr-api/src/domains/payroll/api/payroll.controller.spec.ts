import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { PayrollController } from './payroll.controller.js';
import { PayrollCycleGovernanceService } from '../services/payroll-cycle-governance.service.js';
import { PayrollGlPostingService } from '../services/payroll-gl-posting.service.js';

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
    { getSetup: async () => ({ locations: [{ code: 'CAIRO_HQ', active: true, currency: 'EGP' }] }) } as never,
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
      { getSetup: async () => ({ locations: [{ code: 'CAIRO_HQ', active: true, currency: 'EGP' }], payrollBlockingRules: [] }) } as never,
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
      { findByWorker: async () => [], findByWorkers: async () => [] } as never,
      { findByWorker: async () => [], findByWorkersBetween: async () => [] } as never,
      { findByWorker: async () => [], findByWorkers: async () => new Map() } as never,
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
        findByWorker: async () => [],
        findByWorkers: async () => [
          {
            workerId,
            dataCategory: 'CONTACT',
            payload: {
              departmentName: 'Finance',
              orgUnitId: 'org-unit-finance',
              workLocation: { code: 'CAIRO_HQ' },
            },
          },
          {
            workerId,
            dataCategory: 'COMPENSATION',
            payload: { grossSalaryAmount: 10000, salaryCurrency: 'EGP' },
          },
          {
            workerId,
            dataCategory: 'BASIC',
            payload: { workEmail: 'scoped.worker@example.com' },
          },
        ],
      } as never,
      { findByWorker: async () => [], findByWorkersBetween: async () => [] } as never,
      { findByWorker: async () => [], findByWorkers: async () => new Map() } as never,
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

  it('builds monthly GL preview with location statutory account mapping', async () => {
    const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440401');
    const setup = {
      locations: [{ code: 'CAIRO_HQ', countryCode: 'EG', currency: 'EGP' }],
      attendancePolicy: {},
      payrollBlockingRules: [],
      statutoryPayrollPacks: [{
        code: 'EG_STAT',
        label: 'Egypt statutory pack',
        active: true,
        countryCode: 'EG',
        locationCodes: ['CAIRO_HQ'],
        calculationPolicy: {
          taxRatePercent: 10,
          employeeInsuranceRatePercent: 5,
        },
        glAccountMapping: {
          salaryExpenseAccount: '6100',
          employerInsuranceExpenseAccount: '6110',
          taxPayableAccount: '2150',
          insurancePayableAccount: '2160',
          deductionPayableAccount: '2250',
          bankClearingAccount: '1050',
        },
      }],
    };
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
        totalGross: 10000,
        totalTax: 1000,
        totalEmployeeInsurance: 500,
        totalEmployerInsurance: 700,
        totalPolicyDeductions: 250,
        totalNet: 8250,
        currency: 'EGP',
        rows: employees.map((employee: Record<string, unknown>) => ({
          ...employee,
          baseGrossSalary: 10000,
          earningAmount: 0,
          taxableEarningAmount: 0,
          nonTaxableEarningAmount: 0,
          grossSalary: 10000,
          taxAmount: 1000,
          employeeInsuranceAmount: 500,
          employerInsuranceAmount: 700,
          policyDeductionAmount: 250,
          netSalary: 8250,
          explainability: [],
        })),
      })),
      buildBankTransferRows: vi.fn(() => []),
      maskRowForActor: (row: unknown) => row,
      summarizeLockedAttendanceSnapshots: vi.fn(() => ({ payableMinutes: 0 })),
    };
    const controller = new PayrollController(
      {} as never,
      { getSetup: async () => setup } as never,
      {
        findActive: async () => [],
        search: async () => [],
        findByStatusForTenant: async () => [{
          id: workerId,
          tenantId: new Uuid('00000000-0000-0000-0000-000000000001'),
          employeeNumber: 'EMP-GL-001',
          firstName: 'Ledger',
          lastName: 'Worker',
          email: { toString: () => 'ledger.worker@example.com' },
          employmentType: 'FULL_TIME',
        }],
        searchForTenant: async () => [],
      } as never,
      {
        findByWorker: async () => [],
        findByWorkers: async () => [
          {
            workerId,
            dataCategory: 'CONTACT',
            payload: {
              departmentName: 'Finance',
              workLocation: { code: 'CAIRO_HQ' },
            },
          },
          {
            workerId,
            dataCategory: 'COMPENSATION',
            payload: { grossSalaryAmount: 10000, salaryCurrency: 'EGP' },
          },
          {
            workerId,
            dataCategory: 'BASIC',
            payload: { workEmail: 'ledger.worker@example.com' },
          },
        ],
      } as never,
      { findByWorker: async () => [], findByWorkersBetween: async () => [] } as never,
      { findByWorker: async () => [], findByWorkers: async () => new Map() } as never,
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
      new PayrollGlPostingService() as never,
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

    await expect(controller.monthlyCycleGlPreview('2026', '6', 'CAIRO_HQ', req)).resolves.toMatchObject({
      payrollCycleId: '2026-06',
      lines: expect.arrayContaining([
        expect.objectContaining({ accountCode: '6100', debit: 10000 }),
        expect.objectContaining({ accountCode: '2150', credit: 1000 }),
        expect.objectContaining({ accountCode: '1050', credit: 8250 }),
      ]),
      events: ['PayrollGlPreviewBuilt'],
    });
  });

  it('fails closed before dispatching close when enterprise close evidence is missing', async () => {
    const payrollCycleId = '550e8400-e29b-41d4-a716-446655440501';
    const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
    const commandBus = { execute: vi.fn(async () => ({ success: true })) };
    const payrollCycle = {
      id: new Uuid(payrollCycleId),
      tenantId,
      cycleName: 'May 2026 Payroll',
      payPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
      payPeriodEnd: new Date('2026-05-31T00:00:00.000Z'),
      payDate: new Date('2026-05-31T00:00:00.000Z'),
      status: 'APPROVED',
      aggregateVersion: 4,
    };
    const controller = new PayrollController(
      commandBus as never,
      {
        getSetup: async () => ({
          locations: [{ code: 'CAIRO_HQ', countryCode: 'EG', currency: 'EGP' }],
          statutoryPayrollPacks: [{
            code: 'EG_STAT',
            label: 'Egypt statutory payroll',
            active: true,
            countryCode: 'EG',
            locationCodes: ['CAIRO_HQ'],
            calculationPolicy: {
              taxRatePercent: 10,
              employeeInsuranceRatePercent: 5,
            },
          }],
          payrollBlockingRules: [],
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { findByWorkers: async () => new Map() } as never,
      { buildBankTransferRows: vi.fn(() => []) } as never,
      new PayrollCycleGovernanceService() as never,
      {
        findById: vi.fn(async () => payrollCycle),
        findByTenant: vi.fn(async () => [payrollCycle]),
      } as never,
      {} as never,
      {} as never,
      {
        findByPayrollCycle: vi.fn(async () => [{
          id: new Uuid('550e8400-e29b-41d4-a716-446655440502'),
          workerId: new Uuid('550e8400-e29b-41d4-a716-446655440503'),
          lineType: 'NET_PAY',
          description: 'Net pay',
          amount: 8400,
          currency: 'EGP',
          ruleSetId: 'SYSTEM',
          explanation: 'gross - deductions',
          status: 'LOCKED',
        }]),
      } as never,
      { findByPayrollCycle: vi.fn(async () => undefined) } as never,
      { findByPayrollCycle: vi.fn(async () => []) } as never,
      {} as never,
      { findByPayrollCycle: vi.fn(async () => undefined) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const req = {
      tenantId: tenantId.value,
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440100'),
        roles: ['PAYROLL_ADMIN'],
        permissions: ['PAYROLL_MANAGE'],
        mfaAuthenticated: true,
      },
    } as never;

    let response: unknown;
    try {
      await controller.closePayrollCycle(payrollCycleId, req);
      throw new Error('Expected payroll close to fail readiness');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      response = (error as BadRequestException).getResponse();
    }

    expect(response).toMatchObject({
      message: 'Payroll cycle has blocking readiness issues',
      readiness: {
        canClose: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'MISSING_GL_MAPPING' }),
          expect.objectContaining({ code: 'MISSING_PAYMENT_BATCH_CONFIG' }),
          expect.objectContaining({ code: 'MISSING_GL_POSTING' }),
          expect.objectContaining({ code: 'MISSING_PAYMENT_BATCH' }),
          expect.objectContaining({ code: 'MISSING_PAYSLIP_ARTIFACT' }),
        ]),
      },
    });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('does not accept client readiness overrides on close-to-pay blockers', async () => {
    const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440601');
    const commandBus = { execute: vi.fn(async () => ({ success: true })) };
    const preview = {
      id: '2026-05',
      name: 'May 2026 Payroll',
      year: 2026,
      month: 5,
      calendarDays: 31,
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      payDate: '2026-05-31',
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
        employeeId: 'EMP-BLOCK-001',
        name: 'Blocked Worker',
        email: 'blocked.worker@example.com',
        grossSalary: 0,
        netSalary: 0,
        currency: 'EGP',
        explainability: [],
      }],
    };
    const controller = new PayrollController(
      commandBus as never,
      { getSetup: async () => ({ locations: [{ code: 'CAIRO_HQ', countryCode: 'EG', currency: 'EGP' }] }) } as never,
      { findByStatusForTenant: async () => [], searchForTenant: async () => [] } as never,
      { findByWorkers: async () => [] } as never,
      { findByWorkersBetween: async () => [] } as never,
      {
        findByWorker: vi.fn(async () => [{
          workDate: '2026-05-01',
          locked: true,
          readyForPayroll: true,
        }]),
        findByWorkers: vi.fn(async (_tenantId, workerIds) => {
          const map = new Map();
          for (const id of workerIds) map.set(id.value, [{ workDate: '2026-05-01', locked: true, readyForPayroll: true }]);
          return map;
        }),
      } as never,
      {} as never,
      {
        buildMonthlyCycle: vi.fn(() => preview),
        buildBankTransferRows: vi.fn(() => [{
          employeeId: 'EMP-BLOCK-001',
          workerId: workerId.value,
          name: 'Blocked Worker',
          workEmail: 'blocked.worker@example.com',
          bankName: 'National Bank',
          accountHolderName: 'Blocked Worker',
          accountNumber: '123',
          iban: '',
          routingNumber: '',
          swiftCode: '',
          netSalary: 0,
          currency: 'EGP',
          bankReady: true,
          readinessReason: 'READY',
        }]),
        maskRowForActor: (row: unknown) => row,
      } as never,
      new PayrollCycleGovernanceService() as never,
      { findByTenant: vi.fn(async () => []) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { applyApprovedInputs: vi.fn((cycle) => cycle) } as never,
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

    let response: unknown;
    try {
      await controller.closeMonthlyCycleToPay({
        year: 2026,
        month: 5,
        overrideReadiness: true,
        overrideReason: 'client says close anyway',
      } as never, req);
      throw new Error('Expected payroll close-to-pay to fail readiness');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      response = (error as BadRequestException).getResponse();
    }

    expect(response).toMatchObject({
      message: 'Payroll cycle has blocking readiness issues',
      readiness: {
        canClose: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'MISSING_PAYROLL_COMPENSATION' }),
          expect.objectContaining({ code: 'ZERO_OR_NEGATIVE_NET_PAY' }),
        ]),
      },
    });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('uses persisted enterprise evidence before final close-to-pay dispatch', async () => {
    const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
    const payrollCycleId = '550e8400-e29b-41d4-a716-446655440701';
    const calculationRunId = '550e8400-e29b-41d4-a716-446655440702';
    const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440703');
    const commandNames: string[] = [];
    const cycle = {
      id: new Uuid(payrollCycleId),
      tenantId,
      cycleName: 'May 2026 Payroll',
      payPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
      payPeriodEnd: new Date('2026-05-31T00:00:00.000Z'),
      payDate: new Date('2026-05-31T00:00:00.000Z'),
      status: 'DRAFT',
      aggregateVersion: 0,
    };
    const run = {
      id: new Uuid(calculationRunId),
      status: 'PENDING',
      aggregateVersion: 0,
    };
    const commandBus = {
      execute: vi.fn(async (command: { commandName: string }) => {
        commandNames.push(command.commandName);
        if (command.commandName === 'CreatePayrollCycle') {
          cycle.status = 'DRAFT';
          return { success: true, data: { payrollCycleId }, newState: cycle.status };
        }
        if (command.commandName === 'OpenPayrollCycle') cycle.status = 'OPEN';
        if (command.commandName === 'StartPayrollInputCollection') cycle.status = 'INPUT_COLLECTION';
        if (command.commandName === 'StartPayrollValidation') cycle.status = 'VALIDATION';
        if (command.commandName === 'StartPayrollCalculation') cycle.status = 'CALCULATION';
        if (command.commandName === 'StartPayrollReview') cycle.status = 'REVIEW';
        if (command.commandName === 'ApprovePayrollCycle') cycle.status = 'APPROVED';
        if (command.commandName === 'ClosePayrollCycle') cycle.status = 'CLOSED';
        if (command.commandName === 'StartPayrollCalculationRun') {
          run.status = 'PENDING';
          return { success: true, data: { payrollCalculationRunId: calculationRunId }, newState: run.status };
        }
        if (command.commandName === 'ValidatePayrollCalculationRun') run.status = 'VALIDATED';
        if (command.commandName === 'FinalizePayrollCalculationRun') run.status = 'FINALIZED';
        return { success: true, data: {}, newState: cycle.status };
      }),
    };
    const preview = {
      id: '2026-05',
      name: 'May 2026 Payroll',
      year: 2026,
      month: 5,
      calendarDays: 31,
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      payDate: '2026-05-31',
      employeeCount: 1,
      totalGross: 10000,
      totalTax: 1000,
      totalEmployeeInsurance: 500,
      totalEmployerInsurance: 700,
      totalPolicyDeductions: 0,
      totalNet: 8500,
      currency: 'EGP',
      rows: [{
        workerId: workerId.value,
        employeeId: 'EMP-TRUST-001',
        name: 'Trusted Worker',
        email: 'trusted.worker@example.com',
        grossSalary: 10000,
        netSalary: 8500,
        currency: 'EGP',
        explainability: [],
      }],
    };
    let storedPaymentBatch: unknown;
    const controller = new PayrollController(
      commandBus as never,
      {
        getSetup: async () => ({
          locations: [{ code: 'CAIRO_HQ', countryCode: 'EG', currency: 'EGP' }],
          statutoryPayrollPacks: [{
            code: 'EG_STAT',
            label: 'Egypt statutory payroll',
            active: true,
            countryCode: 'EG',
            locationCodes: ['CAIRO_HQ'],
            calculationPolicy: {
              taxRatePercent: 10,
              employeeInsuranceRatePercent: 5,
            },
          }],
        }),
      } as never,
      { findByStatusForTenant: async () => [], searchForTenant: async () => [] } as never,
      { findByWorkers: async () => [] } as never,
      { findByWorkersBetween: async () => [] } as never,
      {
        findByWorker: vi.fn(async () => [{
          workDate: '2026-05-01',
          locked: true,
          readyForPayroll: true,
        }]),
        findByWorkers: vi.fn(async (_tenantId, workerIds) => {
          const map = new Map();
          for (const id of workerIds) map.set(id.value, [{ workDate: '2026-05-01', locked: true, readyForPayroll: true }]);
          return map;
        }),
      } as never,
      {} as never,
      {
        buildMonthlyCycle: vi.fn(() => preview),
        buildBankTransferRows: vi.fn(() => [{
          employeeId: 'EMP-TRUST-001',
          workerId: workerId.value,
          name: 'Trusted Worker',
          workEmail: 'trusted.worker@example.com',
          bankName: 'National Bank',
          accountHolderName: 'Trusted Worker',
          accountNumber: '123',
          iban: '',
          routingNumber: '',
          swiftCode: '',
          netSalary: 8500,
          currency: 'EGP',
          bankReady: true,
          readinessReason: 'READY',
        }]),
        buildResultLineDrafts: vi.fn(() => []),
        buildPayslipsFromResultLines: vi.fn(() => []),
        maskRowForActor: (row: unknown) => row,
      } as never,
      new PayrollCycleGovernanceService() as never,
      {
        findById: vi.fn(async () => cycle),
        findByTenant: vi.fn(async () => []),
      } as never,
      { findByPayrollCycle: vi.fn(async () => []) } as never,
      { findById: vi.fn(async () => run) } as never,
      { findByPayrollCycle: vi.fn(async () => []) } as never,
      {
        save: vi.fn(async (record) => { storedPaymentBatch = record; }),
        findByPayrollCycle: vi.fn(async () => storedPaymentBatch),
      } as never,
      { saveMany: vi.fn(async () => undefined), findByPayrollCycle: vi.fn(async () => []) } as never,
      {} as never,
      { findByPayrollCycle: vi.fn(async () => undefined), save: vi.fn(async () => undefined) } as never,
      {
        buildInputDrafts: vi.fn(() => []),
        buildPaymentBatch: vi.fn((cyclePreview, rows) => ({
          batchId: `PAYMENT-${cyclePreview.id}`,
          payrollCycleId: cyclePreview.id,
          periodStart: cyclePreview.periodStart,
          periodEnd: cyclePreview.periodEnd,
          payDate: cyclePreview.payDate,
          ready: true,
          readyCount: rows.length,
          blockedCount: 0,
          totalNet: 8500,
          currency: 'EGP',
          rows,
        })),
        renderPayslipHtml: vi.fn(() => '<html></html>'),
      } as never,
      { applyApprovedInputs: vi.fn((cyclePreview) => cyclePreview) } as never,
      {
        buildPaymentBatchRecord: vi.fn(({ payrollCycleId, batch }) => ({
          id: 'batch-1',
          tenantId: tenantId.value,
          payrollCycleId,
          batchNumber: batch.batchId,
          status: batch.ready ? 'READY' : 'BLOCKED',
          periodStart: batch.periodStart,
          periodEnd: batch.periodEnd,
          payDate: batch.payDate,
          currency: batch.currency,
          readyCount: batch.readyCount,
          blockedCount: batch.blockedCount,
          totalNet: batch.totalNet,
          fileHash: 'hash',
          payload: batch,
          reconciliationSummary: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      new PayrollGlPostingService() as never,
    );
    const req = {
      tenantId: tenantId.value,
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440100'),
        roles: ['PAYROLL_ADMIN'],
        permissions: ['PAYROLL_MANAGE'],
        mfaAuthenticated: true,
      },
    } as never;

    let response: unknown;
    try {
      await controller.closeMonthlyCycleToPay({ year: 2026, month: 5 }, req);
      throw new Error('Expected persisted enterprise evidence to block final close');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      response = (error as BadRequestException).getResponse();
    }

    expect(response).toMatchObject({
      message: 'Payroll cycle has blocking readiness issues',
      readiness: {
        canClose: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'MISSING_GL_MAPPING' }),
          expect.objectContaining({ code: 'MISSING_PAYMENT_BATCH_CONFIG' }),
        ]),
      },
    });
    expect(commandNames).not.toContain('ApprovePayrollCycle');
    expect(commandNames).not.toContain('ClosePayrollCycle');
  });

  it('rebuilds persisted calculation rows before direct close readiness passes', async () => {
    const payrollCycleId = '550e8400-e29b-41d4-a716-446655440801';
    const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
    const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440802');
    const commandBus = { execute: vi.fn(async () => ({ success: true })) };
    const payrollCycle = {
      id: new Uuid(payrollCycleId),
      tenantId,
      cycleName: 'May 2026 Payroll',
      payPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
      payPeriodEnd: new Date('2026-05-31T00:00:00.000Z'),
      payDate: new Date('2026-05-31T00:00:00.000Z'),
      status: 'APPROVED',
      aggregateVersion: 4,
    };
    const controller = new PayrollController(
      commandBus as never,
      {
        getSetup: async () => ({
          locations: [{ code: 'CAIRO_HQ', countryCode: 'EG', currency: 'EGP' }],
          statutoryPayrollPacks: [{
            code: 'EG_STAT',
            label: 'Egypt statutory payroll',
            active: true,
            countryCode: 'EG',
            locationCodes: ['CAIRO_HQ'],
            bankFileFormats: ['CSV'],
            calculationPolicy: {
              taxRatePercent: 10,
              employeeInsuranceRatePercent: 5,
            },
            glAccountMapping: {
              salaryExpenseAccount: '6100',
              employerInsuranceExpenseAccount: '6110',
              taxPayableAccount: '2150',
              insurancePayableAccount: '2160',
              deductionPayableAccount: '2250',
              bankClearingAccount: '1050',
            },
          }],
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { findByWorkers: async () => new Map() } as never,
      { buildBankTransferRows: vi.fn(() => []) } as never,
      new PayrollCycleGovernanceService() as never,
      {
        findById: vi.fn(async () => payrollCycle),
        findByTenant: vi.fn(async () => [payrollCycle]),
      } as never,
      {} as never,
      {} as never,
      {
        findByPayrollCycle: vi.fn(async () => [{
          id: new Uuid('550e8400-e29b-41d4-a716-446655440803'),
          workerId,
          lineType: 'NET_PAY',
          description: 'Net pay',
          amount: 0,
          currency: 'EGP',
          ruleSetId: 'SYSTEM',
          explanation: 'gross - deductions',
          status: 'LOCKED',
        }]),
      } as never,
      {
        findByPayrollCycle: vi.fn(async () => ({
          status: 'READY',
          readyCount: 1,
          blockedCount: 0,
          totalNet: 0,
          currency: 'EGP',
          payload: {
            rows: [{
              employeeId: 'EMP-ZERO-001',
              workerId: workerId.value,
              name: 'Zero Net',
              workEmail: 'zero.net@example.com',
              bankName: 'National Bank',
              accountHolderName: 'Zero Net',
              accountNumber: '123',
              iban: '',
              routingNumber: '',
              swiftCode: '',
              netSalary: 0,
              currency: 'EGP',
              bankReady: true,
              readinessReason: 'READY',
            }],
          },
          reconciliationSummary: {},
        })),
      } as never,
      {
        findByPayrollCycle: vi.fn(async () => [{
          workerId: workerId.value,
          employeeId: 'EMP-ZERO-001',
          status: 'GENERATED',
          contentHash: 'hash',
          htmlContent: '<html>ready</html>',
        }]),
      } as never,
      {} as never,
      {
        findByPayrollCycle: vi.fn(async () => ({
          status: 'DRAFT',
          totalDebits: 0,
          totalCredits: 0,
          lines: [{ accountCode: '1050', description: 'Zero net', debit: 0, credit: 0, currency: 'EGP' }],
        })),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const req = {
      tenantId: tenantId.value,
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440100'),
        roles: ['PAYROLL_ADMIN'],
        permissions: ['PAYROLL_MANAGE'],
        mfaAuthenticated: true,
      },
    } as never;

    let response: unknown;
    try {
      await controller.closePayrollCycle(payrollCycleId, req);
      throw new Error('Expected persisted result lines to block direct close');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      response = (error as BadRequestException).getResponse();
    }

    expect(response).toMatchObject({
      message: 'Payroll cycle has blocking readiness issues',
      readiness: {
        canClose: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'ZERO_OR_NEGATIVE_NET_PAY', workerId: workerId.value }),
        ]),
      },
    });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('paginates through the full workforce instead of truncating at a single page, and batches per-worker data fetches (regression for HCM-P0-17)', async () => {
    const pageSize = 500; // must match PayrollController's internal page size
    const totalWorkers = pageSize + 1;
    const makeWorker = (i: number) => ({
      id: new Uuid(`00000000-0000-4000-8000-${i.toString().padStart(12, '0')}`),
      employeeNumber: `EMP-${i}`,
      firstName: 'Worker',
      lastName: `${i}`,
      email: { toString: () => `worker${i}@example.com` },
      employmentType: 'FULL_TIME',
    });
    const allWorkers = Array.from({ length: totalWorkers }, (_, i) => makeWorker(i));
    const findByStatusForTenant = vi.fn(async (_status: string, _tenantId: Uuid, options?: { limit?: number; offset?: number }) => {
      const limit = options?.limit ?? totalWorkers;
      const offset = options?.offset ?? 0;
      return allWorkers.slice(offset, offset + limit);
    });
    const findByWorker = vi.fn();
    const findByWorkers = vi.fn(async () => []);
    const findByWorkersBetween = vi.fn(async () => []);
    const findByWorkersLedger = vi.fn(async () => new Map());
    const payrollCalculation = {
      buildMonthlyCycle: vi.fn(({ employees }: { employees: unknown[] }) => ({
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
        rows: [],
      })),
      maskRowForActor: (row: unknown) => row,
    };
    const controller = new PayrollController(
      {} as never,
      { getSetup: async () => ({ locations: [{ code: 'CAIRO_HQ', countryCode: 'EG', currency: 'EGP', active: true }], attendancePolicy: {}, payrollBlockingRules: [] }) } as never,
      { findByStatusForTenant, searchForTenant: vi.fn(async () => []) } as never,
      { findByWorker, findByWorkers } as never,
      { findByWorker, findByWorkersBetween } as never,
      { findByWorker, findByWorkers: findByWorkersLedger } as never,
      { calculateDay: vi.fn(), summarizeMonth: vi.fn(() => ({ payableMinutes: 0 })) } as never,
      payrollCalculation as never,
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

    const employees = await (controller as any).buildPayrollEmployees(2026, 6, req);

    // Regression: the whole workforce must be fetched, not truncated at one page.
    expect(employees).toHaveLength(totalWorkers);
    expect(findByStatusForTenant).toHaveBeenCalledTimes(2);
    expect(findByStatusForTenant.mock.calls[0][2]).toMatchObject({ limit: pageSize, offset: 0 });
    expect(findByStatusForTenant.mock.calls[1][2]).toMatchObject({ limit: pageSize, offset: pageSize });

    // Regression: per-worker data is batch-fetched once for the whole
    // workforce, not fanned out into one query per worker (N+1).
    expect(findByWorkers).toHaveBeenCalledTimes(1);
    expect(findByWorkersBetween).toHaveBeenCalledTimes(1);
    expect(findByWorkersLedger).toHaveBeenCalledTimes(1);
    expect(findByWorker).not.toHaveBeenCalled();
  });
});
