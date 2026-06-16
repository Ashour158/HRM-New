import { describe, expect, it, vi } from 'vitest';
import { PersonalDataRetentionJob, type PersonalDataRetentionRepositoryPort } from './personal-data-retention-job.js';
import type { JobContext } from './scheduled-job.js';
import { Uuid, ConflictError } from '@hcm/shared-kernel';

describe('PersonalDataRetentionJob', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const actorId = new Uuid('00000000-0000-4000-8000-000000000004');
  const workerA = new Uuid('550e8400-e29b-41d4-a716-446655440001');
  const workerB = new Uuid('550e8400-e29b-41d4-a716-446655440002');

  const makeCtx = (runCommand: ReturnType<typeof vi.fn>): JobContext =>
    ({
      tenantId,
      timezone: 'UTC',
      periodKey: '2026-06-16',
      now: new Date('2026-06-16T01:00:00.000Z'),
      actor: { actorId } as JobContext['actor'],
      jobName: 'personal-data-retention',
      runCommand,
    }) as unknown as JobContext;

  it('dispatches one erasure command per worker with all expired categories', async () => {
    const repo: PersonalDataRetentionRepositoryPort = {
      findRecordsPastRetention: vi.fn().mockResolvedValue([
        { workerId: workerA, recordId: Uuid.generate(), dataCategory: 'BASIC' },
        { workerId: workerA, recordId: Uuid.generate(), dataCategory: 'CONTACT' },
        { workerId: workerB, recordId: Uuid.generate(), dataCategory: 'MEDICAL' },
      ]),
    };
    const runCommand = vi.fn().mockResolvedValue({});
    const job = new PersonalDataRetentionJob(repo);

    const outcome = await job.runForTenant(makeCtx(runCommand));

    expect(outcome.itemsProcessed).toBe(2);
    expect(runCommand).toHaveBeenCalledTimes(2);
    const aCall = runCommand.mock.calls.find((c) => c[0].payload.workerId.value === workerA.value);
    expect(aCall).toBeDefined();
    if (!aCall) throw new Error('Expected a runCommand call for workerA');
    expect(aCall[0].commandName).toBe('EraseWorkerPersonalData');
    expect([...aCall[0].payload.dataCategories].sort()).toEqual(['BASIC', 'CONTACT']);
  });

  it('records a skip and continues when a worker erasure is blocked', async () => {
    const repo: PersonalDataRetentionRepositoryPort = {
      findRecordsPastRetention: vi.fn().mockResolvedValue([
        { workerId: workerA, recordId: Uuid.generate(), dataCategory: 'BASIC' },
        { workerId: workerB, recordId: Uuid.generate(), dataCategory: 'BASIC' },
      ]),
    };
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new ConflictError('under an active legal hold'));
    const job = new PersonalDataRetentionJob(repo);

    const outcome = await job.runForTenant(makeCtx(runCommand));

    expect(outcome.itemsProcessed).toBe(1);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors?.[0]).toMatchObject({ code: 'RETENTION_SKIPPED' });
  });

  it('processes nothing when no records are past retention', async () => {
    const repo: PersonalDataRetentionRepositoryPort = {
      findRecordsPastRetention: vi.fn().mockResolvedValue([]),
    };
    const runCommand = vi.fn();
    const job = new PersonalDataRetentionJob(repo);

    const outcome = await job.runForTenant(makeCtx(runCommand));

    expect(outcome.itemsProcessed).toBe(0);
    expect(runCommand).not.toHaveBeenCalled();
  });
});
