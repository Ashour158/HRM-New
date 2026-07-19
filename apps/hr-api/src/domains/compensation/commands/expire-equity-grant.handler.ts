import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { EquityGrantRepository } from '../repositories/equity-grant.repository.js';
import { EquityGrantFsm } from '../fsm/equity-grant.fsm.js';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';

/**
 * Command handler for expiring an EquityGrant.
 */
@Injectable()
@CommandHandler('ExpireEquityGrant')
export class ExpireEquityGrantHandler implements ICommandHandler {
  commandName = 'ExpireEquityGrant' as const;

  constructor(
    private readonly repo: EquityGrantRepository,
    private readonly publisher: CompensationEventsPublisher,
    private readonly fsm: EquityGrantFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { grantId: Uuid };
    const grant = await this.repo.findById(payload.grantId);
    if (!grant) throw new Error('EquityGrant not found');

    grant.expire(command.correlationId);
    await this.repo.save(grant);
    const eventsEmitted = grant.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(grant, command);

    return {
      success: true,
      data: { grantId: grant.id.value, status: grant.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: grant.id,
      newState: grant.status,
      newVersion: grant.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActions(grant.status),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
