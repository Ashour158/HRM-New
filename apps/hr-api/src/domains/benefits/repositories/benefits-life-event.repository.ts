import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';
import type { Database } from '@hcm/database';
import { BenefitsLifeEvent } from '../aggregates/benefits-life-event.aggregate.js';

/**
 * Repository for {@link BenefitsLifeEvent} aggregates.
 */
@Injectable()
export class BenefitsLifeEventRepository extends BaseRepository<'benefits_life_events', BenefitsLifeEvent> {
  protected readonly tableName = 'benefits_life_events' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for benefits life event query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<BenefitsLifeEvent | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['benefits_life_events']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<BenefitsLifeEvent[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['benefits_life_events']));
  }

  async save(entity: BenefitsLifeEvent): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['benefits_life_events']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['benefits_life_events']>);
    }
  }

  private toAggregate(row: Database['benefits_life_events']): BenefitsLifeEvent {
    return new BenefitsLifeEvent({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      eventType: row.event_type,
      eventDate: row.event_date,
      description: row.description ?? undefined,
      status: row.status as 'RECORDED' | 'PENDING_PROCESSING' | 'PROCESSED' | 'REJECTED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    });
  }

  private toRow(entity: BenefitsLifeEvent): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      event_type: entity.eventType,
      event_date: entity.eventDate,
      description: entity.description ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
