import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import { TotalCompensationStatement } from '../aggregates/total-compensation-statement.aggregate.js';

/**
 * Repository for {@link TotalCompensationStatement} aggregates.
 */
@Injectable()
export class TotalCompensationStatementRepository extends BaseRepository<'total_compensation_statements', TotalCompensationStatement> {
  protected readonly tableName = 'total_compensation_statements' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<TotalCompensationStatement | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['total_compensation_statements']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<TotalCompensationStatement[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['total_compensation_statements']));
  }

  async findByWorkerAndYear(workerId: Uuid, statementYear: number): Promise<TotalCompensationStatement | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .where('statement_year', '=', statementYear)
      .executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Database['total_compensation_statements']) : undefined;
  }

  async save(entity: TotalCompensationStatement): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['total_compensation_statements']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['total_compensation_statements']>);
    }
  }

  private toAggregate(row: Database['total_compensation_statements']): TotalCompensationStatement {
    return new TotalCompensationStatement({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      statementYear: row.statement_year,
      baseSalary: row.base_salary,
      bonusAmount: row.bonus_amount,
      equityValue: row.equity_value,
      benefitsValue: row.benefits_value,
      totalComp: row.total_comp,
      currency: row.currency,
      status: row.status as 'DRAFT' | 'GENERATED' | 'DELIVERED' | 'ACKNOWLEDGED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    });
  }

  private toRow(entity: TotalCompensationStatement): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      statement_year: entity.statementYear,
      base_salary: entity.baseSalary,
      bonus_amount: entity.bonusAmount,
      equity_value: entity.equityValue,
      benefits_value: entity.benefitsValue,
      total_comp: entity.totalComp,
      currency: entity.currency,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
