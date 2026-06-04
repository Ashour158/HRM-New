import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { AssignManagerPayload } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { ManagerRelationshipRepository } from '../repositories/manager-relationship.repository.js';
import { ManagerRelationship } from '../aggregates/manager-relationship.aggregate.js';

/**
 * Command handler for assigning a manager to a worker.
 */
@Injectable()
@CommandHandler('AssignManager')
export class AssignManagerHandler implements ICommandHandler {
  commandName = 'AssignManager' as const;

  constructor(private readonly repo: ManagerRelationshipRepository) {}

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
}
