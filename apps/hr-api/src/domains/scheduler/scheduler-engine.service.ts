import { Inject, Injectable } from '@nestjs/common';
import { createPrivacyForEvent, type HrEventEnvelope } from '@hcm/event-schemas';
import { runWithTenant } from '@hcm/platform-core';
import { Uuid } from '@hcm/shared-kernel';
// Value imports (not `import type`): Nest needs the runtime class in paramtypes
// metadata to resolve these by-type constructor dependencies.
import { CommandBus } from '../../platform/command-bus/command-bus.js';
import { EventBus } from '../../platform/event-bus/event-bus.js';
import { HcmSetupService } from '../hcm-setup/hcm-setup.service.js';
import { resolveTenantTimezone } from '../hcm-setup/hcm-setup-currency.js';
import { buildSchedulerCommandEnvelope, schedulerIdempotencyKey } from './scheduler-command-envelope.factory.js';
import { nextRunAfter, schedulerPeriodKey } from './scheduler-time.js';
import { SCHEDULER_JOB_REPOSITORY, SCHEDULER_JOB_RUN_REPOSITORY } from './scheduler.types.js';
import type {
  SchedulerJob,
  SchedulerJobRepositoryPort,
  SchedulerJobRunRepositoryPort,
  SchedulerRunResult,
} from './scheduler.types.js';

