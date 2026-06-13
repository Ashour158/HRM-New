import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { buildSchedulerCommandEnvelope, SCHEDULER_SYSTEM_ACTOR_ID } from './scheduler-command-envelope.factory.js';

describe('buildSchedulerCommandEnvelope', () => {
  it('builds the same command envelope shape as controllers with a SYSTEM actor and deterministic idempotency key', () => {
    const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
    const aggregateId = new Uuid('00000000-0000-0000-0000-000000000701');
    const envelope = buildSchedulerCommandEnvelope({
      tenantId,
      jobKey: 'monthly-leave-carryover',
      periodKey: '2026-06',
      commandName: 'CarryOverAbsenceAccrualBalance',
      aggregateType: 'AbsenceAccrualBalance',
      aggregateId,
      payload: { balanceId: aggregateId },
      reason: 'Scheduled monthly leave carryover',
    });

    expect(envelope.commandSchemaVersion).toBe(1);
    expect(envelope.tenantId.value).toBe(tenantId.value);
    expect(envelope.actor).toEqual({
      actorType: 'SYSTEM',
      actorId: SCHEDULER_SYSTEM_ACTOR_ID,
      roles: ['SYSTEM_ACTOR'],
      permissions: ['ADMIN_SYSTEM'],
      mfaAuthenticated: true,
    });
    expect(envelope.aggregateId?.value).toBe(aggregateId.value);
    expect(envelope.idempotencyKey).toBe(`scheduler:${tenantId.value}:monthly-leave-carryover:2026-06`);
    expect(envelope.metadata).toEqual({
      requestHash: expect.any(String),
      clientType: 'SYSTEM',
    });
  });
});
