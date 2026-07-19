import { describe, expect, it, vi } from 'vitest';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';
import { HrServiceCase } from '../aggregates/hr-service-case.aggregate.js';
import { ReassignHrServiceCaseHandler } from './reassign-hr-service-case.handler.js';

const tenantId = Uuid.generate();
const actorId = Uuid.generate();

function command(payload: unknown): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName: 'ReassignHrServiceCase',
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
      caseNumber: 'HR-2026-0010',
      requesterWorkerId: Uuid.generate(),
      caseType: 'PAYROLL_HELP',
      priority: 'MEDIUM',
      description: 'Reassignment handler wiring test.',
    },
    Uuid.generate(),
  );
}

describe('ReassignHrServiceCaseHandler', () => {
  it('reassigns the loaded case to the new agent and owner group', async () => {
    const serviceCase = openCase();
    const newAssignee = Uuid.generate();
    const repo = { findById: vi.fn().mockResolvedValue(serviceCase), save: vi.fn().mockResolvedValue(undefined) };
    const handler = new ReassignHrServiceCaseHandler(repo as never, new FsmFramework(), new HrServiceDeliveryEventsPublisher());

    const result = await handler.handle(command({ hrServiceCaseId: serviceCase.id, assignedTo: newAssignee.value, ownerGroup: 'Payroll Escalations' }));

    expect(result.success).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(serviceCase);
    expect(serviceCase.assignedTo?.value).toBe(newAssignee.value);
    expect(result.data).toMatchObject({ assignedTo: newAssignee.value, ownerGroup: 'Payroll Escalations' });
  });

  it('throws when the case does not exist', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(undefined), save: vi.fn() };
    const handler = new ReassignHrServiceCaseHandler(repo as never, new FsmFramework(), new HrServiceDeliveryEventsPublisher());

    await expect(handler.handle(command({ hrServiceCaseId: Uuid.generate(), assignedTo: Uuid.generate().value })))
      .rejects.toThrow('HR service case not found');
  });
});
