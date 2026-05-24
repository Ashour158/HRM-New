import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { PolicyAcknowledgement } from '../aggregates/policy-acknowledgement.aggregate.js';
import { PolicyAcknowledgementRepository } from '../repositories/policy-acknowledgement.repository.js';
import { ComplianceEventsPublisher } from '../events/compliance-events.publisher.js';

export interface RequirePolicyAcknowledgementPayload {
  requirementId: string;
  workerId: string;
  policyDocumentId: string;
  dueDate: Date;
}

/**
 * Handler for the RequirePolicyAcknowledgement command.
 */
@Injectable()
@CommandHandler('RequirePolicyAcknowledgement')
export class RequirePolicyAcknowledgementHandler implements ICommandHandler {
  readonly commandName = 'RequirePolicyAcknowledgement';

  constructor(
    private readonly repo: PolicyAcknowledgementRepository,
    private readonly eventsPublisher: ComplianceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RequirePolicyAcknowledgementPayload;

    const ack = PolicyAcknowledgement.create(
      {
        id: new Uuid(payload.requirementId),
        tenantId: command.tenantId,
        workerId: new Uuid(payload.workerId),
        policyDocumentId: new Uuid(payload.policyDocumentId),
        dueDate: payload.dueDate,
      },
      command.correlationId,
    );

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
      allowedNextActions: ['RecordPolicyAcknowledgement', 'MarkOverdue'],
      fieldAccessDecisions: {},
      eventsEmitted: ack.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
