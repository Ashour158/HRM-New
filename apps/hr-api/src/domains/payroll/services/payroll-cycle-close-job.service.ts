import { Injectable, Logger } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { PayrollInputRepository } from '../repositories/payroll-input.repository.js';
import { PayrollResultLineRepository } from '../repositories/payroll-result-line.repository.js';
import {
  PayrollCycleCalculationService,
  type PayrollCyclePreview,
  type PayrollCycleEmployeeInput,
} from './payroll-cycle-calculation.service.js';
import type { PayrollCloseToPayReadiness } from './payroll-cycle-governance.service.js';
import { PayrollInputOrchestrationService } from './payroll-input-orchestration.service.js';
import { PayrollApprovedInputProjectionService } from './payroll-approved-input-projection.service.js';
import { PayrollArtifactService } from './payroll-artifact.service.js';
import { PayrollGlPostingService } from './payroll-gl-posting.service.js';
import { resolvePayrollGlAccountMapping } from './payroll-gl-account-mapping.util.js';
import { PayrollPersistedCycleReadinessService } from './payroll-persisted-cycle-readiness.service.js';
import { PayrollCloseWorkflowService, type PayrollWorkflowContext } from './payroll-close-workflow.service.js';
import {
  PayrollCycleCloseJobRepository,
  type PayrollCycleCloseJobRecord,
  type PayrollCycleCloseJobEmployeeError,
} from '../repositories/payroll-cycle-close-job.repository.js';

export interface PayrollCloseMassUpdateRow {
  employeeId?: string;
  grossSalary?: number;
  currency?: string;
  taxOverride?: number;
  insuranceOverride?: number;
  deductionCode?: string;
  deductionAmount?: number;
}

export interface StartCloseToPayInput {
  tenantId: Uuid;
  actor: HrActor;
  year: number;
  month: number;
  workLocationCode?: string;
  closeCycle: boolean;
  massUpdateRows: PayrollCloseMassUpdateRow[];
  /** Preview already validated as ready-to-close by the caller (synchronous pre-check). */
  preview: PayrollCyclePreview;
  /** Pre-check readiness, guaranteed canClose === true; carried through for closeCycle=false responses. */
  readiness: PayrollCloseToPayReadiness;
  /** Employee snapshot used to build payslips; computed once by the caller to avoid a redundant recomputation mid-job. */
  employees: PayrollCycleEmployeeInput[];
  /** Employees processed per batch before a progress checkpoint is persisted. Default 50. */
  batchSize?: number;
}

export interface StartCloseToPayResult {
  jobId: string;
  status: 'RUNNING';
  totalEmployees: number;
  totalBatches: number;
  batchSize: number;
}

const DEFAULT_BATCH_SIZE = 50;

@Injectable()
export class PayrollCycleCloseJobService {
  private readonly logger = new Logger(PayrollCycleCloseJobService.name);

  constructor(
    private readonly jobRepo: PayrollCycleCloseJobRepository,
    private readonly workflow: PayrollCloseWorkflowService,
    private readonly hcmSetupService: HcmSetupService,
    private readonly payrollInputRepo: PayrollInputRepository,
    private readonly resultLineRepo: PayrollResultLineRepository,
    private readonly payrollCalculation: PayrollCycleCalculationService,
    private readonly payrollInputOrchestration: PayrollInputOrchestrationService,
    private readonly payrollApprovedInputProjection: PayrollApprovedInputProjectionService,
    private readonly payrollArtifact: PayrollArtifactService,
    private readonly payrollGlPosting: PayrollGlPostingService,
    private readonly persistedReadiness: PayrollPersistedCycleReadinessService,
  ) {}

