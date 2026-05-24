import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import { EquityGrant, type VestingScheduleEntry } from '../aggregates/equity-grant.aggregate.js';

/**
 * Repository for {@link EquityGrant} aggregates.
 */
@Injectable()
export class EquityGrantRepository extends BaseRepository<'equity_grants', EquityGrant> {
  protected readonly tableName = 'equity_grants' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<EquityGrant | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['equity_grants']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<EquityGrant[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['equity_grants']));
  }

  async save(entity: EquityGrant): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['equity_grants']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['equity_grants']>);
    }
  }

  private toAggregate(row: Database['equity_grants']): EquityGrant {
    return new EquityGrant({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      grantType: row.grant_type,
      grantDate: row.grant_date,
      vestingSchedule: (row.vesting_schedule as VestingScheduleEntry[]) ?? [],
      totalUnits: row.total_units,
      vestedUnits: row.vested_units,
      exercisedUnits: row.exercised_units,
      strikePrice: row.strike_price ?? undefined,
      status: row.status as 'GRANTED' | 'VESTING' | 'VESTED' | 'EXERCISED' | 'EXPIRED' | 'FORFEITED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    });
  }

  private toRow(entity: EquityGrant): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      grant_type: entity.grantType,
      grant_date: entity.grantDate,
      vesting_schedule: JSON.parse(JSON.stringify(entity.vestingSchedule)),
      total_units: entity.totalUnits,
      vested_units: entity.vestedUnits,
      exercised_units: entity.exercisedUnits,
      strike_price: entity.strikePrice ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
