import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { UpdateOrgUnitPayload } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { OrgUnitRepository } from '../repositories/org-unit.repository.js';
import { OrgUnitFsm } from '../fsm/org-unit.fsm.js';
import { OrgUnit } from '../aggregates/org-unit.aggregate.js';

/**
 * Command handler for updating an OrgUnit.
 */
@Injectable()
@CommandHandler('UpdateOrgUnit')
export class UpdateOrgUnitHandler implements ICommandHandler {
  commandName = 'UpdateOrgUnit' as const;

  constructor(
    private readonly repo: OrgUnitRepository,
    private readonly eventBus: EventBus,
    private readonly fsm: OrgUnitFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as UpdateOrgUnitPayload;
    const entity = await this.repo.findById(payload.orgUnitId);
    if (!entity) {
      throw new Error('OrgUnit not found');
    }

    entity.update(
      { name: payload.name, parentId: payload.parentOrgUnitId },
      command.correlationId,
    );
    await this.repo.save(entity);
    const eventsEmitted = entity.domainEvents.map((e) => e.eventName);
    await this.publishEvents(entity, command);

    return {
      success: true,
      data: { id: entity.id.value, name: entity.name, status: entity.status },
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

  private async publishEvents(entity: OrgUnit, command: HrCommandEnvelope<unknown>): Promise<void> {
    const envelopes: HrEventEnvelope<unknown>[] = entity.domainEvents.map((event) => ({
      eventId: Uuid.generate(),
      eventName: event.eventName,
      eventSchemaVersion: 1,
      tenantId: command.tenantId,
      aggregateType: 'OrgUnit',
      aggregateId: entity.id,
      payload: event as unknown as Record<string, unknown>,
      metadata: {
        correlationId: command.correlationId,
        causationId: command.commandId,
        requestHash: command.metadata.requestHash,
        clientType: command.metadata.clientType,
      },
      privacy: createPrivacyForEvent('NONE', undefined, 'PROFILE'),
      occurredAt: new Date(),
      version: 1,
    }));
    await this.eventBus.publishAll(envelopes);
    entity.clearDomainEvents();
  }
}
