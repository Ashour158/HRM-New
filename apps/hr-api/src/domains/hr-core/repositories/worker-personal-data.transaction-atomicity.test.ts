import { describe, expect, it } from 'vitest';
import { Uuid, Email } from '@hcm/shared-kernel';
import { runWithTenant, runWithTransaction } from '@hcm/database';
import { WorkerRepository } from './worker.repository.js';
import { WorkerProfile } from '../aggregates/worker-profile.aggregate.js';
import { PersonalDataRecordRepository } from './personal-data-record.repository.js';
import { PersonalDataRecord } from '../aggregates/personal-data-record.aggregate.js';
import { createFakeTransactionalStore } from '../../../test-support/fake-transactional-db.js';

// Proves the Part 3 transaction-participation fix for hr-core's two
// flagship domains: WorkerRepository and PersonalDataRecordRepository both
// extend BaseRepository and rely on its `executor` getter (which resolves to
// the ambient command-bus transaction via `resolveTransactionAwareExecutor`
// when one is active). This is the same mechanism CommandBus.execute() uses
// to write the audit record, outbox event, transition ledger, and
// idempotency key inside `this.db.transaction().execute(...)` — so a
// repository write made via `runWithTransaction(tx, () => handler.handle())`
// now shares that same transaction instead of opening its own autocommit
// connection.
//
// The critical assertion in each "rolls back" test: when the surrounding
// transaction's callback throws (simulating a later pipeline step — e.g. the
// audit-record insert — failing), the repository's write must NOT appear in
// the durably "committed" store. If the repository still wrote through its
// own separate pooled connection (the pre-fix bug), the write would land in
// `committed` immediately regardless of the later throw, and this assertion
// would fail.

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');

function makeWorker(id: Uuid): WorkerProfile {
  return new WorkerProfile({
    id,
    tenantId,
    employeeNumber: `EMP-${id.value.slice(-4)}`,
    status: 'ACTIVE',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: new Email(`ada-${id.value.slice(-4)}@example.com`),
    hireDate: new Date('2026-01-01T00:00:00.000Z'),
    employmentType: 'FULL_TIME',
  });
}

function makePersonalDataRecord(id: Uuid, workerId: Uuid): PersonalDataRecord {
  return new PersonalDataRecord({
    id,
    tenantId,
    workerId,
    dataCategory: 'EMERGENCY_CONTACT',
    dataClassification: 'CONFIDENTIAL',
    payload: { name: 'Jane Doe', phone: '+1-555-0100' },
    consentStatus: 'GRANTED',
    state: 'ACTIVE',
  });
}

describe('WorkerRepository transaction atomicity', () => {
  it('rolls back the worker write when a later step in the same command transaction fails', async () => {
    const store = createFakeTransactionalStore();
    const repo = new WorkerRepository();
    (repo as unknown as { db: unknown }).db = store.autocommitDb;
    const worker = makeWorker(new Uuid('550e8400-e29b-41d4-a716-446655440001'));

    await runWithTenant(tenantId, async () => {
      await expect(
        store.transaction().execute((tx) => runWithTransaction(tx as never, async () => {
          await repo.save(worker);
          // Simulates the audit/outbox write step failing after the state write,
          // exactly as CommandBus.execute() would if stepWriteAuditRecord threw.
          throw new Error('audit write failed');
        })),
      ).rejects.toThrow('audit write failed');
    });

    expect(store.committed.get('workers')?.has(worker.id.value)).toBeFalsy();
  });

  it('commits the worker write when the whole command transaction succeeds', async () => {
    const store = createFakeTransactionalStore();
    const repo = new WorkerRepository();
    (repo as unknown as { db: unknown }).db = store.autocommitDb;
    const worker = makeWorker(new Uuid('550e8400-e29b-41d4-a716-446655440002'));

    await runWithTenant(tenantId, async () => {
      await store.transaction().execute((tx) => runWithTransaction(tx as never, () => repo.save(worker)));
    });

    expect(store.committed.get('workers')?.get(worker.id.value)).toMatchObject({
      id: worker.id.value,
      tenant_id: tenantId.value,
    });
  });

  it('falls back to its own pooled connection outside any command transaction (e.g. background jobs)', async () => {
    const store = createFakeTransactionalStore();
    const repo = new WorkerRepository();
    (repo as unknown as { db: unknown }).db = store.autocommitDb;
    const worker = makeWorker(new Uuid('550e8400-e29b-41d4-a716-446655440003'));

    await runWithTenant(tenantId, async () => {
      await repo.save(worker);
    });

    expect(store.committed.get('workers')?.has(worker.id.value)).toBe(true);
  });
});

describe('PersonalDataRecordRepository transaction atomicity', () => {
  it('rolls back the personal data record write when a later step in the same command transaction fails', async () => {
    const store = createFakeTransactionalStore();
    const repo = new PersonalDataRecordRepository();
    (repo as unknown as { db: unknown }).db = store.autocommitDb;
    const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440010');
    const record = makePersonalDataRecord(new Uuid('550e8400-e29b-41d4-a716-446655440011'), workerId);

    await runWithTenant(tenantId, async () => {
      await expect(
        store.transaction().execute((tx) => runWithTransaction(tx as never, async () => {
          await repo.save(record);
          throw new Error('outbox write failed');
        })),
      ).rejects.toThrow('outbox write failed');
    });

    expect(store.committed.get('personal_data_records')?.has(record.id.value)).toBeFalsy();
  });

  it('commits the personal data record write when the whole command transaction succeeds', async () => {
    const store = createFakeTransactionalStore();
    const repo = new PersonalDataRecordRepository();
    (repo as unknown as { db: unknown }).db = store.autocommitDb;
    const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440012');
    const record = makePersonalDataRecord(new Uuid('550e8400-e29b-41d4-a716-446655440013'), workerId);

    await runWithTenant(tenantId, async () => {
      await store.transaction().execute((tx) => runWithTransaction(tx as never, () => repo.save(record)));
    });

    expect(store.committed.get('personal_data_records')?.get(record.id.value)).toMatchObject({
      id: record.id.value,
      worker_id: workerId.value,
    });
  });
});
