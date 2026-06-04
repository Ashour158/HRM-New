import { Injectable, NotFoundException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { PositionRepository } from '../repositories/position.repository.js';

export interface FillPositionCommandPayload {
  positionId: string;
  workerId: string;
}

/**
 * Handler for the FillPosition command.
 *
 * Links a worker to a position. Validates that the position is ACTIVE or VACANT
 * and not FROZEN.
 */
@Injectable()
@CommandHandler('FillPosition')
export class FillPositionHandler implements ICommandHandler {
  readonly commandName = 'FillPosition';

  constructor(
    private readonly positionRepo: PositionRepository,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as FillPositionCommandPayload;
    const position = await this.positionRepo.findById(new Uuid(payload.positionId));
    if (!position) {
      throw new NotFoundException('Position not found');
    }

    const workerId = new Uuid(payload.workerId);
    position.fill(workerId, command.correlationId);
    await this.positionRepo.save(position);

    return {
      success: true,
      data: { positionId: position.id.value, workerId: workerId.value, status: position.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: position.id,
      newState: position.status,
      newVersion: position.version,
      allowedNextActions: ['Vacate'],
      fieldAccessDecisions: {},
      eventsEmitted: ['PositionFilled'],
      auditRecordId: Uuid.generate(),
    };
  }
}
