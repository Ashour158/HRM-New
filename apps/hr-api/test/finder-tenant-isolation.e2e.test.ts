import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPool, runWithTenant } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { PerformanceReviewRepository } from '../src/domains/performance/repositories/performance-review.repository.js';
import { LearningAssignmentRepository } from '../src/domains/learning/repositories/learning-assignment.repository.js';
import { TimeClockEventRepository } from '../src/domains/time-attendance/repositories/time-clock-event.repository.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const TENANT_B = '00000000-0000-0000-0000-0000000000b2';

let dbReady = false;
let skipReason = '';
let suffix = '';
const cleanup: Array<{ table: string; id: string }> = [];

async function canReachDatabase(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    skipReason = 'DATABASE_URL is not set';
    return false;
  }
  try {
    await Promise.race([
      getPool().query('select 1'),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('database reachability timeout')), 2_000)),
    ]);
    return true;
  } catch (err) {
    skipReason = err instanceof Error ? err.message : String(err);
    return false;
  }
}

const tenantIt = (name: string, fn: () => Promise<void>, timeout = 30_000): void => {
  it(name, async () => {
    if (!dbReady) {
      console.warn(`[finder-tenant-isolation.e2e] skipped: ${skipReason}`);
      return;
    }
    await fn();
  }, timeout);
};

async function insertPerformanceReview(workerId: string, reviewCycleId: string, managerId: string): Promise<string> {
  const id = randomUUID();
  await getPool().query(
    `insert into hr_performance.performance_reviews (
      id, tenant_id, worker_id, review_cycle_id, manager_id, status, aggregate_version, created_at, updated_at
    ) values ($1, $2, $3, $4, $5, 'DRAFT', 0, now(), now())`,
    [id, TENANT_A, workerId, reviewCycleId, managerId],
  );
  cleanup.push({ table: 'hr_performance.performance_reviews', id });
  return id;
}

async function insertLearningCourse(courseId: string): Promise<void> {
  await getPool().query(
    `insert into hr_learning.learning_courses (
      id, tenant_id, title, content_type, status, aggregate_version, created_at, updated_at
    ) values ($1, $2, 'Finder Isolation Course', 'COURSE', 'PUBLISHED', 0, now(), now())`,
    [courseId, TENANT_A],
  );
  cleanup.push({ table: 'hr_learning.learning_courses', id: courseId });
}

async function insertLearningAssignment(workerId: string, courseId: string, assignedBy: string): Promise<string> {
  const id = randomUUID();
  // Satisfy the learning_assignments -> learning_courses FK before assigning.
  await insertLearningCourse(courseId);
  await getPool().query(
    `insert into hr_learning.learning_assignments (
      id, tenant_id, worker_id, course_id, assigned_by, assigned_at, status, aggregate_version, created_at, updated_at
    ) values ($1, $2, $3, $4, $5, now(), 'ASSIGNED', 0, now(), now())`,
    [id, TENANT_A, workerId, courseId, assignedBy],
  );
  cleanup.push({ table: 'hr_learning.learning_assignments', id });
  return id;
}

async function insertTimeClockEvent(workerId: string): Promise<string> {
  const id = randomUUID();
  await getPool().query(
    `insert into hr_time.time_clock_events (
      id, tenant_id, worker_id, event_type, timestamp, status, aggregate_version, created_at, updated_at
    ) values ($1, $2, $3, 'CLOCK_IN', now(), 'RECORDED', 0, now(), now())`,
    [id, TENANT_A, workerId],
  );
  cleanup.push({ table: 'hr_time.time_clock_events', id });
  return id;
}

beforeAll(async () => {
  dbReady = await canReachDatabase();
  suffix = Date.now().toString(36);
  if (!dbReady) return;
  await getPool().query(
    `insert into hr_platform.tenants (id, name, slug, status)
     values ($1, 'Finder Tenant Isolation B', $2, 'ACTIVE')
     on conflict (id) do update set status = excluded.status`,
    [TENANT_B, `finder-isolation-${suffix}`],
  );
});

afterAll(async () => {
  if (dbReady) {
    for (const row of cleanup.reverse()) {
      await getPool().query(`delete from ${row.table} where id = $1`, [row.id]).catch(() => undefined);
    }
    await getPool().query('delete from hr_platform.tenants where id = $1', [TENANT_B]).catch(() => undefined);
  }
});

describe.sequential('custom finder tenant isolation regressions', () => {
  tenantIt('performance review finders require tenant context and hide other-tenant rows', async () => {
    const repo = new PerformanceReviewRepository();
    const workerId = randomUUID();
    const reviewCycleId = randomUUID();
    const managerId = randomUUID();
    const rowId = await insertPerformanceReview(workerId, reviewCycleId, managerId);

    await expect(repo.findByWorker(new Uuid(workerId))).rejects.toThrow('Tenant context required');
    await runWithTenant(new Uuid(TENANT_B), async () => {
      await expect(repo.findByWorker(new Uuid(workerId))).resolves.toEqual([]);
      await expect(repo.findByReviewCycle(new Uuid(reviewCycleId))).resolves.toEqual([]);
      await expect(repo.findByManager(new Uuid(managerId))).resolves.toEqual([]);
    });
    await runWithTenant(new Uuid(TENANT_A), async () => {
      const rows = await repo.findByWorker(new Uuid(workerId));
      expect(rows.map((row) => row.id.value)).toContain(rowId);
    });
  });

  tenantIt('learning assignment finders require tenant context and hide other-tenant rows', async () => {
    const repo = new LearningAssignmentRepository();
    const workerId = randomUUID();
    const courseId = randomUUID();
    const assignedBy = randomUUID();
    const rowId = await insertLearningAssignment(workerId, courseId, assignedBy);

    await expect(repo.findByWorker(new Uuid(workerId))).rejects.toThrow('Tenant context required');
    await runWithTenant(new Uuid(TENANT_B), async () => {
      await expect(repo.findByWorker(new Uuid(workerId))).resolves.toEqual([]);
      await expect(repo.findByCourse(new Uuid(courseId))).resolves.toEqual([]);
    });
    await runWithTenant(new Uuid(TENANT_A), async () => {
      const rows = await repo.findByWorker(new Uuid(workerId));
      expect(rows.map((row) => row.id.value)).toContain(rowId);
    });
  });

  tenantIt('time clock event finders require tenant context and hide other-tenant rows', async () => {
    const repo = new TimeClockEventRepository();
    const workerId = randomUUID();
    const rowId = await insertTimeClockEvent(workerId);

    await expect(repo.findByWorker(new Uuid(workerId))).rejects.toThrow('Tenant context required');
    await runWithTenant(new Uuid(TENANT_B), async () => {
      await expect(repo.findByWorker(new Uuid(workerId))).resolves.toEqual([]);
      await expect(repo.findByWorkersBetween([new Uuid(workerId)], new Date(Date.now() - 60_000), new Date(Date.now() + 60_000))).resolves.toEqual([]);
    });
    await runWithTenant(new Uuid(TENANT_A), async () => {
      const rows = await repo.findByWorker(new Uuid(workerId));
      expect(rows.map((row) => row.id.value)).toContain(rowId);
    });
  });
});
