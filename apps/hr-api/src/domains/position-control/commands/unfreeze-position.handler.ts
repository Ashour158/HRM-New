import { Injectable, NotFoundException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { PositionRepository } from '../repositories/position.repository.js';

export interface UnfreezePositionCommandPayload {
  positionId: string;
}

/**
 * Handler for the UnfreezePosition command.
 */
@Injectable()
@CommandHandler('UnfreezePosition')
export class UnfreezePositionHandler implements ICommandHandler {
  readonly commandName = 'UnfreezePosition';

  constructor(
    private readonly positionRepo: PositionRepository,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as UnfreezePositionCommandPayload;
    const position = await this.positionRepo.findById(new Uuid(payload.positionId));
    if (!position) {
      throw new NotFoundException('Position not found');
    }

    position.unfreeze(command.correlationId);
    await this.positionRepo.save(position);

    return {
      success: true,
      data: { positionId: position.id.value, status: position.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: position.id,
      newState: position.status,
      newVersion: position.version,
      allowedNextActions: ['Freeze', 'Fill', 'Close', 'Update'],
      fieldAccessDecisions: {},
      eventsEmitted: ['PositionUnfrozen'],
      auditRecordId: Uuid.generate(),
    };
  }
}
