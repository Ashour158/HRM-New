import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CreateOrgUnitPayload } from '@hcm/command-contracts';
import { OrgUnitRepository } from '../repositories/org-unit.repository.js';
import { OrgUnit } from '../aggregates/org-unit.aggregate.js';
import { OrgUnitFsm } from '../fsm/org-unit.fsm.js';

/**
 * Command handler for creating a new OrgUnit.
 */
@Injectable()
@CommandHandler('CreateOrgUnit')
export class CreateOrgUnitHandler implements ICommandHandler {
  commandName = 'CreateOrgUnit' as const;

  constructor(
    private readonly repo: OrgUnitRepository,
    private readonly fsm: OrgUnitFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateOrgUnitPayload;

    const entity = OrgUnit.create({
      id: payload.orgUnitId,
      tenantId: command.tenantId,
      name: payload.name,
      legalEntityId: payload.legalEntityId,
      parentId: payload.parentOrgUnitId,
      correlationId: command.correlationId,
    });

    await this.repo.save(entity);
    const eventsEmitted = entity.domainEvents.map((e) => e.eventName);

    return {
      success: true,
      data: {
        id: entity.id.value,
        name: entity.name,
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