@Injectable()
export class SchedulerEngineService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly eventBus: EventBus,
    @Inject(SCHEDULER_JOB_REPOSITORY)
    private readonly jobRepository: SchedulerJobRepositoryPort,
    @Inject(SCHEDULER_JOB_RUN_REPOSITORY)
    private readonly runRepository: SchedulerJobRunRepositoryPort,
    // Pick<> erases to Object in metadata, so inject the concrete service token.
    @Inject(HcmSetupService)
    private readonly hcmSetup: Pick<HcmSetupService, 'getSetup'>,
  ) {}

  async runDueJobsForTenant(tenantId: Uuid, now = new Date()): Promise<SchedulerRunResult[]> {
    const jobs = await this.jobRepository.findDueJobs(tenantId, now);
    const results: SchedulerRunResult[] = [];
    for (const job of jobs) {
      results.push(await this.runJob(tenantId, job, now));
    }
    return results;
  }

  async runJob(tenantId: Uuid, job: SchedulerJob, now = new Date()): Promise<SchedulerRunResult> {
    if (job.tenantId.value !== tenantId.value) {
      throw new Error(`Scheduler job ${job.jobKey} does not belong to tenant ${tenantId.value}`);
    }
    return runWithTenant(tenantId, async () => {
      const setup = await this.hcmSetup.getSetup(tenantId);
      const timezone = resolveTenantTimezone(setup);
      const periodKey = schedulerPeriodKey(now, job.scheduleKind, timezone);
      const correlationId = Uuid.generate();
      const idempotencyKey = schedulerIdempotencyKey(tenantId, job.jobKey, periodKey);
      const start = await this.runRepository.tryStartRun({
        tenantId,
        jobId: job.id,
        jobKey: job.jobKey,
        periodKey,
        runKind: job.jobType,
        idempotencyKey,
        correlationId,
        startedAt: now,
      });

      if (!start.started) {
        return { status: 'SKIPPED_DUPLICATE', run: start.run };
      }

      try {
        if (job.jobType === 'COMMAND') {
          const { commandId, outcome } = await this.executeCommandJob(job, periodKey, correlationId);
          const result = outcome as { success: boolean; errorMessage?: string; errorCode?: string };
          if (!result.success) {
            await this.runRepository.markFailed({
              tenantId,
              runId: start.run.id,
              errorMessage: result.errorMessage ?? result.errorCode ?? 'Scheduled command failed',
              resultPayload: outcome as unknown as Record<string, unknown>,
            });
            return { status: 'FAILED', run: start.run, commandId, errorMessage: result.errorMessage };
          }
          await this.runRepository.markSucceeded({
            tenantId,
            runId: start.run.id,
            commandId,
            resultPayload: outcome as unknown as Record<string, unknown>,
          });
          await this.jobRepository.markRunCompleted({
            tenantId,
            jobId: job.id,
            lastRunAt: now,
            nextRunAt: nextRunAfter(now, job.scheduleKind),
          });
          return { status: 'SUCCEEDED', run: start.run, commandId };
        }

        const event = this.buildReminderEvent(job, periodKey, correlationId, now, timezone.label);
        await this.eventBus.publish(event);
        await this.runRepository.markSucceeded({
          tenantId,
          runId: start.run.id,
          eventId: event.eventId,
          resultPayload: { eventName: event.eventName, eventId: event.eventId.value },
        });
        await this.jobRepository.markRunCompleted({
          tenantId,
          jobId: job.id,
          lastRunAt: now,
          nextRunAt: nextRunAfter(now, job.scheduleKind),
        });
        return { status: 'SUCCEEDED', run: start.run, eventId: event.eventId };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.runRepository.markFailed({ tenantId, runId: start.run.id, errorMessage: message });
        return { status: 'FAILED', run: start.run, errorMessage: message };
      }
    });
  }

  private async executeCommandJob(job: SchedulerJob, periodKey: string, correlationId: Uuid) {
    if (!job.commandName) {
      throw new Error(`Scheduler command job ${job.jobKey} is missing commandName`);
    }
    const envelope = buildSchedulerCommandEnvelope({
      tenantId: job.tenantId,
      jobKey: job.jobKey,
      periodKey,
      commandName: job.commandName,
      aggregateType: job.aggregateType,
      aggregateId: job.aggregateId,
      payload: materializeTemplate(job.payloadTemplate ?? {}),
      reason: `Scheduled job ${job.jobKey}`,
      correlationId,
    });
    const outcome = await this.commandBus.execute(envelope);
    return { commandId: envelope.commandId, outcome };
  }

  private buildReminderEvent(
    job: SchedulerJob,
    periodKey: string,
    correlationId: Uuid,
    now: Date,
    timezoneLabel: string,
  ): HrEventEnvelope<Record<string, unknown>> {
    const payload = {
      ...materializeTemplate(job.eventPayloadTemplate ?? {}),
      jobKey: job.jobKey,
      periodKey,
      scheduledFor: now.toISOString(),
      tenantTimezone: timezoneLabel,
    };
    const eventName = job.eventName ?? 'SchedulerReminderDue';
    return {
      eventId: Uuid.generate(),
      eventName,
      eventSchemaVersion: 1,
      tenantId: job.tenantId,
      aggregateType: job.aggregateType,
      aggregateId: job.aggregateId ?? job.id,
      payload,
      metadata: {
        correlationId,
        requestHash: JSON.stringify(payload),
        clientType: 'SYSTEM',
        hrDataSensitivity: 'LOW',
      },
      privacy: createPrivacyForEvent('LOW', readSubjectWorkerId(payload), 'PROFILE'),
      occurredAt: now,
      version: 1,
    };
  }
}

function materializeTemplate(template: Record<string, unknown>): Record<string, unknown> {
  return materializeRecord(template);
}

function materializeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = materializeValue(key, value);
  }
  return result;
}

function materializeValue(key: string, value: unknown): unknown {
  if (typeof value === 'string' && key.endsWith('Id') && Uuid.isValid(value)) {
    return new Uuid(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => materializeValue(key.endsWith('Ids') ? 'itemId' : key, item));
  }
  if (typeof value === 'object' && value !== null) {
    return materializeRecord(value as Record<string, unknown>);
  }
  return value;
}

function readSubjectWorkerId(payload: Record<string, unknown>): string | undefined {
  const value = payload.subjectWorkerId ?? payload.workerId ?? payload.recipientWorkerId;
  if (value instanceof Uuid) return value.value;
  if (typeof value === 'string' && Uuid.isValid(value)) return value;
  return undefined;
}
