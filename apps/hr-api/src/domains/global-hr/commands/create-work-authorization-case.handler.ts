import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { WorkAuthorizationCase } from '../aggregates/work-authorization-case.aggregate.js';
import { WorkAuthorizationCaseRepository } from '../repositories/work-authorization-case.repository.js';
import { GlobalHrEventsPublisher } from '../events/global-hr-events.publisher.js';

export interface CreateWorkAuthorizationCasePayload {
  caseId: string;
  workerId: string;
  authorizationType: string;
  issuingCountry: string;
  documentNumber?: string;
  validFrom?: Date;
  validUntil?: Date;
}

/**
 * Handler for the CreateWorkAuthorizationCase command.
 */
@Injectable()
@CommandHandler('CreateWorkAuthorizationCase')
export class CreateWorkAuthorizationCaseHandler implements ICommandHandler {
  readonly commandName = 'CreateWorkAuthorizationCase';

  constructor(
    private readonly repo: WorkAuthorizationCaseRepository,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateWorkAuthorizationCasePayload;

    const authCase = WorkAuthorizationCase.create(
      {
        id: new Uuid(payload.caseId),
        tenantId: command.tenantId,
        workerId: new Uuid(payload.workerId),
        authorizationType: payload.authorizationType,
        issuingCountry: payload.issuingCountry,
        documentNumber: payload.documentNumber,
        validFrom: payload.validFrom,
        validUntil: payload.validUntil,
      },
      command.correlationId,
    );

    await this.repo.save(authCase);
    await this.eventsPublisher.publishUncommitted(authCase, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { caseId: authCase.id.value, status: authCase.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: authCase.id,
      newState: authCase.status,
      newVersion: authCase.aggregateVersion,
      allowedNextActions: ['StartWorkAuthorizationReview'],
      fieldAccessDecisions: {},
      eventsEmitted: authCase.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
