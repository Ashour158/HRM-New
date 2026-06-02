import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import { BenefitsProgram } from '../aggregates/benefits-program.aggregate.js';

/**
 * Repository for {@link BenefitsProgram} aggregates.
 */
@Injectable()
export class BenefitsProgramRepository extends BaseRepository<'benefits_programs', BenefitsProgram> {
  protected readonly tableName = 'benefits_programs' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<BenefitsProgram | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['benefits_programs']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<BenefitsProgram[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['benefits_programs']));
  }

  async findActive(tenantId?: Uuid): Promise<BenefitsProgram[]> {
    let query = this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('status', '=', 'ACTIVE');
    if (tenantId) {
      query = query.where('tenant_id', '=', tenantId.value);
    }
    const rows = await query.execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['benefits_programs']));
  }

  async save(entity: BenefitsProgram): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['benefits_programs']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['benefits_programs']>);
    }
  }

  private toAggregate(row: Database['benefits_programs']): BenefitsProgram {
    return new BenefitsProgram({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      programName: row.program_name,
      programType: row.program_type,
      carrierId: row.carrier_id ? new Uuid(row.carrier_id) : undefined,
      effectiveFrom: row.effective_from ?? undefined,
      effectiveUntil: row.effective_until ?? undefined,
      status: row.status as 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    });
  }

  private toRow(entity: BenefitsProgram): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      program_name: entity.programName,
      program_type: entity.programType,
      carrier_id: entity.carrierId?.value ?? null,
      effective_from: entity.effectiveFrom ?? null,
      effective_until: entity.effectiveUntil ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
