import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { TotalCompensationStatementRepository } from '../repositories/total-compensation-statement.repository.js';
import { TotalCompensationStatementFsm } from '../fsm/total-compensation-statement.fsm.js';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';

/**
 * Command handler for delivering a TotalCompensationStatement.
 */
@Injectable()
@CommandHandler('DeliverTotalCompensationStatement')
export class DeliverTotalCompensationStatementHandler implements ICommandHandler {
  commandName = 'DeliverTotalCompensationStatement' as const;

  constructor(
    private readonly repo: TotalCompensationStatementRepository,
    private readonly publisher: CompensationEventsPublisher,
    private readonly fsm: TotalCompensationStatementFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { statementId: Uuid };
    const statement = await this.repo.findById(payload.statementId);
    if (!statement) throw new Error('TotalCompensationStatement not found');

    statement.deliver(command.correlationId);
    await this.repo.save(statement);
    const eventsEmitted = statement.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(statement, command);

    return {
      success: true,
      data: { statementId: statement.id.value, status: statement.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: statement.id,
      newState: statement.status,
      newVersion: statement.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActions(statement.status),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
