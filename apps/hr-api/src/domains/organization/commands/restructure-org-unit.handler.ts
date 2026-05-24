import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { RestructureOrgUnitPayload } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { OrgUnitRepository } from '../repositories/org-unit.repository.js';
import { OrgUnitFsm } from '../fsm/org-unit.fsm.js';
import { OrgUnit } from '../aggregates/org-unit.aggregate.js';

/**
 * Command handler for restructuring an OrgUnit.
 */
@Injectable()
@CommandHandler('RestructureOrgUnit')
export class RestructureOrgUnitHandler implements ICommandHandler {
  commandName = 'RestructureOrgUnit' as const;

  constructor(
    private readonly repo: OrgUnitRepository,
    private readonly eventBus: EventBus,
    private readonly fsm: OrgUnitFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RestructureOrgUnitPayload;
    const entity = await this.repo.findById(payload.orgUnitId);
    if (!entity) {
      throw new Error('OrgUnit not found');
    }

    entity.restructure(payload.newParentOrgUnitId, payload.newName, command.correlationId);

    // Recalculate path and level when parent changes
    if (payload.newParentOrgUnitId) {
      const parent = await this.repo.findById(payload.newParentOrgUnitId);
      entity.path = parent ? `${parent.path ?? ''}/${entity.id.value}` : entity.id.value;
      entity.level = (parent?.level ?? 0) + 1;
    } else if (payload.newParentOrgUnitId === undefined) {
      // No change to parent
    } else {
      // Explicitly set to root
      entity.path = entity.id.value;
      entity.level = 0;
    }

    await this.repo.save(entity);
    const eventsEmitted = entity.domainEvents.map((e) => e.eventName);
    await this.publishEvents(entity, command);

    return {
      success: true,
      data: {
        id: entity.id.value,
        name: entity.name,
        parentId: entity.parentId?.value,
        path: entity.path,
        level: entity.level,
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
