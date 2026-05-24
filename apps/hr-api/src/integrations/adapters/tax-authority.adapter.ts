/**
 * Tax Authority Filing Adapter
 *
 * Tax integrates with tax authorities.
 * On PayrollCycleClosed: generate tax filing reports.
 * On TaxJurisdictionAssignmentFinalized: notify tax authority.
 * Supports year-end form generation (W-2, 1099, etc.).
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Uuid } from '@hcm/shared-kernel';
import type { IntegrationAdapter, IntegrationResult, ValidationResult } from '../types.js';

export interface FilingResult extends IntegrationResult {
  filingId?: string;
  reportUrl?: string;
}

export interface SubmissionResult extends IntegrationResult {
  acknowledgementCode?: string;
  submittedAt?: Date;
}

export interface FormResult extends IntegrationResult {
  formUrl?: string;
  formType: string;
}

export type YearEndFormType = 'W-2' | 'W-2C' | '1099-NEC' | '1099-MISC' | '1095-C';

@Injectable()
export class TaxAuthorityAdapter implements IntegrationAdapter {
  readonly name = 'tax-authority';
  readonly direction = 'OUTBOUND' as const;
  private readonly logger = new Logger(TaxAuthorityAdapter.name);

  async healthCheck(): Promise<boolean> {
    // Mock: ping tax authority API
    return true;
  }

  /**
   * Generate a tax filing report for a closed payroll cycle.
   * @param cycleId      Payroll cycle aggregate id
   * @param jurisdiction Tax jurisdiction code (e.g. 'US-FED', 'DE-BY')
   */
  async generateTaxFiling(cycleId: Uuid, jurisdiction: string): Promise<FilingResult> {
    this.logger.log({ type: 'TAX_GENERATE_FILING', cycleId: cycleId.value, jurisdiction });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      filingId: `FIL-${cycleId.value}-${jurisdiction}`,
      details: { cycleId: cycleId.value, jurisdiction },
    };
  }

  /**
   * Submit a previously generated tax filing to the authority.
   * @param filingId Filing identifier returned by generateTaxFiling
   */
  async submitTaxFiling(filingId: string): Promise<SubmissionResult> {
    this.logger.log({ type: 'TAX_SUBMIT_FILING', filingId });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      acknowledgementCode: `ACK-${filingId}`,
      submittedAt: new Date(),
      details: { filingId },
    };
  }

  /**
   * Generate a year-end form for a worker.
   * @param workerId Worker aggregate id
   * @param year     Tax year
   * @param formType Form type (W-2, 1099, etc.)
   */
  async generateYearEndForm(workerId: Uuid, year: number, formType: YearEndFormType): Promise<FormResult> {
    this.logger.log({ type: 'TAX_GENERATE_YEAR_END', workerId: workerId.value, year, formType });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      formType,
      formUrl: `/tax/forms/${workerId.value}/${year}/${formType}.pdf`,
      details: { workerId: workerId.value, year, formType },
    };
  }

  /**
   * Validate tax data for a worker before filing.
   * @param workerId Worker aggregate id
   */
  async validateTaxData(workerId: Uuid): Promise<ValidationResult> {
    this.logger.log({ type: 'TAX_VALIDATE_DATA', workerId: workerId.value });

    return { valid: true, errors: [], warnings: [] };
  }

  async send(payload: unknown): Promise<IntegrationResult> {
    const p = payload as Record<string, unknown>;
    if (p.cycleId && p.jurisdiction) {
      return this.generateTaxFiling(p.cycleId as Uuid, p.jurisdiction as string);
    }
    if (p.filingId && p.action === 'SUBMIT') {
      return this.submitTaxFiling(p.filingId as string);
    }
    if (p.workerId && p.year && p.formType) {
      return this.generateYearEndForm(p.workerId as Uuid, p.year as number, p.formType as YearEndFormType);
    }
    throw new Error('Tax Authority Adapter: unsupported payload shape');
  }

  async receive(): Promise<unknown> {
    return { message: 'No inbound queue configured for tax authority adapter' };
  }
}
