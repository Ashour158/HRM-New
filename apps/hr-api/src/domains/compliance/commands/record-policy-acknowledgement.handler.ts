import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { PolicyAcknowledgementRepository } from '../repositories/policy-acknowledgement.repository.js';
import { ComplianceEventsPublisher } from '../events/compliance-events.publisher.js';

export interface RecordPolicyAcknowledgementPayload {
  requirementId: string;
}

/**
 * Handler for the RecordPolicyAcknowledgement command.
 */
@Injectable()
@CommandHandler('RecordPolicyAcknowledgement')
export class RecordPolicyAcknowledgementHandler implements ICommandHandler {
  readonly commandName = 'RecordPolicyAcknowledgement';

  constructor(
    private readonly repo: PolicyAcknowledgementRepository,
    private readonly eventsPublisher: ComplianceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RecordPolicyAcknowledgementPayload;
    const ack = await this.repo.findById(new Uuid(payload.requirementId));
    if (!ack) {
      throw new ValidationError('Policy acknowledgement not found');
    }

    ack.recordAcknowledgement(command.correlationId);
    await this.repo.save(ack);
    await this.eventsPublisher.publishUncommitted(ack, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { requirementId: ack.id.value, status: ack.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ack.id,
      newState: ack.status,
      newVersion: ack.aggregateVersion,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted: ack.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
