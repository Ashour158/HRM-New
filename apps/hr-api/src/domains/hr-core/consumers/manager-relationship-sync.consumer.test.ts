/**
 * Coverage for the WorkerProfile.managerId <-> organization.ManagerRelationship
 * drift fix.
 *
 * `POST /organization/manager-relationships` (AssignManagerHandler /
 * EndManagerRelationshipHandler) only mutates the `ManagerRelationship`
 * aggregate; it does not touch `WorkerProfile.managerId`, which a wide range
 * of other domains read directly (absence/leave approval routing,
 * performance review peer/manager detection, time & attendance manager
 * scoping, "my team" listings, IAM/notification recipient resolution). This
 * consumer keeps `WorkerProfile.managerId` in sync by reacting to
 * ManagerRelationship domain events, regardless of which endpoint or saga
 * triggered them.
 */
import { describe, expect, it, vi } from 'vitest';
import { Uuid, Email } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { ManagerRelationshipSyncConsumer } from './manager-relationship-sync.consumer.js';
import { WorkerProfile } from '../aggregates/worker-profile.aggregate.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const eventId = new Uuid('00000000-0000-0000-0000-000000000002');
const aggregateId = new Uuid('00000000-0000-0000-0000-000000000003');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000004');
const workerId = '00000000-0000-0000-0000-000000000102';
const oldManagerId = '00000000-0000-0000-0000-000000000201';
const newManagerId = '00000000-0000-0000-0000-000000000202';

function worker(managerId?: string): WorkerProfile {
  return new WorkerProfile({
    id: new Uuid(workerId),
    tenantId,
    employeeNumber: 'EMP-001',
    status: 'ACTIVE',
    firstName: 'Amina',
    lastName: 'Nour',
    email: new Email('amina.nour@example.com'),
    hireDate: new Date('2024-01-01'),
    employmentType: 'FULL_TIME',
    managerId: managerId ? new Uuid(managerId) : undefined,
  });
}

function buildConsumer(existingWorker: WorkerProfile | undefined) {
  const savedWorkers: WorkerProfile[] = [];
  const workerRepo = {
    findByIdForTenant: vi.fn().mockResolvedValue(existingWorker),
    save: vi.fn(async (w: WorkerProfile) => {
      savedWorkers.push(w);
    }),
  };
  const consumer = new ManagerRelationshipSyncConsumer(
    { subscribe: vi.fn() } as never,
    { consume: vi.fn(), registerReplayHandler: vi.fn() } as never,
    workerRepo as never,
  );
  const handle = (event: HrEventEnvelope<unknown>) =>
    (consumer as unknown as { handle(event: HrEventEnvelope<unknown>): Promise<void> }).handle(event);
  return { workerRepo, savedWorkers, handle };
}

function event(eventName: string, payload: Record<string, unknown>): HrEventEnvelope<unknown> {
  return {
    eventId,
    eventName,
    eventSchemaVersion: 1,
    tenantId,
    aggregateType: 'ManagerRelationship',
    aggregateId,
    payload,
    metadata: {
      correlationId,
      requestHash: 'test-request',
      clientType: 'SYSTEM',
    },
    privacy: {
      privacyLevel: 'INTERNAL',
      dataClasses: [],
      retentionClass: 'OPERATIONAL',
      crossBorderRestricted: false,
    },
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    version: 1,
  } as unknown as HrEventEnvelope<unknown>;
}

describe('ManagerRelationshipSyncConsumer', () => {
  it('sets WorkerProfile.managerId when a ManagerRelationship is created', async () => {
    const { workerRepo, savedWorkers, handle } = buildConsumer(worker(undefined));

    await handle(event('ManagerRelationshipCreated', {
      id: Uuid.generate().value,
      workerId,
      managerId: newManagerId,
      status: 'DRAFT',
    }));

    expect(workerRepo.save).toHaveBeenCalledTimes(1);
    expect(savedWorkers[0].managerId?.value).toBe(newManagerId);
  });

  it('updates WorkerProfile.managerId on ManagerRelationshipActivated when it points at a different manager', async () => {
    const { workerRepo, savedWorkers, handle } = buildConsumer(worker(oldManagerId));

    await handle(event('ManagerRelationshipActivated', {
      id: Uuid.generate().value,
      workerId,
      managerId: newManagerId,
      status: 'ACTIVE',
    }));

    expect(workerRepo.save).toHaveBeenCalledTimes(1);
    expect(savedWorkers[0].managerId?.value).toBe(newManagerId);
  });

  it('is a no-op when the worker already points at the manager from the event', async () => {
    const { workerRepo, handle } = buildConsumer(worker(newManagerId));

    await handle(event('ManagerRelationshipCreated', {
      id: Uuid.generate().value,
      workerId,
      managerId: newManagerId,
      status: 'DRAFT',
    }));

    expect(workerRepo.save).not.toHaveBeenCalled();
  });

  it('clears WorkerProfile.managerId when the relationship representing the current manager ends', async () => {
    const { workerRepo, savedWorkers, handle } = buildConsumer(worker(oldManagerId));

    await handle(event('ManagerRelationshipEnded', {
      id: Uuid.generate().value,
      workerId,
      managerId: oldManagerId,
      endDate: '2026-06-01',
      status: 'ENDED',
    }));

    expect(workerRepo.save).toHaveBeenCalledTimes(1);
    expect(savedWorkers[0].managerId).toBeUndefined();
  });

  it('does not clobber a newer manager assignment when an older relationship-ended event arrives out of order', async () => {
    // Worker was already re-pointed at newManagerId; a late/replayed "ended"
    // event for the OLD relationship must not blow away the new assignment.
    const { workerRepo, handle } = buildConsumer(worker(newManagerId));

    await handle(event('ManagerRelationshipEnded', {
      id: Uuid.generate().value,
      workerId,
      managerId: oldManagerId,
      endDate: '2026-06-01',
      status: 'ENDED',
    }));

    expect(workerRepo.save).not.toHaveBeenCalled();
  });

  it('ignores unrelated ManagerRelationship events', async () => {
    const { workerRepo, handle } = buildConsumer(worker(oldManagerId));

    await handle(event('ManagerRelationshipUpdated', {
      id: Uuid.generate().value,
      workerId,
      isPrimary: false,
    }));

    expect(workerRepo.save).not.toHaveBeenCalled();
  });

  it('is a no-op when the worker cannot be found', async () => {
    const { workerRepo, handle } = buildConsumer(undefined);

    await handle(event('ManagerRelationshipCreated', {
      id: Uuid.generate().value,
      workerId,
      managerId: newManagerId,
      status: 'DRAFT',
    }));

    expect(workerRepo.save).not.toHaveBeenCalled();
  });
});
