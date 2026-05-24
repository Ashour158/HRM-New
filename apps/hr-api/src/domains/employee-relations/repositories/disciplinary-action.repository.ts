import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { DisciplinaryAction, type DisciplinaryActionStatus } from '../aggregates/disciplinary-action.aggregate.js';

@Injectable()
export class DisciplinaryActionRepository extends BaseRepository<'disciplinary_actions', DisciplinaryAction> {
  protected readonly tableName = 'disciplinary_actions' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<DisciplinaryAction | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['disciplinary_actions']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<DisciplinaryAction[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['disciplinary_actions']));
  }



  async save(entity: DisciplinaryAction): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['disciplinary_actions']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['disciplinary_actions']>);
    }
  }

  private toAggregate(row: Database['disciplinary_actions']): DisciplinaryAction {
    return new DisciplinaryAction({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      actionType: row.action_type,
      severity: row.severity,
      description: '',
      effectiveDate: row.effective_date,
      status: row.status as DisciplinaryActionStatus,
      erCaseId: Uuid.generate(),
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: DisciplinaryAction): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      action_type: entity.actionType,
      severity: entity.severity,
      effective_date: entity.effectiveDate,
      expiry_date: null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
