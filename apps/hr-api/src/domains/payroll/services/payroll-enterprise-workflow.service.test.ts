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

  it('rounds the settled/exception totals to correct binary floating-point summation drift', () => {
    // 0.1 + 0.2 + 8399.99 in IEEE 754 double precision is
    // 8400.290000000001, not exactly 8400.29 -- naive accumulation left
    // the raw drift in the persisted reconciliation summary.
    const exported = service.markPaymentBatchExported(
      service.approvePaymentBatch(paymentBatch(), 'actor-1', now),
      'CBE_EGYPT_CSV',
      'actor-1',
      now,
    );

    const reconciled = service.reconcilePaymentBatch(exported, [
      { employeeId: 'EMP-001', amount: 0.1, status: 'SETTLED', bankReference: 'BANK-1' },
      { employeeId: 'EMP-002', amount: 0.2, status: 'SETTLED', bankReference: 'BANK-2' },
      { employeeId: 'EMP-003', amount: 8399.99, status: 'SETTLED', bankReference: 'BANK-3' },
    ], 'actor-2', now);

    const rawSum = 0.1 + 0.2 + 8399.99;
    expect(rawSum).not.toBe(8400.29); // sanity: raw float drift is real
    expect(reconciled.reconciliationSummary).toEqual(expect.objectContaining({
      settledAmount: 8400.29,
    }));
  });

  it('fails loudly instead of silently turning a corrupt settlement amount into NaN', () => {
    // Previously: Number(row.amount || 0) on a non-numeric `amount` (as can
    // arrive from an unvalidated HTTP body despite the `number` TS type)
    // produced NaN, which then silently poisoned the entire settledAmount
    // total for the whole payment batch instead of failing the request.
    const exported = service.markPaymentBatchExported(
      service.approvePaymentBatch(paymentBatch(), 'actor-1', now),
      'CBE_EGYPT_CSV',
      'actor-1',
      now,
    );

    const corruptRows = [
      { employeeId: 'EMP-001', amount: 'not-a-number' as unknown as number, status: 'SETTLED' as const, bankReference: 'BANK-1' },
    ];

    expect(() => service.reconcilePaymentBatch(exported, corruptRows, 'actor-2', now)).toThrow(/Expected a numeric value/);
  });

  it('publishes payslips only from generated state', () => {
    const published = service.publishPayslip(payslip(), 'actor-1', now);
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedBy).toBe('actor-1');
    expect(published.publishedAt?.toISOString()).toBe(now.toISOString());
  });
});
