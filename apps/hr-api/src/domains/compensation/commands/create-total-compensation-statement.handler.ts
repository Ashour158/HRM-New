import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { TotalCompensationStatementRepository } from '../repositories/total-compensation-statement.repository.js';
import { TotalCompensationStatement } from '../aggregates/total-compensation-statement.aggregate.js';
import { TotalCompensationStatementFsm } from '../fsm/total-compensation-statement.fsm.js';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';

/**
 * Command handler for creating a new TotalCompensationStatement.
 */
@Injectable()
@CommandHandler('CreateTotalCompensationStatement')
export class CreateTotalCompensationStatementHandler implements ICommandHandler {
  commandName = 'CreateTotalCompensationStatement' as const;

  constructor(
    private readonly repo: TotalCompensationStatementRepository,
    private readonly publisher: CompensationEventsPublisher,
    private readonly fsm: TotalCompensationStatementFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      statementId: Uuid;
      workerId: Uuid;
      statementYear: number;
      baseSalary: number;
      bonusAmount: number;
      equityValue: number;
      benefitsValue: number;
      totalComp: number;
      currency: string;
    };

    const statement = TotalCompensationStatement.create({
      id: payload.statementId,
      tenantId: command.tenantId,
      workerId: payload.workerId,
      statementYear: payload.statementYear,
      baseSalary: payload.baseSalary,
      bonusAmount: payload.bonusAmount,
      equityValue: payload.equityValue,
      benefitsValue: payload.benefitsValue,
      totalComp: payload.totalComp,
      currency: payload.currency,
      correlationId: command.correlationId,
    });

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
