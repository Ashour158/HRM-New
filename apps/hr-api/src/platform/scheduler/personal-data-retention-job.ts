import { Inject, Injectable, Optional } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import { Uuid, ConflictError } from '@hcm/shared-kernel';
import { EraseWorkerPersonalDataCommandName } from '@hcm/command-contracts';
import { sql } from 'kysely';
import type { JobContext, JobOutcome, ScheduledJob } from './scheduled-job.js';

/** Default retention horizon (7 years) when not overridden by configuration. */
const DEFAULT_RETENTION_DAYS = 2555;

export interface RetentionExpiredRecord {
  workerId: Uuid;
  recordId: Uuid;
  dataCategory: string;
}

export interface PersonalDataRetentionRepositoryPort {
  findRecordsPastRetention(input: {
    tenantId: Uuid;
    now: Date;
    retentionDays: number;
  }): Promise<RetentionExpiredRecord[]>;
}

/**
 * Read model for retention enforcement.
 *
 * Returns active personal data records whose `updated_at` is older than the
 * retention horizon, EXCLUDING any worker covered by an active legal hold —
 * holds must be released before retention can erase their data.
 */
@Injectable()
export class PersonalDataRetentionReadRepository implements PersonalDataRetentionRepositoryPort {
  private readonly db = createKyselyInstance(getPool());

  async findRecordsPastRetention(input: {
    tenantId: Uuid;
    now: Date;
    retentionDays: number;
  }): Promise<RetentionExpiredRecord[]> {
    const cutoff = new Date(input.now.getTime() - input.retentionDays * 24 * 60 * 60 * 1000);
    const rows = await this.db
      .selectFrom('personal_data_records as record')
      .select(['record.id', 'record.worker_id', 'record.data_category'])
      .where('record.tenant_id', '=', input.tenantId.value)
      .where('record.state', '!=', 'DELETED')
      .where('record.updated_at', '<=', cutoff)
      // Exclude any worker under an active legal hold in this tenant.
      .where(
        sql<boolean>`not exists (
          select 1 from hr_compliance.legal_holds hold
          where hold.tenant_id = ${input.tenantId.value}
            and hold.status = 'ACTIVE'
            and record.worker_id = any(hold.affected_worker_ids)
        )`,
      )
      .execute();
    return rows.map((row) => ({
      workerId: new Uuid(row.worker_id),
      recordId: new Uuid(row.id),
      dataCategory: row.data_category,
    }));
  }
}

/**
 * Enforces the personal-data retention lifecycle.
 *
 * Daily, for each tenant, it finds personal data records past their retention
 * horizon (excluding workers under an active legal hold) and dispatches a
 * right-to-erasure command per worker. The erasure handler re-checks legal
 * holds as defense-in-depth, so a hold placed between query and dispatch still
 * blocks deletion.
 */
@Injectable()
export class PersonalDataRetentionJob implements ScheduledJob {
  readonly name = 'personal-data-retention';
  readonly cron = '0 1 * * *';
  readonly permissions = ['PERSONAL_DATA_ERASE'];

  constructor(
    @Optional()
    @Inject(PersonalDataRetentionReadRepository)
    private readonly repository: PersonalDataRetentionRepositoryPort = new PersonalDataRetentionReadRepository(),
  ) {}

  private retentionDays(): number {
    const configured = Number(process.env.PERSONAL_DATA_RETENTION_DAYS);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_RETENTION_DAYS;
  }

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const expired = await this.repository.findRecordsPastRetention({
      tenantId: ctx.tenantId,
      now: ctx.now,
      retentionDays: this.retentionDays(),
    });

    // Group expired record categories per worker for a single erasure command.
    const byWorker = new Map<string, Set<string>>();
    for (const record of expired) {
      const key = record.workerId.value;
      const categories = byWorker.get(key) ?? new Set<string>();
      categories.add(record.dataCategory);
      byWorker.set(key, categories);
    }

    const errors: Array<{ message: string; code?: string }> = [];
    let processed = 0;
    for (const [workerIdValue, categories] of byWorker) {
      const workerId = new Uuid(workerIdValue);
      try {
        await ctx.runCommand({
          commandName: EraseWorkerPersonalDataCommandName,
          aggregateType: 'Worker',
          subjectWorkerId: workerId,
          payload: {
            workerId,
            dataCategories: [...categories],
            requestedByWorkerId: ctx.actor.actorId,
            reason: `retention-policy:${this.name}`,
          },
          permissions: this.permissions,
          reason: this.name,
        });
        processed += 1;
      } catch (error) {
        // A legal hold placed between query and dispatch blocks this worker;
        // record it as skipped and continue. Any other failure (infra, db,
        // permissions) is a real error and must surface, not be masked.
        if (error instanceof ConflictError) {
          errors.push({
            message: `worker ${workerIdValue}: ${error.message}`,
            code: 'RETENTION_SKIPPED',
          });
          continue;
        }
        throw error;
      }
    }

    return { itemsProcessed: processed, errors: errors.length > 0 ? errors : undefined };
  }
}
