import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';

export const SCHEDULER_SYSTEM_ACTOR_ID = new Uuid('00000000-0000-4000-8000-000000000003');

export function schedulerIdempotencyKey(tenantId: Uuid, jobKey: string, periodKey: string): string {
  return `scheduler:${tenantId.value}:${jobKey}:${periodKey}`;
}

export function buildSchedulerCommandEnvelope<TPayload>(input: {
  tenantId: Uuid;
  jobKey: string;
  periodKey: string;
  commandName: string;
  aggregateType: string;
  aggregateId?: Uuid;
  expectedState?: string;
  expectedVersion?: number;
  subjectWorkerId?: Uuid;
  payload: TPayload;
  reason: string;
  correlationId?: Uuid;
}): HrCommandEnvelope<TPayload> {
  return {
    commandId: Uuid.generate(),
    commandName: input.commandName,
    commandSchemaVersion: 1,
    tenantId: input.tenantId,
    actor: {
      actorType: 'SYSTEM',
      actorId: SCHEDULER_SYSTEM_ACTOR_ID,
      roles: ['SYSTEM_ACTOR'],
      permissions: ['ADMIN_SYSTEM'],
      mfaAuthenticated: true,
    },
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    expectedState: input.expectedState,
    expectedVersion: input.expectedVersion,
    subjectWorkerId: input.subjectWorkerId,
    idempotencyKey: schedulerIdempotencyKey(input.tenantId, input.jobKey, input.periodKey),
    correlationId: input.correlationId ?? Uuid.generate(),
    reason: input.reason,
    payload: input.payload,
    metadata: {
      requestHash: computeRequestHash(input.payload),
      clientType: 'SYSTEM',
    },
  };
}
