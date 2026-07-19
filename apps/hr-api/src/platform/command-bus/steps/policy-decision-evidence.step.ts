import type { Transaction } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { isUuid } from '../command-bus.utils.js';
import type { CommandPolicyDecisionEvidence } from './types.js';

/**
 * Writes the Policy Center evidence-ledger row for a command's applied-policy
 * decision. Bootstrap/system-seeded revision ids (non-UUID) are intentionally
 * NOT written here — they stay in the command/audit payload only, since there
 * is no real FK row for them to reference.
 */
export class PolicyDecisionEvidenceStep {
  async write(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>,
    evidence?: CommandPolicyDecisionEvidence,
  ): Promise<void> {
    if (!evidence?.policyRevisionId || !isUuid(evidence.policyRevisionId)) return;

    const dynamicTx = tx as unknown as {
      insertInto: (table: string) => {
        values: (row: Record<string, unknown>) => {
          execute: () => Promise<unknown>;
        };
      };
    };
    await dynamicTx
      .insertInto('hr_platform.admin_policy_decision_evidence')
      .values({
        id: Uuid.generate().value,
        tenant_id: command.tenantId.value,
        policy_revision_id: evidence.policyRevisionId,
        service_area: evidence.serviceArea,
        engine_name: evidence.engineName,
        engine_version: evidence.engineVersion,
        scope_match: evidence.scopeMatch,
        decision: evidence.decision,
        reason: evidence.reason,
        subject_worker_id: evidence.subjectWorkerId ?? null,
        source_record_id: evidence.sourceRecordId ?? result.aggregateId.value,
        created_at: new Date(),
      })
      .execute();
  }
}
