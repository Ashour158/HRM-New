import { Inject, Injectable, Optional } from '@nestjs/common';
import { computeRequestHash, runWithTenant } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CommandBus } from '../command-bus/command-bus.js';
import { EffectiveDatingActivationLogRepository } from './effective-dating-activation-log.repository.js';
import type { EffectiveDatingActivationLogRepositoryPort } from './effective-dating-activation-log.repository.js';
import { SystemActorFactory } from './system-actor.factory.js';

export interface EffectiveDatingCandidate {
  id: Uuid;
  aggregateType: string;
  status: string;
  effectiveFrom: Date;
  aggregateVersion?: number;
  subjectWorkerId?: Uuid;
}

export interface EffectiveDatingCommandSpec {
  commandName: string;
  aggregateType: string;
  aggregateId: Uuid;
  expectedState?: string;
  expectedVersion?: number;
  subjectWorkerId?: Uuid;
  payload: Record<string, unknown>;
  permissions?: string[];
  reason?: string;
}

export interface EffectiveDatingActivatorInput<TCandidate extends EffectiveDatingCandidate> {
  tenantId: Uuid;
  jobName: string;
  today: Date;
  dueStatuses?: string[];
  queryDueRows(ctx: { tenantId: Uuid; today: Date }): Promise<TCandidate[]>;
  buildCommand(row: TCandidate): EffectiveDatingCommandSpec;
}

export interface EffectiveDatingActivatorResult {
  processed: number;
  skipped: number;
  failed: number;
  errors: string[];
}

@Injectable()
export class EffectiveDatingActivator {
  constructor(
    private readonly commandBus: CommandBus,
    @Optional()
    @Inject(EffectiveDatingActivationLogRepository)
    private readonly activationLog: EffectiveDatingActivationLogRepositoryPort = new EffectiveDatingActivationLogRepository(),
    @Optional()
    @Inject(SystemActorFactory)
    private readonly systemActorFactory: SystemActorFactory = new SystemActorFactory(),
  ) {}

  async activateDue<TCandidate extends EffectiveDatingCandidate>(
    input: EffectiveDatingActivatorInput<TCandidate>,
  ): Promise<EffectiveDatingActivatorResult> {
    return runWithTenant(input.tenantId, async () => {
      const rows = await input.queryDueRows({ tenantId: input.tenantId, today: input.today });
      const dueRows = uniqueRows(rows).filter((row) => isDue(row, input.today, input.dueStatuses));
      let processed = 0;
      let skipped = rows.length - dueRows.length;
      let failed = 0;
      const errors: string[] = [];

      for (const row of dueRows) {
        const command = input.buildCommand(row);
        const effectiveDateBucket = dateBucket(row.effectiveFrom);
        const start = await this.activationLog.tryStartActivation({
          tenantId: input.tenantId,
          jobName: input.jobName,
          aggregateType: command.aggregateType,
          aggregateId: command.aggregateId,
          effectiveDateBucket,
          commandName: command.commandName,
          now: input.today,
        });
        if (!start.started) {
          skipped += 1;
          continue;
        }

        try {
          const envelope = this.buildEnvelope(input, row, command, effectiveDateBucket);
          await this.commandBus.execute(envelope);
          await this.activationLog.markSucceeded({
            tenantId: input.tenantId,
            activationId: start.activationId,
            finishedAt: new Date(),
          });
          processed += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.activationLog.markFailed({
            tenantId: input.tenantId,
            activationId: start.activationId,
            error: message,
            finishedAt: new Date(),
          });
          errors.push(message);
          failed += 1;
        }
      }

      return { processed, skipped, failed, errors };
    });
  }

  private buildEnvelope<TCandidate extends EffectiveDatingCandidate>(
    input: EffectiveDatingActivatorInput<TCandidate>,
    row: TCandidate,
    command: EffectiveDatingCommandSpec,
    effectiveDateBucket: string,
  ): HrCommandEnvelope<Record<string, unknown>> {
    const actor = this.systemActorFactory.createForJob(input.jobName, command.permissions);
    return {
      commandId: Uuid.generate(),
      commandName: command.commandName,
      commandSchemaVersion: 1,
      tenantId: input.tenantId,
      actor,
      subjectWorkerId: command.subjectWorkerId ?? row.subjectWorkerId,
      aggregateType: command.aggregateType,
      aggregateId: command.aggregateId,
      expectedState: command.expectedState ?? row.status,
      expectedVersion: command.expectedVersion ?? row.aggregateVersion,
      effectiveDate: row.effectiveFrom,
      idempotencyKey: [
        'effective-dating',
        input.tenantId.value,
        input.jobName,
        command.aggregateType,
        command.aggregateId.value,
        effectiveDateBucket,
      ].join(':'),
      correlationId: Uuid.generate(),
      reason: command.reason ?? input.jobName,
      payload: command.payload,
      metadata: {
        requestHash: computeRequestHash(command.payload),
        clientType: 'SYSTEM_SCHEDULER',
        hrDataSensitivity: 'LOW',
      },
    };
  }
}

function uniqueRows<TCandidate extends EffectiveDatingCandidate>(rows: TCandidate[]): TCandidate[] {
  const byKey = new Map<string, TCandidate>();
  for (const row of rows) {
    byKey.set(`${row.aggregateType}:${row.id.value}`, row);
  }
  return Array.from(byKey.values());
}

function isDue(row: EffectiveDatingCandidate, today: Date, dueStatuses = ['PENDING', 'SCHEDULED']): boolean {
  return dueStatuses.includes(row.status) && row.effectiveFrom.getTime() <= endOfDayUtc(today).getTime();
}

function endOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function dateBucket(date: Date): string {
  return date.toISOString().slice(0, 10);
}
