import { describe, expect, it, vi } from 'vitest';
import { ConflictError, Uuid } from '@hcm/shared-kernel';
import { BaseRepository } from './base-repository.js';
import { runWithTenant } from '../connection/tenant-context.js';

class TestRepository extends BaseRepository<'compensation_plans', Record<string, unknown>> {
  protected readonly tableName = 'compensation_plans' as const;
}

function fakeDb(options: { updateResult: Record<string, unknown> | undefined; findResult?: Record<string, unknown> | undefined }) {
  const updateWhereCalls: Array<[string, string, unknown]> = [];
  const updateBuilder = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn((...args: [string, string, unknown]) => {
      updateWhereCalls.push(args);
      return updateBuilder;
    }),
    returningAll: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(options.updateResult),
  };
  const selectBuilder = {
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(options.findResult),
  };
  const db = {
    updateTable: vi.fn(() => updateBuilder),
    selectFrom: vi.fn(() => selectBuilder),
  };
  return { db: db as never, updateWhereCalls, updateBuilder, selectBuilder };
}

const tenantId = Uuid.generate();
const rowId = Uuid.generate();

describe('BaseRepository.update optimistic-concurrency guard', () => {
  it('writes without a version predicate when expectedVersion is omitted (unchanged behavior)', async () => {
    const { db, updateWhereCalls } = fakeDb({ updateResult: { id: rowId.value, aggregate_version: 3 } });
    const repo = new TestRepository(db);

    await runWithTenant(tenantId, () => repo.update(rowId, { status: 'ACTIVE' } as never));

    expect(updateWhereCalls).toEqual([
      ['id', '=', rowId.value],
      ['tenant_id', '=', tenantId.value],
    ]);
  });

  it('adds an aggregate_version predicate when expectedVersion is provided', async () => {
    const { db, updateWhereCalls } = fakeDb({ updateResult: { id: rowId.value, aggregate_version: 3 } });
    const repo = new TestRepository(db);

    await runWithTenant(tenantId, () => repo.update(rowId, { status: 'ACTIVE' } as never, { expectedVersion: 2 }));

    expect(updateWhereCalls).toEqual([
      ['id', '=', rowId.value],
      ['tenant_id', '=', tenantId.value],
      ['aggregate_version', '=', 2],
    ]);
  });

  it('throws ConflictError instead of silently no-op-ing when a concurrent write already moved the version', async () => {
    // The guarded UPDATE matched no row (someone else's write already changed
    // aggregate_version), but the row still exists under the id/tenant.
    const { db } = fakeDb({ updateResult: undefined, findResult: { id: rowId.value, aggregate_version: 3 } });
    const repo = new TestRepository(db);

    await expect(
      runWithTenant(tenantId, () => repo.update(rowId, { status: 'ACTIVE' } as never, { expectedVersion: 2 })),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('returns undefined (not-found), not a ConflictError, when the row genuinely does not exist', async () => {
    const { db } = fakeDb({ updateResult: undefined, findResult: undefined });
    const repo = new TestRepository(db);

    const result = await runWithTenant(tenantId, () => repo.update(rowId, { status: 'ACTIVE' } as never, { expectedVersion: 2 }));

    expect(result).toBeUndefined();
  });
});
