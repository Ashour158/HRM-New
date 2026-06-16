import { Controller, Get, Post, Body, Param, Query, Req, Res, BadRequestException, ForbiddenException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { AuthGuard } from '../../../guards/auth.guard.js';
import { actorClientType, requireActor, requireTenantId } from '../../../platform/http/request-context.js';

import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { resolveTenantCurrency } from '../../hcm-setup/hcm-setup-currency.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import type { HcmSetupConfig, PayrollGlAccountMapping } from '../../hcm-setup/hcm-setup.types.js';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import { PersonalDataRecordRepository } from '../../hr-core/repositories/personal-data-record.repository.js';
import { AttendanceCalculationService, type AttendanceSession } from '../../time-attendance/services/attendance-calculation.service.js';
import { TimeClockEventRepository } from '../../time-attendance/repositories/time-clock-event.repository.js';
import { AttendanceDailyLedgerRepository } from '../../time-attendance/repositories/attendance-daily-ledger.repository.js';
import { PayrollCycleRepository } from '../repositories/payroll-cycle.repository.js';
import { PayrollInputRepository } from '../repositories/payroll-input.repository.js';
import { PayrollCalculationRunRepository } from '../repositories/payroll-calculation-run.repository.js';
import { PayrollResultLineRepository } from '../repositories/payroll-result-line.repository.js';
import { PayrollPaymentBatchRepository } from '../repositories/payroll-payment-batch.repository.js';
import { PayrollPayslipArtifactRepository } from '../repositories/payroll-payslip-artifact.repository.js';
import { PayrollExportJobRepository } from '../repositories/payroll-export-job.repository.js';
import { PayrollGlPostingRepository } from '../repositories/payroll-gl-posting.repository.js';
import {
  PayrollCycleCalculationService,
  type PayrollBankAccount,
  type PayrollBankTransferRow,
  type PayrollCycleEmployeeInput,
  type PayrollCyclePreview,
  type PayrollCycleRow,
} from '../services/payroll-cycle-calculation.service.js';
import {
  PayrollCycleGovernanceService,
  type PayrollCloseGlPostingEvidence,
  type PayrollClosePaymentBatchEvidence,
  type PayrollClosePayslipArtifactEvidence,
  type ExistingPayrollCycleSummary,
  type PayrollCloseToPayReadiness,
  type PayrollReadinessIssue,
} from '../services/payroll-cycle-governance.service.js';
import { PayrollInputOrchestrationService, type PayrollInputDraft } from '../services/payroll-input-orchestration.service.js';
import { PayrollApprovedInputProjectionService, type PayrollApprovedInputRecord } from '../services/payroll-approved-input-projection.service.js';
import { PayrollArtifactService } from '../services/payroll-artifact.service.js';
import { DocumentExportService, EXPORT_CONTENT_TYPES } from '../../../platform/export/document-export.service.js';
import { PayrollEnterpriseWorkflowService, type PayrollReconciliationRow } from '../services/payroll-enterprise-workflow.service.js';
import { PayrollBankFileService, type PayrollBankFileFormat } from '../services/payroll-bank-file.service.js';
import { PayrollGlPostingService } from '../services/payroll-gl-posting.service.js';
import type * as dtos from './dtos.js';
import {
  CreatePayrollCycleDtoSchema, CreatePayrollInputDtoSchema,
  StartPayrollCalculationRunDtoSchema, CalculatePayrollResultLineDtoSchema, ZodValidationPipe,
} from './dtos.js';

type PayrollCsvRow = {
  employeeId?: string;
  workEmail?: string;
  grossSalary?: number;
  currency?: string;
  taxOverride?: number;
  insuranceOverride?: number;
  deductionCode?: string;
  deductionAmount?: number;
  effectiveMonth?: string;
};

type PayrollOffCycleRow = {
  employeeId?: string;
  inputType?: 'OFF_CYCLE_EARNING' | 'RETRO_ADJUSTMENT' | 'OFF_CYCLE_DEDUCTION' | 'RETRO_DEDUCTION';
  amount?: number;
  currency?: string;
  description?: string;
};

type ClockLocationPayload = {
  distanceMeters?: number;
};

const PAYROLL_VISIBILITY_ROLES = new Set(['HR_ADMIN', 'PAYROLL_ADMIN', 'SUPER_ADMIN']);

function csvEscape(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(rows: Array<Record<string, string | number | null | undefined>>): string {
  const headers = Object.keys(rows[0] ?? {
    employeeId: '',
    name: '',
    workEmail: '',
    department: '',
    workLocationCode: '',
    taxIdentifier: '',
    insuranceIdentifier: '',
    baseGrossSalary: '',
    earningAmount: '',
    taxableEarningAmount: '',
    nonTaxableEarningAmount: '',
    grossSalary: '',
    taxAmount: '',
    employeeInsuranceAmount: '',
    policyDeductionAmount: '',
    netSalary: '',
    currency: '',
  });
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n');
}

function parseClockLocation(value?: string): ClockLocationPayload {
  if (!value) return {};
  try {
    return JSON.parse(value) as ClockLocationPayload;
  } catch {
    return {};
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function requirePayrollCurrency(currency: string | undefined, context: string): string {
  if (!currency) throw new BadRequestException(`${context} currency is required`);
  return currency;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@ApiTags('Payroll')
@UseGuards(AuthGuard)
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly hcmSetupService: HcmSetupService,
    private readonly workerRepo: WorkerRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly timeClockEventRepo: TimeClockEventRepository,
    private readonly attendanceDailyLedgerRepo: AttendanceDailyLedgerRepository,
    private readonly attendanceCalculation: AttendanceCalculationService,
    private readonly payrollCalculation: PayrollCycleCalculationService,
    private readonly payrollGovernance: PayrollCycleGovernanceService,
    private readonly payrollCycleRepo: PayrollCycleRepository,
    private readonly payrollInputRepo: PayrollInputRepository,
    private readonly calculationRunRepo: PayrollCalculationRunRepository,
    private readonly resultLineRepo: PayrollResultLineRepository,
    private readonly paymentBatchRepo: PayrollPaymentBatchRepository,
    private readonly payslipArtifactRepo: PayrollPayslipArtifactRepository,
    private readonly exportJobRepo: PayrollExportJobRepository,
    private readonly glPostingRepo: PayrollGlPostingRepository,
    private readonly payrollInputOrchestration: PayrollInputOrchestrationService,
    private readonly payrollApprovedInputProjection: PayrollApprovedInputProjectionService,
    private readonly payrollArtifact: PayrollArtifactService,
    private readonly documentExport: DocumentExportService,
    _payrollEnterpriseWorkflow: PayrollEnterpriseWorkflowService,
    _payrollBankFile: PayrollBankFileService,
    private readonly payrollGlPosting: PayrollGlPostingService,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = requireTenantId(req, 'Payroll');
    const actor = requireActor(req, 'Payroll');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor,
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: actorClientType(actor) },
    };
  }

  private getTenantId(req: Request): Uuid {
    return requireTenantId(req, 'Payroll');
  }

  private hasPayrollVisibility(req: Request): boolean {
    return (req.actor?.roles ?? []).some((role) => PAYROLL_VISIBILITY_ROLES.has(role));
  }

  private getActorId(req: Request): string {
    const actorId = req.actor?.actorId;
    if (actorId instanceof Uuid) return actorId.value;
    const actorIdLike = actorId as { value?: unknown } | undefined;
    if (typeof actorIdLike?.value === 'string') return actorIdLike.value;
    throw new ForbiddenException('Authenticated actor is required');
  }

  private getActorUuid(req: Request): Uuid {
    try {
      return new Uuid(this.getActorId(req));
    } catch {
      return Uuid.generate();
    }
  }

  private getActorUuidString(req: Request): string | undefined {
    try {
      return new Uuid(this.getActorId(req)).value;
    } catch {
      return undefined;
    }
  }

  private safeUuid(value: string | undefined, fallback: Uuid): Uuid {
    return value && Uuid.isValid(value) ? new Uuid(value) : fallback;
  }

  private async executeOrThrow<T>(command: HrCommandEnvelope<unknown>): Promise<CommandResult<T>> {
    const result = await this.commandBus.execute(command) as CommandResult<T>;
    const maybeFailure = result as { success?: boolean; errorMessage?: string; errorCode?: string };
    if (maybeFailure.success === false) {
      const failure = result as CommandResult<T> & { errorMessage?: string; errorCode?: string };
      throw new BadRequestException(failure.errorMessage ?? failure.errorCode ?? 'Payroll command failed');
    }
    return result;
  }

  private readResultId(result: CommandResult<unknown>, key: string): string {
    const data = result.data as Record<string, unknown> | undefined;
    const value = data?.[key];
    if (typeof value !== 'string') throw new BadRequestException(`Payroll command did not return ${key}`);
    return value;
  }

  private async advancePayrollCycle(commandName: string, payrollCycleId: string, req: Request): Promise<CommandResult<unknown>> {
    const cycle = await this.payrollCycleRepo.findById(new Uuid(payrollCycleId));
    if (!cycle) throw new BadRequestException('Payroll cycle not found');
    const payload = commandName === 'ApprovePayrollCycle'
      ? { payrollCycleId: new Uuid(payrollCycleId), approvedBy: this.getActorUuid(req) }
      : { payrollCycleId: new Uuid(payrollCycleId) };
    return this.executeOrThrow(this.buildCommand(commandName, 'PayrollCycle', payload, req, {
      aggregateId: new Uuid(payrollCycleId),
      expectedState: cycle.status,
      expectedVersion: cycle.aggregateVersion,
    }));
  }

  private async advanceCalculationRun(commandName: string, calculationRunId: string, req: Request): Promise<CommandResult<unknown>> {
    const run = await this.calculationRunRepo.findById(new Uuid(calculationRunId));
    if (!run) throw new BadRequestException('Payroll calculation run not found');
    return this.executeOrThrow(this.buildCommand(commandName, 'PayrollCalculationRun', {
      payrollCalculationRunId: new Uuid(calculationRunId),
    }, req, {
      aggregateId: new Uuid(calculationRunId),
      expectedState: run.status,
      expectedVersion: run.aggregateVersion,
    }));
  }

  private async lockResultLineThroughWorkflow(payrollResultLineId: string, explanation: string, req: Request): Promise<void> {
    let line = await this.resultLineRepo.findById(new Uuid(payrollResultLineId));
    if (!line) throw new BadRequestException('Payroll result line not found');
    await this.executeOrThrow(this.buildCommand('ExplainPayrollResultLine', 'PayrollResultLine', {
      payrollResultLineId: new Uuid(payrollResultLineId),
      explanation,
    }, req, {
      aggregateId: new Uuid(payrollResultLineId),
      expectedState: line.status,
      expectedVersion: line.aggregateVersion,
      subjectWorkerId: line.workerId,
    }));

    line = await this.resultLineRepo.findById(new Uuid(payrollResultLineId));
    if (!line) throw new BadRequestException('Payroll result line not found');
    await this.executeOrThrow(this.buildCommand('ReviewPayrollResultLine', 'PayrollResultLine', {
      payrollResultLineId: new Uuid(payrollResultLineId),
    }, req, {
      aggregateId: new Uuid(payrollResultLineId),
      expectedState: line.status,
      expectedVersion: line.aggregateVersion,
      subjectWorkerId: line.workerId,
    }));

    line = await this.resultLineRepo.findById(new Uuid(payrollResultLineId));
    if (!line) throw new BadRequestException('Payroll result line not found');
    await this.executeOrThrow(this.buildCommand('LockPayrollResultLine', 'PayrollResultLine', {
      payrollResultLineId: new Uuid(payrollResultLineId),
    }, req, {
      aggregateId: new Uuid(payrollResultLineId),
      expectedState: line.status,
      expectedVersion: line.aggregateVersion,
      subjectWorkerId: line.workerId,
    }));
  }

  private async approvePayrollInputThroughWorkflow(draft: PayrollInputDraft, req: Request): Promise<string> {
    const inputResult = await this.executeOrThrow(this.buildCommand('CreatePayrollInput', 'PayrollInput', {
      workerId: new Uuid(draft.workerId),
      payrollCycleId: new Uuid(draft.payrollCycleId),
      inputType: draft.inputType,
      amount: draft.amount,
      currency: draft.currency,
      description: draft.description,
    }, req, {
      subjectWorkerId: new Uuid(draft.workerId),
    }));
    const payrollInputId = this.readResultId(inputResult, 'payrollInputId');

    let input = await this.payrollInputRepo.findById(new Uuid(payrollInputId));
    if (!input) throw new BadRequestException('Payroll input not found after creation');
    await this.executeOrThrow(this.buildCommand('SubmitPayrollInput', 'PayrollInput', {
      payrollInputId: new Uuid(payrollInputId),
    }, req, {
      aggregateId: new Uuid(payrollInputId),
      expectedState: input.status,
      expectedVersion: input.aggregateVersion,
      subjectWorkerId: input.workerId,
    }));

    input = await this.payrollInputRepo.findById(new Uuid(payrollInputId));
    if (!input) throw new BadRequestException('Payroll input not found after submission');
    await this.executeOrThrow(this.buildCommand('ApprovePayrollInput', 'PayrollInput', {
      payrollInputId: new Uuid(payrollInputId),
    }, req, {
      aggregateId: new Uuid(payrollInputId),
      expectedState: input.status,
      expectedVersion: input.aggregateVersion,
      subjectWorkerId: input.workerId,
    }));

    return payrollInputId;
  }

  private validateMassUpdateRows(rows: PayrollCsvRow[]): Array<{ row: number; field: string; message: string }> {
    const seenEmployeeIds = new Set<string>();
    const errors: Array<{ row: number; field: string; message: string }> = [];

    rows.forEach((row, index) => {
      if (!row.employeeId) errors.push({ row: index + 1, field: 'employeeId', message: 'Employee ID is required' });
      if (row.employeeId && seenEmployeeIds.has(row.employeeId)) errors.push({ row: index + 1, field: 'employeeId', message: 'Duplicate employee ID in upload' });
      if (row.employeeId) seenEmployeeIds.add(row.employeeId);
      if (row.grossSalary !== undefined && Number(row.grossSalary) < 0) errors.push({ row: index + 1, field: 'grossSalary', message: 'Gross salary cannot be negative' });
      if (row.taxOverride !== undefined && Number(row.taxOverride) < 0) errors.push({ row: index + 1, field: 'taxOverride', message: 'Tax override cannot be negative' });
      if (row.insuranceOverride !== undefined && Number(row.insuranceOverride) < 0) errors.push({ row: index + 1, field: 'insuranceOverride', message: 'Insurance override cannot be negative' });
      if (row.deductionAmount !== undefined && Number(row.deductionAmount) < 0) errors.push({ row: index + 1, field: 'deductionAmount', message: 'Deduction amount cannot be negative' });
      if (row.currency && row.currency.length !== 3) errors.push({ row: index + 1, field: 'currency', message: 'Currency must be a 3-letter ISO code' });
    });

    return errors;
  }

  private validateOffCycleRows(rows: PayrollOffCycleRow[]): Array<{ row: number; field: string; message: string }> {
    const errors: Array<{ row: number; field: string; message: string }> = [];
    rows.forEach((row, index) => {
      if (!row.employeeId) errors.push({ row: index + 1, field: 'employeeId', message: 'Employee ID is required' });
      if (!row.inputType) errors.push({ row: index + 1, field: 'inputType', message: 'Input type is required' });
      if (row.amount === undefined || Number(row.amount) <= 0) errors.push({ row: index + 1, field: 'amount', message: 'Amount must be greater than zero' });
      if (row.currency && row.currency.length !== 3) errors.push({ row: index + 1, field: 'currency', message: 'Currency must be a 3-letter ISO code' });
    });
    return errors;
  }

  private async applyMassUpdateRowsToInputCollection(payrollCycleId: string, rows: PayrollCsvRow[], req: Request) {
    const applied: Array<{ employeeId: string; workerId: string; inputTypes: string[] }> = [];
    const tenantCurrency = await this.resolvePayrollCurrencyForRequest(req);
    for (const row of rows) {
      if (!row.employeeId) continue;
      const worker = await this.findWorkerByEmployeeId(row.employeeId, this.getTenantId(req));
      if (!worker) {
        throw new BadRequestException(`Employee ${row.employeeId} was not found`);
      }
      const inputTypes: string[] = [];
      const baseDescription = `${row.employeeId} payroll mass update`;
      const drafts: PayrollInputDraft[] = [];
      if (row.grossSalary !== undefined) {
        drafts.push({
          workerId: worker.id.value,
          payrollCycleId,
          inputType: 'MASS_UPDATE_GROSS_PAY',
          amount: Number(row.grossSalary),
          currency: row.currency ?? tenantCurrency,
          description: `${baseDescription} gross salary`,
        });
      }
      if (row.taxOverride !== undefined) {
        drafts.push({
          workerId: worker.id.value,
          payrollCycleId,
          inputType: 'MASS_UPDATE_TAX_OVERRIDE',
          amount: Number(row.taxOverride),
          currency: row.currency ?? tenantCurrency,
          description: `${baseDescription} tax override`,
        });
      }
      if (row.insuranceOverride !== undefined) {
        drafts.push({
          workerId: worker.id.value,
          payrollCycleId,
          inputType: 'MASS_UPDATE_INSURANCE_OVERRIDE',
          amount: Number(row.insuranceOverride),
          currency: row.currency ?? tenantCurrency,
          description: `${baseDescription} insurance override`,
        });
      }
      if (row.deductionAmount !== undefined) {
        drafts.push({
          workerId: worker.id.value,
          payrollCycleId,
          inputType: row.deductionCode ? `MASS_UPDATE_DEDUCTION_${row.deductionCode}` : 'MASS_UPDATE_DEDUCTION',
          amount: Number(row.deductionAmount),
          currency: row.currency ?? tenantCurrency,
          description: `${baseDescription} deduction ${row.deductionCode ?? ''}`.trim(),
        });
      }
      for (const draft of drafts) {
        await this.approvePayrollInputThroughWorkflow(draft, req);
        inputTypes.push(draft.inputType);
      }
      applied.push({ employeeId: row.employeeId, workerId: worker.id.value, inputTypes });
    }

    return {
      appliedRows: applied,
      inputCount: applied.reduce((total, row) => total + row.inputTypes.length, 0),
    };
  }

  private async buildMassUpdateProjectionInputs(rows: PayrollCsvRow[], tenantCurrency: string, tenantId: Uuid): Promise<PayrollApprovedInputRecord[]> {
    const inputs: PayrollApprovedInputRecord[] = [];
    for (const row of rows) {
      if (!row.employeeId) continue;
      const worker = await this.findWorkerByEmployeeId(row.employeeId, tenantId);
      if (!worker) {
        throw new BadRequestException(`Employee ${row.employeeId} was not found`);
      }
      const currency = row.currency ?? tenantCurrency;
      if (row.grossSalary !== undefined) inputs.push({
        workerId: worker.id.value,
        inputType: 'MASS_UPDATE_GROSS_PAY',
        amount: Number(row.grossSalary),
        currency,
        status: 'APPROVED',
        description: `${row.employeeId} projected gross salary`,
      });
      if (row.taxOverride !== undefined) inputs.push({
        workerId: worker.id.value,
        inputType: 'MASS_UPDATE_TAX_OVERRIDE',
        amount: Number(row.taxOverride),
        currency,
        status: 'APPROVED',
        description: `${row.employeeId} projected tax override`,
      });
      if (row.insuranceOverride !== undefined) inputs.push({
        workerId: worker.id.value,
        inputType: 'MASS_UPDATE_INSURANCE_OVERRIDE',
        amount: Number(row.insuranceOverride),
        currency,
        status: 'APPROVED',
        description: `${row.employeeId} projected insurance override`,
      });
      if (row.deductionAmount !== undefined) inputs.push({
        workerId: worker.id.value,
        inputType: row.deductionCode ? `MASS_UPDATE_DEDUCTION_${row.deductionCode}` : 'MASS_UPDATE_DEDUCTION',
        amount: Number(row.deductionAmount),
        currency,
        status: 'APPROVED',
        description: `${row.employeeId} projected deduction ${row.deductionCode ?? ''}`.trim(),
      });
    }
    return inputs;
  }

  private async buildOffCycleProjectionInputs(rows: PayrollOffCycleRow[], tenantCurrency: string, tenantId: Uuid): Promise<PayrollApprovedInputRecord[]> {
    const inputs: PayrollApprovedInputRecord[] = [];
    for (const row of rows) {
      if (!row.employeeId || !row.inputType || row.amount === undefined) continue;
      const worker = await this.findWorkerByEmployeeId(row.employeeId, tenantId);
      if (!worker) throw new BadRequestException(`Employee ${row.employeeId} was not found`);
      inputs.push({
        workerId: worker.id.value,
        inputType: row.inputType,
        amount: Number(row.amount),
        currency: row.currency ?? tenantCurrency,
        status: 'APPROVED',
        description: row.description ?? `${row.employeeId} ${row.inputType.toLowerCase().replace(/_/g, ' ')}`,
      });
    }
    return inputs;
  }

  private toApprovedInputRecords(inputs: Awaited<ReturnType<PayrollInputRepository['findByPayrollCycle']>>): PayrollApprovedInputRecord[] {
    return inputs.map((input) => ({
      workerId: input.workerId.value,
      inputType: input.inputType,
      amount: input.amount,
      currency: input.currency,
      status: input.status,
      description: input.description,
    }));
  }

  private async findWorkerByEmployeeId(employeeId: string, tenantId: Uuid) {
    // Resolve strictly within the request tenant so colliding employee numbers across
    // tenants cannot leak/cross-apply another tenant's worker.
    const activeWorkers = await this.workerRepo.findByStatusForTenant('ACTIVE', tenantId, { limit: 1000 });
    const fallbackWorkers = activeWorkers.length > 0
      ? activeWorkers
      : await this.workerRepo.searchForTenant('', tenantId, { limit: 1000 });
    return fallbackWorkers.find((worker) => worker.employeeNumber === employeeId);
  }

  private async resolvePayrollCurrencyForRequest(req: Request): Promise<string> {
    return resolveTenantCurrency(await this.hcmSetupService.getSetup(requireTenantId(req)));
  }

  private toSessions(events: Array<{ eventType: string; timestamp: Date; location?: string }>): AttendanceSession[] {
    const sorted = [...events].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
    const sessions: AttendanceSession[] = [];
    let checkIn: { timestamp: Date; location?: string } | undefined;

    for (const event of sorted) {
      if (event.eventType === 'CLOCK_IN') {
        checkIn = { timestamp: event.timestamp, location: event.location };
      } else if (event.eventType === 'CLOCK_OUT' && checkIn) {
        sessions.push({
          checkInAt: checkIn.timestamp,
          checkOutAt: event.timestamp,
          distanceMeters: parseClockLocation(checkIn.location).distanceMeters,
        });
        checkIn = undefined;
      }
    }

    return sessions;
  }

  private async buildAttendanceSummary(workerId: Uuid, year: number, month: number, req: Request) {
    const periodStart = `${year}-${month.toString().padStart(2, '0')}-01`;
    const periodEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const lockedSnapshots = await this.attendanceDailyLedgerRepo.findByWorker(this.getTenantId(req), workerId, {
      dateFrom: periodStart,
      dateTo: periodEnd,
    });
    if (lockedSnapshots.some((snapshot) => snapshot.locked)) {
      const locked = lockedSnapshots.filter((snapshot) => snapshot.locked);
      return {
        ...this.payrollCalculation.summarizeLockedAttendanceSnapshots(locked),
        source: 'LOCKED_LEDGER',
        lockedLedgerDays: new Set(locked.map((snapshot) => snapshot.workDate)).size,
        estimated: false,
      };
    }

    const setup = await this.hcmSetupService.getSetup(this.getTenantId(req));
    const events = await this.timeClockEventRepo.findByWorker(workerId);
    const days = new Map<string, typeof events>();

    for (const event of events) {
      if (event.timestamp.getUTCFullYear() !== year || event.timestamp.getUTCMonth() + 1 !== month) continue;
      const day = event.timestamp.toISOString().slice(0, 10);
      days.set(day, [...(days.get(day) ?? []), event]);
    }

    const dayCalculations = [...days.entries()].map(([workDate, dayEvents]) => this.attendanceCalculation.calculateDay({
      workDate,
      sessions: this.toSessions(dayEvents.map((event) => ({
        eventType: event.eventType,
        timestamp: event.timestamp,
        location: event.location,
      }))),
      policy: setup.attendancePolicy,
      timezoneOffsetMinutes: setup.attendancePolicy.timezoneOffsetMinutes,
    }));

    return {
      ...this.attendanceCalculation.summarizeMonth(dayCalculations),
      source: 'RAW_ESTIMATE',
      lockedLedgerDays: 0,
      estimated: true,
    };
  }

  private async buildPayrollEmployees(year: number, month: number, req: Request): Promise<PayrollCycleEmployeeInput[]> {
    const tenantId = this.getTenantId(req);
    const setup = await this.hcmSetupService.getSetup(tenantId);
    const activeWorkers = await this.workerRepo.findByStatusForTenant('ACTIVE', tenantId, { limit: 1000 });
    const workers = activeWorkers.length > 0 ? activeWorkers : await this.workerRepo.searchForTenant('', tenantId, { limit: 1000 });
    const tenantCurrency = resolveTenantCurrency(setup);

    return Promise.all(workers.map(async (worker) => {
      const records = await this.personalDataRepo.findByWorker(worker.id);
      const payloadByCategory = Object.fromEntries(records.map((record) => [record.dataCategory, record.payload ?? {}])) as Record<string, Record<string, unknown>>;
      const compensation = payloadByCategory.COMPENSATION ?? {};
      const contact = payloadByCategory.CONTACT ?? {};
      const basic = payloadByCategory.BASIC ?? {};
      const banking = payloadByCategory.BANKING ?? {};
      const tax = payloadByCategory.TAX ?? {};
      const bankAccountPayload = banking.bankAccount as Record<string, unknown> | undefined;
      const taxProfile = tax.taxProfile as Record<string, unknown> | undefined;
      const workLocation = contact.workLocation as Record<string, unknown> | undefined;
      const locationCode = typeof workLocation?.code === 'string' ? workLocation.code : undefined;
      const location = setup.locations.find((item) => item.code === locationCode);
      const locationCurrency = location?.currency;
      const orgUnit = contact.orgUnit as Record<string, unknown> | undefined;
      const departmentId = worker.departmentId?.value;
      const legalEntityId = worker.legalEntityId?.value;
      const orgUnitId = readString(contact.orgUnitId ?? orgUnit?.id ?? orgUnit?.code);
      const countryCode = readString(workLocation?.countryCode ?? location?.countryCode);
      const grossSalary = Number(compensation.grossSalaryAmount ?? compensation.salaryAmount ?? 0);
      const salaryCurrency = String(compensation.salaryCurrency ?? locationCurrency ?? tenantCurrency);
      const salaryBasis = readString(compensation.salaryBasis)?.toUpperCase();
      const hourlyRate = Number(compensation.hourlyRateAmount ?? compensation.hourlyRate ?? 0);
      const bankAccount: PayrollBankAccount | undefined = bankAccountPayload ? {
        bankName: readString(bankAccountPayload.bankName),
        accountHolderName: readString(bankAccountPayload.accountHolderName),
        accountNumber: readString(bankAccountPayload.accountNumber ?? bankAccountPayload.bankAccountNumber),
        iban: readString(bankAccountPayload.iban),
        routingNumber: readString(bankAccountPayload.routingNumber),
        swiftCode: readString(bankAccountPayload.swiftCode ?? bankAccountPayload.swift),
      } : undefined;

      return {
        workerId: worker.id.value,
        employeeId: worker.employeeNumber,
        name: `${worker.firstName} ${worker.lastName}`.trim(),
        email: String(basic.workEmail ?? basic.personalEmail ?? worker.email.toString()),
        department: String(contact.departmentName ?? ''),
        departmentId,
        legalEntityId,
        orgUnitId,
        countryCode,
        tenantId: tenantId.value,
        workLocationCode: locationCode,
        employmentType: worker.employmentType,
        salaryBasis: salaryBasis === 'HOURLY' ? 'HOURLY' : 'MONTHLY',
        hourlyRate: hourlyRate > 0 ? hourlyRate : undefined,
        grossSalary,
        currency: salaryCurrency,
        bankAccount,
        taxIdentifier: readString(taxProfile?.taxIdentifier ?? tax.taxIdentifier ?? tax.payrollTaxIdentifier),
        insuranceIdentifier: readString(
          taxProfile?.socialInsuranceNumber
            ?? taxProfile?.insuranceIdentifier
            ?? tax.socialInsuranceNumber
            ?? tax.insuranceIdentifier,
        ),
        attendanceSummary: await this.buildAttendanceSummary(worker.id, year, month, req),
      };
    }));
  }

  private async buildMonthlyPreview(req: Request, year: number, month: number, workLocationCode?: string): Promise<PayrollCyclePreview> {
    const setup = await this.hcmSetupService.getSetup(this.getTenantId(req));
    const employees = await this.buildPayrollEmployees(year, month, req);
    const preview = this.payrollCalculation.buildMonthlyCycle({ year, month, employees, setup, workLocationCode });
    const requestActor = requireActor(req, 'Payroll preview');
    const actor = { roles: requestActor.roles, workerId: requestActor.actorId.value };
    return {
      ...preview,
      rows: preview.rows.map((row) => this.payrollCalculation.maskRowForActor(row, actor)),
    };
  }

  private resolvePayrollGlAccountMapping(
    setup: HcmSetupConfig,
    preview: PayrollCyclePreview,
    workLocationCode?: string,
  ): PayrollGlAccountMapping | undefined {
    const locationCodes = new Set([
      workLocationCode,
      ...preview.rows.map((row) => row.workLocationCode),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0));
    const countryCodes = new Set(setup.locations
      .filter((location) => locationCodes.size === 0 || locationCodes.has(location.code))
      .map((location) => location.countryCode)
      .filter((value): value is string => typeof value === 'string' && value.length > 0));
    const activePacks = (setup.statutoryPayrollPacks ?? []).filter((pack) => pack.active);
    const locationPack = activePacks.find((pack) => (pack.locationCodes ?? []).some((code) => locationCodes.has(code)));
    if (locationPack?.glAccountMapping) return locationPack.glAccountMapping;
    const countryPack = activePacks.find((pack) => countryCodes.size === 0 || countryCodes.has(pack.countryCode));
    return countryPack?.glAccountMapping;
  }

  private persistedBankRowsFromPaymentBatch(
    paymentBatch: Awaited<ReturnType<PayrollPaymentBatchRepository['findByPayrollCycle']>>,
  ): PayrollBankTransferRow[] {
    return Array.isArray(paymentBatch?.payload?.rows) ? paymentBatch.payload.rows : [];
  }

  private buildPersistedCycleRows(input: {
    resultLines: Awaited<ReturnType<PayrollResultLineRepository['findByPayrollCycle']>>;
    paymentBatch: Awaited<ReturnType<PayrollPaymentBatchRepository['findByPayrollCycle']>>;
    payslipArtifacts: Awaited<ReturnType<PayrollPayslipArtifactRepository['findByPayrollCycle']>>;
  }): PayrollCycleRow[] {
    const lockedLines = input.resultLines.filter((line) => line.status === 'LOCKED');
    const linesByWorkerId = new Map<string, typeof lockedLines>();
    for (const line of lockedLines) {
      const workerId = line.workerId.value;
      linesByWorkerId.set(workerId, [...(linesByWorkerId.get(workerId) ?? []), line]);
    }

    const bankRowsByWorkerId = new Map(this.persistedBankRowsFromPaymentBatch(input.paymentBatch).map((row) => [row.workerId, row]));
    const artifactsByWorkerId = new Map(input.payslipArtifacts.map((artifact) => [artifact.workerId, artifact]));

    return [...linesByWorkerId.entries()].map(([workerId, lines]) => {
      const bankRow = bankRowsByWorkerId.get(workerId);
      const artifact = artifactsByWorkerId.get(workerId);
      const currency = requirePayrollCurrency(lines[0]?.currency ?? bankRow?.currency ?? artifact?.currency, 'Locked payroll row');
      const grossLines = lines.filter((line) => (
        line.lineType === 'GROSS'
        || line.ruleSetId === 'EARNING'
        || line.lineType === 'OFF_CYCLE_EARNING'
        || line.lineType === 'RETRO_ADJUSTMENT'
      ));
      const taxLines = lines.filter((line) => line.lineType === 'TAX' || line.ruleSetId === 'TAX' || (line.explanation ?? '').toLowerCase().includes('taxable base'));
      const employeeInsuranceLines = lines.filter((line) => line.lineType === 'EMPLOYEE_INSURANCE');
      const employerInsuranceLines = lines.filter((line) => line.lineType === 'EMPLOYER_INSURANCE');
      const netLines = lines.filter((line) => line.lineType === 'NET_PAY');
      const deductionLines = lines.filter((line) => (
        !grossLines.includes(line)
        && !taxLines.includes(line)
        && !employeeInsuranceLines.includes(line)
        && !employerInsuranceLines.includes(line)
        && !netLines.includes(line)
      ));
      const grossSalary = roundMoney(grossLines.reduce((total, line) => total + line.amount, 0));
      const taxAmount = roundMoney(taxLines.reduce((total, line) => total + line.amount, 0));
      const employeeInsuranceAmount = roundMoney(employeeInsuranceLines.reduce((total, line) => total + line.amount, 0));
      const employerInsuranceAmount = roundMoney(employerInsuranceLines.reduce((total, line) => total + line.amount, 0));
      const netSalary = roundMoney(
        netLines.length > 0
          ? netLines.reduce((total, line) => total + line.amount, 0)
          : artifact?.netPay ?? bankRow?.netSalary ?? Math.max(grossSalary - taxAmount - employeeInsuranceAmount, 0),
      );
      const policyDeductionAmount = roundMoney(deductionLines.length > 0
        ? deductionLines.reduce((total, line) => total + line.amount, 0)
        : Math.max(grossSalary - taxAmount - employeeInsuranceAmount - netSalary, 0));

      return {
        workerId,
        employeeId: bankRow?.employeeId ?? artifact?.employeeId ?? workerId,
        name: bankRow?.name ?? artifact?.payslipPayload?.employeeName ?? artifact?.employeeId ?? workerId,
        email: bankRow?.workEmail ?? '',
        baseGrossSalary: grossSalary,
        earningAmount: roundMoney(grossLines.filter((line) => line.lineType !== 'GROSS').reduce((total, line) => total + line.amount, 0)),
        taxableEarningAmount: null,
        nonTaxableEarningAmount: null,
        grossSalary,
        taxAmount,
        employeeInsuranceAmount,
        employerInsuranceAmount,
        policyDeductionAmount,
        netSalary,
        currency,
        explainability: lines
          .filter((line) => line.lineType !== 'NET_PAY')
          .map((line) => ({
            code: line.lineType,
            label: line.description,
            amount: line.amount,
            source: line.ruleSetId === 'EARNING' ? 'EARNING' : line.ruleSetId === 'ATTENDANCE' ? 'ATTENDANCE' : 'POLICY',
            formula: line.explanation ?? line.description,
          })),
      };
    });
  }

  private async buildPersistedCyclePreview(req: Request, payrollCycleId: string): Promise<PayrollCyclePreview> {
    const cycle = await this.payrollCycleRepo.findById(new Uuid(payrollCycleId));
    if (!cycle) throw new BadRequestException('Payroll cycle not found');
    const payrollCycleUuid = new Uuid(payrollCycleId);
    const tenantId = this.getTenantId(req);
    const [allResultLines, paymentBatch, payslipArtifacts, setup] = await Promise.all([
      this.resultLineRepo.findByPayrollCycle(payrollCycleUuid),
      this.paymentBatchRepo.findByPayrollCycle(tenantId, payrollCycleUuid),
      this.payslipArtifactRepo.findByPayrollCycle(tenantId, payrollCycleUuid),
      this.hcmSetupService.getSetup(tenantId),
    ]);
    const resultLines = allResultLines.filter((line) => line.status === 'LOCKED');
    const rows = this.buildPersistedCycleRows({ resultLines, paymentBatch, payslipArtifacts });
    const gross = roundMoney(rows.length > 0 ? rows.reduce((total, row) => total + (row.grossSalary ?? 0), 0) : resultLines
      .filter((line) => line.lineType === 'GROSS' || line.ruleSetId === 'EARNING' || line.lineType === 'OFF_CYCLE_EARNING' || line.lineType === 'RETRO_ADJUSTMENT')
      .reduce((total, line) => total + line.amount, 0));
    const tax = roundMoney(rows.length > 0 ? rows.reduce((total, row) => total + (row.taxAmount ?? 0), 0) : resultLines
      .filter((line) => line.lineType === 'TAX' || (line.explanation ?? '').toLowerCase().includes('taxable base'))
      .reduce((total, line) => total + line.amount, 0));
    const employeeInsurance = roundMoney(rows.length > 0 ? rows.reduce((total, row) => total + (row.employeeInsuranceAmount ?? 0), 0) : resultLines
      .filter((line) => line.lineType === 'EMPLOYEE_INSURANCE')
      .reduce((total, line) => total + line.amount, 0));
    const employerInsurance = roundMoney(rows.length > 0 ? rows.reduce((total, row) => total + (row.employerInsuranceAmount ?? 0), 0) : resultLines
      .filter((line) => line.lineType === 'EMPLOYER_INSURANCE')
      .reduce((total, line) => total + line.amount, 0));
    const net = roundMoney(rows.length > 0 ? rows.reduce((total, row) => total + (row.netSalary ?? 0), 0) : paymentBatch?.totalNet ?? resultLines
      .filter((line) => line.lineType === 'NET_PAY')
      .reduce((total, line) => total + line.amount, 0));
    const deductions = roundMoney(rows.length > 0 ? rows.reduce((total, row) => total + (row.policyDeductionAmount ?? 0), 0) : Math.max(gross - tax - employeeInsurance - net, 0));
    return {
      id: `${cycle.payPeriodStart.getUTCFullYear()}-${String(cycle.payPeriodStart.getUTCMonth() + 1).padStart(2, '0')}`,
      name: cycle.cycleName,
      year: cycle.payPeriodStart.getUTCFullYear(),
      month: cycle.payPeriodStart.getUTCMonth() + 1,
      calendarDays: cycle.payPeriodEnd.getUTCDate(),
      periodStart: cycle.payPeriodStart.toISOString().slice(0, 10),
      periodEnd: cycle.payPeriodEnd.toISOString().slice(0, 10),
      payDate: (cycle.payDate ?? cycle.payPeriodEnd).toISOString().slice(0, 10),
      employeeCount: rows.length > 0 ? rows.length : new Set(resultLines.map((line) => line.workerId.value)).size,
      totalGross: gross,
      totalTax: tax,
      totalEmployeeInsurance: employeeInsurance,
      totalEmployerInsurance: employerInsurance,
      totalPolicyDeductions: deductions,
      totalNet: net,
      currency: resultLines[0]?.currency ?? paymentBatch?.currency ?? resolveTenantCurrency(setup),
      rows,
    };
  }

  private toGlPostingEvidence(posting: Awaited<ReturnType<PayrollGlPostingRepository['findByPayrollCycle']>>): PayrollCloseGlPostingEvidence | undefined {
    if (!posting) return undefined;
    return {
      status: posting.status,
      totalDebits: posting.totalDebits,
      totalCredits: posting.totalCredits,
      lineCount: posting.lines.length,
    };
  }

  private toPaymentBatchEvidence(batch: Awaited<ReturnType<PayrollPaymentBatchRepository['findByPayrollCycle']>>): PayrollClosePaymentBatchEvidence | undefined {
    if (!batch) return undefined;
    return {
      status: batch.status,
      readyCount: batch.readyCount,
      blockedCount: batch.blockedCount,
      totalNet: batch.totalNet,
      exceptionCount: Number(batch.reconciliationSummary?.exceptionCount ?? 0),
    };
  }

  private toPayslipArtifactEvidence(
    artifacts: Awaited<ReturnType<PayrollPayslipArtifactRepository['findByPayrollCycle']>>,
  ): PayrollClosePayslipArtifactEvidence[] {
    return artifacts.map((artifact) => ({
      workerId: artifact.workerId,
      employeeId: artifact.employeeId,
      status: artifact.status,
      contentHash: artifact.contentHash,
      htmlReady: artifact.htmlContent.trim().length > 0,
    }));
  }

  private async buildPersistedCycleCloseReadiness(req: Request, payrollCycleId: string): Promise<PayrollCloseToPayReadiness> {
    const tenantId = this.getTenantId(req);
    const payrollCycleUuid = new Uuid(payrollCycleId);
    const [preview, setup, resultLines, glPosting, paymentBatch, payslipArtifacts] = await Promise.all([
      this.buildPersistedCyclePreview(req, payrollCycleId),
      this.hcmSetupService.getSetup(tenantId),
      this.resultLineRepo.findByPayrollCycle(payrollCycleUuid),
      this.glPostingRepo.findByPayrollCycle(tenantId, payrollCycleUuid),
      this.paymentBatchRepo.findByPayrollCycle(tenantId, payrollCycleUuid),
      this.payslipArtifactRepo.findByPayrollCycle(tenantId, payrollCycleUuid),
    ]);
    const expectedPayslipWorkerIds = [...new Set(resultLines
      .filter((line) => line.status === 'LOCKED')
      .map((line) => line.workerId.value))];

    return this.payrollGovernance.evaluateCloseToPayReadiness({
      preview,
      bankRows: this.persistedBankRowsFromPaymentBatch(paymentBatch),
      existingCycles: [],
      setup,
      closeEvidence: {
        requireEnterpriseEvidence: true,
        glPosting: this.toGlPostingEvidence(glPosting),
        paymentBatch: this.toPaymentBatchEvidence(paymentBatch),
        payslipArtifacts: this.toPayslipArtifactEvidence(payslipArtifacts),
        expectedPayslipWorkerIds,
      },
    });
  }

  private async assertPersistedCycleCanClose(req: Request, payrollCycleId: string): Promise<void> {
    const readiness = await this.buildPersistedCycleCloseReadiness(req, payrollCycleId);
    if (readiness.canClose) return;
    throw new BadRequestException({
      message: 'Payroll cycle has blocking readiness issues',
      readiness,
    });
  }

  private async buildAttendanceLockIssues(preview: PayrollCyclePreview, req: Request): Promise<PayrollReadinessIssue[]> {
    const tenantId = this.getTenantId(req);
    const issues: PayrollReadinessIssue[] = [];
    for (const row of preview.rows) {
      const ledgers = await this.attendanceDailyLedgerRepo.findByWorker(tenantId, new Uuid(row.workerId), {
        dateFrom: preview.periodStart,
        dateTo: preview.periodEnd,
      });
      const readyLocked = ledgers.filter((ledger) => ledger.locked && ledger.readyForPayroll);
      if (readyLocked.length === 0) {
        issues.push({
          code: 'ATTENDANCE_LEDGER_NOT_LOCKED',
          condition: 'ATTENDANCE_BLOCKER',
          severity: 'ERROR',
          blocking: true,
          employeeId: row.employeeId,
          workerId: row.workerId,
          message: `Employee ${row.employeeId} has no locked attendance ledger for ${preview.periodStart} to ${preview.periodEnd}.`,
        });
        continue;
      }
      const unreadyCount = ledgers.filter((ledger) => !ledger.locked || !ledger.readyForPayroll).length;
      if (unreadyCount > 0) {
        issues.push({
          code: 'ATTENDANCE_LEDGER_PARTIALLY_UNLOCKED',
          condition: 'ATTENDANCE_BLOCKER',
          severity: 'ERROR',
          blocking: true,
          employeeId: row.employeeId,
          workerId: row.workerId,
          message: `Employee ${row.employeeId} has ${unreadyCount} attendance ledger rows not locked for payroll.`,
        });
      }
    }
    return issues;
  }

  private async buildMonthlyPreviewReadiness(
    preview: PayrollCyclePreview,
    req: Request,
    workLocationCode?: string,
  ): Promise<PayrollCloseToPayReadiness> {
    const setup = await this.hcmSetupService.getSetup(this.getTenantId(req));
    return this.mergeReadiness(this.payrollGovernance.evaluateCloseToPayReadiness({
      preview,
      bankRows: this.payrollCalculation.buildBankTransferRows(preview.rows),
      existingCycles: await this.findExistingCycleSummaries(req),
      workLocationCode,
      setup,
    }), await this.buildAttendanceLockIssues(preview, req));
  }

  private mergeReadiness(readiness: PayrollCloseToPayReadiness, additionalIssues: PayrollReadinessIssue[]): PayrollCloseToPayReadiness {
    const issues = [...readiness.issues, ...additionalIssues];
    const blockingIssueCount = issues.filter((issue) => issue.blocking).length;
    return {
      canClose: blockingIssueCount === 0,
      blockingIssueCount,
      warningIssueCount: issues.filter((issue) => !issue.blocking).length,
      issues,
    };
  }

  private assertCanExportPayroll(req: Request): void {
    if (!this.hasPayrollVisibility(req)) {
      throw new ForbiddenException('Only HR or Payroll administrators can export tenant payroll data');
    }
  }

  @Get('monthly-cycle-preview')
  async monthlyCyclePreview(
    @Query('year') year: string | undefined,
    @Query('month') month: string | undefined,
    @Query('workLocationCode') workLocationCode: string | undefined,
    @Req() req: Request,
  ) {
    this.assertCanExportPayroll(req);
    const now = new Date();
    const preview = await this.buildMonthlyPreview(
      req,
      year ? Number(year) : now.getUTCFullYear(),
      month ? Number(month) : now.getUTCMonth() + 1,
      workLocationCode,
    );
    return {
      ...preview,
      readiness: await this.buildMonthlyPreviewReadiness(preview, req, workLocationCode),
    };
  }

  @Get('export.csv')
  async exportMonthlyPayrollCsv(
    @Query('year') year: string | undefined,
    @Query('month') month: string | undefined,
    @Query('workLocationCode') workLocationCode: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.assertCanExportPayroll(req);
    const now = new Date();
    const preview = await this.buildMonthlyPreview(
      req,
      year ? Number(year) : now.getUTCFullYear(),
      month ? Number(month) : now.getUTCMonth() + 1,
      workLocationCode,
    );
    const rows = preview.rows.map((row) => ({
      employeeId: row.employeeId,
      name: row.name,
      workEmail: row.email,
      department: row.department,
      workLocationCode: row.workLocationCode,
      taxIdentifier: row.taxIdentifier,
      insuranceIdentifier: row.insuranceIdentifier,
      baseGrossSalary: row.baseGrossSalary,
      earningAmount: row.earningAmount,
      taxableEarningAmount: row.taxableEarningAmount,
      nonTaxableEarningAmount: row.nonTaxableEarningAmount,
      grossSalary: row.grossSalary,
      taxAmount: row.taxAmount,
      employeeInsuranceAmount: row.employeeInsuranceAmount,
      policyDeductionAmount: row.policyDeductionAmount,
      netSalary: row.netSalary,
      currency: row.currency,
    }));
    const csv = toCsv(rows);
    const fileName = `payroll-${preview.id}.csv`;
    const exportJob = this.payrollArtifact.buildExportJobRecord({
      tenantId: this.getTenantId(req).value,
      requestedBy: this.getActorUuidString(req),
      exportType: 'PAYROLL_SUMMARY_CSV',
      fileName,
      content: csv,
      rowCount: rows.length,
      filters: { year: preview.year, month: preview.month, workLocationCode },
      purpose: 'Payroll summary export',
    });
    await this.executeOrThrow(this.buildCommand('SavePayrollExportJob', 'PayrollExportJob', { record: exportJob }, req, {
      aggregateId: new Uuid(exportJob.id),
    }));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Data-Classification', 'HIGH_SENSITIVITY');
    res.setHeader('X-Visibility-Scope', 'PAYROLL_ADMIN_ONLY');
    res.send(csv);
  }

  @Get('bank-sheet.csv')
  async exportBankSheetCsv(
    @Query('year') year: string | undefined,
    @Query('month') month: string | undefined,
    @Query('workLocationCode') workLocationCode: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.assertCanExportPayroll(req);
    const now = new Date();
    const preview = await this.buildMonthlyPreview(
      req,
      year ? Number(year) : now.getUTCFullYear(),
      month ? Number(month) : now.getUTCMonth() + 1,
      workLocationCode,
    );
    const rows = this.payrollCalculation.buildBankTransferRows(preview.rows).map((row) => ({
      employeeId: row.employeeId,
      name: row.name,
      workEmail: row.workEmail,
      bankName: row.bankName,
      accountHolderName: row.accountHolderName,
      accountNumber: row.accountNumber,
      iban: row.iban,
      routingNumber: row.routingNumber,
      swiftCode: row.swiftCode,
      netSalary: row.netSalary,
      currency: row.currency,
      bankReady: row.bankReady ? 'YES' : 'NO',
      readinessReason: row.readinessReason,
    }));
    const csv = toCsv(rows);
    const fileName = `bank-sheet-${preview.id}.csv`;
    const exportJob = this.payrollArtifact.buildExportJobRecord({
      tenantId: this.getTenantId(req).value,
      requestedBy: this.getActorUuidString(req),
      exportType: 'BANK_SHEET_CSV',
      fileName,
      content: csv,
      rowCount: rows.length,
      filters: { year: preview.year, month: preview.month, workLocationCode },
      purpose: 'Bank transfer sheet export',
    });
    await this.executeOrThrow(this.buildCommand('SavePayrollExportJob', 'PayrollExportJob', { record: exportJob }, req, {
      aggregateId: new Uuid(exportJob.id),
    }));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Data-Classification', 'HIGH_SENSITIVITY');
    res.setHeader('X-Visibility-Scope', 'PAYROLL_ADMIN_ONLY');
    res.send(csv);
  }

  @Get('payment-batch-preview')
  async paymentBatchPreview(
    @Query('year') year: string | undefined,
    @Query('month') month: string | undefined,
    @Query('workLocationCode') workLocationCode: string | undefined,
    @Req() req: Request,
  ) {
    this.assertCanExportPayroll(req);
    const now = new Date();
    const preview = await this.buildMonthlyPreview(
      req,
      year ? Number(year) : now.getUTCFullYear(),
      month ? Number(month) : now.getUTCMonth() + 1,
      workLocationCode,
    );
    return this.payrollInputOrchestration.buildPaymentBatch(
      preview,
      this.payrollCalculation.buildBankTransferRows(preview.rows),
    );
  }

  @Get('monthly-cycle-gl-preview')
  async monthlyCycleGlPreview(
    @Query('year') year: string | undefined,
    @Query('month') month: string | undefined,
    @Query('workLocationCode') workLocationCode: string | undefined,
    @Req() req: Request,
  ) {
    this.assertCanExportPayroll(req);
    const now = new Date();
    const preview = await this.buildMonthlyPreview(
      req,
      year ? Number(year) : now.getUTCFullYear(),
      month ? Number(month) : now.getUTCMonth() + 1,
      workLocationCode,
    );
    const setup = await this.hcmSetupService.getSetup(this.getTenantId(req));
    return {
      ...this.payrollGlPosting.buildPosting({
        tenantId: this.getTenantId(req).value,
        payrollCycleId: preview.id,
        preview,
        createdBy: this.getActorUuidString(req),
        accountMapping: this.resolvePayrollGlAccountMapping(setup, preview, workLocationCode),
      }),
      events: ['PayrollGlPreviewBuilt'],
    };
  }

  @Get('export-jobs')
  async getPayrollExportJobs(@Query('limit') limit: string | undefined, @Req() req: Request) {
    this.assertCanExportPayroll(req);
    return this.exportJobRepo.findByTenant(this.getTenantId(req), limit ? Number(limit) : 20);
  }

  private async findExistingCycleSummaries(req: Request): Promise<ExistingPayrollCycleSummary[]> {
    const cycles = await this.payrollCycleRepo.findByTenant(this.getTenantId(req));
    return cycles.map((cycle) => ({
      payrollCycleId: cycle.id.value,
      periodStart: cycle.payPeriodStart.toISOString().slice(0, 10),
      periodEnd: cycle.payPeriodEnd.toISOString().slice(0, 10),
      status: cycle.status,
    }));
  }

  @Post('monthly-cycle/close-to-pay')
  async closeMonthlyCycleToPay(
    @Body() body: {
      year?: number;
      month?: number;
      workLocationCode?: string;
      closeCycle?: boolean;
      massUpdateRows?: PayrollCsvRow[];
    },
    @Req() req: Request,
  ) {
    this.assertCanExportPayroll(req);
    const now = new Date();
    const year = Number(body.year ?? now.getUTCFullYear());
    const month = Number(body.month ?? now.getUTCMonth() + 1);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('A valid year and month are required');
    }
    const massUpdateRows = body.massUpdateRows ?? [];
    const massUpdateErrors = this.validateMassUpdateRows(massUpdateRows);
    if (massUpdateErrors.length > 0) {
      throw new BadRequestException({
        message: 'Payroll mass update has validation errors',
        errors: massUpdateErrors,
      });
    }

    const preview = await this.buildMonthlyPreview(req, year, month, body.workLocationCode);
    if (preview.employeeCount === 0) throw new BadRequestException('No employees are available for this payroll cycle');
    const setup = await this.hcmSetupService.getSetup(this.getTenantId(req));
    const tenantCurrency = resolveTenantCurrency(setup);
    const projectedReadinessPreview = this.payrollApprovedInputProjection.applyApprovedInputs(
      preview,
      await this.buildMassUpdateProjectionInputs(massUpdateRows, tenantCurrency, this.getTenantId(req)),
    );
    const readinessBankRows = this.payrollCalculation.buildBankTransferRows(projectedReadinessPreview.rows);
    const readiness = this.mergeReadiness(this.payrollGovernance.evaluateCloseToPayReadiness({
      preview: projectedReadinessPreview,
      bankRows: readinessBankRows,
      existingCycles: await this.findExistingCycleSummaries(req),
      workLocationCode: body.workLocationCode,
      setup,
    }), await this.buildAttendanceLockIssues(projectedReadinessPreview, req));
    if (!readiness.canClose) {
      throw new BadRequestException({
        message: 'Payroll cycle has blocking readiness issues',
        readiness,
      });
    }

    const cycleResult = await this.executeOrThrow(this.buildCommand('CreatePayrollCycle', 'PayrollCycle', {
      cycleName: preview.name,
      payPeriodStart: new Date(`${preview.periodStart}T00:00:00.000Z`),
      payPeriodEnd: new Date(`${preview.periodEnd}T00:00:00.000Z`),
      payDate: new Date(`${preview.payDate}T00:00:00.000Z`),
    }, req));
    const payrollCycleId = this.readResultId(cycleResult, 'payrollCycleId');

    await this.advancePayrollCycle('OpenPayrollCycle', payrollCycleId, req);
    await this.advancePayrollCycle('StartPayrollInputCollection', payrollCycleId, req);

    let payrollInputCount = 0;
    for (const row of preview.rows) {
      for (const draft of this.payrollInputOrchestration.buildInputDrafts(row, { payrollCycleId })) {
        await this.approvePayrollInputThroughWorkflow(draft, req);
        payrollInputCount += 1;
      }
    }
    const massUpdateResult = await this.applyMassUpdateRowsToInputCollection(payrollCycleId, massUpdateRows, req);
    payrollInputCount += massUpdateResult.inputCount;
    const approvedInputs = await this.payrollInputRepo.findByPayrollCycle(new Uuid(payrollCycleId));
    const calculationPreview = this.payrollApprovedInputProjection.applyApprovedInputs(
      preview,
      this.toApprovedInputRecords(approvedInputs),
    );
    const calculationBankRows = this.payrollCalculation.buildBankTransferRows(calculationPreview.rows);

    await this.advancePayrollCycle('StartPayrollValidation', payrollCycleId, req);
    await this.advancePayrollCycle('StartPayrollCalculation', payrollCycleId, req);

    const runResult = await this.executeOrThrow(this.buildCommand('StartPayrollCalculationRun', 'PayrollCalculationRun', {
      payrollCycleId: new Uuid(payrollCycleId),
      currency: calculationPreview.currency,
      totalWorkers: calculationPreview.employeeCount,
      totalGrossPay: calculationPreview.totalGross,
      totalNetPay: calculationPreview.totalNet,
    }, req));
    const payrollCalculationRunId = this.readResultId(runResult, 'payrollCalculationRunId');

    let resultLineCount = 0;
    for (const row of calculationPreview.rows) {
      for (const draft of this.payrollCalculation.buildResultLineDrafts(row, { payrollCycleId, calculationRunId: payrollCalculationRunId })) {
        const lineResult = await this.executeOrThrow(this.buildCommand('CalculatePayrollResultLine', 'PayrollResultLine', {
          workerId: new Uuid(draft.workerId),
          payrollCycleId: new Uuid(draft.payrollCycleId),
          calculationRunId: new Uuid(draft.calculationRunId),
          lineType: draft.lineType,
          description: draft.description,
          amount: draft.amount,
          currency: draft.currency,
          ruleSetId: draft.ruleSetId,
          ruleId: draft.ruleId,
          calculationStep: draft.calculationStep,
          inputSnapshotHash: draft.inputSnapshotHash,
        }, req, {
          subjectWorkerId: new Uuid(draft.workerId),
        }));
        const payrollResultLineId = this.readResultId(lineResult, 'payrollResultLineId');
        await this.lockResultLineThroughWorkflow(payrollResultLineId, draft.explanation, req);
        resultLineCount += 1;
      }
    }

    await this.advanceCalculationRun('ValidatePayrollCalculationRun', payrollCalculationRunId, req);
    await this.advanceCalculationRun('FinalizePayrollCalculationRun', payrollCalculationRunId, req);
    await this.advancePayrollCycle('StartPayrollReview', payrollCycleId, req);

    const lockedResultLines = (await this.resultLineRepo.findByPayrollCycle(new Uuid(payrollCycleId)))
      .filter((line) => line.status === 'LOCKED')
      .map((line) => ({
        id: line.id.value,
        workerId: line.workerId.value,
        lineType: line.lineType,
        description: line.description,
        amount: line.amount,
        currency: line.currency,
        ruleSetId: line.ruleSetId,
        explanation: line.explanation,
        status: line.status,
      }));
    const employees = await this.buildPayrollEmployees(year, month, req);
    const payslips = this.payrollCalculation.buildPayslipsFromResultLines({
      payrollCycle: {
        id: payrollCycleId,
        periodStart: calculationPreview.periodStart,
        periodEnd: calculationPreview.periodEnd,
        payDate: calculationPreview.payDate,
      },
      employees,
      resultLines: lockedResultLines,
    });
    const payslipArtifacts = payslips.map((payslip) => this.payrollArtifact.buildPayslipArtifactRecord({
      tenantId: this.getTenantId(req).value,
      payrollCycleId,
      payslip,
      htmlContent: this.payrollInputOrchestration.renderPayslipHtml(payslip),
    }));
    await this.executeOrThrow(this.buildCommand('GeneratePayrollPayslipArtifacts', 'PayrollPayslipArtifact', {
      payrollCycleId,
      records: payslipArtifacts,
    }, req, { aggregateId: new Uuid(payrollCycleId) }));

    const persistedPaymentBatch = {
      ...this.payrollInputOrchestration.buildPaymentBatch(calculationPreview, calculationBankRows),
      payrollCycleId,
    };
    const paymentBatchRecord = this.payrollArtifact.buildPaymentBatchRecord({
      tenantId: this.getTenantId(req).value,
      payrollCycleId,
      batch: persistedPaymentBatch,
      createdBy: this.getActorUuidString(req),
    });
    await this.executeOrThrow(this.buildCommand('CreatePayrollPaymentBatch', 'PayrollPaymentBatch', {
      record: paymentBatchRecord,
    }, req, { aggregateId: this.safeUuid(paymentBatchRecord.id, new Uuid(payrollCycleId)) }));

    const glPosting = this.payrollGlPosting.buildPosting({
      tenantId: this.getTenantId(req).value,
      payrollCycleId,
      preview: calculationPreview,
      createdBy: this.getActorUuidString(req),
      accountMapping: this.resolvePayrollGlAccountMapping(setup, calculationPreview, body.workLocationCode),
    });
    await this.executeOrThrow(this.buildCommand('CreatePayrollGlPosting', 'PayrollGlPosting', {
      record: glPosting,
    }, req, { aggregateId: this.safeUuid(glPosting.id, new Uuid(payrollCycleId)) }));

    let finalCycleStatus = 'REVIEW';
    let finalReadiness = readiness;
    if (body.closeCycle ?? true) {
      finalReadiness = await this.buildPersistedCycleCloseReadiness(req, payrollCycleId);
      if (!finalReadiness.canClose) {
        throw new BadRequestException({
          message: 'Payroll cycle has blocking readiness issues',
          readiness: finalReadiness,
        });
      }
      await this.advancePayrollCycle('ApprovePayrollCycle', payrollCycleId, req);
      const closeResult = await this.advancePayrollCycle('ClosePayrollCycle', payrollCycleId, req);
      finalCycleStatus = String(closeResult.newState ?? 'CLOSED');
    }

    return {
      payrollCycleId,
      payrollCalculationRunId,
      paymentBatchId: paymentBatchRecord.id,
      glPostingId: glPosting.id,
      status: finalCycleStatus,
      employeeCount: calculationPreview.employeeCount,
      payrollInputCount,
      massUpdateInputCount: massUpdateResult.inputCount,
      resultLineCount,
      payslipArtifactCount: payslipArtifacts.length,
      periodStart: calculationPreview.periodStart,
      periodEnd: calculationPreview.periodEnd,
      totalGross: calculationPreview.totalGross,
      totalNet: calculationPreview.totalNet,
      currency: calculationPreview.currency,
      bankReadyCount: calculationBankRows.filter((row) => row.bankReady).length,
      bankMissingCount: calculationBankRows.filter((row) => !row.bankReady).length,
      readiness: finalReadiness,
      events: ['PayrollCycleClosedToPay', 'PayrollInputsApproved', 'PayrollResultLinesLocked', 'PaymentBatchPersisted', 'PayslipArtifactsGenerated', 'PayrollGlPostingBuilt', 'PayrollCloseReadinessEvaluated'],
    };
  }

  @Get('mass-update-template.csv')
  async massUpdateTemplate(@Req() req: Request, @Res() res: Response) {
    this.assertCanExportPayroll(req);
    const tenantCurrency = await this.resolvePayrollCurrencyForRequest(req);
    const csv = toCsv([{
      employeeId: 'EMP-001',
      workEmail: 'employee@example.com',
      grossSalary: 10000,
      currency: tenantCurrency,
      taxOverride: '',
      insuranceOverride: '',
      deductionCode: 'LATE_PER_MINUTE',
      deductionAmount: '',
      effectiveMonth: '2026-05',
    }]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payroll-mass-update-template.csv"');
    res.setHeader('X-Data-Classification', 'CONFIDENTIAL');
    res.setHeader('X-Visibility-Scope', 'PAYROLL_ADMIN_ONLY');
    res.send(csv);
  }

  @Post('mass-update-preview')
  async massUpdatePreview(@Body() body: { rows?: PayrollCsvRow[] }, @Req() req: Request) {
    this.assertCanExportPayroll(req);
    const rows = body.rows ?? [];
    const errors = this.validateMassUpdateRows(rows);

    return {
      accepted: errors.length === 0,
      rowCount: rows.length,
      errors,
      events: errors.length === 0 ? ['PayrollMassUpdateValidated'] : ['PayrollMassUpdateRejected'],
    };
  }

  @Post('mass-update-apply')
  async massUpdateApply(@Body() body: { payrollCycleId?: string; rows?: PayrollCsvRow[] }, @Req() req: Request) {
    this.assertCanExportPayroll(req);
    const rows = body.rows ?? [];
    const errors = this.validateMassUpdateRows(rows);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Payroll mass update has validation errors',
        errors,
      });
    }
    if (!body.payrollCycleId) throw new BadRequestException('payrollCycleId is required to apply a payroll mass update');
    const cycle = await this.payrollCycleRepo.findById(new Uuid(body.payrollCycleId));
    if (!cycle) throw new BadRequestException('Payroll cycle not found');
    if (cycle.status !== 'INPUT_COLLECTION') {
      throw new BadRequestException(`Cannot apply mass update while payroll cycle is ${cycle.status}`);
    }

    const result = await this.applyMassUpdateRowsToInputCollection(body.payrollCycleId, rows, req);

    return {
      applied: true,
      payrollCycleId: body.payrollCycleId,
      rowCount: rows.length,
      inputCount: result.inputCount,
      appliedRows: result.appliedRows,
      events: ['PayrollMassUpdateApplied', 'PayrollInputsApproved'],
    };
  }

  @Post('off-cycle-preview')
  async offCyclePreview(
    @Body() body: { year?: number; month?: number; workLocationCode?: string; rows?: PayrollOffCycleRow[] },
    @Req() req: Request,
  ) {
    this.assertCanExportPayroll(req);
    const now = new Date();
    const rows = body.rows ?? [];
    const errors = this.validateOffCycleRows(rows);
    if (errors.length > 0) {
      return {
        accepted: false,
        rowCount: rows.length,
        errors,
      };
    }
    const preview = await this.buildMonthlyPreview(
      req,
      Number(body.year ?? now.getUTCFullYear()),
      Number(body.month ?? now.getUTCMonth() + 1),
      body.workLocationCode,
    );
    return {
      accepted: true,
      rowCount: rows.length,
      preview: this.payrollApprovedInputProjection.applyApprovedInputs(
        preview,
        await this.buildOffCycleProjectionInputs(rows, await this.resolvePayrollCurrencyForRequest(req), this.getTenantId(req)),
      ),
      events: ['PayrollOffCyclePreviewBuilt'],
    };
  }

  @Post('cycles/:id/off-cycle-inputs')
  async applyOffCycleInputs(
    @Param('id') id: string,
    @Body() body: { rows?: PayrollOffCycleRow[] },
    @Req() req: Request,
  ) {
    this.assertCanExportPayroll(req);
    const cycle = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!cycle) throw new BadRequestException('Payroll cycle not found');
    if (cycle.status !== 'INPUT_COLLECTION') {
      throw new BadRequestException(`Off-cycle inputs can only be applied while payroll cycle is INPUT_COLLECTION, current status is ${cycle.status}`);
    }
    const rows = body.rows ?? [];
    const errors = this.validateOffCycleRows(rows);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Off-cycle payroll rows have validation errors',
        errors,
      });
    }
    const applied: Array<{ employeeId: string; workerId: string; inputType: string }> = [];
    const tenantCurrency = await this.resolvePayrollCurrencyForRequest(req);
    for (const row of rows) {
      if (!row.employeeId || !row.inputType || row.amount === undefined) continue;
      const worker = await this.findWorkerByEmployeeId(row.employeeId, this.getTenantId(req));
      if (!worker) throw new BadRequestException(`Employee ${row.employeeId} was not found`);
      await this.approvePayrollInputThroughWorkflow({
        workerId: worker.id.value,
        payrollCycleId: id,
        inputType: row.inputType,
        amount: Number(row.amount),
        currency: row.currency ?? tenantCurrency,
        description: row.description ?? `${row.employeeId} ${row.inputType.toLowerCase().replace(/_/g, ' ')}`,
      }, req);
      applied.push({ employeeId: row.employeeId, workerId: worker.id.value, inputType: row.inputType });
    }
    return {
      applied: true,
      payrollCycleId: id,
      inputCount: applied.length,
      appliedRows: applied,
      events: ['PayrollOffCycleInputsApplied', 'PayrollInputsApproved'],
    };
  }

  @Post('payment-batches/:id/approve')
  async approvePaymentBatch(@Param('id') id: string, @Req() req: Request) {
    this.assertCanExportPayroll(req);
    const result = await this.executeOrThrow(this.buildCommand('ApprovePayrollPaymentBatch', 'PayrollPaymentBatch', {
      paymentBatchId: id,
    }, req, { aggregateId: new Uuid(id) }));
    return result.data;
  }

  @Post('payment-batches/:id/export')
  async exportPaymentBatch(
    @Param('id') id: string,
    @Body() body: { format?: PayrollBankFileFormat },
    @Req() req: Request,
  ) {
    this.assertCanExportPayroll(req);
    const result = await this.executeOrThrow(this.buildCommand('ExportPayrollPaymentBatch', 'PayrollPaymentBatch', {
      paymentBatchId: id,
      format: body.format,
    }, req, { aggregateId: new Uuid(id) }));
    return result.data;
  }

  @Post('payment-batches/:id/reconcile')
  async reconcilePaymentBatch(
    @Param('id') id: string,
    @Body() body: { rows?: PayrollReconciliationRow[] },
    @Req() req: Request,
  ) {
    this.assertCanExportPayroll(req);
    const result = await this.executeOrThrow(this.buildCommand('ReconcilePayrollPaymentBatch', 'PayrollPaymentBatch', {
      paymentBatchId: id,
      rows: body.rows ?? [],
    }, req, { aggregateId: new Uuid(id) }));
    return result.data;
  }

  @Post('cycles/:id/payslips/publish')
  async publishPayrollCyclePayslips(@Param('id') id: string, @Req() req: Request) {
    this.assertCanExportPayroll(req);
    const result = await this.executeOrThrow(this.buildCommand('PublishPayrollCyclePayslips', 'PayrollPayslipArtifact', {
      payrollCycleId: id,
    }, req, { aggregateId: new Uuid(id) }));
    return result.data;
  }

  @Post('cycles/:id/gl-posting')
  async createPayrollGlPosting(@Param('id') id: string, @Req() req: Request) {
    this.assertCanExportPayroll(req);
    const preview = await this.buildPersistedCyclePreview(req, id);
    const setup = await this.hcmSetupService.getSetup(this.getTenantId(req));
    const posting = this.payrollGlPosting.buildPosting({
      tenantId: this.getTenantId(req).value,
      payrollCycleId: id,
      preview,
      createdBy: this.getActorUuidString(req),
      accountMapping: this.resolvePayrollGlAccountMapping(setup, preview),
    });
    const result = await this.executeOrThrow(this.buildCommand('CreatePayrollGlPosting', 'PayrollGlPosting', {
      record: posting,
    }, req, { aggregateId: this.safeUuid(posting.id, new Uuid(id)) }));
    return result.data;
  }

  @Get('cycles/:id/gl-posting')
  async getPayrollGlPosting(@Param('id') id: string, @Req() req: Request) {
    this.assertCanExportPayroll(req);
    const posting = await this.glPostingRepo.findByPayrollCycle(this.getTenantId(req), new Uuid(id));
    if (!posting) throw new BadRequestException('No GL posting found for this payroll cycle');
    return posting;
  }

  /* Payroll Cycles */
  @Post('cycles')
  async createPayrollCycle(@Body(new ZodValidationPipe(CreatePayrollCycleDtoSchema)) dto: dtos.CreatePayrollCycleDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreatePayrollCycle', 'PayrollCycle', dto, req));
  }

  @Post('cycles/:id/commands/open')
  async openPayrollCycle(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('OpenPayrollCycle', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/start-input-collection')
  async startInputCollection(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('StartPayrollInputCollection', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/start-validation')
  async startValidation(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('StartPayrollValidation', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/start-calculation')
  async startCalculation(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('StartPayrollCalculation', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/start-review')
  async startReview(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('StartPayrollReview', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/approve')
  async approvePayrollCycle(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('ApprovePayrollCycle', 'PayrollCycle', { payrollCycleId: new Uuid(id), approvedBy: Uuid.generate() }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/close')
  async closePayrollCycle(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    await this.assertPersistedCycleCanClose(req, id);
    return this.commandBus.execute(this.buildCommand('ClosePayrollCycle', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/export')
  async exportPayrollCycle(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('ExportPayrollCycle', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Post('cycles/:id/commands/cancel')
  async cancelPayrollCycle(@Param('id') id: string, @Req() req: Request) {
    const pc = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!pc) throw new BadRequestException('Payroll cycle not found');
    return this.commandBus.execute(this.buildCommand('CancelPayrollCycle', 'PayrollCycle', { payrollCycleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pc.status, expectedVersion: pc.aggregateVersion }));
  }

  @Get('cycles/:id')
  async getPayrollCycle(@Param('id') id: string, @Req() req: Request) {
    this.assertCanExportPayroll(req);
    return this.payrollCycleRepo.findById(new Uuid(id));
  }

  @Get('cycles/:id/payment-batch')
  async getPayrollCyclePaymentBatch(@Param('id') id: string, @Req() req: Request) {
    this.assertCanExportPayroll(req);
    const batch = await this.paymentBatchRepo.findByPayrollCycle(this.getTenantId(req), new Uuid(id));
    if (!batch) throw new BadRequestException('No persisted payment batch found for this payroll cycle');
    return batch;
  }

  @Get('cycles/:id/export-jobs')
  async getPayrollCycleExportJobs(@Param('id') id: string, @Req() req: Request) {
    this.assertCanExportPayroll(req);
    return this.exportJobRepo.findByPayrollCycle(this.getTenantId(req), new Uuid(id));
  }

  @Get('cycles/:id/payslips')
  async getPayrollCyclePayslips(@Param('id') id: string, @Req() req: Request) {
    this.assertCanExportPayroll(req);
    const artifacts = await this.payslipArtifactRepo.findByPayrollCycle(this.getTenantId(req), new Uuid(id));
    if (artifacts.length > 0) {
      return artifacts.map((artifact) => ({
        id: artifact.id,
        workerId: artifact.workerId,
        employeeId: artifact.employeeId,
        grossPay: artifact.grossPay,
        netPay: artifact.netPay,
        currency: artifact.currency,
        status: artifact.status,
        contentHash: artifact.contentHash,
        dataClassification: artifact.dataClassification,
        generatedAt: artifact.createdAt,
      }));
    }
    const cycle = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!cycle) throw new BadRequestException('Payroll cycle not found');
    const resultLines = (await this.resultLineRepo.findByPayrollCycle(new Uuid(id)))
      .filter((line) => line.status === 'LOCKED')
      .map((line) => ({
        id: line.id.value,
        workerId: line.workerId.value,
        lineType: line.lineType,
        description: line.description,
        amount: line.amount,
        currency: line.currency,
        ruleSetId: line.ruleSetId,
        explanation: line.explanation,
        status: line.status,
      }));
    const employees = await this.buildPayrollEmployees(
      cycle.payPeriodStart.getUTCFullYear(),
      cycle.payPeriodStart.getUTCMonth() + 1,
      req,
    );
    return this.payrollCalculation.buildPayslipsFromResultLines({
      payrollCycle: {
        id: cycle.id.value,
        periodStart: cycle.payPeriodStart.toISOString().slice(0, 10),
        periodEnd: cycle.payPeriodEnd.toISOString().slice(0, 10),
        payDate: (cycle.payDate ?? cycle.payPeriodEnd).toISOString().slice(0, 10),
      },
      employees,
      resultLines,
    });
  }

  @Get('cycles/:id/payslips/:workerId.html')
  async getPayrollCyclePayslipHtml(
    @Param('id') id: string,
    @Param('workerId') workerId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.assertCanExportPayroll(req);
    const artifact = await this.payslipArtifactRepo.findByCycleAndWorker(this.getTenantId(req), new Uuid(id), new Uuid(workerId));
    if (artifact) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="payslip-${artifact.employeeId}.html"`);
      res.setHeader('X-Data-Classification', artifact.dataClassification);
      res.setHeader('X-Visibility-Scope', 'PAYROLL_ADMIN_ONLY');
      res.setHeader('X-Content-Hash', artifact.contentHash);
      res.send(artifact.htmlContent);
      return;
    }
    const cycle = await this.payrollCycleRepo.findById(new Uuid(id));
    if (!cycle) throw new BadRequestException('Payroll cycle not found');
    const resultLines = (await this.resultLineRepo.findByPayrollCycle(new Uuid(id)))
      .filter((line) => line.status === 'LOCKED' && line.workerId.value === workerId)
      .map((line) => ({
        id: line.id.value,
        workerId: line.workerId.value,
        lineType: line.lineType,
        description: line.description,
        amount: line.amount,
        currency: line.currency,
        ruleSetId: line.ruleSetId,
        explanation: line.explanation,
        status: line.status,
      }));
    if (resultLines.length === 0) throw new BadRequestException('No locked payslip result lines found for this employee');
    const employees = await this.buildPayrollEmployees(
      cycle.payPeriodStart.getUTCFullYear(),
      cycle.payPeriodStart.getUTCMonth() + 1,
      req,
    );
    const payslip = this.payrollCalculation.buildPayslipsFromResultLines({
      payrollCycle: {
        id: cycle.id.value,
        periodStart: cycle.payPeriodStart.toISOString().slice(0, 10),
        periodEnd: cycle.payPeriodEnd.toISOString().slice(0, 10),
        payDate: (cycle.payDate ?? cycle.payPeriodEnd).toISOString().slice(0, 10),
      },
      employees,
      resultLines,
    })[0];
    if (!payslip) throw new BadRequestException('Payslip could not be generated');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="payslip-${payslip.employeeId}-${cycle.payPeriodStart.toISOString().slice(0, 7)}.html"`);
    res.setHeader('X-Data-Classification', 'HIGH_SENSITIVITY');
    res.setHeader('X-Visibility-Scope', 'PAYROLL_ADMIN_ONLY');
    res.send(this.payrollInputOrchestration.renderPayslipHtml(payslip));
  }

  @Get('cycles/:id/payslips/:workerId.pdf')
  async getPayrollCyclePayslipPdf(
    @Param('id') id: string,
    @Param('workerId') workerId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.assertCanExportPayroll(req);
    const artifact = await this.payslipArtifactRepo.findByCycleAndWorker(this.getTenantId(req), new Uuid(id), new Uuid(workerId));
    if (!artifact) throw new BadRequestException('Payslip artifact not found for this employee and cycle');
    const payslip = artifact.payslipPayload;

    const moneyRows: Array<Array<string | number>> = (payslip?.lines ?? []).map((line) => [
      line.lineType, line.description, line.amount, line.currency,
    ]);
    moneyRows.push(['SUMMARY', 'Gross pay', artifact.grossPay, artifact.currency]);
    if (payslip) {
      moneyRows.push(['SUMMARY', 'Taxes', payslip.taxes, artifact.currency]);
      moneyRows.push(['SUMMARY', 'Deductions', payslip.deductions, artifact.currency]);
    }
    moneyRows.push(['SUMMARY', 'Net pay', artifact.netPay, artifact.currency]);

    const buffer = await this.documentExport.toPdf({
      title: `Payslip — ${payslip?.employeeName ?? artifact.employeeId} (${artifact.employeeId})`,
      columns: ['Type', 'Description', 'Amount', 'Currency'],
      rows: moneyRows,
      generatedAt: new Date().toISOString(),
    });
    res.setHeader('Content-Type', EXPORT_CONTENT_TYPES.pdf);
    res.setHeader('Content-Disposition', `attachment; filename="payslip-${artifact.employeeId}.pdf"`);
    res.setHeader('X-Data-Classification', artifact.dataClassification);
    res.setHeader('X-Visibility-Scope', 'PAYROLL_ADMIN_ONLY');
    res.setHeader('X-Content-Hash', artifact.contentHash);
    return res.send(buffer);
  }

  /* Payroll Inputs */
  @Post('inputs')
  async createPayrollInput(@Body(new ZodValidationPipe(CreatePayrollInputDtoSchema)) dto: dtos.CreatePayrollInputDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreatePayrollInput', 'PayrollInput', {
      ...dto,
      workerId: new Uuid(dto.workerId),
      payrollCycleId: new Uuid(dto.payrollCycleId),
    }, req, { subjectWorkerId: new Uuid(dto.workerId) }));
  }

  @Post('inputs/:id/commands/submit')
  async submitPayrollInput(@Param('id') id: string, @Req() req: Request) {
    const pi = await this.payrollInputRepo.findById(new Uuid(id));
    if (!pi) throw new BadRequestException('Payroll input not found');
    return this.commandBus.execute(this.buildCommand('SubmitPayrollInput', 'PayrollInput', { payrollInputId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pi.status, expectedVersion: pi.aggregateVersion }));
  }

  @Post('inputs/:id/commands/approve')
  async approvePayrollInput(@Param('id') id: string, @Req() req: Request) {
    const pi = await this.payrollInputRepo.findById(new Uuid(id));
    if (!pi) throw new BadRequestException('Payroll input not found');
    return this.commandBus.execute(this.buildCommand('ApprovePayrollInput', 'PayrollInput', { payrollInputId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pi.status, expectedVersion: pi.aggregateVersion }));
  }

  @Post('inputs/:id/commands/reject')
  async rejectPayrollInput(@Param('id') id: string, @Req() req: Request) {
    const pi = await this.payrollInputRepo.findById(new Uuid(id));
    if (!pi) throw new BadRequestException('Payroll input not found');
    return this.commandBus.execute(this.buildCommand('RejectPayrollInput', 'PayrollInput', { payrollInputId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pi.status, expectedVersion: pi.aggregateVersion }));
  }

  @Post('inputs/:id/commands/correct')
  async correctPayrollInput(@Param('id') id: string, @Req() req: Request) {
    const pi = await this.payrollInputRepo.findById(new Uuid(id));
    if (!pi) throw new BadRequestException('Payroll input not found');
    return this.commandBus.execute(this.buildCommand('CorrectPayrollInput', 'PayrollInput', { payrollInputId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: pi.status, expectedVersion: pi.aggregateVersion }));
  }

  @Get('inputs/cycle/:cycleId')
  async getPayrollInputsByCycle(@Param('cycleId') cycleId: string) {
    return this.payrollInputRepo.findByPayrollCycle(new Uuid(cycleId));
  }

  /* Calculation Runs */
  @Post('calculation-runs')
  async startCalculationRun(@Body(new ZodValidationPipe(StartPayrollCalculationRunDtoSchema)) dto: dtos.StartPayrollCalculationRunDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('StartPayrollCalculationRun', 'PayrollCalculationRun', {
      ...dto,
      payrollCycleId: new Uuid(dto.payrollCycleId),
    }, req));
  }

  @Post('calculation-runs/:id/commands/validate')
  async validateCalculationRun(@Param('id') id: string, @Req() req: Request) {
    const run = await this.calculationRunRepo.findById(new Uuid(id));
    if (!run) throw new BadRequestException('Calculation run not found');
    return this.commandBus.execute(this.buildCommand('ValidatePayrollCalculationRun', 'PayrollCalculationRun', { payrollCalculationRunId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: run.status, expectedVersion: run.aggregateVersion }));
  }

  @Post('calculation-runs/:id/commands/finalize')
  async finalizeCalculationRun(@Param('id') id: string, @Req() req: Request) {
    const run = await this.calculationRunRepo.findById(new Uuid(id));
    if (!run) throw new BadRequestException('Calculation run not found');
    return this.commandBus.execute(this.buildCommand('FinalizePayrollCalculationRun', 'PayrollCalculationRun', { payrollCalculationRunId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: run.status, expectedVersion: run.aggregateVersion }));
  }

  @Post('calculation-runs/:id/commands/fail')
  async failCalculationRun(@Param('id') id: string, @Req() req: Request) {
    const run = await this.calculationRunRepo.findById(new Uuid(id));
    if (!run) throw new BadRequestException('Calculation run not found');
    return this.commandBus.execute(this.buildCommand('FailPayrollCalculationRun', 'PayrollCalculationRun', { payrollCalculationRunId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: run.status, expectedVersion: run.aggregateVersion }));
  }

  @Get('calculation-runs/cycle/:cycleId')
  async getCalculationRunsByCycle(@Param('cycleId') cycleId: string) {
    return this.calculationRunRepo.findByPayrollCycle(new Uuid(cycleId));
  }

  /* Result Lines */
  @Post('result-lines')
  async calculateResultLine(@Body(new ZodValidationPipe(CalculatePayrollResultLineDtoSchema)) dto: dtos.CalculatePayrollResultLineDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CalculatePayrollResultLine', 'PayrollResultLine', {
      ...dto,
      workerId: new Uuid(dto.workerId),
      payrollCycleId: new Uuid(dto.payrollCycleId),
      calculationRunId: new Uuid(dto.calculationRunId),
    }, req, { subjectWorkerId: new Uuid(dto.workerId) }));
  }

  @Post('result-lines/:id/commands/explain')
  async explainResultLine(@Param('id') id: string, @Body() body: { explanation: string }, @Req() req: Request) {
    const line = await this.resultLineRepo.findById(new Uuid(id));
    if (!line) throw new BadRequestException('Result line not found');
    return this.commandBus.execute(this.buildCommand('ExplainPayrollResultLine', 'PayrollResultLine', { payrollResultLineId: new Uuid(id), explanation: body.explanation }, req, { aggregateId: new Uuid(id), expectedState: line.status, expectedVersion: line.aggregateVersion }));
  }

  @Post('result-lines/:id/commands/review')
  async reviewResultLine(@Param('id') id: string, @Req() req: Request) {
    const line = await this.resultLineRepo.findById(new Uuid(id));
    if (!line) throw new BadRequestException('Result line not found');
    return this.commandBus.execute(this.buildCommand('ReviewPayrollResultLine', 'PayrollResultLine', { payrollResultLineId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: line.status, expectedVersion: line.aggregateVersion }));
  }

  @Post('result-lines/:id/commands/lock')
  async lockResultLine(@Param('id') id: string, @Req() req: Request) {
    const line = await this.resultLineRepo.findById(new Uuid(id));
    if (!line) throw new BadRequestException('Result line not found');
    return this.commandBus.execute(this.buildCommand('LockPayrollResultLine', 'PayrollResultLine', { payrollResultLineId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: line.status, expectedVersion: line.aggregateVersion }));
  }

  @Get('result-lines/cycle/:cycleId')
  async getResultLinesByCycle(@Param('cycleId') cycleId: string) {
    return this.resultLineRepo.findByPayrollCycle(new Uuid(cycleId));
  }
}
