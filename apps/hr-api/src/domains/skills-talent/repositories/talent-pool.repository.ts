import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { TalentPool, type TalentPoolStatus } from '../aggregates/talent-pool.aggregate.js';

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

@Injectable()
export class TalentPoolRepository extends BaseRepository<'talent_pools', TalentPool> {
  protected readonly tableName = 'talent_pools' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<TalentPool | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<TalentPool[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: TalentPool): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): TalentPool {
    return new TalentPool({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      poolName: row.pool_name,
      criteria: parseObject(row.criteria),
      memberIds: parseStringArray(row.member_ids),
      status: (row.status as TalentPoolStatus) ?? 'ACTIVE',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: TalentPool): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      pool_name: entity.poolName,
      criteria: JSON.stringify(entity.criteria ?? {}),
      member_ids: JSON.stringify(entity.memberIds ?? []),
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
