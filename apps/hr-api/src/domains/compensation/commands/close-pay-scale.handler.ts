import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { PayScaleRepository } from '../repositories/pay-scale.repository.js';
import { PayScaleFsm } from '../fsm/pay-scale.fsm.js';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';

/**
 * Command handler for closing a PayScale.
 * ACTIVE or REVISED → CLOSED (terminal).
 */
@Injectable()
@CommandHandler('ClosePayScale')
export class ClosePayScaleHandler implements ICommandHandler {
  commandName = 'ClosePayScale' as const;

  constructor(
    private readonly repo: PayScaleRepository,
    private readonly publisher: CompensationEventsPublisher,
    private readonly fsm: PayScaleFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { scaleId: Uuid };
    const scale = await this.repo.findById(payload.scaleId);
    if (!scale) throw new Error('PayScale not found');

    scale.close(command.correlationId);
    await this.repo.save(scale);
    const eventsEmitted = scale.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(scale, command);

    return {
      success: true,
      data: { scaleId: scale.id.value, status: scale.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: scale.id,
      newState: scale.status,
      newVersion: scale.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActions(scale.status),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
