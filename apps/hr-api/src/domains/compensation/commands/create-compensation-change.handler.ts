import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CompensationChangeRepository } from '../repositories/compensation-change.repository.js';
import { CompensationChange } from '../aggregates/compensation-change.aggregate.js';
import { CompensationChangeFsm } from '../fsm/compensation-change.fsm.js';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';

/**
 * Command handler for creating a new CompensationChange.
 */
@Injectable()
@CommandHandler('CreateCompensationChange')
export class CreateCompensationChangeHandler implements ICommandHandler {
  commandName = 'CreateCompensationChange' as const;

  constructor(
    private readonly repo: CompensationChangeRepository,
    private readonly publisher: CompensationEventsPublisher,
    private readonly fsm: CompensationChangeFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      changeId: Uuid;
      workerId: Uuid;
      changeType: string;
      oldAmount?: number;
      newAmount: number;
      currency: string;
      effectiveDate: Date;
    };

    const change = CompensationChange.create({
      id: payload.changeId,
      tenantId: command.tenantId,
      workerId: payload.workerId,
      changeType: payload.changeType,
      oldAmount: payload.oldAmount,
      newAmount: payload.newAmount,
      currency: payload.currency,
      effectiveDate: payload.effectiveDate,
      correlationId: command.correlationId,
    });

    await this.repo.save(change);
    const eventsEmitted = change.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(change, command);

    return {
      success: true,
      data: { changeId: change.id.value, status: change.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: change.id,
      newState: change.status,
      newVersion: change.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActions(change.status),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
