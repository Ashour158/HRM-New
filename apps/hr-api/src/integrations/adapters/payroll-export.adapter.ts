/**
 * Payroll Export Adapter
 *
 * Payroll produces pay-cycle facts; Finance/ERP owns the general ledger.
 * On PayrollCycleApproved this adapter exports payroll data to the
 * downstream Finance/ERP system.
 *
 * Supported formats: CSV, XML, JSON, API
 * Export types: gross-to-net, deductions, taxes, journal entries
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Uuid } from '@hcm/shared-kernel';
import type { ExportResult, IntegrationAdapter, IntegrationResult, ValidationResult } from '../types.js';

export type ExportFormat = 'CSV' | 'XML' | 'JSON' | 'API';

@Injectable()
export class PayrollExportAdapter implements IntegrationAdapter {
  readonly name = 'payroll-export';
  readonly direction = 'OUTBOUND' as const;
  private readonly logger = new Logger(PayrollExportAdapter.name);

  async healthCheck(): Promise<boolean> {
    // Mock: in production ping Finance/ERP health endpoint
    return true;
  }

  /**
   * Export an entire payroll cycle in the requested format.
   * @param cycleId Payroll cycle aggregate id
   * @param format  Target export format
   */
  async exportPayrollCycle(cycleId: Uuid, format: ExportFormat): Promise<ExportResult> {
    this.logger.log({ type: 'PAYROLL_EXPORT_CYCLE', cycleId: cycleId.value, format });

    // Mock implementation
    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      format,
      recordCount: 0,
      details: { cycleId: cycleId.value },
    };
  }

  /**
   * Export payslips for a payroll cycle.
   * @param cycleId Payroll cycle aggregate id
   */
  async exportPayslips(cycleId: Uuid): Promise<ExportResult> {
    this.logger.log({ type: 'PAYROLL_EXPORT_PAYSLIPS', cycleId: cycleId.value });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      format: 'PDF',
      recordCount: 0,
      details: { cycleId: cycleId.value },
    };
  }

  /**
   * Export GL journal entries for a payroll cycle.
   * @param cycleId Payroll cycle aggregate id
   */
  async exportJournalEntries(cycleId: Uuid): Promise<ExportResult> {
    this.logger.log({ type: 'PAYROLL_EXPORT_JOURNAL', cycleId: cycleId.value });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      format: 'API',
      recordCount: 0,
      details: { cycleId: cycleId.value },
    };
  }

  /**
   * Validate that a payroll cycle can be exported without errors.
   * @param cycleId Payroll cycle aggregate id
   */
  async validateExport(cycleId: Uuid): Promise<ValidationResult> {
    this.logger.log({ type: 'PAYROLL_VALIDATE_EXPORT', cycleId: cycleId.value });

    // Mock implementation – in production run schema/平衡 checks
    return { valid: true, errors: [], warnings: [] };
  }

  async send(payload: unknown): Promise<IntegrationResult> {
    const p = payload as Record<string, unknown>;
    if (p.cycleId && p.format) {
      return this.exportPayrollCycle(p.cycleId as Uuid, p.format as ExportFormat);
    }
    if (p.cycleId && p.action === 'EXPORT_PAYSLIPS') {
      return this.exportPayslips(p.cycleId as Uuid);
    }
    if (p.cycleId && p.action === 'EXPORT_JOURNAL') {
      return this.exportJournalEntries(p.cycleId as Uuid);
    }
    throw new Error('Payroll Export Adapter: unsupported payload shape');
  }

  async receive(): Promise<unknown> {
    return { message: 'No inbound queue configured for payroll export adapter' };
  }
}
