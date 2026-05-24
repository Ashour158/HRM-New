import { Injectable } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { HeadcountRequest } from '../aggregates/headcount-request.aggregate.js';
import { HeadcountRequestRepository } from '../repositories/headcount-request.repository.js';
import { PositionEventsPublisher } from '../events/position-events.publisher.js';

export interface SubmitHeadcountRequestCommandPayload {
  departmentId?: string;
  legalEntityId?: string;
  justification: string;
  requestedPositions: number;
}

/**
 * Handler for the SubmitHeadcountRequest command.
 *
 * Generates a request number and validates the initial state before
 * creating the aggregate.
 */
@Injectable()
@CommandHandler('SubmitHeadcountRequest')
export class SubmitHeadcountRequestHandler implements ICommandHandler {
  readonly commandName = 'SubmitHeadcountRequest';

  constructor(
    private readonly headcountRepo: HeadcountRequestRepository,
    private readonly eventsPublisher: PositionEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as SubmitHeadcountRequestCommandPayload;
    const tenantId = command.tenantId;

    const requestNumber = await this.headcountRepo.generateRequestNumber(tenantId);

    const request = HeadcountRequest.create({
      id: Uuid.generate(),
      tenantId,
      requestNumber,
      departmentId: payload.departmentId ? new Uuid(payload.departmentId) : undefined,
      legalEntityId: payload.legalEntityId ? new Uuid(payload.legalEntityId) : undefined,
      justification: payload.justification,
      requestedBy: command.actor.actorId,
      positionsRequested: payload.requestedPositions,
    });

    await this.headcountRepo.save(request);
    await this.eventsPublisher.publishUncommitted(request, tenantId, command.correlationId);

    return {
      success: true,
      data: {
        headcountRequestId: request.id.value,
        requestNumber: request.requestNumber,
        status: request.status,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: request.id,
      newState: request.status,
      newVersion: request.version,
      allowedNextActions: ['Submit', 'Cancel'],
      fieldAccessDecisions: {},
      eventsEmitted: ['HeadcountRequestCreated'],
      auditRecordId: Uuid.generate(),
    };
  }
}
