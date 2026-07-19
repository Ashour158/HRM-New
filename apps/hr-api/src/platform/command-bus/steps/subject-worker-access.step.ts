import type { Kysely } from 'kysely';
import type { Database } from '@hcm/database';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { makeError } from '../command-bus-errors.js';

/**
 * Employee self-service guard: a non-privileged actor may only target
 * themselves (or, for managers, their own direct reports) as the command's
 * subject worker.
 */
export class SubjectWorkerAccessStep {
  constructor(private readonly db: Kysely<Database>) {}

  async validate(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (!command.subjectWorkerId) return;
    if (command.actor.actorType === 'SYSTEM' || command.actor.actorType === 'SERVICE_ACCOUNT' || command.actor.actorType === 'INTEGRATION') return;
    if (command.actor.roles.some((role) => ['HR_ADMIN', 'HRBP', 'PAYROLL_ADMIN', 'SUPER_ADMIN'].includes(role))) return;
    if (command.actor.actorId.value === command.subjectWorkerId.value) {
      const self = await this.db
        .selectFrom('workers')
        .select(['id'])
        .where('id', '=', command.subjectWorkerId.value)
        .where('tenant_id', '=', command.tenantId.value)
        .executeTakeFirst();
      if (self) return;
    }
    if (command.actor.roles.includes('MANAGER')) {
      const report = await this.db
        .selectFrom('workers')
        .select(['id'])
        .where('id', '=', command.subjectWorkerId.value)
        .where('tenant_id', '=', command.tenantId.value)
        .where('manager_id', '=', command.actor.actorId.value)
        .executeTakeFirst();
      if (report) return;
    }
    const actorEmail = (command.actor as { email?: string }).email;
    if (actorEmail && command.actor.roles.includes('MANAGER')) {
      const manager = await this.db
        .selectFrom('workers')
        .select(['id'])
        .where('email', '=', actorEmail)
        .where('tenant_id', '=', command.tenantId.value)
        .executeTakeFirst();
      if (manager) {
        const report = await this.db
          .selectFrom('workers')
          .select(['id'])
          .where('id', '=', command.subjectWorkerId.value)
          .where('tenant_id', '=', command.tenantId.value)
          .where('manager_id', '=', manager.id)
          .executeTakeFirst();
        if (report) return;
      }
    }
    if (actorEmail) {
      const self = await this.db
        .selectFrom('workers')
        .select(['id'])
        .where('id', '=', command.subjectWorkerId.value)
        .where('tenant_id', '=', command.tenantId.value)
        .where('email', '=', actorEmail)
        .executeTakeFirst();
      if (self) return;
    }

    throw makeError(
      command,
      CommandPipelineStep.VALIDATE_TENANT_SUBJECT_WORKER_ACCESS,
      'SUBJECT_WORKER_ACCESS_DENIED',
      'Employee self-service commands can only target the authenticated employee',
      false,
    );
  }
}
