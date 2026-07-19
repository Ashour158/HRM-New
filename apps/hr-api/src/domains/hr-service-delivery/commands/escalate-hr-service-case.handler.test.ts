import { describe, expect, it, vi } from 'vitest';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';
import { HrServiceCase } from '../aggregates/hr-service-case.aggregate.js';
import { EscalateHrServiceCaseHandler } from './escalate-hr-service-case.handler.js';

const tenantId = Uuid.generate();
const actorId = Uuid.generate();

function command(payload: unknown): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName: 'EscalateHrServiceCase',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['HR_ADMIN'],
      permissions: [],
      mfaAuthenticated: true,
    },
    aggregateType: 'HrServiceCase',
    idempotencyKey: Uuid.generate().value,
    correlationId: Uuid.generate(),
    reason: 'test',
    payload,
    metadata: {},
  } as HrCommandEnvelope<unknown>;
}

function openCase(): HrServiceCase {
  return HrServiceCase.open(
    {
      id: Uuid.generate(),
      tenantId,
      caseNumber: 'HR-2026-0009',
      requesterWorkerId: Uuid.generate(),
      caseType: 'PAYROLL_HELP',
      priority: 'HIGH',
      description: 'Escalation handler wiring test.',
    },
    Uuid.generate(),
  );
}

describe('EscalateHrServiceCaseHandler', () => {
  it('escalates the loaded case, persists it, and reports the new state', async () => {
    const serviceCase = openCase();
    const repo = { findById: vi.fn().mockResolvedValue(serviceCase), save: vi.fn().mockResolvedValue(undefined) };
    const handler = new EscalateHrServiceCaseHandler(repo as never, new FsmFramework(), new HrServiceDeliveryEventsPublisher());

    const result = await handler.handle(command({ hrServiceCaseId: serviceCase.id, escalationReason: 'Regulatory deadline at risk.' }));

    expect(result.success).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(serviceCase);
    expect(result.newState).toBe('ESCALATED');
    expect(result.data).toMatchObject({ escalationReason: 'Regulatory deadline at risk.' });
  });

  it('throws when the case does not exist', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(undefined), save: vi.fn() };
    const handler = new EscalateHrServiceCaseHandler(repo as never, new FsmFramework(), new HrServiceDeliveryEventsPublisher());

    await expect(handler.handle(command({ hrServiceCaseId: Uuid.generate(), escalationReason: 'Anything.' })))
      .rejects.toThrow('HR service case not found');
  });
});
