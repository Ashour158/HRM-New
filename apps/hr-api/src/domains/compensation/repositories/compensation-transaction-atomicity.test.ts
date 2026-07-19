import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { runWithTenant, runWithTransaction } from '@hcm/database';
import { CompensationPlanRepository } from './compensation-plan.repository.js';
import { CompensationPlan } from '../aggregates/compensation-plan.aggregate.js';
import { createFakeTransactionalStore } from '../../../test-support/fake-transactional-db.js';

// Proves the Part 3 transaction-participation fix for the compensation
// domain. CompensationPlanRepository (like every compensation repository)
// extends BaseRepository, whose `save()` delegates to the inherited
// transaction-aware `insert`/`update` methods — this is the regression
// guard proving that path stays atomic with the rest of the command's
// writes (audit record, outbox event, idempotency key) across this refactor.

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');

function makeCompensationPlan(id: Uuid): CompensationPlan {
  return new CompensationPlan({
    id,
    tenantId,
    name: 'FY26 Base Salary Plan',
    planType: 'BASE_SALARY',
    currency: 'USD',
    status: 'DRAFT',
  });
}

describe('CompensationPlanRepository transaction atomicity', () => {
  it('rolls back the compensation plan write when a later step in the same command transaction fails', async () => {
    const store = createFakeTransactionalStore();
    const repo = new CompensationPlanRepository();
    (repo as unknown as { db: unknown }).db = store.autocommitDb;
    const plan = makeCompensationPlan(new Uuid('550e8400-e29b-41d4-a716-446655440041'));

    await runWithTenant(tenantId, async () => {
      await expect(
        store.transaction().execute((tx) => runWithTransaction(tx as never, async () => {
          await repo.save(plan);
          throw new Error('audit write failed');
        })),
      ).rejects.toThrow('audit write failed');
    });

    expect(store.committed.get('compensation_plans')?.has(plan.id.value)).toBeFalsy();
  });

  it('commits the compensation plan write when the whole command transaction succeeds', async () => {
    const store = createFakeTransactionalStore();
    const repo = new CompensationPlanRepository();
    (repo as unknown as { db: unknown }).db = store.autocommitDb;
    const plan = makeCompensationPlan(new Uuid('550e8400-e29b-41d4-a716-446655440042'));

    await runWithTenant(tenantId, async () => {
      await store.transaction().execute((tx) => runWithTransaction(tx as never, () => repo.save(plan)));
    });

    expect(store.committed.get('compensation_plans')?.get(plan.id.value)).toMatchObject({
      id: plan.id.value,
      name: 'FY26 Base Salary Plan',
    });
  });

  it('falls back to its own pooled connection outside any command transaction', async () => {
    const store = createFakeTransactionalStore();
    const repo = new CompensationPlanRepository();
    (repo as unknown as { db: unknown }).db = store.autocommitDb;
    const plan = makeCompensationPlan(new Uuid('550e8400-e29b-41d4-a716-446655440043'));

    await runWithTenant(tenantId, async () => {
      await repo.save(plan);
    });

    expect(store.committed.get('compensation_plans')?.has(plan.id.value)).toBe(true);
  });
});
