import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type { PayrollPayslip } from './payroll-cycle-calculation.service.js';
import type { PayrollPaymentBatch } from './payroll-input-orchestration.service.js';

export interface PayrollPaymentBatchRecord {
  id: string;
  tenantId: string;
  payrollCycleId: string;
  batchNumber: string;
  status: 'READY' | 'BLOCKED' | 'APPROVED' | 'EXPORTED' | 'RECONCILED' | 'RECONCILIATION_EXCEPTION';
  periodStart: string;
  periodEnd: string;
  payDate: string;
  currency: string;
  readyCount: number;
  blockedCount: number;
  totalNet: number;
  fileHash: string;
  payload: PayrollPaymentBatch;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  exportedAt?: Date;
  reconciledAt?: Date;
  bankFileFormat?: string;
  reconciliationSummary?: Record<string, unknown>;
  workflowEvents?: Array<Record<string, unknown>>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollPayslipArtifactRecord {
  id: string;
  tenantId: string;
  payrollCycleId: string;
  workerId: string;
  employeeId: string;
  artifactFormat: 'HTML';
  status: 'GENERATED' | 'PUBLISHED';
  grossPay: number;
  netPay: number;
  currency: string;
  contentHash: string;
  htmlContent: string;
  payslipPayload?: PayrollPayslip;
  dataClassification: 'HIGH_SENSITIVITY';
  publishedBy?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollExportJobRecord {
  id: string;
  tenantId: string;
  payrollCycleId?: string;
  exportType: string;
  status: 'COMPLETED';
  requestedBy?: string;
  purpose: string;
  filters: Record<string, unknown>;
  rowCount: number;
  fileName: string;
  fileHash: string;
  dataClassification: 'HIGH_SENSITIVITY';
  createdAt: Date;
  completedAt: Date;
}

function hash(value: unknown): string {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

@Injectable()
export class PayrollArtifactService {
  buildPaymentBatchRecord(input: {
    tenantId: string;
    payrollCycleId: string;
    batch: PayrollPaymentBatch;
    createdBy?: string;
  }): PayrollPaymentBatchRecord {
    const now = new Date();
    return {
      id: randomUUID(),
      tenantId: input.tenantId,
      payrollCycleId: input.payrollCycleId,
      batchNumber: input.batch.batchId,
      status: input.batch.ready ? 'READY' : 'BLOCKED',
      periodStart: input.batch.periodStart,
      periodEnd: input.batch.periodEnd,
      payDate: input.batch.payDate,
      currency: input.batch.currency,
      readyCount: input.batch.readyCount,
      blockedCount: input.batch.blockedCount,
      totalNet: input.batch.totalNet,
      fileHash: hash(input.batch),
      payload: input.batch,
      createdBy: input.createdBy,
      reconciliationSummary: {},
      workflowEvents: [{
        type: 'PaymentBatchCreated',
        actorId: input.createdBy,
        occurredAt: now.toISOString(),
      }],
      createdAt: now,
      updatedAt: now,
    };
  }

  buildPayslipArtifactRecord(input: {
    tenantId: string;
    payrollCycleId: string;
    payslip: PayrollPayslip;
    htmlContent: string;
  }): PayrollPayslipArtifactRecord {
    const now = new Date();
    return {
      id: randomUUID(),
      tenantId: input.tenantId,
      payrollCycleId: input.payrollCycleId,
      workerId: input.payslip.workerId,
      employeeId: input.payslip.employeeId,
      artifactFormat: 'HTML',
      status: 'GENERATED',
      grossPay: input.payslip.grossPay,
      netPay: input.payslip.netPay,
      currency: input.payslip.currency,
      contentHash: hash(input.htmlContent),
      htmlContent: input.htmlContent,
      payslipPayload: input.payslip,
      dataClassification: 'HIGH_SENSITIVITY',
      createdAt: now,
      updatedAt: now,
    };
  }

  buildExportJobRecord(input: {
    tenantId: string;
    payrollCycleId?: string;
    requestedBy?: string;
    exportType: string;
    fileName: string;
    content: string;
    rowCount: number;
    filters: Record<string, unknown>;
    purpose: string;
  }): PayrollExportJobRecord {
    const now = new Date();
    return {
      id: randomUUID(),
      tenantId: input.tenantId,
      payrollCycleId: input.payrollCycleId,
      exportType: input.exportType,
      status: 'COMPLETED',
      requestedBy: input.requestedBy,
      purpose: input.purpose,
      filters: input.filters,
      rowCount: input.rowCount,
      fileName: input.fileName,
      fileHash: hash(input.content),
      dataClassification: 'HIGH_SENSITIVITY',
      createdAt: now,
      completedAt: now,
    };
  }
}
