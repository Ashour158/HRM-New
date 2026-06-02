import { Injectable, NotFoundException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { HeadcountRequestRepository } from '../repositories/headcount-request.repository.js';
import { PositionEventsPublisher } from '../events/position-events.publisher.js';

export interface ApproveHeadcountRequestCommandPayload {
  requestId: string;
  positionsApproved: number;
}

/**
 * Handler for the ApproveHeadcountRequest command.
 *
 * Enforces SoD: approver cannot be the requester.
 * May trigger Position creation if auto-create is enabled.
 */
@Injectable()
@CommandHandler('ApproveHeadcountRequest')
export class ApproveHeadcountRequestHandler implements ICommandHandler {
  readonly commandName = 'ApproveHeadcountRequest';

  constructor(
    private readonly headcountRepo: HeadcountRequestRepository,
    private readonly eventsPublisher: PositionEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ApproveHeadcountRequestCommandPayload;
    const request = await this.headcountRepo.findById(new Uuid(payload.requestId));
    if (!request) {
      throw new NotFoundException('Headcount request not found');
    }

    request.approve(command.actor.actorId, payload.positionsApproved, command.correlationId);
    await this.headcountRepo.save(request);
    await this.eventsPublisher.publishUncommitted(request, command.tenantId, command.correlationId);

    return {
      success: true,
      data: {
        headcountRequestId: request.id.value,
        approvedBy: command.actor.actorId.value,
        status: request.status,
        positionsApproved: request.positionsApproved,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: request.id,
      newState: request.status,
      newVersion: request.version,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted: ['HeadcountRequestApproved'],
      auditRecordId: Uuid.generate(),
    };
  }
}
