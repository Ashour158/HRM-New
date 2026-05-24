import { Injectable, NotFoundException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { HeadcountRequestRepository } from '../repositories/headcount-request.repository.js';
import { PositionEventsPublisher } from '../events/position-events.publisher.js';

export interface RejectHeadcountRequestCommandPayload {
  requestId: string;
  reason: string;
}

/**
 * Handler for the RejectHeadcountRequest command.
 */
@Injectable()
@CommandHandler('RejectHeadcountRequest')
export class RejectHeadcountRequestHandler implements ICommandHandler {
  readonly commandName = 'RejectHeadcountRequest';

  constructor(
    private readonly headcountRepo: HeadcountRequestRepository,
    private readonly eventsPublisher: PositionEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RejectHeadcountRequestCommandPayload;
    const request = await this.headcountRepo.findById(new Uuid(payload.requestId));
    if (!request) {
      throw new NotFoundException('Headcount request not found');
    }

    request.reject(command.actor.actorId, command.correlationId);
    await this.headcountRepo.save(request);
    await this.eventsPublisher.publishUncommitted(request, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { headcountRequestId: request.id.value, status: request.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: request.id,
      newState: request.status,
      newVersion: request.version,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted: ['HeadcountRequestRejected'],
      auditRecordId: Uuid.generate(),
    };
  }
}
