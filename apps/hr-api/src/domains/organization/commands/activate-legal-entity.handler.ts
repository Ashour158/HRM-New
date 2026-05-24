import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { ActivateLegalEntityPayload } from '@hcm/command-contracts';
import { LegalEntityRepository } from '../repositories/legal-entity.repository.js';
import { LegalEntityFsm } from '../fsm/legal-entity.fsm.js';
import { LegalEntityEventsPublisher } from '../events/legal-entity-events.publisher.js';

/**
 * Command handler for activating a LegalEntity.
 */
@Injectable()
@CommandHandler('ActivateLegalEntity')
export class ActivateLegalEntityHandler implements ICommandHandler {
  commandName = 'ActivateLegalEntity' as const;

  constructor(
    private readonly repo: LegalEntityRepository,
    private readonly publisher: LegalEntityEventsPublisher,
    private readonly fsm: LegalEntityFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ActivateLegalEntityPayload;
    const entity = await this.repo.findById(payload.legalEntityId);
    if (!entity) {
      throw new Error('LegalEntity not found');
    }

    entity.activate(command.correlationId);
    await this.repo.save(entity);
    const eventsEmitted = entity.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(entity, command);

    return {
      success: true,
      data: { id: entity.id.value, status: entity.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.version,
      allowedNextActions: this.fsm.getAllowedActions(entity.status),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
