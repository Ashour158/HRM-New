import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { EmploymentContract, type EmploymentContractState } from '../aggregates/employment-contract.aggregate.js';

export interface EmploymentContractExpiryAlertRow {
  workerId: string;
  contractId: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

/**
 * Repository for {@link EmploymentContract} aggregates.
 */
@Injectable()
export class EmploymentContractRepository extends BaseRepository<'employment_contracts', EmploymentContract> {
  protected readonly tableName = 'employment_contracts' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<EmploymentContract | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['employment_contracts']) : undefined;
  }

  async findByIdForTenant(id: Uuid, tenantId: Uuid): Promise<EmploymentContract | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('id', '=', id.value)
      .where('tenant_id', '=', tenantId.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Database['employment_contracts']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<EmploymentContract[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['employment_contracts']));
  }

  async findByWorkerForTenant(workerId: Uuid, tenantId: Uuid): Promise<EmploymentContract[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['employment_contracts']));
  }

  async findExpiringWithin(days: number): Promise<EmploymentContractExpiryAlertRow[]> {
    return this.findExpiringWithinForTenant(days);
  }

  async findExpiringWithinForTenant(days: number, tenantId?: Uuid): Promise<EmploymentContractExpiryAlertRow[]> {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() + days);
    let query = this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('end_date', 'is not', null)
      .where('end_date', '<=', cutoff);
    if (tenantId) {
      query = query.where('tenant_id', '=', tenantId.value);
    }
    const rows = await query.execute();

    return rows
      .map((row) => ({
        workerId: row.worker_id,
        contractId: row.id,
        expiryDate: this.isoDate(row.end_date),
        daysUntilExpiry: this.daysUntil(row.end_date),
      }))
      .filter((alert): alert is EmploymentContractExpiryAlertRow => Boolean(alert.expiryDate))
      .sort((left, right) => left.daysUntilExpiry - right.daysUntilExpiry);
  }

  async save(entity: EmploymentContract): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['employment_contracts']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['employment_contracts']>);
    }
  }

  private toAggregate(row: Database['employment_contracts']): EmploymentContract {
    return new EmploymentContract({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      contractType: row.contract_type,
      startDate: row.start_date,
      endDate: row.end_date ?? undefined,
      terms: (row.terms as Record<string, unknown>) ?? undefined,
      signedAt: row.signed_at ?? undefined,
      state: row.state as EmploymentContractState,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: EmploymentContract): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      contract_type: entity.contractType,
      start_date: entity.startDate,
      end_date: entity.endDate ?? null,
      terms: entity.terms ?? null,
      signed_at: entity.signedAt ?? null,
      state: entity.state,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }

  private isoDate(value: Date | string | null | undefined): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  private daysUntil(value: Date | string | null | undefined): number {
    if (!value) return Number.POSITIVE_INFINITY;
    const expiry = value instanceof Date ? value : new Date(value);
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const expiryDay = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
    return Math.ceil((expiryDay - today) / (24 * 60 * 60 * 1000));
  }
}
