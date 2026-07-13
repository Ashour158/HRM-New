import type { Transaction } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandPolicyDecisionEvidence } from './types.js';

/** Writes the HR audit-log record for a command, in the same transaction as the state write. */
export class AuditStep {
  async write(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>,
    policyDecisionEvidence?: CommandPolicyDecisionEvidence,
  ): Promise<Uuid> {
    const auditId = Uuid.generate();
    await tx
      .insertInto('audit_log')
      .values({
        id: auditId.value,
        tenant_id: command.tenantId.value,
        actor_type: command.actor.actorType,
        actor_id: command.actor.actorId.value,
        action: command.commandName,
        resource_type: command.aggregateType,
        resource_id: result.aggregateId.value,
        payload: {
          commandId: command.commandId.value,
          newState: result.newState,
          newVersion: result.newVersion,
          correlationId: command.correlationId.value,
          policyDecisionEvidence: policyDecisionEvidence ? [policyDecisionEvidence] : [],
        } as unknown as Record<string, never>,
        occurred_at: new Date(),
        correlation_id: command.correlationId.value,
      })
      .execute();
    return auditId;
  }
}
