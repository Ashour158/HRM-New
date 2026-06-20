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
import { createReadinessMetadata } from '../readiness.js';
import { integrationEndpointConfigured, sendIntegrationHttpPayload } from '../http-transport.js';

export type ExportFormat = 'CSV' | 'XML' | 'JSON' | 'API';

@Injectable()
export class PayrollExportAdapter implements IntegrationAdapter {
  readonly name = 'payroll-export';
  readonly direction = 'OUTBOUND' as const;
  readonly readiness = createReadinessMetadata({
    ownerTeam: 'Payroll Integrations',
    ownerContact: 'payroll-integrations@example.com',
    sandboxEndpointRef: 'env:HR_PAYROLL_EXPORT_SANDBOX_ENDPOINT',
    productionEndpointRef: 'env:HR_PAYROLL_EXPORT_PRODUCTION_ENDPOINT',
    credentialRefBase: 'vault:integrations/payroll-export',
  });
  private readonly logger = new Logger(PayrollExportAdapter.name);

  async healthCheck(): Promise<boolean> {
    return integrationEndpointConfigured(this.readiness);
  }

  /**
   * Export an entire payroll cycle in the requested format.
   * @param cycleId Payroll cycle aggregate id
   * @param format  Target export format
   */
  async exportPayrollCycle(cycleId: Uuid, format: ExportFormat): Promise<ExportResult> {
    this.logger.log({ type: 'PAYROLL_EXPORT_CYCLE', cycleId: cycleId.value, format });

    const result = await sendIntegrationHttpPayload(this.name, this.readiness, {
      operation: 'EXPORT_PAYROLL_CYCLE',
      cycleId,
      format,
    });
    return { ...result, format };
  }

  /**
   * Export payslips for a payroll cycle.
   * @param cycleId Payroll cycle aggregate id
   */
  async exportPayslips(cycleId: Uuid): Promise<ExportResult> {
    this.logger.log({ type: 'PAYROLL_EXPORT_PAYSLIPS', cycleId: cycleId.value });

    const result = await sendIntegrationHttpPayload(this.name, this.readiness, {
      operation: 'EXPORT_PAYSLIPS',
      cycleId,
    });
    return { ...result, format: 'PDF' };
  }

  /**
   * Export GL journal entries for a payroll cycle.
   * @param cycleId Payroll cycle aggregate id
   */
  async exportJournalEntries(cycleId: Uuid): Promise<ExportResult> {
    this.logger.log({ type: 'PAYROLL_EXPORT_JOURNAL', cycleId: cycleId.value });

    const result = await sendIntegrationHttpPayload(this.name, this.readiness, {
      operation: 'EXPORT_JOURNAL',
      cycleId,
    });
    return { ...result, format: 'API' };
  }

  /**
   * Validate that a payroll cycle can be exported without errors.
   * @param cycleId Payroll cycle aggregate id
   */
  async validateExport(cycleId: Uuid): Promise<ValidationResult> {
    this.logger.log({ type: 'PAYROLL_VALIDATE_EXPORT', cycleId: cycleId.value });

    const result = await sendIntegrationHttpPayload(this.name, this.readiness, {
      operation: 'VALIDATE_EXPORT',
      cycleId,
    });
    return result.success
      ? { valid: true, errors: [], warnings: [] }
      : { valid: false, errors: [result.error ?? 'Payroll export validation failed'], warnings: [] };
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
