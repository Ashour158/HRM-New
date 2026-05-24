import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { SpendingAccountRepository } from '../repositories/spending-account.repository.js';
import { SpendingAccount } from '../aggregates/spending-account.aggregate.js';
import { SpendingAccountFsm } from '../fsm/spending-account.fsm.js';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';

/**
 * Command handler for creating a new SpendingAccount.
 */
@Injectable()
@CommandHandler('CreateSpendingAccount')
export class CreateSpendingAccountHandler implements ICommandHandler {
  commandName = 'CreateSpendingAccount' as const;

  constructor(
    private readonly repo: SpendingAccountRepository,
    private readonly publisher: BenefitsEventsPublisher,
    private readonly fsm: SpendingAccountFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      accountId: Uuid;
      workerId: Uuid;
      accountType: string;
      annualElection: number;
      currency: string;
    };

    const account = SpendingAccount.create({
      id: payload.accountId,
      tenantId: command.tenantId,
      workerId: payload.workerId,
      accountType: payload.accountType,
      annualElection: payload.annualElection,
      currency: payload.currency,
      correlationId: command.correlationId,
    });

    await this.repo.save(account);
    const eventsEmitted = account.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(account, command);

    return {
      success: true,
      data: { accountId: account.id.value, status: account.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: account.id,
      newState: account.status,
      newVersion: account.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActions(account.status),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
