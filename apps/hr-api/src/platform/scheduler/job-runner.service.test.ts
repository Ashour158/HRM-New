import { describe, expect, it, vi } from 'vitest';
import { getCurrentTenantId } from '@hcm/platform-core';
import { Uuid } from '@hcm/shared-kernel';
import type { CommandBus } from '../command-bus/command-bus.js';
import { ObservabilityMetricsService } from '../../observability/observability-metrics.service.js';
import type { StructuredLoggerService } from '../../observability/structured-logger.service.js';
import { JobRunner } from './job-runner.service.js';
import type {
  ActiveTenant,
  ScheduledJob,
  SchedulerJobRunRecord,
  SchedulerJobRunRepositoryPort,
  SchedulerJobScheduleOverride,
  SchedulerJobScheduleRepositoryPort,
} from './scheduled-job.js';
import { SchedulerJobRunRepository } from './scheduler-job-run.repository.js';
import { SchedulerJobScheduleRepository } from './scheduler-job-schedule.repository.js';
import { ScheduledJobRegistry } from './scheduled-job.registry.js';
import { SystemActorFactory } from './system-actor.factory.js';
import { TenantDirectoryService } from './tenant-directory.service.js';

const tenantOne = new Uuid('00000000-0000-4000-8000-000000000001');
const tenantTwo = new Uuid('00000000-0000-4000-8000-000000000002');
const tenantThree = new Uuid('00000000-0000-4000-8000-000000000003');
const aggregateId = new Uuid('00000000-0000-4000-8000-000000000101');

function activeTenants(...tenantIds: Uuid[]): ActiveTenant[] {
  return tenantIds.map((tenantId) => ({ tenantId, timezone: 'UTC' }));
}

function buildRunner(input: {
  job: ScheduledJob;
  tenants?: ActiveTenant[];
  runRepository?: FakeRunRepository;
  scheduleRepository?: FakeScheduleRepository;
  commandBus?: Partial<CommandBus>;
}) {
  const commandBus = {
    execute: vi.fn(async () => ({ success: true })),
    ...(input.commandBus ?? {}),
  } as unknown as CommandBus;
  const runRepository = input.runRepository ?? new FakeRunRepository();
  const scheduleRepository = input.scheduleRepository ?? new FakeScheduleRepository();
  const tenantDirectory = {
    listActiveTenants: vi.fn(async () => input.tenants ?? activeTenants(tenantOne)),
  } as unknown as TenantDirectoryService;
  const logger = {
    info: vi.fn(),
  } as unknown as StructuredLoggerService;
  const metrics = new ObservabilityMetricsService();
  const runner = new JobRunner(
    new ScheduledJobRegistry([input.job]),
    tenantDirectory,
    runRepository as unknown as SchedulerJobRunRepository,
    scheduleRepository as unknown as SchedulerJobScheduleRepository,
    new SystemActorFactory(),
    commandBus,
    metrics,
    logger,
  );
  return { runner, commandBus, runRepository, scheduleRepository, metrics, logger };
}

