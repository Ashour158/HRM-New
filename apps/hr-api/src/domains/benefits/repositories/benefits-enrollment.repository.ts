import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';
import type { Database } from '@hcm/database';
import { BenefitsEnrollment, type DependentEntry } from '../aggregates/benefits-enrollment.aggregate.js';

/**
 * Repository for {@link BenefitsEnrollment} aggregates.
 */
@Injectable()
export class BenefitsEnrollmentRepository extends BaseRepository<'benefits_enrollments', BenefitsEnrollment> {
  protected readonly tableName = 'benefits_enrollments' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for benefits enrollment query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<BenefitsEnrollment | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['benefits_enrollments']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<BenefitsEnrollment[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['benefits_enrollments']));
  }

  async findByProgram(programId: Uuid): Promise<BenefitsEnrollment[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('program_id', '=', programId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['benefits_enrollments']));
  }

  async save(entity: BenefitsEnrollment): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['benefits_enrollments']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['benefits_enrollments']>);
    }
  }

  private toAggregate(row: Database['benefits_enrollments']): BenefitsEnrollment {
    return new BenefitsEnrollment({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      programId: new Uuid(row.program_id),
      coverageLevel: row.coverage_level,
      dependents: (row.dependents as DependentEntry[]) ?? [],
      effectiveDate: row.effective_date,
      status: row.status as 'DRAFT' | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'EFFECTIVE' | 'TERMINATED' | 'REJECTED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    });
  }

  private toRow(entity: BenefitsEnrollment): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      program_id: entity.programId.value,
      coverage_level: entity.coverageLevel,
      dependents: JSON.parse(JSON.stringify(entity.dependents)),
      effective_date: entity.effectiveDate,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
