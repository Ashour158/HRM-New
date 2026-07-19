import { describe, expect, it, vi } from 'vitest';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';
import { OpenHrServiceCaseHandler } from './open-hr-service-case.handler.js';

const tenantId = Uuid.generate();
const actorId = Uuid.generate();
const catalogItemId = Uuid.generate();
const requesterWorkerId = Uuid.generate();

function command(payload: unknown): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName: 'OpenHrServiceCase',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['EMPLOYEE'],
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

function buildHandler(catalogItem: unknown) {
  const saved: { value?: unknown } = {};
  const repo = { save: vi.fn(async (entity: unknown) => { saved.value = entity; }) };
  const catalogItemRepo = { findById: vi.fn().mockResolvedValue(catalogItem) };
  const handler = new OpenHrServiceCaseHandler(
    repo as never,
    catalogItemRepo as never,
    new FsmFramework(),
    new HrServiceDeliveryEventsPublisher(),
  );
  return { handler, repo, catalogItemRepo, saved };
}

describe('OpenHrServiceCaseHandler catalog linkage', () => {
  it('auto-derives the SLA deadline and owner group from the linked catalog item', async () => {
    const { handler, catalogItemRepo, saved } = buildHandler({
      id: catalogItemId,
      slaHours: 24,
      category: 'Payroll & Reward',
      defaultOwnerGroup: 'Payroll Escalations',
    });

    const before = Date.now();
    await handler.handle(command({
      caseNumber: 'HR-2026-0001',
      requesterWorkerId: requesterWorkerId.value,
      caseType: 'PAYROLL_HELP',
      priority: 'HIGH',
      description: 'Payslip deduction looks wrong.',
      catalogItemId: catalogItemId.value,
    }));

    expect(catalogItemRepo.findById).toHaveBeenCalledWith(catalogItemId);
    const savedCase = saved.value as { catalogItemId?: Uuid; ownerGroup?: string; slaDeadline?: Date };
    expect(savedCase.catalogItemId?.value).toBe(catalogItemId.value);
    expect(savedCase.ownerGroup).toBe('Payroll Escalations');
    expect(savedCase.slaDeadline).toBeInstanceOf(Date);
    expect(savedCase.slaDeadline!.getTime() - before).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
  });

  it('falls back to the catalog item category as owner group when no default is configured', async () => {
    const { handler, saved } = buildHandler({
      id: catalogItemId,
      slaHours: 48,
      category: 'Benefits',
    });

    await handler.handle(command({
      caseNumber: 'HR-2026-0002',
      requesterWorkerId: requesterWorkerId.value,
      caseType: 'BENEFITS_SUPPORT',
      priority: 'MEDIUM',
      description: 'Need help with enrollment.',
      catalogItemId: catalogItemId.value,
    }));

    const savedCase = saved.value as { ownerGroup?: string };
    expect(savedCase.ownerGroup).toBe('Benefits');
  });

  it('respects an explicit SLA deadline and owner group override instead of deriving them', async () => {
    const explicitDeadline = new Date('2026-12-31T00:00:00.000Z');
    const { handler, saved } = buildHandler({
      id: catalogItemId,
      slaHours: 24,
      category: 'Payroll',
    });

    await handler.handle(command({
      caseNumber: 'HR-2026-0003',
      requesterWorkerId: requesterWorkerId.value,
      caseType: 'PAYROLL_HELP',
      priority: 'HIGH',
      description: 'Need a manual override.',
      catalogItemId: catalogItemId.value,
      slaDeadline: explicitDeadline.toISOString(),
      ownerGroup: 'Manual Override Team',
    }));

    const savedCase = saved.value as { slaDeadline?: Date; ownerGroup?: string };
    expect(savedCase.slaDeadline?.toISOString()).toBe(explicitDeadline.toISOString());
    expect(savedCase.ownerGroup).toBe('Manual Override Team');
  });

  it('rejects opening a case against a catalog item that does not exist', async () => {
    const { handler } = buildHandler(undefined);

    await expect(handler.handle(command({
      caseNumber: 'HR-2026-0004',
      requesterWorkerId: requesterWorkerId.value,
      caseType: 'PAYROLL_HELP',
      priority: 'HIGH',
      description: 'Should fail.',
      catalogItemId: catalogItemId.value,
    }))).rejects.toThrow('HR service catalog item not found');
  });

  it('does not touch the catalog item repository when no catalogItemId is provided', async () => {
    const { handler, catalogItemRepo, saved } = buildHandler(undefined);

    await handler.handle(command({
      caseNumber: 'HR-2026-0005',
      requesterWorkerId: requesterWorkerId.value,
      caseType: 'PROFILE_DATA_CHANGE',
      priority: 'LOW',
      description: 'No catalog item linked.',
    }));

    expect(catalogItemRepo.findById).not.toHaveBeenCalled();
    const savedCase = saved.value as { catalogItemId?: Uuid; slaDeadline?: Date; ownerGroup?: string };
    expect(savedCase.catalogItemId).toBeUndefined();
    expect(savedCase.slaDeadline).toBeUndefined();
    expect(savedCase.ownerGroup).toBeUndefined();
  });
});