describe('JobRunner', () => {
  it('runs a fake job across tenants inside each tenant context', async () => {
    const tenantContexts: string[] = [];
    const commandContexts: string[] = [];
    const job: ScheduledJob = {
      name: 'absence-accrual-close',
      cron: '* * * * *',
      permissions: ['ABSENCE_ACCRUAL_CLOSE'],
      async runForTenant(ctx) {
        tenantContexts.push(getCurrentTenantId()?.value ?? 'missing');
        await ctx.runCommand({
          commandName: 'CloseAbsenceAccrualBalance',
          aggregateType: 'AbsenceAccrualBalance',
          aggregateId,
          payload: { balanceId: aggregateId.value },
        });
        return { itemsProcessed: 1 };
      },
    };
    const { runner, commandBus } = buildRunner({
      job,
      tenants: activeTenants(tenantOne, tenantTwo, tenantThree),
      commandBus: {
        execute: vi.fn(async () => {
          commandContexts.push(getCurrentTenantId()?.value ?? 'missing');
          return { success: true };
        }),
      },
    });

    const result = await runner.runJobAcrossTenants(job.name, new Date('2026-06-13T10:00:00.000Z'));

    expect(result.tenants.map((tenant) => tenant.status)).toEqual(['SUCCEEDED', 'SUCCEEDED', 'SUCCEEDED']);
    expect(tenantContexts).toEqual([tenantOne.value, tenantTwo.value, tenantThree.value]);
    expect(commandContexts).toEqual([tenantOne.value, tenantTwo.value, tenantThree.value]);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      actor: expect.objectContaining({
        actorType: 'SYSTEM',
        roles: ['SYSTEM_SCHEDULER'],
        permissions: expect.arrayContaining(['SCHEDULER_RUN', 'ABSENCE_ACCRUAL_CLOSE']),
      }),
      metadata: expect.objectContaining({ clientType: 'SYSTEM_SCHEDULER' }),
      reason: job.name,
    }));
  });

  it('skips a second run with the same tenant/job/period key', async () => {
    let processed = 0;
    const job: ScheduledJob = {
      name: 'leave-expiry-recalc',
      cron: '* * * * *',
      async runForTenant() {
        processed += 1;
        return { itemsProcessed: 1 };
      },
    };
    const runRepository = new FakeRunRepository();
    const { runner } = buildRunner({ job, runRepository });
    const now = new Date('2026-06-13T10:01:00.000Z');

    const first = await runner.runJobAcrossTenants(job.name, now);
    const second = await runner.runJobAcrossTenants(job.name, now);

    expect(first.tenants[0]?.status).toBe('SUCCEEDED');
    expect(second.tenants[0]?.status).toBe('SKIPPED');
    expect(second.tenants[0]?.error).toBe('ALREADY_SUCCEEDED');
    expect(processed).toBe(1);
  });

  it('allows a failed run to retry for the same tenant/job/period key', async () => {
    let attempts = 0;
    const job: ScheduledJob = {
      name: 'attendance-anomaly-alert',
      cron: '* * * * *',
      async runForTenant() {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('temporary reporting outage');
        }
        return { itemsProcessed: 3 };
      },
    };
    const runRepository = new FakeRunRepository();
    const { runner } = buildRunner({ job, runRepository });
    const now = new Date('2026-06-13T10:01:00.000Z');

    const first = await runner.runJobAcrossTenants(job.name, now);
    const second = await runner.runJobAcrossTenants(job.name, now);

    expect(first.tenants[0]?.status).toBe('FAILED');
    expect(second.tenants[0]?.status).toBe('SUCCEEDED');
    expect(second.tenants[0]?.itemsProcessed).toBe(3);
    expect(attempts).toBe(2);
  });

  it('does not double-process concurrent runners for the same tenant/job/period', async () => {
    let processed = 0;
    const job: ScheduledJob = {
      name: 'attendance-ledger-close',
      cron: '* * * * *',
      async runForTenant() {
        processed += 1;
        await sleep(25);
        return { itemsProcessed: 1 };
      },
    };
    const runRepository = new FakeRunRepository();
    const first = buildRunner({ job, runRepository });
    const second = buildRunner({ job, runRepository });
    const now = new Date('2026-06-13T10:02:00.000Z');

    const results = await Promise.all([
      first.runner.runJobAcrossTenants(job.name, now),
      second.runner.runJobAcrossTenants(job.name, now),
    ]);

    expect(processed).toBe(1);
    expect(results.flatMap((result) => result.tenants.map((tenant) => tenant.status)).sort()).toEqual(['SKIPPED', 'SUCCEEDED']);
  });

  it('isolates failures so one tenant does not abort the next tenant', async () => {
    const job: ScheduledJob = {
      name: 'benefits-window-reminder',
      cron: '* * * * *',
      async runForTenant(ctx) {
        if (ctx.tenantId.value === tenantTwo.value) {
          throw new Error('carrier feed unavailable');
        }
        return { itemsProcessed: 2 };
      },
    };
    const { runner, runRepository } = buildRunner({
      job,
      tenants: activeTenants(tenantOne, tenantTwo, tenantThree),
    });

    const result = await runner.runJobAcrossTenants(job.name, new Date('2026-06-13T10:03:00.000Z'));

    expect(result.tenants.map((tenant) => tenant.status)).toEqual(['SUCCEEDED', 'FAILED', 'SUCCEEDED']);
    expect(result.tenants[1]?.error).toBe('carrier feed unavailable');
    expect(runRepository.failedRuns).toHaveLength(1);
    expect(runRepository.succeededRuns).toHaveLength(2);
  });

  it('honors tenant schedule overrides and skips disabled jobs', async () => {
    const processedTenants: string[] = [];
    const job: ScheduledJob = {
      name: 'payroll-input-freeze',
      cron: '0 0 * * *',
      async runForTenant(ctx) {
        processedTenants.push(ctx.tenantId.value);
        return { itemsProcessed: 1 };
      },
    };
    const scheduleRepository = new FakeScheduleRepository([
      { tenantId: tenantOne, jobName: job.name, cron: '0 12 * * *', enabled: true },
      { tenantId: tenantTwo, jobName: job.name, cron: '0 12 * * *', enabled: false },
    ]);
    const runRepository = new FakeRunRepository();
    const { runner } = buildRunner({
      job,
      tenants: activeTenants(tenantOne, tenantTwo, tenantThree),
      scheduleRepository,
      runRepository,
    });

    const results = await runner.runDueJobs(new Date('2026-06-13T12:00:00.000Z'));

    expect(results).toHaveLength(1);
    expect(results[0]?.tenants).toHaveLength(1);
    expect(processedTenants).toEqual([tenantOne.value]);
    expect(runRepository.skippedRuns).toEqual([
      expect.objectContaining({ tenantId: tenantTwo.value, reason: 'disabled' }),
    ]);
  });
});

