import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CreateLegalEntityPayload } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { LegalEntityRepository } from '../repositories/legal-entity.repository.js';
import { LegalEntity } from '../aggregates/legal-entity.aggregate.js';
import { LegalEntityFsm } from '../fsm/legal-entity.fsm.js';
import { LegalEntityEventsPublisher } from '../events/legal-entity-events.publisher.js';

/**
 * Command handler for creating a new LegalEntity.
 */
@Injectable()
@CommandHandler('CreateLegalEntity')
export class CreateLegalEntityHandler implements ICommandHandler {
  commandName = 'CreateLegalEntity' as const;

  constructor(
    private readonly repo: LegalEntityRepository,
    private readonly publisher: LegalEntityEventsPublisher,
    private readonly fsm: LegalEntityFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateLegalEntityPayload;

    const entity = LegalEntity.create({
      id: payload.legalEntityId,
      tenantId: command.tenantId,
      name: payload.name,
      code: this.generateCode(payload.name, payload.legalEntityId),
      countryCode: payload.countryCode,
      registrationNumber: payload.registrationNumber,
      correlationId: command.correlationId,
    });

    await this.repo.save(entity);
    const eventsEmitted = entity.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(entity, command);

    return {
      success: true,
      data: {
        id: entity.id.value,
        name: entity.name,
        code: entity.code,
        countryCode: entity.countryCode,
        status: entity.status,
      },
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

  private generateCode(name: string, id: Uuid): string {
    const slug = name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .substring(0, 10);
    return `${slug}-${id.value.slice(0, 8)}`;
  }
}
