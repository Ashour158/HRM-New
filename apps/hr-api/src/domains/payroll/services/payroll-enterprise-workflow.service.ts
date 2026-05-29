import { BadRequestException, Injectable } from '@nestjs/common';
import type { PayrollPaymentBatchRecord, PayrollPayslipArtifactRecord } from './payroll-artifact.service.js';

export type PayrollReconciliationRow = {
  employeeId: string;
  amount: number;
  status: 'SETTLED' | 'FAILED' | 'RETURNED' | 'PARTIAL';
  bankReference?: string;
  message?: string;
};

function appendWorkflowEvent(
  record: PayrollPaymentBatchRecord,
  event: Record<string, unknown>,
): Array<Record<string, unknown>> {
  return [...(record.workflowEvents ?? []), event];
}

@Injectable()
export class PayrollEnterpriseWorkflowService {
  approvePaymentBatch(record: PayrollPaymentBatchRecord, actorId: string, at = new Date()): PayrollPaymentBatchRecord {
    if (record.status !== 'READY') {
      throw new BadRequestException(`Payment batch must be READY before approval, current status is ${record.status}`);
    }
    return {
      ...record,
      status: 'APPROVED',
      approvedBy: actorId,
      approvedAt: at,
      updatedAt: at,
      workflowEvents: appendWorkflowEvent(record, {
        type: 'PaymentBatchApproved',
        actorId,
        occurredAt: at.toISOString(),
      }),
    };
  }

  markPaymentBatchExported(
    record: PayrollPaymentBatchRecord,
    bankFileFormat: string,
    actorId: string,
    at = new Date(),
  ): PayrollPaymentBatchRecord {
    if (record.status !== 'APPROVED') {
      throw new BadRequestException(`Payment batch must be APPROVED before export, current status is ${record.status}`);
    }
    return {
      ...record,
      status: 'EXPORTED',
      bankFileFormat,
      exportedAt: at,
      updatedAt: at,
      workflowEvents: appendWorkflowEvent(record, {
        type: 'PaymentBatchExported',
        actorId,
        bankFileFormat,
        occurredAt: at.toISOString(),
      }),
    };
  }

  reconcilePaymentBatch(
    record: PayrollPaymentBatchRecord,
    rows: PayrollReconciliationRow[],
    actorId: string,
    at = new Date(),
  ): PayrollPaymentBatchRecord {
    if (record.status !== 'EXPORTED') {
      throw new BadRequestException(`Payment batch must be EXPORTED before reconciliation, current status is ${record.status}`);
    }
    const settledRows = rows.filter((row) => row.status === 'SETTLED');
    const exceptionRows = rows.filter((row) => row.status !== 'SETTLED');
    const settledAmount = settledRows.reduce((total, row) => total + Number(row.amount || 0), 0);
    const exceptionAmount = exceptionRows.reduce((total, row) => total + Number(row.amount || 0), 0);
    const status: PayrollPaymentBatchRecord['status'] = exceptionRows.length > 0 ? 'RECONCILIATION_EXCEPTION' : 'RECONCILED';
    return {
      ...record,
      status,
      reconciledAt: at,
      updatedAt: at,
      reconciliationSummary: {
        rowCount: rows.length,
        settledCount: settledRows.length,
        exceptionCount: exceptionRows.length,
        settledAmount,
        exceptionAmount,
        rows,
      },
      workflowEvents: appendWorkflowEvent(record, {
        type: status === 'RECONCILED' ? 'PaymentBatchReconciled' : 'PaymentBatchReconciliationException',
        actorId,
        rowCount: rows.length,
        exceptionCount: exceptionRows.length,
        occurredAt: at.toISOString(),
      }),
    };
  }

  publishPayslip(record: PayrollPayslipArtifactRecord, actorId: string, at = new Date()): PayrollPayslipArtifactRecord {
    if (record.status !== 'GENERATED') {
      throw new BadRequestException(`Payslip must be GENERATED before publication, current status is ${record.status}`);
    }
    return {
      ...record,
      status: 'PUBLISHED',
      publishedBy: actorId,
      publishedAt: at,
      updatedAt: at,
    };
  }
}
