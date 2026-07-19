import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { CommandResult, HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { actorClientType } from '../../../platform/http/request-context.js';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { resolveTenantCurrency } from '../../hcm-setup/hcm-setup-currency.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import { PayrollCycleRepository } from '../repositories/payroll-cycle.repository.js';
import { PayrollCalculationRunRepository } from '../repositories/payroll-calculation-run.repository.js';
import { PayrollInputRepository } from '../repositories/payroll-input.repository.js';
import { PayrollResultLineRepository } from '../repositories/payroll-result-line.repository.js';
import type { PayrollInputDraft } from './payroll-input-orchestration.service.js';

/**
 * Everything the close-to-pay orchestration needs from the caller: who is acting and on
 * which tenant. Deliberately independent of Express's Request so this workflow can run both
 * inside an HTTP handler and inside the detached background close-to-pay job.
 */
export interface PayrollWorkflowContext {
  tenantId: Uuid;
  actor: HrActor;
  /**
   * Stable namespace mixed into every command's idempotency key issued through this
   * context. For an HTTP request this is naturally unique per call (random); for the
   * background close-to-pay job this MUST be the job id so that resuming/retrying the same
   * job re-issues the exact same idempotency keys and the CommandBus's own idempotency cache
   * (see CommandBus.stepFastIdempotencyLookup) short-circuits already-completed commands
   * instead of re-running them or double-applying effects.
   */
  idempotencyNamespace: string;
}

@Injectable()
export class PayrollCloseWorkflowService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly hcmSetupService: HcmSetupService,
    private readonly workerRepo: WorkerRepository,
    private readonly payrollCycleRepo: PayrollCycleRepository,
    private readonly calculationRunRepo: PayrollCalculationRunRepository,
    private readonly payrollInputRepo: PayrollInputRepository,
    private readonly resultLineRepo: PayrollResultLineRepository,
  ) {}

  buildCommand<TPayload>(
    ctx: PayrollWorkflowContext,
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid; idempotencyKey?: string },
  ): HrCommandEnvelope<TPayload> {
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId: ctx.tenantId,
      actor: ctx.actor,
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      idempotencyKey: options?.idempotencyKey ?? this.deterministicIdempotencyKey(ctx, commandName, randomUUID()),
      correlationId: Uuid.generate(),
      reason: 'Payroll close-to-pay',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: actorClientType(ctx.actor) },
    };
  }

  /**
   * Deterministic idempotency key derived from a stable business discriminator (e.g.
   * `${workerId}:${lineType}:${calculationStep}`) rather than a random UUID. Retrying the
   * same logical operation with the same discriminator reuses the CommandBus's Redis-backed
   * idempotency cache (24h TTL) and returns the prior result instead of re-executing -
   * this is what makes the batch loop safe to resume after a partial failure without a
   * separate dedup mechanism.
   */
  deterministicIdempotencyKey(ctx: PayrollWorkflowContext, commandName: string, discriminator: string): string {
    return `payroll-close:${ctx.tenantId.value}:${ctx.idempotencyNamespace}:${commandName}:${discriminator}`;
  }

  async executeOrThrow<T>(command: HrCommandEnvelope<unknown>): Promise<CommandResult<T>> {
    const result = await this.commandBus.execute(command) as CommandResult<T>;
    const maybeFailure = result as { success?: boolean; errorMessage?: string; errorCode?: string };
    if (maybeFailure.success === false) {
      const failure = result as CommandResult<T> & { errorMessage?: string; errorCode?: string };
      throw new BadRequestException(failure.errorMessage ?? failure.errorCode ?? 'Payroll command failed');
    }
    return result;
  }

  readResultId(result: CommandResult<unknown>, key: string): string {
    const data = result.data as Record<string, unknown> | undefined;
    const value = data?.[key];
    if (typeof value !== 'string') throw new BadRequestException(`Payroll command did not return ${key}`);
    return value;
  }

  async findWorkerByEmployeeId(employeeId: string, tenantId: Uuid) {
    const activeWorkers = await this.workerRepo.findByStatusForTenant('ACTIVE', tenantId, { limit: 1000 });
    const fallbackWorkers = activeWorkers.length > 0
      ? activeWorkers
      : await this.workerRepo.searchForTenant('', tenantId, { limit: 1000 });
    return fallbackWorkers.find((worker) => worker.employeeNumber === employeeId);
  }

  async resolvePayrollCurrency(tenantId: Uuid): Promise<string> {
    return resolveTenantCurrency(await this.hcmSetupService.getSetup(tenantId));
  }

  async advancePayrollCycle(ctx: PayrollWorkflowContext, commandName: string, payrollCycleId: string): Promise<CommandResult<unknown>> {
    const cycle = await this.payrollCycleRepo.findById(new Uuid(payrollCycleId));
    if (!cycle) throw new BadRequestException('Payroll cycle not found');
    const payload = commandName === 'ApprovePayrollCycle'
      ? { payrollCycleId: new Uuid(payrollCycleId), approvedBy: ctx.actor.actorId }
      : { payrollCycleId: new Uuid(payrollCycleId) };
    return this.executeOrThrow(this.buildCommand(ctx, commandName, 'PayrollCycle', payload, {
      aggregateId: new Uuid(payrollCycleId),
      expectedState: cycle.status,
      expectedVersion: cycle.aggregateVersion,
      idempotencyKey: this.deterministicIdempotencyKey(ctx, commandName, payrollCycleId),
    }));
  }

  async advanceCalculationRun(ctx: PayrollWorkflowContext, commandName: string, calculationRunId: string): Promise<CommandResult<unknown>> {
    const run = await this.calculationRunRepo.findById(new Uuid(calculationRunId));
    if (!run) throw new BadRequestException('Payroll calculation run not found');
    return this.executeOrThrow(this.buildCommand(ctx, commandName, 'PayrollCalculationRun', {
      payrollCalculationRunId: new Uuid(calculationRunId),
    }, {
      aggregateId: new Uuid(calculationRunId),
      expectedState: run.status,
      expectedVersion: run.aggregateVersion,
      idempotencyKey: this.deterministicIdempotencyKey(ctx, commandName, calculationRunId),
    }));
  }

  async lockResultLineThroughWorkflow(ctx: PayrollWorkflowContext, payrollResultLineId: string, explanation: string): Promise<void> {
    let line = await this.resultLineRepo.findById(new Uuid(payrollResultLineId));
    if (!line) throw new BadRequestException('Payroll result line not found');
    await this.executeOrThrow(this.buildCommand(ctx, 'ExplainPayrollResultLine', 'PayrollResultLine', {
      payrollResultLineId: new Uuid(payrollResultLineId),
      explanation,
    }, {
      aggregateId: new Uuid(payrollResultLineId),
      expectedState: line.status,
      expectedVersion: line.aggregateVersion,
      subjectWorkerId: line.workerId,
      idempotencyKey: this.deterministicIdempotencyKey(ctx, 'ExplainPayrollResultLine', payrollResultLineId),
    }));

    line = await this.resultLineRepo.findById(new Uuid(payrollResultLineId));
    if (!line) throw new BadRequestException('Payroll result line not found');
    await this.executeOrThrow(this.buildCommand(ctx, 'ReviewPayrollResultLine', 'PayrollResultLine', {
      payrollResultLineId: new Uuid(payrollResultLineId),
    }, {
      aggregateId: new Uuid(payrollResultLineId),
      expectedState: line.status,
      expectedVersion: line.aggregateVersion,
      subjectWorkerId: line.workerId,
      idempotencyKey: this.deterministicIdempotencyKey(ctx, 'ReviewPayrollResultLine', payrollResultLineId),
    }));

    line = await this.resultLineRepo.findById(new Uuid(payrollResultLineId));
    if (!line) throw new BadRequestException('Payroll result line not found');
    await this.executeOrThrow(this.buildCommand(ctx, 'LockPayrollResultLine', 'PayrollResultLine', {
      payrollResultLineId: new Uuid(payrollResultLineId),
    }, {
      aggregateId: new Uuid(payrollResultLineId),
      expectedState: line.status,
      expectedVersion: line.aggregateVersion,
      subjectWorkerId: line.workerId,
      idempotencyKey: this.deterministicIdempotencyKey(ctx, 'LockPayrollResultLine', payrollResultLineId),
    }));
  }

  async approvePayrollInputThroughWorkflow(ctx: PayrollWorkflowContext, draft: PayrollInputDraft): Promise<string> {
    const createDiscriminator = `${draft.workerId}:${draft.inputType}`;
    const inputResult = await this.executeOrThrow(this.buildCommand(ctx, 'CreatePayrollInput', 'PayrollInput', {
      workerId: new Uuid(draft.workerId),
      payrollCycleId: new Uuid(draft.payrollCycleId),
      inputType: draft.inputType,
      amount: draft.amount,
      currency: draft.currency,
      description: draft.description,
    }, {
      subjectWorkerId: new Uuid(draft.workerId),
      idempotencyKey: this.deterministicIdempotencyKey(ctx, 'CreatePayrollInput', createDiscriminator),
    }));
    const payrollInputId = this.readResultId(inputResult, 'payrollInputId');

    let input = await this.payrollInputRepo.findById(new Uuid(payrollInputId));
    if (!input) throw new BadRequestException('Payroll input not found after creation');
    await this.executeOrThrow(this.buildCommand(ctx, 'SubmitPayrollInput', 'PayrollInput', {
      payrollInputId: new Uuid(payrollInputId),
    }, {
      aggregateId: new Uuid(payrollInputId),
      expectedState: input.status,
      expectedVersion: input.aggregateVersion,
      subjectWorkerId: input.workerId,
      idempotencyKey: this.deterministicIdempotencyKey(ctx, 'SubmitPayrollInput', payrollInputId),
    }));

    input = await this.payrollInputRepo.findById(new Uuid(payrollInputId));
    if (!input) throw new BadRequestException('Payroll input not found after submission');
    await this.executeOrThrow(this.buildCommand(ctx, 'ApprovePayrollInput', 'PayrollInput', {
      payrollInputId: new Uuid(payrollInputId),
    }, {
      aggregateId: new Uuid(payrollInputId),
      expectedState: input.status,
      expectedVersion: input.aggregateVersion,
      subjectWorkerId: input.workerId,
      idempotencyKey: this.deterministicIdempotencyKey(ctx, 'ApprovePayrollInput', payrollInputId),
    }));

    return payrollInputId;
  }

  async applyMassUpdateRowsToInputCollection(
    ctx: PayrollWorkflowContext,
    payrollCycleId: string,
    rows: Array<{
      employeeId?: string;
      grossSalary?: number;
      currency?: string;
      taxOverride?: number;
      insuranceOverride?: number;
      deductionCode?: string;
      deductionAmount?: number;
    }>,
  ): Promise<{ appliedRows: Array<{ employeeId: string; workerId: string; inputTypes: string[] }>; inputCount: number }> {
    const applied: Array<{ employeeId: string; workerId: string; inputTypes: string[] }> = [];
    const tenantCurrency = await this.resolvePayrollCurrency(ctx.tenantId);
    for (const row of rows) {
      if (!row.employeeId) continue;
      const worker = await this.findWorkerByEmployeeId(row.employeeId, ctx.tenantId);
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
        await this.approvePayrollInputThroughWorkflow(ctx, draft);
        inputTypes.push(draft.inputType);
      }
      applied.push({ employeeId: row.employeeId, workerId: worker.id.value, inputTypes });
    }

    return {
      appliedRows: applied,
      inputCount: applied.reduce((total, row) => total + row.inputTypes.length, 0),
    };
  }
}
