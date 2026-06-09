import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import { sql } from 'kysely';

export interface PerformanceNotificationInput {
  tenantId: string;
  recipientWorkerId: string;
  category: string;
  title: string;
  body: string;
  relatedAggregateType?: string;
  relatedAggregateId?: string;
  payload?: Record<string, unknown>;
  createdBy?: string;
}

export interface PerformanceNotificationRecord extends PerformanceNotificationInput {
  id: string;
  readAt?: Date;
  createdAt: Date;
}

interface NotificationRow {
  id: string;
  tenant_id: string;
  recipient_worker_id: string;
  category: string;
  title: string;
  body: string;
  related_aggregate_type: string | null;
  related_aggregate_id: string | null;
  payload: unknown;
  read_at: Date | null;
  created_by: string | null;
  created_at: Date;
}

@Injectable()
export class PerformanceNotificationRepository {
  private readonly db = createKyselyInstance(getPool());

  async createMany(records: PerformanceNotificationInput[]): Promise<void> {
    for (const record of records) {
      await sql`
        INSERT INTO hr_performance.performance_notifications (
          tenant_id,
          recipient_worker_id,
          category,
          title,
          body,
          related_aggregate_type,
          related_aggregate_id,
          payload,
          created_by
        ) VALUES (
          ${record.tenantId},
          ${record.recipientWorkerId},
          ${record.category},
          ${record.title},
          ${record.body},
          ${record.relatedAggregateType ?? null},
          ${record.relatedAggregateId ?? null},
          ${JSON.stringify(record.payload ?? {})}::jsonb,
          ${record.createdBy ?? null}
        )
      `.execute(this.db);
    }
  }

  async findByWorker(tenantId: string, workerId: string): Promise<PerformanceNotificationRecord[]> {
    const result = await sql<NotificationRow>`
      SELECT *
      FROM hr_performance.performance_notifications
      WHERE tenant_id = ${tenantId}
        AND recipient_worker_id = ${workerId}
      ORDER BY created_at DESC
      LIMIT 100
    `.execute(this.db);

    return result.rows.map((row: any) => this.toRecord(row));
  }

  async markRead(tenantId: string, notificationId: string, workerId: string): Promise<PerformanceNotificationRecord | undefined> {
    const result = await sql<NotificationRow>`
      UPDATE hr_performance.performance_notifications
      SET read_at = COALESCE(read_at, now())
      WHERE tenant_id = ${tenantId}
        AND id = ${notificationId}
        AND recipient_worker_id = ${workerId}
      RETURNING *
    `.execute(this.db);

    return result.rows[0] ? this.toRecord(result.rows[0]) : undefined;
  }

  private toRecord(row: NotificationRow): PerformanceNotificationRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      recipientWorkerId: row.recipient_worker_id,
      category: row.category,
      title: row.title,
      body: row.body,
      relatedAggregateType: row.related_aggregate_type ?? undefined,
      relatedAggregateId: row.related_aggregate_id ?? undefined,
      payload: typeof row.payload === 'object' && row.payload !== null ? row.payload as Record<string, unknown> : {},
      readAt: row.read_at ?? undefined,
      createdBy: row.created_by ?? undefined,
      createdAt: row.created_at,
    };
  }
}
