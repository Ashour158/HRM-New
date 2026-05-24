import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { LegalHoldRepository } from '../repositories/legal-hold.repository.js';
import { ComplianceEventsPublisher } from '../events/compliance-events.publisher.js';

export interface ReleaseLegalHoldPayload {
  holdId: string;
  releasedByWorkerId: string;
}

/**
 * Handler for the ReleaseLegalHold command.
 */
@Injectable()
@CommandHandler('ReleaseLegalHold')
export class ReleaseLegalHoldHandler implements ICommandHandler {
  readonly commandName = 'ReleaseLegalHold';

  constructor(
    private readonly repo: LegalHoldRepository,
    private readonly eventsPublisher: ComplianceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ReleaseLegalHoldPayload;
    const hold = await this.repo.findById(new Uuid(payload.holdId));
    if (!hold) {
      throw new ValidationError('Legal hold not found');
    }

    hold.release(new Uuid(payload.releasedByWorkerId), command.correlationId);
    await this.repo.save(hold);
    await this.eventsPublisher.publishUncommitted(hold, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { holdId: hold.id.value, status: hold.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: hold.id,
      newState: hold.status,
      newVersion: hold.aggregateVersion,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted: hold.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
