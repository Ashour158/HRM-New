import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import { ManagerRelationship } from '../aggregates/manager-relationship.aggregate.js';

/**
 * Repository for ManagerRelationship aggregates.
 */
@Injectable()
export class ManagerRelationshipRepository extends BaseRepository<'hr_org.manager_relationships', ManagerRelationship> {
  protected readonly tableName = 'hr_org.manager_relationships' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<ManagerRelationship | undefined> {
    const row = await super.findById(id);
    return row ? this.toEntity(row as unknown as Database['hr_org.manager_relationships']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<ManagerRelationship[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r) => this.toEntity(r as unknown as Database['hr_org.manager_relationships']));
  }

  async findByManager(managerId: Uuid): Promise<ManagerRelationship[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('manager_id', '=', managerId.value)
      .execute();
    return rows.map((r) => this.toEntity(r as unknown as Database['hr_org.manager_relationships']));
  }

  async findByTenant(tenantId: Uuid): Promise<ManagerRelationship[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r) => this.toEntity(r as unknown as Database['hr_org.manager_relationships']));
  }

  async findActiveForWorker(workerId: Uuid): Promise<ManagerRelationship | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .where('end_date', 'is', null)
      .executeTakeFirst();
    return row ? this.toEntity(row as unknown as Database['hr_org.manager_relationships']) : undefined;
  }

  async save(entity: ManagerRelationship): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['hr_org.manager_relationships']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['hr_org.manager_relationships']>);
    }
  }

  private toRow(entity: ManagerRelationship): Insertable<Database['hr_org.manager_relationships']> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      manager_id: entity.managerId.value,
      department_id: entity.departmentId?.value ?? null,
      is_primary: entity.isPrimary,
      start_date: entity.startDate.toISOString(),
      end_date: entity.endDate ? entity.endDate.toISOString() : null,
      aggregate_version: entity.version,
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
    } as unknown as Insertable<Database['hr_org.manager_relationships']>;
  }

  private toEntity(row: Database['hr_org.manager_relationships']): ManagerRelationship {
    return ManagerRelationship.restore({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      managerId: new Uuid(row.manager_id),
      departmentId: row.department_id ? new Uuid(row.department_id) : undefined,
      isPrimary: row.is_primary,
      startDate: row.start_date as unknown as unknown as Date,
      endDate: (row.end_date as unknown as unknown as unknown as Date | null) ?? undefined,
      status: 'ACTIVE',
      createdAt: row.created_at as unknown as unknown as Date,
      updatedAt: row.updated_at as unknown as unknown as Date,
      version: row.aggregate_version,
    });
  }
}
