import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CarrierReconciliationRunRepository } from '../repositories/carrier-reconciliation-run.repository.js';
import { CarrierReconciliationRun } from '../aggregates/carrier-reconciliation-run.aggregate.js';
import { CarrierReconciliationRunFsm } from '../fsm/carrier-reconciliation-run.fsm.js';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';

/**
 * Command handler for creating a new CarrierReconciliationRun.
 */
@Injectable()
@CommandHandler('CreateCarrierReconciliationRun')
export class CreateCarrierReconciliationRunHandler implements ICommandHandler {
  commandName = 'CreateCarrierReconciliationRun' as const;

  constructor(
    private readonly repo: CarrierReconciliationRunRepository,
    private readonly publisher: BenefitsEventsPublisher,
    private readonly fsm: CarrierReconciliationRunFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      runId: Uuid;
      carrierId: Uuid;
      periodStart: Date;
      periodEnd: Date;
      totalPremium: number;
      totalCollected: number;
      varianceAmount: number;
      currency: string;
    };

    const run = CarrierReconciliationRun.create({
      id: payload.runId,
      tenantId: command.tenantId,
      carrierId: payload.carrierId,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      totalPremium: payload.totalPremium,
      totalCollected: payload.totalCollected,
      varianceAmount: payload.varianceAmount,
      currency: payload.currency,
      correlationId: command.correlationId,
    });
    // Immediately begin the run so CarrierReconciliationStarted fires, mirroring
    // how CreateBenefitsEnrollmentHandler submits enrollments right after creation.
    run.start(command.correlationId);

    await this.repo.save(run);
    const eventsEmitted = run.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(run, command);

    return {
      success: true,
      data: { runId: run.id.value, status: run.status },
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
