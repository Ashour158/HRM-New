import { Injectable, NotFoundException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { HeadcountRequestRepository } from '../repositories/headcount-request.repository.js';

export interface CancelHeadcountRequestCommandPayload {
  requestId: string;
}

/**
 * Handler for the CancelHeadcountRequest command.
 */
@Injectable()
@CommandHandler('CancelHeadcountRequest')
export class CancelHeadcountRequestHandler implements ICommandHandler {
  readonly commandName = 'CancelHeadcountRequest';

  constructor(
    private readonly headcountRepo: HeadcountRequestRepository,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CancelHeadcountRequestCommandPayload;
    const request = await this.headcountRepo.findById(new Uuid(payload.requestId));
    if (!request) {
      throw new NotFoundException('Headcount request not found');
    }

    request.cancel(command.correlationId);
    await this.headcountRepo.save(request);

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
      eventsEmitted: ['HeadcountRequestCancelled'],
      auditRecordId: Uuid.generate(),
    };
  }
}
