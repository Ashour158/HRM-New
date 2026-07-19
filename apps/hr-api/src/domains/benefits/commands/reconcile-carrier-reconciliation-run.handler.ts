import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CarrierReconciliationRunRepository } from '../repositories/carrier-reconciliation-run.repository.js';
import { CarrierReconciliationRunFsm } from '../fsm/carrier-reconciliation-run.fsm.js';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';

/**
 * Command handler that marks a CarrierReconciliationRun as reconciled, from
 * either IN_PROGRESS (clean run) or VARIANCE_DETECTED (variance resolved).
 */
@Injectable()
@CommandHandler('ReconcileCarrierReconciliationRun')
export class ReconcileCarrierReconciliationRunHandler implements ICommandHandler {
  commandName = 'ReconcileCarrierReconciliationRun' as const;

  constructor(
    private readonly repo: CarrierReconciliationRunRepository,
    private readonly publisher: BenefitsEventsPublisher,
    private readonly fsm: CarrierReconciliationRunFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { runId: Uuid };
    const run = await this.repo.findById(payload.runId);
    if (!run) {
      throw new NotFoundException('CarrierReconciliationRun not found');
    }

    // Idempotent replay: a command retry (network blip, redelivery) must
    // succeed rather than throw once the run is already RECONCILED.
    if (run.status !== 'RECONCILED') {
      run.reconcile(command.correlationId);
      await this.repo.save(run);
    }
    const eventsEmitted = run.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(run, command);

    return {
      success: true,
      data: {
        runId: run.id.value,
        carrierId: run.carrierId.value,
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
