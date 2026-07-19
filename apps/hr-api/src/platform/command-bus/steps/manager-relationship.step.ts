import type { Kysely } from 'kysely';
import type { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { makeError } from '../command-bus-errors.js';
import { extractPayloadUuid, readUuidValue } from '../command-bus.utils.js';

/** Manager/HRBP relationship gate: a MANAGER actor may only target their own direct reports. */
export class ManagerRelationshipStep {
  constructor(private readonly db: Kysely<Database>) {}

  async evaluate(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (!command.actor.roles.includes('MANAGER')) return;
    if (command.actor.roles.some((role) => ['HR_ADMIN', 'HRBP', 'PAYROLL_ADMIN', 'SUPER_ADMIN'].includes(role))) return;
    const subjectWorkerId = command.subjectWorkerId ?? extractPayloadUuid(command.payload, 'workerId');
    if (!subjectWorkerId) return;

    const actorId = readUuidValue(command.actor.actorId);
    if (actorId && await this.isDirectManager(subjectWorkerId, actorId, command.tenantId)) {
      return;
    }
    const actorEmail = (command.actor as { email?: string }).email;
    if (actorEmail) {
      const manager = await this.db
        .selectFrom('workers')
        .select(['id'])
        .where('email', '=', actorEmail)
        .where('tenant_id', '=', command.tenantId.value)
        .executeTakeFirst();
      if (manager && await this.isDirectManager(subjectWorkerId, manager.id, command.tenantId)) {
        return;
      }
    }

    throw makeError(
      command,
      CommandPipelineStep.EVALUATE_MANAGER_HRBP_RELATIONSHIP,
      'MANAGER_RELATIONSHIP_DENIED',
      'Manager commands can only target direct reports',
      false,
    );
  }

  private async isDirectManager(subjectWorkerId: Uuid, managerId: string, tenantId: Uuid): Promise<boolean> {
    const report = await this.db
      .selectFrom('workers')
      .select(['id'])
      .where('id', '=', subjectWorkerId.value)
      .where('tenant_id', '=', tenantId.value)
      .where('manager_id', '=', managerId)
      .executeTakeFirst();
    return Boolean(report);
  }
}
