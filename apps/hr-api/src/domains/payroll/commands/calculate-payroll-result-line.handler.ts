import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { PayrollResultLine } from '../aggregates/payroll-result-line.aggregate.js';
import { PayrollResultLineRepository } from '../repositories/payroll-result-line.repository.js';
import { PayrollEventsPublisher } from '../events/payroll-events.publisher.js';

@CommandHandler('CalculatePayrollResultLine')
@Injectable()
export class CalculatePayrollResultLineHandler {
  constructor(
    private readonly repo: PayrollResultLineRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PayrollEventsPublisher,
    private readonly hcmSetupService: HcmSetupService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      payrollCycleId: Uuid;
      calculationRunId: Uuid;
      lineType: string;
      description: string;
      amount: number;
      currency: string;
      ruleSetId?: string;
      ruleId?: string;
      calculationStep?: string;
      inputSnapshotHash?: string;
    };
    const setup = await this.hcmSetupService.getSetup(command.tenantId);
    if (!payload.inputSnapshotHash) {
      throw new ValidationError('Payroll result lines must be backed by an applied payroll calculation input snapshot');
    }
    if (!payload.ruleSetId && !payload.ruleId && !payload.calculationStep) {
      throw new ValidationError('Payroll result lines must include applied payroll policy evidence');
    }
    if (!Number.isFinite(payload.amount)) {
      throw new ValidationError('Payroll result line amount must be finite');
    }
    const policyEvidence = {
      engine: 'PayrollPolicyCalculationGate',
      payrollTaxMode: setup.payrollCalculationPolicy.taxMode ?? 'FLAT_PERCENT',
      statutoryPackCount: setup.statutoryPayrollPacks.filter((pack) => pack.active).length,
      earningPolicyCount: setup.earningPolicies.filter((policy) => policy.active).length,
      deductionPolicyCount: setup.deductionPolicies.filter((policy) => policy.active).length,
      inputSnapshotHash: payload.inputSnapshotHash,
    };
    const line = PayrollResultLine.calculate(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        payrollCycleId: payload.payrollCycleId,
        calculationRunId: payload.calculationRunId,
        lineType: payload.lineType,
        description: payload.description,
        amount: payload.amount,
        currency: payload.currency,
        ruleSetId: payload.ruleSetId,
        ruleId: payload.ruleId,
        calculationStep: payload.calculationStep,
        inputSnapshotHash: payload.inputSnapshotHash,
      },
      command.correlationId,
    );
    await this.repo.save(line);
    await this.publisher.publishFromAggregate(line);
    return {
      success: true,
      data: { payrollResultLineId: line.id.value, status: line.status, policyEvidence },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: line.id,
      newState: line.status,
      newVersion: line.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(line.status, 'PayrollResultLine'),
      eventsEmitted: line.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
