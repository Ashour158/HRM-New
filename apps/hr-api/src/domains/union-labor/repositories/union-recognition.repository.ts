import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { UnionRecognition, type UnionRecognitionStatus } from '../aggregates/union-recognition.aggregate.js';

@Injectable()
export class UnionRecognitionRepository extends BaseRepository<'union_recognitions', UnionRecognition> {
  protected readonly tableName = 'union_recognitions' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<UnionRecognition | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['union_recognitions']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<UnionRecognition[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['union_recognitions']));
  }



  async save(entity: UnionRecognition): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['union_recognitions']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['union_recognitions']>);
    }
  }

  private toAggregate(row: Database['union_recognitions']): UnionRecognition {
    return new UnionRecognition({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      unionName: row.union_name,
      bargainingUnitId: new Uuid(row.bargaining_unit_id),
      status: row.status as UnionRecognitionStatus,
      effectiveDate: row.effective_date ?? undefined,
      expirationDate: row.expiration_date ?? undefined,
      agreementDocument: row.agreement_document ?? undefined,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: UnionRecognition): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      union_name: entity.unionName,
      bargaining_unit_id: entity.bargainingUnitId.value,
      status: entity.status,
      effective_date: entity.effectiveDate ?? null,
      expiration_date: entity.expirationDate ?? null,
      agreement_document: entity.agreementDocument ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
