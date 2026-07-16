import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId, parseNumeric, parseNullableNumeric } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { KeyResult, type KeyResultStatus } from '../aggregates/key-result.aggregate.js';

@Injectable()
export class KeyResultRepository extends BaseRepository<'key_results', KeyResult> {
  protected readonly tableName = 'key_results' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for key result query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<KeyResult | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByObjective(objectiveId: Uuid): Promise<KeyResult[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('objective_id', '=', objectiveId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: KeyResult): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): KeyResult {
    return new KeyResult({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      objectiveId: new Uuid(row.objective_id),
      title: row.title,
      description: row.description ?? undefined,
      targetValue: parseNumeric(row.target_value),
      currentValue: parseNullableNumeric(row.current_value) ?? 0,
      startValue: parseNullableNumeric(row.start_value) ?? 0,
      unit: row.unit ?? undefined,
      scoringMethod: row.scoring_method ?? 'LINEAR',
      progress: parseNullableNumeric(row.progress) ?? 0,
      status: (row.status as KeyResultStatus) ?? 'DRAFT',
      dueDate: row.due_date ?? undefined,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: KeyResult): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      objective_id: entity.objectiveId.value,
      title: entity.title,
      description: entity.description ?? null,
      target_value: entity.targetValue,
      current_value: entity.currentValue,
      start_value: entity.startValue,
      unit: entity.unit ?? null,
      scoring_method: entity.scoringMethod,
      progress: entity.progress,
      status: entity.status,
      due_date: entity.dueDate ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
