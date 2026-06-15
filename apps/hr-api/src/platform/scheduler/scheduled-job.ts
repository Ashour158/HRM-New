import type { HrActor } from '@hcm/command-contracts';
import type { Uuid } from '@hcm/shared-kernel';

export const SCHEDULED_JOBS = Symbol('SCHEDULED_JOBS');

export type ScheduledJobConcurrency = 'per-tenant' | 'global';

export interface ScheduledJob {
  name: string;
  cron: string;
  concurrency?: ScheduledJobConcurrency;
  permissions?: string[];
  periodKey?: (now: Date, timezone: string) => string;
  runForTenant(ctx: JobContext): Promise<JobOutcome>;
}

export interface TenantJobContext {
  tenantId: Uuid;
  timezone: string;
  periodKey: string;
  now: Date;
  actor: HrActor;
  jobName: string;
}

export interface RunCommandInput<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  commandName: string;
  aggregateType: string;
  aggregateId?: Uuid;
  subjectWorkerId?: Uuid;
  payload: TPayload;
  permissions?: string[];
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface JobContext extends TenantJobContext {
  runCommand<TPayload extends Record<string, unknown>>(input: RunCommandInput<TPayload>): Promise<unknown>;
}

export interface JobOutcome {
  itemsProcessed: number;
  errors?: Array<string | { message: string; code?: string }>;
}

export type SchedulerJobRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';

export interface SchedulerJobRunRecord {
  id: Uuid;
  tenantId: Uuid;
  jobName: string;
  periodKey: string;
  status: SchedulerJobRunStatus;
  itemsProcessed: number;
  error?: string;
  startedAt: Date;
  finishedAt?: Date;
}

export interface TryStartSchedulerJobRunInput {
  tenantId: Uuid;
  jobName: string;
  periodKey: string;
  startedAt: Date;
}

export type TryStartSchedulerJobRunResult =
  | { acquired: true; run: SchedulerJobRunRecord }
  | { acquired: false; run?: SchedulerJobRunRecord; skipReason: 'ALREADY_SUCCEEDED' | 'RUNNING' };

export interface SchedulerJobRunRepositoryPort {
  tryStartRun(input: TryStartSchedulerJobRunInput): Promise<TryStartSchedulerJobRunResult>;
  markSucceeded(input: { tenantId: Uuid; runId: Uuid; itemsProcessed: number; finishedAt: Date }): Promise<void>;
  markFailed(input: { tenantId: Uuid; runId: Uuid; error: string; itemsProcessed: number; finishedAt: Date }): Promise<void>;
  markSkipped(input: { tenantId: Uuid; jobName: string; periodKey: string; reason: string; at: Date }): Promise<void>;
}

export interface SchedulerJobScheduleOverride {
  tenantId: Uuid;
  jobName: string;
  cron: string;
  enabled: boolean;
}

export interface SchedulerJobScheduleRepositoryPort {
  getScheduleOverride(tenantId: Uuid, jobName: string): Promise<SchedulerJobScheduleOverride | undefined>;
  upsertSchedule(input: {
    tenantId: Uuid;
    jobName: string;
    cron: string;
    enabled: boolean;
    updatedBy: Uuid;
  }): Promise<SchedulerJobScheduleOverride>;
}

export interface ActiveTenant {
  tenantId: Uuid;
  timezone: string;
}

export interface TenantJobRunResult {
  tenantId: string;
  jobName: string;
  periodKey: string;
  status: SchedulerJobRunStatus;
  itemsProcessed: number;
  error?: string;
}

export interface JobRunBatchResult {
  jobName: string;
  tenants: TenantJobRunResult[];
}
