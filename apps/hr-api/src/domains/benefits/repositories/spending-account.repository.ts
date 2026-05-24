import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import { SpendingAccount } from '../aggregates/spending-account.aggregate.js';

/**
 * Repository for {@link SpendingAccount} aggregates.
 */
@Injectable()
export class SpendingAccountRepository extends BaseRepository<'spending_accounts', SpendingAccount> {
  protected readonly tableName = 'spending_accounts' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<SpendingAccount | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['spending_accounts']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<SpendingAccount[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['spending_accounts']));
  }

  async save(entity: SpendingAccount): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['spending_accounts']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['spending_accounts']>);
    }
  }

  private toAggregate(row: Database['spending_accounts']): SpendingAccount {
    return new SpendingAccount({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      accountType: row.account_type,
      annualElection: row.annual_election,
      usedAmount: row.used_amount,
      availableAmount: row.available_amount,
      currency: row.currency,
      status: row.status as 'ACTIVE' | 'SUSPENDED' | 'CLOSED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at as unknown as Date,
      updatedAt: row.updated_at as unknown as Date,
    });
  }

  private toRow(entity: SpendingAccount): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      account_type: entity.accountType,
      annual_election: entity.annualElection,
      used_amount: entity.usedAmount,
      available_amount: entity.availableAmount,
      currency: entity.currency,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
