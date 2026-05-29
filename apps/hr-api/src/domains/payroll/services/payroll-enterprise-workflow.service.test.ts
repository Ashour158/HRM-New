import { describe, expect, it } from 'vitest';
import { PayrollEnterpriseWorkflowService } from './payroll-enterprise-workflow.service.js';
import type { PayrollPaymentBatchRecord, PayrollPayslipArtifactRecord } from './payroll-artifact.service.js';

const now = new Date('2026-05-31T12:00:00.000Z');

const paymentBatch = (status: PayrollPaymentBatchRecord['status'] = 'READY'): PayrollPaymentBatchRecord => ({
  id: 'batch-1',
  tenantId: 'tenant-1',
  payrollCycleId: 'cycle-1',
  batchNumber: 'PAYMENT-2026-05',
  status,
  periodStart: '2026-05-01',
  periodEnd: '2026-05-31',
  payDate: '2026-05-31',
  currency: 'EGP',
  readyCount: 1,
  blockedCount: 0,
  totalNet: 8400,
  fileHash: 'hash',
  payload: {
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
    rows: [],
  },
  workflowEvents: [],
  reconciliationSummary: {},
  createdAt: now,
  updatedAt: now,
});

const payslip = (): PayrollPayslipArtifactRecord => ({
  id: 'payslip-1',
  tenantId: 'tenant-1',
  payrollCycleId: 'cycle-1',
  workerId: 'worker-1',
  employeeId: 'EMP-001',
  artifactFormat: 'HTML',
  status: 'GENERATED',
  grossPay: 10000,
  netPay: 8400,
  currency: 'EGP',
  contentHash: 'hash',
  htmlContent: '<html></html>',
  dataClassification: 'HIGH_SENSITIVITY',
  createdAt: now,
  updatedAt: now,
});

describe('PayrollEnterpriseWorkflowService', () => {
  const service = new PayrollEnterpriseWorkflowService();

  it('moves payment batches through approval, export, and reconciliation with auditable events', () => {
    const approved = service.approvePaymentBatch(paymentBatch(), 'actor-1', now);
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('actor-1');
    expect(approved.approvedAt?.toISOString()).toBe(now.toISOString());

    const exported = service.markPaymentBatchExported(approved, 'CBE_EGYPT_CSV', 'actor-1', now);
    expect(exported.status).toBe('EXPORTED');
    expect(exported.bankFileFormat).toBe('CBE_EGYPT_CSV');
    expect(exported.exportedAt?.toISOString()).toBe(now.toISOString());

    const reconciled = service.reconcilePaymentBatch(exported, [
      { employeeId: 'EMP-001', amount: 8400, status: 'SETTLED', bankReference: 'BANK-1' },
    ], 'actor-2', now);
    expect(reconciled.status).toBe('RECONCILED');
    expect(reconciled.reconciliationSummary).toEqual(expect.objectContaining({
      settledCount: 1,
      exceptionCount: 0,
      settledAmount: 8400,
    }));
    expect(reconciled.workflowEvents?.map((event) => event.type)).toEqual([
      'PaymentBatchApproved',
      'PaymentBatchExported',
      'PaymentBatchReconciled',
    ]);
  });

  it('holds reconciliation exceptions when bank rows fail', () => {
    const exported = service.markPaymentBatchExported(
      service.approvePaymentBatch(paymentBatch(), 'actor-1', now),
      'CSV',
      'actor-1',
      now,
    );

    const reconciled = service.reconcilePaymentBatch(exported, [
      { employeeId: 'EMP-001', amount: 8400, status: 'FAILED', message: 'Closed bank account' },
    ], 'actor-2', now);

    expect(reconciled.status).toBe('RECONCILIATION_EXCEPTION');
    expect(reconciled.reconciliationSummary).toEqual(expect.objectContaining({
      settledCount: 0,
      exceptionCount: 1,
      exceptionAmount: 8400,
    }));
  });

  it('publishes payslips only from generated state', () => {
    const published = service.publishPayslip(payslip(), 'actor-1', now);
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedBy).toBe('actor-1');
    expect(published.publishedAt?.toISOString()).toBe(now.toISOString());
  });
});
