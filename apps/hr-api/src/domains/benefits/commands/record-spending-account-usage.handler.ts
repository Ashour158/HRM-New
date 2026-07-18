import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { SpendingAccountRepository } from '../repositories/spending-account.repository.js';
import { SpendingAccountFsm } from '../fsm/spending-account.fsm.js';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';

/**
 * Command handler that records an FSA/HSA claim/spend against a SpendingAccount,
 * reducing its available balance.
 */
@Injectable()
@CommandHandler('RecordSpendingAccountUsage')
export class RecordSpendingAccountUsageHandler implements ICommandHandler {
  commandName = 'RecordSpendingAccountUsage' as const;

  constructor(
    private readonly repo: SpendingAccountRepository,
    private readonly publisher: BenefitsEventsPublisher,
    private readonly fsm: SpendingAccountFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { accountId: Uuid; amount: number };
    const account = await this.repo.findById(payload.accountId);
    if (!account) throw new Error('SpendingAccount not found');

    account.recordUsage(payload.amount, command.correlationId);
    await this.repo.save(account);
    const eventsEmitted = account.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(account, command);

    return {
      success: true,
      data: {
        accountId: account.id.value,
        workerId: account.workerId.value,
        usedAmount: account.usedAmount,
        availableAmount: account.availableAmount,
        currency: account.currency,
        status: account.status,
      },
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
