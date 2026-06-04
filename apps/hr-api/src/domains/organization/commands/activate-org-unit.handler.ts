import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { ActivateOrgUnitPayload } from '@hcm/command-contracts';
import { OrgUnitRepository } from '../repositories/org-unit.repository.js';
import { OrgUnitFsm } from '../fsm/org-unit.fsm.js';

/**
 * Command handler for activating an OrgUnit.
 */
@Injectable()
@CommandHandler('ActivateOrgUnit')
export class ActivateOrgUnitHandler implements ICommandHandler {
  commandName = 'ActivateOrgUnit' as const;

  constructor(
    private readonly repo: OrgUnitRepository,
    private readonly fsm: OrgUnitFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ActivateOrgUnitPayload;
    const entity = await this.repo.findById(payload.orgUnitId);
    if (!entity) {
      throw new Error('OrgUnit not found');
    }

    entity.activate(command.correlationId);
    await this.repo.save(entity);
    const eventsEmitted = entity.domainEvents.map((e) => e.eventName);

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
