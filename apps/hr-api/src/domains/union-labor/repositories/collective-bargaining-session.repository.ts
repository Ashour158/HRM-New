import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { CollectiveBargainingSession, type CollectiveBargainingSessionStatus } from '../aggregates/collective-bargaining-session.aggregate.js';

@Injectable()
export class CollectiveBargainingSessionRepository extends BaseRepository<'collective_bargaining_sessions', CollectiveBargainingSession> {
  protected readonly tableName = 'collective_bargaining_sessions' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<CollectiveBargainingSession | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['collective_bargaining_sessions']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<CollectiveBargainingSession[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['collective_bargaining_sessions']));
  }



  async save(entity: CollectiveBargainingSession): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['collective_bargaining_sessions']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['collective_bargaining_sessions']>);
    }
  }

  private toAggregate(row: Database['collective_bargaining_sessions']): CollectiveBargainingSession {
    return new CollectiveBargainingSession({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      unionRecognitionId: new Uuid(row.union_recognition_id),
      sessionDate: row.session_date,
      status: row.status as CollectiveBargainingSessionStatus,
      location: row.location ?? undefined,
      agenda: row.agenda ?? undefined,
      minutes: row.minutes ?? undefined,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: CollectiveBargainingSession): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      union_recognition_id: entity.unionRecognitionId.value,
      session_date: entity.sessionDate,
      status: entity.status,
      location: entity.location ?? null,
      agenda: entity.agenda ?? null,
      minutes: entity.minutes ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
