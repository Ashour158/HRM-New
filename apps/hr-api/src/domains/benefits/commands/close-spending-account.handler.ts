import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { SpendingAccountRepository } from '../repositories/spending-account.repository.js';
import { SpendingAccountFsm } from '../fsm/spending-account.fsm.js';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';

/**
 * Command handler that permanently closes a SpendingAccount (FSA/HSA). The
 * BenefitsCarrierConsumer reacts to SpendingAccountClosed to stop the
 * account's carrier-side contribution, so `accountId`/`workerId`/`accountType`
 * must be present in the emitted event payload (`data`).
 */
@Injectable()
@CommandHandler('CloseSpendingAccount')
export class CloseSpendingAccountHandler implements ICommandHandler {
  commandName = 'CloseSpendingAccount' as const;

  constructor(
    private readonly repo: SpendingAccountRepository,
    private readonly publisher: BenefitsEventsPublisher,
    private readonly fsm: SpendingAccountFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { accountId: Uuid };
    const account = await this.repo.findById(payload.accountId);
    if (!account) {
      throw new NotFoundException('SpendingAccount not found');
    }

    // Idempotent replay: a command retry (network blip, redelivery) must
    // succeed rather than throw once the account is already CLOSED.
    if (account.status !== 'CLOSED') {
      account.close(command.correlationId);
      await this.repo.save(account);
    }
    const eventsEmitted = account.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(account, command);

    return {
      success: true,
      data: {
        accountId: account.id.value,
        workerId: account.workerId.value,
        accountType: account.accountType,
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