  /**
   * Creates the RUNNING job record and starts the heavy pipeline in the background without
   * awaiting it. Callers (the HTTP controller) get a job id back immediately instead of
   * blocking on thousands of sequential CommandBus round trips inside one HTTP request.
   */
  async startJob(input: StartCloseToPayInput): Promise<StartCloseToPayResult> {
    const batchSize = input.batchSize && input.batchSize > 0 ? Math.floor(input.batchSize) : DEFAULT_BATCH_SIZE;
    const totalEmployees = input.preview.employeeCount;
    const totalBatches = Math.max(1, Math.ceil(Math.max(totalEmployees, input.preview.rows.length) / batchSize));
    const jobRecord = await this.jobRepo.create({
      tenantId: input.tenantId,
      year: input.year,
      month: input.month,
      workLocationCode: input.workLocationCode,
      closeCycle: input.closeCycle,
      batchSize,
      totalEmployees,
      totalBatches,
      requestedBy: input.actor.actorId.value,
    });

    // Deliberately not awaited: the caller must return the job id immediately.
    void this.run(jobRecord.id, input, batchSize).catch((error) => {
      this.logger.error({
        eventType: 'PAYROLL_CLOSE_JOB_UNCAUGHT_ERROR',
        jobId: jobRecord.id.value,
        tenantId: input.tenantId.value,
        message: error instanceof Error ? error.message : String(error),
      });
    });

    return {
      jobId: jobRecord.id.value,
      status: 'RUNNING',
      totalEmployees,
      totalBatches,
      batchSize,
    };
  }

  async getJobStatus(tenantId: Uuid, jobId: Uuid): Promise<PayrollCycleCloseJobRecord | undefined> {
    return this.jobRepo.findById(tenantId, jobId);
  }

