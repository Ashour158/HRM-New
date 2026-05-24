import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { TimeClockEvent, type TimeClockEventStatus, type TimeClockEventType } from '../aggregates/time-clock-event.aggregate.js';

@Injectable()
export class TimeClockEventRepository extends BaseRepository<'time_clock_events', TimeClockEvent> {
  protected readonly tableName = 'time_clock_events' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<TimeClockEvent | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['time_clock_events']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<TimeClockEvent[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['time_clock_events']));
  }

  async save(entity: TimeClockEvent): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['time_clock_events']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['time_clock_events']>);
    }
  }

  private toAggregate(row: Database['time_clock_events']): TimeClockEvent {
    return new TimeClockEvent({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      eventType: row.event_type as TimeClockEventType,
      timestamp: row.timestamp,
      location: row.location ?? undefined,
      deviceId: row.device_id ?? undefined,
      status: row.status as TimeClockEventStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: TimeClockEvent): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      event_type: entity.eventType,
      timestamp: entity.timestamp,
      location: entity.location ?? null,
      device_id: entity.deviceId ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
