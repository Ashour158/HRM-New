import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { PolicyDocumentRepository } from '../repositories/policy-document.repository.js';
import { ComplianceEventsPublisher } from '../events/compliance-events.publisher.js';

export interface RejectPolicyDocumentPayload {
  documentId: string;
}

/**
 * Handler for the RejectPolicyDocument command.
 */
@Injectable()
@CommandHandler('RejectPolicyDocument')
export class RejectPolicyDocumentHandler implements ICommandHandler {
  readonly commandName = 'RejectPolicyDocument';

  constructor(
    private readonly repo: PolicyDocumentRepository,
    private readonly eventsPublisher: ComplianceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RejectPolicyDocumentPayload;
    const doc = await this.repo.findById(new Uuid(payload.documentId));
    if (!doc) {
      throw new ValidationError('Policy document not found');
    }

    doc.reject(command.correlationId);
    await this.repo.save(doc);
    await this.eventsPublisher.publishUncommitted(doc, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { documentId: doc.id.value, status: doc.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: doc.id,
      newState: doc.status,
      newVersion: doc.aggregateVersion,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted: doc.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
