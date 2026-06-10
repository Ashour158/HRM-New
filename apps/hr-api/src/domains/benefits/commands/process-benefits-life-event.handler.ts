import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { BenefitsLifeEventRepository } from '../repositories/benefits-life-event.repository.js';
import { BenefitsLifeEventFsm } from '../fsm/benefits-life-event.fsm.js';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';

@Injectable()
@CommandHandler('ProcessBenefitsLifeEvent')
export class ProcessBenefitsLifeEventHandler implements ICommandHandler {
  commandName = 'ProcessBenefitsLifeEvent' as const;

  constructor(
    private readonly repo: BenefitsLifeEventRepository,
    private readonly publisher: BenefitsEventsPublisher,
    private readonly fsm: BenefitsLifeEventFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { lifeEventId: Uuid; processedBy?: Uuid };
    const event = await this.repo.findById(payload.lifeEventId);
    if (!event) throw new Error('BenefitsLifeEvent not found');

    event.process(command.correlationId);
    await this.repo.save(event);
    const eventsEmitted = event.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(event, command);

    return {
      success: true,
      data: {
        lifeEventId: event.id.value,
        workerId: event.workerId.value,
        eventType: event.eventType,
        processedBy: payload.processedBy?.value,
        status: event.status,
      },
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
