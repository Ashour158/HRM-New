import type { Kysely } from 'kysely';
import type { Database } from '@hcm/database';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { makeError } from '../command-bus-errors.js';
import { extractPayloadUuid } from '../command-bus.utils.js';

/** Legal-hold gate: blocks mutation of a subject worker under an active legal hold. */
export class LegalPolicyStep {
  constructor(private readonly db: Kysely<Database>) {}

  async evaluate(command: HrCommandEnvelope<unknown>): Promise<void> {
    const subjectWorkerId = command.subjectWorkerId ?? extractPayloadUuid(command.payload, 'workerId');
    if (!subjectWorkerId) return;
    if (command.actor.roles.some((role) => ['LEGAL', 'COMPLIANCE_OFFICER', 'SUPER_ADMIN'].includes(role))) return;
    if (command.actor.breakGlassSessionId) return;

    const worker = await this.db
      .selectFrom('workers')
      .select(['id', 'legal_hold_status'])
      .where('tenant_id', '=', command.tenantId.value)
      .where('id', '=', subjectWorkerId.value)
      .executeTakeFirst();
    if (worker?.legal_hold_status === 'ACTIVE') {
      throw makeError(
        command,
        CommandPipelineStep.EVALUATE_LEGAL_HOLD_RETENTION_COUNTRY_LABOR_LAW_APPROVAL_STATE,
        'LEGAL_HOLD_BLOCKED',
        'Worker is under active legal hold; mutation requires Legal, Compliance, or break-glass authority',
        false,
      );
    }
  }
}
