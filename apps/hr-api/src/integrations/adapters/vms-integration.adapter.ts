/**
 * Vendor Management System (VMS) Adapter
 *
 * Contingent workforce integrates with external VMS platforms.
 * On ContingentAssignmentActivated: sync assignment to VMS.
 * On SowEngagementCreated: sync SOW engagement to VMS.
 * Receives timesheet and expense data from the VMS.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Uuid } from '@hcm/shared-kernel';
import type { IntegrationAdapter, IntegrationResult, ValidationResult } from '../types.js';

export interface VmsResult extends IntegrationResult {
  vmsReferenceId?: string;
}

export interface TimesheetResult extends IntegrationResult {
  timesheetId?: string;
  hoursApproved?: number;
}

export interface ExpenseResult extends IntegrationResult {
  expenseReportId?: string;
  amountApproved?: number;
}

export interface RateCardEntry {
  jobClassificationId: string;
  rateType: 'HOURLY' | 'DAILY' | 'FIXED';
  currency: string;
  amount: number;
  effectiveDate: string;
}

@Injectable()
export class VmsIntegrationAdapter implements IntegrationAdapter {
  readonly name = 'vms-integration';
  readonly direction = 'BIDIRECTIONAL' as const;
  private readonly logger = new Logger(VmsIntegrationAdapter.name);

  async healthCheck(): Promise<boolean> {
    // Mock: ping VMS health endpoint
    return true;
  }

  /**
   * Sync a contingent worker assignment to the VMS.
   * @param assignment Assignment metadata
   */
  async syncWorkerAssignment(assignment: {
    assignmentId: Uuid;
    workerId: Uuid;
    vendorId: Uuid;
    startDate: string;
    endDate?: string;
    rateAmount: number;
    rateCurrency: string;
  }): Promise<VmsResult> {
    this.logger.log({
      type: 'VMS_SYNC_ASSIGNMENT',
      assignmentId: assignment.assignmentId.value,
      workerId: assignment.workerId.value,
    });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      vmsReferenceId: `VMS-${assignment.assignmentId.value}`,
      details: { vendorId: assignment.vendorId.value },
    };
  }

  /**
   * Sync a Statement-of-Work engagement to the VMS.
   * @param sow SOW engagement metadata
   */
  async syncSowEngagement(sow: {
    sowId: Uuid;
    vendorId: Uuid;
    totalValue: number;
    currency: string;
    startDate: string;
    endDate: string;
  }): Promise<VmsResult> {
    this.logger.log({ type: 'VMS_SYNC_SOW', sowId: sow.sowId.value });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      vmsReferenceId: `VMS-SOW-${sow.sowId.value}`,
      details: { vendorId: sow.vendorId.value, totalValue: sow.totalValue },
    };
  }

  /**
   * Receive a timesheet submission from the VMS (INBOUND).
   * @param timesheet Timesheet payload
   */
  async receiveTimesheet(timesheet: {
    timesheetId: string;
    workerId: Uuid;
    assignmentId: Uuid;
    hours: number;
    periodStart: string;
    periodEnd: string;
  }): Promise<TimesheetResult> {
    this.logger.log({
      type: 'VMS_RECEIVE_TIMESHEET',
      timesheetId: timesheet.timesheetId,
      workerId: timesheet.workerId.value,
    });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      timesheetId: timesheet.timesheetId,
      hoursApproved: timesheet.hours,
      details: { assignmentId: timesheet.assignmentId.value },
    };
  }

  /**
   * Receive an expense report from the VMS (INBOUND).
   * @param expense Expense payload
   */
  async receiveExpense(expense: {
    expenseReportId: string;
    workerId: Uuid;
    assignmentId: Uuid;
    amount: number;
    currency: string;
    expenseDate: string;
  }): Promise<ExpenseResult> {
    this.logger.log({
      type: 'VMS_RECEIVE_EXPENSE',
      expenseReportId: expense.expenseReportId,
      workerId: expense.workerId.value,
    });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      expenseReportId: expense.expenseReportId,
      amountApproved: expense.amount,
      details: { currency: expense.currency },
    };
  }

  /**
   * Validate a rate card before syncing to the VMS.
   * @param rateCard Array of rate card entries
   */
  async validateRateCard(rateCard: RateCardEntry[]): Promise<ValidationResult> {
    this.logger.log({ type: 'VMS_VALIDATE_RATE_CARD', entries: rateCard.length });

    const errors: string[] = [];
    const warnings: string[] = [];

    for (const entry of rateCard) {
      if (entry.amount <= 0) {
        errors.push(`Rate amount must be positive for ${entry.jobClassificationId}`);
      }
      if (!entry.effectiveDate) {
        errors.push(`Effective date required for ${entry.jobClassificationId}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async send(payload: unknown): Promise<IntegrationResult> {
    const p = payload as Record<string, unknown>;
    if (p.assignmentId && p.workerId && p.vendorId) {
      return this.syncWorkerAssignment(p as unknown as {
        assignmentId: Uuid;
        workerId: Uuid;
        vendorId: Uuid;
        startDate: string;
        endDate?: string;
        rateAmount: number;
        rateCurrency: string;
      });
    }
    if (p.sowId && p.vendorId && p.totalValue) {
      return this.syncSowEngagement(p as unknown as {
        sowId: Uuid;
        vendorId: Uuid;
        totalValue: number;
        currency: string;
        startDate: string;
        endDate: string;
      });
    }
    throw new Error('VMS Integration Adapter: unsupported payload shape');
  }

  async receive(): Promise<unknown> {
    return { message: 'Use receiveTimesheet or receiveExpense for inbound VMS data' };
  }
}
