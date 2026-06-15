import { Injectable, Optional } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { sql, type Kysely } from 'kysely';

export interface ReminderDispatchLogInput {
  tenantId: Uuid;
  dispatchKey: string;
  reminderType: string;
  subjectId: Uuid;
  subjectType: string;
  dueDateBucket: string;
  escalationTier: string;
  audienceWorkerIds: string[];
  now: Date;
  dedupeWindowMs: number;
}

export interface ReminderDispatchLogResult {
  recorded: boolean;
  dispatchKey: string;
}

export interface ReminderDispatchLogRecord {
  id: string;
  tenantId: string;
  dispatchKey: string;
  reminderType: string;
  subjectId: string;
  subjectType: string;
  dueDateBucket: string;
  escalationTier: string;
  audienceWorkerIds: string[];
  dispatchedAt: Date;
  expiresAt: Date;
}

export interface ReminderDispatchLogRepositoryPort {
  tryRecordDispatch(input: ReminderDispatchLogInput): Promise<ReminderDispatchLogResult>;
  findRecentForAudience?(tenantId: Uuid, workerId: Uuid, limit?: number): Promise<ReminderDispatchLogRecord[]>;
}

@Injectable()
export class ReminderDispatchLogRepository implements ReminderDispatchLogRepositoryPort {
  private readonly db: Kysely<Database>;

  constructor(@Optional() db?: Kysely<Database>) {
    this.db = db ?? createKyselyInstance(getPool());
  }

  async tryRecordDispatch(input: ReminderDispatchLogInput): Promise<ReminderDispatchLogResult> {
    const existing = await this.db
      .selectFrom('reminder_dispatch_log')
      .select(['id', 'expires_at'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('dispatch_key', '=', input.dispatchKey)
      .executeTakeFirst();

    const expiresAt = new Date(input.now.getTime() + input.dedupeWindowMs);
    if (existing?.expires_at && existing.expires_at > input.now) {
      return { recorded: false, dispatchKey: input.dispatchKey };
    }

    if (existing) {
      await this.db
        .updateTable('reminder_dispatch_log')
        .set({
          audience_worker_ids: input.audienceWorkerIds,
          dispatched_at: input.now,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
          aggregate_version: (eb) => eb('aggregate_version', '+', 1),
        })
        .where('id', '=', existing.id)
        .execute();
      return { recorded: true, dispatchKey: input.dispatchKey };
    }

    await this.db
      .insertInto('reminder_dispatch_log')
      .values({
        id: Uuid.generate().value,
        tenant_id: input.tenantId.value,
        dispatch_key: input.dispatchKey,
        reminder_type: input.reminderType,
        subject_id: input.subjectId.value,
        subject_type: input.subjectType,
        due_date_bucket: input.dueDateBucket,
        escalation_tier: input.escalationTier,
        audience_worker_ids: input.audienceWorkerIds,
        dispatched_at: input.now,
        expires_at: expiresAt,
        aggregate_version: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();
    return { recorded: true, dispatchKey: input.dispatchKey };
  }

  async findRecentForAudience(tenantId: Uuid, workerId: Uuid, limit = 20): Promise<ReminderDispatchLogRecord[]> {
    const result = await sql<{
      id: string;
      tenant_id: string;
      dispatch_key: string;
      reminder_type: string;
      subject_id: string;
      subject_type: string;
      due_date_bucket: string;
      escalation_tier: string;
      audience_worker_ids: string[];
      dispatched_at: Date;
      expires_at: Date;
    }>`
      SELECT id,
             tenant_id,
             dispatch_key,
             reminder_type,
             subject_id,
             subject_type,
             due_date_bucket,
             escalation_tier,
             audience_worker_ids,
             dispatched_at,
             expires_at
      FROM hr_platform.reminder_dispatch_log
      WHERE tenant_id = ${tenantId.value}
        AND audience_worker_ids @> ARRAY[${workerId.value}]::text[]
      ORDER BY dispatched_at DESC
      LIMIT ${limit}
    `.execute(this.db);

    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      dispatchKey: row.dispatch_key,
      reminderType: row.reminder_type,
      subjectId: row.subject_id,
      subjectType: row.subject_type,
      dueDateBucket: row.due_date_bucket,
      escalationTier: row.escalation_tier,
      audienceWorkerIds: row.audience_worker_ids,
      dispatchedAt: row.dispatched_at,
      expiresAt: row.expires_at,
    }));
  }
}
