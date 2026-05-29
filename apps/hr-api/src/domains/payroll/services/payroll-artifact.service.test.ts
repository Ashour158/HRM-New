import { describe, expect, it } from 'vitest';
import { PayrollArtifactService } from './payroll-artifact.service.js';
import type { PayrollPaymentBatch } from './payroll-input-orchestration.service.js';
import type { PayrollPayslip } from './payroll-cycle-calculation.service.js';

const paymentBatch: PayrollPaymentBatch = {
  batchId: 'PAYMENT-2026-05',
  payrollCycleId: 'cycle-1',
  periodStart: '2026-05-01',
  periodEnd: '2026-05-31',
  payDate: '2026-05-31',
  ready: true,
  readyCount: 1,
  blockedCount: 0,
  totalNet: 8400,
  currency: 'EGP',
  rows: [
    {
      employeeId: 'EMP-001',
      workerId: 'worker-1',
      name: 'Mona Hassan',
      workEmail: 'mona@example.com',
      bankName: 'National Bank',
      accountHolderName: 'Mona Hassan',
      accountNumber: '123456789',
      iban: '',
      routingNumber: '',
      swiftCode: '',
      netSalary: 8400,
      currency: 'EGP',
      bankReady: true,
      readinessReason: 'READY',
    },
  ],
};

const payslip: PayrollPayslip = {
  id: 'cycle-1:worker-1',
  workerId: 'worker-1',
  employeeId: 'EMP-001',
  employeeName: 'Mona Hassan',
  payPeriodStart: '2026-05-01',
  payPeriodEnd: '2026-05-31',
  payDate: '2026-05-31',
  grossPay: 10000,
  netPay: 8400,
  deductions: 600,
  taxes: 1000,
  currency: 'EGP',
  lines: [
    { id: 'line-1', workerId: 'worker-1', lineType: 'GROSS', description: 'Base gross salary', amount: 10000, currency: 'EGP' },
    { id: 'line-2', workerId: 'worker-1', lineType: 'NET_PAY', description: 'Net pay', amount: 8400, currency: 'EGP' },
  ],
};

describe('PayrollArtifactService', () => {
  const service = new PayrollArtifactService();

  it('creates hashed payment batch, payslip, and export audit records', () => {
    const payment = service.buildPaymentBatchRecord({
      tenantId: 'tenant-1',
      payrollCycleId: 'cycle-1',
      batch: paymentBatch,
      createdBy: 'actor-1',
    });
    const payslipArtifact = service.buildPayslipArtifactRecord({
      tenantId: 'tenant-1',
      payrollCycleId: 'cycle-1',
      payslip,
      htmlContent: '<html>payslip</html>',
    });
    const exportJob = service.buildExportJobRecord({
      tenantId: 'tenant-1',
      payrollCycleId: 'cycle-1',
      requestedBy: 'actor-1',
      exportType: 'BANK_SHEET_CSV',
      fileName: 'bank-sheet.csv',
      content: 'employeeId,netSalary\nEMP-001,8400',
      rowCount: 1,
      filters: { year: 2026, month: 5 },
      purpose: 'Bank transfer file',
    });

    expect(payment).toEqual(expect.objectContaining({
      tenantId: 'tenant-1',
      payrollCycleId: 'cycle-1',
      batchNumber: 'PAYMENT-2026-05',
      status: 'READY',
      readyCount: 1,
      blockedCount: 0,
      totalNet: 8400,
      currency: 'EGP',
      createdBy: 'actor-1',
    }));
    expect(payment.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(payment.payload.rows[0].employeeId).toBe('EMP-001');
    expect(payslipArtifact).toEqual(expect.objectContaining({
      tenantId: 'tenant-1',
      payrollCycleId: 'cycle-1',
      workerId: 'worker-1',
      employeeId: 'EMP-001',
      artifactFormat: 'HTML',
      dataClassification: 'HIGH_SENSITIVITY',
      grossPay: 10000,
      netPay: 8400,
    }));
    expect(payslipArtifact.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(exportJob).toEqual(expect.objectContaining({
      tenantId: 'tenant-1',
      payrollCycleId: 'cycle-1',
      exportType: 'BANK_SHEET_CSV',
      status: 'COMPLETED',
      requestedBy: 'actor-1',
      rowCount: 1,
      fileName: 'bank-sheet.csv',
      dataClassification: 'HIGH_SENSITIVITY',
    }));
    expect(exportJob.fileHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
