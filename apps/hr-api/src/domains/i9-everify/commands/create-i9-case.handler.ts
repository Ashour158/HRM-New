import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { I9Case } from '../aggregates/i9-case.aggregate.js';
import { I9CaseRepository } from '../repositories/i9-case.repository.js';
import { I9EverifyEventsPublisher } from '../events/i9-everify-events.publisher.js';
import { coerceUuid } from './coerce-uuid.js';

export interface CreateI9CasePayload {
  i9CaseId: string | Uuid;
  workerId: string | Uuid;
  startDate: Date;
}

/**
 * Handler for the CreateI9Case command. Creates the I-9 case shell that tracks a
 * worker's employment-eligibility-verification process, computing the Section 2
 * compliance due date (3 business days after `startDate`) up front.
 */
@Injectable()
@CommandHandler('CreateI9Case')
export class CreateI9CaseHandler implements ICommandHandler {
  readonly commandName = 'CreateI9Case';

  constructor(
    private readonly repo: I9CaseRepository,
    private readonly eventsPublisher: I9EverifyEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateI9CasePayload;

    const i9Case = I9Case.create(
      {
        id: coerceUuid(payload.i9CaseId),
        tenantId: command.tenantId,
        workerId: coerceUuid(payload.workerId),
        startDate: new Date(payload.startDate),
      },
      command.correlationId,
    );

    await this.repo.save(i9Case);
    await this.eventsPublisher.publishUncommitted(i9Case, command.tenantId, command.correlationId);

    return {
      success: true,
      data: {
        i9CaseId: i9Case.id.value,
        status: i9Case.status,
        section2DueDate: i9Case.section2DueDate.toISOString(),
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: i9Case.id,
      newState: i9Case.status,
      newVersion: i9Case.aggregateVersion,
      allowedNextActions: ['CompleteI9CaseSection1'],
      fieldAccessDecisions: {},
      eventsEmitted: i9Case.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    };
  }
}
