import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { LegalHold } from '../aggregates/legal-hold.aggregate.js';
import { LegalHoldRepository } from '../repositories/legal-hold.repository.js';
import { ComplianceEventsPublisher } from '../events/compliance-events.publisher.js';

export interface PlaceLegalHoldPayload {
  holdId: string;
  holdName: string;
  description?: string;
  reason: string;
  affectedWorkerIds: string[];
  placedByWorkerId: string;
}

/**
 * Handler for the PlaceLegalHold command.
 */
@Injectable()
@CommandHandler('PlaceLegalHold')
export class PlaceLegalHoldHandler implements ICommandHandler {
  readonly commandName = 'PlaceLegalHold';

  constructor(
    private readonly repo: LegalHoldRepository,
    private readonly eventsPublisher: ComplianceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as PlaceLegalHoldPayload;

    const hold = LegalHold.create(
      {
        id: new Uuid(payload.holdId),
        tenantId: command.tenantId,
        holdName: payload.holdName,
        description: payload.description,
        reason: payload.reason,
        affectedWorkerIds: payload.affectedWorkerIds.map((id) => new Uuid(id)),
        placedBy: new Uuid(payload.placedByWorkerId),
      },
      command.correlationId,
    );

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
      allowedNextActions: ['ReleaseLegalHold'],
      fieldAccessDecisions: {},
      eventsEmitted: hold.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
