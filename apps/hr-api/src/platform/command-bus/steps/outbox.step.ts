import type { Transaction } from 'kysely';
import type { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { outboxMetadataForEvent } from '../../outbox-inbox/outbox-event-envelope.js';
import { inferEmployeeDataCategory, inferEventNameFromCommand, resolveSubjectWorkerId } from '../command-bus.utils.js';
import type { CommandPolicyDecisionEvidence } from './types.js';

/** Writes outbox_events rows for every event a command emitted, in the same transaction. */
export class OutboxStep {
  async write(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>,
    policyDecisionEvidence?: CommandPolicyDecisionEvidence,
  ): Promise<void> {
    const eventNames = result.eventsEmitted?.length
      ? result.eventsEmitted
      : [inferEventNameFromCommand(command.commandName, command.aggregateType)];

    for (const eventName of eventNames) {
      const subjectWorkerId = resolveSubjectWorkerId(command, result);
      const privacy = createPrivacyForEvent(
        command.metadata.hrDataSensitivity ?? 'NONE',
        subjectWorkerId?.value,
        inferEmployeeDataCategory(command.aggregateType),
      );
      const event: HrEventEnvelope<unknown> = {
        eventId: crypto.randomUUID() as unknown as Uuid,
        eventName,
        eventSchemaVersion: 1,
        tenantId: command.tenantId,
        aggregateType: command.aggregateType,
        aggregateId: result.aggregateId,
        payload: result.data,
        metadata: {
          correlationId: command.correlationId,
          causationId: command.commandId,
          sourceEventId: command.sourceEventId,
          processInstanceId: command.processInstanceId,
          requestHash: command.metadata.requestHash,
          clientType: command.metadata.clientType,
          dataResidencyRegion: command.metadata.dataResidencyRegion,
          hrDataSensitivity: command.metadata.hrDataSensitivity,
        },
        privacy,
        occurredAt: new Date(),
        version: result.newVersion,
      };
      const metadata = {
        ...outboxMetadataForEvent(event),
        ...(policyDecisionEvidence ? { policyDecisionEvidence: [policyDecisionEvidence] } : {}),
      };

      await tx
        .insertInto('outbox_events')
        .values({
          id: crypto.randomUUID(),
          tenant_id: command.tenantId.value,
          event_name: event.eventName,
          aggregate_type: event.aggregateType,
          aggregate_id: event.aggregateId.value,
          payload: event.payload as unknown as Record<string, never>,
          metadata: metadata as unknown as Record<string, never>,
          event_schema_version: event.eventSchemaVersion,
          event_topic: metadata.topic,
          envelope_version: event.version,
          correlation_id: event.metadata.correlationId.value,
          causation_id: event.metadata.causationId?.value ?? null,
          created_at: new Date().toISOString(),
          published_at: null,
          publish_attempt_count: 0,
        })
        .execute();
    }
  }
}
