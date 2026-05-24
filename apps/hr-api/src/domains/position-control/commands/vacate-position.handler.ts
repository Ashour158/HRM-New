import { Injectable, NotFoundException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { PositionRepository } from '../repositories/position.repository.js';
import { PositionEventsPublisher } from '../events/position-events.publisher.js';

export interface VacatePositionCommandPayload {
  positionId: string;
  reason: string;
}

/**
 * Handler for the VacatePosition command.
 *
 * Unlinks a worker from a position. Can be triggered directly via API
 * or indirectly by a WorkerTerminated saga event.
 */
@Injectable()
@CommandHandler('VacatePosition')
export class VacatePositionHandler implements ICommandHandler {
  readonly commandName = 'VacatePosition';

  constructor(
    private readonly positionRepo: PositionRepository,
    private readonly eventsPublisher: PositionEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as VacatePositionCommandPayload;
    const position = await this.positionRepo.findById(new Uuid(payload.positionId));
    if (!position) {
      throw new NotFoundException('Position not found');
    }

    position.vacate(command.correlationId);
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
      allowedNextActions: ['Fill', 'Close', 'Update'],
      fieldAccessDecisions: {},
      eventsEmitted: ['PositionVacated'],
      auditRecordId: Uuid.generate(),
    };
  }
}
