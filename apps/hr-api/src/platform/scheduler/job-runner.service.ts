import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { computeRequestHash, runWithTenant } from '@hcm/platform-core';
import { CommandBus } from '../command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { ObservabilityMetricsService } from '../../observability/observability-metrics.service.js';
import { StructuredLoggerService } from '../../observability/structured-logger.service.js';
import type { ActiveTenant, JobContext, JobOutcome, JobRunBatchResult, ScheduledJob, TenantJobRunResult } from './scheduled-job.js';
import { schedulerPeriodKey, isCronDue } from './scheduler-time.js';
import { SchedulerJobRunRepository } from './scheduler-job-run.repository.js';
import { SchedulerJobScheduleRepository } from './scheduler-job-schedule.repository.js';
import { ScheduledJobRegistry } from './scheduled-job.registry.js';
import { SystemActorFactory } from './system-actor.factory.js';
import { TenantDirectoryService } from './tenant-directory.service.js';

@Injectable()
export class JobRunner {
  constructor(
    private readonly registry: ScheduledJobRegistry,
    private readonly tenants: TenantDirectoryService,
    private readonly runRepository: SchedulerJobRunRepository,
    private readonly scheduleRepository: SchedulerJobScheduleRepository,
    private readonly systemActorFactory: SystemActorFactory,
    private readonly commandBus: CommandBus,
    private readonly metrics: ObservabilityMetricsService,
    private readonly logger: StructuredLoggerService,
  ) {}

  @Cron('* * * * *')
  async handleCronTick(): Promise<void> {
    await this.runDueJobs(new Date());
  }

  async runDueJobs(now = new Date()): Promise<JobRunBatchResult[]> {
    const results: JobRunBatchResult[] = [];
    for (const job of this.registry.list()) {
      const tenants = await this.tenants.listActiveTenants();
      const dueTenants: ActiveTenant[] = [];
      for (const tenant of tenants) {
        const schedule = await this.scheduleRepository.getScheduleOverride(tenant.tenantId, job.name);
        if (schedule && !schedule.enabled) {
          await this.recordSkipped(job, tenant, now, 'disabled');
          continue;
        }
        const cron = schedule?.cron ?? job.cron;
        if (isCronDue(cron, now, tenant.timezone)) {
          dueTenants.push(tenant);
        }
      }
      if (dueTenants.length > 0) {
        results.push(await this.runJobForTenants(job, dueTenants, now));
      }
    }
    return results;
  }

  async runJobAcrossTenants(jobName: string, now = new Date(), tenantId?: Uuid): Promise<JobRunBatchResult> {
    const job = this.registry.get(jobName);
    if (!job) {
      throw new Error(`Scheduled job "${jobName}" is not registered`);
    }
    const activeTenants = await this.tenants.listActiveTenants();
    const tenants = tenantId
      ? activeTenants.filter((tenant) => tenant.tenantId.value === tenantId.value)
      : activeTenants;
    return this.runJobForTenants(job, tenants, now);
  }

  private async runJobForTenants(job: ScheduledJob, tenants: ActiveTenant[], now: Date): Promise<JobRunBatchResult> {
    const results: TenantJobRunResult[] = [];
    for (const tenant of tenants) {
      results.push(await this.runJobForTenant(job, tenant, now));
    }
    return { jobName: job.name, tenants: results };
  }

