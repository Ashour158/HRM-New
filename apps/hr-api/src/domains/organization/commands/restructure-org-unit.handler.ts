import { Injectable } from '@nestjs/common';
import { ConflictError, Uuid } from '@hcm/shared-kernel';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { RestructureOrgUnitPayload } from '@hcm/command-contracts';
import { OrgUnitRepository } from '../repositories/org-unit.repository.js';
import { OrgUnitFsm } from '../fsm/org-unit.fsm.js';
import { WorksCouncilConsultationGuard } from '../../global-hr/services/works-council-consultation-guard.service.js';

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
    private readonly worksCouncilGuard: WorksCouncilConsultationGuard,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RestructureOrgUnitPayload;
    const entity = await this.repo.findById(payload.orgUnitId);
    if (!entity) {
      throw new Error('OrgUnit not found');
    }

    // Compliance gate: a restructuring cannot proceed while the org unit's
    // legal entity has a required works-council consultation that has not
    // completed. Org units without a legal entity on file are not scoped by
    // this guard (see WorksCouncilConsultationGuard for the scoping rationale).
    if (entity.legalEntityId) {
      await this.worksCouncilGuard.assertNotBlocked(entity.legalEntityId, command.tenantId, 'restructure org unit');
    }

    if (payload.newParentOrgUnitId) {
      await this.assertNoCycle(entity.id, payload.newParentOrgUnitId);
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

  /**
   * Walks the ancestor chain starting at `newParentId` and rejects the
   * restructure if `orgUnitId` appears anywhere in it (or is the new parent
   * itself). Without this, OrgUnitRepository.findTree() can build a real JS
   * object-reference cycle in its `children` arrays, and res.json() on any
   * endpoint that serializes the org tree throws "Converting circular
   * structure to JSON" -- an unhandled 500 for the whole tenant, not just
   * the affected unit (HCM-P0-6). A visited set bounds the walk in case
   * pre-existing data already contains an unrelated cycle.
   */
  private async assertNoCycle(orgUnitId: Uuid, newParentId: Uuid): Promise<void> {
    if (newParentId.equals(orgUnitId)) {
      throw new ConflictError('An org unit cannot be restructured to be its own parent', {
        orgUnitId: orgUnitId.value,
        newParentOrgUnitId: newParentId.value,
      });
    }

    const visited = new Set<string>();
    let currentId: string | undefined = newParentId.value;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const current = await this.repo.findById(new Uuid(currentId));
      if (!current) break;
      if (current.parentId?.value === orgUnitId.value) {
        throw new ConflictError('Restructuring this org unit under the requested parent would create a cycle', {
          orgUnitId: orgUnitId.value,
          newParentOrgUnitId: newParentId.value,
        });
      }
      currentId = current.parentId?.value;
    }
  }
}
