import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Email, Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { WorkerProfile } from '../aggregates/worker-profile.aggregate.js';
import { TerminateWorkerHandler } from './terminate-worker.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000002');
const workerId = new Uuid('00000000-0000-0000-0000-000000000003');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000004');

function worker(overrides: Partial<{ status: 'ACTIVE' | 'SUSPENDED' }> = {}) {
  return new WorkerProfile({
    id: workerId,
    tenantId,
    employeeNumber: 'EMP-001',
    status: overrides.status ?? 'ACTIVE',
    firstName: 'Mona',
    lastName: 'Hassan',
    email: new Email('mona.hassan@example.com'),
    hireDate: new Date('2023-01-15'),
    employmentType: 'FULL_TIME',
    aggregateVersion: 3,
  });
}

function command(payload: Record<string, unknown>): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName: 'TerminateWorker',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['HR_ADMIN'],
      permissions: ['WORKER_TERMINATE'],
      mfaAuthenticated: true,
    },
    aggregateType: 'WorkerProfile',
    aggregateId: workerId,
    idempotencyKey: 'idem-1',
    correlationId,
    reason: 'Test termination',
    payload,
    metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
  } as unknown as HrCommandEnvelope<unknown>;
}

describe('TerminateWorkerHandler', () => {
  const workerRepo = { findByIdForTenant: vi.fn(), save: vi.fn() };
  const jobAssignmentRepo = { findByWorkerForTenant: vi.fn().mockResolvedValue([]), save: vi.fn() };
  const employmentRelationshipRepo = { findByWorkerForTenant: vi.fn().mockResolvedValue([]), save: vi.fn() };
  const fsm = { getAllowedActionsFromState: vi.fn().mockReturnValue([]) };
  const eventPublisher = { publishFromAggregate: vi.fn() };

  const handler = new TerminateWorkerHandler(
    workerRepo as never,
    jobAssignmentRepo as never,
    employmentRelationshipRepo as never,
    fsm as never,
    eventPublisher as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    jobAssignmentRepo.findByWorkerForTenant.mockResolvedValue([]);
    employmentRelationshipRepo.findByWorkerForTenant.mockResolvedValue([]);
  });

  it('emits a WorkerTerminated-payload-schema-conformant data object (workerId, terminatedBy, effectiveDate)', async () => {
    workerRepo.findByIdForTenant.mockResolvedValue(worker());

    const terminationDate = new Date('2026-08-01T00:00:00.000Z');
    const result = await handler.handle(command({
      workerId: workerId.value,
      terminationDate,
      reason: 'Employee resignation',
    }));

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      workerId: workerId.value,
      status: 'TERMINATED',
      terminatedBy: actorId.value,
      effectiveDate: terminationDate.toISOString(),
      reason: 'Employee resignation',
    });
    expect(workerRepo.save).toHaveBeenCalled();
  });

  it('surfaces the free-text termination reason unchanged for downstream categorization', async () => {
    workerRepo.findByIdForTenant.mockResolvedValue(worker());

    const result = await handler.handle(command({
      workerId: workerId.value,
      terminationDate: new Date('2026-09-15T00:00:00.000Z'),
      reason: 'Role eliminated due to redundancy',
    }));

    expect((result.data as { reason: string }).reason).toBe('Role eliminated due to redundancy');
  });
});
