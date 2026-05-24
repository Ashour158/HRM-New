import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { BenefitsLifeEventRepository } from '../repositories/benefits-life-event.repository.js';
import { BenefitsLifeEvent } from '../aggregates/benefits-life-event.aggregate.js';
import { BenefitsLifeEventFsm } from '../fsm/benefits-life-event.fsm.js';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';

/**
 * Command handler for creating a new BenefitsLifeEvent.
 */
@Injectable()
@CommandHandler('CreateBenefitsLifeEvent')
export class CreateBenefitsLifeEventHandler implements ICommandHandler {
  commandName = 'CreateBenefitsLifeEvent' as const;

  constructor(
    private readonly repo: BenefitsLifeEventRepository,
    private readonly publisher: BenefitsEventsPublisher,
    private readonly fsm: BenefitsLifeEventFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      lifeEventId: Uuid;
      workerId: Uuid;
      eventType: string;
      eventDate: Date;
      description?: string;
    };

    const event = BenefitsLifeEvent.create({
      id: payload.lifeEventId,
      tenantId: command.tenantId,
      workerId: payload.workerId,
      eventType: payload.eventType,
      eventDate: payload.eventDate,
      description: payload.description,
      correlationId: command.correlationId,
    });

    await this.repo.save(event);
    const eventsEmitted = event.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(event, command);

    return {
      success: true,
      data: { lifeEventId: event.id.value, status: event.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: event.id,
      newState: event.status,
      newVersion: event.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActions(event.status),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
