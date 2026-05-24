import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { AssignManagerPayload } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import {
  MANAGER_ASSIGNED,
  type ManagerAssignedPayload,
} from '@hcm/event-schemas';
import { ManagerRelationshipRepository } from '../repositories/manager-relationship.repository.js';
import { ManagerRelationship } from '../aggregates/manager-relationship.aggregate.js';

/**
 * Command handler for assigning a manager to a worker.
 */
@Injectable()
@CommandHandler('AssignManager')
export class AssignManagerHandler implements ICommandHandler {
  commandName = 'AssignManager' as const;

  constructor(
    private readonly repo: ManagerRelationshipRepository,
    private readonly eventBus: EventBus,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as AssignManagerPayload;

    const entity = ManagerRelationship.create({
      id: Uuid.generate(),
      tenantId: command.tenantId,
      workerId: payload.workerId,
      managerId: payload.managerId,
      departmentId: payload.departmentId,
      correlationId: command.correlationId,
    });

    // Transition directly to ACTIVE (no separate activate endpoint)
    entity.activate(command.correlationId);

    await this.repo.save(entity);
    const eventsEmitted = entity.domainEvents.map((e) => e.eventName);
    await this.publishEvents(entity, command);

    return {
      success: true,
      data: {
        id: entity.id.value,
        workerId: entity.workerId.value,
        managerId: entity.managerId.value,
        status: entity.status,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.version,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }

  private async publishEvents(entity: ManagerRelationship, command: HrCommandEnvelope<unknown>): Promise<void> {
    const envelopes: HrEventEnvelope<unknown>[] = entity.domainEvents.map((event) => {
      const base = {
        eventId: Uuid.generate(),
        eventSchemaVersion: 1,
        tenantId: command.tenantId,
        aggregateType: 'ManagerRelationship',
        aggregateId: entity.id,
        metadata: {
          correlationId: command.correlationId,
          causationId: command.commandId,
          requestHash: command.metadata.requestHash,
          clientType: command.metadata.clientType,
        },
        privacy: createPrivacyForEvent('NONE', undefined, 'PROFILE'),
        occurredAt: new Date(),
        version: 1,
      };

      if (event.eventName === 'ManagerRelationshipCreated' || event.eventName === 'ManagerRelationshipActivated') {
        const payload: ManagerAssignedPayload = {
          assignmentId: entity.id,
          workerId: entity.workerId,
          managedOrgUnitId: entity.departmentId ?? entity.id,
          assignedBy: command.actor.actorId,
        };
        return { ...base, eventName: MANAGER_ASSIGNED, payload } as HrEventEnvelope<unknown>;
      }

      return { ...base, eventName: event.eventName, payload: event as unknown as Record<string, unknown> } as HrEventEnvelope<unknown>;
    });

    await this.eventBus.publishAll(envelopes);
    entity.clearDomainEvents();
  }
}