class FakeRunRepository implements SchedulerJobRunRepositoryPort {
  readonly runs = new Map<string, SchedulerJobRunRecord>();
  readonly succeededRuns: string[] = [];
  readonly failedRuns: string[] = [];
  readonly skippedRuns: Array<{ tenantId: string; reason: string }> = [];

  async tryStartRun(input: Parameters<SchedulerJobRunRepositoryPort['tryStartRun']>[0]) {
    const key = ledgerKey(input.tenantId, input.jobName, input.periodKey);
    const existing = this.runs.get(key);
    if (existing) {
      if (existing.status !== 'SUCCEEDED' && existing.status !== 'RUNNING') {
        existing.status = 'RUNNING';
        existing.itemsProcessed = 0;
        existing.error = undefined;
        existing.startedAt = input.startedAt;
        existing.finishedAt = undefined;
        return { acquired: true as const, run: existing };
      }
      return {
        acquired: false as const,
        run: existing,
        skipReason: existing.status === 'SUCCEEDED' ? 'ALREADY_SUCCEEDED' as const : 'RUNNING' as const,
      };
    }
    const run: SchedulerJobRunRecord = {
      id: Uuid.generate(),
      tenantId: input.tenantId,
      jobName: input.jobName,
      periodKey: input.periodKey,
      status: 'RUNNING',
      itemsProcessed: 0,
      startedAt: input.startedAt,
    };
    this.runs.set(key, run);
    return { acquired: true as const, run };
  }

  async markSucceeded(input: Parameters<SchedulerJobRunRepositoryPort['markSucceeded']>[0]) {
    const run = this.findRun(input.tenantId, input.runId);
    run.status = 'SUCCEEDED';
    run.itemsProcessed = input.itemsProcessed;
    run.finishedAt = input.finishedAt;
    this.succeededRuns.push(run.id.value);
  }

  async markFailed(input: Parameters<SchedulerJobRunRepositoryPort['markFailed']>[0]) {
    const run = this.findRun(input.tenantId, input.runId);
    run.status = 'FAILED';
    run.itemsProcessed = input.itemsProcessed;
    run.error = input.error;
    run.finishedAt = input.finishedAt;
    this.failedRuns.push(run.id.value);
  }

  async markSkipped(input: Parameters<SchedulerJobRunRepositoryPort['markSkipped']>[0]) {
    this.skippedRuns.push({ tenantId: input.tenantId.value, reason: input.reason });
  }

  private findRun(tenantId: Uuid, runId: Uuid): SchedulerJobRunRecord {
    const run = Array.from(this.runs.values()).find((candidate) =>
      candidate.tenantId.value === tenantId.value && candidate.id.value === runId.value,
    );
    if (!run) throw new Error(`Run ${runId.value} not found`);
    return run;
  }
}

class FakeScheduleRepository implements SchedulerJobScheduleRepositoryPort {
  private readonly overrides: SchedulerJobScheduleOverride[];

  constructor(overrides: SchedulerJobScheduleOverride[] = []) {
    this.overrides = overrides;
  }

  async getScheduleOverride(tenantId: Uuid, jobName: string) {
    return this.overrides.find((override) => override.tenantId.value === tenantId.value && override.jobName === jobName);
  }

  async upsertSchedule(input: Parameters<SchedulerJobScheduleRepositoryPort['upsertSchedule']>[0]) {
    const override = {
      tenantId: input.tenantId,
      jobName: input.jobName,
      cron: input.cron,
      enabled: input.enabled,
    };
    this.overrides.push(override);
    return override;
  }
}

function ledgerKey(tenantId: Uuid, jobName: string, periodKey: string): string {
  return `${tenantId.value}|${jobName}|${periodKey}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
