import { Injectable, Optional } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import type { Kysely } from 'kysely';

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

export interface ReminderDispatchLogRepositoryPort {
  tryRecordDispatch(input: ReminderDispatchLogInput): Promise<ReminderDispatchLogResult>;
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
}
