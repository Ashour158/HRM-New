import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { sql } from 'kysely';

export type PlatformNotificationAudience = 'EMPLOYEE' | 'MANAGER' | 'HR_OPERATIONS';
export const HR_OPERATIONS_NOTIFICATION_ROLE = 'HR_OPERATIONS';

export interface PlatformNotificationInput {
  tenantId: string;
  audience: PlatformNotificationAudience;
  recipientWorkerId?: string;
  recipientRole?: string;
  category: string;
  title: string;
  body: string;
  sourceEventId: string;
  sourceEventName: string;
  relatedAggregateType: string;
  relatedAggregateId: string;
  payload?: Record<string, unknown>;
}

export interface PlatformNotificationRecord extends PlatformNotificationInput {
  id: string;
  deliveryStatus: string;
  readAt?: Date;
  createdAt: Date;
}

interface PlatformNotificationRow {
  id: string;
  tenant_id: string;
  audience: PlatformNotificationAudience;
  recipient_worker_id: string | null;
  recipient_role: string | null;
  category: string;
  title: string;
  body: string;
  source_event_id: string;
  source_event_name: string;
  related_aggregate_type: string;
  related_aggregate_id: string;
  payload: unknown;
  delivery_status: string;
  read_at: Date | null;
  created_at: Date;
}

@Injectable()
export class PlatformNotificationRepository {
  private readonly db = createKyselyInstance(getPool());

  async findWorkerIdForActor(tenantId: string, actorId: string, email?: string): Promise<string | undefined> {
    if (Uuid.isValid(actorId)) {
      const byId = await this.db
        .selectFrom('workers')
        .select('id')
        .where('tenant_id', '=', tenantId)
        .where('id', '=', actorId)
        .executeTakeFirst();
      if (byId?.id) return byId.id;
    }

    if (email) {
      const byEmail = await this.db
        .selectFrom('workers')
        .select('id')
        .where('tenant_id', '=', tenantId)
        .where('email', '=', email)
        .executeTakeFirst();
      if (byEmail?.id) return byEmail.id;
    }

    return undefined;
  }

  async findManagerWorkerIdForWorker(tenantId: string, workerId: string): Promise<string | undefined> {
    const row = await this.db
      .selectFrom('workers')
      .select('manager_id')
      .where('tenant_id', '=', tenantId)
      .where('id', '=', workerId)
      .executeTakeFirst();

    return row?.manager_id ?? undefined;
  }

  async createMany(records: PlatformNotificationInput[]): Promise<void> {
    for (const record of records) {
      await sql`
        INSERT INTO hr_platform.platform_notifications (
          tenant_id,
          audience,
          recipient_worker_id,
          recipient_role,
          category,
          title,
          body,
          source_event_id,
          source_event_name,
          related_aggregate_type,
          related_aggregate_id,
          payload
        ) VALUES (
          ${record.tenantId},
          ${record.audience},
          ${record.recipientWorkerId ?? null},
          ${record.recipientRole ?? null},
          ${record.category},
          ${record.title},
          ${record.body},
          ${record.sourceEventId},
          ${record.sourceEventName},
          ${record.relatedAggregateType},
          ${record.relatedAggregateId},
          ${JSON.stringify(record.payload ?? {})}::jsonb
        )
        ON CONFLICT (tenant_id, source_event_id, audience, COALESCE(recipient_worker_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(recipient_role, ''))
        DO NOTHING
      `.execute(this.db);
    }
  }

  async findByWorker(tenantId: string, workerId: string, limit = 50): Promise<PlatformNotificationRecord[]> {
    const result = await sql<PlatformNotificationRow>`
      SELECT *
      FROM hr_platform.platform_notifications
      WHERE tenant_id = ${tenantId}
        AND recipient_worker_id = ${workerId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `.execute(this.db);

    return result.rows.map((row) => this.toRecord(row));
  }

  async findByRole(tenantId: string, role: string, limit = 100): Promise<PlatformNotificationRecord[]> {
    const result = await sql<PlatformNotificationRow>`
      SELECT *
      FROM hr_platform.platform_notifications
      WHERE tenant_id = ${tenantId}
        AND recipient_role = ${role}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `.execute(this.db);

    return result.rows.map((row) => this.toRecord(row));
  }

  async markWorkerRead(tenantId: string, notificationId: string, workerId: string): Promise<PlatformNotificationRecord | undefined> {
    const result = await sql<PlatformNotificationRow>`
      UPDATE hr_platform.platform_notifications
      SET read_at = COALESCE(read_at, now())
      WHERE tenant_id = ${tenantId}
        AND id = ${notificationId}
        AND recipient_worker_id = ${workerId}
      RETURNING *
    `.execute(this.db);

    return result.rows[0] ? this.toRecord(result.rows[0]) : undefined;
  }

  async markAllWorkerRead(tenantId: string, workerId: string): Promise<number> {
    const result = await sql<PlatformNotificationRow>`
      UPDATE hr_platform.platform_notifications
      SET read_at = now()
      WHERE tenant_id = ${tenantId}
        AND recipient_worker_id = ${workerId}
        AND read_at IS NULL
      RETURNING id
    `.execute(this.db);

    return result.rows.length;
  }

  private toRecord(row: PlatformNotificationRow): PlatformNotificationRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      audience: row.audience,
      recipientWorkerId: row.recipient_worker_id ?? undefined,
      recipientRole: row.recipient_role ?? undefined,
      category: row.category,
      title: row.title,
      body: row.body,
      sourceEventId: row.source_event_id,
      sourceEventName: row.source_event_name,
      relatedAggregateType: row.related_aggregate_type,
      relatedAggregateId: row.related_aggregate_id,
      payload: typeof row.payload === 'object' && row.payload !== null ? row.payload as Record<string, unknown> : {},
      deliveryStatus: row.delivery_status,
      readAt: row.read_at ?? undefined,
      createdAt: row.created_at,
    };
  }
}
