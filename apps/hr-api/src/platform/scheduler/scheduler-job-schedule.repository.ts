import { Injectable, Optional } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import type { Kysely, Selectable } from 'kysely';
import type {
  SchedulerJobScheduleOverride,
  SchedulerJobScheduleRepositoryPort,
} from './scheduled-job.js';

type SchedulerJobScheduleRow = Selectable<Database['scheduler_job_schedules']>;

@Injectable()
export class SchedulerJobScheduleRepository implements SchedulerJobScheduleRepositoryPort {
  private readonly db: Kysely<Database>;

  constructor(@Optional() db?: Kysely<Database>) {
    this.db = db ?? createKyselyInstance(getPool());
  }

  async getScheduleOverride(tenantId: Uuid, jobName: string): Promise<SchedulerJobScheduleOverride | undefined> {
    const row = await this.db
      .selectFrom('scheduler_job_schedules')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('job_name', '=', jobName)
      .executeTakeFirst();
    return row ? toOverride(row) : undefined;
  }

  async listOverridesForTenant(tenantId: Uuid): Promise<SchedulerJobScheduleOverride[]> {
    const rows = await this.db
      .selectFrom('scheduler_job_schedules')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map(toOverride);
  }

  async upsertSchedule(input: {
    tenantId: Uuid;
    jobName: string;
    cron: string;
    enabled: boolean;
    updatedBy: Uuid;
  }): Promise<SchedulerJobScheduleOverride> {
    const row = await this.db
      .insertInto('scheduler_job_schedules')
      .values({
        id: Uuid.generate().value,
        tenant_id: input.tenantId.value,
        job_name: input.jobName,
        cron: input.cron,
        enabled: input.enabled,
        updated_by: input.updatedBy.value,
        aggregate_version: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .onConflict((oc) =>
        oc.columns(['tenant_id', 'job_name']).doUpdateSet({
          cron: input.cron,
          enabled: input.enabled,
          updated_by: input.updatedBy.value,
          updated_at: new Date().toISOString(),
          aggregate_version: (eb) => eb('aggregate_version', '+', 1),
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return toOverride(row);
  }
}

function toOverride(row: SchedulerJobScheduleRow): SchedulerJobScheduleOverride {
  return {
    tenantId: new Uuid(row.tenant_id),
    jobName: row.job_name,
    cron: row.cron,
    enabled: row.enabled,
  };
}
