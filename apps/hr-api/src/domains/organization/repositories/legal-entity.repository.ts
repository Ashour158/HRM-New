import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';
import type { Database } from '@hcm/database';
import { LegalEntity } from '../aggregates/legal-entity.aggregate.js';

/**
 * Repository for LegalEntity aggregates.
 */
@Injectable()
export class LegalEntityRepository extends BaseRepository<'hr_org.legal_entities', LegalEntity> {
  protected readonly tableName = 'hr_org.legal_entities' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for hr org.legal entitie query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<LegalEntity | undefined> {
    const row = await super.findById(id);
    return row ? this.toEntity(row as unknown as Database['hr_org.legal_entities']) : undefined;
  }

  async findByCode(code: string): Promise<LegalEntity | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('code', '=', code)
      .executeTakeFirst();
    return row ? this.toEntity(row as unknown as Database['hr_org.legal_entities']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<LegalEntity[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toEntity(r as unknown as Database['hr_org.legal_entities']));
  }

  async save(entity: LegalEntity): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['hr_org.legal_entities']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['hr_org.legal_entities']>);
    }
  }

  private toRow(entity: LegalEntity): Insertable<Database['hr_org.legal_entities']> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      name: entity.name,
      code: entity.code,
      country_code: entity.countryCode,
      registration_number: entity.registrationNumber,
      status: entity.status,
      aggregate_version: entity.version,
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
    } as unknown as Insertable<Database['hr_org.legal_entities']>;
  }

  private toEntity(row: Database['hr_org.legal_entities']): LegalEntity {
    return LegalEntity.restore({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      name: row.name,
      code: row.code,
      countryCode: row.country_code,
      registrationNumber: row.registration_number,
      status: row.status as 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISSOLVED',
      createdAt: row.created_at as unknown as unknown as Date,
      updatedAt: row.updated_at as unknown as unknown as Date,
      version: row.aggregate_version,
    });
  }
}