  private async runJobForTenant(job: ScheduledJob, tenant: ActiveTenant, now: Date): Promise<TenantJobRunResult> {
    const periodKey = job.periodKey?.(now, tenant.timezone) ?? schedulerPeriodKey(now, tenant.timezone);
    const startedAt = new Date();
    const start = await this.runRepository.tryStartRun({
      tenantId: tenant.tenantId,
      jobName: job.name,
      periodKey,
      startedAt,
    });

    if (!start.acquired) {
      this.recordSkippedMetricsAndLog(job, tenant, periodKey, start.skipReason);
      return {
        tenantId: tenant.tenantId.value,
        jobName: job.name,
        periodKey,
        status: 'SKIPPED',
        itemsProcessed: 0,
        error: start.skipReason,
      };
    }

    const runId = start.run.id;
    try {
      const outcome = await runWithTenant(tenant.tenantId, async () => {
        const actor = this.systemActorFactory.createForJob(job.name, job.permissions);
        return job.runForTenant(this.buildContext(job, tenant, now, periodKey, actor));
      });
      if (hasErrors(outcome)) {
        const error = summarizeOutcomeErrors(outcome);
        await this.finishFailed(job, tenant, runId, periodKey, outcome.itemsProcessed, error, startedAt);
        return {
          tenantId: tenant.tenantId.value,
          jobName: job.name,
          periodKey,
          status: 'FAILED',
          itemsProcessed: outcome.itemsProcessed,
          error,
        };
      }
      await this.finishSucceeded(job, tenant, runId, periodKey, outcome.itemsProcessed, startedAt);
      return {
        tenantId: tenant.tenantId.value,
        jobName: job.name,
        periodKey,
        status: 'SUCCEEDED',
        itemsProcessed: outcome.itemsProcessed,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.finishFailed(job, tenant, runId, periodKey, 0, message, startedAt);
      return {
        tenantId: tenant.tenantId.value,
        jobName: job.name,
        periodKey,
        status: 'FAILED',
        itemsProcessed: 0,
        error: message,
      };
    }
  }

  private buildContext(job: ScheduledJob, tenant: ActiveTenant, now: Date, periodKey: string, actor: HrActor): JobContext {
    return {
      tenantId: tenant.tenantId,
      timezone: tenant.timezone,
      periodKey,
      now,
      actor,
      jobName: job.name,
      runCommand: async (input) => {
        const commandActor = {
          ...actor,
          permissions: unique([...(actor.permissions ?? []), ...(input.permissions ?? [])]),
        };
        const aggregateId = input.aggregateId;
        const payload = input.payload;
        const envelope: HrCommandEnvelope<typeof payload> = {
          commandId: Uuid.generate(),
          commandName: input.commandName,
          commandSchemaVersion: 1,
          tenantId: tenant.tenantId,
          actor: commandActor,
          subjectWorkerId: input.subjectWorkerId,
          aggregateType: input.aggregateType,
          aggregateId,
          idempotencyKey: schedulerCommandIdempotencyKey(tenant.tenantId, job.name, periodKey, input.commandName, aggregateId),
          correlationId: Uuid.generate(),
          reason: input.reason ?? job.name,
          payload,
          metadata: {
            requestHash: computeRequestHash(payload),
            clientType: 'SYSTEM_SCHEDULER',
          },
        };
        return this.commandBus.execute(envelope);
      },
    };
  }

  private async recordSkipped(job: ScheduledJob, tenant: ActiveTenant, now: Date, reason: string): Promise<void> {
    const periodKey = job.periodKey?.(now, tenant.timezone) ?? schedulerPeriodKey(now, tenant.timezone);
    await this.runRepository.markSkipped({ tenantId: tenant.tenantId, jobName: job.name, periodKey, reason, at: now });
    this.recordSkippedMetricsAndLog(job, tenant, periodKey, reason);
  }

  private async finishSucceeded(
    job: ScheduledJob,
    tenant: ActiveTenant,
    runId: Uuid,
    periodKey: string,
    itemsProcessed: number,
    startedAt: Date,
  ): Promise<void> {
    const finishedAt = new Date();
    await this.runRepository.markSucceeded({ tenantId: tenant.tenantId, runId, itemsProcessed, finishedAt });
    this.recordMetricsAndLog('SUCCEEDED', job, tenant, periodKey, itemsProcessed, startedAt, finishedAt);
  }

  private async finishFailed(
    job: ScheduledJob,
    tenant: ActiveTenant,
    runId: Uuid,
    periodKey: string,
    itemsProcessed: number,
    error: string,
    startedAt: Date,
  ): Promise<void> {
    const finishedAt = new Date();
    await this.runRepository.markFailed({ tenantId: tenant.tenantId, runId, itemsProcessed, error, finishedAt });
    this.recordMetricsAndLog('FAILED', job, tenant, periodKey, itemsProcessed, startedAt, finishedAt, error);
  }

  private recordMetricsAndLog(
    status: 'SUCCEEDED' | 'FAILED',
    job: ScheduledJob,
    tenant: ActiveTenant,
    periodKey: string,
    itemsProcessed: number,
    startedAt: Date,
    finishedAt: Date,
    error?: string,
  ): void {
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
    this.metrics.recordSchedulerJobRun({
      jobName: job.name,
      status,
      durationMs,
      itemsProcessed,
    });
    this.logger.info({
      eventType: 'SCHEDULER_JOB_RUN',
      jobName: job.name,
      tenantId: tenant.tenantId.value,
      periodKey,
      status,
      durationMs,
      itemsProcessed,
      error,
    });
  }

  private recordSkippedMetricsAndLog(job: ScheduledJob, tenant: ActiveTenant, periodKey: string, reason: string): void {
    this.metrics.recordSchedulerJobRun({
      jobName: job.name,
      status: 'SKIPPED',
      durationMs: 0,
      itemsProcessed: 0,
    });
    this.logger.info({
      eventType: 'SCHEDULER_JOB_RUN',
      jobName: job.name,
      tenantId: tenant.tenantId.value,
      periodKey,
      status: 'SKIPPED',
      itemsProcessed: 0,
      reason,
    });
  }
}

function schedulerCommandIdempotencyKey(
  tenantId: Uuid,
  jobName: string,
  periodKey: string,
  commandName: string,
  aggregateId?: Uuid,
): string {
  return ['scheduler', tenantId.value, jobName, periodKey, commandName, aggregateId?.value ?? 'new'].join(':');
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function hasErrors(outcome: JobOutcome): boolean {
  return Array.isArray(outcome.errors) && outcome.errors.length > 0;
}

function summarizeOutcomeErrors(outcome: JobOutcome): string {
  return (outcome.errors ?? [])
    .map((error) => typeof error === 'string' ? error : error.message)
    .filter((message) => message.trim().length > 0)
    .join('; ') || 'Scheduled job completed with errors';
}