  /**
   * Runs the pipeline for a single job to completion. Not `private` so tests can `await` it
   * directly instead of racing the fire-and-forget dispatch in startJob(); startJob() remains
   * the production entry point and never awaits this itself.
   */
  async run(jobId: Uuid, input: StartCloseToPayInput, batchSize: number): Promise<void> {
    const ctx: PayrollWorkflowContext = {
      tenantId: input.tenantId,
      actor: input.actor,
      // Stable across a resume of this exact job: retried commands reuse the same
      // idempotency keys and hit the CommandBus's idempotency cache instead of re-running.
      idempotencyNamespace: jobId.value,
    };
    const employeeErrors: PayrollCycleCloseJobEmployeeError[] = [];

    try {
      const setup = await this.hcmSetupService.getSetup(input.tenantId);

      const cycleResult = await this.workflow.executeOrThrow(this.workflow.buildCommand(ctx, 'CreatePayrollCycle', 'PayrollCycle', {
        cycleName: input.preview.name,
        payPeriodStart: new Date(`${input.preview.periodStart}T00:00:00.000Z`),
        payPeriodEnd: new Date(`${input.preview.periodEnd}T00:00:00.000Z`),
        payDate: new Date(`${input.preview.payDate}T00:00:00.000Z`),
      }, { idempotencyKey: this.workflow.deterministicIdempotencyKey(ctx, 'CreatePayrollCycle', 'cycle') }));
      const payrollCycleId = this.workflow.readResultId(cycleResult, 'payrollCycleId');
      await this.jobRepo.updateProgress(input.tenantId, jobId, { payrollCycleId });

      await this.workflow.advancePayrollCycle(ctx, 'OpenPayrollCycle', payrollCycleId);
      await this.workflow.advancePayrollCycle(ctx, 'StartPayrollInputCollection', payrollCycleId);

      let payrollInputCount = 0;
      let processed = 0;
      let currentBatch = 0;

      for (const batch of chunk(input.preview.rows, batchSize)) {
        currentBatch += 1;
        for (const row of batch) {
          try {
            for (const draft of this.payrollInputOrchestration.buildInputDrafts(row, { payrollCycleId })) {
              await this.workflow.approvePayrollInputThroughWorkflow(ctx, draft);
              payrollInputCount += 1;
            }
          } catch (error) {
            employeeErrors.push(toEmployeeError(row.workerId, row.employeeId, 'INPUT_COLLECTION', error));
          }
        }
        processed += batch.length;
        await this.jobRepo.updateProgress(input.tenantId, jobId, { processedEmployees: processed, currentBatch, errors: employeeErrors });
        await yieldToEventLoop();
      }

      const massUpdateResult = await this.workflow.applyMassUpdateRowsToInputCollection(ctx, payrollCycleId, input.massUpdateRows);
      payrollInputCount += massUpdateResult.inputCount;

      const approvedInputs = await this.payrollInputRepo.findByPayrollCycle(new Uuid(payrollCycleId));
      const calculationPreview = this.payrollApprovedInputProjection.applyApprovedInputs(
        input.preview,
        approvedInputs.map((row) => ({
          workerId: row.workerId.value,
          inputType: row.inputType,
          amount: row.amount,
          currency: row.currency,
          status: row.status,
          description: row.description,
        })),
      );
      const calculationBankRows = this.payrollCalculation.buildBankTransferRows(calculationPreview.rows);

      await this.workflow.advancePayrollCycle(ctx, 'StartPayrollValidation', payrollCycleId);
      await this.workflow.advancePayrollCycle(ctx, 'StartPayrollCalculation', payrollCycleId);

      const runResult = await this.workflow.executeOrThrow(this.workflow.buildCommand(ctx, 'StartPayrollCalculationRun', 'PayrollCalculationRun', {
        payrollCycleId: new Uuid(payrollCycleId),
        currency: calculationPreview.currency,
        totalWorkers: calculationPreview.employeeCount,
        totalGrossPay: calculationPreview.totalGross,
        totalNetPay: calculationPreview.totalNet,
      }, { idempotencyKey: this.workflow.deterministicIdempotencyKey(ctx, 'StartPayrollCalculationRun', payrollCycleId) }));
      const payrollCalculationRunId = this.workflow.readResultId(runResult, 'payrollCalculationRunId');

      let resultLineCount = 0;
      processed = 0;
      currentBatch = 0;
      const calculationBatches = chunk(calculationPreview.rows, batchSize);
      await this.jobRepo.updateProgress(input.tenantId, jobId, {
        payrollCalculationRunId,
        totalBatches: calculationBatches.length,
        totalEmployees: calculationPreview.rows.length,
        processedEmployees: 0,
        currentBatch: 0,
      });

      for (const batch of calculationBatches) {
        currentBatch += 1;
        for (const row of batch) {
          try {
            for (const draft of this.payrollCalculation.buildResultLineDrafts(row, { payrollCycleId, calculationRunId: payrollCalculationRunId })) {
              const discriminator = `${draft.workerId}:${draft.lineType}:${draft.calculationStep}`;
              const lineResult = await this.workflow.executeOrThrow(this.workflow.buildCommand(ctx, 'CalculatePayrollResultLine', 'PayrollResultLine', {
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
              }, {
                subjectWorkerId: new Uuid(draft.workerId),
                idempotencyKey: this.workflow.deterministicIdempotencyKey(ctx, 'CalculatePayrollResultLine', discriminator),
              }));
              const payrollResultLineId = this.workflow.readResultId(lineResult, 'payrollResultLineId');
              await this.workflow.lockResultLineThroughWorkflow(ctx, payrollResultLineId, draft.explanation);
              resultLineCount += 1;
            }
          } catch (error) {
            employeeErrors.push(toEmployeeError(row.workerId, row.employeeId, 'CALCULATION', error));
          }
        }
        processed += batch.length;
        await this.jobRepo.updateProgress(input.tenantId, jobId, { processedEmployees: processed, currentBatch, errors: employeeErrors });
        await yieldToEventLoop();
      }

      await this.workflow.advanceCalculationRun(ctx, 'ValidatePayrollCalculationRun', payrollCalculationRunId);
      await this.workflow.advanceCalculationRun(ctx, 'FinalizePayrollCalculationRun', payrollCalculationRunId);
      await this.workflow.advancePayrollCycle(ctx, 'StartPayrollReview', payrollCycleId);

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

      const payslips = this.payrollCalculation.buildPayslipsFromResultLines({
        payrollCycle: {
          id: payrollCycleId,
          periodStart: calculationPreview.periodStart,
          periodEnd: calculationPreview.periodEnd,
          payDate: calculationPreview.payDate,
        },
        employees: input.employees,
        resultLines: lockedResultLines,
      });
      const payslipArtifacts = payslips.map((payslip) => this.payrollArtifact.buildPayslipArtifactRecord({
        tenantId: input.tenantId.value,
        payrollCycleId,
        payslip,
        htmlContent: this.payrollInputOrchestration.renderPayslipHtml(payslip),
      }));
      await this.workflow.executeOrThrow(this.workflow.buildCommand(ctx, 'GeneratePayrollPayslipArtifacts', 'PayrollPayslipArtifact', {
        payrollCycleId,
        records: payslipArtifacts,
      }, { aggregateId: new Uuid(payrollCycleId), idempotencyKey: this.workflow.deterministicIdempotencyKey(ctx, 'GeneratePayrollPayslipArtifacts', payrollCycleId) }));

      const persistedPaymentBatch = {
        ...this.payrollInputOrchestration.buildPaymentBatch(calculationPreview, calculationBankRows),
        payrollCycleId,
      };
      const paymentBatchRecord = this.payrollArtifact.buildPaymentBatchRecord({
        tenantId: input.tenantId.value,
        payrollCycleId,
        batch: persistedPaymentBatch,
        createdBy: input.actor.actorId.value,
      });
      await this.workflow.executeOrThrow(this.workflow.buildCommand(ctx, 'CreatePayrollPaymentBatch', 'PayrollPaymentBatch', {
        record: paymentBatchRecord,
      }, { aggregateId: safeUuid(paymentBatchRecord.id, new Uuid(payrollCycleId)), idempotencyKey: this.workflow.deterministicIdempotencyKey(ctx, 'CreatePayrollPaymentBatch', payrollCycleId) }));

      const glPosting = this.payrollGlPosting.buildPosting({
        tenantId: input.tenantId.value,
        payrollCycleId,
        preview: calculationPreview,
        createdBy: input.actor.actorId.value,
        accountMapping: resolvePayrollGlAccountMapping(setup, calculationPreview, input.workLocationCode),
      });
      await this.workflow.executeOrThrow(this.workflow.buildCommand(ctx, 'CreatePayrollGlPosting', 'PayrollGlPosting', {
        record: glPosting,
      }, { aggregateId: safeUuid(glPosting.id, new Uuid(payrollCycleId)), idempotencyKey: this.workflow.deterministicIdempotencyKey(ctx, 'CreatePayrollGlPosting', payrollCycleId) }));

      let finalCycleStatus = 'REVIEW';
      let finalReadiness = input.readiness;
      if (input.closeCycle) {
        finalReadiness = await this.persistedReadiness.buildPersistedCycleCloseReadiness(input.tenantId, payrollCycleId);
        if (!finalReadiness.canClose) {
          // Matches the pre-refactor synchronous contract: persisted enterprise evidence
          // (GL mapping, payment batch config, payslip artifacts) missing at final-close time
          // fails the run. Inputs/calculation/locking/artifacts already persisted up to this
          // point remain in place (cycle sits in REVIEW) - only the approve+close step is
          // skipped - and the job id keeps the failure + partial payrollCycleId observable.
          throw new Error(`Payroll cycle has blocking readiness issues: ${finalReadiness.issues
            .filter((issue) => issue.blocking)
            .map((issue) => issue.message)
            .join('; ')}`);
        }
        await this.workflow.advancePayrollCycle(ctx, 'ApprovePayrollCycle', payrollCycleId);
        const closeResult = await this.workflow.advancePayrollCycle(ctx, 'ClosePayrollCycle', payrollCycleId);
        finalCycleStatus = String((closeResult as { newState?: string }).newState ?? 'CLOSED');
      }

      await this.jobRepo.markSucceeded(input.tenantId, jobId, {
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
        employeeErrors,
        events: ['PayrollCycleClosedToPay', 'PayrollInputsApproved', 'PayrollResultLinesLocked', 'PaymentBatchPersisted', 'PayslipArtifactsGenerated', 'PayrollGlPostingBuilt', 'PayrollCloseReadinessEvaluated'],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.jobRepo.updateProgress(input.tenantId, jobId, { errors: employeeErrors });
      await this.jobRepo.markFailed(input.tenantId, jobId, message);
      this.logger.error({
        eventType: 'PAYROLL_CLOSE_JOB_FAILED',
        jobId: jobId.value,
        tenantId: input.tenantId.value,
        message,
      });
    }
  }
}

function toEmployeeError(workerId: string, employeeId: string | undefined, stage: string, error: unknown): PayrollCycleCloseJobEmployeeError {
  return {
    workerId,
    employeeId,
    stage,
    message: error instanceof Error ? error.message : String(error),
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function safeUuid(value: string | undefined, fallback: Uuid): Uuid {
  return value && Uuid.isValid(value) ? new Uuid(value) : fallback;
}
