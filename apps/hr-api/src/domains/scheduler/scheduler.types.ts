import type { Uuid } from '@hcm/shared-kernel';

export type SchedulerJobType = 'COMMAND' | 'REMINDER_EVENT';
export type SchedulerScheduleKind = 'MANUAL' | 'ONE_OFF' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type SchedulerJobStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type SchedulerJobRunStatus = 'STARTED' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED_DUPLICATE';

export interface SchedulerJob {
  id: Uuid;
  tenantId: Uuid;
  jobKey: string;
  label: string;
  description?: string;
  jobType: SchedulerJobType;
  scheduleKind: SchedulerScheduleKind;
  status: SchedulerJobStatus;
  enabled: boolean;
  commandName?: string;
  aggregateType: string;
  aggregateId?: Uuid;
  payloadTemplate?: Record<string, unknown>;
  eventName?: string;
  eventPayloadTemplate?: Record<string, unknown>;
  nextRunAt?: Date;
  lastRunAt?: Date;
  aggregateVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulerJobRun {
  id: Uuid;
  tenantId: Uuid;
  jobId: Uuid;
  jobKey: string;
  periodKey: string;
  runKind: SchedulerJobType;
  status: SchedulerJobRunStatus;
  idempotencyKey: string;
  commandId?: Uuid;
  correlationId: Uuid;
  eventId?: Uuid;
  startedAt: Date;
  finishedAt?: Date;
  errorMessage?: string;
  resultPayload: Record<string, unknown>;
  aggregateVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulerJobRepositoryPort {
  findDueJobs(tenantId: Uuid, dueAt: Date): Promise<SchedulerJob[]>;
  markRunCompleted(input: { tenantId: Uuid; jobId: Uuid; lastRunAt: Date; nextRunAt?: Date }): Promise<void>;
}

export interface SchedulerJobRunRepositoryPort {
  tryStartRun(input: {
    tenantId: Uuid;
    jobId: Uuid;
    jobKey: string;
    periodKey: string;
    runKind: SchedulerJobType;
    idempotencyKey: string;
    correlationId: Uuid;
    startedAt: Date;
  }): Promise<{ started: boolean; run: SchedulerJobRun }>;
  markSucceeded(input: {
    tenantId: Uuid;
    runId: Uuid;
    commandId?: Uuid;
    eventId?: Uuid;
    resultPayload: Record<string, unknown>;
    finishedAt?: Date;
  }): Promise<void>;
  markFailed(input: {
    tenantId: Uuid;
    runId: Uuid;
    errorMessage: string;
    resultPayload?: Record<string, unknown>;
    finishedAt?: Date;
  }): Promise<void>;
}

export interface SchedulerRunResult {
  status: SchedulerJobRunStatus;
  run: SchedulerJobRun;
  commandId?: Uuid;
  eventId?: Uuid;
  errorMessage?: string;
}

export const SCHEDULER_JOB_REPOSITORY = Symbol('SCHEDULER_JOB_REPOSITORY');
export const SCHEDULER_JOB_RUN_REPOSITORY = Symbol('SCHEDULER_JOB_RUN_REPOSITORY');
