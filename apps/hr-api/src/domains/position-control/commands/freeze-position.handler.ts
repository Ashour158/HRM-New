import { Injectable, NotFoundException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { PositionRepository } from '../repositories/position.repository.js';
import { PositionEventsPublisher } from '../events/position-events.publisher.js';

export interface FreezePositionCommandPayload {
  positionId: string;
  reason: string;
}

/**
 * Handler for the FreezePosition command.
 */
@Injectable()
@CommandHandler('FreezePosition')
export class FreezePositionHandler implements ICommandHandler {
  readonly commandName = 'FreezePosition';

  constructor(
    private readonly positionRepo: PositionRepository,
    private readonly eventsPublisher: PositionEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as FreezePositionCommandPayload;
    const position = await this.positionRepo.findById(new Uuid(payload.positionId));
    if (!position) {
      throw new NotFoundException('Position not found');
    }

    position.freeze(command.correlationId);
    await this.positionRepo.save(position);
    await this.eventsPublisher.publishUncommitted(position, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { positionId: position.id.value, status: position.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: position.id,
      newState: position.status,
      newVersion: position.version,
      allowedNextActions: ['Unfreeze', 'Close', 'Update'],
      fieldAccessDecisions: {},
      eventsEmitted: ['PositionFrozen'],
      auditRecordId: Uuid.generate(),
    };
  }
}
