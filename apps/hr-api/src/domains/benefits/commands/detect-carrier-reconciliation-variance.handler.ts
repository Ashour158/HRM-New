import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CarrierReconciliationRunRepository } from '../repositories/carrier-reconciliation-run.repository.js';
import { CarrierReconciliationRunFsm } from '../fsm/carrier-reconciliation-run.fsm.js';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';

/**
 * Command handler that records a detected premium/collection variance for an
 * in-progress CarrierReconciliationRun. The BenefitsCarrierConsumer reacts to
 * CarrierReconciliationVarianceDetected to raise an escalation, so `runId`
 * and `varianceAmount` must be present in the emitted event payload (`data`).
 */
@Injectable()
@CommandHandler('DetectCarrierReconciliationVariance')
export class DetectCarrierReconciliationVarianceHandler implements ICommandHandler {
  commandName = 'DetectCarrierReconciliationVariance' as const;

  constructor(
    private readonly repo: CarrierReconciliationRunRepository,
    private readonly publisher: BenefitsEventsPublisher,
    private readonly fsm: CarrierReconciliationRunFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { runId: Uuid; varianceAmount: number };
    const run = await this.repo.findById(payload.runId);
    if (!run) throw new Error('CarrierReconciliationRun not found');

    run.detectVariance(payload.varianceAmount, command.correlationId);
    await this.repo.save(run);
    const eventsEmitted = run.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(run, command);

    return {
      success: true,
      data: {
        runId: run.id.value,
        carrierId: run.carrierId.value,
        varianceAmount: run.varianceAmount,
        currency: run.currency,
        status: run.status,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: run.id,
      newState: run.status,
      newVersion: run.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActions(run.status),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
