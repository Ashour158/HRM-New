import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { runWithTenant, runWithTransaction } from '@hcm/database';
import { PayrollCycleRepository } from './payroll-cycle.repository.js';
import { PayrollCycle } from '../aggregates/payroll-cycle.aggregate.js';
import { PayrollExportJobRepository } from './payroll-export-job.repository.js';
import type { PayrollExportJobRecord } from '../services/payroll-artifact.service.js';
import { createFakeTransactionalStore } from '../../../test-support/fake-transactional-db.js';

// Proves the Part 3 transaction-participation fix for the payroll domain,
// covering both repository shapes that existed before this fix:
//
//  - PayrollCycleRepository extends BaseRepository and its `save()` already
//    delegated to the inherited transaction-aware `insert`/`update` — this
//    test is the regression guard for that path.
//  - PayrollExportJobRepository did NOT extend BaseRepository and wrote
//    directly through its own separately-pooled `this.db` — this was the
//    actual bug: an export job could get written and durably committed even
//    if the audit/outbox/idempotency write later in the same command failed.
//    It now uses the same `resolveTransactionAwareExecutor` mechanism via a
//    local `executor` getter.

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');

function makePayrollCycle(id: Uuid): PayrollCycle {
  return new PayrollCycle({
    id,
    tenantId,
    cycleName: 'July 2026 Monthly',
    payPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
    payPeriodEnd: new Date('2026-07-31T00:00:00.000Z'),
  });
}

function makeExportJobRecord(id: string): PayrollExportJobRecord {
  return {
    id,
    tenantId: tenantId.value,
    exportType: 'BANK_FILE',
    status: 'COMPLETED',
    purpose: 'Monthly bank transfer export',
    filters: {},
    rowCount: 12,
    fileName: 'export.csv',
    fileHash: 'deadbeef',
    dataClassification: 'HIGH_SENSITIVITY',
    createdAt: new Date('2026-07-31T00:00:00.000Z'),
    completedAt: new Date('2026-07-31T00:05:00.000Z'),
  };
}

describe('PayrollCycleRepository transaction atomicity', () => {
  it('rolls back the payroll cycle write when a later step in the same command transaction fails', async () => {
    const store = createFakeTransactionalStore();
    const repo = new PayrollCycleRepository();
    (repo as unknown as { db: unknown }).db = store.autocommitDb;
    const cycle = makePayrollCycle(new Uuid('550e8400-e29b-41d4-a716-446655440021'));

    await runWithTenant(tenantId, async () => {
      await expect(
        store.transaction().execute((tx) => runWithTransaction(tx as never, async () => {
          await repo.save(cycle);
          throw new Error('audit write failed');
        })),
      ).rejects.toThrow('audit write failed');
    });

    expect(store.committed.get('payroll_cycles')?.has(cycle.id.value)).toBeFalsy();
  });

  it('commits the payroll cycle write when the whole command transaction succeeds', async () => {
    const store = createFakeTransactionalStore();
    const repo = new PayrollCycleRepository();
    (repo as unknown as { db: unknown }).db = store.autocommitDb;
    const cycle = makePayrollCycle(new Uuid('550e8400-e29b-41d4-a716-446655440022'));

    await runWithTenant(tenantId, async () => {
      await store.transaction().execute((tx) => runWithTransaction(tx as never, () => repo.save(cycle)));
    });

    expect(store.committed.get('payroll_cycles')?.get(cycle.id.value)).toMatchObject({
      id: cycle.id.value,
      cycle_name: 'July 2026 Monthly',
    });
  });
});

describe('PayrollExportJobRepository transaction atomicity', () => {
  it('rolls back the export job write when a later step in the same command transaction fails', async () => {
    const store = createFakeTransactionalStore();
    const repo = new PayrollExportJobRepository();
    (repo as unknown as { db: unknown }).db = store.autocommitDb;
    const record = makeExportJobRecord('550e8400-e29b-41d4-a716-446655440031');

    await runWithTenant(tenantId, async () => {
      await expect(
        store.transaction().execute((tx) => runWithTransaction(tx as never, async () => {
          await repo.save(record);
          throw new Error('outbox write failed');
        })),
      ).rejects.toThrow('outbox write failed');
    });

    expect(store.committed.get('payroll_export_jobs')?.has(record.id)).toBeFalsy();
  });

  it('commits the export job write when the whole command transaction succeeds', async () => {
    const store = createFakeTransactionalStore();
    const repo = new PayrollExportJobRepository();
    (repo as unknown as { db: unknown }).db = store.autocommitDb;
    const record = makeExportJobRecord('550e8400-e29b-41d4-a716-446655440032');

    await runWithTenant(tenantId, async () => {
      await store.transaction().execute((tx) => runWithTransaction(tx as never, () => repo.save(record)));
    });

    expect(store.committed.get('payroll_export_jobs')?.get(record.id)).toMatchObject({
      id: record.id,
      tenant_id: tenantId.value,
    });
  });

  it('falls back to its own pooled connection outside any command transaction', async () => {
    const store = createFakeTransactionalStore();
    const repo = new PayrollExportJobRepository();
    (repo as unknown as { db: unknown }).db = store.autocommitDb;
    const record = makeExportJobRecord('550e8400-e29b-41d4-a716-446655440033');

    await repo.save(record);

    expect(store.committed.get('payroll_export_jobs')?.has(record.id)).toBe(true);
  });
});
