import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { EndManagerRelationshipPayload } from '@hcm/command-contracts';
import { ManagerRelationshipRepository } from '../repositories/manager-relationship.repository.js';

/**
 * Command handler for ending a manager relationship.
 */
@Injectable()
@CommandHandler('EndManagerRelationship')
export class EndManagerRelationshipHandler implements ICommandHandler {
  commandName = 'EndManagerRelationship' as const;

  constructor(private readonly repo: ManagerRelationshipRepository) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as EndManagerRelationshipPayload;
    const entity = await this.repo.findById(payload.relationshipId);
    if (!entity) {
      throw new Error('ManagerRelationship not found');
    }

    entity.end(payload.endDate ?? new Date(), command.correlationId);
    await this.repo.save(entity);
    const eventsEmitted = entity.domainEvents.map((e) => e.eventName);

    return {
      success: true,
      data: {
        id: entity.id.value,
        workerId: entity.workerId.value,
        managerId: entity.managerId.value,
        endDate: entity.endDate?.toISOString(),
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
