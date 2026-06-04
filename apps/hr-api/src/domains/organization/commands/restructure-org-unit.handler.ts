import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { RestructureOrgUnitPayload } from '@hcm/command-contracts';
import { OrgUnitRepository } from '../repositories/org-unit.repository.js';
import { OrgUnitFsm } from '../fsm/org-unit.fsm.js';

/**
 * Command handler for restructuring an OrgUnit.
 */
@Injectable()
@CommandHandler('RestructureOrgUnit')
export class RestructureOrgUnitHandler implements ICommandHandler {
  commandName = 'RestructureOrgUnit' as const;

  constructor(
    private readonly repo: OrgUnitRepository,
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
}
