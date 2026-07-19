import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { PolicyDocument } from '../aggregates/policy-document.aggregate.js';
import { PolicyDocumentRepository } from '../repositories/policy-document.repository.js';
import { ComplianceEventsPublisher } from '../events/compliance-events.publisher.js';

export interface CreatePolicyDocumentPayload {
  documentId: string;
  title: string;
  documentType: string;
  version: string;
  content: Record<string, unknown>;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
}

/**
 * Handler for the CreatePolicyDocument command.
 */
@Injectable()
@CommandHandler('CreatePolicyDocument')
export class CreatePolicyDocumentHandler implements ICommandHandler {
  readonly commandName = 'CreatePolicyDocument';

  constructor(
    private readonly repo: PolicyDocumentRepository,
    private readonly eventsPublisher: ComplianceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreatePolicyDocumentPayload;

    const doc = PolicyDocument.create(
      {
        id: new Uuid(payload.documentId),
        tenantId: command.tenantId,
        title: payload.title,
        documentType: payload.documentType,
        documentVersion: payload.version,
        content: payload.content,
        effectiveFrom: payload.effectiveFrom,
        effectiveUntil: payload.effectiveUntil,
      },
      command.correlationId,
    );

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
      allowedNextActions: ['SubmitPolicyDocumentForApproval'],
      fieldAccessDecisions: {},
      eventsEmitted: doc.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
